/**
 * Agent Buccet — Admission Hard Block Ceiling Contract
 *
 * Proves the hard-ceiling invariants:
 *
 *   H1  Weak provenance hits standing deny after exactly WEAK_PROVENANCE_HARD_BLOCK_CEILING
 *       tarpit decisions, regardless of density config.
 *   H2  Loose density config (windowSize > safe envelope) does not allow a weak
 *       provenance past the hard ceiling.
 *   H3  Hard-ceiling promotion is ledger-visible with promotionKind = "hard_ceiling".
 *   H4  validateAdmissionConfig() returns warnings for unsafe density configs.
 *   H5  Density promotion still fires before the ceiling when config is tight.
 *   H6  Standing-deny cache hit (O(1)) after hard-ceiling promotion —
 *       promotionKind preserved in state.
 */

import {
  DEFAULT_ADMISSION_WEIGHT,
  DENSITY_SAFE_MAX_WINDOW_SIZE,
  evaluateAdmission,
  initialAdmissionState,
  WEAK_PROVENANCE_HARD_BLOCK_CEILING,
  validateAdmissionConfig,
} from "../lib/agent-buccet/index.ts";
import type {
  BoundaryAdmissionConfig,
  BoundaryAdmissionState,
  BoundaryProvenanceRecord,
} from "../lib/agent-buccet/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`HARD-CAP contract FAIL: ${message}`);
}

function makeRequest(
  provenance: string,
  nowMs: number,
  overrides?: { provenanceStrength?: "weak" | "medium" | "strong" },
) {
  return {
    requestId: `req-${nowMs}-${Math.random()}`,
    provenance,
    provenanceStrength: overrides?.provenanceStrength ?? ("weak" as const),
    weightClass: "standard" as const,
    receivedAtMs: nowMs,
  };
}

/** Build a state with a weak provenance pre-seeded to a given totalDeniedCount. */
function stateWithDeniedCount(provenance: string, deniedCount: number, nowMs: number): BoundaryAdmissionState {
  const record: BoundaryProvenanceRecord = {
    requestTimestamps: Array.from({ length: deniedCount }, (_, i) => nowMs - (deniedCount - i) * 100),
    recentDecisions: Array.from({ length: deniedCount }, () => false),
    totalDeniedCount: deniedCount,
    totalInboundWeight: deniedCount,
    windowWeightTimestamps: [],
    lastSeenMs: nowMs - 100,
  };
  return {
    standingDenyProvenances: {},
    provenanceRecords: { [provenance]: record },
    hostileDeniedCounts: { [provenance]: deniedCount },
  };
}

// ─── H1: Hard ceiling fires at exactly WEAK_PROVENANCE_HARD_BLOCK_CEILING ──────
// Pre-seed state with ceiling - 1 denied decisions.
// The next tarpitted request must fire the ceiling.

{
  const cfg: BoundaryAdmissionConfig = {
    velocity: { maxRpm: 0, windowMs: 60_000 }, // always trips (after first admitted for weak)
    // No density config — only hard ceiling applies
  };

  // Pre-seed: ceiling - 1 denied. One more tarpit must fire the ceiling.
  const seedState = stateWithDeniedCount("ip:weak-h1", WEAK_PROVENANCE_HARD_BLOCK_CEILING - 1, 1_000);

  // First eval: ceiling not yet reached (deniedCount = 9 < 10)
  const r1 = evaluateAdmission({
    config: cfg,
    state: seedState,
    request: makeRequest("ip:weak-h1", 2_000),
    nowMs: 2_000,
  });
  assert(r1.result.promoted === false, "H1a: ceiling must NOT fire at ceiling-1 denials");
  assert(r1.result.promotionKind !== "hard_ceiling", "H1a: promotionKind must not be hard_ceiling yet");

  // One more deny (velocity fires again, accumulating 10 total)
  const r2 = evaluateAdmission({
    config: cfg,
    state: r1.state,
    request: makeRequest("ip:weak-h1", 2_100),
    nowMs: 2_100,
  });

  // Now at exactly ceiling. Check if ceiling fires (next tarpit triggers it).
  // r1 velocity fires, totalDeniedCount becomes ceiling. r2 should check ceiling.
  let state = r2.state;
  let ceilingFired = r2.result.promoted && r2.result.promotionKind === "hard_ceiling";

  if (!ceilingFired) {
    // One more request to pick up the ceiling after velocity updated the count
    const r3 = evaluateAdmission({
      config: cfg,
      state,
      request: makeRequest("ip:weak-h1", 2_200),
      nowMs: 2_200,
    });
    ceilingFired = r3.result.promoted && r3.result.promotionKind === "hard_ceiling";
    state = r3.state;
  }

  assert(ceilingFired, "H1b: ceiling must fire within 1 request of reaching WEAK_PROVENANCE_HARD_BLOCK_CEILING denials");
  assert(state.standingDenyProvenances["ip:weak-h1"] !== undefined, "H1c: provenance must be in standing deny");
  assert(
    state.standingDenyProvenances["ip:weak-h1"].promotionKind === "hard_ceiling",
    "H1d: standing deny entry must have promotionKind=hard_ceiling",
  );

  console.log(`  [pass] H1: hard ceiling fires at WEAK_PROVENANCE_HARD_BLOCK_CEILING=${WEAK_PROVENANCE_HARD_BLOCK_CEILING} tarpit decisions`);
}

