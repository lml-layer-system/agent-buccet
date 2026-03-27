/**
 * UPL Tracks — Post-law execution corridor enforcement.
 *
 * Purpose: collapse post-law execution from infinite recursive possibility into
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
import type { BoundaryActionKind, BoundaryActionRequest, BoundaryUplTrackConstraint } from "./types.ts";

const LOW_ENTROPY_EXPRESSION_PROFILES: Record<string, {
  forbidden: RegExp[];
  description: string;
}> = {
  archival: {
    description: "low-entropy archival register",
    forbidden: [
      /\b(?:amazing|legendary|obviously|unforgettable|fantastic|awesome|incredible)\b/i,
      /\b(?:i|we|you|your|our|my)\b/i,
      /\b(?:like a|as if|as though|phoenix)\b/i,
      /!/i,
    ],
  },
  formal: {
    description: "formal register",
    forbidden: [
      /\b(?:awesome|super|kinda|sorta|heck|damn)\b/i,
      /!/i,
    ],
  },
  neutral: {
    description: "neutral register",
    forbidden: [
      /\b(?:amazing|terrible|obviously|clearly|unforgettable)\b/i,
      /!/i,
    ],
  },
  factual: {
    description: "factual register",
    forbidden: [
      /\b(?:i think|i believe|obviously|clearly|amazing|legendary)\b/i,
      /\b(?:like a|as if|as though)\b/i,
      /!/i,
    ],
  },
  technical: {
    description: "technical register",
    forbidden: [
      /\b(?:amazing|awesome|incredible|obviously)\b/i,
      /!/i,
    ],
  },
};

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
const DB_ACTION_KINDS: BoundaryActionKind[] = [
  "db.query",
  "db.insert",
  "db.update",
  "db.delete",
];

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

function inferChatOutputShape(output: string | undefined): BoundaryUplTrackConstraint["outputShape"] | undefined {
  if (!output) {
    return undefined;
  }
  const trimmed = output.trim();
  if (!trimmed) {
    return undefined;
  }
  if ((trimmed.startsWith("{") || trimmed.startsWith("["))) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // ignore
    }
  }
  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1 && lines.every((line) => /^[-*]\s+/.test(line))) {
    return "bullets";
  }
  if (lines.length > 1 && lines.every((line) => /^\d+\.\s+/.test(line))) {
    return "numbered";
  }
  return "paragraph";
}

function textMatchesPattern(text: string, pattern: string): boolean {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) {
    return true;
  }
  const regexLiteral = trimmedPattern.match(/^\/(.+)\/([a-z]*)$/i);
  if (regexLiteral) {
    try {
      return new RegExp(regexLiteral[1], regexLiteral[2]).test(text);
    } catch {
      return text.toLowerCase().includes(trimmedPattern.toLowerCase());
    }
  }
  return text.toLowerCase().includes(trimmedPattern.toLowerCase());
}

function checkExpressionProfile(profile: string, output: string): string | null {
  const normalized = profile.trim().toLowerCase();
  const spec = LOW_ENTROPY_EXPRESSION_PROFILES[normalized];
  if (!spec) {
    return null;
  }
  for (const regex of spec.forbidden) {
    if (regex.test(output)) {
      return (
        `output exits the approved execution corridor ` +
        `(expression profile '${normalized}' forbids: ${regex})`
      );
    }
  }
  return null;
}

function describeOutputShape(shape: BoundaryUplTrackConstraint["outputShape"]): string {
  return shape ?? "unspecified";
}

function isOutputShapeSatisfied(shape: BoundaryUplTrackConstraint["outputShape"], output: string): boolean {
  const trimmed = output.trim();
  if (!shape) {
    return true;
  }
  if (shape === "json") {
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
      return false;
    }
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (shape === "bullets") {
    return lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line));
  }
  if (shape === "numbered") {
    return lines.length > 0 && lines.every((line) => /^\d+\.\s+/.test(line));
  }
  if (shape === "paragraph") {
    return lines.length <= 1 || lines.every((line) => !/^[-*]\s+/.test(line) && !/^\d+\.\s+/.test(line));
  }
  return true;
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
  // 1. Action kind must be in the allowed set.
  if (!constraint.allowedActionKinds.includes(request.actionKind)) {
    return (
      `action kind '${request.actionKind}' exits the approved execution corridor ` +
      `(corridor allows: ${constraint.allowedActionKinds.join(", ")})`
    );
  }

  // 2. Target must match the pattern (when present).
  if (constraint.targetPattern) {
    const target = request.target;
    const pattern = constraint.targetPattern;

    // Path-like targets (start with / or . or contain a path separator): prefix match.
    const isPathLike =
      target.startsWith("/") ||
      target.startsWith("./") ||
      target.startsWith("../") ||
      target.includes(path.sep);

    const matchMode = constraint.targetMatchMode
      ?? (isPathLike ? "prefix" : "exact");
    const matches = matchMode === "exact"
      ? target === pattern
      : target === pattern || target.startsWith(pattern + path.sep) || target.startsWith(pattern + "/");

    if (!matches) {
      return (
        `target '${target}' exits the approved target corridor '${pattern}' ` +
        `(track: ${constraint.description})`
      );
    }
  }

  if (constraint.reviewSurface && request.reviewContext?.surface !== constraint.reviewSurface) {
    return (
      `review surface '${request.reviewContext?.surface ?? "unknown"}' exits the approved execution corridor ` +
      `(track requires surface: ${constraint.reviewSurface})`
    );
  }

  if (constraint.reviewInvariantLawId) {
    const inboundInvariant = request.reviewContext?.invariantLawId;
    if (inboundInvariant !== constraint.reviewInvariantLawId) {
      return (
        `invariant '${inboundInvariant ?? "none"}' exits the approved execution corridor ` +
        `(track requires: ${constraint.reviewInvariantLawId})`
      );
    }
  }

  const text = request.reviewContext?.attemptedOutput ?? request.payloadSummary ?? "";
  if (constraint.requiredTextPatterns?.length) {
    for (const pattern of constraint.requiredTextPatterns) {
      if (!textMatchesPattern(text, pattern)) {
        return (
          `output exits the approved execution corridor ` +
          `(required pattern missing: ${pattern})`
        );
      }
    }
  }

  if (constraint.forbiddenTextPatterns?.length) {
    for (const pattern of constraint.forbiddenTextPatterns) {
      if (textMatchesPattern(text, pattern)) {
        return (
          `output exits the approved execution corridor ` +
          `(forbidden pattern present: ${pattern})`
        );
      }
    }
  }

  if (constraint.outputShape && !isOutputShapeSatisfied(constraint.outputShape, text)) {
    return (
      `output exits the approved execution corridor ` +
      `(required shape: ${describeOutputShape(constraint.outputShape)})`
    );
  }

  if (constraint.expressionProfile) {
    const expressionViolation = checkExpressionProfile(constraint.expressionProfile, text);
    if (expressionViolation) {
      return expressionViolation;
    }
  }

  return null;
}

/**
 * Summarise an active track constraint for display in Terminal 2 (buccet console).
 */
export function formatTrackConstraint(constraint: BoundaryUplTrackConstraint): string {
  const kinds = constraint.allowedActionKinds.join(", ");
  const patternPart = constraint.targetPattern
    ? ` | target${constraint.targetMatchMode === "exact" ? "==" : "^="}: ${constraint.targetPattern}`
    : "";
  const invariantPart = constraint.reviewInvariantLawId
    ? ` | invariant: ${constraint.reviewInvariantLawId}`
    : "";
  const requiredPart = constraint.requiredTextPatterns?.length
    ? ` | require: ${constraint.requiredTextPatterns.join(" ; ")}`
    : "";
  const forbiddenPart = constraint.forbiddenTextPatterns?.length
    ? ` | forbid: ${constraint.forbiddenTextPatterns.join(" ; ")}`
    : "";
  const shapePart = constraint.outputShape ? ` | shape: ${constraint.outputShape}` : "";
  const profilePart = constraint.expressionProfile ? ` | expression: ${constraint.expressionProfile}` : "";
  return `${constraint.description} — kinds: ${kinds}${patternPart}${invariantPart}${requiredPart}${forbiddenPart}${shapePart}${profilePart}`;
}
