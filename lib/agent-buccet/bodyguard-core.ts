import { appendBoundaryLedger } from "./ledger.ts";
import {
  getActiveUserLawIds,
  lookupUserPathDecision,
  writeApprovedUserPathLaw,
  writeDeniedUserPathLaw,
} from "./user-path-ledger.ts";
import type {
  BoundaryActionRequest,
  BoundaryApprovalDecision,
  BoundaryApprovalChoice,
  BoundaryLawResult,
  BoundaryLedgerRecord,
  BoundaryLegacyApprovalDecision,
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

  const choice = normalizeApprovalChoice(args.decision);

  if (choice === "allow_as_law") {
    upl = await writeApprovedUserPathLaw({
      ledger: upl,
      request: args.request,
      witness: args.witness,
      session: args.config.session,
      decision: args.decision,
    });
    const newEntry = upl.userApprovedLawPaths[upl.userApprovedLawPaths.length - 1];
    await appendBoundaryLedger("UPL_LAW_APPROVED", {
      sessionId: args.config.session.sessionId,
      actorId: args.config.session.actorId,
      requestId: args.request.requestId,
      actionKind: args.request.actionKind,
      target: args.request.target,
      reason: `standing UPL allow created: ${newEntry.id}`,
      lawIds: [newEntry.id],
      metadata: {
        upl_entry_id: newEntry.id,
        upl_scope: newEntry.scope,
        upl_path_hash: newEntry.pathHash,
        witness_record_id: args.witness.META.id,
      },
      createdAt: newEntry.createdAt,
    });
  } else if (choice === "deny_as_law") {
    upl = await writeDeniedUserPathLaw({
      ledger: upl,
      request: args.request,
      witness: args.witness,
      session: args.config.session,
      decision: args.decision,
    });
    const newEntry = upl.userDeniedLawPaths[upl.userDeniedLawPaths.length - 1];
    await appendBoundaryLedger("UPL_LAW_DENIED", {
      sessionId: args.config.session.sessionId,
      actorId: args.config.session.actorId,
      requestId: args.request.requestId,
      actionKind: args.request.actionKind,
      target: args.request.target,
      reason: `standing UPL deny created: ${newEntry.id}`,
      lawIds: [newEntry.id],
      metadata: {
        upl_entry_id: newEntry.id,
        upl_scope: newEntry.scope,
        upl_path_hash: newEntry.pathHash,
        witness_record_id: args.witness.META.id,
      },
      createdAt: newEntry.createdAt,
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

function normalizeApprovalChoice(
  decision: BoundaryApprovalDecision | BoundaryLegacyApprovalDecision,
): BoundaryApprovalChoice {
  if ("choice" in decision) {
    return decision.choice;
  }
  if (decision.approved) {
    return "allow_as_law";
  }
  if (decision.persistDenied) {
    return "deny_as_law";
  }
  return "deny_once";
}
