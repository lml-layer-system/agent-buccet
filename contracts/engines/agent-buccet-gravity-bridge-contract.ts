import assert from "node:assert/strict";
import net from "node:net";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  sendBoundaryInterceptServerInput,
} from "../lib/agent-buccet/index.ts";

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(fn: () => Promise<T | null>, timeoutMs: number, stepMs: number): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await fn();
    if (result !== null) {
      return result;
    }
    await wait(stepMs);
  }
  throw new Error(`timed out after ${timeoutMs}ms`);
}

async function sendGravityPayload(target: { host: string; port: number }, payload: string): Promise<string> {
  const socket = net.createConnection(target.port, target.host);
  await once(socket, "connect");
  socket.write(`${payload}\n`);

  let response = "";
  for await (const chunk of socket) {
    response += chunk.toString();
    if (response.length >= 1) {
      socket.end();
      return response[0] ?? "0";
    }
  }
  throw new Error("gravity bridge closed before responding");
}

async function waitForPendingGroup(args: {
  interceptPort: number;
  predicate: (group: {
    groupId: string;
    actionClass: string;
    operation: string;
    target: string;
    waitingCount: number;
    memberCount: number;
    state: string;
  }) => boolean;
  label: string;
}) {
  return await waitFor(async () => {
    const swarmStatus = await sendBoundaryInterceptServerInput({
      target: { host: "127.0.0.1", port: args.interceptPort },
      input: {
        command: "swarm_status",
      },
    });
    assert.equal(swarmStatus.type, "swarm_status");
    return swarmStatus.groups.find((group) => group.state === "waiting" && args.predicate(group)) ?? null;
  }, 10_000, 100);
}

