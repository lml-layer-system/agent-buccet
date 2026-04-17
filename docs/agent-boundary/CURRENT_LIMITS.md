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

Cost governance in Buccet is expressed as weighted motion and weighted inbound work, not provider billing tokens. Ingress cost is governed by admission weight classes and admission mass; egress cost is governed by action-class weight and governor mass.

---

## Run-Surface vs Read-Surface

The full repo is not the hot runtime.

Agent Buccet intentionally keeps a larger readable body:

- docs
- doctrine
- proofs
- rendered pack inventories
- source and archive material

But the live snapped runtime is narrower and proof-backed.

### Run-surface

The hot runtime executes through:

- `data/agent-buccet-law-foundation/data/working/active-law-body/manifest.json`
- `data/agent-buccet-law-foundation/data/working/active-law-body/projected-laws.json`
- `data/agent-buccet-law-foundation/user-path-ledger.json`
- the native `physwrap` lane
- the native `deep-intercept` lane
- the vendored Rust/WASM substrate package

These are the surfaces the runtime actually consumes for law identity, standing user law, native payload physics, native intercept, and substrate-backed transport.

### Read-surface

The larger readable body stays in the repo for operator visibility, proof, and study, but is not the hot execution path by default.

That includes items like:

- rendered boundary pack inventories
- generated base/time runtime corpora outside the active law body
- section maps and archive/provenance material
- broader reference docs

This is the distinction:

- full repo truth stays available
- hot runtime consequence stays pinned to the snapped system

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

Buccet's authority seam is first consequence-bearing contact, not a claim that every continuation syscall becomes a new sovereignty event. `open` / `openat`, `connect`, `exec*`, path mutation calls, and framework action proposals are the places where unknown motion is caught, frozen, and routed into Gravity / Bodyguard / UPL. Many lower-level syscall families are only alternate continuation shapes on an already-open file descriptor or socket.

The table below is therefore about native deep-intercept visibility and normalization depth, not a blanket statement that each uncovered family is a fresh authority bypass:

| Write path | Coverage |
|---|---|
| `open` / `openat` / `fopen` / `creat` (write mode) | **Covered** — deep-intercept hook |
| `write` | **Covered** — deep-intercept hook |
| `read` | **Covered** — deep-intercept hook |
| `execve` / `execv` / `execvp` | **Covered** — deep-intercept hook |
| `connect` / `socket` | **Covered** — deep-intercept hook |
| `writev` | **Not explicitly covered** — continuation-shape visibility gap on an already-open fd |
| `sendfile` | **Not explicitly covered** — kernel-assisted continuation copy path |
| `splice` / `tee` | **Not explicitly covered** — zero-copy continuation paths |
| `mmap(MAP_SHARED)` | **Not explicitly covered** — shared-memory mutation continuation path |
| `pwrite` / `pwritev` | **Not explicitly covered** — offset-write continuation shape |
| `io_uring` ops | **Not explicitly covered** — async submission path; this remains the hardest native gap |

The uncovered families are documented, not hidden. For most of them, the consequence should already have crossed the same upstream Buccet boundary earlier as `fs.read`, `fs.write`, `network.send`, or another finite action class. What is missing is per-family native normalization/proof depth, not a new independent authority system. `io_uring` is the clearest remaining case where deeper native handling is still needed.

### Egress: What is Checked at chat.emit vs Network Boundaries

- `chat.emit` — subject to boundary law evaluation (scope, grants, UPL, base laws) and automatic outbound payload classification for PII, credentials, and financial data
- `network.send` — subject to boundary law evaluation (domain allowlist, scope); enforced at the `connect()` interception level in the libc hook
- Egress structural validity (bodyguard/gravity) applies to all outbound action proposals before execution

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

**Shipped default posture:** persistent runtime sessions seed an outbound governor by default with velocity + mass active. This governs outbound runaway force and weighted session cost out of the box without pretending to be token accounting.

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

**Shipped default posture:** persistent runtime sessions seed inbound admission by default with velocity + density + mass active, plus the weak-provenance hard ceiling. This governs hostile wake-up force and weighted inbound cost out of the box.

### Path

```
Inbound → O(1) canyon cache → bounded provenance tracking → admission laws → deny/tarpit
```

### Admission Laws

