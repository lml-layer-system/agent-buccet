/**
 * Agent Buccet — Input Admission Boundary Contract
 *
 * Verifies the Grand Canyon model:
 * A. Hostile inputs are denied by law (normal path)
 * B. Density law detects pathological provenance
 * C. Standing deny is written to state (ledgered once by caller)
 * D. Future traffic from that provenance hits the O(1) cache — no adjudication
 * E. Normal provenances are not caught
 * F. Velocity, mass, and LRU eviction work correctly
 * G. Provenance strength scales thresholds (weak = tighter)
 */

import {
  DEFAULT_ADMISSION_WEIGHT,
  evaluateAdmission,
  getInputWeight,
  initialAdmissionState,
  markStandingDenyLedgered,
} from "../lib/agent-buccet/index.ts";
import type {
  BoundaryAdmissionConfig,
  BoundaryAdmissionState,
  BoundaryInputRequest,
} from "../lib/agent-buccet/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function makeRequest(
  provenance: string,
  overrides?: Partial<BoundaryInputRequest>,
): BoundaryInputRequest {
  return {
    requestId: `req-${Date.now()}-${Math.random()}`,
    provenance,
    provenanceStrength: "medium",
    weightClass: "standard",
    receivedAtMs: Date.now(),
    ...overrides,
  };
}

// ─── Unit: weight table ────────────────────────────────────────────────────────

assert(DEFAULT_ADMISSION_WEIGHT["standard"] === 1, "standard weight=1");
assert(DEFAULT_ADMISSION_WEIGHT["large_prompt"] === 4, "large_prompt weight=4");
assert(DEFAULT_ADMISSION_WEIGHT["attachment"] === 6, "attachment weight=6");
assert(DEFAULT_ADMISSION_WEIGHT["retrieval_request"] === 5, "retrieval_request weight=5");
assert(DEFAULT_ADMISSION_WEIGHT["fanout_request"] === 8, "fanout_request weight=8");
assert(getInputWeight("standard") === 1, "getInputWeight standard=1");
assert(getInputWeight("fanout_request") === 8, "getInputWeight fanout=8");
assert(getInputWeight("standard", { standard: 3 }) === 3, "custom weight override");

// ─── Unit: velocity ───────────────────────────────────────────────────────────

const velocityConfig: BoundaryAdmissionConfig = {
  velocity: { maxRpm: 2, windowMs: 60_000 },
};

let vState = initialAdmissionState();
const now1 = 1_000;

// Two requests admitted (below maxRpm=2 per 60s window)
const v1 = evaluateAdmission({ config: velocityConfig, state: vState, request: makeRequest("ip:1.2.3.4", { receivedAtMs: now1 }), nowMs: now1 });
assert(v1.result.decision === "admit", "first request admitted (velocity)");
vState = v1.state;

const v2 = evaluateAdmission({ config: velocityConfig, state: vState, request: makeRequest("ip:1.2.3.4", { receivedAtMs: now1 + 100 }), nowMs: now1 + 100 });
assert(v2.result.decision === "admit", "second request admitted (velocity)");
vState = v2.state;

// Third request in same window trips velocity
const v3 = evaluateAdmission({ config: velocityConfig, state: vState, request: makeRequest("ip:1.2.3.4", { receivedAtMs: now1 + 200 }), nowMs: now1 + 200 });
assert(v3.result.decision === "tarpit", "third request tarpitted (velocity trip)");
assert(v3.result.dimension === "velocity", "dimension=velocity");
assert(v3.result.lawId === "BOUNDARY.ADMISSION.VELOCITY.01", "velocity law ID");
vState = v3.state;

// After window expires, request is admitted again
const v4 = evaluateAdmission({ config: velocityConfig, state: vState, request: makeRequest("ip:1.2.3.4", { receivedAtMs: now1 + 61_001 }), nowMs: now1 + 61_001 });
assert(v4.result.decision === "admit", "request after window expiry admitted");

// Different provenance is not affected
const v5 = evaluateAdmission({ config: velocityConfig, state: vState, request: makeRequest("ip:9.9.9.9", { receivedAtMs: now1 + 300 }), nowMs: now1 + 300 });
assert(v5.result.decision === "admit", "different provenance not affected by other's velocity trip");

// ─── Unit: velocity threshold scales with provenance strength ─────────────────

