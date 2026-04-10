# Agent Buccet Security Model

This document defines the operational split inside Agent Buccet.

## Core Split

### Feeders / Gravity Funnel

Every consequence-bearing feeder does only this:
- catch motion at its local seam
- collapse that motion into the shared Gravity funnel shape
- forward the frozen proposal into the same Buccet runtime

Feeders include:
- native hook / gravity bridge
- system-intercept bridge
- framework adapters
- intercept-daemon stdin/stdout transport
- intercept-server socket transport

The feeder does not:
- decide law
- widen scope
- approve motion
- create a second authority system

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
- run bodyguard reasoning

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
- bodyguard
- gravity
- ledger
- final allow / deny / require-approval decisions

## Decision Path

1. motion is intercepted at the action boundary
2. the feeder collapses it into the shared Gravity funnel
3. Gravity catches, freezes, and holds — the action does not execute
4. **Input Admission Boundary fires** (when `admissionConfig` is configured):
   - O(1) canyon cache check — brain never wakes for known-hostile provenances
   - Bounded provenance density tracking
   - Velocity / Density / Mass reflex thresholds for inbound traffic
   - Tarpit decision: hold socket, return nothing (not a fast 403/429)
   - Ledger the event and surface it to Terminal 2
   - Only if admitted → continue
