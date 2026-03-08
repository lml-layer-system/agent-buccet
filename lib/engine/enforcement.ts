import type { RunMode, SnapProfile } from "@/lib/profiles";
import { evaluateInvariantState, type EngineState } from "./invariants";

export type EnforcementClass = "HARD_LEGALITY" | "FEEDBACK_REPAIR" | "CONTAINMENT" | "LEDGER_PROOF";

export type LawBinding = {
  lawId: string;
  detectorId: string;
  gateId: string;
  repairId: string | null;
  enforcementClass: EnforcementClass;
};

export type GeneratorAccounting = {
  drift: number;
  correction: number;
  containment: number;
  stable: boolean;
};

export type EnforcementReport = {
  admissible: boolean;
  nullOutput: boolean;
  reasonIfNull: string | null;
  lawBindings: LawBinding[];
  triggeredRepairs: string[];
  failedEnforcementClasses: EnforcementClass[];
  generator: GeneratorAccounting;
};

export function bindLaws(profile: SnapProfile): LawBinding[] {
  return profile.lmlLaws.map((law, index) => ({
    lawId: law.id,
    detectorId: profile.detectors[index % Math.max(1, profile.detectors.length)]?.id ?? "DET.HOLE",
    gateId: profile.hardGates[index % Math.max(1, profile.hardGates.length)]?.id ?? "GATE.HOLE",
    repairId: profile.nslRepairs[index % Math.max(1, profile.nslRepairs.length)]?.id ?? null,
    enforcementClass: classifyEnforcementClass(law.text, law.enforcement),
  }));
}

export function evaluateGeneratorState(
  state: EngineState,
  profile: SnapProfile,
  previousViolation: number,
  mode: RunMode,
): GeneratorAccounting {
  const now = evaluateInvariantState({ ...state, mode }, profile);
  const drift = Math.max(0, now.violation - previousViolation);
  const correction = Math.max(0, previousViolation - now.violation);
  const containment = now.forbiddenHits.length === 0 ? 1 : 0;
  const stable = correction + containment >= drift;
  return { drift, correction, containment, stable };
}

export function enforceState(
  state: EngineState,
  profile: SnapProfile,
  mode: RunMode,
  previousViolation = 0,
): EnforcementReport {
  const invariant = evaluateInvariantState({ ...state, mode }, profile);
  const bindings = bindLaws(profile);

  const triggeredRepairs = bindings
    .filter((binding) => binding.repairId && (!state.invariantsObserved.includes(binding.lawId) || invariant.missingProofForLaws.includes(binding.lawId)))
    .map((binding) => binding.repairId as string);

  const failedEnforcementClasses = unique(
    bindings
      .filter((binding) => !state.invariantsObserved.includes(binding.lawId))
      .map((binding) => binding.enforcementClass),
  );
  if (invariant.hardGateFailures.length > 0) {
    failedEnforcementClasses.push("HARD_LEGALITY");
  }

  const generator = evaluateGeneratorState(state, profile, previousViolation, mode);
  const nullOutput = !invariant.admissible;

  return {
    admissible: invariant.admissible,
    nullOutput,
    reasonIfNull: nullOutput ? invariant.reasonIfNull : null,
    lawBindings: bindings,
    triggeredRepairs,
    failedEnforcementClasses,
    generator,
  };
}

function classifyEnforcementClass(text: string, enforcement: string): EnforcementClass {
  const lower = `${text} ${enforcement}`.toLowerCase();
  if (/proof|ledger|audit|trace/.test(lower)) {
    return "LEDGER_PROOF";
  }
  if (/contain|quarantine|isolate|firebreak/.test(lower)) {
    return "CONTAINMENT";
  }
  if (/repair|restore|recheck|rollback/.test(lower)) {
    return "FEEDBACK_REPAIR";
  }
  return "HARD_LEGALITY";
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
