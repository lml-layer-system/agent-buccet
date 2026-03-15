import type { CodingIntentSpec } from "@/lib/lml/coding-intent-spec";
import type { CodingSkeletonContract } from "@/lib/lml/coding-skeleton-laws";

export const CODING_SCALE_LAWS = [
  "ABILITY.CODING.77: Scaling failures are direct algorithm legality failures when the coding family has a simpler admissible path.",
  "ABILITY.CODING.78: Exponential, obviously non-scaling, or unnecessarily high-complexity implementations must collapse to NULL before emission.",
] as const;

export type CodingScaleValidation = {
  ok: boolean;
  reason: string;
  passed: string[];
  failed: string[];
};

export function validateCodingScale(args: {
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
  text: string;
}): CodingScaleValidation {
  const lower = args.text.toLowerCase();
  const passed: string[] = [];
  const failed: string[] = [];

  const nestedLoops = /(for\s+\w+\s+in\s+\w+:[\s\S]{0,160}for\s+\w+\s+in\s+\w+:)|(while\s+\w+:[\s\S]{0,160}for\s+\w+\s+in\s+\w+:)/.test(lower);
  const setAlternative = /\bset\(/.test(lower);
  if (nestedLoops && !setAlternative) failed.push("G1.1_WRONG_TIME_COMPLEXITY");
  else passed.push("G1.1_WRONG_TIME_COMPLEXITY");

  if (/return\s+fibonacci\(\w+\s*-\s*1\)\s*\+\s*fibonacci\(\w+\s*-\s*2\)/.test(lower) || /return\s+\w+\(\w+\s*-\s*1\)\s*\+\s*\w+\(\w+\s*-\s*2\)/.test(lower)) failed.push("G1.2_EXPONENTIAL_WHEN_POLYNOMIAL_EXISTS");
  else passed.push("G1.2_EXPONENTIAL_WHEN_POLYNOMIAL_EXISTS");

  if ((args.contract.family === "api" || args.contract.family === "app" || args.contract.family === "orm") && /\bselect\(\w+\)\b/.test(lower) && !/\blimit\(|pagination|page_size|offset\b/.test(lower)) failed.push("G1.3_DOESNT_SCALE");
  else passed.push("G1.3_DOESNT_SCALE");

  return {
    ok: failed.length === 0,
    reason: failed.length === 0 ? "ok" : `scale_failed:${failed[0]}`,
    passed,
    failed,
  };
}
