# Runtime Boundaries and UPL Tracks

Agent Buccet is a governed runtime for AI agents.

Its job is not to prove that a model is safe. Its job is to prove that unauthorized action does not become authority at runtime.

Agents can propose. They cannot authorize.

---

## Kernel Boundary and Traffic Control

Agent Buccet sits where agent intent becomes operating-system, network, file, shell, API, chat, spend, or workflow consequence.

At that point, the question is no longer:

> What did the model mean?

The question is:

> Is this action allowed to cross the boundary?

Buccet treats every consequential action as traffic.

That traffic may be:

- file traffic: read, write, delete, move, overwrite
- environment traffic: secrets, tokens, `.env`, API keys
- shell traffic: command execution, subprocesses, package managers, scripts
- network traffic: outbound calls, webhooks, telemetry, API requests
- chat/output traffic: messages, disclosures, external communication
- spend traffic: purchases, invoices, subscriptions, metered usage
- workflow traffic: approvals, automation, task delegation, retries
- swarm traffic: agent-to-agent communication, fanout, shared state
- law traffic: attempts to create, weaken, mutate, or bypass rules

The kernel boundary is the line between proposal and consequence.

Agents can generate proposals.  
They cannot authorize crossing.

---

## `buccet create`: Turning Intent into UPL Tracks

`buccet create` does not hand an agent raw power.

It creates a governed track.

A track is a bounded lane of action with explicit law attached to it.

Examples:

```bash
buccet create spend
buccet create source
buccet create workflow
buccet create transport
buccet create automation
buccet create approval
buccet create path
```

Each track defines what kind of traffic may exist, who may use it, what it is for, and what proof must be produced.

A spend track is not:

> The agent can spend money.

It is:

- principal: who is responsible
- purpose: why the spend exists
- cap: maximum amount
- vendor/recipient: where money may go
- risk tier: how dangerous the action is
- recurrence: whether it can happen once or repeatedly
- approval mode: auto, ask-first, deny, dual approval, headless under cap
- time window: when the lane is valid
- proof: what must be recorded
- revocation: how the lane can be killed

A source track is not:

> The agent can trust this input.

It is:

- what source is admitted
- what authority the source has
- whether it may instruct, inform, cite, or only provide context
- whether it can influence tools
- whether it can trigger external actions
- whether it can cross into another workflow

A workflow track is not:

> The agent can do the task.

It is:

- allowed path
- allowed tools
- allowed targets
- required checkpoints
- approval gates
- rollback rules
- output boundaries
- ledger requirements

`buccet create` turns vague human permission into a typed User Path Law.

The track becomes the route.  
UPL becomes the traffic law.  
The runtime becomes the enforcement point.

---

## Traffic Control Model

Buccet does not only ask whether an action is good or bad.

It asks:

1. What kind of traffic is this?
2. Which track is it trying to use?
3. Who is the principal?
4. What is the purpose?
5. What target will be affected?
6. What law applies?
7. Is the action inside the lane?
8. Does it require approval?
9. What proof must be written?
10. Should this action be allowed, denied, deferred, or escalated?

This makes agent governance less like a prompt and more like air-traffic control for consequences.

The agent may request takeoff.

Buccet checks the runway, route, clearance, cargo, identity, destination, limits, and rules of flight.

No clearance, no crossing.

---

## Core Distinction

Most agent systems give tools to agents.

Agent Buccet creates governed surfaces first, then lets agents propose traffic across them.

That is the difference between:

> This agent has network access.

and:

> This agent may send this kind of data, to this class of destination, for this purpose, under this approval mode, within this limit, with this proof trail.

The first is permission.

The second is law.

---

## Boundary Surfaces

### Files

Reads, writes, deletes, moves, overwrites, archives, and other file mutations.

A file boundary asks whether the target is inside scope, whether the action is destructive, whether a prior law exists, and what proof must be written.

### Environment and Secrets

API keys, tokens, `.env`, credentials, config, and sensitive runtime variables.

Secrets are denied by default unless a track explicitly grants bounded access for a scoped purpose.

### Shell and Commands

Command execution, subprocesses, package managers, scripts, `curl`, build tools, and local automation.

Shell access is treated as high-risk because a command can become network, file, process, or credential traffic.

### Network

Outbound requests, webhooks, telemetry, external API calls, downloads, uploads, and data egress.

