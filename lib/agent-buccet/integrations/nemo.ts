import {
  enforceBoundaryProposal,
  wrapBoundaryTool,
  type BoundaryExecutionResult,
  type BoundaryToolEnvelope,
  type BoundaryToolProposal,
} from "../adapters.ts";
import type { BoundaryRuntimeConfig } from "../types.ts";

export async function enforceNemoProposal<T>(args: {
  config: BoundaryRuntimeConfig;
  proposal: BoundaryToolProposal<T>;
}): Promise<BoundaryExecutionResult<T>> {
  return enforceBoundaryProposal(args);
}

export function wrapNemoTool<TInput, TOutput>(
  config: BoundaryRuntimeConfig,
  envelope: BoundaryToolEnvelope<TInput, TOutput>,
): (input: TInput) => Promise<BoundaryExecutionResult<TOutput>> {
  return wrapBoundaryTool(config, envelope);
}

export function createNemoBoundaryGuard(config: BoundaryRuntimeConfig) {
  return {
    enforceProposal: <T>(proposal: BoundaryToolProposal<T>) =>
      enforceNemoProposal({ config, proposal }),
    wrapTool: <TInput, TOutput>(envelope: BoundaryToolEnvelope<TInput, TOutput>) =>
      wrapNemoTool(config, envelope),
  };
}
