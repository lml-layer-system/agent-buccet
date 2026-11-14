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

/**
 * User time constraints: explicit prohibitions in the user's own message for
 * this turn ("don't delete notes.txt", "don't touch config.yml", "don't send
 * secrets.json anywhere"). A matching action is flagged violatesUserConstraint;
 * META.NOVELTY.01 then holds it for review, and standing allows do not
 * auto-approve it (see user-path-ledger).
 *
 * Three kinds, by what the user forbade:
 *   destroy — delete/remove/erase/wipe/rm/…: anything that destroys the file's
 *             content or takes it away from its path — delete, move, an
 *             OVERWRITE (fs.write replaces the content), or a destructive or
 *             truncating shell command.
 *   modify  — edit/modify/change/overwrite/alter/update/touch/…: every
 *             mutation — the destroy set plus append and mutating commands.
 *   send    — send/share/upload/post/email/leak/forward/…: any outbound
 *             transfer (network/comm, or a network shell command) that names it.
 */
type ConstraintKind = "destroy" | "modify" | "send";

// "don't" also arrives as "dont" and with a typographic apostrophe (phones and
// macOS auto-curl it), which is normalized before matching.
const NEGATION = String.raw`(?:do\s+not|don'?t|never|must\s+not|mustn'?t|should\s+not|shouldn'?t|cannot|can'?t)`;
const VERBS: Record<ConstraintKind, string> = {
  destroy: String.raw`(?:delete|remove|erase|wipe|rm|trash|destroy|unlink|shred)`,
  modify: String.raw`(?:edit|modify|change|overwrite|alter|update|rewrite|touch|mess\s+with|write\s+to)`,
  send: String.raw`(?:send|share|upload|post|e-?mail|leak|transmit|forward|publish|exfiltrate|paste)`,
};
const CONSTRAINT_LAW_IDS: Record<ConstraintKind, string> = {
  destroy: "TIME.CONSTRAINT.DELETE.01",
  modify: "TIME.CONSTRAINT.MODIFY.01",
  send: "TIME.CONSTRAINT.SEND.01",
};
const CONSTRAINT_NOUN: Record<ConstraintKind, string> = {
  destroy: "deleting",
  modify: "modifying",
  send: "sending",
};
const CONSTRAINT_LABEL = "Action conflicts with the user time constraint.";

// Clause = the object of the prohibition up to the end of the sentence. A dot
// followed by a word character stays inside the clause, so "notes.txt" is one
// target, not "notes".
const clauseRegex = (kind: ConstraintKind) =>
  new RegExp(String.raw`\b${NEGATION}\s+${VERBS[kind]}\s+((?:[^.!?\n;]|\.(?=\w))+)`, "gi");

