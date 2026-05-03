# Gemini Team Runtime Spec

## Purpose

This document defines the intended runtime for the Gemini branch team/workshop face.

It is not a new system.

It is the same Agent Buccet body:

- same UPL
- same gravity / novelty / swarm / bodyguard boundaries
- same ledger and witness surfaces
- same deny and approval model

What changes is the operator-facing creative/workshop runtime:

- input enters Pi
- Pi opens the whole-view of the team's path-source field
- the whole is fractured into specialist regions
- each peer runs the same bounded comprehension process on its own region
- Pi reconciles and speaks for the group
- every action proposal remains bounded by UPL

## No Drift

This runtime must not drift into:

- a second law engine
- a second approval body
- a second boundary stack
- a creative-side exception lane
- a team runtime that can mutate UPL directly

The team proposes.
Buccet law decides.
Pi coordinates and speaks.

## Current Branch Truth

The Gemini branch already has these real pieces:

- persisted teams and peer manifests
- typed path-source transports
- an auto-injected comprehension source
- Pi as execution engine
- brain-pass session startup and teardown
- Pi tool calls routed through `enforceBoundaryProposal`
- creative-wall and user-telemetry denial classes

This runtime also assumes the path-source checkpoint layer described in:

- `docs/specs/path-source-checkpoints.md`

The current live gap is:

- `ask` / `enter` still select the first peer
- peer specialization is stored, but not yet used as the runtime decomposition model
- `swarm view` presents a governance surface that is ahead of the runtime telemetry behind it

This spec defines the next pass that closes that gap.

## Canonical Runtime

The intended team runtime is:

`Input -> Pi -> Whole-View -> Fracture -> Specialist Team -> Pi Reconcile -> Pi Render -> User`

For side effects:

`Peer Proposal -> Pi -> UPL Verdict -> Allow | Deny | Queue -> Continue | Refuse`

The whole-view is prepared before live user input starts.

Path-source ingestion and checkpointing should already have produced the source field, whole-view handles, and fracture-ready projection surface. The live run starts on top of a prepared map, not by rebuilding the map from scratch inside the same turn.

### Step 1. Intake

The user enters a request through:

- `buccet ask <team> "..."`
- `buccet enter <team>`

Pi receives the request as the hands/coordinator surface.

Pi does not solve the whole task itself.
Pi does not spend the first live turn recursively searching for the world it is about to inspect.

### Step 2. Whole-View Open

Pi opens the team's path-source field as a whole-view projection.

This is not a giant prompt.

It is an externalized working surface where:

- the whole source field is visible
- stable locations are already fixed
- Pi can zoom instantly into any needed region

### Step 3. Team Context Build

Pi constructs a bounded team run context:

- raw user input
- team manifest
- peer roster
- each peer's specialty
- each peer's `ownsStep`
- each peer's `sourceIds`
- team path-source corpus
- whole-view projection handles
- auto-injected comprehension process
- UPL track snap reference
- live runtime boundary session

### Step 4. Fracture

Pi does not treat the whole input as one monolithic task.

Pi fractures the whole into specialist work regions.

Fracture must use:

- intent class
- required comprehension stages
- domain keywords
- required sources
- high-risk consequence class
- explicit user constraints
- whole-view structural relations
- path-source region boundaries
- stable dependency/interface edges

Fracture must not be:

- "pick the first peer"
- "broadcast blindly and accept the fastest answer"

The output of fracture is a peer task graph.

## Peer Task Graph

Each peer task packet should contain:

- `teamId`
- `runId`
- `peerId`
- `specialty`
- `ownsStep`
- `taskSlice`
- `inputExcerpt`
- `declaredIntent`
- `constraints`
- `sourceIds`
- `projectionHandles`
- `requiredReadiness`
- `upstreamDependencies`
- `allowedOutputs`
- `allowedActionKinds`

This packet is bounded context, not ambient authority.

## Specialist Execution Rule

Every relevant peer receives the request through its own slice:

- its specialty
- its owned stage
- its path-source subset
- its opened projection region
- the same comprehension law
- the same UPL boundedness

The peer then runs the comprehension process on its slice:

1. receive
2. represent
3. infer intent
4. bind constraints
5. select method
6. acquire/use knowledge
7. transform
8. validate
9. render
10. return

The peer does not return a final user answer by default.
It returns a structured peer result to Pi.

## Peer Result Contract

Each peer result should contain:

- `peerId`
- `runId`
- `ownsStep`
- `specialty`
- `resultKind`
- `content`
- `confidence`
- `sourcesUsed`
- `assumptions`
- `openQuestions`
- `validationState`
- `freshness`
- `proposedActions`
- `conflictsRaised`

Where:

- `resultKind` may be `intent`, `research`, `constraint`, `plan`, `validation`, `render-fragment`, `refusal`, or `blocked`
- `proposedActions` are boundary proposals only, not executed side effects

## Pi Responsibilities

Pi is:

- the hands
- the bounded orchestrator
- the spokesperson

