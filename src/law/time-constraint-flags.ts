import path from "node:path";
import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryReviewContext,
} from "./../runtime/types.ts";

type BoundaryTimeConstraintSignals = {
  flags: BoundaryActionRequest["flags"];
  reviewContext?: Partial<BoundaryReviewContext>;
};

const DELETE_NEGATION_PREFIX =
  /\b(?:do not|don't|never|must not|should not|cannot|can't)\s+delete\b/i;
const DELETE_GLOBAL_TAIL =
  /\b(?:anything|any(?:thing| files?)|files?|them|it|this|that|whatever)\b/i;
const DELETE_CONSTRAINT_LAW_ID = "TIME.CONSTRAINT.DELETE.01";
const DELETE_CONSTRAINT_LABEL = "Action conflicts with the user time constraint.";

function normalizeActionTarget(target: string): string {
  return target.toLowerCase().replaceAll("\\", "/");
}

function normalizeConstraintLiteral(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("\\", "/")
    .replace(/\b(?:the|a|an|my|this|that|these|those)\b/g, " ")
    .replace(/\b(?:file|files|path|paths|folder|folders|directory|directories)\b/g, " ")
    .replace(/[.,;:!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDeleteConstraintTargets(userInput: string): {
  matchAll: boolean;
  targets: string[];
} {
  const targets: string[] = [];
  let matchAll = false;

  for (const match of userInput.matchAll(
    /\b(?:do not|don't|never|must not|should not|cannot|can't)\s+delete\s+([^.!?\n;]+)/gi,
  )) {
    const clause = match[1]?.trim();
    if (!clause) {
      continue;
    }
    if (DELETE_GLOBAL_TAIL.test(clause)) {
      matchAll = true;
      continue;
    }

    const quotedTargets = [...clause.matchAll(/["']([^"']+)["']/g)]
      .map((item) => item[1]?.trim())
      .filter(Boolean) as string[];
    if (quotedTargets.length > 0) {
      for (const target of quotedTargets) {
        const normalized = normalizeConstraintLiteral(target);
        if (normalized) {
          targets.push(normalized);
        }
      }
      continue;
    }

    const normalizedClause = normalizeConstraintLiteral(clause);
    if (normalizedClause) {
      targets.push(normalizedClause);
    }
  }

  return {
    matchAll,
    targets: [...new Set(targets)],
  };
}

function deleteConstraintMatchesTarget(target: string, constraintTarget: string): boolean {
  const normalizedTarget = normalizeActionTarget(target);
  const normalizedConstraint = normalizeConstraintLiteral(constraintTarget);
  if (!normalizedConstraint) {
    return false;
  }

  const targetBase = path.basename(normalizedTarget);
  const constraintBase = path.basename(normalizedConstraint);
  return (
    normalizedTarget.includes(normalizedConstraint) ||
    targetBase === normalizedConstraint ||
    targetBase === constraintBase ||
    normalizedTarget.endsWith(`/${constraintBase}`)
  );
}

function inferDeleteConstraintSignals(args: {
  actionKind: BoundaryActionKind;
  target: string;
  reviewContext?: BoundaryReviewContext;
}): BoundaryTimeConstraintSignals {
  const userInput = args.reviewContext?.userInput?.trim();
  if (args.actionKind !== "fs.delete" || !userInput || !DELETE_NEGATION_PREFIX.test(userInput)) {
    return { flags: {} };
  }

  const extracted = extractDeleteConstraintTargets(userInput);
  const matchingTarget = extracted.targets.find((target) =>
    deleteConstraintMatchesTarget(args.target, target),
  );
  if (!extracted.matchAll && !matchingTarget) {
    return { flags: {} };
  }

  const evidence = extracted.matchAll
    ? ["User explicitly prohibited deletion.", `Attempted delete targeted ${args.target}.`]
    : [
        `User explicitly prohibited deleting ${matchingTarget}.`,
        `Attempted delete targeted ${args.target}.`,
      ];

  return {
    flags: {
      violatesUserConstraint: true,
    },
    reviewContext: {
      invariantLawId: DELETE_CONSTRAINT_LAW_ID,
      invariantLabel: DELETE_CONSTRAINT_LABEL,
      evidence,
    },
  };
}

export function inferBoundaryTimeConstraintSignals(args: {
  actionKind: BoundaryActionKind;
  target: string;
  reviewContext?: BoundaryReviewContext;
}): BoundaryTimeConstraintSignals {
  return inferDeleteConstraintSignals(args);
}
