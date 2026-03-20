# Approval Flow Example

The approval queue adapter gives a concrete human loop.

## Setup

```ts
import {
  createPersistentBoundaryRuntimeStore,
  createBoundaryBodyguard,
} from "@/lib/agent-buccet";

const store = await createPersistentBoundaryRuntimeStore({
  sessionId: "approval-session-1",
  actorId: "user:ryan",
});

await store.openPath({
  rootPath: "/workspace/project",
  grantedActions: ["fs.read", "fs.delete"],
  issuedBy: "user:ryan",
});

const bodyguard = createBoundaryBodyguard(store);
```

## Dangerous action

```ts
const result = await bodyguard.enforceProposal({
  actionKind: "fs.delete",
  target: "/workspace/project/build",
  successReason: "delete executed inside boundary runtime",
  execute: async () => {
    // destructive action
  },
});
```

Expected behavior:
- delete requires approval
- approval request is queued
- no execution until explicit approval

## Inspect pending approvals

```ts
const pending = bodyguard.approvals.listPending();
```

Each pending approval gives:
- request id
- target
- reason
- creation time

## Approve or deny

```ts
bodyguard.approvals.approve(pending[0].approvalId);
// or
bodyguard.approvals.deny(pending[0].approvalId);
```

## Ledger result

Expected ledger chain:
- `ACTION_PROPOSED`
- `DECISION_RETURNED`
- `APPROVAL_REQUESTED`
- `APPROVAL_GRANTED` or `APPROVAL_DENIED`
- `ACTION_EXECUTED` or `ACTION_BLOCKED`

This is the exact human loop the repo should expose for remote control surfaces.
