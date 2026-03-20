import {
  appendBoundaryLedger,
  queryBoundaryLedger,
  verifyBoundaryLedgerChain,
} from "../lib/agent-buccet/index.ts";

type Tier = "small" | "medium";

function nowMs() {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function parseTier(value: string | undefined): Tier {
  return value === "medium" ? "medium" : "small";
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const tier = parseTier(process.env.AGENT_BUCCET_LEDGER_PERF_TIER);
  const writes = tier === "medium" ? 250 : 80;
  const sessionId = `agent-buccet-ledger-perf-${tier}-${Date.now()}`;
  const actorId = "system:ledger-perf-contract";

  const t0 = nowMs();
  for (let index = 0; index < writes; index += 1) {
    await appendBoundaryLedger("ACTION_PROPOSED", {
      sessionId,
      actorId,
      requestId: `perf-${index}`,
      actionKind: "fs.read",
      target: `/tmp/perf-${index}.txt`,
      reason: "ledger perf smoke",
      createdAt: new Date().toISOString(),
    });
  }
  const appendMs = nowMs() - t0;

  const t1 = nowMs();
  const records = await queryBoundaryLedger({
    source: actorId,
    action: "fs.read",
    limit: writes + 10,
  });
  const queryMs = nowMs() - t1;

  const t2 = nowMs();
  const verify = await verifyBoundaryLedgerChain();
  const verifyMs = nowMs() - t2;

  const appendPerRecordMs = appendMs / writes;
  const maxAppendPerRecordMs = Number(process.env.AGENT_BUCCET_LEDGER_PERF_MAX_APPEND_MS ?? "500");
  const maxQueryMs = Number(process.env.AGENT_BUCCET_LEDGER_PERF_MAX_QUERY_MS ?? "15000");
  const maxVerifyMs = Number(process.env.AGENT_BUCCET_LEDGER_PERF_MAX_VERIFY_MS ?? "30000");

  assert(
    records.length >= writes,
    `expected at least ${writes} queried records, got ${records.length}`,
  );
  assert(verify.ok, `ledger verify failed during perf contract: ${verify.reason ?? "unknown"}`);
  assert(
    appendPerRecordMs <= maxAppendPerRecordMs,
    `append perf regression: ${appendPerRecordMs.toFixed(2)}ms/record > ${maxAppendPerRecordMs}ms`,
  );
  assert(queryMs <= maxQueryMs, `query perf regression: ${queryMs.toFixed(2)}ms > ${maxQueryMs}ms`);
  assert(verifyMs <= maxVerifyMs, `verify perf regression: ${verifyMs.toFixed(2)}ms > ${maxVerifyMs}ms`);

  const metrics = {
    tier,
    writes,
    append_ms: Number(appendMs.toFixed(2)),
    append_per_record_ms: Number(appendPerRecordMs.toFixed(2)),
    query_ms: Number(queryMs.toFixed(2)),
    verify_ms: Number(verifyMs.toFixed(2)),
    queried_records: records.length,
    thresholds: {
      max_append_per_record_ms: maxAppendPerRecordMs,
      max_query_ms: maxQueryMs,
      max_verify_ms: maxVerifyMs,
    },
  };

  console.log("Agent Buccet ledger perf contract");
  console.log(JSON.stringify(metrics, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
