import { runBoundaryProcess } from "./../../src/index.ts";
import {
  createPersistentBoundaryRuntimeStore,
} from "./../../src/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionId = `agent-buccet-physics-${runId}`;
  const actorId = "user:payload-physics-contract";

  const store = await createPersistentBoundaryRuntimeStore({ sessionId, actorId });
  await store.openPath({
    rootPath: "/",
    grantedActions: ["tool.exec"],
    issuedBy: actorId,
  });
  store.replaceConfig({
    ...store.getConfig(),
    processPolicy: {
      allowedCommands: ["node", "sh", "sleep", "echo"],
      allowedEnvPrefixes: ["AGENT_BUCCET_", "PATH", "HOME"],
      physics: {
        wallClockTimeoutMs: 300,
      },
    },
  });

  const config = store.getConfig();

  // Wall-clock timeout: `sleep 5` should be killed before it completes
  let timedOut = false;
  try {
    await runBoundaryProcess({
      config,
      command: "sleep",
      commandArgs: ["5"],
      scopePaths: ["/"],
    });
  } catch (err) {
    // SIGKILL causes the promise to reject with a signal error
    timedOut = true;
    assert(
      err instanceof Error && err.message.includes("SIGKILL"),
      `expected SIGKILL error, got: ${String(err)}`,
    );
  }
  assert(timedOut, "sleep 5 with 300ms wall-clock timeout should be killed");

  // Fast command: `echo hello` should complete before the timeout
  const echoResult = await runBoundaryProcess({
    config,
    command: "echo",
    commandArgs: ["hello"],
    scopePaths: ["/"],
  });
  assert(echoResult.exitCode === 0, "echo hello should exit 0 within wall-clock timeout");

  console.log("Agent Buccet payload physics contract");
  console.log(`wall-clock timeout killed sleep 5: ${timedOut}`);
  console.log(`echo hello exit code: ${echoResult.exitCode}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
