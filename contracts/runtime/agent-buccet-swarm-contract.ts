import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import {
  classifySwarmPath,
  createPersistentBoundaryRuntimeStore,
  readBoundaryLedgerBySession,
  sendBoundaryInterceptServerInput,
  type BoundaryInterceptDaemonOutput,
  type BoundaryInterceptSwarmGroup,
} from "../lib/agent-buccet/index.ts";

type SwarmStatusOutput = Extract<BoundaryInterceptDaemonOutput, { type: "swarm_status" }>;

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSwarmStatus(args: {
  target: { socketPath: string };
  predicate: (status: SwarmStatusOutput) => boolean;
  label: string;
}) {
  let lastStatus: SwarmStatusOutput | undefined;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const status = await sendBoundaryInterceptServerInput({
      target: args.target,
      input: {
        command: "swarm_status",
      },
    });
    assert.equal(status.type, "swarm_status");
    lastStatus = status;
    if (args.predicate(status)) {
      return status;
    }
    await wait(100);
  }

  throw new Error(`timed out waiting for ${args.label}: ${JSON.stringify(lastStatus)}`);
}

function requireSwarmGroup(status: SwarmStatusOutput, target: string): BoundaryInterceptSwarmGroup {
  const group = status.groups.find((entry) => entry.target === target);
  assert.ok(group, `expected swarm group for ${target}`);
  return group;
}

