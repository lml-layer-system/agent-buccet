# Governor Physics: Two-Tier Containment

Agent Buccet governs two layers:

**Boundary Laws (Tier 1)** — how the agent moves (motion governance)
**Payload Physics (Tier 2)** — what approved processes can physically become (envelope governance)

These are not the same thing. An agent that moves slowly and lawfully can still spawn a process that allocates infinite memory. The two tiers together close the full break surface.

A third layer governs the inbound direction:

**Input Admission Boundary** — hostile inbound traffic denied before it reaches the brain

---

## Tier 1 — Boundary Laws (Motion Governance)

Four kinetic dimensions govern how the agent crosses the action boundary per session. All four are pure functions in `governor.ts`. State is carried in `BoundaryRuntimeConfig.governorState` and flows back through `BoundaryExecutionResult.config` after every crossing.

### Velocity

Maximum boundary crossings per minute.

Agent actions cross the boundary constantly. Without a ceiling, an agent can fire thousands of actions per minute — either as a runaway loop or as a deliberate overwhelm attempt. Velocity applies a sliding-window RPM ceiling. Actions that arrive above the ceiling are frozen and surfaced through Terminal 2 before law evaluation continues.

```ts
governorConfig: {
  velocity: { maxRpm: 60, windowMs: 60_000 }
}
```

Law ID: `BOUNDARY.GOVERNOR.VELOCITY.01`
Ledger event: `GOVERNOR_TRIP` (dimension: `"velocity"`)

### Density

Maximum ratio of unlawful-to-lawful crossings in a sliding window.

A healthy session has a low denial rate. An agent that fires repeated denied actions has a pathological density pattern. Density trips when the recent denial ratio exceeds the configured threshold.

```ts
governorConfig: {
  density: { maxFailureRatio: 0.8, windowSize: 20 }
}
```

Law ID: `BOUNDARY.GOVERNOR.DENSITY.01`
Ledger event: `GOVERNOR_TRIP` (dimension: `"density"`)

### Mass

Absolute weighted action horizon per session.

Every session has a ceiling on total actions, weighted by action class. Dangerous actions (`tool.exec`, `fs.delete`, `db.delete`) count more toward the horizon than lightweight reads. When the ceiling is reached, no further crossings are permitted in that session.

```ts
governorConfig: {
  mass: { maxCrossings: 500 },
}
```

Law ID: `BOUNDARY.GOVERNOR.MASS.01`
Ledger event: `GOVERNOR_TRIP` (dimension: `"mass"`)

### Weight

Asymmetric per-action-class cost scaling used by Mass.

Not all actions cost the same. `weight` is a partial override table. Unspecified action kinds use the default table below.

```ts
governorConfig: {
  weight: {
    "tool.exec": 10,
    "fs.delete": 8,
    "network.send": 5,
    "fs.read": 1,
  }
}
```

Weight is not a separate law dimension — it is the cost scale applied when computing the Mass running total.

### Default Weight Table

| Action kind | Default weight |
|---|---|
| `tool.exec` | 10 |
| `fs.delete` | 8 |
| `sys.credential.use` | 8 |
| `sys.credential.read` | 8 |
| `sys.config.write` | 6 |
| `sys.env.write` | 6 |
| `network.send` | 5 |
| `comm.send` | 5 |
| `db.delete` | 8 |
| `db.update` | 4 |
| `db.insert` | 3 |
| `db.query` | 2 |
| `fs.write` | 2 |
| `fs.append` | 2 |
| `fs.move` | 2 |
| `fs.read` | 1 |
| `chat.emit` | 1 |
| `sys.env.read` | 1 |
| `sys.config.read` | 1 |
| (unlisted) | 1 |

### Fail Behavior

Governor trips before `evaluateBoundaryLaws` is called. Terminal 1 freezes the action, records `GOVERNOR_TRIP`, and surfaces the event through the normal approval path. Terminal 2 still decides the outcome. No execution happens while the event is held. Fail closed — no silent continuation.

