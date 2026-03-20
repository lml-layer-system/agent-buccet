import { createApprovalQueueAdapter } from "./approval.ts";
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
    return enforceBoundaryProposal({
      config: getGuardedConfig(),
      proposal,
    });
  }

  function wrapTool<TInput, TOutput>(envelope: BoundaryToolEnvelope<TInput, TOutput>) {
    return async (input: TInput) =>
      wrapBoundaryTool(getGuardedConfig(), envelope)(input);
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
