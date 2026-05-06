# Changelog

All notable changes to Agent Buccet are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/).

---

## [0.2.0] - 2026-05-02

### Added

**Spend / Value Boundary**
- `buccet create spend` — dedicated Buccet class for agents that can create financial consequence, routed through the value-boundary enforcement brain
- Hardcoded two-layer spend enforcement: sync packet/provenance/period-cap/high-risk checks and async team-lane/recursion/rolling-aggregate checks
- 13 typed spend law packs: merchant.purchase, subscription.provider, license.seat, exchange.trade, bill.payment, travel.booking, ad.spend, donation.gift, procurement.order, api.credit, platform.signup, account.transfer, contract.signature
- Signal-based spend pack proposal flow: Pi scores and suggests matching packs, human picks and activates the corridor
- Explicit spend blend drafts for combining packs into composite corridors
- Guided spend setup flow: `buccet upl spend propose`, `buccet upl spend setup`, `buccet upl spend list`
- High-risk commit intent classes: subscribe, transfer, withdraw, swap, sign
- High-risk destination kinds: exchange, wallet, contract, account
- Spend risk class enforcement: high, irreversible, recurring, volatile, identity_sensitive, legal_obligation
- Period cap normalization and rolling aggregate cap enforcement

**UPL Review Lanes**
- Every UPL delta tagged as `yes_side`, `denial_side`, `runtime_ask`, or `removed`
- Operator sees explicit lane impact for both the acceptance side and the denial side before approving
- `buccet upl review` surfaces the full before/after lane delta so the human knows exactly what changes before applying

**Living UPL Process**
- Structured UPL law lifecycle: `observed → boundary_identified → invariant_extracted → typed → drafted → reviewed → human_approved → compiled → active`
- `BoundaryStructuredUplLaw` typed law body with full spend corridor fields
- Living-UPL switchboard: `buccet upl draft`, `buccet upl review`, `buccet upl apply`, `buccet upl workspace`
- Explicit block on activating `state=ask` law — human approval required to move to live

**Create / Workshop Buccets**
- `buccet create` — workshop/comprehension Buccets for creative and analytical teams
- Comprehension engine runtime with universal comprehension process injected into all agents
- Brain-pass loop: `buccet ask` and `buccet enter` wired to the runBrainPass runtime
- Unified path-source library with Pi and Ollama transports and per-provider UPL corridors
- HTTP transport surface: path-source transport + UPL corridors + `--http` CLI flag
- Multi-Buccet creation cockpit: `buccet create cockpit`
- Persistent creation continuity runtime with history, rollback, and cherry-pick
- Canonical shard handoff runtime for team-to-team continuation
- Per-team proof-of-work trace surface: `buccet create trace`

**User Telemetry Boundary**
- Explicit denial wall on outbound user telemetry — all `network.send` on telemetry-class targets blocked unless standing UPL opens the corridor

**Pi Integration**
- `@mariozechner/pi-agent-core` and `@mariozechner/pi-ai` promoted to direct dependencies — install automatically with `npm install`, no separate step

### Fixed

- Standing-law hash inconsistency: bodyguard now runs on every allow, not just initial evaluation
- Kernel continuation denial gaps closed — lower-level unsafe continuation classes now consistently blocked

### Changed

- Repo source reorganized into domain surfaces: `src/boundaries/`, `src/law/`, `src/proof/`, `src/runtime/`, `src/teams/`, `src/engines/`, `src/context/`
- CLI moved to `cli/`
- Contracts reorganized into `contracts/` with domain subdirectories
- Docs reorganized into `docs/specs/`, `docs/guides/`, `docs/enterprise/`
- Specific UPL track denials preferred over broad base denials

---

## [0.1.0] - 2026-04-15

Initial public release.

### Added

**Law Engine**
- Default boundary law body: deny-by-default for delete, write outside scope, exec, network, and credential access
- Time-body defensive laws: novelty guard, completeness claims, authority escalation, bulk irreversible actions, scope expansion, session mutation, and law self-modification
- User Path Ledger (UPL): standing user-law persistence that survives process restart and session recovery
- Law evaluation pipeline with explicit allow / deny / require_approval decisions
- NSL (Next Step Law): lawful recovery suggestions returned on blocked actions (open_path, grant_write, grant_delete, dry_run_preview, deny_and_explain)

**Path Orchestrator**
- Session-scoped reachable path registry — if a path is not opened, it does not exist to the agent
- Explicit grant issuance, revocation, and expiry
- Time-limited grants
- Persistent session state across process crashes and restarts
- Dry-run mode: full enforcement resolution without executing the action

**Ledger**
- Append-only witness ledger with Ed25519 signing and hash chains
- Write-ahead log (WAL) with automatic crash recovery
- Atomic writes via temp-file + POSIX rename
- Signed checkpoints with optional file and HTTP witness publishing
- Ledger CLI: verify, key, seal, checkpoint, witness-file, witness-http
- Structured audit helpers for detecting incomplete traces

**Gravity System**
- Freeze-and-forward hook path: intercepted actions are held, not silently dropped
- Swarm support: multiple processes feeding the same enforcement brain
- Swarm group deduplication: repeated identical proposals coalesce into one pending group
- Gravity supervisor with process lifecycle management

**Integration Surface**
- Framework-agnostic: `BoundaryToolEnvelope` + `enforceBoundaryProposal` for any tool layer
- Built-in integration adapters: OpenAI Agents, LangGraph, NeMo, Telegram
- Queued approval bridge for human-in-the-loop flows
- Process wrapper with whitelist-based environment variable filtering and scope-enforced working directory
- CLI: `buccet init`, `buccet scope add`, `buccet run`, `buccet logs`, `buccet status`, `buccet uninstall`

**Release Infrastructure**
- Release witness: signed checkpoint published on every build, with explicit opt-out break-glass path
- Hosted install shell: single-command deployment from release assets
- Standalone package export: `npm run package:agent-buccet`

---

[0.2.0]: https://github.com/lml-layer-system/agent-buccet/releases/tag/v0.2.0
[0.1.0]: https://github.com/lml-layer-system/agent-buccet/releases/tag/v0.1.0

