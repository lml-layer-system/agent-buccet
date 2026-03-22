import {
  getActiveUserLawIds,
  lookupUserPathDecision,
  writeApprovedUserPathLaw,
  writeDeniedUserPathLaw,
} from "./user-path-ledger.ts";
import type {
  BoundaryActionRequest,
  BoundaryApprovalDecision,
  BoundaryLawResult,
  BoundaryLedgerRecord,
  BoundaryRuntimeConfig,
} from "./types.ts";

export function resolveBodyguardStandingLaw(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): BoundaryLawResult | null {
  const standingUserLaw = args.config.upl
    ? lookupUserPathDecision({
      ledger: args.config.upl,
      session: args.config.session,
      request: args.request,
    })
    : null;

  if (!standingUserLaw) {
    return null;
  }

  if (standingUserLaw.decision === "allow") {
    return {
      decision: "allow",
      reason: `allowed by standing UPL approval ${standingUserLaw.entry.id}`,
      triggeredLawIds: [standingUserLaw.entry.id],
      requiresApproval: false,
    };
  }

  return {
    decision: "deny",
    reason: `blocked by standing UPL denial ${standingUserLaw.entry.id}`,
    triggeredLawIds: [standingUserLaw.entry.id],
    requiresApproval: false,
  };
}

export async function applyBodyguardUserLawDecision(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  witness: BoundaryLedgerRecord;
  decision: BoundaryApprovalDecision;
}): Promise<BoundaryRuntimeConfig> {
  if (!args.config.upl) {
    return args.config;
  }

  let upl = args.config.upl;

  if (args.decision.approved) {
    upl = await writeApprovedUserPathLaw({
      ledger: upl,
      request: args.request,
      witness: args.witness,
      session: args.config.session,
      decision: args.decision,
    });
  } else if (args.decision.persistDenied) {
    upl = await writeDeniedUserPathLaw({
      ledger: upl,
      request: args.request,
      witness: args.witness,
      session: args.config.session,
      decision: args.decision,
    });
  } else {
    return args.config;
  }

  return {
    ...args.config,
    upl,
    userLawIds: [
      ...new Set([
        ...(args.config.userLawIds ?? []),
        ...getActiveUserLawIds(upl, args.config.session),
      ]),
    ],
  };
}
