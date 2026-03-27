import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_BOUNDARY_LAWS,
  createBoundaryBodyguard,
  createPersistentBoundaryRuntimeStore,
  lookupUserPathTrackDecision,
  openBoundaryPath,
  readBoundaryLedgerBySession,
  saveUserPathLedger,
  loadUserPathLedger,
} from "../lib/agent-buccet/index.ts";
import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundarySession,
  BoundaryUplEntry,
  BoundaryUserPathLedger,
} from "../lib/agent-buccet/types.ts";

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

function makeSession(): BoundarySession {
  return {
    sessionId: "upl-track-review",
    actorId: "user:review-surface",
    createdAt: new Date().toISOString(),
    dryRun: false,
    persistent: true,
    status: "active",
  };
}

function makeRequest(
  actionKind: BoundaryActionKind,
  target: string,
  payloadSummary?: string,
): BoundaryActionRequest {
  return {
    requestId: randomUUID(),
    sessionId: "upl-track-review",
    actionKind,
    target,
    payloadSummary,
    requestedAt: new Date().toISOString(),
    provenance: "agent_inference",
  };
}

function makeApprovedTrack(args: {
  id: string;
  createdAt: string;
  targetPattern: string;
}): BoundaryUplEntry {
  return {
    id: args.id,
    type: "APPROVED",
    path: `tool.exec ${args.targetPattern}`,
    pathHash: `hash-${args.id}`,
    createdAt: args.createdAt,
    scope: "GLOBAL",
    status: "ACTIVE",
    witness: `witness-${args.id}`,
    trackConstraint: {
      allowedActionKinds: ["tool.exec"],
      targetPattern: args.targetPattern,
      targetMatchMode: "prefix",
      description: `allow ${args.targetPattern}`,
    },
  };
}

async function main() {
  // R1: default filesystem mutation laws require approval.
  for (const actionKind of ["fs.write", "fs.append", "fs.mkdir", "fs.move"] as BoundaryActionKind[]) {
    const law = DEFAULT_BOUNDARY_LAWS.find((entry) => entry.lawId === "BOUNDARY.FS.WRITE.01");
    assert.ok(law, "expected BOUNDARY.FS.WRITE.01 to exist");
    const result = law.evaluate({
      session: makeSession(),
      request: makeRequest(actionKind, `/tmp/${actionKind.replace(".", "-")}`),
      activeGrants: [],
    });
    assert.ok(result, `expected ${actionKind} to match BOUNDARY.FS.WRITE.01`);
    assert.equal(result?.decision, "require_approval", `${actionKind} must require approval by default`);
  }

  // R2: a valid allow track beats an unrelated track violation.
  const trackLedger: BoundaryUserPathLedger = {
    specVersion: 1,
    userApprovedLawPaths: [
      makeApprovedTrack({
        id: "UPL-ALLOW-NPM",
        createdAt: "2026-03-27T00:00:00.000Z",
        targetPattern: "npm",
      }),
      makeApprovedTrack({
        id: "UPL-ALLOW-GIT",
        createdAt: "2026-03-27T00:00:01.000Z",
        targetPattern: "git",
      }),
    ],
    userDeniedLawPaths: [],
  };

  const trackDecision = lookupUserPathTrackDecision({
    ledger: trackLedger,
    session: makeSession(),
    request: makeRequest("tool.exec", "git", "git"),
  });
  assert.ok(trackDecision, "expected a track decision for tool.exec");
  assert.equal(trackDecision?.decision, "allow", "matching git track must win over unrelated npm violation");
  assert.equal(trackDecision?.entry.id, "UPL-ALLOW-GIT", "matching git track must be selected");

  // R3/R4: session end drains pending approvals and records session-ended denial reason.
  const originalUpl = await loadUserPathLedger();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-release-surface-"));

  try {
    await saveUserPathLedger({ specVersion: 1, userApprovedLawPaths: [], userDeniedLawPaths: [] });

    const workspace = path.join(tempRoot, "workspace");
    await fs.mkdir(workspace, { recursive: true });

    const sessionId = `agent-buccet-release-surface-${Date.now()}`;
    const actorId = "user:release-surface-contract";
    const store = await createPersistentBoundaryRuntimeStore({ sessionId, actorId });

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
    const pendingTarget = path.join(workspace, "pending.txt");
    const proposal = bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: pendingTarget,
      payloadSummary: "write pending file",
      provenance: "agent_inference",
      execute: async () => "should-not-run",
      successReason: "wrote pending file",
    });

    const pending = await waitForPending(() => bodyguard.approvals.listPending());
    assert.equal(pending.length, 1, "expected one pending approval before session end");

    await store.endSession({
      endedBy: actorId,
      reason: "contract ended session",
    });

    const proposalResult = await proposal;
    assert.equal(proposalResult.allowed, false, "session end must deny the pending proposal");
    assert.equal(proposalResult.executed, false, "drained pending approval must not execute");

    const records = await readBoundaryLedgerBySession(sessionId);
    const approvalDenied = records.find((record) =>
      record.eventType === "APPROVAL_DENIED" && record.payload.reason === "session ended"
    );
    assert.ok(approvalDenied, "expected approval denial to be ledgered with session-ended reason");

    const sessionEnded = records.find((record) => record.eventType === "SESSION_ENDED");
    assert.ok(sessionEnded, "expected SESSION_ENDED ledger record");
    assert.equal(
      sessionEnded?.payload.metadata?.pending_approvals_drained,
      1,
      "session end must record drained pending approvals",
    );

    console.log("Agent Buccet release-surface contract");
    console.log("  R1 default fs mutation laws: ok");
    console.log("  R2 track precedence:         ok");
    console.log("  R3 session-end drain:        ok");
    console.log("  R4 denial ledger reason:     ok");
  } finally {
    await saveUserPathLedger(originalUpl);
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
