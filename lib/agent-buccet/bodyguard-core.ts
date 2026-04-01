import { buildBoundaryBodyguardMoves } from "./bodyguard-moves.ts";
import {
  createBoundaryGravityService,
  type BoundaryGravityEnforcement,
} from "./gravity-adapter/gravity-service.ts";
import { appendBoundaryLedger } from "./ledger.ts";
import { evaluateBoundaryLaws } from "./laws.ts";
import { grantsForAction } from "./orchestrator.ts";
import {
  getActiveUserLawIds,
  lookupUserPathDecision,
  lookupUserPathTrackDecision,
  writeApprovedUserPathLaw,
  writeDeniedUserPathLaw,
} from "./user-path-ledger.ts";
import { checkTrackConstraint } from "./upl-tracks.ts";
import type {
  BoundaryActionRequest,
  BoundaryApprovalDecision,
  BoundaryApprovalChoice,
  BoundaryLawResult,
  BoundaryLedgerRecord,
  BoundaryLegacyApprovalDecision,
  BoundaryRuntimeConfig,
  BodyguardMove,
} from "./types.ts";

export type BodyguardAdjudication = {
  result: BoundaryLawResult;
  bodyguardMoves: BodyguardMove[];
};

export type BodyguardHeldDecision = BodyguardAdjudication | null;

export type BodyguardRequestAdjudication = BodyguardAdjudication & {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  grantOffer?: Extract<BoundaryGravityEnforcement, { outcome: "bodyguard_grant_offer" }>;
};

export function attachBodyguardControl(
  config: BoundaryRuntimeConfig,
  overrides?: Partial<BoundaryRuntimeConfig>,
): BoundaryRuntimeConfig {
  return {
    ...config,
    ...overrides,
    bodyguardOnline: true,
  };
}

function resolveBodyguardPriorityLaw(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): BoundaryLawResult | null {
  const priorityLaws = args.config.laws.filter((law) => law.lawId.startsWith("META."));
  if (priorityLaws.length === 0) {
    return null;
  }

  const activeGrants = grantsForAction(args.config.session, args.request.actionKind, args.config.grants);
  const triggeredLawIds: string[] = [];
  let matched = false;
  let decision: "allow" | "require_approval" | null = null;
  let reason = "";

  for (const law of priorityLaws) {
    const result = law.evaluate({
      session: args.config.session,
      request: args.request,
      activeGrants,
    });
    if (!result) {
      continue;
    }
    matched = true;
    triggeredLawIds.push(...result.triggeredLawIds);
    if (result.decision === "deny") {
      return expandRuntimeMuscleTriggeredLawIds(args.config, {
        decision: "deny",
        reason: result.reason,
        triggeredLawIds,
        requiresApproval: false,
      });
    }
    if (result.decision === "require_approval") {
      decision = "require_approval";
      reason = result.reason;
      continue;
    }
    if (!decision) {
      decision = "allow";
      reason = result.reason;
    }
  }

  if (!matched || !decision) {
    return null;
  }

  return expandRuntimeMuscleTriggeredLawIds(args.config, {
    decision,
    reason,
    triggeredLawIds,
    requiresApproval: decision === "require_approval",
  });
}

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

  if (standingUserLaw) {
    const entry = standingUserLaw.entry;
    const triggeredLawIds = [
      entry.id,
      ...(args.config.runtimeMuscle?.timeLawIdsByCategory.user_path_ledger ?? []),
    ];

    if (entry.trackConstraint) {
      const trackViolation = checkTrackConstraint(entry.trackConstraint, args.request);
      if (trackViolation) {
        if (standingUserLaw.decision === "allow") {
          return {
            decision: "require_approval",
            reason: `action exits approved execution corridor: ${trackViolation}`,
            triggeredLawIds,
            requiresApproval: true,
            uplTrackId: entry.id,
            uplTrackViolated: true,
          };
        }
      } else if (standingUserLaw.decision === "allow") {
        return {
          decision: "allow",
          reason: `allowed by standing UPL approval ${entry.id}`,
          triggeredLawIds,
          requiresApproval: false,
          uplTrackId: entry.id,
        };
      } else {
        return {
          decision: "deny",
          reason: `blocked by standing UPL denial ${entry.id}`,
          triggeredLawIds,
          requiresApproval: false,
          uplTrackId: entry.id,
        };
      }
    }

    if (standingUserLaw.decision === "allow") {
      return {
        decision: "allow",
        reason: `allowed by standing UPL approval ${entry.id}`,
        triggeredLawIds,
        requiresApproval: false,
      };
    }

    return {
      decision: "deny",
      reason: `blocked by standing UPL denial ${entry.id}`,
      triggeredLawIds,
      requiresApproval: false,
    };
  }

  if (!args.config.upl) {
    return null;
  }

  const trackMatch = lookupUserPathTrackDecision({
    ledger: args.config.upl,
    session: args.config.session,
    request: args.request,
  });
  if (!trackMatch) {
    return null;
  }

  const triggeredLawIds = [
    trackMatch.entry.id,
    ...(args.config.runtimeMuscle?.timeLawIdsByCategory.user_path_ledger ?? []),
  ];
  if (trackMatch.decision === "track_violation") {
    return {
      decision: "require_approval",
      reason: `action exits approved execution corridor: ${trackMatch.violation}`,
      triggeredLawIds,
      requiresApproval: true,
      uplTrackId: trackMatch.entry.id,
      uplTrackViolated: true,
    };
  }
  if (trackMatch.decision === "deny") {
    return {
      decision: "deny",
      reason: `blocked by UPL track corridor ${trackMatch.entry.id}`,
      triggeredLawIds,
      requiresApproval: false,
      uplTrackId: trackMatch.entry.id,
    };
  }
  return {
    decision: "allow",
    reason: `allowed by UPL track corridor ${trackMatch.entry.id}`,
    triggeredLawIds,
    requiresApproval: false,
    uplTrackId: trackMatch.entry.id,
  };
}

