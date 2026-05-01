# NeMo Example

Minimal attach pattern:

```ts
import {
  createPersistentBoundaryRuntimeStore,
  createBoundaryBodyguard,
} from "@/lib/agent-buccet";

const store = await createPersistentBoundaryRuntimeStore({
  sessionId: "nemo-session-1",
  actorId: "user:ryan",
});

await store.openPath({
  rootPath: "/workspace/project",
  grantedActions: ["fs.read", "fs.write", "fs.mkdir", "fs.move"],
  issuedBy: "user:ryan",
});

const bodyguard = createBoundaryBodyguard(store);

const guardedTool = bodyguard.nemo.wrapTool({
  toolName: "write_project_file",
  actionKind: "fs.write",
  describeTarget: (input: { path: string }) => input.path,
  payloadSummary: (input) => `write:${input.path}`,
  execute: async (input) => {
    // existing NeMo tool logic here
    return { ok: true, path: input.path };
  },
});
```

Meaning:
- NeMo still interprets the request
- the wrapped tool still does the work
- Buccet decides whether the action is lawful before the tool can act
