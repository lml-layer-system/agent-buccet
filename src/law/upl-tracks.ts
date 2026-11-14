/**
 * UPL Tracks — Post-law execution corridor enforcement.
 *
 * Purpose: narrow post-law execution from infinite recursive possibility into
 * finite lawful motion. Once UPL law is recorded on a tracked surface, execution
 * must stay inside the corridor that law put into motion. The model does not
 * return to open-ended general agency; it enters a narrow lawful channel.
 *
 * Surface scope — UPL Tracks apply ONLY to the two post-law continuation surfaces:
 *
 *   • Tool / Action Boundary  — fs.*, tool.exec, network.send, comm.send, db.*, sys.*
 *   • Chat / Output Boundary  — chat.emit
 *
 * UPL Tracks do NOT apply to:
 *
 *   • Input Admission Boundary  — ingress is a catch/freeze/hold/deny front-line,
 *                                  not a post-law continuation corridor.
 *   • Payload-Physics Boundary  — hard containment / ceiling enforcement, not
 *                                  semantic execution shaping.
 *
 * Two pure functions:
 *   buildAutoTrackConstraint — auto-derive the track corridor from a UPL-bearing request
 *   checkTrackConstraint     — validate an incoming request against an active corridor
 */

import path from "node:path";
import { checkExpressionCorridor } from "./../runtime/expression-track-extractor.ts";
import {
  checkCompletionCorridor,
  checkOutputCorridor,
} from "./../runtime/output-track-extractor.ts";
import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryUplTrackConstraint,
} from "./../runtime/types.ts";

/** All filesystem action kinds. */
const FS_ACTION_KINDS: BoundaryActionKind[] = [
  "fs.read",
  "fs.write",
  "fs.append",
  "fs.delete",
  "fs.mkdir",
  "fs.move",
];

/** All database action kinds. */
const DB_ACTION_KINDS: BoundaryActionKind[] = ["db.query", "db.insert", "db.update", "db.delete"];

/** All system action kinds. */
const SYS_ACTION_KINDS: BoundaryActionKind[] = [
  "sys.env.read",
  "sys.env.write",
  "sys.config.read",
  "sys.config.write",
  "sys.credential.read",
  "sys.credential.use",
];

/**
 * All action kinds that belong to the two post-law execution surfaces where
 * UPL Tracks are in scope:
 *
 *   Tool / Action Boundary  — all fs.*, tool.exec, network.send, comm.send, db.*, sys.*
 *   Chat / Output Boundary  — chat.emit
 *
 * Admission and Physics surfaces are excluded by design.
 */
export const TRACK_SURFACE_ACTION_KINDS = new Set<BoundaryActionKind>([
  ...FS_ACTION_KINDS,
  "agent.spend",
  "tool.exec",
  "network.send",
  "comm.send",
  ...DB_ACTION_KINDS,
  ...SYS_ACTION_KINDS,
  "chat.emit",
]);

/**
 * Returns true if the action kind belongs to a UPL-Track-eligible execution surface.
 *
 * Only Tool/Action and Chat/Output surface kinds are eligible.
 * Admission and Physics surface kinds are never tracked.
 */
export function isTrackSurface(actionKind: BoundaryActionKind): boolean {
  return TRACK_SURFACE_ACTION_KINDS.has(actionKind);
}

/**
 * Extract the domain prefix from a network/URL target.
 * "https://api.example.com/v1/data" → "https://api.example.com"
 * "api.example.com" → "api.example.com"
 */
function extractNetworkDomain(target: string): string {
  try {
    const url = new URL(target.startsWith("http") ? target : `https://${target}`);
    return `${url.protocol}//${url.host}`;
  } catch {
    // Not a URL — use the target up to the first slash
    const slashIndex = target.indexOf("/");
    return slashIndex > 0 ? target.slice(0, slashIndex) : target;
  }
}

/**
 * Extract the command name from a tool.exec target or payloadSummary.
 * "spawn:git commit -m 'msg'" → "git"
 * "make" → "make"
 * "/usr/bin/python3 script.py" → "python3"
 */
function extractCommandName(raw: string): string {
  const withoutSpawn = raw.replace(/^spawn:/, "").trim();
  const firstToken = withoutSpawn.split(/\s+/)[0] ?? withoutSpawn;
  // Strip directory prefix — keep only the base name
  return path.basename(firstToken);
}

/**
 * Build a track constraint automatically from an approved request.
 *
 * Called when a tracked UPL entry is written.
 * The constraint narrows the active execution corridor to match the law
 * the user just set in motion — preventing mission creep after law is set.
 *
 * Returns undefined for action kinds outside the UPL Tracks surface scope
 * (i.e. anything not in TRACK_SURFACE_ACTION_KINDS). Callers should check
 * isTrackSurface() before calling, but this function is safe to call directly.
 */
