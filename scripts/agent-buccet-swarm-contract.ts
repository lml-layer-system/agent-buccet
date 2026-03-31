import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import {
  readBoundaryLedgerBySession,
  sendBoundaryInterceptServerInput,
  type BoundaryInterceptDaemonOutput,
} from "../lib/agent-buccet/index.ts";

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSwarmStatus(args: {
  target: { socketPath: string };
  predicate: (status: {
    type: string;
    totals: { pending: number; waitingMembers: number };
    groups: Array<{
      groupId: string;
      target: string;
      waitingCount: number;
      memberCount: number;
    }>;
  }) => boolean;
  label: string;
}) {
  let lastStatus:
    | {
        type: string;
        totals: { pending: number; waitingMembers: number };
        groups: Array<{
          groupId: string;
          target: string;
          waitingCount: number;
          memberCount: number;
        }>;
      }
    | undefined;

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

async function main() {
  const repoRoot = process.cwd();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-swarm-"));
  const sessionId = `swarm-contract-${randomUUID()}`;
  const socketPath = path.join("/tmp", `ab-swarm-${randomUUID().slice(0, 12)}.sock`);
  const target = { socketPath };

  const interceptServer = spawn(process.execPath, [
    path.join(repoRoot, "scripts", "agent-buccet-intercept-server.ts"),
    "--session-id",
    sessionId,
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
  const firstRequest = sendBoundaryInterceptServerInput({
    target,
    input: {
      actionClass: "file",
      operation: "write",
      target: sharedTarget,
      payloadSummary: "pid=1001 agent=one",
    },
  });
  const secondRequest = sendBoundaryInterceptServerInput({
    target,
    input: {
      actionClass: "file",
      operation: "write",
      target: sharedTarget,
      payloadSummary: "pid=1002 agent=two",
    },
  });

  const swarmStatus = await waitForSwarmStatus({
    target,
    label: "two waiting swarm members",
    predicate: (status) =>
      status.totals.pending === 1
      && status.totals.waitingMembers === 2
      && status.groups.some((group) => group.target === sharedTarget && group.waitingCount >= 2),
  });
  assert.equal(swarmStatus.totals.pending, 1, "expected one pending swarm group");
  assert.equal(swarmStatus.totals.waitingMembers, 2, "expected two waiting swarm members");
  assert.equal(swarmStatus.groups.length >= 1, true, "expected at least one tracked group");

  const pendingGroup = swarmStatus.groups.find((group) => group.target === sharedTarget);
  assert.ok(pendingGroup, "expected shared swarm target group");
  assert.equal(pendingGroup.target, sharedTarget);
  assert.equal(pendingGroup.waitingCount >= 2, true);
  assert.equal(pendingGroup.memberCount >= 2, true);

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

  interceptServer.kill("SIGTERM");
  await once(interceptServer, "exit");

  console.log("Agent Buccet swarm contract");
  console.log(`group: ${pendingGroup.groupId}`);
  console.log(`waiting members: ${pendingGroup.waitingCount}`);
  console.log(`first decision: ${firstDecision.type === "decision" ? firstDecision.decision : "error"}`);
  console.log(`second decision: ${secondDecision.type === "decision" ? secondDecision.decision : "error"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
