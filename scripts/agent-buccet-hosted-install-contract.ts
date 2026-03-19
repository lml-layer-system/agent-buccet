import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();

async function resolveReleaseDir(): Promise<string> {
  const candidates = [
    path.join(repoRoot, "dist", "releases"),
    path.join(repoRoot, "releases"),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(candidate, "install.sh"));
      await fs.access(path.join(candidate, "latest.json"));
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error("unable to locate hosted release assets");
}

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
  const releaseDir = await resolveReleaseDir();
  const installScript = path.join(releaseDir, "install.sh");
  const manifestPath = path.join(releaseDir, "latest.json");
  await fs.access(installScript);
  await fs.access(manifestPath);

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-hosted-install-"));
  const homePath = path.join(tempRoot, "home");
  const launcherDir = path.join(tempRoot, "bin");
  const workspacePath = path.join(tempRoot, "workspace");
  await fs.mkdir(workspacePath, { recursive: true });

  const installEnv = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_LAUNCHER_DIR: launcherDir,
    AGENT_BUCCET_MANIFEST_URL: `file://${manifestPath}`,
  };

  const installResult = await run("sh", [installScript], installEnv, repoRoot);
  assert.equal(installResult.code, 0, installResult.stderr);
  assert.match(installResult.stdout, /Agent Buccet is now protecting your system\./);

  const launcherPath = path.join(launcherDir, "buccet");
  await fs.access(launcherPath);

  const cliEnv = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_LAUNCHER_PATH: launcherPath,
  };

  const statusResult = await run(launcherPath, ["status", "--json"], cliEnv, workspacePath);
  assert.equal(statusResult.code, 0, statusResult.stderr);
  const status = JSON.parse(statusResult.stdout) as { initialized: boolean; scopes: string[] };
  assert.equal(status.initialized, true);
  assert.equal(status.scopes.length, 0);

  const uninstallResult = await run(launcherPath, ["uninstall"], cliEnv, workspacePath);
  assert.equal(uninstallResult.code, 0, uninstallResult.stderr);

  const homeExists = await fs.access(homePath).then(() => true).catch(() => false);
  assert.equal(homeExists, false);

  console.log(`hosted install launcher: ${launcherPath}`);
  console.log(`status scopes: ${status.scopes.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
