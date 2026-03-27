import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const scriptPath = await (async () => {
  const candidates = [
    path.join(repoRoot, "scripts", "buccet.ts"),
    path.join(repoRoot, "bin", "buccet.ts"),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error("unable to locate buccet CLI script");
})();

function runCli(args: string[], env: NodeJS.ProcessEnv, stdinInput?: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath, ...args], {
      cwd: repoRoot,
      env,
      stdio: [stdinInput !== undefined ? "pipe" : "ignore", "pipe", "pipe"],
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

    if (stdinInput !== undefined) {
      child.stdin!.write(stdinInput);
      child.stdin!.end();
    }
  });
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-cli-"));
  const homePath = path.join(tempRoot, "home");
  const workspacePath = path.join(tempRoot, "workspace");
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.writeFile(path.join(workspacePath, "note.txt"), "hello\n", "utf8");

  const env = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_CALLER_CWD: workspacePath,
    AGENT_BUCCET_LAUNCHER_PATH: path.join(tempRoot, "bin", "buccet"),
  };

  const initResult = await runCli(["init"], env);
  assert.equal(initResult.code, 0, initResult.stderr);
  assert.match(initResult.stdout, /Agent Buccet/);

  const statusResult = await runCli(["status", "--json"], env);
  assert.equal(statusResult.code, 0, statusResult.stderr);
  const status = JSON.parse(statusResult.stdout) as {
    initialized: boolean;
    sessionStatus: string;
    scopes: string[];
  };
  assert.equal(status.initialized, true);
  assert.equal(status.sessionStatus, "active");
  assert.ok(status.scopes.includes(workspacePath));

  const scopeAddResult = await runCli(["scope", "add", "."], env);
  assert.equal(scopeAddResult.code, 0, scopeAddResult.stderr);

  const scopeListResult = await runCli(["scope", "list", "--json"], env);
  assert.equal(scopeListResult.code, 0, scopeListResult.stderr);
  const scopes = JSON.parse(scopeListResult.stdout) as Array<{ rootPath: string }>;
  assert.ok(scopes.some((scope) => scope.rootPath === workspacePath));

  const doctorResult = await runCli(["doctor"], env);
  assert.equal(doctorResult.code, 0, doctorResult.stderr);
  assert.match(doctorResult.stdout, /Doctor/);

  const hookStatusResult = await runCli(["hook", "status", "--json"], env);
  assert.equal(hookStatusResult.code, 0, hookStatusResult.stderr);
  const hookStatus = JSON.parse(hookStatusResult.stdout) as {
    initialized: boolean;
    interceptedAttempts?: number;
  };
  assert.equal(hookStatus.initialized, true);

  const consoleResult = await runCli(["console"], env, "quit\n");
  assert.equal(consoleResult.code, 0, consoleResult.stderr);
  assert.match(consoleResult.stdout, /Command Center/);

  const runResult = await runCli(["run", "--", "/bin/echo", "protected"], env);
  assert.equal(runResult.code, 0, runResult.stderr);
  assert.match(runResult.stdout, /exit code: 0/);

  const logsResult = await runCli(["logs", "--limit", "5", "--json"], env);
  assert.equal(logsResult.code, 0, logsResult.stderr);
  const logs = JSON.parse(logsResult.stdout) as Array<{ META: { event_type: string } }>;
  assert.ok(logs.some((record) => record.META.event_type === "ACTION_EXECUTED"));

  const ledgerResult = await runCli(["ledger", "--limit", "5"], env);
  assert.equal(ledgerResult.code, 0, ledgerResult.stderr);
  assert.match(ledgerResult.stdout, /Witness Ledger/);

  const uninstallResult = await runCli(["uninstall"], env);
  assert.equal(uninstallResult.code, 0, uninstallResult.stderr);
  const homeExists = await fs.access(homePath).then(() => true).catch(() => false);
  assert.equal(homeExists, false);

  console.log(`cli status scopes: ${status.scopes.length}`);
  console.log(`cli log tail: ${logs.length}`);
  console.log(`cli doctor: ok`);
  console.log(`cli hook status: ok`);
  console.log(`cli console: ok`);
  console.log(`cli ledger: ok`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
