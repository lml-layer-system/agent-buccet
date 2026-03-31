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

function spawnBuccet(args: string[], env: NodeJS.ProcessEnv, cwd: string) {
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
  const result = new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
  return { child, result };
}

async function runCommand(command: string, args: string[], cwd: string) {
  return await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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

async function waitFor<T>(predicate: () => Promise<T | false>, label: string): Promise<T> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const result = await predicate();
    if (result !== false) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function main() {
  const repoRoot = process.cwd();
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-hook-runtime-"));
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-hook-workspace-"));
  const env = {
    ...process.env,
    AGENT_BUCCET_HOME: home,
    AGENT_BUCCET_LAUNCHER_PATH: path.join(home, "bin", "buccet"),
    AGENT_BUCCET_CALLER_CWD: repoRoot,
  };
  const victimPath = path.join(workspace, "SENSITIVE.txt");
  const attackerSourcePath = path.join(workspace, "spawn_attacker.c");
  const attackerBinaryPath = path.join(workspace, "spawn_attacker");

  await fs.writeFile(victimPath, "do not delete\n", "utf8");
  await fs.writeFile(
    attackerSourcePath,
    [
      "#include <spawn.h>",
      "#include <stdio.h>",
      "#include <stdlib.h>",
      "#include <sys/wait.h>",
      "#include <errno.h>",
      "",
      "extern char **environ;",
      "",
      "int main(int argc, char **argv) {",
      "  if (argc < 2) {",
      "    fprintf(stderr, \"usage: %s <target>\\n\", argv[0]);",
      "    return 2;",
      "  }",
      "  pid_t pid = 0;",
      "  char *const child_argv[] = {\"/bin/rm\", \"-f\", argv[1], NULL};",
      "  int rc = posix_spawn(&pid, \"/bin/rm\", NULL, NULL, child_argv, environ);",
      "  if (rc != 0) {",
      "    errno = rc;",
      "    perror(\"posix_spawn\");",
      "    return 3;",
      "  }",
      "  int status = 0;",
      "  if (waitpid(pid, &status, 0) < 0) {",
      "    perror(\"waitpid\");",
      "    return 4;",
      "  }",
      "  if (WIFEXITED(status)) {",
      "    return WEXITSTATUS(status);",
      "  }",
      "  return 5;",
      "}",
      "",
    ].join("\n"),
    "utf8",
  );

  const compileResult = await runCommand(process.env.CC ?? "cc", [attackerSourcePath, "-o", attackerBinaryPath], workspace);
  assert.equal(compileResult.code, 0, compileResult.stderr);

  const initResult = await run(["init", "--no-default-scope", "--scope", workspace], env, repoRoot);
  assert.equal(initResult.code, 0, initResult.stderr);

  const buildResult = await run(["hook", "build"], env, repoRoot);
  assert.equal(buildResult.code, 0, buildResult.stderr);

  const startResult = await run(["hook", "start"], env, repoRoot);
  assert.equal(startResult.code, 0, startResult.stderr);

  const hookStatus = await waitFor(async () => {
    const statusResult = await run(["hook", "status", "--json"], env, repoRoot);
    if (statusResult.code !== 0) {
      return false;
    }
    const status = JSON.parse(statusResult.stdout) as {
      running?: boolean;
      state?: string;
      interceptSocketPath?: string;
      gravityBridgeSocketPath?: string;
    };
    return status.running === true && status.state === "alive" ? status : false;
  }, "hook daemon alive");

  const envResult = await run(["hook", "env", "--json"], env, repoRoot);
  assert.equal(envResult.code, 0, envResult.stderr);
  const hookEnv = JSON.parse(envResult.stdout) as Record<string, string>;
  assert.ok(hookEnv.BUCCET_SOCKET_PATH);
  assert.ok(hookEnv.BUCCET_BRAIN_STATUS_PATH);
  assert.equal(hookEnv.BUCCET_SOCKET_PATH, hookStatus.gravityBridgeSocketPath);
  assert.notEqual(hookEnv.BUCCET_SOCKET_PATH, hookStatus.interceptSocketPath);

  const attackRun = spawnBuccet(["hook", "run", "--", attackerBinaryPath, victimPath], env, repoRoot);

  const pendingGroupId = await waitFor(async () => {
    const swarmResult = await run(["swarm", "list", "--json"], env, repoRoot);
    if (swarmResult.code !== 0) {
      return false;
    }
    const payload = JSON.parse(swarmResult.stdout) as {
      groups?: Array<{ groupId: string; state: string; target: string; actionClass?: string; operation?: string }>;
    };
    const pending = payload.groups?.find((group) =>
      group.state === "waiting"
      && (
        group.target === victimPath
        || group.target === "/bin/rm"
        || (group.actionClass === "shell" && group.operation === "exec")
      )
    );
    if (!pending) {
      return false;
    }
    return pending.groupId;
  }, "pending intercepted delete approval");

  const denyResult = await run(["swarm", "deny", pendingGroupId as string, "--reason", "hook-runtime-contract deny"], env, repoRoot);
  assert.equal(denyResult.code, 0, denyResult.stderr);

  const attackResult = await attackRun.result;
  assert.notEqual(attackResult.code, 0, "expected denied spawn attacker to exit non-zero");
  await fs.access(victimPath);

  const stopResult = await run(["hook", "stop"], env, repoRoot);
  assert.equal(stopResult.code, 0, stopResult.stderr);

  await waitFor(async () => {
    const statusResult = await run(["hook", "status", "--json"], env, repoRoot);
    if (statusResult.code !== 0) {
      return false;
    }
    const status = JSON.parse(statusResult.stdout) as { running?: boolean };
    return status.running === false ? true : false;
  }, "hook daemon stop");

  console.log("hook runtime contract");
  console.log(`home: ${home}`);
  console.log(`socket: ${hookEnv.BUCCET_SOCKET_PATH}`);
  console.log(`victim preserved: ${victimPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