function expandRuntimeMuscleTriggeredLawIds(
  config: BoundaryRuntimeConfig,
  result: BoundaryLawResult,
): BoundaryLawResult {
  const runtimeMuscle = config.runtimeMuscle;
  if (!runtimeMuscle) {
    return result;
  }

  const extraLawIds = new Set<string>();
  for (const lawId of result.triggeredLawIds) {
    switch (lawId) {
      case "META.TRUST.01":
        for (const id of runtimeMuscle.timeLawIdsByCategory.truth_alignment ?? []) extraLawIds.add(id);
        break;
      case "META.AUTHORITY.01":
        for (const id of runtimeMuscle.timeLawIdsByCategory.authority_bypass ?? []) extraLawIds.add(id);
        break;
      case "META.NOVELTY.01":
        for (const id of runtimeMuscle.timeLawIdsByCategory.hallucination_prevention ?? []) extraLawIds.add(id);
        break;
      case "META.SCOPE.01":
        for (const id of runtimeMuscle.timeLawIdsByCategory.safety_governance ?? []) extraLawIds.add(id);
        break;
      case "META.LAW.01":
        for (const id of runtimeMuscle.timeLawIdsByCategory.meta_law ?? []) extraLawIds.add(id);
        break;
      case "META.SESSION.01":
        for (const id of runtimeMuscle.timeLawIdsByCategory.memory_temporal ?? []) extraLawIds.add(id);
        break;
      case "META.LEDGER.01":
        for (const id of runtimeMuscle.timeLawIdsByCategory.ledger_proof ?? []) extraLawIds.add(id);
        break;
      default:
        break;
    }
  }

  if (extraLawIds.size === 0) {
    return result;
  }

  return {
    ...result,
    triggeredLawIds: [...new Set([...result.triggeredLawIds, ...extraLawIds])],
  };
}

export async function resolveBodyguardHeldRequest(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): Promise<BodyguardHeldDecision> {
  if (!args.config.bodyguardOnline) {
    const result: BoundaryLawResult = {
      decision: "deny",
      reason: "bodyguard is offline; no decision handoff is available",
      triggeredLawIds: ["BODYGUARD.OFFLINE.01"],
      requiresApproval: false,
    };
    return {
      result,
      bodyguardMoves: [],
    };
  }

  if (args.config.session.status === "ended") {
    const result: BoundaryLawResult = {
      decision: "deny",
      reason: "session has been ended by the user and can no longer authorize actions",
      triggeredLawIds: ["BOUNDARY.SESSION.ENDED.01"],
      requiresApproval: false,
    };
    return {
      result,
      bodyguardMoves: [],
    };
  }

  return null;
}

export function evaluateBodyguardAction(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): BodyguardAdjudication {
  const priorityLaw = resolveBodyguardPriorityLaw(args);
  if (priorityLaw) {
    return {
      result: priorityLaw,
      bodyguardMoves: buildBoundaryBodyguardMoves(args.request, priorityLaw),
    };
  }

  const standingLaw = resolveBodyguardStandingLaw(args);
  if (standingLaw) {
    return {
      result: standingLaw,
      bodyguardMoves: [],
    };
  }

  const result = evaluateBoundaryLaws({
    session: args.config.session,
    request: args.request,
    laws: args.config.laws,
    grants: args.config.grants,
    approvalRequiredFor: args.config.approvalRequiredFor,
  });
  const expandedResult = expandRuntimeMuscleTriggeredLawIds(args.config, result);

  return {
    result: expandedResult,
    bodyguardMoves: buildBoundaryBodyguardMoves(args.request, expandedResult),
  };
}

