import {
  type BoundaryExecutionResult,
  type BoundaryToolEnvelope,
  type BoundaryToolProposal,
  enforceBoundaryProposal,
  wrapBoundaryTool,
} from "./../boundaries/bodyguard.ts";
import type { BoundaryRuntimeConfig } from "./../runtime/types.ts";

export async function enforceVercelAIProposal<T>(args: {
  config: BoundaryRuntimeConfig;
  proposal: BoundaryToolProposal<T>;
}): Promise<BoundaryExecutionResult<T>> {
  return enforceBoundaryProposal(args);
}

export function wrapVercelAITool<TInput, TOutput>(
  config: BoundaryRuntimeConfig,
  envelope: BoundaryToolEnvelope<TInput, TOutput>,
): (input: TInput) => Promise<BoundaryExecutionResult<TOutput>> {
  return wrapBoundaryTool(config, envelope);
}

export function createVercelAIBoundaryGuard(config: BoundaryRuntimeConfig) {
  return {
    enforceProposal: <T>(proposal: BoundaryToolProposal<T>) =>
      enforceVercelAIProposal({ config, proposal }),
    wrapTool: <TInput, TOutput>(envelope: BoundaryToolEnvelope<TInput, TOutput>) =>
      wrapVercelAITool(config, envelope),
  };
}
