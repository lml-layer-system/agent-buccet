# Implementation Status

Version: `1.2.0`
Date: `2026-02-16`
Scope: Unified plan execution (`P0 -> P1 -> P2`) with demo/product split and legal fail-closed guarantees.

## Snapshot
- P0 Critical Foundation: `Complete`
- P1 Productization: `Complete`
- P2 Compliance/Reliability hardening: `Complete`
- Final acceptance signoff: `docs/FINAL_ACCEPTANCE_SIGNOFF.md`

## P0 Status (Complete)
1. `P0.1` Real Citation Provider Adapters: complete (`lib/providers/citation/*`, `app/api/snap-run/route.ts`).
2. `P0.2` Product Fail-Closed Gate Chain: complete (`app/api/snap-run/route.ts`, `lib/engine/invariants.ts`, `lib/snap/lml-integration.ts`).
3. `P0.3` Immutable Audit Ledger: complete (`lib/ledger/*`, `/api/snap-run`, `/api/snap-replay`).
4. `P0.4` Profile Freeze + Version Pinning: complete (`lib/profiles/registry.ts`, `assertPinnedProfile`).
5. `P0.5` Deployment Guardrails: complete (`.github/workflows/release-guardrails.yml`, `scripts/check-release-guardrails.ts`, `npm run ci:guardrails`).

## P1 Status (In Progress)
- `P1.1` App Split (Demo vs Product): implemented route/API namespace split.
  - Demo: `app/demo/page.tsx`, `app/api/demo/*`
  - Product: `app/product/*`, `app/api/product/*`
- `P1.2` Lawyer Portal: initial implementation live at `app/product/lawyer/page.tsx`.
  - Includes case controls + timeline update workflow + message inbox view.
- `P1.3` Client GPS Portal: initial implementation live at `app/product/client/[caseId]/page.tsx`.
  - Includes status, timeline, next step, question submit with lawyer preset auto-ack.
- `P1.4` RBAC + Case Permissions: initial enforcement implemented in `lib/auth/rbac.ts` and product APIs.
- `P1.5` Evidence Artifact Store: implemented immutable storage refs and mutation-ledger linkage.
  - Files: `lib/storage/artifact-store.ts`, `app/api/product/lawyer/cases/[caseId]/artifacts/route.ts`, `lib/storage/product-store.ts`.
- `P1.6` Throughput Classification 343-state: initial implementation complete.
  - Files: `lib/flow/types.ts`, `lib/flow/classifier.ts`, `lib/flow/risk-gates.ts`, `app/api/product/lawyer/flow/route.ts`.
  - Current behavior: A/B/C signature assignment + C1/C2 hard-gate requirement (artifact refs) + auto-binding from case artifact store.
- `P1.7` Hallway UI: initial implementation complete.
  - Files: `app/(product)/lawyer/flow/page.tsx`, `app/product/lawyer/flow/page.tsx`, `app/globals.css`.
  - Current behavior: focus-capped now queue + lane separation (`Now`, `This Week`, `Waiting`, `Someday`, `Completed`, `Audit`) + waiting-lane follow-up enforcement indicators.

## P2 Status (In Progress)
- `P2.1` Sanction-risk tests: initial suite implemented and passing.
  - Files: `tests/legal-safety/sanction-risk.ts`
- `P2.2` Deterministic replay suite: initial suite implemented and passing.
  - Files: `tests/replay/deterministic-replay.ts`
- `P2.2b` Product API RBAC/fail-closed policy suite: implemented and passing.
  - Files: `tests/product-api/rbac-failclosed.ts`, `lib/product/mutation-policy.ts`
- `P2.3` Coverage/blocker reporting: complete and passing.
  - Files: `scripts/report-coverage.ts`, `scripts/report-blockers.ts`
- `P2.4` Release manifest + signoff: initial manifest generator implemented.
  - Files: `scripts/release-manifest.ts`, `scripts/verify-release-manifest.ts`, `docs/releases/release-2026-02-16.json`, `docs/releases/local-2026-02-16.json`, `docs/releases/local-2026-02-16-gated.json`
  - Enforcement:
    - `RELEASE_SIGNOFF` is mandatory (non-`UNSIGNED`)
    - manifest gate fields are verified (`blockerCriticalHigh==0`, `determinismPass`, `ledgerChainVerified`)
    - test matrix pass flags are verified (`verifySnap`, `legalSafety`, `deterministicReplay`, `productApi`)
    - digest integrity is verified

## Latest Validation
- `npm run lint` passed
- `npm run build` passed
- `npm run ci:guardrails` passed
- `npm run test:legal-safety` passed
- `npm run test:replay` passed
- `npm run test:product-api` passed
- `npm run release:manifest` passed
- `npm run verify:manifest` passed
- `npm run report:blockers` passed (critical/high/medium: 0/0/0)
- `npm run report:coverage` passed (laws mapped 100%, repairs mapped 100%)
- `RELEASE_SIGNOFF=local RELEASE_ID=local-all-gates-2026-02-16 npm run release:all-gates` passed

## Latest Hardening Additions
- Law coverage contract implemented in compiled law web:
  - complete source-law incorporation tracking
  - required meta-law presence tracking (`164,165,166,167,168,169`)
  - `coverage.complete` fail-closed enforcement at runtime and CI guardrails
- Canonical planet manifest overlay support added:
  - optional input file: `data/generated/canonical-planet-manifest.json` (or `LML_CANONICAL_PLANET_MANIFEST`)
  - strict validation (count, uniqueness, required meta IDs)
  - deterministic merge into compile corpus when present

## Demo Lock + Run-Anywhere Additions
- Public demo contract enforced (`lmlStages`, `whyChecked`, `whyNeedsRepair`, `gpt2Response`, `humanReviewStatus`, model receipt).
- Internal terms blocked from public payloads.
- Live GPT-2 path verification tests added.
- Freeze verifier added and wired into CI/guardrails:
  - `npm run verify:freeze`
  - `npm run demo:check`
- Docker demo packaging added:
  - `Dockerfile.demo`
  - `docker-compose.demo.yml`
  - npm commands: `demo:check`, `demo:up`, `demo:down`
- New docs:
  - `docs/ONTOLOGY_FREEZE.md`
  - `docs/DEMO_RUNBOOK.md`
