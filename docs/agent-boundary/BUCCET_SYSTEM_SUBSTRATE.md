# Buccet System Substrate

This document captures the full snapped Agent Buccet system as a finite substrate without dropping the moving parts.

For the process that keeps collapsing open-ended authored growth into this executable substrate, see [Buccet Full System Body](BUCCET_META_EFUE_SUBSTRATE_PROCESS.md).

It is not a slogan.
It is not a summary.
It is the compressed execution substrate of the whole organism.

## Result

Agent Buccet compresses into:

- `6` substrate planes
- `3` terminals
- `4` consequence boundaries
- `1` finite lawful machine

This is a lossless snap at the system-architecture level.

## System Graph

The full Buccet system graph is:

```text
G = {
  bootstrap,
  install,
  runtime_store,
  intercept,
  hook,
  adapter_bridge,
  action_class_mapper,
  input_admission,
  scope,
  grants,
  path_law,
  base_laws,
  upl,
  document_import,
  track_extractor,
  expression_corridor,
  output_corridor,
  completion_corridor,
  action_corridor,
  governor,
  gravity,
  bodyguard,
  approvals,
  swarm,
  payload_physics,
  ledger,
  witness,
  release_witness,
  restart_fail_closed
}
```

## Snapped Substrate

The minimal finite substrate that preserves the full system is:

```text
BuccetSubstrate = {
  LifecyclePlane,
  AuthorityPlane,
  TranslationPlane,
  BoundaryPlane,
  ControlPlane,
  WitnessPlane
}
```

## The Six Planes

### 1. LifecyclePlane

Owns:
- install
- bootstrap
- init
- runtime store
- persistent state
- restart semantics
- fail-closed-on-dead-brain startup posture

Purpose:
- bring the organism into existence
- make protection available immediately
- keep the runtime alive correctly

### 2. AuthorityPlane

Owns:
- base laws
- UPL
- document/policy import
- Track Extractor input
- scope
- grants
- path law
- allow-as-law / deny-as-law

Purpose:
- define what is lawful

This is where:
- user is law
- company is law
- regulator is law
- document is law

### 3. TranslationPlane

Owns:
- framework adapters
- deep intercept mapping
- bridge/server mapping
- action class normalization
- OS/program/runtime reduction into finite Buccet actions

Purpose:
- collapse every stack into the same finite motion language

This is why platform, framework, and program type do not alter the doctrine.

### 4. BoundaryPlane

Owns:
- input admission boundary
- action boundary
- output boundary
- payload-physics boundary
- freeze / tarpit / hold / refuse surfaces

Purpose:
- ensure all consequence happens at real finite boundaries

### 5. ControlPlane

Owns:
- Track Extractor
- snapped corridors
- governor
- gravity
- bodyguard
- approvals
- swarm
- adjudication
- verdict application logic

Purpose:
- turn law into law-in-motion

### 6. WitnessPlane

Owns:
- ledger
- signatures
- checkpoints
- witness export
- release witness
- traceability

Purpose:
- prove the entire path after consequence

## The Three Terminals

The three terminals are the execution posture of the six planes.

In the product surface, these are logical roles, not a requirement to keep three physical windows open.

Default operator posture:
- one physical terminal
- `buccet console`
- shield, control, and witness rendered together

Optional split posture:
- `buccet hook status --watch`
- `buccet ledger --follow`

### Terminal 1

- TranslationPlane + BoundaryPlane contact edge
- catch
- freeze
- tarpit
- hold
- apply verdict

Invariant:
- no consequence lands before verdict

### Terminal 2

- AuthorityPlane + ControlPlane
- law evaluation
- command authority
- approval handling
- track enforcement

Invariant:
- only lawful motion survives

### Terminal 3

- WitnessPlane
- signed ledger
- proof
- release evidence

Invariant:
- every material consequence path is provable

LifecyclePlane underlies all three.

## The Four Consequence Boundaries

### 1. Input Admission Boundary

Before the brain wakes:
- velocity
- density
- mass
- provenance hostility
- tarpit / deny / ledger

### 2. Action Boundary

Every real action crosses here:
- filesystem
- process execution
- network / recipient sends
- database actions
- system / credential access

### 3. Output Boundary

Every outbound answer crosses here:
- chat output
- output corridor
- expression corridor
- completion corridor

### 4. Payload-Physics Boundary

