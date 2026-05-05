# Agent Buccet Deep Dive

The longer system model — how Agent Buccet treats agents, law, loops, swarms, sources, open deployments, closed deployments, and enterprise fleet governance.

## How Buccet Runs In Practice

Buccet has two operating modes, but they are the same boundary body underneath.

### Interactive mode

Use `buccet console` when you want a human at the boundary in real time.

- proposals freeze at the boundary
- the human can approve, deny, or turn repeated decisions into standing law
- approved judgment can be compiled into the live UPL so the same decision does not need to be re-made forever

### 24/7 headless mode

Use headless mode when you want the same governed system to run continuously without a human at the approval console (`buccet console`).

- the runtime follows standing human law already recorded in the UPL
- the same boundaries, rails, walls, ledger, and governor still apply
- unclear, unlawful, or out-of-lane motion still fails closed instead of silently self-authorizing

Autonomous mode does not mean "the human is gone." It means the human already authored or approved the law, and that standing UPL becomes the approval surface in the loop now.

In that sense, the UPL becomes the operational form of the human in the loop: stored human judgment the system follows at runtime.

## What "Agent" Means Here

In Buccet, an agent is not the law. It is the moving interval between the law and the outside world.

It leaves the live rulebook to search, speak, call tools, touch files, send network traffic, or coordinate work. Then it returns to the same boundary for judgment, recording, and further motion.

That means the agent is always downstream of the UPL, not above it. It can propose motion. It cannot define the laws of its own existence.

## How Buccet Cuts Recursive Loops At The Source

Buccet does not let approval reopen infinite agency.

Once standing law exists, Buccet binds that live UPL into finite tracks on the two post-law continuation surfaces:

- tool and action motion
- chat and output motion

Acceptance becomes motion rails. Denial becomes motion walls. They live in one compiled runtime field, but they do not do the same job.

That is how recursive drift gets cut at the source:

- the model does not return to open-ended general agency after law is set
- lawful motion stays inside the lawful corridor
- denied motion is not a usable lane for the agent
- if motion leaves the approved corridor, Buccet surfaces the drift instead of silently widening the world

The denial side is not a suggestion and not a second menu of options. For the running agent, those are physically unavailable tracks. It does not get the denial side as a visible route to travel. It operates on lawful structure only.

UPL Traffic is the controller that keeps yes on yes and no on no:

- acceptance rails stay open in motion
- denial walls stay closed in motion

If motion tries to leave the lawful rail, Buccet does not hand the agent a no-side lane. It holds the boundary, surfaces the drift, and fails closed instead of widening the world.

Paths cut recursion at the orchestration layer in the same spirit. They keep higher-order work forward-only, finite, and stage-bound instead of recursively replanning forever.

## Why Swarms Do Not Change The Boundary

Buccet does not need a second control system for swarms.

If many protected processes or agents hit the same unresolved target:

- the hooks still freeze and hold
- one Buccet brain groups matching requests together
- one lawful approval or denial resolves that whole group
- the same law body, rails, walls, scope truth, and ledger still govern the outcome

Swarm scale does not create a new exception path. It is still one boundary system, not a special swarm override.

## How Skills And Sources Enter Buccet

There are two different intake paths, and they do different jobs.

### 1. External skills and workflows become rules

If you find a skill, template, or workflow in a source catalog, you bring the raw material into Buccet's rule layer.

Example sources:

- SkillsMP
- AITmpl Skills
- SkillHub
- AgentSkills

Fast openers:

```bash
buccet upl sources --open skillsmp
buccet upl sources --open aitmpl
buccet upl sources --open skillhub
buccet upl sources --open agentskills
```

Then the flow is:

1. pick the skill or workflow you want
2. copy the real source material
3. paste it into the allow side or the block side
4. sync it
5. Buccet compiles it into the live rulebook

That copied source material can be:

- raw skill text
- `SKILL.md`
- `README.md`
- extracted package markdown
- normal workflow descriptions

