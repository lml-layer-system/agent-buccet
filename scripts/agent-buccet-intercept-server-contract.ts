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
  const scriptPath = path.join(cwd, "bin", "agent-buccet-intercept-server.ts");
  const fallbackPath = path.join(cwd, "scripts", "agent-buccet-intercept-server.ts");
  const daemonPath = cwd.includes(`${path.sep}dist${path.sep}agent-buccet`) ? scriptPath : fallbackPath;

  const child = spawn(process.execPath, [daemonPath, "--session-id", sessionId, "--socket", socketPath], {
    cwd,
    stdio: ["ignore", "ignore", "pipe"],
  });

  let ready = false;
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
    if (chunk.includes("intercept server running")) {
      ready = true;
    }
  });

  for (let attempt = 0; attempt < 50 && !ready; attempt += 1) {
    await wait(100);
  }
  assert.equal(ready, true, `server should reach ready state\n${stderr}`);

  const status = await sendJson(socketPath, {
    command: "status",
    requestId: "status-1",
  }) as { type: string; running: boolean };
  assert.equal(status.type, "status");
  assert.equal(status.running, true);
  console.log(`initial status running: ${status.running}`);

  child.kill("SIGTERM");
  await wait(250);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await wait(250);
  }

  await fs.rm(socketPath, { force: true }).catch(() => undefined);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