// weak provenance gets half the threshold → maxPerWindow = ceil(2 * 60000 / 60000 / 2) = 1
let weakState = initialAdmissionState();
const w1 = evaluateAdmission({ config: velocityConfig, state: weakState, request: makeRequest("ip:weak", { provenanceStrength: "weak", receivedAtMs: 1000 }), nowMs: 1000 });
assert(w1.result.decision === "admit", "first weak-provenance request admitted");
weakState = w1.state;

const w2 = evaluateAdmission({ config: velocityConfig, state: weakState, request: makeRequest("ip:weak", { provenanceStrength: "weak", receivedAtMs: 2000 }), nowMs: 2000 });
assert(w2.result.decision === "tarpit", "second weak-provenance request tarpitted (tighter threshold)");

// strong provenance gets double threshold → maxPerWindow = ceil(4 * 60000 / 60000) = 4
let strongState = initialAdmissionState();
for (let i = 0; i < 4; i++) {
  const r = evaluateAdmission({ config: velocityConfig, state: strongState, request: makeRequest("pubkey:abc", { provenanceStrength: "strong", receivedAtMs: i * 100 }), nowMs: i * 100 });
  assert(r.result.decision === "admit", `strong provenance request ${i + 1} admitted`);
  strongState = r.state;
}
const s5 = evaluateAdmission({ config: velocityConfig, state: strongState, request: makeRequest("pubkey:abc", { provenanceStrength: "strong", receivedAtMs: 500 }), nowMs: 500 });
assert(s5.result.decision === "tarpit", "fifth strong-provenance request tarpitted (4x threshold)");

// ─── Unit: density → standing deny promotion ──────────────────────────────────

const densityConfig: BoundaryAdmissionConfig = {
  density: { maxDenyRatio: 0.6, windowSize: 5 },
};

let dState = initialAdmissionState();
// Simulate: 3 denied + 2 admitted in last 5 = 60% denied = trips density
// We feed the decisions via the recentDecisions field manually through recordAdmission.
// Actually we need to drive it through evaluateAdmission. Let us pre-populate state.
// Pre-populate a provenance with 3 denied and 2 admitted decisions in its record.
dState = {
  standingDenyProvenances: {},
  provenanceRecords: {
    "session:attacker": {
      requestTimestamps: [1, 2, 3, 4, 5],
      recentDecisions: [false, false, false, true, true], // 3 denied, 2 admitted = 60%
      totalInboundWeight: 5,
      windowWeightTimestamps: [],
      lastSeenMs: 5,
    },
  },
};

const d1 = evaluateAdmission({ config: densityConfig, state: dState, request: makeRequest("session:attacker", { receivedAtMs: 6 }), nowMs: 6 });
assert(d1.result.decision === "tarpit", "density trip: 60% denial ratio in window");
assert(d1.result.dimension === "density", "dimension=density");
assert(d1.result.lawId === "BOUNDARY.ADMISSION.DENSITY.01", "density law ID");
assert(d1.result.promoted === true, "density trip promotes to standing deny");
dState = d1.state;

// Provenance is now in standing deny
assert(dState.standingDenyProvenances["session:attacker"] !== undefined, "provenance in standing deny after promotion");
assert(dState.standingDenyProvenances["session:attacker"].ledgered === false, "ledgered=false until caller marks it");

// Caller marks it ledgered (simulates async ledger write completion)
dState = markStandingDenyLedgered(dState, "session:attacker");
assert(dState.standingDenyProvenances["session:attacker"].ledgered === true, "ledgered=true after markStandingDenyLedgered");

// ─── Unit: O(1) standing-deny cache hit ──────────────────────────────────────

// After promotion, subsequent requests hit the O(1) cache — no density evaluation
const d2 = evaluateAdmission({ config: densityConfig, state: dState, request: makeRequest("session:attacker", { receivedAtMs: 100 }), nowMs: 100 });
assert(d2.result.decision === "tarpit", "standing deny cache hit → tarpit");
assert(d2.result.dimension === "standing_deny", "dimension=standing_deny (cache hit, not density)");
assert(d2.result.promoted === false, "no re-promotion on cache hit");

// Exact same state returned — the cache hit is O(1), does not update records
assert(
  d2.state.standingDenyProvenances["session:attacker"]?.ledgered === true,
  "ledgered state preserved through cache hit",
);

// ─── Unit: mass ───────────────────────────────────────────────────────────────

const massConfig: BoundaryAdmissionConfig = {
  mass: { maxInboundWeight: 10, windowMs: 60_000 },
};

