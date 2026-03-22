import { appendBoundaryLedger } from "./ledger.ts";
import { evaluateBoundaryLaws } from "./laws.ts";
import { buildBoundaryNslMoves } from "./nsl.ts";
import { resolveBodyguardStandingLaw } from "./bodyguard-core.ts";
import {
  instantiateBoundaryGrant,
  instantiatePathLaw,
} from "./orchestrator.ts";
import { persistBoundarySessionState } from "./state.ts";
import type {
  BoundaryActionRequest,
  BoundaryActionKind,
  BoundaryGrant,
  BoundaryPathLaw,
  BoundaryResourceKind,
  BoundaryRuntimeConfig,
  BoundaryLawResult,
  NslMove,
} from "./types.ts";

export type BoundaryEvaluation = {
  result: BoundaryLawResult;
  nslMoves: NslMove[];
};

export type OpenPathResult = {
  grant: BoundaryGrant;
  pathLaw: BoundaryPathLaw;
};

function revokePathLawsForGrant(
  pathLaws: BoundaryPathLaw[],
  grant: BoundaryGrant,
  revokedAt: string,
): BoundaryPathLaw[] {
  const targetLawId = typeof grant.metadata?.law_id === "string" ? grant.metadata.law_id : undefined;
  return pathLaws.map((pathLaw) => {
    if (targetLawId && pathLaw.lawId === targetLawId) {
      return { ...pathLaw, revokedAt };
    }
    if (pathLaw.rootPath === grant.resourceValue) {
      return { ...pathLaw, revokedAt };
    }
    return pathLaw;
  });
}

export async function issueBoundaryGrant(args: {
  config: BoundaryRuntimeConfig;
  resourceKind: BoundaryResourceKind;
  resourceValue: string;
  grantedActions: BoundaryActionKind[];
  issuedBy: string;
  expiresAt?: string;
  metadata?: Record<string, string | number | boolean>;
}): Promise<{ grant: BoundaryGrant; config: BoundaryRuntimeConfig }> {
  const issuedAt = new Date().toISOString();
  const grant = instantiateBoundaryGrant({
    session: args.config.session,
    resourceKind: args.resourceKind,
    resourceValue: args.resourceValue,
    grantedActions: args.grantedActions,
    issuedBy: args.issuedBy,
    issuedAt,
    expiresAt: args.expiresAt,
    metadata: args.metadata,
  });

  await appendBoundaryLedger("GRANT_ISSUED", {
    sessionId: args.config.session.sessionId,
    actorId: args.issuedBy,
    grantId: grant.grantId,
    target: args.resourceValue,
    reason: "resource grant issued by user",
    metadata: {
      resource_kind: args.resourceKind,
      granted_actions: args.grantedActions.join(","),
    },
    createdAt: issuedAt,
  });

  const nextConfig: BoundaryRuntimeConfig = {
    ...args.config,
    grants: [...args.config.grants, grant],
  };
  await persistBoundarySessionState(nextConfig);
  return { grant, config: nextConfig };
}

export async function revokeBoundaryGrant(args: {
  config: BoundaryRuntimeConfig;
  grantId: string;
  revokedBy: string;
  reason?: string;
}): Promise<{ grant: BoundaryGrant | null; config: BoundaryRuntimeConfig }> {
  const revokedAt = new Date().toISOString();
  const targetGrant = args.config.grants.find((grant) => grant.grantId === args.grantId) ?? null;
  if (!targetGrant) {
    return { grant: null, config: args.config };
  }

  const revokedGrant: BoundaryGrant = {
    ...targetGrant,
    revokedAt,
  };
  const nextGrants = args.config.grants.map((grant) =>
    grant.grantId === args.grantId ? revokedGrant : grant,
  );
  const nextPathLaws = revokePathLawsForGrant(args.config.pathLaws, revokedGrant, revokedAt);
  const nextConfig: BoundaryRuntimeConfig = {
    ...args.config,
    grants: nextGrants,
    pathLaws: nextPathLaws,
  };

  await appendBoundaryLedger("GRANT_REVOKED", {
    sessionId: args.config.session.sessionId,
    actorId: args.revokedBy,
    grantId: args.grantId,
    target: targetGrant.resourceValue,
    reason: args.reason ?? "resource grant revoked by user",
    metadata: {
      resource_kind: targetGrant.resourceKind,
    },
    createdAt: revokedAt,
  });

  await persistBoundarySessionState(nextConfig);
  return { grant: revokedGrant, config: nextConfig };
}

export async function expireBoundaryGrants(args: {
  config: BoundaryRuntimeConfig;
  nowIso?: string;
}): Promise<{ expiredGrantIds: string[]; config: BoundaryRuntimeConfig }> {
  const nowIso = args.nowIso ?? new Date().toISOString();
  const expiredGrants = args.config.grants.filter(
    (grant) => !grant.revokedAt && Boolean(grant.expiresAt && grant.expiresAt < nowIso),
  );
  if (expiredGrants.length === 0) {
    return { expiredGrantIds: [], config: args.config };
  }

  const expiredGrantIds = new Set(expiredGrants.map((grant) => grant.grantId));
  const nextGrants = args.config.grants.map((grant) =>
    expiredGrantIds.has(grant.grantId) ? { ...grant, revokedAt: nowIso } : grant,
  );
  let nextPathLaws = [...args.config.pathLaws];
  for (const grant of expiredGrants) {
    nextPathLaws = revokePathLawsForGrant(nextPathLaws, grant, nowIso);
    await appendBoundaryLedger("GRANT_EXPIRED", {
      sessionId: args.config.session.sessionId,
      actorId: args.config.session.actorId,
      grantId: grant.grantId,
      target: grant.resourceValue,
      reason: "resource grant expired and is no longer reachable",
      metadata: {
        resource_kind: grant.resourceKind,
      },
      createdAt: nowIso,
    });
  }

  const nextConfig: BoundaryRuntimeConfig = {
    ...args.config,
    grants: nextGrants,
    pathLaws: nextPathLaws,
  };
  await persistBoundarySessionState(nextConfig);
  return { expiredGrantIds: [...expiredGrantIds], config: nextConfig };
}

