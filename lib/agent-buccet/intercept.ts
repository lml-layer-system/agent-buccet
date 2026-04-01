import { randomUUID } from "node:crypto";
import { adjudicateBoundaryRequest, createBoundaryActionRequest } from "./bodyguard.ts";
import {
  evaluateAdmission,
  initialAdmissionState,
  markCanyonLedgered,
} from "./admission.ts";
import { appendBoundaryLedger } from "./ledger.ts";
import type {
  BoundaryActionKind,
  BoundaryAdmissionState,
  BoundaryInputWeightClass,
  BoundaryProvenanceStrength,
  BoundaryRequestProvenance,
  BoundaryReviewContext,
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
  reviewContext?: BoundaryReviewContext;
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
  funnel?: {
    source: "gravity";
    rawAction: string;
    pid?: string;
    extra?: string;
  };
};

export type BoundaryInterceptDecision = "allow" | "deny" | "require_approval";
export type BoundaryInterceptApprovalMode = "interactive" | "standing_law";

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
  payloadSummary?: string;
  reviewContext?: BoundaryReviewContext;
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

export type BoundaryGravityFunnelPayload = {
  action: string;
  target: string;
  pid?: string;
  extra?: string;
};

type BoundaryGravityPayloadHints = {
  payloadSummary?: string;
  provenance?: BoundaryRequestProvenance;
  flags?: BoundaryInterceptRequest["flags"];
};

function decodeGravityComponent(component: string): string {
  try {
    return decodeURIComponent(component);
  } catch {
    return component;
  }
}

export function parseBoundaryGravityFunnelPayload(line: string): BoundaryGravityFunnelPayload {
  const trimmed = line.trim();
  const first = trimmed.indexOf("|");
  const second = first >= 0 ? trimmed.indexOf("|", first + 1) : -1;
  const third = second >= 0 ? trimmed.indexOf("|", second + 1) : -1;
  if (first < 0 || second < 0 || third < 0) {
    throw new Error("malformed gravity payload");
  }
  return {
    action: trimmed.slice(0, first),
    target: decodeGravityComponent(trimmed.slice(first + 1, second)),
    pid: trimmed.slice(second + 1, third),
    extra: decodeGravityComponent(trimmed.slice(third + 1)),
  };
}

