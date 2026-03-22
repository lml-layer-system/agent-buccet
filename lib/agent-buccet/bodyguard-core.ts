import { buildBoundaryBodyguardMoves } from "./bodyguard-moves.ts";
import {
  createBoundaryGravityService,
  type BoundaryGravityEnforcement,
} from "./gravity-adapter/gravity-service.ts";
import { appendBoundaryLedger } from "./ledger.ts";
import { evaluateBoundaryLaws } from "./laws.ts";
import {
  getActiveUserLawIds,
  lookupUserPathDecision,
  writeApprovedUserPathLaw,
  writeDeniedUserPathLaw,
} from "./user-path-ledger.ts";
import type {
  BoundaryActionRequest,
  BoundaryApprovalDecision,
  BoundaryLawResult,
  BoundaryLedgerRecord,
  BoundaryRuntimeConfig,
  NslMove,
} from "./types.ts";

export type BodyguardAdjudication = {
  result: BoundaryLawResult;
  nslMoves: NslMove[];
};

export type BodyguardHeldDecision = BodyguardAdjudication | null;

export type BodyguardRequestAdjudication = BodyguardAdjudication & {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  grantOffer?: Extract<BoundaryGravityEnforcement, { outcome: "nsl_grant_offer" }>;
};

export function attachBodyguardControl(
  config: BoundaryRuntimeConfig,
  overrides?: Partial<BoundaryRuntimeConfig>,
): BoundaryRuntimeConfig {
  return {
    ...config,
    ...overrides,
    bodyguardOnline: true,
  };
}

export function resolveBodyguardStandingLaw(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): BoundaryLawResult | null {
  const standingUserLaw = args.config.upl
    ? lookupUserPathDecision({
      ledger: args.config.upl,
      session: args.config.session,
      request: args.request,
    })
    : null;

  if (!standingUserLaw) {
    return null;
  }

  if (standingUserLaw.decision === "allow") {
    return {
      decision: "allow",
      reason: `allowed by standing UPL approval ${standingUserLaw.entry.id}`,
      triggeredLawIds: [
        standingUserLaw.entry.id,
        ...(
          args.config.runtimeMuscle?.timeLawIdsByCategory.user_path_ledger ?? []
        ),
      ],
      requiresApproval: false,
    };
  }

  return {
    decision: "deny",
    reason: `blocked by standing UPL denial ${standingUserLaw.entry.id}`,
    triggeredLawIds: [
      standingUserLaw.entry.id,
      ...(
        args.config.runtimeMuscle?.timeLawIdsByCategory.user_path_ledger ?? []
      ),
    ],
    requiresApproval: false,
  };
}

function expandRuntimeMuscleTriggeredLawIds(
  config: BoundaryRuntimeConfig,
  result: BoundaryLawResult,
): BoundaryLawResult {
  const runtimeMuscle = config.runtimeMuscle;
  if (!runtimeMuscle) {
    return result;
  }

  const extraLawIds = new Set<string>();
  for (const lawId of result.triggeredLawIds) {
    switch (lawId) {
      case "META.TRUST.01":
        for (const id of runtimeMuscle.timeLawIdsByCategory.truth_alignment ?? []) extraLawIds.add(id);
        break;
      case "META.AUTHORITY.01":
        for (const id of runtimeMuscle.timeLawIdsByCategory.authority_bypass ?? []) extraLawIds.add(id);
        break;
      case "META.NOVELTY.01":
        for (const id of runtimeMuscle.timeLawIdsByCategory.hallucination_prevention ?? []) extraLawIds.add(id);
        break;
      case "META.SCOPE.01":
        for (const id of runtimeMuscle.timeLawIdsByCategory.safety_governance ?? []) extraLawIds.add(id);
        break;
      case "META.LAW.01":
        for (const id of runtimeMuscle.timeLawIdsByCategory.meta_law ?? []) extraLawIds.add(id);
        break;
      case "META.SESSION.01":
        for (const id of runtimeMuscle.timeLawIdsByCategory.memory_temporal ?? []) extraLawIds.add(id);
        break;
      case "META.LEDGER.01":
        for (const id of runtimeMuscle.timeLawIdsByCategory.ledger_proof ?? []) extraLawIds.add(id);
        break;
      default:
        break;
    }
  }

  if (extraLawIds.size === 0) {
    return result;
  }

  return {
    ...result,
    triggeredLawIds: [...new Set([...result.triggeredLawIds, ...extraLawIds])],
  };
}

