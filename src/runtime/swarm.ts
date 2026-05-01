import { createHash, randomUUID } from "node:crypto";
import {
  createBoundaryActionRequest,
  enableBodyguardControl,
  recordBodyguardUserLawDecision,
} from "./bodyguard.ts";
import { createBoundaryHeadlessApprovalHandler } from "./headless.ts";
import {
  describeBoundaryNoveltyState,
  normalizeBoundaryNoveltyState,
} from "./novelty.ts";
import path from "node:path";
import {
  evaluateBoundaryIntercept,
  mapInterceptToBoundaryAction,
  withAdmittedBoundaryNovelty,
  withBoundaryNovelty,
  type BoundaryInterceptDecision,
  type BoundaryInterceptRequest,
  type BoundaryInterceptResult,
} from "./intercept.ts";
import { appendBoundaryLedger } from "./ledger.ts";
import type {
  BoundaryActionKind,
  BoundaryAdmissionState,
  BoundaryApprovalPrompt,
  BoundaryActionRequest,
  BoundaryResourceKind,
  BoundaryNoveltyState,
  BoundaryReviewContext,
  BoundaryUserPathLedger,
  BodyguardMove,
} from "./types.ts";
import type { BoundaryRuntimeStore } from "./store.ts";
import { loadUserPathLedger } from "./user-path-ledger.ts";

// ─── Structural limits ────────────────────────────────────────────────────────

/** Maximum number of pending groups held at once. Prevents unbounded growth
 *  under a flood of unique-target requests. When the cap is hit, new requests
 *  that would create a fresh group are denied immediately rather than queued. */
const MAX_PENDING_GROUPS = 256;

/** Maximum waiters allowed per group. A single approval gate should not
 *  accumulate unlimited hanging promises. Excess joiners are denied fast. */
const MAX_WAITERS_PER_GROUP = 64;

/** How long a waiter will park before self-resolving to deny (ms).
 *  Prevents indefinite hangs when a group is never settled. */
const WAITER_TIMEOUT_MS = 60_000;

/** Maximum groups processed concurrently in resolveWaitingGroupsFromUpl.
 *  Prevents a flood of pending groups from saturating the approval handler. */
const MAX_CONCURRENT_UPL_RESOLVE = 8;

// ─── Readiness tiers ──────────────────────────────────────────────────────────

/** Artifact readiness: what an output carries so the next agent knows
 *  what it is and what actions are allowed against it — no asking needed. */
export type BoundarySwarmReadiness =
  | "raw"
  | "draft"
  | "locally_complete"
  | "dependency_ready"
  | "domain_verified"
  | "cross_domain_verified"
  | "globally_ready"
  | "released"
  | "rolled_back";

/** Actions permitted at each readiness tier.
 *  Agents read this — they do not negotiate it. */
export const READINESS_PERMITTED_ACTIONS: Record<BoundarySwarmReadiness, readonly string[]> = {
  raw:                  ["inspect"],
  draft:                ["inspect", "review", "comment"],
  locally_complete:     ["inspect", "review", "comment", "test"],
  dependency_ready:     ["inspect", "review", "comment", "test", "integrate"],
  domain_verified:      ["inspect", "review", "comment", "test", "integrate", "stage"],
  cross_domain_verified:["inspect", "review", "comment", "test", "integrate", "stage", "release_candidate"],
  globally_ready:       ["inspect", "review", "comment", "test", "integrate", "stage", "release_candidate", "deploy"],
  released:             ["inspect", "rollback"],
  rolled_back:          ["inspect", "review", "comment"],
};

/** Returns true if the given action is permitted at the given readiness tier. */
export function isActionPermittedAtReadiness(action: string, readiness: BoundarySwarmReadiness): boolean {
  return (READINESS_PERMITTED_ACTIONS[readiness] as readonly string[]).includes(action);
}

const LOW_RISK_SWARM_ACTIONS = new Set([
  "inspect",
  "review",
  "comment",
  "summarize",
  "draft",
  "test",
]);

const HIGH_RISK_SWARM_ACTIONS = new Set([
  "deploy",
  "release",
  "release_candidate",
  "stage",
  "merge",
  "publish",
  "write",
  "append",
  "delete",
  "move",
  "network.send",
  "comm.send",
  "agent.spend",
  "sys.credential.read",
  "sys.credential.use",
  "tool.exec",
  "db.insert",
  "db.update",
  "db.delete",
  "exec",
]);

const HIGH_RISK_BOUNDARY_ACTION_KINDS = new Set<BoundaryActionKind>([
  "fs.write",
  "fs.append",
  "fs.delete",
  "fs.move",
  "fs.mkdir",
  "network.send",
  "comm.send",
  "agent.spend",
  "sys.credential.read",
  "sys.credential.use",
  "sys.config.write",
  "sys.env.write",
  "tool.exec",
  "db.insert",
  "db.update",
  "db.delete",
]);

const DEFAULT_HISTORY_BY_ACTION: Partial<Record<string, string[]>> = {
  deploy: ["build_pass", "security_review", "rollback_plan", "owner_approval"],
  release: ["tests_passed", "versioned_artifact", "changelog_ready", "release_witness"],
  release_candidate: ["tests_passed", "versioned_artifact"],
  stage: ["tests_passed", "owner_approval"],
  merge: ["tests_passed", "review_approved"],
  publish: ["content_review", "legal_review"],
};

const DEFAULT_HISTORY_BY_ACTION_KIND: Partial<Record<BoundaryActionKind, string[]>> = {
  "tool.exec": ["owner_approval"],
  "network.send": ["destination_verified", "owner_approval"],
  "comm.send": ["recipient_verified", "owner_approval"],
  "agent.spend": ["intent_declared", "destination_declared", "cap_declared", "source_authority"],
  "sys.credential.read": ["owner_approval", "security_review"],
  "sys.credential.use": ["owner_approval", "security_review"],
  "db.insert": ["owner_approval"],
  "db.update": ["owner_approval", "change_review"],
  "db.delete": ["owner_approval", "change_review"],
  "fs.write": ["owner_approval"],
  "fs.append": ["owner_approval"],
  "fs.move": ["owner_approval"],
  "fs.delete": ["owner_approval", "rollback_plan"],
};

function isHighConsequenceSwarmAction(action: string | undefined, actionKind: BoundaryActionKind | undefined): boolean {
  if (action && HIGH_RISK_SWARM_ACTIONS.has(action)) {
    return true;
  }
  return actionKind ? HIGH_RISK_BOUNDARY_ACTION_KINDS.has(actionKind) : false;
}

function isLowRiskSwarmAction(action: string | undefined, actionKind: BoundaryActionKind | undefined): boolean {
  if (action && LOW_RISK_SWARM_ACTIONS.has(action)) {
    return true;
  }
  return actionKind === "fs.read" || actionKind === "db.query" || actionKind === "sys.config.read" || actionKind === "sys.env.read";
}

function defaultRequiredHistoryForSwarmAction(
  action: string | undefined,
  actionKind: BoundaryActionKind | undefined,
): string[] {
  const byAction = action ? DEFAULT_HISTORY_BY_ACTION[action] ?? [] : [];
  const byKind = actionKind ? DEFAULT_HISTORY_BY_ACTION_KIND[actionKind] ?? [] : [];
  return [...new Set([...byAction, ...byKind])];
}

function findBudgetOverflow(cost: BoundarySwarmCost | undefined):
  | { scope: string; consumed: number; cap: number; unit: string }
  | null {
  if (!cost) {
    return null;
  }

  const budgets: Array<{ scope: string; consumed: number; cap: number; unit: string }> = [];
  if (cost.unitCap !== undefined) {
    budgets.push({ scope: "agent", consumed: cost.unitsConsumed, cap: cost.unitCap, unit: cost.unit });
  }
  for (const [scope, entry] of [
    ["task", cost.taskBudget],
    ["intent", cost.intentBudget],
    ["artifact", cost.artifactBudget],
    ["swarm", cost.swarmBudget],
    ["window", cost.windowBudget],
    ["global", cost.globalBudget],
  ] as const) {
    if (!entry) {
      continue;
    }
    budgets.push({ scope, consumed: entry.consumed, cap: entry.cap, unit: entry.unit ?? cost.unit });
  }

  return budgets.find((budget) => budget.consumed >= budget.cap) ?? null;
}

function findNearBudget(cost: BoundarySwarmCost | undefined):
  | { scope: string; consumed: number; cap: number; unit: string }
  | null {
  if (!cost) {
    return null;
  }

  const budgets: Array<{ scope: string; consumed: number; cap: number; unit: string }> = [];
  if (cost.unitCap !== undefined) {
    budgets.push({ scope: "agent", consumed: cost.unitsConsumed, cap: cost.unitCap, unit: cost.unit });
  }
  for (const [scope, entry] of [
    ["task", cost.taskBudget],
    ["intent", cost.intentBudget],
    ["artifact", cost.artifactBudget],
    ["swarm", cost.swarmBudget],
    ["window", cost.windowBudget],
    ["global", cost.globalBudget],
  ] as const) {
    if (!entry) {
      continue;
    }
    budgets.push({ scope, consumed: entry.consumed, cap: entry.cap, unit: entry.unit ?? cost.unit });
  }

  return budgets.find((budget) => budget.cap > 0 && (budget.consumed / budget.cap) >= 0.8) ?? null;
}

// ─── Path classification ──────────────────────────────────────────────────────

