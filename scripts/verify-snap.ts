import { runSnap } from "./snap-common.ts";
import { loadLawWeb } from "../lib/engine/store.ts";

const PROHIBITED = [/\bsha[-\s]?256\b/i, /\bhashlib\b/i, /\bhash\b/i];

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const lawWeb = await loadLawWeb();
  assert(Boolean(lawWeb.coverage), "Law web coverage metadata missing.");
  assert(lawWeb.coverage.complete, "Law web coverage incomplete.");

  const profileId = "DOC_LAW_PROFILE";

  const first = runSnap(profileId, "demo");
  const second = runSnap(profileId, "demo");

  const firstComparable = JSON.stringify({
    per: first.per,
    uuis: first.uuis,
    delta: first.snap.C_DELTA,
    blockers: first.snap.D_BLOCKERS,
  });
  const secondComparable = JSON.stringify({
    per: second.per,
    uuis: second.uuis,
    delta: second.snap.C_DELTA,
    blockers: second.snap.D_BLOCKERS,
  });

  assert(firstComparable === secondComparable, "Determinism check failed for SNAP pipeline.");

  const completeness = first.uuis.failure_return_completeness;
  assert(Boolean(completeness?.complete), "Failure->Return completeness check failed.");

  const thresholds = first.profile.thresholds;
  assert(typeof thresholds === "object" && thresholds !== null, "Profile threshold map missing.");

  const criticalBlockerCount = first.snap.D_BLOCKERS.HOLES_BLOCKING_LML.length + first.snap.D_BLOCKERS.HOLES_BLOCKING_NSL.length;
  assert(criticalBlockerCount === 0, `Critical blocker count must be 0, got ${criticalBlockerCount}.`);

  const payload = JSON.stringify(first);
  for (const pattern of PROHIBITED) {
    assert(!pattern.test(payload), `Prohibited term policy failed (${pattern}).`);
  }

  console.log("SNAP verification passed.");
  console.log(`profile=${profileId} blockers=${criticalBlockerCount} complete=${String(completeness?.complete)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
