import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import {
  describeUserPath,
  hashUserPath,
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

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-intercept-server-"));
  const sessionId = `intercept-server-contract-${randomUUID()}`;
  const socketPath = path.join("/tmp", `ab-is-${randomUUID().slice(0, 12)}.sock`);
  const uplPath = path.join(tempRoot, "user-path-ledger.json");
  const allowedTarget = "/bin/echo";
  const deniedTarget = "/usr/bin/id";
  // reviewContext must include surface: "action" so the hash stored in the UPL ledger
  // matches the normalized hash used by evaluateRequestWithMode and evaluateBoundaryIntercept.
  const allowedRequest = {
    sessionId,
    requestId: "standing-law-upl",
    requestedAt: new Date(0).toISOString(),
    actionKind: "tool.exec" as const,
    target: allowedTarget,
    payloadSummary: "standing-law allow /bin/echo",
    provenance: "agent_inference" as const,
    reviewContext: { surface: "action" as const },
  };
  await fs.writeFile(uplPath, `${JSON.stringify({
    specVersion: 1,
    userApprovedLawPaths: [
      {
        id: "UPL-000001",
        type: "APPROVED",
        path: describeUserPath(allowedRequest),
        pathHash: hashUserPath(allowedRequest),
        createdAt: new Date().toISOString(),
        scope: "GLOBAL",
        status: "ACTIVE",
        witness: "standing-law-contract",
        requestBasis: {
          actionKind: allowedRequest.actionKind,
          target: allowedRequest.target,
          payloadSummary: allowedRequest.payloadSummary,
          provenance: allowedRequest.provenance,
        },
      },
    ],
    userDeniedLawPaths: [],
  }, null, 2)}\n`, "utf8");
  const cwd = process.cwd();
  const scriptPath = path.join(cwd, "bin", "agent-buccet-intercept-server.ts");
  const fallbackPath = path.join(cwd, "scripts", "agent-buccet-intercept-server.ts");
  const daemonPath = cwd.includes(`${path.sep}dist${path.sep}agent-buccet`) ? scriptPath : fallbackPath;
  const child = spawn(process.execPath, [daemonPath, "--session-id", sessionId, "--socket", socketPath], {
    cwd,
    stdio: ["ignore", "ignore", "pipe"],
    env: {
      ...process.env,
      AGENT_BUCCET_UPL_LEDGER_PATH: uplPath,
    },
  });

  try {
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
    }) as { type: string; running: boolean; approvalMode?: string };
    assert.equal(status.type, "status");
    assert.equal(status.running, true);
    assert.equal(status.approvalMode, "interactive");
    console.log(`initial status running: ${status.running}`);

    const modeStatus = await sendJson(socketPath, {
      command: "swarm_mode",
      requestId: "swarm-mode-status-1",
    }) as { type: string; mode: string };
    assert.equal(modeStatus.type, "swarm_mode");
    assert.equal(modeStatus.mode, "interactive");

    const enabledStandingLaw = await sendJson(socketPath, {
      command: "swarm_mode",
      requestId: "swarm-mode-enable-standing-law",
      mode: "standing_law",
    }) as { type: string; mode: string };
    assert.equal(enabledStandingLaw.type, "swarm_mode");
    assert.equal(enabledStandingLaw.mode, "standing_law");

    const standingLawAllowed = await sendJson(socketPath, {
      requestId: "standing-law-allow-match",
      actionClass: "shell",
      operation: "exec",
      target: allowedTarget,
      payloadSummary: "standing-law allow /bin/echo",
      provenance: "agent_inference",
    }) as { type: string; decision: string; reason: string };
    assert.equal(standingLawAllowed.type, "decision");
    assert.equal(standingLawAllowed.decision, "allow");
    assert.match(standingLawAllowed.reason, /standing-law:/);
    console.log(`standing-law allowed decision: ${standingLawAllowed.decision}`);

    const standingLawDenied = await sendJson(socketPath, {
      requestId: "standing-law-deny-no-match",
      actionClass: "shell",
      operation: "exec",
      target: deniedTarget,
      payloadSummary: "standing-law no match /usr/bin/id",
      provenance: "agent_inference",
    }) as { type: string; decision: string; reason: string };
    assert.equal(standingLawDenied.type, "decision");
    assert.equal(standingLawDenied.decision, "deny");
    assert.match(standingLawDenied.reason, /standing-law:/);
    console.log(`standing-law unmatched decision: ${standingLawDenied.decision}`);

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
        mode: string;
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
    assert.equal(deniedSwarmStatus.mode, "standing_law");

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
      }) as { type: string; running: boolean; approvalMode?: string };
      return restartedStatus.type === "status" && restartedStatus.running ? restartedStatus : null;
    }, 5_000, 100);

    const restoredStandingLaw = await sendJson(socketPath, {
      command: "swarm_mode",
      requestId: "swarm-mode-status-after-restart",
    }) as { type: string; mode: string };
    assert.equal(restoredStandingLaw.type, "swarm_mode");
    assert.equal(restoredStandingLaw.mode, "standing_law");

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

    const restoredInteractive = await sendJson(socketPath, {
      command: "swarm_mode",
      requestId: "swarm-mode-restore-interactive",
      mode: "interactive",
    }) as { type: string; mode: string };
    assert.equal(restoredInteractive.type, "swarm_mode");
    assert.equal(restoredInteractive.mode, "interactive");
  } finally {
    child.kill("SIGTERM");
    await wait(250);
    if (child.exitCode === null) {
      child.kill("SIGKILL");
      await wait(250);
    }

    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
