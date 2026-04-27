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

// ─── Path classification ──────────────────────────────────────────────────────

/** Instant routing decision for every contact.
 *  Green = act now. Yellow = speculative/review. Red = reject. Purple = intent underspecified. */
export type BoundarySwarmPath = "green" | "yellow" | "red" | "purple";

export type BoundarySwarmPathClassification = {
  path: BoundarySwarmPath;
  disposition: "continue" | "queue" | "deny";
  reason: string;
  lawIds: string[];
};

/** Classify a contact against readiness and intent.
 *  This is the instant routing layer — no waiting, no negotiation. */
export function classifySwarmPath(args: {
  action?: string;
  readiness: BoundarySwarmReadiness;
  intent?: BoundarySwarmIntent;
  ownership?: BoundarySwarmOwnership;
  actorRole?: string;
  handoff?: BoundarySwarmHandoff;
  completedValidation?: string[];
}): BoundarySwarmPathClassification {
  const action = args.action?.trim();

  if (!action) {
    return {
      path: "purple",
      disposition: "queue",
      reason: "swarm action is underspecified — receiver cannot determine the next lawful continuation",
      lawIds: ["SWARM.ACTION.UNSPECIFIED"],
    };
  }

  // Purple — intent is present but goal is empty or underspecified.
  if (args.intent !== undefined && !args.intent.goal.trim()) {
    return {
      path: "purple",
      disposition: "queue",
      reason: "intent is present but goal is underspecified — human clarification required",
      lawIds: ["SWARM.INTENT.UNDERSPECIFIED"],
    };
  }

  // Purple — ownership exists but the current agent role is missing.
  if (args.ownership !== undefined && !(args.actorRole?.trim())) {
    return {
      path: "purple",
      disposition: "queue",
      reason: "ownership is defined but the acting agent role is missing — the next lawful owner cannot be proven",
      lawIds: ["SWARM.OWNERSHIP.UNDECLARED"],
    };
  }

  if (args.handoff?.expiresAt) {
    const expiresAt = Date.parse(args.handoff.expiresAt);
    if (!Number.isNaN(expiresAt) && expiresAt <= Date.now()) {
      return {
        path: "red",
        disposition: "deny",
        reason: `handoff '${args.handoff.artifactId}' is stale — expiration ${args.handoff.expiresAt} has passed`,
        lawIds: ["SWARM.HANDOFF.STALE"],
      };
    }
  }

  if (args.handoff?.forbiddenUse?.some((forbidden) => forbidden === action)) {
    return {
      path: "red",
      disposition: "deny",
      reason: `handoff '${args.handoff.artifactId}' forbids action '${action}'`,
      lawIds: ["SWARM.HANDOFF.FORBIDDEN_USE"],
    };
  }

  if (args.handoff?.allowedUse?.length && !args.handoff.allowedUse.includes(action)) {
    return {
      path: "red",
      disposition: "deny",
      reason: `handoff '${args.handoff.artifactId}' does not allow action '${action}'`,
      lawIds: ["SWARM.HANDOFF.ALLOWED_USE_MISMATCH"],
    };
  }

  if (args.handoff?.receiver && args.actorRole?.trim() && args.handoff.receiver !== args.actorRole.trim()) {
    return {
      path: "red",
      disposition: "deny",
      reason: `handoff receiver '${args.handoff.receiver}' does not match acting role '${args.actorRole.trim()}'`,
      lawIds: ["SWARM.HANDOFF.RECEIVER_MISMATCH"],
    };
  }

  if (args.ownership && args.actorRole?.trim()) {
    const actorRole = args.actorRole.trim();
    const allowedRoles = [
      args.ownership.primaryOwner,
      args.ownership.backupOwner,
      args.ownership.reviewer,
    ].filter((value): value is string => Boolean(value?.trim()));
    if (allowedRoles.length > 0 && !allowedRoles.includes(actorRole)) {
      return {
        path: "red",
        disposition: "deny",
        reason: `acting role '${actorRole}' is outside the declared ownership path (${allowedRoles.join(", ")})`,
        lawIds: ["SWARM.OWNERSHIP.DENIED"],
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
    };
  }

  // Red — action not permitted at this readiness tier.
  if (!isActionPermittedAtReadiness(action, args.readiness)) {
    return {
      path: "red",
      disposition: "deny",
      reason: `action '${action}' is not permitted at readiness tier '${args.readiness}' — allowed: ${READINESS_PERMITTED_ACTIONS[args.readiness].join(", ")}`,
      lawIds: ["SWARM.READINESS.DENIED"],
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
    };
  }

  // Yellow — permitted but intent is absent (unknown goal alignment).
  if (!args.intent) {
    return {
      path: "yellow",
      disposition: "continue",
      reason: "action is locally permitted but no intent is set — proceed speculatively",
      lawIds: ["SWARM.INTENT.MISSING"],
    };
  }

  // Green — permitted and intent is defined.
  return {
    path: "green",
    disposition: "continue",
    reason: `action '${action}' is permitted at readiness '${args.readiness}' and aligns with intent: ${args.intent.goal}`,
    lawIds: ["SWARM.PATH.GREEN"],
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

// ─── Cost ─────────────────────────────────────────────────────────────────────

/** Per-agent cost tracking. Keeps the swarm accountable to a budget. */
export type BoundarySwarmCost = {
  /** Token or compute units consumed by this agent/group so far. */
  unitsConsumed: number;
  /** Hard ceiling — group is denied if exceeded. */
  unitCap?: number;
  /** Arbitrary cost label (e.g. "tokens", "usd-cents", "api-calls"). */
  unit: string;
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
  /** Cost tracking for the agent(s) in this group. */
  cost?: BoundarySwarmCost;
  /** Novelty classification attached to this group. */
  novelty?: BoundaryNoveltyState;
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
    };
  }

  return {
    path: "purple",
    disposition: "queue",
    reason,
    lawIds: noveltyLawIds(novelty),
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
    readiness: swarm.readiness ?? "draft",
    intent: swarm.intent,
    ownership: swarm.ownership,
    actorRole: swarm.actorRole,
    handoff: swarm.handoff,
    completedValidation: swarm.completedValidation,
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
    } : null,
  };
  const encoded = JSON.stringify(normalized);
  const digest = createHash("sha256").update(encoded).digest("hex").slice(0, 16);
  return `${normalized.actionClass}:${normalized.operation}:${digest}`;
}

