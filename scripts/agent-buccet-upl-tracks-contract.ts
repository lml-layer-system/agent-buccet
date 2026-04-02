/**
 * UPL Tracks contract.
 *
 * Proves:
 * T1 — after standing UPL allow is recorded, the approved UPL entry has a trackConstraint set
 * T2 — a request inside the approved corridor is allowed without re-prompting
 * T3 — a request that exits the approved target corridor returns require_approval
 * T4 — UPL_TRACK_VIOLATED event appears in the ledger after a corridor exit
 * T5 — after deny_as_law, the denied UPL entry also has a trackConstraint set
 * T6 — a request inside the denied corridor is blocked without re-prompting
 */

import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  createBoundaryBodyguard,
  createPersistentBoundaryRuntimeStore,
  loadUserPathLedger,
  openBoundaryPath,
  readBoundaryLedgerBySession,
  saveUserPathLedger,
} from "../lib/agent-buccet/index.ts";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPending<T>(list: () => T[], timeoutMs = 5_000): Promise<T[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const items = list();
    if (items.length > 0) return items;
    await sleep(25);
  }
  return list();
}

async function main() {
  // Isolate UPL state for this contract run.
  const originalLedger = await loadUserPathLedger();

  try {
    await saveUserPathLedger({ specVersion: 1, userApprovedLawPaths: [], userDeniedLawPaths: [] });

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-tracks-"));
    const workspace = path.join(tempRoot, "workspace");
    const subdir = path.join(workspace, "subdir");
    await fs.mkdir(subdir, { recursive: true });

    const sessionId = `agent-buccet-upl-tracks-${Date.now()}`;
    const actorId = "user:upl-tracks-contract";

    let store = await createPersistentBoundaryRuntimeStore({ sessionId, actorId });

    // Open the workspace as a scoped path law and require explicit approval for fs.write
    // so we can exercise standing UPL allow track binding.
    const { config: scopedConfig } = await openBoundaryPath({
      config: store.getConfig(),
      rootPath: workspace,
      grantedActions: ["fs.write"],
      issuedBy: actorId,
      seedBaseAcceptance: false,
    });
    store.replaceConfig({
      ...scopedConfig,
      approvalRequiredFor: [...(scopedConfig.approvalRequiredFor ?? []), "fs.write"],
    });

    const bodyguard = createBoundaryBodyguard(store);

    // ─── T1 / T2: standing UPL allow binds a track corridor ─────────────────

    const approvedTarget = path.join(subdir, "output.txt");
    const approvedDir = subdir; // expected trackConstraint.targetPattern

    // First proposal — out-of-scope for the narrow scope, so it needs approval.
    const firstProposal = bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: approvedTarget,
      payloadSummary: "write result to output.txt",
      provenance: "agent_inference",
      execute: async () => "first-write-value",
      successReason: "wrote output.txt",
    });

    const pending = await waitForPending(() => bodyguard.approvals.listPending());
    assert.equal(pending.length, 1, "T1: expected one pending approval for the first fs.write");

    bodyguard.approvals.allowAsLaw(pending[0].approvalId);
    const firstResult = await firstProposal;
    assert.equal(firstResult.allowed, true, "T1: expected allow after user approved as law");

    // Read back the UPL entry.
    const upl = await loadUserPathLedger();
    const activeApproved = upl.userApprovedLawPaths.filter((e) => e.status === "ACTIVE");
    assert.ok(activeApproved.length > 0, "T1: expected at least one active approved UPL entry");

    const trackEntry = activeApproved[activeApproved.length - 1];
    assert.ok(trackEntry.trackConstraint, "T1: expected trackConstraint to be set on allow_as_law entry");
    assert.ok(
      trackEntry.trackConstraint.allowedActionKinds.includes("fs.write"),
      "T1: expected track to allow fs.write",
    );
    assert.equal(
      trackEntry.trackConstraint.targetPattern,
      approvedDir,
      "T1: expected track targetPattern to be the parent directory of the approved target",
    );

    console.log(`T1 ok: trackConstraint bound — kinds: ${trackEntry.trackConstraint.allowedActionKinds.join(",")} | pattern: ${trackEntry.trackConstraint.targetPattern}`);

    // ─── T2: identical request short-circuits via track (no re-prompt) ───────

    const sameTargetResult = await bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: approvedTarget,
      payloadSummary: "write result again",
      provenance: "agent_inference",
      execute: async () => "second-write-value",
      successReason: "wrote output.txt again",
    });

    assert.equal(sameTargetResult.allowed, true, "T2: expected allow for identical target — track not violated");
    assert.equal(sameTargetResult.requiresApproval, false, "T2: expected no re-prompt for track-compliant request");

    // A sibling file in the same subdir must also pass the track (same parent dir).
    const siblingTarget = path.join(subdir, "other.txt");
    const siblingResult = await bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: siblingTarget,
      payloadSummary: "write sibling file",
      provenance: "agent_inference",
      execute: async () => "sibling-value",
      successReason: "wrote sibling.txt",
    });
    assert.equal(siblingResult.allowed, true, "T2: expected allow for sibling file in same directory");

    console.log("T2 ok: track-compliant requests pass without re-prompt");

    // ─── T3: request that exits the approved target corridor → require_approval ──

    const outsideTarget = path.join(workspace, "other", "escape.txt");
    await fs.mkdir(path.join(workspace, "other"), { recursive: true });

    const escapePending: Promise<unknown>[] = [];
    const escapeProposal = bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: outsideTarget,
      payloadSummary: "write outside corridor",
      provenance: "agent_inference",
      execute: async () => {
        escapePending.push(Promise.resolve());
        return "should-require-re-approval";
      },
      successReason: "wrote escape.txt",
    });

    const corridorPending = await waitForPending(() => bodyguard.approvals.listPending());
    assert.ok(corridorPending.length > 0, "T3: expected corridor violation to surface as require_approval in Terminal 2");

    const corridorApproval = corridorPending[0];
    assert.ok(
      corridorApproval.request.reason.includes("exits approved execution corridor"),
      "T3: expected violation reason to mention 'exits approved execution corridor'",
    );

    // Deny it as law so we can prove deny tracks too.
    bodyguard.approvals.denyAsLaw(corridorApproval.approvalId);
    const escapeResult = await escapeProposal;
    assert.equal(escapeResult.allowed, false, "T3: expected denial after corridor violation");

    console.log("T3 ok: out-of-corridor request surfaced to Terminal 2 with correct reason");

    // ─── T4: UPL_TRACK_VIOLATED event in ledger ──────────────────────────────

    const ledgerRecords = await readBoundaryLedgerBySession(sessionId);
    const trackViolatedEvent = ledgerRecords.find(
      (r) => r.eventType === "UPL_TRACK_VIOLATED",
    );
    assert.ok(
      trackViolatedEvent,
      "T4: expected UPL_TRACK_VIOLATED ledger event after corridor exit",
    );

    console.log(`T4 ok: UPL_TRACK_VIOLATED recorded — ${trackViolatedEvent.payload.reason}`);

    // ─── T5 / T6: standing deny also binds a track corridor ───────────────────

    const postDenyLedger = await loadUserPathLedger();
    const activeDenied = postDenyLedger.userDeniedLawPaths.filter((entry) => entry.status === "ACTIVE");
    assert.ok(activeDenied.length > 0, "T5: expected an active denied UPL entry after deny_as_law");
    const deniedTrackEntry = activeDenied[activeDenied.length - 1];
    assert.ok(deniedTrackEntry.trackConstraint, "T5: expected denied UPL entry to carry a trackConstraint");
    assert.equal(
      deniedTrackEntry.trackConstraint.targetPattern,
      path.join(workspace, "other"),
      "T5: expected denied track targetPattern to bind to the denied corridor",
    );

    const deniedSibling = path.join(workspace, "other", "again.txt");
    const deniedSiblingResult = await bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: deniedSibling,
      payloadSummary: "write denied sibling file",
      provenance: "agent_inference",
      execute: async () => "should-not-run",
      successReason: "should not execute inside denied corridor",
    });
    assert.equal(deniedSiblingResult.allowed, false, "T6: expected denied corridor request to be blocked");
    assert.equal(deniedSiblingResult.requiresApproval, false, "T6: expected standing denied corridor to avoid re-prompt");

    console.log("T5 ok: standing deny bound a track corridor");
    console.log("T6 ok: denied corridor blocked repeat motion without re-prompt");

    // ─── T7: closed segment on the same road blocks motion ──────────────────

    const secretsDir = path.join(workspace, "secrets");
    await fs.mkdir(secretsDir, { recursive: true });
    const deniedSecret = path.join(secretsDir, "blocked.txt");
    const denySecretProposal = bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: deniedSecret,
      payloadSummary: "write blocked secret",
      provenance: "agent_inference",
      execute: async () => "should-not-run",
      successReason: "should not execute inside secret wall",
    });

    const deniedSecretResult = await denySecretProposal;
    assert.equal(deniedSecretResult.allowed, false, "T7 setup: expected secret wall to be recorded");
    assert.equal(
      deniedSecretResult.requiresApproval,
      false,
      "T7 setup: expected secret wall to deny directly when base denial pack already walls it",
    );

    const rootAllowed = path.join(workspace, "root-allowed.txt");
    const rootProposal = bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: rootAllowed,
      payloadSummary: "write root file",
      provenance: "agent_inference",
      execute: async () => "root-allowed",
      successReason: "wrote root-allowed.txt",
    });

    const rootPendingApprovals = await waitForPending(() => bodyguard.approvals.listPending());
    assert.ok(rootPendingApprovals.length > 0, "T7 setup: expected approval for broad root corridor");
    bodyguard.approvals.allowAsLaw(rootPendingApprovals[0].approvalId);
    const rootResult = await rootProposal;
    assert.equal(rootResult.allowed, true, "T7 setup: expected broad root corridor to be approved");

    const deniedInsideBroadRoad = path.join(secretsDir, "still-blocked.txt");
    const deniedInsideBroadRoadResult = await bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: deniedInsideBroadRoad,
      payloadSummary: "write secret after wall",
      provenance: "agent_inference",
      execute: async () => "should-not-run",
      successReason: "should not execute through closed segment",
    });
    assert.equal(
      deniedInsideBroadRoadResult.allowed,
      false,
      "T7: expected closed secret segment to block motion even when broad workspace corridor exists",
    );
    assert.equal(
      deniedInsideBroadRoadResult.requiresApproval,
      false,
      "T7: expected closed secret segment to deny without re-prompt",
    );

    console.log("T7 ok: closed segment on the same road blocked motion inside broad approved corridor");

    // ─── Summary ─────────────────────────────────────────────────────────────
    console.log("");
    console.log("Agent Buccet UPL Tracks contract");
    console.log(`  T1 track bound:     ${!!trackEntry.trackConstraint}`);
    console.log(`  T2 corridor allow:  ${sameTargetResult.allowed && siblingResult.allowed}`);
    console.log(`  T3 corridor exit:   ${!escapeResult.allowed}`);
    console.log(`  T4 ledger event:    ${!!trackViolatedEvent}`);
    console.log(`  T5 deny track:      ${!!deniedTrackEntry.trackConstraint}`);
    console.log(`  T6 deny corridor:   ${!deniedSiblingResult.allowed}`);
    console.log(`  T7 closed segment:  ${!deniedInsideBroadRoadResult.allowed}`);

    await fs.rm(tempRoot, { recursive: true, force: true });
  } finally {
    await saveUserPathLedger(originalLedger);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
