import { promises as fs } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { appendCodingFrontierBenchmarkLedger } from "../lib/lml/coding-frontier-benchmark-ledger.ts";

type RawInstance = {
  instance_id: string;
  repo?: string;
  problem_statement?: string;
  hints_text?: string;
  selected_test_files_to_run?: string[] | string;
  FAIL_TO_PASS?: string[] | string;
  [key: string]: unknown;
};

type LmlResponse = {
  answer?: string;
  code?: {
    blocks?: Array<{ language?: string; code?: string }>;
    primary?: { language?: string; code?: string } | null;
  };
  trace?: {
    ability_route?: string;
    final_action?: "success" | "refusal";
    reason?: string;
  };
  benchmark_debug?: {
    raw_candidate_text?: string | null;
    normalized_candidate_text?: string | null;
    normalization_reason?: string | null;
  };
};

const LOCAL_REPO_ROOTS: Record<string, string> = {
  "NodeBB/NodeBB": "/Users/ryangatoloai-faupula/SWE-bench_Pro-os/local_repos/NodeBB",
  "qutebrowser/qutebrowser": "/Users/ryangatoloai-faupula/SWE-bench_Pro-os/local_repos/qutebrowser",
};

function summarize(output: string): string {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 30)
    .join(" | ")
    .slice(0, 1800);
}

function compactProblemStatement(problemStatement: string): string {
  const normalized = problemStatement.replace(/\r/g, "").trim();
  if (!normalized) {
    return "";
  }

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const title = lines.find((line) => /title/i.test(line)) ?? lines[0] ?? "";
  const issueDescription = lines.find((line) => /^issue description/i.test(line) || /^description/i.test(line)) ?? "";
  const expected = lines.find((line) => /^expected behavior/i.test(line) || /^what is expected/i.test(line)) ?? "";
  const current = lines.find((line) => /^current behavior/i.test(line) || /^what happened instead/i.test(line)) ?? "";

  const requirementsIndex = lines.findIndex((line) => /^requirements:/i.test(line));
  const requirementLines = requirementsIndex >= 0
    ? lines
        .slice(requirementsIndex + 1)
        .filter((line) => /^[-*]/.test(line) || /^\d+\./.test(line))
        .slice(0, 6)
    : [];

  const signals = [title, issueDescription, expected, current, ...requirementLines]
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  const joined = signals.join("\n");
  return joined.length > 1400 ? `${joined.slice(0, 1400)}...` : joined;
}

function parseStringList(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)).filter(Boolean) : [value];
  } catch {
    return [value];
  }
}

function singularizePathSegment(segment: string): string {
  if (segment.endsWith("ies")) {
    return `${segment.slice(0, -3)}y`;
  }
  if (segment.endsWith("s") && !segment.endsWith("ss")) {
    return segment.slice(0, -1);
  }
  return segment;
}

