import { randomUUID } from "node:crypto";
import { runBoundaryWrappedCommand } from "./../src/index.ts";

type ParsedArgs = {
  sessionId: string;
  actorId: string;
  scopePaths: string[];
  policyPath?: string;
  cwd?: string;
  env: Record<string, string>;
  keepSession: boolean;
  dryRun: boolean;
  command: string;
  commandArgs: string[];
};

function usage(): never {
  console.error(
    [
      "Usage:",
      "  node scripts/agent-buccet-run.ts [options] -- <command> [args...]",
      "",
      "Options:",
      "  --session-id <id>",
      "  --actor-id <id>",
      "  --scope <path>          repeatable",
      "  --policy <json-path>",
      "  --cwd <path>",
      "  --env KEY=VALUE         repeatable",
      "  --keep-session",
      "  --dry-run",
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  let sessionId = `agent-buccet-run-${randomUUID()}`;
  let actorId = "user:agent-buccet-cli";
  const scopePaths: string[] = [];
  let policyPath: string | undefined;
  let cwd: string | undefined;
  const env: Record<string, string> = {};
  let keepSession = false;
  let dryRun = false;
  let separatorIndex = argv.indexOf("--");

  if (separatorIndex === -1) {
    separatorIndex = argv.length;
  }

  const optionArgs = argv.slice(0, separatorIndex);
  const commandArgs = argv.slice(separatorIndex + 1);

  for (let index = 0; index < optionArgs.length; index += 1) {
    const token = optionArgs[index];
    if (token === "--session-id") {
      sessionId = optionArgs[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--actor-id") {
      actorId = optionArgs[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--scope") {
      scopePaths.push(optionArgs[index + 1] ?? usage());
      index += 1;
      continue;
    }
    if (token === "--policy") {
      policyPath = optionArgs[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--cwd") {
      cwd = optionArgs[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--env") {
      const pair = optionArgs[index + 1] ?? usage();
      const separator = pair.indexOf("=");
      if (separator <= 0) {
        usage();
      }
      env[pair.slice(0, separator)] = pair.slice(separator + 1);
      index += 1;
      continue;
    }
    if (token === "--keep-session") {
      keepSession = true;
      continue;
    }
    if (token === "--dry-run") {
      dryRun = true;
      continue;
    }
    usage();
  }

  if (commandArgs.length === 0) {
    usage();
  }

  return {
    sessionId,
    actorId,
    scopePaths,
    policyPath,
    cwd,
    env,
    keepSession,
    dryRun,
    command: commandArgs[0],
    commandArgs: commandArgs.slice(1),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = await runBoundaryWrappedCommand({
    sessionId: args.sessionId,
    actorId: args.actorId,
    command: args.command,
    commandArgs: args.commandArgs,
    scopePaths: args.scopePaths,
    policyPath: args.policyPath,
    cwd: args.cwd,
    env: args.env,
    keepSession: args.keepSession,
    dryRun: args.dryRun,
  });

  console.log(
    `Agent Buccet wrapper completed. session=${result.sessionId} exitCode=${result.exitCode}`,
  );
  process.exit(result.exitCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