/** Instant routing decision for every contact.
 *  Green = act now. Yellow = speculative/review. Red = reject. Purple = intent underspecified. */
export type BoundarySwarmPath = "green" | "yellow" | "red" | "purple";

export type BoundarySwarmYellowReason =
  | "missing_intent"
  | "missing_validation"
  | "stale_version"
  | "dependency_pending"
  | "ownership_uncertain"
  | "provenance_uncertain"
  | "cost_near_cap"
  | "speculative_allowed";

export type BoundarySwarmPurpleAction =
  | "ask"
  | "define"
  | "route_to_owner"
  | "expire"
  | "deny";

export type BoundarySwarmDefinitionRequest = {
  action: BoundarySwarmPurpleAction;
  reason: string;
  owner?: string;
  evidenceNeeded?: string[];
  expiresAt?: string;
};

export type BoundarySwarmPathClassification = {
  path: BoundarySwarmPath;
  disposition: "continue" | "queue" | "deny";
  reason: string;
  lawIds: string[];
  code: string;
  yellowReason?: BoundarySwarmYellowReason;
  purpleAction?: BoundarySwarmPurpleAction;
  definitionRequest?: BoundarySwarmDefinitionRequest;
};

/** Classify a contact against readiness and intent.
 *  This is the instant routing layer — no waiting, no negotiation. */
