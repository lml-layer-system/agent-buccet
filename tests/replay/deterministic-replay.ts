import { randomUUID } from "node:crypto";
import { appendSnapRunLedger, replaySnapRunById } from "../../lib/ledger/index.ts";
import { runSnap } from "../../scripts/snap-common.ts";
import { getProfileOrThrow } from "../../lib/profiles/index.ts";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function comparable(value: ReturnType<typeof runSnap>) {
  return JSON.stringify({
    per: value.per,
    uuis: value.uuis,
    delta: value.snap.C_DELTA,
    blockers: value.snap.D_BLOCKERS,
  });
}

async function main() {
  const profileId = "DOC_LAW_PROFILE";
  const profile = getProfileOrThrow(profileId);

  const first = runSnap(profileId, "product");
  const second = runSnap(profileId, "product");

  assert(comparable(first) === comparable(second), "Deterministic decision mismatch for same input/profile/version.");

  const runId = `replay-${randomUUID()}`;
  await appendSnapRunLedger({
    runId,
    profileId: profile.profileId,
    profileVersion: profile.version,
    profileImmutableHash: profile.immutableHash,
    runMode: "product",
    admissible: true,
    nullOutput: false,
    blockerCount: 0,
    rejectedCount: 0,
    artifactLength: 42,
    createdAt: new Date().toISOString(),
  });

  const proof = await replaySnapRunById(runId);
  assert(proof.found, "Replay proof did not find run ID.");
  assert(proof.verified, `Replay proof chain invalid: ${proof.verificationFailures.join("; ")}`);

  console.log("Deterministic replay suite passed.");
  console.log(JSON.stringify({ runId, chainLength: proof.chainLength, verified: proof.verified }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
