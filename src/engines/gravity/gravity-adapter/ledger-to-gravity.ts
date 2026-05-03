import type { LedgerView } from "../gravity-core/index.ts";

// Witness Ledger is immutable history — it records but never gates live authorization.
// The live law surface is UPL only. Bodyguard checks UPL; Witness Ledger writes afterward.
export async function mapBoundaryLedgerToGravityView(_args: {
  sessionId: string;
  requestId?: string;
}): Promise<LedgerView> {
  return {
    sessionTraceComplete: true,
    requestTraceComplete: true,
  };
}
