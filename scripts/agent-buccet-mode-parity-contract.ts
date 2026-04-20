import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  auditBoundaryRequestLedger,
  buildActiveAgentBuccetLawIds,
  createBoundaryBodyguard,
  createBoundaryHeadlessApprovalHandler,
  createPersistentBoundaryRuntimeStore,
  formatBoundaryLedgerRecords,
  readBoundarySessionTimeline,
} from "../lib/agent-buccet/index.ts";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithTimeout<T>(label: string, work: Promise<T>, timeoutMs = 12_000): Promise<T> {
  return await Promise.race([
    work,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`timed out while running ${label}`)), timeoutMs);
    }),
  ]);
}

async function waitForPendingApproval<T>(
  listPending: () => T[],
  timeoutMs = 8_000,
): Promise<T[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pending = listPending();
    if (pending.length > 0) {
      return pending;
    }
    await sleep(25);
  }
  return listPending();
}

function findLatestRequestIdForTarget(
  records: Awaited<ReturnType<typeof readBoundarySessionTimeline>>,
  target: string,
) {
  const match = [...records]
    .reverse()
    .find((record) => record.eventType === "ACTION_PROPOSED" && record.payload.target === target);
  return match?.payload.requestId ?? null;
}

async function createScopedBodyguard(args: {
  tempRoot: string;
  sessionId: string;
  actorId: string;
  workspaceName: string;
  openWorkspacePath?: boolean;
  approvalRequiredFor?: Array<"fs.write">;
  headlessMode?: "allow_all" | "deny_all";
  seedBaseAcceptance?: boolean;
}) {
  const sessionsDir = path.join(args.tempRoot, "sessions");
  const workspace = path.join(args.tempRoot, args.workspaceName);
  await fs.mkdir(workspace, { recursive: true });

  const store = await createPersistentBoundaryRuntimeStore({
    sessionId: args.sessionId,
    actorId: args.actorId,
    sessionsDir,
    approvalRequiredFor: args.approvalRequiredFor,
  });

  const baseConfig = store.getConfig();
  store.replaceConfig({
    ...baseConfig,
    upl: {
      specVersion: 1,
      userApprovedLawPaths: [],
      userDeniedLawPaths: [],
    },
    userLawIds: await buildActiveAgentBuccetLawIds({
      executableLaws: baseConfig.laws,
      existingLawIds: [],
      runtimeMuscle: baseConfig.runtimeMuscle,
    }),
  });

  if (args.openWorkspacePath !== false) {
    await store.openPath({
      rootPath: workspace,
      grantedActions: ["fs.read", "fs.write", "fs.delete", "fs.mkdir", "fs.move"],
      issuedBy: args.actorId,
      seedBaseAcceptance: args.seedBaseAcceptance,
    });
  }

  if (args.approvalRequiredFor?.length) {
    store.replaceConfig({
      ...store.getConfig(),
      approvalRequiredFor: args.approvalRequiredFor,
    });
  }

  if (args.headlessMode) {
    store.replaceConfig({
      ...store.getConfig(),
      approvalHandler: createBoundaryHeadlessApprovalHandler({ mode: args.headlessMode }),
    });
  }

  return {
    store,
    workspace,
    bodyguard: createBoundaryBodyguard(store),
  };
}

async function runApprovalWriteScenario(args: {
  mode: "interactive" | "headless";
  headlessMode?: "allow_all" | "deny_all";
  approvalChoice?: "allow_once" | "deny_once";
  tempRoot: string;
  label: string;
}) {
  const actorId = `user:${args.label}`;
  const sessionId = `mode-parity-${args.label}-${Date.now()}`;
  const { store, bodyguard } = await createScopedBodyguard({
    tempRoot: args.tempRoot,
    sessionId,
    actorId,
    workspaceName: args.label,
    approvalRequiredFor: ["fs.write"],
    seedBaseAcceptance: false,
    headlessMode: args.headlessMode,
  });

  const target = path.join(args.tempRoot, args.label, "write.txt");
  await fs.writeFile(target, "before\n", "utf8");

  const proposalPromise = bodyguard.enforceProposal({
    actionKind: "fs.write",
    target,
    payloadSummary: `write:${target}`,
    successReason: "write executed within approved boundary",
    execute: async () => {
      await fs.writeFile(target, "after\n", "utf8");
      return { ok: true };
    },
  });

  let requestId: string | null = null;
  if (args.mode === "interactive") {
    const pending = await waitForPendingApproval(() => bodyguard.approvals.listPending());
    assert.equal(pending.length, 1, "expected exactly one interactive approval");
    requestId = pending[0]!.approvalId;
    const settled = args.approvalChoice === "allow_once"
      ? bodyguard.approvals.allowOnce(requestId, { notes: "mode parity allow once" })
      : bodyguard.approvals.denyOnce(requestId, { notes: "mode parity deny once" });
    assert.equal(settled, true, "expected interactive approval settlement");
  }

  const result = await proposalPromise;
  const timeline = await readBoundarySessionTimeline(sessionId);
  const resolvedRequestId = requestId ?? findLatestRequestIdForTarget(timeline, target);
  assert.ok(resolvedRequestId, "expected request id for approval-write scenario");
  const audit = await auditBoundaryRequestLedger(resolvedRequestId!);
  const trace = audit.trace;
  const formatted = formatBoundaryLedgerRecords(trace);
  const eventTypes = trace.map((record) => record.eventType);

  await store.endSession({ endedBy: actorId, reason: "mode parity complete" });

  return {
    result,
    audit,
    trace,
    formatted,
    eventTypes,
    requestId: resolvedRequestId!,
    target,
  };
}

