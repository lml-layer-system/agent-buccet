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

// Negations and destructive verbs a user actually types. "don't" also arrives as
// "dont" and with a typographic apostrophe (phones/macOS auto-curl it), which is
// normalized before matching; "remove"/"erase"/"wipe"/"rm" mean the same thing.
const NEGATION = String.raw`(?:do\s+not|don'?t|never|must\s+not|mustn'?t|should\s+not|shouldn'?t|cannot|can'?t)`;
const DESTRUCTIVE_VERB = String.raw`(?:delete|remove|erase|wipe|rm|trash|destroy|unlink|shred)`;
const DELETE_NEGATION_PREFIX = new RegExp(String.raw`\b${NEGATION}\s+${DESTRUCTIVE_VERB}\b`, "i");
const DELETE_NEGATION_CLAUSE = new RegExp(
  String.raw`\b${NEGATION}\s+${DESTRUCTIVE_VERB}\s+([^.!?\n;]+)`,
  "gi",
);
// Shell commands that remove a file from its path.
const DESTRUCTIVE_COMMAND = /(?:^|[\s;&|(])(?:rm|rmdir|unlink|shred|del|erase|trash|mv)(?=\s)/i;

function normalizeApostrophes(value: string): string {
  return value.replace(/[‘’ʼ´`]/g, "'");
}
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

  for (const match of userInput.matchAll(DELETE_NEGATION_CLAUSE)) {
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

/**
 * Does this action remove `target` from where it lives? A delete obviously; a
 * move/rename takes it away from its path just the same; and a shell command
 * that runs rm/unlink/shred/mv on it. (An overwrite is an edit, not a delete,
 * and is deliberately not treated as one.)
 */
function removesTarget(args: {
  actionKind: BoundaryActionKind;
  target: string;
  payloadSummary?: string;
}): { removes: boolean; subject: string } {
  if (args.actionKind === "fs.delete" || args.actionKind === "fs.move") {
    return { removes: true, subject: args.target };
  }
  if (args.actionKind === "tool.exec") {
    const command = [args.target, args.payloadSummary ?? ""].join(" ").trim();
    return { removes: DESTRUCTIVE_COMMAND.test(` ${command}`), subject: command };
  }
  return { removes: false, subject: args.target };
}

function inferDeleteConstraintSignals(args: {
  actionKind: BoundaryActionKind;
  target: string;
  payloadSummary?: string;
  reviewContext?: BoundaryReviewContext;
}): BoundaryTimeConstraintSignals {
  const rawInput = args.reviewContext?.userInput?.trim();
  const userInput = rawInput ? normalizeApostrophes(rawInput) : undefined;
  const removal = removesTarget(args);
  if (!removal.removes || !userInput || !DELETE_NEGATION_PREFIX.test(userInput)) {
    return { flags: {} };
  }

  const extracted = extractDeleteConstraintTargets(userInput);
  const matchingTarget = extracted.targets.find((target) =>
    deleteConstraintMatchesTarget(removal.subject, target),
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
  payloadSummary?: string;
  reviewContext?: BoundaryReviewContext;
}): BoundaryTimeConstraintSignals {
  return inferDeleteConstraintSignals(args);
}
