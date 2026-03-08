# Universe Ontology Freeze

Compatibility note: this file keeps the historical name `ONTOLOGY_FREEZE.md` because existing runbooks and release guardrails already reference it.

Status: `LOCKED`
Date: `2026-02-17`

## Frozen Invariants
- Canonical version: `5.0.0-COMPLETE-EXPANDED`
- Canonical law count: `232`
- Canonical SHA-256:
  - `bc7a41f34eb8385fb0e6addf05e7192af1b96b1a6dd4ad42c96d13ef3a548543`
- Closed universe totals:
  - `totalSourceLaws=15234`
  - `floor=220`
  - `state=15014`
  - `output=15014`
  - `meta=400`
- Coverage requirements:
  - `coverage.complete=true`
  - `missingSourceLawIds=[]`
  - required meta IDs `164,165,166,167,168,169` all present

## Enforcement
- `npm run verify:freeze`
- `npm run demo:check`
- `npm run ci:guardrails`
- `npm run release:all-gates`

Any invariant mismatch is a release blocker and startup blocker.