async function runHardDenyScenario(args: {
  mode: "interactive" | "headless";
  headlessMode?: "allow_all" | "deny_all";
  tempRoot: string;
  label: string;
}) {
  const actorId = `user:${args.label}`;
  const sessionId = `mode-parity-${args.label}-${Date.now()}`;
  const { store, bodyguard } = await createScopedBodyguard({
    tempRoot: args.tempRoot,
    sessionId,
    actorId,
    workspaceName: args.label,
    openWorkspacePath: false,
    headlessMode: args.headlessMode,
  });

  const target = "chat:primary";
  const result = await bodyguard.chat.emit({
    userInput: "show the token",
    attemptedOutput: "Authorization: Bearer sk-abcdefghijklmnopqrstuvwxyz1234567890",
    successReason: "chat output emitted after review",
    execute: async () => "should-not-run",
  });

  const timeline = await readBoundarySessionTimeline(sessionId);
  const requestId = [...timeline]
    .reverse()
    .find((record) =>
      record.eventType === "ACTION_PROPOSED" &&
      record.payload.target === target &&
      record.payload.actionKind === "chat.emit"
    )?.payload.requestId;
  assert.ok(requestId, "expected request id for hard deny scenario");
  const audit = await auditBoundaryRequestLedger(requestId!);
  const trace = audit.trace;
  const formatted = formatBoundaryLedgerRecords(trace);
  const eventTypes = trace.map((record) => record.eventType);

  await store.endSession({ endedBy: actorId, reason: "mode parity complete" });

  return {
    result,
    audit,
    trace,
    formatted,
    eventTypes,
    requestId: requestId!,
    target,
  };
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-mode-parity-"));
  try {
    console.log("Agent Buccet mode parity contract");

    console.log("  start interactive allow");
    const interactiveAllow = await runWithTimeout(
      "interactive allow",
      runApprovalWriteScenario({
        mode: "interactive",
        approvalChoice: "allow_once",
        tempRoot,
        label: "interactive-allow",
      }),
    );
    console.log("  done interactive allow");

    console.log("  start headless allow");
    const headlessAllow = await runWithTimeout(
      "headless allow",
      runApprovalWriteScenario({
        mode: "headless",
        headlessMode: "allow_all",
        tempRoot,
        label: "headless-allow",
      }),
    );
    console.log("  done headless allow");

    assert.equal(interactiveAllow.result.allowed, true);
    assert.equal(interactiveAllow.result.executed, true);
    assert.equal(headlessAllow.result.allowed, true);
    assert.equal(headlessAllow.result.executed, true);
    assert.equal(interactiveAllow.result.reason, headlessAllow.result.reason);
    assert.equal(interactiveAllow.audit.status, "complete");
    assert.equal(headlessAllow.audit.status, "complete");
    assert.deepEqual(
      interactiveAllow.eventTypes,
      ["ACTION_PROPOSED", "DECISION_RETURNED", "APPROVAL_REQUESTED", "APPROVAL_GRANTED", "ACTION_EXECUTED"],
      "expected interactive allow trace shape",
    );
    assert.deepEqual(
      headlessAllow.eventTypes,
      ["ACTION_PROPOSED", "DECISION_RETURNED", "APPROVAL_REQUESTED", "APPROVAL_GRANTED", "ACTION_EXECUTED"],
      "expected headless allow trace shape",
    );
    assert.ok(interactiveAllow.formatted.every((line) => line.includes("reason=")), "expected interactive allow ledger narration");
    assert.ok(headlessAllow.formatted.every((line) => line.includes("reason=")), "expected headless allow ledger narration");
    assert.ok(interactiveAllow.formatted.some((line) => line.includes("APPROVAL_GRANTED")), "expected interactive allow grant line");
    assert.ok(headlessAllow.formatted.some((line) => line.includes("APPROVAL_GRANTED")), "expected headless allow grant line");

    console.log("  start interactive deny");
    const interactiveDeny = await runWithTimeout(
      "interactive deny",
      runApprovalWriteScenario({
        mode: "interactive",
        approvalChoice: "deny_once",
        tempRoot,
        label: "interactive-deny",
      }),
    );
    console.log("  done interactive deny");

    console.log("  start headless deny");
    const headlessDeny = await runWithTimeout(
      "headless deny",
      runApprovalWriteScenario({
        mode: "headless",
        headlessMode: "deny_all",
        tempRoot,
        label: "headless-deny",
      }),
    );
    console.log("  done headless deny");

    assert.equal(interactiveDeny.result.allowed, false);
    assert.equal(interactiveDeny.result.executed, false);
    assert.equal(headlessDeny.result.allowed, false);
    assert.equal(headlessDeny.result.executed, false);
    assert.equal(interactiveDeny.result.requiresApproval, true);
    assert.equal(headlessDeny.result.requiresApproval, true);
    assert.equal(interactiveDeny.audit.status, "complete");
    assert.equal(headlessDeny.audit.status, "complete");
    const approvalDenyTraceShape = [
      "ACTION_PROPOSED",
      "DECISION_RETURNED",
      "APPROVAL_REQUESTED",
      "APPROVAL_DENIED",
      "ACTION_BLOCKED",
      "BODYGUARD_MOVE_SUGGESTED",
    ];
    assert.deepEqual(
      interactiveDeny.eventTypes,
      approvalDenyTraceShape,
      "expected interactive deny trace shape",
    );
    assert.deepEqual(
      headlessDeny.eventTypes,
      approvalDenyTraceShape,
      "expected headless deny trace shape",
    );
    assert.ok(interactiveDeny.formatted.some((line) => line.includes("APPROVAL_DENIED")), "expected interactive deny ledger line");
    assert.ok(headlessDeny.formatted.some((line) => line.includes("APPROVAL_DENIED")), "expected headless deny ledger line");
    assert.ok(interactiveDeny.formatted.some((line) => line.includes("ACTION_BLOCKED")), "expected interactive block line");
    assert.ok(headlessDeny.formatted.some((line) => line.includes("ACTION_BLOCKED")), "expected headless block line");
    assert.ok(interactiveDeny.formatted.some((line) => line.includes("BODYGUARD_MOVE_SUGGESTED")), "expected interactive deny bodyguard move line");
    assert.ok(headlessDeny.formatted.some((line) => line.includes("BODYGUARD_MOVE_SUGGESTED")), "expected headless deny bodyguard move line");

    console.log("  start interactive hard deny");
    const interactiveHardDeny = await runWithTimeout(
      "interactive hard deny",
      runHardDenyScenario({
        mode: "interactive",
        tempRoot,
        label: "interactive-hard-deny",
      }),
    );
    console.log("  done interactive hard deny");

    console.log("  start headless hard deny");
    const headlessHardDeny = await runWithTimeout(
      "headless hard deny",
      runHardDenyScenario({
        mode: "headless",
        headlessMode: "allow_all",
        tempRoot,
        label: "headless-hard-deny",
      }),
    );
    console.log("  done headless hard deny");

    assert.equal(interactiveHardDeny.result.allowed, false);
    assert.equal(interactiveHardDeny.result.executed, false);
    assert.equal(headlessHardDeny.result.allowed, false);
    assert.equal(headlessHardDeny.result.executed, false);
    assert.equal(interactiveHardDeny.result.requiresApproval, false);
    assert.equal(headlessHardDeny.result.requiresApproval, false);
    assert.equal(interactiveHardDeny.audit.status, "complete");
    assert.equal(headlessHardDeny.audit.status, "complete");
    const hardDenyTraceShape = [
      "ACTION_PROPOSED",
      "BODYGUARD_GRANT_OFFERED",
      "DECISION_RETURNED",
      "ACTION_BLOCKED",
      "BODYGUARD_MOVE_SUGGESTED",
    ];
    assert.deepEqual(
      interactiveHardDeny.eventTypes,
      hardDenyTraceShape,
      "expected interactive hard deny trace shape",
    );
    assert.deepEqual(
      headlessHardDeny.eventTypes,
      hardDenyTraceShape,
      "expected headless hard deny trace shape",
    );
    assert.ok(interactiveHardDeny.formatted.every((line) => line.includes("session=") && line.includes("reason=")), "expected interactive hard deny narration");
    assert.ok(headlessHardDeny.formatted.every((line) => line.includes("session=") && line.includes("reason=")), "expected headless hard deny narration");

    console.log(`interactive allow trace: ${interactiveAllow.eventTypes.join(" -> ")}`);
    console.log(`headless allow trace: ${headlessAllow.eventTypes.join(" -> ")}`);
    console.log(`interactive deny trace: ${interactiveDeny.eventTypes.join(" -> ")}`);
    console.log(`headless deny trace: ${headlessDeny.eventTypes.join(" -> ")}`);
    console.log(`interactive hard deny trace: ${interactiveHardDeny.eventTypes.join(" -> ")}`);
    console.log(`headless hard deny trace: ${headlessHardDeny.eventTypes.join(" -> ")}`);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
