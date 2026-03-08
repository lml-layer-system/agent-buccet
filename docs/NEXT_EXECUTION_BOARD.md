# Next Execution Board

Version: `1.1.0`
Date: `2026-02-16`
Status: `Execution complete`

## Current Execution Status
- `P0.1-P0.5`: Complete
- `P1.1-P1.7`: Complete
- `P2.1-P2.4`: Complete
- Final acceptance and evidence: `docs/FINAL_ACCEPTANCE_SIGNOFF.md`

## P0 Critical Foundation

### P0.1 Real Citation Provider Adapters
- File targets: `lib/providers/citation/*`, `lib/engine/enforcement.ts`, `lib/profiles/registry.ts`
- Acceptance: existence/currency/jurisdiction/adverse checks hit real provider interfaces; simulated checks removed in product mode.

### P0.2 Product Fail-Closed Gate Chain
- File targets: `app/api/snap-run/route.ts`, `lib/snap/lml-integration.ts`, `lib/engine/invariants.ts`
- Acceptance: if any required legal gate fails, output is `NULL`; no bypass path.

### P0.3 Immutable Audit Ledger
- File targets: `lib/ledger/*`, `app/api/snap-run/route.ts`, `lib/engine/enforcement.ts`
- Acceptance: append-only run events, hash-linked records, replay proof for a run ID.

### P0.4 Profile Freeze + Version Pinning
- File targets: `lib/profiles/registry.ts`, `docs/LML_SNAP_CONTRACT.md`
- Acceptance: every run stores `profileId + version + immutableHash`; no mutable runtime profile edits.

### P0.5 Deployment Guardrails
- File targets: `.github/workflows/*` (or CI config), `package.json`
- Acceptance: CI blocks release on `verify:snap` fail, blocker severity > 0, or determinism mismatch.

## P1 Productization

### P1.1 App Split (Demo vs Product)
- File targets: new `apps/demo-*`, `apps/product-*` or equivalent route grouping
- Acceptance: demo and product have isolated configs, endpoints, and storage namespaces.

### P1.2 Lawyer Portal (Product)
- File targets: `app/(product)/lawyer/*`, shared components
- Acceptance: case controls, gate console, citations panel, audit timeline visible per case.

### P1.3 Client GPS Portal (Product)
- File targets: `app/(product)/client/*`
- Acceptance: simple timeline, next action, upload/question flow, no expert controls.

### P1.4 RBAC + Case Permissions
- File targets: `lib/auth/*`, product routes/APIs
- Acceptance: lawyer/staff/client roles enforced; unauthorized access rejected.

### P1.5 Evidence Artifact Store
- File targets: `lib/storage/*`, product APIs
- Acceptance: proof artifacts stored with immutable references; linked to ledger events.

### P1.6 Throughput Classification 343-state
- File targets: `lib/flow/types.ts`, `lib/flow/classifier.ts`, `lib/flow/risk-gates.ts`, `lib/profiles/registry.ts`
- Acceptance:
  - Every inbound item is classified into `A/B/C` (`Time x Obligation x Risk`) with object type.
  - Unknown/triage bucket is explicit and measured.
  - `C1/C2` risk classes auto-bind to hard legal/proof gates.

### P1.7 Hallway UI (Flow Control Surface)
- File targets: `app/(product)/lawyer/flow/*`, `app/(product)/components/*`
- Acceptance:
  - Primary `Now Queue` shows A1-A3 items sorted by risk/obligation.
  - Separation views: `Now`, `This Week`, `Waiting`, `Someday`, `Completed`, `Audit`.
  - Waiting lane enforces owner + expected date + follow-up reminders.
  - Focus cap (top-priority items visible by default) is implemented.

## P2 Compliance + Reliability

### P2.1 Sanction-Risk Test Suite
- File targets: `tests/legal-safety/*`
- Acceptance: fake citation, stale law, wrong jurisdiction, missing adverse authority all fail closed.

### P2.2 Deterministic Replay Suite
- File targets: `tests/replay/*`, `scripts/verify-snap.ts`
- Acceptance: same input/profile/version reproduces same decision and blocker set.

### P2.3 Coverage Deepening
- File targets: `scripts/report-coverage.ts`, `scripts/report-blockers.ts`
- Acceptance: law mapping and repair mapping stay >= target thresholds per profile release.

### P2.4 Release Manifest + Signoff
- File targets: `docs/releases/*`, release script
- Acceptance: signed manifest includes profile hashes, gate results, and test matrix.

## Execution Order
1. P0.1
2. P0.2
3. P0.3
4. P0.4
5. P0.5
6. P1.1
7. P1.2
8. P1.3
9. P1.4
10. P1.5
11. P1.6
12. P1.7
13. P2.1
14. P2.2
15. P2.3
16. P2.4

## Go/No-Go Gates
1. No product release unless P0 complete.
2. No legal output without immutable ledger record.
3. No release if blocker report shows any critical/high.
4. No release if determinism/replay checks fail.


## UI Constitution Reference
All P1 UI execution must comply with:
- `docs/UI_SIGNATURE_SPEC.md`
- `docs/CASE_GPS_ENGINEERING_BRIEF.md`

Hard compliance checks for P1.2/P1.3/P1.7:
1. Signature-range validation for lawyer/client portals.
2. Forbidden-combo checks in design review and QA.
3. Accessibility baseline (WCAG AA) as release gate.
