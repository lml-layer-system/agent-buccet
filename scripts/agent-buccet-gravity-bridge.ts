import { promises as fs } from "node:fs";
import net from "node:net";
import readline from "node:readline";
import {
  sendBoundaryInterceptServerInput,
  type BoundaryInterceptDaemonOutput,
  type BoundaryInterceptRequest,
} from "../lib/agent-buccet/index.ts";

type ParsedArgs = {
  listenSocketPath?: string;
  listenHost?: string;
  listenPort?: number;
  upstreamHost?: string;
  upstreamPort?: number;
  upstreamSocketPath?: string;
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
      "  node scripts/agent-buccet-gravity-bridge.ts --listen-socket <path> --upstream-socket <path>",
      "  node scripts/agent-buccet-gravity-bridge.ts --listen-socket <path> --upstream-host <host> --upstream-port <port>",
      "  node scripts/agent-buccet-gravity-bridge.ts --listen-host <host> --listen-port <port> --upstream-host <host> --upstream-port <port>",
      "",
      "Environment:",
      "  BUCCET_SOCKET_PATH",
      "  AGENT_BUCCET_INTERCEPT_SOCKET",
      "  AGENT_BUCCET_INTERCEPT_HOST",
      "  AGENT_BUCCET_INTERCEPT_PORT",
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  let listenSocketPath: string | undefined = process.env.BUCCET_SOCKET_PATH ?? "/tmp/buccet.sock";
  let listenHost: string | undefined;
  let listenPort: number | undefined;
  let upstreamHost = process.env.AGENT_BUCCET_INTERCEPT_HOST;
  let upstreamPort = process.env.AGENT_BUCCET_INTERCEPT_PORT
    ? Number(process.env.AGENT_BUCCET_INTERCEPT_PORT)
    : undefined;
  let upstreamSocketPath = process.env.AGENT_BUCCET_INTERCEPT_SOCKET;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--listen-socket") {
      listenSocketPath = argv[index + 1] ?? usage();
      listenHost = undefined;
      listenPort = undefined;
      index += 1;
      continue;
    }
    if (token === "--listen-host") {
      listenHost = argv[index + 1] ?? usage();
      listenSocketPath = undefined;
      index += 1;
      continue;
    }
    if (token === "--listen-port") {
      listenPort = Number(argv[index + 1] ?? usage());
      listenSocketPath = undefined;
      index += 1;
      continue;
    }
    if (token === "--upstream-socket") {
      upstreamSocketPath = argv[index + 1] ?? usage();
      upstreamHost = undefined;
      upstreamPort = undefined;
      index += 1;
      continue;
    }
    if (token === "--upstream-host") {
      upstreamHost = argv[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--upstream-port") {
      upstreamPort = Number(argv[index + 1] ?? usage());
      index += 1;
      continue;
    }
    usage();
  }

  if (!listenSocketPath && !(listenHost && listenPort)) {
    usage();
  }

  if (!upstreamSocketPath && !(upstreamHost && upstreamPort)) {
    usage();
  }

  return {
    listenSocketPath,
    listenHost,
    listenPort,
    upstreamHost,
    upstreamPort,
    upstreamSocketPath,
  };
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

function writeDecision(socket: net.Socket, output: BoundaryInterceptDaemonOutput | Error) {
  if (output instanceof Error) {
    socket.write("0");
    return;
  }
  socket.write(output.type === "decision" && output.decision === "allow" ? "1" : "0");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.listenSocketPath) {
    await fs.rm(args.listenSocketPath, { force: true }).catch(() => undefined);
  }

  const server = net.createServer((socket) => {
    const rl = readline.createInterface({
      input: socket,
      crlfDelay: Infinity,
    });

    void (async () => {
      for await (const line of rl) {
        if (!line.trim()) {
          continue;
        }
        try {
          const payload = parseGravityPayload(line);
          const request = mapGravityPayloadToInterceptRequest(payload);
          const output = await sendBoundaryInterceptServerInput({
            target: args.upstreamSocketPath
              ? { socketPath: args.upstreamSocketPath }
              : { host: args.upstreamHost!, port: args.upstreamPort! },
            input: request,
          });

          if (output.type === "error") {
            console.error(`[gravity-bridge-error] ${output.error}`);
          } else if (output.type === "decision" && output.decision !== "allow") {
            console.error(`[gravity-bridge-blocked] ${payload.action} ${payload.target} reason=${output.reason}`);
          }

          writeDecision(socket, output);
        } catch (error) {
          console.error("[gravity-bridge-deny]", error);
          writeDecision(socket, error instanceof Error ? error : new Error("gravity bridge failed"));
        }
      }
    })().catch((error) => {
      console.error("[gravity-bridge-connection-error]", error);
      socket.destroy(error instanceof Error ? error : undefined);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    if (args.listenSocketPath) {
      server.listen(args.listenSocketPath, () => resolve());
      return;
    }
    server.listen(args.listenPort, args.listenHost, () => resolve());
  });
  if (args.listenSocketPath) {
    await fs.chmod(args.listenSocketPath, 0o600).catch(() => undefined);
  }
  const listenAddress = args.listenSocketPath ?? `${args.listenHost}:${args.listenPort}`;
  console.error(
    `Agent Buccet gravity bridge running. sensor=${listenAddress} upstream=${args.upstreamSocketPath ?? `${args.upstreamHost}:${args.upstreamPort}`}`,
  );

  const shutdown = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (args.listenSocketPath) {
      await fs.rm(args.listenSocketPath, { force: true }).catch(() => undefined);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
