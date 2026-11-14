import { randomUUID } from "node:crypto";
import {
  adjudicateBoundaryRequest,
  createBoundaryActionRequest,
} from "./../boundaries/bodyguard.ts";
import { inferBoundaryProtectedMaterialSignals } from "./../boundaries/secrets-boundary.ts";
import { isSensitiveMutationTarget } from "./../law/sensitive-target.ts";
import { appendBoundaryLedger } from "./../proof/ledger.ts";
import { evaluateAdmission, initialAdmissionState, markCanyonLedgered } from "./admission.ts";
import { admitBoundaryNoveltyState, normalizeBoundaryNoveltyState } from "./novelty.ts";
import { assessBoundarySubstrateIntercept } from "./substrate/substrate-live.ts";
import type {
  BoundarySwarmComposition,
  BoundarySwarmCoordinationState,
  BoundarySwarmCost,
  BoundarySwarmDefinitionRequest,
  BoundarySwarmDomainStatus,
  BoundarySwarmFreshness,
  BoundarySwarmHandoff,
  BoundarySwarmIntent,
  BoundarySwarmIntentLedger,
  BoundarySwarmOwnership,
  BoundarySwarmPath,
  BoundarySwarmProvenance,
  BoundarySwarmPurpleAction,
  BoundarySwarmReadiness,
  BoundarySwarmRequestMeta,
  BoundarySwarmYellowReason,
} from "./swarm.ts";
import type {
  BodyguardMove,
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryAdmissionState,
  BoundaryInputWeightClass,
  BoundaryNoveltyState,
  BoundaryProvenanceStrength,
  BoundaryRequestProvenance,
  BoundaryReviewContext,
  BoundaryRuntimeConfig,
} from "./types.ts";

export type BoundaryInterceptActionClass =
  | "file"
  | "shell"
  | "network"
  | "communication"
  | "database"
  | "system";

export type BoundaryInterceptFunnelSource = "gravity" | "system" | "framework";