async function main() {
  const repoRoot = process.cwd();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-gravity-bridge-"));
  const sessionId = `gravity-bridge-${randomUUID()}`;
  const interceptPort = 7788 + Math.floor(Math.random() * 1000);
  const gravityPort = 9000 + Math.floor(Math.random() * 1000);

  const interceptServerPath = path.join(repoRoot, "scripts", "agent-buccet-intercept-server.ts");
  const gravityBridgePath = path.join(repoRoot, "scripts", "agent-buccet-gravity-bridge.ts");

  const interceptServer = spawn(process.execPath, [
    interceptServerPath,
    "--session-id",
    sessionId,
    "--host",
    "127.0.0.1",
    "--port",
    String(interceptPort),
  ], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "pipe"],
  });

  let interceptReady = false;
  let interceptStderr = "";
  interceptServer.stderr.setEncoding("utf8");
  interceptServer.stderr.on("data", (chunk) => {
    interceptStderr += chunk;
    if (chunk.includes("intercept server running")) {
      interceptReady = true;
    }
  });

  for (let attempt = 0; attempt < 100 && !interceptReady; attempt += 1) {
    await wait(100);
  }
  assert.equal(interceptReady, true, `intercept server should be ready\n${interceptStderr}`);

  const gravityBridge = spawn(process.execPath, [
    gravityBridgePath,
    "--listen-host",
    "127.0.0.1",
    "--listen-port",
    String(gravityPort),
    "--upstream-host",
    "127.0.0.1",
    "--upstream-port",
    String(interceptPort),
  ], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "pipe"],
  });

  let bridgeReady = false;
  let bridgeStderr = "";
  gravityBridge.stderr.setEncoding("utf8");
  gravityBridge.stderr.on("data", (chunk) => {
    bridgeStderr += chunk;
    if (chunk.includes("gravity bridge running")) {
      bridgeReady = true;
    }
  });

  for (let attempt = 0; attempt < 100 && !bridgeReady; attempt += 1) {
    await wait(100);
  }
  assert.equal(bridgeReady, true, `gravity bridge should be ready\n${bridgeStderr}`);

  const approvalTarget = path.join(tempRoot, "candidate.txt");
  let approvalSettled = false;
  const approvalReleasedPromise = sendGravityPayload(
    { host: "127.0.0.1", port: gravityPort },
    `write|${approvalTarget}|${process.pid}|from-contract`,
  );
  void approvalReleasedPromise.finally(() => {
    approvalSettled = true;
  });

  await wait(250);
  assert.equal(
    approvalSettled,
    false,
    `expected approval-required payload to remain frozen while waiting for swarm approval\nintercept stderr:\n${interceptStderr}\nbridge stderr:\n${bridgeStderr}`,
  );

  const swarmStatus = await sendBoundaryInterceptServerInput({
    target: { host: "127.0.0.1", port: interceptPort },
    input: {
      command: "swarm_status",
    },
  });
  assert.equal(swarmStatus.type, "swarm_status");
  assert.equal(swarmStatus.totals.pending, 1);
  assert.equal(swarmStatus.totals.waitingMembers, 1);
  const pendingGroup = swarmStatus.groups.find((group) => group.target === approvalTarget);
  assert.ok(pendingGroup, "expected pending swarm group for approval target");

  const approvalAck = await sendBoundaryInterceptServerInput({
    target: { host: "127.0.0.1", port: interceptPort },
    input: {
      command: "swarm_approve",
      groupId: pendingGroup.groupId,
      issuedBy: "user:gravity-bridge-contract",
      reason: "release frozen gravity payload after explicit approval",
    },
  });
  assert.equal(approvalAck.type, "ack");
  assert.equal(approvalAck.command, "swarm_approve");

  const approvalReleased = await approvalReleasedPromise;
  assert.equal(
    approvalReleased,
    "1",
    `expected approval-required payload to release after swarm approval\nintercept stderr:\n${interceptStderr}\nbridge stderr:\n${bridgeStderr}`,
  );

  const denyDecision = await sendBoundaryInterceptServerInput({
    target: { host: "127.0.0.1", port: interceptPort },
    input: {
      actionClass: "file",
      operation: "write",
      target: path.join(tempRoot, "meta-denied.txt"),
      payloadSummary: `pid=${process.pid} from-contract`,
      provenance: "agent_inference",
      flags: {
        authorityClaimed: true,
      },
    },
  });
  assert.equal(denyDecision.type, "decision");
  assert.equal(denyDecision.decision, "deny");

  const denyBlocked = await sendGravityPayload(
    { host: "127.0.0.1", port: gravityPort },
    `write|${path.join(tempRoot, "meta-denied.txt")}|${process.pid}|from-contract prov=agent_inference flags=authorityClaimed`,
  );
  assert.equal(
    denyBlocked,
    "0",
    `expected hard-deny payload to block at the front-layer\nintercept stderr:\n${interceptStderr}\nbridge stderr:\n${bridgeStderr}`,
  );

  const renameSource = path.join(tempRoot, "rename-source.txt");
  const renameDestination = path.join(tempRoot, "rename-destination.txt");
  let renameSettled = false;
  const renamePromise = sendGravityPayload(
    { host: "127.0.0.1", port: gravityPort },
    `rename|${renameSource}|${process.pid}|${renameDestination}`,
  );
  void renamePromise.finally(() => {
    renameSettled = true;
  });

  const renameSourceGroup = await waitForPendingGroup({
    interceptPort,
    label: "rename source group",
    predicate: (group) =>
      group.actionClass === "file"
      && group.operation === "move"
      && group.target === renameSource,
  });
  assert.equal(renameSettled, false, "rename payload should remain frozen on the source-side hold");
  const renameSourceAck = await sendBoundaryInterceptServerInput({
    target: { host: "127.0.0.1", port: interceptPort },
    input: {
      command: "swarm_approve",
      groupId: renameSourceGroup.groupId,
      issuedBy: "user:gravity-bridge-contract",
      reason: "release rename source hold",
    },
  });
  assert.equal(renameSourceAck.type, "ack");

  const renameDestinationGroup = await waitForPendingGroup({
    interceptPort,
    label: "rename destination group",
    predicate: (group) =>
      group.actionClass === "file"
      && group.operation === "move"
      && group.target === renameDestination,
  });
  const renameDestinationAck = await sendBoundaryInterceptServerInput({
    target: { host: "127.0.0.1", port: interceptPort },
    input: {
      command: "swarm_deny",
      groupId: renameDestinationGroup.groupId,
      deniedBy: "user:gravity-bridge-contract",
      reason: "deny rename destination hold",
    },
  });
  assert.equal(renameDestinationAck.type, "ack");

  const renameBlocked = await renamePromise;
  assert.equal(
    renameBlocked,
    "0",
    `expected rename payload to block if the destination-side hold is denied\nintercept stderr:\n${interceptStderr}\nbridge stderr:\n${bridgeStderr}`,
  );

  const symlinkPath = path.join(tempRoot, "alias-link.txt");
  const symlinkTarget = path.join(tempRoot, "alias-target.txt");
  let symlinkSettled = false;
  const symlinkPromise = sendGravityPayload(
    { host: "127.0.0.1", port: gravityPort },
    `symlink|${symlinkPath}|${process.pid}|${symlinkTarget}`,
  );
  void symlinkPromise.finally(() => {
    symlinkSettled = true;
  });

  const symlinkPathGroup = await waitForPendingGroup({
    interceptPort,
    label: "symlink path group",
    predicate: (group) =>
      group.actionClass === "file"
      && group.operation === "move"
      && group.target === symlinkPath,
  });
  assert.equal(symlinkSettled, false, "symlink payload should remain frozen on the link-path hold");
  const symlinkPathAck = await sendBoundaryInterceptServerInput({
    target: { host: "127.0.0.1", port: interceptPort },
    input: {
      command: "swarm_approve",
      groupId: symlinkPathGroup.groupId,
      issuedBy: "user:gravity-bridge-contract",
      reason: "release symlink path hold",
    },
  });
  assert.equal(symlinkPathAck.type, "ack");

  const symlinkTargetGroup = await waitForPendingGroup({
    interceptPort,
    label: "symlink target group",
    predicate: (group) =>
      group.actionClass === "file"
      && group.operation === "move"
      && group.target === symlinkTarget,
  });
  const symlinkTargetAck = await sendBoundaryInterceptServerInput({
    target: { host: "127.0.0.1", port: interceptPort },
    input: {
      command: "swarm_deny",
      groupId: symlinkTargetGroup.groupId,
      deniedBy: "user:gravity-bridge-contract",
      reason: "deny symlink target hold",
    },
  });
  assert.equal(symlinkTargetAck.type, "ack");

  const symlinkBlocked = await symlinkPromise;
  assert.equal(
    symlinkBlocked,
    "0",
    `expected symlink payload to block if the target-side hold is denied\nintercept stderr:\n${interceptStderr}\nbridge stderr:\n${bridgeStderr}`,
  );

  gravityBridge.kill("SIGTERM");
  interceptServer.kill("SIGTERM");
  await once(gravityBridge, "exit");
  await once(interceptServer, "exit");

  console.log(`gravity bridge released approval-required payload: ${approvalReleased}`);
  console.log(`gravity bridge blocked hard-deny payload: ${denyBlocked}`);
  console.log(`gravity bridge held rename source and destination separately: ${renameBlocked}`);
  console.log(`gravity bridge held symlink path and target separately: ${symlinkBlocked}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
