# Agent Buccet Entry Surface

## What This Pass Is

This is the public spec for the next product pass after the final boundary pass.

The goal is not new law categories.
The goal is not a second engine.
The goal is not a parallel runtime.

The goal is frictionless entry.

Agent Buccet already has the boundary body:

- one Buccet
- one UPL
- one bodyguard path
- one intercept path
- one ledger

This pass adds easier ways for users to enter that same body.

## Rule

Every entry surface must preserve the same enforcement chain:

- same UPL
- same tracks
- same bodyguard
- same denial side
- same witness trail

No entry surface may introduce:

- a lighter policy engine
- a host-specific exception engine
- a bypass around the denial side
- a separate approval path

MCP already proves the pattern:

- easy host attachment
- same Buccet underneath

The remaining work is to add more doors with the same property.

## What Survives

The public entry problem reduces to four doors:

1. hosted install
2. SDK middleware wrapper
3. host-native editor and agent adapters
4. git and GitHub egress gate

Everything else is either:

- packaging polish
- host-specific detail inside one of these doors
- or later enterprise control-plane work above them

## Door 1: Hosted Install

### Purpose

Let a user install and initialize Buccet without cloning the repo or hand-wiring local setup.

### User story

The user should be able to land on a public install surface, run one command, and get:

- the `buccet` launcher
- initialized local state
- a working default runtime
- the same law body and denial side

### Required properties

- same package surface as the shipped release
- same hook/bootstrap integrity checks
- same install proof as local shell install
- fail closed if the runtime cannot be initialized correctly

### Proof targets

- hosted install succeeds on a clean machine
- hosted install produces the same `buccet` runtime as local install
- first-run cold boot works without manual repair
- install cannot silently fall into an unprotected fake mode

## Door 2: SDK Middleware Wrapper

### Purpose

Let developers wrap an existing agent loop with Buccet in a few lines, without redesigning their stack.

### User story

A developer already has an agent runtime:

- OpenAI Agents SDK
- Claude SDK
- LangGraph
- custom loop

They should be able to add Buccet at the proposal boundary and keep:

- the same host framework
- the same tools
- the same application architecture

while moving consequence through the Buccet body.

### Required properties

- proposal normalization into the shared adapter intake shape
- same law evaluation path as MCP and CLI
- no private feeder shapes per framework
- same ledger and provenance semantics

### Proof targets

- wrapped SDK tool calls hit the same allow, deny, and approval outcomes as direct Buccet execution
- wrapped outbound chat, network, and tool actions are still caught by denial-side law
- framework adapters cannot widen scope or suppress witness data

## Door 3: Host-Native Editor And Agent Adapters

### Purpose

Make Buccet feel native inside the hosts people already use.

### User story

A user should be able to attach Buccet to a host like:

- Claude Desktop / Claude Code style environments
- Cursor
- VS Code agent surfaces
- other host shells that already manage tools and context

without needing to think about raw transport configuration.

### Required properties

- same transport rule as MCP: host attachment changes transport, not authority
- one-command or one-click host attachment where possible
- host-specific install/uninstall path
- explicit health/status feedback inside the host

### Proof targets

- host-native attachment reaches the same enforcement chain as `buccet mcp`
- attach and detach flows are reversible
- a host cannot keep stale authority after Buccet is removed

## Door 4: Git And GitHub Egress Gate

### Purpose

Protect the most common developer outbound path for source and secret leaks.

### User story

A developer should not be able to accidentally move protected material out through:

- commit content
- push
- patch export
- pull request body
- issue body
- comment body

when that material is sealed by the Secrets Boundary.

### Required properties

- same Secrets Boundary denial side
- same custody model for protected source truth
- same deny and witness semantics across CLI and GitHub-connected surfaces
- no special “GitHub is trusted” escape hatch

### Proof targets

- protected source cannot be pushed or posted without lawful opening
- Git and GitHub helpers still use the same Buccet body
- secrets denial reasons remain inspectable in the ledger

## Shared Constraints

Every door in this pass must satisfy the same constraints:

- same Buccet
- same UPL
- same denial side
- same witness trail
- no second engine
- no host-specific policy fork

The door changes adoption friction.
It does not change authority.

## Non-Goals

This pass does not add:

- new boundary categories
- a second UPL
- enterprise custom boundary compilation
- special-case host policy engines
- host-specific exceptions to the denial side

Those are different layers of work.

## Build Order

The implementation order for the final door pass is:

1. hosted install
2. SDK middleware wrapper
3. host-native editor and agent adapters
4. git and GitHub egress gate

That order is intentional:

- hosted install is the biggest friction reducer
- SDK wrapping is the biggest developer adoption door
- host-native adapters make the product feel obvious
- git and GitHub egress makes the Secrets Boundary felt where leaks actually happen

## Success Condition

This pass is complete when a user can enter Agent Buccet through multiple surfaces with low friction and still hit:

- the same law body
- the same denial side
- the same approval path
- the same witness proof

The adoption door may change.
The protection body may not.
