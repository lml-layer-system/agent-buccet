# Agent Buccet Base Laws

A verifiable, open corpus of defensive behavioral laws for Agent Buccet — an AI agent built
on an interceptor-first architecture where every action-boundary crossing is lawful, traceable,
and user-mediated.

---

## What This Is

Agent Buccet enforces its behavior through a structured law body. Laws are not soft guidelines —
they are runtime constraints loaded at the foundation layer, checked before action boundaries are
crossed, and traceable back to source.

This repo is the **base-law workspace**: the corpus preparation and staging environment where
the full Agent Buccet law body is remodeled, verified, and packaged before upstream transfer
into the runtime system.

The law body covers 12 families:
- 11 base-law families — defensive invariants, factual integrity, alignment, epistemic defense,
  agentic failure defense, and dimension families for the full behavioral surface
- 1 time-law family — temporal defensive laws with full `BASE` / `STATE` / `OUTPUT` / `TEMPORAL` layering

All 8,209 laws are meant to be run together as a unified active surface.

Notes:
- procedural offensive enablement is excluded; adversarial attack recognition is active defensive law
- the imported ancestor continuity payload has now been remodeled into Agent Buccet time laws
- `MT-00401` through `MT-00420` are authored Agent Buccet time laws added after reverse-EFUE stress and hostile review exposed missing user-path memory and continuity enforcement surfaces
- the base corpus is family-compressed: active enforcement text at the family-law level, source law IDs retained as coverage trace
- time laws are the dynamic defense family and are actively layered across `BASE`, `STATE`, `OUTPUT`, and `TEMPORAL`
- the runtime substrate is the snapped always-on form of the same `8,209` active laws; it changes size and compute shape, not law logic or coverage
- the User Path Ledger uses two linked specs:
  - `user-path-ledger-spec.json` for behavior and entry schema
  - `data/working/user-path-ledger-spec.json` for governing law membership
- this repo verifies transfer-surface integrity only; live upstream runtime existence and ingestion must be verified in the `agent-buccet` runtime repo
- `reports/` is historical pass history only; it is not the authoritative transfer surface

---

## The Corpus

| Metric | Value |
|--------|-------|
| Source laws (pre-remodel) | 68,277 |
| Surviving unique base-law entities | 2,407 |
| Active base law-layer instances (3 states × 2,407) | 7,221 |
| Active time laws (4 layers × 247) | 988 |
| **Full active law body** | **8,209** |
| Base-law families | 11 |
| Time-law families | 1 |
| Total active families | 12 |

The base corpus is **family-compressed**: each of the 2,407 surviving laws operates across three
distinct behavioral states — `BASE` (foundational enforcement), `STATE` (state integrity), and
`OUTPUT` (action boundary). These are the same law with different enforcement scope at each state,
not copies. Source law IDs are retained as coverage trace and runtime indexing anchors.

The time corpus is the dynamic continuity surface. Its 247 surviving time laws operate across four
distinct behavioral states — `BASE`, `STATE`, `OUTPUT`, and `TEMPORAL` — yielding 988 active
time-law rows.

---

## Verify It

```sh
npm run verify:upstream-transfer
```

Expected output (all assertions pass):

```text
agent-buccet-base-laws manifest integrity: OK
scope: file presence, count consistency, and substrate semantic equivalence
surviving base laws=2407
active base laws=7221
active time laws=988
full active law body=8209
runtime substrate active laws=8209
user path ledger governing laws=20
upstream repo=agent-buccet
foundation loader=lib/agent-buccet/foundation.ts
session continuity=lib/agent-buccet/state.ts,lib/agent-buccet/policy.ts
user path ledger=lib/agent-buccet/user-path-ledger.ts
law body index=OK (8209 entries, 37 family-layers)
```

---

## How It Works

1. **Source corpus** — 68,277 raw laws from the source legal system corpus
2. **Family remodeling** — laws assigned to 11 base-law families; 65,870 excluded by category
   (domain-specific, duplicate, unresolvable); 2,407 survive
3. **Runtime layering** — each of the 2,407 surviving base laws is instantiated across three
   distinct behavioral states (`BASE`, `STATE`, `OUTPUT`), yielding 7,221 law-layer instances in
   `data/working/base-law-runtime-corpus/projected-laws.json`
4. **Time law construction** — 247 surviving time laws are instantiated across four runtime
   states (`BASE`, `STATE`, `OUTPUT`, `TEMPORAL`), yielding 988 active time laws in
   `data/working/time-law-runtime-corpus/`
