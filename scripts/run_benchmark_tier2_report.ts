import { promises as fs } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { getBenchmarkTier2TaskPacks } from "../lib/lml/coding-oracle/index.ts";
import { appendCodingBenchmarkTier2Ledger, type CodingBenchmarkTier2CommandResult } from "../lib/lml/coding-benchmark-tier2-ledger.ts";

type RepoRun = {
  repo: string;
  taskCount: number;
  commands: CodingBenchmarkTier2CommandResult[];
};

function runCommand(repoPath: string, command: string): CodingBenchmarkTier2CommandResult {
  const repo = path.basename(repoPath);
  try {
    const output = execFileSync("zsh", ["-lc", command], {
      cwd: repoPath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 8,
    });
    return {
      repo,
      command,
      ok: true,
      failureCount: 0,
      summary: summarizeOutput(output),
    };
  } catch (error) {
    const stdout = typeof error === "object" && error && "stdout" in error ? String((error as { stdout?: string }).stdout ?? "") : "";
    const stderr = typeof error === "object" && error && "stderr" in error ? String((error as { stderr?: string }).stderr ?? "") : "";
    const combined = `${stdout}\n${stderr}`.trim();
    return {
      repo,
      command,
      ok: false,
      failureCount: countFailures(combined),
      summary: summarizeOutput(combined),
    };
  }
}

function countFailures(output: string): number {
  const patterns = [
    /Test Files\s+(\d+)\s+failed/i,
    /Tests\s+(\d+)\s+failed/i,
    /collected\s+\d+\s+items\s+\/\s+(\d+)\s+error/i,
    /(\d+)\s+failed/i,
    /(\d+)\s+error/i,
  ];
  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) {
      return Number.parseInt(match[1] ?? "0", 10);
    }
  }
  return output ? 1 : 0;
}

function summarizeOutput(output: string): string {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(0, 12).join(" | ").slice(0, 1200);
}

function renderReport(runs: RepoRun[]): string {
  const tier2 = getBenchmarkTier2TaskPacks();
  const lines: string[] = [];
  lines.push("# Coding Benchmark Tier 2 Report");
  lines.push("");
  lines.push(`- total tier-2 tasks: \`${tier2.length}\``);
  lines.push(`- repos: \`${runs.length}\``);
  lines.push(`- failing commands: \`${runs.flatMap((run) => run.commands).filter((result) => !result.ok).length}\``);
  lines.push("");
  lines.push("## Repo Runs");
  lines.push("");
  lines.push("| Repo | Tier-2 Tasks | Command | OK | Failure Count |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const run of runs) {
    for (const result of run.commands) {
      lines.push(`| ${run.repo} | ${run.taskCount} | \`${result.command}\` | ${result.ok ? "yes" : "no"} | ${result.failureCount} |`);
    }
  }
  lines.push("");
  lines.push("## Failure Surface");
  lines.push("");
  for (const run of runs) {
    lines.push(`### ${run.repo}`);
    lines.push("");
    for (const result of run.commands) {
      lines.push(`- command: \`${result.command}\``);
      lines.push(`- ok: \`${result.ok}\``);
      lines.push(`- failure_count: \`${result.failureCount}\``);
      lines.push(`- summary: ${result.summary || "no output"}`);
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const tier2 = getBenchmarkTier2TaskPacks();
  const repos = [...new Set(tier2.map((task) => task.repo))];
  const runs: RepoRun[] = [];

  for (const repo of repos) {
    const repoPath = path.join(process.cwd(), "..", repo);
    const commands = repo === "next-benchmark"
      ? ["npm test", "npm run typecheck"]
      : [". .venv/bin/activate && python -m pytest"];
    runs.push({
      repo,
      taskCount: tier2.filter((task) => task.repo === repo).length,
      commands: commands.map((command) => runCommand(repoPath, command)),
    });
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const reportPath = path.join(process.cwd(), "docs", `CODING_BENCHMARK_TIER2_REPORT_${stamp}.md`);
  await fs.writeFile(reportPath, renderReport(runs), "utf8");
  await appendCodingBenchmarkTier2Ledger("BENCHMARK_TIER2_RUN_COMPLETED", {
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
      "ABILITY.CODING.162",
      "ABILITY.CODING.163",
      "ABILITY.CODING.164",
      "ABILITY.CODING.165",
    ],
    repoResults: runs.flatMap((run) => run.commands),
  });
  console.log(reportPath);
}

await main();
