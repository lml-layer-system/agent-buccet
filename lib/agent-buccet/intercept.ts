import { randomUUID } from "node:crypto";
import { adjudicateBoundaryRequest } from "./bodyguard.ts";
import { createBoundaryActionRequest } from "./request-builder.ts";
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
    claimsCompleteCoverage?: boolean;
    requestsScopeExpansion?: boolean;
    requestsLawMutation?: boolean;
    requestsSessionRevival?: boolean;
    requestsLedgerBypass?: boolean;
  };
};

export type BoundaryInterceptDecision = "allow" | "deny" | "require_approval";

export type BoundaryInterceptSwarmGroupState = "waiting" | "approved" | "denied";

export type BoundaryInterceptSwarmGroup = {
  groupId: string;
  key: string;
  state: BoundaryInterceptSwarmGroupState;
  createdAt: string;
  updatedAt: string;
  actionClass: BoundaryInterceptRequest["actionClass"];
  operation: string;
  target: string;
  reason: string;
  lawIds: string[];
  memberCount: number;
  waitingCount: number;
  requestIds: string[];
};

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

  const adjudication = await adjudicateBoundaryRequest({
    config: args.config,
    request: boundaryRequest,
  });

  return {
    decision: adjudication.result.decision,
    reason: adjudication.result.reason,
    lawIds: adjudication.result.triggeredLawIds,
    nslMoves: adjudication.nslMoves,
    requestId: adjudication.request.requestId,
    actionKind: adjudication.request.actionKind,
  };
}

export type BoundaryInterceptDaemonCommand =
  | { command: "status"; requestId?: string }
  | { command: "restart"; requestId?: string; reason?: string }
  | { command: "shutdown"; requestId?: string }
  | { command: "swarm_status"; requestId?: string }
  | { command: "swarm_approve"; requestId?: string; groupId: string; issuedBy?: string; reason?: string }
  | { command: "swarm_deny"; requestId?: string; groupId: string; deniedBy?: string; reason?: string; asLaw?: boolean };

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
      swarm?: {
        pending: number;
        waitingMembers: number;
        tracked: number;
      };
    }
  | {
      type: "swarm_status";
      requestId: string;
      groups: BoundaryInterceptSwarmGroup[];
      totals: {
        pending: number;
        waitingMembers: number;
        tracked: number;
      };
    }
  | {
      type: "ack";
      requestId: string;
      command: "restart" | "shutdown" | "swarm_approve" | "swarm_deny";
      restartCount?: number;
      reason?: string;
      groupId?: string;
    }
  | {
      type: "error";
      requestId: string;
      error: string;
    };

export function daemonRequestId(requestId?: string): string {
  return requestId ?? `intercept-${randomUUID()}`;
}
