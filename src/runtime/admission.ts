/**
 * Input Admission Boundary — same Agent Buccet doctrine applied inward.
 *
 * Outbound: protect the world from agent force.
 * Inbound: protect the agent/system from hostile inbound force.
 *
 * Same laws. Same fail-closed behavior. Same ledger authority.
 * The brain must never be the thing that filters attacks whose purpose is to wake the brain.
 *
 * Architecture:
 * - O(1) canyon cache check (hot path, no I/O)
 * - Bounded provenance density tracking (LRU eviction + TTL)
 * - Velocity / Density / Mass laws for inbound traffic
 * - Exactly-once ledger write per canyon promotion (caller responsibility)
 * - Tarpit decision: hold socket, return nothing — do NOT return fast 403/429
 */

import type {
  BoundaryAdmissionConfig,
  BoundaryAdmissionState,
  BoundaryInputWeightClass,
  BoundaryProvenanceRecord,
  BoundaryProvenanceStrength,
} from "./types.ts";

// ─── Default weights ──────────────────────────────────────────────────────────
// Not all inputs cost the same. Large prompt bodies, attachments, retrieval
// triggers, and fanout triggers carry higher inbound weight.

export const DEFAULT_ADMISSION_WEIGHT: Record<BoundaryInputWeightClass, number> = {
  standard: 1,
  large_prompt: 4,
  attachment: 6,
  retrieval_request: 5,
  fanout_request: 8,
};

export const DEFAULT_ADMISSION_CONFIG: BoundaryAdmissionConfig = {
  velocity: { maxRpm: 60, windowMs: 60_000 },
  density: { maxDenyRatio: 0.6, windowSize: 5 },
  mass: { maxInboundWeight: 120, windowMs: 60_000 },
};

export function getInputWeight(
  weightClass: BoundaryInputWeightClass,
  weight?: Partial<Record<BoundaryInputWeightClass, number>>,
): number {
  return (weight ?? DEFAULT_ADMISSION_WEIGHT)[weightClass] ?? DEFAULT_ADMISSION_WEIGHT.standard;
}

// ─── Input request descriptor ─────────────────────────────────────────────────

export type BoundaryInputRequest = {
  requestId: string;
  /** Provenance key — strongest available: pubkey > session > IP. */
  provenance: string;
  /** Strength of evidence backing this provenance. Weaker = tighter thresholds. */
  provenanceStrength: BoundaryProvenanceStrength;
  /** Weight class of the inbound payload. */
  weightClass: BoundaryInputWeightClass;
  receivedAtMs: number;
};

// ─── Hard block ceiling ───────────────────────────────────────────────────────
// Safety floor for weak-strength provenances (IP-based).
//
// A weak provenance CANNOT accumulate more than WEAK_PROVENANCE_HARD_BLOCK_CEILING
// tarpit decisions before being forced into canyon hold — regardless of density
// window size or ratio configuration.
//
// Density config may make promotion happen SOONER (stricter = faster), but it
// can NEVER push promotion LATER than WEAK_PROVENANCE_HARD_BLOCK_CEILING.
// This ceiling is not a tuning knob. It is a structural safety floor.
//
// Unsafe density configs (windowSize such that signal threshold > ceiling) are
// caught by validateAdmissionConfig() and surface startup and ledger warnings.

export const WEAK_PROVENANCE_HARD_BLOCK_CEILING = 10;

// Safe density config envelope: density.windowSize should be ≤ this so that
// the density signal threshold (ceil(windowSize/2)) does not exceed the hard ceiling.
export const DENSITY_SAFE_MAX_WINDOW_SIZE = WEAK_PROVENANCE_HARD_BLOCK_CEILING * 2; // 20

// ─── Admission result ─────────────────────────────────────────────────────────

export type BoundaryAdmissionDecision = "admit" | "tarpit";

export type BoundaryAdmissionResult = {
  decision: BoundaryAdmissionDecision;
  reason: string;
  dimension?: "velocity" | "density" | "mass" | "canyon";
  lawId?: string;
  /** True when this evaluation caused canyon promotion. Caller must write ledger once. */
  promoted: boolean;
  /** How promotion was triggered — only set when promoted=true.
   *  "hard_ceiling": density config was too loose; hard block ceiling fired.
   *  "density": normal density threshold promotion. */
  promotionKind?: "density" | "hard_ceiling";
};

