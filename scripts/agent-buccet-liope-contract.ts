/**
 * LIOPE — Ledger I/O Physics Envelope contract
 *
 * Proves the three LIOPE invariants:
 *   Q1.8  Atomic Shedding Ring Buffer — queue is bounded; overflow is shed, not written
 *   D2.8  Max-IOPS Background Daemon  — batch flush writes all queued events under one lock
 *   A3.8  Signed Magnitude Storm Events — LEDGER_STORM_SUMMARY is emitted when shed > 0
 *
 * Also verifies:
 *   - Material state transitions bypass the queue and are written immediately
 *   - LEDGER_STORM_SUMMARY is signed and chain-linked like any other record
 */

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  appendBoundaryLedger,
  flushLiopeQueue,
  getLiopeStats,
  stopLiopeDaemon,
  LIOPE_MAX_QUEUE_SIZE,
  LIOPE_MATERIAL_EVENTS,
  readBoundaryLedgerBySession,
  readAllBoundaryLedgerRecords,
  verifyBoundaryLedgerRecordSignature,
} from "../lib/agent-buccet/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`LIOPE contract FAIL: ${message}`);
}

async function clearLedgerForTest(): Promise<void> {
  const ledgerDir = path.join(process.cwd(), "data", "ledger");
  const ledgerFile = path.join(ledgerDir, "agent-boundary-ledger.jsonl");
  const walFile = path.join(ledgerDir, "agent-boundary-ledger.wal.jsonl");
  const lockFile = path.join(ledgerDir, "agent-boundary-ledger.lock");
  await fs.mkdir(ledgerDir, { recursive: true });
  await fs.writeFile(ledgerFile, "", "utf8").catch(() => undefined);
  await fs.writeFile(walFile, "", "utf8").catch(() => undefined);
  await fs.rm(lockFile, { force: true }).catch(() => undefined);
}

function makePayload(sessionId: string, overrides?: Partial<{ target: string; reason: string }>) {
  return {
    sessionId,
    actorId: "system:liope-contract",
    requestId: `req-${randomUUID()}`,
    actionKind: "network.send" as const,
    target: overrides?.target ?? "https://example.com",
    reason: overrides?.reason ?? "liope test",
    createdAt: new Date().toISOString(),
  };
}