---

## Tier 2 — Payload Physics

Tier 1 governs boundary crossings. A single approved `tool.exec` crossing can still spawn a process that exhausts all RAM, opens infinite file descriptors, or runs forever. Tier 2 governs what that process can physically do and become.

The payload physics policy (`BoundaryProcessPhysics`) is OS-agnostic. Enforcement is OS-native, applied by a Native Physics Translator (`buccet-physwrap`) that selects the platform's appropriate backend. Two distinct enforcement classes exist under Tier 2.

---

### Tier 2a — Payload Envelope Physics

**What it governs:** launch-time ceiling on what a process can BECOME. Limits are set before `exec()`; the kernel terminates or blocks the process itself when the ceiling is exceeded. Governs the entire lifecycle of the process from birth.

| Policy field | Native primitive | Breach behavior |
|---|---|---|
| `wallClockTimeoutMs` | `setTimeout` → `SIGKILL` | unconditional kill (Node.js, all platforms) |
| `cpuTimeLimitSec` | `RLIMIT_CPU` / `PerJobUserTimeLimit` | `SIGXCPU`→`SIGKILL` / job termination |
| `maxProcesses` | `RLIMIT_NPROC` / `ActiveProcessLimit` | `EAGAIN` on `fork` / `CreateProcess` fails |
| `maxMemoryBytes` | `RLIMIT_AS` / `ProcessMemoryLimit` | `ENOMEM` / `VirtualAlloc` fails |

**Platform coverage:**

| Field | Linux | macOS | Windows |
|---|---|---|---|
| `wallClockTimeoutMs` | **LIVE** | **LIVE** | **LIVE** |
| `cpuTimeLimitSec` | **LIVE** | **LIVE** | **LIVE** |
| `maxProcesses` | **LIVE** | **LIVE** — `RLIMIT_NPROC` (per-user scope; not per-process-tree) | **LIVE** |
| `maxMemoryBytes` | **LIVE** | **LIVE** — `RLIMIT_AS` + `memorystatus_control` jetsam (arm64 coverage) | **LIVE** |

Ledger metadata key: `physwrap_envelope_active`, `physwrap_envelope_skipped`.

---

### Tier 2b — Live I/O / Object Boundary

**What it governs:** ongoing enforcement on live I/O operations during execution. The process continues running; operations are denied or throttled depending on platform semantics.

| Policy field | Native primitive | Breach behavior | Platforms |
|---|---|---|---|
| `maxOpenFiles` | `RLIMIT_NOFILE` | `EMFILE` on `open()`/`socket()` — refuse | Linux, macOS |
| `maxOpenFiles` | IAT hook on `CreateFileA`/`CreateFileW` in `buccet-ioboundary.dll` | `ERROR_TOO_MANY_OPEN_FILES` — refuse | Windows |
| `maxFileSizeBytes` | `RLIMIT_FSIZE` | `SIGXFSZ` on `write()` beyond size — refuse | Linux, macOS |
| `maxFileSizeBytes` | IAT hook on `WriteFile` in `buccet-ioboundary.dll` | `ERROR_FILE_TOO_LARGE` — refuse | Windows |
| `maxIoRateBytesPerSec` | `SetIoRateControlInformationJobObject` `MaxBandwidth` | I/O delayed by kernel scheduler — throttle | Windows 10 1607+ |
| `maxIoOpsPerSec` | `SetIoRateControlInformationJobObject` `MaxIops` | I/O delayed by kernel scheduler — throttle | Windows 10 1607+ |

**Platform coverage:**

