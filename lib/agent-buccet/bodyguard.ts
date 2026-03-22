import { randomUUID } from "node:crypto";
import { createApprovalQueueAdapter } from "./approval.ts";
import {
  adjudicateBodyguardRequest,
  applyBodyguardUserLawDecision,
  attachBodyguardControl,
  evaluateBodyguardAction,
  resolveBodyguardHeldRequest,
} from "./bodyguard-core.ts";
import { createBoundaryGravityService } from "./gravity-adapter/gravity-service.ts";
import { appendBoundaryLedger } from "./ledger.ts";
import { createBoundaryGravityAttachment } from "./gravity.ts";
import type { BoundaryRuntimeStore } from "./store.ts";
import { buildTelegramBoundaryProposal } from "./integrations/telegram.ts";
import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryApprovalDecision,
  BoundaryApprovalRequest,
  BoundaryDecision,
  BoundaryLedgerRecord,
  BoundaryRequestProvenance,
  BoundaryRuntimeConfig,
  NslMove,
} from "./types.ts";

export {
  type BodyguardAdjudication,
  type BodyguardHeldDecision,
  type BodyguardRequestAdjudication,
} from "./bodyguard-core.ts";

export function enableBodyguardControl(
  config: BoundaryRuntimeConfig,
  overrides?: Partial<BoundaryRuntimeConfig>,
): BoundaryRuntimeConfig {
  return attachBodyguardControl(config, overrides);
}

export type BoundaryExecutionResult<T = void> = {
  config: BoundaryRuntimeConfig;
  allowed: boolean;
  executed: boolean;
  requiresApproval: boolean;
  reason: string;
  nslMoves: NslMove[];
  value?: T;
};

export type BoundaryToolProposal<T = unknown> = {
  actionKind: BoundaryActionKind;
  target: string;
  payloadSummary?: string;
  provenance?: BoundaryRequestProvenance;
  flags?: BoundaryActionRequest["flags"];
  successReason: string;
  dryRunPreviewReason?: string;
  execute?: () => Promise<T>;
  successMetadata?: Record<string, string | number | boolean>;
};

export type BoundaryToolEnvelope<TInput, TOutput> = {
  toolName: string;
  describeTarget: (input: TInput) => string;
  actionKind: BoundaryActionKind;
  payloadSummary?: (input: TInput) => string | undefined;
  provenance?: BoundaryRequestProvenance | ((input: TInput) => BoundaryRequestProvenance);
  flags?: (input: TInput) => BoundaryActionRequest["flags"];
  successReason?: string | ((input: TInput) => string);
  dryRunPreviewReason?: string | ((input: TInput) => string);
  successMetadata?: (input: TInput) => Record<string, string | number | boolean> | undefined;
  execute: (input: TInput) => Promise<TOutput>;
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

async function logProposedAction(
  config: BoundaryRuntimeConfig,
  request: BoundaryActionRequest,
  reason = "action proposed",
): Promise<void> {
  await appendBoundaryLedger("ACTION_PROPOSED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    requestId: request.requestId,
    actionKind: request.actionKind,
    target: request.target,
    reason,
    createdAt: request.requestedAt,
  });
}