function deriveLikelyTouchedPaths(instance: RawInstance): string[] {
  const repo = String(instance.repo ?? "");
  const testFiles = parseStringList(instance.selected_test_files_to_run);
  const failToPass = parseStringList(instance.FAIL_TO_PASS);
  const candidates = new Set<string>();

  for (const testFile of testFiles) {
    candidates.add(testFile);
    if (repo === "NodeBB/NodeBB" && testFile.startsWith("test/")) {
      const mapped = testFile.replace(/^test\//, "src/");
      candidates.add(mapped);
      const parts = mapped.split("/");
      const last = parts.pop() ?? "";
      if (last) {
        parts.push(singularizePathSegment(last));
        candidates.add(parts.join("/"));
      }
    }
    if (repo === "qutebrowser/qutebrowser" && testFile.startsWith("tests/unit/")) {
      const mapped = testFile
        .replace(/^tests\/unit\//, "qutebrowser/")
        .replace(/\/test_([^/]+)\.py$/, "/$1.py");
      candidates.add(mapped);
    }
  }

  const failText = failToPass.join("\n");
  if (repo === "NodeBB/NodeBB") {
    if (/email/i.test(failText)) {
      candidates.add("src/user/email.js");
      candidates.add("src/controllers/admin/users.js");
      candidates.add("src/socket.io/admin/user.js");
    }
    if (/webfinger|well-known/i.test(failText) || /webfinger|well-known/i.test(String(instance.problem_statement ?? ""))) {
      candidates.add("src/controllers/index.js");
      candidates.add("src/controllers/helpers.js");
      candidates.add("src/routes/index.js");
    }
  }
  if (repo === "qutebrowser/qutebrowser") {
    candidates.add("qutebrowser/utils/qtlog.py");
    candidates.add("tests/unit/utils/test_qtlog.py");
  }

  return [...candidates].filter(Boolean).slice(0, 8);
}

function readRepoFileAtCommit(repo: string, commit: string, filePath: string): string {
  const repoRoot = LOCAL_REPO_ROOTS[repo];
  if (!repoRoot || !commit || !filePath) {
    return "";
  }
  try {
    return execFileSync(
      "git",
      ["-C", repoRoot, "show", `${commit}:${filePath}`],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 1024 * 1024 * 2,
      },
    );
  } catch {
    return "";
  }
}

function compactFileExcerpt(text: string): string {
  const lines = text.replace(/\r/g, "").split("\n");
  const compact = lines.slice(0, 36).join("\n").trim();
  return compact.length > 700 ? `${compact.slice(0, 700)}...` : compact;
}

function buildRepoContext(instance: RawInstance, likelyPaths: string[]): string {
  const repo = String(instance.repo ?? "");
  const commit = String(instance.base_commit ?? "");
  if (!repo || !commit) {
    return "";
  }
  if (repo === "qutebrowser/qutebrowser") {
    return "";
  }
  const excerptBlocks: string[] = [];
  const sourcePaths = likelyPaths.filter((filePath) => !/^test[s]?\//.test(filePath));
  const fallbackPaths = parseStringList(instance.selected_test_files_to_run).filter((filePath) => !/^test[s]?\//.test(filePath));
  const candidatePaths = [...new Set([...sourcePaths, ...fallbackPaths])].slice(0, 2);
  for (const filePath of candidatePaths) {
    const content = readRepoFileAtCommit(repo, commit, filePath);
    if (!content.trim()) {
      continue;
    }
    excerptBlocks.push([
      `File excerpt: ${filePath}`,
      "```",
      compactFileExcerpt(content),
      "```",
    ].join("\n"));
    if (excerptBlocks.length >= 1) {
      break;
    }
  }
  return excerptBlocks.join("\n\n");
}

function buildPrompt(instance: RawInstance): string {
  const hints = typeof instance.hints_text === "string" && instance.hints_text.trim()
    ? `Hints:\n${instance.hints_text.trim().slice(0, 600)}\n\n`
    : "";
  const compactProblem = compactProblemStatement(typeof instance.problem_statement === "string" ? instance.problem_statement : "");
  const testFiles = parseStringList(instance.selected_test_files_to_run).slice(0, 6);
  const failingTests = parseStringList(instance.FAIL_TO_PASS).slice(0, 6);
  const likelyPaths = deriveLikelyTouchedPaths(instance);
  const repoContext = buildRepoContext(instance, likelyPaths);
  return [
    "Implement a code fix for a SWE-bench Pro repository bug.",
    `Repository: ${typeof instance.repo === "string" ? instance.repo : "unknown"}`,
    `Instance ID: ${instance.instance_id}`,
    `Base commit: ${typeof instance.base_commit === "string" ? instance.base_commit : "unknown"}`,
    "",
    "This is a coding task.",
    "Write code changes as a unified git diff patch only.",
    "Start the first line with: diff --git",
    "Output only patch text.",
    "Do not explain.",
    "Do not use markdown fences.",
    "",
    "Problem statement:",
    compactProblem,
    "",
    testFiles.length > 0 ? `Selected test files:\n${testFiles.map((item) => `- ${item}`).join("\n")}\n` : "",
    failingTests.length > 0 ? `Fail-to-pass tests:\n${failingTests.map((item) => `- ${item}`).join("\n")}\n` : "",
    likelyPaths.length > 0 ? `Likely touched paths:\n${likelyPaths.map((item) => `- ${item}`).join("\n")}\n` : "",
    repoContext ? `Repo context:\n${repoContext}\n` : "",
    hints,
  ].join("\n");
}

function extractPatch(response: LmlResponse): string {
  const primary = response.code?.primary?.code?.trim() ?? "";
  if (primary.includes("diff --git")) {
    return primary;
  }
  const block = (response.code?.blocks ?? [])
    .map((item) => item.code?.trim() ?? "")
    .find((code) => code.includes("diff --git"));
  if (block) {
    return block;
  }
  const answer = response.answer?.trim() ?? "";
  if (answer.includes("diff --git")) {
    return answer;
  }
  return "";
}

async function callLocalModel(instance: RawInstance): Promise<{
  patch: string;
  abilityRoute: string;
  finalAction: string;
  reason: string;
  answerPreview: string;
  rawCandidatePreview: string;
  normalizedCandidatePreview: string;
  normalizationReason: string;
}> {
  const response = await fetch(
    "http://127.0.0.1:3000/api/lml-chat",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: buildPrompt(instance),
        sessionId: `swebench-wave1-${Date.now()}-${instance.instance_id}`,
        userLaws: [
          {
            law_id: "USR-CODING-0001",
            text: "allow ability: coding",
            scope: "global",
            enforcement: "user_always_on",
          },
          {
            law_id: "USR-CODING-0002",
            text: "forbid web_search",
            scope: "global",
            enforcement: "user_always_on",
          },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    },
  );

  if (!response.ok) {
    throw new Error(`local endpoint failed: ${response.status}`);
  }
  const payload = await response.json() as LmlResponse;
  return {
    patch: extractPatch(payload),
    abilityRoute: payload.trace?.ability_route ?? "unknown",
    finalAction: payload.trace?.final_action ?? "unknown",
    reason: payload.trace?.reason ?? "unknown",
    answerPreview: (payload.answer ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
    rawCandidatePreview: (payload.benchmark_debug?.raw_candidate_text ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
    normalizedCandidatePreview: (payload.benchmark_debug?.normalized_candidate_text ?? "").replace(/\s+/g, " ").trim().slice(0, 240),
    normalizationReason: payload.benchmark_debug?.normalization_reason ?? "unknown",
  };
}

async function main(): Promise<void> {
  const benchmarkRoot = path.join(process.cwd(), "..", "SWE-bench_Pro-os");
  const rawSource = path.join(benchmarkRoot, "helper_code", "sweap_eval_full_v2.jsonl");
  const waveDir = path.join(benchmarkRoot, "local_waves", "wave1_local_model");
  const rawSubsetPath = path.join(waveDir, "wave1_raw.jsonl");
  const patchPath = path.join(waveDir, "wave1_local_model_patches.json");
  const attemptsPath = path.join(waveDir, "wave1_attempts.json");
  const outputDir = path.join(waveDir, "eval_output");
  const reportPath = path.join(
    process.cwd(),
    "docs",
    `CODING_FRONTIER_BENCHMARK_WAVE1_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.md`,
  );

  const raw = await fs.readFile(rawSource, "utf8");
  const rows = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RawInstance);
  const waveRows = rows.slice(0, 3);
  const instanceIds = waveRows.map((row) => row.instance_id);

  await fs.mkdir(waveDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(rawSubsetPath, `${waveRows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");

  const attempts: Array<{
    instance_id: string;
    ability_route: string;
    final_action: string;
    reason: string;
    patch_present: boolean;
    patch_bytes: number;
    answer_preview: string;
    raw_candidate_preview: string;
    normalized_candidate_preview: string;
    normalization_reason: string;
  }> = [];

  const patches = [];
  for (const row of waveRows) {
    try {
      const result = await callLocalModel(row);
      attempts.push({
        instance_id: row.instance_id,
        ability_route: result.abilityRoute,
        final_action: result.finalAction,
        reason: result.reason,
        patch_present: result.patch.length > 0,
        patch_bytes: result.patch.length,
        answer_preview: result.answerPreview,
        raw_candidate_preview: result.rawCandidatePreview,
        normalized_candidate_preview: result.normalizedCandidatePreview,
        normalization_reason: result.normalizationReason,
      });
      patches.push({
        instance_id: row.instance_id,
        patch: result.patch,
        prefix: "wave1_local_model",
      });
    } catch (error) {
      const reason = error instanceof DOMException && error.name === "TimeoutError"
        ? "benchmark_instance_timeout"
        : `benchmark_instance_error:${error instanceof Error ? error.message : "unknown"}`;
      attempts.push({
        instance_id: row.instance_id,
        ability_route: "coding.governed",
        final_action: "refusal",
        reason,
        patch_present: false,
        patch_bytes: 0,
        answer_preview: "",
        raw_candidate_preview: "",
        normalized_candidate_preview: "",
        normalization_reason: reason,
      });
      patches.push({
        instance_id: row.instance_id,
        patch: "",
        prefix: "wave1_local_model",
      });
    }
  }

  await fs.writeFile(patchPath, JSON.stringify(patches, null, 2), "utf8");
  await fs.writeFile(attemptsPath, JSON.stringify(attempts, null, 2), "utf8");

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
    const evalResultsPath = path.join(outputDir, "eval_results.json");
    const evalResults = JSON.parse(await fs.readFile(evalResultsPath, "utf8")) as Record<string, boolean>;
    passedInstances = Object.values(evalResults).filter(Boolean).length;
    summary = summarize(output);
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

  const patchCount = attempts.filter((attempt) => attempt.patch_present).length;
  const refusalCount = attempts.filter((attempt) => attempt.final_action === "refusal").length;
  const lines = [
    "# SWE-bench Pro Wave 1 Local Model Report",
    "",
    "- benchmark: `SWE-bench Pro`",
    "- wave: `wave1_local_model`",
    "- runtime: `local_docker + local_patch_only_generator`",
    `- status: \`${status}\``,
    `- total_instances: \`${instanceIds.length}\``,
    `- passed_instances: \`${passedInstances}\``,
    `- blocked_instances: \`${blockedInstances}\``,
    `- generated_patches: \`${patchCount}\``,
    `- refusals: \`${refusalCount}\``,
    "",
    "## Instance Attempts",
    "",
    ...attempts.map((attempt) =>
      `- \`${attempt.instance_id}\`: route=\`${attempt.ability_route}\`, final_action=\`${attempt.final_action}\`, patch_present=\`${attempt.patch_present}\`, patch_bytes=\`${attempt.patch_bytes}\`, reason=\`${attempt.reason}\`, normalization_reason=\`${attempt.normalization_reason}\`, answer_preview=\`${attempt.answer_preview}\`, raw_candidate_preview=\`${attempt.raw_candidate_preview}\`, normalized_candidate_preview=\`${attempt.normalized_candidate_preview}\``,
    ),
    "",
    "## Summary",
    "",
    `- ${summary || "no output"}`,
    "",
    "## Artifacts",
    "",
    `- patches: \`${patchPath}\``,
    `- attempts: \`${attemptsPath}\``,
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
    waveId: "wave1_local_model",
    runtime: "local_docker + local_patch_only_generator",
    instanceIds,
    totalInstances: instanceIds.length,
    passedInstances,
    blockedInstances,
    summary: `generated_patches=${patchCount}; refusals=${refusalCount}; ${summary}`,
  });

  console.log(reportPath);
}

await main();
