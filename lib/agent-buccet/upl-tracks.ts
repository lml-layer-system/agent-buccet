/**
 * UPL Tracks — Post-law execution corridor enforcement.
 *
 * Purpose: collapse post-law execution from infinite recursive possibility into
 * finite lawful motion. After allow_as_law is recorded, execution must stay inside
 * the corridor that was approved. The model does not return to open-ended general
 * agency; it enters a narrow lawful channel.
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
 *   buildAutoTrackConstraint — auto-derive the track corridor from an approved request
 *   checkTrackConstraint     — validate an incoming request against an active corridor
 */

import path from "node:path";
import type { BoundaryActionKind, BoundaryActionRequest, BoundaryUplTrackConstraint } from "./types.ts";

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
 * Called when allow_as_law is recorded for GLOBAL or SESSION scope.
 * The constraint narrows the active execution corridor to match exactly
 * what was approved — preventing mission creep after law is set.
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
      // Allow the exact action kind that was approved.
      // Target pattern = parent directory → sibling files in the same dir are allowed,
      // but writes to /etc or anywhere else are not.
      const parentDir = path.dirname(request.target);
      return {
        allowedActionKinds: [request.actionKind],
        targetPattern: parentDir === "." ? undefined : parentDir,
        description: `${request.actionKind} within ${parentDir === "." ? "current dir" : parentDir}`,
      };
    }

    case "tool": {
      // Allow only tool.exec, constrained to the same command name.
      const commandName = extractCommandName(request.payloadSummary ?? request.target);
      return {
        allowedActionKinds: ["tool.exec"],
        targetPattern: commandName || undefined,
        description: `tool.exec: ${commandName || request.target}`,
      };
    }

    case "chat": {
      // Allow only chat.emit — prevents scope widening to tool.exec or network.send.
      // No target pattern; any chat target is fine within the chat corridor.
      return {
        allowedActionKinds: ["chat.emit"],
        description: "chat emission only",
      };
    }

    case "network": {
      const domain = extractNetworkDomain(request.target);
      return {
        allowedActionKinds: ["network.send"],
        targetPattern: domain,
        description: `network.send to ${domain}`,
      };
    }

    case "db": {
      // Approve all DB operation kinds for this database (INSERT implies SELECT, etc.)
      // but bind to the exact database target.
      return {
        allowedActionKinds: DB_ACTION_KINDS,
        targetPattern: request.target,
        description: `database operations on ${request.target}`,
      };
    }

    case "sys": {
      // Approve all sys kinds for this resource — bind to the exact target.
      return {
        allowedActionKinds: SYS_ACTION_KINDS,
        targetPattern: request.target,
        description: `system access: ${request.target}`,
      };
    }

    case "comm": {
      return {
        allowedActionKinds: ["comm.send"],
        targetPattern: request.target,
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

/**
 * Check whether an incoming request satisfies a UPL track constraint.
 *
 * Returns a human-readable violation reason string if the request exits the corridor,
 * or null if the request is within bounds.
 *
 * Target pattern matching uses prefix semantics for path-like targets,
 * exact-match for everything else.
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

    const matches = isPathLike
      ? target === pattern || target.startsWith(pattern + path.sep) || target.startsWith(pattern + "/")
      : target === pattern || target.startsWith(pattern);

    if (!matches) {
      return (
        `target '${target}' exits the approved target corridor '${pattern}' ` +
        `(track: ${constraint.description})`
      );
    }
  }

  return null;
}

/**
 * Summarise an active track constraint for display in Terminal 2 (buccet console).
 */
export function formatTrackConstraint(constraint: BoundaryUplTrackConstraint): string {
  const kinds = constraint.allowedActionKinds.join(", ");
  const patternPart = constraint.targetPattern ? ` | target: ${constraint.targetPattern}` : "";
  return `${constraint.description} — kinds: ${kinds}${patternPart}`;
}
