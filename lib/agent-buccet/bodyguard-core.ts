import { auditBoundarySessionLedger } from "./ledger-audit.ts";
import { buildBoundaryBodyguardMoves } from "./bodyguard-moves.ts";
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
      triggeredLawIds: [standingUserLaw.entry.id],
      requiresApproval: false,
    };
  }

  return {
    decision: "deny",
    reason: `blocked by standing UPL denial ${standingUserLaw.entry.id}`,
    triggeredLawIds: [standingUserLaw.entry.id],
    requiresApproval: false,
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

  const audit = await auditBoundarySessionLedger(args.config.session.sessionId);
  if (audit.status !== "complete") {
    const result: BoundaryLawResult = {
      decision: "deny",
      reason: audit.reason,
      triggeredLawIds: ["META.LEDGER.02"],
      requiresApproval: false,
    };
    return {
      result,
      nslMoves: buildBoundaryBodyguardMoves(args.request, result),
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
  if (args.config.session.status === "ended") {
    return {
      result: {
        decision: "deny",
        reason: "session has been ended by the user and can no longer authorize actions",
        triggeredLawIds: ["BOUNDARY.SESSION.ENDED.01"],
        requiresApproval: false,
      },
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

  const result = evaluateBoundaryLaws({
    session: args.config.session,
    request: args.request,
    laws: args.config.laws,
    grants: args.config.grants,
    approvalRequiredFor: args.config.approvalRequiredFor,
  });

  return {
    result,
    nslMoves: buildBoundaryBodyguardMoves(args.request, result),
  };
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
