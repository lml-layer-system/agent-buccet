import type { LedgerView } from "../gravity-core/index.ts";

export async function mapBoundaryLedgerToGravityView(args: {
  sessionId: string;
  requestId?: string;
}): Promise<LedgerView> {
  return {
    sessionTraceComplete: true,
    requestTraceComplete: true,
  };
}
