import { runAllProfiles } from "./snap-common.ts";

function severityFor(id: string): "critical" | "high" | "medium" {
  if (/H00[1-3]|critical|hard/i.test(id)) {
    return "critical";
  }
  if (/H00[4-6]|proof|legality|enforcement/i.test(id)) {
    return "high";
  }
  return "medium";
}

function main() {
  const runs = runAllProfiles("demo");
  const unresolvedBySeverity = {
    critical: 0,
    high: 0,
    medium: 0,
  };

  for (const run of runs) {
    const blockers = [...run.snap.D_BLOCKERS.HOLES_BLOCKING_LML, ...run.snap.D_BLOCKERS.HOLES_BLOCKING_NSL];
    for (const blocker of blockers) {
      unresolvedBySeverity[severityFor(blocker.id)] += 1;
    }
    console.log(`${run.profile.profileId}: lml=${run.snap.D_BLOCKERS.HOLES_BLOCKING_LML.length} nsl=${run.snap.D_BLOCKERS.HOLES_BLOCKING_NSL.length}`);
  }

  console.log("Unresolved holes by severity:");
  console.log(`critical=${unresolvedBySeverity.critical}`);
  console.log(`high=${unresolvedBySeverity.high}`);
  console.log(`medium=${unresolvedBySeverity.medium}`);
}

main();
