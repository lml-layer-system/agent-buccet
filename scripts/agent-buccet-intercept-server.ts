import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import net from "node:net";
import readline from "node:readline";
import {
  allowIngressAsLaw,
  allowIngressOnce,
  createBoundaryGravitySupervisor,
  createPersistentBoundaryRuntimeStore,
  createBoundarySwarmCoordinator,
  daemonRequestId,
  denyIngressAsLaw,
  restoreBoundaryRuntimeStore,
  type BoundaryInterceptDaemonInput,
  type BoundaryInterceptDaemonOutput,
  appendBoundaryLedger,
} from "../lib/agent-buccet/index.ts";

type ParsedArgs = {
  sessionId: string;
  actorId: string;
  sessionsDir?: string;
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
      "  --sessions-dir <path>",
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
  let sessionsDir: string | undefined;
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
    sessionsDir,
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
    sessionsDir: args.sessionsDir,
  });
  const store = restored ?? await createPersistentBoundaryRuntimeStore({
    sessionId: args.sessionId,
    actorId: args.actorId,
    sessionsDir: args.sessionsDir,
  });

  const supervisor = createBoundaryGravitySupervisor({
    store,
    heartbeatIntervalMs: args.heartbeatIntervalMs,
    heartbeatTimeoutMs: args.heartbeatTimeoutMs,
    onPanic: (error) => {
      console.error("[intercept-server-panic]", error);
    },
  });
  const swarm = createBoundarySwarmCoordinator(store);

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
              const swarmStatus = swarm.listGroups();
              writeOutput(socket, {
                type: "status",
                requestId,
                ...status,
                swarm: swarmStatus.totals,
              });
              continue;
            }
            if (parsed.command === "swarm_status") {
              const swarmStatus = swarm.listGroups();
              writeOutput(socket, {
                type: "swarm_status",
                requestId,
                groups: swarmStatus.groups,
                totals: swarmStatus.totals,
              });
              continue;
            }
            if (parsed.command === "ingress_status") {
              const admissionState = store.getConfig().admissionState;
              const canyonProvenances = admissionState?.canyonProvenances ?? {};
              const hostileDeniedCounts = admissionState?.hostileDeniedCounts ?? {};
              const allowOnce = admissionState?.allowOnceProvenances ?? {};
              const allowed = admissionState?.allowedProvenances ?? {};
              const canyonEntries = Object.entries(canyonProvenances)
                .map(([provenance, entry]) => ({
                  provenance,
                  state: "canyon" as const,
                  reason: entry.reason,
                  promotionKind: entry.promotionKind,
                  operatorDisposition: entry.operatorDisposition,
                  seenAt: entry.canyonedAt,
                  ledgered: entry.ledgered,
                  deniedCount: hostileDeniedCounts[provenance] ?? 0,
                  allowOnceRemaining: allowOnce[provenance]?.remaining ?? 0,
                  standingAllowed: Boolean(allowed[provenance]),
                }))
                .sort((left, right) => right.seenAt - left.seenAt);
              const allowOnceEntries = Object.entries(allowOnce)
                .filter(([, entry]) => entry.remaining > 0)
                .map(([provenance, entry]) => ({
                  provenance,
                  state: "allow_once" as const,
                  reason: "Terminal 2 released this provenance from canyon once",
                  seenAt: entry.grantedAt,
                  deniedCount: hostileDeniedCounts[provenance] ?? 0,
                  allowOnceRemaining: entry.remaining,
                  standingAllowed: false,
                }));
              const allowLawEntries = Object.entries(allowed)
                .map(([provenance, entry]) => ({
                  provenance,
                  state: "allow_as_law" as const,
                  reason: entry.reason,
                  seenAt: entry.grantedAt,
                  deniedCount: hostileDeniedCounts[provenance] ?? 0,
                  allowOnceRemaining: 0,
                  standingAllowed: true,
                }));
              const provenances = [...canyonEntries, ...allowOnceEntries, ...allowLawEntries]
                .sort((left, right) => right.seenAt - left.seenAt);
              writeOutput(socket, {
                type: "ingress_status",
                requestId,
                provenances,
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
            if (parsed.command === "swarm_approve") {
              const approved = await swarm.approveGroup({
                groupId: parsed.groupId,
                issuedBy: parsed.issuedBy ?? store.getConfig().session.actorId,
                reason: parsed.reason,
                asLaw: parsed.asLaw,
              });
              if (!approved) {
                writeOutput(socket, {
                  type: "error",
                  requestId,
                  error: `unknown swarm group: ${parsed.groupId}`,
                });
                continue;
              }
              writeOutput(socket, {
                type: "ack",
                requestId,
                command: "swarm_approve",
                groupId: approved.groupId,
                reason: parsed.reason ?? "swarm approval granted",
              });
              continue;
            }
            if (parsed.command === "swarm_deny") {
              const denied = await swarm.denyGroup({
                groupId: parsed.groupId,
                deniedBy: parsed.deniedBy ?? store.getConfig().session.actorId,
                reason: parsed.reason,
                asLaw: parsed.asLaw,
              });
              if (!denied) {
                writeOutput(socket, {
                  type: "error",
                  requestId,
                  error: `unknown swarm group: ${parsed.groupId}`,
                });
                continue;
              }
              writeOutput(socket, {
                type: "ack",
                requestId,
                command: "swarm_deny",
                groupId: denied.groupId,
                reason: parsed.reason ?? "swarm approval denied",
              });
              continue;
            }
            if (
              parsed.command === "ingress_allow_once" ||
              parsed.command === "ingress_allow_as_law" ||
              parsed.command === "ingress_deny_once" ||
              parsed.command === "ingress_deny_as_law"
            ) {
              const current = store.getConfig();
              const state = current.admissionState;
              if (!state) {
                writeOutput(socket, {
                  type: "error",
                  requestId,
                  error: "admission boundary is not active",
                });
                continue;
              }

              let nextState = state;
              if (parsed.command === "ingress_allow_once") {
                nextState = allowIngressOnce(state, parsed.provenance);
                await appendBoundaryLedger("INGRESS_ALLOW_ONCE", {
                  sessionId: current.session.sessionId,
                  actorId: parsed.issuedBy ?? current.session.actorId,
                  decision: "allow",
                  target: parsed.provenance,
                  reason: parsed.reason ?? `Terminal 2 released ${parsed.provenance} from canyon once`,
                  metadata: { provenance: parsed.provenance },
                  createdAt: new Date().toISOString(),
                });
              } else if (parsed.command === "ingress_allow_as_law") {
                nextState = allowIngressAsLaw(state, parsed.provenance, parsed.reason);
                await appendBoundaryLedger("INGRESS_ALLOW_AS_LAW", {
                  sessionId: current.session.sessionId,
                  actorId: parsed.issuedBy ?? current.session.actorId,
                  decision: "allow",
                  target: parsed.provenance,
                  reason: parsed.reason ?? `Terminal 2 wrote standing ingress allow for ${parsed.provenance}`,
                  metadata: { provenance: parsed.provenance },
                  createdAt: new Date().toISOString(),
                });
              } else if (parsed.command === "ingress_deny_once") {
                await appendBoundaryLedger("INGRESS_DENY_ONCE", {
                  sessionId: current.session.sessionId,
                  actorId: parsed.deniedBy ?? current.session.actorId,
                  decision: "deny",
                  target: parsed.provenance,
                  reason: parsed.reason ?? `Terminal 2 kept ${parsed.provenance} in the canyon this time`,
                  metadata: { provenance: parsed.provenance },
                  createdAt: new Date().toISOString(),
                });
              } else {
                nextState = denyIngressAsLaw(state, parsed.provenance, parsed.reason);
                await appendBoundaryLedger("INGRESS_DENY_AS_LAW", {
                  sessionId: current.session.sessionId,
                  actorId: parsed.deniedBy ?? current.session.actorId,
                  decision: "deny",
                  target: parsed.provenance,
                  reason: parsed.reason ?? `Terminal 2 wrote standing canyon hold for ${parsed.provenance}`,
                  metadata: { provenance: parsed.provenance },
                  createdAt: new Date().toISOString(),
                });
              }

              store.replaceConfig({
                ...current,
                admissionState: nextState,
              });
              await store.persist();

              writeOutput(socket, {
                type: "ack",
                requestId,
                command: parsed.command,
                provenance: parsed.provenance,
                reason: parsed.reason,
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

          const result = await swarm.evaluateOrWait(parsed);

          if (result.tarpitActive) {
            // Canyon behavior for hostile ingress: hold the socket briefly and
            // then close it without a response so the caller does not get a
            // fast deny oracle.
            await new Promise((resolve) => setTimeout(resolve, 1500));
            socket.end();
            continue;
          }

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
