# LangGraph Example

Minimal attach pattern:

```ts
import {
  createPersistentBoundaryRuntimeStore,
  createBoundaryBodyguard,
} from "@/lib/lml/agent-boundary";

const store = await createPersistentBoundaryRuntimeStore({
  sessionId: "langgraph-session-1",
  actorId: "user:ryan",
});

await store.issueGrant({
  resourceKind: "tool",
  resourceValue: "git",
  grantedActions: ["tool.exec"],
  issuedBy: "user:ryan",
});

const bodyguard = createBoundaryBodyguard(store);

const guardedNode = bodyguard.langgraph.wrapNode({
  toolName: "git_status_node",
  actionKind: "tool.exec",
  describeTarget: () => "git",
  payloadSummary: () => "git status",
  execute: async () => {
    // existing LangGraph node logic here
    return { ok: true, command: "git status" };
  },
});
```

Meaning:
- the graph still controls flow
- the boundary controls whether a real tool action can exist
