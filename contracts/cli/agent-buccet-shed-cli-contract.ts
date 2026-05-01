import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "scripts", "buccet.ts");

function runCli(args: string[], env: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath, ...args], {
      cwd: repoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ stdout, stderr, code });
    });
  });
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-shed-cli-"));
  const homePath = path.join(tempRoot, "home");
  const workspacePath = path.join(tempRoot, "workspace");
  const uplLedgerPath = path.join(tempRoot, "upl-ledger.json");
  await fs.mkdir(workspacePath, { recursive: true });

  const env = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_CALLER_CWD: workspacePath,
    AGENT_BUCCET_LAUNCHER_PATH: path.join(tempRoot, "bin", "buccet"),
    AGENT_BUCCET_UPL_LEDGER_PATH: uplLedgerPath,
  };

  try {
    const initResult = await runCli(["init", "--session-id", "shed-cli-session", "--actor-id", "user:shed-cli"], env);
    assert.equal(initResult.code, 0, initResult.stderr);

    const shedResult = await runCli(["shed", "--json"], env);
    assert.equal(shedResult.code, 0, shedResult.stderr);
    const shed = JSON.parse(shedResult.stdout) as {
      unitId: string;
      runtimeDir: string;
      snapshotPath: string;
      persistedState: boolean;
      enteredEnvironment: boolean;
      lifecycleStarted: boolean;
    };
    assert.match(shed.unitId, /^disp-/);
    assert.equal(shed.persistedState, true);
    assert.equal(shed.enteredEnvironment, true);
    assert.equal(shed.lifecycleStarted, true);
    await fs.access(shed.snapshotPath);

    const statusResult = await runCli(["shed", "status", "--json"], env);
    assert.equal(statusResult.code, 0, statusResult.stderr);
    const status = JSON.parse(statusResult.stdout) as {
      sessionId: string;
      shedCount: number;
      respawnCount: number;
      entries: Array<{ eventType: string }>;
    };
    assert.equal(status.sessionId, "shed-cli-session");
    assert.equal(status.shedCount >= 1, true);
    assert.equal(status.respawnCount >= 1, true);
    assert.equal(status.entries.some((entry) => entry.eventType === "DISPOSABLE_SHED_TRIGGERED"), true);
    assert.equal(status.entries.some((entry) => entry.eventType === "DISPOSABLE_RESPAWNED"), true);

    console.log("Agent Buccet shed CLI contract");
    console.log(`unit: ${shed.unitId}`);
    console.log(`runtime: ${shed.runtimeDir}`);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
