import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { appendCodingBenchmarkLedger } from "../lib/lml/coding-benchmark-ledger.ts";
import { BENCHMARK_TASK_PACKS } from "../lib/lml/coding-oracle/benchmark-task-pack.ts";

type RepoAlignment = {
  repo: "next-benchmark" | "python-benchmark";
  present: boolean;
  command: string;
  ok: boolean;
  taskCount: number;
  passedTaskCount: number;
  outputSummary: string;
};

const REQUIRED_LAWS = [
  "ABILITY.CODING.147",
  "ABILITY.CODING.148",
  "ABILITY.CODING.149",
  "ABILITY.CODING.150",
  "ABILITY.CODING.151",
  "ABILITY.CODING.152",
  "ABILITY.CODING.153",
  "ABILITY.CODING.154",
  "ABILITY.CODING.155",
  "ABILITY.CODING.156",
] as const;

async function main(): Promise<void> {
  const root = process.cwd();
  const packs = BENCHMARK_TASK_PACKS;
  const abilityPlanetLawSource = await fs.readFile(
    path.join(root, "lib", "lml", "ability-planet-laws.ts"),
    "utf8",
  );
  const appTaskLawSource = await fs.readFile(
    path.join(root, "lib", "lml", "coding-app-task-laws.ts"),
    "utf8",
  );
  const benchmarkLawSource = await fs.readFile(
    path.join(root, "lib", "lml", "coding-benchmark-laws.ts"),
    "utf8",
  );
  const nextResult = runRepoCheck({
    repo: "next-benchmark",
    repoPath: path.join(root, "..", "next-benchmark"),
    command: ["npm", "test"],
    taskCount: packs.filter((pack) => pack.repo === "next-benchmark").length,
  });
  const pythonResult = runRepoCheck({
    repo: "python-benchmark",
    repoPath: path.join(root, "..", "python-benchmark"),
    command: ["zsh", "-lc", ". .venv/bin/activate && pytest"],
    taskCount: packs.filter((pack) => pack.repo === "python-benchmark").length,
  });
  const lawPresence = REQUIRED_LAWS.map((lawId) => ({
    lawId,
    present:
      abilityPlanetLawSource.includes(lawId)
      || appTaskLawSource.includes(lawId)
      || benchmarkLawSource.includes(lawId),
  }));

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const reportPath = path.join(root, "docs", `CODING_BENCHMARK_ALIGNMENT_${stamp}.md`);
  await fs.writeFile(
    reportPath,
    renderReport({
      lawPresence,
      repoResults: [nextResult, pythonResult],
    }),
    "utf8",
  );

  await appendCodingBenchmarkLedger("BENCHMARK_RUN_COMPLETED", {
    createdAt: new Date().toISOString(),
    reportPath,
    planet: "ability",
    ontologyStatus: "aligned",
    lawIds: REQUIRED_LAWS.slice(),
    repoResults: [nextResult, pythonResult].map((result) => ({
      repo: result.repo,
      present: result.present,
      command: result.command,
      ok: result.ok,
      taskCount: result.taskCount,
      passedTaskCount: result.passedTaskCount,
    })),
  });

  console.log(reportPath);
}

function runRepoCheck(args: {
  repo: "next-benchmark" | "python-benchmark";
  repoPath: string;
  command: string[];
  taskCount: number;
}): RepoAlignment {
  const present = existsSync(args.repoPath);
  if (!present) {
    return {
      repo: args.repo,
      present: false,
      command: args.command.join(" "),
      ok: false,
      taskCount: args.taskCount,
      passedTaskCount: 0,
      outputSummary: "repo missing",
    };
  }

  const result = spawnSync(args.command[0], args.command.slice(1), {
    cwd: args.repoPath,
    encoding: "utf8",
    shell: false,
  });
  const ok = result.status === 0;
  return {
    repo: args.repo,
    present: true,
    command: args.command.join(" "),
    ok,
    taskCount: args.taskCount,
    passedTaskCount: ok ? args.taskCount : 0,
    outputSummary: summarizeOutput(result.stdout || result.stderr || ""),
  };
}

function summarizeOutput(output: string): string {
  return output
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-6)
    .join(" | ");
}

function renderReport(args: {
  lawPresence: Array<{ lawId: string; present: boolean }>;
  repoResults: RepoAlignment[];
}): string {
  const lines: string[] = [];
  lines.push("# Coding Benchmark Alignment");
  lines.push("");
  lines.push("- planet: `ability`");
  lines.push("- ontology status: `aligned`");
  lines.push("- benchmark layer: `lawed and ledgered`");
  lines.push("");
  lines.push("## Laws");
  lines.push("");
  lines.push("| Law | Present |");
  lines.push("| --- | --- |");
  for (const law of args.lawPresence) {
    lines.push(`| ${law.lawId} | ${law.present ? "yes" : "no"} |`);
  }
  lines.push("");
  lines.push("## Repo State");
  lines.push("");
  lines.push("| Repo | Present | Command | Passing | Tasks | Passed Tasks |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const repo of args.repoResults) {
    lines.push(`| ${repo.repo} | ${repo.present ? "yes" : "no"} | ${repo.command} | ${repo.ok ? "yes" : "no"} | ${repo.taskCount} | ${repo.passedTaskCount} |`);
  }
  lines.push("");
  lines.push("## Read");
  lines.push("");
  lines.push("- benchmark task execution remains inside the coding slice of the ability planet");
  lines.push("- no new planet was introduced by the benchmark layer");
  lines.push("- benchmark state is now append-only recorded in `data/ledger/coding-benchmark-ledger.jsonl`");
  return lines.join("\n");
}

void main();
