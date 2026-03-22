import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function execFileAsync(file: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function main() {
  const cwd = process.cwd();
  const sessionId = `agent-buccet-intercept-daemon-${randomUUID()}`;
  const inputPath = path.join(cwd, "data", "agent-boundary", `intercept-daemon-contract-${sessionId}.jsonl`);
  await fs.mkdir(path.dirname(inputPath), { recursive: true });
  await fs.writeFile(
    inputPath,
    [
      JSON.stringify({ requestId: "status-1", command: "status" }),
      JSON.stringify({ requestId: "decision-1", actionClass: "database", operation: "query", target: "analytics" }),
      JSON.stringify({ requestId: "restart-1", command: "restart", reason: "daemon contract restart" }),
      JSON.stringify({ requestId: "shutdown-1", command: "shutdown" }),
      "",
    ].join("\n"),
    "utf8",
  );

  const daemonPath = await fs
    .access(path.join(cwd, "bin", "agent-buccet-intercept-daemon.ts"))
    .then(() => "bin/agent-buccet-intercept-daemon.ts")
    .catch(() => "scripts/agent-buccet-intercept-daemon.ts");
  const command = `cat ${JSON.stringify(inputPath)} | node ${daemonPath} --session-id ${JSON.stringify(sessionId)} --heartbeat-ms 250 --heartbeat-timeout-ms 3000`;
  const shell = await fs.access("/bin/bash").then(() => "/bin/bash").catch(() => "/bin/sh");
  const { stdout } = await execFileAsync(shell, ["-c", command], cwd);
  const outputs = stdout
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

  const status = outputs.find((line) => line.requestId === "status-1");
  const decision = outputs.find((line) => line.requestId === "decision-1");
  const restart = outputs.find((line) => line.requestId === "restart-1");
  const shutdown = outputs.find((line) => line.requestId === "shutdown-1");

  assert(status?.type === "status" && status.running === true, "expected running status from intercept daemon");
  assert(
    decision?.type === "decision" && decision.decision === "deny",
    "expected out-of-scope database intercept request to be denied",
  );
  assert(restart?.type === "ack" && restart.command === "restart", "expected restart ack");
  assert(shutdown?.type === "ack" && shutdown.command === "shutdown", "expected shutdown ack");

  console.log("Agent Buccet intercept daemon contract");
  console.log(`initial status running: ${String(status?.running)}`);
  console.log(`database intercept decision (deny=out-of-scope): ${String(decision?.decision)}`);
  console.log(`restart command: ${String(restart?.command)}`);
  console.log(`shutdown command: ${String(shutdown?.command)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
