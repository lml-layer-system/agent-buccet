import {
  DEFAULT_GOVERNOR_WEIGHT,
  createBoundaryBodyguard,
  createPersistentBoundaryRuntimeStore,
  evaluateBoundaryGovernor,
  initialGovernorState,
  recordGovernorCrossing,
} from "./../../src/index.ts";
import type {
  BoundaryActionKind,
  BoundaryGovernorConfig,
  BoundaryGovernorState,
} from "./../../src/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

// ─── Unit: evaluateBoundaryGovernor ──────────────────────────────────────────

function makeSession(_overrides?: object) {
  return {
    sessionId: `gov-test-${Date.now()}`,
    actorId: "user:governor-contract",
    createdAt: new Date().toISOString(),
    dryRun: false,
    persistent: false,
    status: "active" as const,
  };
}

function makeRequest(actionKind: BoundaryActionKind = "network.send") {
  return {
    requestId: `req-${Date.now()}-${Math.random()}`,
    sessionId: "gov-test",
    actionKind,
    target: "https://example.com",
    requestedAt: new Date().toISOString(),
    provenance: "agent_inference" as const,
  };
}

// ─── Velocity ────────────────────────────────────────────────────────────────

const velocityConfig: BoundaryGovernorConfig = {
  velocity: { maxRpm: 2, windowMs: 60_000 },
};

// First crossing — fine
const result1 = evaluateBoundaryGovernor({
  config: velocityConfig,
  state: initialGovernorState(),
  request: makeRequest(),
  nowMs: 1000,
});
assert(!result1.tripped, "first crossing should not trip velocity");

// Fill window with maxRpm crossings
let velState: BoundaryGovernorState = initialGovernorState();
velState = recordGovernorCrossing({
  state: velState,
  config: velocityConfig,
  actionKind: "network.send",
  wasLawful: true,
  nowMs: 1000,
});
velState = recordGovernorCrossing({
  state: velState,
  config: velocityConfig,
  actionKind: "network.send",
  wasLawful: true,
  nowMs: 2000,
});

// Third crossing in same window should trip
const velTrip = evaluateBoundaryGovernor({
  config: velocityConfig,
  state: velState,
  request: makeRequest(),
  nowMs: 3000,
});
assert(velTrip.tripped, "third crossing in window should trip velocity");
assert(velTrip.tripped && velTrip.dimension === "velocity", "tripped dimension should be velocity");
assert(velTrip.tripped && velTrip.lawId === "BOUNDARY.GOVERNOR.VELOCITY.01", "velocity law ID");

// After window expires, crossing is fine again
const velExpired = evaluateBoundaryGovernor({
  config: velocityConfig,
  state: velState,
  request: makeRequest(),
  nowMs: 1000 + 60_001, // window has passed for first crossing, only one remains
});
assert(!velExpired.tripped, "crossing after velocity window expires should not trip");

// ─── Density ─────────────────────────────────────────────────────────────────

const densityConfig: BoundaryGovernorConfig = {
  density: { maxFailureRatio: 0.6, windowSize: 5 },
};

let densState: BoundaryGovernorState = initialGovernorState();
// 3 denied + 2 allowed in window = 60% denied = exactly at threshold = should trip
densState = recordGovernorCrossing({
  state: densState,
  config: densityConfig,
  actionKind: "fs.read",
  wasLawful: false,
  nowMs: 1,
});
densState = recordGovernorCrossing({
  state: densState,
  config: densityConfig,
  actionKind: "fs.read",
  wasLawful: false,
  nowMs: 2,
});
densState = recordGovernorCrossing({
  state: densState,
  config: densityConfig,
  actionKind: "fs.read",
  wasLawful: false,
  nowMs: 3,
});
densState = recordGovernorCrossing({
  state: densState,
  config: densityConfig,
  actionKind: "fs.read",
  wasLawful: true,
  nowMs: 4,
});
densState = recordGovernorCrossing({
  state: densState,
  config: densityConfig,
  actionKind: "fs.read",
  wasLawful: true,
  nowMs: 5,
});

const densTrip = evaluateBoundaryGovernor({
  config: densityConfig,
  state: densState,
  request: makeRequest("fs.read"),
  nowMs: 6,
});
assert(densTrip.tripped, "60% denial ratio in window should trip density");
assert(densTrip.tripped && densTrip.dimension === "density", "tripped dimension should be density");
assert(densTrip.tripped && densTrip.lawId === "BOUNDARY.GOVERNOR.DENSITY.01", "density law ID");

// All lawful — no trip
let cleanDensState: BoundaryGovernorState = initialGovernorState();
for (let i = 0; i < 10; i++) {
  cleanDensState = recordGovernorCrossing({
    state: cleanDensState,
    config: densityConfig,
    actionKind: "fs.read",
    wasLawful: true,
    nowMs: i,
  });
}
const densNoTrip = evaluateBoundaryGovernor({
  config: densityConfig,
  state: cleanDensState,
  request: makeRequest("fs.read"),
  nowMs: 11,
});
assert(!densNoTrip.tripped, "all-lawful history should not trip density");

// ─── Mass ─────────────────────────────────────────────────────────────────────

const massConfig: BoundaryGovernorConfig = {
  mass: { maxCrossings: 15 },
};

// tool.exec has weight 10 — first one is fine (0 + 10 = 10 ≤ 15)
const massResult1 = evaluateBoundaryGovernor({
  config: massConfig,
  state: initialGovernorState(),
  request: makeRequest("tool.exec"),
  nowMs: 1,
});
assert(!massResult1.tripped, "first tool.exec should not trip mass (weight 10 ≤ 15)");

