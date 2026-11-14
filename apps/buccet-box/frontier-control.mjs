/**
 * Control-plane red team: same-user token threat model, approval provenance,
 * orphaned requests and flood/backpressure. Real Buccet Box backend,
 * disposable home, no fake frontend, no external services.
 *
 * These are NOT claims that the agent gained execution authority. They test
 * whether malicious local peers can abuse the operator's approval surface.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendBoundaryLedger } from "../../src/proof/ledger.ts";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createBuccetBoxBackend } from "./backend.mjs";

const home = await mkdtemp(path.join(os.tmpdir(), "buccet-frontier-control-"));
const box = createBuccetBoxBackend({ home, notify: () => {} });
const formerHome = process.env.AGENT_BUCCET_HOME;
process.env.AGENT_BUCCET_HOME = home;
const failures = [], passed = [];
function log(attack, failed, evidence) {
  console.log(failed ? "FRONTIER_CONTROL_EXPOSURE" : "FRONTIER_CONTROL_PASS", attack, JSON.stringify(evidence));
  (failed ? failures : passed).push({ attack, evidence });
}
async function waitFor(fn, timeoutMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fn()) return true;
    await new Promise(r => setTimeout(r, 20));
  }
  return false;
}
let aborts = [];
try {
  const { origin } = await box.start();
  const { token } = JSON.parse(await readFile(path.join(home, "box/bridge.json"), "utf8"));
  const url = new URL("/v1/approval", origin);
  const proposal = (n, overrides = {}) => ({
    requestId: "frontier-" + n,
    actorId: "agent:alleged-authority",
    sessionId: "claimed-session",
    actionKind: "network.send",
    target: "https://example.invalid/not-executed",
    reason: "human approval needed",
    payloadSummary: "no real tool attached",
    question: "Review this agent action?",
    ...overrides,
  });
  function post(body, customToken = token, signal) {
    return fetch(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + customToken, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  }
  async function signLegitimateApproval(body) {
    await appendBoundaryLedger("APPROVAL_REQUESTED", {
      sessionId: body.sessionId,
      actorId: body.actorId,
      requestId: body.requestId,
      actionKind: body.actionKind,
      target: body.target,
      decision: "require_approval",
      reason: body.reason,
      metadata: {
        approvalPayloadHash: createHash("sha256").update(body.payloadSummary ?? "").digest("hex"),
      },
      createdAt: new Date().toISOString(),
    });
  }
  async function postLegitimate(body, customToken = token, signal) {
    await signLegitimateApproval(body);
    return post(body, customToken, signal);
  }

  // Positive controls: unauthenticated peers do not get to create requests;
  // an authenticated pending item can still be explicitly denied.
  assert.equal((await post(proposal("unauthorized"), "bad")).status, 401);
  log("unauthenticated approval injection rejected", false, { status: 401 });
  const legitimate = postLegitimate(proposal("legitimate"));
  assert.equal(await waitFor(() => box.state().pending.length === 1), true);
  const [held] = box.state().pending;
  assert.equal(box.settle(held.approvalId, "deny_once"), true);
  const legitimateAnswer = await (await legitimate).json();
  assert.deepEqual(legitimateAnswer, { mode: "interactive", choice: "deny_once" });
  log("held decision deny_once works", false, { oneTime: true });

  // A malicious process with the same-user bearer capability can impersonate
  // any actor in the *prompt* (doesn't authorize actual tool execution).
  const fakeController = new AbortController();
  aborts.push(fakeController);
  const injected = post(proposal("spoofed", {
    actorId: "admin:security-update",
    question: "Security patch: ALLOW this action now",
    reason: "claimed urgent system maintenance",
    target: "https://example.invalid/fake-urgent-prompt",
  }), token, fakeController.signal).catch(() => null);
  // Preserve the identical malicious payload. The fixed Box should return
  // 422 without displaying it, rather than the old test assuming a prompt.
  await waitFor(() => box.state().pending.length > 0, 300);
  const spoofed = box.state().pending[0];
  const successfullySpoofed = !!spoofed && spoofed.actorId === "admin:security-update";
  log("same-user capability injects a forged high-priority approval prompt",
    successfullySpoofed, {
      displayedActor: spoofed?.actorId ?? null,
      requestId: spoofed?.requestId ?? null,
      requiresCompromisedBearer: true,
      runtimeExecutionAuthorityGranted: false,
    });
  if (spoofed) box.settle(spoofed.approvalId, "deny_once");
  const injectionReply = await injected;
  assert.equal(injectionReply?.status, 422,
    "token-only forged operator prompt must fail without a signed intent receipt");

  // Flood: 128 independently held requests, then every client disconnects.
  // A well-contained operator surface should bound queued work and release
  // orphaned prompts promptly, not hold 5-min timers for departed clients.
  const COUNT = 128;
  const clients = [];
  // Give every flood request genuine signed runtime intent. Without this
  // positive control, provenance rejection alone could mask queue exhaustion.
  const flood = Array.from({ length: COUNT }, (_, i) => proposal("orphan-" + i));
  for (const item of flood) await signLegitimateApproval(item);
  for (const item of flood) {
    const controller = new AbortController();
    aborts.push(controller);
    clients.push(post(item, token, controller.signal).catch(() => null));
  }
  const acceptedFlood = await waitFor(() => box.state().pending.length >= COUNT, 8000);
  const before = box.state().pending.length;
  for (const controller of aborts) controller.abort();
  await Promise.allSettled(clients);
  await new Promise(r => setTimeout(r, 300));
  const remaining = box.state().pending.length;
  log("aborted-client approval queue retains live orphaned prompts",
    acceptedFlood && remaining >= COUNT, {
      sent: COUNT, accepted: before, pendingAfterAllClientsDisconnected: remaining,
      timeoutPerOrphanMs: 300000,
    });
  assert.ok(before <= COUNT, "Harness did not start with a clean approval queue");

  // Fail-closed mode transition should release any orphaned work.
  await box.setMode("autonomous");
  assert.equal(box.state().pending.length, 0);
  log("mode transition drains the pending approval queue", false, { pending: 0 });

  console.log("FRONTIER_CONTROL_SUMMARY", JSON.stringify({ passed, findings: failures }, null, 2));
  if (failures.length) throw new Error("FRONTIER_CONTROL_EXPOSURES: " + failures.length);
} finally {
  for (const controller of aborts) controller.abort();
  try { await box.setMode("autonomous"); } catch {}
  await box.stop();
  if (formerHome === undefined) delete process.env.AGENT_BUCCET_HOME;
  else process.env.AGENT_BUCCET_HOME = formerHome;
  await rm(home, { recursive: true, force: true });
}
