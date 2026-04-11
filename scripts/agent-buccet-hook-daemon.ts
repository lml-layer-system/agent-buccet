#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

type ParsedArgs = {
  sessionId: string;
  actorId: string;
  sessionsDir: string;
  interceptSocketPath: string;
  gravityBridgeSocketPath: string;
  brainStatusPath: string;
  pidFilePath: string;
  maxRestarts: number;
};

type ChildName = "intercept" | "gravity_bridge";

function usage(): never {
  console.error(
    [
      "Usage:",
      "  node scripts/agent-buccet-hook-daemon.ts",
      "    --session-id <id>",
      "    --actor-id <id>",
      "    --sessions-dir <path>",
      "    --intercept-socket <path>",
      "    --gravity-bridge-socket <path>",
      "    --brain-status-file <path>",
      "    --pid-file <path>",
      "    [--max-restarts <n>]",
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  let sessionId = "";
  let actorId = "";
  let sessionsDir = "";
  let interceptSocketPath = "";
  let gravityBridgeSocketPath = "";
  let brainStatusPath = "";
  let pidFilePath = "";
  let maxRestarts = 10;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--session-id") {
      sessionId = argv[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--actor-id") {
      actorId = argv[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--sessions-dir") {
      sessionsDir = argv[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--intercept-socket") {
      interceptSocketPath = argv[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--gravity-bridge-socket") {
      gravityBridgeSocketPath = argv[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--brain-status-file") {
      brainStatusPath = argv[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--pid-file") {
      pidFilePath = argv[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--max-restarts") {
      maxRestarts = Number(argv[index + 1] ?? usage());
      index += 1;
      continue;
    }
    usage();
  }

  if (!sessionId || !actorId || !sessionsDir || !interceptSocketPath || !gravityBridgeSocketPath || !brainStatusPath || !pidFilePath) {
    usage();
  }

  return {
    sessionId,
    actorId,
    sessionsDir,
    interceptSocketPath,
    gravityBridgeSocketPath,
    brainStatusPath,
    pidFilePath,
    maxRestarts,
  };
}

async function ensureParent(targetPath: string) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
}

async function writeStatus(args: ParsedArgs, patch: Record<string, unknown>) {
  await ensureParent(args.brainStatusPath);
  const payload = {
    state: "alive",
    sessionId: args.sessionId,
    actorId: args.actorId,
    interceptSocketPath: args.interceptSocketPath,
    gravityBridgeSocketPath: args.gravityBridgeSocketPath,
    brainStatusPath: args.brainStatusPath,
    updatedAt: new Date().toISOString(),
    pid: process.pid,
    ...patch,
  };
  await fs.writeFile(args.brainStatusPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function waitForReady(child: ChildProcess, readyText: string, childName: ChildName): Promise<void> {
  return new Promise((resolve, reject) => {
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
      if (chunk.includes(readyText)) {
        resolve();
      }
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      reject(new Error(`${childName} exited before ready with code ${code ?? "unknown"}\n${stderr}`));
    });
  });
}

function waitForChildExit(child: ChildProcess | null | undefined, timeoutMs = 5_000): Promise<void> {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve();
    }, timeoutMs);

    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.once("error", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scriptDir = path.dirname(new URL(import.meta.url).pathname);
  let stopping = false;
  let interceptChild: ChildProcess | null = null;
  let gravityBridgeChild: ChildProcess | null = null;
  let restartCount = 0;

  await ensureParent(args.pidFilePath);
  await fs.writeFile(args.pidFilePath, `${process.pid}\n`, "utf8");
  await writeStatus(args, {
    state: "starting",
    restartCount,
  });

  function attachChildExitHandler(name: ChildName, child: ChildProcess) {
    child.on("exit", () => {
      if (name === "intercept") {
        if (interceptChild === child) {
          interceptChild = null;
        }
      } else if (gravityBridgeChild === child) {
        gravityBridgeChild = null;
      }
      if (!stopping) {
        void restartChild(name);
      }
    });
  }

  function stopChild(child: ChildProcess | null | undefined) {
    child?.kill("SIGTERM");
  }

  async function spawnIntercept() {
    await fs.rm(args.interceptSocketPath, { force: true }).catch(() => undefined);
    const child = spawn(process.execPath, [
      path.join(scriptDir, "agent-buccet-intercept-server.ts"),
      "--session-id",
      args.sessionId,
      "--actor-id",
      args.actorId,
      "--sessions-dir",
      args.sessionsDir,
      "--socket",
      args.interceptSocketPath,
    ], {
      cwd: process.cwd(),
      stdio: ["ignore", "ignore", "pipe"],
      env: process.env,
    });
    await waitForReady(child, "intercept server running", "intercept");
    interceptChild = child;
    return child;
  }

  async function spawnGravityBridge() {
    await fs.rm(args.gravityBridgeSocketPath, { force: true }).catch(() => undefined);
    const child = spawn(process.execPath, [
      path.join(scriptDir, "agent-buccet-gravity-bridge.ts"),
      "--listen-socket",
      args.gravityBridgeSocketPath,
      "--upstream-socket",
      args.interceptSocketPath,
    ], {
      cwd: process.cwd(),
      stdio: ["ignore", "ignore", "pipe"],
      env: process.env,
    });
    await waitForReady(child, "gravity bridge running", "gravity_bridge");
    gravityBridgeChild = child;
    return child;
  }

  async function markDead(reason: string) {
    await writeStatus(args, {
      state: "dead",
      restartCount,
      lastError: reason,
    });
  }

  async function restartChild(name: ChildName) {
    restartCount += 1;
    if (restartCount > args.maxRestarts) {
      stopping = true;
      await markDead(`${name} exceeded max restarts`);
      process.exitCode = 1;
      return;
    }
    await writeStatus(args, {
      state: "starting",
      restartCount,
      lastError: `${name} restarted`,
    });
    try {
      if (name === "intercept") {
        attachChildExitHandler(name, await spawnIntercept());
      } else {
        attachChildExitHandler(name, await spawnGravityBridge());
      }
      await writeStatus(args, {
        state: "alive",
        restartCount,
      });
    } catch (error) {
      stopping = true;
      await markDead(error instanceof Error ? error.message : `${name} restart failed`);
      process.exitCode = 1;
    }
  }

  try {
    const [interceptReadyChild, gravityReadyChild] = await Promise.all([
      spawnIntercept(),
      spawnGravityBridge(),
    ]);
    attachChildExitHandler("intercept", interceptReadyChild);
    attachChildExitHandler("gravity_bridge", gravityReadyChild);
    await writeStatus(args, {
      state: "alive",
      restartCount,
    });
  } catch (error) {
    stopping = true;
    stopChild(interceptChild);
    stopChild(gravityBridgeChild);
    await markDead(error instanceof Error ? error.message : "hook daemon failed to start");
    process.exit(1);
  }

  const shutdown = async (reason: string) => {
    if (stopping) {
      return;
    }
    stopping = true;
    const interceptToStop = interceptChild;
    const gravityBridgeToStop = gravityBridgeChild;
    interceptToStop?.kill("SIGTERM");
    gravityBridgeToStop?.kill("SIGTERM");
    await Promise.all([
      waitForChildExit(interceptToStop),
      waitForChildExit(gravityBridgeToStop),
    ]);
    await fs.rm(args.interceptSocketPath, { force: true }).catch(() => undefined);
    await fs.rm(args.gravityBridgeSocketPath, { force: true }).catch(() => undefined);
    await markDead(reason);
    await fs.rm(args.pidFilePath, { force: true }).catch(() => undefined);
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("hook daemon stopped");
  });
  process.on("SIGTERM", () => {
    void shutdown("hook daemon stopped");
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
