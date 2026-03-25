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

Agent actions cross the boundary constantly. Without a ceiling, an agent can fire thousands of actions per minute — either as a runaway loop or as a deliberate overwhelm attempt. Velocity applies a sliding-window RPM ceiling. Actions that arrive above the ceiling are denied before law evaluation.

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

Governor trips before `evaluateBoundaryLaws` is called. No law evaluation, no approval prompt, no execution. The ledger records a `GOVERNOR_TRIP` event with the dimension, law ID, and reason. A `deny_and_explain` recovery move is returned. Fail closed — no fallback, no retry.

---

## Tier 2 — Payload Physics (Envelope Governance)

Tier 1 governs boundary crossings. A single approved `tool.exec` crossing can still spawn a process that exhausts all RAM, opens infinite file descriptors, or runs forever. Tier 2 governs what that process can physically become.

The payload physics policy (`BoundaryProcessPhysics`) is OS-agnostic. Enforcement is OS-native, applied by a Native Physics Translator that selects the appropriate backend for the current platform.

### Wall-Clock Timeout

**Status: LIVE (all platforms)**

Maximum elapsed time for an approved process. When the timeout expires, the process receives `SIGKILL` from the Node.js runtime. No cooperation required — the process is killed unconditionally.

```ts
processPolicy: {
  physics: { wallClockTimeoutMs: 30_000 }
}
```

Ledger event: `PROCESS_WALL_CLOCK_KILL`
Implementation: `setTimeout` + `child.kill('SIGKILL')`, cleared on normal exit.

### Native Physics Translator (`buccet-physwrap`)

**The physwrap binary is the native enforcement translator for Tier 2 limits.**

The policy layer (`BoundaryProcessPhysics`) declares OS-agnostic limits. The physwrap translator converts them into the platform's native enforcement primitives before `exec()`. Without physwrap, limits are applied via a shell-ulimit fallback that is auditable but weaker.

`process.ts` selects the enforcement path automatically:
- `PROCESS_PHYSWRAP_ACTIVE` ledger event: physwrap binary found and used — strong path
- `PROCESS_PHYSWRAP_FALLBACK` ledger event: binary not found — shell-ulimit fallback in use

**If `PROCESS_PHYSWRAP_FALLBACK` appears in the ledger, the strong-path guarantees below do not apply.**

#### Platform Status

One physwrap source per platform. Same contract after the hook — same ledger events, same metadata shape, same operator guarantee model. The only OS-specific layer is the translator itself.

| Platform | Source file | Method | Cap drop | Status |
|---|---|---|---|---|
| **Linux** | `physwrap.c` | `setrlimit()` + `prctl(PR_CAPBSET_DROP, CAP_SYS_RESOURCE)` | Yes — bounding set | **LIVE** |
| **macOS** | `physwrap_mac.c` | `setrlimit()` (Darwin POSIX) | N/A — no Linux cap system | **LIVE** |
| **Windows** | `physwrap_win.c` | NT Job Objects (`CreateJobObject` + `SetInformationJobObject`) | N/A | **LIVE** |

All three are built by `native/physwrap/build.sh` (POSIX platforms) or `native/physwrap/build_win.bat` (MSVC). Platform is detected at build time and recorded in the `physwrap_platform` field of `PROCESS_PHYSWRAP_ACTIVE` ledger events.

**macOS root processes:** POSIX `setrlimit()` hard limits prevent self-elevation for unprivileged processes. Root can exceed on Darwin. A Darwin-native sandbox backend (App Sandbox / seatbelt-class) is the correct next-phase mechanism for privileged containment — documented, not implied as present.

**CRITICAL RULE:** macOS next-phase documentation stays at the backend class level (App Sandbox / seatbelt-class), not a single API name. Darwin sandbox APIs are version-sensitive; the class maps to the appropriate primitive at build time.

#### Linux Strong-Path Guarantee (`physwrap.c`)

On Linux with physwrap active:

1. `prctl(PR_CAPBSET_DROP, CAP_SYS_RESOURCE)` removes the capability from the bounding set before `exec()`. The spawned process and all its descendants cannot call `setrlimit()` to raise limits above the configured ceiling, regardless of UID. `EPERM` (lacks `CAP_SETPCAP`) is non-fatal but logged as `PROCESS_PHYSWRAP_CAP_WARNING` — limits still bind for non-root processes.
2. `prctl(PR_CAP_AMBIENT, PR_CAP_AMBIENT_LOWER, CAP_SYS_RESOURCE)` clears the ambient set (Linux 4.3+; silently ignored on older kernels).
3. `setrlimit()` is called with **hard == soft** for each limit. Setting the hard limit equal to the soft prevents self-elevation without requiring the capability.
4. `execvp()` — no shell interposition, no PATH injection surface.

#### Supported Limits by Platform