// ─── H2: Loose density config does not push past ceiling ─────────────────────
// maxDenyRatio=0.99, windowSize=100 → density would need 99% denials in 100
// requests before firing. For weak provenance, ceiling (10) fires first.

{
  const looseCfg: BoundaryAdmissionConfig = {
    velocity: { maxRpm: 0, windowMs: 60_000 },
    density: { maxDenyRatio: 0.99, windowSize: 100 },
  };

  // Pre-seed to ceiling - 1
  const seedState = stateWithDeniedCount("ip:weak-h2", WEAK_PROVENANCE_HARD_BLOCK_CEILING - 1, 1_000);

  let state = seedState;
  let promotionKind: "density" | "hard_ceiling" | undefined;

  // Drive until promotion occurs
  for (let i = 0; i < 5; i++) {
    const r = evaluateAdmission({
      config: looseCfg,
      state,
      request: makeRequest("ip:weak-h2", 2_000 + i * 100),
      nowMs: 2_000 + i * 100,
    });
    state = r.state;
    if (r.result.promoted) {
      promotionKind = r.result.promotionKind;
      break;
    }
    if (state.standingDenyProvenances["ip:weak-h2"]) break;
  }

  assert(state.standingDenyProvenances["ip:weak-h2"] !== undefined, "H2: must be in standing deny");
  assert(
    promotionKind === "hard_ceiling" || state.standingDenyProvenances["ip:weak-h2"].promotionKind === "hard_ceiling",
    `H2: loose density config must not prevent ceiling — got promotionKind=${promotionKind ?? state.standingDenyProvenances["ip:weak-h2"]?.promotionKind}`,
  );

  console.log("  [pass] H2: loose density config does not push past hard ceiling");
}

// ─── H3: result.promotionKind = "hard_ceiling" is visible at ceiling fire ─────

{
  const cfg: BoundaryAdmissionConfig = {
    velocity: { maxRpm: 0, windowMs: 60_000 },
  };

  const seedState = stateWithDeniedCount("ip:weak-h3", WEAK_PROVENANCE_HARD_BLOCK_CEILING - 1, 1_000);

  let state = seedState;
  let ceilingResult: typeof import("../lib/agent-buccet/index.ts").evaluateAdmission extends
    (args: infer _A) => infer R ? R : never | undefined;
  let found = false;

  for (let i = 0; i < 5; i++) {
    const r = evaluateAdmission({
      config: cfg,
      state,
      request: makeRequest("ip:weak-h3", 2_000 + i * 100),
      nowMs: 2_000 + i * 100,
    });
    state = r.state;
    if (r.result.promoted && r.result.promotionKind === "hard_ceiling") {
      found = true;
      assert(r.result.decision === "tarpit", "H3: hard ceiling result must be tarpit");
      assert(r.result.lawId === "BOUNDARY.ADMISSION.HARD_CEILING.01", `H3: lawId must be HARD_CEILING.01 — got ${r.result.lawId}`);
      assert(r.result.promoted === true, "H3: promoted must be true");
      assert(r.result.promotionKind === "hard_ceiling", "H3: promotionKind must be hard_ceiling");
      break;
    }
    if (state.standingDenyProvenances["ip:weak-h3"]) break;
  }

  assert(found, "H3: hard ceiling must fire within 5 requests of ceiling - 1 denials and expose promotionKind");

  console.log("  [pass] H3: result.promotionKind='hard_ceiling' visible at ceiling fire with correct lawId");
}

// ─── H4: validateAdmissionConfig warns on unsafe density configs ──────────────

