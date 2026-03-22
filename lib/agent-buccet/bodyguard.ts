import { createApprovalQueueAdapter } from "./approval.ts";
import { createBoundaryGravityService } from "./gravity-adapter/gravity-service.ts";
import {
  enforceBoundaryProposal,
  wrapBoundaryTool,
  type BoundaryToolEnvelope,
  type BoundaryToolProposal,
} from "./adapters.ts";
import type { BoundaryExecutionResult } from "./bodyguard-engine.ts";
export { createBoundaryActionRequest, executeBoundaryControlledAction } from "./bodyguard-engine.ts";
export type { BoundaryExecutionResult } from "./bodyguard-engine.ts";
import { createBoundaryGravityAttachment } from "./gravity.ts";
import type { BoundaryRuntimeStore } from "./store.ts";
import { buildTelegramBoundaryProposal } from "./integrations/telegram.ts";

export * from "./bodyguard-core.ts";

/**
 * Creates the primary boundary enforcement surface for an agent session.
 *
 * `createBoundaryBodyguard` is the main integration point for agent frameworks.
 * It wires together the runtime store, approval queue, and gravity service into
 * a single object with enforcement methods for each supported framework.
 *
 * The bodyguard is **stateful** — every enforcement call that results in a
 * grant or UPL update automatically persists the updated config back to the
 * store. Callers do not need to manage config mutations manually.
 *
 * @param store - A persistent runtime store created via
 *   `createPersistentBoundaryRuntimeStore` or `restoreBoundaryRuntimeStore`.
 * @returns The bodyguard object with per-framework integration surfaces.
 *
 * @example
 * ```typescript
 * const store = await createPersistentBoundaryRuntimeStore({
 *   sessionId: "my-session",
 *   actorId: "user:alice",
 * });
 * await store.openPath({ rootPath: "/tmp/workspace", grantedActions: ["fs.write"], issuedBy: "user:alice" });
 *
 * const bodyguard = createBoundaryBodyguard(store);
 *
 * // Wrap any tool — enforcement is automatic
 * const safeWrite = bodyguard.wrapTool({
 *   toolName: "write_file",
 *   actionKind: "fs.write",
 *   describeTarget: (input: { path: string }) => input.path,
 *   execute: async ({ path, content }) => fs.writeFile(path, content),
 * });
 *
 * const result = await safeWrite({ path: "/tmp/workspace/out.txt", content: "hello" });
 * result.allowed   // true if admitted, false if blocked
 * result.executed  // true if the execute fn actually ran
 * ```
 *
 * @see {@link https://github.com/lml-layer-system/agent-buccet/blob/main/docs/agent-boundary/INTEGRATIONS.md}
 */
export function createBoundaryBodyguard(store: BoundaryRuntimeStore) {
  const approvals = createApprovalQueueAdapter();
  const gravityService = createBoundaryGravityService();

  function getGuardedConfig() {
    return {
      ...store.getConfig(),
      approvalHandler: approvals.handler,
      gravityService,
    };
  }

  async function enforceProposal<T>(proposal: BoundaryToolProposal<T>): Promise<BoundaryExecutionResult<T>> {
    const result = await enforceBoundaryProposal({
      config: getGuardedConfig(),
      proposal,
    });
    store.replaceConfig(result.config);
    return result;
  }

  function wrapTool<TInput, TOutput>(envelope: BoundaryToolEnvelope<TInput, TOutput>) {
    return async (input: TInput) => {
      const result = await wrapBoundaryTool(getGuardedConfig(), envelope)(input);
      store.replaceConfig(result.config);
      return result;
    };
  }

  const gravity = createBoundaryGravityAttachment({
    store,
    approvalHandler: approvals.handler,
  });

  return {
    store,
    approvals,
    gravity,
    enforceProposal,
    wrapTool,
    nemo: {
      enforceProposal,
      wrapTool,
    },
    openaiAgents: {
      enforceProposal,
      wrapTool,
    },
    langgraph: {
      enforceProposal,
      wrapNode: wrapTool,
    },
    telegram: {
      buildProposal: buildTelegramBoundaryProposal,
      enforceProposal,
      approvals,
    },
  };
}
