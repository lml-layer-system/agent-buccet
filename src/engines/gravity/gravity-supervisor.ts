import { createBoundaryGravityAttachment } from "./gravity.ts";
import type { BoundaryGravityResult } from "./gravity.ts";
import type { BoundaryToolProposal } from "./../../boundaries/bodyguard.ts";
import type { BoundaryApprovalHandler } from "./../../runtime/types.ts";
import type { BoundaryRuntimeStore } from "./../../runtime/store.ts";

export type BoundaryGravitySupervisorOptions = {
  store: BoundaryRuntimeStore;
  approvalHandler?: BoundaryApprovalHandler;
  heartbeatIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  maxRestarts?: number;
  onHeartbeat?: (heartbeat: {
    sessionId: string;
    lastEventType: string;
    lastDecision: "allow" | "null";
    emittedAt: string;
  }) => Promise<void> | void;
  onPanic?: (error: unknown) => Promise<void> | void;
};

export type BoundaryGravitySupervisorStatus = {
  running: boolean;
  restartCount: number;
  lastHeartbeatAt?: string;
  lastDecision?: "allow" | "null";
  lastError?: string;
  lastRestartReason?: string;
};

export function createBoundaryGravitySupervisor(options: BoundaryGravitySupervisorOptions) {
  const maxRestarts = options.maxRestarts ?? 5;

  let stopping = false;
  let restartCount = 0;
  let attachment = createAttachment();
  let loopPromise: Promise<void> | null = null;
  let lastHeartbeatAt = "";
  let lastDecision: "allow" | "null" | undefined;
  let lastError = "";
  let lastRestartReason = "";

  function createAttachment() {
    return createBoundaryGravityAttachment({
      store: options.store,
      approvalHandler: options.approvalHandler,
      emitHeartbeat: async (heartbeat) => {
        lastHeartbeatAt = heartbeat.emittedAt;
        lastDecision = heartbeat.lastDecision;
        await options.onHeartbeat?.({
          sessionId: options.store.getConfig().session.sessionId,
          lastEventType: "gravity",
          lastDecision: heartbeat.lastDecision,
          emittedAt: heartbeat.emittedAt,
        });
      },
      emitPanic: async (error) => {
        lastError = error instanceof Error ? error.message : String(error);
        await options.onPanic?.(error);
      },
    });
  }

  async function restart(reason: string) {
    if (stopping) {
      return;
    }
    lastError = reason;
    lastRestartReason = reason;
    restartCount += 1;
    if (restartCount > maxRestarts) {
      stopping = true;
      throw new Error(`gravity supervisor exceeded max restarts: ${reason}`);
    }

    if (loopPromise) {
      await attachment.shutdown().catch(() => undefined);
      await loopPromise.catch(() => undefined);
    }
    attachment = createAttachment();
    loopPromise = null;
    startLoop();
  }

  function startLoop() {
    if (loopPromise) {
      return;
    }

    loopPromise = attachment.start().catch(async (error) => {
      if (stopping) {
        return;
      }
      await restart(error instanceof Error ? error.message : "gravity loop crashed");
    });
  }

  async function runWithRestart<T>(reason: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      await restart(error instanceof Error ? error.message : reason);
      throw error;
    }
  }

  return {
    async start() {
      stopping = false;
      startLoop();
    },
    async stop() {
      stopping = true;
      await attachment.shutdown();
      await loopPromise;
      loopPromise = null;
    },
    async restart(reason = "manual supervisor restart") {
      await restart(reason);
    },
    submitProposal<T>(proposal: BoundaryToolProposal<T>): Promise<BoundaryGravityResult<T>> {
      return runWithRestart("gravity proposal failed", () => attachment.submitProposal(proposal));
    },
    auditSession: () => runWithRestart("gravity audit failed", () => attachment.auditSession()),
    expireGrants: (nowIso?: string) =>
      runWithRestart("gravity grant expiry failed", () => attachment.expireGrants(nowIso)),
    getStatus(): BoundaryGravitySupervisorStatus {
      return {
        running: !stopping && loopPromise !== null,
        restartCount,
        lastHeartbeatAt: lastHeartbeatAt || undefined,
        lastDecision,
        lastError: lastError || undefined,
        lastRestartReason: lastRestartReason || undefined,
      };
    },
  };
}
