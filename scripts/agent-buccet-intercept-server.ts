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
  denyIngressOnce,
  denyIngressAsLaw,
  restoreBoundaryRuntimeStore,
  type BoundaryInterceptDaemonInput,
  type BoundaryInterceptDaemonOutput,
  type BoundaryInterceptRequest,
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

type GravitySocketPayload = {
  action: string;
  target: string;
  pid?: string;
  extra?: string;
};

type GravityPayloadHints = {
  payloadSummary?: string;
  provenance?: BoundaryInterceptRequest["provenance"];
  flags?: BoundaryInterceptRequest["flags"];
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

function writeJsonOutput(socket: net.Socket, output: BoundaryInterceptDaemonOutput) {
  socket.write(`${JSON.stringify(output)}\n`);
}

function writeGravityDecision(socket: net.Socket, output: BoundaryInterceptDaemonOutput | Error) {
  if (output instanceof Error) {
    socket.write("0");
    return;
  }
  socket.write(output.type === "decision" && output.decision === "allow" ? "1" : "0");
}

function parseGravityPayload(line: string): GravitySocketPayload {
  const parts = line.trim().split("|");
  if (parts.length < 3) {
    throw new Error("malformed gravity payload");
  }
  return {
    action: parts[0] ?? "",
    target: parts[1] ?? "",
    pid: parts[2] ?? "",
    extra: parts.slice(3).join("|"),
  };
}

function parseGravityPayloadHints(payload: GravitySocketPayload): GravityPayloadHints {
  const flags: NonNullable<BoundaryInterceptRequest["flags"]> = {};
  const extraTokens = (payload.extra ?? "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const payloadSummaryTokens: string[] = [];
  let provenance: BoundaryInterceptRequest["provenance"] | undefined;

  for (const token of extraTokens) {
    if (token.startsWith("prov=")) {
      provenance = token.slice("prov=".length) as BoundaryInterceptRequest["provenance"];
      continue;
    }
    if (token.startsWith("flags=")) {
      for (const flagName of token.slice("flags=".length).split(",")) {
        if (flagName === "authorityClaimed") flags.authorityClaimed = true;
        if (flagName === "claimsCompleteCoverage") flags.claimsCompleteCoverage = true;
        if (flagName === "requestsScopeExpansion") flags.requestsScopeExpansion = true;
        if (flagName === "requestsLawMutation") flags.requestsLawMutation = true;
        if (flagName === "requestsSessionRevival") flags.requestsSessionRevival = true;
        if (flagName === "requestsLedgerBypass") flags.requestsLedgerBypass = true;
      }
      continue;
    }
    payloadSummaryTokens.push(token);
  }

  return {
    payloadSummary: [
      payload.pid ? `pid=${payload.pid}` : "",
      payloadSummaryTokens.join(" "),
    ].filter(Boolean).join(" "),
    provenance,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
  };
}

function mapGravityPayloadToInterceptRequest(payload: GravitySocketPayload): BoundaryInterceptRequest {
  const hints = parseGravityPayloadHints(payload);

  switch (payload.action) {
    case "read":
      return {
        actionClass: "file",
        operation: "read",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "write":
    case "create":
    case "chmod":
    case "chown":
      return {
        actionClass: "file",
        operation: "write",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "delete":
    case "rmdir":
      return {
        actionClass: "file",
        operation: "delete",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "mkdir":
      return {
        actionClass: "file",
        operation: "mkdir",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "rename":
    case "link":
    case "symlink":
      return {
        actionClass: "file",
        operation: "move",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "exec":
      return {
        actionClass: "shell",
        operation: "exec",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "database.query":
      return {
        actionClass: "database",
        operation: "query",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "database.insert":
      return {
        actionClass: "database",
        operation: "insert",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "database.update":
      return {
        actionClass: "database",
        operation: "update",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "database.delete":
      return {
        actionClass: "database",
        operation: "delete",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "system.env.read":
      return {
        actionClass: "system",
        operation: "env.read",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "system.env.write":
      return {
        actionClass: "system",
        operation: "env.write",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "system.config.read":
      return {
        actionClass: "system",
        operation: "config.read",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "system.config.write":
      return {
        actionClass: "system",
        operation: "config.write",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "system.credential.read":
      return {
        actionClass: "system",
        operation: "credential.read",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "system.credential.use":
      return {
        actionClass: "system",
        operation: "credential.use",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    case "connect":
      return {
        actionClass: "network",
        operation: "send",
        target: payload.target,
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      };
    default:
      throw new Error(`unsupported gravity action: ${payload.action}`);
  }
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

        let parsed: BoundaryInterceptDaemonInput | BoundaryInterceptRequest;
        let requestId = "";
        let rawGravityClient = false;
        try {
          const daemonInput = JSON.parse(trimmed) as BoundaryInterceptDaemonInput;
          parsed = daemonInput;
          requestId = daemonRequestId(daemonInput.requestId);
        } catch {
          rawGravityClient = true;
          parsed = mapGravityPayloadToInterceptRequest(parseGravityPayload(trimmed));
          requestId = daemonRequestId();
        }

        try {
          if ("command" in parsed) {
            if (parsed.command === "status") {
              const status = supervisor.getStatus();
              const swarmStatus = swarm.listGroups();
              writeJsonOutput(socket, {
                type: "status",
                requestId,
                ...status,
                swarm: swarmStatus.totals,
              });
              continue;
            }
            if (parsed.command === "swarm_status") {
              const swarmStatus = swarm.listGroups();
              writeJsonOutput(socket, {
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
              const denyOnce = admissionState?.denyOnceProvenances ?? {};
              const allowed = admissionState?.allowedProvenances ?? {};
              const seen = new Set<string>();
              const denyOnceEntries = Object.entries(denyOnce)
                .filter(([, entry]) => entry.remaining > 0)
                .map(([provenance, entry]) => ({
                  provenance,
                  state: "deny_once" as const,
                  reason: entry.reason,
                  seenAt: entry.grantedAt,
                  deniedCount: hostileDeniedCounts[provenance] ?? 0,
                  allowOnceRemaining: 0,
                  standingAllowed: Boolean(allowed[provenance]),
                }));
              for (const entry of denyOnceEntries) {
                seen.add(entry.provenance);
              }
              const allowOnceEntries = Object.entries(allowOnce)
                .filter(([provenance, entry]) => entry.remaining > 0 && !seen.has(provenance))
                .map(([provenance, entry]) => ({
                  provenance,
                  state: "allow_once" as const,
                  reason: "Terminal 2 released this provenance from canyon once",
                  seenAt: entry.grantedAt,
                  deniedCount: hostileDeniedCounts[provenance] ?? 0,
                  allowOnceRemaining: entry.remaining,
                  standingAllowed: false,
                }));
              for (const entry of allowOnceEntries) {
                seen.add(entry.provenance);
              }
              const allowLawEntries = Object.entries(allowed)
                .filter(([provenance]) => !seen.has(provenance))
                .map(([provenance, entry]) => ({
                  provenance,
                  state: "allow_as_law" as const,
                  reason: entry.reason,
                  seenAt: entry.grantedAt,
                  deniedCount: hostileDeniedCounts[provenance] ?? 0,
                  allowOnceRemaining: 0,
                  standingAllowed: true,
                }));
              for (const entry of allowLawEntries) {
                seen.add(entry.provenance);
              }
              const canyonEntries = Object.entries(canyonProvenances)
                .filter(([provenance]) => !seen.has(provenance))
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
                }));
              const provenances = [...canyonEntries, ...allowOnceEntries, ...denyOnceEntries, ...allowLawEntries]
                .sort((left, right) => right.seenAt - left.seenAt);
              writeJsonOutput(socket, {
                type: "ingress_status",
                requestId,
                provenances,
              });
              continue;
            }
            if (parsed.command === "restart") {
              await supervisor.restart(parsed.reason ?? "server command restart");
              const status = supervisor.getStatus();
              writeJsonOutput(socket, {
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
                writeJsonOutput(socket, {
                  type: "error",
                  requestId,
                  error: `unknown swarm group: ${parsed.groupId}`,
                });
                continue;
              }
              writeJsonOutput(socket, {
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
                writeJsonOutput(socket, {
                  type: "error",
                  requestId,
                  error: `unknown swarm group: ${parsed.groupId}`,
                });
                continue;
              }
              writeJsonOutput(socket, {
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
                writeJsonOutput(socket, {
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
                nextState = denyIngressOnce(
                  state,
                  parsed.provenance,
                  parsed.reason ?? `Terminal 2 kept ${parsed.provenance} in the canyon once`,
                );
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

              writeJsonOutput(socket, {
                type: "ack",
                requestId,
                command: parsed.command,
                provenance: parsed.provenance,
                reason: parsed.reason,
              });
              continue;
            }
            await supervisor.stop();
            writeJsonOutput(socket, {
              type: "ack",
              requestId,
              command: "shutdown",
            });
            server.close();
            return;
          }

          const result = await swarm.evaluateOrWait(parsed);

          if (result.tarpitActive) {
            // Cheap canyon behavior for hostile ingress: drop the payload and
            // close without a response so the caller gets no approval oracle
            // and the front line does not retain per-connection state.
            socket.destroy();
            continue;
          }

          const output: BoundaryInterceptDaemonOutput = {
            type: "decision",
            ...result,
            requestId,
            internalRequestId: result.requestId,
          };
          if (rawGravityClient) {
            writeGravityDecision(socket, output);
            continue;
          }
          writeJsonOutput(socket, output);
        } catch (error) {
          const output: BoundaryInterceptDaemonOutput = {
            type: "error",
            requestId,
            error: error instanceof Error ? error.message : "server evaluation failed",
          };
          if (rawGravityClient) {
            writeGravityDecision(socket, error instanceof Error ? error : new Error(output.error));
            continue;
          }
          writeJsonOutput(socket, output);
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
