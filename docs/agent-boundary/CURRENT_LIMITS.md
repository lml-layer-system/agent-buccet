# Current Limits

This document states the current limits of Agent Buccet plainly, precisely, and without softening.

Every primitive listed here maps to: a code surface, a ledger event, and a contract/test that proves it.

---

## What Agent Buccet Is

- A fail-closed law boundary
- An egress structural validity layer
- A motion governor (Tier 1 laws)
- A payload physics envelope (Tier 2 containment)
- An input admission boundary (inbound hostile force denied before the brain wakes)

## What Agent Buccet Is Not

- A generic sandbox
- A token budget dashboard
- An LLM moderation gateway
- A probabilistic scanner or semantic filter
- A fail-open wrapper
- A promise of 100% OS-kernel mediation on every syscall path

---

## Intercept Level

The INTERCEPT layer is the earliest point at which Buccet can catch action proposals — the action boundary, which every agent must cross to do anything real.

### Default intercept surfaces

- `LD_PRELOAD` / `DYLD_INSERT_LIBRARIES` libc hooks for native processes
- Framework adapter hooks for JS/Python agent stacks (Claude SDK, NeMo, OpenAI Agents, LangGraph, Telegram)

Both surfaces map into the same finite boundary action classes and route to the same Buccet brain.

### Intercept depth

The C/libc layer is the deepest public level. Below that — OS-kernel hooks (eBPF, seccomp, ptrace), hypervisor, and firmware/boot-level enforcement — is not part of this release. Proprietary by design.

### Mode without C compiler

If a C compiler is not available at install time, Agent Buccet runs in user-space bridge mode — same brain, same law body, same ledger, framework-level interception only. Run `buccet hook build && buccet hook start` once `cc` is available to enable libc-level interception.

---

## Coverage Map

### Egress: Action Classes Covered

Agent Buccet intercepts these action classes:

| Class | Examples | Covered |
|---|---|---|
| Filesystem | `open`, `openat`, `fopen`, `creat`, `write`, `unlink`, `rename`, `mkdir`, `rmdir`, `chmod`, `chown`, `link`, `symlink` | **Yes** — libc hook + framework adapter |
| Process / tool | `execve`, `execv`, `execvp`, `system` | **Yes** — libc hook + framework adapter |
| Network | `connect`, `socket` | **Yes** — libc hook (connection-level) |
| Recipient / communication | framework-level send paths | **Yes** — framework adapter |
| Database | framework-level query/insert/update/delete | **Yes** — framework adapter |
| System / config / credential | env read/write, config read/write, credential read/use | **Yes** — framework adapter |

### Egress: Syscall Family Coverage

Not all write paths are created equal. Explicitly covered write syscalls and what is not yet covered:

| Write path | Coverage |
|---|---|
| `open` / `openat` / `fopen` / `creat` (write mode) | **Covered** — deep-intercept hook |
| `write` | **Covered** — deep-intercept hook |
| `read` | **Covered** — deep-intercept hook |
| `execve` / `execv` / `execvp` | **Covered** — deep-intercept hook |
| `connect` / `socket` | **Covered** — deep-intercept hook |
| `writev` | **Not explicitly covered** — not yet in deep-intercept |
| `sendfile` | **Not explicitly covered** — kernel-level file copy bypass |
| `splice` / `tee` | **Not explicitly covered** — zero-copy kernel paths |
| `mmap(MAP_SHARED)` | **Not explicitly covered** — shared memory write path |
| `pwrite` / `pwritev` | **Not explicitly covered** |
| `io_uring` ops | **Not explicitly covered** — async I/O ring bypass |

The uncovered paths are documented, not hidden. They represent the honest boundary of the current deep-intercept layer. Framework-level adapters capture intent before any syscall is issued and close most of these gaps at the semantic layer.

### Egress: What is Checked at chat.emit vs Network Boundaries

- `chat.emit` — subject to boundary law evaluation (scope, grants, UPL, base laws)
- `network.send` — subject to boundary law evaluation (domain allowlist, scope); enforced at the `connect()` interception level in the libc hook
- Egress structural validity (NSL/gravity) applies to all outbound action proposals before execution

---

## Resource Governor

### Tier 1 — Boundary Laws: LIVE

