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
   - swarm coordination if many matching requests are waiting
   - ledger
5. verdict returns
6. hook applies that verdict

## Swarm Mode

When many protected processes hit the same unresolved target:
- hooks still only catch, freeze, and pass
- the Buccet brain groups matching waiting requests into one shared pending group
- one lawful approval or denial resolves that whole group
- ledger records the shared swarm decision path

That means swarm support does not introduce a second control system.
It is still one brain, one law body, one ledger, and one scope truth.

## Intercept Level

The INTERCEPT layer catches at the universally lowest computational level: the action boundary.

Every agent — regardless of framework, language, or runtime — must eventually cross a real action boundary to do anything:
- libc calls (`open`, `write`, `execve`, `connect`, ...) for native processes
- framework tool hooks for JS/Python agent stacks

The INTERCEPT layer hooks both surfaces. This is universally the lowest you can get without locking to one OS.

```
INTERCEPT hooks at:
  → libc calls     (LD_PRELOAD / DYLD_INSERT_LIBRARIES — any Unix/macOS process)
  → framework APIs (Claude SDK, NeMo, OpenAI Agents, LangGraph, Telegram)

Both map into the same finite boundary action classes.
Both route to the same Buccet brain.
```

`buccet init` builds and starts the intercept layer automatically. If a C compiler is not available, Agent Buccet runs in user-space bridge mode — the same brain, law body, and ledger, with framework-level interception only.

OS-specific kernel hooks (eBPF, seccomp, ptrace) go deeper on one platform but trade universal coverage for OS lock-in. They can be added as supplemental nets in front of the same Buccet brain but are not the universal default.

Those supplemental nets do not become the authority system.
They remain catch, freeze, and pass layers in front of the same Buccet brain.

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
Release flows publish witness checkpoints by default and require explicit break-glass opt-out to skip that step.

## What Agent Buccet Guarantees

- no ambient authority
- opened scope becomes lawful scope
- prompt content does not become authority
- ledger bypass is denied
- hook does not become a second brain
- release artifacts carry a witness decision trail by default

## What Agent Buccet Does Not Yet Guarantee

- OS-kernel mediation on every syscall path (eBPF/seccomp/ptrace — locks to one platform)
- independent external witnessing by default (ledger is locally signed; remote anchoring requires operator wiring)
- hardware-backed key protection by default
