# Current Limits

This document states the current limits of the public Agent Buccet release plainly.

## Intercept Level

The INTERCEPT layer is the universally lowest computational level at which Buccet can catch action proposals — the action boundary, which every agent must cross to do anything real.

The default intercept layer is:
- `LD_PRELOAD` / `DYLD_INSERT_LIBRARIES` libc hooks for native processes (built and started automatically by `buccet init` when a C compiler is available)
- framework adapter hooks for JS/Python agent stacks (Claude SDK, NeMo, OpenAI Agents, LangGraph, Telegram)

Both surfaces map into the same finite boundary action classes and route to the same Buccet brain.

The hosted installer (`curl -fsSL https://buccet.lml.dev/install | sh`) requires no prior toolchain. It detects bun or node automatically and installs bun if neither is found. The launcher produced by the install script also resolves bun vs node at each invocation so the runtime preference is always correct.

If a C compiler is not available at install time, Agent Buccet runs in user-space bridge mode — same brain, same law body, same ledger, framework-level interception only. Run `buccet hook build && buccet hook start` once `cc` is available to enable libc-level interception.

The C/libc layer is the deepest public level. Below that — OS-kernel hooks (eBPF, seccomp, ptrace), hypervisor, and firmware/boot-level enforcement — is not part of this release and is not an open extension point. Proprietary by design.

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
- witness publishing — checkpoint signed and stored locally by default; set BUCCET_WITNESS_URL to publish to your own off-machine witness server

Current ledger does not yet guarantee:
- hardware-isolated signing keys by default

## Hook Failure Semantics

Current behavior:
- hook freezes and waits
- if supervisor marks the brain dead, hook fails closed

This is correct for the public release.

## Resource Governor

**Tier 1 — Boundary Governor: LIVE**

Three stateful pre-law dimensions are enforced before the law body evaluates any request:
- `BOUNDARY.GOVERNOR.VELOCITY.01` — RPM ceiling (sliding window)
- `BOUNDARY.GOVERNOR.DENSITY.01` — failure ratio ceiling (sliding decision window)
- `BOUNDARY.GOVERNOR.MASS.01` — weighted action horizon (asymmetric weights by action class)

State is carried in `BoundaryRuntimeConfig.governorState`. All three are pure functions in `governor.ts`. Governor trips are ledgered as `GOVERNOR_TRIP` and fail closed — no fallback, no retry.

Configure via `BoundaryRuntimeConfig.governorConfig`. All fields optional; governor is inert when `governorConfig` is absent.

**Tier 2 — Payload Physics:**

- **Wall-clock timeout: LIVE** — `wallClockTimeoutMs` in `BoundaryProcessPhysics` triggers `SIGKILL` on breach. Platform-independent. Ledgered as `PROCESS_WALL_CLOCK_KILL`.
- **POSIX rlimits: SCAFFOLDED** — `cpuTimeLimitSec`, `maxProcesses`, `maxMemoryBytes`, `maxOpenFiles`, `maxFileSizeBytes` translate to `ulimit` flags wrapped via `sh -c ulimit ...; exec {cmd}`. Linux/macOS only (skipped on Windows). No kernel-enforced guarantee without OS-level enforcement; this is the user-space scaffold.

## Public Claim Discipline

Safe claims:
- universal agent bodyguard
- INTERCEPT catches at the universally lowest computational level (action boundary, libc + framework hooks)
- persistent bodyguard that survives agent restarts
- freeze-and-forward hook path
- signed inspectable ledger
- active base laws

Unsafe claims:
- full OS-kernel mediation on every syscall (platform-specific; not the universal default)
- impossible bypass on all OS paths
- hardware-backed key protection (software keys on disk; HSM support is not part of this release)