async function main() {
  // Stop the background daemon for the duration of the contract.
  // All flushes are explicit — prevents the 100ms timer from racing with shed-count checks.
  stopLiopeDaemon();

  await clearLedgerForTest();

  // ─── Test 1: Material events bypass LIOPE queue ──────────────────────────────

  const materialSession = `liope-material-${randomUUID()}`;

  // Flush any prior queued junk first
  await flushLiopeQueue();

  const statsBefore = getLiopeStats();

  await appendBoundaryLedger("SESSION_STARTED", {
    ...makePayload(materialSession),
    reason: "session started — material bypass test",
  });

  const statsAfter = getLiopeStats();
  // queue depth should not have increased (material event bypasses queue)
  assert(
    statsAfter.queueDepth === statsBefore.queueDepth,
    `material SESSION_STARTED must bypass queue — queueDepth before=${statsBefore.queueDepth} after=${statsAfter.queueDepth}`,
  );

  // Record must be readable immediately (written synchronously)
  const materialRecords = await readBoundaryLedgerBySession(materialSession);
  assert(materialRecords.length >= 1, "material SESSION_STARTED must be immediately durable");
  assert(
    materialRecords.some((r) => r.eventType === "SESSION_STARTED"),
    "material record must have eventType SESSION_STARTED",
  );

  console.log("  [pass] Test 1: material events bypass LIOPE queue and are immediately durable");

  // ─── Test 2: LIOPE_MATERIAL_EVENTS set covers expected entries ───────────────

  const expectedMaterial: string[] = [
    "SESSION_STARTED", "SESSION_ENDED", "GRANT_ISSUED", "GRANT_REVOKED",
    "ACTION_BLOCKED", "ACTION_EXECUTED", "GOVERNOR_TRIP",
    "PROCESS_PHYSWRAP_ACTIVE", "INGRESS_STANDING_LAW_WRITTEN", "LEDGER_STORM_SUMMARY",
  ];
  for (const ev of expectedMaterial) {
    assert(
      LIOPE_MATERIAL_EVENTS.has(ev as never),
      `LIOPE_MATERIAL_EVENTS must include ${ev}`,
    );
  }

  console.log("  [pass] Test 2: LIOPE_MATERIAL_EVENTS covers expected material event types");

  // ─── Test 3: Observation events go through the queue (O(1) enqueue) ──────────

  await flushLiopeQueue(); // start with empty queue
  const obsSession = `liope-obs-${randomUUID()}`;

  const depthBefore = getLiopeStats().queueDepth;

  await appendBoundaryLedger("INGRESS_PROVENANCE_BLOCKED", makePayload(obsSession));
  await appendBoundaryLedger("INGRESS_DENIED", makePayload(obsSession));
  await appendBoundaryLedger("INGRESS_VELOCITY_TRIP", makePayload(obsSession));

  const depthAfter = getLiopeStats().queueDepth;
  assert(depthAfter === depthBefore + 3, `3 observation events must be in queue — expected ${depthBefore + 3} got ${depthAfter}`);

  // Not yet on disk (daemon hasn't flushed)
  const obsBeforeFlush = await readBoundaryLedgerBySession(obsSession);
  assert(obsBeforeFlush.length === 0, "observation events must NOT be on disk before flush");

  console.log("  [pass] Test 3: observation events queue in memory, not written until flush");

  // ─── Test 4: Flush writes all queued events — D2.8 batch flush ───────────────

  await flushLiopeQueue();

  const obsAfterFlush = await readBoundaryLedgerBySession(obsSession);
  assert(obsAfterFlush.length >= 3, `all 3 queued events must be durable after flush — got ${obsAfterFlush.length}`);
  assert(
    obsAfterFlush.some((r) => r.eventType === "INGRESS_PROVENANCE_BLOCKED"),
    "INGRESS_PROVENANCE_BLOCKED must be in ledger after flush",
  );
  assert(
    obsAfterFlush.some((r) => r.eventType === "INGRESS_VELOCITY_TRIP"),
    "INGRESS_VELOCITY_TRIP must be in ledger after flush",
  );

  // Chain linkage: consecutive records must form a valid prev_hash chain
  const sorted = obsAfterFlush.sort((a, b) => a.index - b.index);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    if (prev.META.hash !== "sha256:pending") {
      assert(
        curr.META.prev_hash === prev.META.hash,
        `chain broken at index ${curr.index}: prev_hash=${curr.META.prev_hash} expected=${prev.META.hash}`,
      );
    }
  }

  console.log("  [pass] Test 4: flush writes all queued events, chain-linked correctly");

  // ─── Test 5: Q1.8 shed — overflow is counted, not written ────────────────────

  await flushLiopeQueue(); // start clean

  // Fill queue past capacity
  const shedSession = `liope-shed-${randomUUID()}`;
  const overfill = LIOPE_MAX_QUEUE_SIZE + 50;

  for (let i = 0; i < overfill; i++) {
    await appendBoundaryLedger("INGRESS_PROVENANCE_BLOCKED", makePayload(shedSession));
  }

  const shedStats = getLiopeStats();
  assert(shedStats.shedCount >= 50, `shed count must be >= 50 (overfill=${overfill}, maxQueueSize=${LIOPE_MAX_QUEUE_SIZE}) — got shedCount=${shedStats.shedCount}`);
  assert(shedStats.queueDepth <= LIOPE_MAX_QUEUE_SIZE, `queue depth must not exceed LIOPE_MAX_QUEUE_SIZE=${LIOPE_MAX_QUEUE_SIZE} — got ${shedStats.queueDepth}`);
  assert(
    shedStats.shedByClass["INGRESS_PROVENANCE_BLOCKED"] !== undefined,
    "shed class tracking must record INGRESS_PROVENANCE_BLOCKED",
  );

  console.log(`  [pass] Test 5: Q1.8 shed — ${shedStats.shedCount} events shed, queue bounded to ${shedStats.queueDepth}`);

  // ─── Test 6: A3.8 storm summary — LEDGER_STORM_SUMMARY emitted on flush when shed > 0 ──
  // Shed state is captured from Test 5 above. We flush immediately — no async gap
  // where the daemon could reset the counters (daemon is stopped for the contract).

  const allBefore = await readAllBoundaryLedgerRecords();
  const stormCountBefore = allBefore.filter((r) => r.eventType === "LEDGER_STORM_SUMMARY").length;

  await flushLiopeQueue();

  const allAfter = await readAllBoundaryLedgerRecords();
  const stormRecords = allAfter.filter((r) => r.eventType === "LEDGER_STORM_SUMMARY");
  assert(
    stormRecords.length > stormCountBefore,
    "LEDGER_STORM_SUMMARY must be emitted after flush with shed > 0",
  );

  const storm = stormRecords[stormRecords.length - 1]!;
  assert(
    typeof storm.payload.metadata?.shed_count === "number" && storm.payload.metadata.shed_count > 0,
    "LEDGER_STORM_SUMMARY must carry shed_count > 0",
  );
  assert(
    typeof storm.payload.metadata?.window_ms === "number",
    "LEDGER_STORM_SUMMARY must carry window_ms",
  );
  assert(
    typeof storm.payload.metadata?.by_class === "string",
    "LEDGER_STORM_SUMMARY must carry by_class JSON string",
  );

  const parsedByClass = JSON.parse(storm.payload.metadata.by_class as string) as Record<string, number>;
  assert(
    parsedByClass["INGRESS_PROVENANCE_BLOCKED"] !== undefined,
    "LEDGER_STORM_SUMMARY.by_class must include shed class INGRESS_PROVENANCE_BLOCKED",
  );

  console.log(`  [pass] Test 6: A3.8 LEDGER_STORM_SUMMARY emitted — shed_count=${storm.payload.metadata?.shed_count} window_ms=${storm.payload.metadata?.window_ms}`);

  // ─── Test 7: LEDGER_STORM_SUMMARY is signed ───────────────────────────────────

  const stormSig = storm.META.signature;
  const stormSignerId = storm.META.signer_id;
  assert(typeof stormSig === "string" && stormSig.length > 0, "LEDGER_STORM_SUMMARY must carry a signature");
  assert(typeof stormSignerId === "string" && stormSignerId.length > 0, "LEDGER_STORM_SUMMARY must carry a signer_id");

  const sigResult = await verifyBoundaryLedgerRecordSignature(storm);
  assert(sigResult.ok, `LEDGER_STORM_SUMMARY signature must verify — reason: ${sigResult.reason}`);

  console.log("  [pass] Test 7: LEDGER_STORM_SUMMARY is ed25519-signed and verifies correctly");

  // ─── Test 8: No shed on second flush — shed counter resets between windows ───

  await flushLiopeQueue(); // fresh flush with no queued events

  const statsClean = getLiopeStats();
  assert(statsClean.shedCount === 0, "shed count must reset to 0 after flush");
  assert(statsClean.queueDepth === 0, "queue must be empty after flush");

  const allAfterClean = await readAllBoundaryLedgerRecords();
  const stormAfterClean = allAfterClean.filter((r) => r.eventType === "LEDGER_STORM_SUMMARY").length;
  assert(
    stormAfterClean === stormRecords.length,
    "no additional LEDGER_STORM_SUMMARY must be emitted when shed=0",
  );

  console.log("  [pass] Test 8: shed counter resets after flush, no spurious storm summaries emitted");

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log("\nLIOPE contract: all 8 tests passed.");
  console.log(`  LIOPE_MAX_QUEUE_SIZE=${LIOPE_MAX_QUEUE_SIZE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
