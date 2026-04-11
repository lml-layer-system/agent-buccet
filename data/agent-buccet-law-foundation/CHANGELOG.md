# Changelog

All notable changes to the Agent Buccet Base Laws corpus are documented here.

This file covers law body changes, tooling changes, and structural changes. It does not
cover changes to the upstream `agent-buccet` runtime — see that repo's changelog for
enforcement-layer changes.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] - 2026-03-21

### Law Body

- **8,209 active laws** — 7,221 base laws (11 families × 3 layers) + 988 time laws
  (1 family × 4 layers: BASE/STATE/OUTPUT/TEMPORAL)
- Full corpus remodel from 68,277 source laws across 11 base law families
- 65,870 source laws excluded across 10 documented categories (see `EXCLUSION_CRITERIA.md`)
- 2,407 surviving base source laws projected to 7,221 runtime instances
- 247 time source laws projected to 988 runtime instances across 4 layers
- **Adversarial recognition restored to active surface** — procedural offensive enablement
  remains excluded; adversarial attack recognition, exploit-shape detection, and
  hostile-boundary recognition are active defensive law
- **MT-00401..MT-00420** — 20 authored time laws added after reverse-EFUE stress testing;
  these are authored (not derived from source corpus) and govern temporal continuity edge cases

### Tooling

- `scripts/verify-upstream-transfer.js` — comprehensive integrity gate: file presence,
  count consistency across all manifests, UPL governing law roster, and canonical JSON
  equality proving the runtime substrate exactly materializes the active law body
- `runtime/agent-buccet-law-substrate.js` — CPU-friendly runtime substrate library;
  94% size reduction (522 KB substrate vs 8.5 MB materialized form); O(1) law resolution
  by ID, family-layer, gate, category
- `data/working/active-law-body/index.json` — positional lookup index: byId, byFamilyLayer,
  byFamily, byLayer, byPartition; all O(1)
- `scripts/generate-runtime-law-substrate.js` — generates substrate artifact with SHA256
  integrity hashes of both substrate and materialized form
- `scripts/generate-active-law-body.js` — generates combined 8,209-law body with index
- `scripts/patch-time-law-schema.js` — one-time schema normalizer for time law entries

### Infrastructure

- Apache 2.0 license
- GitHub Actions CI (`verify.yml`) — gates every push and PR on
  `npm run verify:upstream-transfer`
- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` added
- `AGENTS.md` — working protocol for Claude agents and human contributors
- `UPSTREAM_TRANSFER_CONTRACT.json` — machine-readable contract specifying the exact
  transfer surface, required files, law counts, and upstream attach points
