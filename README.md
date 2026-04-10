# Agent Buccet

Building Ultimate Containment Constraints Every Time.

Agent Buccet is a law-bound control layer for AI agents.

It sits at the action boundary, not at the prompt layer. Agents can propose. They cannot authorize. Buccet decides what can happen, what must stop, what needs approval, and what gets recorded in the ledger.

## What You Get

- one live UPL field compiled from approved and denied law
- one-terminal operator cockpit with shield, approval/control, and witness feed together
- path runtime for structured lawful work
- path sources for domain context without widening permissions
- interactive and headless modes on the same lawful body
- durable ledger and witness trail

## Install

Hosted install:

```bash
curl -fsSL https://buccet.lml.dev/install | sh
```

Repo install:

```bash
npm install
sh scripts/install-agent-buccet.sh
```

After install:

```bash
buccet init
buccet console
```

If you want immediate strong-path intercept on a cold machine:

```bash
buccet hook start
```

## First Run

Open scope and run one guarded command:

```bash
buccet scope add .
buccet run -- /bin/echo protected
buccet status
buccet logs
```

If you want the shortest operator map:

```bash
buccet where
```

If you want the full machine posture check:

```bash
buccet doctor --strict
```

## Where Things Go

Approved UPL:

```text
~/.buccet/upl-docs/acceptance
```

Denied UPL:

```text
~/.buccet/upl-docs/denial
```

Path sources:

```bash
buccet path sources add <path-name> <file...> [--domain <domain>]
```

Paths:

```bash
buccet path run <path-name> [--request <text>] [--steps <n>|--all]
buccet path watch <path-name|formation-id> [--follow]
```

If users forget `buccet upl sync`, Buccet now auto-syncs changed UPL docs before runtime surfaces like `buccet console`, `buccet run`, `buccet hook run`, and `buccet path run`.

## What Buccet Enforces

The same live law body governs:

- filesystem motion
- process execution
- network and recipient sends
- database actions
- system and credential access

The runtime returns only:

- `ALLOW`
- `DENY`
- `REQUIRE_APPROVAL`

## Product Shape

Buccet is not a new agent framework.

It is the control body under the agent stack you already run:

- Claude Code style workflows
- OpenAI Agents
- LangGraph
- OpenClaw
- NeMo / NemoClaw style runtimes
- custom tool-using agents

Paths organize lawful work.
Path sources enrich lawful work.
UPL stays the authority.
Denial overrides acceptance.

## Docs

Start here:

- [Docs Home](docs/agent-boundary/README.md)
- [Quickstart](docs/agent-boundary/QUICKSTART.md)
- [Where To Add What](docs/agent-boundary/WHERE_TO_ADD_WHAT.md)

Operator and law:

- [UPL Base Packs](docs/agent-boundary/UPL_BASE_PACKS.md)
- [UPL Acceptance Source Pipeline](docs/agent-boundary/UPL_ACCEPTANCE_SOURCE_PIPELINE.md)
- [Buccet Path Memory](docs/agent-boundary/BUCCET_PATH_MEMORY.md)
- [Law Catalog](docs/agent-boundary/LAW_CATALOG.md)
- [Law Reference](docs/agent-boundary/LAW_REFERENCE.md)

Proof and release:

- [Launch Proof](docs/agent-boundary/LAUNCH_PROOF.md)
- [Release Checklist](docs/agent-boundary/RELEASE_CHECKLIST.md)
- [Security Model](docs/agent-boundary/SECURITY_MODEL.md)
- [Threat Model Traceability](docs/agent-boundary/THREAT_MODEL_TRACEABILITY.md)

System shape:

- [Buccet System Substrate](docs/agent-boundary/BUCCET_SYSTEM_SUBSTRATE.md)
- [Buccet Full System Body](docs/agent-boundary/BUCCET_META_EFUE_SUBSTRATE_PROCESS.md)
- [Current Limits](docs/agent-boundary/CURRENT_LIMITS.md)

## Proof Commands

```bash
npm run check:agent-buccet:production
npm run check:agent-buccet:locked
```

For the deepest hook-runtime proof:

```bash
npm run check:agent-buccet:runtime-deep
```
