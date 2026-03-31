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

async function sendJsonOrNull(socketPath: string, payload: object): Promise<unknown | null> {
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
  return null;
}

async function main() {
  console.log("Agent Buccet intercept server contract");

  const sessionId = `intercept-server-contract-${randomUUID()}`;
  const socketPath = path.join("/tmp", `ab-is-${randomUUID().slice(0, 12)}.sock`);
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

  const decision = await sendJson(socketPath, {
    requestId: "meta-deny-1",
    actionClass: "file",
    operation: "write",
    target: "/tmp/agent-buccet-intercept-contract.txt",
    payloadSummary: "contract authority claim",
    provenance: "agent_inference",
    flags: {
      authorityClaimed: true,
    },
  }) as { type: string; decision: string };
  assert.equal(decision.type, "decision");
  assert.equal(decision.decision, "deny");
  console.log(`meta-law intercept decision: ${decision.decision}`);

  const deniedSwarmStatus = await waitFor(async () => {
    const status = await sendJson(socketPath, {
      command: "swarm_status",
      requestId: "swarm-status-meta-deny",
    }) as {
      type: string;
      groups: Array<{ state: string; target: string; actionClass?: string; operation?: string }>;
    };
    if (status.type !== "swarm_status") {
      return null;
    }
    const deniedGroup = status.groups.find((group) =>
      group.state === "denied"
      && group.actionClass === "file"
      && group.operation === "write"
      && group.target === "/tmp/agent-buccet-intercept-contract.txt"
    );
    return deniedGroup ? status : null;
  }, 5_000, 100);
  assert.equal(deniedSwarmStatus.type, "swarm_status");

  const restart = await sendJson(socketPath, {
    command: "restart",
    requestId: "restart-1",
    reason: "server contract restart",
  }) as { type: string; command: string; restartCount?: number };
  assert.equal(restart.type, "ack");
  assert.equal(restart.command, "restart");
  assert.equal(typeof restart.restartCount, "number");

  await waitFor(async () => {
    const restartedStatus = await sendJson(socketPath, {
      command: "status",
      requestId: "status-after-restart",
    }) as { type: string; running: boolean };
    return restartedStatus.type === "status" && restartedStatus.running ? restartedStatus : null;
  }, 5_000, 100);

  const denyAsLaw = await sendJson(socketPath, {
    command: "ingress_deny_as_law",
    provenance: "ip:9.9.9.9",
    requestId: "ingress-deny-as-law",
  }) as { type: string; command: string };
  assert.equal(denyAsLaw.type, "ack");
  assert.equal(denyAsLaw.command, "ingress_deny_as_law");

  const ingressStatus = await sendJson(socketPath, {
    command: "ingress_status",
    requestId: "ingress-status-1",
  }) as {
    type: string;
    provenances: Array<{ provenance: string; state: string; operatorDisposition?: string }>;
  };
  assert.equal(ingressStatus.type, "ingress_status");
  const deniedEntry = ingressStatus.provenances.find((entry) => entry.provenance === "ip:9.9.9.9");
  assert.ok(deniedEntry, "canyon-held provenance should appear in ingress status");
  assert.equal(deniedEntry?.state, "canyon");
  assert.equal(deniedEntry?.operatorDisposition, "deny_as_law");

  const tarpitted = await sendJsonOrNull(socketPath, {
    actionClass: "network",
    operation: "send",
    target: "attacker.example",
    provenance: "external_content",
    requestId: "ingress-tarpit",
    admission: {
      provenance: "ip:9.9.9.9",
      provenanceStrength: "weak",
      weightClass: "standard",
    },
  });
  assert.equal(tarpitted, null, "canyon-held ingress should be tarpitted without a fast response");

  const allowOnce = await sendJson(socketPath, {
    command: "ingress_allow_once",
    provenance: "ip:9.9.9.9",
    requestId: "ingress-allow-once",
  }) as { type: string; command: string };
  assert.equal(allowOnce.type, "ack");
  assert.equal(allowOnce.command, "ingress_allow_once");

  const ingressStatus2 = await sendJson(socketPath, {
    command: "ingress_status",
    requestId: "ingress-status-2",
  }) as {
    type: string;
    provenances: Array<{ provenance: string; state: string; allowOnceRemaining?: number }>;
  };
  const allowOnceEntry = ingressStatus2.provenances.find((entry) => entry.provenance === "ip:9.9.9.9");
  assert.ok(allowOnceEntry, "allow once should expose a one-shot ingress release");
  assert.equal(allowOnceEntry?.state, "allow_once");
  assert.equal(allowOnceEntry?.allowOnceRemaining, 1);

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