| Law | Dimension | Law ID | Code | Ledger event |
|---|---|---|---|---|
| Velocity | Inbound RPM per provenance | `BOUNDARY.ADMISSION.VELOCITY.01` | `admission.ts` | `INGRESS_PROVENANCE_BLOCKED` |
| Density | Deny ratio → canyon hold promotion | `BOUNDARY.ADMISSION.DENSITY.01` | `admission.ts` | `INGRESS_CANYON_STATE_WRITTEN` (once) |
| Mass | Inbound weight horizon | `BOUNDARY.ADMISSION.MASS.01` | `admission.ts` | `INGRESS_PROVENANCE_BLOCKED` |
| Hard Block Ceiling | Weak provenance tarpit counter | `BOUNDARY.ADMISSION.HARD_CEILING.01` | `admission.ts` | `INGRESS_CANYON_STATE_WRITTEN` (once, `promotion_kind=hard_ceiling`) |
| Canyon Hold | O(1) cache hit | `BOUNDARY.ADMISSION.CANYON.01` | `admission.ts` | `INGRESS_PROVENANCE_BLOCKED` |

### Hard Block Ceiling

A structural safety floor that cannot be disabled or loosened by operator config.

**Invariant:** A weak-strength provenance (IP/network) accumulating `WEAK_PROVENANCE_HARD_BLOCK_CEILING` (= 10) tarpit decisions is unconditionally forced to canyon hold — regardless of `density.windowSize`, `density.maxDenyRatio`, or the absence of any density config.

**`totalDeniedCount` counts admission-layer tarpit decisions only** (velocity/mass/density trips at the admission boundary). It does NOT count `ACTION_BLOCKED` events from the bodyguard path. These are distinct paths: admission tarpits happen before the brain wakes; `ACTION_BLOCKED` events require the request to pass admission and then fail law evaluation in the bodyguard. The rate of `ACTION_BLOCKED` from admitted IPs is bounded by admission velocity limits (cap on RPM per weak provenance) and LLM inference speed — not by `totalDeniedCount`. The ceiling operates on the admission-tarpit path, which is the right path for forcing canyon promotion.

**TTL/LRU churn protection:** `totalDeniedCount` is tracked in two places: `provenanceRecords[ip].totalDeniedCount` (subject to normal TTL/LRU eviction) and `hostileDeniedCounts[ip]` (evicted by LRU size pressure only — NOT TTL-evicted, intentionally). When a provenance record is absent (new IP or evicted), the new record is seeded from `hostileDeniedCounts`. This means an IP cannot reset its ceiling counter by going quiet for `provenanceTtlMs` (5 min) and returning. Once hostile, always accumulating toward the ceiling. `hostileDeniedCounts` evicts by count ascending (lowest-count entries evicted first) to prioritise keeping the most dangerous IPs in memory.

**Two seams — two enforcement mechanisms:**

| Seam | What it is | How it is closed |
|---|---|---|
| **Architectural seam** | `ACTION_BLOCKED` is a material bypass event, written for every blocked action | Closed architecturally — `ACTION_BLOCKED` is only written via the bodyguard path (LLM-mediated, inference-speed limited). It is never written by the intercept path (the botnet-facing path). Admission events are the intercept path's write surface, and they are queueable (LIOPE-bounded). |
| **Config seam** | Density config could theoretically be set loose enough that weak provenance accumulates many blocks before density fires | Locked by hard ceiling — density config may make promotion sooner (tighter = faster), but it can NEVER delay promotion past `WEAK_PROVENANCE_HARD_BLOCK_CEILING` for weak provenance. This is enforced in `evaluateAdmission` in `admission.ts`, not in config. |

**`promotionKind` field in ledger:**
- `INGRESS_CANYON_STATE_WRITTEN` records now carry `promotion_kind: "density"` or `promotion_kind: "hard_ceiling"` in metadata — distinguishing which seam triggered the promotion.

**`validateAdmissionConfig()` warns on unsafe configs:**
- `density.windowSize > DENSITY_SAFE_MAX_WINDOW_SIZE` (= 20): density signal threshold exceeds the hard ceiling — density is effectively inert for weak provenances (ceiling fires first).
- `density.maxDenyRatio > 1.0`: after weak-provenance scaling, threshold is vacuously permissive.

These warnings do not disable the ceiling. They surface config drift at startup so operators know their density settings are outside the safe envelope.

### Ledger vs. Cache