So the user does not need to hand-write law just to bring a skill into the system. Buccet parses the source material into standing rules.

### 2. Path sources add context, not permission

Path sources are different.

They do not decide what the agent is allowed to do. They only enrich a named workflow with domain context.

Example:

- the rulebook may allow research work inside a project
- a path source can attach books, notes, specs, or reference files to the `research` path
- that makes the path smarter without making it more powerful

Add path sources with:

```bash
buccet path sources add <path-name> <file...> [--domain <domain>]
```

So the split is:

- rules decide permission
- path sources add context
- denial still overrides acceptance
- the ledger records what happened

## How `buccet create` Builds Hyperspecialized Agents (Without Widening UPL)

Buccet has a creative face. `buccet create` is the operator-facing surface for building hyperspecialized agent teams that propose work; the same defense face still decides every action. Teams just propose. The creative wall denies team actions that would touch defense-face state.

There are two `create` flavors. Both produce a saved, named slice of the Buccet substrate.

```
buccet create <team-name> [--domain <domain>]
buccet create spend <team-name> --domain <domain> [--confirm-spend]
```

The first builds a **workshop team** — creative agents under the universal agent comprehension brain. The second builds a **SPEND Buccet** — financial agents under the spending-agent value-boundary brain. The brain is auto-injected per class. Workshop teams cannot be repurposed into spend teams or vice versa: the brain protocol is bound at create time.

### What a team actually is

From `src/teams/team-workshop.ts`, a team manifest carries:

- **a domain** and a slug
- **a roster of peer agents**, each with: title, specialty, model hint, an owned comprehension stage (`--owns-step`), a tool list, an assigned source slice, and a per-agent spend cap
- **a brain instance** — `base-agent-comprehension-process` for workshop teams, `spending-agent-value-boundary` for SPEND. Auto-injected. **`team-workshop.ts:1641` throws if you try to remove it: *"The brain source is auto-injected and cannot be removed from a team."*** The operator chooses the LLM that thinks inside this protocol; the protocol itself stays.
- **a path-source corpus** — the team's library
- **a UPL track snap reference** — taken at create time so audits can replay
- **per-agent conscience-spend trackers** — running spend + cap per peer

Teams live under `<home>/teams/<slug>/manifest.json` plus a `continuity/` dir for snapshots.

### The boundedness invariant

Adding skills, agents, or path sources to a team **does not widen the UPL track**. The team manifest is a slice *under* the UPL boundary, not above it. Every source intake routes through the boundary at runtime via Pi's `beforeToolCall` hook, mapped per transport:

- file sources → `fs.read`
- remote-LLM sources → `network.send`
- local-LLM sources → `tool.exec`
- HTTP-API sources (RAG / vectors) → `network.send`
- engine sources (Pi or custom) → tool dispatch surface, each individually gated

`pi-adapter.ts:34` imports `enforceBoundaryProposal` directly. Every Pi tool dispatch traverses that function. There is no path where a newly added source picks up authority that wasn't already in UPL — the source is just another caller of the same gated dispatch path.

### Path-source intake — what happens at the moment of attach

When `buccet create add-source` accepts a source, `buildTeamSourceCheckpoint` in `src/context/path-source-checkpoints.ts:262` runs:

1. **Normalize** — CRLF → LF, deterministic byte order
2. **Hash** — SHA-256 over `sourceId::title::kind::bodyHash` produces the digest
3. **Compress** — brotli + base64, stored compactly
4. **Segment into stable regions** — fixed line spans, each given a stable address (e.g. `sourceId:L1-L40`), region id, hash, and 240-byte preview
5. **Persist** under the team's checkpoint root

This is what makes sources addressable, verifiable, and replayable. A peer agent doesn't get the whole library; it gets a constrained set of region handles (`buildTeamPeerTaskGraph` line 727: *"Use only your assigned projection region handles plus whole-view context."*) with required readiness `["team-ready", "projection-opened", "upl-bound"]`.

