import { randomUUID } from "node:crypto";
import {
  applyBodyguardUserLawDecision,
  resolveBodyguardStandingLaw,
} from "./bodyguard-core.ts";
import { auditBoundarySessionLedger } from "./ledger-audit.ts";
import { appendBoundaryLedger } from "./ledger.ts";
import { buildBoundaryNslMoves } from "./nsl.ts";
import { evaluateBoundaryAction } from "./runtime.ts";
import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryApprovalDecision,
  BoundaryApprovalRequest,
  BoundaryLawResult,
  BoundaryRequestProvenance,
  BoundaryRuntimeConfig,
  NslMove,
} from "./types.ts";

export type BoundaryExecutionResult<T = void> = {
  config: BoundaryRuntimeConfig;
  allowed: boolean;
  executed: boolean;
  requiresApproval: boolean;
  reason: string;
  nslMoves: NslMove[];
  value?: T;
};

export function createBoundaryActionRequest(args: {
  config: BoundaryRuntimeConfig;
  actionKind: BoundaryActionKind;
  target: string;
  payloadSummary?: string;
  provenance?: BoundaryRequestProvenance;
  flags?: BoundaryActionRequest["flags"];
}): BoundaryActionRequest {
  return {
    requestId: randomUUID(),
    sessionId: args.config.session.sessionId,
    actionKind: args.actionKind,
    target: args.target,
    payloadSummary: args.payloadSummary,
    requestedAt: new Date().toISOString(),
    provenance: args.provenance ?? "agent_inference",
    flags: args.flags,
  };
}

async function logBlockedAction(
  config: BoundaryRuntimeConfig,
  request: BoundaryActionRequest,
  reason: string,
  lawIds: string[],
): Promise<void> {
  await appendBoundaryLedger("ACTION_BLOCKED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    requestId: request.requestId,
    actionKind: request.actionKind,
    target: request.target,
    decision: "deny",
    reason,
    lawIds,
    createdAt: new Date().toISOString(),
  });
}

async function logExecutedAction(
  config: BoundaryRuntimeConfig,
  request: BoundaryActionRequest,
  reason: string,
  metadata?: Record<string, string | number | boolean>,
): Promise<void> {
  await appendBoundaryLedger("ACTION_EXECUTED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    requestId: request.requestId,
    actionKind: request.actionKind,
    target: request.target,
    decision: "allow",
    reason,
    metadata,
    createdAt: new Date().toISOString(),
  });
}

function normalizeApprovalDecision(
  decision: boolean | BoundaryApprovalDecision,
): BoundaryApprovalDecision {
  if (typeof decision === "boolean") {
    return { approved: decision };
  }
  return decision;
}

async function requestApproval(
  config: BoundaryRuntimeConfig,
  approval: BoundaryApprovalRequest,
  lawIds: string[],
): Promise<{ approved: boolean; decision: BoundaryApprovalDecision; witnessRecord: Awaited<ReturnType<typeof appendBoundaryLedger>> }> {
  await appendBoundaryLedger("APPROVAL_REQUESTED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    requestId: approval.request.requestId,
    actionKind: approval.request.actionKind,
    target: approval.request.target,
    decision: "require_approval",
    reason: approval.reason,
    lawIds,
    createdAt: new Date().toISOString(),
  });

  if (!config.approvalHandler) {
    const witnessRecord = await appendBoundaryLedger("APPROVAL_DENIED", {
      sessionId: config.session.sessionId,
      actorId: config.session.actorId,
      requestId: approval.request.requestId,
      actionKind: approval.request.actionKind,
      target: approval.request.target,
      decision: "deny",
      reason: "approval denied or unavailable",
      lawIds,
      createdAt: new Date().toISOString(),
    });
    return { approved: false, decision: { approved: false }, witnessRecord };
  }

  const decision = normalizeApprovalDecision(await config.approvalHandler(approval));
  const witnessRecord = await appendBoundaryLedger(decision.approved ? "APPROVAL_GRANTED" : "APPROVAL_DENIED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    requestId: approval.request.requestId,
    actionKind: approval.request.actionKind,
    target: approval.request.target,
    decision: decision.approved ? "allow" : "deny",
    reason: decision.approved ? "approval granted by user" : "approval denied or unavailable",
    lawIds,
    createdAt: new Date().toISOString(),
  });

  return { approved: decision.approved, decision, witnessRecord };
}