| Policy field | Primitive | Signal / error on breach | Linux | macOS | Windows |
|---|---|---|---|---|---|
| `cpuTimeLimitSec` | `RLIMIT_CPU` / `PerJobUserTimeLimit` | `SIGXCPU`→`SIGKILL` / job termination | ✓ | ✓ | ✓ |
| `maxProcesses` | `RLIMIT_NPROC` / `ActiveProcessLimit` | `EAGAIN` on `fork` / `CreateProcess` fails | ✓ | — | ✓ |
| `maxMemoryBytes` | `RLIMIT_AS` / `ProcessMemoryLimit` | `ENOMEM` / `VirtualAlloc` fails | ✓ | — | ✓ |
| `maxOpenFiles` | `RLIMIT_NOFILE` | `EMFILE` | ✓ | ✓ | — |
| `maxFileSizeBytes` | `RLIMIT_FSIZE` | `SIGXFSZ` | ✓ | ✓ | — |
| `CAP_SYS_RESOURCE` drop | `PR_CAPBSET_DROP` | prevents self-elevation | ✓ | N/A | N/A |

macOS: `maxProcesses` (`RLIMIT_NPROC`) and `maxMemoryBytes` (`RLIMIT_AS`) are accepted but silently ignored — not reliably enforced on Darwin. Flags are consumed without error.

Windows: `maxOpenFiles` and `maxFileSizeBytes` are accepted but not yet enforced — no Job Object equivalent. `PROCESS_PHYSWRAP_ACTIVE` is still recorded; the active limits are listed in the metadata.

```ts
processPolicy: {
  physics: {
    wallClockTimeoutMs: 30_000,
    cpuTimeLimitSec: 10,
    maxProcesses: 32,           // Linux only
    maxMemoryBytes: 536870912,  // 512 MB — Linux only
    maxOpenFiles: 64,
    maxFileSizeBytes: 104857600, // 100 MB
  }
}
```

Ledger events: `PROCESS_PHYSWRAP_ACTIVE` (strong path) or `PROCESS_PHYSWRAP_FALLBACK` (degraded path), plus `PROCESS_SPAWNED` and `PROCESS_EXITED`.

#### Shell-Ulimit Fallback (Auditable Degradation)

When physwrap is not available, `process.ts` falls back to `sh -c ulimit -S{flag} N; ulimit -H{flag} N; exec {cmd}`. Both soft and hard flags are set explicitly. The ledger records `PROCESS_PHYSWRAP_FALLBACK`.

Fallback weaknesses relative to the strong path:
- Requires `sh` to be present in the environment
- Does not drop `CAP_SYS_RESOURCE` — root or cap-elevated processes can raise limits
- Shell subprocess adds a thin injection surface

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
| Density | Deny ratio in sliding window → standing deny | Pathological repetition | `BOUNDARY.ADMISSION.DENSITY.01` |
| Mass | Inbound weight horizon per provenance per window | Total cost of admitted work | `BOUNDARY.ADMISSION.MASS.01` |
| Standing Deny | O(1) cache check | Exact provenance match after promotion | `BOUNDARY.ADMISSION.STANDING_DENY.01` |

Velocity and Mass trips tarpit the current request but do **not** promote to standing deny alone — standing deny promotion is density-driven only. The distinction: temporary rate enforcement ≠ permanent ban.

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

### Standing-Deny Promotion: Ledger vs. Cache

- **Ledger** — durable exactly-once authority: `INGRESS_STANDING_LAW_WRITTEN` written once per hostile provenance when density threshold is crossed
- **Cache** — O(1) hot-path enforcement: in-memory `standingDenyProvenances` checked before any law evaluation

Flood traffic never creates flood disk writes. The state update is synchronous (exactly-once in the single-threaded Node.js event loop) before the async ledger write. `ledgered: false → true` flag prevents re-write under any concurrent evaluation.

### Enforcement Path

```
Inbound request
  │
  ├─► O(1) standing-deny cache check       ← zero I/O, zero allocation
  │     hit → TARPIT (hold socket, return nothing)
  │
  ├─► Bounded provenance record lookup
  │     (LRU/TTL eviction on miss)
  │
  ├─► Velocity check (per-provenance RPM)
  │     trip → TARPIT (+ density check for standing-deny promotion)
  │
  ├─► Mass check (per-provenance inbound weight)
  │     trip → TARPIT (+ density check for standing-deny promotion)
  │
  ├─► Density check (deny ratio in sliding window)
  │     trip → standing-deny promotion → INGRESS_STANDING_LAW_WRITTEN (once)
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
| `INGRESS_STANDING_LAW_WRITTEN` | Once per hostile provenance at density trip (durable) |
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
    ├── Density: deny ratio → standing deny → O(1) cache
    ├── Mass: inbound weight horizon
    └── Standing Deny: O(1) cache check — brain never wakes

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
    ├── Process tree: RLIMIT_NPROC (physwrap → setrlimit) [LIVE — Linux only]
    ├── Memory: RLIMIT_AS (physwrap → setrlimit) [LIVE — Linux only]
    ├── File descriptors: RLIMIT_NOFILE (physwrap → setrlimit) [LIVE — Linux/macOS]
    ├── File size: RLIMIT_FSIZE (physwrap → setrlimit) [LIVE — Linux/macOS]
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