Network traffic is disclosure-capable by default. It must be justified by source, destination, purpose, approval mode, and proof.

### Chat and Output

Agent messages, external communication, chat emission, user-visible output, and cross-channel disclosure.

Output is a consequence when it can reveal data, trigger action, impersonate a user, or move information across boundaries.

### Input Admission

Sources, documents, URLs, code comments, retrieved context, issue text, emails, PDFs, and other inbound material.

Input can inform an agent, but it should not automatically gain authority to instruct tools.

### Spend

Budgets, purchases, invoices, subscriptions, cloud resources, metered APIs, GPU usage, retries, and recurring costs.

Spend is a consequence. A spend track must bind principal, purpose, cap, recurrence, risk, approval, and proof.

### Law Mutation

Attempts to create, edit, weaken, delete, bypass, reinterpret, or self-authorize rules.

Law mutation is one of the most sensitive surfaces because an agent that can weaken the boundary can turn later proposals into unauthorized authority.

### Swarms

Agent-to-agent communication, delegation, fanout, shared state, shared tools, cross-agent persuasion, and role drift.

Swarms need isolation and traffic control because one compromised agent can become a source of authority for another.

### Headless Automation

Actions that run without live approval.

Headless mode is not open autonomy. It is pre-authorized autonomy inside a bounded track.

---

## User Path Laws

A User Path Law binds action to enforceable context.

A mature UPL should describe:

- principal
- purpose
- action
- target
- bucket
- cap
- risk
- recurrence
- approval mode
- proof
- duration
- revocation
- source intent

Natural language alone is not authority.

Authority emerges only when user intent is transformed into a validated law and enforced by the runtime.

---

## Approval Modes

Agent Buccet can support multiple approval modes:

- allow once
- allow as law
- deny once
- deny as law
- ask first
- forbidden
- headless allowed under cap
- dual approval / enterprise approval
- emergency break-glass with proof

The point is not only to block.

The point is to make allowed action precise, scoped, revocable, and auditable.

---

## Witness Ledger

Every denial, approval, escalation, blocked action, allowed action, simulated spend event, and law mutation attempt should leave proof.

After an incident, the important questions are:

- what action was proposed?
- which law applied?
- who or what was the principal?
- what target would have been affected?
- was it allowed, denied, deferred, or escalated?
- who authorized it?
- what proof exists?
- what failure class does it map back to?

The witness ledger turns runtime behavior into evidence.

---

## Gauntlet and Bootcamp Testing

Agent Buccet should be tested as a hostile proving ground for runtime intent enforcement.

The result sought is not hope.

The result sought is evidence.

### Lane 1: Forbidden-Action Pressure

Try to force prohibited actions:

- delete protected files
- read secrets
- exfiltrate data
- bypass approvals
- use revoked tools
- spend above cap
- impersonate the user
- communicate across isolated agents
- mutate or weaken law

Attack variants include direct prompt injection, indirect prompt injection, encoded instructions, fake approvals, hostile tool outputs, broken JSON, role confusion, urgency framing, and swarm collusion.

### Lane 2: Authorized-Action Fidelity

Make sure legitimate user-approved actions still work.

A runtime that only says no is not governance.

It is paralysis.

Authorized-action tests should include one-time grants, temporary permissions, revocations, conditional allowances, edge cases, and amended rules.

### Lane 3: Finance Simulation

Use fake ledgers, fake vendors, fake invoices, balances, approval states, and settlement events to test spend boundaries without exposing real capital.

Every transaction remains a proposed state transition until policy evaluation endorses it.

### Lane 4: Source Patch Replay

Every discovered failure should become a permanent regression case.

After a patch is applied, the exact exploit family and neighboring variants should be replayed automatically.

The loop continues until the runtime proves the fix held at the source.

---

## Relationship to the AI Failure Periodic Table

The **AI Failure Periodic Table** names the failure.

**Daily Driver MCP** brings the failure map into Cursor, Claude Desktop, and other MCP-compatible workflows.

**Agent Buccet** enforces the boundary.

The **witness ledger** records what happened.

```text
failure → known/unknown → class/gap → boundary → UPL / user custom rules → Buccet enforcement → proof ledger → loop begins again
```

Known failures map to existing boundaries.

Unknown failures become new structure.