// ─── Config validation ────────────────────────────────────────────────────────

export type AdmissionConfigWarning = {
  severity: "error" | "warning";
  field: string;
  message: string;
};

/**
 * Validate an admission config against the safety envelope.
 *
 * Returns warnings when density config would allow weak provenances to accumulate
 * more blocks than WEAK_PROVENANCE_HARD_BLOCK_CEILING before density fires.
 * The hard ceiling still applies — these are warnings about config drift, not
 * about the ceiling being breached (the ceiling cannot be breached by config).
 */
export function validateAdmissionConfig(config: BoundaryAdmissionConfig): AdmissionConfigWarning[] {
  const warnings: AdmissionConfigWarning[] = [];

  if (config.density) {
    const windowSize = config.density.windowSize ?? 20;
    const signalThreshold = Math.ceil(windowSize / 2);

    if (signalThreshold > WEAK_PROVENANCE_HARD_BLOCK_CEILING) {
      warnings.push({
        severity: "warning",
        field: "density.windowSize",
        message:
          `density.windowSize=${windowSize} → signal threshold=${signalThreshold} decisions — ` +
          `exceeds WEAK_PROVENANCE_HARD_BLOCK_CEILING=${WEAK_PROVENANCE_HARD_BLOCK_CEILING}. ` +
          `Weak provenances will hit the hard ceiling before density fires. ` +
          `Density window is effectively inert for weak provenance. ` +
          `Reduce windowSize to ≤${DENSITY_SAFE_MAX_WINDOW_SIZE} to keep density inside the safety envelope.`,
      });
    }

    const weakMaxRatio = config.density.maxDenyRatio / 2; // weak provenance scaling in evaluateAdmission
    if (weakMaxRatio > 0.5) {
      warnings.push({
        severity: "warning",
        field: "density.maxDenyRatio",
        message:
          `density.maxDenyRatio=${config.density.maxDenyRatio} → weak provenance threshold=${weakMaxRatio.toFixed(2)}. ` +
          `Requires >${Math.round(weakMaxRatio * 100)}% deny ratio before density promotion. ` +
          `Hostile weak provenances can accumulate up to ${windowSize} tarpit decisions before density fires. ` +
          `Hard ceiling applies at ${WEAK_PROVENANCE_HARD_BLOCK_CEILING} — density is bypassed above that.`,
      });
    }
  }

  return warnings;
}

// ─── State initialization ─────────────────────────────────────────────────────

export function initialAdmissionState(): BoundaryAdmissionState {
  return {
    canyonProvenances: {},
    allowOnceProvenances: {},
    denyOnceProvenances: {},
    allowedProvenances: {},
    provenanceRecords: {},
    hostileDeniedCounts: {},
  };
}

function normalizeAdmissionState(state: BoundaryAdmissionState): BoundaryAdmissionState {
  return {
    canyonProvenances: state.canyonProvenances ?? {},
    allowOnceProvenances: state.allowOnceProvenances ?? {},
    denyOnceProvenances: state.denyOnceProvenances ?? {},
    allowedProvenances: state.allowedProvenances ?? {},
    provenanceRecords: state.provenanceRecords ?? {},
    hostileDeniedCounts: state.hostileDeniedCounts ?? {},
  };
}

function trimTimedOverrideMap<T extends { grantedAt: number }>(
  entries: Record<string, T>,
  maxSize: number,
): Record<string, T> {
  const keys = Object.keys(entries);
  if (keys.length <= maxSize) return entries;
  const sorted = keys.sort((left, right) => entries[right].grantedAt - entries[left].grantedAt);
  const kept: Record<string, T> = {};
  for (const key of sorted.slice(0, maxSize)) {
    kept[key] = entries[key];
  }
  return kept;
}

