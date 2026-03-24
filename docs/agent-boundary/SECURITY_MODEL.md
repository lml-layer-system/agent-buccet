# Agent Buccet Security Model

This document defines the operational split inside Agent Buccet.

## Core Split

### Hook

The hook does only this:
- catch motion at the action boundary
- freeze it — the action does not execute
- signal the Buccet brain that a frozen proposal is waiting
- wait for the verdict
- apply the verdict

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

1. motion is intercepted at the action boundary
2. hook freezes it — the action does not execute
3. hook signals the Buccet brain that a frozen proposal is waiting
4. Buccet brain evaluates while the action stays frozen:
   - **resource governor** (Tier 1 pre-check — velocity / density / mass; trips before law evaluation)
   - laws (base runtime laws)
   - scope and grants
   - gravity
   - UPL (User Path Ledger — the user's own runtime laws, same enforcement class as base laws)
   - NSL if needed
   - swarm coordination if many matching requests are waiting
   - ledger
5. verdict returns: allow / deny / require_approval
6. hook applies the verdict — allow executes, deny drops, require_approval holds until resolved

## UPL — User Path Ledger

The UPL is not a preference store. It is not a settings file. It is not a cache.

The UPL is a set of **active runtime laws** — the same enforcement class as the base boundary laws — that are user-customizable.

When the Bodyguard arrives at a frozen proposal:
- it carries the UPL with it
- every entry in the UPL is a standing law
- if that law matches the target, it decides on contact — just like any base runtime law would

The difference from base laws:
- base laws are set by the runtime and cannot be changed by the agent
- UPL laws are set by the **user** — one person, the human in the chair

There is only one source of authority: the user.

The Bodyguard enforces that by turning every user decision into a standing UPL law. If the user said "deny writes to /etc" once, that becomes law. Future identical proposals are resolved at the UPL check without asking again.

The agent cannot write to the UPL. The agent cannot read the UPL to understand its limits. The agent proposes. The user's laws decide.

## Swarm Mode

When many protected processes hit the same unresolved target:
- hooks still only freeze and hold — no action executes, nothing passes
- the Buccet brain groups matching frozen requests into one shared pending group
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

The C/libc layer is the deepest level in the public release. That is by design.

Below the C/libc layer — OS-kernel interception (eBPF, seccomp, ptrace), hypervisor-level, and firmware/boot-level enforcement — is not part of this release. It is not an open extension point. If you need that depth, contact the author or build it yourself. Those layers are proprietary by design and intentionally withheld.

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

## Resource Governor

The resource governor fires before law evaluation. It is not a law; it is a pre-law rate and volume control layer.

Two tiers:

**Tier 1 — Boundary Laws (stateful, pure functions)**

- `BOUNDARY.GOVERNOR.VELOCITY.01` — request rate ceiling (RPM). Trips when crossing count in the velocity window exceeds `maxRpm`.
- `BOUNDARY.GOVERNOR.DENSITY.01` — sliding window failure ratio. Trips when denied/total in the decision window exceeds `maxFailureRatio`.
- `BOUNDARY.GOVERNOR.MASS.01` — weighted action horizon. Trips when cumulative weighted crossings exceed `maxCrossings`. Action class weights are asymmetric: `tool.exec=10`, `fs.delete=8`, `sys.credential.*=8`, down to `fs.read/chat.emit=1`.

All three are stateless from the function's perspective — state is carried in `BoundaryRuntimeConfig.governorState` and flows back through `BoundaryExecutionResult.config` after every crossing.

**Tier 2 — Payload Physics (process containment)**

- Wall-clock timeout: `setTimeout` → `SIGKILL` on breach. Fully live. Platform-independent.
- POSIX rlimits: `ulimit -t` (CPU), `ulimit -u` (nproc), `ulimit -v` (AS), `ulimit -n` (open files), `ulimit -f` (file size). Scaffolded via `sh -c ulimit ...; exec {cmd}`. Linux/macOS only; skipped on Windows.

Governor trips are ledgered as `GOVERNOR_TRIP`. Wall-clock kills are ledgered as `PROCESS_WALL_CLOCK_KILL`. Both fail closed — no fallback, no retry, no best-effort continuation.

## What Agent Buccet Does Not Yet Guarantee

- OS-kernel mediation on every syscall path (eBPF/seccomp/ptrace — locks to one platform)
- independent external witnessing by default (ledger is locally signed; remote anchoring requires operator wiring)
- hardware-backed key protection by default
