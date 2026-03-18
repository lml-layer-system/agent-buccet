import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import path from "node:path";
import { once } from "node:events";

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendJson(socketPath: string, payload: object): Promise<unknown> {
  const socket = net.createConnection(socketPath);
  await once(socket, "connect");
  socket.write(`${JSON.stringify(payload)}\n`);
  let buffer = "";
  for await (const chunk of socket) {
    buffer += chunk.toString();
    const newline = buffer.indexOf("\n");
    if (newline === -1) {
      continue;
    }
    const line = buffer.slice(0, newline).trim();
    if (!line) {
      buffer = buffer.slice(newline + 1);
      continue;
    }
    socket.end();
    return JSON.parse(line);
  }
  throw new Error("socket closed before response");
}

async function main() {
  console.log("Agent Buccet intercept server contract");

  const sessionId = `intercept-server-contract-${randomUUID()}`;
  const socketPath = path.join("/tmp", `agent-buccet-intercept-${randomUUID()}.sock`);
  const cwd = process.cwd();
  const scriptPath = path.join(
    cwd,
    "bin",
    "agent-buccet-intercept-server.ts",
  );
  const fallbackPath = path.join(
    cwd,
    "scripts",
    "agent-buccet-intercept-server.ts",
  );
  const daemonPath = cwd.includes(`${path.sep}dist${path.sep}agent-buccet`) ? scriptPath : fallbackPath;

  const child = spawn(process.execPath, [daemonPath, "--session-id", sessionId, "--socket", socketPath], {
    cwd,
    stdio: ["ignore", "ignore", "pipe"],
  });

  let ready = false;
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    if (chunk.includes("intercept server running")) {
      ready = true;
    }
  });

  for (let attempt = 0; attempt < 50 && !ready; attempt += 1) {
    await wait(100);
  }
  assert.equal(ready, true, "server should reach ready state");

  const status = await sendJson(socketPath, {
    command: "status",
    requestId: "status-1",
  }) as { type: string; running: boolean };
  assert.equal(status.type, "status");
  assert.equal(status.running, true);
  console.log(`initial status running: ${status.running}`);

  const decision = await sendJson(socketPath, {
    requestId: "db-1",
    actionClass: "database",
    operation: "query",
    target: "db://primary/customers",
    payloadSummary: "select * from customers limit 1",
  }) as { type: string; decision: string };
  assert.equal(decision.type, "decision");
  assert.equal(decision.decision, "require_approval");
  console.log(`database intercept decision: ${decision.decision}`);

  const restart = await sendJson(socketPath, {
    command: "restart",
    requestId: "restart-1",
    reason: "server contract restart",
  }) as { type: string; command: string };
  assert.equal(restart.type, "ack");
  assert.equal(restart.command, "restart");
  console.log(`restart command: ${restart.command}`);

  const shutdown = await sendJson(socketPath, {
    command: "shutdown",
    requestId: "shutdown-1",
  }) as { type: string; command: string };
  assert.equal(shutdown.type, "ack");
  assert.equal(shutdown.command, "shutdown");
  console.log(`shutdown command: ${shutdown.command}`);

  await once(child, "exit");
  await fs.rm(socketPath, { force: true }).catch(() => undefined);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
