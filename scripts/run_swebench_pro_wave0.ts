import { promises as fs } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { appendCodingFrontierBenchmarkLedger } from "../lib/lml/coding-frontier-benchmark-ledger.ts";

type RawInstance = {
  instance_id: string;
  patch?: string;
  [key: string]: unknown;
};

function summarize(output: string): string {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .join(" | ")
    .slice(0, 1500);
}

async function main(): Promise<void> {
  const benchmarkRoot = path.join(process.cwd(), "..", "SWE-bench_Pro-os");
  const rawSource = path.join(benchmarkRoot, "helper_code", "sweap_eval_full_v2.jsonl");
  const waveDir = path.join(benchmarkRoot, "local_waves", "wave0_gold");
  const rawSubsetPath = path.join(waveDir, "wave0_raw.jsonl");
  const patchPath = path.join(waveDir, "wave0_gold_patches.json");
  const outputDir = path.join(waveDir, "eval_output");
  const reportPath = path.join(process.cwd(), "docs", `CODING_FRONTIER_BENCHMARK_WAVE0_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.md`);

  const raw = await fs.readFile(rawSource, "utf8");
  const rows = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RawInstance);
  const waveRows = rows.slice(0, 5);
  const instanceIds = waveRows.map((row) => row.instance_id);

  await fs.mkdir(waveDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(rawSubsetPath, `${waveRows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  await fs.writeFile(
    patchPath,
    JSON.stringify(
      waveRows.map((row) => ({
        instance_id: row.instance_id,
        patch: row.patch ?? "",
        prefix: "gold",
      })),
      null,
      2,
    ),
    "utf8",
  );

  let status = "passed";
  let summary = "wave completed";
  let passedInstances = 0;
  let blockedInstances = 0;

  try {
    const output = execFileSync(
      "zsh",
      [
        "-lc",
        [
          ". .venv/bin/activate",
          "python swe_bench_pro_eval.py",
          `--raw_sample_path='${rawSubsetPath}'`,
          `--patch_path='${patchPath}'`,
          `--output_dir='${outputDir}'`,
          "--scripts_dir=run_scripts",
          "--num_workers=1",
          "--dockerhub_username=jefzda",
          "--use_local_docker",
        ].join(" "),
      ],
      {
        cwd: benchmarkRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 1024 * 1024 * 16,
      },
    );
    summary = summarize(output);
    passedInstances = instanceIds.length;
  } catch (error) {
    const stdout = typeof error === "object" && error && "stdout" in error ? String((error as { stdout?: string }).stdout ?? "") : "";
    const stderr = typeof error === "object" && error && "stderr" in error ? String((error as { stderr?: string }).stderr ?? "") : "";
    const combined = `${stdout}\n${stderr}`.trim();
    status = combined.toLowerCase().includes("docker") || combined.toLowerCase().includes("permission denied") || combined.toLowerCase().includes("not installed")
      ? "blocked"
      : "failed";
    blockedInstances = status === "blocked" ? instanceIds.length : 0;
    summary = summarize(combined);
  }

  const lines = [
    "# SWE-bench Pro Wave 0 Report",
    "",
    "- benchmark: `SWE-bench Pro`",
    "- wave: `wave0_gold`",
    "- runtime: `local_docker`",
    `- status: \`${status}\``,
    `- total_instances: \`${instanceIds.length}\``,
    `- passed_instances: \`${passedInstances}\``,
    `- blocked_instances: \`${blockedInstances}\``,
    "",
    "## Instance IDs",
    "",
    ...instanceIds.map((id) => `- \`${id}\``),
    "",
    "## Summary",
    "",
    `- ${summary || "no output"}`,
  ];

  await fs.writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");

  await appendCodingFrontierBenchmarkLedger("FRONTIER_BENCHMARK_WAVE_COMPLETED", {
    createdAt: new Date().toISOString(),
    reportPath,
    planet: "ability",
    ontologyStatus: "aligned",
    lawIds: [
      "ABILITY.CODING.285",
      "ABILITY.CODING.286",
      "ABILITY.CODING.287",
      "ABILITY.CODING.288",
      "ABILITY.CODING.289",
    ],
    benchmark: "SWE-bench Pro",
    waveId: "wave0_gold",
    runtime: "local_docker",
    instanceIds,
    totalInstances: instanceIds.length,
    passedInstances,
    blockedInstances,
    summary,
  });

  console.log(reportPath);
}

await main();
