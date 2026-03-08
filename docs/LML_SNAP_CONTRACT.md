# LML SNAP Contract

Version: `1.0.0`
Frozen Date: `2026-02-16`

## 1. Spec-to-Code Baseline
This document is the canonical contract for SNAP execution in this repository.
Any change to required output schema, stage semantics, admissibility behavior, or profile identity requires a version bump.

## 1.1 Universe Ontology Terminology
- `Sun` = the base/core law body
- `Ability planet` = the planet that holds ability laws
- `Meta planet` = the planet that holds meta laws
- `Universe` = the full loaded system

Compatibility note:
- Active manifest path is `data/generated/canonical-planet-manifest.json`.
- Active manifest env var is `LML_CANONICAL_PLANET_MANIFEST`.

## 2. Required SNAP Outputs (Exact)
Every SNAP run MUST return exactly these four top-level objects:
1. `A_PER`
2. `B_UUIS`
3. `C_DELTA`
4. `D_BLOCKERS`

No additional top-level output objects are allowed.

## 3. Stage Flow Semantics (Locked)
Mandatory stage flow:
1. `LML Checking`
2. `LML Blocking/Repairing` (optional; only if violations exist)
3. `LML RE-Checking`
4. `LML Confirmed`
5. `Human Approval`

Transitions are deterministic and must be traceable in run evidence.

## 4. No-Invention Rule
If a required input element is missing, the system MUST emit a typed `HOLE`.
The system MUST NOT fabricate values to satisfy requirements.

## 5. Admissibility Rule
If the state is non-admissible under active profile gates, output MUST be `NULL`.
No output transition is allowed from a non-admissible state.

## 6. No-Proof-No-Transition
If a law requires proof and proof is missing, transition MUST fail closed.
Result MUST include blocker(s) and repair path(s).

## 7. Demo vs Product Separation
- `demo` mode: isolated, single-run constraints, pedagogical output.
- `product` mode: strict enforcement, fail-closed behavior, no synthetic pass.

Product mode MUST keep stricter thresholds than demo mode.

## 8. Profile Identity and Immutability
Every profile has:
- immutable `profileId`
- immutable `version`
- immutable `immutableHash`

Profile mutations create a new profile version, never in-place mutation.

## 9. Citation Safety Contract (Legal Profiles)
For legal safety profiles, citation handling is hard-gated:
1. citation generation ban in legal mode
2. retrieval-first, verify-first, shepardize-first gate sequence
3. one-fake-citation hard stop
4. jurisdiction + currency + adverse-authority checks before admissibility

## 10. Verification Contract
A release is valid only when all pass:
1. deterministic output for identical input/profile/mode
2. failure->return completeness
3. profile threshold compliance
4. critical blocker count equals zero (for admissible reference run)
5. prohibited-term policy compliance

## 11. Planet Coverage Contract
The compiled law web MUST carry explicit law-coverage metadata and fail closed if incomplete.

Compatibility note:
- The underlying metadata still uses `law-coverage` terminology.

Required conditions:
1. every ingested source law is incorporated into compiled families (`floor/state/meta`)
2. required meta-law set is present: `164, 165, 166, 167, 168, 169`
3. `coverage.complete === true` for release gates

If coverage is incomplete, runtime returns blocked `NULL` and release guardrails fail.

## 12. Canonical Planet Manifest Ingestion (Optional Overlay, Strict When Present)
If `data/generated/canonical-planet-manifest.json` (or `LML_CANONICAL_PLANET_MANIFEST`) is present:
1. it is validated for total count, unique `law_id`, and required meta-law IDs
2. it is merged into the compile corpus as canonical law records
3. compile/verify scripts enforce its integrity before release

## 13. API Startup Hard Gate (Demo + Product)
Demo/product API routes must fail closed at startup unless all are true:
1. canonical planet manifest exists and validates
2. canonical total laws is at least `232`
3. compiled law-web coverage is complete
4. all canonical law IDs are incorporated into compiled law families

If any check fails, APIs refuse execution before request processing.
