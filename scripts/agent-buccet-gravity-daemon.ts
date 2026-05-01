import { randomUUID } from "node:crypto";
import {
  createBoundaryGravitySupervisor,
  createPersistentBoundaryRuntimeStore,
  restoreBoundaryRuntimeStore,
} from "./../src/index.ts";

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
      "  node scripts/agent-buccet-gravity-daemon.ts [options]",
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
  let sessionId = `agent-buccet-gravity-daemon-${randomUUID()}`;
  let actorId = "system:agent-buccet-gravity-daemon";
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
    onHeartbeat: (heartbeat) => {
      console.log(`[gravity-heartbeat] session=${heartbeat.sessionId} decision=${heartbeat.lastDecision} at=${heartbeat.emittedAt}`);
    },
    onPanic: (error) => {
      console.error("[gravity-panic]", error);
    },
  });

  await supervisor.start();
  console.log(`Agent Buccet gravity daemon running. session=${args.sessionId}`);

  const shutdown = async () => {
    await supervisor.stop();
    process.exit(0);
  };

  const manualRestart = async () => {
    await supervisor.restart("manual daemon restart command");
    const status = supervisor.getStatus();
    console.log(
      `[gravity-restart] session=${args.sessionId} restarts=${status.restartCount} reason=${status.lastRestartReason ?? "unknown"}`,
    );
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGHUP", manualRestart);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