Four dimensions, all pure functions, all fail-closed.

| Law | Code | Ledger event | Contract |
|---|---|---|---|
| `BOUNDARY.GOVERNOR.VELOCITY.01` | `governor.ts:evaluateBoundaryGovernor` | `GOVERNOR_TRIP` dim=velocity | `agent-buccet-governor-contract.ts` |
| `BOUNDARY.GOVERNOR.DENSITY.01` | `governor.ts:evaluateBoundaryGovernor` | `GOVERNOR_TRIP` dim=density | `agent-buccet-governor-contract.ts` |
| `BOUNDARY.GOVERNOR.MASS.01` | `governor.ts:evaluateBoundaryGovernor` | `GOVERNOR_TRIP` dim=mass | `agent-buccet-governor-contract.ts` |
| Weight table | `governor.ts:DEFAULT_GOVERNOR_WEIGHT` | — (applies to mass) | `agent-buccet-governor-contract.ts` |

Trips before law evaluation. No fallback. No retry. No best-effort continuation.

### Tier 2 — Payload Physics

#### Wall-clock timeout: LIVE (all platforms)

| Primitive | Code | Ledger event | Contract |
|---|---|---|---|
| `wallClockTimeoutMs` → `SIGKILL` | `process.ts` | `PROCESS_WALL_CLOCK_KILL` | `agent-buccet-payload-physics-contract.ts` |

Platform-independent. `setTimeout` + `child.kill('SIGKILL')`.

#### Native physwrap enforcer (rlimits + privilege drop)

The `buccet-physwrap` binary is the Native Physics Translator. It applies rlimits via direct `setrlimit()` syscalls and applies a platform-native privilege drop before `exec()`.

| Path | Ledger event | Guarantee level |
|---|---|---|
| **Strong path** — physwrap binary found | `PROCESS_PHYSWRAP_ACTIVE` | `setrlimit()` hard+soft + platform privilege drop |
| **Fallback path** — binary not found | `PROCESS_PHYSWRAP_FALLBACK` | `sh -c ulimit -S/-H` — limits applied, privilege drop NOT executed |
| **Cap drop warning** — lacks `CAP_SETPCAP` | `PROCESS_PHYSWRAP_CAP_WARNING` | Limits enforced; bounding-set drop did not execute (Linux) |

`PROCESS_PHYSWRAP_ACTIVE` includes `physwrap_active_limits` and `physwrap_skipped_limits` — the exact per-platform limit coverage is recorded in the ledger for every invocation.

**CRITICAL: If `PROCESS_PHYSWRAP_FALLBACK` appears in the ledger, the strong-path guarantees are degraded. Root or cap-elevated payloads may raise their own limits. Treat as a configuration gap.**

Build physwrap to activate the strong path: `npm run build:native:physwrap`

#### Native backends — one source file per platform

| Platform | Source | Method |
|---|---|---|
| Linux | `native/physwrap/physwrap.c` | `setrlimit()` + `PR_CAPBSET_DROP(CAP_SYS_RESOURCE)` + `PR_CAP_AMBIENT_LOWER` |
| macOS | `native/physwrap/physwrap_mac.c` | `setrlimit()` + `setgid()`/`setuid()` privilege drop (`--uid`/`--gid`) |
| Windows | `native/physwrap/physwrap_win.c` | NT Job Objects (`CreateJobObject` + `SetInformationJobObject`) |

Build: `npm run build:native:physwrap` (POSIX) or `native/physwrap/build_win.bat` (MSVC).
`PHYSWRAP_PLATFORM` is recorded in `PROCESS_PHYSWRAP_ACTIVE` ledger events.

#### Limit coverage by platform