async function logDecisionReturned(
  config: BoundaryRuntimeConfig,
  request: BoundaryActionRequest,
  reason: string,
  decision: BoundaryDecision,
  lawIds: string[],
): Promise<void> {
  await appendBoundaryLedger("DECISION_RETURNED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    requestId: request.requestId,
    actionKind: request.actionKind,
    target: request.target,
    decision,
    reason,
    lawIds,
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

export async function enforceBoundaryProposal<T>(args: {
  config: BoundaryRuntimeConfig;
  proposal: BoundaryToolProposal<T>;
}): Promise<BoundaryExecutionResult<T>> {
  return runBoundaryControlledAction({
    config: enableBodyguardControl(args.config),
    request: createBoundaryActionRequest({
      config: args.config,
      actionKind: args.proposal.actionKind,
      target: args.proposal.target,
      payloadSummary: args.proposal.payloadSummary,
      provenance: args.proposal.provenance,
      flags: args.proposal.flags,
    }),
    execute: args.proposal.execute,
    successReason: args.proposal.successReason,
    dryRunPreviewReason: args.proposal.dryRunPreviewReason,
    successMetadata: args.proposal.successMetadata,
  });
}

export function wrapBoundaryTool<TInput, TOutput>(
  config: BoundaryRuntimeConfig,
  envelope: BoundaryToolEnvelope<TInput, TOutput>,
): (input: TInput) => Promise<BoundaryExecutionResult<TOutput>> {
  return async (input: TInput) =>
    enforceBoundaryProposal({
      config,
      proposal: {
        actionKind: envelope.actionKind,
        target: envelope.describeTarget(input),
        payloadSummary: envelope.payloadSummary?.(input),
        provenance:
          typeof envelope.provenance === "function"
            ? envelope.provenance(input)
            : envelope.provenance,
        flags: envelope.flags?.(input),
        successReason:
          typeof envelope.successReason === "function"
            ? envelope.successReason(input)
            : envelope.successReason ?? `${envelope.toolName} executed inside boundary runtime`,
        dryRunPreviewReason:
          typeof envelope.dryRunPreviewReason === "function"
            ? envelope.dryRunPreviewReason(input)
            : envelope.dryRunPreviewReason,
        successMetadata: envelope.successMetadata?.(input),
        execute: async () => envelope.execute(input),
      },
    });
}

export async function runBoundaryControlledAction<T>(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  execute?: () => Promise<T>;
  successReason: string;
  dryRunPreviewReason?: string;
  successMetadata?: Record<string, string | number | boolean>;
}): Promise<BoundaryExecutionResult<T>> {
  let activeConfig = args.config;
  let activeRequest = args.request;
  await logProposedAction(activeConfig, activeRequest);
  let adjudication = await adjudicateBoundaryRequest({
    config: activeConfig,
    request: activeRequest,
  });
  activeConfig = adjudication.config;
  activeRequest = adjudication.request;
  await logDecisionReturned(
    activeConfig,
    activeRequest,
    adjudication.result.reason,
    adjudication.result.decision,
    adjudication.result.triggeredLawIds,
  );

  if (adjudication.result.decision === "deny") {
    await logBlockedAction(
      activeConfig,
      activeRequest,
      adjudication.result.reason,
      adjudication.result.triggeredLawIds,
    );

    for (const move of adjudication.nslMoves) {
      await appendBoundaryLedger("NSL_MOVE_SUGGESTED", {
        sessionId: activeConfig.session.sessionId,
        actorId: activeConfig.session.actorId,
        requestId: activeRequest.requestId,
        actionKind: activeRequest.actionKind,
        target: activeRequest.target,
        moveId: move.moveId,
        decision: adjudication.result.decision,
        reason: move.description,
        lawIds: adjudication.result.triggeredLawIds,
        createdAt: new Date().toISOString(),
      });
    }

    return {
      config: activeConfig,
      allowed: false,
      executed: false,
      requiresApproval: false,
      reason: adjudication.result.reason,
      nslMoves: adjudication.nslMoves,
    };
  }

  while (adjudication.result.decision === "require_approval") {
    const approvalResult = await requestApproval(
      activeConfig,
      {
        session: activeConfig.session,
        request: activeRequest,
        reason: adjudication.result.reason,
        lawIds: adjudication.result.triggeredLawIds,
        nslMoves: adjudication.nslMoves,
      },
      adjudication.result.triggeredLawIds,
    );
    activeConfig = await recordBodyguardUserLawDecision({
      config: activeConfig,
      request: activeRequest,
      witness: approvalResult.witnessRecord,
      decision: approvalResult.decision,
    });

    if (!approvalResult.approved) {
      if (adjudication.grantOffer) {
        await adjudication.grantOffer.denyGrant();
      }
      await logBlockedAction(
        activeConfig,
        activeRequest,
        adjudication.result.reason,
        adjudication.result.triggeredLawIds,
      );
      return {
        config: activeConfig,
        allowed: false,
        executed: false,
        requiresApproval: true,
        reason: adjudication.result.reason,
        nslMoves: adjudication.nslMoves,
      };
    }

    if (adjudication.grantOffer) {
      const replay = await adjudication.grantOffer.applyGrant({
        session: activeConfig.session,
        request: activeRequest,
        reason: adjudication.result.reason,
        lawIds: adjudication.result.triggeredLawIds,
        nslMoves: adjudication.nslMoves,
      });
      activeConfig = replay.config;
      activeRequest = replay.request;
      await appendBoundaryLedger("PROPOSAL_REPLAYED", {
        sessionId: activeConfig.session.sessionId,
        actorId: activeConfig.session.actorId,
        requestId: activeRequest.requestId,
        actionKind: activeRequest.actionKind,
        target: activeRequest.target,
        reason: "proposal replayed after user approval changed standing law",
        lawIds: adjudication.result.triggeredLawIds,
        createdAt: new Date().toISOString(),
      });
      adjudication = await adjudicateBoundaryRequest({
        config: activeConfig,
        request: activeRequest,
      });
      activeConfig = adjudication.config;
      activeRequest = adjudication.request;
      await logDecisionReturned(
        activeConfig,
        activeRequest,
        adjudication.result.reason,
        adjudication.result.decision,
        adjudication.result.triggeredLawIds,
      );
      if (adjudication.result.decision === "deny") {
        await logBlockedAction(
          activeConfig,
          activeRequest,
          adjudication.result.reason,
          adjudication.result.triggeredLawIds,
        );
        return {
          config: activeConfig,
          allowed: false,
          executed: false,
          requiresApproval: false,
          reason: adjudication.result.reason,
          nslMoves: adjudication.nslMoves,
        };
      }
      continue;
    }

    adjudication = await adjudicateBoundaryRequest({
      config: activeConfig,
      request: activeRequest,
    });
    activeConfig = adjudication.config;
    activeRequest = adjudication.request;
    await logDecisionReturned(
      activeConfig,
      activeRequest,
      adjudication.result.reason,
      adjudication.result.decision,
      adjudication.result.triggeredLawIds,
    );
    if (adjudication.result.decision === "deny") {
      await logBlockedAction(
        activeConfig,
        activeRequest,
        adjudication.result.reason,
        adjudication.result.triggeredLawIds,
      );
      return {
        config: activeConfig,
        allowed: false,
        executed: false,
        requiresApproval: false,
        reason: adjudication.result.reason,
        nslMoves: adjudication.nslMoves,
      };
    }
  }

  if (!args.execute) {
    return {
      config: activeConfig,
      allowed: true,
      executed: false,
      requiresApproval: adjudication.result.requiresApproval,
      reason: args.successReason,
      nslMoves: adjudication.nslMoves,
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
      requiresApproval: adjudication.result.requiresApproval,
      reason,
      nslMoves: adjudication.nslMoves,
    };
  }

  const value = await args.execute();
  await logExecutedAction(activeConfig, activeRequest, args.successReason, args.successMetadata);

  return {
    config: activeConfig,
    allowed: true,
    executed: true,
    requiresApproval: adjudication.result.requiresApproval,
    reason: args.successReason,
    nslMoves: adjudication.nslMoves,
    value,
  };
}

export async function adjudicateHeldBoundaryRequest(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}) {
  return resolveBodyguardHeldRequest(args);
}

export function adjudicateBoundaryAction(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}) {
  return evaluateBodyguardAction(args);
}

export async function adjudicateBoundaryRequest(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}) {
  return adjudicateBodyguardRequest(args);
}

export async function recordBodyguardUserLawDecision(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  witness: BoundaryLedgerRecord;
  decision: BoundaryApprovalDecision;
}) {
  return applyBodyguardUserLawDecision(args);
}

export function createBoundaryBodyguard(store: BoundaryRuntimeStore) {
  const approvals = createApprovalQueueAdapter();
  const gravityService = createBoundaryGravityService();

  function getGuardedConfig() {
    return enableBodyguardControl(store.getConfig(), {
      approvalHandler: approvals.handler,
      gravityService,
    });
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