5. Buccet brain evaluates while the action stays frozen:
   - **resource governor** (Tier 1 pre-check — velocity / density / mass / weight; trips before law evaluation)
   - laws (base runtime laws)
   - scope and grants
   - gravity
   - UPL (User Path Ledger — the user's own runtime laws, same enforcement class as base laws)
   - bodyguard if needed
   - swarm coordination if many matching requests are waiting
   - ledger
6. verdict returns: allow / deny / require_approval
7. the feeder applies the verdict — allow executes, deny drops, require_approval holds until resolved

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

Base Buccet law now ships as authored packs:

- base denial pack
- base acceptance pack

They stay separate for human inspection and customization.
Runtime compiles them into one live UPL field.

See [UPL Base Packs](UPL_BASE_PACKS.md).

## UPL Tracks — Authored Corridors

When a user records `allow_as_law`, a **UPL Track** is automatically bound to that approval.

The track is a narrow execution corridor derived from exactly what was approved:
- `fs.write /workspace/subdir/output.txt` → track binds `fs.write` within `/workspace/subdir` (parent directory)
- `tool.exec git commit` → track binds `tool.exec git` (command name prefix)
- `network.send https://api.example.com/v1` → track binds `network.send` to `https://api.example.com`

The model does not return to open-ended general agency after approval. It enters a finite lawful channel.

On track-eligible surfaces, Buccet binds standing UPL law into corridors:
- `actionCorridor` — action kind + target shape
- `outputCorridor` — output format and structure
- `completionCorridor` — completion grammar and shape
- `expressionCorridor` — expression register and style

These corridors are the execution form of law.

They are the authored rails and walls that the runtime can enforce after law has already been decided.

**What tracks are not:**
- Not a new boundary layer. They run inside the existing UPL enforcement gate.
- Not a new brain or replacement runtime. Post-law motion shaping only.
- Not applied to `allow_once` decisions — ephemeral approvals have no standing corridor.
- Not applied to DOMAIN-scoped UPL entries — domain scope is already coarse-grain by action class.

**Surface scope:** Tracks apply only to Tool/Action and Chat/Output surfaces. Input Admission and Payload-Physics surfaces are excluded — ingress is front-line catch/freeze/deny, not a post-law continuation corridor; physics is hard ceiling enforcement, not semantic shaping.

View active track corridors from Terminal 2: `tracks`

## UPL Traffic — Live Motion Enforcement

`UPL Traffic` is the post-law motion enforcer for the compiled UPL field.

It is separate from the front gate, but it does not introduce a second brain.

It does not:
- decide law
- ask for approval
- widen scope
- author new UPL

It does only this:
- keep acceptance rails open in motion
- keep denial rails closed in motion
- compress motion to the already-decided live UPL field
- surface drift when motion exits the approved corridor

To keep the two sides structurally distinct in the same runtime field, each compiled segment carries:
- a traffic class:
  - `allow_rail`
  - `deny_wall`
- a deterministic polarity tag:
  - `UPL.TRAFFIC.RAIL:sha256:...`
  - `UPL.TRAFFIC.WALL:sha256:...`

If the class/tag does not match the compiled segment polarity, the segment fails closed and does not resolve as live traffic.

That means the runtime split is:
- UPL Tracks author the rails and walls
- UPL Traffic enforces those rails and walls in motion

When a subsequent request matches the UPL field by action family:
- motion stays on an approval rail → allow
- motion hits a denial wall → deny
- motion exits the approved rail → drift

`drift` is not a new law decision. It is the runtime fact that motion left the already-decided UPL corridor. Terminal 2 can then resolve that drift according to the active mode.

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
Both collapse into the same Gravity funnel and route to the same Buccet brain.
```

`buccet init` now does the fast machine bring-up by default. Strong-path intercept can then be armed explicitly with `buccet hook start`, or it is armed when the protected hook path is actually used. If a C compiler is not available, Agent Buccet runs in user-space bridge mode — the same brain, law body, and ledger, with framework-level interception only.

`agent-buccet:intercept-daemon` is a stdin/stdout transport over the intercept server path. It is not a separate adjudicator.

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

Optional witness publication can publish checkpoints outside the local runtime. Set `BUCCET_WITNESS_URL` to enable remote anchoring.

## What Agent Buccet Guarantees

- no ambient authority
- opened scope becomes lawful scope
- prompt content does not become authority
- ledger bypass is denied
- hook does not become a second brain
- signed local decision trail in every ledger; optional remote witness anchoring when `BUCCET_WITNESS_URL` is configured

## Resource Governor

The resource governor fires before law evaluation. It is not a second government; it is a pre-law kinetic control layer that can hold an event before Bodyguard decides it.

Two tiers:

**Tier 1 — Boundary Laws (stateful, pure functions)**

- `BOUNDARY.GOVERNOR.VELOCITY.01` — request rate ceiling (RPM). Trips when crossing count in the velocity window exceeds `maxRpm`.
- `BOUNDARY.GOVERNOR.DENSITY.01` — sliding window failure ratio. Trips when denied/total in the decision window exceeds `maxFailureRatio`.
- `BOUNDARY.GOVERNOR.MASS.01` — weighted action horizon. Trips when cumulative weighted crossings exceed `maxCrossings`. Action class weights are asymmetric: `tool.exec=10`, `fs.delete=8`, `sys.credential.*=8`, down to `fs.read/chat.emit=1`.

All three are stateless from the function's perspective — state is carried in `BoundaryRuntimeConfig.governorState` and flows back through `BoundaryExecutionResult.config` after every crossing.

**Tier 2 — Payload Physics (two enforcement classes)**

The payload physics policy (`BoundaryProcessPhysics`) is OS-agnostic. Enforcement is OS-native, applied by the Native Physics Translator (`buccet-physwrap`). Two enforcement classes with different native shapes:

- **Tier 2a — Payload Envelope Physics** — launch-time ceiling on what a process can BECOME. Wall-clock timeout (`setTimeout` → `SIGKILL`), CPU time (`RLIMIT_CPU` / `PerJobUserTimeLimit`), process count (`RLIMIT_NPROC` on Linux/macOS; per-user scope on macOS), virtual memory (`RLIMIT_AS` on Linux/macOS; `memorystatus_control` jetsam ceiling on macOS for arm64 RSS coverage). All surfaces live on all three platforms. Ledgered as `PROCESS_PHYSWRAP_ACTIVE` with `physwrap_envelope_active`/`physwrap_envelope_skipped` and `physwrap_macos_jetsam_reinforcement` (Darwin runtime-observed jetsam outcome).

- **Tier 2b — Live I/O / Object Boundary** — ongoing enforcement on live object creation and I/O operations during execution. Live on all platforms. `maxOpenFiles` and `maxFileSizeBytes` use refuse semantics on all platforms: POSIX via `RLIMIT_NOFILE`/`RLIMIT_FSIZE` (EMFILE/SIGXFSZ), Windows via `buccet-ioboundary.dll` IAT hooks on `CreateFileA/W` and `WriteFile` (`ERROR_TOO_MANY_OPEN_FILES`/`ERROR_FILE_TOO_LARGE`). The DLL is injected by `physwrap_win.c` before the main thread resumes — fail closed if injection fails. `maxIoRateBytesPerSec`/`maxIoOpsPerSec` enforce via `SetIoRateControlInformationJobObject` throttle semantics on Windows 10 1607+; skipped on Linux/macOS (no rlimit equivalent).

- **Shell-ulimit fallback (degraded path)** — used when physwrap binary is not built. Covers Tier 2a limits only. Does NOT drop `CAP_SYS_RESOURCE`. Ledgered as `PROCESS_PHYSWRAP_FALLBACK`.

**If `PROCESS_PHYSWRAP_FALLBACK` appears in the ledger, the strong-path envelope guarantee is explicitly downgraded. Root or cap-elevated payloads may raise their own limits.**

Governor trips are ledgered as `GOVERNOR_TRIP`. All physics enforce fail closed — no fallback, no retry, no best-effort continuation.

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


## Category Definition

### Agent Buccet Is

- A **fail-closed law boundary** — deny is the default when the brain is unreachable; the hook never guesses
- An **egress structural validity layer** — outbound actions are validated against boundary laws before execution
- A **motion governor** (Tier 1) — velocity, density, mass, and weight laws cap how the agent can move; shipped defaults govern outbound rate and weighted action cost without pretending to be token accounting
- A **payload physics enforcer** (Tier 2a: envelope — CPU/memory/process ceiling on all platforms; Tier 2b: live I/O boundary — file descriptor/file size limits on all platforms; I/O rate/IOPS throttle on Windows 10 1607+) — native rlimits, IAT-hook DLL injection, Job Objects, capability drop, and macOS jetsam ceiling govern what approved processes can physically become and do; runtime enforcement outcome ledgered per-run
- An **input admission boundary** — hostile inbound traffic is denied before tokenization, inference, or API invocation; shipped defaults govern inbound velocity, density, and weighted work before the brain wakes
- A **ledger I/O physics envelope** (LIOPE) — the ledger survives distributed event storms via a bounded ring buffer (Q1.8), max-IOPS background daemon (D2.8), and signed magnitude storm summaries (A3.8); hot path O(1); material state transitions always durable

### Agent Buccet Is Not

- A generic sandbox (it is a specific law boundary with declared coverage)
- A token budget dashboard (it governs weighted action crossings and weighted inbound work, not LLM token counts)
- An LLM moderation gateway (no semantic classification in the hot path; pre-cognitive law only)
- A probabilistic scanner (decisions are deterministic — law matches or doesn't)
- A fail-open wrapper (there is no default-allow fallback on brain death)
- A promise of 100% OS-kernel mediation on every syscall (Buccet's authority seam is upstream consequence classification; deep-intercept honesty is about native proof depth and normalization coverage)

---

## What Agent Buccet Guarantees

- No ambient authority — agent cannot act outside opened scope
- Opened scope becomes lawful scope — scope boundaries are enforced, not advisory
- Prompt content does not become authority — only explicit grants and laws confer capability
- Ledger bypass is denied — there is no path that executes without a ledger record
- Hook does not become a second brain — the hook only freezes, signals, and applies verdicts
- Release artifacts carry a witness decision trail by default
- Tier 1 governor enforces before law evaluation — velocity, density, mass, weight all live
- Wall-clock kill enforces on all platforms — platform-independent
- Native physwrap enforces rlimits directly when `PROCESS_PHYSWRAP_ACTIVE` in ledger; on Darwin, `physwrap_macos_jetsam_reinforcement` tells the operator exactly which memory enforcement path was active at runtime
- Input admission boundary protects the brain from hostile inbound force when `admissionConfig` is configured
- Ledger I/O Physics Envelope (LIOPE) bounds disk I/O and memory under distributed event storms — hot path O(1), material state transitions always durable, storm repetition collapses to signed `LEDGER_STORM_SUMMARY`

---

## What Agent Buccet Does Not Yet Guarantee

- Per-syscall native mediation/proof on every continuation primitive (eBPF/seccomp/ptrace-class completeness is not part of this release)
- Independent external witnessing by default (ledger is locally signed; remote anchoring requires operator configuration)
- Hardware-backed key protection by default (software keys on disk; HSM support not in this release)
- rlimit strong-path guarantees when `PROCESS_PHYSWRAP_FALLBACK` is in ledger
- macOS privileged containment when `dropToUid` is not configured (root can exceed POSIX rlimit hard limits on Darwin without uid drop; physwrap warns at runtime; Darwin-native sandbox backend is the next-phase mechanism for full containment)
- Windows Tier 2b I/O rate/IOPS enforcement requires Windows 10 1607+ (`SetIoRateControlInformationJobObject`); physwrap degrades gracefully on older Windows and logs a warning — those two fields are then skipped and recorded in `physwrap_io_boundary_skipped`

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
