import {
  type BoundaryExecutionResult,
  type BoundaryToolEnvelope,
  type BoundaryToolProposal,
  enforceBoundaryProposal,
  wrapBoundaryTool,
} from "./../boundaries/bodyguard.ts";
import type { BoundaryRuntimeConfig } from "./../runtime/types.ts";

export async function enforceLangGraphProposal<T>(args: {
  config: BoundaryRuntimeConfig;
  proposal: BoundaryToolProposal<T>;
}): Promise<BoundaryExecutionResult<T>> {
  return enforceBoundaryProposal(args);
}

export function wrapLangGraphNode<TInput, TOutput>(
  config: BoundaryRuntimeConfig,
  envelope: BoundaryToolEnvelope<TInput, TOutput>,
): (input: TInput) => Promise<BoundaryExecutionResult<TOutput>> {
  return wrapBoundaryTool(config, envelope);
}

export function createLangGraphBoundaryGuard(config: BoundaryRuntimeConfig) {
  return {
    enforceProposal: <T>(proposal: BoundaryToolProposal<T>) =>
      enforceLangGraphProposal({ config, proposal }),
    wrapNode: <TInput, TOutput>(envelope: BoundaryToolEnvelope<TInput, TOutput>) =>
      wrapLangGraphNode(config, envelope),
  };
}