| Field | Linux | macOS | Windows |
|---|---|---|---|
| `maxOpenFiles` | **LIVE** — `RLIMIT_NOFILE` → `EMFILE` (refuse) | **LIVE** — `RLIMIT_NOFILE` → `EMFILE` (refuse) | **LIVE** — IAT hook → `ERROR_TOO_MANY_OPEN_FILES` (refuse) |
| `maxFileSizeBytes` | **LIVE** — `RLIMIT_FSIZE` → `SIGXFSZ` (refuse) | **LIVE** — `RLIMIT_FSIZE` → `SIGXFSZ` (refuse) | **LIVE** — IAT hook → `ERROR_FILE_TOO_LARGE` (refuse) |
| `maxIoRateBytesPerSec` | Skipped — no rlimit equiv | Skipped — no rlimit equiv | **LIVE** — Job Object I/O rate throttle (Win 10 1607+) |
| `maxIoOpsPerSec` | Skipped — no rlimit equiv | Skipped — no rlimit equiv | **LIVE** — Job Object IOPS throttle (Win 10 1607+) |

**Windows Tier 2b implementation — `buccet-ioboundary.dll`:**
`physwrap_win.c` injects `buccet-ioboundary.dll` into the target process while the main thread is SUSPENDED, before any user code runs. The DLL uses IAT patching to hook `CreateFileA`/`CreateFileW` and `WriteFile` in all loaded modules. When the open-file count reaches `maxOpenFiles`, `CreateFile` returns `INVALID_HANDLE_VALUE` with `ERROR_TOO_MANY_OPEN_FILES` — per-operation refusal. When a write would cause a file to exceed `maxFileSizeBytes`, `WriteFile` returns `FALSE` with `ERROR_FILE_TOO_LARGE`. Future modules loaded via `LoadLibrary` are also patched. Fail closed: if the DLL cannot be found or injection fails, physwrap terminates the process and exits with code 2.

**Scope note (Windows IAT hook):** Covers Win32 API callers (`CreateFileA/W`, `WriteFile`). Processes calling `ntdll.dll` directly (bypassing Win32) are outside this boundary. Standard agent workloads are covered.

**Semantic note — refuse vs throttle:**
POSIX rlimits and Windows IAT hooks both implement **refuse** semantics for `maxOpenFiles`/`maxFileSizeBytes`: the operation returns an error immediately. Windows I/O rate control implements **throttle** semantics: the kernel delays operations to enforce the budget. The nofile/fsize contract is semantically equivalent across all platforms.

Ledger metadata keys: `physwrap_io_boundary_active`, `physwrap_io_boundary_skipped`.

---

### Native Physics Translator (`buccet-physwrap`)

**The physwrap binary is the native enforcement translator for Tier 2 limits.**

The policy layer (`BoundaryProcessPhysics`) declares OS-agnostic limits. The physwrap translator converts them into the platform's native enforcement primitives before `exec()`. Without physwrap, limits are applied via a shell-ulimit fallback that is auditable but weaker.

`process.ts` selects the enforcement path automatically:
- `PROCESS_PHYSWRAP_ACTIVE` — physwrap binary found and used; metadata includes per-class coverage
- `PROCESS_PHYSWRAP_FALLBACK` — binary not found; shell-ulimit fallback in use

**If `PROCESS_PHYSWRAP_FALLBACK` appears in the ledger, the strong-path guarantees do not apply.**

#### Platform Status

One physwrap source per platform. Same contract after the hook — same ledger events, same metadata shape, same operator guarantee model. The only OS-specific layer is the translator itself.

| Platform | Source file | Tier 2a method | Tier 2b method | Privilege drop |
|---|---|---|---|---|
| **Linux** | `physwrap.c` | `setrlimit()` + `PR_CAPBSET_DROP(CAP_SYS_RESOURCE)` | `setrlimit()` (refuse semantics) | `PR_CAPBSET_DROP` |
| **macOS** | `physwrap_mac.c` | `setrlimit()` + `memorystatus_control` jetsam (arm64 memory) | `setrlimit()` (refuse semantics) | `setgid()`/`setuid()` via `--uid`/`--gid` |
| **Windows** | `physwrap_win.c` + `buccet_ioboundary_win.c` | NT Job Objects | IAT hook DLL: nofile/fsize (refuse); Job Object: io_rate/iops (throttle, Win 10 1607+) | N/A |

