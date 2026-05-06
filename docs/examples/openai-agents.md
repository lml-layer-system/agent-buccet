# OpenAI Agents Example

Minimal attach pattern:

```ts
import {
  createPersistentBoundaryRuntimeStore,
  createBoundaryBodyguard,
} from "agent-buccet";

const store = await createPersistentBoundaryRuntimeStore({
  sessionId: "openai-agents-session-1",
  actorId: "user:ryan",
});

await store.issueGrant({
  resourceKind: "recipient",
  resourceValue: "ops@example.com",
  grantedActions: ["comm.send"],
  issuedBy: "user:ryan",
});

const bodyguard = createBoundaryBodyguard(store);

const sendAlert = bodyguard.openaiAgents.wrapTool({
  toolName: "send_alert",
  actionKind: "comm.send",
  describeTarget: (input: { recipient: string }) => input.recipient,
  payloadSummary: (input) => `alert:${input.recipient}`,
  execute: async (input) => {
    // existing OpenAI Agents tool logic here
    return { sent: true, recipient: input.recipient };
  },
});
```

Meaning:
- your agent SDK still runs normally
- real-world sends still terminate in Buccet first
