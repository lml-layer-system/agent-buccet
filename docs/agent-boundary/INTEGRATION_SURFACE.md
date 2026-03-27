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

With bodyguard-integrated gravity enabled, unlawful motion can also collapse to:
- `null`
- followed by Bodyguard recovery moves outside the active execution path (e.g. `open_as_law`, `grant_network`, `dry_run_preview`)

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

### Boundary action surface

Use:
- `createBoundaryActionRequest(...)`
- `enforceBoundaryProposal(...)`

This is the shared action admission path through Bodyguard.

### Gravity service

Use:
- `createBoundaryGravityService(...)`

Gravity is the deeper no-leak enforcement layer under the bodyguard path.
It can:
- allow lawful motion
- null unlawful but grantable motion into bodyguard recovery
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
If a request or session trace is incomplete, higher-level systems should treat it as non-authoritative and ask for explicit user intervention through the approval handler or Bodyguard recovery moves.

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

These expose the same boundary bodyguard for recipient sends, domain sends, tool execution, database actions, and system/config/credential actions.

### Resource governor

Configure via `BoundaryRuntimeConfig`:

```ts
const config: BoundaryRuntimeConfig = {
  // ...
  governorConfig: {
    velocity: { maxRpm: 30, windowMs: 60_000 },       // max 30 crossings per 60s window
    density:  { maxFailureRatio: 0.5, windowSize: 20 }, // deny/total ≤ 50% over last 20 decisions
    mass:     { maxCrossings: 200 },                   // weighted horizon ceiling
    weight:   { "tool.exec": 10, "fs.delete": 8 },    // override default weights (optional)
  },
  // governorState is managed automatically — do not set manually
};
```

The governor pre-check fires before law evaluation. When any dimension trips, Terminal 1 holds the action, records `GOVERNOR_TRIP`, and surfaces the event through the normal Bodyguard approval path. Terminal 2 still decides whether to allow once, allow as law, deny once, or deny as law. State flows back automatically via `BoundaryExecutionResult.config` — callers using `createBoundaryBodyguard` need no changes.

Default weight table (full): `tool.exec=10`, `fs.delete=8`, `sys.credential.use/read=8`, `sys.config.write/sys.env.write=6`, `network.send/comm.send=5`, `db.delete=8`, `db.update=4`, `db.insert=3`, `db.query=2`, `fs.write/append/move=2`, `fs.mkdir/fs.read/chat.emit/sys.env.read/sys.config.read=1`.

For proof:
- `npm run test:agent-buccet:governor-contract`

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
- wall-clock timeout enforcement (`BoundaryProcessPhysics.wallClockTimeoutMs` → `SIGKILL` + `PROCESS_WALL_CLOCK_KILL` ledger event)
- POSIX rlimit scaffold (`cpuTimeLimitSec`, `maxProcesses`, `maxMemoryBytes`, `maxOpenFiles`, `maxFileSizeBytes` via `sh -c ulimit ...; exec {cmd}` — Linux/macOS only)

For proof:
- `npm run test:agent-buccet:wrapper-contract`
- `npm run test:agent-buccet:payload-physics-contract`

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

### Outbound payload classification

Use:
- `inferBoundaryEgressFlagsFromPayload(payload: string)`

This scans an outbound payload string and returns flags for `network.send` and `comm.send` proposals:
- `payloadContainsPii` — email, phone, SSN patterns
- `payloadContainsCredential` — API keys, private keys, password/token fields, AWS access key IDs
- `payloadContainsFinancialData` — card number patterns with Luhn validation

Set the returned flags on the proposal. `BOUNDARY.EGRESS.PII.01`, `BOUNDARY.EGRESS.CREDENTIAL.01`, and `BOUNDARY.EGRESS.FINANCIAL.01` laws will deny the send automatically.

For proof:
- `npm run test:agent-buccet:egress-contract`

## UPL as zero-search skill discovery

The User Path Ledger (UPL) is the agent's approved action space, indexed by SHA256 path hash over `(actionKind + target + flags + payloadSummary)`.

Other agent frameworks use recursive skill search: the agent is asked to do something, the framework searches skills.md or tool indexes for a matching capability, the LLM evaluates the match, and the result may recurse. This is compute-heavy, latency-heavy, and structurally redundant.

In this architecture, **UPL is skills**:
- First time the agent proposes an action → goes through Bodyguard admission → user approves or denies
- `allow_as_law` / `deny_as_law` writes the standing UPL entry with a SHA256 path hash key
- Every subsequent identical action → O(1) UPL lookup → instant allow or deny, no re-prompt, no LLM evaluation
- The agent's approved action space is pre-indexed and self-building through normal use

There is no separate skill registry. There is no recursive search. The agent's skill set emerges from its operating history under law enforcement. The UPL is both the decision cache and the standing law surface.

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