| Layer | Role | I/O behavior |
|---|---|---|
| Ledger (`INGRESS_CANYON_STATE_WRITTEN`) | Durable exactly-once authority | Written once per hostile provenance on density trip |
| Canyon cache (`canyonProvenances`) | O(1) hot-path enforcement | In-memory, zero I/O |

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

- High-volume *admission observation events* (`INGRESS_PROVENANCE_BLOCKED`, `INGRESS_DENIED`, `INGRESS_VELOCITY_TRIP`, `INGRESS_DENSITY_TRIP`, `INGRESS_MASS_TRIP`) are enqueued in memory (O(1) hot path) and flushed in batches. These are the primary botnet storm events.
- *Material state transitions* (`SESSION_STARTED`, `GRANT_ISSUED`, `ACTION_PROPOSED`, `ACTION_BLOCKED`, `ACTION_EXECUTED`, `DECISION_RETURNED`, `GOVERNOR_TRIP`, `PROCESS_PHYSWRAP_ACTIVE`, `INGRESS_CANYON_STATE_WRITTEN`, etc.) bypass the queue and write immediately — always durable.
- When the queue is full, overflow events are shed. The shed count is tracked atomically.
- On each flush: if shed > 0, one `LEDGER_STORM_SUMMARY` record is prepended to the batch. It carries `shed_count`, `window_ms`, `by_class` (JSON breakdown by event type). It is ed25519-signed and chain-linked like any other record.
- File rollover: when the ledger file exceeds `BUCCET_LEDGER_MAX_FILE_SIZE_BYTES` (default 10 MB), it is renamed to a timestamped archive and a new file begins. Chain linkage is preserved via `prev_hash`.

**Two-path architecture — why the bypass set is safe under botnet pressure:**

Agent Buccet has two distinct execution paths with different write profiles:

| Path | Entry point | Typical caller | What writes on this path |
|---|---|---|---|
| **Intercept path** | `evaluateBoundaryIntercept` | Intercept daemon/server (network-facing) | `INGRESS_PROVENANCE_BLOCKED` (queueable), `INGRESS_CANYON_STATE_WRITTEN` (material, once per IP lifetime) |
| **Bodyguard path** | `enforceBodyguardBoundary` | LLM framework adapters (tool-call dispatch) | `ACTION_PROPOSED`, `DECISION_RETURNED`, `ACTION_BLOCKED`, `ACTION_EXECUTED`, `GOVERNOR_TRIP` |

A distributed botnet hits the **intercept path**. The intercept path calls `adjudicateBoundaryRequest` (the core adjudicator) directly — it does NOT pass through the outer bodyguard wrapper that writes `ACTION_PROPOSED` / `DECISION_RETURNED` / `ACTION_BLOCKED`. Those events are only written in the bodyguard path, which is reached via LLM inference (tool call proposals) — inference-speed limited, not IP-rate limited.

**Adversarial classification of each material bypass class:**

| Event class | Externally amplifiable | Max frequency under attack | Durability justified |
|---|---|---|---|
| `SESSION_STARTED/ENDED` | Only if session creation endpoint is unprotected upstream | Bounded by session creation rate | Yes — operator API, not direct attacker surface |
| `PATH_*/GRANT_*/RECIPIENT_*/DOMAIN_*/TOOL_*/DATABASE_*/SYSTEM_*` | No | Operator config events, not runtime | Yes |
| `UPL_ALLOW_RECORDED`, `UPL_DENY_RECORDED` | No | User interaction required | Yes |
| `ACTION_PROPOSED` | **Not via intercept path** (never written there). Via bodyguard path: inference-speed limited | ~1–5/sec via LLM tool calls | Yes — lawful-session audit trail; not botnet-reachable |
| `DECISION_RETURNED` | Same as ACTION_PROPOSED | Same | Yes |
| `ACTION_BLOCKED` | Same as ACTION_PROPOSED | Same | Yes — enforcement record |
| `ACTION_EXECUTED` | Requires passing law eval — harder than block | Very low | Yes |
| `GOVERNOR_TRIP` | Via bodyguard path only | maxRpm × session count | Yes — enforcement record, velocity-bounded |
| `INGRESS_CANYON_STATE_WRITTEN` | Structurally once per IP lifetime (`ledgered` flag check in intercept.ts) | One write per unique hostile IP | Yes — canyon hold authority record |
| `PROCESS_*`, `PROCESS_PHYSWRAP_*` | No — requires passing law eval + actual process spawn | Bounded by OS process limits | Yes |
| `APPROVAL_*`, `BODYGUARD_*`, `USER_CONFIRMED_DENY`, `PROPOSAL_REPLAYED` | No — human/operator gated | Near-zero | Yes |
| `LEDGER_STORM_SUMMARY` | No — emitted by LIOPE itself | One per flush window (100ms) | Yes — storm audit record |