export async function openBoundaryPath(args: {
  config: BoundaryRuntimeConfig;
  rootPath: string;
  grantedActions: BoundaryActionKind[];
  issuedBy: string;
  expiresAt?: string;
}): Promise<OpenPathResult & { config: BoundaryRuntimeConfig }> {
  const openedAt = new Date().toISOString();
  const { grant, pathLaw } = instantiatePathLaw({
    session: args.config.session,
    rootPath: args.rootPath,
    grantedActions: args.grantedActions,
    issuedBy: args.issuedBy,
    instantiatedAt: openedAt,
    expiresAt: args.expiresAt,
  });

  await appendBoundaryLedger("PATH_OPENED", {
    sessionId: args.config.session.sessionId,
    actorId: args.issuedBy,
    grantId: grant.grantId,
    target: args.rootPath,
    reason: "path opened by user",
    lawIds: [pathLaw.lawId],
    metadata: {
      granted_actions: args.grantedActions.join(","),
    },
    createdAt: openedAt,
  });

  await appendBoundaryLedger("PATH_LAW_INSTANTIATED", {
    sessionId: args.config.session.sessionId,
    actorId: args.issuedBy,
    grantId: grant.grantId,
    target: args.rootPath,
    reason: "opened path became lawful reachable scope for the session",
    lawIds: [pathLaw.lawId],
    metadata: {
      granted_actions: args.grantedActions.join(","),
    },
    createdAt: openedAt,
  });

  const nextConfig: BoundaryRuntimeConfig = {
    ...args.config,
    grants: [...args.config.grants, grant],
    pathLaws: [...args.config.pathLaws, pathLaw],
  };
  await persistBoundarySessionState(nextConfig);

  return { grant, pathLaw, config: nextConfig };
}

export async function evaluateBoundaryAction(
  config: BoundaryRuntimeConfig,
  request: BoundaryActionRequest,
): Promise<BoundaryEvaluation> {
  if (config.session.status === "ended") {
    const result: BoundaryLawResult = {
      decision: "deny",
      reason: "session has been ended by the user and can no longer authorize actions",
      triggeredLawIds: ["BOUNDARY.SESSION.ENDED.01"],
      requiresApproval: false,
    };
    await appendBoundaryLedger("ACTION_BLOCKED", {
      sessionId: config.session.sessionId,
      actorId: config.session.actorId,
      requestId: request.requestId,
      actionKind: request.actionKind,
      target: request.target,
      decision: result.decision,
      reason: result.reason,
      lawIds: result.triggeredLawIds,
      createdAt: new Date().toISOString(),
    });
    return { result, nslMoves: [] };
  }

  await appendBoundaryLedger("ACTION_PROPOSED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    requestId: request.requestId,
    actionKind: request.actionKind,
    target: request.target,
    reason: "action proposed",
    createdAt: request.requestedAt,
  });

  const standingLawResult = resolveBodyguardStandingLaw({ config, request });

  if (standingLawResult?.decision === "allow") {
    return { result: standingLawResult, nslMoves: [] };
  }

  if (standingLawResult?.decision === "deny") {
    await appendBoundaryLedger("ACTION_BLOCKED", {
      sessionId: config.session.sessionId,
      actorId: config.session.actorId,
      requestId: request.requestId,
      actionKind: request.actionKind,
      target: request.target,
      decision: standingLawResult.decision,
      reason: standingLawResult.reason,
      lawIds: standingLawResult.triggeredLawIds,
      createdAt: new Date().toISOString(),
    });
    return { result: standingLawResult, nslMoves: [] };
  }

  const result = evaluateBoundaryLaws({
    session: config.session,
    request,
    laws: config.laws,
    grants: config.grants,
    approvalRequiredFor: config.approvalRequiredFor,
  });

  await appendBoundaryLedger("DECISION_RETURNED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    requestId: request.requestId,
    actionKind: request.actionKind,
    target: request.target,
    decision: result.decision,
    reason: result.reason,
    lawIds: result.triggeredLawIds,
    createdAt: new Date().toISOString(),
  });

  const nslMoves = buildBoundaryNslMoves(request, result);
  for (const move of nslMoves) {
    await appendBoundaryLedger("NSL_MOVE_SUGGESTED", {
      sessionId: config.session.sessionId,
      actorId: config.session.actorId,
      requestId: request.requestId,
      moveId: move.moveId,
      actionKind: request.actionKind,
      target: request.target,
      decision: result.decision,
      reason: move.description,
      lawIds: result.triggeredLawIds,
      createdAt: new Date().toISOString(),
    });
  }

  return { result, nslMoves };
}
