import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  createBoundaryBodyguard,
  createPersistentBoundaryRuntimeStore,
  evaluateBoundaryIntercept,
  loadUserPathLedger,
  lookupUserPathTrackDecision,
} from "../lib/agent-buccet/index.ts";
import type { BoundaryActionKind, BoundaryActionRequest, BoundarySession } from "../lib/agent-buccet/index.ts";

function makeSession(): BoundarySession {
  return {
    sessionId: "kernel-boundary-contract",
    actorId: "user:kernel-boundary-contract",
    createdAt: new Date().toISOString(),
    dryRun: false,
    persistent: true,
    status: "active",
  };
}

function makeRequest(
  actionKind: BoundaryActionKind,
  target: string,
  payloadSummary?: string,
): BoundaryActionRequest {
  return {
    requestId: `${actionKind}-${target}`,
    sessionId: "kernel-boundary-contract",
    actionKind,
    target,
    payloadSummary,
    requestedAt: new Date().toISOString(),
    provenance: "agent_inference",
  };
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-kernel-boundary-"));
  const previousLedgerPath = process.env.AGENT_BUCCET_UPL_LEDGER_PATH;
  process.env.AGENT_BUCCET_UPL_LEDGER_PATH = path.join(tempRoot, "user-path-ledger.json");

  try {
    const ledger = await loadUserPathLedger();
    const session = makeSession();

    const driverLoad = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("tool.exec", "insmod", "spawn:insmod evil.ko"),
    });
    assert.ok(driverLoad, "expected module load to match the kernel wall");
    assert.equal(driverLoad?.decision, "deny");
    assert.equal(driverLoad?.entry.id, "DENY.KERNEL.DRIVER.014C");

    const processInjection = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("tool.exec", "python", "python exploit.py --mode ptrace --target 4121"),
    });
    assert.ok(processInjection, "expected ptrace-style process injection to match the kernel wall");
    assert.equal(processInjection?.decision, "deny");
    assert.equal(processInjection?.entry.id, "DENY.KERNEL.INJECTION.014D");

    const dockerSock = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("fs.read", "/var/run/docker.sock"),
    });
    assert.ok(dockerSock, "expected docker.sock read to match the kernel wall");
    assert.equal(dockerSock?.decision, "deny");
    assert.match(dockerSock?.entry.id ?? "", /^DENY\.KERNEL\./, "expected docker.sock read to hit a kernel wall");

    const rawNetwork = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("tool.exec", "pfctl", "pfctl -e && route add 10.0.0.0/8 192.168.1.1"),
    });
    assert.ok(rawNetwork, "expected raw routing mutation to match the kernel wall");
    assert.equal(rawNetwork?.decision, "deny");
    assert.equal(rawNetwork?.entry.id, "DENY.KERNEL.NETWORK.014K");

    const store = await createPersistentBoundaryRuntimeStore({
      sessionId: `kernel-boundary-${Date.now()}`,
      actorId: "user:kernel-boundary-runtime",
      sessionsDir: path.join(tempRoot, "sessions"),
    });
    const bodyguard = createBoundaryBodyguard(store);

    const intercepted = await evaluateBoundaryIntercept({
      config: bodyguard.store.getConfig(),
      request: {
        actionClass: "shell",
        operation: "exec",
        target: "nsenter",
        payloadSummary: "nsenter --target 1 --mount --uts --ipc /bin/bash",
        provenance: "external_content",
      },
    });

    assert.equal(intercepted.decision, "deny", "expected kernel-boundary intercept to deny");
    assert.ok(
      intercepted.lawIds.includes("DENY.KERNEL.NAMESPACE.014G"),
      "expected kernel-boundary intercept to surface the namespace-crossing wall",
    );

    console.log("Agent Buccet kernel boundary contract");
    console.log(`driver wall: ${driverLoad?.entry.id}`);
    console.log(`injection wall: ${processInjection?.entry.id}`);
    console.log(`docker socket wall: ${dockerSock?.entry.id}`);
    console.log(`raw network wall: ${rawNetwork?.entry.id}`);
    console.log(`intercept wall: ${intercepted.lawIds.join(", ")}`);
  } finally {
    if (previousLedgerPath === undefined) {
      delete process.env.AGENT_BUCCET_UPL_LEDGER_PATH;
    } else {
      process.env.AGENT_BUCCET_UPL_LEDGER_PATH = previousLedgerPath;
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
