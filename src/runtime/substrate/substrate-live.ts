import { grantsForAction, targetMatchesGrant } from "./../orchestrator.ts";
import { substrate, PolicyDecision, type RouteResult, type ValidationResult } from "./substrate-rust.ts";
import { checkTrackConstraint } from "./../../law/upl-tracks.ts";
import {
  lookupUserPathDecision,
  lookupUserPathTrackDecision,
} from "./../../proof/user-path-ledger.ts";
import type {
  BoundaryActionRequest,
  BoundaryApprovalDecision,
  BoundaryLawResult,
  BoundaryRequestProvenance,
  BoundaryRuntimeConfig,
  BoundaryUplEntry,
} from "./../types.ts";

type SubstrateTrafficMatchDecision = "allow" | "deny" | "require_approval" | "no_match";

type SubstrateTrafficMatch = {
  decision: SubstrateTrafficMatchDecision;
  entry?: BoundaryUplEntry;
  reason?: string;
  triggeredLawIds: string[];
  uplTrackId?: string;
  uplTrackViolated?: true;
};

export type BoundarySubstrateInterceptAssessment = {
  decision: PolicyDecision;
  trustDomain: string;
  reason?: string;
  triggeredLawIds: string[];
};

export type BoundarySubstrateGravityAssessment = {
  decision: PolicyDecision;
  route: RouteResult;
  validation: ValidationResult;
};

export type BoundarySubstrateApprovalAssessment = {
  decision: PolicyDecision;
  trustDomain: string;
};

export type BoundarySubstrateApprovalMutationAssessment = {
  allowed: boolean;
  reason?: string;
  validation: ValidationResult;
};

const routeCounters = new Map<string, number>();

function trafficLawIds(config: BoundaryRuntimeConfig, entry: BoundaryUplEntry): string[] {
  return [
    entry.id,
    ...(config.runtimeMuscle?.timeLawIdsByCategory.user_path_ledger ?? []),
  ];
}

function describeTrafficEntry(entry: BoundaryUplEntry): string {
  const note = entry.notes?.trim();
  if (note) {
    return note;
  }
  const trackDescription = entry.trackConstraint?.description?.trim();
  if (trackDescription) {
    return trackDescription;
  }
  return entry.id;
}

function standingLawReason(entry: BoundaryUplEntry, fallback: string): string {
  const trimmed = entry.notes?.trim();
  return trimmed ? `standing-law: ${trimmed}` : fallback;
}

function provenanceDomain(provenance: BoundaryRequestProvenance): string {
  switch (provenance) {
    case "trusted_user":
      return "personal";
    case "trusted_system":
      return "work";
    case "remote_user":
      return "untrusted";
    case "external_content":
      return "disposable";
    case "tool_output":
      return "work";
    case "agent_inference":
    default:
      return "work";
  }
}

function substrateServiceForAction(request: BoundaryActionRequest): string {
  return request.actionKind;
}

function substrateDomainMap(config: BoundaryRuntimeConfig): Record<string, string> {
  return {
    [config.session.sessionId]: "work",
    [config.session.actorId]: "work",
  };
}

function resolveTrustTarget(request: BoundaryActionRequest): string {
  return request.target || request.actionKind;
}

function buildKRolesForRequest(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  trafficMatch?: SubstrateTrafficMatch;
}): Array<{
  subjects: string[];
  verbs: string[];
  resources: string[];
}> {
  const actionGrants = grantsForAction(args.config.session, args.request.actionKind, args.config.grants)
    .filter((grant) => targetMatchesGrant(args.request, grant));

  const roles = actionGrants.map((grant) => ({
    subjects: [args.config.session.actorId],
    verbs: [args.request.actionKind],
    resources: [grant.resourceValue, args.request.target],
  }));

  if (args.trafficMatch?.decision === "allow") {
    roles.push({
      subjects: [args.config.session.actorId],
      verbs: [args.request.actionKind],
      resources: [args.request.target, args.trafficMatch.entry?.id ?? args.request.target],
    });
  }

  return roles;
}

function buildRouteBackends(request: BoundaryActionRequest): Array<{ endpoint: string; weight: number }> {
  if (request.actionKind === "chat.emit") {
    return [
      { endpoint: "chat-boundary", weight: 3 },
      { endpoint: "approval-gate", weight: 1 },
    ];
  }
  if (
    request.actionKind === "network.send" ||
    request.actionKind === "comm.send" ||
    request.actionKind === "agent.spend"
  ) {
    return [
      { endpoint: "egress-boundary", weight: 2 },
      { endpoint: "approval-gate", weight: 2 },
    ];
  }
  if (request.actionKind.startsWith("fs.")) {
    return [
      { endpoint: "path-rail", weight: 3 },
      { endpoint: "approval-gate", weight: 1 },
    ];
  }
  return [
    { endpoint: "gravity-core", weight: 2 },
    { endpoint: "approval-gate", weight: 1 },
  ];
}

