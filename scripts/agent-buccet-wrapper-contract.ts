import { promises as fs } from "node:fs";
import path from "node:path";
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
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionId = `agent-buccet-wrapper-contract-${runId}`;
  const actorId = "user:wrapper-contract";
  const demoRoot = path.join(process.cwd(), "data", "agent-boundary", "wrapper-contract", sessionId);
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
          "META.TRUST.01",
          "META.AUTHORITY.01",
          "META.SCOPE.01",
          "META.LAW.01",
          "META.SESSION.01",
          "META.LEDGER.01",
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
