import type { CodingSkeletonContract } from "@/lib/lml/coding-skeleton-laws";

export const CODING_FLOOR_LAWS = [
  "ABILITY.CODING.19: U1 Totality. Coding output must terminate explicit control paths and avoid incomplete structural stubs.",
  "ABILITY.CODING.20: U2 Explicitness. Coding output must avoid star imports, hidden globals, and reflection-style access where a local explicit structure exists.",
  "ABILITY.CODING.21: U3 Determinism. Coding output must avoid random, time, process, shell, and uncontrolled IO inside core logic unless the request explicitly requires it.",
  "ABILITY.CODING.22: U4 Local Reasoning. Coding output should prefer named local structure over opaque indirection in simple law-routed tasks.",
  "ABILITY.CODING.23: U5 Explicit Failure. Coding output must avoid bare catch/except behavior and preserve explicit failure paths.",
  "ABILITY.CODING.24: U6 Algebraic Data. Coding output should prefer constrained explicit state shape over impossible-state drift where the task family supports it.",
] as const;

export type CodingFloorValidation = {
  ok: boolean;
  reason: string;
  passed: string[];
  failed: string[];
};

export function validateCodingFloor(args: {
  contract: CodingSkeletonContract;
  text: string;
}): CodingFloorValidation {
  const lower = args.text.toLowerCase();
  const passed: string[] = [];
  const failed: string[] = [];

  if (hasExplicitStructure(lower)) passed.push("u1_totality");
  else failed.push("u1_totality");

  if (!hasExplicitnessViolation(lower)) passed.push("u2_explicitness");
  else failed.push("u2_explicitness");

  if (!hasDeterminismViolation(lower, args.contract)) passed.push("u3_determinism");
  else failed.push("u3_determinism");

  if (!hasLocalReasoningViolation(lower, args.contract)) passed.push("u4_local_reasoning");
  else failed.push("u4_local_reasoning");

  if (!hasExplicitFailureViolation(lower)) passed.push("u5_explicit_failure");
  else failed.push("u5_explicit_failure");

  if (!hasAlgebraicStateViolation(lower, args.contract)) passed.push("u6_algebraic_data");
  else failed.push("u6_algebraic_data");

  return {
    ok: failed.length === 0,
    reason: failed.length === 0 ? "ok" : `floor_failed:${failed[0]}`,
    passed,
    failed,
  };
}

function hasExplicitStructure(lower: string): boolean {
  return /\b(def\s+\w+\(|function\s+\w+\(|class\s+\w+|@app\.(get|post|put|delete|patch)|router\.)/.test(lower);
}

function hasExplicitnessViolation(lower: string): boolean {
  return /\bfrom\s+\w+\s+import\s+\*|globals\(|locals\(|getattr\(|setattr\(|eval\(|exec\(/.test(lower);
}

function hasDeterminismViolation(lower: string, contract: CodingSkeletonContract): boolean {
  if (contract.family === "game") {
    return false;
  }
  return /\bimport\s+random\b|\bfrom\s+random\b|\bdatetime\b|\btime\b|\bsubprocess\b|\bos\.system\b|\bexec\.command\b|\bchild_process\b|\bfs\./.test(lower);
}

function hasLocalReasoningViolation(lower: string, contract: CodingSkeletonContract): boolean {
  if (contract.family !== "utility") {
    return false;
  }
  return /\blambda\b|=>\s*[^\{]/.test(lower);
}

function hasExplicitFailureViolation(lower: string): boolean {
  return /\bexcept\s*:\s*(?:\n|return|pass|raise|#|$)|\bexcept\s*:\b|\bcatch\s*\(\s*\)\s*\{/.test(lower);
}

function hasAlgebraicStateViolation(lower: string, contract: CodingSkeletonContract): boolean {
  if (contract.family !== "auth" && contract.family !== "orm") {
    return false;
  }
  return /\bany\b/.test(lower) && !/\btype\b|\binterface\b|\benum\b|\bclass\b|\bbaseModel\b/i.test(lower);
}
