# Agent Buccet Open-Source Implementation Plan

## Mission

Ship a minimal hard-boundary runtime for AI agents that makes unauthorized actions structurally impossible by default.

Core doctrine:
- Agents can propose. They cannot authorize.
- No ambient authority for agents.
- If a path is not opened, it does not exist to the agent.
- If a path is opened, it becomes lawful reachable scope for the session.
- Session law persists until the user explicitly ends it; process loss or laptop shutdown must not shake the bucket loose.
- If the session snapshot is damaged, the append-only ledger must still be sufficient to restore lawful scope.

## Public Scope

Public modules:
- law engine
- path orchestrator
- NSL safe-repair layer
- append-only ledger
- filesystem-first runtime wrappers
- small integration surface for agent tool layers and external frameworks
- policy loading and approval adapter surface

Public guarantees:
- deny by default
- explicit user-opened scope only
- opened paths become session law, not loose permission memory
- persistent session law survives restarts until the user ends the session
- user can revoke granted authority at any time and the bucket closes immediately
- expired grants die automatically and stay dead after restart
- untrusted prompt content remains proposal, never authority
- every meaningful action must be ledgered in a complete audit chain or it is non-authoritative
- dangerous actions require approval
- all meaningful actions are logged
- blocked actions return lawful next moves instead of silent failure

## Private Scope

Keep private:
- meta loops
- law-of-law proposal systems
- offensive learning/intelligence improvements
- gravity internals unless later needed for public enforcement
- higher-order private internals not required for defensive runtime behavior
- deeper universe orchestration that increases model power rather than containment

## V1 Proof Target

The first public release succeeds if a developer can install the runtime and immediately observe:
- delete blocked by default
- out-of-scope write blocked by default
- destructive action converted into approval request
- user-opened paths enforced structurally
- ledger proving every decision
- NSL offering lawful next moves
- add-on integration surface that existing agent stacks can wrap without migration

## Architectural Spine

The runtime is only four public pillars:
- Law engine
- Path orchestrator
- NSL
- Ledger

Execution flow:
1. agent proposes an action
2. path orchestrator checks reachability
3. law engine decides allow / deny / require_approval
4. NSL produces next lawful move if needed
5. ledger records the full decision path
6. executor runs only if admitted

## V1 Feature Set

### Core Laws
- no delete unless explicitly allowed
- no write outside approved scope
- no move/rename outside approved scope
- no shell execution unless allowed
- no network unless allowed
- no irreversible bulk action without approval
- prompt content cannot widen scope or mutate law
- prompt content cannot self-approve or revive ended sessions

### Scope Control
- session-scoped reachable resources only
- issued grants for opened paths/resources
- opened paths instantiate lawful session scope
- domains/tools/recipients can also be granted as explicit reachable scope
- time-limited grants
- revocable grants
- revocation and expiry persist across crash/restart
- dry-run mode

### Ledger
- append-only
- decision + reason visible
- path/grant/action/approval all recorded
- session start/restore/persist/end all recorded
- ledger doubles as crash-recovery evidence, not just observability
- structured audit helpers can detect incomplete request/session traces

### NSL
- safe next-step suggestions
- approval prompts
- pluggable repair move registry
- user-extensible repair moves

### Integration Surface
- framework-agnostic action executor
- policy config loading and validation
- queued approval bridge for remote control surfaces
- ledger query helpers
- remote-command proposal helpers with defensive meta-flag inference
- concrete wrappers for recipient sends, domain sends, and tool execution

## Build Order

### Phase 1: Spec Lock
Deliver:
- public/private boundary doc
- core doctrine doc
- action model
- grant model
- ledger schema
- NSL move schema

### Phase 2: Ledger
Implement append-only records for:
- session started/restored/persisted/ended
- path opened
- path-law instantiated
- grant issued/revoked/expired
- action proposed
- decision returned
- approval requested/granted/denied
- action executed
- NSL move suggested/chosen

### Phase 3: Path Orchestrator
Implement:
- opened path registry
- reachability checks
- path-law instantiation on open
- persistent session-state save/restore
- atomic on-disk session writes and ledger-backed recovery
- grant issuance/revocation
- expired grant cleanup
- dry-run resolution

### Phase 4: Law Engine
Implement:
- default deny policy
- destructive action classification
- approval-required decisions
- user law loading and validation

### Phase 5: Filesystem Runtime
Implement wrappers for:
- read
- write
- overwrite
- append
- delete
- mkdir
- rename/move

Every wrapper must go through:
- path orchestrator
- law engine
- NSL
- ledger

### Phase 6: NSL
Implement defensive NSL only:
- open_path
- grant_write
- grant_delete
- grant_exec
- deny_and_explain
- dry_run_preview

### Phase 7: SDK / Examples
Implement:
- one runtime constructor
- one session object
- one approval hook
- one ledger sink
- one framework-agnostic adapter surface
- three demos: blocked delete, out-of-scope write, approved destructive action

## Non-Goals

Not in V1:
- multi-agent orchestration
- dashboards
- hosted platform
- adaptive policy intelligence
- product packaging
- general chat features
- offensive intelligence features

## Success Criteria

V1 is ready when:
- install is under 10 minutes
- unauthorized delete is impossible by default
- unauthorized out-of-scope write is impossible by default
- opened scope survives process restart and laptop shutdown until the user explicitly ends the session
- corrupted or missing session snapshots do not shake lawful scope loose if the ledger is intact
- approval flow is visible and understandable
- ledger is readable and complete
- NSL gives lawful recovery paths
- safe path is the easy path