export function classifySwarmPath(args: {
  action?: string;
  actionKind?: BoundaryActionKind;
  readiness: BoundarySwarmReadiness;
  intent?: BoundarySwarmIntent;
  intentLedger?: BoundarySwarmIntentLedger;
  ownership?: BoundarySwarmOwnership;
  actorRole?: string;
  handoff?: BoundarySwarmHandoff;
  completedValidation?: string[];
  provenance?: BoundarySwarmProvenance;
  freshness?: BoundarySwarmFreshness;
  composition?: BoundarySwarmComposition;
  coordination?: BoundarySwarmCoordinationState;
  domainStatus?: BoundarySwarmDomainStatus;
  cost?: BoundarySwarmCost;
}): BoundarySwarmPathClassification {
  const action = args.action?.trim();
  const actionKind = args.actionKind;
  const actorRole = args.actorRole?.trim();
  const highRisk = isHighConsequenceSwarmAction(action, actionKind);
  const lowRisk = isLowRiskSwarmAction(action, actionKind);

  if (!action) {
    const reason = "swarm action is underspecified — receiver cannot determine the next lawful continuation";
    return {
      path: "purple",
      disposition: "queue",
      reason,
      lawIds: ["SWARM.ACTION.UNSPECIFIED"],
      code: "SWARM.ACTION.UNSPECIFIED",
      purpleAction: "define",
      definitionRequest: {
        action: "define",
        reason,
        owner: args.ownership?.primaryOwner,
        evidenceNeeded: ["swarm action"],
      },
    };
  }

  // Purple — intent is present but goal is empty or underspecified.
  if (args.intent !== undefined && !args.intent.goal.trim()) {
    const reason = "intent is present but goal is underspecified — human clarification required";
    return {
      path: "purple",
      disposition: "queue",
      reason,
      lawIds: ["SWARM.INTENT.UNDERSPECIFIED"],
      code: "SWARM.INTENT.UNDERSPECIFIED",
      purpleAction: "ask",
      definitionRequest: {
        action: "ask",
        reason,
        owner: args.ownership?.primaryOwner,
        evidenceNeeded: ["intent goal", "success condition"],
      },
    };
  }

  // Purple — ownership exists but the current agent role is missing.
  if (args.ownership !== undefined && !actorRole) {
    const reason = "ownership is defined but the acting agent role is missing — the next lawful owner cannot be proven";
    return {
      path: "purple",
      disposition: "queue",
      reason,
      lawIds: ["SWARM.OWNERSHIP.UNDECLARED"],
      code: "SWARM.OWNERSHIP.UNDECLARED",
      purpleAction: "route_to_owner",
      definitionRequest: {
        action: "route_to_owner",
        reason,
        owner: args.ownership.primaryOwner,
        evidenceNeeded: ["acting agent role"],
      },
    };
  }

  if (
    highRisk
    && !args.intent
  ) {
    const reason = "high-consequence swarm motion cannot continue without declared intent";
    return {
      path: "purple",
      disposition: "queue",
      reason,
      lawIds: ["SWARM.INTENT.MISSING.HIGH_RISK"],
      code: "SWARM.INTENT.MISSING.HIGH_RISK",
      purpleAction: "ask",
      definitionRequest: {
        action: "ask",
        reason,
        owner: args.ownership?.primaryOwner,
        evidenceNeeded: ["intent goal", "must-have constraints", "success condition"],
      },
    };
  }

  if (
    highRisk
    && args.intentLedger
    && (
      args.intentLedger.openAmbiguities.length > 0
      || args.intentLedger.pendingHumanDecisions.length > 0
    )
  ) {
    const reason = "high-consequence swarm motion is blocked until intent ambiguities and pending human decisions are resolved";
    return {
      path: "purple",
      disposition: "queue",
      reason,
      lawIds: ["SWARM.INTENT.PENDING_DECISION"],
      code: "SWARM.INTENT.PENDING_DECISION",
      purpleAction: "ask",
      definitionRequest: {
        action: "ask",
        reason,
        owner: args.ownership?.primaryOwner,
        evidenceNeeded: [
          ...args.intentLedger.openAmbiguities.map((item) => `ambiguity:${item}`),
          ...args.intentLedger.pendingHumanDecisions.map((item) => `decision:${item}`),
        ],
      },
    };
  }

  const ownershipRoles = args.ownership
    ? [
        args.ownership.primaryOwner,
        args.ownership.backupOwner,
        args.ownership.reviewer,
      ].filter((value): value is string => Boolean(value?.trim()))
    : [];

  if (
    args.handoff?.receiver
    && ownershipRoles.length > 0
    && !ownershipRoles.includes(args.handoff.receiver)
  ) {
    return {
      path: "red",
      disposition: "deny",
      reason: `handoff receiver '${args.handoff.receiver}' is outside the declared ownership path`,
      lawIds: ["SWARM.OWNERSHIP.TRANSFER_UNDECLARED"],
      code: "SWARM.OWNERSHIP.TRANSFER_UNDECLARED",
    };
  }

  if (
    actorRole
    && highRisk
    && args.ownership?.reviewer === actorRole
    && actorRole !== args.ownership.primaryOwner
    && actorRole !== args.ownership.backupOwner
  ) {
    return {
      path: "red",
      disposition: "deny",
      reason: `reviewer role '${actorRole}' cannot execute high-consequence swarm action '${action}'`,
      lawIds: ["SWARM.OWNERSHIP.REVIEWER_EXECUTION_DENIED"],
      code: "SWARM.OWNERSHIP.REVIEWER_EXECUTION_DENIED",
    };
  }

  if (
    actorRole
    && highRisk
    && args.ownership?.backupOwner === actorRole
    && !args.coordination?.primaryOwnerTimedOut
    && !args.coordination?.primaryOwnerFailed
  ) {
    return {
      path: "red",
      disposition: "deny",
      reason: `backup owner '${actorRole}' cannot take over high-consequence swarm action before timeout or failure is declared`,
      lawIds: ["SWARM.OWNERSHIP.BACKUP_NOT_ACTIVATED"],
      code: "SWARM.OWNERSHIP.BACKUP_NOT_ACTIVATED",
    };
  }

  if (args.ownership?.timeoutMs && args.coordination?.lastHeartbeatAt) {
    const lastHeartbeatAt = Date.parse(args.coordination.lastHeartbeatAt);
    if (!Number.isNaN(lastHeartbeatAt) && (Date.now() - lastHeartbeatAt) >= args.ownership.timeoutMs) {
      const timeoutAction = args.coordination.timeoutAction ?? "reroute";
      if (timeoutAction === "abort") {
        return {
          path: "red",
          disposition: "deny",
          reason: `primary owner heartbeat exceeded timeout (${args.ownership.timeoutMs}ms) and the swarm timeout law is abort`,
          lawIds: ["SWARM.SILENCE.ABORT"],
          code: "SWARM.SILENCE.ABORT",
        };
      }
      return {
        path: "yellow",
        disposition: "queue",
        reason: `primary owner heartbeat exceeded timeout (${args.ownership.timeoutMs}ms) — swarm must ${timeoutAction} before continuing`,
        lawIds: ["SWARM.SILENCE.TIMEOUT"],
        code: "SWARM.SILENCE.TIMEOUT",
        yellowReason: "ownership_uncertain",
      };
    }
  }

  if (args.freshness?.invalidated) {
    return {
      path: highRisk ? "red" : "yellow",
      disposition: highRisk ? "deny" : "queue",
      reason: "artifact freshness has been invalidated — revalidation is required before continuation",
      lawIds: ["SWARM.FRESHNESS.INVALIDATED"],
      code: "SWARM.FRESHNESS.INVALIDATED",
      ...(highRisk ? {} : { yellowReason: "stale_version" as const }),
    };
  }

  const staleAtIso = args.freshness?.staleAt;
  if (staleAtIso) {
    const staleAt = Date.parse(staleAtIso);
    if (!Number.isNaN(staleAt) && staleAt <= Date.now()) {
      return {
        path: "yellow",
        disposition: "queue",
        reason: `artifact freshness window has expired at ${staleAtIso} — revalidation is required before continuation`,
        lawIds: ["SWARM.FRESHNESS.STALE"],
        code: "SWARM.FRESHNESS.STALE",
        yellowReason: "stale_version",
      };
    }
  }

  if (args.freshness?.observedAt && args.freshness.maxAgeMs !== undefined) {
    const observedAt = Date.parse(args.freshness.observedAt);
    if (!Number.isNaN(observedAt) && (Date.now() - observedAt) >= args.freshness.maxAgeMs) {
      return {
        path: "yellow",
        disposition: "queue",
        reason: `artifact observation is older than allowed freshness window (${args.freshness.maxAgeMs}ms)`,
        lawIds: ["SWARM.FRESHNESS.REVALIDATE"],
        code: "SWARM.FRESHNESS.REVALIDATE",
        yellowReason: "stale_version",
      };
    }
  }

  if (args.handoff?.expiresAt) {
    const expiresAt = Date.parse(args.handoff.expiresAt);
    if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) {
      return {
        path: "red",
        disposition: "deny",
        reason: `handoff '${args.handoff.artifactId}' is stale — expiration ${args.handoff.expiresAt} has passed`,
        lawIds: ["SWARM.HANDOFF.STALE"],
        code: "SWARM.HANDOFF.STALE",
      };
    }
  }

  if (args.handoff?.forbiddenUse?.some((forbidden) => forbidden === action)) {
    return {
      path: "red",
      disposition: "deny",
      reason: `handoff '${args.handoff.artifactId}' forbids action '${action}'`,
      lawIds: ["SWARM.HANDOFF.FORBIDDEN_USE"],
      code: "SWARM.HANDOFF.FORBIDDEN_USE",
    };
  }

  if (args.handoff?.allowedUse?.length && !args.handoff.allowedUse.includes(action)) {
    return {
      path: "red",
      disposition: "deny",
      reason: `handoff '${args.handoff.artifactId}' does not allow action '${action}'`,
      lawIds: ["SWARM.HANDOFF.ALLOWED_USE_MISMATCH"],
      code: "SWARM.HANDOFF.ALLOWED_USE_MISMATCH",
    };
  }

  if (args.handoff?.receiver && actorRole && args.handoff.receiver !== actorRole) {
    return {
      path: "red",
      disposition: "deny",
      reason: `handoff receiver '${args.handoff.receiver}' does not match acting role '${actorRole}'`,
      lawIds: ["SWARM.HANDOFF.RECEIVER_MISMATCH"],
      code: "SWARM.HANDOFF.RECEIVER_MISMATCH",
    };
  }

  if (args.ownership && actorRole) {
    if (ownershipRoles.length > 0 && !ownershipRoles.includes(actorRole)) {
      return {
        path: "red",
        disposition: "deny",
        reason: `acting role '${actorRole}' is outside the declared ownership path (${ownershipRoles.join(", ")})`,
        lawIds: ["SWARM.OWNERSHIP.DENIED"],
        code: "SWARM.OWNERSHIP.DENIED",
      };
    }
  }

  // Red — action forbidden by intent mustNotHave.
  if (args.intent?.mustNotHave?.some((forbidden) => action.toLowerCase().includes(forbidden.toLowerCase()))) {
    return {
      path: "red",
      disposition: "deny",
      reason: `action '${action}' matches a forbidden intent constraint`,
      lawIds: ["SWARM.INTENT.FORBIDDEN"],
      code: "SWARM.INTENT.FORBIDDEN",
    };
  }

  if (args.domainStatus?.user === "red") {
    return {
      path: "red",
      disposition: "deny",
      reason: "user-intent precedence blocks continuation",
      lawIds: ["SWARM.DOMAIN.USER_BLOCK"],
      code: "SWARM.DOMAIN.USER_BLOCK",
    };
  }

  if (highRisk && args.domainStatus?.security === "red") {
    return {
      path: "red",
      disposition: "deny",
      reason: "security precedence blocks high-consequence continuation",
      lawIds: ["SWARM.DOMAIN.SECURITY_BLOCK"],
      code: "SWARM.DOMAIN.SECURITY_BLOCK",
    };
  }

  if (highRisk && args.domainStatus?.legal === "red") {
    return {
      path: "red",
      disposition: "deny",
      reason: "legal precedence blocks high-consequence continuation",
      lawIds: ["SWARM.DOMAIN.LEGAL_BLOCK"],
      code: "SWARM.DOMAIN.LEGAL_BLOCK",
    };
  }

  if (highRisk && (args.domainStatus?.product === "red" || args.domainStatus?.engineering === "red")) {
    return {
      path: "yellow",
      disposition: "queue",
      reason: "cross-domain conflict requires arbitration before high-consequence continuation",
      lawIds: ["SWARM.DOMAIN.ARBITRATION_REQUIRED"],
      code: "SWARM.DOMAIN.ARBITRATION_REQUIRED",
      yellowReason: "dependency_pending",
    };
  }

  if (args.provenance) {
    const isEvidenceOnly = args.provenance.safeToActOn === false
      || (actionKind === "tool.exec" && args.provenance.safeToExecute === false)
      || (actionKind?.startsWith("fs.") && args.provenance.safeToImport === false);
    if (isEvidenceOnly) {
      return {
        path: highRisk ? "red" : "yellow",
        disposition: highRisk ? "deny" : "queue",
        reason: "unverified agent output is evidence-only and cannot directly become authority",
        lawIds: ["SWARM.PROVENANCE.EVIDENCE_ONLY"],
        code: "SWARM.PROVENANCE.EVIDENCE_ONLY",
        ...(highRisk ? {} : { yellowReason: "provenance_uncertain" as const }),
      };
    }

    if (
      args.provenance.trust !== "trusted"
      || args.provenance.containsUnverifiedClaims
      || args.provenance.source === "unknown"
    ) {
      return {
        path: "yellow",
        disposition: highRisk ? "queue" : "continue",
        reason: highRisk
          ? "provenance is not trusted enough for high-consequence continuation without review"
          : "provenance is uncertain — continuation remains evidence-oriented",
        lawIds: ["SWARM.PROVENANCE.UNVERIFIED"],
        code: "SWARM.PROVENANCE.UNVERIFIED",
        yellowReason: "provenance_uncertain",
      };
    }
  }

  // Red — action not permitted at this readiness tier.
  if (!isActionPermittedAtReadiness(action, args.readiness)) {
    return {
      path: "red",
      disposition: "deny",
      reason: `action '${action}' is not permitted at readiness tier '${args.readiness}' — allowed: ${READINESS_PERMITTED_ACTIONS[args.readiness].join(", ")}`,
      lawIds: ["SWARM.READINESS.DENIED"],
      code: "SWARM.READINESS.DENIED",
    };
  }

  const missingValidation = (args.handoff?.requiredValidation ?? []).filter(
    (requirement) => !(args.completedValidation ?? []).includes(requirement),
  );
  if (missingValidation.length > 0) {
    return {
      path: "yellow",
      disposition: "queue",
      reason: `handoff '${args.handoff?.artifactId}' is missing required validation: ${missingValidation.join(", ")}`,
      lawIds: ["SWARM.HANDOFF.VALIDATION_PENDING"],
      code: "SWARM.HANDOFF.VALIDATION_PENDING",
      yellowReason: "missing_validation",
    };
  }

  if (args.composition?.expectedVersion && args.composition.artifactVersion && args.composition.expectedVersion !== args.composition.artifactVersion) {
    return {
      path: "yellow",
      disposition: "queue",
      reason: `artifact version '${args.composition.artifactVersion}' does not match expected version '${args.composition.expectedVersion}'`,
      lawIds: ["SWARM.COMPOSITION.VERSION_MISMATCH"],
      code: "SWARM.COMPOSITION.VERSION_MISMATCH",
      yellowReason: "stale_version",
    };
  }

  if (args.composition?.dependenciesPending?.length) {
    return {
      path: "yellow",
      disposition: "queue",
      reason: `composition dependencies are still pending: ${args.composition.dependenciesPending.join(", ")}`,
      lawIds: ["SWARM.COMPOSITION.DEPENDENCY_PENDING"],
      code: "SWARM.COMPOSITION.DEPENDENCY_PENDING",
      yellowReason: "dependency_pending",
    };
  }

  const requiredHistory = [
    ...defaultRequiredHistoryForSwarmAction(action, actionKind),
    ...(args.composition?.requiredHistory ?? []),
  ];
  const completedHistory = new Set(args.composition?.completedHistory ?? []);
  const missingHistory = [...new Set(requiredHistory)].filter((item) => !completedHistory.has(item));
  if (missingHistory.length > 0) {
    return {
      path: "yellow",
      disposition: "queue",
      reason: `high-consequence continuation is missing required history: ${missingHistory.join(", ")}`,
      lawIds: ["SWARM.COMPOSITION.HISTORY_PENDING"],
      code: "SWARM.COMPOSITION.HISTORY_PENDING",
      yellowReason: "missing_validation",
    };
  }

  // Yellow — permitted but intent is absent (unknown goal alignment).
  if (!args.intent) {
    return {
      path: "yellow",
      disposition: lowRisk ? "continue" : "queue",
      reason: lowRisk
        ? "action is locally permitted but no intent is set — low-risk speculative continuation only"
        : "action is locally permitted but intent is missing — continuation must wait for declared purpose",
      lawIds: ["SWARM.INTENT.MISSING"],
      code: "SWARM.INTENT.MISSING",
      yellowReason: lowRisk ? "speculative_allowed" : "missing_intent",
    };
  }

  const nearBudget = findNearBudget(args.cost);
  if (nearBudget) {
    return {
      path: "yellow",
      disposition: highRisk ? "queue" : "continue",
      reason: `${nearBudget.scope} cost is near cap (${nearBudget.consumed}/${nearBudget.cap} ${nearBudget.unit})`,
      lawIds: ["SWARM.COST.NEAR_CAP"],
      code: "SWARM.COST.NEAR_CAP",
      yellowReason: "cost_near_cap",
    };
  }

  // Green — permitted and intent is defined.
  return {
    path: "green",
    disposition: "continue",
    reason: `action '${action}' is permitted at readiness '${args.readiness}' and aligns with intent: ${args.intent.goal}`,
    lawIds: ["SWARM.PATH.GREEN"],
    code: "SWARM.PATH.GREEN",
  };
}

