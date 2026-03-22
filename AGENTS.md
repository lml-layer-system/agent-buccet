# Agent Buccet Fusion Plan

This file records the current runtime fusion target for Agent Buccet.

## Runtime Architecture

Native Agent Buccet is the brain and skeleton.
It owns:
- Interceptor
- Gravity
- Bodyguard
- swarm
- wrapper and action-boundary control
- session and grant control
- runtime decision flow

The transferred law foundation is the muscle.
Its live runtime form is the snapped runtime substrate.

The expanded `8,209` law body is not the hot runtime primitive.
It is the inspectable enumeration of what the transferred muscle contains.

UPL is the active mutable user law ledger.

Witness Ledger is the immutable cryptographic history.

## Runtime Flow

1. The carried law field is already live.
2. Something hits the boundary.
3. Interceptor and Gravity catch, stop, and hold.
4. Bodyguard takes over.
5. Bodyguard checks UPL only.
6. If UPL has standing allow, allow.
7. If UPL has standing deny, deny.
8. If UPL has no standing user law, ask the user.
9. If the user says yes, approval automatically becomes UPL law.
10. If the user says no, ask whether that no should become law.
11. Every event and every UPL mutation is written to Witness Ledger.

Witness Ledger is never used as live authorization input.
It is history, not the active decision surface.

## Swarm

Swarm stays native.
It is not a second control system.
Swarm uses the same path:
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
