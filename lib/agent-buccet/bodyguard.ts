import { randomUUID } from "node:crypto";
import { createApprovalQueueAdapter } from "./approval.ts";
import { createBoundaryGravityService } from "./gravity-adapter/gravity-service.ts";
import {
  enforceBoundaryProposal,
  wrapBoundaryTool,
  type BoundaryToolEnvelope,
  type BoundaryToolProposal,
} from "./adapters.ts";
import {
  applyBodyguardUserLawDecision,
  resolveBodyguardStandingLaw,
} from "./bodyguard-core.ts";
import { BoundaryApprovalTimeoutError } from "./errors.ts";
import { appendBoundaryLedger } from "./ledger.ts";
import { evaluateBoundaryLaws } from "./laws.ts";
import { buildBoundaryNslMoves } from "./nsl.ts";
import { createBoundaryGravityAttachment } from "./gravity.ts";
import type { BoundaryRuntimeStore } from "./store.ts";
import { buildTelegramBoundaryProposal } from "./integrations/telegram.ts";
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

export * from "./bodyguard-core.ts";

/**
 * The raw law evaluation result paired with NSL move suggestions.
 * Returned by `evaluateBoundaryAction`.
 */
export type BoundaryEvaluation = {
  result: BoundaryLawResult;
  nslMoves: NslMove[];
};

/**
 * Evaluates a proposed action against the active session laws.
 *
 * This function is Bodyguard-owned. It does NOT re-check session status or UPL —
 * those are handled by the Bodyguard enforcement loop before this is called.
 * The snapped runtime muscle participates here directly: active muscle families
 * govern categorical invariants (law mutation, ledger bypass, session revival)
 * before the default law set runs.
 *
 * Remaining gap: full muscle-governed adjudication (all families converted to
 * evaluated BoundaryLaw objects) is the next step — base invariant and temporal
 * continuity families are enforced directly here as the current step forward.
 */
