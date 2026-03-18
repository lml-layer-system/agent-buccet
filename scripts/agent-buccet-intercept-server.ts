import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import net from "node:net";
import readline from "node:readline";
import {
  createBoundaryGravitySupervisor,
  createPersistentBoundaryRuntimeStore,
  daemonRequestId,
  evaluateBoundaryIntercept,
  restoreBoundaryRuntimeStore,
  type BoundaryInterceptDaemonInput,
  type BoundaryInterceptDaemonOutput,
} from "../lib/lml/agent-boundary/index.ts";

type ParsedArgs = {
  sessionId: string;
  actorId: string;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
  host: string;
  port?: number;
  socketPath?: string;
};

function usage(): never {
  console.error(
    [
      "Usage:",
      "  node scripts/agent-buccet-intercept-server.ts [options]",
      "",
      "Options:",
      "  --session-id <id>",
      "  --actor-id <id>",
      "  --heartbeat-ms <ms>",
      "  --heartbeat-timeout-ms <ms>",
      "  --host <host>",
      "  --port <port>",
      "  --socket <path>",
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  let sessionId = `agent-buccet-intercept-server-${randomUUID()}`;
  let actorId = "system:agent-buccet-intercept-server";
  let heartbeatIntervalMs = 5_000;
  let heartbeatTimeoutMs = 15_000;
  let host = "127.0.0.1";
  let port: number | undefined = 7788;
  let socketPath: string | undefined;

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
    if (token === "--host") {
      host = argv[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--port") {
      port = Number(argv[index + 1] ?? usage());
      index += 1;
      continue;
    }
    if (token === "--socket") {
      socketPath = argv[index + 1] ?? usage();
      port = undefined;
      index += 1;
      continue;
    }
    usage();
  }

  return {
    sessionId,
    actorId,
    heartbeatIntervalMs,
    heartbeatTimeoutMs,
    host,
    port,
    socketPath,
  };
}

function writeOutput(socket: net.Socket, output: BoundaryInterceptDaemonOutput) {
  socket.write(`${JSON.stringify(output)}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const restored = await restoreBoundaryRuntimeStore({
    sessionId: args.sessionId,
  });
  const store = restored ?? await createPersistentBoundaryRuntimeStore({
    sessionId: args.sessionId,
    actorId: args.actorId,
  });

  const supervisor = createBoundaryGravitySupervisor({
    store,
    heartbeatIntervalMs: args.heartbeatIntervalMs,
    heartbeatTimeoutMs: args.heartbeatTimeoutMs,
    onPanic: (error) => {
      console.error("[intercept-server-panic]", error);
    },
  });

  await supervisor.start();

  if (args.socketPath) {
    await fs.rm(args.socketPath, { force: true }).catch(() => undefined);
  }

  const server = net.createServer((socket) => {
    const rl = readline.createInterface({
      input: socket,
      crlfDelay: Infinity,
    });

    void (async () => {
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
          writeOutput(socket, {
            type: "error",
            requestId: daemonRequestId(),
            error: error instanceof Error ? error.message : "invalid daemon input",
          });
          continue;
        }

        try {
          if ("command" in parsed) {
            if (parsed.command === "status") {
              const status = supervisor.getStatus();
              writeOutput(socket, {
                type: "status",
                requestId,
                ...status,
              });
              continue;
            }
            if (parsed.command === "restart") {
              await supervisor.restart(parsed.reason ?? "server command restart");
              const status = supervisor.getStatus();
              writeOutput(socket, {
                type: "ack",
                requestId,
                command: "restart",
                restartCount: status.restartCount,
                reason: status.lastRestartReason,
              });
              continue;
            }
            await supervisor.stop();
            writeOutput(socket, {
              type: "ack",
              requestId,
              command: "shutdown",
            });
            server.close();
            return;
          }

          const result = await evaluateBoundaryIntercept({
            config: {
              ...store.getConfig(),
            },
            request: parsed,
          });

          writeOutput(socket, {
            type: "decision",
            ...result,
            requestId,
            internalRequestId: result.requestId,
          });
        } catch (error) {
          writeOutput(socket, {
            type: "error",
            requestId,
            error: error instanceof Error ? error.message : "server evaluation failed",
          });
        }
      }
    })().catch((error) => {
      console.error("[intercept-server-connection-error]", error);
      socket.destroy(error instanceof Error ? error : undefined);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    if (args.socketPath) {
      server.listen(args.socketPath, () => resolve());
      return;
    }
    server.listen(args.port, args.host, () => resolve());
  });

  const address = server.address();
  if (typeof address === "string") {
    console.error(`Agent Buccet intercept server running. socket=${address} session=${args.sessionId}`);
  } else if (address) {
    console.error(
      `Agent Buccet intercept server running. host=${address.address} port=${address.port} session=${args.sessionId}`,
    );
  }

  const shutdown = async () => {
    await supervisor.stop();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    if (args.socketPath) {
      await fs.rm(args.socketPath, { force: true }).catch(() => undefined);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
  process.on("SIGHUP", () => {
    void supervisor.restart("signal restart");
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
