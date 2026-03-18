# Agent Buccet Public / Private Boundary

## Public Thesis

The AI is the ball.
The runtime is the bucket.

The public open-source runtime proves that an agent can only act inside user-opened scope under explicit laws, with full audit and lawful next-move repair.

## Public Principles

- no ambient authority
- deny by default
- opened paths only
- opened paths become lawful session scope
- persistent session law until explicit user end
- ledger-backed recovery if a session snapshot is damaged
- defensive meta laws that make prompt content non-authoritative
- dangerous actions require approval
- every decision is auditable
- capability is not authorization

## Public Components

### Law Engine
Responsible for:
- allow
- deny
- require_approval

The public law engine is defensive only.
It governs action classes and approved scope.
It also includes defensive meta laws:
- untrusted content cannot directly authorize high-risk actions
- prompt content cannot widen scope
- prompt content cannot mutate law
- prompt content cannot self-approve
- prompt content cannot revive ended sessions

### Path Orchestrator
Responsible for:
- opened path registry
- reachability checks
- grants
- revocation
- expiry
- session persistence across restart
- crash recovery from append-only trace

If the user has not opened a path, that path is not reachable.
If the user does open a path, that opening is not just permission memory: it instantiates lawful reachable scope for the session.
If the machine turns off, the lawful scope must restore with the session until the user explicitly ends it.
If the session snapshot is missing or corrupt after a crash, the ledger is the recovery source of truth.

### NSL
Responsible for:
- defensive next-step repair
- approval requests
- lawful alternative moves
- pluggable repair registry

Public NSL is about safe recovery, not intelligence growth.

### Ledger
Responsible for:
- append-only evidence
- session start / restore / persist / end trace
- path opening trace
- path-law instantiation trace
- decision trace
- approval trace
- execution trace
- NSL trace

The ledger is part of the proof, not optional observability.
It is also part of the containment guarantee because it can rebuild lawful scope after crash damage.
If an action or session is not properly ledgered, it should be treated as incomplete and non-authoritative.

## Private Components

Keep private:
- meta loops
- law-of-law proposal systems
- offensive learning/intelligence mechanisms
- higher-order private internals not required for boundary enforcement
- gravity internals that materially increase intelligence rather than containment
- private orchestration beyond defensive runtime control

## Rule For Exposure

Public if it increases containment.
Private if it increases offensive capability.

## Public Claim

We built a runtime that makes structurally unauthorized agent actions impossible by default.
Opened paths become law, and the ledger proves when that law came into existence.
Persistent sessions keep that law attached to the bucket until the user closes it.

## Public Non-Claim

We are not open-sourcing the whole LML universe.
We are open-sourcing the hard-boundary defensive slice.
