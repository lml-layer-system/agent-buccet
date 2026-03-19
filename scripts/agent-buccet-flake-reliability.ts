import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

type ObservedContractSpec = {
  id: string;
  command: string;
  args: string[];
  attempts: number;
  timeoutMs: number;
  cleanupPatterns: string[];
};

type AttemptResult = {
  attempt: number;
  ok: boolean;
  durationMs: number;
  exitCode: number | null;
  timedOut: boolean;
  failureSignature?: string;
};

type ObservedContractReport = {
  id: string;
  passRate: number;
  passedAttempts: number;
  attempts: number;
  minDurationMs: number;
  maxDurationMs: number;
  averageDurationMs: number;
  lastDurationMs: number;
  lastFailureSignature: string | null;
  promotable: boolean;
  logPath: string;
  artifactPath: string;
  results: AttemptResult[];
};

const repoRoot = process.cwd();
const artifactsDir = path.join(repoRoot, "artifacts", "observed-contracts");
const boundaryLedgerLockPath = path.join(repoRoot, "data", "ledger", "agent-boundary-ledger.lock");

function envString(primary: string, legacy: string, fallback: string): string {
  return process.env[primary] ?? process.env[legacy] ?? fallback;
}

const attempts = Number(envString("AGENT_BUCCET_OBSERVED_ATTEMPTS", "AGENT_BUCCET_QUARANTINE_ATTEMPTS", "3"));
const promotionThreshold = Number(
  envString("AGENT_BUCCET_OBSERVED_PROMOTION_THRESHOLD", "AGENT_BUCCET_QUARANTINE_PROMOTION_THRESHOLD", "0.99"),
);
const defaultTimeoutMs = Number(
  envString("AGENT_BUCCET_OBSERVED_TIMEOUT_MS", "AGENT_BUCCET_QUARANTINE_TIMEOUT_MS", "30000"),
);
const strictMode =
  process.env.AGENT_BUCCET_OBSERVED_STRICT === "true" || process.env.AGENT_BUCCET_QUARANTINE_STRICT === "true";

const testSpecs: ObservedContractSpec[] = [
  {
    id: "swarm",
    command: "npm",
    args: ["run", "test:agent-buccet:swarm"],
    attempts,
    timeoutMs: defaultTimeoutMs,
    cleanupPatterns: ["agent-buccet-intercept-server.ts --session-id swarm-contract-"],
  },
  {
    id: "intercept-server",
    command: "npm",
    args: ["run", "test:agent-buccet:intercept-server"],
    attempts,
    timeoutMs: defaultTimeoutMs,
    cleanupPatterns: ["agent-buccet-intercept-server.ts --session-id intercept-server-contract-"],
  },
];

function summarizeFailure(stderr: string, stdout: string, timedOut: boolean): string {
  if (timedOut) {
    return "attempt-timeout";
  }
  const combined = `${stderr}\n${stdout}`.trim();
  if (!combined) {
    return "no-output";
  }
  const lines = combined
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return (lines.at(-1) ?? "unknown-failure").slice(0, 240);
}

async function cleanupResidualProcesses(patterns: string[]) {
  for (const pattern of patterns) {
    await new Promise<void>((resolve) => {
      const child = spawn("pkill", ["-f", pattern], {
        stdio: "ignore",
      });
      child.on("error", () => resolve());
      child.on("close", () => resolve());
    });
  }

  // Some failures leave a stale ledger lock file behind, which makes subsequent
  // attempts fail during boundary runtime startup. This keeps the observed lane
  // reliable without changing the production ledger logic.
  await fs.rm(boundaryLedgerLockPath, { force: true }).catch(() => undefined);
}

