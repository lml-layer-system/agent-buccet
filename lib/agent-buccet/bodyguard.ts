import { createApprovalQueueAdapter } from "./approval.ts";
import {
  adjudicateBodyguardRequest,
  applyBodyguardUserLawDecision,
  attachBodyguardControl,
  evaluateBodyguardAction,
  resolveBodyguardHeldRequest,
} from "./bodyguard-core.ts";
import { createBoundaryGravityService } from "./gravity-adapter/gravity-service.ts";
import {
  enforceBoundaryProposal,
  wrapBoundaryTool,
  type BoundaryToolEnvelope,
  type BoundaryToolProposal,
} from "./adapters.ts";
import type { BoundaryExecutionResult } from "./executor.ts";
import { createBoundaryGravityAttachment } from "./gravity.ts";
import type { BoundaryRuntimeStore } from "./store.ts";
import { buildTelegramBoundaryProposal } from "./integrations/telegram.ts";
import type {
  BoundaryActionRequest,
  BoundaryApprovalDecision,
  BoundaryLedgerRecord,
  BoundaryRuntimeConfig,
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
