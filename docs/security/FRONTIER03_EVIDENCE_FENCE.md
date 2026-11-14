# Frontier03 evidence-integrity fence — PRETEST STAGING

Parent tracker: [#21](https://github.com/lml-layer-system/agent-buccet/issues/21). Workstreams: #22–#26.

**Stage:** PRETEST SPECIFICATION ONLY. Do not present this as ten completed security tests. There is no general guarantee of 100% system correctness.

## What the fence enforces once installed on main

- A **closed ten-gate inventory**: exactly G01–G10, with each failure class, issue mapping, effort estimate, positive/negative obligations, named CI job, and OS coverage frozen independently inside the checker. All start UNVERIFIED.
- **Dependency closure:** 26 directed prerequisite links are pinned as a verified acyclic graph. A downstream gate cannot be counted GREEN while any required upstream gate is RED or UNVERIFIED. Reopening an upstream gate invalidates downstream acceptance without manual monitoring.
- **No green without both actual attack AND authorized positive-control evidence** at the same successful main-branch workflow run, source SHA, run attempt, exact job ID and OS runner labels. Require three unexpired GitHub artifacts (attack, authorized, detector-sensitivity) with exact artifact IDs and SHA-256 digest metadata.
- **No platform-laundering**: macOS G07 requires macOS evidence, Windows G08 requires Windows evidence; G09/G10 require all three supported OS targets. A green packaging build is not an isolation proof.
- **No baseline-laundering**: merged #18 evidence is a protected-native baseline, not proof of the new 10 gates.
- **No silent skipped/waived** state or unsupported-OS label promoted to green. A genuine failed future attack is recorded as **RED** with a reproducer, source SHA, failed GitHub run/job, and null green evidence. RED always blocks release.
- **No hand-edited issue checkbox**: with CI credentials, the issue #21 checklist and acceptance manifest must agree.
- **No premature tag publication**: when merged, `.github/workflows/release.yml` invokes `--release` before publishing npm/packages. Release requires 10/10 and every evidence source SHA must equal the tag commit SHA.
- **No attack execution in the fence script.** The script checks contract structure and authenticated evidence metadata; the actual attack/recovery suites are separate future work.

## Artifacts and contracts

- `contracts/security/frontier03-acceptance.json` — immutable inventory, estimated work shares, platform obligations and state.
- `scripts/security/frontier03-fence.mjs` — static validator plus authenticated GitHub evidence checks.
- `.github/workflows/frontier03-evidence-fence.yml` — short automatic policy-only check on future PRs and updates, with optional manual release mode.
- `.github/workflows/release.yml` — checks full attestation **before** npm publication on tags.

## Evidence contract, when tests are eventually authorized

A gate may change from `UNVERIFIED` to `GREEN` only if `evidence` contains:
- `threatModel`, `rootCause`, `structuralCorrection`: specific and evidence-backed descriptions, not the words `PASS` or `GREEN`
- `attackerReachedBoundary: true`
- `actualEffectRejected: true`
- `authorizedEffectSucceeded: true`
- `legacyInsecureTestOnly: false`
- `runs`: one attestation per pinned OS with `platform`, `sourceSha`, `runId`, `runAttempt`, exact `jobName`, `jobId`, plus `artifacts.attack`, `.authorized`, `.sensitivity` each with `id` and `digest`

Each run must be a successful GitHub push workflow **on main** named exactly `Frontier03 real-effect acceptance`, sourced from `.github/workflows/frontier03-real-effects.yml` (not yet written). Its exact platform-labeled job must complete three named witness steps: `Observe actual attacker effect denied`, `Verify legitimate authorized commit`, `Prove mutant is detected by test`. It must contain three **unexpired SHA-256-digested artifacts** for that gate/platform:

`frontier03-G01-linux-attack`, `frontier03-G01-linux-authorized`, and `frontier03-G01-linux-sensitivity` (replace gate/platform as appropriate).

**These artifacts must contain actual observed effect/recovery traces, not just a PASS string.** A gate may be `UNVERIFIED` (no evidence), `RED` (a confirmed failed run and precise reproducer), or `GREEN` (complete independently bound positive, negative and sensitivity evidence). Only GREEN can release. This checker verifies GitHub's metadata and immutable binding, not the underlying scientific meaning. A code/review policy must protect the evidence producer and checker, or a privileged maintainer could weaken them.

## Install-time dependencies / governance boundary

1. Merge the isolated pretest branch deliberately, after checking no conflict with Claude's active decision-layer PRs.
2. Configure GitHub branch protection / repository rules to **require** the exact status check `Frontier03 / evidence integrity (no attacks)` and protect the fence, manifest, and release workflow from unreviewed modifications.
3. Require the release workflow/check to run from the protected default branch. Tags cannot count test-only unsafe builds.
4. **Run none of the G01–G10 attacks until explicitly authorized.** Evidence remains null and the release path deliberately rejects.
5. Do not interpret a passing preflight as an actual security test; preflight can pass with **0/10** gate evidence, whereas `--release` cannot.

**Current limitation:** GitHub ruleset enumeration returned empty; branch protection returned 403 to the connected integration, so protection could not be independently confirmed or modified. [Issue #28](https://github.com/lml-layer-system/agent-buccet/issues/28) tracks required-check/guardrail activation. This is a **prepared, inactive branch fence**, not proof of enforceable merge policy until the protected controls are installed on main.

## Threats this fence cannot magically eliminate

- A malicious maintainer with authority to change the workflow, evidence producer or GitHub repository protections.
- Fabricated artifact contents from a compromised CI workflow: the checker validates artifact identity/digest and workflow completion, not the runtime truth of traces.
- Genuine unknown vulnerabilities outside the fixed, declared attack campaign.
- Platform-specific isolation missing from production binaries. Until implemented and tested, these gate states must remain unverified.
- A full system-security guarantee: 10/10 measures completion of the ten agreed contracts only.

**This is an acceptance-control fence, not a substitute for runtime authorization and OS isolation.**


## Dependency closure (26 edges, independent graph contract)

- G01 depends on G02.
- G02 depends on none.
- G03 depends on G02.
- G04 depends on G01 and G03.
- G05 depends on G02 and G03.
- G06 depends on G01 and G05.
- G07 and G08 each depend on G03 and G04.
- G09 depends on G04, G05, G06, G07, and G08.
- G10 depends on G01 through G09.

Every edge is an implication that *must* hold for a dependent gate to be accepted. Acyclicity is checked by the policy validator. The graph is a model of required authority and evidence, not proof that the dependent implementation is already correct. A later RED upstream result automatically blocks any dependent GREEN claim at the next enforced check.

## Contradictions filtered by the pretest comb (not runtime attack results)

| Candidate assertion | Why the acceptance contract rejects it |
| --- | --- |
| "PR #18 passed, therefore G01–G10 pass" | Baseline SHA/PR cannot certify any new gate |
| "Release macOS/Windows parity from a Linux or packaging job" | Pinned per-gate OS list and job runner labels are mandatory |
| "A failed attack alone means correctness" | Real authorized control and detector mutation evidence must also pass |
| "An old successful run remains enough after source changes" | Release requires exact tag SHA plus run ID, attempt, job and artifact matching |
| "An issue checkbox creates evidence" | Manifest + authenticated issue #21 have to agree |
| "Any CI workflow named similarly can issue proof" | Exact workflow name/path, main push, job ID, step names, artifact IDs and SHA-256 metadata pinned |
| "A green workflow implies the evidence producer itself is unforgeable" | **Not established**: code ownership/rules and substantive trace checks are still necessary |

## Explicit residual uncertainties

- A GitHub artifact's digest proves immutable bytes only at the recorded provider boundary; it **does not independently prove those bytes record a genuine syscall effect**. Future evidence producers must emit detailed observed traces and make mutant tests go red.
- The checker cannot prevent someone with permissions to modify itself, its workflows or branch protection from disabling it. Require repository-level status checks, file protection and a reviewed deployment path (tracked in #28).
- Running only this preflight says nothing about whether G01–G10 runtime behavior is secure. No G01–G10 frontier attack has yet been launched.

**No private analysis protocol or supplied PDF has been placed in this public guide.**