All three are built by `native/physwrap/build.sh` (POSIX) or `native/physwrap/build_win.bat` (MSVC). Platform recorded in `physwrap_platform` of `PROCESS_PHYSWRAP_ACTIVE` events.

#### Linux Strong-Path Guarantee (`physwrap.c`)

On Linux with physwrap active:

1. `prctl(PR_CAPBSET_DROP, CAP_SYS_RESOURCE)` removes the capability from the bounding set before `exec()`. The spawned process and all its descendants cannot call `setrlimit()` to raise limits above the configured ceiling, regardless of UID. `EPERM` (lacks `CAP_SETPCAP`) is non-fatal but logged as `PROCESS_PHYSWRAP_CAP_WARNING` — limits still bind for non-root processes.
2. `prctl(PR_CAP_AMBIENT, PR_CAP_AMBIENT_LOWER, CAP_SYS_RESOURCE)` clears the ambient set (Linux 4.3+; silently ignored on older kernels).
3. `setrlimit()` is called with **hard == soft** for each limit. Setting the hard limit equal to the soft prevents self-elevation without requiring the capability.
4. `execvp()` — no shell interposition, no PATH injection surface.

#### `PROCESS_PHYSWRAP_ACTIVE` Ledger Metadata

Every physwrap invocation records per-class coverage and runtime-observed backend reinforcement. This event is emitted **post-exit** so it carries the exact physics that were active for the run, not just the physics that were configured.

```
physwrap_platform                    "linux" | "macos" | "windows" | "unknown"
physwrap_envelope_active             comma-separated active Tier 2a limits, e.g. "cpu,nproc,as"
physwrap_envelope_skipped            comma-separated skipped Tier 2a limits
physwrap_io_boundary_active          comma-separated active Tier 2b limits
                                     Linux/macOS: "nofile,fsize" (rlimit refuse)
                                     Windows: "nofile,fsize" (IAT hook refuse) + "io_rate"/"io_iops" if configured
physwrap_io_boundary_skipped         comma-separated skipped Tier 2b limits
                                     Linux/macOS: "io_rate,io_iops" if configured (no rlimit equiv)
                                     Windows: "io_rate"/"io_iops" if not configured
physwrap_privilege_active            e.g. "uid_gid_drop" on macOS when --uid provided
physwrap_privilege_skipped           e.g. "uid_gid_drop" on Linux (CAP drop is always on)
physwrap_macos_jetsam_reinforcement  Darwin only — runtime-observed jetsam ceiling outcome:
                                       "active"              memorystatus_control applied (full arm64 coverage)
                                       "failed"              memorystatus_control returned error; RLIMIT_AS active
                                       "unavailable"         symbol absent (weak_import NULL); RLIMIT_AS active
                                       "not_configured"      --as-kb not passed; no memory limit applied
                                       "status_file_missing" physwrap crashed before writing status
                                       "n/a"                 non-Darwin platform
```

**Darwin memory enforcement — reading the ledger truth:** `physwrap_platform=macos` + `physwrap_macos_jetsam_reinforcement=active` means both `RLIMIT_AS` and the jetsam ceiling are live. Any other value tells the operator exactly which path degraded and why. The jetsam status is written by `physwrap_mac.c` to a temp file before `execvp()` and read by `process.ts` after child exit — it reflects what actually ran, not just what was configured.

`physwrap_io_boundary_active` containing `nofile` and `fsize` on Windows confirms the IAT hook DLL was wired and per-operation refusal is live.

#### Shell-Ulimit Fallback (Auditable Degradation)

When physwrap is not available, `process.ts` falls back to `sh -c ulimit -S{flag} N; ulimit -H{flag} N; exec {cmd}`. Both soft and hard flags are set explicitly. The ledger records `PROCESS_PHYSWRAP_FALLBACK`.

Fallback weaknesses relative to the strong path:
- Requires `sh` to be present in the environment
- Does not drop `CAP_SYS_RESOURCE` — root or cap-elevated processes can raise limits
- Shell subprocess adds a thin injection surface
- Not available on Windows