function resolveRawTrafficMatch(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): SubstrateTrafficMatch {
  if (!args.config.upl) {
    return {
      decision: "no_match",
      triggeredLawIds: [],
    };
  }

  const exactMatch = lookupUserPathDecision({
    ledger: args.config.upl,
    session: args.config.session,
    request: args.request,
  });
  if (exactMatch) {
    const triggeredLawIds = trafficLawIds(args.config, exactMatch.entry);
    if (exactMatch.decision === "allow") {
      return {
        decision: "allow",
        entry: exactMatch.entry,
        reason: standingLawReason(exactMatch.entry, "standing-law: existing UPL law allowed this request"),
        triggeredLawIds,
        uplTrackId: exactMatch.entry.trackConstraint ? exactMatch.entry.id : undefined,
      };
    }
    return {
      decision: "deny",
      entry: exactMatch.entry,
      reason: standingLawReason(exactMatch.entry, "standing-law: existing UPL law denied this request"),
      triggeredLawIds,
      uplTrackId: exactMatch.entry.trackConstraint ? exactMatch.entry.id : undefined,
    };
  }

  const trackMatch = lookupUserPathTrackDecision({
    ledger: args.config.upl,
    session: args.config.session,
    request: args.request,
  });
  if (!trackMatch) {
    return {
      decision: "no_match",
      triggeredLawIds: [],
    };
  }

  const triggeredLawIds = trafficLawIds(args.config, trackMatch.entry);
  if (trackMatch.decision === "track_violation") {
    return {
      decision: "require_approval",
      entry: trackMatch.entry,
      reason: `action exits approved execution corridor: ${trackMatch.violation}`,
      triggeredLawIds,
      uplTrackId: trackMatch.entry.id,
      uplTrackViolated: true,
    };
  }
  if (trackMatch.decision === "deny") {
    return {
      decision: "deny",
      entry: trackMatch.entry,
      reason: `blocked by UPL traffic wall ${describeTrafficEntry(trackMatch.entry)}`,
      triggeredLawIds,
      uplTrackId: trackMatch.entry.id,
    };
  }
  return {
    decision: "allow",
    entry: trackMatch.entry,
    reason: `allowed by UPL traffic rail ${describeTrafficEntry(trackMatch.entry)}`,
    triggeredLawIds,
    uplTrackId: trackMatch.entry.id,
  };
}

export async function assessBoundarySubstrateIntercept(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): Promise<BoundarySubstrateInterceptAssessment> {
  await substrate.init();
  const trafficMatch = resolveRawTrafficMatch(args);
  const trustDomain = substrate.qAssignTrustDomain(resolveTrustTarget(args.request), {
    domain_map: substrateDomainMap(args.config),
  });
  const sourceDomain = provenanceDomain(args.request.provenance);
  const service = substrateServiceForAction(args.request);
  const policyTable = trafficMatch.decision === "deny"
    ? {}
    : {
        [`${sourceDomain}@${trustDomain}@${service}`]: "ALLOW",
      };
  const decision = substrate.qInterceptCall(args.config.session.sessionId, {
    source_domain: sourceDomain,
    target_domain: trustDomain,
    call: { service },
    policy_table: policyTable,
  });

  return {
    decision,
    trustDomain,
    reason: decision === PolicyDecision.Deny && trafficMatch.reason ? trafficMatch.reason : undefined,
    triggeredLawIds: decision === PolicyDecision.Deny ? trafficMatch.triggeredLawIds : [],
  };
}

