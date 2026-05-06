import { promises as fs } from "node:fs";
import net from "node:net";
import readline from "node:readline";
import {
  type BoundaryGravityFunnelPayload,
  type BoundaryInterceptDaemonOutput,
  mapBoundaryGravityFunnelPayloadToInterceptRequests,
  parseBoundaryGravityFunnelPayload,
  sendBoundaryInterceptServerInput,
} from "./../src/index.ts";

type ParsedArgs = {
  listenSocketPath?: string;
  listenHost?: string;
  listenPort?: number;
  upstreamHost?: string;
  upstreamPort?: number;
  upstreamSocketPath?: string;
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

async function forwardGravityPayload(args: {
  payload: BoundaryGravityFunnelPayload;
  target: ParsedArgs;
}): Promise<BoundaryInterceptDaemonOutput> {
  const requests = mapBoundaryGravityFunnelPayloadToInterceptRequests(args.payload);
  let lastOutput: BoundaryInterceptDaemonOutput | null = null;

  for (const request of requests) {
    lastOutput = await sendBoundaryInterceptServerInput({
      target: args.target.upstreamSocketPath
        ? { socketPath: args.target.upstreamSocketPath }
        : { host: args.target.upstreamHost!, port: args.target.upstreamPort! },
      input: request,
    });

    if (lastOutput.type !== "decision" || lastOutput.decision !== "allow") {
      return lastOutput;
    }
  }

  if (!lastOutput) {
    throw new Error("gravity bridge produced no intercept output");
  }

  return lastOutput;
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
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    void (async () => {
      for await (const line of rl) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        if (trimmed === "__health__") {
          socket.write("1");
          continue;
        }
        try {
          const payload = parseBoundaryGravityFunnelPayload(trimmed);
          const output = await forwardGravityPayload({
            payload,
            target: args,
          });

          if (output.type === "error") {
            console.error(`[gravity-bridge-error] ${output.error}`);
          } else if (output.type === "decision" && output.decision !== "allow") {
            console.error(
              `[gravity-bridge-blocked] ${payload.action} ${payload.target} reason=${output.reason}`,
            );
          }

          writeDecision(socket, output);
        } catch (error) {
          console.error("[gravity-bridge-deny]", error);
          writeDecision(
            socket,
            error instanceof Error ? error : new Error("gravity bridge failed"),
          );
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
