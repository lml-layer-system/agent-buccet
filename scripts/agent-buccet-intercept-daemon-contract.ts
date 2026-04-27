import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import path from "node:path";
import readline from "node:readline";

type DaemonOutput = Record<string, unknown>;

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function createDaemonClient(child: ReturnType<typeof spawn>) {
  const waiters = new Map<string, {
    resolve: (value: DaemonOutput) => void;
    reject: (reason?: unknown) => void;
  }>();

  const rl = readline.createInterface({
    input: child.stdout!,
    crlfDelay: Infinity,
  });

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    const output = JSON.parse(trimmed) as DaemonOutput;
    const requestId = String(output.requestId ?? "");
    const waiter = waiters.get(requestId);
    if (!waiter) {
      return;
    }
    waiters.delete(requestId);
    waiter.resolve(output);
  });

  child.once("exit", (code, signal) => {
    for (const waiter of waiters.values()) {
      waiter.reject(new Error(`daemon exited before response (code=${String(code)} signal=${String(signal)})`));
    }
    waiters.clear();
  });

  return {
    send(requestId: string, payload: object): Promise<DaemonOutput> {
      return new Promise((resolve, reject) => {
        waiters.set(requestId, { resolve, reject });
        child.stdin!.write(`${JSON.stringify({ requestId, ...payload })}\n`);
      });
    },
  };
}

async function main() {
  console.log("Agent Buccet intercept daemon contract");

  const cwd = process.cwd();
  const sessionId = `agent-buccet-intercept-daemon-${randomUUID()}`;
  const daemonPath = path.join(cwd, cwd.includes(`${path.sep}dist${path.sep}agent-buccet`)
    ? "bin/agent-buccet-intercept-daemon.ts"
    : "scripts/agent-buccet-intercept-daemon.ts");

  const child = spawn(process.execPath, [
    daemonPath,
    "--session-id",
    sessionId,
    "--heartbeat-ms",
    "250",
    "--heartbeat-timeout-ms",
    "3000",
  ], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let ready = false;
  let stderr = "";
  child.stderr!.setEncoding("utf8");
  child.stderr!.on("data", (chunk) => {
    stderr += chunk;
    if (chunk.includes("intercept daemon running") || chunk.includes("intercept server running")) {
      ready = true;
    }
  });

  for (let attempt = 0; attempt < 100 && !ready; attempt += 1) {
    await wait(100);
  }
  assert.equal(ready, true, `daemon should reach ready state\n${stderr}`);

  const client = createDaemonClient(child);

  const status = await client.send("status-1", { command: "status" }) as {
    type: string;
    running: boolean;
    approvalMode?: string;
    swarm?: { pending: number };
  };
  assert.equal(status.type, "status");
  assert.equal(status.running, true);
  assert.equal(status.approvalMode, "interactive");
  console.log(`initial status running: ${status.running}`);

  const decisionTarget = "/tmp/agent-buccet-intercept-daemon-contract.txt";
  const decision = await client.send("decision-1", {
    actionClass: "file",
    operation: "write",
    target: decisionTarget,
    payloadSummary: "daemon contract pending write",
    provenance: "agent_inference",
  }) as { type: string; decision: string; reason: string };
  assert.equal(decision.type, "decision");
  assert.equal(decision.decision, "deny");
  assert.match(decision.reason, /outside user-opened reachable scope/i);
  console.log(`daemon-held decision: ${decision.decision}`);

  const restart = await client.send("restart-1", {
    command: "restart",
    reason: "daemon contract restart",
  }) as { type: string; command: string };
  assert.equal(restart.type, "ack");
  assert.equal(restart.command, "restart");
  console.log(`restart command: ${restart.command}`);

  const shutdown = await client.send("shutdown-1", {
    command: "shutdown",
  }) as { type: string; command: string };
  assert.equal(shutdown.type, "ack");
  assert.equal(shutdown.command, "shutdown");
  console.log(`shutdown command: ${shutdown.command}`);

  await once(child, "exit");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