export async function resolveBodyguardHeldRequest(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): Promise<BodyguardHeldDecision> {
  if (!args.config.bodyguardOnline) {
    const result: BoundaryLawResult = {
      decision: "deny",
      reason: "bodyguard is offline; no decision handoff is available",
      triggeredLawIds: ["BODYGUARD.OFFLINE.01"],
      requiresApproval: false,
    };
    return {
      result,
      nslMoves: [],
    };
  }

  if (args.config.session.status === "ended") {
    const result: BoundaryLawResult = {
      decision: "deny",
      reason: "session has been ended by the user and can no longer authorize actions",
      triggeredLawIds: ["BOUNDARY.SESSION.ENDED.01"],
      requiresApproval: false,
    };
    return {
      result,
      nslMoves: [],
    };
  }

  const standingLaw = resolveBodyguardStandingLaw(args);
  if (standingLaw) {
    return {
      result: standingLaw,
      nslMoves: [],
    };
  }

  return null;
}

export function evaluateBodyguardAction(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): BodyguardAdjudication {
  const standingLaw = resolveBodyguardStandingLaw(args);
  if (standingLaw) {
    return {
      result: standingLaw,
      nslMoves: [],
    };
  }

  const result = evaluateBoundaryLaws({
    session: args.config.session,
    request: args.request,
    laws: args.config.laws,
    grants: args.config.grants,
    approvalRequiredFor: args.config.approvalRequiredFor,
  });
  const expandedResult = expandRuntimeMuscleTriggeredLawIds(args.config, result);

  return {
    result: expandedResult,
    nslMoves: buildBoundaryBodyguardMoves(args.request, expandedResult),
  };
}

export async function adjudicateBodyguardRequest(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): Promise<BodyguardRequestAdjudication> {
  const heldDecision = await resolveBodyguardHeldRequest(args);
  if (heldDecision) {
    return {
      ...heldDecision,
      config: args.config,
      request: args.request,
    };
  }

  {
    const gravityService = args.config.gravityService ?? createBoundaryGravityService();
    const gravity = await gravityService.enforceRequest({
      config: args.config,
      request: args.request,
    });

    if (gravity.outcome === "deny") {
      return {
        config: gravity.config,
        request: gravity.request,
        result: {
          decision: "deny",
          reason: gravity.reason,
          triggeredLawIds: gravity.lawIds,
          requiresApproval: false,
        },
        nslMoves: gravity.nslMoves,
      };
    }

    if (gravity.outcome === "nsl_grant_offer") {
      return {
        config: gravity.config,
        request: gravity.request,
        result: {
          decision: "require_approval",
          reason: gravity.reason,
          triggeredLawIds: gravity.lawIds,
          requiresApproval: true,
        },
        nslMoves: gravity.nslMoves,
        grantOffer: gravity,
      };
    }

    const nextConfig = gravity.config ?? args.config;
    const nextRequest = gravity.request ?? args.request;
    const adjudication = evaluateBodyguardAction({
      config: nextConfig,
      request: nextRequest,
    });
    return {
      ...adjudication,
      config: nextConfig,
      request: nextRequest,
    };
  }
}

export async function applyBodyguardUserLawDecision(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  witness: BoundaryLedgerRecord;
  decision: BoundaryApprovalDecision;
}): Promise<BoundaryRuntimeConfig> {
  if (!args.config.upl) {
    return args.config;
  }

  let upl = args.config.upl;

  if (args.decision.approved) {
    upl = await writeApprovedUserPathLaw({
      ledger: upl,
      request: args.request,
      witness: args.witness,
      session: args.config.session,
      decision: args.decision,
    });
    await appendBoundaryLedger("UPL_ALLOW_RECORDED", {
      sessionId: args.config.session.sessionId,
      actorId: args.config.session.actorId,
      requestId: args.request.requestId,
      actionKind: args.request.actionKind,
      target: args.request.target,
      decision: "allow",
      reason: "standing UPL approval recorded",
      lawIds: [upl.userApprovedLawPaths[upl.userApprovedLawPaths.length - 1]?.id].filter(Boolean),
      metadata: {
        witness_record: args.witness.META.id,
        upl_scope: args.decision.scope ?? "GLOBAL",
      },
      createdAt: new Date().toISOString(),
    });
  } else if (args.decision.persistDenied) {
    upl = await writeDeniedUserPathLaw({
      ledger: upl,
      request: args.request,
      witness: args.witness,
      session: args.config.session,
      decision: args.decision,
    });
    await appendBoundaryLedger("UPL_DENY_RECORDED", {
      sessionId: args.config.session.sessionId,
      actorId: args.config.session.actorId,
      requestId: args.request.requestId,
      actionKind: args.request.actionKind,
      target: args.request.target,
      decision: "deny",
      reason: "standing UPL denial recorded",
      lawIds: [upl.userDeniedLawPaths[upl.userDeniedLawPaths.length - 1]?.id].filter(Boolean),
      metadata: {
        witness_record: args.witness.META.id,
        upl_scope: args.decision.scope ?? "GLOBAL",
      },
      createdAt: new Date().toISOString(),
    });
  } else {
    return args.config;
  }

  return {
    ...args.config,
    upl,
    userLawIds: [
      ...new Set([
        ...(args.config.userLawIds ?? []),
        ...getActiveUserLawIds(upl, args.config.session),
      ]),
    ],
  };
}
