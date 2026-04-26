import { createHash, randomUUID } from "node:crypto";
import { enableBodyguardControl, recordBodyguardUserLawDecision } from "./bodyguard.ts";
import { createBoundaryHeadlessApprovalHandler } from "./headless.ts";
import path from "node:path";
import { evaluateBoundaryIntercept, mapInterceptToBoundaryAction, type BoundaryInterceptRequest, type BoundaryInterceptResult } from "./intercept.ts";
import { appendBoundaryLedger } from "./ledger.ts";
import type {
  BoundaryActionKind,
  BoundaryAdmissionState,
  BoundaryApprovalPrompt,
  BoundaryActionRequest,
  BoundaryResourceKind,
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

// ─── Intent ───────────────────────────────────────────────────────────────────

/** The human-desired result that governs this swarm group.
 *  Every continuation must remain on Path(intent). */
export type BoundarySwarmIntent = {
  /** One-sentence goal — what must be true at the end. */
  goal: string;
  /** Required conditions that cannot be traded away. */
  mustHave?: string[];
  /** Outcomes that are forbidden regardless of local validity. */
  mustNotHave?: string[];
  /** How we know it worked. */
  successCondition?: string;
  /** When the human must be consulted rather than the swarm deciding. */
  escalationCondition?: string;
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
  /** Readiness of the artifact this group is acting on or producing. */
  readiness: BoundarySwarmReadiness;
  /** Human-desired result this group is serving. */
  intent?: BoundarySwarmIntent;
  /** Cost tracking for the agent(s) in this group. */
  cost?: BoundarySwarmCost;
};

type BoundarySwarmResolution =
  | { kind: "retry" }
  | { kind: "allow_once"; reason: string }
  | { kind: "deny"; reason: string };

type BoundarySwarmWaiter = {
  wait(): Promise<BoundarySwarmResolution>;
  settle(resolution: BoundarySwarmResolution): void;
};

type BoundarySwarmPendingGroup = BoundarySwarmGroup & {
  representative: BoundaryInterceptRequest;
  waiters: Set<BoundarySwarmWaiter>;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeTarget(request: BoundaryInterceptRequest): string {
  if (request.actionClass === "file") {
    return path.resolve(request.target);
  }
  return request.target.trim();
}

/** Swarm key is scoped to sessionId so groups never bleed across sessions. */
function buildSwarmKey(sessionId: string, request: BoundaryInterceptRequest): string {
  const normalized = {
    sessionId,
    actionClass: request.actionClass,
    operation: request.operation,
    target: normalizeTarget(request),
    provenance: request.provenance ?? "agent_inference",
    flags: request.flags ?? {},
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
  const config = store.getConfig();
  return {
    requestId,
    sessionId: config.session.sessionId,
    actionKind: mapInterceptToBoundaryAction(request),
    target: normalizeTarget(request),
    payloadSummary: request.payloadSummary,
    reviewContext: request.reviewContext,
    requestedAt: new Date().toISOString(),
    provenance: request.provenance ?? "agent_inference",
    flags: request.flags,
  };
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
      ...(args.readiness ? { swarm_readiness: args.readiness } : {}),
      ...(args.intent ? { swarm_intent_goal: args.intent.goal } : {}),
      ...(args.cost ? { swarm_cost_units_consumed: args.cost.unitsConsumed, swarm_cost_unit: args.cost.unit } : {}),
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
      readiness: group.readiness,
      intent: group.intent,
      cost: group.cost,
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
      readiness: "locally_complete",
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
    groupOpts?: { readiness?: BoundarySwarmReadiness; intent?: BoundarySwarmIntent; cost?: BoundarySwarmCost },
  ): { group: BoundarySwarmPendingGroup; joined: boolean } | { denied: true; reason: string } {
    const config = store.getConfig();
    const sessionId = config.session.sessionId;
    const key = buildSwarmKey(sessionId, request);
    const now = new Date().toISOString();
    const existing = pendingGroups.get(key);

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
      readiness: groupOpts?.readiness ?? "draft",
      intent: groupOpts?.intent,
      cost: groupOpts?.cost,
    };
    pendingGroups.set(key, group);
    return { group, joined: false };
  }

  async function waitForResolution(
    request: BoundaryInterceptRequest,
    result: BoundaryInterceptResult,
    groupOpts?: { readiness?: BoundarySwarmReadiness; intent?: BoundarySwarmIntent; cost?: BoundarySwarmCost },
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

    return evaluateOrWait(request, groupOpts);
  }

  async function evaluateOrWait(
    request: BoundaryInterceptRequest,
    groupOpts?: { readiness?: BoundarySwarmReadiness; intent?: BoundarySwarmIntent; cost?: BoundarySwarmCost },
  ): Promise<BoundaryInterceptResult> {
    // Cost guard — if caller tracks cost and cap is exceeded, deny before evaluation.
    if (groupOpts?.cost && isOverBudget(groupOpts.cost)) {
      const config = store.getConfig();
      const denyResult: BoundaryInterceptResult = {
        requestId: randomUUID(),
        actionKind: mapInterceptToBoundaryAction(request),
        decision: "deny",
        reason: `agent cost cap exceeded (${groupOpts.cost.unitsConsumed} ${groupOpts.cost.unit})`,
        lawIds: [],
        bodyguardMoves: [],
      };
      rememberImmediateResolution(request, denyResult);
      return denyResult;
    }

    await store.hydrate();
    const result = await evaluateBoundaryIntercept({
      config: enableBodyguardControl(store.getConfig()),
      request,
    });
    applyInterceptState(result);

    // Fast continuation — already lawful, no queue needed.
    if (result.decision !== "require_approval") {
      rememberImmediateResolution(request, result);
      return result;
    }

    return waitForResolution(request, result, groupOpts);
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

    for (const waiter of group.waiters) {
      waiter.settle(args.asLaw
        ? { kind: "retry" }
        : { kind: "allow_once", reason: approveReason });
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