// ─── Intent ───────────────────────────────────────────────────────────────────

/** The human-desired result that governs this swarm group.
 *  Every continuation must remain on Path(intent). */
export type BoundarySwarmIntent = {
  /** One-sentence goal — what must be true at the end. */
  goal: string;
  /** What human value this serves. */
  why?: string;
  /** Required conditions that cannot be traded away. */
  mustHave?: string[];
  /** Outcomes that are forbidden regardless of local validity. */
  mustNotHave?: string[];
  /** What matters most when tradeoffs appear. */
  preferenceOrder?: string[];
  /** How we know it worked. */
  successCondition?: string;
  /** When enough is enough — stop condition. */
  stopCondition?: string;
  /** When the human must be consulted rather than the swarm deciding. */
  escalationCondition?: string;
  /** When the intent itself needs human clarification. */
  revisionCondition?: string;
};

// ─── Intent Ledger ────────────────────────────────────────────────────────────

/** Shared ledger all swarms read and write against.
 *  Prevents drift — every group's actions are checked against this. */
export type BoundarySwarmIntentLedger = {
  /** The governing human goal. */
  goal: string;
  /** Constraints that cannot be traded. */
  mustHave: string[];
  /** Forbidden outcomes. */
  mustNotHave: string[];
  /** How we know it worked. */
  successCriteria: string[];
  /** Ambiguities not yet resolved by the human. */
  openAmbiguities: string[];
  /** Tradeoffs the human has explicitly accepted. */
  acceptedTradeoffs: string[];
  /** Paths the human has explicitly rejected. */
  rejectedPaths: string[];
  /** Decisions already made — no need to re-ask. */
  humanDecisions: string[];
  /** Things still requiring human decision. */
  pendingHumanDecisions: string[];
  /** Evidence that current work supports the goal. */
  progressEvidence: string[];
  /** When this ledger was last updated. */
  updatedAt: string;
};

/** Create a minimal intent ledger from a goal string. */
export function createIntentLedger(goal: string): BoundarySwarmIntentLedger {
  return {
    goal,
    mustHave: [],
    mustNotHave: [],
    successCriteria: [],
    openAmbiguities: [],
    acceptedTradeoffs: [],
    rejectedPaths: [],
    humanDecisions: [],
    pendingHumanDecisions: [],
    progressEvidence: [],
    updatedAt: new Date().toISOString(),
  };
}

// ─── Ownership ────────────────────────────────────────────────────────────────

/** Who owns the next move — every task has a defined owner so there is
 *  never a "who's got this?" pause. */
export type BoundarySwarmOwnership = {
  /** Primary agent role responsible for this group. */
  primaryOwner: string;
  /** Fallback if primary is unavailable or times out. */
  backupOwner?: string;
  /** Role responsible for reviewing the output. */
  reviewer?: string;
  /** Where this goes if reviewer is blocked or disagreement cannot resolve. */
  escalationPath?: string;
  /** After this duration (ms) with no progress, route to backupOwner or escalationPath. */
  timeoutMs?: number;
};

// ─── Handoff Law ──────────────────────────────────────────────────────────────

/** Full handoff contract — every output carries enough state for the next
 *  agent to know exactly what can happen next. No asking. */
export type BoundarySwarmHandoff = {
  /** Who produced this artifact. */
  sender: string;
  /** Who should receive it. */
  receiver: string;
  /** Identifier of the artifact being handed off. */
  artifactId: string;
  /** Readiness at time of handoff. */
  readiness: BoundarySwarmReadiness;
  /** Version or sequence number. */
  version: string;
  /** What this artifact may be used for at this readiness. */
  allowedUse: string[];
  /** What this artifact must NOT be used for yet. */
  forbiddenUse?: string[];
  /** ISO timestamp after which this handoff is considered stale. */
  expiresAt?: string;
  /** Validation required before the receiver acts. */
  requiredValidation?: string[];
  /** What the receiver should do next. */
  nextAction: string;
};

export type BoundarySwarmProvenance = {
  source: "user" | "model" | "tool" | "repo" | "web" | "unknown";
  trust: "trusted" | "unverified" | "unknown";
  containsUnverifiedClaims?: boolean;
  safeToQuote?: boolean;
  safeToExecute?: boolean;
  safeToImport?: boolean;
  safeToActOn?: boolean;
};

export type BoundarySwarmFreshness = {
  observedAt?: string;
  maxAgeMs?: number;
  staleAt?: string;
  invalidated?: boolean;
};

export type BoundarySwarmComposition = {
  pathId?: string;
  requiredHistory?: string[];
  completedHistory?: string[];
  dependenciesPending?: string[];
  artifactVersion?: string;
  expectedVersion?: string;
};

export type BoundarySwarmCoordinationState = {
  lastHeartbeatAt?: string;
  timeoutAction?: "reroute" | "replace" | "escalate" | "abort";
  primaryOwnerTimedOut?: boolean;
  primaryOwnerFailed?: boolean;
};

export type BoundarySwarmDomainStatus = {
  user?: "green" | "yellow" | "red";
  security?: "green" | "yellow" | "red";
  legal?: "green" | "yellow" | "red";
  product?: "green" | "yellow" | "red";
  engineering?: "green" | "yellow" | "red";
};

// ─── Cost ─────────────────────────────────────────────────────────────────────

export type BoundarySwarmBudgetWindow = {
  consumed: number;
  cap: number;
  unit?: string;
};

/** Per-agent cost tracking. Keeps the swarm accountable to a budget. */
export type BoundarySwarmCost = {
  /** Token or compute units consumed by this agent/group so far. */
  unitsConsumed: number;
  /** Hard ceiling — group is denied if exceeded. */
  unitCap?: number;
  /** Arbitrary cost label (e.g. "tokens", "usd-cents", "api-calls"). */
  unit: string;
  /** Aggregate budgets that prevent distributed tiny actions from bypassing a real cap. */
  taskBudget?: BoundarySwarmBudgetWindow;
  intentBudget?: BoundarySwarmBudgetWindow;
  artifactBudget?: BoundarySwarmBudgetWindow;
  swarmBudget?: BoundarySwarmBudgetWindow;
  windowBudget?: BoundarySwarmBudgetWindow;
  globalBudget?: BoundarySwarmBudgetWindow;
};

export type BoundarySwarmRequestMeta = {
  /** The coordination action being requested at this boundary. */
  action?: string;
  /** The acting specialized agent role. */
  actorRole?: string;
  /** Readiness of the artifact or state being acted on. */
  readiness?: BoundarySwarmReadiness;
  /** Human-desired result for this continuation. */
  intent?: BoundarySwarmIntent;
  /** Shared intent ledger for drift control across agents. */
  intentLedger?: BoundarySwarmIntentLedger;
  /** Ownership path for this action. */
  ownership?: BoundarySwarmOwnership;
  /** Full handoff contract for this action. */
  handoff?: BoundarySwarmHandoff;
  /** Validations already completed on the handed-off artifact. */
  completedValidation?: string[];
  /** Provenance and trust posture for the handed-off material. */
  provenance?: BoundarySwarmProvenance;
  /** Freshness and staleness controls for the handed-off material. */
  freshness?: BoundarySwarmFreshness;
  /** Composition and readiness-history controls for multi-step continuation. */
  composition?: BoundarySwarmComposition;
  /** Heartbeat, timeout, and takeover state for the current ownership path. */
  coordination?: BoundarySwarmCoordinationState;
  /** Cross-domain posture that can block or arbitrate continuation. */
  domainStatus?: BoundarySwarmDomainStatus;
  /** Cost tracking for the acting agent or group. */
  cost?: BoundarySwarmCost;
};

// ─── Group state ──────────────────────────────────────────────────────────────

export type BoundarySwarmGroupState = "waiting" | "approved" | "denied";

