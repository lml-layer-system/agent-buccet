import { promises as fs } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { appendCodingRealRepoLedger, type CodingRealRepoCommandResult } from "../lib/lml/coding-real-repo-ledger.ts";

type SuiteRun = {
  suiteId: string;
  repo: string;
  commands: string[];
  requiredTool?: string;
};

const SUITES: SuiteRun[] = [
  {
    suiteId: "R1",
    repo: "r1-nextjs-commerce",
    commands: ["npm test", "npm run typecheck"],
  },
  {
    suiteId: "R2",
    repo: "r2-cms-blog",
    commands: ["npm test", "npm run typecheck"],
  },
  {
    suiteId: "R6",
    repo: "r6-fastapi-service",
    commands: [". .venv/bin/activate && python -m mypy app --strict && python -m pytest tests/test_repository.py"],
  },
  {
    suiteId: "R3",
    repo: "r3-saas-dashboard",
    commands: ["npm test", "npm run typecheck"],
  },
  {
    suiteId: "R9",
    repo: "r9-refactor-tool",
    commands: [". .venv/bin/activate && python -m mypy refactor --strict && python -m pytest tests/test_binding.py"],
  },
  {
    suiteId: "T3N",
    repo: "t3-next-cache-bleed",
    commands: ["npm test", "npm run typecheck"],
  },
  {
    suiteId: "T3P",
    repo: "t3-python-doublespend",
    commands: [". .venv/bin/activate && python -m mypy app --strict && python -m pytest tests/test_wallet_race.py -v"],
  },
  {
    suiteId: "R7",
    repo: "r7-python-worker",
    commands: [". .venv/bin/activate && python -m mypy worker --strict && python -m pytest tests/test_idempotency_leaf.py"],
  },
  {
    suiteId: "R4",
    repo: "r4-docs-media",
    commands: ["npm test", "npm run typecheck"],
  },
  {
    suiteId: "R5",
    repo: "r5-billing-webhooks",
    commands: ["npm test", "npm run typecheck"],
  },
  {
    suiteId: "R11",
    repo: "r11-go-worker",
    commands: ["go build ./...", "go test -v ./... -run TestGoroutineLeakWitness"],
    requiredTool: "go",
  },
  {
    suiteId: "R12",
    repo: "r12-rust-mutex",
    commands: ["cargo check", "cargo test --test witness"],
  },
];

function runCommand(repoPath: string, command: string): CodingRealRepoCommandResult {
  const repo = path.basename(repoPath);
  try {
    const output = execFileSync("zsh", ["-lc", command], {
      cwd: repoPath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024 * 8,
    });
    return { repo, command, ok: true, status: "passed", failureCount: 0, summary: summarize(output) };
  } catch (error) {
    const stdout = typeof error === "object" && error && "stdout" in error ? String((error as { stdout?: string }).stdout ?? "") : "";
    const stderr = typeof error === "object" && error && "stderr" in error ? String((error as { stderr?: string }).stderr ?? "") : "";
    const combined = `${stdout}\n${stderr}`.trim();
    return { repo, command, ok: false, status: "failed", failureCount: countFailures(combined), summary: summarize(combined) };
  }
}

function isToolAvailable(tool: string): boolean {
  try {
    execFileSync("zsh", ["-lc", `command -v ${tool}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024,
    });
    return true;
  } catch {
    return false;
  }
}

function summarize(output: string): string {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .join(" | ")
    .slice(0, 1200);
}

function countFailures(output: string): number {
  const patterns = [/Test Files\s+(\d+)\s+failed/i, /Tests\s+(\d+)\s+failed/i, /(\d+)\s+failed/i, /(\d+)\s+error/i];
  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) return Number.parseInt(match[1] ?? "0", 10);
  }
  return output ? 1 : 0;
}

async function main(): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const reportPath = path.join(process.cwd(), "docs", `CODING_REAL_REPO_SUITES_REPORT_${stamp}.md`);
  const suiteResults = SUITES.map((suite) => {
    if (suite.requiredTool && !isToolAvailable(suite.requiredTool)) {
      return {
        suiteId: suite.suiteId,
        repo: suite.repo,
        repoResults: suite.commands.map((command) => ({
          repo: suite.repo,
          command,
          ok: false,
          status: "blocked" as const,
          failureCount: 0,
          summary: `blocked: required tool '${suite.requiredTool}' is not installed in the current environment`,
        })),
      };
    }
    return {
      suiteId: suite.suiteId,
      repo: suite.repo,
      repoResults: suite.commands.map((command) => runCommand(path.join(process.cwd(), "..", suite.repo), command)),
    };
  });

  const lines = [
    "# Coding Real Repo Suites Report",
    "",
    `- suites: \`${SUITES.length}\``,
    `- failing commands: \`${suiteResults.flatMap((suite) => suite.repoResults).filter((result) => result.status === "failed").length}\``,
    `- blocked commands: \`${suiteResults.flatMap((suite) => suite.repoResults).filter((result) => result.status === "blocked").length}\``,
    "",
    "| Suite | Repo | Command | Status | Failure Count |",
    "| --- | --- | --- | --- | --- |",
    ...suiteResults.flatMap((suite) =>
      suite.repoResults.map((result) => `| ${suite.suiteId} | ${suite.repo} | \`${result.command}\` | ${result.status ?? (result.ok ? "passed" : "failed")} | ${result.failureCount} |`),
    ),
    "",
    "## Command Surface",
    "",
    ...suiteResults.flatMap((suite) => [
      `### ${suite.suiteId} - ${suite.repo}`,
      "",
      ...suite.repoResults.flatMap((result) => [
        `- command: \`${result.command}\``,
        `- status: \`${result.status ?? (result.ok ? "passed" : "failed")}\``,
        `- ok: \`${result.ok}\``,
        `- failure_count: \`${result.failureCount}\``,
        `- summary: ${result.summary || "no output"}`,
        "",
      ]),
    ]),
  ];

  await fs.writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");

  for (const suite of suiteResults) {
    await appendCodingRealRepoLedger("REAL_REPO_SUITE_RUN_COMPLETED", {
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
        "ABILITY.CODING.174",
        "ABILITY.CODING.175",
        "ABILITY.CODING.176",
        "ABILITY.CODING.276",
        "ABILITY.CODING.277",
        "ABILITY.CODING.278",
        "ABILITY.CODING.279",
        "ABILITY.CODING.280",
        "ABILITY.CODING.281",
        "ABILITY.CODING.282",
        "ABILITY.CODING.283",
        "ABILITY.CODING.284",
      ],
      suiteId: suite.suiteId,
      repoResults: suite.repoResults,
    });
  }

  console.log(reportPath);
}

await main();
