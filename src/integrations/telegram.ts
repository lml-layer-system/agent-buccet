import { createApprovalQueueAdapter } from "./../boundaries/approval.ts";
import {
  enforceBoundaryProposal,
  type BoundaryExecutionResult,
  type BoundaryToolProposal,
} from "./../boundaries/bodyguard.ts";
import { buildRemoteBoundaryProposal } from "./../runtime/remote.ts";
import type {
  BoundaryActionKind,
  BoundaryRequestProvenance,
  BoundaryRuntimeConfig,
} from "./../runtime/types.ts";

export function buildTelegramBoundaryProposal<T>(args: {
  actionKind: BoundaryActionKind;
  target: string;
  rawText: string;
  payloadSummary?: string;
  execute?: () => Promise<T>;
  successReason: string;
  provenance?: BoundaryRequestProvenance;
}): BoundaryToolProposal<T> {
  return buildRemoteBoundaryProposal({
    ...args,
    channel: "telegram",
  });
}

export async function enforceTelegramProposal<T>(args: {
  config: BoundaryRuntimeConfig;
  proposal: BoundaryToolProposal<T>;
}): Promise<BoundaryExecutionResult<T>> {
  return enforceBoundaryProposal(args);
}

export function createTelegramBoundaryBridge(config: BoundaryRuntimeConfig) {
  const approvals = createApprovalQueueAdapter();
  const configuredRuntime: BoundaryRuntimeConfig = {
    ...config,
    approvalHandler: approvals.handler,
  };

  return {
    config: configuredRuntime,
    approvals,
    buildProposal: buildTelegramBoundaryProposal,
    enforceProposal: <T>(proposal: BoundaryToolProposal<T>) =>
      enforceTelegramProposal({ config: configuredRuntime, proposal }),
  };
}