function trimCanyonProvenances(
  entries: BoundaryAdmissionState["canyonProvenances"],
  maxSize: number,
): BoundaryAdmissionState["canyonProvenances"] {
  const keys = Object.keys(entries);
  if (keys.length <= maxSize) return entries;
  const sorted = keys.sort((left, right) => {
    const leftPinned = entries[left].operatorDisposition === "deny_as_law" ? 1 : 0;
    const rightPinned = entries[right].operatorDisposition === "deny_as_law" ? 1 : 0;
    if (leftPinned !== rightPinned) {
      return leftPinned - rightPinned;
    }
    return entries[left].canyonedAt - entries[right].canyonedAt;
  });
  const next = { ...entries };
  for (let index = 0; index < sorted.length - maxSize; index += 1) {
    delete next[sorted[index]];
  }
  return next;
}

function emptyProvenanceRecord(nowMs: number): BoundaryProvenanceRecord {
  return {
    requestTimestamps: [],
    recentDecisions: [],
    totalDeniedCount: 0,
    totalInboundWeight: 0,
    windowWeightTimestamps: [],
    lastSeenMs: nowMs,
  };
}

// ─── LRU/TTL eviction ─────────────────────────────────────────────────────────
// Prevents unbounded growth from attacker-sprayed fake provenances.
// Called inside evaluateAdmission before inserting a new provenance record.

function evictProvenanceRecords(
  records: Record<string, BoundaryProvenanceRecord>,
  maxSize: number,
  ttlMs: number,
  nowMs: number,
): Record<string, BoundaryProvenanceRecord> {
  const result: Record<string, BoundaryProvenanceRecord> = {};
  const cutoff = nowMs - ttlMs;

  // Pass 1: drop expired entries (TTL)
  for (const [key, rec] of Object.entries(records)) {
    if (rec.lastSeenMs >= cutoff) {
      result[key] = rec;
    }
  }

  // Pass 2: if still over max, evict oldest by lastSeenMs (LRU)
  const keys = Object.keys(result);
  if (keys.length < maxSize) {
    return result;
  }
  const sorted = keys.sort((a, b) => result[a].lastSeenMs - result[b].lastSeenMs);
  const evictCount = sorted.length - maxSize + 1; // +1 to make room for new entry
  for (let i = 0; i < evictCount; i++) {
    delete result[sorted[i]];
  }
  return result;
}

// ─── Hostile denied count eviction ────────────────────────────────────────────
// hostileDeniedCounts is NOT TTL-evicted — an IP that goes quiet and returns must
// still carry its prior tarpit count toward the ceiling.
// Size eviction uses a count-ascending sort: evict lowest-count entries first,
// keeping the most hostile provenances (closest to or at the ceiling).

function evictHostileDeniedCounts(
  counts: Record<string, number>,
  maxSize: number,
): Record<string, number> {
  const keys = Object.keys(counts);
  if (keys.length <= maxSize) return counts;
  // Keep highest-count entries — they're the most dangerous
  const sorted = keys.sort((a, b) => counts[a] - counts[b]);
  const result: Record<string, number> = {};
  for (let i = sorted.length - maxSize; i < sorted.length; i++) {
    result[sorted[i]] = counts[sorted[i]];
  }
  return result;
}

// ─── Threshold scaling by provenance strength ─────────────────────────────────
// Weaker provenance (IP) gets tighter thresholds — harder to establish trust,
// easier to be denied. Stronger provenance (pubkey) gets headroom.

function scaleThreshold(base: number, strength: BoundaryProvenanceStrength): number {
  switch (strength) {
    case "strong": return base * 2;     // pubkey / signed identity: double headroom
    case "medium": return base;         // session identity: no scaling
    case "weak":   return Math.max(1, Math.ceil(base * 0.5)); // IP: half threshold
  }
}

// ─── Core evaluation (pure, synchronous) ─────────────────────────────────────
// Returns { result, state } — state already updated with the new record.
// If result.promoted === true, caller must write INGRESS_CANYON_STATE_WRITTEN
// to the ledger exactly once (check canyonProvenances[provenance].ledgered).