**Residual dependency (config seam — locked by hard ceiling):** `ACTION_BLOCKED` is bounded by admission density config tightness AND the hard block ceiling. With density window=5, deny_ratio=0.6 (the default), a hostile IP is promoted to canyon hold after ~3 blocks. At worst — with no density config at all — the hard ceiling fires at `WEAK_PROVENANCE_HARD_BLOCK_CEILING` (= 10) tarpit decisions, unconditionally. With 10M unique IPs that each get at most 10 ACTION_BLOCKEDs, that is 100M writes — but these arrive over the time it takes 10M IPs to hit the ceiling (tens of minutes at realistic attack rates). Not a spike. The hard ceiling is a code-level floor, not a config parameter — it cannot be loosened. Density config only makes promotion happen sooner.

**Verdict:** The bypass set cannot be used as the new seam for botnet-scale disk exhaustion. The intercept path is the botnet-facing surface, and it writes only queueable admission events (shed under storm) plus exactly-once-per-IP canyon records. Action events (the material set) are gated behind LLM inference, not IP rate.

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

## Compatibility & Enforcement

Agent Buccet is entirely policy-source agnostic.

RLHF-shaped model behavior, constitutional constraints, external guardrail outputs, domain-specific safety primitives, and regulator or business policies are policy sources. Buccet does not invent that safety intent, and it does not replace the systems that establish it.

**Agent Buccet turns safety intent into boundary-level enforcement.**

Whatever safety primitive your model, business, or regulator already depends on, Buccet can carry that intent to the exact boundaries where agent behavior becomes consequence.

Agent Buccet does not replace your safety stack. It helps your existing safety intent hit the consequence boundary with more force.

Whatever target you already care about,
whatever safety intent you already trust,
Buccet helps make that intent bind at consequence time.

The effect is multiplicative, not replacement.

It is natively compatible with:
- RLHF-shaped models
- constitutional or policy-guided models
- external guardrail systems
- domain-specific safety primitives

These are the consequence boundaries where that intent binds:

| Boundary | What it is | What binds here |
|---|---|---|
| **Action Boundary** | Every tool call, file op, network send, process spawn — intercepted before execution | Base laws, UPL laws, scope, grants, gravity |
| **Output Boundary** | Chat emissions and outbound content | Scope, grants, UPL, base laws |
| **Input Admission Boundary** | Hostile inbound force denied before the brain wakes | Velocity, density, mass laws — brain never wakes for denied provenances |
| **Payload-Physics Boundary** | What approved processes can become and do | CPU, memory, file descriptors, wall-clock time — kernel-enforced |

Policy-source compatibility inside Buccet:

| Source | What it becomes |
|---|---|
| RLHF-shaped models | Existing safety intent presented at runtime. Buccet does not replace RLHF; it makes that intent bind at the boundary where action or output would become consequence. |
| Constitutional / policy-guided models | Existing policy intent carried into base laws or UPL-ready laws with the same enforcement class as every other Buccet law. |
| External guardrail systems | Existing guardrail verdicts expressed as standing law on the Buccet enforcement plane. Not a hint. Not a preference. Enforced on contact. |
| Domain-specific, regulator, or business rules | Existing permitted/denied targets, actions, and payload limits expressed as scope, grants, or UPL law and enforced identically to base laws. |

UPL is the policy binding surface. Any safety policy that can be expressed as a boundary decision on an action class, target, output condition, admission rule, or payload-physics limit is Buccet-compatible. UPL laws carry the same enforcement weight as base runtime laws. The agent cannot read them, cannot modify them, and cannot route around them.

The doctrine is exact: existing safety intent -> Buccet enforcement plane -> consequence-boundary enforcement.


---

## Transport Isolation

`buccet transport run` executes packaged workloads through the Buccet substrate portability chain (`applyIsolation` → `persistState` → `enterEnvironment`).

### Platform state

| Platform | `isolationActive` | What it means |
|----------|------------------|---------------|
| Linux | **true** | Full rootfs confinement — the workload runs inside the packaged rootfs, PATH is locked to the package, no host filesystem access outside the root |
| macOS | **false** (graceful degrade) | Rootfs escape prevention degrades silently; the workload runs but confinement is not enforced at the OS level |

