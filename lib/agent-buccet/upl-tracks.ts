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
import { checkExpressionCorridor } from "./expression-track-extractor.ts";
import { checkCompletionCorridor, checkOutputCorridor } from "./output-track-extractor.ts";

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

function matchesTrackPattern(text: string, pattern: string): boolean {
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

function normalizeTrackTarget(target: string): string {
  return target.replaceAll("\\", "/");
}

function buildRequestTrackText(request: BoundaryActionRequest): string {
  return [
    request.actionKind,
    request.target,
    request.payloadSummary ?? "",
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
  const allowedActionKinds = constraint.actionCorridor?.allowedActionKinds ?? constraint.allowedActionKinds;
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

    const matchMode = constraint.actionCorridor?.targetMatchMode
      ?? constraint.targetMatchMode
      ?? (isPathLike ? "prefix" : "exact");
    const matches = targetPatterns.some((pattern) => {
      if (matchMode === "regex") {
        return matchesTrackPattern(normalizedTarget, pattern);
      }
      if (matchMode === "exact") {
        return target === pattern;
      }
      return target === pattern || target.startsWith(pattern + path.sep) || target.startsWith(pattern + "/");
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
    const matches = constraint.requestTextPatterns.some((pattern) => matchesTrackPattern(requestText, pattern));
    if (!matches) {
      return (
        `request text exits the approved execution corridor ` +
        `(track: ${constraint.description})`
      );
    }
  }

  const reviewSurface = constraint.actionCorridor?.reviewSurface ?? constraint.reviewSurface;
  if (reviewSurface && request.reviewContext?.surface !== reviewSurface) {
    return (
      `review surface '${request.reviewContext?.surface ?? "unknown"}' exits the approved execution corridor ` +
      `(track requires surface: ${reviewSurface})`
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
  const outputViolation = checkOutputCorridor(constraint.outputCorridor, constraint, text);
  if (outputViolation) {
    return outputViolation;
  }
  const completionViolation = checkCompletionCorridor(constraint.completionCorridor, constraint, text);
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
 * Summarise an active track constraint for display in Terminal 2 (buccet console).
 */
export function formatTrackConstraint(constraint: BoundaryUplTrackConstraint): string {
  const kinds = (constraint.actionCorridor?.allowedActionKinds ?? constraint.allowedActionKinds).join(", ");
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
  const invariantPart = constraint.reviewInvariantLawId
    ? ` | invariant: ${constraint.reviewInvariantLawId}`
    : "";
  const requiredPart = (outputCorridor?.requiredTextPatterns ?? constraint.requiredTextPatterns)?.length
    ? ` | require: ${(outputCorridor?.requiredTextPatterns ?? constraint.requiredTextPatterns)?.join(" ; ")}`
    : "";
  const forbiddenPart = (outputCorridor?.forbiddenTextPatterns ?? constraint.forbiddenTextPatterns)?.length
    ? ` | forbid: ${(outputCorridor?.forbiddenTextPatterns ?? constraint.forbiddenTextPatterns)?.join(" ; ")}`
    : "";
  const shapePart = (outputCorridor?.outputShape ?? constraint.outputShape) ? ` | shape: ${outputCorridor?.outputShape ?? constraint.outputShape}` : "";
  const completionPart = constraint.completionCorridor
    ? ` | completion-corridor: ${Object.entries(constraint.completionCorridor).map(([k, v]) => `${k}=${String(v)}`).join(",")}`
    : (constraint.completionGrammar ? ` | completion: ${constraint.completionGrammar}` : "");
  const profilePart = constraint.expressionProfile ? ` | expression: ${constraint.expressionProfile}` : "";
  const corridorPart = constraint.expressionCorridor
    ? ` | expression-corridor: ${Object.entries(constraint.expressionCorridor).map(([k, v]) => `${k}=${String(v)}`).join(",")}`
    : "";
  const outputCorridorPart = outputCorridor
    ? ` | output-corridor: ${Object.entries(outputCorridor).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(";") : String(v)}`).join(",")}`
    : "";
  const actionCorridorPart = constraint.actionCorridor
    ? ` | action-corridor: ${Object.entries(constraint.actionCorridor).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(";") : String(v)}`).join(",")}`
    : "";
  return `${constraint.description} — kinds: ${kinds}${patternPart}${requestPart}${invariantPart}${requiredPart}${forbiddenPart}${shapePart}${completionPart}${profilePart}${corridorPart}${outputCorridorPart}${actionCorridorPart}`;
}