export async function evaluateBoundaryAction(
  config: BoundaryRuntimeConfig,
  request: BoundaryActionRequest,
): Promise<BoundaryEvaluation> {
  await appendBoundaryLedger("ACTION_PROPOSED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    requestId: request.requestId,
    actionKind: request.actionKind,
    target: request.target,
    reason: "action proposed",
    createdAt: request.requestedAt,
  });

  // Snapped runtime muscle participates in live adjudication.
  // Active muscle families enforce categorical invariants before default law evaluation.
  if (config.runtimeMuscle) {
    const structuralViolation =
      request.flags?.requestsLawMutation || request.flags?.requestsLedgerBypass;

    if (structuralViolation) {
      const governingFamily = config.runtimeMuscle.base.families.find(
        (f) => f.status === "active",
      );
      if (governingFamily) {
        const muscleResult: BoundaryLawResult = {
          decision: "deny",
          reason: `[${governingFamily.familyId}] ${governingFamily.familyTitle}: ${governingFamily.familyCompressedLaw.slice(0, 200)}`,
          triggeredLawIds: [governingFamily.familyId],
          requiresApproval: false,
        };
        await appendBoundaryLedger("DECISION_RETURNED", {
          sessionId: config.session.sessionId,
          actorId: config.session.actorId,
          requestId: request.requestId,
          actionKind: request.actionKind,
          target: request.target,
          decision: muscleResult.decision,
          reason: muscleResult.reason,
          lawIds: muscleResult.triggeredLawIds,
          createdAt: new Date().toISOString(),
        });
        return { result: muscleResult, nslMoves: [] };
      }
    }

    const timeViolation = request.flags?.requestsSessionRevival;
    const timeFamilyActive = config.runtimeMuscle.time.family.status === "active";
    if (timeViolation && timeFamilyActive) {
      const tf = config.runtimeMuscle.time.family;
      const muscleResult: BoundaryLawResult = {
        decision: "deny",
        reason: `[${tf.familyId}] ${tf.familyTitle}: ${tf.familyCompressedLaw.slice(0, 200)}`,
        triggeredLawIds: [tf.familyId],
        requiresApproval: false,
      };
      await appendBoundaryLedger("DECISION_RETURNED", {
        sessionId: config.session.sessionId,
        actorId: config.session.actorId,
        requestId: request.requestId,
        actionKind: request.actionKind,
        target: request.target,
        decision: muscleResult.decision,
        reason: muscleResult.reason,
        lawIds: muscleResult.triggeredLawIds,
        createdAt: new Date().toISOString(),
      });
      return { result: muscleResult, nslMoves: [] };
    }
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
 * The primary Bodyguard enforcement function.
 *
 * Every boundary decision — from intercept, wrapTool, swarm, and direct calls —
 * routes through here. Bodyguard is the single decision center.
 *
 * Enforcement loop:
 * 1. Fires `onBeforeAction` hook if configured.
 * 2. Denies if session has ended.
 * 3. Checks UPL (User Path Ledger) for a standing allow/deny.
 * 4. Runs through the gravity service (freeze-and-forward) if attached.
 * 5. Evaluates all active laws via `evaluateBoundaryAction`.
 * 6. Dispatches to the approval handler if `"require_approval"`.
 * 7. Executes the `execute` function only if fully admitted.
 * 8. Records the decision and outcome in the Witness Ledger (write only).
 * 9. Fires `onAfterAction` hook if configured.
 *
 * UPL is the only live standing-law surface.
 * Witness Ledger is written here but never read for authorization.
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

  if (args.config.session.status === "ended") {
    const reason = "session has ended; no actions permitted after session close";
    await logBlockedAction(args.config, args.request, reason, ["TIME.SESSION.01"]);
    return {
      config: activeConfig,
      allowed: false,
      executed: false,
      requiresApproval: false,
      reason,
      nslMoves: [],
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

      if (!approved.approved) {
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

/**
 * Creates the primary boundary enforcement surface for an agent session.
 *
 * `createBoundaryBodyguard` is the main integration point for agent frameworks.
 * It wires together the runtime store, approval queue, and gravity service into
 * a single object with enforcement methods for each supported framework.
 *
 * The bodyguard is **stateful** — every enforcement call that results in a
 * grant or UPL update automatically persists the updated config back to the
 * store. Callers do not need to manage config mutations manually.
 *
 * @param store - A persistent runtime store created via
 *   `createPersistentBoundaryRuntimeStore` or `restoreBoundaryRuntimeStore`.
 * @returns The bodyguard object with per-framework integration surfaces.
 *
 * @example
 * ```typescript
 * const store = await createPersistentBoundaryRuntimeStore({
 *   sessionId: "my-session",
 *   actorId: "user:alice",
 * });
 * await store.openPath({ rootPath: "/tmp/workspace", grantedActions: ["fs.write"], issuedBy: "user:alice" });
 *
 * const bodyguard = createBoundaryBodyguard(store);
 *
 * // Wrap any tool — enforcement is automatic
 * const safeWrite = bodyguard.wrapTool({
 *   toolName: "write_file",
 *   actionKind: "fs.write",
 *   describeTarget: (input: { path: string }) => input.path,
 *   execute: async ({ path, content }) => fs.writeFile(path, content),
 * });
 *
 * const result = await safeWrite({ path: "/tmp/workspace/out.txt", content: "hello" });
 * result.allowed   // true if admitted, false if blocked
 * result.executed  // true if the execute fn actually ran
 * ```
 *
 * @see {@link https://github.com/lml-layer-system/agent-buccet/blob/main/docs/agent-boundary/INTEGRATIONS.md}
 */
export function createBoundaryBodyguard(store: BoundaryRuntimeStore) {
  const approvals = createApprovalQueueAdapter();
  const gravityService = createBoundaryGravityService();

  function getGuardedConfig() {
    return {
      ...store.getConfig(),
      approvalHandler: approvals.handler,
      gravityService,
    };
  }

  async function enforceProposal<T>(proposal: BoundaryToolProposal<T>): Promise<BoundaryExecutionResult<T>> {
    const result = await enforceBoundaryProposal({
      config: getGuardedConfig(),
      proposal,
    });
    store.replaceConfig(result.config);
    return result;
  }

  function wrapTool<TInput, TOutput>(envelope: BoundaryToolEnvelope<TInput, TOutput>) {
    return async (input: TInput) => {
      const result = await wrapBoundaryTool(getGuardedConfig(), envelope)(input);
      store.replaceConfig(result.config);
      return result;
    };
  }

  const gravity = createBoundaryGravityAttachment({
    store,
    approvalHandler: approvals.handler,
  });

  return {
    store,
    approvals,
    gravity,
    enforceProposal,
    wrapTool,
    nemo: {
      enforceProposal,
      wrapTool,
    },
    openaiAgents: {
      enforceProposal,
      wrapTool,
    },
    langgraph: {
      enforceProposal,
      wrapNode: wrapTool,
    },
    telegram: {
      buildProposal: buildTelegramBoundaryProposal,
      enforceProposal,
      approvals,
    },
  };
}
