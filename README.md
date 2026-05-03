# Agent Buccet

Full-boundary enforcement for AI agents — action, spend, output, 
inbound, telemetry, kernel — governed at runtime against your 
standing law before consequence lands.

**Agents can propose. They cannot authorize.**

Buccet decides:

- what is allowed
- what is denied
- what requires a human
- what becomes standing law
- what gets written to the witness ledger

![Agent Buccet](docs/assets/agent-buccet-hero.jpg)

## What's Live

The code already ships a layered control body:

- unified operator cockpit via `buccet console`
- standing UPL with acceptance side and denial side
- authored-law flow via `upl import` and `upl sync`
- typed living-UPL workspace via `upl draft`, `upl review`, `upl apply`, and `upl workspace`
- human-only activation of live law
- spend-specific law packs with exact corridor staging
- spend proposal flow where Pi suggests packs but the human still picks and activates the corridor
- `create` Buccets for creative/workshop teams
- `create spend` Buccets for financial agents
- per-team proof-of-work traces, continuity snapshots, rollback, and cherry-pick
- MCP server and host attachment for Claude Desktop, Cursor, VS Code, and Claude Code
- bounded transport packaging and import/run flows
- ledger, witness, release-witness, runtime snap, and contract surfaces to prove the system is standing where it claims

It also ships the deeper boundary body that the old README undersold:

- egress structural validity layer
- telemetry/disclosure boundary on outbound chat/output and egress motion
- secrets boundary
- motion governor
- payload physics envelope
- input admission boundary
- kernel-boundary denial walls for lower-level unsafe classes
- swarm resolution
- shed reboot / boundary-on-self

Stress-tested under adversarial swarm load. 
denied_actions_reaching_tools: 0.

## Boundary Set

Buccet is not one vague safety layer. It is a set of named boundaries and enforcers:

- **UPL / standing law**: the active user-authored law body
- **tracks + traffic**: post-law rails and walls that keep motion finite after approval
- **spend / value boundary**: financial commitment and obligation creation
- **telemetry / disclosure boundary**: outbound chat, output, and user-telemetry exposure
- **secrets boundary**: credentials, internal secret surfaces, sensitive payload classes
- **input admission boundary**: inbound hostile force denied before the brain wakes
- **motion governor**: velocity, density, mass, and weighted outbound force
- **payload physics**: process envelope and live I/O/object ceilings
- **kernel boundary laws**: lower-level unsafe classes denied as named walls
- **witness / ledger boundary**: consequence proof, approval proof, release proof

These are not just docs. They are represented in runtime code, contracts, and ledgers.

## Why This Is Different

Most agent systems live above the consequence boundary:

- prompts try to steer the model
- frameworks coordinate tools
- providers regress or improve
- wrappers change ergonomics

Buccet lives below that layer, at the point where an agent tries to touch the world.

That means the model can change, the framework can change, and the workflow can change without changing the control body that governs consequence.

## Intercept Depth And Kernel Truth

Buccet’s public intercept seam is the action boundary:

- libc-level native intercept where available
- framework/adapter intercept where that is the right seam
- system-intercept bridge and gravity funnel normalization

The open-source runtime also ships explicit kernel-boundary denial walls for unsafe lower-level classes and proves them in contracts.

What it does **not** claim is universal kernel mediation on every syscall path.
That line matters.

Read [current limits](docs/current-limits.md) and [security model](docs/security-model.md) for the exact claim boundary.

## Telemetry, Disclosure, And Witness

Buccet is not only about tool execution.
It also governs what becomes visible, disclosed, and externally emitted:

- outbound chat/output
- user telemetry
- sensitive egress classes
- proof of completion claims
- witness-bearing consequence history

The runtime does not treat disclosure as “just another message.”
It has explicit denial walls, telemetry-boundary handling, and witness requirements.

That is why the repo includes:

- ledger + audit surfaces
- witness and release-witness
- proof contracts around egress, secrets, disclosure, and completion claims

## The Core Model

- `UPL` = User Path Laws, the standing law body
- `acceptance` = what may happen
- `denial` = what must not happen
- `tracks` = the snapped post-law continuation rails and walls
- `path sources` = context and specialization, not permission
- `ledger` = the witness trail from first proposal to final consequence

The important architectural split is:

Pi is the Buccet AI assistant surface — it can draft, explain, 
and review proposed law, but it cannot activate it. Only 
human-approved law becomes active UPL.


That is now real in code, not just a motto.

## Start Here

If you are new to the repo, use this order:

- operators: [quickstart](docs/quickstart.md)
- security review: [security model](docs/security-model.md)
- current ceiling and non-claims: [current limits](docs/current-limits.md)
- MCP setup: [MCP server guide](docs/guides/mcp-server.md)
- contributor map: [docs index](docs/README.md) and [where to add what](docs/guides/WHERE_TO_ADD_WHAT.md)
- repo/public surface: [public/private boundary](docs/public-private-boundary.md) and [repo boundary](docs/REPO_BOUNDARY.md)

## Install

```bash
git clone https://github.com/lml-layer-system/agent-buccet
cd agent-buccet
sh scripts/install-agent-buccet.sh
buccet init
buccet console
```

If you want the machine posture check too:

```bash
buccet doctor --strict
```

## What You Can Do As An Operator

### 1. Stand up the control body

```bash
buccet init
buccet console
buccet status
buccet where
```

### 2. Author and ratify standing law

```bash
buccet upl import policy.md
buccet upl sync --lane acceptance
buccet upl sync --lane denial
buccet upl list
```

