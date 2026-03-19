# Quickstart

This quickstart is for the Agent Buccet public slice only.

Goal:
- start a persistent boundary session
- open one lawful path
- run one guarded action
- understand where approval and ledger fit

## 0. Install the shell

Hosted-ready release install:

```bash
sh dist/releases/install.sh
```

If you are working directly from the repo root:

```bash
sh scripts/install-agent-buccet.sh
```

Then:

```bash
buccet status
buccet scope add .
buccet run -- /bin/echo protected
buccet logs
```

The hosted installer auto-initializes the runtime without opening default scope.
The local repo installer leaves initialization explicit:

```bash
buccet init
```

To remove it cleanly:

```bash
buccet uninstall
```

## 1. Start a persistent session

Use:
- `startPersistentBoundarySession(...)`

Or for a live shared attachment layer:
- `createPersistentBoundaryRuntimeStore(...)`
- `createBoundaryBodyguard(...)`

This creates a bucket that survives restart until the user ends it.

## 2. Open lawful scope

Use:
- `openBoundaryPath(...)`

This does not merely remember permission.
It instantiates lawful session scope.

The ledger records:
- `PATH_OPENED`
- `PATH_LAW_INSTANTIATED`

## 3. Run actions through Buccet

For filesystem:
- `boundaryReadFile(...)`
- `boundaryWriteFile(...)`
- `boundaryAppendFile(...)`
- `boundaryDeletePath(...)`
- `boundaryMkdir(...)`
- `boundaryMovePath(...)`

For other action classes:
- `boundaryRecipientSend(...)`
- `boundaryNetworkSend(...)`
- `boundaryToolExec(...)`
- `boundaryDatabaseAction(...)`
- `boundarySystemAction(...)`

For framework integration:
- `createNemoBoundaryGuard(...)`
- `createOpenAIAgentsBoundaryGuard(...)`
- `createLangGraphBoundaryGuard(...)`
- `createTelegramBoundaryBridge(...)`

For one bodyguard that follows the agent everywhere:
- create one shared runtime store
- attach one bodyguard to that store
- route NeMo / OpenAI / LangGraph / Telegram through that same bodyguard
- route many protected processes through that same Buccet brain when swarm mode is needed

## 4. Approval

If an action is dangerous, Buccet returns:
- `REQUIRE_APPROVAL`

Use:
- `createApprovalQueueAdapter(...)`
- or a custom approval handler

The agent never self-approves.

## 5. Ledger

Every meaningful action must be ledgered.

Use:
- `readBoundaryLedgerBySession(...)`
- `readBoundaryLedgerByRequest(...)`
- `auditBoundaryRequestLedger(...)`
- `auditBoundarySessionLedger(...)`

If the trace is incomplete:
- do not trust the action
- route back to user / NSL / lawful recovery

## 6. Remote / async control

For Telegram-style or other remote channels:
- build a proposal with `buildTelegramBoundaryProposal(...)`
- or use `buildRemoteBoundaryProposal(...)`

These mark remote input as:
- proposal
- not authority

and attach meta-law flags for:
- authority claims
- scope expansion attempts
- law mutation attempts
- session revival attempts
- ledger bypass attempts

## 7. Scope lifecycle

Use:
- `issueBoundaryGrant(...)`
- `revokeBoundaryGrant(...)`
- `expireBoundaryGrants(...)`

This keeps authority reversible.

## 8. The minimum mental model

Someone says:
- “clean up the temp files”

The agent proposes an action.

Before anything becomes real:
- Buccet checks law
- Buccet checks scope
- Buccet checks ledger state
- Buccet decides:
  - `ALLOW`
  - `DENY`
  - `REQUIRE_APPROVAL`

That is the whole point.

## 9. Run the end-to-end example

From the repo root:

```bash
npm run demo:agent-buccet
```

This runs one concrete flow through the real runtime:
- opened path becomes law
- in-scope write executes
- out-of-scope write becomes an open-as-law offer
- destructive delete requires approval
- restored session keeps lawful scope
- ended session denies later motion

## 10. Run the gravity contract harness

From the repo root:

```bash
npm run test:agent-buccet:gravity-contract
```

This asserts the deeper gravity contract:
- out-of-scope -> `nsl_grant_offer`
- authority claim -> `deny`
- incomplete ledger session -> `deny`

## 10.4 Run the swarm contract harness

