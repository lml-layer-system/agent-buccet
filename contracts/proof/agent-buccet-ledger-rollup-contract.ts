import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  appendBoundaryLedger,
  buildBoundaryLedgerRollup,
  readBoundaryLedgerRollups,
  writeBoundaryLedgerRollup,
} from "./../../src/index.ts";

async function main() {
  const sessionId = `agent-buccet-ledger-rollup-${randomUUID()}`;
  const actorId = "system:ledger-rollup-contract";
  const now = new Date().toISOString();

  await appendBoundaryLedger("ACTION_BLOCKED", {
    sessionId,
    actorId,
    requestId: `req-${randomUUID()}`,
    actionKind: "fs.delete",
    target: "/tmp/ledger-rollup-contract.txt",
    decision: "deny",
    reason: "blocked delete",
    lawIds: ["BOUNDARY.DELETE.01"],
    createdAt: now,
  });

  const period = `rollup-${randomUUID()}`;
  const built = await buildBoundaryLedgerRollup({
    period,
    from: now.slice(0, 10),
  });
  assert.equal(typeof built.total_entries, "number");

  const written = await writeBoundaryLedgerRollup({
    period,
    from: now.slice(0, 10),
  });
  assert.equal(written.period, period);

  const rollups = await readBoundaryLedgerRollups();
  assert.equal(rollups.some((rollup) => rollup.period === period), true);

  console.log("Agent Buccet ledger rollup contract");
  console.log(`rollup period: ${written.period}`);
  console.log(`entries: ${written.total_entries}`);
  console.log(`denials: ${written.by_decision.DENY ?? 0}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