// Shell commands that destroy a file's content or take it away from its path:
// rm/unlink/shred/mv/…, truncate, dd of=, and a single `>` redirect (not `>>`).
const DESTRUCTIVE_COMMAND =
  /(?:^|[\s;&|(])(?:rm|rmdir|unlink|shred|del|erase|trash|mv|truncate)(?=\s)|\bdd\b[^;&|]*\bof=|(?:^|[^>&0-9])>(?!>)/i;
// Additionally mutating (modify kind): appends, in-place edits, tee, copies onto.
const MUTATING_COMMAND =
  /(?:^|[\s;&|(])(?:sed\s+-i|perl\s+-[a-z]*i|tee|cp|install|chmod|chown|touch|patch)(?=\s)|>>/i;
// Outbound transfer commands (send kind).
const NETWORK_COMMAND =
  /(?:^|[\s;&|(])(?:curl|wget|scp|sftp|rsync|nc|ncat|ftp|http|httpie|aws\s+s3|gsutil|rclone)(?=\s)/i;

const GLOBAL_TAIL = /\b(?:anything|any(?:thing| files?)|files?|them|it|this|that|whatever)\b/i;

function normalizeApostrophes(value: string): string {
  return value.replace(/[‘’ʼ´`]/g, "'");
}

function normalizeActionTarget(target: string): string {
  return target.toLowerCase().replaceAll("\\", "/");
}

function normalizeConstraintLiteral(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("\\", "/")
    .replace(/\b(?:the|a|an|my|this|that|these|those)\b/g, " ")
    .replace(/\b(?:file|files|path|paths|folder|folders|directory|directories)\b/g, " ")
    .replace(/\b(?:anywhere|anyone|to anyone|please|ever|again)\b/g, " ")
    .replace(/[,;:!?]+/g, " ")
    .replace(/\.(?!\w)/g, " ") // sentence dots go; dots inside names (notes.txt) stay
    .replace(/\s+/g, " ")
    .trim();
}

function extractConstraintTargets(
  userInput: string,
  kind: ConstraintKind,
): { matchAll: boolean; targets: string[] } {
  const targets: string[] = [];
  let matchAll = false;

  for (const match of userInput.matchAll(clauseRegex(kind))) {
    const clause = match[1]?.trim();
    if (!clause) {
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
    // Path-like tokens name the protected thing most precisely ("notes.txt",
    // "/ws/keep", "config\\app.yml"), even inside a longer clause like "notes.txt
    // in the backup folder" or "any files in /ws/keep".
    const pathTokens = clause
      .split(/\s+/)
      .map((token) => token.replace(/^[("'`]+|[)"'`,;:!?]+$/g, "").replace(/\.$/, ""))
      .filter((token) => /[/\\]/.test(token) || /\w\.[A-Za-z0-9]{1,8}$/.test(token))
      .map(normalizeConstraintLiteral)
      .filter(Boolean);
    const normalizedClause = normalizeConstraintLiteral(clause);
    if (GLOBAL_TAIL.test(clause) && pathTokens.length === 0) {
      matchAll = true; // "don't delete anything" / "don't touch them"
      continue;
    }
    targets.push(...pathTokens);
    if (normalizedClause && pathTokens.length === 0) {
      targets.push(normalizedClause);
    }
  }

  return { matchAll, targets: [...new Set(targets)] };
}

function constraintMatchesSubject(subject: string, constraintTarget: string): boolean {
  const normalizedSubject = normalizeActionTarget(subject);
  const normalizedConstraint = normalizeConstraintLiteral(constraintTarget);
  if (!normalizedConstraint) {
    return false;
  }
  const subjectBase = path.basename(normalizedSubject);
  const constraintBase = path.basename(normalizedConstraint);
  return (
    normalizedSubject.includes(normalizedConstraint) ||
    subjectBase === normalizedConstraint ||
    subjectBase === constraintBase ||
    normalizedSubject.endsWith(`/${constraintBase}`)
  );
}

/**
 * The text an action's constraint is matched against, and whether the action
 * is of a kind that the given prohibition forbids.
 */
function actionSubject(
  kind: ConstraintKind,
  args: { actionKind: BoundaryActionKind; target: string; payloadSummary?: string },
): string | null {
  const command = ` ${[args.target, args.payloadSummary ?? ""].join(" ").trim()}`;
  switch (kind) {
    case "destroy":
      if (["fs.delete", "fs.move", "fs.write"].includes(args.actionKind)) return args.target;
      if (args.actionKind === "tool.exec" && DESTRUCTIVE_COMMAND.test(command)) return command;
      return null;
    case "modify":
      if (["fs.write", "fs.append", "fs.delete", "fs.move"].includes(args.actionKind)) {
        return args.target;
      }
      if (
        args.actionKind === "tool.exec" &&
        (DESTRUCTIVE_COMMAND.test(command) || MUTATING_COMMAND.test(command))
      ) {
        return command;
      }
      return null;
    case "send":
      if (["network.send", "comm.send", "email.send", "message.send"].includes(args.actionKind)) {
        return command;
      }
      if (args.actionKind === "tool.exec" && NETWORK_COMMAND.test(command)) return command;
      return null;
  }
}

export function inferBoundaryTimeConstraintSignals(args: {
  actionKind: BoundaryActionKind;
  target: string;
  payloadSummary?: string;
  reviewContext?: BoundaryReviewContext;
}): BoundaryTimeConstraintSignals {
  const rawInput = args.reviewContext?.userInput?.trim();
  if (!rawInput) {
    return { flags: {} };
  }
  const userInput = normalizeApostrophes(rawInput);

  for (const kind of ["destroy", "modify", "send"] as const) {
    if (!new RegExp(String.raw`\b${NEGATION}\s+${VERBS[kind]}\b`, "i").test(userInput)) continue;
    const subject = actionSubject(kind, args);
    if (subject === null) continue;

    const extracted = extractConstraintTargets(userInput, kind);
    const matchingTarget = extracted.targets.find((target) =>
      constraintMatchesSubject(subject, target),
    );
    if (!extracted.matchAll && !matchingTarget) continue;

    const evidence = extracted.matchAll
      ? [
          `User explicitly prohibited ${CONSTRAINT_NOUN[kind]} anything.`,
          `Attempted ${args.actionKind} targeted ${args.target}.`,
        ]
      : [
          `User explicitly prohibited ${CONSTRAINT_NOUN[kind]} ${matchingTarget}.`,
          `Attempted ${args.actionKind} targeted ${args.target}.`,
        ];
    return {
      flags: { violatesUserConstraint: true },
      reviewContext: {
        invariantLawId: CONSTRAINT_LAW_IDS[kind],
        invariantLabel: CONSTRAINT_LABEL,
        evidence,
      },
    };
  }
  return { flags: {} };
}
