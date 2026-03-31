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

  const approvalBlockedPromise = sendGravityPayload(
    { host: "127.0.0.1", port: gravityPort },
    `write|${path.join(tempRoot, "candidate.txt")}|${process.pid}|from-contract`,
  );

  const pendingGroupId = await waitFor(async () => {
    const swarmStatus = await sendBoundaryInterceptServerInput({
      target: { host: "127.0.0.1", port: interceptPort },
      input: { command: "swarm_status", requestId: "swarm-status-1" },
    });
    if (swarmStatus.type !== "swarm_status") {
      return null;
    }
    const pending = swarmStatus.groups.find((group) =>
      group.state === "waiting"
      && group.actionClass === "file"
      && group.operation === "write"
      && group.target === path.join(tempRoot, "candidate.txt")
    );
    return pending?.groupId ?? null;
  }, 5_000, 100);

  const approvalDenied = await sendBoundaryInterceptServerInput({
    target: { host: "127.0.0.1", port: interceptPort },
    input: {
      command: "swarm_deny",
      groupId: pendingGroupId,
      requestId: "swarm-deny-1",
      reason: "gravity-bridge-contract deny",
    },
  });
  assert.equal(approvalDenied.type, "ack");

  const approvalBlocked = await approvalBlockedPromise;
  assert.equal(
    approvalBlocked,
    "0",
    `expected approval-required payload to block at the front-layer\nintercept stderr:\n${interceptStderr}\nbridge stderr:\n${bridgeStderr}`,
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

  gravityBridge.kill("SIGTERM");
  interceptServer.kill("SIGTERM");
  await once(gravityBridge, "exit");
  await once(interceptServer, "exit");

  console.log(`gravity bridge blocked approval-required payload: ${approvalBlocked}`);
  console.log(`gravity bridge blocked hard-deny payload: ${denyBlocked}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
