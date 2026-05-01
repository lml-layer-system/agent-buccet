import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  evaluateSystemInterceptEvent,
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

async function main() {
  console.log("Agent Buccet system intercept contract");

  const sessionId = `system-intercept-contract-${randomUUID()}`;
  const socketPath = path.join("/tmp", `agent-buccet-system-intercept-${randomUUID()}.sock`);
  const cwd = process.cwd();
  const scriptPath = path.join(cwd, "bin", "agent-buccet-intercept-server.ts");
  const fallbackPath = path.join(cwd, "scripts", "agent-buccet-intercept-server.ts");
  const serverPath = cwd.includes(`${path.sep}dist${path.sep}agent-buccet`) ? scriptPath : fallbackPath;

  const child = spawn(process.execPath, [serverPath, "--session-id", sessionId, "--socket", socketPath], {
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

  const status = await sendBoundaryInterceptServerInput({
    target: { socketPath },
    input: { command: "status", requestId: "status-1" },
  });
  assert.equal(status.type, "status");
  console.log(`status transport: ${status.type}`);

  const deleteDecisionPromise = evaluateSystemInterceptEvent({
    target: { socketPath },
    event: {
      requestId: "file-delete-1",
      kind: "file.delete",
      target: "/tmp/outside-scope.txt",
      pid: process.pid,
      executablePath: process.execPath,
      cwd,
    },
  });

  const pendingGroupId = await waitFor(async () => {
    const swarmStatus = await sendBoundaryInterceptServerInput({
      target: { socketPath },
      input: { command: "swarm_status", requestId: "swarm-status-1" },
    });
    if (swarmStatus.type !== "swarm_status") {
      return null;
    }
    const pending = swarmStatus.groups.find((group) =>
      group.state === "waiting"
      && group.actionClass === "file"
      && group.operation === "delete"
      && group.target === "/tmp/outside-scope.txt"
    );
    return pending?.groupId ?? null;
  }, 5_000, 100);

  const deleteDenied = await sendBoundaryInterceptServerInput({
    target: { socketPath },
    input: {
      command: "swarm_deny",
      groupId: pendingGroupId,
      requestId: "swarm-deny-1",
      reason: "system-intercept-contract deny",
    },
  });
  assert.equal(deleteDenied.type, "ack");

  const deleteDecision = await deleteDecisionPromise;
  assert.equal(deleteDecision.type, "decision");
  assert.equal(deleteDecision.decision, "deny");
  console.log(`file delete decision: ${deleteDecision.decision}`);

  const credentialDecision = await evaluateSystemInterceptEvent({
    target: { socketPath },
    event: {
      requestId: "credential-read-1",
      kind: "system.credential.read",
      target: "credential://prod/api-key",
      pid: process.pid,
      executablePath: process.execPath,
      cwd,
      provenance: "agent_inference",
      flags: {
        authorityClaimed: true,
      },
    },
  });
  assert.equal(credentialDecision.type, "decision");
  assert.equal(credentialDecision.decision, "deny");
  console.log(`credential read decision: ${credentialDecision.decision}`);

  const shutdown = await sendBoundaryInterceptServerInput({
    target: { socketPath },
    input: { command: "shutdown", requestId: "shutdown-1" },
  });
  assert.equal(shutdown.type, "ack");
  console.log(`shutdown transport: ${shutdown.type}`);

  await once(child, "exit");
  await fs.rm(socketPath, { force: true }).catch(() => undefined);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
