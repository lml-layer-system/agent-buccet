import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const installScript = await (async () => {
  const candidates = [
    path.join(repoRoot, "scripts", "install-agent-buccet.sh"),
    path.join(repoRoot, "install.sh"),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error("unable to locate Agent Buccet install script");
})();

function run(command: string, args: string[], env: NodeJS.ProcessEnv, cwd: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-install-"));
  const homePath = path.join(tempRoot, "home");
  const launcherDir = path.join(tempRoot, "bin");
  const workspacePath = path.join(tempRoot, "workspace");
  await fs.mkdir(workspacePath, { recursive: true });

  const installEnv = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_LAUNCHER_DIR: launcherDir,
  };

  const installResult = await run("sh", [installScript], installEnv, repoRoot);
  assert.equal(installResult.code, 0, installResult.stderr);
  assert.match(installResult.stdout, /Agent Buccet installed\./);

  const launcherPath = path.join(launcherDir, "buccet");
  const launcherExists = await fs.access(launcherPath).then(() => true).catch(() => false);
  assert.equal(launcherExists, true);

  const cliEnv = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_LAUNCHER_PATH: launcherPath,
  };

  const initResult = await run(launcherPath, ["init"], cliEnv, workspacePath);
  assert.equal(initResult.code, 0, initResult.stderr);
  assert.match(initResult.stdout, /Agent Buccet/);

  const statusResult = await run(launcherPath, ["status", "--json"], cliEnv, workspacePath);
  assert.equal(statusResult.code, 0, statusResult.stderr);
  const status = JSON.parse(statusResult.stdout) as { initialized: boolean; scopes: string[] };
  assert.equal(status.initialized, true);
  const workspaceRealPath = await fs.realpath(workspacePath);
  const scopeRealPaths = await Promise.all(status.scopes.map((scope) => fs.realpath(scope).catch(() => scope)));
  assert.ok(scopeRealPaths.includes(workspaceRealPath));

  const uninstallResult = await run(launcherPath, ["uninstall"], cliEnv, workspacePath);
  assert.equal(uninstallResult.code, 0, uninstallResult.stderr);

  const homeExists = await fs.access(homePath).then(() => true).catch(() => false);
  assert.equal(homeExists, false);

  console.log(`installed launcher: ${launcherPath}`);
  console.log(`status scopes: ${status.scopes.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
