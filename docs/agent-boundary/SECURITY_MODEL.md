# Agent Buccet Security Model

This document defines the operational split inside Agent Buccet.

## Core Split

### Hook

The hook does only this:
- catch motion
- freeze motion
- pass motion upward
- wait

The hook does not:
- decide law
- decide scope
- decide approval
- write the ledger as a source of truth
- run NSL reasoning

### Supervisor

The supervisor does only this:
- keep the Buccet brain alive
- restart it if possible
- mark it dead if it is confirmed unavailable

The supervisor does not:
- reinterpret law
- approve actions
- widen scope

### Buccet Brain

The main Agent Buccet runtime owns:
- base laws
- defensive meta laws
- scope and grants
- NSL
- gravity
- ledger
- final allow / deny / require-approval decisions

## Decision Path

1. motion is intercepted
2. hook freezes it
3. hook forwards it into Agent Buccet
4. Agent Buccet evaluates:
   - laws
   - scope
   - gravity
   - NSL if needed
   - ledger
5. verdict returns
6. hook applies that verdict

## Failure Model

### Brain alive but not yet answered

Hook behavior:
- wait
- stay frozen

### Brain confirmed dead by supervisor

Hook behavior:
- fail closed
- deny immediately

That means the hook never guesses.

## Ledger Guarantees

The ledger now provides:
- canonical structured records
- sequential IDs
- `sha256` chain linkage
- `ed25519` signatures on records
- inspectable public signing identity
- signed checkpoints

Optional witness publication can publish checkpoints outside the local runtime.

## What Agent Buccet Guarantees

- no ambient authority
- opened scope becomes lawful scope
- prompt content does not become authority
- ledger bypass is denied
- hook does not become a second brain

## What Agent Buccet Does Not Yet Guarantee

- full kernel mediation on every OS path
- independent external witnessing by default
- hardware-backed key protection by default
