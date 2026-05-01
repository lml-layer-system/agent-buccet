import type {
  EnforcementResult,
  GravityEvent,
  GravityKernelDeps,
  GravityState,
  LawSkill,
  LawViolation,
} from "./types.ts";
import { allViolationsGrantable } from "./types.ts";

function buildSkillErrorViolation(args: {
  lawId: string;
  phase: "validate" | "normalize";
  error: unknown;
}): LawViolation {
  const message = args.error instanceof Error ? args.error.message : String(args.error);
  return {
    lawId: args.lawId,
    code: args.phase === "validate" ? "LAW_SKILL_VALIDATE_ERROR" : "LAW_SKILL_NORMALIZE_ERROR",
    message: `${args.phase} failed inside gravity law-skill ${args.lawId}: ${message}`,
  };
}

export function evaluateGravityEvent(args: {
  state: GravityState;
  event: GravityEvent;
  skills: readonly LawSkill[];
  onSkillError?: (error: {
    phase: "validate" | "normalize";
    lawId: string;
    error: unknown;
  }) => void;
}): { result: EnforcementResult; state: GravityState } {
  let violations = [] as ReturnType<LawSkill["validate"]>;
  for (const skill of args.skills) {
    let next: ReturnType<LawSkill["validate"]>;
    try {
      next = skill.validate(args.state, args.event);
    } catch (error) {
      args.onSkillError?.({
        phase: "validate",
        lawId: skill.id,
        error,
      });
      violations = violations.concat(buildSkillErrorViolation({
        lawId: skill.id,
        phase: "validate",
        error,
      }));
      continue;
    }
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
    try {
      nextState = skill.normalize(nextState, relevant);
    } catch (error) {
      args.onSkillError?.({
        phase: "normalize",
        lawId: skill.id,
        error,
      });
      violations = violations.concat(buildSkillErrorViolation({
        lawId: skill.id,
        phase: "normalize",
        error,
      }));
    }
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
        onSkillError: ({ phase, lawId, error }) => {
          deps.emitPanic?.({
            kind: phase === "validate" ? "law-skill-validate-error" : "law-skill-normalize-error",
            lawId,
            error,
          });
        },
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