export type BoundaryInterceptRequest = {
  actionClass: BoundaryInterceptActionClass;
  operation: string;
  target: string;
  payloadSummary?: string;
  reviewContext?: BoundaryReviewContext;
  provenance?: BoundaryRequestProvenance;
  novelty?: BoundaryNoveltyState;
  flags?: BoundaryActionRequest["flags"];
  /** Admission boundary metadata — used for inbound DDoS / prompt-spam defense. */
  admission?: {
    /** Provenance key: strongest available (pubkey > session > IP). */
    provenance: string;
    provenanceStrength: BoundaryProvenanceStrength;
    weightClass: BoundaryInputWeightClass;
  };
  funnel?: {
    source: BoundaryInterceptFunnelSource;
    rawAction: string;
    pid?: string;
    extra?: string;
  };
  swarm?: BoundarySwarmRequestMeta;
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
  sessionId: string;
  readiness: BoundarySwarmReadiness;
  path?: BoundarySwarmPath;
  pathReason?: string;
  swarmAction?: string;
  actorRole?: string;
  intent?: BoundarySwarmIntent;
  intentLedger?: BoundarySwarmIntentLedger;
  ownership?: BoundarySwarmOwnership;
  handoff?: BoundarySwarmHandoff;
  completedValidation?: string[];
  provenance?: BoundarySwarmProvenance;
  freshness?: BoundarySwarmFreshness;
  composition?: BoundarySwarmComposition;
  coordination?: BoundarySwarmCoordinationState;
  domainStatus?: BoundarySwarmDomainStatus;
  cost?: BoundarySwarmCost;
  novelty?: BoundaryNoveltyState;
  pathCode?: string;
  yellowReason?: BoundarySwarmYellowReason;
  purpleAction?: BoundarySwarmPurpleAction;
  definitionRequest?: BoundarySwarmDefinitionRequest;
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

function inferInterceptNoveltyBoundary(
  request: BoundaryInterceptRequest,
): BoundaryNoveltyState | undefined {
  const base = normalizeBoundaryNoveltyState(request.novelty);
  const classes = [...(base?.classes ?? [])];
  const boundaryHits = [...(base?.boundaryHits ?? [])];
  const reasonParts = new Set<string>();

  if (base?.reason) {
    reasonParts.add(base.reason);
  }

  let detected = base?.detected === true;
  let selfOriginated = base?.selfOriginated === true;
  const disposition = base?.disposition ?? "queue";

  if (request.provenance === "trusted_system" || request.funnel) {
    detected = true;
    selfOriginated = true;
    classes.push("self_originated_motion");
    boundaryHits.push("front", "side", "back", "runtime", "reentry");
    if (request.funnel?.source === "gravity") {
      boundaryHits.push("gravity");
    }
    reasonParts.add("self-originated Buccet motion re-enters through novelty before consequence");
  }

  if (request.swarm && detected) {
    boundaryHits.push("swarm");
  }

  if ((request.flags?.requestsLawMutation || request.flags?.requestsLedgerBypass) && detected) {
    boundaryHits.push("upl");
  }

  if (!detected) {
    return base;
  }

  return normalizeBoundaryNoveltyState({
    detected: true,
    classes,
    boundaryHits,
    selfOriginated,
    disposition,
    reason: [...reasonParts].join("; "),
    admitted: base?.admitted,
  });
}

export function withBoundaryNovelty(request: BoundaryInterceptRequest): BoundaryInterceptRequest {
  const novelty = inferInterceptNoveltyBoundary(request);
  if (!novelty) {
    return request;
  }
  return {
    ...request,
    novelty,
  };
}

export function withAdmittedBoundaryNovelty(
  request: BoundaryInterceptRequest,
): BoundaryInterceptRequest {
  const novelty = admitBoundaryNoveltyState(inferInterceptNoveltyBoundary(request));
  if (!novelty) {
    return request;
  }
  return {
    ...request,
    novelty,
  };
}

type CreateBoundaryFunnelInterceptRequestArgs = {
  source: BoundaryInterceptFunnelSource;
  rawAction: string;
  actionClass: BoundaryInterceptRequest["actionClass"];
  operation: string;
  target: string;
  payloadSummary?: string;
  reviewContext?: BoundaryReviewContext;
  provenance?: BoundaryRequestProvenance;
  flags?: BoundaryInterceptRequest["flags"];
  pid?: string | number;
  extra?: string;
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

function parseBoundaryGravityPayloadHints(
  payload: BoundaryGravityFunnelPayload,
): BoundaryGravityPayloadHints {
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
        if (flagName === "noveltyDetected") flags.noveltyDetected = true;
        if (flagName === "noveltySelfOriginated") flags.noveltySelfOriginated = true;
      }
      continue;
    }
    payloadSummaryTokens.push(token);
  }

  return {
    payloadSummary: [payload.pid ? `pid=${payload.pid}` : "", payloadSummaryTokens.join(" ")]
      .filter(Boolean)
      .join(" "),
    provenance,
    flags: Object.keys(flags).length > 0 ? flags : undefined,
  };
}

