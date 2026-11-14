import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBuccetBoxBackend } from "./backend.mjs";
import { loadBuccetBoxBridge } from "../../src/box/bridge.ts";
import { appendBoundaryLedger } from "../../src/proof/ledger.ts";

async function fixture(t) {
  const home = await mkdtemp(path.join(os.tmpdir(), "buccet-box-bridge-"));
  const box = createBuccetBoxBackend({ home, notify: () => {} });
  const bridgeFile = path.join(home, "box", "bridge.json");
  const { origin } = await box.start();
  const former = process.env.BUCCET_BOX_BRIDGE_FILE;
  const formerHome = process.env.AGENT_BUCCET_HOME;
  process.env.BUCCET_BOX_BRIDGE_FILE = bridgeFile;
  process.env.AGENT_BUCCET_HOME = home;
  t.after(async () => {
    if (former === undefined) delete process.env.BUCCET_BOX_BRIDGE_FILE;
    else process.env.BUCCET_BOX_BRIDGE_FILE = former;
    if (formerHome === undefined) delete process.env.AGENT_BUCCET_HOME;
    else process.env.AGENT_BUCCET_HOME = formerHome;
    await box.stop();
    await rm(home, { recursive: true, force: true });
  });
  return { box, bridgeFile, origin };
}

const proposal = {
  requestId: "isolated-proposal-1",
  sessionId: "unit-test-session",
  actorId: "hermes",
  actionKind: "network.send",
  target: "https://example.org/submit",
  reason: "external destination not authorized",
  lawIds: ["BOUNDARY.NETWORK.SEND.01"],
  payloadSummary: "test payload",
  question: "Should Hermes contact this destination?",
};

async function waitPending(box) {
  for (let i = 0; i < 200; i++) {
    const pending = box.state().pending[0];
    if (pending) return pending;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail("no pending approval reached the box");
}

test("actual MCP-side bridge client delivers the UPL question and receives one human choice", async (t) => {
  const { box } = await fixture(t);
  const bridge = await loadBuccetBoxBridge();
  assert.ok(bridge);
  // The legitimate runtime, not the token holder, signs the pending action.
  // The same unsigned request is rejected by the compromised-token attack.
  await appendBoundaryLedger("APPROVAL_REQUESTED", {
    sessionId: proposal.sessionId,
    actorId: proposal.actorId,
    requestId: proposal.requestId,
    actionKind: proposal.actionKind,
    target: proposal.target,
    decision: "require_approval",
    reason: proposal.reason,
    lawIds: proposal.lawIds,
    metadata: {
      approvalPayloadHash: createHash("sha256").update(proposal.payloadSummary ?? "").digest("hex"),
    },
    createdAt: new Date().toISOString(),
  });
  const pendingAnswer = bridge.requestApproval(proposal);
  const held = await waitPending(box);
  assert.equal(held.requestId, proposal.requestId);
  assert.equal(held.actorId, proposal.actorId);
  assert.equal(held.target, proposal.target);
  assert.equal(box.settle(held.approvalId, "allow_once"), true);
  assert.deepEqual(await pendingAnswer, { mode: "interactive", choice: "allow_once" });
  assert.equal(box.settle(held.approvalId, "allow_once"), false);
});

test("autonomous mode is notification-only and bridge does not mint approval", async (t) => {
  const { box } = await fixture(t);
  const bridge = await loadBuccetBoxBridge();
  assert.ok(bridge);
  await box.setMode("autonomous");
  const response = await bridge.requestApproval(proposal);
  assert.deepEqual(response, { mode: "autonomous" });
  assert.equal(box.state().pending.length, 0);
  await appendBoundaryLedger("ACTION_BLOCKED", {
    sessionId: proposal.sessionId,
    actorId: proposal.actorId,
    requestId: proposal.requestId,
    actionKind: proposal.actionKind,
    target: proposal.target,
    decision: "deny",
    reason: "standing UPL has no matching acceptance",
    createdAt: new Date().toISOString(),
  });
  await bridge.record({
    requestId: proposal.requestId,
    actorId: proposal.actorId,
    actionKind: proposal.actionKind,
    target: proposal.target,
    decision: "deny",
    reason: "standing UPL has no matching acceptance",
  });
  assert.equal(box.state().activity.length, 1);
  assert.equal(box.state().activity[0].decision, "deny");
});

test("missing bridge fails safe with no local authorization", async (t) => {
  const { box, bridgeFile } = await fixture(t);
  const bridge = await loadBuccetBoxBridge();
  assert.ok(bridge);
  await box.stop();
  assert.deepEqual(await bridge.requestApproval(proposal), {
    mode: "interactive",
    choice: "deny_once",
  });
  await assert.rejects(() => readFile(bridgeFile, "utf8"), { code: "ENOENT" });
});

test("invalid bridge credentials cannot be promoted to authority", async (t) => {
  const { bridgeFile } = await fixture(t);
  const { writeFile } = await import("node:fs/promises");
  await writeFile(bridgeFile, JSON.stringify({
    version: 1,
    origin: "http://attacker.invalid:4444/",
    token: "a".repeat(64),
  }), { mode: 0o600 });
  await assert.rejects(() => loadBuccetBoxBridge(), /Invalid Buccet Box bridge/);
});
