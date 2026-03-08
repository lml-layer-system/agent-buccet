import { runAllProfiles } from "./snap-common.ts";

function main() {
  const runs = runAllProfiles("demo");

  let totalLaws = 0;
  let mappedLaws = 0;
  let totalRepairs = 0;
  let mappedRepairs = 0;

  for (const run of runs) {
    totalLaws += run.profile.lmlLaws.length;
    totalRepairs += run.profile.nslRepairs.length;

    const mappedLawTexts = new Set(run.snap.C_DELTA.LML_ADD.map((item) => item.text));
    mappedLaws += run.profile.lmlLaws.filter((law) => [...mappedLawTexts].some((text) => text.includes(law.id) || text.toLowerCase().includes(law.text.toLowerCase().slice(0, 24)))).length;

    const mappedRepairIds = new Set(run.snap.C_DELTA.NSL_ADD.map((item) => item.repair_id));
    mappedRepairs += run.profile.nslRepairs.filter((repair) => mappedRepairIds.has(repair.id)).length;
  }

  const lawCoverage = totalLaws === 0 ? 1 : mappedLaws / totalLaws;
  const repairCoverage = totalRepairs === 0 ? 1 : mappedRepairs / totalRepairs;

  console.log("SNAP coverage report");
  console.log(`profiles=${runs.length}`);
  console.log(`laws mapped=${mappedLaws}/${totalLaws} (${(lawCoverage * 100).toFixed(2)}%)`);
  console.log(`repairs mapped=${mappedRepairs}/${totalRepairs} (${(repairCoverage * 100).toFixed(2)}%)`);
}

main();
