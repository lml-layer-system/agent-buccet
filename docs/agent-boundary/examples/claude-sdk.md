# Claude SDK Example

Minimal attach pattern for `@anthropic-ai/sdk` tool_use loops.

```ts
import Anthropic from "@anthropic-ai/sdk";
import {
  startPersistentBoundarySession,
  openBoundaryPath,
} from "agent-buccet";
import { createClaudeSDKBoundaryGuard } from "agent-buccet/integrations";

// 1. Start a boundary session
let config = await startPersistentBoundarySession({
  sessionId: "claude-agent-session-1",
  actorId: "user:alice",
});

// 2. Open the workspace the agent is allowed to touch
({ config } = await openBoundaryPath({
  config,
  rootPath: "/home/alice/workspace",
  grantedActions: ["fs.read", "fs.write"],
  issuedBy: "user:alice",
}));

// 3. Register which tools map to which boundary actions
const guard = createClaudeSDKBoundaryGuard(config, {
  read_file: {
    actionClass: "file",
    operation: "read",
    describeTarget: (input) => (input as { path: string }).path,
  },
  write_file: {
    actionClass: "file",
    operation: "write",
    describeTarget: (input) => (input as { path: string }).path,
  },
  run_shell: {
    actionClass: "shell",
    operation: "exec",
    describeTarget: (input) => (input as { command: string }).command,
  },
});

// 4. In your Claude tool_use loop:
const client = new Anthropic();
const response = await client.messages.create({ ... });

for (const block of response.content) {
  if (block.type !== "tool_use") continue;

  const result = await guard.evaluate(block.name, block.input);

  if (result.decision !== "allow") {
    // Surface result.reason + result.nslMoves to the user
    // Return a tool_result block with the boundary decision
    console.log(`Blocked: ${result.reason}`);
    console.log(`Laws: ${result.lawIds.join(", ")}`);
    continue;
  }

  // Safe to execute the tool
}
```

Meaning:
- your Claude SDK loop runs normally
- every tool_use block is evaluated through intercept → gravity → bodyguard before execution
- unknown tools are denied by default (`BOUNDARY.TOOL.UNMAPPED`)
- the ledger records every decision, signed and chained

See also:
- [`createClaudeSDKBoundaryGuard`](../../../lib/agent-buccet/integrations/claude-sdk.ts)
- [`evaluateBoundaryIntercept`](../../../lib/agent-buccet/intercept.ts)
- [Quickstart](../../../examples/quickstart/index.ts)
