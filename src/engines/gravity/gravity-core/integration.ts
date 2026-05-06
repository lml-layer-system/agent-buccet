import { runGravityLoop } from "./kernel.ts";
import type { EnforcementResult, GravityKernelDeps, GravityProposal, LawSkill } from "./types.ts";

/**
 * Thin client that outer runtimes can use to feed proposals/events into gravity.
 * This stays framework-agnostic; concrete Bodyguard callers and integrations live elsewhere.
 */
export interface GravityClient {
  /**
   * Submit a proposal for enforcement and receive a decision.
   * Implementations are expected to translate this into a GravityEvent stream
   * consumed by runGravityLoop.
   */
  enforceProposal: (proposal: GravityProposal) => Promise<EnforcementResult>;
}

/**
 * Helper to start the gravity loop with a given dependency bridge and law-skills.
 * The outer supervisor is responsible for process lifetime and restart semantics.
 */
export function startGravityKernel(
  deps: GravityKernelDeps,
  skills: readonly LawSkill[],
): Promise<never> {
  return runGravityLoop(deps, skills);
}
