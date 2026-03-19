# Current Limits

This document states the current limits of the public Agent Buccet release plainly.

## Deep Intercept

Current hook depth is:
- preload / injected front-layer interception
- bridge-fed into the existing Buccet runtime

It is not yet:
- kernel-level mediation
- full platform-wide syscall coverage

## Coverage

Agent Buccet covers meaningful action classes:
- filesystem
- process/tool
- network
- recipient
- database
- system/config/credential

But it should not be described as:
- every possible path on every platform

## Ledger

Current ledger guarantees:
- local signed ledger
- chain verification
- public-key inspection
- signed checkpoints
- optional witness publishing

Current ledger does not yet guarantee:
- mandatory external witness by default
- remote anchoring by default
- hardware-isolated signing keys by default

## Hook Failure Semantics

Current behavior:
- hook freezes and waits
- if supervisor marks the brain dead, hook fails closed

This is correct for the public release.

## Public Claim Discipline

Safe claims:
- add-on containment layer
- persistent bodyguard
- freeze-and-forward hook path
- signed inspectable ledger
- active base laws

Unsafe claims:
- full kernel mediation
- impossible bypass on all OS paths
- independent external attestation by default
