import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import {
  createPersistentBoundaryRuntimeStore,
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
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-novelty-"));
  const sessionsDir = path.join(tempRoot, "sessions");
  const sessionId = `novelty-contract-${randomUUID()}`;
  const socketPath = path.join("/tmp", `ab-novelty-${randomUUID().slice(0, 12)}.sock`);
  const target = { socketPath };

  const store = await createPersistentBoundaryRuntimeStore({
    sessionId,
    actorId: "user:novelty-contract",
    sessionsDir,
  });
  await store.openPath({
    rootPath: tempRoot,
    grantedActions: ["fs.read", "fs.write"],
    issuedBy: "user:novelty-contract",
    seedBaseAcceptance: false,
  });

  const selfOriginatedPath = path.join(tempRoot, "self-originated.txt");
  const standingLawPath = path.join(tempRoot, "standing-law.txt");
  const noveltyExecTarget = path.join(tempRoot, "novelty-exec.sh");
  const standingLawPayload = "trusted-system standing law read";
  await fs.writeFile(selfOriginatedPath, "ready\n", "utf8");
  await fs.writeFile(standingLawPath, "ready\n", "utf8");
  await fs.writeFile(noveltyExecTarget, "#!/bin/sh\necho novelty\n", "utf8");
  await store.issueGrant({
    resourceKind: "tool",
    resourceValue: noveltyExecTarget,
    grantedActions: ["tool.exec"],
    issuedBy: "user:novelty-contract",
  });

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

  const selfOne = sendBoundaryInterceptServerInput({
    target,
    input: {
      actionClass: "file",
      operation: "read",
      target: selfOriginatedPath,
      payloadSummary: "trusted-system read one",
      provenance: "trusted_system",
    },
  });
  const selfTwo = sendBoundaryInterceptServerInput({
    target,
    input: {
      actionClass: "file",
      operation: "read",
      target: selfOriginatedPath,
      payloadSummary: "trusted-system read two",
      provenance: "trusted_system",
    },
  });

  const selfStatus = await waitForSwarmStatus({
    target,
    label: "self-originated novelty queue",
    predicate: (status) =>
      status.groups.some((group) =>
        group.target === selfOriginatedPath
        && group.state === "waiting"
        && group.waitingCount >= 2
        && group.path === "purple"
        && group.novelty?.selfOriginated === true
        && group.lawIds.includes("TIME.NOVELTY.01")),
  });
  const selfGroup = requireSwarmGroup(selfStatus, selfOriginatedPath);
  assert.equal(selfGroup.novelty?.selfOriginated, true);
  assert.equal(selfGroup.novelty?.classes?.includes("self_originated_motion"), true);
  assert.equal(selfGroup.novelty?.boundaryHits?.includes("reentry"), true);

  const selfApprove = await sendBoundaryInterceptServerInput({
    target,
    input: {
      command: "swarm_approve",
      groupId: selfGroup.groupId,
      issuedBy: "user:novelty-contract",
      reason: "record standing law for reviewed self-originated read",
      asLaw: true,
    },
  });
  assert.equal(selfApprove.type, "ack");

  const [selfDecisionOne, selfDecisionTwo] = await Promise.all([selfOne, selfTwo]) as [
    BoundaryInterceptDaemonOutput,
    BoundaryInterceptDaemonOutput,
  ];
  assert.equal(selfDecisionOne.type, "decision");
  assert.equal(selfDecisionTwo.type, "decision");
  assert.equal(selfDecisionOne.decision, "allow");
  assert.equal(selfDecisionTwo.decision, "allow");

  const noveltyExec = sendBoundaryInterceptServerInput({
    target,
    input: {
      actionClass: "shell",
      operation: "exec",
      target: noveltyExecTarget,
      payloadSummary: "echo novelty",
      novelty: {
        detected: true,
        classes: ["unknown_tool_request"],
        boundaryHits: ["front", "kernel"],
        reason: "unknown tool-shaped contact hit the kernel-facing execution boundary",
      },
    },
  });

  const execStatus = await waitForSwarmStatus({
    target,
    label: "exec novelty queue",
    predicate: (status) =>
      status.groups.some((group) =>
        group.target === noveltyExecTarget
        && group.state === "waiting"
        && group.path === "purple"
        && group.novelty?.boundaryHits?.includes("kernel")
        && group.lawIds.includes("TIME.NOVELTY.01")),
  });
  const execGroup = requireSwarmGroup(execStatus, noveltyExecTarget);
  assert.equal(execGroup.novelty?.classes?.includes("unknown_tool_request"), true);

  const execApprove = await sendBoundaryInterceptServerInput({
    target,
    input: {
      command: "swarm_approve",
      groupId: execGroup.groupId,
      issuedBy: "user:novelty-contract",
      reason: "admit novelty and re-hit downstream execution wall",
      asLaw: false,
    },
  });
  assert.equal(execApprove.type, "ack");

  const execDecision = await noveltyExec;
  assert.equal(execDecision.type, "decision");
  assert.equal(execDecision.decision, "deny");
  assert.ok(
    execDecision.lawIds.includes("BOUNDARY.EXEC.01"),
    `expected downstream exec deny after novelty admission, got reason=${execDecision.reason} lawIds=${execDecision.lawIds.join(",")}`,
  );

  const standingLawNovelty = sendBoundaryInterceptServerInput({
    target,
    input: {
      actionClass: "file",
      operation: "read",
      target: standingLawPath,
      payloadSummary: standingLawPayload,
      provenance: "trusted_system",
    },
  });

  const standingSeedStatus = await waitForSwarmStatus({
    target,
    label: "standing-law novelty queue",
    predicate: (status) =>
      status.groups.some((group) =>
        group.target === standingLawPath
        && group.state === "waiting"
        && group.path === "purple"),
  });
  const standingSeedGroup = requireSwarmGroup(standingSeedStatus, standingLawPath);

  const standingApprove = await sendBoundaryInterceptServerInput({
    target,
    input: {
      command: "swarm_approve",
      groupId: standingSeedGroup.groupId,
      issuedBy: "user:novelty-contract",
      reason: "record standing law for reviewed novelty read",
      asLaw: true,
    },
  });
  assert.equal(standingApprove.type, "ack");

  const standingSeedDecision = await standingLawNovelty;
  assert.equal(standingSeedDecision.type, "decision");
  assert.equal(standingSeedDecision.decision, "allow");

  const modeAck = await sendBoundaryInterceptServerInput({
    target,
    input: {
      command: "swarm_mode",
      mode: "standing_law",
    },
  });
  assert.equal(modeAck.type, "swarm_mode");
  assert.equal(modeAck.mode, "standing_law");

  const standingLawDecision = await sendBoundaryInterceptServerInput({
    target,
    input: {
      actionClass: "file",
      operation: "read",
      target: standingLawPath,
      payloadSummary: standingLawPayload,
      provenance: "trusted_system",
    },
  });
  assert.equal(standingLawDecision.type, "decision");
  assert.equal(standingLawDecision.decision, "allow");

  const noPendingStatus = await waitForSwarmStatus({
    target,
    label: "no pending novelty group after standing law replay",
    predicate: (status) => !status.groups.some((group) => group.target === standingLawPath && group.state === "waiting"),
  });
  assert.equal(
    noPendingStatus.groups.some((group) => group.target === standingLawPath && group.state === "waiting"),
    false,
  );

  interceptServer.kill("SIGTERM");
  await once(interceptServer, "exit");

  console.log("Agent Buccet novelty boundary contract");
  console.log(`self-originated queued: ${selfGroup.groupId}`);
  console.log(`self-originated replay decisions: ${selfDecisionOne.type === "decision" ? selfDecisionOne.decision : "error"}, ${selfDecisionTwo.type === "decision" ? selfDecisionTwo.decision : "error"}`);
  console.log(`novel exec downstream deny: ${execDecision.type === "decision" ? execDecision.decision : "error"}`);
  console.log(`standing-law replay: ${standingLawDecision.type === "decision" ? standingLawDecision.decision : "error"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
