import type { RepairCatalog, RepairOperator, RepairPackName } from "./types.ts";

const OPERATORS: RepairOperator[] = [
  mk("R1", "UNCERTAINTY", "low confidence or missing evidence", "emit HOLE and freeze high-impact transition", "blocks ungrounded transition", ["F_UNCERTAIN"], "PANIC"),
  mk("R2", "UNCERTAINTY", "proof required but absent", "deny transition and route safe default", "prevents proofless mutation", ["F_PROOF_GAP"], "PANIC"),
  mk("R3", "UNCERTAINTY", "high-stakes anomaly", "require independent evidence channel", "reduces single-channel spoof", ["F_SPOOFING", "F_UNCERTAIN"], "RESTORE"),
  mk("R4", "UNCERTAINTY", "uncertainty with continuation needed", "defer with bounded conservative mode", "keeps operation in safe region", ["F_UNCERTAIN"], "RESTORE"),
  mk("R5", "DRIFT", "rapid state flip", "apply hysteresis lock", "stops oscillation", ["F_DRIFT", "F_OSCILLATION"], "RESTORE"),
  mk("R6", "DRIFT", "invariant trend violation", "run re-anchor pulse", "pulls state toward anchor", ["F_DRIFT"], "RESTORE"),
  mk("R7", "DRIFT", "drift over threshold", "downgrade to safe mode", "prevents runaway", ["F_DRIFT", "F_RUNAWAY"], "PANIC"),
  mk("R8", "INTEGRITY", "version mismatch", "rollback to last-known-good and freeze updates", "stops silent overwrite", ["F_INTEGRITY"], "PANIC"),
  mk("R9", "INTEGRITY", "protected write attempt", "enforce write-protect and quarantine channel", "prevents kernel overwrite", ["F_OVERWRITE"], "PANIC"),
  mk("R10", "INTEGRITY", "anchor inconsistency", "restore anchor from trusted copy", "recovers identity", ["F_OVERWRITE", "F_CORRUPTION"], "RESTORE"),
  mk("R11", "SPOOFING", "boundary-hug pattern", "escalate trust downgrade and quarantine window", "mitigates gaming", ["F_SPOOFING"], "RESTORE"),
  mk("R12", "SPOOFING", "judge-modeling suspicion", "apply randomized probe escalation", "breaks rehearsed compliance", ["F_SPOOFING"], "HARDEN"),
  mk("R13", "OOD", "no-fit ontology", "quarantine to unknown", "prevents forced-fit hallucination", ["F_OOD"], "PANIC"),
  mk("R14", "OOD", "repeated no-fit", "emit ontology expansion request", "enables authorized growth path", ["F_OOD"], "HARDEN"),
  mk("R15", "CASCADE", "high-impact coupling", "apply coupling firebreak", "contains spread", ["F_CASCADE"], "PANIC"),
  mk("R16", "CASCADE", "module panic threshold", "circuit-breaker isolate module", "stops propagation", ["F_CASCADE"], "PANIC"),
  mk("R17", "CASCADE", "recovery achieved", "staged recouple ramp", "prevents relapse cascade", ["F_RECOVERY"], "REPAIR"),
  mk("R18", "LEDGER", "evidence mismatch", "invalidate output and reconcile ledger", "restores trace integrity", ["F_LEDGER"], "REPAIR"),
  mk("R19", "LEDGER", "missing provenance", "rebuild provenance or quarantine", "restores auditability", ["F_LEDGER"], "REPAIR"),
  mk("R20", "LEDGER", "tamper suspicion", "audit freeze", "prevents hidden debt accumulation", ["F_LEDGER"], "PANIC"),
  mk("R21", "RESOURCE", "repair budget threatened", "enforce reserved budget", "prevents starvation", ["F_RESOURCE"], "PANIC"),
  mk("R22", "RESOURCE", "overload spike", "shed non-critical load", "preserves kernel and detection", ["F_RESOURCE", "F_OVERLOAD"], "PANIC"),
  mk("R23", "LATENCY", "audit lag near runaway", "insert interrupt correction", "keeps correction ahead of drift", ["F_LATENCY"], "PANIC"),
  mk("R24", "LATENCY", "time-gap exploitation risk", "collapse audit interval", "blocks deferred harm", ["F_LATENCY"], "HARDEN"),
  mk("R25", "MIS_CORRECTION", "restore target uncertain", "verify anchor before restore", "avoids wrong-self stabilization", ["F_MIS_CORRECTION"], "RESTORE"),
  mk("R26", "MIS_CORRECTION", "correction overshoot", "apply gain damping", "stops correction oscillation", ["F_OSCILLATION"], "REPAIR"),
  mk("R27", "META_HARDENING", "panic event occurred", "register failure signature", "improves recurrence detection", ["F_ANY"], "HARDEN"),
  mk("R28", "META_HARDENING", "failure missed by detection", "install detector or emit HOLE", "reduces stealth repeats", ["F_MISSED_DETECTION"], "HARDEN"),
  mk("R29", "META_HARDENING", "failure lacks return path", "install return path or emit HOLE", "closes failure-return gap", ["F_MISSING_RETURN"], "HARDEN"),
  mk("R30", "META_HARDENING", "update spoof attempt", "tighten auth gate and quarantine update channel", "reduces future overwrite", ["F_SPOOFING", "F_OVERWRITE"], "HARDEN"),
];

