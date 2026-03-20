import type {
  BoundaryApprovalHandler,
  BoundaryApprovalRequest,
} from "./types.ts";

export type PendingBoundaryApproval = {
  approvalId: string;
  request: BoundaryApprovalRequest;
  createdAt: string;
};

export type BoundaryApprovalQueueAdapter = {
  handler: BoundaryApprovalHandler;
  listPending(): PendingBoundaryApproval[];
  approve(approvalId: string): boolean;
  deny(approvalId: string): boolean;
};

export function createStaticApprovalHandler(approved: boolean): BoundaryApprovalHandler {
  return async () => approved;
}

export function createPredicateApprovalHandler(
  predicate: (approval: BoundaryApprovalRequest) => Promise<boolean> | boolean,
): BoundaryApprovalHandler {
  return async (approval) => predicate(approval);
}

export function createApprovalQueueAdapter(): BoundaryApprovalQueueAdapter {
  const pending = new Map<
    string,
    PendingBoundaryApproval & { resolve: (approved: boolean) => void }
  >();

  const handler: BoundaryApprovalHandler = async (approval) =>
    new Promise<boolean>((resolve) => {
      const approvalId = approval.request.requestId;
      pending.set(approvalId, {
        approvalId,
        request: approval,
        createdAt: new Date().toISOString(),
        resolve,
      });
    });

  function settle(approvalId: string, approved: boolean): boolean {
    const entry = pending.get(approvalId);
    if (!entry) {
      return false;
    }
    pending.delete(approvalId);
    entry.resolve(approved);
    return true;
  }

  return {
    handler,
    listPending: () =>
      [...pending.values()].map(({ resolve: _resolve, ...entry }) => entry),
    approve: (approvalId: string) => settle(approvalId, true),
    deny: (approvalId: string) => settle(approvalId, false),
  };
}