What approved motion may physically become:
- cpu
- wall clock
- memory
- process count
- open files
- file size
- I/O controls where supported

## Policy Binding Surface

`UPL` is the universal policy binding surface.

Policies enter through:
- user law
- markdown documents
- imported company policy
- regulator policy
- guardrail policy
- shaped model policy expressed as law

Path:

1. policy/doc enters through `UPL`
2. Track Extractor kills everything that is not operative meaning
3. surviving meaning snaps into:
   - `expressionCorridor`
   - `outputCorridor`
   - `completionCorridor`
   - `actionCorridor`
4. standing law becomes runtime motion corridor
5. Buccet enforces that corridor at consequence time

There is no second adapter maze.
UPL is the binding path.

## Runtime Firing Order

For any event:

1. LifecyclePlane boots the organism
2. TranslationPlane maps raw surface into finite Buccet action classes
3. BoundaryPlane catches the event before consequence
4. Input Admission fires first when the event is inbound
5. Terminal 1 freezes the consequence path
6. Terminal 2 resolves through:
   - governor
   - base laws
   - scope / grants / path laws
   - UPL
   - tracks
   - gravity
   - bodyguard
7. verdict becomes exactly one of:
   - `ALLOW`
   - `DENY`
   - `REQUIRE_APPROVAL`
   - `TARPIT`
8. if approval becomes standing law:
   - UPL updates
   - tracks resnap
9. Terminal 1 applies verdict
10. Terminal 3 witnesses the path

## Lossless Mapping

Every named subsystem maps into the snapped substrate:

| Original Subsystem | Snapped Plane |
| --- | --- |
| install / bootstrap / runtime store / restart-fail-closed | LifecyclePlane |
| base laws / UPL / document import / scope / grants / path law / approval-as-law | AuthorityPlane |
| intercept / hook / adapter bridge / action mapper | TranslationPlane |
| input admission / action boundary / output boundary / payload physics contact surface | BoundaryPlane |
| Track Extractor / corridors / governor / gravity / bodyguard / approvals / swarm | ControlPlane |
| ledger / witness / release witness / checkpoints / traceability | WitnessPlane |

Nothing material is left outside the snap.

## Compression Statement

System-graph compression:

- named subsystem graph: ~`28-29` nodes
- snapped substrate: `6` planes

Approximate architecture compression:

```text
29 -> 6
compression ratio ~= 4.8:1
```

This is structural compression, not a benchmarked micro-timing claim.

## Invariants

The snapped substrate is only correct if all of these remain true:

- user is law
- documents become law through UPL
- law becomes motion through tracks
- partial snap is illegal
- no consequence before verdict
- fail closed on dead brain
- all material consequence paths witness
- translators may vary by platform, doctrine does not

## Executable Substrate

```text
SYSTEM AGENT_BUCCET

BOOT:
  install()
  init_runtime_store()
  init_ledger_and_witness()
  init_hook_or_bridge()
  init_intercept()
  init_bodyguard_gravity_governor()
  load_base_laws()
  load_upl()
  snap_tracks_from_upl()

POLICY_BIND(policy_doc):
  compiled_law = UPL.import(policy_doc)
  UPL.write(compiled_law)
  tracks = TrackExtractor.snap(compiled_law)
  activate(tracks)

ON_EVENT(raw_event):
  event = translate(raw_event)

  if event.kind == ingress:
    ingress_result = admission_check(event)
    if ingress_result in {DENY, TARPIT}:
      witness(event, ingress_result)
      stop

  freeze(event)

  verdict = adjudicate(
    event,
    base_laws,
    upl,
    tracks,
    scope,
    grants,
    governor,
    gravity,
    process_physics
  )

  if verdict == REQUIRE_APPROVAL:
    pending = freeze_pending(event)
    human_decision = await approval_terminal(pending)

    if human_decision in {ALLOW_AS_LAW, DENY_AS_LAW}:
      UPL.write(human_decision)
      tracks = TrackExtractor.snap(UPL)

    verdict = apply_human_decision(human_decision)

  apply(verdict, event)
  witness(event, verdict)
```

## Final Definition

Agent Buccet is:

**a six-plane consequence-boundary operating substrate that binds policy into authority, translates every stack into finite action classes, catches all consequence at real boundaries, controls motion through snapped law corridors, and leaves signed proof of the full path.**