/** Waiter with a hard timeout — never hangs forever. */
function createWaiter(): BoundarySwarmWaiter {
  let resolvePromise: ((resolution: BoundarySwarmResolution) => void) | null = null;
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const promise = new Promise<BoundarySwarmResolution>((resolve) => {
    resolvePromise = resolve;
    timeoutHandle = setTimeout(() => {
      resolve({ kind: "deny", reason: "swarm waiter timed out — no approval received within window" });
    }, WAITER_TIMEOUT_MS);
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
  if (!cost || cost.unitCap === undefined) return false;
  return cost.unitsConsumed >= cost.unitCap;
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
      cost: group.cost,
      novelty: group.novelty,
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
      cost: request.swarm?.cost,
      novelty: request.novelty,
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
      if (isOverBudget(existing.cost)) {
        return { denied: true, reason: `swarm group cost cap exceeded (${existing.cost?.unitsConsumed} ${existing.cost?.unit})` };
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
      cost: swarm?.cost,
      novelty: request.novelty,
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
    const waiter = createWaiter();
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
    if (swarm?.cost && isOverBudget(swarm.cost)) {
      const denyResult = createSyntheticSwarmResult({
        request: normalizedRequest,
        decision: "deny",
        reason: `agent cost cap exceeded (${swarm.cost.unitsConsumed} ${swarm.cost.unit})`,
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
