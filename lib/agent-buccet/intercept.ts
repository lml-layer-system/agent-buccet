import { randomUUID } from "node:crypto";
import { adjudicateBoundaryRequest, createBoundaryActionRequest } from "./bodyguard.ts";
import {
  evaluateAdmission,
  initialAdmissionState,
  markStandingDenyLedgered,
} from "./admission.ts";
import { appendBoundaryLedger } from "./ledger.ts";
import type {
  BoundaryActionKind,
  BoundaryAdmissionState,
  BoundaryInputWeightClass,
  BoundaryProvenanceStrength,
  BoundaryRequestProvenance,
  BoundaryRuntimeConfig,
  BodyguardMove,
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
  /** Admission boundary metadata — used for inbound DDoS / prompt-spam defense. */
  admission?: {
    /** Provenance key: strongest available (pubkey > session > IP). */
    provenance: string;
    provenanceStrength: BoundaryProvenanceStrength;
    weightClass: BoundaryInputWeightClass;
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
  bodyguardMoves: BodyguardMove[];
  memberCount: number;
  waitingCount: number;
  requestIds: string[];
};

export type BoundaryInterceptResult = {
  decision: BoundaryInterceptDecision;
  reason: string;
  lawIds: string[];
  bodyguardMoves: BodyguardMove[];
  requestId: string;
  actionKind: BoundaryActionKind;
  tarpitActive?: boolean;
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
}): Promise<BoundaryInterceptResult & { admissionState?: BoundaryAdmissionState }> {
  // ── Admission Boundary: fires BEFORE adjudication, tokenization, or any
  //    application-layer processing. Hostile inbound traffic is tarpitted here.
  if (args.config.admissionConfig && args.request.admission) {
    const { admission } = args.request;
    const admState = args.config.admissionState ?? initialAdmissionState();

    const { result: admResult, state: nextAdmState } = evaluateAdmission({
      config: args.config.admissionConfig,
      state: admState,
      request: {
        requestId: randomUUID(),
        provenance: admission.provenance,
        provenanceStrength: admission.provenanceStrength,
        weightClass: admission.weightClass,
        receivedAtMs: Date.now(),
      },
      nowMs: Date.now(),
    });

    if (admResult.decision === "tarpit") {
      // Exactly-once ledger write for standing-deny promotion.
      // Check ledgered flag before writing — prevents duplicate I/O under flood.
      let finalAdmState = nextAdmState;
      if (admResult.promoted && !nextAdmState.standingDenyProvenances[admission.provenance]?.ledgered) {
        await appendBoundaryLedger("INGRESS_STANDING_LAW_WRITTEN", {
          sessionId: args.config.session.sessionId,
          actorId: args.config.session.actorId,
          decision: "deny",
          reason: admResult.reason,
          lawIds: admResult.lawId ? [admResult.lawId] : [],
          metadata: {
            provenance: admission.provenance,
            provenance_strength: admission.provenanceStrength,
            dimension: admResult.dimension ?? "standing_deny",
            promotion_kind: admResult.promotionKind ?? "density",
          },
          createdAt: new Date().toISOString(),
        });
        finalAdmState = markStandingDenyLedgered(nextAdmState, admission.provenance);
      }

      // Log tarpit (not every drop — only the first block per provenance per call)
      await appendBoundaryLedger("INGRESS_PROVENANCE_BLOCKED", {
        sessionId: args.config.session.sessionId,
        actorId: args.config.session.actorId,
        decision: "deny",
        reason: admResult.reason,
        lawIds: admResult.lawId ? [admResult.lawId] : [],
        metadata: {
          provenance: admission.provenance,
          dimension: admResult.dimension ?? "standing_deny",
        },
        createdAt: new Date().toISOString(),
      });

      return {
        // Tarpit — not a fast "deny". At socket layer this means: hold the connection,
        // drop the payload, return nothing. The caller (intercept daemon/server) is
        // responsible for applying actual socket-level tarpit behavior.
        decision: "deny",
        reason: admResult.reason,
        lawIds: admResult.lawId ? [admResult.lawId] : ["BOUNDARY.ADMISSION.STANDING_DENY.01"],
        bodyguardMoves: [],
        requestId: randomUUID(),
        actionKind: mapInterceptToBoundaryAction(args.request),
        tarpitActive: true,
        admissionState: finalAdmState,
      };
    }

    // Admitted by admission boundary — continue to law/gravity adjudication
    // Pass updated admission state back to caller via result
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
      bodyguardMoves: adjudication.bodyguardMoves,
      requestId: adjudication.request.requestId,
      actionKind: adjudication.request.actionKind,
      admissionState: nextAdmState,
    };
  }

  // No admission config — standard intercept path (no change to existing behavior)
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
    bodyguardMoves: adjudication.bodyguardMoves,
    requestId: adjudication.request.requestId,
    actionKind: adjudication.request.actionKind,
  };
}

export type BoundaryInterceptDaemonCommand =
  | { command: "status"; requestId?: string }
  | { command: "restart"; requestId?: string; reason?: string }
  | { command: "shutdown"; requestId?: string }
  | { command: "swarm_status"; requestId?: string }
  | { command: "swarm_approve"; requestId?: string; groupId: string; issuedBy?: string; reason?: string; asLaw?: boolean }
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
