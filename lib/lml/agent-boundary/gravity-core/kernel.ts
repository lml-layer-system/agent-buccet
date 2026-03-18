import type {
  EnforcementResult,
  GravityEvent,
  GravityKernelDeps,
  GravityState,
  LawSkill,
} from "./types.ts";
import { allViolationsGrantable } from "./types.ts";

/**
 * Core gravity loop.
 *
 * This loop is intentionally minimal:
 * - It blocks on nextEvent()
 * - Runs validation across all law-skills
 * - Applies idempotent normalization when needed
 * - Persists the resulting state
 *
 * It does not know about Telegram, Slack, tools, or UI. Only state + law + motion.
 */
export async function runGravityLoop(
  deps: GravityKernelDeps,
  skills: readonly LawSkill[],
): Promise<never> {
  let state: GravityState;
  try {
    state = await deps.loadState();
  } catch (error) {
    deps.emitPanic?.(error);
    // Supervisor is expected to restart the kernel.
    // This never resolves successfully by design.
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }

  let lastDecision: EnforcementResult["decision"] = "allow";
  let lastEventAt = Date.now();

  while (true) {
    const event: GravityEvent = await deps.nextEvent();
    lastEventAt = Date.now();

    let violations = [] as ReturnType<LawSkill["validate"]>;
    for (const skill of skills) {
      try {
        const next = skill.validate(state, event);
        if (next.length > 0) {
          violations = violations.concat(next);
        }
      } catch (error) {
        deps.emitPanic?.({
          kind: "law-skill-validate-error",
          lawId: skill.id,
          error,
        });
      }
    }

    let result: EnforcementResult;
    if (violations.length === 0) {
      result = {
        decision: "allow",
        state,
        violations,
      };
    } else {
      let nextState = state;
      for (const skill of skills) {
        const relevant = violations.filter((v) => v.lawId === skill.id);
        if (relevant.length === 0) {
          continue;
        }
        try {
          nextState = skill.normalize(nextState, relevant);
        } catch (error) {
          deps.emitPanic?.({
            kind: "law-skill-normalize-error",
            lawId: skill.id,
            error,
          });
        }
      }
      result = {
        decision: allViolationsGrantable(violations) ? "null" : "deny",
        state: nextState,
        violations,
      };
      state = nextState;
    }

    await deps.saveState(state).catch((error) => {
      deps.emitPanic?.({
        kind: "save-state-error",
        error,
      });
    });

    lastDecision = result.decision;
    deps.emitHeartbeat?.({
      lastEventAt,
      lastDecision,
    });
  }
}
