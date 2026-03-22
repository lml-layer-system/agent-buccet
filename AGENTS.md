# Agent Buccet Fusion Contract

This file is the working contract for the current fusion pass in `agent-buccet`.

## Branch Discipline

- Work on `buccet-base-time-law-transfer` only unless explicitly told otherwise.
- Do not touch `main` from this workflow.
- Do not rewrite the current public README during fusion work.
- README changes happen only in a final late-stage surgical pass.

## Current Objective

Fuse native Agent Buccet with the transferred law foundation correctly.

That means:
- native Agent Buccet stays the brain and skeleton
- the transferred law foundation is the muscle
- the transferred law foundation runs live as the snapped runtime substrate
- the expanded `8,209` law body remains the inspectable enumeration of what is running
- everything runs together as one Agent Buccet runtime

## Architecture

### Native Agent Buccet

Native Agent Buccet is the brain and skeleton.
It owns:
- Interceptor
- Gravity
- Bodyguard
- swarm
- wrapper and action-boundary control
- session and grant control
- runtime decision flow

### Transferred Law Foundation

The transferred law foundation is the muscle.

Its live runtime form is the snapped runtime substrate.

The snapped runtime substrate is not a different law body.
It is the compressed live runtime form of the same transferred law foundation.

The expanded `8,209` law body is not the hot runtime primitive.
It is the inspectable enumeration of what the live muscle contains.

### Ledgers

UPL is the active mutable user law ledger.

Witness Ledger is the immutable cryptographic history.

UPL is live law.
Witness Ledger is history.

## Non-Negotiable Runtime Rules

- Do not split native Agent Buccet and the transferred runtime into separate control systems.
- Do not treat the expanded `8,209` law body as the hot runtime primitive.
- Do not reintroduce `laws.json` or `law-web.json` as live runtime sources.
- Do not use Witness Ledger as live authorization input.
- Do not describe the transferred time body as `meta` in runtime-facing architecture.
- Preserve both:
  - the snapped runtime substrate as the live transferred muscle
  - the expanded `8,209` law body as the inspectable enumeration

## Why Action Boundary First Matters

Everything important happens at the action boundary layer.

That is the stable layer across:
- agent stacks
- model changes
- framework changes
- future tools
- swarm and multi-agent behavior

The stack can change.
The action boundary does not.

That is why Agent Buccet is built there.

## Interceptor And Gravity

Interceptor and Gravity do not deliberate.

They catch, stop, and hold.

They can do that instantly because the carried invariants and laws are already live.
The law field is the reason the system can see boundary violation at all.

The laws are not consulted after the catch as a separate thought process.
The laws are the reason the catch happens.

So the reflex path is:
- the live law field sees violation
- Interceptor catches
- Gravity stops and holds
- Bodyguard receives the caught event

## Runtime Flow

1. The live law field is already active.
2. Something hits the action boundary.
3. Interceptor and Gravity catch, stop, and hold immediately.
4. Bodyguard takes over.
5. Bodyguard checks UPL only.
6. If UPL has standing allow, allow.
7. If UPL has standing deny, deny.
8. If UPL has no standing user law, ask the user.
9. If the user says yes, approval automatically becomes UPL law.
10. If the user says no, ask whether that no should become law.
11. Every event and every UPL mutation is written to Witness Ledger.

Witness Ledger is never used as live authorization input.

## UPL Rules

UPL is the active mutable user law ledger.

UPL contains:
- approved paths
- denied paths
- mute state
- scope state
- user modifications

UPL is customizable and changeable by the user.

Exact behavior:
- yes always becomes UPL law
- no always asks whether that no should become law
- one-time no is recorded but does not become standing law

## Witness Ledger Rules

Witness Ledger is:
- immutable
- cryptographically hashed
- historical
- complete

It must enumerate every meaningful event and every UPL mutation.

It is not the active law surface.

## Swarm

Swarm stays native.
Swarm is part of the same brain.
Swarm is not a second control system.

Swarm uses the same action-boundary path:
- Interceptor
- Gravity
- Bodyguard
- UPL
- Witness Ledger
- user authority when needed

## Implementation Plan

1. Freeze the architecture above.
2. Load the snapped transferred law foundation at runtime startup.
3. Keep the expanded `8,209` law body available only for inspect, audit, proof, and regeneration.
4. Preserve the native Buccet runtime control core.
5. Implement the two-ledger model exactly:
   - UPL for live mutable user law
   - Witness Ledger for immutable hashed history
6. Wire Bodyguard to UPL-only live decisioning.
7. Write Witness Ledger after every catch, hold, decision, and UPL mutation.
8. Keep swarm on the same fused path.
9. Unify runtime-facing naming to `base` and `time` after fusion is working.
10. Update README last, surgically.

## Immediate First Slice

1. Load snapped transferred foundation into native runtime state.
2. Wire Bodyguard to UPL-only live decisioning.
3. Wire Witness Ledger writes after every decision path.
4. Prove one end-to-end boundary flow works.

## Done For This Fusion Slice

This slice is done only when:
- the snapped transferred law foundation loads into native runtime state
- native Agent Buccet remains the control brain
- the expanded `8,209` law body stays inspection-only
- Bodyguard uses UPL only for live standing user-law decisions
- Witness Ledger is write-only for history and proof
- swarm uses the exact same fused path
- no runtime-facing `meta` language remains for the transferred time body
- README still has not been surgically updated yet