**When the fallback path is active, the system's guarantee level is explicitly downgraded. Operators should treat `PROCESS_PHYSWRAP_FALLBACK` ledger events as a configuration gap requiring resolution.**

Build physwrap to restore the strong path:
```bash
npm run build:native:physwrap
```

---

## Input Admission Boundary

**Status: LIVE**

The same doctrine applied inward. Outbound: protect the world from agent force. Inbound: protect the agent/system from hostile inbound force.

**The brain must never be the thing that filters attacks aimed at waking the brain.**

If hostile traffic reaches tokenization, prompt assembly, inference, or API calls before denial, the attacker has already won: compute bleed, wallet bleed, rate-limit bleed, and starvation of real users.

### Admission Law Family

The same four kinetic dimensions govern inbound traffic per provenance. All are pure functions in `admission.ts`.

| Law | Dimension | What it governs | Law ID |
|---|---|---|---|
| Velocity | RPM ceiling per provenance per window | Request rate | `BOUNDARY.ADMISSION.VELOCITY.01` |
| Density | Deny ratio in sliding window → canyon promotion | Pathological repetition | `BOUNDARY.ADMISSION.DENSITY.01` |
| Mass | Inbound weight horizon per provenance per window | Total cost of admitted work | `BOUNDARY.ADMISSION.MASS.01` |
| Canyon Hold | O(1) cache check | Exact provenance match after promotion | `BOUNDARY.ADMISSION.CANYON.01` |

Velocity and Mass trips tarpit the current request but do **not** promote to canyon cache alone — density is the promotion seam. The distinction: temporary rate enforcement ≠ durable canyon hold.

### Inbound Weight Table

Not all inputs cost the same.

| Weight class | Default weight | Examples |
|---|---|---|
| `standard` | 1 | Normal chat/tool request |
| `large_prompt` | 4 | Body > configured token threshold |
| `retrieval_request` | 5 | Triggers RAG / external retrieval |
| `attachment` | 6 | Binary or media attachment |
| `fanout_request` | 8 | Triggers broadcast to multiple targets |

### Provenance Policy

Provenance classes in order of strength:

1. **Strong** — authenticated pubkey / signed identity: double threshold headroom
2. **Medium** — session identity / device / client binding: no scaling
3. **Weak** — IP / network provenance: half threshold (tighter denial ceiling)

Stronger provenance = more headroom before denial. Weaker provenance = faster trip.

### Bounded Provenance Tracking

Provenance density tracking is bounded by LRU eviction and TTL:

- `provenanceMaxSize` (default 10,000): when exceeded, oldest-by-last-seen entries are evicted
- `provenanceTtlMs` (default 300,000 ms): entries not seen within TTL are evicted on next access

This prevents an attacker from converting compute DDoS into memory DDoS by spraying fake provenances.

### Canyon Hold Promotion: Ledger vs. Cache

- **Ledger** — durable exactly-once authority: `INGRESS_CANYON_STATE_WRITTEN` written once per hostile provenance when density threshold is crossed
- **Cache** — O(1) hot-path enforcement: in-memory `canyonProvenances` checked before any law evaluation

Flood traffic never creates flood disk writes. The state update is synchronous (exactly-once in the single-threaded Node.js event loop) before the async ledger write. `ledgered: false → true` flag prevents re-write under any concurrent evaluation.

### Enforcement Path

```
Inbound request
  │
  ├─► O(1) canyon cache check       ← zero I/O, zero allocation
  │     hit → TARPIT (hold socket, return nothing)
  │
  ├─► Bounded provenance record lookup
  │     (LRU/TTL eviction on miss)
  │
  ├─► Velocity check (per-provenance RPM)
  │     trip → TARPIT (+ density check for canyon promotion)
  │
  ├─► Mass check (per-provenance inbound weight)
  │     trip → TARPIT (+ density check for canyon promotion)
  │
  ├─► Density check (deny ratio in sliding window)
  │     trip → canyon promotion → INGRESS_CANYON_STATE_WRITTEN (once)
  │          → TARPIT
  │
  └─► ADMIT → law evaluation, routing, model path
```

