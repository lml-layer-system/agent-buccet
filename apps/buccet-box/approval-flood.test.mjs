/**
 * BOX-02 adversarial transport tests.
 * A caller with the local bridge capability must not keep abandoned approval
 * prompts alive or exhaust unbounded operator state. Disposable home only.
 */
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBuccetBoxBackend } from "./backend.mjs";

const MAX_EXPECTED_PENDING = 32;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(condition, label, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await pause(10);
  }
  assert.fail("timeout waiting for " + label);
}

async function fixture(t) {
  const home = await mkdtemp(path.join(os.tmpdir(), "buccet-approval-flood-"));
  const box = createBuccetBoxBackend({ home, notify: () => {}, onChange: () => {} });
  const { origin } = await box.start();
  const { token } = JSON.parse(await readFile(path.join(home, "box", "bridge.json"), "utf8"));
  const clients = [];
  t.after(async () => {
    for (const client of clients) client.abort();
    for (const row of box.state().pending) box.settle(row.approvalId, "deny_once");
    await box.stop();
    await rm(home, { recursive: true, force: true });
  });
  function post(requestId) {
    const body = JSON.stringify({
      requestId, actorId: "agent:redteam", actionKind: "fs.write",
      target: "/tmp/buccet-disposable/only", reason: "adversarial queue pressure",
    });
    const req = httpRequest(new URL("/v1/approval", origin), {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    });
    const result = new Promise((resolve, reject) => {
      req.on("response", (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve({
          status: response.statusCode,
          body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
        }));
        response.on("error", reject);
      });
      req.on("error", reject);
    });
    // Cancellation is expected in this test; avoid unhandled rejections.
    result.catch(() => {});
    req.end(body);
    const client = { abort: () => req.destroy(), result };
    clients.push(client);
    return client;
  }
  return { box, post };
}

test("aborted approval transport immediately removes stale operator prompt", async (t) => {
  const { box, post } = await fixture(t);
  const abandoned = post("abandoned-approval");
  await waitFor(() => box.state().pending.length === 1, "held request");
  abandoned.abort();
  await waitFor(() => box.state().pending.length === 0, "abandoned approval cancellation", 1500);
  assert.equal(box.state().pending.length, 0);
  assert.equal(box.settle("abandoned-approval", "allow_once"), false);
  const live = post("live-followup");
  await waitFor(() => box.state().pending.length === 1, "new live approval");
  assert.ok(box.settle(box.state().pending[0].approvalId, "allow_once"));
  assert.deepEqual(await live.result, { status: 200, body: { mode: "interactive", choice: "allow_once" } });
});

test("approval queue saturates at a finite budget and rejects excess requests", async (t) => {
  const { box, post } = await fixture(t);
  const held = Array.from({ length: MAX_EXPECTED_PENDING },
    (_, i) => post("pressure-" + i));
  await waitFor(() => box.state().pending.length === MAX_EXPECTED_PENDING, "full approval queue");
  const overflow = post("pressure-overflow");
  overflow.result.then(() => { overflow.resultSettled = true; }, () => { overflow.resultSettled = true; });
  // On a broken backend, the 33rd request becomes a new pending prompt.
  // Never await the unresolved HTTP response when proving that defect.
  await waitFor(() => box.state().pending.length > MAX_EXPECTED_PENDING ||
    overflow.resultSettled === true, "overflow adjudication", 500);
  assert.ok(box.state().pending.length <= MAX_EXPECTED_PENDING,
    "unbounded approval queue admitted the 33rd prompt");
  const result = await overflow.result;
  assert.equal(result.status, 429, "excess requests must receive backpressure");
  assert.equal(box.state().pending.length, MAX_EXPECTED_PENDING);
  for (const row of box.state().pending) box.settle(row.approvalId, "deny_once");
  assert.equal((await Promise.all(held.map((x) => x.result))).length, MAX_EXPECTED_PENDING);
  assert.equal(box.state().pending.length, 0);
});