let mState = initialAdmissionState();
// fanout_request weight=8 — one admitted (8 ≤ 10)
const m1 = evaluateAdmission({ config: massConfig, state: mState, request: makeRequest("session:heavy", { weightClass: "fanout_request", receivedAtMs: 1000 }), nowMs: 1000 });
assert(m1.result.decision === "admit", "first fanout request admitted (weight 8 ≤ 10)");
mState = m1.state;

// Second fanout (weight 8) would push to 16 > 10 → mass trip
const m2 = evaluateAdmission({ config: massConfig, state: mState, request: makeRequest("session:heavy", { weightClass: "fanout_request", receivedAtMs: 2000 }), nowMs: 2000 });
assert(m2.result.decision === "tarpit", "second fanout tarpitted (cumulative weight > 10)");
assert(m2.result.dimension === "mass", "dimension=mass");
assert(m2.result.lawId === "BOUNDARY.ADMISSION.MASS.01", "mass law ID");

// standard requests (weight 1) — many fit under ceiling
let mLightState = initialAdmissionState();
for (let i = 0; i < 10; i++) {
  const r = evaluateAdmission({ config: massConfig, state: mLightState, request: makeRequest("session:light", { weightClass: "standard", receivedAtMs: i * 100 }), nowMs: i * 100 });
  assert(r.result.decision === "admit", `standard request ${i + 1} admitted`);
  mLightState = r.state;
}
// 11th standard (weight 1) would push to 11 > 10 → mass trip
const m11 = evaluateAdmission({ config: massConfig, state: mLightState, request: makeRequest("session:light", { weightClass: "standard", receivedAtMs: 1100 }), nowMs: 1100 });
assert(m11.result.decision === "tarpit", "11th standard request tarpitted (cumulative 11 > 10)");

// ─── Unit: no config — admission is inactive ──────────────────────────────────

const r = evaluateAdmission({ config: {}, state: initialAdmissionState(), request: makeRequest("ip:whatever"), nowMs: 1 });
assert(r.result.decision === "admit", "empty config — admission always admits");

// ─── Unit: LRU eviction — bounded provenance tracking ────────────────────────

const lruConfig: BoundaryAdmissionConfig = {
  velocity: { maxRpm: 100, windowMs: 60_000 },
  provenanceMaxSize: 3,    // tiny max for test
  provenanceTtlMs: 1_000,  // 1s TTL
};

let lruState = initialAdmissionState();
// Add 3 provenances at t=0
for (let i = 0; i < 3; i++) {
  const r2 = evaluateAdmission({ config: lruConfig, state: lruState, request: makeRequest(`ip:${i}`, { receivedAtMs: 0 }), nowMs: 0 });
  lruState = r2.state;
}
assert(Object.keys(lruState.provenanceRecords).length === 3, "3 provenances tracked");

// At t=2000 (past TTL of 1s), adding a 4th causes eviction of stale entries
const lru4 = evaluateAdmission({ config: lruConfig, state: lruState, request: makeRequest("ip:new", { receivedAtMs: 2000 }), nowMs: 2000 });
lruState = lru4.state;
// All 3 old entries are TTL-evicted; only "ip:new" remains
assert(
  lruState.provenanceRecords["ip:new"] !== undefined,
  "new provenance tracked after LRU eviction",
);
assert(
  lruState.provenanceRecords["ip:0"] === undefined,
  "old provenance evicted by TTL",
);

console.log("Agent Buccet admission contract");
console.log(`weight table: standard=${DEFAULT_ADMISSION_WEIGHT["standard"]}, fanout=${DEFAULT_ADMISSION_WEIGHT["fanout_request"]}`);
console.log(`velocity trip at 3rd request (maxRpm=2): ${v3.result.decision === "tarpit"}`);
console.log(`weak provenance threshold halved (trip at 2nd): ${w2.result.decision === "tarpit"}`);
console.log(`strong provenance threshold doubled (trip at 5th): ${s5.result.decision === "tarpit"}`);
console.log(`density trip at 60% ratio → promoted: ${d1.result.promoted}`);
console.log(`O(1) cache hit after promotion: ${d2.result.dimension === "standing_deny"}`);
console.log(`mass trip (fanout weight 8, ceiling 10): ${m2.result.decision === "tarpit"}`);
console.log(`empty config always admits: ${r.result.decision === "admit"}`);
console.log(`LRU eviction (TTL=1s): ip:0 evicted=${lruState.provenanceRecords["ip:0"] === undefined}`);
