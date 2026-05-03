import {
  type BoundaryExecutionResult,
  type BoundaryToolEnvelope,
  type BoundaryToolProposal,
  enforceBoundaryProposal,
  wrapBoundaryTool,
} from "./../boundaries/bodyguard.ts";
import type { BoundaryRuntimeConfig } from "./../runtime/types.ts";

export async function enforceOpenAIAgentProposal<T>(args: {
  config: BoundaryRuntimeConfig;
  proposal: BoundaryToolProposal<T>;
}): Promise<BoundaryExecutionResult<T>> {
  return enforceBoundaryProposal(args);
}

export function wrapOpenAIAgentTool<TInput, TOutput>(
  config: BoundaryRuntimeConfig,
  envelope: BoundaryToolEnvelope<TInput, TOutput>,
): (input: TInput) => Promise<BoundaryExecutionResult<TOutput>> {
  return wrapBoundaryTool(config, envelope);
}

export function createOpenAIAgentsBoundaryGuard(config: BoundaryRuntimeConfig) {
  return {
    enforceProposal: <T>(proposal: BoundaryToolProposal<T>) =>
      enforceOpenAIAgentProposal({ config, proposal }),
    wrapTool: <TInput, TOutput>(envelope: BoundaryToolEnvelope<TInput, TOutput>) =>
      wrapOpenAIAgentTool(config, envelope),
  };
}