function parseBoundaryGravityPayloadHints(payload: BoundaryGravityFunnelPayload): BoundaryGravityPayloadHints {
  const flags: NonNullable<BoundaryInterceptRequest["flags"]> = {};
  const extraTokens = (payload.extra ?? "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const payloadSummaryTokens: string[] = [];
  let provenance: BoundaryRequestProvenance | undefined;

  for (const token of extraTokens) {
    if (token.startsWith("prov=")) {
      provenance = token.slice("prov=".length) as BoundaryRequestProvenance;
      continue;
    }
    if (token.startsWith("flags=")) {
      for (const flagName of token.slice("flags=".length).split(",")) {
        if (flagName === "authorityClaimed") flags.authorityClaimed = true;
        if (flagName === "claimsCompleteCoverage") flags.claimsCompleteCoverage = true;
        if (flagName === "requestsScopeExpansion") flags.requestsScopeExpansion = true;
        if (flagName === "requestsLawMutation") flags.requestsLawMutation = true;
        if (flagName === "requestsSessionRevival") flags.requestsSessionRevival = true;
        if (flagName === "requestsLedgerBypass") flags.requestsLedgerBypass = true;
      }
      continue;
    }
    payloadSummaryTokens.push(token);
  }

  return {
    payloadSummary: [
      payload.pid ? `pid=${payload.pid}` : "",
      payloadSummaryTokens.join(" "),
    ].filter(Boolean).join(" "),
    provenance,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
  };
}

function buildGravityFunnelInterceptRequest(args: {
  payload: BoundaryGravityFunnelPayload;
  actionClass: BoundaryInterceptRequest["actionClass"];
  operation: string;
  target?: string;
  payloadSummary?: string;
  provenance?: BoundaryRequestProvenance;
  flags?: BoundaryInterceptRequest["flags"];
}): BoundaryInterceptRequest {
  return {
    actionClass: args.actionClass,
    operation: args.operation,
    target: args.target ?? args.payload.target,
    payloadSummary: args.payloadSummary,
    provenance: args.provenance,
    flags: args.flags,
    funnel: {
      source: "gravity",
      rawAction: args.payload.action,
      pid: args.payload.pid,
      extra: args.payload.extra,
    },
  };
}

export function mapBoundaryGravityFunnelPayloadToInterceptRequests(
  payload: BoundaryGravityFunnelPayload,
): BoundaryInterceptRequest[] {
  if (payload.action === "rename" || payload.action === "link" || payload.action === "symlink") {
    const counterpart = payload.extra ?? "";
    if (!counterpart) {
      throw new Error(`gravity action ${payload.action} requires counterpart target`);
    }
    return [
      buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "file",
        operation: "move",
        payloadSummary: `move-destination:${counterpart}`,
      }),
      buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "file",
        operation: "move",
        target: counterpart,
        payloadSummary: `move-source:${payload.target}`,
      }),
    ];
  }

  const hints = parseBoundaryGravityPayloadHints(payload);
  switch (payload.action) {
    case "read":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "file",
        operation: "read",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    case "write":
    case "create":
    case "chmod":
    case "chown":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "file",
        operation: "write",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    case "delete":
    case "rmdir":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "file",
        operation: "delete",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    case "mkdir":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "file",
        operation: "mkdir",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    case "exec":
    case "system":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "shell",
        operation: "exec",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    case "database.query":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "database",
        operation: "query",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    case "database.insert":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "database",
        operation: "insert",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    case "database.update":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "database",
        operation: "update",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    case "database.delete":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "database",
        operation: "delete",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    case "system.env.read":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "system",
        operation: "env.read",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    case "system.env.write":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "system",
        operation: "env.write",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    case "system.config.read":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "system",
        operation: "config.read",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    case "system.config.write":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "system",
        operation: "config.write",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    case "system.credential.read":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "system",
        operation: "credential.read",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    case "system.credential.use":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "system",
        operation: "credential.use",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    case "connect":
      return [buildGravityFunnelInterceptRequest({
        payload,
        actionClass: "network",
        operation: "send",
        payloadSummary: hints.payloadSummary,
        provenance: hints.provenance,
        flags: hints.flags,
      })];
    default:
      throw new Error(`unsupported gravity action: ${payload.action}`);
  }
}

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
      // Exactly-once ledger write for canyon promotion.
      // Check ledgered flag before writing — prevents duplicate I/O under flood.
      let finalAdmState = nextAdmState;
      if (admResult.promoted && !nextAdmState.canyonProvenances[admission.provenance]?.ledgered) {
        await appendBoundaryLedger("INGRESS_CANYON_STATE_WRITTEN", {
          sessionId: args.config.session.sessionId,
          actorId: args.config.session.actorId,
          decision: "deny",
          reason: admResult.reason,
          lawIds: admResult.lawId ? [admResult.lawId] : [],
          metadata: {
            provenance: admission.provenance,
            provenance_strength: admission.provenanceStrength,
            dimension: admResult.dimension ?? "canyon",
            promotion_kind: admResult.promotionKind ?? "density",
          },
          createdAt: new Date().toISOString(),
        });
        finalAdmState = markCanyonLedgered(nextAdmState, admission.provenance);
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
          dimension: admResult.dimension ?? "canyon",
        },
        createdAt: new Date().toISOString(),
      });

      return {
        // Tarpit — not a fast "deny". At socket layer this means: hold the connection,
        // drop the payload, return nothing. The caller (intercept daemon/server) is
        // responsible for applying actual socket-level tarpit behavior.
        decision: "deny",
        reason: admResult.reason,
        lawIds: admResult.lawId ? [admResult.lawId] : ["BOUNDARY.ADMISSION.CANYON.01"],
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
      reviewContext: args.request.reviewContext,
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
    reviewContext: args.request.reviewContext,
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
  | { command: "swarm_mode"; requestId?: string; mode?: BoundaryInterceptApprovalMode }
  | { command: "ingress_status"; requestId?: string }
  | { command: "swarm_approve"; requestId?: string; groupId: string; issuedBy?: string; reason?: string; asLaw?: boolean }
  | { command: "swarm_deny"; requestId?: string; groupId: string; deniedBy?: string; reason?: string; asLaw?: boolean }
  | { command: "ingress_allow_once"; requestId?: string; provenance: string; issuedBy?: string; reason?: string }
  | { command: "ingress_allow_as_law"; requestId?: string; provenance: string; issuedBy?: string; reason?: string }
  | { command: "ingress_deny_once"; requestId?: string; provenance: string; deniedBy?: string; reason?: string }
  | { command: "ingress_deny_as_law"; requestId?: string; provenance: string; deniedBy?: string; reason?: string };

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
      approvalMode?: BoundaryInterceptApprovalMode;
      swarm?: {
        pending: number;
        waitingMembers: number;
        tracked: number;
      };
    }
    | {
      type: "swarm_status";
      requestId: string;
      mode: BoundaryInterceptApprovalMode;
      groups: BoundaryInterceptSwarmGroup[];
      totals: {
        pending: number;
        waitingMembers: number;
        tracked: number;
      };
    }
  | {
      type: "swarm_mode";
      requestId: string;
      mode: BoundaryInterceptApprovalMode;
    }
    | {
      type: "ingress_status";
      requestId: string;
      provenances: Array<{
        provenance: string;
        state: "canyon" | "allow_once" | "deny_once" | "allow_as_law";
        reason: string;
        promotionKind?: "density" | "hard_ceiling";
        operatorDisposition?: "deny_as_law";
        seenAt: number;
        ledgered?: boolean;
        deniedCount: number;
        allowOnceRemaining: number;
        standingAllowed: boolean;
      }>;
    }
  | {
      type: "ack";
      requestId: string;
      command:
        | "restart"
        | "shutdown"
        | "swarm_approve"
        | "swarm_deny"
        | "swarm_mode"
        | "ingress_allow_once"
        | "ingress_allow_as_law"
        | "ingress_deny_once"
        | "ingress_deny_as_law";
      restartCount?: number;
      reason?: string;
      groupId?: string;
      provenance?: string;
    }
  | {
      type: "error";
      requestId: string;
      error: string;
    };

export function daemonRequestId(requestId?: string): string {
  return requestId ?? `intercept-${randomUUID()}`;
}