async function main() {
  const repoRoot = process.cwd();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-swarm-"));
  const sessionsDir = path.join(tempRoot, "sessions");
  const sessionId = `swarm-contract-${randomUUID()}`;
  const socketPath = path.join("/tmp", `ab-swarm-${randomUUID().slice(0, 12)}.sock`);
  const target = { socketPath };

  const store = await createPersistentBoundaryRuntimeStore({
    sessionId,
    actorId: "user:swarm-contract",
    sessionsDir,
  });
  await store.openPath({
    rootPath: tempRoot,
    grantedActions: ["fs.write"],
    issuedBy: "user:swarm-contract",
    seedBaseAcceptance: false,
  });

  const lowRiskMissingIntent = classifySwarmPath({
    action: "inspect",
    actionKind: "fs.read",
    readiness: "draft",
  });
  assert.equal(lowRiskMissingIntent.path, "yellow");
  assert.equal(lowRiskMissingIntent.disposition, "continue");
  assert.equal(lowRiskMissingIntent.yellowReason, "speculative_allowed");

  const highRiskMissingIntent = classifySwarmPath({
    action: "deploy",
    actionKind: "tool.exec",
    readiness: "globally_ready",
    actorRole: "deployment",
    ownership: {
      primaryOwner: "deployment",
    },
  });
  assert.equal(highRiskMissingIntent.path, "purple");
  assert.equal(highRiskMissingIntent.disposition, "queue");
  assert.equal(highRiskMissingIntent.code, "SWARM.INTENT.MISSING.HIGH_RISK");
  assert.equal(highRiskMissingIntent.definitionRequest?.action, "ask");

  const staleHighRisk = classifySwarmPath({
    action: "deploy",
    actionKind: "tool.exec",
    readiness: "globally_ready",
    actorRole: "deployment",
    ownership: {
      primaryOwner: "deployment",
    },
    intent: { goal: "ship the release" },
    freshness: {
      staleAt: new Date(Date.now() - 1_000).toISOString(),
    },
  });
  assert.equal(staleHighRisk.path, "yellow");
  assert.equal(staleHighRisk.code, "SWARM.FRESHNESS.STALE");
  assert.equal(staleHighRisk.yellowReason, "stale_version");

  const compositionPending = classifySwarmPath({
    action: "deploy",
    actionKind: "tool.exec",
    readiness: "globally_ready",
    actorRole: "deployment",
    ownership: {
      primaryOwner: "deployment",
    },
    intent: { goal: "ship the release" },
    composition: {
      completedHistory: ["build_pass"],
      requiredHistory: ["security_review", "rollback_plan"],
    },
  });
  assert.equal(compositionPending.path, "yellow");
  assert.equal(compositionPending.disposition, "queue");
  assert.equal(compositionPending.code, "SWARM.COMPOSITION.HISTORY_PENDING");

  const backupOwnerDenied = classifySwarmPath({
    action: "deploy",
    actionKind: "tool.exec",
    readiness: "globally_ready",
    actorRole: "backup",
    ownership: {
      primaryOwner: "primary",
      backupOwner: "backup",
    },
    intent: { goal: "ship the release" },
  });
  assert.equal(backupOwnerDenied.path, "red");
  assert.equal(backupOwnerDenied.code, "SWARM.OWNERSHIP.BACKUP_NOT_ACTIVATED");

  const reviewerExecDenied = classifySwarmPath({
    action: "deploy",
    actionKind: "tool.exec",
    readiness: "globally_ready",
    actorRole: "review",
    ownership: {
      primaryOwner: "coding",
      reviewer: "review",
    },
    intent: { goal: "ship the release" },
  });
  assert.equal(reviewerExecDenied.path, "red");
  assert.equal(reviewerExecDenied.code, "SWARM.OWNERSHIP.REVIEWER_EXECUTION_DENIED");

  const silenceTimeout = classifySwarmPath({
    action: "integrate",
    actionKind: "fs.write",
    readiness: "dependency_ready",
    actorRole: "coding",
    ownership: {
      primaryOwner: "coding",
      timeoutMs: 1_000,
    },
    coordination: {
      lastHeartbeatAt: new Date(Date.now() - 10_000).toISOString(),
      timeoutAction: "reroute",
    },
    intent: { goal: "ship the patch" },
  });
  assert.equal(silenceTimeout.path, "yellow");
  assert.equal(silenceTimeout.code, "SWARM.SILENCE.TIMEOUT");

  const securityBlock = classifySwarmPath({
    action: "deploy",
    actionKind: "tool.exec",
    readiness: "globally_ready",
    actorRole: "deployment",
    ownership: {
      primaryOwner: "deployment",
    },
    intent: { goal: "ship the release" },
    domainStatus: {
      security: "red",
    },
  });
  assert.equal(securityBlock.path, "red");
  assert.equal(securityBlock.code, "SWARM.DOMAIN.SECURITY_BLOCK");

  const evidenceOnly = classifySwarmPath({
    action: "deploy",
    actionKind: "tool.exec",
    readiness: "globally_ready",
    actorRole: "deployment",
    ownership: {
      primaryOwner: "deployment",
    },
    intent: { goal: "ship the release" },
    provenance: {
      source: "model",
      trust: "unverified",
      safeToActOn: false,
    },
  });
  assert.equal(evidenceOnly.path, "red");
  assert.equal(evidenceOnly.code, "SWARM.PROVENANCE.EVIDENCE_ONLY");

  const interceptServer = spawn(process.execPath, [
    path.join(repoRoot, "scripts", "agent-buccet-intercept-server.ts"),
    "--session-id",
    sessionId,
    "--sessions-dir",
    sessionsDir,
    "--socket",
    socketPath,
  ], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "pipe"],
  });

  let ready = false;
  let stderr = "";
  interceptServer.stderr.setEncoding("utf8");
  interceptServer.stderr.on("data", (chunk) => {
    stderr += chunk;
    if (chunk.includes("intercept server running")) {
      ready = true;
    }
  });

  for (let attempt = 0; attempt < 100 && !ready; attempt += 1) {
    await wait(100);
  }
  assert.equal(ready, true, `intercept server should be ready\n${stderr}`);

  const sharedTarget = path.join(tempRoot, "shared.txt");
  const sharedSwarm = {
    action: "integrate",
    actorRole: "coding",
    readiness: "dependency_ready" as const,
    intent: {
      goal: "ship shared file change",
    },
    ownership: {
      primaryOwner: "coding",
      reviewer: "review",
    },
    handoff: {
      sender: "planner",
      receiver: "coding",
      artifactId: "artifact-shared",
      readiness: "dependency_ready" as const,
      version: "v1",
      allowedUse: ["integrate"],
      requiredValidation: ["tests"],
      nextAction: "integrate",
    },
    completedValidation: ["tests"],
    composition: {
      completedHistory: ["owner_approval"],
    },
    cost: {
      unitsConsumed: 2,
      unitCap: 10,
      unit: "tokens",
    },
  };
  const firstRequest = sendBoundaryInterceptServerInput({
    target,
    input: {
      actionClass: "file",
      operation: "write",
      target: sharedTarget,
      payloadSummary: "pid=1001 agent=one",
      swarm: sharedSwarm,
    },
  });
  const secondRequest = sendBoundaryInterceptServerInput({
    target,
    input: {
      actionClass: "file",
      operation: "write",
      target: sharedTarget,
      payloadSummary: "pid=1002 agent=two",
      swarm: sharedSwarm,
    },
  });

  const swarmStatus = await waitForSwarmStatus({
    target,
    label: "two waiting swarm members",
    predicate: (status) =>
      status.totals.pending === 1
      && status.totals.waitingMembers === 2
      && status.groups.some((group) =>
        group.target === sharedTarget
        && group.waitingCount >= 2
        && group.path === "green"
        && group.swarmAction === "integrate"
        && group.readiness === "dependency_ready"),
  });
  assert.equal(swarmStatus.totals.pending, 1, "expected one pending swarm group");
  assert.equal(swarmStatus.totals.waitingMembers, 2, "expected two waiting swarm members");
  assert.equal(swarmStatus.groups.length >= 1, true, "expected at least one tracked group");

  const pendingGroup = requireSwarmGroup(swarmStatus, sharedTarget);
  assert.equal(pendingGroup.target, sharedTarget);
  assert.equal(pendingGroup.waitingCount >= 2, true);
  assert.equal(pendingGroup.memberCount >= 2, true);
  assert.equal(pendingGroup.path, "green");
  assert.equal(pendingGroup.swarmAction, "integrate");
  assert.equal(pendingGroup.actorRole, "coding");
  assert.equal(pendingGroup.readiness, "dependency_ready");
  assert.equal(pendingGroup.intent?.goal, "ship shared file change");
  assert.equal(pendingGroup.ownership?.primaryOwner, "coding");
  assert.equal(pendingGroup.handoff?.artifactId, "artifact-shared");
  assert.equal(pendingGroup.cost?.unit, "tokens");

  const approve = await sendBoundaryInterceptServerInput({
    target,
    input: {
      command: "swarm_approve",
      groupId: pendingGroup.groupId,
      issuedBy: "user:swarm-contract",
      reason: "allow shared swarm target once",
      asLaw: false,
    },
  });
  assert.equal(approve.type, "ack");
  assert.equal(approve.command, "swarm_approve");

  const [firstDecision, secondDecision] = await Promise.all([firstRequest, secondRequest]) as [
    BoundaryInterceptDaemonOutput,
    BoundaryInterceptDaemonOutput,
  ];

  assert.equal(firstDecision.type, "decision");
  assert.equal(secondDecision.type, "decision");
  assert.equal(firstDecision.decision, "allow");
  assert.equal(secondDecision.decision, "allow");

  const ledger = await readBoundaryLedgerBySession(sessionId);
  const swarmApproval = ledger.find((record) =>
    record.META.event_type === "APPROVAL_GRANTED"
    && record.META.session_id === sessionId
    && record.INPUT.target === sharedTarget
    && String(record.INPUT.params.swarm_group_id ?? "").startsWith("swarm-")
  );
  assert.ok(swarmApproval, "expected swarm approval entry in ledger");

  const readinessDenied = await sendBoundaryInterceptServerInput({
    target,
    input: {
      actionClass: "file",
      operation: "write",
      target: path.join(tempRoot, "readiness-denied.txt"),
      payloadSummary: "pid=1003 agent=deploy",
      swarm: {
        action: "deploy",
        actorRole: "deployment",
        readiness: "draft",
        intent: { goal: "ship the release" },
      },
    },
  });
  assert.equal(readinessDenied.type, "decision");
  assert.equal(readinessDenied.decision, "deny");
  assert.equal(readinessDenied.lawIds.includes("SWARM.READINESS.DENIED"), true);

  const handoffDenied = await sendBoundaryInterceptServerInput({
    target,
    input: {
      actionClass: "file",
      operation: "write",
      target: path.join(tempRoot, "handoff-denied.txt"),
      payloadSummary: "pid=1004 agent=security",
      swarm: {
        action: "deploy",
        actorRole: "security",
        readiness: "globally_ready",
        intent: { goal: "ship the release" },
        handoff: {
          sender: "coding",
          receiver: "deployment",
          artifactId: "artifact-release",
          readiness: "globally_ready",
          version: "v3",
          allowedUse: ["deploy"],
          nextAction: "deploy",
        },
      },
    },
  });
  assert.equal(handoffDenied.type, "decision");
  assert.equal(handoffDenied.decision, "deny");
  assert.equal(handoffDenied.lawIds.includes("SWARM.HANDOFF.RECEIVER_MISMATCH"), true);

  const costDenied = await sendBoundaryInterceptServerInput({
    target,
    input: {
      actionClass: "file",
      operation: "write",
      target: path.join(tempRoot, "cost-denied.txt"),
      payloadSummary: "pid=1005 agent=budget",
      swarm: {
        action: "integrate",
        actorRole: "coding",
        readiness: "dependency_ready",
        intent: { goal: "ship the patch" },
        cost: {
          unitsConsumed: 5,
          unitCap: 5,
          unit: "tokens",
        },
      },
    },
  });
  assert.equal(costDenied.type, "decision");
  assert.equal(costDenied.decision, "deny");
  assert.equal(costDenied.lawIds.includes("SWARM.COST.CAP_EXCEEDED"), true);

  const aggregateCostDenied = await sendBoundaryInterceptServerInput({
    target,
    input: {
      actionClass: "file",
      operation: "write",
      target: path.join(tempRoot, "aggregate-cost-denied.txt"),
      payloadSummary: "pid=1005b agent=budget-aggregate",
      swarm: {
        action: "integrate",
        actorRole: "coding",
        readiness: "dependency_ready",
        intent: { goal: "ship the patch" },
        cost: {
          unitsConsumed: 1,
          unitCap: 10,
          unit: "tokens",
          swarmBudget: {
            consumed: 100,
            cap: 100,
            unit: "tokens",
          },
        },
      },
    },
  });
  assert.equal(aggregateCostDenied.type, "decision");
  assert.equal(aggregateCostDenied.decision, "deny");
  assert.equal(aggregateCostDenied.lawIds.includes("SWARM.COST.CAP_EXCEEDED"), true);

  const highRiskPurpleTarget = path.join(tempRoot, "high-risk-intent-missing.txt");
  const highRiskPurpleRequest = sendBoundaryInterceptServerInput({
    target,
    input: {
      actionClass: "file",
      operation: "write",
      target: highRiskPurpleTarget,
      payloadSummary: "pid=1005c agent=deployment",
      swarm: {
        action: "deploy",
        actorRole: "deployment",
        readiness: "globally_ready",
        ownership: {
          primaryOwner: "deployment",
        },
      },
    },
  });

  const highRiskPurpleStatus = await waitForSwarmStatus({
    target,
    label: "high-risk intent missing queue",
    predicate: (status) =>
      status.groups.some((group) =>
        group.target === highRiskPurpleTarget
        && group.state === "waiting"
        && group.path === "purple"
        && group.pathCode === "SWARM.INTENT.MISSING.HIGH_RISK"
        && group.definitionRequest?.action === "ask"),
  });
  const highRiskPurpleGroup = requireSwarmGroup(highRiskPurpleStatus, highRiskPurpleTarget);
  assert.equal(highRiskPurpleGroup.purpleAction, "ask");
  assert.equal(highRiskPurpleGroup.definitionRequest?.owner, "deployment");

  const highRiskPurpleDeny = await sendBoundaryInterceptServerInput({
    target,
    input: {
      command: "swarm_deny",
      groupId: highRiskPurpleGroup.groupId,
      deniedBy: "user:swarm-contract",
      reason: "high-risk deploy cannot continue without intent",
      asLaw: false,
    },
  });
  assert.equal(highRiskPurpleDeny.type, "ack");
  assert.equal(highRiskPurpleDeny.command, "swarm_deny");

  const highRiskPurpleDecision = await highRiskPurpleRequest;
  assert.equal(highRiskPurpleDecision.type, "decision");
  assert.equal(highRiskPurpleDecision.decision, "deny");
  assert.equal(highRiskPurpleDecision.reason, "high-risk deploy cannot continue without intent");

  const purpleTarget = path.join(tempRoot, "intent-purple.txt");
  const purpleRequest = sendBoundaryInterceptServerInput({
    target,
    input: {
      actionClass: "file",
      operation: "write",
      target: purpleTarget,
      payloadSummary: "pid=1006 agent=purple",
      swarm: {
        action: "integrate",
        actorRole: "coding",
        readiness: "dependency_ready",
        intent: { goal: "   " },
      },
    },
  });

  const purpleStatus = await waitForSwarmStatus({
    target,
    label: "purple intent clarification queue",
    predicate: (status) =>
      status.totals.pending === 1
      && status.groups.some((group) =>
        group.target === purpleTarget
        && group.state === "waiting"
        && group.path === "purple"),
  });
  const purpleGroup = requireSwarmGroup(purpleStatus, purpleTarget);
  assert.equal(purpleGroup.path, "purple");
  assert.equal(purpleGroup.lawIds.includes("SWARM.INTENT.UNDERSPECIFIED"), true);

  const purpleDeny = await sendBoundaryInterceptServerInput({
    target,
    input: {
      command: "swarm_deny",
      groupId: purpleGroup.groupId,
      deniedBy: "user:swarm-contract",
      reason: "intent stayed underspecified",
      asLaw: false,
    },
  });
  assert.equal(purpleDeny.type, "ack");
  assert.equal(purpleDeny.command, "swarm_deny");

  const purpleDecision = await purpleRequest;
  assert.equal(purpleDecision.type, "decision");
  assert.equal(purpleDecision.decision, "deny");
  assert.equal(purpleDecision.reason, "intent stayed underspecified");

  interceptServer.kill("SIGTERM");
  await once(interceptServer, "exit");

  console.log("Agent Buccet swarm contract");
  console.log(`group: ${pendingGroup.groupId}`);
  console.log(`waiting members: ${pendingGroup.waitingCount}`);
  console.log(`first decision: ${firstDecision.type === "decision" ? firstDecision.decision : "error"}`);
  console.log(`second decision: ${secondDecision.type === "decision" ? secondDecision.decision : "error"}`);
  console.log(`readiness denial: ${readinessDenied.type === "decision" ? readinessDenied.decision : "error"}`);
  console.log(`handoff denial: ${handoffDenied.type === "decision" ? handoffDenied.decision : "error"}`);
  console.log(`cost denial: ${costDenied.type === "decision" ? costDenied.decision : "error"}`);
  console.log(`aggregate cost denial: ${aggregateCostDenied.type === "decision" ? aggregateCostDenied.decision : "error"}`);
  console.log(`high-risk purple decision: ${highRiskPurpleDecision.type === "decision" ? highRiskPurpleDecision.decision : "error"}`);
  console.log(`purple decision: ${purpleDecision.type === "decision" ? purpleDecision.decision : "error"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