5. **Combined active body** — base + time merged into `data/working/active-law-body/` for
   transfer and verification
6. **Runtime substrate snap** — the same combined body is snapped into
   `data/working/runtime-law-substrate/` as the compressed always-on runtime form

Exclusion criteria are documented in `EXCLUSION_CRITERIA.md`.
Transfer contract is machine-readable at `UPSTREAM_TRANSFER_CONTRACT.json`.

---

## Source of Truth Files

- `data/working/base-law-families/manifest.json` — base-law family manifest
- `data/working/base-law-runtime-corpus/manifest.json` — active base-law manifest (7,221 laws)
- `data/working/base-law-runtime-corpus/projected-laws.json` — flattened runtime-ready base-law corpus
- `data/working/time-law-family/manifest.json` — time-law family manifest
- `data/working/time-law-runtime-corpus/manifest.json` — active time-law manifest (988 laws)
- `data/working/time-law-runtime-corpus/projected-laws.json` — flattened runtime-ready time-law corpus
- `data/working/active-law-body/manifest.json` — combined active law body manifest
- `data/working/active-law-body/projected-laws.json` — combined active base+time law body for transfer
- `data/working/runtime-law-substrate/manifest.json` — compressed runtime substrate manifest
- `data/working/runtime-law-substrate/agent-buccet-runtime-substrate.json` — compressed always-on runtime substrate
- `data/working/user-path-ledger-spec.json` — canonical governing-law list for the User Path Ledger
- `user-path-ledger-spec.json` — behavioral User Path Ledger spec (entry schema, NSL contract, upstream attach points)

---

## Generation Scripts

- `scripts/generate-base-law-families.js` — regenerates surviving base-law family manifests
- `scripts/generate-base-runtime-corpus.js` — regenerates active base-law runtime corpus
- `scripts/generate-time-law-family.js` — regenerates the time-law family from the preserved ancestor payload
- `scripts/generate-time-runtime-corpus.js` — regenerates active time-law runtime corpus
- `scripts/generate-active-law-body.js` — regenerates the combined active law body
- `scripts/generate-runtime-law-substrate.js` — regenerates the snapped runtime substrate

---

## Repository Structure

```text
agent-buccet-base-laws/
├── data/
│   ├── meta-law-foundation/
│   │   └── ancestor/                    # Source for time law construction (preserved)
│   └── working/
│       ├── base-law-families/           # 11 base-law family definitions + manifest
│       ├── base-law-runtime-corpus/     # Family-projected base laws (7,221), manifest
│       ├── time-law-family/             # Time-law family definition + manifest
│       ├── time-law-runtime-corpus/     # Per-law time laws (988), manifest
│       ├── active-law-body/             # Combined base+time corpus (8,209), manifest
│       ├── runtime-law-substrate/       # Compressed always-on runtime substrate, manifest
│       └── user-path-ledger-spec.json   # Governing-law list for the User Path Ledger
├── reports/                             # Historical remodeling pass logs (provenance only)
├── runtime/
│   └── agent-buccet-law-substrate.js    # Runtime substrate loader/materializer/resolver
├── scripts/
│   ├── verify-upstream-transfer.js      # Transfer readiness check (runnable)
│   ├── generate-active-law-body.js      # Combines base+time projected-laws into active-law-body
│   ├── generate-base-law-families.js    # Regenerates surviving base-law family manifests
│   ├── generate-base-runtime-corpus.js  # Regenerates active base-law runtime corpus
│   ├── generate-time-law-family.js      # Regenerates time-law family from ancestor payload
│   ├── generate-time-runtime-corpus.js  # Regenerates active time-law runtime corpus
│   └── generate-runtime-law-substrate.js# Regenerates the snapped runtime substrate
├── .github/workflows/verify.yml         # CI: gates every PR on verify:upstream-transfer
├── AGENTS.md                            # Work protocol for contributors and Claude agents
├── CONTRIBUTING.md                      # How to contribute
├── EXCLUSION_CRITERIA.md                # What was excluded and why
├── LICENSE                              # Apache 2.0
├── UPSTREAM_TRANSFER_CONTRACT.json      # Machine-readable transfer contract
└── user-path-ledger-spec.json           # Full behavioral contract for the User Path Ledger
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

The hard rules for all contributors — human and AI agent — are in [AGENTS.md](AGENTS.md).

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
