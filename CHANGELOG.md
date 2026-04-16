# Changelog

All notable changes to Agent Buccet are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [Semantic Versioning](https://semver.org/).

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

[0.1.0]: https://github.com/lml-layer-system/agent-buccet/releases/tag/v0.1.0

