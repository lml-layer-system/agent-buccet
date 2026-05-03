import { promises as fs } from "node:fs";
import {
  createBoundaryGravitySupervisor,
  createPersistentBoundaryRuntimeStore,
} from "./../../src/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionId = `agent-buccet-gravity-supervisor-${runId}`;
  const actorId = "system:gravity-supervisor-contract";
  const store = await createPersistentBoundaryRuntimeStore({
    sessionId,
    actorId,
  });

  let heartbeatCount = 0;
  const supervisor = createBoundaryGravitySupervisor({
    store,
    onHeartbeat: () => {
      heartbeatCount += 1;
    },
  });

  await supervisor.start();
  await store.openPath({
    rootPath: "/tmp",
    grantedActions: ["fs.write"],
    issuedBy: actorId,
  });
  await supervisor.auditSession();
  await supervisor.submitProposal({
    actionKind: "fs.write",
    target: "/tmp/agent-buccet-gravity-supervisor-contract.txt",
    payloadSummary: "event-driven heartbeat",
    successReason: "event-driven supervisor proposal executed",
    execute: async () => {
      await fs.writeFile(
        "/tmp/agent-buccet-gravity-supervisor-contract.txt",
        "event-driven heartbeat\n",
        "utf8",
      );
    },
  });
  await sleep(50);
  const status = supervisor.getStatus();
  assert(status.running, "expected supervisor to be running");
  assert(heartbeatCount > 0, "expected supervisor to emit event-driven heartbeats");
  assert(Boolean(status.lastHeartbeatAt), "expected supervisor to record last heartbeat");

  await supervisor.restart("contract restart");
  await sleep(350);
  const restarted = supervisor.getStatus();
  assert(restarted.restartCount >= 1, "expected supervisor to record restart count");
  assert(
    restarted.lastRestartReason === "contract restart",
    "expected supervisor to record restart reason",
  );

  await supervisor.stop();
  const stopped = supervisor.getStatus();
  assert(!stopped.running, "expected supervisor to stop cleanly");

  console.log("Agent Buccet gravity supervisor contract");
  console.log(`event heartbeat count: ${heartbeatCount}`);
  console.log(`restart count: ${restarted.restartCount}`);
  console.log(`last restart reason: ${restarted.lastRestartReason ?? "unknown"}`);
  console.log(`last decision: ${restarted.lastDecision ?? "unknown"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
