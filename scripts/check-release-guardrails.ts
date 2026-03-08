import { runAllProfiles, runSnap } from "./snap-common.ts";
import { appendSnapRunLedger, replaySnapRunById } from "../lib/ledger/index.ts";
import { loadLawWeb } from "../lib/engine/store.ts";
import { assertApiLawReadiness } from "../lib/engine/readiness.ts";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function severityFor(id: string): "critical" | "high" | "medium" {
  if (/H00[1-3]|critical|hard/i.test(id)) {
    return "critical";
  }
  if (/H00[4-6]|proof|legality|enforcement/i.test(id)) {
    return "high";
  }
  return "medium";
}

function comparable(run: ReturnType<typeof runSnap>) {
  return JSON.stringify({
    per: run.per,
    uuis: run.uuis,
    delta: run.snap.C_DELTA,
    blockers: run.snap.D_BLOCKERS,
  });
}

async function main() {
  // Guardrail 0: canonical law coverage must be complete.
  const lawWeb = await loadLawWeb();
  assert(Boolean(lawWeb.coverage), "Guardrail failed: compiled law web coverage metadata missing.");
  assert(lawWeb.coverage.complete, "Guardrail failed: law coverage incomplete.");
  await assertApiLawReadiness();

  // Guardrail 1: blockers must not include critical/high severity.
  for (const mode of ["demo", "product"] as const) {
    const runs = runAllProfiles(mode);
    for (const run of runs) {
      const allBlockers = [...run.snap.D_BLOCKERS.HOLES_BLOCKING_LML, ...run.snap.D_BLOCKERS.HOLES_BLOCKING_NSL];
      const criticalOrHigh = allBlockers.filter((b) => {
        const severity = severityFor(b.id);
        return severity === "critical" || severity === "high";
      });
      assert(
        criticalOrHigh.length === 0,
        `Guardrail failed: ${run.profile.profileId} (${mode}) has critical/high blockers (${criticalOrHigh.map((b) => b.id).join(", ")}).`,
      );
    }
  }

  // Guardrail 2: deterministic output for identical input/profile/mode.
  const profileIds = runAllProfiles("demo").map((r) => r.profile.profileId);
  for (const profileId of profileIds) {
    for (const mode of ["demo", "product"] as const) {
      const first = runSnap(profileId, mode);
      const second = runSnap(profileId, mode);
      assert(
        comparable(first) === comparable(second),
        `Guardrail failed: determinism mismatch for profile=${profileId} mode=${mode}.`,
      );
    }
  }

  // Guardrail 3: replay proof chain must verify.
  const runId = `ci-guardrail-${Date.now()}`;
  await appendSnapRunLedger({
    runId,
    profileId: "DOC_LAW_PROFILE",
    profileVersion: "1.0.0",
    profileImmutableHash: "ci-check",
    runMode: "demo",
    admissible: true,
    nullOutput: false,
    blockerCount: 0,
    rejectedCount: 0,
    artifactLength: 1,
    createdAt: new Date().toISOString(),
  });

  const proof = await replaySnapRunById(runId);
  assert(proof.found, "Guardrail failed: replay proof run not found.");
  assert(proof.verified, `Guardrail failed: replay chain not verified (${proof.verificationFailures.join("; ")}).`);

  console.log("Release guardrails passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
