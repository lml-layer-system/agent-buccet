# Telegram Example

Minimal attach pattern:

```ts
import {
  createPersistentBoundaryRuntimeStore,
  createBoundaryBodyguard,
} from "@/lib/lml/agent-boundary";

const store = await createPersistentBoundaryRuntimeStore({
  sessionId: "telegram-session-1",
  actorId: "user:ryan",
});

await store.openPath({
  rootPath: "/workspace/project/tmp",
  grantedActions: ["fs.read", "fs.delete"],
  issuedBy: "user:ryan",
});

const bodyguard = createBoundaryBodyguard(store);

const proposal = bodyguard.telegram.buildProposal({
  actionKind: "fs.delete",
  target: "/workspace/project/tmp",
  rawText: "clean up the temp files",
  successReason: "telegram cleanup executed inside boundary runtime",
});

const result = await bodyguard.telegram.enforceProposal(proposal);
```

Meaning:
- Telegram is only the mouth
- the agent proposes an action
- Buccet decides whether the action is lawful
- the same shared bodyguard and approvals follow the agent across surfaces
