# Agent Buccet Integration Surface

## What This Repo Is

This boundary runtime is an add-on containment layer for agent systems.

It does not replace:
- NeMo Guardrails
- OpenAI Agents SDK
- LangGraph / LangChain
- custom agent loops
- Telegram / Discord / Slack control surfaces

It sits at the action boundary and decides:
- `ALLOW`
- `DENY`
- `REQUIRE_APPROVAL`

After a `DENY`, the user can also choose to make that denial a law so the same class of motion is denied on contact in later requests.

With executor-integrated gravity enabled, unlawful motion can also collapse to:
- `null`
- followed by NSL open-as-law recovery outside the active execution path

## Core Position

Bring your own agent.
Add boundary law for containment.

If the path was not issued, the action cannot happen.

## Integration Point

The integration point is the proposed real-world action:
- file operation
- tool execution
- network send
- recipient-targeted action
- database action
- system/config/credential action

Existing stack:
- interprets the user request
- chooses a tool or action
- proposes execution

Boundary runtime:
- checks reachable scope
- checks laws
- checks gravity no-leak constraints
- requests approval if required
- records everything in the ledger
- executes only if admitted
- allows grants to be revoked or expire without leaving stale authority behind

Request provenance matters:
- `trusted_user`
- `trusted_system`
- `remote_user`
- `agent_inference`
- `tool_output`
- `external_content`

Untrusted provenance is treated as proposal, not authority.

Scope is not path-only:
- `path`
- `domain`
- `tool`
- `recipient`
- `database`
- `system`

## Public API Surface

### Framework-agnostic executor

Use:
- `createBoundaryActionRequest(...)`
- `executeBoundaryControlledAction(...)`

This is the shared action admission path.

### Gravity service

Use:
- `createBoundaryGravityService(...)`

Gravity is the deeper no-leak enforcement layer under the executor path.
It can:
- allow lawful motion
- null unlawful but grantable motion into NSL recovery
- deny non-grantable unlawful motion

For proof:
- `npm run test:agent-buccet:gravity-contract`

### Generic tool adapters

Use:
- `enforceBoundaryProposal(...)`
- `wrapBoundaryTool(...)`

These allow existing agent stacks to wrap tool execution without changing their whole architecture.
They also allow callers to pass provenance and defensive meta flags so prompt-injection attempts fail closed at the action boundary.

### Policy loading

Use:
- `loadBoundaryPolicyConfig(...)`
- `applyBoundaryPolicyConfig(...)`

These allow boundary law packs, approval-required classes, and initial grants to be loaded from config instead of hand-wired code.

### Scope lifecycle

Use:
- `issueBoundaryGrant(...)`
- `revokeBoundaryGrant(...)`
- `expireBoundaryGrants(...)`

These keep user authority reversible. Opened scope is real law, but it is not permanent ambient permission.

### Approval adapters

Use:
- `createStaticApprovalHandler(...)`
- `createPredicateApprovalHandler(...)`
- `createApprovalQueueAdapter(...)`

The queue adapter is the bridge for remote approval surfaces like Telegram, Slack, Discord, web UI, or custom control panels.

### Ledger queries

Use:
- `readBoundaryLedgerBySession(...)`
- `readBoundaryLedgerByRequest(...)`
- `readBoundaryLedgerByEventType(...)`
- `readLatestBoundarySessionRecord(...)`
- `auditBoundaryRequestLedger(...)`
- `auditBoundarySessionLedger(...)`
- `formatBoundaryLedgerRecords(...)`

These make the containment proof inspectable by higher-level systems.
If a request or session trace is incomplete, higher-level systems should treat it as non-authoritative and ask for explicit user intervention through NSL/approval.

### Filesystem wrappers

Use:
- `boundaryReadFile(...)`
- `boundaryWriteFile(...)`
- `boundaryAppendFile(...)`
- `boundaryDeletePath(...)`
- `boundaryMkdir(...)`
- `boundaryMovePath(...)`

These are the first concrete containment surface.

### Communication / execution wrappers

Use:
- `boundaryRecipientSend(...)`
- `boundaryNetworkSend(...)`
- `boundaryToolExec(...)`
- `boundaryDatabaseAction(...)`
- `boundarySystemAction(...)`

These expose the same boundary executor for recipient sends, domain sends, tool execution, database actions, and system/config/credential actions.

### Process wrapper layer

Use:
- `runBoundaryWrappedCommand(...)`
- `prepareBoundaryProcess(...)`
- `runBoundaryProcess(...)`

This is the current public wrapper phase.
It adds:
- command allow/block policy
- scoped working directory enforcement
- filtered child environment
- process launch/spawn/exit ledgering

For proof:
- `npm run test:agent-buccet:wrapper-contract`

### Gravity supervisor / daemon

Use:
- `createBoundaryGravitySupervisor(...)`

Runtime entrypoint:
- `npm run agent-buccet:gravity-daemon -- --session-id my-session`

This is the current public daemon phase.
It adds:
- event-driven supervision
- grant expiry maintenance
- restart-counted supervisor state

Operational rule:
- meta laws stay pure
- supervisor owns restart behavior
- manual restart is an operational command, not a law mutation

For proof:
- `npm run test:agent-buccet:gravity-supervisor`

### Intercept daemon

Use:
- `evaluateBoundaryIntercept(...)`

Runtime entrypoint:
- `npm run agent-buccet:intercept-daemon -- --session-id my-session`

This is the transport seam for future deeper process/OS hooks.
It adds:
- finite action-boundary request mapping
- JSONL daemon control surface
- explicit `status` / `restart` / `shutdown` commands

For proof:
- `npm run test:agent-buccet:intercept-daemon`

### Intercept server

Use:
- `evaluateBoundaryIntercept(...)`

Runtime entrypoint:
- `npm run agent-buccet:intercept-server -- --session-id my-session --port 7788`

This is the local socket transport seam for external wrappers or future OS-level hooks.
It adds:
- finite action-boundary request mapping
- socket-based control surface
- explicit `status` / `restart` / `shutdown` commands

For proof:
- `npm run test:agent-buccet:intercept-server`

### Method 1 system-intercept seam

Use:
- `mapSystemInterceptEventToRequest(...)`
- `evaluateSystemInterceptEvent(...)`
- `sendBoundaryInterceptServerInput(...)`

Bridge entrypoint:
- `npm run agent-buccet:system-intercept-bridge -- --socket /tmp/agent-buccet.sock`

This is the additive seam for future eBPF/FUSE/LD_PRELOAD or other OS-level hook layers.
It does not introduce a second policy engine.
It translates low-level external events into the same finite action-boundary requests already enforced by Agent Buccet.

For proof:
- `npm run test:agent-buccet:system-intercept`

### Remote command helpers

Use:
- `inferBoundaryMetaFlagsFromText(...)`
- `buildRemoteBoundaryProposal(...)`

These mark remote or async control text as untrusted proposal input and attach defensive meta flags before execution is even attempted.

## Why This Matters

Remote and async agent control creates authority drift:
- wrong path
- wrong workspace
- ambiguous short instructions
- destructive actions from phone/thin-client workflows

This runtime is built to stop that structurally, not by prompt suggestion.

## Non-Goal

This repo is not trying to be:
- a new full agent framework
- a replacement for orchestration stacks
- a conversational guardrail system only

It is the hard-boundary containment layer that existing stacks can add.
