# Governor Physics: Two-Tier Containment

Agent Buccet governs two layers:

**Boundary Laws** — how the agent moves (motion)
**Payload Physics** — what approved processes can physically become (envelope)

These are not the same thing. An agent that moves slowly and lawfully can still spawn a process that allocates infinite memory. The two tiers together close the full break surface.

---

## Tier 1 — Boundary Laws (Motion Governance)

Four kinetic dimensions govern how the agent crosses the action boundary per session.

### Velocity

Maximum boundary crossings per minute.

Agent actions cross the boundary constantly. Without a ceiling, an agent can fire thousands of actions per minute — either as a runaway loop or as a deliberate overwhelm attempt. Velocity applies a sliding-window RPM ceiling. Actions that arrive above the ceiling are denied before law evaluation.

```ts
governorConfig: {
  velocity: { maxRpm: 60, windowMs: 60_000 }
}
```

Law ID: `BOUNDARY.GOVERNOR.VELOCITY.01`

### Density

Maximum ratio of unlawful-to-lawful crossings in a sliding window.

A healthy session has a low denial rate. An agent that alternates lawful and unlawful actions, or fires repeated denied actions, has a pathological density pattern. Density trips when the recent denial ratio exceeds the configured threshold.

```ts
governorConfig: {
  density: { maxFailureRatio: 0.8, windowSize: 20 }
}
```

Law ID: `BOUNDARY.GOVERNOR.DENSITY.01`

### Mass

Absolute weighted action horizon per session.

Every session has a ceiling on total actions, weighted by action class. Dangerous actions (tool.exec, fs.delete, db.delete) count more toward the horizon than lightweight reads. When the ceiling is reached, no further crossings are permitted in that session.

```ts
governorConfig: {
  mass: { maxCrossings: 500 },
  weight: {
    "tool.exec": 10,
    "fs.delete": 8,
    "network.send": 5,
    "fs.read": 1,
  }
}
```

Law ID: `BOUNDARY.GOVERNOR.MASS.01`

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

### Governor State Persistence

Governor state (`crossingTimestamps`, `totalWeightedCrossings`, `recentDecisions`) is stored in `BoundaryRuntimeConfig.governorState` and flows back through `BoundaryExecutionResult.config` after every action. `createBoundaryBodyguard` calls `store.replaceConfig(result.config)` after each enforcement, so the state is always current in the store.

### Fail Behavior

If the governor trips, the action is denied before `evaluateBoundaryLaws` is called. No law evaluation, no approval prompt, no execution. The ledger records a `GOVERNOR_TRIP` event with the dimension, law ID, and reason. A `deny_and_explain` recovery move is returned.

---

## Tier 2 — Payload Physics (Envelope Governance)

Tier 1 governs boundary crossings. A single approved crossing (`sys_execve`) can still spawn a process that exhausts all RAM, opens infinite file descriptors, or writes an unlimited disk file. Tier 2 governs what that process can physically become.

### Wall-clock timeout (live)

Maximum elapsed time for an approved process. When the timeout expires, the process receives SIGKILL from the Node.js runtime. No cooperation required from the process — it is killed regardless.

```ts
processPolicy: {
  physics: { wallClockTimeoutMs: 30_000 }
}
```

Ledger event: `PROCESS_WALL_CLOCK_KILL`

Implementation: `setTimeout` + `child.kill('SIGKILL')` applied immediately after `spawn()`. The timeout is cleared on normal process exit.

### POSIX rlimit injection (scaffolded — Linux/macOS)

When `physics` includes any of the following, the process is spawned via a `sh -c ulimit ...` wrapper that sets the limits before exec. The kernel then enforces them directly — the process cannot raise its own limits without `CAP_SYS_RESOURCE`.

| Field | rlimit | Kernel signal |
|---|---|---|
| `cpuTimeLimitSec` | `RLIMIT_CPU` (ulimit -t) | SIGXCPU |
| `maxProcesses` | `RLIMIT_NPROC` (ulimit -u) | fork/clone returns EAGAIN |
| `maxMemoryBytes` | `RLIMIT_AS` (ulimit -v, in KB) | ENOMEM |
| `maxOpenFiles` | `RLIMIT_NOFILE` (ulimit -n) | EMFILE |
| `maxFileSizeBytes` | `RLIMIT_FSIZE` (ulimit -f, in 512-byte blocks) | SIGXFSZ |

```ts
processPolicy: {
  physics: {
    wallClockTimeoutMs: 30_000,
    cpuTimeLimitSec: 10,
    maxProcesses: 32,
    maxMemoryBytes: 512 * 1024 * 1024, // 512 MB
    maxOpenFiles: 64,
    maxFileSizeBytes: 100 * 1024 * 1024, // 100 MB
  }
}
```

Ledger event: `PROCESS_LAUNCH_REQUESTED` (with rlimit metadata when physics is applied)

These guarantees hold within the declared Buccet enforcement surface, assuming:
- hook integrity
- kernel integrity
- explicit syscall-family coverage
- an unprivileged contained payload that cannot alter its own limits

Note: on Windows (`process.platform === 'win32'`), rlimit injection is skipped. Wall-clock timeout is platform-independent.

---

## Architecture Distinction

```
MOTION
  Boundary Laws (Tier 1)
    ├── Velocity: RPM ceiling per session
    ├── Density: pathological failure ratio
    └── Mass: weighted total action horizon

ENVELOPE
  Payload Physics (Tier 2)
    ├── Wall-clock timeout: SIGKILL after N ms (live)
    ├── CPU time limit: RLIMIT_CPU via ulimit -t
    ├── Process tree: RLIMIT_NPROC via ulimit -u
    ├── Memory: RLIMIT_AS via ulimit -v
    ├── File descriptors: RLIMIT_NOFILE via ulimit -n
    └── File size: RLIMIT_FSIZE via ulimit -f
```

Agent Buccet does not promise abstract safety. Within the declared enforcement surface, a contained unprivileged process cannot exceed its configured kinetic and capacity invariants because the kernel itself refuses the violating operation.
