import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBuccetBoxBackend } from "./backend.mjs";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function poll(fn, t = 4000) { const e = Date.now() + t;
  while (Date.now() < e) { const v = fn(); if (v) return v; await delay(20); }
  throw new Error("poll timeout"); }

async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "buccet-bind-"));
  const box = createBuccetBoxBackend({ home: dir, notify: () => {} });
  const { origin } = await box.start();
  const token = JSON.parse(await readFile(path.join(dir, "box", "bridge.json"), "utf8")).token;
  t.after(async () => { await box.stop(); await rm(dir, { recursive: true, force: true }); });
  const approve = (body) => fetch(new URL("/v1/approval", origin), { method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
  const mk = (id, target) => ({ requestId: id, sessionId: "s", actorId: "agent", actionKind: "fs.write", target, reason: id, payloadSummary: "p", lawIds: [], question: "q" });
  return { box, approve, mk };
}

test("each held request carries a stable canonical fingerprint", async (t) => {
  const { box, approve, mk } = await fixture(t);
  const p = approve(mk("A", "/ws/a.txt"));
  const row = await poll(() => box.state().pending[0]);
  assert.match(row.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(box.state().pending[0].fingerprint, row.fingerprint, "fingerprint is stable");
  box.settle(row.approvalId, "deny_once"); await p;
});

test("a decision bound to the WRONG fingerprint is refused", async (t) => {
  const { box, approve, mk } = await fixture(t);
  const p = approve(mk("A", "/ws/a.txt"));
  const row = await poll(() => box.state().pending[0]);
  assert.equal(box.settle(row.approvalId, "allow_once", { fingerprint: "deadbeef" }), false);
  assert.ok(box.state().pending[0], "request remains held after a mismatched decision");
  box.settle(row.approvalId, "deny_once"); await p;
});

test("ALLOW is refused until the review dwell elapses; DENY is immediate", async (t) => {
  const { box, approve, mk } = await fixture(t);
  const p = approve(mk("A", "/ws/a.txt"));
  const row = await poll(() => box.state().pending[0]);
  assert.ok(row.reviewReadyInMs > 0, "fresh request is not review-ready");
  assert.equal(box.settle(row.approvalId, "allow_once", { fingerprint: row.fingerprint }), false, "fast allow refused");
  await delay(720);
  assert.equal(box.state().pending[0].reviewReadyInMs, 0, "review-ready after dwell");
  assert.equal(box.settle(row.approvalId, "allow_once", { fingerprint: row.fingerprint }), true, "allow accepted after dwell");
  assert.deepEqual(await p, { mode: "interactive", choice: "allow_once" });
});

test("auto-advance cannot be fast-allowed: the promoted request has its own dwell", async (t) => {
  const { box, approve, mk } = await fixture(t);
  const pA = approve(mk("A-benign", "/ws/report.txt"));
  const rowA = await poll(() => box.state().pending[0]);
  const pB = approve(mk("B-danger", "/ws/.env"));
  await poll(() => box.state().pending.length === 2);
  await delay(720);                                   // dwell for A
  assert.equal(box.settle(rowA.approvalId, "allow_once", { fingerprint: rowA.fingerprint }), true);
  await pA;
  // B is now the head; its review clock just started — a fast allow must fail.
  const rowB = await poll(() => box.state().pending[0]);
  assert.equal(rowB.requestId, "B-danger");
  assert.ok(rowB.reviewReadyInMs > 0, "promoted request restarts the dwell");
  assert.equal(box.settle(rowB.approvalId, "allow_once", { fingerprint: rowB.fingerprint }), false, "fast allow of promoted request refused");
  box.settle(rowB.approvalId, "deny_once"); await pB;
});
