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

Two enforcement classes with different native shapes. Both use `buccet-physwrap` as the translator, but the enforcement primitive and breach behavior differ.

#### Tier 2a — Payload Envelope Physics: LIVE (all platforms with noted gaps)

Launch-time ceiling on what a process can BECOME. The kernel terminates or blocks the process itself when the ceiling is exceeded.

| Primitive | Code | Ledger event | Contract |
|---|---|---|---|
| `wallClockTimeoutMs` → `SIGKILL` | `process.ts` | `PROCESS_WALL_CLOCK_KILL` | `agent-buccet-payload-physics-contract.ts` |
| `setrlimit()` / Job Objects | `physwrap.c` / `physwrap_win.c` | `PROCESS_PHYSWRAP_ACTIVE` | `agent-buccet-physwrap-contract.ts` |

**Tier 2a coverage by platform:**

| Field | Linux | macOS | Windows |
|---|---|---|---|
| `wallClockTimeoutMs` | **LIVE** | **LIVE** | **LIVE** |
| `cpuTimeLimitSec` | **LIVE** | **LIVE** | **LIVE** |
| `maxProcesses` | **LIVE** | **LIVE** — `RLIMIT_NPROC` (per-user scope; not per-process-tree) | **LIVE** |
| `maxMemoryBytes` | **LIVE** | **LIVE** — `RLIMIT_AS` + `memorystatus_control` jetsam (arm64 coverage) | **LIVE** |

#### Tier 2b — Live I/O / Object Boundary: LIVE on all platforms

Ongoing enforcement on live I/O operations during execution. Platform enforcement shape differs by surface: POSIX rlimits use refuse semantics (operation returns error); Windows uses IAT-hook per-operation refusal for nofile/fsize and Job Object throttle for I/O rate.

| Primitive | Code | Ledger event | Contract |
|---|---|---|---|
| `RLIMIT_NOFILE` / `RLIMIT_FSIZE` | `physwrap.c` / `physwrap_mac.c` | `PROCESS_PHYSWRAP_ACTIVE` | `agent-buccet-physwrap-contract.ts` |
| IAT hook: `CreateFileA/W` / `WriteFile` | `buccet_ioboundary_win.c` (DLL, injected by `physwrap_win.c`) | `PROCESS_PHYSWRAP_ACTIVE` | `agent-buccet-physwrap-contract.ts` |
| `SetIoRateControlInformationJobObject` | `physwrap_win.c` | `PROCESS_PHYSWRAP_ACTIVE` | `agent-buccet-physwrap-contract.ts` |

**Tier 2b coverage by platform:**

| Field | Linux | macOS | Windows |
|---|---|---|---|
| `maxOpenFiles` | **LIVE** — `RLIMIT_NOFILE` → `EMFILE` (refuse) | **LIVE** — `RLIMIT_NOFILE` → `EMFILE` (refuse) | **LIVE** — IAT hook → `ERROR_TOO_MANY_OPEN_FILES` (refuse) |
| `maxFileSizeBytes` | **LIVE** — `RLIMIT_FSIZE` → `SIGXFSZ` (refuse) | **LIVE** — `RLIMIT_FSIZE` → `SIGXFSZ` (refuse) | **LIVE** — IAT hook → `ERROR_FILE_TOO_LARGE` (refuse) |
| `maxIoRateBytesPerSec` | Skipped — ledgered | Skipped — ledgered | **LIVE** — Job Object I/O rate throttle (Win 10 1607+) |
| `maxIoOpsPerSec` | Skipped — ledgered | Skipped — ledgered | **LIVE** — Job Object IOPS throttle (Win 10 1607+) |

**Windows Tier 2b implementation:** `maxOpenFiles` and `maxFileSizeBytes` are enforced via `buccet-ioboundary.dll`, which is injected into the child process by `physwrap_win.c` before the main thread resumes. The DLL hooks `CreateFileA`/`CreateFileW` and `WriteFile` via IAT patching, applying per-operation refusal semantics (`ERROR_TOO_MANY_OPEN_FILES`, `ERROR_FILE_TOO_LARGE`). Fail closed: if the DLL cannot be found or injection fails, physwrap exits with code 2 — the limits cannot be silently skipped. `maxIoRateBytesPerSec` and `maxIoOpsPerSec` are enforced via `SetIoRateControlInformationJobObject` (Windows 10 1607+) with throttle semantics.

