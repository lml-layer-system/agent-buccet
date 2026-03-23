import { enableBodyguardControl } from "./bodyguard.ts";
import {
  enforceBoundaryProposal,
  type BoundaryToolProposal,
} from "./bodyguard.ts";
import { auditBoundarySessionLedger } from "./ledger-audit.ts";
import type { BoundaryApprovalHandler } from "./types.ts";
import type { BoundaryRuntimeStore } from "./store.ts";

export type BoundaryGravityDecision = "allow" | "null";

export type BoundaryGravityResult<T = unknown> = {
  decision: BoundaryGravityDecision;
  executed: boolean;
  requiresApproval: boolean;
  reason: string;
  nslMoves: Awaited<ReturnType<typeof enforceBoundaryProposal<T>>>["nslMoves"];
  value?: T;
};

export type BoundaryGravityEvent =
  | {
      type: "proposal";
      proposal: BoundaryToolProposal<unknown>;
      resolve: (result: BoundaryGravityResult<unknown>) => void;
      reject: (error: unknown) => void;
    }
  | {
      type: "expire_grants";
      nowIso?: string;
      resolve: () => void;
      reject: (error: unknown) => void;
    }
  | {
      type: "audit_session";
      resolve: (result: { decision: BoundaryGravityDecision; reason: string }) => void;
      reject: (error: unknown) => void;
    }
  | {
      type: "shutdown";
      resolve: () => void;
      reject: (error: unknown) => void;
    };

export type BoundaryGravityHeartbeat = {
  sessionId: string;
  lastEventType: BoundaryGravityEvent["type"];
  lastDecision: BoundaryGravityDecision;
  emittedAt: string;
};

export type BoundaryGravityDeps = {
  loadState: () => Promise<BoundaryRuntimeStore>;
  nextEvent: () => Promise<BoundaryGravityEvent>;
  approvalHandler?: BoundaryApprovalHandler;
  emitHeartbeat?: (heartbeat: BoundaryGravityHeartbeat) => Promise<void> | void;
  emitPanic?: (error: unknown) => Promise<void> | void;
};

export type BoundaryGravityQueue = {
  nextEvent: () => Promise<BoundaryGravityEvent>;
  submitProposal: <T>(proposal: BoundaryToolProposal<T>) => Promise<BoundaryGravityResult<T>>;
  expireGrants: (nowIso?: string) => Promise<void>;
  auditSession: () => Promise<{ decision: BoundaryGravityDecision; reason: string }>;
  shutdown: () => Promise<void>;
};

function createAsyncEventQueue() {
  const pendingEvents: BoundaryGravityEvent[] = [];
  const waiters: Array<(event: BoundaryGravityEvent) => void> = [];

  function enqueue(event: BoundaryGravityEvent) {
    const waiter = waiters.shift();
    if (waiter) {
      waiter(event);
      return;
    }
    pendingEvents.push(event);
  }

  async function nextEvent(): Promise<BoundaryGravityEvent> {
    const existing = pendingEvents.shift();
    if (existing) {
      return existing;
    }
    return new Promise<BoundaryGravityEvent>((resolve) => {
      waiters.push(resolve);
    });
  }

  return { enqueue, nextEvent };
}

export function createBoundaryGravityQueue(): BoundaryGravityQueue {
  const queue = createAsyncEventQueue();

  return {
    nextEvent: queue.nextEvent,
    submitProposal: <T>(proposal: BoundaryToolProposal<T>) =>
      new Promise<BoundaryGravityResult<T>>((resolve, reject) => {
        queue.enqueue({
          type: "proposal",
          proposal,
          resolve: resolve as (result: BoundaryGravityResult<unknown>) => void,
          reject,
        });
      }),
    expireGrants: (nowIso?: string) =>
      new Promise<void>((resolve, reject) => {
        queue.enqueue({
          type: "expire_grants",
          nowIso,
          resolve,
          reject,
        });
      }),
    auditSession: () =>
      new Promise<{ decision: BoundaryGravityDecision; reason: string }>((resolve, reject) => {
        queue.enqueue({
          type: "audit_session",
          resolve,
          reject,
        });
      }),
    shutdown: () =>
      new Promise<void>((resolve, reject) => {
        queue.enqueue({
          type: "shutdown",
          resolve,
          reject,
        });
      }),
  };
}

export async function runBoundaryGravityLoop(deps: BoundaryGravityDeps): Promise<void> {
  let store: BoundaryRuntimeStore;
  try {
    store = await deps.loadState();
  } catch (error) {
    await deps.emitPanic?.(error);
    throw error;
  }

  while (true) {
    const event = await deps.nextEvent();
    try {
      if (event.type === "shutdown") {
        await store.persist();
        event.resolve();
        return;
      }

      if (event.type === "expire_grants") {
        await store.expireGrants(event.nowIso);
        await store.persist();
        await deps.emitHeartbeat?.({
          sessionId: store.getConfig().session.sessionId,
          lastEventType: event.type,
          lastDecision: "allow",
          emittedAt: new Date().toISOString(),
        });
        event.resolve();
        continue;
      }

      if (event.type === "audit_session") {
        const audit = await auditBoundarySessionLedger(store.getConfig().session.sessionId);
        const decision: BoundaryGravityDecision = audit.status === "complete" ? "allow" : "null";
        await deps.emitHeartbeat?.({
          sessionId: store.getConfig().session.sessionId,
          lastEventType: event.type,
          lastDecision: decision,
          emittedAt: new Date().toISOString(),
        });
        event.resolve({
          decision,
          reason: audit.reason,
        });
        continue;
      }

      const result = await enforceBoundaryProposal({
        config: enableBodyguardControl(store.getConfig(), {
          approvalHandler: deps.approvalHandler,
        }),
        proposal: event.proposal,
      });

      const decision: BoundaryGravityDecision = result.allowed ? "allow" : "null";
      store.replaceConfig(result.config);
      await store.persist();
      await deps.emitHeartbeat?.({
        sessionId: store.getConfig().session.sessionId,
        lastEventType: event.type,
        lastDecision: decision,
        emittedAt: new Date().toISOString(),
      });
      event.resolve({
        decision,
        executed: result.executed,
        requiresApproval: result.requiresApproval,
        reason: result.reason,
        nslMoves: result.nslMoves,
        value: result.value,
      });
    } catch (error) {
      await deps.emitPanic?.(error);
      event.reject(error);
    }
  }
}

export function createBoundaryGravityAttachment(args: {
  store: BoundaryRuntimeStore;
  approvalHandler?: BoundaryApprovalHandler;
  emitHeartbeat?: BoundaryGravityDeps["emitHeartbeat"];
  emitPanic?: BoundaryGravityDeps["emitPanic"];
}) {
  const queue = createBoundaryGravityQueue();
  let running: Promise<void> | null = null;

  return {
    start: () => {
      if (!running) {
        running = runBoundaryGravityLoop({
          loadState: async () => args.store,
          nextEvent: queue.nextEvent,
          approvalHandler: args.approvalHandler,
          emitHeartbeat: args.emitHeartbeat,
          emitPanic: args.emitPanic,
        });
      }
      return running;
    },
    submitProposal: queue.submitProposal,
    expireGrants: queue.expireGrants,
    auditSession: queue.auditSession,
    shutdown: queue.shutdown,
  };
}
