import { spawn } from "node:child_process";
import { once } from "node:events";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import readline from "node:readline";
import {
  daemonRequestId,
  sendBoundaryInterceptServerInput,
  type BoundaryInterceptDaemonInput,
  type BoundaryInterceptDaemonOutput,
} from "./../src/index.ts";

type ParsedArgs = {
  sessionId: string;
  actorId: string;
  sessionsDir?: string;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
};

function usage(): never {
  console.error(
    [
      "Usage:",
      "  node scripts/agent-buccet-intercept-daemon.ts [options]",
      "",
      "Options:",
      "  --session-id <id>",
      "  --actor-id <id>",
      "  --sessions-dir <path>",
      "  --heartbeat-ms <ms>",
      "  --heartbeat-timeout-ms <ms>",
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  let sessionId = `agent-buccet-intercept-daemon-${randomUUID()}`;
  let actorId = "system:agent-buccet-intercept-daemon";
  let sessionsDir: string | undefined;
  let heartbeatIntervalMs = 5_000;
  let heartbeatTimeoutMs = 15_000;

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
    if (token === "--heartbeat-ms") {
      heartbeatIntervalMs = Number(argv[index + 1] ?? usage());
      index += 1;
      continue;
    }
    if (token === "--heartbeat-timeout-ms") {
      heartbeatTimeoutMs = Number(argv[index + 1] ?? usage());
      index += 1;
      continue;
    }
    usage();
  }

  return {
    sessionId,
    actorId,
    sessionsDir,
    heartbeatIntervalMs,
    heartbeatTimeoutMs,
  };
}

function writeOutput(output: BoundaryInterceptDaemonOutput) {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

async function resolveInterceptServerPath(cwd: string): Promise<string> {
  const packagedPath = path.join(cwd, "bin", "agent-buccet-intercept-server.ts");
  const sourcePath = path.join(cwd, "scripts", "agent-buccet-intercept-server.ts");
  try {
    await fs.access(packagedPath);
    return packagedPath;
  } catch {
    return sourcePath;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  const socketPath = path.join("/tmp", `ab-id-${randomUUID().slice(0, 12)}.sock`);
  const serverPath = await resolveInterceptServerPath(cwd);
  const serverArgs = [
    serverPath,
    "--session-id",
    args.sessionId,
    "--actor-id",
    args.actorId,
    "--socket",
    socketPath,
    "--heartbeat-ms",
    String(args.heartbeatIntervalMs),
    "--heartbeat-timeout-ms",
    String(args.heartbeatTimeoutMs),
  ];
  if (args.sessionsDir) {
    serverArgs.push("--sessions-dir", args.sessionsDir);
  }

  const child = spawn(process.execPath, serverArgs, {
    cwd,
    stdio: ["ignore", "ignore", "pipe"],
  });

  let ready = false;
  let shutdownRequested = false;
  let startupStderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    startupStderr += chunk;
    process.stderr.write(chunk);
    if (chunk.includes("intercept server running")) {
      ready = true;
    }
  });

  for (let attempt = 0; attempt < 100 && !ready; attempt += 1) {
    if (child.exitCode !== null) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (!ready) {
    throw new Error(`intercept daemon failed to start backing intercept server\n${startupStderr}`);
  }

  console.error(`Agent Buccet intercept daemon running. session=${args.sessionId}`);

  const target = { socketPath } as const;
  const active = new Set<Promise<void>>();
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  const forwardInput = async (parsed: BoundaryInterceptDaemonInput, requestId: string) => {
    try {
      if ("command" in parsed && parsed.command === "shutdown") {
        shutdownRequested = true;
      }
      writeOutput(await sendBoundaryInterceptServerInput({
        target,
        input: parsed,
      }));
    } catch (error) {
      writeOutput({
        type: "error",
        requestId,
        error: error instanceof Error ? error.message : "daemon evaluation failed",
      });
    }
  };

  const ensureServerShutdown = async () => {
    if (child.exitCode !== null) {
      return;
    }
    try {
      await sendBoundaryInterceptServerInput({
        target,
        input: {
          command: "shutdown",
          requestId: daemonRequestId("daemon-auto-shutdown"),
        },
      });
    } catch {
      child.kill("SIGTERM");
    }
  };

  const handleSignal = () => {
    shutdownRequested = true;
    void ensureServerShutdown();
  };

  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let parsed: BoundaryInterceptDaemonInput;
    let requestId = "";
    try {
      parsed = JSON.parse(trimmed) as BoundaryInterceptDaemonInput;
      requestId = daemonRequestId(parsed.requestId);
    } catch (error) {
      writeOutput({
        type: "error",
        requestId: daemonRequestId(),
        error: error instanceof Error ? error.message : "invalid daemon input",
      });
      continue;
    }

    const task = forwardInput(parsed, requestId).finally(() => {
      active.delete(task);
    });
    active.add(task);

    if ("command" in parsed && parsed.command === "shutdown") {
      break;
    }
  }
  rl.close();
  process.stdin.pause();

  if (!shutdownRequested) {
    shutdownRequested = true;
    const shutdownTask = ensureServerShutdown().finally(() => {
      active.delete(shutdownTask);
    });
    active.add(shutdownTask);
  }

  await Promise.allSettled([...active]);
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await once(child, "exit").catch(() => undefined);
  }
  await fs.rm(socketPath, { force: true }).catch(() => undefined);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
