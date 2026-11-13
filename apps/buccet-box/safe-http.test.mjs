import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { fetchBuccetApprovedDestination } from "../../src/box/safe-http.ts";

async function server(handler) {
  const s = http.createServer(handler);
  await new Promise((resolve) => s.listen(0, "127.0.0.1", resolve));
  const address = s.address();
  if (!address || typeof address === "string") throw new Error("server not listening");
  return { s, origin: `http://127.0.0.1:${address.port}` };
}
function close(s) { return new Promise((resolve, reject) => s.close((e) => e ? reject(e) : resolve())); }

test("a permitted URL cannot redirect to an unadjudicated destination", async () => {
  let outerHits = 0;
  let forbiddenHits = 0;
  const forbidden = await server((_req, res) => {
    forbiddenHits++;
    res.writeHead(200); res.end("forbidden-reached");
  });
  const allowed = await server((_req, res) => {
    outerHits++;
    res.writeHead(302, { Location: `${forbidden.origin}/not-authorized` });
    res.end("redirect");
  });
  try {
    await assert.rejects(
      () => fetchBuccetApprovedDestination(`${allowed.origin}/allowed`, { method: "GET", headers: {} }),
      /fetch failed|redirect/i,
    );
    assert.equal(outerHits, 1);
    assert.equal(forbiddenHits, 0, "SECURITY BYPASS: redirected destination received an HTTP request");
  } finally {
    await close(allowed.s);
    await close(forbidden.s);
  }
});

test("non-redirected request can complete through the same executor", async () => {
  let hits = 0;
  const allowed = await server((_req, res) => {
    hits++;
    res.writeHead(200, { "Content-Type": "text/plain" }); res.end("ok");
  });
  try {
    const res = await fetchBuccetApprovedDestination(`${allowed.origin}/safe`, {
      method: "GET", headers: {},
    });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "ok");
    assert.equal(hits, 1);
  } finally {
    await close(allowed.s);
  }
});