export async function executeBoundaryControlledAction<T>(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  execute?: () => Promise<T>;
  successReason: string;
  dryRunPreviewReason?: string;
  successMetadata?: Record<string, string | number | boolean>;
}): Promise<BoundaryExecutionResult<T>> {
  let activeConfig = args.config;
  let activeRequest = args.request;
  const sessionAudit = await auditBoundarySessionLedger(args.config.session.sessionId);
  if (sessionAudit.status !== "complete") {
    const result: BoundaryLawResult = {
      decision: "deny",
      reason: sessionAudit.reason,
      triggeredLawIds: ["META.LEDGER.02"],
      requiresApproval: false,
    };
    const nslMoves = buildBoundaryNslMoves(args.request, result);

    await appendBoundaryLedger("ACTION_PROPOSED", {
      sessionId: args.config.session.sessionId,
      actorId: args.config.session.actorId,
      requestId: args.request.requestId,
      actionKind: args.request.actionKind,
      target: args.request.target,
      reason: "action proposed during incomplete session ledger state",
      createdAt: args.request.requestedAt,
    });

    await logBlockedAction(
      args.config,
      args.request,
      result.reason,
      result.triggeredLawIds,
    );

    for (const move of nslMoves) {
      await appendBoundaryLedger("NSL_MOVE_SUGGESTED", {
        sessionId: args.config.session.sessionId,
        actorId: args.config.session.actorId,
        requestId: args.request.requestId,
        moveId: move.moveId,
        actionKind: args.request.actionKind,
        target: args.request.target,
        decision: result.decision,
        reason: move.description,
        lawIds: result.triggeredLawIds,
        createdAt: new Date().toISOString(),
      });
    }

    return {
      config: activeConfig,
      allowed: false,
      executed: false,
      requiresApproval: false,
      reason: result.reason,
      nslMoves,
    };
  }

  const preGravityStandingLaw = resolveBodyguardStandingLaw({
    config: activeConfig,
    request: activeRequest,
  });

  if (preGravityStandingLaw?.decision === "deny") {
    await logBlockedAction(
      activeConfig,
      activeRequest,
      preGravityStandingLaw.reason,
      preGravityStandingLaw.triggeredLawIds,
    );
    return {
      config: activeConfig,
      allowed: false,
      executed: false,
      requiresApproval: false,
      reason: preGravityStandingLaw.reason,
      nslMoves: [],
    };
  }

  if (preGravityStandingLaw?.decision === "allow") {
    if (!args.execute) {
      return {
        config: activeConfig,
        allowed: true,
        executed: false,
        requiresApproval: false,
        reason: preGravityStandingLaw.reason,
        nslMoves: [],
      };
    }

    const isMutatingAction = activeRequest.actionKind !== "fs.read";
    if (activeConfig.session.dryRun && isMutatingAction) {
      const reason =
        args.dryRunPreviewReason ?? "session is in dry-run mode; action previewed but not executed";
      await logExecutedAction(activeConfig, activeRequest, reason, { dry_run: true });
      return {
        config: activeConfig,
        allowed: true,
        executed: false,
        requiresApproval: false,
        reason,
        nslMoves: [],
      };
    }

    const value = await args.execute();
    await logExecutedAction(
      activeConfig,
      activeRequest,
      `executed under ${preGravityStandingLaw.reason.replace(/^allowed by /, "")}`,
      args.successMetadata,
    );
    return {
      config: activeConfig,
      allowed: true,
      executed: true,
      requiresApproval: false,
      reason: preGravityStandingLaw.reason,
      nslMoves: [],
      value,
    };
  }

  if (activeConfig.gravityService) {
    const gravity = await activeConfig.gravityService.enforceRequest({
      config: activeConfig,
      request: activeRequest,
    });

    if (gravity.outcome === "deny") {
      for (const move of gravity.nslMoves) {
        await appendBoundaryLedger("NSL_MOVE_SUGGESTED", {
          sessionId: activeConfig.session.sessionId,
          actorId: activeConfig.session.actorId,
          requestId: activeRequest.requestId,
          moveId: move.moveId,
          actionKind: activeRequest.actionKind,
          target: activeRequest.target,
          decision: "deny",
          reason: move.description,
          lawIds: gravity.lawIds,
          createdAt: new Date().toISOString(),
        });
      }
      await logBlockedAction(activeConfig, activeRequest, gravity.reason, gravity.lawIds);
      return {
        config: activeConfig,
        allowed: false,
        executed: false,
        requiresApproval: false,
        reason: gravity.reason,
        nslMoves: gravity.nslMoves,
      };
    }

    if (gravity.outcome === "nsl_grant_offer") {
      for (const move of gravity.nslMoves) {
        await appendBoundaryLedger("NSL_MOVE_SUGGESTED", {
          sessionId: activeConfig.session.sessionId,
          actorId: activeConfig.session.actorId,
          requestId: activeRequest.requestId,
          moveId: move.moveId,
          actionKind: activeRequest.actionKind,
          target: activeRequest.target,
          decision: "deny",
          reason: move.description,
          lawIds: gravity.lawIds,
          createdAt: new Date().toISOString(),
        });
      }

      const approved = await requestApproval(
        activeConfig,
        {
          session: activeConfig.session,
          request: activeRequest,
          reason: gravity.reason,
          lawIds: gravity.lawIds,
          nslMoves: gravity.nslMoves,
        },
        gravity.lawIds,
      );

      if (!approved) {
        await gravity.denyGrant();
        await logBlockedAction(activeConfig, activeRequest, gravity.reason, gravity.lawIds);
        return {
          config: activeConfig,
          allowed: false,
          executed: false,
          requiresApproval: true,
          reason: gravity.reason,
          nslMoves: gravity.nslMoves,
        };
      }

      const replay = await gravity.applyGrant({
        session: activeConfig.session,
        request: activeRequest,
        reason: gravity.reason,
        lawIds: gravity.lawIds,
        nslMoves: gravity.nslMoves,
      });
      activeConfig = replay.config;
      activeRequest = replay.request;
    }

    if (gravity.outcome === "transform" && gravity.request.requestId !== activeRequest.requestId) {
      activeRequest = gravity.request;
    }
  }

  const evaluation = await evaluateBoundaryAction(activeConfig, activeRequest);

  if (evaluation.result.decision === "deny") {
    await logBlockedAction(
      activeConfig,
      activeRequest,
      evaluation.result.reason,
      evaluation.result.triggeredLawIds,
    );
    return {
      config: activeConfig,
      allowed: false,
      executed: false,
      requiresApproval: false,
      reason: evaluation.result.reason,
      nslMoves: evaluation.nslMoves,
    };
  }

  const standingLaw = resolveBodyguardStandingLaw({
    config: activeConfig,
    request: activeRequest,
  });

  if (standingLaw?.decision === "deny") {
    await logBlockedAction(
      activeConfig,
      activeRequest,
      standingLaw.reason,
      standingLaw.triggeredLawIds,
    );
    return {
      config: activeConfig,
      allowed: false,
      executed: false,
      requiresApproval: false,
      reason: standingLaw.reason,
      nslMoves: [],
    };
  }

  if (standingLaw?.decision === "allow") {
    if (!args.execute) {
      return {
        config: activeConfig,
        allowed: true,
        executed: false,
        requiresApproval: false,
        reason: standingLaw.reason,
        nslMoves: [],
      };
    }
    const value = await args.execute();
    await logExecutedAction(
      activeConfig,
      activeRequest,
      `executed under ${standingLaw.reason.replace(/^allowed by /, "")}`,
      args.successMetadata,
    );
    return {
      config: activeConfig,
      allowed: true,
      executed: true,
      requiresApproval: false,
      reason: standingLaw.reason,
      nslMoves: [],
      value,
    };
  }

  if (evaluation.result.decision === "require_approval") {
    const approvalResult = await requestApproval(
      activeConfig,
      {
        session: activeConfig.session,
        request: activeRequest,
        reason: evaluation.result.reason,
        lawIds: evaluation.result.triggeredLawIds,
        nslMoves: evaluation.nslMoves,
      },
      evaluation.result.triggeredLawIds,
    );
    activeConfig = await applyBodyguardUserLawDecision({
      config: activeConfig,
      request: activeRequest,
      witness: approvalResult.witnessRecord,
      decision: approvalResult.decision,
    });

    if (!approvalResult.approved) {
      await logBlockedAction(
        activeConfig,
        activeRequest,
        evaluation.result.reason,
        evaluation.result.triggeredLawIds,
      );
      return {
        config: activeConfig,
        allowed: false,
        executed: false,
        requiresApproval: true,
        reason: evaluation.result.reason,
        nslMoves: evaluation.nslMoves,
      };
    }
  }

  if (!args.execute) {
    return {
      config: activeConfig,
      allowed: true,
      executed: false,
      requiresApproval: evaluation.result.requiresApproval,
      reason: args.successReason,
      nslMoves: evaluation.nslMoves,
    };
  }

  const isMutatingAction = activeRequest.actionKind !== "fs.read";
  if (activeConfig.session.dryRun && isMutatingAction) {
    const reason =
      args.dryRunPreviewReason ?? "session is in dry-run mode; action previewed but not executed";
    await logExecutedAction(activeConfig, activeRequest, reason, { dry_run: true });
    return {
      config: activeConfig,
      allowed: true,
      executed: false,
      requiresApproval: evaluation.result.requiresApproval,
      reason,
      nslMoves: evaluation.nslMoves,
    };
  }

  const value = await args.execute();
  await logExecutedAction(activeConfig, activeRequest, args.successReason, args.successMetadata);

  return {
    config: activeConfig,
    allowed: true,
    executed: true,
    requiresApproval: evaluation.result.requiresApproval,
    reason: args.successReason,
    nslMoves: evaluation.nslMoves,
    value,
  };
}
