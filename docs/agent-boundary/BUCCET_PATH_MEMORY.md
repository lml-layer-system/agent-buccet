# Buccet Path Memory

This is the Buccet-native memory/orchestration layer for cutting recursive loops at the core.

It is not a second law engine.
It is not a second authority system.
It is a finite path-memory substrate that keeps higher-order work forward-only, reusable, and terminating.

## Purpose

The ancestor pattern is simple:

- infinite user requests should not produce infinite agent loops
- work should collapse into a finite path
- each stage should get one turn
- context should move forward
- path changes should spawn a new path instead of recursively mutating the current one

Buccet Path Memory is that collapse.

## What It Is

Buccet Path Memory provides:

- fixed path templates
- explicit domain labels per path
- path sources as path-level domain context boxes
- specialist agent rosters per path
- fixed stage order per path
- stage-to-agent ownership
- agent-local memory banks collapsed from shared path sources
- path/agent/stage UPL bindings
- exact path existence checks
- one active stage at a time
- reusable formation state
- explicit path switching
- path snapshots for persistence
- live formation views

## What It Is Not

It does not:

- authorize actions
- bypass UPL
- widen scope
- replace Bodyguard
- replace the ledger

Every real consequence still crosses the same Buccet boundary.

## The Built-In Paths

The default library is:

- `messaging`
- `search`
- `coding`
- `research`
- `automation`
- `files`
- `analysis`
- `general`

Each path has:

- a domain
- a title
- a model hint
- a path source box
- a law subset
- a tool subset
- an agent roster
- a fixed list of stages

Each stage names the exact specialist agent or agents that own that stage.
Each path and agent also carries the UPL surface it is supposed to stay inside.
Each path can also carry domain-specific path sources that enrich the work without changing permissions.

That means Buccet can say:

- this path belongs to this domain
- these are the agents assigned to it
- these are the domain sources enriching it
- this stage is currently owned by these agents
- this is the lawful UPL surface those agents are operating inside

The count is open-ended.
You can define any number of specialist agents for a path as long as the path remains finite and the agents remain UPL-bound.
You can also load any number of domain sources into the path source box to make those agents hyper-specialized without widening UPL.

Path sources are not UPL.
They do not authorize anything.
They do not widen scope.
They enrich the domain context available inside the fixed path.

The path layer does not need to "think about the no side."
It only sees lawful structure.
The denial side stays underneath as the protective override on anything outside lawful motion.

The core path engine is not supposed to hunt for a path.
It does an exact check:

- if the requested path exists in the library, instantiate it
- if it does not exist, materialize that exact path and lock it into the library

That makes path activation basically a boolean lookup plus exact path materialization, not a recursive search problem.

## Core Invariants

Buccet Path Memory enforces:

- one active stage at a time
- any number of specialist agents can be assigned to a path
- each stage must have explicit agent ownership
- no stage calls itself
- no backtracking to an earlier stage
- no recursive re-entry after terminal state
- mode switch means new formation, not mutation of the running one
- every formation terminates in finite steps because the stage list is finite

## Example

`search` collapses to:

1. `query`
2. `safety`
3. `search`
4. `extract`
5. `summarize`

`coding` collapses to:

1. `requirements`
2. `plan`
3. `safety`
4. `build`
5. `test`
6. `fix`
7. `finalize`

Each stage gets one turn.
The next stage activates only after the current one resolves.

Each stage also has named owners.
Example:

- `query` -> `query-framer`
- `search` -> `search-runner`
- `extract` -> `fact-extractor`
- `summarize` -> `result-synthesizer` + `search-safety`

## Memory-Heavy, Compute-Light

This layer stores formations and reuses them.

That means:

- path structure is remembered
- path domain is remembered
- path sources are remembered
- specialist roster is remembered
- agent-local memory banks are remembered
- UPL binding surface is remembered
- previous context can be transferred
- switching paths keeps continuity
- the system does not need to recursively re-plan the whole task every turn

## Path Switching

When a request moves out of the current path:

- Buccet classifies the new request
- the current formation is preserved as memory
- a new formation is instantiated for the new path
- previous context can be carried forward

This is how Buccet avoids recursive loop behavior at the orchestration layer.

## API Surface

Main entry points:

- `classifyBuccetPathRequest(...)` for UI suggestion only, not core authority
- `createBuccetPathLibrary(...)`
- `createBuccetPathTemplate(...)`
- `hasBuccetPath(...)`
- `getBuccetPathTemplate(...)`
- `ensureBuccetPathInLibrary(...)`
- `snapshotBuccetPathLibrary(...)`
- `restoreBuccetPathLibrary(...)`
- `saveBuccetPathLibrary(...)`
- `loadBuccetPathLibrary(...)`
- `canInstantiateBuccetFormation(...)`
- `instantiateBuccetFormation(...)`
- `advanceBuccetFormation(...)`
- `getCurrentBuccetStageAgents(...)`
- `describeBuccetFormationLiveView(...)`
- `renderBuccetFormationLiveView(...)`
- `detectBuccetPathSwitch(...)`
- `switchBuccetFormation(...)`
- `BuccetPathMemoryStore`
- `saveBuccetPathMemorySnapshot(...)`
- `loadBuccetPathMemorySnapshot(...)`

## CLI Surface

The user-facing path-source flow is:

- `buccet path list`
- `buccet path show <path-name>`
- `buccet path sources add <path-name> <file...> [--domain <domain>]`
- `buccet path sources list <path-name>`

That is the NotebookLM-style source box for a path.
It persists the path library and enriches the path with domain material without changing UPL.

## Position In The System

Buccet Path Memory sits beside the boundary core.

It gives higher-order work a finite execution structure, while:

- Gravity still catches
- Bodyguard still decides
- UPL still governs
- the ledger still witnesses

So the loop cut happens structurally before “one giant agent” behavior can form, but without changing the core authority doctrine.

## Live-Time View

The live view is meant to show exactly what is happening:

- which path is active
- which domain it belongs to
- which path sources are enriching it
- how many agents are assigned
- which stage is active now
- which agents own that stage
- which source slice those agents are using
- what UPL action kinds and targets they are bound to
- the event timeline of the formation so far

That makes the orchestration visible instead of hidden.
It shows lawful work in motion, not a second authority system.