**Scope note (Windows):** The IAT hook covers Win32 API callers (`CreateFileA/W`, `WriteFile`). Processes that call `ntdll.dll` directly (bypassing Win32) are outside this boundary. Standard agent workloads (Python, Node.js, PowerShell) use Win32 and are covered.

**Semantic note:** POSIX rlimits and Windows IAT hooks both use refuse semantics (operation returns error). Windows I/O rate control uses throttle semantics (delays, not refuses). The nofile/fsize contract is semantically equivalent across platforms; the I/O rate contract differs.

#### Native backends — one source file per platform

| Platform | Source | Tier 2a | Tier 2b | Privilege drop |
|---|---|---|---|---|
| Linux | `native/physwrap/physwrap.c` | `setrlimit()` + `PR_CAPBSET_DROP` | `setrlimit()` | `PR_CAPBSET_DROP(CAP_SYS_RESOURCE)` |
| macOS | `native/physwrap/physwrap_mac.c` | `setrlimit()` + `memorystatus_control` jetsam (arm64 memory) | `setrlimit()` | `setgid()`/`setuid()` via `--uid`/`--gid` |
| Windows | `physwrap_win.c` + `buccet_ioboundary_win.c` | NT Job Objects | IAT hook DLL (nofile/fsize) + Job Object throttle (io_rate/iops) | N/A |

Build: `npm run build:native:physwrap` (POSIX) or `native/physwrap/build_win.bat` (MSVC).

#### physwrap enforcement path

| Path | Ledger event | Guarantee level |
|---|---|---|
| **Strong path** — physwrap binary found | `PROCESS_PHYSWRAP_ACTIVE` | `setrlimit()` hard+soft + platform privilege drop; per-class coverage recorded |
| **Fallback path** — binary not found | `PROCESS_PHYSWRAP_FALLBACK` | `sh -c ulimit -S/-H` — Tier 2a limits applied, privilege drop NOT executed, Tier 2b partially covered |
| **Cap drop warning** — lacks `CAP_SETPCAP` | `PROCESS_PHYSWRAP_CAP_WARNING` | Limits enforced; bounding-set drop did not execute (Linux) |

`PROCESS_PHYSWRAP_ACTIVE` records per-class coverage and runtime-observed backend reinforcement. Key fields:

| Metadata field | Values | What it tells the operator |
|---|---|---|
| `physwrap_platform` | `linux` / `macos` / `windows` | Which native backend ran |
| `physwrap_envelope_active` | e.g. `cpu,nproc,as` | Tier 2a limits applied at launch |
| `physwrap_envelope_skipped` | e.g. `io_rate` | Configured limits not enforced on this platform |
| `physwrap_io_boundary_active` | e.g. `nofile,fsize` | Tier 2b live-I/O limits active |
| `physwrap_io_boundary_skipped` | e.g. `io_rate,io_iops` | Live-I/O limits skipped (no rlimit equiv on Linux/macOS) |
| `physwrap_privilege_active` | e.g. `uid_gid_drop` | Privilege drop path taken |
| `physwrap_macos_jetsam_reinforcement` | `active` / `failed` / `unavailable` / `not_configured` / `n/a` | **Darwin only — runtime-observed jetsam ceiling outcome.** `active`: memorystatus_control applied; `failed`: call returned error, RLIMIT_AS still active; `unavailable`: symbol absent (weak_import), RLIMIT_AS still active; `not_configured`: `--as-kb` not passed; `n/a`: non-Darwin platform |

**Reading the Darwin memory truth from a single run:** look for `physwrap_platform=macos`, then read `physwrap_macos_jetsam_reinforcement`. `active` means both RLIMIT_AS and jetsam ceiling are live (full arm64 coverage). Anything else tells you which path degraded and why.

