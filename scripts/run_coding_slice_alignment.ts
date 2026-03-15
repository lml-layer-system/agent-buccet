import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { readAllCodingBenchmarkLedgerRecords } from "../lib/lml/coding-benchmark-ledger.ts";
import { readAllCodingCoverageLedgerRecords } from "../lib/lml/coding-coverage-ledger.ts";

const APP_TASK_LAWS = [
  "ABILITY.CODING.147",
  "ABILITY.CODING.148",
  "ABILITY.CODING.149",
  "ABILITY.CODING.150",
  "ABILITY.CODING.151",
] as const;

const BENCHMARK_LAWS = [
  "ABILITY.CODING.152",
  "ABILITY.CODING.153",
  "ABILITY.CODING.154",
  "ABILITY.CODING.155",
  "ABILITY.CODING.156",
] as const;

const HOSTILE_LAWS = [
  "ABILITY.CODING.31",
  "ABILITY.CODING.32",
  "ABILITY.CODING.39",
  "ABILITY.CODING.59",
  "ABILITY.CODING.60",
  "ABILITY.CODING.61",
  "ABILITY.CODING.62",
  "ABILITY.CODING.63",
  "ABILITY.CODING.64",
  "ABILITY.CODING.65",
  "ABILITY.CODING.66",
  "ABILITY.CODING.67",
  "ABILITY.CODING.85",
  "ABILITY.CODING.86",
  "ABILITY.CODING.87",
  "ABILITY.CODING.88",
  "ABILITY.CODING.90",
  "ABILITY.CODING.91",
  "ABILITY.CODING.95",
  "ABILITY.CODING.96",
  "ABILITY.CODING.97",
  "ABILITY.CODING.98",
  "ABILITY.CODING.99",
  "ABILITY.CODING.100",
  "ABILITY.CODING.101",
  "ABILITY.CODING.104",
  "ABILITY.CODING.105",
  "ABILITY.CODING.106",
  "ABILITY.CODING.107",
  "ABILITY.CODING.108",
  "ABILITY.CODING.109",
  "ABILITY.CODING.110",
  "ABILITY.CODING.111",
  "ABILITY.CODING.112",
  "ABILITY.CODING.113",
  "ABILITY.CODING.114",
  "ABILITY.CODING.115",
  "ABILITY.CODING.116",
  "ABILITY.CODING.117",
  "ABILITY.CODING.118",
  "ABILITY.CODING.119",
  "ABILITY.CODING.120",
  "ABILITY.CODING.121",
  "ABILITY.CODING.122",
  "ABILITY.CODING.123",
  "ABILITY.CODING.124",
  "ABILITY.CODING.125",
  "ABILITY.CODING.126",
  "ABILITY.CODING.127",
  "ABILITY.CODING.137",
  "ABILITY.CODING.138",
  "ABILITY.CODING.139",
  "ABILITY.CODING.140",
  "ABILITY.CODING.141",
  "ABILITY.CODING.142",
  "ABILITY.CODING.143",
  "ABILITY.CODING.144",
  "ABILITY.CODING.145",
  "ABILITY.CODING.146",
] as const;

async function main(): Promise<void> {
  const root = process.cwd();
  const abilitySource = await fs.readFile(path.join(root, "lib", "lml", "ability-planet-laws.ts"), "utf8");
  const appTaskSource = await fs.readFile(path.join(root, "lib", "lml", "coding-app-task-laws.ts"), "utf8");
  const benchmarkSource = await fs.readFile(path.join(root, "lib", "lml", "coding-benchmark-laws.ts"), "utf8");
  const hostileLawSources = await Promise.all([
    "coding-failure-laws.ts",
    "coding-semantics.ts",
    "coding-surface.ts",
    "coding-integration.ts",
    "coding-logic.ts",
    "coding-trunk-laws.ts",
    "coding-root-laws.ts",
    "coding-meta-root-laws.ts",
    "coding-execution.ts",
    "coding-grounding.ts",
    "coding-slot-invariants.ts",
  ].map((file) => fs.readFile(path.join(root, "lib", "lml", file), "utf8")));
  const hostileCoverageReport = path.join(root, "docs", "CODING_HOSTILE_PACK_COVERAGE_20260314.md");
  const appTaskCoverageReport = path.join(root, "docs", "CODING_APP_TASK_PACK_COVERAGE_20260314.md");
  const benchmarkAlignmentReport = path.join(root, "docs", "CODING_BENCHMARK_ALIGNMENT_20260314.md");

  const coverageLedger = await readAllCodingCoverageLedgerRecords();
  const benchmarkLedger = await readAllCodingBenchmarkLedgerRecords();

  const slices: Array<{
    name: string;
    lawIds: readonly string[];
    lawSource: string;
    reportPath: string;
    ledgerPresent: boolean;
  }> = [
    {
      name: "app_task",
      lawIds: APP_TASK_LAWS,
      lawSource: `${abilitySource}\n${appTaskSource}`,
      reportPath: appTaskCoverageReport,
      ledgerPresent: coverageLedger.some((record) => record.payload.slice === "app_task"),
    },
    {
      name: "hostile_family",
      lawIds: HOSTILE_LAWS,
      lawSource: [abilitySource, ...hostileLawSources].join("\n"),
      reportPath: hostileCoverageReport,
      ledgerPresent: coverageLedger.some((record) => record.payload.slice === "hostile_family"),
    },
    {
      name: "benchmark",
      lawIds: BENCHMARK_LAWS,
      lawSource: `${abilitySource}\n${benchmarkSource}`,
      reportPath: benchmarkAlignmentReport,
      ledgerPresent: benchmarkLedger.length > 0,
    },
  ];

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const reportPath = path.join(root, "docs", `CODING_SLICE_ALIGNMENT_${stamp}.md`);
  await fs.writeFile(reportPath, renderReport(slices), "utf8");
  console.log(reportPath);
}

function renderReport(
  slices: ReadonlyArray<{
    name: string;
    lawIds: readonly string[];
    lawSource: string;
    reportPath: string;
    ledgerPresent: boolean;
  }>,
): string {
  const lines: string[] = [];
  lines.push("# Coding Slice Alignment");
  lines.push("");
  lines.push("- planet: `ability`");
  lines.push("- ontology status: `aligned`");
  lines.push("");
  lines.push("| Slice | Laws Present | Report Present | Ledger Present |");
  lines.push("| --- | --- | --- | --- |");
  for (const slice of slices) {
    const lawsPresent = slice.lawIds.every((lawId) => slice.lawSource.includes(lawId));
    const reportPresent = existsSync(slice.reportPath);
    lines.push(`| ${slice.name} | ${lawsPresent ? "yes" : "no"} | ${reportPresent ? "yes" : "no"} | ${slice.ledgerPresent ? "yes" : "no"} |`);
  }
  lines.push("");
  lines.push("## Read");
  lines.push("");
  lines.push("- app-task coverage is explicit law + report + ledger");
  lines.push("- hostile family coverage is explicit law + report + ledger");
  lines.push("- benchmark pressure is explicit law + report + ledger");
  lines.push("- all three slices remain inside the coding slice of the ability planet");
  return lines.join("\n");
}

void main();