const PACKS: RepairCatalog["packs"] = {
  "NSL.REPAIR_PACK.MEASUREMENT": ["R1", "R2", "R3", "R4", "R11", "R12", "R13", "R18", "R28"],
  "NSL.REPAIR_PACK.DRIFT": ["R5", "R6", "R7", "R23", "R24", "R26"],
  "NSL.REPAIR_PACK.INTEGRITY": ["R8", "R9", "R10", "R20", "R30"],
  "NSL.REPAIR_PACK.CONTAINMENT": ["R15", "R16", "R17", "R21", "R22"],
  "NSL.REPAIR_PACK.LEDGER": ["R18", "R19", "R20"],
  "NSL.REPAIR_PACK.RESOURCE": ["R21", "R22"],
  "NSL.REPAIR_PACK.LATENCY": ["R23", "R24"],
  "NSL.REPAIR_PACK.OOD": ["R13", "R14"],
  "NSL.REPAIR_PACK.META_HARDENING": ["R27", "R28", "R29", "R30"],
  "NSL.REPAIR_PACK.ALL": OPERATORS.map((operator) => operator.repair_id),
};

export const NSL_REPAIR_CATALOG: RepairCatalog = {
  operators: OPERATORS,
  packs: PACKS,
};

export function resolveAuthorizedRepairs(
  authorizedPacks: RepairPackName[],
  measurementPackAuthorized: boolean,
  measurementPresent: boolean,
): RepairOperator[] {
  const requested = new Set<RepairPackName>(authorizedPacks);
  if (measurementPresent && measurementPackAuthorized) {
    requested.add("NSL.REPAIR_PACK.MEASUREMENT");
  }

  const ids = new Set<string>();
  for (const pack of requested) {
    for (const id of PACKS[pack] ?? []) {
      ids.add(id);
    }
  }

  return OPERATORS.filter((operator) => ids.has(operator.repair_id));
}

function mk(
  repair_id: string,
  family: RepairOperator["family"],
  trigger: string,
  move: string,
  effect: string,
  maps_failures: string[],
  priority: RepairOperator["priority"],
): RepairOperator {
  return {
    repair_id,
    family,
    trigger,
    move,
    effect,
    maps_failures,
    priority,
    scope: "runtime",
    preconditions: ["failure_detected"],
    ledger_requirements: ["failure_class", "trigger_evidence", "action_record"],
  };
}
