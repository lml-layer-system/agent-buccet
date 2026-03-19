import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

async function run(args: string[], env: NodeJS.ProcessEnv, cwd: string) {
  return await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(cwd, "scripts", "buccet.ts"), ...args], {
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
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function waitFor(predicate: () => Promise<boolean>, label: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function main() {
  const repoRoot = process.cwd();
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-hook-runtime-"));
  const env = {
    ...process.env,
    AGENT_BUCCET_HOME: home,
    AGENT_BUCCET_LAUNCHER_PATH: path.join(home, "bin", "buccet"),
    AGENT_BUCCET_CALLER_CWD: repoRoot,
  };

  const initResult = await run(["init", "--no-default-scope"], env, repoRoot);
  assert.equal(initResult.code, 0, initResult.stderr);

  const buildResult = await run(["hook", "build"], env, repoRoot);
  assert.equal(buildResult.code, 0, buildResult.stderr);

  const startResult = await run(["hook", "start"], env, repoRoot);
  assert.equal(startResult.code, 0, startResult.stderr);

  await waitFor(async () => {
    const statusResult = await run(["hook", "status", "--json"], env, repoRoot);
    if (statusResult.code !== 0) {
      return false;
    }
    const status = JSON.parse(statusResult.stdout) as { running?: boolean; state?: string };
    return status.running === true && status.state === "alive";
  }, "hook daemon alive");

  const envResult = await run(["hook", "env", "--json"], env, repoRoot);
  assert.equal(envResult.code, 0, envResult.stderr);
  const hookEnv = JSON.parse(envResult.stdout) as Record<string, string>;
  assert.ok(hookEnv.BUCCET_SOCKET_PATH);
  assert.ok(hookEnv.BUCCET_BRAIN_STATUS_PATH);

  const stopResult = await run(["hook", "stop"], env, repoRoot);
  assert.equal(stopResult.code, 0, stopResult.stderr);

  await waitFor(async () => {
    const statusResult = await run(["hook", "status", "--json"], env, repoRoot);
    if (statusResult.code !== 0) {
      return false;
    }
    const status = JSON.parse(statusResult.stdout) as { running?: boolean };
    return status.running === false;
  }, "hook daemon stop");

  console.log("hook runtime contract");
  console.log(`home: ${home}`);
  console.log(`socket: ${hookEnv.BUCCET_SOCKET_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
