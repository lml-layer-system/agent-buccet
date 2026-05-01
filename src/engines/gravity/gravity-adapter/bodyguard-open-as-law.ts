import {
  buildGrantFromOffer,
  buildOpenAsLawStep,
  LEDGER_EVENTS,
  type BodyguardGrantOffer,
  type BodyguardOpenAsLawStep,
} from "../gravity-core/index.ts";
import { appendBoundaryLedger } from "../ledger.ts";
import { issueBoundaryGrant, openBoundaryPath } from "../runtime.ts";
import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryResourceKind,
  BoundaryRuntimeConfig,
  BodyguardMove,
} from "../types.ts";

// Re-export LEDGER_EVENTS so callers that imported it from here still work
export { LEDGER_EVENTS };

function actionForRequest(request: BoundaryActionRequest): BoundaryActionKind[] {
  return [request.actionKind];
}

export function buildGravityBodyguardMoves(step: BodyguardOpenAsLawStep): BodyguardMove[] {
  return [
    {
      moveId: `open_as_law:${step.scopeKind}:${step.scopeIdentifier}`,
      kind: "open_as_law",
      title: "Open as law",
      description: step.message,
      target: step.scopeIdentifier,
      metadata: {
        scope_kind: step.scopeKind,
        law_code: step.lawCode,
      },
    },
    {
      moveId: `deny_open_as_law:${step.scopeKind}:${step.scopeIdentifier}`,
      kind: "deny_and_explain",
      title: "Deny request",
      description: `Keep ${step.scopeIdentifier} outside current law and block the request.`,
      target: step.scopeIdentifier,
    },
  ];
}

export async function ledgerBodyguardGrantOffer(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  offer: BodyguardGrantOffer;
}) {
  await appendBoundaryLedger("BODYGUARD_GRANT_OFFERED", {
    sessionId: args.config.session.sessionId,
    actorId: args.config.session.actorId,
    requestId: args.request.requestId,
    actionKind: args.request.actionKind,
    target: args.offer.scopeIdentifier,
    decision: "deny",
    reason: args.offer.message,
    lawIds: [args.offer.lawId],
    metadata: {
      scope_kind: args.offer.scopeKind,
      violation_code: args.offer.code,
    },
    createdAt: new Date().toISOString(),
  });
}

export async function applyOpenAsLawBodyguardGrant(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  offer: BodyguardGrantOffer;
  issuedBy: string;
  expiresAt?: number;
}): Promise<BoundaryRuntimeConfig> {
  const issuance = buildGrantFromOffer(args.offer, args.expiresAt);

  if (args.offer.scopeKind === "path") {
    const opened = await openBoundaryPath({
      config: args.config,
      rootPath: args.offer.scopeIdentifier,
      grantedActions: actionForRequest(args.request),
      issuedBy: args.issuedBy,
      expiresAt: issuance.grant.expiresAt ? new Date(issuance.grant.expiresAt).toISOString() : undefined,
    });
    await appendBoundaryLedger("PROPOSAL_REPLAYED", {
      sessionId: args.config.session.sessionId,
      actorId: args.issuedBy,
      requestId: args.request.requestId,
      actionKind: args.request.actionKind,
      target: args.request.target,
      decision: "allow",
      reason: "proposal replayed after open-as-law grant",
      lawIds: [args.offer.lawId],
      createdAt: new Date().toISOString(),
    });
    return opened.config;
  }

  if (args.offer.scopeKind === "other") {
    throw new Error("cannot issue open-as-law grant for unsupported scope kind 'other'");
  }

  const issued = await issueBoundaryGrant({
    config: args.config,
    resourceKind: args.offer.scopeKind as BoundaryResourceKind,
    resourceValue: args.offer.scopeIdentifier,
    grantedActions: actionForRequest(args.request),
    issuedBy: args.issuedBy,
    expiresAt: issuance.grant.expiresAt ? new Date(issuance.grant.expiresAt).toISOString() : undefined,
  });

  await appendBoundaryLedger(issuance.ledgerEventOpened as never, {
    sessionId: args.config.session.sessionId,
    actorId: args.issuedBy,
    requestId: args.request.requestId,
    grantId: issued.grant.grantId,
    actionKind: args.request.actionKind,
    target: args.offer.scopeIdentifier,
    decision: "allow",
    reason: "scope opened as law by explicit user confirmation",
    lawIds: [args.offer.lawId],
    createdAt: new Date().toISOString(),
  });
  await appendBoundaryLedger(issuance.ledgerEventLawInstantiated as never, {
    sessionId: args.config.session.sessionId,
    actorId: args.issuedBy,
    requestId: args.request.requestId,
    grantId: issued.grant.grantId,
    actionKind: args.request.actionKind,
    target: args.offer.scopeIdentifier,
    decision: "allow",
    reason: "opened scope became law for replay",
    lawIds: [args.offer.lawId],
    createdAt: new Date().toISOString(),
  });
  await appendBoundaryLedger("PROPOSAL_REPLAYED", {
    sessionId: args.config.session.sessionId,
    actorId: args.issuedBy,
    requestId: args.request.requestId,
    actionKind: args.request.actionKind,
    target: args.request.target,
    decision: "allow",
    reason: "proposal replayed after open-as-law grant",
    lawIds: [args.offer.lawId],
    createdAt: new Date().toISOString(),
  });
  return issued.config;
}

export async function ledgerBodyguardConfirmedDeny(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  offer: BodyguardGrantOffer;
}) {
  await appendBoundaryLedger("USER_CONFIRMED_DENY", {
    sessionId: args.config.session.sessionId,
    actorId: args.config.session.actorId,
    requestId: args.request.requestId,
    actionKind: args.request.actionKind,
    target: args.request.target,
    decision: "deny",
    reason: "user denied open-as-law request",
    lawIds: [args.offer.lawId],
    createdAt: new Date().toISOString(),
  });
}

export function buildOpenAsLawBodyguardStep(args: {
  offer: BodyguardGrantOffer;
  request: BoundaryActionRequest;
}) {
  return buildOpenAsLawStep(args.offer, {
    kind: args.request.actionKind.startsWith("fs.")
      ? "filesystem"
      : args.request.actionKind === "agent.spend"
        ? "recipient_send"
      : args.request.actionKind === "comm.send"
        ? "recipient_send"
        : args.request.actionKind === "network.send"
          ? "network_send"
          : args.request.actionKind === "tool.exec"
            ? "tool_exec"
            : args.request.actionKind.startsWith("db.")
              ? "database"
              : args.request.actionKind.startsWith("sys.")
                ? "system"
            : "other",
    payload: {
      scopeIdentifier: args.offer.scopeIdentifier,
      scopeKind: args.offer.scopeKind,
      actionLabel: args.offer.actionLabel,
      requestId: args.request.requestId,
    },
    provenance: {
      source: args.request.provenance,
      sessionId: args.request.sessionId,
      originId: args.request.requestId,
      authorityClaimed: args.request.flags?.authorityClaimed,
      claimsCompleteCoverage: args.request.flags?.claimsCompleteCoverage,
      requestsScopeExpansion: args.request.flags?.requestsScopeExpansion,
      requestsLawMutation: args.request.flags?.requestsLawMutation,
      requestsSessionRevival: args.request.flags?.requestsSessionRevival,
      requestsLedgerBypass: args.request.flags?.requestsLedgerBypass,
    },
  });
}
