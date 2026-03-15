import type { CodingIntentSpec } from "@/lib/lml/coding-intent-spec";
import type { CodingSkeletonContract } from "@/lib/lml/coding-skeleton-laws";

export const CODING_LOGIC_LAWS = [
  "ABILITY.CODING.90: Logic legality must resolve direct control-flow, return, type, collection, and exception leaf classes before repair proceeds.",
  "ABILITY.CODING.91: Missing tests or witness loss is not enough; direct logic defects must also be caught at the leaf-class level when present.",
] as const;

export type CodingLogicValidation = {
  ok: boolean;
  reason: string;
  passed: string[];
  failed: string[];
};

export function validateCodingLogic(args: {
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
  text: string;
}): CodingLogicValidation {
  const lower = args.text.toLowerCase();
  const passed: string[] = [];
  const failed: string[] = [];

  if (/if\s+\w+\s*>\s*0:\s*return\b[\s\S]{0,120}\breturn\b/.test(lower) && !/\belse:/.test(lower)) failed.push("L1.4_MISSING_CONDITION_CASE");
  else passed.push("L1.4_MISSING_CONDITION_CASE");

  if (/while\s+true\b/.test(lower) && !/\bbreak\b/.test(lower)) failed.push("L2.2_INFINITE_LOOP:no_break_path");
  else passed.push("L2.2_INFINITE_LOOP");

  if (/def\s+\w+\([^)]*\)\s*(->\s*[^:]+)?:\s*\n(?:\s+[^\n]+\n)+/m.test(lower) && /\bdef\s+\w+\(/.test(lower) && !/\breturn\b/.test(lower) && args.contract.family === "utility") failed.push("L3.1_MISSING_RETURN:no_return_statement");
  else passed.push("L3.1_MISSING_RETURN");

  if (/->\s*dict\[str,\s*str\]/.test(lower) && /\breturn\s+\[['"]/.test(lower)) failed.push("L3.2_WRONG_RETURN_TYPE:list_return_for_dict_contract");
  else passed.push("L3.2_WRONG_RETURN_TYPE");

  if (/=\s*none\b[\s\S]{0,120}\.\w+\(/.test(lower)) failed.push("L4.2_NULL_NONE_DEREFERENCE:none_method_call");
  else passed.push("L4.2_NULL_NONE_DEREFERENCE");

  if (/for\s+\w+\s+in\s+\w+:\s*[\s\S]{0,120}\.append\(\w+\)/.test(lower) && /\.append\(\w+\)/.test(lower)) failed.push("L5.3_MUTATION_DURING_ITERATION:append_inside_iteration");
  else passed.push("L5.3_MUTATION_DURING_ITERATION");

  {
    const keyedAccess = [...lower.matchAll(/\[['"]([^'"]+)['"]\]/g)].map((m) => m[1]);
    const literalKeys = new Set([...lower.matchAll(/['"]([^'"]+)['"]\s*:/g)].map((m) => m[1]));
    const hasUncheckedKeyAccess = keyedAccess.some((key) => !literalKeys.has(key));
    if (hasUncheckedKeyAccess && !/\bget\(['"]/.test(lower) && !/\bin\s+\w+/.test(lower) && !/\btry:/.test(lower)) failed.push("L5.5_KEY_NOT_FOUND:unchecked_literal_key_access");
    else passed.push("L5.5_KEY_NOT_FOUND");
  }

  if (/except\s+exception:\s*pass/.test(lower) || /except:\s*pass/.test(lower)) failed.push("L6.4_EXCEPTION_SWALLOWING:pass_in_except");
  else passed.push("L6.4_EXCEPTION_SWALLOWING");

  if (
    args.contract.family === "utility"
    && (
      /\b(config|user|payload|input)\[['"][^'"]+['"]\]\s*=/.test(lower)
      || /\b(export\s+const|const)\s+\w+\s*=\s*\([^)]*(config|user|payload|input)[^)]*\)\s*=>[\s\S]{0,220}(config|user|payload|input)\.[a-z_][a-z0-9_]*\s*=/.test(lower)
    )
    && /\breturn\s+(config|user|payload|input)\b/.test(lower)
  ) {
    failed.push("L1.1_SIDE_EFFECT_LEAK:mutates_input_reference");
  } else {
    passed.push("L1.1_SIDE_EFFECT_LEAK");
  }

  if (
    args.contract.family === "refactor"
    && (
      (
        /def\s+calculate_discount\(price\)\s*:\s*return\s+price\s*\*\s*0\.8/.test(lower)
        && /assert\s+calculate_discount\(100\)\s*==\s*80/.test(lower)
      )
      || (
        /def\s+visit_binop\(self,\s*node(?::\s*astnode)?\):[\s\S]{0,260}right\s*=\s*node\.right/.test(lower)
        && /def\s+test_visit_binop_transforms_children\(\):[\s\S]{0,260}assert\s+result\.right\.is_transformed\s*==\s*false/.test(lower)
      )
      || (
        /def\s+visit_binop\(self,\s*node\):[\s\S]{0,260}'right':\s*node\[['"]right['"]\]/.test(lower)
        && /def\s+test_visit_binop_transforms_children\(\):[\s\S]{0,260}assert\s+result\[['"]right['"]\]\[['"]is_transformed['"]\]\s*==\s*false/.test(lower)
      )
    )
  ) {
    failed.push("L8.2_TEST_MUTATION:mutated_test_matches_bug");
  } else {
    passed.push("L8.2_TEST_MUTATION");
  }

  return {
    ok: failed.length === 0,
    reason: failed.length === 0 ? "ok" : `logic_failed:${failed[0]}`,
    passed,
    failed,
  };
}