### Pi as the active map — model portability

Pi (`@mariozechner/pi-agent-core` + `@mariozechner/pi-ai`) is the singular **HANDS** of every team. From the layered architecture comment at the top of `pi-adapter.ts`:

> BRAIN = brain protocol path source + AI/LLM path source + Library path sources. *Brain proposes; never mutates UPL.*
> UPL = standing law; allow / deny / ask operator.
> HANDS = Pi. *Pi receives the user input, packages it with the brain protocol + library + UPL track snap, calls the AI, and dispatches the AI's proposed actions. Each dispatch traverses Buccet's boundary via `beforeToolCall` → `enforceBoundaryProposal`.*

The packaging is the active map: input + brain protocol + library projection handles + UPL track snap. Because Pi does the packaging, the AI/LLM is a path source like any other — swap the model and the next one picks up the exact same packet. No model-specific context is hidden inside the AI; it lives in the package Pi assembles.

This is what gives Buccet model portability. A team running on Claude can hand off to GPT, Gemini, Grok, a local Llama, or any other LLM transport — the brain protocol, library handles, UPL track snap, and ledger trail are identical inputs to whichever model takes the next pass. The operator changes one path source ref; the team continues.

### The persistent brain in every Buccet

Two layers of "brain" exist on every team:

- **The brain protocol path source** — auto-injected, immutable. Workshop = `base-agent-comprehension-process`. SPEND = `spending-agent-value-boundary`. This is the cognitive framework: how the team comprehends a request, structures stages, and runs the spend boundary. It coordinates the team's peers under one shared shape.
- **The AI/LLM path source** — operator-chosen. Add via `buccet create add-source <team> --remote <provider>` or `--local <provider>`. This is the model doing the thinking inside the brain protocol.

The first is permanent because removing it would let an unconstrained LLM define its own comprehension stages and spend logic — that's the failure mode Buccet is built to prevent. The second is the operator's call, swappable any time.

`buccet create cockpit` shows every team running across the substrate: brain status, active peers, waiting peers, blocked peers, teams needing attention. Coordination is observable.

### Open-source proves the pattern; enterprise scales it

The open-source core proves that a hyperspecialized team — agents, skills, sources, brain, hands — can be built and run with full UPL enforcement, full ledger trail, and zero permission widening. One team at a time. Reproducibly.

The enterprise layer is for organizations running thousands or millions of these teams in parallel: dashboards, organization-wide policy, compliance evidence, resource governance for spend / token burn / reasoning depth, integrations with internal systems. The constitutional core is free; what organizations pay for is the operational layer above it.

## How Buccet Handles Flooding And Cost

Buccet does not wait for an agent to wake up, think, and spend money before trying to defend itself.

Inbound pressure is governed first. The input admission boundary evaluates velocity, density, mass, and weak provenance. If a source looks hostile or starts a DDoS-style flood against the system, Buccet can deny it or drop it into a tarpit before the brain wakes.

Outbound pressure is governed too. The motion governor uses velocity, mass, and action weight so dangerous actions cost more than lightweight reads. That means repeated tool execution, destructive file motion, or heavy outbound sending burns through the session budget faster than safe low-impact work.

In Buccet, cost governance is structural. It is governed as weighted inbound work and weighted outbound motion, not just as provider token billing after the fact.

So the system is not only deciding "is this allowed." It is also deciding whether the inbound load, outbound force, and process shape are acceptable before consequence or spend expands.

## What Buccet Enforces

The same live rulebook governs:

- chat and output emission
- filesystem motion
- process execution
- network and recipient sends
- database actions
- system and credential access

The runtime returns only:

- `ALLOW`
- `DENY`
- `REQUIRE_APPROVAL`

## Open-Source World

Agent Buccet is built for the open-source world as much as the closed one.

Open-source builders should not have to choose between freedom and responsibility. With Agent Buccet, open systems can ship with visible boundaries, enforceable consequence control, and durable proof of what was allowed, denied, contained, or stopped.

