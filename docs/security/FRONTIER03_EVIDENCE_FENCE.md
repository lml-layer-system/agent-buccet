# Frontier03 evidence-integrity fence — PRETEST STAGING

Parent tracker: [#21](https://github.com/lml-layer-system/agent-buccet/issues/21). Workstreams: #22–#26.

**Stage:** PRETEST SPECIFICATION ONLY. Do not present this as ten completed security tests. There is no general guarantee of 100% system correctness.

## What the fence enforces once installed on main

- A **closed ten-gate inventory**: exactly G01–G10, pinned issue and OS coverage, unverified by default.
- **No green without both attack AND authorized positive evidence** tied to the same completed successful GitHub run, pinned run attempt, source commit, exact job name, and unexpired cryptographically digested evidence artifacts.
- **No platform-laundering**: macOS G07 requires macOS evidence, Windows G08 requires Windows evidence; G09/G10 require all three supported OS targets. A green packaging build is not an isolation proof.
- **No baseline-laundering**: merged #18 evidence is a protected-native baseline, not proof of the new 10 gates.
- **No silent skipped/waived** state or unsupported-OS label promoted to green.
- **No hand-edited issue checkbox**: with CI credentials, the issue #21 checklist and acceptance manifest must agree.
- **No premature tag publication**: the modified `.github/workflows/release.yml` runs the fence before publishing npm/packages. The `--release` mode requires 10/10 independently attested gates.
- **No attack execution in the fence script.** The script checks contract structure and authenticated evidence metadata; the actual attack/recovery suites are separate future work.

## Artifacts and contracts

- `contracts/security/frontier03-acceptance.json` — immutable inventory, estimated work shares, platform obligations and state.
- `scripts/security/frontier03-fence.mjs` — static validator plus authenticated GitHub evidence checks.
- `.github/workflows/frontier03-evidence-fence.yml` — short automatic policy-only check on future PRs and updates, with optional manual release mode.
- `.github/workflows/release.yml` — checks full attestation **before** npm publication on tags.

## Evidence contract, when tests are eventually authorized

A gate may change from `UNVERIFIED` to `GREEN` only if `evidence` contains:
- `threatModel`, `rootCause`, `structuralCorrection`: substantial, independently reviewed descriptions
- `attackerReachedBoundary: true`
- `actualEffectRejected: true`
- `authorizedEffectSucceeded: true`
- `legacyInsecureTestOnly: false`
- `runs`: one attestation for each pinned OS, with `platform`, `sourceSha`, `runId`, `runAttempt` and the manifest's exact `jobName`

Each run must be a completed successful GitHub Actions workflow whose name includes `Frontier03`, with that source commit/attempt and the corresponding successful job. It must contain three **unexpired SHA-256-digested artifacts** for that gate/platform:

`frontier03-G01-linux-attack`, `frontier03-G01-linux-authorized`, and `frontier03-G01-linux-sensitivity` (replace gate/platform as appropriate).

**These artifacts must contain actual observed effect/recovery traces, not just a PASS string.** This checker verifies GitHub's metadata and immutable binding, not the underlying scientific meaning. A code/review policy must protect the evidence producer and checker, or a privileged maintainer could weaken them.

## Install-time dependencies / governance boundary

1. Merge the isolated pretest branch deliberately, after checking no conflict with Claude's active decision-layer PRs.
2. Configure GitHub branch protection / repository rules to **require** the exact status check `Frontier03 / evidence integrity (no attacks)` and protect the fence, manifest, and release workflow from unreviewed modifications.
3. Require the release workflow/check to run from the protected default branch. Tags cannot count test-only unsafe builds.
4. **Run none of the G01–G10 attacks until explicitly authorized.** Evidence remains null and the release path deliberately rejects.
5. Do not interpret a passing preflight as an actual security test; preflight can pass with **0/10** gate evidence, whereas `--release` cannot.

**Current limitation:** GitHub repository rulesets were empty at inspection, and the connected integration could not read/edit branch protection. This branch is a prepared fence, NOT proof that the status check is currently required by the repository. Activate the required-check rule separately.

## Threats this fence cannot magically eliminate

- A malicious maintainer with authority to change the workflow, evidence producer or GitHub repository protections.
- Fabricated artifact contents from a compromised CI workflow: the checker validates artifact identity/digest and workflow completion, not the runtime truth of traces.
- Genuine unknown vulnerabilities outside the fixed, declared attack campaign.
- Platform-specific isolation missing from production binaries. Until implemented and tested, these gate states must remain unverified.
- A full system-security guarantee: 10/10 measures completion of the ten agreed contracts only.

**This is an acceptance-control fence, not a substitute for runtime authorization and OS isolation.**
