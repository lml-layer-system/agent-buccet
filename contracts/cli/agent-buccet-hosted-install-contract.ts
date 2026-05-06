import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

const repoRoot = process.cwd();

async function resolveReleaseDir(): Promise<string> {
  const candidates = [path.join(repoRoot, "dist", "releases"), path.join(repoRoot, "releases")];
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(candidate, "install.sh"));
      await fs.access(path.join(candidate, "latest.json"));
      return candidate;
    } catch {}
  }
  throw new Error("unable to locate hosted release assets");
}

function run(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
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
  const customPathName = "domain-workbench";
  const customDomain = "specialized_domain_ops";
  await fs.access(installScript);
  await fs.access(manifestPath);

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-hosted-install-"));
  const homePath = path.join(tempRoot, "home");
  const launcherDir = path.join(tempRoot, "bin");
  const workspacePath = path.join(tempRoot, "workspace");
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.writeFile(
    path.join(workspacePath, "domain-playbook.md"),
    "# Domain Playbook\n\nDomain rules, source material, operating steps, and output expectations.\n",
    "utf8",
  );

  const installEnv = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_LAUNCHER_DIR: launcherDir,
    AGENT_BUCCET_MANIFEST_URL: `file://${manifestPath}`,
  };

  const installStartedAt = performance.now();
  const installResult = await run("sh", [installScript], installEnv, repoRoot);
  const installMs = performance.now() - installStartedAt;
  assert.equal(installResult.code, 0, installResult.stderr);
  assert.match(installResult.stdout, /Agent Buccet v[0-9]+\.[0-9]+\.[0-9]+/);
  assert.match(installResult.stdout, /installed\s+✓/);
  assert.match(installResult.stdout, /verified\s+✓/);
  assert.match(installResult.stdout, /ready\s+buccet console/);

  const launcherPath = path.join(launcherDir, "buccet");
  await fs.access(launcherPath);
  const snapSummaryPath = path.join(homePath, "current", "INSTALL_SNAP.txt");
  const snapSummaryExists = await fs
    .access(snapSummaryPath)
    .then(() => true)
    .catch(() => false);
  assert.equal(snapSummaryExists, true);

  const cliEnv = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_LAUNCHER_PATH: launcherPath,
  };

  const statusResult = await run(launcherPath, ["status", "--json"], cliEnv, workspacePath);
  assert.equal(statusResult.code, 0, statusResult.stderr);
  const status = JSON.parse(statusResult.stdout) as { initialized: boolean; scopes?: string[] };
  assert.equal(status.initialized, false);
  assert.equal((status.scopes ?? []).length, 0);

  const initStartedAt = performance.now();
  const initResult = await run(launcherPath, ["init", "--no-default-scope"], cliEnv, workspacePath);
  const initMs = performance.now() - initStartedAt;
  assert.equal(initResult.code, 0, initResult.stderr);

  const pathAddResult = await run(
    launcherPath,
    [
      "path",
      "sources",
      "add",
      customPathName,
      "domain-playbook.md",
      "--domain",
      customDomain,
      "--json",
    ],
    cliEnv,
    workspacePath,
  );
  assert.equal(pathAddResult.code, 0, pathAddResult.stderr);
  const added = JSON.parse(pathAddResult.stdout) as {
    pathName: string;
    domain: string;
    totalSources: number;
  };
  assert.equal(added.pathName, customPathName);
  assert.equal(added.domain, customDomain);
  assert.equal(added.totalSources, 1);

  const pathRunResult = await run(
    launcherPath,
    ["path", "run", customPathName, "--request", "do the work for this domain", "--all", "--json"],
    cliEnv,
    workspacePath,
  );
  assert.equal(pathRunResult.code, 0, pathRunResult.stderr);
  const pathRun = JSON.parse(pathRunResult.stdout) as {
    formation: {
      pathName: string;
      status: string;
    };
  };
  assert.equal(pathRun.formation.pathName, customPathName);
  assert.equal(pathRun.formation.status, "COMPLETED");

  const uninstallResult = await run(launcherPath, ["uninstall"], cliEnv, workspacePath);
  assert.equal(uninstallResult.code, 0, uninstallResult.stderr);

  const homeExists = await fs
    .access(homePath)
    .then(() => true)
    .catch(() => false);
  assert.equal(homeExists, false);

  console.log(`hosted install launcher: ${launcherPath}`);
  console.log(`hosted install ms: ${installMs.toFixed(2)}`);
  console.log(`hosted cold init ms: ${initMs.toFixed(2)}`);
  console.log(`status scopes: ${(status.scopes ?? []).length}`);
  console.log(`path runtime: ${customPathName}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