This means open-source teams can show, not just claim, that their agent deployments are governed:

- what boundaries exist
- what actions were allowed or denied
- what payload physics were enforced
- what input was blocked before the brain woke
- what output was stopped before consequence landed
- what the ledger recorded from first input to final consequence

Agent Buccet does not ask the world to blindly trust open systems. It gives open systems a way to demonstrate bounded, auditable, enforceable behavior in the real world.

Build with it. Ship with it. Extend it. Defend your agents with it.

## Product Shape

Buccet is not a new agent framework.

It is the control body under the agent stack you already run:

- Claude SDK
- Claude Code style workflows
- OpenAI Agents
- LangGraph
- capability-dense agent shells
- NeMo / NemoClaw style runtimes
- custom tool-using agents

Workflows organize repeatable safe work. Attached sources add context without adding permission. The user rulebook stays the authority. Blocked rules override allowed rules.

## Closed-Source World

Closed-source teams should not have to choose between capability and control. With Agent Buccet, private systems can bind internal policy, compliance rules, operating procedures, and business constraints at the same consequence boundaries where agent behavior becomes real.

This means closed-source teams can keep their own stack, their own models, and their own internal policies while still making those constraints enforceable:

- internal policy can become standing runtime rules
- private operating rules can compile into enforceable action controls
- approval and denial can be carried as durable runtime rules
- output, action, input-admission, and payload-physics boundaries can all be governed without exposing internal systems
- the ledger can prove what was allowed, denied, contained, or stopped inside private deployments

Agent Buccet does not ask closed teams to replace their existing safety stack. It gives them a way to bind their own safety intent at consequence time, inside the systems they already own.

## For Teams And Organizations

Agent Buccet Enterprise is the organizational operating layer being built above the open-source core.

The open-source core is the live consequence boundary. The enterprise layer is the organizational control plane being built above it.

The open-source runtime gives you the constitutional core:

- live User Path Law (UPL), where prior human judgment becomes standing runtime law
- denial-over-acceptance enforcement, with allow rails, deny walls, and UPL Traffic keeping yes on yes and no on no
- governed boundaries across action, chat, input admission, payload physics, approval, and ledger surfaces
- paths, path sources, and path memory for repeatable bounded workflows, with skill intake, custom skill intake, and path-source enrichment that let users create specialized agents without widening permission
- witness, ledger, and release-proof surfaces for evidence, audit, replay, and accountability
- interactive mode, standing-law mode, and 24/7 headless operation on the same control body
- swarm grouping and governed multi-agent resolution under the same law body
- governed control over tool use, files, network, database, system access, and output consequence
- portable bounded transport — pack a fully governed workload, ship it to any machine, and run it with the same enforcement, isolation, and law intact on arrival

These enterprise-scale surfaces are being built for organizations that need Buccet at operational scale:

- dashboards and operator visibility across every Buccet running in an organization
- organization-wide multi-agent and multi-swarm governance — managing thousands of Buccets under one policy surface
- organization-wide policy, default pack, and deployment controls
- resource governance for spend, token burn, reasoning depth, path-source scale, and job-specific swarm allocation, including enterprise spend governance for payment-capable agents
- integrations with internal systems, enterprise workflows, and environment-specific rollout support
- compliance-oriented evidence handling for audit trails, replay, checkpoints, rollups, and organizational accountability

The open-source core is live now. The security is free. What organizations pay for is the organizational scale layer: dashboards, organizational policy control, compliance-oriented evidence handling, and governance controls for teams running Buccet at production depth across thousands or millions of agents.

Early teams, commercial partners, and design partners can reach out at [ryangat@lmlsystemlayer.com](mailto:ryangat@lmlsystemlayer.com).

## Docs

Start here:

- [Docs Home](README.md)
- [Quickstart](quickstart.md)
- [Security Model](security-model.md)
- [Current Limits](current-limits.md)
- [MCP Server Guide](guides/mcp-server.md)