export type BoundarySwarmGroup = {
  groupId: string;
  key: string;
  state: BoundarySwarmGroupState;
  createdAt: string;
  updatedAt: string;
  actionClass: BoundaryInterceptRequest["actionClass"];
  operation: string;
  target: string;
  reason: string;
  payloadSummary?: string;
  reviewContext?: BoundaryReviewContext;
  lawIds: string[];
  bodyguardMoves: BodyguardMove[];
  memberCount: number;
  waitingCount: number;
  requestIds: string[];
  /** Session that owns this group — no cross-session waiter joins. */
  sessionId: string;
  /** Live swarm path classification for this group. */
  path?: BoundarySwarmPath;
  /** Reason explaining the active swarm path. */
  pathReason?: string;
  /** Explicit coordination action being attempted. */
  swarmAction?: string;
  /** Acting role for the representative request. */
  actorRole?: string;
  /** Readiness of the artifact this group is acting on or producing. */
  readiness: BoundarySwarmReadiness;
  /** Human-desired result this group is serving. */
  intent?: BoundarySwarmIntent;
  /** Shared drift-control ledger for this group. */
  intentLedger?: BoundarySwarmIntentLedger;
  /** Ownership path for this group. */
  ownership?: BoundarySwarmOwnership;
  /** Handoff contract governing this group. */
  handoff?: BoundarySwarmHandoff;
  /** Completed validations attached to this group. */
  completedValidation?: string[];
  /** Provenance and trust posture for the group artifact. */
  provenance?: BoundarySwarmProvenance;
  /** Freshness and staleness posture for the group artifact. */
  freshness?: BoundarySwarmFreshness;
  /** Composition and required-history posture for the group artifact. */
  composition?: BoundarySwarmComposition;
  /** Coordination and heartbeat posture for the group. */
  coordination?: BoundarySwarmCoordinationState;
  /** Cross-domain status for arbitration and precedence. */
  domainStatus?: BoundarySwarmDomainStatus;
  /** Cost tracking for the agent(s) in this group. */
  cost?: BoundarySwarmCost;
  /** Novelty classification attached to this group. */
  novelty?: BoundaryNoveltyState;
  /** Stable code for the current path decision. */
  pathCode?: string;
  /** Explicit subtype when the group is on the yellow path. */
  yellowReason?: BoundarySwarmYellowReason;
  /** Explicit definition action when the group is on the purple path. */
  purpleAction?: BoundarySwarmPurpleAction;
  /** Definition task emitted for purple/underspecified continuation. */
  definitionRequest?: BoundarySwarmDefinitionRequest;
};

type BoundarySwarmResolution =
  | { kind: "retry"; request?: BoundaryInterceptRequest }
  | { kind: "allow_once"; reason: string }
  | { kind: "deny"; reason: string };

type BoundarySwarmWaiter = {
  wait(): Promise<BoundarySwarmResolution>;
  settle(resolution: BoundarySwarmResolution): void;
};

