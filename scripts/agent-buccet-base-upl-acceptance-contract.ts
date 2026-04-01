import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  evaluateBoundaryAction,
  loadUserPathLedger,
  openBoundaryPath,
  createPersistentBoundaryRuntimeStore,
} from "../lib/agent-buccet/index.ts";
import type { BoundaryActionKind, BoundaryActionRequest } from "../lib/agent-buccet/index.ts";

function makeRequest(args: {
  sessionId: string;
  actionKind: BoundaryActionKind;
  target: string;
  payloadSummary?: string;
}): BoundaryActionRequest {
  return {
    requestId: `${args.actionKind}:${args.target}`,
    sessionId: args.sessionId,
    actionKind: args.actionKind,
    target: args.target,
    payloadSummary: args.payloadSummary,
    requestedAt: new Date().toISOString(),
    provenance: "agent_inference",
  };
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-base-upl-acceptance-"));
  const ledgerPath = path.join(tempRoot, "user-path-ledger.json");
  const previousLedgerPath = process.env.AGENT_BUCCET_UPL_LEDGER_PATH;
  process.env.AGENT_BUCCET_UPL_LEDGER_PATH = ledgerPath;

  try {
    const sessionId = `agent-buccet-base-upl-acceptance-${Date.now()}`;
    const actorId = "user:base-upl-acceptance-contract";
    const workspace = path.join(tempRoot, "workspace");
    const outputsDir = path.join(workspace, "outputs");
    const secretsDir = path.join(workspace, "secrets");
    await fs.mkdir(outputsDir, { recursive: true });
    await fs.mkdir(secretsDir, { recursive: true });
    await fs.writeFile(path.join(workspace, "README.md"), "workspace read\n", "utf8");
    await fs.writeFile(path.join(secretsDir, "api.txt"), "secret\n", "utf8");

    const store = await createPersistentBoundaryRuntimeStore({
      sessionId,
      actorId,
    });
    const grantedActions: BoundaryActionKind[] = [
      "fs.read",
      "fs.write",
      "fs.append",
      "fs.delete",
      "fs.mkdir",
      "fs.move",
    ];
    const { config } = await openBoundaryPath({
      config: store.getConfig(),
      rootPath: workspace,
      grantedActions,
      issuedBy: actorId,
    });
    store.replaceConfig(config);

    const upl = await loadUserPathLedger();
    const baseAcceptanceEntries = upl.userApprovedLawPaths.filter((entry) =>
      entry.status === "ACTIVE" &&
      entry.scope === "SESSION" &&
      entry.sessionId === sessionId &&
      entry.notes?.includes("Buccet base acceptance pack")
    );
    assert.equal(baseAcceptanceEntries.length, 4, "expected base acceptance pack to seed four session-scoped rails");
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.notes?.includes("[workspace_read]")),
      "expected workspace read rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.notes?.includes("[workspace_mutation]")),
      "expected workspace mutation rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.notes?.includes("[local_organization]")),
      "expected local organization rail",
    );
    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.notes?.includes("[internal_artifacts]")),
      "expected internal artifacts rail",
    );

    const readDecision = await evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "fs.read",
      target: path.join(workspace, "README.md"),
      payloadSummary: "read:utf8",
    }));
    assert.equal(readDecision.result.decision, "allow", "expected workspace read to allow on contact");

    const writeDecision = await evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "fs.write",
      target: path.join(workspace, "src", "index.ts"),
      payloadSummary: "write:12bytes",
    }));
    assert.equal(writeDecision.result.decision, "allow", "expected workspace write to allow on contact");

    const artifactDecision = await evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "fs.append",
      target: path.join(outputsDir, "report.txt"),
      payloadSummary: "append:12bytes",
    }));
    assert.equal(artifactDecision.result.decision, "allow", "expected outputs write to allow on contact");

    const mkdirDecision = await evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "fs.mkdir",
      target: path.join(workspace, "notes"),
    }));
    assert.equal(mkdirDecision.result.decision, "allow", "expected local organization rail to allow mkdir");

    const deleteDecision = await evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "fs.delete",
      target: path.join(workspace, "README.md"),
    }));
    assert.equal(deleteDecision.result.decision, "require_approval", "expected delete to stay outside the base acceptance pack");

    const secretDecision = await evaluateBoundaryAction(config, makeRequest({
      sessionId,
      actionKind: "fs.read",
      target: path.join(secretsDir, "api.txt"),
      payloadSummary: "read:utf8",
    }));
    assert.equal(secretDecision.result.decision, "deny", "expected deny wall to cut out workspace secrets");
    assert.ok(
      secretDecision.result.triggeredLawIds.some((id) => id.startsWith("DENY.SECRETS.ACCESS.003")),
      "expected secret access denial to come from the base denial pack",
    );

    console.log("Agent Buccet base UPL acceptance contract");
    console.log(`seeded rails: ${baseAcceptanceEntries.length}`);
    console.log(`workspace read: ${readDecision.result.decision}`);
    console.log(`workspace write: ${writeDecision.result.decision}`);
    console.log(`outputs write: ${artifactDecision.result.decision}`);
    console.log(`delete remains gated: ${deleteDecision.result.decision}`);
    console.log(`secret wall: ${secretDecision.result.decision}`);
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