export async function resolveBoundarySubstrateTraffic(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): Promise<BoundaryLawResult | null> {
  const match = resolveRawTrafficMatch(args);
  if (match.decision === "no_match" || !match.reason) {
    return null;
  }

  await substrate.init();
  const subject = args.config.session.actorId;
  const resource = match.entry?.id ?? args.request.target;
  const policyRules = match.decision === "allow"
    ? [{ subject, action: args.request.actionKind, resource, effect: "ALLOW" }]
    : [];
  const trustDecision = substrate.qEnforcePolicy(subject, resource, args.request.actionKind, {
    policy_rules: policyRules,
  });
  const orchestrationDecision = substrate.kEnforce(resource, {
    subject,
    action: args.request.actionKind,
    resource,
    roles: buildKRolesForRequest({
      config: args.config,
      request: args.request,
      trafficMatch: match,
    }),
  });

  if (match.decision === "allow") {
    if (trustDecision === PolicyDecision.Allow && orchestrationDecision === PolicyDecision.Allow) {
      return {
        decision: "allow",
        reason: match.reason,
        triggeredLawIds: match.triggeredLawIds,
        requiresApproval: false,
        uplTrackId: match.uplTrackId,
      };
    }
    return {
      decision: "require_approval",
      reason: "substrate closed the approved execution rail; approval required",
      triggeredLawIds: match.triggeredLawIds,
      requiresApproval: true,
      uplTrackId: match.uplTrackId,
      ...(match.uplTrackViolated ? { uplTrackViolated: true } : {}),
    };
  }

  if (match.decision === "deny") {
    return {
      decision: "deny",
      reason: match.reason,
      triggeredLawIds: match.triggeredLawIds,
      requiresApproval: false,
      uplTrackId: match.uplTrackId,
    };
  }

  return {
    decision: "require_approval",
    reason: match.reason,
    triggeredLawIds: match.triggeredLawIds,
    requiresApproval: true,
    uplTrackId: match.uplTrackId,
    ...(match.uplTrackViolated ? { uplTrackViolated: true } : {}),
  };
}

export async function assessBoundarySubstrateGravity(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): Promise<BoundarySubstrateGravityAssessment> {
  await substrate.init();
  const counterKey = `${args.config.session.sessionId}:${args.request.actionKind}`;
  const route = substrate.kRoute(args.config.session.sessionId, {
    backends: buildRouteBackends(args.request),
    _route_counter: routeCounters.get(counterKey) ?? 0,
  });
  routeCounters.set(counterKey, route.next_counter);

  const validation = substrate.kValidate(args.request.requestId, {
    manifest: {
      apiVersion: "buccet/v1",
      kind: "BoundaryRequest",
      metadata: { name: args.request.requestId },
      spec: {
        actionKind: args.request.actionKind,
        target: args.request.target,
        provenance: args.request.provenance,
      },
    },
    rules: [{ field: "spec", required: true }],
  });

  const decision = substrate.kEnforce(args.config.session.sessionId, {
    subject: args.config.session.actorId,
    action: args.request.actionKind,
    resource: args.request.target,
    roles: buildKRolesForRequest({
      config: args.config,
      request: args.request,
    }),
  });

  return {
    decision,
    route,
    validation,
  };
}

export async function assessBoundarySubstrateApprovalRequest(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): Promise<BoundarySubstrateApprovalAssessment> {
  await substrate.init();
  const trustDomain = substrate.qAssignTrustDomain(resolveTrustTarget(args.request), {
    domain_map: substrateDomainMap(args.config),
  });
  const decision = substrate.qInterceptCall(args.config.session.sessionId, {
    source_domain: "boundary",
    target_domain: trustDomain,
    call: { service: "approval.request" },
    policy_table: {
      [`boundary@${trustDomain}@approval.request`]: "ALLOW",
    },
  });
  return { decision, trustDomain };
}

export async function validateBoundarySubstrateApprovalMutation(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  decision: BoundaryApprovalDecision;
}): Promise<BoundarySubstrateApprovalMutationAssessment> {
  await substrate.init();
  const trustDomain = substrate.qAssignTrustDomain(resolveTrustTarget(args.request), {
    domain_map: substrateDomainMap(args.config),
  });
  const policy = substrate.qEnforcePolicy(args.config.session.actorId, trustDomain, args.decision.choice, {
    policy_rules: [{
      subject: args.config.session.actorId,
      action: args.decision.choice,
      resource: trustDomain,
      effect: "ALLOW",
    }],
  });
  const validation = substrate.kValidate(args.request.requestId, {
    manifest: {
      apiVersion: "buccet/v1",
      kind: "BoundaryApprovalMutation",
      metadata: { name: args.request.requestId },
      spec: {
        choice: args.decision.choice,
        actionKind: args.request.actionKind,
        target: args.request.target,
      },
    },
    rules: [{ field: "spec", required: true }],
  });
  const allowed = policy === PolicyDecision.Allow && validation.passed;
  return {
    allowed,
    reason: allowed ? undefined : validation.message || "substrate rejected approval mutation",
    validation,
  };
}