async function runOneAttempt(spec: ObservedContractSpec, attempt: number, logPath: string): Promise<AttemptResult> {
  await cleanupResidualProcesses(spec.cleanupPatterns);

  const started = Date.now();
  const child = spawn(spec.command, spec.args, {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    detached: process.platform !== "win32",
  });

  let stdout = "";
  let stderr = "";
  let timedOut = false;
  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const timer = setTimeout(() => {
    timedOut = true;
    try {
      if (process.platform !== "win32" && child.pid) {
        process.kill(-child.pid, "SIGKILL");
      } else {
        child.kill("SIGKILL");
      }
    } catch {
      child.kill("SIGKILL");
    }
  }, spec.timeoutMs);

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code));
  }).finally(() => clearTimeout(timer));

  await cleanupResidualProcesses(spec.cleanupPatterns);

  const durationMs = Date.now() - started;
  const ok = exitCode === 0 && !timedOut;
  const failureSignature = ok ? undefined : summarizeFailure(stderr, stdout, timedOut);
  const logChunk = [
    `## ${spec.id} attempt ${attempt}`,
    `exit_code=${exitCode ?? -1}`,
    `duration_ms=${durationMs}`,
    `timed_out=${timedOut}`,
    "stdout:",
    stdout.trim() || "(empty)",
    "stderr:",
    stderr.trim() || "(empty)",
    "",
  ].join("\n");
  await fs.appendFile(logPath, `${logChunk}\n`, "utf8");

  return {
    attempt,
    ok,
    durationMs,
    exitCode,
    timedOut,
    failureSignature,
  };
}

async function runObservedContract(spec: ObservedContractSpec): Promise<ObservedContractReport> {
  const logPath = path.join(artifactsDir, `${spec.id}.log`);
  await fs.writeFile(logPath, "", "utf8");

  const results: AttemptResult[] = [];
  for (let attempt = 1; attempt <= spec.attempts; attempt += 1) {
    const result = await runOneAttempt(spec, attempt, logPath);
    results.push(result);
  }

  const passedAttempts = results.filter((result) => result.ok).length;
  const passRate = spec.attempts === 0 ? 0 : passedAttempts / spec.attempts;
  const last = results.at(-1);
  const failed = [...results].reverse().find((result) => !result.ok);
  const durations = results.map((result) => result.durationMs);
  const totalDurationMs = durations.reduce((sum, value) => sum + value, 0);
  const promotable = passRate >= promotionThreshold;

  return {
    id: spec.id,
    passRate,
    passedAttempts,
    attempts: spec.attempts,
    minDurationMs: durations.length === 0 ? 0 : Math.min(...durations),
    maxDurationMs: durations.length === 0 ? 0 : Math.max(...durations),
    averageDurationMs: durations.length === 0 ? 0 : Math.round(totalDurationMs / durations.length),
    lastDurationMs: last?.durationMs ?? 0,
    lastFailureSignature: failed?.failureSignature ?? null,
    promotable,
    logPath: path.relative(repoRoot, logPath),
    artifactPath: path.relative(repoRoot, artifactsDir),
    results,
  };
}

async function main() {
  await fs.mkdir(artifactsDir, { recursive: true });
  const reports: ObservedContractReport[] = [];
  for (const spec of testSpecs) {
    reports.push(await runObservedContract(spec));
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    observedLane: true,
    attempts,
    timeout_ms: defaultTimeoutMs,
    promotion_threshold: promotionThreshold,
    promotable: reports.every((report) => report.promotable),
    reports: reports.map((report) => ({
      id: report.id,
      pass_rate: report.passRate,
      passed_attempts: report.passedAttempts,
      attempts: report.attempts,
      promotable: report.promotable,
      last_failure_signature: report.lastFailureSignature,
      min_duration_ms: report.minDurationMs,
      average_duration_ms: report.averageDurationMs,
      max_duration_ms: report.maxDurationMs,
      last_duration_ms: report.lastDurationMs,
      artifact_path: report.artifactPath,
      log_path: report.logPath,
    })),
  };

  const reportPath = path.join(artifactsDir, "report.json");
  await fs.writeFile(reportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));

  if (strictMode && !summary.promotable) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