export function buildAutoTrackConstraint(
  request: BoundaryActionRequest,
): BoundaryUplTrackConstraint | undefined {
  if (!isTrackSurface(request.actionKind)) {
    return undefined;
  }

  const [domain] = request.actionKind.split(".");

  switch (domain) {
    case "fs": {
      // Keep filesystem tracks action-exact and directory-scoped for now.
      // This still prevents scope widening out of the approved working lane.
      const parentDir = path.dirname(request.target);
      return {
        allowedActionKinds: [request.actionKind],
        targetPattern: parentDir === "." ? undefined : parentDir,
        targetMatchMode: "prefix",
        description: `${request.actionKind} within ${parentDir === "." ? "current dir" : parentDir}`,
      };
    }

    case "tool": {
      // Allow only tool.exec, constrained to the same command name.
      const commandName = extractCommandName(request.payloadSummary ?? request.target);
      return {
        allowedActionKinds: ["tool.exec"],
        targetPattern: commandName || undefined,
        targetMatchMode: "exact",
        description: `tool.exec: ${commandName || request.target}`,
      };
    }

    case "agent": {
      if (request.actionKind !== "agent.spend" || !request.spendIntent) {
        return undefined;
      }
      return {
        allowedActionKinds: ["agent.spend"],
        targetPattern: request.spendIntent.destination,
        targetMatchMode: "exact",
        spendMaxAmountNormalized: request.spendIntent.amountNormalized,
        spendAllowedDestinationKinds: [request.spendIntent.destinationKind],
        spendAllowedSourceAuthorityKinds: [request.spendIntent.sourceAuthorityKind],
        spendAllowedCommitIntents: [request.spendIntent.commitIntent],
        spendAllowedPrincipals: [request.spendIntent.principal],
        spendAllowedPurposes: [request.spendIntent.purpose],
        spendAllowedBucketIds: [request.spendIntent.bucketId],
        spendAllowedRiskClasses: [request.spendIntent.riskClass],
        spendRecurringAllowed: request.spendIntent.recurring,
        // A standing spend law always carries a CUMULATIVE bound. Without one,
        // approving a single $X spend "as law" let an autonomous agent repeat
        // it without limit (each spend under the per-spend cap, amounts varied
        // by a cent to dodge the identity-keyed recursion guard). When the
        // approved packet declared no period cap, default to the most
        // conservative reading: the approved amount per 24h.
        spendMaxPeriodAmountNormalized:
          request.spendIntent.periodCapNormalized ?? request.spendIntent.amountNormalized,
        spendPeriodWindow: request.spendIntent.periodWindow ?? "24h",
        description: `agent spend to ${request.spendIntent.destination} under ${request.spendIntent.amountNormalized}`,
      };
    }

    case "chat": {
      // Chat tracks bind to the chat surface and, when present, the same invariant
      // law that triggered the review. This narrows post-law motion without claiming
      // full output-grammar enforcement yet.
      return {
        allowedActionKinds: ["chat.emit"],
        reviewSurface: "chat",
        reviewInvariantLawId: request.reviewContext?.invariantLawId,
        outputShape: inferChatOutputShape(request.reviewContext?.attemptedOutput),
        description: request.reviewContext?.invariantLawId
          ? `chat emission under ${request.reviewContext.invariantLawId}`
          : "chat emission only",
      };
    }

    case "network": {
      const domain = extractNetworkDomain(request.target);
      return {
        allowedActionKinds: ["network.send"],
        targetPattern: domain,
        targetMatchMode: "exact",
        description: `network.send to ${domain}`,
      };
    }

    case "db": {
      // Keep DB tracks exact to the approved action kind and database target.
      return {
        allowedActionKinds: [request.actionKind],
        targetPattern: request.target,
        targetMatchMode: "exact",
        description: `${request.actionKind} on ${request.target}`,
      };
    }

    case "sys": {
      // Keep system tracks exact to the approved action kind and target.
      return {
        allowedActionKinds: [request.actionKind],
        targetPattern: request.target,
        targetMatchMode: "exact",
        description: `${request.actionKind} on ${request.target}`,
      };
    }

    case "comm": {
      return {
        allowedActionKinds: ["comm.send"],
        targetPattern: request.target,
        targetMatchMode: "exact",
        description: `comm.send to ${request.target}`,
      };
    }

    default:
      // Should be unreachable: isTrackSurface() guards above cover all known
      // track-eligible action kinds. If a new surface kind is added, extend
      // TRACK_SURFACE_ACTION_KINDS and add a case here.
      return undefined;
  }
}

function inferChatOutputShape(
  output: string | undefined,
): BoundaryUplTrackConstraint["outputShape"] | undefined {
  if (!output) {
    return undefined;
  }
  const trimmed = output.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // ignore
    }
  }
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length > 1 && lines.every((line) => /^[-*]\s+/.test(line))) {
    return "bullets";
  }
  if (lines.length > 1 && lines.every((line) => /^\d+\.\s+/.test(line))) {
    return "numbered";
  }
  return "paragraph";
}

// Allowed flags whitelist — blocks flag injection from user-supplied UPL patterns.
const _REGEX_ALLOWED_FLAGS = /^[gimu]*$/;
// Caps: bound the pattern body and the text matched against it so that even a
// safe pattern cannot be weaponised with a pathological input.
const _REGEX_MAX_BODY = 400;
const _REGEX_MAX_INPUT = 8192;

// ---- Linear-time regex gate (ReDoS defense) ----
//
// A corridor regex is only compiled and run if it is provably free of
// catastrophic backtracking. The guarantee rests on two structural rules:
//
//   1. No quantifier may be applied to a GROUP ( `)*`, `)+`, `){n,}` ) — this
//      removes the exponential family ( `(a+)+`, `(a|a)*`, `(.*)*` ).
//   2. No two UNBOUNDED quantifiers whose atoms can match a COMMON character
//      may sit next to each other, even across zero-width/optional atoms in
//      between — this removes the polynomial family ( `.*.*`, `\w+\w+`,
//      `[a-z]+[a-z]+`, `\w+x?\w+` ).
//
// Quantifiers separated by a mandatory distinct literal (e.g. the many `\s+`
// runs in `git\s+status...rg\b`) stay linear and are accepted. The old guard
// only looked for a `)`-prefixed quantifier, so group-less adjacent stars like
// `.*.*.*` slipped through and backtracked super-linearly.
type RegexAtom = { cls: Set<number>; unbounded: boolean; optional: boolean; group?: RegexSeq };
type RegexSeq = RegexAtom[][]; // alternation runs, each a concatenation of atoms