**CRITICAL: If `PROCESS_PHYSWRAP_FALLBACK` appears in the ledger, the strong-path guarantees are degraded. Root or cap-elevated payloads may raise their own limits. Treat as a configuration gap.**

**macOS: without `dropToUid`, root processes can exceed POSIX rlimit hard limits. physwrap emits a warning to stderr when running as root without `--uid`. Pass `dropToUid` in `BoundaryProcessPhysics` to close this gap.**

Build physwrap to activate the strong path: `npm run build:native:physwrap`

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

### Ledger I/O Physics Envelope (LIOPE) — storm-survival guarantees

Agent Buccet's ledger survives distributed event storms without exhausting disk I/O or memory.

Three dimensions:

| Dimension | Code | Config env var | Default |
|---|---|---|---|
| **Q1.8** — Atomic Shedding Ring Buffer | `ledger.ts:liopeEnqueue` | `BUCCET_LEDGER_MAX_QUEUE_SIZE` | 10,000 entries |
| **D2.8** — Max-IOPS Background Daemon | `ledger.ts:liopeFlush` | `BUCCET_LEDGER_FLUSH_INTERVAL_MS` | 100ms (max 10 IOPS) |
| **A3.8** — Signed Magnitude Storm Summary | `ledger.ts` → `LEDGER_STORM_SUMMARY` | — | emitted when shed > 0 |

**How it works:**

- High-volume *observation events* (`INGRESS_PROVENANCE_BLOCKED`, `ACTION_PROPOSED`, `DECISION_RETURNED`, etc.) are enqueued in memory (O(1) hot path) and flushed in batches.
- *Material state transitions* (`SESSION_STARTED`, `GRANT_ISSUED`, `ACTION_BLOCKED`, `GOVERNOR_TRIP`, `PROCESS_PHYSWRAP_ACTIVE`, `INGRESS_STANDING_LAW_WRITTEN`, etc.) bypass the queue and write immediately — always durable.
- When the queue is full, overflow events are shed. The shed count is tracked atomically.
- On each flush: if shed > 0, one `LEDGER_STORM_SUMMARY` record is prepended to the batch. It carries `shed_count`, `window_ms`, `by_class` (JSON breakdown by event type). It is ed25519-signed and chain-linked like any other record.
- File rollover: when the ledger file exceeds `BUCCET_LEDGER_MAX_FILE_SIZE_BYTES` (default 10 MB), it is renamed to a timestamped archive and a new file begins. Chain linkage is preserved via `prev_hash`.

**Invariants:**

1. Hot path O(1) — enqueue never blocks on disk
2. Disk writes bounded by `floor(1000 / LIOPE_FLUSH_INTERVAL_MS)` flushes/sec
3. Memory bounded by `LIOPE_MAX_QUEUE_SIZE` entries
4. Material state transitions always durable (bypass queue)
5. Storm repetition collapses to one signed summary per flush window
6. Auditability survives storm conditions — shed count is ledgered, not silently dropped

Contract: `agent-buccet-liope-contract.ts`

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
| LIOPE storm survival — Q1.8 shed | `ledger.ts:liopeEnqueue` | — | `agent-buccet-liope-contract.ts` |
| LIOPE storm survival — A3.8 summary | `ledger.ts:liopeFlush` | `LEDGER_STORM_SUMMARY` | `agent-buccet-liope-contract.ts` |
| LIOPE material bypass | `ledger.ts:appendBoundaryLedger` | immediate write | `agent-buccet-liope-contract.ts` |

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
- Ledger I/O Physics Envelope (LIOPE) — storm-survival, bounded I/O, signed storm summaries — live

### Unsafe claims (do not make)

- Full OS-kernel mediation on every syscall (eBPF/seccomp/ptrace — not part of this release)
- Impossible bypass on all OS paths
- Hardware-backed key protection by default
- rlimit strong-path guarantees when `PROCESS_PHYSWRAP_FALLBACK` is in ledger
- Input DDoS protection when `admissionConfig` is absent from `BoundaryRuntimeConfig`
