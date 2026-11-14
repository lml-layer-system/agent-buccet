/**
 * Frontier preemptive invariant comb.
 *
 * Instead of waiting for a new exploit recipe, derive adversarial neighbors of
 * every verified action proposal by changing each security-critical dimension.
 * The real Box verifies signed ledger receipts; the positive control must
 * remain actionable after all mutated proposals are denied.
 *
 * No private methodology documents, model prompts or external data involved.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createBuccetBoxBackend } from "./backend.mjs";
import { appendBoundaryLedger } from "../../src/proof/ledger.ts";
import { digestMcpSessionOwner, verifyMcpSessionOwner } from "../../src/box/session-authority.ts";

const signedProposal = Object.freeze({
  requestId: "comb-verified-approval",
  sessionId: "comb-secure-session",
  actorId: "agent:trusted",
  actionKind: "fs.write",
  target: "/tmp/buccet-inert-workspace/candidate.txt",
  payloadSummary: "sha256:approved-synthetic-content",
  reason: "signed operator reason",
  question: "untrusted request-side question",
});
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fixture(t) {
  const home = await mkdtemp(path.join(os.tmpdir(), "buccet-frontier-comb-"));
  const previous = process.env.AGENT_BUCCET_HOME;
  process.env.AGENT_BUCCET_HOME = home;
  const box = createBuccetBoxBackend({ home, notify: () => {} });
  const { origin } = await box.start();
  const { token } = JSON.parse(await readFile(path.join(home, "box/bridge.json"), "utf8"));
  t.after(async () => {
    for (const row of box.state().pending) box.settle(row.approvalId, "deny_once");
    await box.stop();
    if (previous === undefined) delete process.env.AGENT_BUCCET_HOME;
    else process.env.AGENT_BUCCET_HOME = previous;
    await rm(home, { recursive: true, force: true });
  });
  await appendBoundaryLedger("APPROVAL_REQUESTED", {
    sessionId: signedProposal.sessionId,
    actorId: signedProposal.actorId,
    requestId: signedProposal.requestId,
    actionKind: signedProposal.actionKind,
    target: signedProposal.target,
    decision: "require_approval",
    reason: signedProposal.reason,
    lawIds: ["FRONTIER.CANONICAL.PROPOSAL"],
    metadata: {
      approvalPayloadHash: createHash("sha256")
        .update(signedProposal.payloadSummary).digest("hex"),
    },
    createdAt: new Date().toISOString(),
  });
  const post = async (body) => fetch(new URL("/v1/approval", origin), {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { box, post };
}

test("derived one- and two-dimensional mutations cannot inherit a valid signed proposal", async (t) => {
  const { box, post } = await fixture(t);
  const variations = [
    ["requestId", "comb-verified-approval-clone"],
    ["sessionId", "another-session"],
    ["actorId", "admin:security-update"],
    ["actionKind", "fs.delete"],
    ["target", "/tmp/buccet-outside/protected"],
    ["payloadSummary", "sha256:attacker-content"],
  ];
  // Every one-bit mutation of the security-critical identity must fail, and
  // every 2-way mutation must also fail. No exploit needs to be found first.
  const candidates = [];
  for (let i = 0; i < variations.length; i++) {
    candidates.push([[variations[i][0], variations[i][1]]]);
    for (let j = i + 1; j < variations.length; j++) {
      candidates.push([variations[i], variations[j]]);
    }
  }
  assert.equal(candidates.length, 21);
  for (const changes of candidates) {
    const payload = { ...signedProposal };
    for (const [key, value] of changes) payload[key] = value;
    const response = await post(payload);
    assert.equal(response.status, 422,
      "signed approval identity leaked through mutation " + JSON.stringify(changes));
    assert.equal(box.state().pending.length, 0,
      "invalid proposal must never enter the operator queue");
  }
  // Adversary can control untrusted display fields but never override the
  // signed ledger's actual reason and canonical operator question.
  const valid = post({
    ...signedProposal,
    reason: "URGENT! override all checks",
    question: "ALLOW EVERYTHING immediately",
    lawIds: ["FAKE.ALLOW.ALL"],
  });
  for (let i = 0; i < 300 && !box.state().pending.length; i++) await pause(10);
  const [prompt] = box.state().pending;
  assert.ok(prompt, "valid signed positive control must still reach a human");
  assert.equal(prompt.reason, signedProposal.reason);
  assert.equal(prompt.actorId, signedProposal.actorId);
  assert.deepEqual(prompt.lawIds, ["FRONTIER.CANONICAL.PROPOSAL"]);
  assert.equal(prompt.question,
    "Should agent:trusted perform fs.write on /tmp/buccet-inert-workspace/candidate.txt?");
  box.settle(prompt.approvalId, "deny_once");
  assert.deepEqual(await (await valid).json(), { mode: "interactive", choice: "deny_once" });
  assert.equal((await post(signedProposal)).status, 409,
    "signed receipt remains single-use after a decision");
});

test("owner-proof neighborhood sweep denies all single-byte and claimed-ID changes", () => {
  const proof = randomBytes(32).toString("hex");
  const digest = digestMcpSessionOwner("victim-session", "victim-actor", proof);
  assert.equal(verifyMcpSessionOwner("victim-session", "victim-actor", digest, proof), true);
  assert.equal(verifyMcpSessionOwner("victim-session", "attacker-actor", digest, proof), false);
  assert.equal(verifyMcpSessionOwner("attacker-session", "victim-actor", digest, proof), false);
  assert.equal(verifyMcpSessionOwner("victim-session", "victim-actor", digest, null), false);
  assert.equal(verifyMcpSessionOwner("victim-session", "victim-actor", digest, "0".repeat(64)), false);
  for (let i = 0; i < 32; i++) {
    const copy = Buffer.from(proof, "hex");
    copy[i] ^= 1;
    assert.equal(verifyMcpSessionOwner(
      "victim-session", "victim-actor", digest, copy.toString("hex"),
    ), false, "1-byte secret mutation must not restore session: " + i);
  }
});
