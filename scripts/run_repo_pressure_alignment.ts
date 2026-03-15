import { promises as fs } from "node:fs";
import path from "node:path";
import { getBenchmarkTier2TaskPacks, getRealRepoSuitePacks, getRealRepoTaskRecords } from "../lib/lml/coding-oracle/index.ts";
import { appendCodingRepoPressureLedger } from "../lib/lml/coding-repo-pressure-ledger.ts";

async function main(): Promise<void> {
  const tier2 = getBenchmarkTier2TaskPacks();
  const suites = getRealRepoSuitePacks();
  const records = getRealRepoTaskRecords();
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const reportPath = path.join(process.cwd(), "docs", `CODING_REPO_PRESSURE_ALIGNMENT_${stamp}.md`);

  const metrics = {
    tier2TaskCount: tier2.length,
    tier2NextTaskCount: tier2.filter((task) => task.repo === "next-benchmark").length,
    tier2PythonTaskCount: tier2.filter((task) => task.repo === "python-benchmark").length,
    realRepoSuiteCount: suites.length,
    realRepoSuiteDetailedCount: suites.filter((suite) => suite.plannedTasks.length > 0).length,
    realRepoTaskRecordCount: records.length,
    immutableTestRecordCount: records.filter((record) => record.testsEditable === false).length,
    boundedEditRecordCount: records.filter((record) => record.maxChangedFileCount > 0).length,
  };

  const lines = [
    "# Coding Repo Pressure Alignment",
    "",
    `- tier-2 tasks: \`${metrics.tier2TaskCount}\``,
    `- tier-2 next tasks: \`${metrics.tier2NextTaskCount}\``,
    `- tier-2 python tasks: \`${metrics.tier2PythonTaskCount}\``,
    `- real repo suites: \`${metrics.realRepoSuiteCount}\``,
    `- detailed repo suites: \`${metrics.realRepoSuiteDetailedCount}\``,
    `- structured repo task records: \`${metrics.realRepoTaskRecordCount}\``,
    `- immutable-test records: \`${metrics.immutableTestRecordCount}\``,
    `- bounded-edit records: \`${metrics.boundedEditRecordCount}\``,
    "",
    "## Tier 2",
    "",
    ...tier2.map((task) => `- ${task.id}: ${task.repo} | ${task.taskType} | ${task.title}`),
    "",
    "## Repo Suites",
    "",
    ...suites.map((suite) => `- ${suite.id}: ${suite.domain} | ${suite.corePressure} | ${suite.primaryWitnessSurface}`),
    "",
    "## Structured Records",
    "",
    ...records.map((record) => `- ${record.id}: ${record.domain} | max_changed=${record.maxChangedFileCount} | tests_editable=${record.testsEditable}`),
  ];

  await fs.writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
  await appendCodingRepoPressureLedger("REPO_PRESSURE_ALIGNMENT_COMPLETED", {
    createdAt: new Date().toISOString(),
    reportPath,
    planet: "ability",
    ontologyStatus: "aligned",
    lawIds: [
      "ABILITY.CODING.157",
      "ABILITY.CODING.158",
      "ABILITY.CODING.159",
      "ABILITY.CODING.160",
      "ABILITY.CODING.161",
    ],
    metrics,
  });
  console.log(reportPath);
}

await main();
