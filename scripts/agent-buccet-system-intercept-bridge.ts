import readline from "node:readline";
import {
  type BoundaryInterceptDaemonCommand,
  type BoundaryInterceptDaemonOutput,
  type BoundarySystemInterceptEvent,
  evaluateSystemInterceptEvent,
  sendBoundaryInterceptServerInput,
} from "./../src/index.ts";

type ParsedArgs = {
  host?: string;
  port?: number;
  socketPath?: string;
};

function usage(): never {
  console.error(
    [
      "Usage:",
      "  node scripts/agent-buccet-system-intercept-bridge.ts [--socket <path>]",
      "  node scripts/agent-buccet-system-intercept-bridge.ts [--host <host> --port <port>]",
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  let host: string | undefined;
  let port: number | undefined;
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
      index += 1;
      continue;
    }
    usage();
  }

  if (socketPath) {
    return { socketPath };
  }
  if (host && port) {
    return { host, port };
  }
  usage();
}

function writeOutput(output: BoundaryInterceptDaemonOutput) {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = args.socketPath
    ? { socketPath: args.socketPath }
    : { host: args.host!, port: args.port! };
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let parsed: BoundarySystemInterceptEvent | BoundaryInterceptDaemonCommand;
    try {
      parsed = JSON.parse(trimmed) as BoundarySystemInterceptEvent | BoundaryInterceptDaemonCommand;
    } catch (error) {
      writeOutput({
        type: "error",
        requestId: "bridge-parse-error",
        error: error instanceof Error ? error.message : "invalid bridge input",
      });
      continue;
    }

    try {
      if ("command" in parsed) {
        writeOutput(await sendBoundaryInterceptServerInput({ target, input: parsed }));
        continue;
      }
      writeOutput(await evaluateSystemInterceptEvent({ target, event: parsed }));
    } catch (error) {
      writeOutput({
        type: "error",
        requestId: parsed.requestId ?? "bridge-eval-error",
        error: error instanceof Error ? error.message : "bridge evaluation failed",
      });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
