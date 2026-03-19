import {
  buildBoundaryLedgerCheckpoint,
  buildBoundaryLedgerRollup,
  queryBoundaryLedger,
  readBoundaryLedgerCheckpoints,
  readBoundaryLedgerSigningIdentity,
  repairBoundaryLedgerChain,
  readBoundaryLedgerStats,
  sealBoundaryLedgerSignatures,
  verifyBoundaryLedgerChain,
  writeBoundaryLedgerCheckpoint,
  writeBoundaryLedgerRollup,
} from "../lib/lml/agent-boundary/index.ts";

type ParsedArgs = {
  command: "query" | "stats" | "verify" | "rollup" | "repair" | "seal" | "checkpoint" | "key";
  from?: string;
  to?: string;
  source?: string;
  action?: string;
  decision?: "ALLOW" | "DENY" | "REQUIRE_APPROVAL" | "PENDING";
  law?: string;
  limit?: number;
  format: "json" | "text";
  period?: string;
  write?: boolean;
};

function usage(): never {
  console.error(
    [
      "Usage:",
      "  node scripts/agent-buccet-ledger-cli.ts query [--from <iso>] [--to <iso>] [--source <id>] [--decision <ALLOW|DENY|REQUIRE_APPROVAL|PENDING>] [--format json|text] [--limit <n>]",
      "  node scripts/agent-buccet-ledger-cli.ts stats [--from <iso>] [--to <iso>] [--format json|text]",
      "  node scripts/agent-buccet-ledger-cli.ts verify [--format json|text]",
      "  node scripts/agent-buccet-ledger-cli.ts rollup --period <label> [--from <iso>] [--to <iso>] [--write] [--format json|text]",
      "  node scripts/agent-buccet-ledger-cli.ts repair [--format json|text]",
      "  node scripts/agent-buccet-ledger-cli.ts seal [--format json|text]",
      "  node scripts/agent-buccet-ledger-cli.ts checkpoint [--write] [--format json|text]",
      "  node scripts/agent-buccet-ledger-cli.ts key [--format json|text]",
    ].join("\n"),
  );
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  const command = argv[0] as ParsedArgs["command"] | undefined;
  if (!command || !["query", "stats", "verify", "rollup", "repair", "seal", "checkpoint", "key"].includes(command)) {
    usage();
  }

  const parsed: ParsedArgs = {
    command,
    format: "json",
  };

  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--from") {
      parsed.from = argv[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--to") {
      parsed.to = argv[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--source") {
      parsed.source = argv[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--action") {
      parsed.action = argv[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--decision") {
      parsed.decision = (argv[index + 1] ?? usage()) as ParsedArgs["decision"];
      index += 1;
      continue;
    }
    if (token === "--law") {
      parsed.law = argv[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--limit") {
      parsed.limit = Number(argv[index + 1] ?? usage());
      index += 1;
      continue;
    }
    if (token === "--format") {
      parsed.format = (argv[index + 1] ?? usage()) as ParsedArgs["format"];
      index += 1;
      continue;
    }
    if (token === "--period") {
      parsed.period = argv[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--write") {
      parsed.write = true;
      continue;
    }
    usage();
  }

  return parsed;
}

function print(value: unknown, format: "json" | "text") {
  if (format === "json") {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      console.log(JSON.stringify(item));
    }
    return;
  }
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === "query") {
    const records = await queryBoundaryLedger({
      from: args.from,
      to: args.to,
      source: args.source,
      action: args.action,
      decision: args.decision,
      law: args.law,
      limit: args.limit,
    });
    print(records, args.format);
    return;
  }

  if (args.command === "stats") {
    const stats = await readBoundaryLedgerStats({
      from: args.from,
      to: args.to,
    });
    print(stats, args.format);
    return;
  }

  if (args.command === "verify") {
    const verify = await verifyBoundaryLedgerChain();
    print(verify, args.format);
    return;
  }

  if (args.command === "repair") {
    const repaired = await repairBoundaryLedgerChain();
    print(repaired, args.format);
    return;
  }

  if (args.command === "seal") {
    const sealed = await sealBoundaryLedgerSignatures();
    print(sealed, args.format);
    return;
  }

  if (args.command === "checkpoint") {
    const checkpoint = args.write
      ? await writeBoundaryLedgerCheckpoint()
      : await buildBoundaryLedgerCheckpoint();
    const stored = await readBoundaryLedgerCheckpoints();
    print({
      checkpoint,
      stored_checkpoints: stored.length,
    }, args.format);
    return;
  }

  if (args.command === "key") {
    const identity = await readBoundaryLedgerSigningIdentity();
    print(identity, args.format);
    return;
  }

  if (!args.period) {
    usage();
  }

  const rollup = args.write
    ? await writeBoundaryLedgerRollup({
        period: args.period,
        from: args.from,
        to: args.to,
      })
    : await buildBoundaryLedgerRollup({
        period: args.period,
        from: args.from,
        to: args.to,
      });
  print(rollup, args.format);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
