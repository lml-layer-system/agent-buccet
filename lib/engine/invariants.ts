import type { RunMode, SnapProfile } from "@/lib/profiles";

export type EngineState = {
  mode: RunMode;
  profileId: string;
  invariantsObserved: string[];
  disturbancesObserved: string[];
  proofsProvided: string[];
  blockers: string[];
  hardGateFailures?: string[];
  metadata?: Record<string, unknown>;
};

export type InvariantTargetSet = {
  K: string[];
  K_epsilon: {
    tolerance: number;
    boundBy: string;
  };
  Adm: {
    requiresProofForLaws: string[];
    forbiddenSignals: string[];
  };
};

export type InvariantEvaluation = {
  admissible: boolean;
  violation: number;
  missingInvariants: string[];
  missingProofForLaws: string[];
  forbiddenHits: string[];
  hardGateFailures: string[];
  reasonIfNull: string | null;
};

export function deriveInvariantTargetSet(profile: SnapProfile, mode: RunMode): InvariantTargetSet {
  return {
    K: profile.lmlLaws.map((law) => law.id),
    K_epsilon: {
      tolerance: mode === "product" ? 0 : 1,
      boundBy: "missing_invariants_count",
    },
    Adm: {
      requiresProofForLaws: profile.lmlLaws
        .filter((law) => /proof|required|verify|verification|shepardize/i.test(law.text))
        .map((law) => law.id),
      forbiddenSignals: profile.hardGates.filter((gate) => gate.hard).map((gate) => gate.id),
    },
  };
}

export function measureViolation(state: EngineState, target: InvariantTargetSet): number {
  const missingInvariantCount = target.K.filter((k) => !state.invariantsObserved.includes(k)).length;
  const missingProofCount = target.Adm.requiresProofForLaws.filter((k) => !state.proofsProvided.includes(k)).length;
  const forbiddenHits = state.blockers.filter((b) => target.Adm.forbiddenSignals.includes(b)).length;
  const hardGateFailures = (state.hardGateFailures ?? []).length;
  return missingInvariantCount + missingProofCount + forbiddenHits + hardGateFailures;
}

export function evaluateInvariantState(state: EngineState, profile: SnapProfile): InvariantEvaluation {
  const target = deriveInvariantTargetSet(profile, state.mode);
  const missingInvariants = target.K.filter((k) => !state.invariantsObserved.includes(k));
  const missingProofForLaws = target.Adm.requiresProofForLaws.filter((k) => !state.proofsProvided.includes(k));
  const forbiddenHits = state.blockers.filter((b) => target.Adm.forbiddenSignals.includes(b));
  const hardGateFailures = state.hardGateFailures ?? [];

  const violation = measureViolation(state, target);
  const admissible = state.mode === "product" ? violation <= target.K_epsilon.tolerance && hardGateFailures.length === 0 : violation <= target.K_epsilon.tolerance;

  return {
    admissible,
    violation,
    missingInvariants,
    missingProofForLaws,
    forbiddenHits,
    hardGateFailures,
    reasonIfNull: admissible
      ? null
      : `non_admissible: violation=${violation} tolerance=${target.K_epsilon.tolerance} hard_gate_failures=${hardGateFailures.length}`,
  };
}
