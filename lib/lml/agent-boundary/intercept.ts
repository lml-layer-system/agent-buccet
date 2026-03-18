import { randomUUID } from "node:crypto";
import { auditBoundarySessionLedger } from "./ledger-audit.ts";
import { createBoundaryActionRequest } from "./executor.ts";
import { createBoundaryGravityService } from "./gravity-adapter/gravity-service.ts";
import { evaluateBoundaryAction } from "./runtime.ts";
import { buildBoundaryNslMoves } from "./nsl.ts";
import type {
  BoundaryActionKind,
  BoundaryRequestProvenance,
  BoundaryRuntimeConfig,
  NslMove,
} from "./types.ts";

export type BoundaryInterceptActionClass =
  | "file"
  | "shell"
  | "network"
  | "communication"
  | "database"
  | "system";

export type BoundaryInterceptRequest = {
  actionClass: BoundaryInterceptActionClass;
  operation: string;
  target: string;
  payloadSummary?: string;
  provenance?: BoundaryRequestProvenance;
  flags?: {
    authorityClaimed?: boolean;
    requestsScopeExpansion?: boolean;
    requestsLawMutation?: boolean;
    requestsSessionRevival?: boolean;
    requestsLedgerBypass?: boolean;
  };
};

export type BoundaryInterceptDecision = "allow" | "deny" | "require_approval";

export type BoundaryInterceptResult = {
  decision: BoundaryInterceptDecision;
  reason: string;
  lawIds: string[];
  nslMoves: NslMove[];
  requestId: string;
  actionKind: BoundaryActionKind;
};

function mapFileOperation(operation: string): BoundaryActionKind {
  switch (operation) {
    case "read":
      return "fs.read";
    case "write":
      return "fs.write";
    case "append":
      return "fs.append";
    case "delete":
      return "fs.delete";
    case "mkdir":
      return "fs.mkdir";
    case "move":
    case "rename":
      return "fs.move";
    default:
      throw new Error(`unsupported file intercept operation: ${operation}`);
  }
}

function mapDatabaseOperation(operation: string): BoundaryActionKind {
  switch (operation) {
    case "query":
      return "db.query";
    case "insert":
      return "db.insert";
    case "update":
      return "db.update";
    case "delete":
      return "db.delete";
    default:
      throw new Error(`unsupported database intercept operation: ${operation}`);
  }
}

function mapSystemOperation(operation: string): BoundaryActionKind {
  switch (operation) {
    case "env.read":
      return "sys.env.read";
    case "env.write":
      return "sys.env.write";
    case "config.read":
      return "sys.config.read";
    case "config.write":
      return "sys.config.write";
    case "credential.read":
      return "sys.credential.read";
    case "credential.use":
      return "sys.credential.use";
    default:
      throw new Error(`unsupported system intercept operation: ${operation}`);
  }
}

export function mapInterceptToBoundaryAction(request: BoundaryInterceptRequest): BoundaryActionKind {
  switch (request.actionClass) {
    case "file":
      return mapFileOperation(request.operation);
    case "shell":
      return "tool.exec";
    case "network":
      return "network.send";
    case "communication":
      return "comm.send";
    case "database":
      return mapDatabaseOperation(request.operation);
    case "system":
      return mapSystemOperation(request.operation);
  }
}

export async function evaluateBoundaryIntercept(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryInterceptRequest;
}): Promise<BoundaryInterceptResult> {
  const actionKind = mapInterceptToBoundaryAction(args.request);
  const boundaryRequest = createBoundaryActionRequest({
    config: args.config,
    actionKind,
    target: args.request.target,
    payloadSummary: args.request.payloadSummary,
    provenance: args.request.provenance,
    flags: args.request.flags,
  });

  const sessionAudit = await auditBoundarySessionLedger(args.config.session.sessionId);
  if (sessionAudit.status !== "complete") {
    const result = {
      decision: "deny" as const,
      reason: sessionAudit.reason,
      lawIds: ["META.LEDGER.02"],
      nslMoves: buildBoundaryNslMoves(boundaryRequest, {
        decision: "deny",
        reason: sessionAudit.reason,
        triggeredLawIds: ["META.LEDGER.02"],
        requiresApproval: false,
      }),
      requestId: boundaryRequest.requestId,
      actionKind,
    };
    return result;
  }

  const gravityService = args.config.gravityService ?? createBoundaryGravityService();
  const gravity = await gravityService.enforceRequest({
    config: args.config,
    request: boundaryRequest,
  });

  if (gravity.outcome === "deny") {
    return {
      decision: "deny",
      reason: gravity.reason,
      lawIds: gravity.lawIds,
      nslMoves: gravity.nslMoves,
      requestId: boundaryRequest.requestId,
      actionKind,
    };
  }

  if (gravity.outcome === "nsl_grant_offer") {
    return {
      decision: "require_approval",
      reason: gravity.reason,
      lawIds: gravity.lawIds,
      nslMoves: gravity.nslMoves,
      requestId: boundaryRequest.requestId,
      actionKind,
    };
  }

  const nextRequest = gravity.request ?? boundaryRequest;
  const nextConfig = gravity.config ?? args.config;
  const evaluated = await evaluateBoundaryAction(nextConfig, nextRequest);

  return {
    decision: evaluated.result.decision,
    reason: evaluated.result.reason,
    lawIds: evaluated.result.triggeredLawIds,
    nslMoves: evaluated.nslMoves,
    requestId: nextRequest.requestId,
    actionKind: nextRequest.actionKind,
  };
}

export type BoundaryInterceptDaemonCommand =
  | { command: "status"; requestId?: string }
  | { command: "restart"; requestId?: string; reason?: string }
  | { command: "shutdown"; requestId?: string };

export type BoundaryInterceptDaemonInput =
  | ({ requestId?: string } & BoundaryInterceptRequest)
  | BoundaryInterceptDaemonCommand;

export type BoundaryInterceptDaemonOutput =
  | ({
      type: "decision";
      requestId: string;
      internalRequestId: string;
    } & BoundaryInterceptResult)
  | {
      type: "status";
      requestId: string;
      running: boolean;
      restartCount: number;
      lastHeartbeatAt?: string;
      lastDecision?: "allow" | "null";
      lastError?: string;
      lastRestartReason?: string;
    }
  | {
      type: "ack";
      requestId: string;
      command: "restart" | "shutdown";
      restartCount?: number;
      reason?: string;
    }
  | {
      type: "error";
      requestId: string;
      error: string;
    };

export function daemonRequestId(requestId?: string): string {
  return requestId ?? `intercept-${randomUUID()}`;
}
