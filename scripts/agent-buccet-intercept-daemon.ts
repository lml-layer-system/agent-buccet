import { randomUUID } from "node:crypto";
import readline from "node:readline";
import {
  attachBodyguardControl,
  createBoundaryGravitySupervisor,
  createPersistentBoundaryRuntimeStore,
  daemonRequestId,
  evaluateBoundaryIntercept,
  restoreBoundaryRuntimeStore,
  type BoundaryInterceptDaemonInput,
  type BoundaryInterceptDaemonOutput,
} from "../lib/agent-buccet/index.ts";

type ParsedArgs = {
  sessionId: string;
  actorId: string;
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
      "  --heartbeat-ms <ms>",
      "  --heartbeat-timeout-ms <ms>",
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  let sessionId = `agent-buccet-intercept-daemon-${randomUUID()}`;
  let actorId = "system:agent-buccet-intercept-daemon";
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
    heartbeatIntervalMs,
    heartbeatTimeoutMs,
  };
}

function writeOutput(output: BoundaryInterceptDaemonOutput) {
  process.stdout.write(`${JSON.stringify(output)}\n`);
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
      console.error("[intercept-daemon-panic]", error);
    },
  });

  await supervisor.start();
  console.error(`Agent Buccet intercept daemon running. session=${args.sessionId}`);

  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

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

    try {
      if ("command" in parsed) {
        if (parsed.command === "status") {
          const status = supervisor.getStatus();
          writeOutput({
            type: "status",
            requestId,
            ...status,
          });
          continue;
        }
        if (parsed.command === "restart") {
          await supervisor.restart(parsed.reason ?? "daemon command restart");
          const status = supervisor.getStatus();
          writeOutput({
            type: "ack",
            requestId,
            command: "restart",
            restartCount: status.restartCount,
            reason: status.lastRestartReason,
          });
          continue;
        }
        await supervisor.stop();
        writeOutput({
          type: "ack",
          requestId,
          command: "shutdown",
        });
        process.exit(0);
      }

      const result = await evaluateBoundaryIntercept({
        config: attachBodyguardControl(store.getConfig()),
        request: parsed,
      });

      writeOutput({
        type: "decision",
        ...result,
        requestId,
        internalRequestId: result.requestId,
      });
    } catch (error) {
      writeOutput({
        type: "error",
        requestId,
        error: error instanceof Error ? error.message : "daemon evaluation failed",
      });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