macOS degradation is by design: `chroot`-style confinement requires elevated privileges on macOS that are not available in a standard install. The substrate reports `isolationActive: false` and continues. All other guarantees (`persistedState`, `enteredEnvironment`, boundary law enforcement) remain active.

**Linux is the full-isolation platform.** The macOS degrade is documented, not hidden. If your deployment depends on rootfs confinement, run transport workloads on Linux.

**Status:** Linux full-isolation path has not yet been independently verified on a live Linux machine in this release. The code path exists and is tested in the substrate contract. An operator-level Linux proof run is pending.

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
| Density → canyon hold | `admission.ts` | `INGRESS_CANYON_STATE_WRITTEN` promotion_kind=density | `agent-buccet-admission-contract.ts` |
| Hard block ceiling → canyon hold | `admission.ts` | `INGRESS_CANYON_STATE_WRITTEN` promotion_kind=hard_ceiling | `agent-buccet-admission-hardcap-contract.ts` |
| Hard ceiling config seam locked | `admission.ts:WEAK_PROVENANCE_HARD_BLOCK_CEILING` | — | `agent-buccet-admission-hardcap-contract.ts` |
| Hard ceiling survives TTL/LRU churn | `admission.ts:hostileDeniedCounts` | — | `agent-buccet-admission-hardcap-contract.ts` H7 |
| O(1) cache hit | `admission.ts` | `INGRESS_PROVENANCE_BLOCKED` dim=canyon | `agent-buccet-admission-contract.ts` |
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
- Hard block ceiling for weak provenance — code-enforced safety floor, cannot be loosened by density config
- Ledger I/O Physics Envelope (LIOPE) — storm-survival, bounded I/O, signed storm summaries — live

### Unsafe claims (do not make)

- Full OS-kernel mediation on every syscall (eBPF/seccomp/ptrace — not part of this release)
- Impossible bypass on all OS paths
- Per-syscall native proof on every continuation write/send primitive
- Hardware-backed key protection by default
- rlimit strong-path guarantees when `PROCESS_PHYSWRAP_FALLBACK` is in ledger
- Input DDoS protection when `admissionConfig` is absent from `BoundaryRuntimeConfig`

---

## Known Behavioral Defaults

### Process Policy: no ambient shell authority

`BoundaryProcessPolicy.allowedCommands` controls which commands the boundary will let `tool.exec` run. If `allowedCommands` is absent or empty, Buccet does **not** treat that as broad shell authority.

Command execution is allowed only if one of these is true:

- the command matches explicit standing process policy in `allowedCommands`
- the command is the current explicitly granted command target for this one boundary-approved action

An empty allowlist does not silently become "anything in PATH can run."

**If you want an explicit command allowlist:**

```typescript
processPolicy: {
  allowedCommands: ["git", "npm", "node"], // only these run
  blockedCommands: ["rm", "curl"],          // always blocked, even if in allowedCommands
}
```

**What you can claim:** Buccet does not give ambient shell authority by default. `tool.exec` still enters the normal boundary path, and the process layer only permits the explicitly allowed command policy or the current approved command target.

### Schema Versioning: v1 only, no migration path

Persisted session state is stamped `schemaVersion: 1`. There is no migration function for v1 → v2. If the schema changes in a future release, old session files will not load — the runtime will create a fresh session (fail-safe, not fail-open). No data from the old session will carry forward silently.

**If your deployment depends on session continuity across upgrades**, check for schema version changes in release notes. Migration utilities will be added when a schema-breaking change ships.

---

## Open Source

Agent Buccet is built for the open-source world as much as the closed one.

Open-source builders should not have to choose between freedom and responsibility. With Agent Buccet, open systems can ship with visible boundaries, enforceable consequence control, and durable proof of what was allowed, denied, contained, or stopped.

This means open-source teams can show, not just claim, that their agent deployments are governed:

- what boundaries exist
- what actions were allowed or denied
- what payload physics were enforced
- what input was blocked before the brain woke
- what output was stopped before consequence landed
- what the ledger recorded from first input to final consequence

Agent Buccet does not ask the world to blindly trust open systems. It gives open systems a way to demonstrate bounded, auditable, enforceable behavior in the real world.

Build with it. Ship with it. Extend it. Defend your agents with it.

We ask only one thing: let Agent Buccet be your bodyguard.