| Limit | Field | Linux | macOS | Windows |
|---|---|---|---|---|
| CPU time | `cpuTimeLimitSec` | `RLIMIT_CPU` — **LIVE** | `RLIMIT_CPU` — **LIVE** | `PerJobUserTimeLimit` — **LIVE** |
| Process tree | `maxProcesses` | `RLIMIT_NPROC` — **LIVE** | Skipped (unreliable on Darwin) — ledgered | `ActiveProcessLimit` — **LIVE** |
| Virtual memory | `maxMemoryBytes` | `RLIMIT_AS` — **LIVE** | Skipped (unreliable on Darwin) — ledgered | `ProcessMemoryLimit` — **LIVE** |
| Open file descriptors | `maxOpenFiles` | `RLIMIT_NOFILE` — **LIVE** | `RLIMIT_NOFILE` — **LIVE** | **OPEN GAP** — no Job Object equivalent; warning emitted, limit NOT applied |
| File size | `maxFileSizeBytes` | `RLIMIT_FSIZE` — **LIVE** | `RLIMIT_FSIZE` — **LIVE** | **OPEN GAP** — no Job Object equivalent; warning emitted, limit NOT applied |
| Privilege drop (Linux) | — | `PR_CAPBSET_DROP(CAP_SYS_RESOURCE)` — **LIVE** | N/A | N/A |
| Privilege drop (macOS) | `dropToUid` / `dropToGid` | N/A | `setgid()`/`setuid()` before exec — **LIVE** | N/A |

**OPEN GAP — Windows `maxOpenFiles` and `maxFileSizeBytes`: no Win32 Job Object equivalent exists. These limits are NOT enforced. physwrap emits explicit stderr warnings and records them in `physwrap_skipped_limits` so the gap is auditable at runtime — but warnings are not enforcement. This surface remains uncovered until a native Windows enforcement path is implemented.**

**macOS: without `dropToUid`, root processes can exceed POSIX rlimit hard limits. physwrap emits a warning to stderr when running as root without `--uid`. Pass `dropToUid` in `BoundaryProcessPhysics` to close this gap.**

The shell-ulimit fallback is an auditable degradation path used when physwrap is not built. It does not support `dropToUid`/`dropToGid`.

Contracts: `agent-buccet-payload-physics-contract.ts`, `agent-buccet-physwrap-contract.ts`

---

## Input Admission Boundary: LIVE

Hostile inbound traffic is denied at the admission layer before the brain wakes — before tokenization, prompt assembly, inference, or API invocation.

### Path

```
Inbound → O(1) standing-deny cache → bounded provenance tracking → admission laws → deny/tarpit
```

### Admission Laws

| Law | Dimension | Law ID | Code | Ledger event |
|---|---|---|---|---|
| Velocity | Inbound RPM per provenance | `BOUNDARY.ADMISSION.VELOCITY.01` | `admission.ts` | `INGRESS_PROVENANCE_BLOCKED` |
| Density | Deny ratio → standing deny promotion | `BOUNDARY.ADMISSION.DENSITY.01` | `admission.ts` | `INGRESS_STANDING_LAW_WRITTEN` (once) |
| Mass | Inbound weight horizon | `BOUNDARY.ADMISSION.MASS.01` | `admission.ts` | `INGRESS_PROVENANCE_BLOCKED` |
| Standing Deny | O(1) cache hit | `BOUNDARY.ADMISSION.STANDING_DENY.01` | `admission.ts` | `INGRESS_PROVENANCE_BLOCKED` |

### Ledger vs. Cache

| Layer | Role | I/O behavior |
|---|---|---|
| Ledger (`INGRESS_STANDING_LAW_WRITTEN`) | Durable exactly-once authority | Written once per hostile provenance on density trip |
| Standing-deny cache (`standingDenyProvenances`) | O(1) hot-path enforcement | In-memory, zero I/O |

A flood of N packets from one provenance produces exactly 1 ledger write. The cache absorbs the rest in total silence.

### Provenance Strength Scaling

| Strength | Examples | Threshold scaling |
|---|---|---|
| Strong | Pubkey / signed identity | 2× headroom |
| Medium | Session / device binding | 1× (baseline) |
| Weak | IP / network provenance | 0.5× (tighter) |

### Bounded Provenance Tracking

LRU eviction (default: 10,000 max entries) + TTL eviction (default: 5 min). Prevents memory exhaustion from provenance-spraying attacks.

Contract: `agent-buccet-admission-contract.ts`

---

## Ledger

### Current guarantees

- Local signed ledger
- Sequential ID chain
- `sha256` chain linkage
- `ed25519` signatures on records
- Inspectable public signing identity
- Signed checkpoints
- Optional witness publication (set `BUCCET_WITNESS_URL`)

