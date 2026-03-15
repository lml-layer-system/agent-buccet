import { promises as fs } from "node:fs";
import path from "node:path";
import { getBenchmarkTaskPacks } from "../lib/lml/coding-oracle/index.ts";

type RepoSummary = {
  repo: string;
  tasks: number;
  multiFileTasks: number;
  hostileVariants: number;
  present: boolean;
};

async function main(): Promise<void> {
  const packs = getBenchmarkTaskPacks();
  const repos = [...new Set(packs.map((pack) => pack.repo))];
  const repoSummaries: RepoSummary[] = [];

  for (const repo of repos) {
    const repoPath = path.join(process.cwd(), "..", repo);
    const stat = await fs.stat(repoPath).then(() => true).catch(() => false);
    const repoPacks = packs.filter((pack) => pack.repo === repo);
    repoSummaries.push({
      repo,
      tasks: repoPacks.length,
      multiFileTasks: repoPacks.filter((pack) => pack.filesExpectedToChange.length >= 2).length,
      hostileVariants: repoPacks.filter((pack) => pack.hostileVariant.length > 0).length,
      present: stat,
    });
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const reportPath = path.join(process.cwd(), "docs", `CODING_BENCHMARK_TASK_PACK_REPORT_${stamp}.md`);
  await fs.writeFile(reportPath, renderReport(repoSummaries, packs), "utf8");
  console.log(reportPath);
}

function renderReport(repoSummaries: RepoSummary[], packs: ReturnType<typeof getBenchmarkTaskPacks>): string {
  const lines: string[] = [];
  lines.push("# Coding Benchmark Task Pack Report");
  lines.push("");
  lines.push(`- total tasks: \`${packs.length}\``);
  lines.push(`- repos: \`${repoSummaries.length}\``);
  lines.push(`- repo tasks with hostile variants: \`${packs.filter((pack) => pack.hostileVariant.length > 0).length}\``);
  lines.push(`- repo tasks expecting multi-file edits: \`${packs.filter((pack) => pack.filesExpectedToChange.length >= 2).length}\``);
  lines.push("");
  lines.push("## Repo Status");
  lines.push("");
  lines.push("| Repo | Present | Tasks | Multi-file | Hostile Variants |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const summary of repoSummaries) {
    lines.push(`| ${summary.repo} | ${summary.present ? "yes" : "no"} | ${summary.tasks} | ${summary.multiFileTasks} | ${summary.hostileVariants} |`);
  }
  lines.push("");
  lines.push("## Tasks");
  lines.push("");
  lines.push("| ID | Repo | Type | Title | Files Expected To Change |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const pack of packs) {
    lines.push(`| ${pack.id} | ${pack.repo} | ${pack.taskType} | ${pack.title} | ${pack.filesExpectedToChange.join(", ")} |`);
  }
  lines.push("");
  lines.push("## Status Read");
  lines.push("");
  if (repoSummaries.some((summary) => !summary.present)) {
    lines.push("- benchmark task packs are now first-class artifacts");
    lines.push("- repo-pressure execution is still blocked until the benchmark repos exist locally");
    lines.push("- next step is repo materialization or importing the benchmark repos into the workspace");
  } else {
    lines.push("- benchmark repos are present locally");
    lines.push("- next step is task execution coverage against live repo state");
  }
  lines.push("");
  return lines.join("\n");
}

void main();