// After recording first tool.exec (weight=10), second tool.exec (weight=10) would push to 20 > 15
let massState = initialGovernorState();
massState = recordGovernorCrossing({
  state: massState,
  config: massConfig,
  actionKind: "tool.exec",
  wasLawful: true,
  nowMs: 1,
});

const massTrip = evaluateBoundaryGovernor({
  config: massConfig,
  state: massState,
  request: makeRequest("tool.exec"),
  nowMs: 2,
});
assert(massTrip.tripped, "second tool.exec should trip mass (10 + 10 = 20 > 15)");
assert(massTrip.tripped && massTrip.dimension === "mass", "tripped dimension should be mass");
assert(massTrip.tripped && massTrip.lawId === "BOUNDARY.GOVERNOR.MASS.01", "mass law ID");

// fs.read has weight 1 — many reads stay under ceiling
let massReadState = initialGovernorState();
for (let i = 0; i < 14; i++) {
  massReadState = recordGovernorCrossing({
    state: massReadState,
    config: massConfig,
    actionKind: "fs.read",
    wasLawful: true,
    nowMs: i,
  });
}
const massReadResult = evaluateBoundaryGovernor({
  config: massConfig,
  state: massReadState,
  request: makeRequest("fs.read"),
  nowMs: 15,
});
assert(
  !massReadResult.tripped,
  "14 fs.read crossings + one more (weight 1 each, 14 + 1 = 15 = max) should not trip",
);

// ─── Weight table ─────────────────────────────────────────────────────────────

assert(DEFAULT_GOVERNOR_WEIGHT["tool.exec"] === 10, "tool.exec should have weight 10");
assert(DEFAULT_GOVERNOR_WEIGHT["fs.delete"] === 8, "fs.delete should have weight 8");
assert(DEFAULT_GOVERNOR_WEIGHT["fs.read"] === 1, "fs.read should have weight 1");

// ─── No config — governor is inactive ────────────────────────────────────────

const noConfig: BoundaryGovernorConfig = {};
const noConfigResult = evaluateBoundaryGovernor({
  config: noConfig,
  state: initialGovernorState(),
  request: makeRequest("tool.exec"),
  nowMs: 1,
});
assert(!noConfigResult.tripped, "empty governor config should never trip");

// ─── Integration: governor trips via createBoundaryBodyguard ─────────────────
// The governor pre-check fires before adjudication. We pre-seed the governor state with one
// crossing already recorded in the window so the very first enforceProposal call trips the
// velocity law immediately — before the action reaches gravity or the approval queue.

async function runIntegration() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionId = `agent-buccet-governor-${runId}`;
  const actorId = "user:governor-contract";

  const store = await createPersistentBoundaryRuntimeStore({ sessionId, actorId });
  await store.openPath({
    rootPath: "/",
    grantedActions: ["network.send"],
    issuedBy: actorId,
  });

  // Pre-seed: velocity window already has 1 crossing (maxRpm=1), so the first
  // enforceProposal will trip BOUNDARY.GOVERNOR.VELOCITY.01 before adjudication.
  const nowMs = Date.now();
  const seededState: BoundaryGovernorState = {
    crossingTimestamps: [nowMs - 1000], // 1s ago, well within 60s window
    totalWeightedCrossings: 5, // network.send weight=5 from the seeded crossing
    recentDecisions: [false], // the seeded crossing was denied
  };
  store.replaceConfig({
    ...store.getConfig(),
    governorConfig: { velocity: { maxRpm: 1, windowMs: 60_000 } },
    governorState: seededState,
    approvalHandler: async () => ({ choice: "deny_once" }),
  });

  const bodyguard = createBoundaryBodyguard(store);

  // First enforceProposal: governor pre-check finds 1 crossing in window >= maxRpm 1.
  // The action is held for approval. The contract auto-denies that approval so
  // the result remains blocked without hanging the approval queue.
  const result = await bodyguard.enforceProposal({
    actionKind: "network.send",
    target: "https://api.example.com/submit",
    successReason: "network send admitted",
  });

  assert(!result.allowed, "governor velocity trip should block the action");
  assert(!result.executed, "governor-held action should not execute");
  assert(result.requiresApproval, "governor trip should surface through approval");
  assert(
    result.bodyguardMoves.some((m) => m.kind === "deny_and_explain"),
    "governor trip should produce deny_and_explain move",
  );

  // After a governor trip, governor state is NOT updated (the crossing was never admitted).
  // The seeded state is preserved.
  const govStateAfterTrip = store.getConfig().governorState;
  assert(govStateAfterTrip !== undefined, "governor state should still be set after trip");
  assert(
    (govStateAfterTrip?.totalWeightedCrossings ?? 0) === 5,
    "totalWeightedCrossings should remain 5 (not incremented on governor trip)",
  );

  return { result, govStateAfterTrip };
}

const integration = await runIntegration();

console.log("Agent Buccet governor contract");
console.log(`velocity trip at crossing 3: ${velTrip.tripped}`);
console.log(`density trip at 60% failure: ${densTrip.tripped}`);
console.log(`mass trip at second tool.exec (weight 10): ${massTrip.tripped}`);
console.log(`empty config no trip: ${!noConfigResult.tripped}`);
console.log(
  `integration: governor velocity trip held for approval: ${!integration.result.allowed && integration.result.requiresApproval}`,
);
console.log(
  `integration: governor state preserved after trip: ${integration.govStateAfterTrip?.totalWeightedCrossings === 5}`,
);