type BoundarySwarmPendingGroup = BoundarySwarmGroup & {
  representative: BoundaryInterceptRequest;
  waiters: Set<BoundarySwarmWaiter>;
  retryOnApproval?: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeTarget(request: BoundaryInterceptRequest): string {
  if (request.actionClass === "file") {
    return path.resolve(request.target);
  }
  return request.target.trim();
}

function withSwarmMeta(
  request: BoundaryInterceptRequest,
  swarm?: BoundarySwarmRequestMeta,
): BoundaryInterceptRequest {
  if (!swarm) {
    return request;
  }
  return request.swarm === swarm
    ? request
    : {
        ...request,
        swarm,
      };
}

function resolveSwarmAction(swarm: BoundarySwarmRequestMeta | undefined): string | undefined {
  return swarm?.action?.trim() || swarm?.handoff?.nextAction?.trim();
}

function noveltyLawIds(novelty: BoundaryNoveltyState): string[] {
  const ids = ["TIME.NOVELTY.01"];
  for (const noveltyClass of novelty.classes ?? []) {
    ids.push(`BOUNDARY.NOVELTY.CLASS.${noveltyClass.replaceAll(/[^a-z0-9]+/gi, "_").toUpperCase()}.01`);
  }
  for (const boundaryHit of novelty.boundaryHits ?? []) {
    ids.push(`BOUNDARY.NOVELTY.HIT.${boundaryHit.replaceAll(/[^a-z0-9]+/gi, "_").toUpperCase()}.01`);
  }
  return [...new Set(ids)];
}

function classifyNoveltyPath(
  request: BoundaryInterceptRequest,
): BoundarySwarmPathClassification | null {
  const novelty = normalizeBoundaryNoveltyState(request.novelty);
  if (!novelty?.detected || novelty.admitted) {
    return null;
  }

  const reason = describeBoundaryNoveltyState(novelty)
    ?? "novel contact requires classification before it can produce consequence";
  if (
    novelty.disposition === "deny"
    || novelty.disposition === "quarantine"
    || novelty.disposition === "safe_error"
    || novelty.disposition === "no_op"
  ) {
    return {
      path: "red",
      disposition: "deny",
      reason,
      lawIds: noveltyLawIds(novelty),
      code: "SWARM.NOVELTY.DENY",
    };
  }

  return {
    path: "purple",
    disposition: "queue",
    reason,
    lawIds: noveltyLawIds(novelty),
    code: "SWARM.NOVELTY.QUEUE",
    purpleAction: "define",
    definitionRequest: {
      action: "define",
      reason,
      evidenceNeeded: ["novelty classification"],
    },
  };
}

function classifyRequestSwarmPath(
  request: BoundaryInterceptRequest,
): BoundarySwarmPathClassification | null {
  const noveltyClassification = classifyNoveltyPath(request);
  if (noveltyClassification) {
    return noveltyClassification;
  }
  const swarm = request.swarm;
  if (!swarm) {
    return null;
  }
  return classifySwarmPath({
    action: resolveSwarmAction(swarm),
    actionKind: mapInterceptToBoundaryAction(request),
    readiness: swarm.readiness ?? "draft",
    intent: swarm.intent,
    intentLedger: swarm.intentLedger,
    ownership: swarm.ownership,
    actorRole: swarm.actorRole,
    handoff: swarm.handoff,
    completedValidation: swarm.completedValidation,
    provenance: swarm.provenance,
    freshness: swarm.freshness,
    composition: swarm.composition,
    coordination: swarm.coordination,
    domainStatus: swarm.domainStatus,
    cost: swarm.cost,
  });
}

/** Swarm key is scoped to sessionId so groups never bleed across sessions. */
function buildSwarmKey(sessionId: string, request: BoundaryInterceptRequest): string {
  const novelty = normalizeBoundaryNoveltyState(request.novelty);
  const normalized = {
    sessionId,
    actionClass: request.actionClass,
    operation: request.operation,
    target: normalizeTarget(request),
    provenance: request.provenance ?? "agent_inference",
    flags: request.flags ?? {},
    novelty: novelty?.detected ? {
      classes: novelty.classes ?? [],
      boundaryHits: novelty.boundaryHits ?? [],
      selfOriginated: novelty.selfOriginated === true,
    } : null,
    swarm: request.swarm ? {
      action: resolveSwarmAction(request.swarm),
      actorRole: request.swarm.actorRole,
      readiness: request.swarm.readiness ?? "draft",
      intentGoal: request.swarm.intent?.goal ?? null,
      ownership: request.swarm.ownership ? {
        primaryOwner: request.swarm.ownership.primaryOwner,
        backupOwner: request.swarm.ownership.backupOwner ?? null,
        reviewer: request.swarm.ownership.reviewer ?? null,
      } : null,
      handoff: request.swarm.handoff ? {
        sender: request.swarm.handoff.sender,
        receiver: request.swarm.handoff.receiver,
        artifactId: request.swarm.handoff.artifactId,
        version: request.swarm.handoff.version,
      } : null,
      provenance: request.swarm.provenance ? {
        source: request.swarm.provenance.source,
        trust: request.swarm.provenance.trust,
        containsUnverifiedClaims: request.swarm.provenance.containsUnverifiedClaims === true,
        safeToActOn: request.swarm.provenance.safeToActOn !== false,
      } : null,
      freshness: request.swarm.freshness ? {
        staleAt: request.swarm.freshness.staleAt ?? null,
        observedAt: request.swarm.freshness.observedAt ?? null,
        maxAgeMs: request.swarm.freshness.maxAgeMs ?? null,
        invalidated: request.swarm.freshness.invalidated === true,
      } : null,
      composition: request.swarm.composition ? {
        pathId: request.swarm.composition.pathId ?? null,
        artifactVersion: request.swarm.composition.artifactVersion ?? null,
        expectedVersion: request.swarm.composition.expectedVersion ?? null,
      } : null,
      domainStatus: request.swarm.domainStatus ?? null,
    } : null,
  };
  const encoded = JSON.stringify(normalized);
  const digest = createHash("sha256").update(encoded).digest("hex").slice(0, 16);
  return `${normalized.actionClass}:${normalized.operation}:${digest}`;
}

/** Waiter with a hard timeout — never hangs forever. */
function createWaiter(timeoutMs = WAITER_TIMEOUT_MS): BoundarySwarmWaiter {
  let resolvePromise: ((resolution: BoundarySwarmResolution) => void) | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const promise = new Promise<BoundarySwarmResolution>((resolve) => {
    resolvePromise = resolve;
    timeoutHandle = setTimeout(() => {
      resolve({ kind: "deny", reason: "swarm waiter timed out — no approval received within window" });
    }, timeoutMs);
  });

  return {
    wait: async () => {
      const resolution = await promise;
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      return resolution;
    },
    settle: (resolution) => {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      resolvePromise?.(resolution);
    },
  };
}

function requestIdForGroup(group: BoundarySwarmPendingGroup): string {
  return group.requestIds[0] ?? `${group.groupId}-request`;
}

function approvalGrantShape(request: BoundaryInterceptRequest): {
  actionKind: BoundaryActionKind;
  resourceKind: BoundaryResourceKind;
  resourceValue: string;
} {
  const actionKind = mapInterceptToBoundaryAction(request);
  switch (request.actionClass) {
    case "file":
      return {
        actionKind,
        resourceKind: "path",
        resourceValue: path.resolve(request.target),
      };
    case "communication":
      return {
        actionKind,
        resourceKind: "recipient",
        resourceValue: request.target,
      };
    case "network":
      return {
        actionKind,
        resourceKind: "domain",
        resourceValue: request.target,
      };
    case "shell":
      return {
        actionKind,
        resourceKind: "tool",
        resourceValue: request.target,
      };
    case "database":
      return {
        actionKind,
        resourceKind: "database",
        resourceValue: request.target,
      };
    case "system":
      return {
        actionKind,
        resourceKind: "system",
        resourceValue: request.target,
      };
  }
}

function toBoundaryActionRequest(store: BoundaryRuntimeStore, request: BoundaryInterceptRequest, requestId: string): BoundaryActionRequest {
  return createBoundaryActionRequest({
    config: store.getConfig(),
    requestId,
    actionKind: mapInterceptToBoundaryAction(request),
    target: normalizeTarget(request),
    payloadSummary: request.payloadSummary,
    reviewContext: request.reviewContext,
    provenance: request.provenance,
    novelty: request.novelty,
    flags: request.flags,
  });
}

function buildDefaultAttemptLines(request: BoundaryActionRequest): string[] {
  const baseLine = request.actionKind === "tool.exec"
    ? `$ ${request.target}`
    : `$ ${request.actionKind} ${request.target}`;
  return request.payloadSummary ? [baseLine, `  ${request.payloadSummary}`] : [baseLine];
}

function buildSwarmApprovalPrompt(group: BoundarySwarmPendingGroup, request: BoundaryActionRequest): BoundaryApprovalPrompt {
  const context = group.representative.reviewContext;
  if (context?.surface === "chat") {
    return {
      title: context.title ?? "Standing-law review",
      question: context.question ?? group.reason,
      surface: "chat",
      lawIds: [...group.lawIds],
      userInput: context.userInput,
      attemptedOutput: context.attemptedOutput,
      invariantLawId: context.invariantLawId ?? group.lawIds[0],
      invariantLabel: context.invariantLabel ?? group.reason,
      evidence: context.evidence ?? [],
      violations: context.violations ?? [],
      options: [],
    };
  }

  return {
    title: context?.title ?? "Standing-law review",
    question: context?.question ?? group.reason,
    surface: "action",
    lawIds: [...group.lawIds],
    attemptLines: context?.attemptLines ?? buildDefaultAttemptLines(request),
    invariantLawId: context?.invariantLawId ?? group.lawIds[0],
    invariantLabel: context?.invariantLabel ?? group.reason,
    violations: context?.violations ?? [],
    options: [],
  };
}

function standingLawReason(notes: string | null | undefined, fallback: string): string {
  const trimmed = notes?.trim();
  return trimmed ? `standing-law: ${trimmed}` : fallback;
}

async function appendSwarmLedger(args: {
  store: BoundaryRuntimeStore;
  eventType: "APPROVAL_REQUESTED" | "APPROVAL_GRANTED" | "APPROVAL_DENIED";
  requestId: string;
  request: BoundaryInterceptRequest;
  reason: string;
  lawIds: string[];
  groupId: string;
  memberCount: number;
  waitingCount: number;
  actorId?: string;
  joined?: boolean;
  readiness?: BoundarySwarmReadiness;
  intent?: BoundarySwarmIntent;
  cost?: BoundarySwarmCost;
  provenance?: BoundarySwarmProvenance;
  freshness?: BoundarySwarmFreshness;
  composition?: BoundarySwarmComposition;
  coordination?: BoundarySwarmCoordinationState;
  domainStatus?: BoundarySwarmDomainStatus;
  novelty?: BoundaryNoveltyState;
}): Promise<Awaited<ReturnType<typeof appendBoundaryLedger>>> {
  const config = args.store.getConfig();
  return appendBoundaryLedger(args.eventType, {
    sessionId: config.session.sessionId,
    actorId: args.actorId ?? config.session.actorId,
    requestId: args.requestId,
    actionKind: mapInterceptToBoundaryAction(args.request),
    target: normalizeTarget(args.request),
    decision: args.eventType === "APPROVAL_GRANTED"
      ? "allow"
      : args.eventType === "APPROVAL_DENIED"
        ? "deny"
        : "require_approval",
    reason: args.reason,
    lawIds: args.lawIds,
    metadata: {
      swarm_group_id: args.groupId,
      swarm_member_count: args.memberCount,
      swarm_waiting_count: args.waitingCount,
      ...(args.joined ? { swarm_joined_existing_group: true } : {}),
      ...(args.request.swarm?.action ? { swarm_action: args.request.swarm.action } : {}),
      ...(args.request.swarm?.actorRole ? { swarm_actor_role: args.request.swarm.actorRole } : {}),
      ...(args.readiness ? { swarm_readiness: args.readiness } : {}),
      ...(args.intent ? { swarm_intent_goal: args.intent.goal } : {}),
      ...(args.request.swarm?.ownership?.primaryOwner ? { swarm_primary_owner: args.request.swarm.ownership.primaryOwner } : {}),
      ...(args.request.swarm?.handoff?.artifactId ? { swarm_handoff_artifact_id: args.request.swarm.handoff.artifactId } : {}),
      ...(args.request.swarm?.handoff?.version ? { swarm_handoff_version: args.request.swarm.handoff.version } : {}),
      ...(args.cost ? { swarm_cost_units_consumed: args.cost.unitsConsumed, swarm_cost_unit: args.cost.unit } : {}),
      ...(args.provenance ? { swarm_provenance_source: args.provenance.source, swarm_provenance_trust: args.provenance.trust } : {}),
      ...(args.freshness?.staleAt ? { swarm_freshness_stale_at: args.freshness.staleAt } : {}),
      ...(args.composition?.pathId ? { swarm_composition_path_id: args.composition.pathId } : {}),
      ...(args.coordination?.lastHeartbeatAt ? { swarm_last_heartbeat_at: args.coordination.lastHeartbeatAt } : {}),
      ...(args.domainStatus ? {
        swarm_domain_user: args.domainStatus.user ?? "unset",
        swarm_domain_security: args.domainStatus.security ?? "unset",
        swarm_domain_legal: args.domainStatus.legal ?? "unset",
        swarm_domain_product: args.domainStatus.product ?? "unset",
        swarm_domain_engineering: args.domainStatus.engineering ?? "unset",
      } : {}),
      ...(args.novelty?.detected ? { novelty_detected: true } : {}),
      ...(args.novelty?.selfOriginated ? { novelty_self_originated: true } : {}),
      ...(args.novelty?.classes?.length ? { novelty_classes: args.novelty.classes.join(",") } : {}),
      ...(args.novelty?.boundaryHits?.length ? { novelty_boundary_hits: args.novelty.boundaryHits.join(",") } : {}),
    },
    createdAt: new Date().toISOString(),
  });
}

// ─── Cost guard ───────────────────────────────────────────────────────────────

/** Returns true if the group has exceeded its cost cap. */
function isOverBudget(cost: BoundarySwarmCost | undefined): boolean {
  return findBudgetOverflow(cost) !== null;
}

function createSyntheticSwarmResult(args: {
  request: BoundaryInterceptRequest;
  decision: BoundaryInterceptDecision;
  reason: string;
  lawIds: string[];
}): BoundaryInterceptResult {
  return {
    requestId: randomUUID(),
    actionKind: mapInterceptToBoundaryAction(args.request),
    decision: args.decision,
    reason: args.reason,
    lawIds: args.lawIds,
    bodyguardMoves: [],
  };
}

// ─── Coordinator ─────────────────────────────────────────────────────────────

export type BoundarySwarmCoordinatorOptions = {
  /** Override the pending group cap (default: MAX_PENDING_GROUPS). */
  maxPendingGroups?: number;
  /** Override the waiters-per-group cap (default: MAX_WAITERS_PER_GROUP). */
  maxWaitersPerGroup?: number;
  /** Override the waiter timeout in ms (default: WAITER_TIMEOUT_MS). */
  waiterTimeoutMs?: number;
};

export function createBoundarySwarmCoordinator(
  store: BoundaryRuntimeStore,
  options: BoundarySwarmCoordinatorOptions = {},
) {
  const maxPendingGroups = options.maxPendingGroups ?? MAX_PENDING_GROUPS;
  const maxWaitersPerGroup = options.maxWaitersPerGroup ?? MAX_WAITERS_PER_GROUP;
  const waiterTimeoutMs = options.waiterTimeoutMs ?? WAITER_TIMEOUT_MS;

  const pendingGroups = new Map<string, BoundarySwarmPendingGroup>();
  const recentGroups = new Map<string, BoundarySwarmGroup>();

  function applyInterceptState(result: BoundaryInterceptResult & { admissionState?: BoundaryAdmissionState }) {
    if (!result.admissionState) {
      return;
    }
    store.replaceConfig({
      ...store.getConfig(),
      admissionState: result.admissionState,
    });
  }

  function snapshotGroup(group: BoundarySwarmPendingGroup | BoundarySwarmGroup): BoundarySwarmGroup {
    return {
      groupId: group.groupId,
      key: group.key,
      state: group.state,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      actionClass: group.actionClass,
      operation: group.operation,
      target: group.target,
      reason: group.reason,
      payloadSummary: "representative" in group ? group.representative.payloadSummary : group.payloadSummary,
      reviewContext: "representative" in group ? group.representative.reviewContext : group.reviewContext,
      lawIds: [...group.lawIds],
      bodyguardMoves: [...group.bodyguardMoves],
      memberCount: group.memberCount,
      waitingCount: group.waitingCount,
      requestIds: [...group.requestIds],
      sessionId: group.sessionId,
      path: group.path,
      pathReason: group.pathReason,
      swarmAction: group.swarmAction,
      actorRole: group.actorRole,
      readiness: group.readiness,
      intent: group.intent,
      intentLedger: group.intentLedger,
      ownership: group.ownership,
      handoff: group.handoff,
      completedValidation: group.completedValidation ? [...group.completedValidation] : undefined,
      provenance: group.provenance,
      freshness: group.freshness,
      composition: group.composition,
      coordination: group.coordination,
      domainStatus: group.domainStatus,
      cost: group.cost,
      novelty: group.novelty,
      pathCode: group.pathCode,
      yellowReason: group.yellowReason,
      purpleAction: group.purpleAction,
      definitionRequest: group.definitionRequest,
    };
  }

  function rememberRecent(group: BoundarySwarmPendingGroup) {
    recentGroups.set(group.groupId, snapshotGroup(group));
    const resolved = [...recentGroups.values()]
      .filter((entry) => entry.state !== "waiting")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    for (const stale of resolved.slice(50)) {
      recentGroups.delete(stale.groupId);
    }
  }

  function rememberImmediateResolution(
    request: BoundaryInterceptRequest,
    result: BoundaryInterceptResult,
  ) {
    const config = store.getConfig();
    const now = new Date().toISOString();
    const pathClassification = classifyRequestSwarmPath(request);
    const resolvedGroup: BoundarySwarmGroup = {
      groupId: `swarm-${randomUUID()}`,
      key: buildSwarmKey(config.session.sessionId, request),
      state: result.decision === "allow" ? "approved" : "denied",
      createdAt: now,
      updatedAt: now,
      actionClass: request.actionClass,
      operation: request.operation,
      target: normalizeTarget(request),
      reason: result.reason,
      payloadSummary: request.payloadSummary,
      reviewContext: request.reviewContext,
      lawIds: [...result.lawIds],
      bodyguardMoves: [...result.bodyguardMoves],
      memberCount: 1,
      waitingCount: 0,
      requestIds: [result.requestId],
      sessionId: config.session.sessionId,
      path: pathClassification?.path,
      pathReason: pathClassification?.reason,
      swarmAction: resolveSwarmAction(request.swarm),
      actorRole: request.swarm?.actorRole,
      readiness: request.swarm?.readiness ?? "locally_complete",
      intent: request.swarm?.intent,
      intentLedger: request.swarm?.intentLedger,
      ownership: request.swarm?.ownership,
      handoff: request.swarm?.handoff,
      completedValidation: request.swarm?.completedValidation ? [...request.swarm.completedValidation] : undefined,
      provenance: request.swarm?.provenance,
      freshness: request.swarm?.freshness,
      composition: request.swarm?.composition,
      coordination: request.swarm?.coordination,
      domainStatus: request.swarm?.domainStatus,
      cost: request.swarm?.cost,
      novelty: request.novelty,
      pathCode: pathClassification?.code,
      yellowReason: pathClassification?.yellowReason,
      purpleAction: pathClassification?.purpleAction,
      definitionRequest: pathClassification?.definitionRequest,
    };
    recentGroups.set(resolvedGroup.groupId, resolvedGroup);
    const resolved = [...recentGroups.values()]
      .filter((entry) => entry.state !== "waiting")
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    for (const stale of resolved.slice(50)) {
      recentGroups.delete(stale.groupId);
    }
  }

  function ensurePendingGroup(
    request: BoundaryInterceptRequest,
    result: BoundaryInterceptResult,
    groupOpts?: BoundarySwarmRequestMeta,
  ): { group: BoundarySwarmPendingGroup; joined: boolean } | { denied: true; reason: string } {
    const config = store.getConfig();
    const sessionId = config.session.sessionId;
    const key = buildSwarmKey(sessionId, request);
    const now = new Date().toISOString();
    const existing = pendingGroups.get(key);
    const swarm = groupOpts ?? request.swarm;
    const pathClassification = classifyRequestSwarmPath(request);

    if (existing) {
      // Cross-session join guard — key already includes sessionId so this
      // is a belt-and-suspenders check for any future key-format change.
      if (existing.sessionId !== sessionId) {
        return { denied: true, reason: "swarm group belongs to a different session" };
      }
      if (existing.waiters.size >= maxWaitersPerGroup) {
        return { denied: true, reason: `swarm group waiter cap reached (${maxWaitersPerGroup})` };
      }
      const existingBudgetOverflow = findBudgetOverflow(existing.cost);
      if (existingBudgetOverflow) {
        return {
          denied: true,
          reason: `swarm ${existingBudgetOverflow.scope} cost cap exceeded (${existingBudgetOverflow.consumed}/${existingBudgetOverflow.cap} ${existingBudgetOverflow.unit})`,
        };
      }
      existing.updatedAt = now;
      existing.memberCount += 1;
      existing.waitingCount += 1;
      existing.requestIds.push(result.requestId);
      return { group: existing, joined: true };
    }

    // New group — check pending cap before creating.
    if (pendingGroups.size >= maxPendingGroups) {
      return { denied: true, reason: `swarm pending group cap reached (${maxPendingGroups}) — request denied to prevent queue flood` };
    }

    const group: BoundarySwarmPendingGroup = {
      groupId: `swarm-${randomUUID()}`,
      key,
      state: "waiting",
      createdAt: now,
      updatedAt: now,
      actionClass: request.actionClass,
      operation: request.operation,
      target: normalizeTarget(request),
      reason: result.reason,
      lawIds: [...result.lawIds],
      bodyguardMoves: [...result.bodyguardMoves],
      memberCount: 1,
      waitingCount: 1,
      requestIds: [result.requestId],
      representative: {
        ...request,
        target: normalizeTarget(request),
      },
      waiters: new Set(),
      sessionId,
      path: pathClassification?.path,
      pathReason: pathClassification?.reason,
      swarmAction: resolveSwarmAction(swarm),
      actorRole: swarm?.actorRole,
      readiness: swarm?.readiness ?? "draft",
      intent: swarm?.intent,
      intentLedger: swarm?.intentLedger,
      ownership: swarm?.ownership,
      handoff: swarm?.handoff,
      completedValidation: swarm?.completedValidation ? [...swarm.completedValidation] : undefined,
      provenance: swarm?.provenance,
      freshness: swarm?.freshness,
      composition: swarm?.composition,
      coordination: swarm?.coordination,
      domainStatus: swarm?.domainStatus,
      cost: swarm?.cost,
      novelty: request.novelty,
      pathCode: pathClassification?.code,
      yellowReason: pathClassification?.yellowReason,
      purpleAction: pathClassification?.purpleAction,
      definitionRequest: pathClassification?.definitionRequest
        ? {
            ...pathClassification.definitionRequest,
            expiresAt: pathClassification.definitionRequest.expiresAt
              ?? new Date(Date.now() + waiterTimeoutMs).toISOString(),
          }
        : undefined,
      retryOnApproval: Boolean(request.novelty?.detected && !request.novelty.admitted),
    };
    pendingGroups.set(key, group);
    return { group, joined: false };
  }

  async function waitForResolution(
    request: BoundaryInterceptRequest,
    result: BoundaryInterceptResult,
    groupOpts?: BoundarySwarmRequestMeta,
  ): Promise<BoundaryInterceptResult> {
    const ensureResult = ensurePendingGroup(request, result, groupOpts);

    // Structural cap or session violation — deny immediately, no queue.
    if ("denied" in ensureResult) {
      return {
        ...result,
        decision: "deny",
        reason: ensureResult.reason,
      };
    }

    const { group, joined } = ensureResult;
    const waiter = createWaiter(waiterTimeoutMs);
    group.waiters.add(waiter);
    recentGroups.set(group.groupId, snapshotGroup(group));

    await appendSwarmLedger({
      store,
      eventType: "APPROVAL_REQUESTED",
      requestId: result.requestId,
      request,
      reason: joined
        ? `${result.reason} (joined existing swarm approval group)`
        : result.reason,
      lawIds: result.lawIds,
      groupId: group.groupId,
      memberCount: group.memberCount,
      waitingCount: group.waitingCount,
      joined,
      readiness: group.readiness,
      intent: group.intent,
      provenance: group.provenance,
      freshness: group.freshness,
      composition: group.composition,
      coordination: group.coordination,
      domainStatus: group.domainStatus,
      cost: group.cost,
      novelty: group.novelty,
    });

    const resolution = await waiter.wait();
    group.waiters.delete(waiter);
    group.waitingCount = Math.max(0, group.waitingCount - 1);
    group.updatedAt = new Date().toISOString();
    rememberRecent(group);

    if (resolution.kind === "deny") {
      return {
        ...result,
        decision: "deny",
        reason: resolution.reason,
      };
    }

    if (resolution.kind === "allow_once") {
      return {
        ...result,
        decision: "allow",
        reason: resolution.reason,
      };
    }

    return evaluateOrWait(resolution.request ?? request, groupOpts);
  }

  async function evaluateOrWait(
    request: BoundaryInterceptRequest,
    groupOpts?: BoundarySwarmRequestMeta,
  ): Promise<BoundaryInterceptResult> {
    const normalizedRequest = withBoundaryNovelty(withSwarmMeta(request, groupOpts));
    const swarm = normalizedRequest.swarm;

    // Cost guard — if caller tracks cost and cap is exceeded, deny before evaluation.
    const budgetOverflow = findBudgetOverflow(swarm?.cost);
    if (budgetOverflow) {
      const denyResult = createSyntheticSwarmResult({
        request: normalizedRequest,
        decision: "deny",
        reason: `swarm ${budgetOverflow.scope} cost cap exceeded (${budgetOverflow.consumed}/${budgetOverflow.cap} ${budgetOverflow.unit})`,
        lawIds: ["SWARM.COST.CAP_EXCEEDED"],
      });
      rememberImmediateResolution(normalizedRequest, denyResult);
      return denyResult;
    }

    const pathClassification = classifyRequestSwarmPath(normalizedRequest);
    if (pathClassification?.disposition === "deny") {
      const denyResult = createSyntheticSwarmResult({
        request: normalizedRequest,
        decision: "deny",
        reason: pathClassification.reason,
        lawIds: pathClassification.lawIds,
      });
      rememberImmediateResolution(normalizedRequest, denyResult);
      return denyResult;
    }
    if (pathClassification?.disposition === "queue") {
      return waitForResolution(
        normalizedRequest,
        createSyntheticSwarmResult({
          request: normalizedRequest,
          decision: "require_approval",
          reason: pathClassification.reason,
          lawIds: pathClassification.lawIds,
        }),
        swarm,
      );
    }

    await store.hydrate();
    const result = await evaluateBoundaryIntercept({
      config: enableBodyguardControl(store.getConfig()),
      request: normalizedRequest,
    });
    applyInterceptState(result);

    // Fast continuation — already lawful, no queue needed.
    if (result.decision !== "require_approval") {
      rememberImmediateResolution(normalizedRequest, result);
      return result;
    }

    return waitForResolution(normalizedRequest, result, swarm);
  }

  async function approveGroup(args: {
    groupId: string;
    issuedBy: string;
    reason?: string;
    asLaw?: boolean;
  }) {
    const group = [...pendingGroups.values()].find((entry) => entry.groupId === args.groupId);
    if (!group) {
      return null;
    }

    if (args.asLaw) {
      const grant = approvalGrantShape(group.representative);
      if (grant.resourceKind === "path") {
        await store.openPath({
          rootPath: grant.resourceValue,
          grantedActions: [grant.actionKind],
          issuedBy: args.issuedBy,
        });
      } else {
        await store.issueGrant({
          resourceKind: grant.resourceKind,
          resourceValue: grant.resourceValue,
          grantedActions: [grant.actionKind],
          issuedBy: args.issuedBy,
        });
      }
    }

    group.state = "approved";
    group.updatedAt = new Date().toISOString();
    pendingGroups.delete(group.key);

    const approveReason = args.reason ?? (args.asLaw
      ? "swarm approval granted and lawful scope updated"
      : "swarm approval granted once without changing standing law");
    const witness = await appendSwarmLedger({
      store,
      eventType: "APPROVAL_GRANTED",
      requestId: requestIdForGroup(group),
      request: group.representative,
      reason: approveReason,
      lawIds: group.lawIds,
      groupId: group.groupId,
      memberCount: group.memberCount,
      waitingCount: group.waitingCount,
      actorId: args.issuedBy,
      readiness: group.readiness,
      intent: group.intent,
      provenance: group.provenance,
      freshness: group.freshness,
      composition: group.composition,
      coordination: group.coordination,
      domainStatus: group.domainStatus,
      cost: group.cost,
      novelty: group.novelty,
    });
    const config = args.asLaw ? await store.hydrate() : store.getConfig();
    if (args.asLaw && config.upl) {
      const boundaryRequest = toBoundaryActionRequest(store, group.representative, requestIdForGroup(group));
      const nextConfig = await recordBodyguardUserLawDecision({
        config,
        request: boundaryRequest,
        witness,
        decision: { choice: "allow_as_law" },
      });
      store.replaceConfig(nextConfig);
    }

    const retryRequest = group.retryOnApproval
      ? withAdmittedBoundaryNovelty(group.representative)
      : group.representative;
    for (const waiter of group.waiters) {
      waiter.settle(
        args.asLaw || group.retryOnApproval
          ? { kind: "retry", request: retryRequest }
          : { kind: "allow_once", reason: approveReason },
      );
    }
    rememberRecent(group);
    return snapshotGroup(group);
  }

  async function denyGroup(args: {
    groupId: string;
    deniedBy: string;
    reason?: string;
    asLaw?: boolean;
  }) {
    const group = [...pendingGroups.values()].find((entry) => entry.groupId === args.groupId);
    if (!group) {
      return null;
    }

    group.state = "denied";
    group.updatedAt = new Date().toISOString();
    pendingGroups.delete(group.key);

    const denyReason = args.reason ?? "swarm approval denied";
    const witness = await appendSwarmLedger({
      store,
      eventType: "APPROVAL_DENIED",
      requestId: requestIdForGroup(group),
      request: group.representative,
      reason: denyReason,
      lawIds: group.lawIds,
      groupId: group.groupId,
      memberCount: group.memberCount,
      waitingCount: group.waitingCount,
      actorId: args.deniedBy,
      readiness: group.readiness,
      intent: group.intent,
      provenance: group.provenance,
      freshness: group.freshness,
      composition: group.composition,
      coordination: group.coordination,
      domainStatus: group.domainStatus,
      cost: group.cost,
      novelty: group.novelty,
    });
    const config = args.asLaw ? await store.hydrate() : store.getConfig();
    if (args.asLaw && config.upl) {
      const boundaryRequest = toBoundaryActionRequest(store, group.representative, requestIdForGroup(group));
      const nextConfig = await recordBodyguardUserLawDecision({
        config,
        request: boundaryRequest,
        witness,
        decision: { choice: "deny_as_law" },
      });
      store.replaceConfig(nextConfig);
    }

    for (const waiter of group.waiters) {
      waiter.settle({ kind: "deny", reason: denyReason });
    }
    rememberRecent(group);
    return snapshotGroup(group);
  }

  function listGroups() {
    const groups = [
      ...pendingGroups.values(),
      ...[...recentGroups.values()].filter((entry) => !pendingGroups.has(entry.key)),
    ]
      .map((group) => snapshotGroup(group))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    return {
      groups,
      totals: {
        pending: groups.filter((entry) => entry.state === "waiting").length,
        waitingMembers: groups
          .filter((entry) => entry.state === "waiting")
          .reduce((sum, entry) => sum + entry.waitingCount, 0),
        tracked: groups.length,
      },
    };
  }

  /** Resolve waiting groups against the UPL with bounded concurrency.
   *  Groups are processed in batches of MAX_CONCURRENT_UPL_RESOLVE so a
   *  large pending queue does not saturate the approval handler. */
  async function resolveWaitingGroupsFromUpl(args: {
    actorId: string;
    getLedger?: () => Promise<BoundaryUserPathLedger>;
  }): Promise<number> {
    const handler = createBoundaryHeadlessApprovalHandler({
      mode: "follow_upl",
      getLedger: args.getLedger ?? (() => loadUserPathLedger()),
    });
    const groups = [...pendingGroups.values()].filter(
      (group) => group.state === "waiting" && group.waitingCount > 0,
    );
    let resolved = 0;

    // Process in bounded batches — no whole-queue flood.
    for (let i = 0; i < groups.length; i += MAX_CONCURRENT_UPL_RESOLVE) {
      const batch = groups.slice(i, i + MAX_CONCURRENT_UPL_RESOLVE);
      await Promise.all(batch.map(async (group) => {
        if (!pendingGroups.has(group.key)) {
          return;
        }

        const approvalRequest = toBoundaryActionRequest(store, group.representative, requestIdForGroup(group));
        const rawDecision = await handler({
          session: store.getConfig().session,
          request: approvalRequest,
          reason: group.reason,
          lawIds: [...group.lawIds],
          bodyguardMoves: [...group.bodyguardMoves],
          prompt: buildSwarmApprovalPrompt(group, approvalRequest),
        });
        const decision = typeof rawDecision === "boolean"
          ? { choice: rawDecision ? "allow_once" as const : "deny_once" as const, notes: null }
          : "approved" in rawDecision
            ? {
                choice: rawDecision.approved ? "allow_once" as const : "deny_once" as const,
                notes: rawDecision.notes,
              }
            : rawDecision;

        const allowed = decision.choice === "allow_once" || decision.choice === "allow_as_law";
        if (allowed) {
          const approved = await approveGroup({
            groupId: group.groupId,
            issuedBy: args.actorId,
            reason: standingLawReason(decision.notes, "standing-law: existing UPL law allowed this request"),
            asLaw: false,
          });
          if (approved) {
            resolved += 1;
          }
          return;
        }

        const denied = await denyGroup({
          groupId: group.groupId,
          deniedBy: args.actorId,
          reason: standingLawReason(decision.notes, "standing-law: no standing UPL law matched this request"),
          asLaw: false,
        });
        if (denied) {
          resolved += 1;
        }
      }));
    }

    return resolved;
  }

  return {
    evaluateOrWait,
    approveGroup,
    denyGroup,
    listGroups,
    resolveWaitingGroupsFromUpl,
    rememberResolution: rememberImmediateResolution,
  };
}
