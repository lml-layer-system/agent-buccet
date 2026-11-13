import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBuccetBoxBackend } from "./backend.mjs";

async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "buccet-box-test-"));
  const seen = [];
  const box = createBuccetBoxBackend({
    home: dir,
    onChange: (state) => seen.push(state),
    notify: () => {},
  });
  const { origin } = await box.start();
  const token = JSON.parse(await readFile(path.join(dir, "box", "bridge.json"), "utf8")).token;
  t.after(async () => { await box.stop(); await rm(dir, { recursive: true, force: true }); });
  async function request(route, payload, auth = token) {
    return fetch(new URL(route, origin), {
      method: "POST",
      headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
  return { box, token, seen, request };
}

const action = {
  requestId: "req-1",
  actorId: "hermes",
  actionKind: "network.send",
  target: "https://example.org",
  reason: "outside standing scope",
  lawIds: ["TEST.LAW.1"],
  question: "Allow this endpoint?",
};

test("unprivileged clients cannot access local bridge", async (t) => {
  const { request } = await fixture(t);
  assert.equal((await request("/v1/event", { decision: "allow" }, "fake")).status, 401);
  assert.equal((await request("/not-found", {}, "fake")).status, 401);
});

test("interactive holds until a human decides, without executing anything", async (t) => {
  const { box, request } = await fixture(t);
  const responsePromise = request("/v1/approval", action).then((r) => r.json());
  for (let i = 0; i < 50 && !box.state().pending.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const [pending] = box.state().pending;
  assert.ok(pending, "approval must become visible");
  assert.equal(pending.target, action.target);
  assert.equal(box.settle(pending.approvalId, "allow_once"), true);
  assert.deepEqual(await responsePromise, { mode: "interactive", choice: "allow_once" });
  assert.equal(box.state().pending.length, 0);
  assert.equal(box.settle(pending.approvalId, "allow_once"), false, "cannot decide twice");
});

test("autonomous answers without interrupting and does not authorize", async (t) => {
  const { box, request } = await fixture(t);
  await box.setMode("autonomous");
  const response = await request("/v1/approval", action);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { mode: "autonomous" });
  assert.equal(box.state().pending.length, 0);
});

test("switching modes denies pending decisions rather than approving them", async (t) => {
  const { box, request } = await fixture(t);
  const pendingResponse = request("/v1/approval", action).then((r) => r.json());
  for (let i = 0; i < 50 && !box.state().pending.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(box.state().pending.length, 1);
  await box.setMode("autonomous");
  assert.deepEqual(await pendingResponse, { mode: "interactive", choice: "deny_once" });
  assert.equal(box.state().pending.length, 0);
});

test("allow and deny events are stored for the bank-style activity feed", async (t) => {
  const { box, request } = await fixture(t);
  for (const decision of ["allow", "deny"]) {
    const response = await request("/v1/event", { ...action, decision });
    assert.equal(response.status, 200);
  }
  assert.deepEqual(box.state().activity.map((x) => x.decision), ["deny", "allow"]);
  assert.equal(box.state().activity[0].target, action.target);
  assert.equal((await request("/v1/event", { ...action, decision: "require_approval" })).status, 400);
});