### Not yet guaranteed

- Hardware-isolated signing keys by default (software keys on disk; HSM support is not in this release)
- Independent external witnessing by default (ledger is locally signed; remote anchoring requires operator configuration)

---

## Hook Failure Semantics

| Condition | Hook behavior |
|---|---|
| Brain alive, not yet answered | Wait. Stay frozen. |
| Brain confirmed dead by supervisor | Fail closed. Deny immediately. |

The hook never guesses.

---

## Trust Surface

These guarantees hold within the declared enforcement surface, assuming:

1. **Hook integrity** — intercept hook is running and has not been bypassed
2. **Kernel integrity** — OS enforces rlimits, signals, and capabilities as specified
3. **Physwrap strong path active** — `PROCESS_PHYSWRAP_ACTIVE` present in ledger; if `PROCESS_PHYSWRAP_FALLBACK` appears, cap-drop guarantee is absent
4. **`CAP_SETPCAP` available for cap-drop** — needed for `PR_CAPBSET_DROP` to succeed on Linux
5. **Admission boundary configured** — `admissionConfig` supplied in `BoundaryRuntimeConfig`; admission is inactive when absent

Violation of any assumption degrades the affected guarantee. The ledger makes the degradation visible.

---

## Proof Loop

Every major architectural claim maps to:

| Primitive | Code surface | Ledger event | Contract/test |
|---|---|---|---|
| Velocity law (outbound) | `governor.ts` | `GOVERNOR_TRIP` dim=velocity | `agent-buccet-governor-contract.ts` |
| Density law (outbound) | `governor.ts` | `GOVERNOR_TRIP` dim=density | `agent-buccet-governor-contract.ts` |
| Mass law (outbound) | `governor.ts` | `GOVERNOR_TRIP` dim=mass | `agent-buccet-governor-contract.ts` |
| Wall-clock kill | `process.ts` | `PROCESS_WALL_CLOCK_KILL` | `agent-buccet-payload-physics-contract.ts` |
| Physwrap strong path | `process.ts` + `native/physwrap/physwrap.c` | `PROCESS_PHYSWRAP_ACTIVE` | `agent-buccet-physwrap-contract.ts` |
| Physwrap fallback | `process.ts` | `PROCESS_PHYSWRAP_FALLBACK` | `agent-buccet-physwrap-contract.ts` |
| Velocity law (inbound) | `admission.ts` | `INGRESS_PROVENANCE_BLOCKED` | `agent-buccet-admission-contract.ts` |
| Density → standing deny | `admission.ts` | `INGRESS_STANDING_LAW_WRITTEN` | `agent-buccet-admission-contract.ts` |
| O(1) cache hit | `admission.ts` | `INGRESS_PROVENANCE_BLOCKED` dim=standing_deny | `agent-buccet-admission-contract.ts` |
| Mass law (inbound) | `admission.ts` | `INGRESS_PROVENANCE_BLOCKED` | `agent-buccet-admission-contract.ts` |
| LRU provenance eviction | `admission.ts` | — | `agent-buccet-admission-contract.ts` |
| Ledger integrity | `ledger.ts` | chain + ed25519 | `agent-buccet-ledger-contract.ts` |

---

## Public Claim Discipline

### Safe claims

- Universal agent bodyguard
- INTERCEPT catches at the universally lowest computational level (action boundary — libc + framework hooks)
- Persistent bodyguard that survives agent restarts
- Freeze-and-forward hook path
- Signed inspectable ledger
- Active base laws
- Fail-closed on brain death
- Tier 1 governor: velocity, density, mass, weight — live
- Wall-clock kill — live
- Native physwrap rlimits — live when `PROCESS_PHYSWRAP_ACTIVE` in ledger
- Input Admission Boundary — live when `admissionConfig` is configured

### Unsafe claims (do not make)

- Full OS-kernel mediation on every syscall (eBPF/seccomp/ptrace — not part of this release)
- Impossible bypass on all OS paths
- Hardware-backed key protection by default
- rlimit strong-path guarantees when `PROCESS_PHYSWRAP_FALLBACK` is in ledger
- Input DDoS protection when `admissionConfig` is absent from `BoundaryRuntimeConfig`