export function createBoundaryFunnelInterceptRequest(
  args: CreateBoundaryFunnelInterceptRequestArgs,
): BoundaryInterceptRequest {
  return {
    actionClass: args.actionClass,
    operation: args.operation,
    target: args.target,
    ...(args.payloadSummary ? { payloadSummary: args.payloadSummary } : {}),
    ...(args.reviewContext ? { reviewContext: args.reviewContext } : {}),
    ...(args.provenance ? { provenance: args.provenance } : {}),
    ...(args.flags ? { flags: args.flags } : {}),
    funnel: {
      source: args.source,
      rawAction: args.rawAction,
      pid: args.pid !== undefined ? String(args.pid) : undefined,
      extra: args.extra,
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
      createBoundaryFunnelInterceptRequest({
        source: "gravity",
        rawAction: payload.action,
        actionClass: "file",
        operation: "move",
        target: payload.target,
        payloadSummary: `move-destination:${counterpart}`,
        pid: payload.pid,
        extra: payload.extra,
      }),
      createBoundaryFunnelInterceptRequest({
        source: "gravity",
        rawAction: payload.action,
        actionClass: "file",
        operation: "move",
        target: counterpart,
        payloadSummary: `move-source:${payload.target}`,
        pid: payload.pid,
        extra: payload.extra,
      }),
    ];
  }

  const hints = parseBoundaryGravityPayloadHints(payload);
  switch (payload.action) {
    case "read":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "file",
          operation: "read",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
    case "write":
    case "create":
    case "chmod":
    case "chown":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "file",
          operation: "write",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
    case "delete":
    case "rmdir":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "file",
          operation: "delete",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
    case "mkdir":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "file",
          operation: "mkdir",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
    case "exec":
    case "system":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "shell",
          operation: "exec",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
    case "database.query":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "database",
          operation: "query",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
    case "database.insert":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "database",
          operation: "insert",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
    case "database.update":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "database",
          operation: "update",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
    case "database.delete":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "database",
          operation: "delete",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
    case "system.env.read":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "system",
          operation: "env.read",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
    case "system.env.write":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "system",
          operation: "env.write",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
    case "system.config.read":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "system",
          operation: "config.read",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
    case "system.config.write":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "system",
          operation: "config.write",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
    case "system.credential.read":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "system",
          operation: "credential.read",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
    case "system.credential.use":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "system",
          operation: "credential.use",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
    case "connect":
      return [
        createBoundaryFunnelInterceptRequest({
          source: "gravity",
          rawAction: payload.action,
          actionClass: "network",
          operation: "send",
          target: payload.target,
          payloadSummary: hints.payloadSummary,
          provenance: hints.provenance,
          flags: hints.flags,
          pid: payload.pid,
          extra: payload.extra,
        }),
      ];
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

export function mapInterceptToBoundaryAction(
  request: BoundaryInterceptRequest,
): BoundaryActionKind {
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

/**
 * AUTH-01 least-privilege: a broad standing scope/corridor that allows a
 * directory also silently allows every secret/credential file beneath it, in
 * every mode (the intercept gate returns `allow`, so the Box is never even
 * consulted). Downgrade such an `allow` for a sensitive MUTATION to
 * `require_approval`, so a human always authorizes credential changes
 * explicitly. In interactive mode that surfaces a prompt; in autonomous mode it
 * flows to the follow_upl handler, which holds it closed. An explicit per-file
 * user law still lands as its own exact decision upstream of this.
 */
function holdSensitiveAllow(
  decision: "allow" | "deny" | "require_approval",
  reason: string,
  actionKind: BoundaryActionKind,
  target: string,
): { decision: "allow" | "deny" | "require_approval"; reason: string } {
  if (decision === "allow" && isSensitiveMutationTarget(actionKind, target)) {
    return {
      decision: "require_approval",
      reason: `sensitive target requires explicit human authorization and is not auto-allowed by standing scope: ${target}`,
    };
  }
  return { decision, reason };
}

export async function evaluateBoundaryIntercept(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryInterceptRequest;
}): Promise<BoundaryInterceptResult & { admissionState?: BoundaryAdmissionState }> {
  const request = withBoundaryNovelty(args.request);
  // ── Admission Boundary: fires BEFORE adjudication, tokenization, or any
  //    application-layer processing. Hostile inbound traffic is tarpitted here.
  if (args.config.admissionConfig && request.admission) {
    const { admission } = request;
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
        actionKind: mapInterceptToBoundaryAction(request),
        tarpitActive: true,
        admissionState: finalAdmState,
      };
    }

    // Admitted by admission boundary — continue to law/gravity adjudication
    // Pass updated admission state back to caller via result
    const actionKind = mapInterceptToBoundaryAction(request);
    const protectedSignals = inferBoundaryProtectedMaterialSignals({
      config: args.config,
      actionKind,
      payload: request.payloadSummary,
    });
    const boundaryRequest = createBoundaryActionRequest({
      config: args.config,
      actionKind,
      target: request.target,
      payloadSummary: request.payloadSummary,
      reviewContext: {
        ...(request.reviewContext ?? { surface: "action" as const }),
        ...(protectedSignals.evidence.length > 0 ? { evidence: protectedSignals.evidence } : {}),
        ...(protectedSignals.protectedSubjectIds.length > 0
          ? { protectedSubjectIds: protectedSignals.protectedSubjectIds }
          : {}),
        ...(protectedSignals.protectedSubjectKinds.length > 0
          ? { protectedSubjectKinds: protectedSignals.protectedSubjectKinds }
          : {}),
      },
      provenance: request.provenance,
      novelty: request.novelty,
      flags: {
        ...(request.flags ?? {}),
        ...(protectedSignals.flags ?? {}),
      },
    });
    const substrateIntercept = await assessBoundarySubstrateIntercept({
      config: args.config,
      request: boundaryRequest,
    });
    if (substrateIntercept.decision === "Deny" && substrateIntercept.reason) {
      return {
        decision: "deny",
        reason: substrateIntercept.reason,
        lawIds: substrateIntercept.triggeredLawIds,
        bodyguardMoves: [],
        requestId: boundaryRequest.requestId,
        actionKind: boundaryRequest.actionKind,
        admissionState: nextAdmState,
      };
    }

    const adjudication = await adjudicateBoundaryRequest({
      config: args.config,
      request: boundaryRequest,
    });

    const verdict = holdSensitiveAllow(
      adjudication.result.decision,
      adjudication.result.reason,
      adjudication.request.actionKind,
      request.target,
    );
    return {
      decision: verdict.decision,
      reason: verdict.reason,
      lawIds: adjudication.result.triggeredLawIds,
      bodyguardMoves: adjudication.bodyguardMoves,
      requestId: adjudication.request.requestId,
      actionKind: adjudication.request.actionKind,
      admissionState: nextAdmState,
    };
  }

  // No admission config — standard intercept path (no change to existing behavior)
  const nonAdmissionActionKind = mapInterceptToBoundaryAction(request);
  const protectedSignals = inferBoundaryProtectedMaterialSignals({
    config: args.config,
    actionKind: nonAdmissionActionKind,
    payload: request.payloadSummary,
  });
  const boundaryRequest = createBoundaryActionRequest({
    config: args.config,
    actionKind: nonAdmissionActionKind,
    target: request.target,
    payloadSummary: request.payloadSummary,
    reviewContext: {
      ...(request.reviewContext ?? { surface: "action" as const }),
      ...(protectedSignals.evidence.length > 0 ? { evidence: protectedSignals.evidence } : {}),
      ...(protectedSignals.protectedSubjectIds.length > 0
        ? { protectedSubjectIds: protectedSignals.protectedSubjectIds }
        : {}),
      ...(protectedSignals.protectedSubjectKinds.length > 0
        ? { protectedSubjectKinds: protectedSignals.protectedSubjectKinds }
        : {}),
    },
    provenance: request.provenance,
    novelty: request.novelty,
    flags: {
      ...(request.flags ?? {}),
      ...(protectedSignals.flags ?? {}),
    },
  });
  const substrateIntercept = await assessBoundarySubstrateIntercept({
    config: args.config,
    request: boundaryRequest,
  });
  if (substrateIntercept.decision === "Deny" && substrateIntercept.reason) {
    return {
      decision: "deny",
      reason: substrateIntercept.reason,
      lawIds: substrateIntercept.triggeredLawIds,
      bodyguardMoves: [],
      requestId: boundaryRequest.requestId,
      actionKind: boundaryRequest.actionKind,
    };
  }

  const adjudication = await adjudicateBoundaryRequest({
    config: args.config,
    request: boundaryRequest,
  });

  const verdict = holdSensitiveAllow(
    adjudication.result.decision,
    adjudication.result.reason,
    adjudication.request.actionKind,
    request.target,
  );
  return {
    decision: verdict.decision,
    reason: verdict.reason,
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
  | {
      command: "swarm_approve";
      requestId?: string;
      groupId: string;
      issuedBy?: string;
      reason?: string;
      asLaw?: boolean;
    }
  | {
      command: "swarm_deny";
      requestId?: string;
      groupId: string;
      deniedBy?: string;
      reason?: string;
      asLaw?: boolean;
    }
  | {
      command: "ingress_allow_once";
      requestId?: string;
      provenance: string;
      issuedBy?: string;
      reason?: string;
    }
  | {
      command: "ingress_allow_as_law";
      requestId?: string;
      provenance: string;
      issuedBy?: string;
      reason?: string;
    }
  | {
      command: "ingress_deny_once";
      requestId?: string;
      provenance: string;
      deniedBy?: string;
      reason?: string;
    }
  | {
      command: "ingress_deny_as_law";
      requestId?: string;
      provenance: string;
      deniedBy?: string;
      reason?: string;
    };

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
