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
        ...(request.spendIntent.periodCapNormalized !== undefined
          ? { spendMaxPeriodAmountNormalized: request.spendIntent.periodCapNormalized }
          : {}),
        ...(request.spendIntent.periodWindow
          ? { spendPeriodWindow: request.spendIntent.periodWindow }
          : {}),
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
// Nested-quantifier heuristic: closing group followed by a quantifier is the canonical ReDoS shape.
const _REGEX_NESTED_QUANTIFIER = /[)]\s*[+*{]/;

function matchesTrackPattern(text: string, pattern: string): boolean {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) {
    return true;
  }
  const regexLiteral = trimmedPattern.match(/^\/(.+)\/([a-z]*)$/i);
  if (regexLiteral) {
    const body = regexLiteral[1];
    const flags = regexLiteral[2];
    // Reject: disallowed flags or nested-quantifier ReDoS shape.
    if (!_REGEX_ALLOWED_FLAGS.test(flags) || _REGEX_NESTED_QUANTIFIER.test(body)) {
      return text.toLowerCase().includes(trimmedPattern.toLowerCase());
    }
    try {
      return new RegExp(body, flags).test(text);
    } catch {
      return text.toLowerCase().includes(trimmedPattern.toLowerCase());
    }
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
): string | null {
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
        return matchesTrackPattern(normalizedTarget, pattern);
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
      matchesTrackPattern(requestText, pattern),
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
    if (
      constraint.spendMaxPeriodAmountNormalized !== undefined &&
      spendIntent.periodCapNormalized !== constraint.spendMaxPeriodAmountNormalized
    ) {
      return (
        `spend period cap '${spendIntent.periodCapNormalized ?? "unset"}' exits the approved execution corridor ` +
        `(allowed: ${constraint.spendMaxPeriodAmountNormalized} | track: ${constraint.description})`
      );
    }
    if (
      constraint.spendPeriodWindow !== undefined &&
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

/**
 * How narrowly this constraint's TARGET matches `request` — the length of the
 * longest target pattern that actually matches. Used to rank a matching ALLOW
 * against a matching DENY: a deny is only overridden by an allow that is
 * genuinely more specific about the TARGET (a deeper carve-out), not one that
 * merely carries more unrelated constraint fields. Returns 0 when the
 * constraint places no target restriction (broadest), which must never outrank
 * a targeted rail.
 */
export function trackTargetMatchSpecificity(
  constraint: BoundaryUplTrackConstraint,
  request: BoundaryActionRequest,
): number {
  const targetPatterns = [
    ...(constraint.actionCorridor?.targetPattern ? [constraint.actionCorridor.targetPattern] : []),
    ...(constraint.targetPatterns ?? []),
    ...(constraint.targetPattern ? [constraint.targetPattern] : []),
  ];
  if (targetPatterns.length === 0) return 0;

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
  const lexicalPrefix = (value: string): string =>
    value.startsWith("/")
      ? path.posix.normalize(normalizeTrackTarget(value)).replace(/\/+$/, "") || "/"
      : value;

  let best = 0;
  for (const pattern of targetPatterns) {
    let matched: boolean;
    if (matchMode === "regex") {
      matched = matchesTrackPattern(normalizedTarget, pattern);
    } else if (matchMode === "exact") {
      matched = target === pattern;
    } else {
      const t = lexicalPrefix(target);
      const p = lexicalPrefix(pattern);
      matched = t === p || t.startsWith(`${p}/`);
    }
    if (matched) best = Math.max(best, pattern.length);
  }
  return best;
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
