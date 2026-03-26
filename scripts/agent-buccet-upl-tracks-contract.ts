/**
 * UPL Tracks contract.
 *
 * Proves:
 * T1 — after allow_as_law, the UPL entry has a trackConstraint set
 * T2 — a request identical to the approved one is allowed without re-prompting (track satisfied)
 * T3 — a request that exits the approved target corridor returns require_approval (track violated)
 * T4 — UPL_TRACK_VIOLATED event appears in the ledger after a corridor exit
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

async function waitForPending<T>(list: () => T[], timeoutMs = 1_500): Promise<T[]> {
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
    // so we can exercise the allow_as_law track-binding path.
    const { config: scopedConfig } = await openBoundaryPath({
      config: store.getConfig(),
      rootPath: workspace,
      grantedActions: ["fs.write"],
      issuedBy: actorId,
    });
    store.replaceConfig({
      ...scopedConfig,
      approvalRequiredFor: [...(scopedConfig.approvalRequiredFor ?? []), "fs.write"],
    });

    const bodyguard = createBoundaryBodyguard(store);

    // ─── T1 / T2: allow_as_law binds a track corridor ───────────────────────

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

    // Deny it (we don't want to expand the corridor in this test).
    bodyguard.approvals.denyOnce(corridorApproval.approvalId);
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

    // ─── Summary ─────────────────────────────────────────────────────────────
    console.log("");
    console.log("Agent Buccet UPL Tracks contract");
    console.log(`  T1 track bound:     ${!!trackEntry.trackConstraint}`);
    console.log(`  T2 corridor allow:  ${sameTargetResult.allowed && siblingResult.allowed}`);
    console.log(`  T3 corridor exit:   ${!escapeResult.allowed}`);
    console.log(`  T4 ledger event:    ${!!trackViolatedEvent}`);

    await fs.rm(tempRoot, { recursive: true, force: true });
  } finally {
    await saveUserPathLedger(originalLedger);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
