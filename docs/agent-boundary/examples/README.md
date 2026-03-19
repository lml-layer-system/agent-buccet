# Agent Buccet Examples

This directory holds the smallest concrete reference examples for the Agent Buccet public slice.

Thin shell install and CLI contracts:

```bash
sh scripts/install-agent-buccet.sh
npm run test:agent-buccet:cli
npm run test:agent-buccet:install
npm run test:agent-buccet:hosted-install
```

Use these when you want:
- an integration attach pattern
- a policy starting point
- a human approval flow reference
- a ledger audit reference

## Integration examples

- [NeMo](/docs/agent-boundary/examples/nemo.md)
- [OpenAI Agents](/docs/agent-boundary/examples/openai-agents.md)
- [LangGraph](/docs/agent-boundary/examples/langgraph.md)
- [Telegram / remote control](/docs/agent-boundary/examples/telegram.md)

## Flow examples

- [Approval flow](/docs/agent-boundary/examples/approval-flow.md)
- [Ledger audit](/docs/agent-boundary/examples/ledger-audit.md)

## Policy examples

- [Filesystem-only policy](/docs/agent-boundary/examples/policies/filesystem-only.json)
- [Remote recipient policy](/docs/agent-boundary/examples/policies/remote-recipient.json)
- [Tool lockdown policy](/docs/agent-boundary/examples/policies/tool-lockdown.json)

## Purpose

These are not full apps.

They are short reference surfaces that show:
- how the shared bodyguard attaches
- how policy is shaped
- how approval works
- how ledger audit should be interpreted

## Runnable end-to-end demo

The repo also includes a runnable CLI example:

```bash
npm run demo:agent-buccet
```

That script lives at:
- [scripts/agent-buccet-e2e.ts](/scripts/agent-buccet-e2e.ts)

## Gravity contract harness

Run:

```bash
npm run test:agent-buccet:gravity-contract
```

That script lives at:
- [scripts/agent-buccet-gravity-contract.ts](/scripts/agent-buccet-gravity-contract.ts)

It proves:
- out-of-scope -> `nsl_grant_offer`
- authority claim -> `deny`
- incomplete ledger session -> `deny`

## Swarm contract harness

Run:

```bash
npm run test:agent-buccet:swarm
```

That script proves:
- two concurrent frozen requests can join one shared swarm group
- one approval can release both through the same Buccet brain
- the ledger records the shared swarm approval path

## Ledger contract harness

Run:

```bash
npm run test:agent-buccet:ledger-contract
```

That script proves:
- canonical ledger entry blocks exist
- sequential IDs and hash links are present on new entries

## Ledger rollup and writer harnesses

Run:

```bash
npm run test:agent-buccet:ledger-rollup
npm run test:agent-buccet:ledger-writer
```

These scripts prove:
- rollups can be built and written from the live ledger
- the isolated ledger writer sidecar can accept append requests

## Ledger CLI

Run:

```bash
npm run agent-buccet:ledger -- verify --format json
npm run agent-buccet:ledger -- key --format json
npm run agent-buccet:ledger -- seal --format json
npm run agent-buccet:ledger -- checkpoint --write --format json
npm run test:agent-buccet:ledger-witness
npm run agent-buccet:ledger -- witness-file --path ./ledger-witness.jsonl --format json
npm run agent-buccet:ledger -- witness-http --url http://127.0.0.1:8080/witness --format json
npm run agent-buccet:ledger -- stats --format json
npm run agent-buccet:ledger -- rollup --period today --write --format json
```

## Wrapper contract harness

Run:

```bash
npm run test:agent-buccet:wrapper-contract
```

That script lives at:
- [scripts/agent-buccet-wrapper-contract.ts](/scripts/agent-buccet-wrapper-contract.ts)

It proves:
- blocked command policy
- scoped cwd enforcement
- environment filtering
- successful wrapped launch

## Action-classes contract harness

Run:

```bash
npm run test:agent-buccet:action-classes
```

That script lives at:
- [scripts/agent-buccet-action-classes-contract.ts](/scripts/agent-buccet-action-classes-contract.ts)

It proves:
- database scope is first-class
- system scope is first-class
- out-of-scope database/system requests become open-as-law offers
- default system laws stay fail-closed

## Gravity supervisor contract harness

Run:

```bash
npm run test:agent-buccet:gravity-supervisor
```

That script lives at:
- [scripts/agent-buccet-gravity-supervisor-contract.ts](/scripts/agent-buccet-gravity-supervisor-contract.ts)

It proves:
- public supervisor starts
- event-driven heartbeats flow when motion enters the system
- audit-driven gravity daemon loop is alive

## Hook runtime contract harness

Run:

```bash
npm run test:agent-buccet:hook-runtime
```

That script lives at:
- [scripts/agent-buccet-hook-runtime-contract.ts](/scripts/agent-buccet-hook-runtime-contract.ts)

It proves:
- native hook build path works from source and installed layouts
- hook daemon starts and writes brain status
- hook env exposes the bridge socket and brain-status path
- hook daemon stops cleanly

## Standalone export

To assemble a standalone Agent Buccet package:

```bash
npm run package:agent-buccet
```

The generated export appears at:
- `dist/agent-buccet/`

Hosted release assets appear at:
- `dist/releases/`

## Public gravity demo

Run:

```bash
npm run demo:agent-buccet:gravity
```

That script lives at:
- [scripts/agent-buccet-gravity-e2e.ts](/scripts/agent-buccet-gravity-e2e.ts)

## Wrapper CLI

Run:

```bash
npm run agent-buccet:run -- --scope /tmp -- /bin/echo wrapped-ok
```

## Native hook path

Run:

```bash
buccet hook build
buccet hook start
buccet hook status
buccet hook env
buccet hook run -- /bin/echo protected
```

## Gravity daemon

Run:

```bash
npm run agent-buccet:gravity-daemon -- --session-id my-session
```

## Intercept daemon

Run:

```bash
npm run agent-buccet:intercept-daemon -- --session-id my-session
```

Contract:

```bash
npm run test:agent-buccet:intercept-daemon
```

## Intercept server

Run:

```bash
npm run agent-buccet:intercept-server -- --session-id my-session --port 7788
```

Contract:

```bash
npm run test:agent-buccet:intercept-server
```

## Gravity bridge

Run:

```bash
npm run agent-buccet:gravity-bridge -- --listen-socket /tmp/buccet.sock --upstream-socket /tmp/agent-buccet-intercept.sock
```

Contract:

```bash
npm run test:agent-buccet:gravity-bridge
```

## Method 1 system-intercept seam

Bridge:

```bash
npm run agent-buccet:system-intercept-bridge -- --socket /tmp/agent-buccet.sock
```

Contract:

```bash
npm run test:agent-buccet:system-intercept
```