{
  // Window size exceeds safe envelope
  const unsafeWindowCfg: BoundaryAdmissionConfig = {
    density: { maxDenyRatio: 0.6, windowSize: DENSITY_SAFE_MAX_WINDOW_SIZE + 1 },
  };
  const warnings1 = validateAdmissionConfig(unsafeWindowCfg);
  assert(warnings1.length > 0, "H4a: oversized density window must produce warnings");
  assert(
    warnings1.some((w) => w.field === "density.windowSize"),
    "H4a: warning must reference density.windowSize",
  );

  // High deny ratio — weak-provenance scaling makes it dangerously permissive
  const unsafeRatioCfg: BoundaryAdmissionConfig = {
    density: { maxDenyRatio: 1.2, windowSize: 10 },
  };
  const warnings2 = validateAdmissionConfig(unsafeRatioCfg);
  assert(warnings2.length > 0, "H4b: unsafe deny ratio must produce warnings");
  assert(
    warnings2.some((w) => w.field === "density.maxDenyRatio"),
    "H4b: warning must reference density.maxDenyRatio",
  );

  // Safe config: no warnings
  const safeCfg: BoundaryAdmissionConfig = {
    density: { maxDenyRatio: 0.6, windowSize: 10 },
  };
  const warnings3 = validateAdmissionConfig(safeCfg);
  assert(warnings3.length === 0, "H4c: safe density config must produce no warnings");

  // No density config at all: no warnings
  const noDensityCfg: BoundaryAdmissionConfig = {
    velocity: { maxRpm: 10, windowMs: 60_000 },
  };
  const warnings4 = validateAdmissionConfig(noDensityCfg);
  assert(warnings4.length === 0, "H4d: config with no density section must produce no warnings");

  console.log(`  [pass] H4: validateAdmissionConfig warns on unsafe configs (DENSITY_SAFE_MAX_WINDOW_SIZE=${DENSITY_SAFE_MAX_WINDOW_SIZE})`);
}

// ─── H5: Tight density fires before ceiling ────────────────────────────────────
// windowSize=4, maxDenyRatio=0.5 → fires after 2 denials in a 4-request window.
// This must beat the ceiling (10 denials) by a wide margin.

{
  const tightCfg: BoundaryAdmissionConfig = {
    velocity: { maxRpm: 0, windowMs: 60_000 },
    density: { maxDenyRatio: 0.5, windowSize: 4 },
  };

  let state = initialAdmissionState();
  let promotedAt = -1;
  let promotionKind: "density" | "hard_ceiling" | undefined;

  for (let i = 0; i < WEAK_PROVENANCE_HARD_BLOCK_CEILING + 5; i++) {
    const r = evaluateAdmission({
      config: tightCfg,
      state,
      request: makeRequest("ip:weak-h5", i * 100),
      nowMs: i * 100,
    });
    state = r.state;

    if (r.result.promoted) {
      promotedAt = i;
      promotionKind = r.result.promotionKind;
      break;
    }
    if (state.standingDenyProvenances["ip:weak-h5"]) break;
  }

  assert(promotedAt !== -1, "H5: some promotion must occur with tight density config");
  assert(
    promotionKind === "density",
    `H5: tight density config must fire before ceiling — got promotionKind=${promotionKind} at i=${promotedAt}`,
  );
  assert(
    promotedAt < WEAK_PROVENANCE_HARD_BLOCK_CEILING,
    `H5: density must fire before ceiling=${WEAK_PROVENANCE_HARD_BLOCK_CEILING} — fired at ${promotedAt}`,
  );

  console.log(`  [pass] H5: tight density fires at request ${promotedAt} (before ceiling=${WEAK_PROVENANCE_HARD_BLOCK_CEILING})`);
}

// ─── H6: O(1) cache hit after ceiling promotion ────────────────────────────────

{
  const cfg: BoundaryAdmissionConfig = {
    velocity: { maxRpm: 0, windowMs: 60_000 },
  };

  const seedState = stateWithDeniedCount("ip:weak-h6", WEAK_PROVENANCE_HARD_BLOCK_CEILING - 1, 1_000);

  let state = seedState;
  for (let i = 0; i < 5; i++) {
    const r = evaluateAdmission({
      config: cfg,
      state,
      request: makeRequest("ip:weak-h6", 2_000 + i * 100),
      nowMs: 2_000 + i * 100,
    });
    state = r.state;
    if (state.standingDenyProvenances["ip:weak-h6"]) break;
  }

  assert(state.standingDenyProvenances["ip:weak-h6"] !== undefined, "H6: must be in standing deny");
  assert(
    state.standingDenyProvenances["ip:weak-h6"].promotionKind === "hard_ceiling",
    "H6: state promotionKind must be hard_ceiling",
  );

  // Next request: O(1) cache hit
  const cacheHit = evaluateAdmission({
    config: cfg,
    state,
    request: makeRequest("ip:weak-h6", 99_999),
    nowMs: 99_999,
  });

  assert(cacheHit.result.decision === "tarpit", "H6: cache hit must tarpit");
  assert(cacheHit.result.dimension === "standing_deny", "H6: cache hit dimension must be standing_deny");
  assert(cacheHit.result.promoted === false, "H6: no re-promotion on cache hit");
  assert(
    cacheHit.state.standingDenyProvenances["ip:weak-h6"]?.promotionKind === "hard_ceiling",
    "H6: promotionKind preserved in state after cache hit",
  );

  console.log("  [pass] H6: O(1) cache hit after ceiling promotion — promotionKind preserved");
}

