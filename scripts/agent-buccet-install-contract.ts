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
  const customPathName = "domain-workbench";
  const customDomain = "specialized_domain_ops";
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

  const pathAddResult = await run(launcherPath, [
    "path",
    "sources",
    "add",
    customPathName,
    "domain-playbook.md",
    "--domain",
    customDomain,
    "--json",
  ], cliEnv, workspacePath);
  assert.equal(pathAddResult.code, 0, pathAddResult.stderr);
  const added = JSON.parse(pathAddResult.stdout) as {
    pathName: string;
    domain: string;
    totalSources: number;
  };
  assert.equal(added.pathName, customPathName);
  assert.equal(added.domain, customDomain);
  assert.equal(added.totalSources, 1);

  const pathRunResult = await run(launcherPath, [
    "path",
    "run",
    customPathName,
    "--request",
    "do the work for this domain",
    "--all",
    "--json",
  ], cliEnv, workspacePath);
  assert.equal(pathRunResult.code, 0, pathRunResult.stderr);
  const pathRun = JSON.parse(pathRunResult.stdout) as {
    formation: {
      pathName: string;
      status: string;
    };
    terminalResult: string | null;
  };
  assert.equal(pathRun.formation.pathName, customPathName);
  assert.equal(pathRun.formation.status, "COMPLETED");
  assert.match(pathRun.terminalResult ?? "", /Domain Workbench Path|domain-workbench/i);

  const pathWatchResult = await run(launcherPath, ["path", "watch", customPathName, "--json"], cliEnv, workspacePath);
  assert.equal(pathWatchResult.code, 0, pathWatchResult.stderr);
  const pathWatch = JSON.parse(pathWatchResult.stdout) as {
    liveView: {
      pathName: string;
      pathSourceCount: number;
    };
  };
  assert.equal(pathWatch.liveView.pathName, customPathName);
  assert.equal(pathWatch.liveView.pathSourceCount, 1);

  const uninstallResult = await run(launcherPath, ["uninstall"], cliEnv, workspacePath);
  assert.equal(uninstallResult.code, 0, uninstallResult.stderr);

  const homeExists = await fs.access(homePath).then(() => true).catch(() => false);
  assert.equal(homeExists, false);

  console.log(`installed launcher: ${launcherPath}`);
  console.log(`status scopes: ${status.scopes.length}`);
  console.log(`path runtime: ${customPathName}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