const _ASCII = 128;
function _classAll(): Set<number> {
  const s = new Set<number>();
  for (let i = 0; i < _ASCII; i++) s.add(i);
  return s;
}
function _classPred(f: (c: string) => boolean): Set<number> {
  const s = new Set<number>();
  for (let i = 0; i < _ASCII; i++) if (f(String.fromCharCode(i))) s.add(i);
  return s;
}
const _CLASS_WORD = _classPred((c) => /[A-Za-z0-9_]/.test(c));
const _CLASS_DIGIT = _classPred((c) => /[0-9]/.test(c));
const _CLASS_SPACE = _classPred((c) => /\s/.test(c));
function _complement(s: Set<number>): Set<number> {
  const r = new Set<number>();
  for (let i = 0; i < _ASCII; i++) if (!s.has(i)) r.add(i);
  return r;
}
function _classOfEscape(ch: string): Set<number> {
  if (ch === "w") return _CLASS_WORD;
  if (ch === "d") return _CLASS_DIGIT;
  if (ch === "s") return _CLASS_SPACE;
  if (ch === "W") return _complement(_CLASS_WORD);
  if (ch === "D") return _complement(_CLASS_DIGIT);
  if (ch === "S") return _complement(_CLASS_SPACE);
  return new Set<number>([ch.charCodeAt(0) & 0x7f]);
}
function _classOfCharClass(src: string): Set<number> {
  const neg = src[1] === "^";
  const body = src.slice(neg ? 2 : 1, -1);
  const s = new Set<number>();
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\") {
      for (const x of _classOfEscape(body[i + 1] ?? "")) s.add(x);
      i++;
      continue;
    }
    if (body[i + 1] === "-" && body[i + 2] !== undefined && body[i + 2] !== "]") {
      const a = c.charCodeAt(0);
      const b = body[i + 2].charCodeAt(0);
      for (let k = a; k <= b && k < _ASCII; k++) s.add(k);
      i += 2;
      continue;
    }
    if (c.charCodeAt(0) < _ASCII) s.add(c.charCodeAt(0));
  }
  return neg ? _complement(s) : s;
}
function _classesOverlap(a: Set<number>, b: Set<number>): boolean {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (big.has(x)) return true;
  return false;
}
function _parseRegexSeq(body: string, start: number, end: number): RegexSeq {
  const runs: RegexAtom[][] = [[]];
  let i = start;
  while (i < end) {
    const c = body[i];
    let atom: RegexAtom | null = null;
    let consumed = 1;
    if (c === "\\") {
      atom = { cls: _classOfEscape(body[i + 1] ?? ""), unbounded: false, optional: false };
      consumed = 2;
    } else if (c === "[") {
      let j = i + 1;
      if (body[j] === "^") j++;
      if (body[j] === "]") j++;
      while (j < end && body[j] !== "]") {
        if (body[j] === "\\") j++;
        j++;
      }
      const src = body.slice(i, j + 1);
      atom = { cls: _classOfCharClass(src), unbounded: false, optional: false };
      consumed = src.length;
    } else if (c === "(") {
      let depth = 0;
      let j = i;
      for (; j < end; j++) {
        if (body[j] === "\\") {
          j++;
          continue;
        }
        if (body[j] === "(") depth++;
        else if (body[j] === ")") {
          depth--;
          if (depth === 0) break;
        }
      }
      const prefix = body.slice(i).match(/^\(\?[a-z]*:/) ??
        body.slice(i).match(/^\(\?[:=!]/) ?? ["("];
      const inner = _parseRegexSeq(body, i + prefix[0].length, j);
      atom = { cls: _classAll(), unbounded: false, optional: false, group: inner };
      consumed = j - i + 1;
    } else if (c === "|") {
      runs.push([]);
      i++;
      continue;
    } else if (c === ".") {
      atom = { cls: _classAll(), unbounded: false, optional: false };
      consumed = 1;
    } else if (c === "^" || c === "$") {
      atom = null;
      consumed = 1;
    } else {
      atom = { cls: new Set<number>([c.charCodeAt(0) & 0x7f]), unbounded: false, optional: false };
      consumed = 1;
    }
    i += consumed;
    if (i < end && atom) {
      const q = body[i];
      if (q === "*") {
        atom.unbounded = true;
        atom.optional = true;
        i++;
        if (body[i] === "?" || body[i] === "+") i++;
      } else if (q === "+") {
        atom.unbounded = true;
        i++;
        if (body[i] === "?" || body[i] === "+") i++;
      } else if (q === "?") {
        atom.optional = true;
        i++;
        if (body[i] === "?") i++;
      } else if (q === "{") {
        const m = body.slice(i).match(/^\{(\d*),?(\d*)\}/);
        if (m) {
          atom.unbounded = /,\}$/.test(m[0]);
          atom.optional = /^\{0?,/.test(m[0]) || /^\{0\}/.test(m[0]);
          i += m[0].length;
          if (body[i] === "?") i++;
        }
      }
    }
    if (atom) runs[runs.length - 1].push(atom);
  }
  return runs;
}
function _hasAdjacentOverlap(seq: RegexSeq): boolean {
  for (const run of seq) {
    for (let k = 0; k < run.length; k++) {
      if (!run[k].unbounded) continue;
      // Walk forward over atoms that can be zero-width (optional / `*`) to the
      // next unbounded quantifier: if its atom shares a character with run[k],
      // the two can backtrack against overlapping input — reject.
      for (let m = k + 1; m < run.length; m++) {
        const mid = run[m];
        if (mid.unbounded) {
          if (_classesOverlap(run[k].cls, mid.cls)) return true;
          if (!mid.optional) break;
          continue;
        }
        if (mid.optional) continue;
        break;
      }
    }
    for (const atom of run) {
      if (atom.group && _hasAdjacentOverlap(atom.group)) return true;
    }
  }
  return false;
}
/**
 * Compile a corridor regex body only if it is provably linear-time; otherwise
 * return null. Null means "unsafe or malformed" — callers must resolve it
 * fail-closed per corridor polarity, never by silently falling back to a
 * substring of the raw pattern (that degrade made protective DENY rails
 * evaporate).
 */
function compileLinearTrackRegex(body: string, flags: string): RegExp | null {
  if (!_REGEX_ALLOWED_FLAGS.test(flags)) return null;
  if (body.length > _REGEX_MAX_BODY) return null;
  if (/\)\s*[*+{]/.test(body)) return null; // quantifier on a group — exponential family
  let seq: RegexSeq;
  try {
    seq = _parseRegexSeq(body, 0, body.length);
  } catch {
    return null;
  }
  if (_hasAdjacentOverlap(seq)) return null; // adjacent overlapping quantifiers — polynomial family
  try {
    return new RegExp(body, flags);
  } catch {
    return null;
  }
}

/**
 * Match `text` against a corridor `pattern`.
 *
 * A `/body/flags` literal is treated as a regex and compiled through the
 * linear-time gate; a plain string is a case-insensitive substring corridor.
 * When a regex literal cannot be safely compiled, this returns
 * `onUnsafeRegex` — the caller's fail-closed value for that corridor's
 * polarity (deny rails pass `true` so an unusable deny pattern still fires;
 * allow rails pass `false` so an unusable allow pattern grants nothing). It is
 * NEVER downgraded to a substring match of the raw slashed pattern.
 */
function matchesTrackPattern(text: string, pattern: string, onUnsafeRegex = false): boolean {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) {
    return true;
  }
  const regexLiteral = trimmedPattern.match(/^\/(.+)\/([a-z]*)$/i);
  if (regexLiteral) {
    const re = compileLinearTrackRegex(regexLiteral[1], regexLiteral[2]);
    if (!re) {
      return onUnsafeRegex;
    }
    const bounded = text.length > _REGEX_MAX_INPUT ? text.slice(0, _REGEX_MAX_INPUT) : text;
    return re.test(bounded);
  }
  return text.toLowerCase().includes(trimmedPattern.toLowerCase());
}

function normalizeTrackTarget(target: string): string {
  return target.replaceAll("\\", "/");
}

function buildRequestTrackText(request: BoundaryActionRequest): string {
  return [
    request.actionKind,
    request.target,
    request.payloadSummary ?? "",
    request.spendIntent?.amountRaw ?? "",
    request.spendIntent?.currencyHint ?? "",
    request.spendIntent?.destination ?? "",
    request.spendIntent?.destinationKind ?? "",
    request.spendIntent?.sourceAuthorityKind ?? "",
    request.spendIntent?.commitIntent ?? "",
    request.spendIntent?.principal ?? "",
    request.spendIntent?.purpose ?? "",
    request.spendIntent?.bucketId ?? "",
    request.spendIntent?.termsSummary ?? "",
    String(request.spendIntent?.recurring ?? ""),
    request.spendIntent?.riskClass ?? "",
    request.spendIntent?.accountabilityRef ?? "",
    request.spendIntent?.instructionSource ?? "",
    request.spendIntent?.periodWindow ?? "",
    request.spendIntent?.periodCapNormalized !== undefined
      ? String(request.spendIntent.periodCapNormalized)
      : "",
    request.reviewContext?.question ?? "",
    request.reviewContext?.attemptedOutput ?? "",
    request.reviewContext?.userInput ?? "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Check whether an incoming request satisfies a UPL track constraint.
 *
 * Returns a human-readable violation reason string if the request exits the corridor,
 * or null if the request is within bounds.
 *
 * Target pattern matching defaults to path-prefix for path-like targets and
 * exact-match for everything else, unless targetMatchMode overrides it.
 */
export function checkTrackConstraint(
  constraint: BoundaryUplTrackConstraint,
  request: BoundaryActionRequest,
  options?: { unsafeRegexInsideCorridor?: boolean },
): string | null {
  // How an unsafe/malformed corridor regex resolves, fail-closed by polarity:
  // a DENY corridor (inside => deny) treats it as matching so the deny still
  // fires; an ALLOW corridor (inside => grant) treats it as non-matching so it
  // surfaces as a corridor exit (track_violation) and grants nothing.
  const onUnsafeRegex = options?.unsafeRegexInsideCorridor ?? false;
  const allowedActionKinds =
    constraint.actionCorridor?.allowedActionKinds ?? constraint.allowedActionKinds;
  // 1. Action kind must be in the allowed set.
  if (!allowedActionKinds.includes(request.actionKind)) {
    return (
      `action kind '${request.actionKind}' exits the approved execution corridor ` +
      `(corridor allows: ${allowedActionKinds.join(", ")})`
    );
  }

  // 2. Target must match the pattern (when present).
  const targetPatterns = [
    ...(constraint.actionCorridor?.targetPattern ? [constraint.actionCorridor.targetPattern] : []),
    ...(constraint.targetPatterns ?? []),
    ...(constraint.targetPattern ? [constraint.targetPattern] : []),
  ];
  if (targetPatterns.length > 0) {
    const target = request.target;
    const normalizedTarget = normalizeTrackTarget(target);

    // Path-like targets (start with / or . or contain a path separator): prefix match.
    const isPathLike =
      target.startsWith("/") ||
      target.startsWith("./") ||
      target.startsWith("../") ||
      target.includes(path.sep);

    const matchMode =
      constraint.actionCorridor?.targetMatchMode ??
      constraint.targetMatchMode ??
      (isPathLike ? "prefix" : "exact");
    // Resolve '.'/'..' lexically for filesystem-style targets so the corridor
    // rail agrees with the confined-fs executor. Without this, a corridor for
    // "/ws/project" accepts "/ws/project/../../etc/shadow" (the raw string still
    // starts with the pattern) even though it resolves OUTSIDE the corridor —
    // an allow-rail / executor disagreement that leans on the executor as the
    // only backstop. Normalizing the path makes the rail reject the escape.
    const lexicalPrefix = (value: string): string =>
      value.startsWith("/")
        ? path.posix.normalize(normalizeTrackTarget(value)).replace(/\/+$/, "") || "/"
        : value;
    const matches = targetPatterns.some((pattern) => {
      if (matchMode === "regex") {
        return matchesTrackPattern(normalizedTarget, pattern, onUnsafeRegex);
      }
      if (matchMode === "exact") {
        return target === pattern;
      }
      const t = lexicalPrefix(target);
      const p = lexicalPrefix(pattern);
      return t === p || t.startsWith(`${p}/`);
    });

    if (!matches) {
      return (
        `target '${target}' exits the approved target corridor '${targetPatterns.join(" | ")}' ` +
        `(track: ${constraint.description})`
      );
    }
  }

  if (constraint.requestTextPatterns?.length) {
    const requestText = buildRequestTrackText(request);
    const matches = constraint.requestTextPatterns.some((pattern) =>
      matchesTrackPattern(requestText, pattern, onUnsafeRegex),
    );
    if (!matches) {
      return `request text exits the approved execution corridor (track: ${constraint.description})`;
    }
  }

  if (constraint.requiredFlags?.length) {
    const flags = request.flags ?? {};
    const missingFlags = constraint.requiredFlags.filter((flag) => !flags[flag]);
    if (missingFlags.length > 0) {
      return `request flags exit the approved execution corridor (missing flags: ${missingFlags.join(", ")} | track: ${constraint.description})`;
    }
  }

  const spendIntent = request.spendIntent;
  if (
    constraint.spendMaxAmountNormalized !== undefined ||
    constraint.spendAllowedDestinationKinds?.length ||
    constraint.spendAllowedSourceAuthorityKinds?.length ||
    constraint.spendAllowedCommitIntents?.length ||
    constraint.spendAllowedPrincipals?.length ||
    constraint.spendAllowedPurposes?.length ||
    constraint.spendAllowedBucketIds?.length ||
    constraint.spendAllowedRiskClasses?.length ||
    constraint.spendRecurringAllowed !== undefined ||
    constraint.spendMaxPeriodAmountNormalized !== undefined ||
    constraint.spendPeriodWindow !== undefined
  ) {
    if (!spendIntent) {
      return `request exits the approved spend corridor (missing normalized spend intent | track: ${constraint.description})`;
    }
    if (
      constraint.spendMaxAmountNormalized !== undefined &&
      spendIntent.amountNormalized > constraint.spendMaxAmountNormalized
    ) {
      return (
        `spend amount '${spendIntent.amountNormalized}' exits the approved execution corridor ` +
        `(max: ${constraint.spendMaxAmountNormalized} | track: ${constraint.description})`
      );
    }
    if (
      constraint.spendAllowedDestinationKinds?.length &&
      !constraint.spendAllowedDestinationKinds.includes(spendIntent.destinationKind)
    ) {
      return (
        `spend destination kind '${spendIntent.destinationKind}' exits the approved execution corridor ` +
        `(allowed: ${constraint.spendAllowedDestinationKinds.join(", ")} | track: ${constraint.description})`
      );
    }
    if (
      constraint.spendAllowedSourceAuthorityKinds?.length &&
      !constraint.spendAllowedSourceAuthorityKinds.includes(spendIntent.sourceAuthorityKind)
    ) {
      return (
        `spend source authority '${spendIntent.sourceAuthorityKind}' exits the approved execution corridor ` +
        `(allowed: ${constraint.spendAllowedSourceAuthorityKinds.join(", ")} | track: ${constraint.description})`
      );
    }
    if (
      constraint.spendAllowedCommitIntents?.length &&
      !constraint.spendAllowedCommitIntents.includes(spendIntent.commitIntent)
    ) {
      return (
        `spend commit intent '${spendIntent.commitIntent}' exits the approved execution corridor ` +
        `(allowed: ${constraint.spendAllowedCommitIntents.join(", ")} | track: ${constraint.description})`
      );
    }
    if (
      constraint.spendAllowedPrincipals?.length &&
      !constraint.spendAllowedPrincipals.includes(spendIntent.principal)
    ) {
      return (
        `spend principal '${spendIntent.principal}' exits the approved execution corridor ` +
        `(allowed: ${constraint.spendAllowedPrincipals.join(", ")} | track: ${constraint.description})`
      );
    }
    if (
      constraint.spendAllowedPurposes?.length &&
      !constraint.spendAllowedPurposes.includes(spendIntent.purpose)
    ) {
      return (
        `spend purpose '${spendIntent.purpose}' exits the approved execution corridor ` +
        `(allowed: ${constraint.spendAllowedPurposes.join(", ")} | track: ${constraint.description})`
      );
    }
    if (
      constraint.spendAllowedBucketIds?.length &&
      !constraint.spendAllowedBucketIds.includes(spendIntent.bucketId)
    ) {
      return (
        `spend bucket '${spendIntent.bucketId}' exits the approved execution corridor ` +
        `(allowed: ${constraint.spendAllowedBucketIds.join(", ")} | track: ${constraint.description})`
      );
    }
    if (
      constraint.spendAllowedRiskClasses?.length &&
      !constraint.spendAllowedRiskClasses.includes(spendIntent.riskClass)
    ) {
      return (
        `spend risk class '${spendIntent.riskClass}' exits the approved execution corridor ` +
        `(allowed: ${constraint.spendAllowedRiskClasses.join(", ")} | track: ${constraint.description})`
      );
    }
    if (
      constraint.spendRecurringAllowed !== undefined &&
      spendIntent.recurring !== constraint.spendRecurringAllowed
    ) {
      return (
        `spend recurring disposition '${spendIntent.recurring ? "recurring" : "one-time"}' exits the approved execution corridor ` +
        `(track requires: ${constraint.spendRecurringAllowed ? "recurring" : "one-time"} | track: ${constraint.description})`
      );
    }
    // The corridor's period cap is a CEILING: a request may declare a tighter
    // cap or none (the spend runtime then enforces the corridor's own bound
    // against the real executed-spend ledger), but never a looser one.
    if (
      constraint.spendMaxPeriodAmountNormalized !== undefined &&
      spendIntent.periodCapNormalized !== undefined &&
      spendIntent.periodCapNormalized > constraint.spendMaxPeriodAmountNormalized
    ) {
      return (
        `spend period cap '${spendIntent.periodCapNormalized}' exits the approved execution corridor ` +
        `(allowed: at most ${constraint.spendMaxPeriodAmountNormalized} | track: ${constraint.description})`
      );
    }
    if (
      constraint.spendPeriodWindow !== undefined &&
      spendIntent.periodWindow !== undefined &&
      spendIntent.periodWindow !== constraint.spendPeriodWindow
    ) {
      return (
        `spend period window '${spendIntent.periodWindow ?? "unset"}' exits the approved execution corridor ` +
        `(allowed: ${constraint.spendPeriodWindow} | track: ${constraint.description})`
      );
    }
  }

  const reviewSurface = constraint.actionCorridor?.reviewSurface ?? constraint.reviewSurface;
  const inboundSurface =
    request.reviewContext?.surface ?? (request.actionKind === "chat.emit" ? "chat" : "action");
  if (reviewSurface && inboundSurface !== reviewSurface) {
    return (
      `review surface '${inboundSurface}' exits the approved execution corridor ` +
      `(track requires surface: ${reviewSurface})`
    );
  }

  if (constraint.reviewInvariantLawId && (reviewSurface === "chat" || inboundSurface === "chat")) {
    const inboundInvariant = request.reviewContext?.invariantLawId;
    if (inboundInvariant !== constraint.reviewInvariantLawId) {
      return (
        `invariant '${inboundInvariant ?? "none"}' exits the approved execution corridor ` +
        `(track requires: ${constraint.reviewInvariantLawId})`
      );
    }
  }

  const text = request.reviewContext?.attemptedOutput ?? request.payloadSummary ?? "";
  const outputViolation = checkOutputCorridor(constraint.outputCorridor, constraint, text);
  if (outputViolation) {
    return outputViolation;
  }
  const completionViolation = checkCompletionCorridor(
    constraint.completionCorridor,
    constraint,
    text,
  );
  if (completionViolation) {
    return completionViolation;
  }

  if (constraint.expressionProfile || constraint.expressionCorridor) {
    const expressionViolation = checkExpressionCorridor({
      profile: constraint.expressionProfile,
      corridor: constraint.expressionCorridor,
      output: text,
    });
    if (expressionViolation) {
      return expressionViolation;
    }
  }

  return null;
}

type TrackTargetScope = { norm: string; mode: "exact" | "prefix" | "regex" };

function lexicalTrackPrefix(value: string): string {
  return value.startsWith("/")
    ? path.posix.normalize(normalizeTrackTarget(value)).replace(/\/+$/, "") || "/"
    : value;
}

/**
 * The target scopes (patterns) of `constraint` that actually match `request`,
 * each tagged with the resolved match mode and a comparable normalized form.
 * Regex scopes are opaque for subset reasoning and kept as-is.
 */
function matchedTrackTargetScopes(
  constraint: BoundaryUplTrackConstraint,
  request: BoundaryActionRequest,
): TrackTargetScope[] {
  const targetPatterns = [
    ...(constraint.actionCorridor?.targetPattern ? [constraint.actionCorridor.targetPattern] : []),
    ...(constraint.targetPatterns ?? []),
    ...(constraint.targetPattern ? [constraint.targetPattern] : []),
  ];
  if (targetPatterns.length === 0) return [];

  const target = request.target;
  const normalizedTarget = normalizeTrackTarget(target);
  const isPathLike =
    target.startsWith("/") ||
    target.startsWith("./") ||
    target.startsWith("../") ||
    target.includes(path.sep);
  const matchMode =
    constraint.actionCorridor?.targetMatchMode ??
    constraint.targetMatchMode ??
    (isPathLike ? "prefix" : "exact");

  const out: TrackTargetScope[] = [];
  for (const pattern of targetPatterns) {
    if (matchMode === "regex") {
      if (matchesTrackPattern(normalizedTarget, pattern))
        out.push({ norm: pattern, mode: "regex" });
    } else if (matchMode === "exact") {
      if (target === pattern) out.push({ norm: lexicalTrackPrefix(pattern), mode: "exact" });
    } else {
      const t = lexicalTrackPrefix(target);
      const p = lexicalTrackPrefix(pattern);
      if (t === p || t.startsWith(`${p}/`)) out.push({ norm: p, mode: "prefix" });
    }
  }
  return out;
}

function trackScopeStrictlyNarrower(allow: TrackTargetScope, deny: TrackTargetScope): boolean {
  if (deny.mode === "exact") return false; // deny pinned to one target: nothing is a strict subset
  const dn = deny.norm;
  const boundary = dn === "/" ? "/" : `${dn}/`;
  if (allow.mode === "exact") return allow.norm !== dn && allow.norm.startsWith(boundary);
  return allow.norm.length > dn.length && allow.norm.startsWith(boundary); // deeper subtree
}

/**
 * Whether the ALLOW's matched target scope is a provable STRICT SUBSET of the
 * DENY's — a genuine deeper carve-out (`/ws/public` inside a `/ws` deny). A
 * deny that narrows via an opaque regex/glob scope, or an allow with no
 * comparable target scope, is never treated as carved out: the deny stands.
 */
function trackAllowTargetCarvesOutDeny(
  denyConstraint: BoundaryUplTrackConstraint,
  allowConstraint: BoundaryUplTrackConstraint,
  request: BoundaryActionRequest,
): boolean {
  const allowScopes = matchedTrackTargetScopes(allowConstraint, request).filter(
    (s) => s.mode !== "regex",
  );
  if (allowScopes.length === 0) return false;
  const denyScopes = matchedTrackTargetScopes(denyConstraint, request);
  if (denyScopes.some((s) => s.mode === "regex")) return false; // opaque deny — incomparable
  if (denyScopes.length === 0) return false; // deny not target-restricted: let specificity decide
  const denyRef = denyScopes.reduce((a, b) => (b.norm.length > a.norm.length ? b : a));
  return allowScopes.some((a) => trackScopeStrictlyNarrower(a, denyRef));
}

/**
 * Specificity of a track constraint RELATIVE TO a specific request: how many
 * distinct constraint dimensions actively gate THIS request.
 *
 * This differs from a raw field count in two ways that matter for ranking a
 * matching ALLOW against a matching DENY on the same request:
 *
 *   1. List dimensions are DEDUPLICATED (counted by distinct value), so
 *      padding a corridor with a duplicated target/text pattern buys nothing.
 *   2. Surface-conditional dimensions (review/output/expression/completion and
 *      spend) count only when the request actually exercises that surface — a
 *      plain `fs.write` with no review context is not narrowed by a
 *      `reviewSurface` / `reviewInvariantLawId`, so those must not inflate its
 *      score. Counting them unconditionally let a same-breadth allow padded
 *      with inert review metadata outrank a protective deny.
 *
 * Used only to break an allow-vs-deny tie; the deny stands unless the allow is
 * genuinely more specific about dimensions that bind this request.
 */
export function trackRequestEngagedSpecificity(
  constraint: BoundaryUplTrackConstraint,
  request: BoundaryActionRequest,
  options?: { discountNonNarrowing?: boolean },
): number {
  const distinct = (values?: readonly string[]): number =>
    values?.length ? new Set(values).size : 0;
  const discount = options?.discountNonNarrowing === true;

  let score = 0;

  // Target corridor — always engaged (every request has a target).
  const targets = new Set<string>([
    ...(constraint.actionCorridor?.targetPattern ? [constraint.actionCorridor.targetPattern] : []),
    ...(constraint.targetPatterns ?? []),
    ...(constraint.targetPattern ? [constraint.targetPattern] : []),
  ]);
  score += discount
    ? [...targets].filter((p) => targetPatternNarrows(constraint, request, p)).length
    : targets.size;

  // Request-text and flag corridors — always evaluated against the request.
  score += discount
    ? new Set((constraint.requestTextPatterns ?? []).filter(requestTextPatternNarrows)).size
    : distinct(constraint.requestTextPatterns);
  score += distinct(constraint.requiredFlags);

  // Review / output / expression / completion corridors are only checked when
  // the request carries a review context; otherwise they do not narrow it.
  if (request.reviewContext) {
    if (constraint.reviewSurface) score += 1;
    if (constraint.reviewInvariantLawId) score += 1;
    if (constraint.actionCorridor?.reviewSurface) score += 1;
    if (constraint.outputShape) score += 1;
    score += distinct(constraint.requiredTextPatterns);
    score += distinct(constraint.forbiddenTextPatterns);
    score += distinct(constraint.outputCorridor?.requiredTextPatterns);
    score += distinct(constraint.outputCorridor?.forbiddenTextPatterns);
    if (constraint.completionGrammar) score += 1;
    if (constraint.completionCorridor?.grammar) score += 1;
    if (constraint.expressionProfile) score += 1;
    if (constraint.expressionCorridor) score += 1;
  }

  // Spend corridors are only checked when the request declares a spend intent.
  if (request.spendIntent) {
    if (constraint.spendMaxAmountNormalized !== undefined) score += 1;
    score += distinct(constraint.spendAllowedDestinationKinds);
    score += distinct(constraint.spendAllowedSourceAuthorityKinds);
    score += distinct(constraint.spendAllowedCommitIntents);
    score += distinct(constraint.spendAllowedPrincipals);
    score += distinct(constraint.spendAllowedPurposes);
    score += distinct(constraint.spendAllowedBucketIds);
    score += distinct(constraint.spendAllowedRiskClasses);
    if (constraint.spendRecurringAllowed !== undefined) score += 1;
    if (constraint.spendMaxPeriodAmountNormalized !== undefined) score += 1;
    if (constraint.spendPeriodWindow !== undefined) score += 1;
  }

  return score;
}

/**
 * Whether a matching ALLOW rail may override a matching DENY rail for `request`.
 *
 * Fail-closed: a deny stands unless the allow is genuinely more specific in one
 * of two independent, non-exploitable ways —
 *   1. its TARGET scope is a strict subset (a deeper carve-out) of the deny's,
 *      capturing legitimate `/ws/public`-inside-`/ws` carve-outs that a flat
 *      field count cannot see; or
 *   2. it engages strictly more request-binding dimensions than the deny
 *      (request-engaged specificity), capturing allows that narrow via host
 *      regex / request-text rather than target depth.
 * Neither path rewards padding: inert metadata and duplicated patterns add no
 * engaged specificity, and a same-breadth allow is not a strict target subset.
 */
export function trackAllowOverridesDeny(
  denyConstraint: BoundaryUplTrackConstraint,
  allowConstraint: BoundaryUplTrackConstraint,
  request: BoundaryActionRequest,
): boolean {
  if (trackAllowTargetCarvesOutDeny(denyConstraint, allowConstraint, request)) {
    return true;
  }
  // Asymmetric on purpose: patterns that match everything (`/.*/`, `""`, a
  // `"/"` target prefix) narrow nothing, so they must not inflate the ALLOW's
  // score. The deny keeps its full count — this only ever removes overrides.
  return (
    trackRequestEngagedSpecificity(allowConstraint, request, { discountNonNarrowing: true }) >
    trackRequestEngagedSpecificity(denyConstraint, request)
  );
}

// Inputs no real corridor is about. A pattern that still matches them excludes
// nothing, so it does not narrow the corridor.
const _NARROWING_PROBE_TEXTS = ["", "zz-buccet-narrowing-probe-7f3a", "\n"];
const _NARROWING_PROBE_PATH = "/zz-buccet-narrowing-probe-7f3a/unrelated/x";
const _NARROWING_PROBE_TOKEN = "zz-buccet-narrowing-probe-7f3a-unrelated";

function requestTextPatternNarrows(pattern: string): boolean {
  return !_NARROWING_PROBE_TEXTS.every((text) => matchesTrackPattern(text, pattern));
}

/**
 * Whether `pattern`, interpreted the way checkTrackConstraint would for a
 * target shaped like `request.target`, excludes an unrelated target.
 */
function targetPatternNarrows(
  constraint: BoundaryUplTrackConstraint,
  request: BoundaryActionRequest,
  pattern: string,
): boolean {
  const target = request.target;
  const isPathLike =
    target.startsWith("/") ||
    target.startsWith("./") ||
    target.startsWith("../") ||
    target.includes(path.sep);
  const probe = isPathLike ? _NARROWING_PROBE_PATH : _NARROWING_PROBE_TOKEN;
  const matchMode =
    constraint.actionCorridor?.targetMatchMode ??
    constraint.targetMatchMode ??
    (isPathLike ? "prefix" : "exact");
  if (matchMode === "regex") return !matchesTrackPattern(normalizeTrackTarget(probe), pattern);
  if (matchMode === "exact") return probe !== pattern;
  const t = lexicalTrackPrefix(probe);
  const p = lexicalTrackPrefix(pattern);
  return !(t === p || t.startsWith(`${p}/`) || p === "/");
}

/**
 * Summarise an active track constraint for display in the operator console (`buccet console`).
 */
export function formatTrackConstraint(constraint: BoundaryUplTrackConstraint): string {
  const kinds = (
    constraint.actionCorridor?.allowedActionKinds ?? constraint.allowedActionKinds
  ).join(", ");
  const targetPattern = constraint.actionCorridor?.targetPattern ?? constraint.targetPattern;
  const targetPatterns = constraint.targetPatterns;
  const targetMatchMode = constraint.actionCorridor?.targetMatchMode ?? constraint.targetMatchMode;
  const outputCorridor = constraint.outputCorridor;
  const patternPart = targetPattern
    ? ` | target${targetMatchMode === "exact" ? "==" : targetMatchMode === "regex" ? "~=" : "^="}: ${targetPattern}`
    : targetPatterns?.length
      ? ` | targets${targetMatchMode === "regex" ? "~=" : targetMatchMode === "exact" ? "==" : "^="}: ${targetPatterns.join(" ; ")}`
      : "";
  const requestPart = constraint.requestTextPatterns?.length
    ? ` | request~=: ${constraint.requestTextPatterns.join(" ; ")}`
    : "";
  const flagPart = constraint.requiredFlags?.length
    ? ` | flags: ${constraint.requiredFlags.join(", ")}`
    : "";
  const spendPart = [
    constraint.spendMaxAmountNormalized !== undefined
      ? `max=${constraint.spendMaxAmountNormalized}`
      : null,
    constraint.spendAllowedDestinationKinds?.length
      ? `destination_kinds=${constraint.spendAllowedDestinationKinds.join(",")}`
      : null,
    constraint.spendAllowedSourceAuthorityKinds?.length
      ? `source_authority=${constraint.spendAllowedSourceAuthorityKinds.join(",")}`
      : null,
    constraint.spendAllowedCommitIntents?.length
      ? `commit_intents=${constraint.spendAllowedCommitIntents.join(",")}`
      : null,
    constraint.spendAllowedPrincipals?.length
      ? `principals=${constraint.spendAllowedPrincipals.join(",")}`
      : null,
    constraint.spendAllowedPurposes?.length
      ? `purposes=${constraint.spendAllowedPurposes.join(",")}`
      : null,
    constraint.spendAllowedBucketIds?.length
      ? `buckets=${constraint.spendAllowedBucketIds.join(",")}`
      : null,
    constraint.spendAllowedRiskClasses?.length
      ? `risk=${constraint.spendAllowedRiskClasses.join(",")}`
      : null,
    constraint.spendRecurringAllowed !== undefined
      ? `recurring=${constraint.spendRecurringAllowed ? "yes" : "no"}`
      : null,
    constraint.spendMaxPeriodAmountNormalized !== undefined
      ? `period_max=${constraint.spendMaxPeriodAmountNormalized}`
      : null,
    constraint.spendPeriodWindow !== undefined
      ? `period_window=${constraint.spendPeriodWindow}`
      : null,
  ]
    .filter(Boolean)
    .join(" | ");
  const invariantPart = constraint.reviewInvariantLawId
    ? ` | invariant: ${constraint.reviewInvariantLawId}`
    : "";
  const requiredPart = (outputCorridor?.requiredTextPatterns ?? constraint.requiredTextPatterns)
    ?.length
    ? ` | require: ${(outputCorridor?.requiredTextPatterns ?? constraint.requiredTextPatterns)?.join(" ; ")}`
    : "";
  const forbiddenPart = (outputCorridor?.forbiddenTextPatterns ?? constraint.forbiddenTextPatterns)
    ?.length
    ? ` | forbid: ${(outputCorridor?.forbiddenTextPatterns ?? constraint.forbiddenTextPatterns)?.join(" ; ")}`
    : "";
  const shapePart =
    (outputCorridor?.outputShape ?? constraint.outputShape)
      ? ` | shape: ${outputCorridor?.outputShape ?? constraint.outputShape}`
      : "";
  const completionPart = constraint.completionCorridor
    ? ` | completion-corridor: ${Object.entries(constraint.completionCorridor)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(",")}`
    : constraint.completionGrammar
      ? ` | completion: ${constraint.completionGrammar}`
      : "";
  const profilePart = constraint.expressionProfile
    ? ` | expression: ${constraint.expressionProfile}`
    : "";
  const corridorPart = constraint.expressionCorridor
    ? ` | expression-corridor: ${Object.entries(constraint.expressionCorridor)
        .map(([k, v]) => `${k}=${String(v)}`)
        .join(",")}`
    : "";
  const outputCorridorPart = outputCorridor
    ? ` | output-corridor: ${Object.entries(outputCorridor)
        .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(";") : String(v)}`)
        .join(",")}`
    : "";
  const actionCorridorPart = constraint.actionCorridor
    ? ` | action-corridor: ${Object.entries(constraint.actionCorridor)
        .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(";") : String(v)}`)
        .join(",")}`
    : "";
  return `${constraint.description} — kinds: ${kinds}${patternPart}${requestPart}${flagPart}${spendPart ? ` | spend: ${spendPart}` : ""}${invariantPart}${requiredPart}${forbiddenPart}${shapePart}${completionPart}${profilePart}${corridorPart}${outputCorridorPart}${actionCorridorPart}`;
}