// ─── H7: TTL eviction does not reset the ceiling counter ──────────────────────
// Simulates: IP accumulates CEILING - 1 denials, goes quiet (record TTL-expires),
// returns. The hostileDeniedCounts map must seed the new record so the ceiling
// fires on the next tarpit — not after a fresh 10 more.

{
  const cfg: BoundaryAdmissionConfig = {
    velocity: { maxRpm: 0, windowMs: 60_000 },
    // Very short provenance TTL to simulate expiry without a 5-minute wait
    provenanceTtlMs: 100,
  };

  // Accumulate CEILING - 1 tarpit decisions normally
  let state = initialAdmissionState();
  for (let i = 0; i < WEAK_PROVENANCE_HARD_BLOCK_CEILING - 1; i++) {
    const r = evaluateAdmission({
      config: cfg,
      state,
      request: makeRequest("ip:weak-h7", 1_000 + i * 200),
      nowMs: 1_000 + i * 200,
    });
    state = r.state;
    // Must not be promoted yet
    assert(
      !state.standingDenyProvenances["ip:weak-h7"],
      `H7: must not be in standing deny before ceiling (i=${i})`,
    );
  }

  // Verify hostileDeniedCounts carries the count so far
  const preTtlCount = state.hostileDeniedCounts["ip:weak-h7"] ?? 0;
  // preTtlCount may be less than CEILING - 1 because some requests were admitted
  // (velocity with weak scaling allows 1 admitted request first), but it must be > 0
  assert(preTtlCount > 0, "H7: hostileDeniedCounts must be populated before TTL eviction");

  // Now simulate TTL expiry: advance time far past provenanceTtlMs (100ms).
  // The provenanceRecord will be evicted on the next lookup, but hostileDeniedCounts must persist.
  const farFutureMs = 1_000 + (WEAK_PROVENANCE_HARD_BLOCK_CEILING - 1) * 200 + 10_000; // +10s

  // Verify: provenanceRecord would be evicted at this time (TTL=100ms, record lastSeenMs < cutoff)
  const recordAfterTtl = state.provenanceRecords["ip:weak-h7"];
  if (recordAfterTtl) {
    const ttlMs = cfg.provenanceTtlMs ?? 300_000;
    const wouldBeEvicted = recordAfterTtl.lastSeenMs < farFutureMs - ttlMs;
    assert(wouldBeEvicted, "H7: provenance record must be evictable at farFutureMs");
  }

  // Drive one more tarpit at farFutureMs — provenanceRecord evicted on lookup,
  // but hostileDeniedCounts seeds the new record's totalDeniedCount.
  // If hostileDeniedCounts + new tarpit >= CEILING, ceiling must fire.
  let ceilingFired = false;
  let stateAtExpiry = state;

  for (let i = 0; i < 5; i++) {
    const r = evaluateAdmission({
      config: cfg,
      state: stateAtExpiry,
      request: makeRequest("ip:weak-h7", farFutureMs + i * 200),
      nowMs: farFutureMs + i * 200,
    });
    stateAtExpiry = r.state;

    if (stateAtExpiry.standingDenyProvenances["ip:weak-h7"]) {
      ceilingFired = true;
      break;
    }
  }

  assert(
    ceilingFired,
    "H7: ceiling must fire after TTL expiry — hostileDeniedCounts must carry the prior count",
  );
  assert(
    stateAtExpiry.standingDenyProvenances["ip:weak-h7"]?.promotionKind === "hard_ceiling",
    "H7: promotion after TTL expiry must be hard_ceiling (not density reset)",
  );

  console.log("  [pass] H7: TTL-evicted provenance carries prior denied count via hostileDeniedCounts — ceiling still fires");
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log("\nAdmission hard-cap contract: all 7 tests passed.");
console.log(`  WEAK_PROVENANCE_HARD_BLOCK_CEILING=${WEAK_PROVENANCE_HARD_BLOCK_CEILING}`);
console.log(`  DENSITY_SAFE_MAX_WINDOW_SIZE=${DENSITY_SAFE_MAX_WINDOW_SIZE}`);
console.log(`  DEFAULT_ADMISSION_WEIGHT.standard=${DEFAULT_ADMISSION_WEIGHT["standard"]}`);
