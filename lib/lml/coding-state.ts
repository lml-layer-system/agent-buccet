import type { CodingIntentSpec } from "./coding-intent-spec.ts";
import type { CodingSkeletonContract } from "./coding-skeleton-laws.ts";
import { validateOracleWitnesses } from "./coding-oracle/witnesses.ts";

export const CODING_STATE_LAWS = [
  "ABILITY.CODING.72: Stateful coding families must preserve initialized state, lawful reset paths, and bounded synchronization before emission.",
  "ABILITY.CODING.73: Shared mutable state without lawful synchronization is inadmissible and must collapse to NULL as a direct state failure.",
  "ABILITY.CODING.74: Stale, polluted, inconsistent, or unreset state is a direct coding legality failure, not a soft warning.",
] as const;

export type CodingStateValidation = {
  ok: boolean;
  reason: string;
  passed: string[];
  failed: string[];
};

export function validateCodingState(args: {
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
  text: string;
}): CodingStateValidation {
  const lower = args.text.toLowerCase();
  const passed: string[] = [];
  const failed: string[] = [];
  const oracle = validateOracleWitnesses({
    contract: args.contract,
    text: args.text,
  });

  if (/\breturn\s+result\b/.test(lower) && !/\bresult\s*=/.test(lower)) failed.push("L7.1_UNINITIALIZED_VARIABLE:return_undefined_result");
  else passed.push("L7.1_UNINITIALIZED_VARIABLE");

  const sharedState = /\b(global\s+[a-z_]\w*|state\s*=\s*\{|\w+_cache\s*=\s*\{|\w+_state\s*=\s*\{)/.test(lower);
  const concurrentFlow = /\b(threading\.thread|asyncio\.create_task|threadpoolexecutor|processpoolexecutor)\b/.test(lower);
  const lockPresent = /\b(lock|rlock|asyncio\.lock|threading\.lock)\b/.test(lower);
  const appStateLifecycle =
    args.contract.family === "app"
    && (
      /\brevalidatepath\(/.test(lower)
      || /\buseeffect\(/.test(lower)
      || /\buseformstate\(/.test(lower)
      || /\buseoptimistic\(/.test(lower)
      || /\bset[a-z0-9_]+\(/.test(lower)
      || /\btoisostring\(\)/.test(lower)
    );
  if (sharedState && concurrentFlow && !lockPresent) failed.push("L7.2_RACE_CONDITION:shared_mutation_without_lock");
  else passed.push("L7.2_RACE_CONDITION");

  const nestedLock = /(with\s+\w+_lock:\s*[\s\S]{0,120}with\s+\w+_lock:)|(lock\.acquire\(\)[\s\S]{0,120}lock\.acquire\(\))/.test(lower);
  if (nestedLock) failed.push("L7.3_DEADLOCK:reentrant_lock_acquire");
  else passed.push("L7.3_DEADLOCK");

  if (/\bstate\[['"]status['"]\]\s*=/.test(lower) && /\breturn\s+state\b/.test(lower) && !/\bstate\[['"]updated_at['"]\]\s*=/.test(lower)) failed.push("L7.4_STATE_INCONSISTENCY:status_mutated_without_version");
  else passed.push("L7.4_STATE_INCONSISTENCY");

  if (/\bglobal\s+[a-z_]\w*/.test(lower) && /(\.append\(|\.update\(|\[['"][^'"]+['"]\]\s*=)/.test(lower)) failed.push("L7.5_GLOBAL_STATE_POLLUTION:global_mutation");
  else passed.push("L7.5_GLOBAL_STATE_POLLUTION");

  if (/\b(cache|cached|snapshot|memo)\b/.test(lower) && !/\b(clear|invalidate|refresh|recompute|version)\b/.test(lower) && !appStateLifecycle) failed.push("L7.6_STALE_STATE:no_invalidation_path");
  else passed.push("L7.6_STALE_STATE");

  const statefulFamily = args.contract.family === "game" || args.contract.family === "app" || args.contract.family === "refactor";
  const explicitStateCarrier = /\b(state\s*=|cache\s*=|global\s+[a-z_]\w*|pygame\.init\(\))/.test(lower);
  if (statefulFamily && explicitStateCarrier && !/\b(reset|clear|teardown|cleanup|pygame\.quit|close\()\b/.test(lower) && !appStateLifecycle) failed.push("L7.7_MISSING_STATE_RESET:no_reset_or_teardown");
  else passed.push("L7.7_MISSING_STATE_RESET");

  if (oracle.ok && args.contract.family === "game") {
    const hasReset = oracle.files.some((file) => /\bdef\s+reset_state\(/.test(file.body));
    const hasLifecycle = oracle.files.some((file) => /\brunning\b|\bclock\.tick\(/.test(file.body));
    if (!hasReset) failed.push("L7.7_MISSING_STATE_RESET:oracle_reset_missing");
    else passed.push("L7.7_MISSING_STATE_RESET:oracle_reset_present");
    if (!hasLifecycle) failed.push("L7.6_STALE_STATE:oracle_lifecycle_missing");
    else passed.push("L7.6_STALE_STATE:oracle_lifecycle_present");
  }

  if (oracle.ok && args.contract.family === "refactor") {
    const hasImmutableClone = oracle.files.some((file) => /\bdef\s+clone_tree_immutable\(/.test(file.body));
    const hasWitness = oracle.files.some((file) => /\bdef\s+run_behavior_preservation_truth\(/.test(file.body));
    if (!hasImmutableClone) failed.push("L7.4_STATE_INCONSISTENCY:oracle_transform_mutability");
    else passed.push("L7.4_STATE_INCONSISTENCY:oracle_transform_immutable");
    if (!hasWitness) failed.push("L7.6_STALE_STATE:oracle_behavior_witness_missing");
    else passed.push("L7.6_STALE_STATE:oracle_behavior_witness_present");
  }

  return {
    ok: failed.length === 0,
    reason: failed.length === 0 ? "ok" : `state_failed:${failed[0]}`,
    passed,
    failed,
  };
}
