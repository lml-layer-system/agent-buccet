import type { LedgerView } from "../gravity-core/index.ts";
import { auditBoundarySessionLedger } from "../ledger-audit.ts";

export async function mapBoundaryLedgerToGravityView(args: {
  sessionId: string;
  requestId?: string;
}): Promise<LedgerView> {
  const sessionAudit = await auditBoundarySessionLedger(args.sessionId);

  return {
    sessionTraceComplete: sessionAudit.status === "complete",
    requestTraceComplete: true,
  };
}