export async function adjudicateBodyguardRequest(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): Promise<BodyguardRequestAdjudication> {
  const heldDecision = await resolveBodyguardHeldRequest(args);
  if (heldDecision) {
    return {
      ...heldDecision,
      config: args.config,
      request: args.request,
    };
  }

  {
    const gravityService = args.config.gravityService ?? createBoundaryGravityService();
    const gravity = await gravityService.enforceRequest({
      config: args.config,
      request: args.request,
    });

    if (gravity.outcome === "deny") {
      return {
        config: gravity.config,
        request: gravity.request,
        result: {
          decision: "deny",
          reason: gravity.reason,
          triggeredLawIds: gravity.lawIds,
          requiresApproval: false,
        },
        bodyguardMoves: gravity.bodyguardMoves,
      };
    }

    if (gravity.outcome === "bodyguard_grant_offer") {
      return {
        config: gravity.config,
        request: gravity.request,
        result: {
          decision: "require_approval",
          reason: gravity.reason,
          triggeredLawIds: gravity.lawIds,
          requiresApproval: true,
        },
        bodyguardMoves: gravity.bodyguardMoves,
        grantOffer: gravity,
      };
    }

    const nextConfig = gravity.config ?? args.config;
    const nextRequest = gravity.request ?? args.request;
    const adjudication = evaluateBodyguardAction({
      config: nextConfig,
      request: nextRequest,
    });
    return {
      ...adjudication,
      config: nextConfig,
      request: nextRequest,
    };
  }
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
    await appendBoundaryLedger("UPL_ALLOW_RECORDED", {
      sessionId: args.config.session.sessionId,
      actorId: args.config.session.actorId,
      requestId: args.request.requestId,
      actionKind: args.request.actionKind,
      target: args.request.target,
      decision: "allow",
      reason: "user recorded standing UPL approval",
      lawIds: [newEntry?.id].filter(Boolean),
      metadata: {
        witness_record: args.witness.META.id,
        upl_scope: args.decision.scope ?? "GLOBAL",
      },
      createdAt: new Date().toISOString(),
    });
    // If a track corridor was auto-bound to this entry, ledger its activation.
    if (newEntry?.trackConstraint) {
      await appendBoundaryLedger("UPL_TRACK_ACTIVATED", {
        sessionId: args.config.session.sessionId,
        actorId: args.config.session.actorId,
        requestId: args.request.requestId,
        actionKind: args.request.actionKind,
        target: args.request.target,
        reason: `UPL track corridor bound: ${newEntry.trackConstraint.description}`,
        lawIds: [newEntry.id],
        metadata: {
          upl_entry_id: newEntry.id,
          upl_entry_type: newEntry.type,
          track_description: newEntry.trackConstraint.description,
          track_allowed_kinds: newEntry.trackConstraint.allowedActionKinds.join(","),
          ...(newEntry.trackConstraint.targetPattern
            ? { track_target_pattern: newEntry.trackConstraint.targetPattern }
            : {}),
        },
        createdAt: new Date().toISOString(),
      });
    }
  } else if (choice === "deny_as_law") {
    upl = await writeDeniedUserPathLaw({
      ledger: upl,
      request: args.request,
      witness: args.witness,
      session: args.config.session,
      decision: args.decision,
    });
    const newEntry = upl.userDeniedLawPaths[upl.userDeniedLawPaths.length - 1];
    await appendBoundaryLedger("UPL_DENY_RECORDED", {
      sessionId: args.config.session.sessionId,
      actorId: args.config.session.actorId,
      requestId: args.request.requestId,
      actionKind: args.request.actionKind,
      target: args.request.target,
      decision: "deny",
      reason: "user recorded standing UPL denial",
      lawIds: [newEntry?.id].filter(Boolean),
      metadata: {
        witness_record: args.witness.META.id,
        upl_scope: args.decision.scope ?? "GLOBAL",
      },
      createdAt: new Date().toISOString(),
    });
    if (newEntry?.trackConstraint) {
      await appendBoundaryLedger("UPL_TRACK_ACTIVATED", {
        sessionId: args.config.session.sessionId,
        actorId: args.config.session.actorId,
        requestId: args.request.requestId,
        actionKind: args.request.actionKind,
        target: args.request.target,
        decision: "deny",
        reason: `UPL track corridor bound: ${newEntry.trackConstraint.description}`,
        lawIds: [newEntry.id],
        metadata: {
          upl_entry_id: newEntry.id,
          upl_entry_type: newEntry.type,
          track_description: newEntry.trackConstraint.description,
          track_allowed_kinds: newEntry.trackConstraint.allowedActionKinds.join(","),
          ...(newEntry.trackConstraint.targetPattern
            ? { track_target_pattern: newEntry.trackConstraint.targetPattern }
            : {}),
        },
        createdAt: new Date().toISOString(),
      });
    }
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