export function evaluateAdmission(args: {
  config: BoundaryAdmissionConfig;
  state: BoundaryAdmissionState;
  request: BoundaryInputRequest;
  nowMs: number;
}): { result: BoundaryAdmissionResult; state: BoundaryAdmissionState } {
  const { config, request, nowMs } = args;
  const { provenance, provenanceStrength, weightClass } = request;
  let state = normalizeAdmissionState(args.state);
  const maxSize = config.provenanceMaxSize ?? 10_000;

  // ── Step 1: operator ingress overrides + O(1) canyon cache ───────────────
  const denyOnceOverride = state.denyOnceProvenances[provenance];
  if (denyOnceOverride && denyOnceOverride.remaining > 0) {
    const nextDenyOnce = { ...state.denyOnceProvenances };
    if (denyOnceOverride.remaining <= 1) {
      delete nextDenyOnce[provenance];
    } else {
      nextDenyOnce[provenance] = {
        ...denyOnceOverride,
        remaining: denyOnceOverride.remaining - 1,
      };
    }
    return {
      result: {
        decision: "tarpit",
        reason: denyOnceOverride.reason,
        dimension: "canyon",
        lawId: "BOUNDARY.ADMISSION.CANYON.01",
        promoted: false,
      },
      state: {
        ...state,
        denyOnceProvenances: nextDenyOnce,
      },
    };
  }

  const onceOverride = state.allowOnceProvenances[provenance];
  if (onceOverride && onceOverride.remaining > 0) {
    const nextAllowOnce = { ...state.allowOnceProvenances };
    if (onceOverride.remaining <= 1) {
      delete nextAllowOnce[provenance];
    } else {
      nextAllowOnce[provenance] = {
        ...onceOverride,
        remaining: onceOverride.remaining - 1,
      };
    }
    return {
      result: {
        decision: "admit",
        reason: `provenance ${provenance} released from canyon once by Terminal 2`,
        promoted: false,
      },
      state: {
        ...state,
        allowOnceProvenances: nextAllowOnce,
      },
    };
  }

  if (state.allowedProvenances[provenance]) {
    return {
      result: {
        decision: "admit",
        reason: `provenance ${provenance} is standing-allowed by Terminal 2`,
        promoted: false,
      },
      state,
    };
  }

  if (state.canyonProvenances[provenance]) {
    return {
      result: {
        decision: "tarpit",
        reason: `provenance ${provenance} is canyon-held — tarpitting without response`,
        dimension: "canyon",
        lawId: "BOUNDARY.ADMISSION.CANYON.01",
        promoted: false,
      },
      state,
    };
  }

  // ── Step 2: Eviction + record lookup ─────────────────────────────────────
  const ttlMs = config.provenanceTtlMs ?? 300_000; // 5 min default

  let records = state.provenanceRecords;
  if (!records[provenance]) {
    records = evictProvenanceRecords(records, maxSize, ttlMs, nowMs);
  }

  // Seed totalDeniedCount from hostileDeniedCounts when the provenanceRecord is absent
  // (new IP or TTL-evicted). This is the TTL-churn fix: an IP that goes quiet long enough
  // for its record to expire returns carrying its prior tarpit count — the ceiling cannot
  // be reset by pacing attacks below the provenanceTtlMs interval.
  const rawExisting = records[provenance];
  const historicalCount = state.hostileDeniedCounts[provenance] ?? 0;
  const existing: BoundaryProvenanceRecord = rawExisting
    ? (rawExisting.totalDeniedCount < historicalCount
        ? { ...rawExisting, totalDeniedCount: historicalCount }
        : rawExisting)
    : { ...emptyProvenanceRecord(nowMs), totalDeniedCount: historicalCount };
  const weight = getInputWeight(weightClass, config.weight);

  // ── Step 2.5: Hard block ceiling for weak provenance ─────────────────────
  // Safety floor — fires before velocity/density/mass and cannot be disabled
  // or loosened by density config. Density can promote sooner; it cannot push
  // promotion past WEAK_PROVENANCE_HARD_BLOCK_CEILING for weak provenances.
  if (provenanceStrength === "weak" && existing.totalDeniedCount >= WEAK_PROVENANCE_HARD_BLOCK_CEILING) {
    const promoted = promoteIfNew(state, provenance, "hard_ceiling");
    const nextState = buildUpdatedState(state, records, provenance, existing, weight, nowMs, false, promoted, maxSize);
    return {
      result: {
        decision: "tarpit",
        reason: `hard block ceiling: weak provenance has accumulated ${existing.totalDeniedCount} blocks (ceiling=${WEAK_PROVENANCE_HARD_BLOCK_CEILING}) — density config cannot override`,
        dimension: "density",
        lawId: "BOUNDARY.ADMISSION.HARD_CEILING.01",
        promoted: promoted.isNew,
        promotionKind: "hard_ceiling",
      },
      state: nextState,
    };
  }

  // ── Step 3: Velocity check ────────────────────────────────────────────────
  if (config.velocity) {
    const windowMs = config.velocity.windowMs ?? 60_000;
    const windowStart = nowMs - windowMs;
    const inWindow = existing.requestTimestamps.filter((t) => t >= windowStart).length;
    const maxRpm = scaleThreshold(config.velocity.maxRpm, provenanceStrength);
    const maxPerWindow = Math.ceil((maxRpm * windowMs) / 60_000);

    if (inWindow >= maxPerWindow) {
      // Density check: has this provenance crossed the deny threshold?
      const promoted = promoteIfDensityTripped(state, config, existing, provenance);
      const nextState = buildUpdatedState(state, records, provenance, existing, weight, nowMs, false, promoted, maxSize);
      return {
        result: {
          decision: "tarpit",
          reason: `inbound velocity ceiling: ${inWindow} requests in window (max ${maxPerWindow})`,
          dimension: "velocity",
          lawId: "BOUNDARY.ADMISSION.VELOCITY.01",
          promoted: promoted.isNew,
          promotionKind: promoted.isNew ? promoted.kind : undefined,
        },
        state: nextState,
      };
    }
  }

  // ── Step 4: Mass check ────────────────────────────────────────────────────
  if (config.mass) {
    const massWindowMs = config.mass.windowMs ?? 60_000;
    const massWindowStart = nowMs - massWindowMs;
    const windowWeight = existing.windowWeightTimestamps
      .filter((e) => e.ts >= massWindowStart)
      .reduce((sum, e) => sum + e.weight, 0);
    const maxMass = scaleThreshold(config.mass.maxInboundWeight, provenanceStrength);

    if (windowWeight + weight > maxMass) {
      const promoted = promoteIfDensityTripped(state, config, existing, provenance);
      const nextState = buildUpdatedState(state, records, provenance, existing, weight, nowMs, false, promoted, maxSize);
      return {
        result: {
          decision: "tarpit",
          reason: `inbound mass ceiling: accumulated weight ${windowWeight} + ${weight} exceeds ${maxMass}`,
          dimension: "mass",
          lawId: "BOUNDARY.ADMISSION.MASS.01",
          promoted: promoted.isNew,
          promotionKind: promoted.isNew ? promoted.kind : undefined,
        },
        state: nextState,
      };
    }
  }

  // ── Step 5: Density check (standalone — repeated hostile inputs) ──────────
  if (config.density) {
    const windowSize = config.density.windowSize ?? 20;
    const recent = existing.recentDecisions.slice(-windowSize);
    if (recent.length >= Math.ceil(windowSize / 2)) {
      const deniedCount = recent.filter((admitted) => !admitted).length;
      const ratio = deniedCount / recent.length;
      const maxRatio = config.density.maxDenyRatio / (provenanceStrength === "weak" ? 2 : provenanceStrength === "strong" ? 1 : 1);

      if (ratio >= maxRatio) {
        const promoted = promoteIfNew(state, provenance, "density");
        const nextState = buildUpdatedState(state, records, provenance, existing, weight, nowMs, false, promoted, maxSize);
        return {
          result: {
            decision: "tarpit",
            reason: `inbound denial density: ${Math.round(ratio * 100)}% unlawful in window (max ${Math.round(maxRatio * 100)}%)`,
            dimension: "density",
            lawId: "BOUNDARY.ADMISSION.DENSITY.01",
            promoted: promoted.isNew,
            promotionKind: promoted.isNew ? "density" : undefined,
          },
          state: nextState,
        };
      }
    }
  }

  // ── Step 6: Admit ─────────────────────────────────────────────────────────
  const nextState = buildUpdatedState(state, records, provenance, existing, weight, nowMs, true, { isNew: false, kind: "density" }, maxSize);
  return {
    result: {
      decision: "admit",
      reason: "inbound request admitted",
      promoted: false,
    },
    state: nextState,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function promoteIfNew(
  state: BoundaryAdmissionState,
  provenance: string,
  kind: "density" | "hard_ceiling" = "density",
): { isNew: boolean; kind: "density" | "hard_ceiling" } {
  if (state.canyonProvenances[provenance]) {
    return { isNew: false, kind };
  }
  // Synchronously mark as promoted (ledgered=false until caller writes)
  // This is the exactly-once guard: state update is synchronous before any async ledger write.
  return { isNew: true, kind };
}

function promoteIfDensityTripped(
  state: BoundaryAdmissionState,
  config: BoundaryAdmissionConfig,
  existing: BoundaryProvenanceRecord,
  provenance: string,
): { isNew: boolean; kind: "density" | "hard_ceiling" } {
  // Canyon promotion is DENSITY-DRIVEN ONLY.
  // Velocity and mass trips tarpit the current request temporarily but do NOT
  // write canyon state unless the deny-density threshold is also crossed.
  // This is the Grand Canyon distinction: temporary rate enforcement ≠ durable canyon hold.
  if (!config.density) {
    return { isNew: false, kind: "density" };
  }
  const windowSize = config.density.windowSize ?? 20;
  const recent = existing.recentDecisions.slice(-windowSize);
  if (recent.length < Math.ceil(windowSize / 2)) {
    return { isNew: false, kind: "density" }; // not enough signal yet
  }
  const deniedCount = recent.filter((admitted) => !admitted).length;
  const ratio = deniedCount / recent.length;
  if (ratio >= config.density.maxDenyRatio) {
    return promoteIfNew(state, provenance, "density");
  }
  return { isNew: false, kind: "density" };
}

function buildUpdatedState(
  state: BoundaryAdmissionState,
  records: Record<string, BoundaryProvenanceRecord>,
  provenance: string,
  existing: BoundaryProvenanceRecord,
  weight: number,
  nowMs: number,
  wasAdmitted: boolean,
  promoted: { isNew: boolean; kind?: "density" | "hard_ceiling" },
  maxSize: number,
): BoundaryAdmissionState {
  const velocityWindowMs = 60_000; // default; caller's config not threaded here — trimmed conservatively
  const newDeniedCount = wasAdmitted ? (existing.totalDeniedCount ?? 0) : (existing.totalDeniedCount ?? 0) + 1;
  const updatedRecord: BoundaryProvenanceRecord = {
    requestTimestamps: [...existing.requestTimestamps.filter((t) => t >= nowMs - velocityWindowMs), nowMs],
    recentDecisions: [...existing.recentDecisions, wasAdmitted].slice(-40),
    totalDeniedCount: newDeniedCount,
    totalInboundWeight: existing.totalInboundWeight + weight,
    windowWeightTimestamps: [...existing.windowWeightTimestamps.filter((e) => e.ts >= nowMs - velocityWindowMs), { ts: nowMs, weight }],
    lastSeenMs: nowMs,
  };

  const nextCanyon = promoted.isNew
    ? {
        ...state.canyonProvenances,
        [provenance]: {
          canyonedAt: nowMs,
          reason: promoted.kind === "hard_ceiling"
            ? `hard block ceiling: accumulated ${newDeniedCount} tarpit decisions for weak provenance`
            : "density threshold crossed",
          ledgered: false,
          promotionKind: promoted.kind ?? "density",
        },
      }
    : state.canyonProvenances;

  // Update hostileDeniedCounts on every tarpit decision.
  // This map survives provenanceRecord TTL eviction so the ceiling cannot be
  // farmed by timing attacks below the provenanceTtlMs threshold.
  let nextHostileCounts = state.hostileDeniedCounts;
  if (!wasAdmitted) {
    const prev = nextHostileCounts[provenance] ?? 0;
    if (newDeniedCount > prev) {
      // Monotone update only. Size cap matches default provenanceMaxSize so the
      // hostile history is bounded by the same order-of-magnitude as the record map.
      nextHostileCounts = evictHostileDeniedCounts(
        { ...nextHostileCounts, [provenance]: newDeniedCount },
        10_000,
      );
    }
  }

  return {
    canyonProvenances: trimCanyonProvenances(nextCanyon, maxSize),
    allowOnceProvenances: trimTimedOverrideMap(state.allowOnceProvenances, maxSize),
    denyOnceProvenances: trimTimedOverrideMap(state.denyOnceProvenances, maxSize),
    allowedProvenances: state.allowedProvenances,
    provenanceRecords: { ...records, [provenance]: updatedRecord },
    hostileDeniedCounts: nextHostileCounts,
  };
}

// ─── Canyon ledger marking ────────────────────────────────────────────────────
// Call this after writing INGRESS_CANYON_STATE_WRITTEN to the ledger.
// Marks the provenance as durably ledgered so no further writes occur.

export function markCanyonLedgered(
  state: BoundaryAdmissionState,
  provenance: string,
): BoundaryAdmissionState {
  if (!state.canyonProvenances[provenance]) {
    return state;
  }
  return {
    ...state,
    canyonProvenances: {
      ...state.canyonProvenances,
      [provenance]: { ...state.canyonProvenances[provenance], ledgered: true },
    },
  };
}

export function allowIngressOnce(
  state: BoundaryAdmissionState,
  provenance: string,
): BoundaryAdmissionState {
  const nextDenyOnce = { ...state.denyOnceProvenances };
  delete nextDenyOnce[provenance];
  return {
    ...state,
    denyOnceProvenances: nextDenyOnce,
    allowOnceProvenances: {
      ...state.allowOnceProvenances,
      [provenance]: { grantedAt: Date.now(), remaining: 1 },
    },
  };
}

export function denyIngressOnce(
  state: BoundaryAdmissionState,
  provenance: string,
  reason = `Terminal 2 kept ${provenance} in the canyon once`,
): BoundaryAdmissionState {
  const nextAllowOnce = { ...state.allowOnceProvenances };
  delete nextAllowOnce[provenance];
  return {
    ...state,
    allowOnceProvenances: nextAllowOnce,
    denyOnceProvenances: {
      ...state.denyOnceProvenances,
      [provenance]: {
        grantedAt: Date.now(),
        remaining: 1,
        reason,
      },
    },
  };
}

export function allowIngressAsLaw(
  state: BoundaryAdmissionState,
  provenance: string,
  reason = "standing ingress allow written by Terminal 2",
): BoundaryAdmissionState {
  const nextCanyon = { ...state.canyonProvenances };
  delete nextCanyon[provenance];
  const nextAllowOnce = { ...state.allowOnceProvenances };
  delete nextAllowOnce[provenance];
  const nextDenyOnce = { ...state.denyOnceProvenances };
  delete nextDenyOnce[provenance];
  return {
    ...state,
    canyonProvenances: nextCanyon,
    allowOnceProvenances: nextAllowOnce,
    denyOnceProvenances: nextDenyOnce,
    allowedProvenances: {
      ...state.allowedProvenances,
      [provenance]: {
        grantedAt: Date.now(),
        reason,
      },
    },
  };
}

export function denyIngressAsLaw(
  state: BoundaryAdmissionState,
  provenance: string,
  reason = "standing canyon hold written by Terminal 2",
): BoundaryAdmissionState {
  const nextAllowed = { ...state.allowedProvenances };
  delete nextAllowed[provenance];
  const nextAllowOnce = { ...state.allowOnceProvenances };
  delete nextAllowOnce[provenance];
  const nextDenyOnce = { ...state.denyOnceProvenances };
  delete nextDenyOnce[provenance];
  return {
    ...state,
    allowedProvenances: nextAllowed,
    allowOnceProvenances: nextAllowOnce,
    denyOnceProvenances: nextDenyOnce,
    canyonProvenances: {
      ...state.canyonProvenances,
      [provenance]: {
        canyonedAt: state.canyonProvenances[provenance]?.canyonedAt ?? Date.now(),
        reason,
        ledgered: state.canyonProvenances[provenance]?.ledgered ?? true,
        promotionKind: state.canyonProvenances[provenance]?.promotionKind ?? "density",
        operatorDisposition: "deny_as_law",
      },
    },
  };
}

export function releaseIngressFromCanyon(
  state: BoundaryAdmissionState,
  provenance: string,
): BoundaryAdmissionState {
  const nextCanyon = { ...state.canyonProvenances };
  delete nextCanyon[provenance];
  return {
    ...state,
    canyonProvenances: nextCanyon,
  };
}
