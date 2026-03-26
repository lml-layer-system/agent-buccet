import { createHash, randomUUID } from "node:crypto";
import { enableBodyguardControl, recordBodyguardUserLawDecision } from "./bodyguard.ts";
import path from "node:path";
import { evaluateBoundaryIntercept, mapInterceptToBoundaryAction, type BoundaryInterceptRequest, type BoundaryInterceptResult } from "./intercept.ts";
import { appendBoundaryLedger } from "./ledger.ts";
import type {
  BoundaryActionKind,
  BoundaryAdmissionState,
  BoundaryActionRequest,
  BoundaryResourceKind,
  BodyguardMove,
} from "./types.ts";
import type { BoundaryRuntimeStore } from "./store.ts";

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
  lawIds: string[];
  bodyguardMoves: BodyguardMove[];
  memberCount: number;
  waitingCount: number;
  requestIds: string[];
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

function normalizeTarget(request: BoundaryInterceptRequest): string {
  if (request.actionClass === "file") {
    return path.resolve(request.target);
  }
  return request.target.trim();
}

function buildSwarmKey(request: BoundaryInterceptRequest): string {
  const normalized = {
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

function createWaiter(): BoundarySwarmWaiter {
  let resolvePromise: ((resolution: BoundarySwarmResolution) => void) | null = null;
  const promise = new Promise<BoundarySwarmResolution>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    wait: async () => promise,
    settle: (resolution) => {
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
    requestedAt: new Date().toISOString(),
    provenance: request.provenance ?? "agent_inference",
    flags: request.flags,
  };
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
    },
    createdAt: new Date().toISOString(),
  });
}

export function createBoundarySwarmCoordinator(store: BoundaryRuntimeStore) {
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
      lawIds: [...group.lawIds],
      bodyguardMoves: [...group.bodyguardMoves],
      memberCount: group.memberCount,
      waitingCount: group.waitingCount,
      requestIds: [...group.requestIds],
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

  function ensurePendingGroup(request: BoundaryInterceptRequest, result: BoundaryInterceptResult) {
    const key = buildSwarmKey(request);
    const now = new Date().toISOString();
    const existing = pendingGroups.get(key);
    if (existing) {
      existing.updatedAt = now;
      existing.memberCount += 1;
      existing.waitingCount += 1;
      existing.requestIds.push(result.requestId);
      return {
        group: existing,
        joined: true,
      };
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
    };
    pendingGroups.set(key, group);
    return {
      group,
      joined: false,
    };
  }

  async function waitForResolution(request: BoundaryInterceptRequest, result: BoundaryInterceptResult): Promise<BoundaryInterceptResult> {
    const { group, joined } = ensurePendingGroup(request, result);
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

    return evaluateOrWait(request);
  }

  async function evaluateOrWait(request: BoundaryInterceptRequest): Promise<BoundaryInterceptResult> {
    const result = await evaluateBoundaryIntercept({
      config: enableBodyguardControl(store.getConfig()),
      request,
    });
    applyInterceptState(result);
    if (result.decision !== "require_approval") {
      return result;
    }
    return waitForResolution(request, result);
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
    });
    const config = store.getConfig();
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
    });
    const config = store.getConfig();
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

  return {
    evaluateOrWait,
    approveGroup,
    denyGroup,
    listGroups,
  };
}
