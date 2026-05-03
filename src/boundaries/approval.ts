import type {
  BoundaryApprovalChoice,
  BoundaryApprovalDecision,
  BoundaryApprovalHandler,
  BoundaryApprovalRequest,
  BoundaryLegacyApprovalDecision,
  BoundaryUplScope,
} from "./../runtime/types.ts";

export type PendingBoundaryApproval = {
  approvalId: string;
  request: BoundaryApprovalRequest;
  createdAt: string;
};

export type BoundaryApprovalQueueAdapter = {
  handler: BoundaryApprovalHandler;
  listPending(): PendingBoundaryApproval[];
  allowOnce(
    approvalId: string,
    options?: { scope?: BoundaryUplScope; notes?: string | null; domain?: string },
  ): boolean;
  allowAsLaw(
    approvalId: string,
    options?: { scope?: BoundaryUplScope; notes?: string | null; domain?: string },
  ): boolean;
  denyOnce(
    approvalId: string,
    options?: { scope?: BoundaryUplScope; notes?: string | null; domain?: string },
  ): boolean;
  approve(
    approvalId: string,
    options?: { scope?: BoundaryUplScope; notes?: string | null; domain?: string },
  ): boolean;
  deny(approvalId: string): boolean;
  denyAsLaw(
    approvalId: string,
    options?: { scope?: BoundaryUplScope; notes?: string | null; domain?: string },
  ): boolean;
  /** Deny all pending approvals — called on session end so no promises leak. */
  drainAll(): string[];
};

export function createStaticApprovalHandler(approved: boolean): BoundaryApprovalHandler {
  return async () => ({ choice: approved ? "allow_once" : "deny_once" });
}

export function createPredicateApprovalHandler(
  predicate: (approval: BoundaryApprovalRequest) => Promise<boolean> | boolean,
): BoundaryApprovalHandler {
  return async (approval) => ({ choice: (await predicate(approval)) ? "allow_once" : "deny_once" });
}

export function createApprovalQueueAdapter(): BoundaryApprovalQueueAdapter {
  const pending = new Map<
    string,
    PendingBoundaryApproval & {
      resolve: (
        approved: boolean | BoundaryApprovalDecision | BoundaryLegacyApprovalDecision,
      ) => void;
    }
  >();

  const handler: BoundaryApprovalHandler = async (approval) =>
    new Promise<boolean | BoundaryApprovalDecision | BoundaryLegacyApprovalDecision>((resolve) => {
      const approvalId = approval.request.requestId;
      pending.set(approvalId, {
        approvalId,
        request: approval,
        createdAt: new Date().toISOString(),
        resolve,
      });
    });

  function settle(
    approvalId: string,
    approved: boolean | BoundaryApprovalDecision | BoundaryLegacyApprovalDecision,
  ): boolean {
    const entry = pending.get(approvalId);
    if (!entry) {
      return false;
    }
    pending.delete(approvalId);
    entry.resolve(approved);
    return true;
  }

  function makeDecision(
    choice: BoundaryApprovalChoice,
    options?: { scope?: BoundaryUplScope; notes?: string | null; domain?: string },
  ): BoundaryApprovalDecision {
    return {
      choice,
      scope: options?.scope,
      notes: options?.notes,
      domain: options?.domain,
    };
  }

  return {
    handler,
    listPending: () => [...pending.values()].map(({ resolve: _resolve, ...entry }) => entry),
    allowOnce: (approvalId: string, options) =>
      settle(approvalId, makeDecision("allow_once", options)),
    allowAsLaw: (approvalId: string, options) =>
      settle(approvalId, makeDecision("allow_as_law", options)),
    denyOnce: (approvalId: string, options) =>
      settle(approvalId, makeDecision("deny_once", options)),
    approve: (approvalId: string, options) =>
      settle(approvalId, makeDecision("allow_as_law", options)),
    deny: (approvalId: string) => settle(approvalId, makeDecision("deny_once")),
    denyAsLaw: (approvalId: string, options) =>
      settle(approvalId, makeDecision("deny_as_law", options)),
    drainAll: () => {
      const drained: string[] = [];
      for (const [approvalId] of pending) {
        settle(approvalId, makeDecision("deny_once"));
        drained.push(approvalId);
      }
      return drained;
    },
  };
}
