import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  prepareBoundaryProcess,
  runBoundaryWrappedCommand,
  startPersistentBoundarySession,
} from "../lib/agent-buccet/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertRejects(fn: () => Promise<unknown>, expected: string) {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes(expected)) {
      throw new Error(`expected error containing "${expected}", got "${message}"`);
    }
    return;
  }
  throw new Error(`expected rejection containing "${expected}"`);
}

async function main() {
  if (process.env.AGENT_BUCCET_WRAPPER_CONTRACT_ISOLATED !== "1") {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "abwc-"));
    const scriptPath = fileURLToPath(import.meta.url);
    const exitCode = await new Promise<number>((resolve, reject) => {
      const child = spawn(process.execPath, [scriptPath], {
        cwd: tempRoot,
        env: {
          ...process.env,
          AGENT_BUCCET_WRAPPER_CONTRACT_ISOLATED: "1",
        },
        stdio: "inherit",
      });
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        if (signal) {
          reject(new Error(`wrapper contract child terminated by signal ${signal}`));
          return;
        }
        resolve(code ?? 1);
      });
    });
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
    return;
  }

  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const sessionId = `abwc-${runId}`;
  const actorId = "user:wrapper-contract";
  const demoRoot = path.join(process.cwd(), "data", "abwc", sessionId);
  const scopedRoot = path.join(demoRoot, "workspace");
  const outsideRoot = path.join(demoRoot, "outside");
  await fs.mkdir(scopedRoot, { recursive: true });
  await fs.mkdir(outsideRoot, { recursive: true });

  const config = {
    ...(await startPersistentBoundarySession({
      sessionId,
      actorId,
    })),
    processPolicy: {
      allowedCommands: ["echo", "node"],
      blockedCommands: ["rm"],
      allowedEnvPrefixes: ["AGENT_BUCCET_", "SAFE_", "PATH", "HOME", "TMP", "TMPDIR"],
      blockedEnvVars: ["SECRET_TOKEN"],
      inheritParentEnv: true,
      enforceScopedCwd: true,
    },
  };

  const prepared = await prepareBoundaryProcess({
    config,
    command: "/usr/bin/env",
    scopePaths: [scopedRoot],
    requestedCwd: scopedRoot,
    envOverrides: {
      SAFE_VISIBLE: "yes",
      SECRET_TOKEN: "no",
    },
  }).catch(() => null);

  assert(prepared === null, "env should be blocked because env command is not in allowedCommands");

  const preparedNode = await prepareBoundaryProcess({
    config,
    command: process.execPath,
    scopePaths: [scopedRoot],
    requestedCwd: scopedRoot,
    envOverrides: {
      SAFE_VISIBLE: "yes",
      SECRET_TOKEN: "no",
    },
  });
  assert(preparedNode.env.SAFE_VISIBLE === "yes", "expected SAFE_VISIBLE to remain");
  assert(!("SECRET_TOKEN" in preparedNode.env), "expected SECRET_TOKEN to be filtered");
  assert(preparedNode.cwd === path.resolve(scopedRoot), "expected scoped cwd to be preserved");

  await assertRejects(
    () =>
      prepareBoundaryProcess({
        config,
        command: "/bin/rm",
        scopePaths: [scopedRoot],
        requestedCwd: scopedRoot,
      }),
    "process command is blocked by wrapper process policy",
  );

  await assertRejects(
    () =>
      prepareBoundaryProcess({
        config,
        command: process.execPath,
        scopePaths: [scopedRoot],
        requestedCwd: outsideRoot,
      }),
    "requested working directory is outside user-opened scope",
  );

  const policyPath = path.join(demoRoot, "wrapper-policy.json");
  await fs.writeFile(
    policyPath,
    JSON.stringify(
      {
        laws: [
          "TIME.TRUST.01",
          "TIME.AUTHORITY.01",
          "TIME.SCOPE.01",
          "TIME.LAW.01",
          "TIME.SESSION.01",
          "TIME.LEDGER.01",
          "BOUNDARY.DELETE.01",
          "BOUNDARY.NETWORK.01",
          "BOUNDARY.COMM.01",
        ],
        process: config.processPolicy,
      },
      null,
      2,
    ),
    "utf8",
  );

  const runResult = await runBoundaryWrappedCommand({
    sessionId: `${sessionId}-run`,
    actorId,
    command: "/bin/echo",
    commandArgs: ["wrapped-process-ok"],
    scopePaths: [scopedRoot],
    policyPath,
    cwd: scopedRoot,
    env: {
      SAFE_VISIBLE: "yes",
      SECRET_TOKEN: "no",
    },
  });

  assert(runResult.exitCode === 0, "expected wrapped echo to exit successfully");

  console.log("Agent Buccet wrapper contract");
  console.log(`filtered env vars: ${preparedNode.droppedEnvVars.join(",")}`);
  console.log(`blocked command policy: ok`);
  console.log(`scoped cwd enforcement: ok`);
  console.log(`wrapped command exit: ${runResult.exitCode}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
