# Agent Buccet Integrations

The repo contains first-party integration surfaces for common agent stacks.

These are not full vendor SDK implementations.
They are explicit boundary entrypoints that make the compatibility claim concrete inside the repo.

## Included

### NeMo Guardrails
- [nemo.ts](../../lib/agent-buccet/integrations/nemo.ts)
- [Example](examples/nemo.md)

Exports:
- `enforceNemoProposal(...)`
- `wrapNemoTool(...)`
- `createNemoBoundaryGuard(...)`

Use this when a NeMo workflow/tool wants to propose a real-world action and Buccet should decide:
- `ALLOW`
- `DENY`
- `REQUIRE_APPROVAL`

### OpenAI Agents
- [openai-agents.ts](../../lib/agent-buccet/integrations/openai-agents.ts)
- [Example](examples/openai-agents.md)

Exports:
- `enforceOpenAIAgentProposal(...)`
- `wrapOpenAIAgentTool(...)`
- `createOpenAIAgentsBoundaryGuard(...)`

### LangGraph / LangChain-style graphs
- [langgraph.ts](../../lib/agent-buccet/integrations/langgraph.ts)
- [Example](examples/langgraph.md)

Exports:
- `enforceLangGraphProposal(...)`
- `wrapLangGraphNode(...)`
- `createLangGraphBoundaryGuard(...)`

### Telegram / remote async control
- [telegram.ts](../../lib/agent-buccet/integrations/telegram.ts)
- [Example](examples/telegram.md)

Exports:
- `buildTelegramBoundaryProposal(...)`
- `enforceTelegramProposal(...)`
- `createTelegramBoundaryBridge(...)`

This bridge includes:
- remote proposal hardening
- approval queue adapter
- provenance-aware enforcement

## Supporting Examples

- [Examples Index](examples/README.md)
- [Approval Flow](examples/approval-flow.md)
- [Ledger Audit](examples/ledger-audit.md)
- [Filesystem Policy](examples/policies/filesystem-only.json)
- [Remote Recipient Policy](examples/policies/remote-recipient.json)
- [Tool Lockdown Policy](examples/policies/tool-lockdown.json)

## Shared Attachment Layer

If the goal is that Buccet follows the agent across multiple frameworks and interfaces, use:
- `createBoundaryRuntimeStore(...)`
- `createPersistentBoundaryRuntimeStore(...)`
- `restoreBoundaryRuntimeStore(...)`
- `createBoundaryBodyguard(...)`

This gives you:
- one live boundary state
- one persistent session
- one approval queue
- many surfaces attached to the same bucket

Meaning:
- NeMo can use it
- OpenAI Agents can use it
- LangGraph can use it
- Telegram can use it

without splitting the boundary into separate local copies.

## Architecture

The integration pattern is always the same:

1. existing stack interprets the request
2. stack proposes an action
3. Agent Buccet boundary guard evaluates law + scope + ledger state
4. only then can anything execute

This keeps the repo interface-agnostic.

It is:
- not a replacement framework
- not a new orchestration platform
- an add-on law layer for existing systems

## Position

Bring your own agent.
Add Buccet for containment.