### 3. Use the typed living-UPL workflow

```bash
buccet upl draft proposal.json
buccet upl review latest
buccet upl apply latest
buccet upl workspace
```

This is the non-magical law path:

- natural language can draft
- review shows the exact before/after delta
- only a human apply makes it live

### 4. Build creative/workshop Buccets

```bash
buccet create design-team --domain product
buccet create list
buccet create show design-team
buccet create cockpit
buccet create trace design-team
```

Creative Buccets carry the workshop/comprehension side:

- team manifests
- path-source memory
- proof-of-work traces
- continuity history
- rollback and cherry-pick

Today, `buccet create` is the general workshop/comprehension lane.
Future first-class modality lanes like visual and voice should fit this same Buccet shape instead of becoming separate ad hoc systems:

- same UPL and boundary body
- same path-source and proof-of-work model
- same continuity and ledger surface
- same operator review and human authority split

That means contributors who want to add visual or voice Buccets later have a clear target: extend the existing create-side body, not bypass it.

### 5. Build spend-bounded financial Buccets

```bash
buccet create spend growth-spend --domain software --confirm-spend
buccet upl spend list
buccet upl spend propose "set up a recurring Slack seat under fifty dollars per month"
buccet upl spend setup license.seat
buccet upl review latest
buccet upl apply latest
```

Spend Buccets are a separate class for agents that can create real financial consequence:

- shopping
- subscriptions
- SaaS seats/licenses
- trading/exchange
- bills and procurement
- API/cloud credits
- platform signup with billing
- transfers
- contracts/signatures
- travel, ads, donations

Financial commitment is routed through the spend/value boundary, not treated like a normal tool call.

### 6. Run guarded work

```bash
buccet scope add .
buccet run -- /bin/echo protected
buccet path run research --request "summarize the spec"
```

### 7. Inspect proof and witness

```bash
buccet logs
buccet ledger --follow
buccet create history design-team
```

### 8. Work the deeper control surfaces

```bash
buccet swarm list
buccet quarantine status
buccet shed --reason "deny-side respawn"
buccet doctor --strict
```

## Headless Does Not Mean Ungoverned

Buccet supports both:

- interactive mode
- standing-law / headless mode

Headless mode still runs through the same boundaries.
It means the human already authored the standing law and the runtime is following that compiled judgment instead of waiting for a live prompt each time.

The system still fails closed on:

- unclear authority
- out-of-corridor motion
- denied targets
- law mutation bypass
- spend side-door attempts
- secrets/telemetry violations
- input admission canyon trips
- governor and payload-physics breaches
- kernel-boundary wall contact

## MCP And Host Attachment

`buccet mcp` starts an MCP server over stdio.

Example host config:

```json
{
  "mcpServers": {
    "buccet": {
      "command": "buccet",
      "args": ["mcp"]
    }
  }
}
```

Every host still routes into the same:

- UPL
- bodyguard
- spend boundary
- witness ledger

MCP is transport only. It does not widen authority.

See [MCP Server](docs/guides/mcp-server.md) and [Entry Surface](docs/guides/ENTRY_SURFACE.md).

## Portable Transport

Buccet can package and move bounded workloads:

```bash
buccet transport pack ./demo --output demo.buccet.tgz -- /bin/demo
buccet transport import demo.buccet.tgz --into ./demo-portable
buccet transport run demo.buccet.tgz
```

That sits on top of the repo-owned substrate and transport law verification.

## Repo Layout

The repo is intentionally split by role:

- `src/` = runtime code, laws, boundaries, engines, teams, context, proof, substrate adapters
- `cli/` = Buccet operator entrypoint
- `contracts/` = executable proofs for law, boundaries, runtime, CLI, teams, proof, packaging
- `docs/` = operator docs, specs, guides, examples
- `examples/` = minimal runnable examples
- `data/` = law foundation payloads and working runtime artifacts
- `scripts/` = build, package, daemon, render, install, and support scripts
- `native/` = lower-level substrate and interception surfaces
- `demo/` = demo scenarios and operator walkthrough scripts

The repo surface is now organized for inspection and publication, not just internal development.

## Read Surface vs Run Surface

The repo is larger than the hot runtime on purpose.

Readable repo body:

- docs
- specs
- contracts
- source
- examples
- native surfaces

Hot runtime body:

- active law body manifests
- projected laws
- live user-path ledger
- native intercept lanes
- governor + admission + payload-physics runtime
- witness + release-witness runtime
- substrate/runtime bridge

That distinction matters:

- the whole repo is readable and auditable
- the runtime consequence path is smaller and snapped

## What To Read Next

- [quickstart](docs/quickstart.md)
- [security model](docs/security-model.md)
- [where to add what](docs/guides/WHERE_TO_ADD_WHAT.md)
- [law catalog](docs/specs/LAW_CATALOG.md)
- [UPL base packs](docs/specs/UPL_BASE_PACKS.md)
- [threat model traceability](docs/specs/THREAT_MODEL_TRACEABILITY.md)

## Work With Us

Early design partners and enterprise teams:
[ryangat@lmlsystemlayer.com](mailto:ryangat@lmlsystemlayer.com)
X: [@lml_layer](https://x.com/lml_layer)


## Current Limits

This repo has a strong user-space enforcement model, but it does not claim universal kernel mediation or impossible-systems marketing.

Read [current limits](docs/current-limits.md) for the exact ceiling, current non-claims, and release posture.
