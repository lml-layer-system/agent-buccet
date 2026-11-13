/**
 * Proactive boundary invariant: a signed proposal is not a reusable bearer
 * instrument. All writes are to a disposable home and a synthetic ledger.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBuccetBoxBackend } from "./backend.mjs";
import { appendBoundaryLedger } from "../../src/proof/ledger.ts";

async function waitUntil(predicate, label) {
  for (let i = 0; i < 300; i++) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.fail("no state transition observed: " + label);
}

const intent = {
  requestId: "verified-intent-01",
  sessionId: "synthetic-security-session",
  actorId: "agent:test",
  actionKind: "fs.write",
  target: "/workspace/synthetic.txt",
  payloadSummary: "sha256:test-only-payload",
};

async function fixture(t) {
  const home = await mkdtemp(path.join(os.tmpdir(), "buccet-consumption-"));
  const previous = process.env.AGENT_BUCCET_HOME;
  process.env.AGENT_BUCCET_HOME = home;
  let box = createBuccetBoxBackend({ home, notify: () => {} });
  let origin = (await box.start()).origin;
  let token = JSON.parse(await readFile(path.join(home, "box/bridge.json"), "utf8")).token;
  t.after(async () => {
    await box.stop();
    if (previous === undefined) delete process.env.AGENT_BUCCET_HOME;
    else process.env.AGENT_BUCCET_HOME = previous;
    await rm(home, { force: true, recursive: true });
  });
  await appendBoundaryLedger("APPROVAL_REQUESTED", {
    sessionId: intent.sessionId,
    actorId: intent.actorId,
    requestId: intent.requestId,
    actionKind: intent.actionKind,
    target: intent.target,
    decision: "require_approval",
    reason: "test-only valid pending intent",
    lawIds: [],
    metadata: {
      approvalPayloadHash: createHash("sha256").update(intent.payloadSummary).digest("hex"),
    },
    createdAt: new Date().toISOString(),
  });
  const post = (signal) => fetch(new URL("/v1/approval", origin), {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(intent),
    signal,
  });
  return {
    home,
    post,
    state: () => box.state(),
    settle: (id, choice) => box.settle(id, choice),
    async restart() {
      await box.stop();
      box = createBuccetBoxBackend({ home, notify: () => {} });
      origin = (await box.start()).origin;
      token = JSON.parse(await readFile(path.join(home, "box/bridge.json"), "utf8")).token;
    },
    async stop() { await box.stop(); },
  };
}

test("signed approval is consumed exactly once, even after denial", async (t) => {
  const f = await fixture(t);
  const first = f.post();
  await waitUntil(() => f.state().pending.length === 1, "original intent prompt");
  const row = f.state().pending[0];
  assert.equal(f.settle(row.approvalId, "deny_once"), true);
  assert.deepEqual(await (await first).json(), { mode: "interactive", choice: "deny_once" });
  const replay = await f.post();
  assert.equal(replay.status, 409, "denied signed intent must not be replayable");
  assert.equal(f.state().pending.length, 0);
});

test("a held request is never rearmed by a disconnect", async (t) => {
  const f = await fixture(t);
  const abort = new AbortController();
  const first = f.post(abort.signal).catch(() => null);
  await waitUntil(() => f.state().pending.length === 1, "original pending intent");
  abort.abort();
  await first;
  await waitUntil(() => f.state().pending.length === 0, "disconnected intent retirement");
  assert.equal((await f.post()).status, 409);
});

test("restart cannot re-expose an already consumed signed intent", async (t) => {
  const f = await fixture(t);
  const first = f.post();
  await waitUntil(() => f.state().pending.length === 1, "pending prompt");
  f.settle(f.state().pending[0].approvalId, "deny_once");
  await first;
  await f.restart();
  const replay = await f.post();
  assert.equal(replay.status, 409);
  assert.equal(f.state().pending.length, 0);
});

test("a corrupted approval-consumption journal fails closed", async (t) => {
  const f = await fixture(t);
  const first = f.post();
  await waitUntil(() => f.state().pending.length === 1, "pending prompt");
  f.settle(f.state().pending[0].approvalId, "deny_once");
  await first;
  await f.stop();
  await writeFile(path.join(f.home, "box/approval-claims.json"), '{"unexpected":"shape"}');
  const corrupted = createBuccetBoxBackend({ home: f.home, notify: () => {} });
  await assert.rejects(corrupted.start(), /approval claim store invalid/);
  assert.equal(corrupted.state().running, false);
});

test("two concurrent presentations cannot both become operator prompts", async (t) => {
  const f = await fixture(t);
  const first = f.post();
  await waitUntil(() => f.state().pending.length === 1, "first claim");
  const second = await f.post();
  assert.equal(second.status, 409);
  assert.equal(f.state().pending.length, 1);
  f.settle(f.state().pending[0].approvalId, "deny_once");
  await first;
});
