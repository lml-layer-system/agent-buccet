import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  createPersistentBoundaryRuntimeStore,
  enableBodyguardControl,
  enforceBoundaryProposal,
  readAllBoundaryLedgerRecords,
  type BoundaryLedgerRecord,
} from "../lib/agent-buccet/index.ts";

function latestEvent(records: BoundaryLedgerRecord[], eventType: string) {
  return [...records].reverse().find((record) => record.META.event_type === eventType);
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-shed-contract-"));
  const sessionId = `shed-contract-${Date.now()}`;
  let executed = false;

  try {
    const sessionsDir = path.join(tempRoot, "sessions");
    const store = await createPersistentBoundaryRuntimeStore({
      sessionId,
      actorId: "user:shed-contract",
      sessionsDir,
      hydrationMode: "light",
    });
    const config = enableBodyguardControl(store.getConfig());

    const result = await enforceBoundaryProposal({
      config,
      proposal: {
        actionKind: "tool.exec",
        target: "bash",
        payloadSummary: "spawn:bash -lc malicious",
        provenance: "external_content",
        flags: {
          requestsLawMutation: true,
          claimsUserApproval: true,
        },
        reviewContext: {
          surface: "action",
          title: "Malicious external content attempted execution",
          question: "This should be denied and shed into a fresh disposable unit.",
          attemptLines: ["$ bash -lc malicious"],
        },
        successReason: "should never execute",
        execute: async () => {
          executed = true;
          return 0;
        },
      },
    });

    assert.equal(result.allowed, false, "external malicious action must be denied");
    assert.equal(result.executed, false, "denied action must not execute");
    assert.equal(executed, false, "execute callback must not run");

    const records = (await readAllBoundaryLedgerRecords())
      .filter((record) => record.payload.sessionId === sessionId);

    const shed = latestEvent(records, "DISPOSABLE_SHED_TRIGGERED");
    assert.ok(shed, "shed trigger must be ledgered");
    assert.equal(shed?.payload.metadata?.provenance, "external_content");
    assert.equal(shed?.payload.metadata?.source_domain, "disposable");
    assert.equal(shed?.payload.decision, "deny");

    const respawn = latestEvent(records, "DISPOSABLE_RESPAWNED");
    assert.ok(respawn, "respawn must be ledgered");
    assert.equal(respawn?.payload.metadata?.respawn_domain, "disposable");

    const runtimeDir = String(respawn?.payload.target ?? "");
    const snapshotPath = String(respawn?.payload.metadata?.snapshot_path ?? "");
    assert.ok(runtimeDir.length > 0, "respawn runtime dir must be recorded");
    assert.ok(snapshotPath.length > 0, "respawn snapshot path must be recorded");

    const snapshotRaw = await fs.readFile(snapshotPath, "utf8");
    const snapshot = JSON.parse(snapshotRaw) as {
      runtime: { isolationActive: boolean; persistedState: boolean; enteredEnvironment: boolean; lifecycleStarted: boolean };
      trigger: string;
      request: { provenance: string; actionKind: string };
    };
    assert.equal(snapshot.trigger, "deny");
    assert.equal(snapshot.request.provenance, "external_content");
    assert.equal(snapshot.request.actionKind, "tool.exec");
    assert.equal(typeof snapshot.runtime.isolationActive, "boolean");
    assert.equal(snapshot.runtime.persistedState, true, "shed flow must persist disposable state");
    assert.equal(snapshot.runtime.enteredEnvironment, true, "shed flow must enter the clean disposable environment");
    assert.equal(snapshot.runtime.lifecycleStarted, true, "shed flow must restart the disposable unit");

    console.log("Agent Buccet shed contract");
    console.log(`session: ${sessionId}`);
    console.log(`runtime: ${runtimeDir}`);
    console.log(`snapshot: ${snapshotPath}`);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