From the repo root:

```bash
npm run test:agent-buccet:swarm
```

This asserts:
- many concurrent frozen requests can hit the same Buccet brain
- matching unresolved requests collapse into one shared swarm group
- one approval can release all waiting matching requests

## 10.5 Run the ledger contract harness

From the repo root:

```bash
npm run test:agent-buccet:ledger-contract
```

This asserts:
- the canonical ledger entry structure is present
- sequential IDs are preserved
- new entries are hash-chained
- query surfaces can read the updated ledger shape

## 10.6 Run the ledger rollup and writer harnesses

From the repo root:

```bash
npm run test:agent-buccet:ledger-rollup
npm run test:agent-buccet:ledger-writer
```

This asserts:
- rollup generation works on top of the live ledger
- an isolated writer sidecar can accept append requests over a local socket

## 10.7 Use the ledger CLI

From the repo root:

```bash
npm run agent-buccet:ledger -- verify --format json
npm run agent-buccet:ledger -- stats --format json
npm run agent-buccet:ledger -- rollup --period today --write --format json
```

If the live ledger ever needs normalization after a bad append race:

```bash
npm run agent-buccet:ledger -- repair --format json
```

## 11. Prepare the standalone export

From the repo root:

```bash
npm run package:agent-buccet
```

This produces:
- `dist/agent-buccet/src`
- `dist/agent-buccet/docs`
- `dist/agent-buccet/examples`
- `dist/agent-buccet/bin/buccet.ts`
- `dist/agent-buccet/install.sh`

## 12. Run the public gravity demo

From the repo root:

```bash
npm run demo:agent-buccet:gravity
```

This shows the public no-leak behavior:
- lawful motion is allowed
- unlawful motion is collapsed to `null`
- recovery stays outside the active motion path

## 13. Run the wrapper CLI

From the repo root:

```bash
npm run agent-buccet:run -- --scope /tmp -- /bin/echo wrapped-ok
```

This is the current public wrapper phase:
- explicit command authorization at the action boundary
- process command allow/block policy
- scoped working directory enforcement
- filtered child environment
- persistent session + ledger attachment
- child process lifecycle recorded in the ledger
- child process launched with Agent Buccet runtime context

## 14. Run the wrapper contract harness

From the repo root:

```bash
npm run test:agent-buccet:wrapper-contract
```

This asserts:
- blocked command -> denied by process policy
- out-of-scope cwd -> denied
- blocked env vars are filtered
- allowed wrapped command still executes

## 15. Run the action-classes contract harness

From the repo root:

```bash
npm run test:agent-buccet:action-classes
```

This asserts:
- out-of-scope database -> open-as-law offer
- out-of-scope system target -> open-as-law offer
- database query remains approval-gated
- system env write remains denied by default

## 16. Run the gravity supervisor contract harness

From the repo root:

```bash
npm run test:agent-buccet:gravity-supervisor
```

This asserts:
- supervisor starts
- event-driven heartbeats flow when motion enters the system
- audit-driven daemon loop is alive

## 17. Run the intercept server contract harness

From the repo root:

```bash
npm run test:agent-buccet:intercept-server
```

This asserts:
- a local client can connect to Agent Buccet over socket transport
- status works over that transport
- finite action-boundary decisions flow through the same bucket
- restart and shutdown work without changing the runtime core

## 18. Run the Method 1 system-intercept contract harness

From the repo root:

```bash
npm run test:agent-buccet:system-intercept
```

This asserts:
- a future OS-level hook can send low-level event shapes to Agent Buccet
- those events map into the same finite action classes already enforced by the runtime
- the current server seam is enough to support deeper intercept layers later without changing the core

Use that export when you want to split Agent Buccet into its own repo without taking the rest of `lml_demo` with it.

## Relevant docs

- [README.md](README.md)
- [INTEGRATIONS.md](INTEGRATIONS.md)
- [INTEGRATION_SURFACE.md](INTEGRATION_SURFACE.md)
- [Examples Index](examples/README.md)
- [Filesystem Policy Example](examples/policies/filesystem-only.json)
- [Remote Recipient Policy Example](examples/policies/remote-recipient.json)
- [Tool Lockdown Policy Example](examples/policies/tool-lockdown.json)
- [Approval Flow Example](examples/approval-flow.md)
- [Ledger Audit Example](examples/ledger-audit.md)
