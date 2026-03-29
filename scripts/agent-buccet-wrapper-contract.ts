import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import {
  prepareBoundaryProcess,
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
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "abwc-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
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

    const child = spawn(
      process.execPath,
      [
        path.join(previousCwd, "scripts", "agent-buccet-run.ts"),
        "--session-id", `${sessionId}-run`,
        "--actor-id", actorId,
        "--scope", scopedRoot,
        "--policy", policyPath,
        "--cwd", scopedRoot,
        "--env", "SAFE_VISIBLE=yes",
        "--env", "SECRET_TOKEN=no",
        "--",
        "/bin/echo",
        "wrapped-process-ok",
      ],
      {
        cwd: previousCwd,
        stdio: "ignore",
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 500));
    assert(child.pid, "expected wrapped child pid");
    process.kill(child.pid, 0);
    child.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      child.once("close", () => resolve());
    });

    console.log("Agent Buccet wrapper contract");
    console.log(`filtered env vars: ${preparedNode.droppedEnvVars.join(",")}`);
    console.log("blocked command policy: ok");
    console.log("scoped cwd enforcement: ok");
    console.log("wrapped command freeze gate: ok");
  } finally {
    process.chdir(previousCwd);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
