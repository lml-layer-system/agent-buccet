import type { CodingIntentSpec } from "@/lib/lml/coding-intent-spec";
import type { CodingSkeletonContract } from "@/lib/lml/coding-skeleton-laws";

export const CODING_DESIGN_LAWS = [
  "ABILITY.CODING.75: Architecture smell classes are direct legality failures for coding collapse when they violate branchable project structure.",
  "ABILITY.CODING.76: Tight coupling, god objects, feature envy, inappropriate intimacy, message chains, and middle-man structure must not emit as lawful designs.",
] as const;

export type CodingDesignValidation = {
  ok: boolean;
  reason: string;
  passed: string[];
  failed: string[];
};

export function validateCodingDesign(args: {
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
  text: string;
}): CodingDesignValidation {
  if (!["app", "refactor"].includes(args.contract.family)) {
    return {
      ok: true,
      reason: "ok",
      passed: [
        "A1.1_TIGHT_COUPLING",
        "A1.2_GOD_OBJECT",
        "A1.4_FEATURE_ENVY",
        "A1.5_INAPPROPRIATE_INTIMACY",
        "A1.6_MESSAGE_CHAIN",
        "A1.7_MIDDLE_MAN",
      ],
      failed: [],
    };
  }

  const lower = args.text.toLowerCase();
  const passed: string[] = [];
  const failed: string[] = [];

  const importLines = (lower.match(/^\s*from\s+[a-z0-9_.]+\s+import\s+[a-z0-9_,\s]+/gm) ?? []);
  const heavyCoupling = importLines.some((line) => (line.split(",").length - 1) >= 3);
  if (heavyCoupling) failed.push("A1.1_TIGHT_COUPLING");
  else passed.push("A1.1_TIGHT_COUPLING");

  const methodCount = (lower.match(/^\s*def\s+[a-z_][a-z0-9_]*\s*\(/gm) ?? []).length;
  const classCount = (lower.match(/^\s*class\s+[a-z_][a-z0-9_]*\s*[:(]/gm) ?? []).length;
  if (classCount === 1 && methodCount >= 8) failed.push("A1.2_GOD_OBJECT");
  else passed.push("A1.2_GOD_OBJECT");

  if (/^\s*def\s+\w+\([^)]*service[^)]*\):[\s\S]{0,220}(service\.\w+){3,}/m.test(lower)) failed.push("A1.4_FEATURE_ENVY");
  else passed.push("A1.4_FEATURE_ENVY");

  if (/\.\_[a-z_][a-z0-9_]*/.test(lower)) failed.push("A1.5_INAPPROPRIATE_INTIMACY");
  else passed.push("A1.5_INAPPROPRIATE_INTIMACY");

  if (/\b\w+\.\w+\.\w+\.\w+/.test(lower)) failed.push("A1.6_MESSAGE_CHAIN");
  else passed.push("A1.6_MESSAGE_CHAIN");

  if (/^\s*def\s+\w+\([^)]*\):\s*\n\s*return\s+self\.\w+\.\w+\(/m.test(lower)) failed.push("A1.7_MIDDLE_MAN");
  else passed.push("A1.7_MIDDLE_MAN");

  return {
    ok: failed.length === 0,
    reason: failed.length === 0 ? "ok" : `design_failed:${failed[0]}`,
    passed,
    failed,
  };
}
