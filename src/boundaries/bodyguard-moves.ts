import type {
  BoundaryActionRequest,
  BoundaryLawResult,
  BodyguardMove,
  BodyguardMoveKind,
} from "./types.ts";

function buildMove(kind: BodyguardMoveKind, title: string, description: string, target?: string): BodyguardMove {
  return {
    moveId: `${kind}:${target ?? "global"}`,
    kind,
    title,
    description,
    target,
  };
}

export function buildBoundaryBodyguardMoves(request: BoundaryActionRequest, result: BoundaryLawResult): BodyguardMove[] {
  if (result.decision === "allow") {
    return [];
  }

  if (result.decision === "require_approval") {
    if (request.actionKind === "comm.send") {
      return [
        buildMove("grant_recipient", "Approve recipient send", "Allow this outbound recipient action.", request.target),
        buildMove("deny_and_explain", "Deny send", "Reject the recipient send and explain the boundary.", request.target),
      ];
    }
    if (request.actionKind === "fs.delete") {
      return [
        buildMove("grant_delete", "Approve delete", "Approve deletion for this target.", request.target),
        buildMove("dry_run_preview", "Preview delete", "Show what would be deleted without executing it.", request.target),
      ];
    }
    if (request.actionKind === "network.send") {
      return [
        buildMove("grant_network", "Approve network send", "Allow this outbound network action.", request.target),
        buildMove("deny_and_explain", "Deny send", "Reject the outbound send and explain the boundary.", request.target),
      ];
    }
    if (request.actionKind === "tool.exec") {
      return [
        buildMove("grant_exec", "Approve tool execution", "Allow this tool execution for the current session.", request.target),
      ];
    }
    if (request.actionKind.startsWith("db.")) {
      return [
        buildMove("grant_database", "Approve database action", "Allow this database action for the current session.", request.target),
        buildMove("deny_and_explain", "Deny database action", "Reject the database action and explain the boundary.", request.target),
      ];
    }
    if (request.actionKind.startsWith("sys.")) {
      return [
        buildMove("grant_system", "Approve system action", "Allow this system action for the current session.", request.target),
        buildMove("deny_and_explain", "Deny system action", "Reject the system action and explain the boundary.", request.target),
      ];
    }
  }

  if (result.reason.includes("outside user-opened reachable scope")) {
    return [
      buildMove("open_path", "Open path", "Open the target path into reachable scope.", request.target),
      buildMove("dry_run_preview", "Preview action", "Show what would happen if the path were opened.", request.target),
    ];
  }

  if (result.reason.includes("ledger")) {
    return [
      buildMove("review_ledger", "Review ledger", "Review the session ledger and re-establish a lawful trace before continuing.", request.target),
      buildMove("deny_and_explain", "Deny and explain", result.reason, request.target),
    ];
  }

  return [buildMove("deny_and_explain", "Deny and explain", result.reason, request.target)];
}

export type { BodyguardMove, BodyguardMoveKind };
