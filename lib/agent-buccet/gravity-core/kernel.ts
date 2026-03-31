import type {
  EnforcementResult,
  GravityEvent,
  GravityKernelDeps,
  GravityState,
  LawSkill,
} from "./types.ts";
import { allViolationsGrantable } from "./types.ts";

export function evaluateGravityEvent(args: {
  state: GravityState;
  event: GravityEvent;
  skills: readonly LawSkill[];
}): { result: EnforcementResult; state: GravityState } {
  let violations = [] as ReturnType<LawSkill["validate"]>;
  for (const skill of args.skills) {
    const next = skill.validate(args.state, args.event);
    if (next.length > 0) {
      violations = violations.concat(next);
    }
  }

  if (violations.length === 0) {
    return {
      result: {
        decision: "allow",
        state: args.state,
        violations,
      },
      state: args.state,
    };
  }

  let nextState = args.state;
  for (const skill of args.skills) {
    const relevant = violations.filter((v) => v.lawId === skill.id);
    if (relevant.length === 0) {
      continue;
    }
    nextState = skill.normalize(nextState, relevant);
  }

  return {
    result: {
      decision: allViolationsGrantable(violations) ? "null" : "deny",
      state: nextState,
      violations,
    },
    state: nextState,
  };
}

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
    let result: EnforcementResult;
    try {
      const evaluated = evaluateGravityEvent({
        state,
        event,
        skills,
      });
      result = evaluated.result;
      state = evaluated.state;
    } catch (error) {
      deps.emitPanic?.(error);
      continue;
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
