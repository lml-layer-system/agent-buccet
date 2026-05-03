import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import net from "node:net";
import readline from "node:readline";
import {
  type BoundaryLedgerWriterInput,
  type BoundaryLedgerWriterOutput,
  appendBoundaryLedgerLocal,
  verifyBoundaryLedgerChain,
} from "./../src/index.ts";

type ParsedArgs = {
  host: string;
  port?: number;
  socketPath?: string;
};

function usage(): never {
  console.error(
    [
      "Usage:",
      "  node scripts/agent-buccet-ledger-writer.ts [--socket <path>]",
      "  node scripts/agent-buccet-ledger-writer.ts [--host <host> --port <port>]",
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  let host = "127.0.0.1";
  let port: number | undefined = 7798;
  let socketPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
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

  return { host, port, socketPath };
}

function writeOutput(
  socket: net.Socket,
  output:
    | BoundaryLedgerWriterOutput
    | { type: "status"; requestId: string; ok: boolean }
    | { type: "ack"; command: "shutdown"; requestId: string },
) {
  socket.write(`${JSON.stringify(output)}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.socketPath) {
    await fs.rm(args.socketPath, { force: true }).catch(() => undefined);
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

        let parsed: BoundaryLedgerWriterInput & { requestId?: string };
        try {
          parsed = JSON.parse(trimmed) as typeof parsed;
        } catch (error) {
          writeOutput(socket, {
            type: "error",
            error: error instanceof Error ? error.message : "invalid writer input",
          });
          continue;
        }

        const requestId = parsed.requestId ?? `ledger-writer-${randomUUID()}`;

        try {
          if (parsed.command === "status") {
            const verify = await verifyBoundaryLedgerChain();
            writeOutput(socket, {
              type: "status",
              requestId,
              ok: verify.ok,
            });
            continue;
          }
          if (parsed.command === "shutdown") {
            writeOutput(socket, {
              type: "ack",
              requestId,
              command: "shutdown",
            });
            server.close();
            return;
          }

          const record = await appendBoundaryLedgerLocal(parsed.eventType, parsed.payload);
          writeOutput(socket, {
            type: "append_ok",
            record,
          });
        } catch (error) {
          writeOutput(socket, {
            type: "error",
            error: error instanceof Error ? error.message : "ledger writer failed",
          });
        }
      }
    })().catch((error) => {
      console.error("[ledger-writer-connection-error]", error);
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
    console.error(`Agent Buccet ledger writer running. socket=${address}`);
  } else if (address) {
    console.error(
      `Agent Buccet ledger writer running. host=${address.address} port=${address.port}`,
    );
  }

  const shutdown = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