**Tarpit behavior:** not a fast HTTP 403 or 429. The intercept layer holds the socket open, drops the payload, and returns nothing. Attacker threads hang until their own OS times out. Attacker socket pool is exhausted, not ours.

### Admission Boundary Placement

The Input Admission Boundary fires at the **earliest intercept layer** — inside `evaluateBoundaryIntercept()`, before any law evaluation, gravity, approval queue, tokenization, prompt assembly, or model invocation.

To activate: supply `admissionConfig` and `admissionState` in `BoundaryRuntimeConfig`.

### Ledger Events

| Event | When emitted |
|---|---|
| `INGRESS_CANYON_STATE_WRITTEN` | Once per hostile provenance at density trip (durable canyon/cache record; not UPL) |
| `INGRESS_PROVENANCE_BLOCKED` | On each tarpit decision (per-call, not per-packet) |
| `INGRESS_DENIED` | Reserved for explicit deny path |
| `INGRESS_VELOCITY_TRIP` | Reserved |
| `INGRESS_DENSITY_TRIP` | Reserved |
| `INGRESS_MASS_TRIP` | Reserved |

---

## Architecture Map

```
INBOUND DIRECTION
  Input Admission Boundary
    ├── Velocity: RPM ceiling per provenance
    ├── Density: deny ratio → canyon promotion → O(1) cache
    ├── Mass: inbound weight horizon
    └── Canyon Hold: O(1) cache check — brain never wakes

MOTION (OUTBOUND)
  Boundary Laws (Tier 1)
    ├── Velocity: RPM ceiling per session
    ├── Density: pathological failure ratio
    ├── Mass: weighted total action horizon
    └── Weight: asymmetric per-class cost scale

ENVELOPE (OUTBOUND)
  Payload Physics (Tier 2)
    ├── Wall-clock timeout: SIGKILL after N ms [LIVE — all platforms]
    ├── CPU time limit: RLIMIT_CPU (physwrap → setrlimit) [LIVE — Linux/macOS]
    ├── Process tree: RLIMIT_NPROC (physwrap → setrlimit) [LIVE — Linux/macOS (per-user scope on macOS)]
    ├── Memory: RLIMIT_AS + memorystatus_control jetsam (physwrap) [LIVE — Linux/macOS]
    ├── File descriptors: RLIMIT_NOFILE / IAT hook CreateFileA/W [LIVE — all platforms]
    ├── File size: RLIMIT_FSIZE / IAT hook WriteFile [LIVE — all platforms]
    └── CAP_SYS_RESOURCE bounding-set drop [LIVE — Linux, requires CAP_SETPCAP]
```

---

## Trust Surface Assumptions

These guarantees hold within the declared Buccet enforcement surface, assuming:

1. **Hook integrity** — the intercept hook is running and has not been bypassed or removed
2. **Kernel integrity** — the OS kernel enforces rlimits, signals, and capability constraints as specified
3. **Physwrap path active** — the `PROCESS_PHYSWRAP_ACTIVE` ledger event must be present; if `PROCESS_PHYSWRAP_FALLBACK` appears, root/cap-elevated payloads can raise their own limits
4. **Unprivileged payload** — on the physwrap strong path (Linux), the spawned process cannot raise limits above the hard ceiling regardless of UID; on the fallback path, this requires the process to lack `CAP_SYS_RESOURCE`
5. **`CAP_SETPCAP` available** — the Node.js process running physwrap must hold `CAP_SETPCAP` for the bounding-set drop to succeed on Linux; `EPERM` is non-fatal but is logged as `PROCESS_PHYSWRAP_CAP_WARNING`

When any assumption is violated, the affected guarantee is explicitly downgraded in the ledger via the appropriate event type.
