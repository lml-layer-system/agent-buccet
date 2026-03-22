import { randomUUID } from "node:crypto";
import {
  applyBodyguardUserLawDecision,
  resolveBodyguardStandingLaw,
} from "./bodyguard-core.ts";
import { BoundaryApprovalTimeoutError } from "./errors.ts";
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

/**
 * The result of a boundary-controlled action execution.
 *
 * - `allowed` — whether the action was permitted by the law engine.
 * - `executed` — whether the `execute` function was actually called.
 * - `requiresApproval` — whether approval was required (even if granted).
 * - `reason` — human-readable explanation of the decision.
 * - `nslMoves` — suggested next lawful moves if the action was denied or deferred.
 * - `value` — the return value of the `execute` function, if it ran.
 */
export type BoundaryExecutionResult<T = void> = {
  config: BoundaryRuntimeConfig;
  allowed: boolean;
  executed: boolean;
  requiresApproval: boolean;
  reason: string;
  nslMoves: NslMove[];
  value?: T;
};

/**
 * Constructs a `BoundaryActionRequest` from the current config and action parameters.
 *
 * This is the standard way to build a request before calling `evaluateBoundaryAction`
 * or `executeBoundaryControlledAction`. The request captures a timestamp and a unique
 * ID at creation time, both of which are recorded in the ledger.
 *
 * @param args.config - Current runtime config (used for session context).
 * @param args.actionKind - The kind of action being proposed.
 * @param args.target - The resource target (path, URL, tool name, etc.).
 * @param args.payloadSummary - Optional human-readable description of the payload.
 * @param args.provenance - Trust level of the action source. Defaults to `"agent_inference"`.
 * @param args.flags - Optional flags that activate specific time-body laws.
 * @returns A fully-formed `BoundaryActionRequest` ready for evaluation.
 */
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

  await config.hooks?.onApprovalRequested?.(approval);

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

  let rawDecision: boolean | BoundaryApprovalDecision;
  if (config.approvalTimeoutMs !== undefined) {
    const timeoutMs = config.approvalTimeoutMs;
    const behavior = config.approvalTimeoutBehavior ?? "deny";
    rawDecision = await Promise.race([
      config.approvalHandler(approval),
      new Promise<boolean>((resolve, reject) => {
        setTimeout(() => {
          if (behavior === "throw") {
            reject(
              new BoundaryApprovalTimeoutError(
                `approval timed out after ${timeoutMs}ms`,
              ),
            );
          } else {
            resolve(false);
          }
        }, timeoutMs);
      }),
    ]);
  } else {
    rawDecision = await config.approvalHandler(approval);
  }
  const decision = normalizeApprovalDecision(rawDecision);
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

/**
 * The primary action enforcement + execution function.
 *
 * Orchestrates the full enforcement loop for a proposed action:
 * 1. Fires `onBeforeAction` hook if configured.
 * 2. Checks session ledger completeness (denies if incomplete).
 * 3. Checks the User Path Ledger for a standing allow/deny.
 * 4. Runs through the gravity service (freeze-and-forward) if attached.
 * 5. Evaluates all active laws via `evaluateBoundaryAction`.
 * 6. Dispatches to the approval handler if `"require_approval"`.
 * 7. Executes the `execute` function only if fully admitted.
 * 8. Records the decision and outcome in the ledger.
 * 9. Fires `onAfterAction` hook if configured.
 *
 * @param args.config - Current runtime config.
 * @param args.request - The proposed action request.
 * @param args.execute - Optional async function that performs the action.
 *   Called only if the action is admitted. Not called in dry-run mode.
 * @param args.successReason - Ledger reason recorded on successful execution.
 * @param args.dryRunPreviewReason - Optional reason recorded when dry-run prevents execution.
 * @param args.successMetadata - Optional metadata recorded on successful execution.
 * @returns `BoundaryExecutionResult<T>` — enforcement outcome with optional return value.
 *
 * @example
 * ```typescript
 * const result = await executeBoundaryControlledAction({
 *   config,
 *   request: createBoundaryActionRequest({ config, actionKind: "fs.write", target: "/tmp/out.txt" }),
 *   successReason: "write admitted by open path grant",
 *   execute: async () => fs.writeFile("/tmp/out.txt", "hello"),
 * });
 * if (!result.allowed) console.log("blocked:", result.reason);
 * ```
 */
export async function executeBoundaryControlledAction<T>(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  execute?: () => Promise<T>;
  successReason: string;
  dryRunPreviewReason?: string;
  successMetadata?: Record<string, string | number | boolean>;
}): Promise<BoundaryExecutionResult<T>> {
  await args.config.hooks?.onBeforeAction?.(args.request);
  const result = await _executeBoundaryControlledActionCore(args);
  await args.config.hooks?.onAfterAction?.(args.request, {
    allowed: result.allowed,
    executed: result.executed,
    reason: result.reason,
  });
  return result;
}

async function _executeBoundaryControlledActionCore<T>(args: {
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
      triggeredLawIds: ["TIME.LEDGER.02"],
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