Pi is not:

- the whole specialist team
- the source of law
- the bypass around UPL

Pi must:

1. fan out peer packets
2. collect peer results
3. reconcile conflicts
4. route any side-effect proposal through Buccet law
5. render the final group answer
6. emit the final answer as the group spokesperson

Pi must not become the whole reasoning agent.
Pi is the hands, reconciler, and spokesperson for the peer field.

## Reconciliation

Pi must reconcile peer results before rendering.

Reconciliation must check:

- intent alignment
- source provenance
- freshness
- validation state
- contradictions between peers
- missing required stages
- domain precedence
- high-risk action readiness

Pi must not treat:

- partial local truth
- stale peer output
- unvalidated research
- a single confident peer

as sufficient final truth.

## Tool Use Rule

Tool motion is not decided by recursive search over possibilities.

The peer or Pi proposes the action shape it can lawfully try.
Buccet looks at the UPL and existing boundary law.
The proposal is then:

- allowed
- denied
- queued

So the runtime should behave like:

- try the lawful move
- get stopped if not lawful
- adapt or refuse

not:

- recursively search for authority
- recursively negotiate tool legality
- treat uncertainty as implied permission

## Domain Precedence

When peers disagree, Pi must respect precedence.

Minimum precedence rules:

- user non-negotiable beats all lower preferences
- security red blocks unsafe continuation
- legal/compliance red blocks prohibited continuation
- validation failure blocks release-grade claims
- unresolved intent blocks irreversible action

Pi must escalate unresolved red conflicts.
Pi must not hide them in the final answer.

## UPL Bounding

Every side effect remains bounded by the same bodyguard path.

That includes:

- file reads and writes
- tool execution
- network sends
- comm sends
- spend
- chat emission

The law remains:

- peers propose
- Pi dispatches
- Buccet decides

No peer receives direct execution authority.

## Creative Wall

The team/workshop face remains creative-side.

It must not:

- mutate UPL directly
- widen scope directly
- forge verdicts
- claim self-approval
- tamper with ledger or witness
- kill or bypass defense-face processes

Pi final rendering must also remain bounded by the creative-wall denial surface.

## Telemetry Boundary

Outbound disclosure remains denied by default unless lawful.

Remote-model use, remote API use, and exfil-like behavior must remain visible as:

- bounded network motion
- bounded tool motion
- bounded spend motion

No team path-source or peer result upgrades unknown outbound disclosure into silent authority.

## Runtime State Machine

Canonical run states:

1. `received`
2. `decomposed`
3. `peer_dispatched`
4. `peer_collecting`
5. `reconciling`
6. `awaiting_boundary_verdict`
7. `rendering`
8. `completed`
9. `blocked`
10. `refused`
11. `failed`

Each state transition must be witnessable.

## Required Gemini Runtime Changes

### 1. Replace First-Peer Selection

Current branch behavior selects the first peer.

That must be replaced with:

- peer selection by `ownsStep`
- peer selection by specialty
- peer selection by source coverage
- peer selection by readiness and status

### 2. Add Whole-View + Fracture Runtime

`ask` / `enter` must open the whole-view path-source field and generate a fracture map for the run.

### 3. Add Team Fan-Out

`ask` / `enter` must create peer task packets and dispatch them to all relevant specialists for the run.

### 4. Add Structured Peer Return

Peer output must not be an unstructured final answer only.
It must be a typed peer result object.

### 5. Add Real Reconciliation

Pi must merge and arbitrate the peer field before speaking.

### 6. Make Swarm View Truthful

`swarm view` must read real runtime telemetry:

- peer dispatched
- peer responded
- peer blocked
- peer denied
- peer timed out
- peer spend updated
- peer source usage
- peer conflict raised

### 7. Persist Per-Peer Spend

`spentNormalized` must be updated from actual boundary-admitted spend events.

### 8. Implement Or Remove Declared `http-api`

If `http-api` remains in the public transport model, it must have:

- manifest registration
- UPL corridor shape
- runtime use path
- contracts

Otherwise it should be removed from the declared transport list until ready.

## Acceptance Criteria

Gemini runtime is complete when all of these are true:

1. `ask` does not route by first-peer fallback.
2. The whole path-source field opens as a whole-view projection.
3. Relevant specialists receive peer task packets from fracture regions.
4. Peer outputs are structured and separately witnessable.
5. Pi renders only after reconciliation.
6. All side effects still traverse Buccet boundary law.
7. `swarm view` reflects actual peer runtime telemetry.
8. Per-peer spend is real, not static manifest data.
9. Creative wall still blocks defense-state mutation.
10. Remote/local/engine transports remain bounded by seeded UPL lanes.

## Tightest Statement

Gemini should run as:

`Input -> Pi -> Whole-View -> Fracture -> Specialist Peer Field -> Pi Reconcile -> Pi Speak`

with:

`Every proposed consequence -> UPL Verdict`

Pi is the hands and spokesperson.
The team is the cognition field.
Buccet remains the law.
