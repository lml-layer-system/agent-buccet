import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  appendBoundaryLedger,
  createBoundaryBodyguard,
  createBoundarySpendRequest,
  createPersistentBoundaryRuntimeStore,
  getActiveUserLawIds,
  loadUserPathLedger,
  saveUserPathLedger,
  writeApprovedUserPathLaw,
  writeDeniedUserPathLaw,
  type BoundarySpendIntent,
} from "../lib/agent-buccet/index.ts";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPending<T>(list: () => T[], timeoutMs = 15_000): Promise<T[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const items = list();
    if (items.length > 0) {
      return items;
    }
    await sleep(25);
  }
  return list();
}

function spendIntent(overrides?: Partial<BoundarySpendIntent>): BoundarySpendIntent {
  return {
    amountRaw: "50.00",
    amountNormalized: 50,
    destination: "merchant:aws",
    destinationKind: "merchant",
    sourceAuthorityKind: "linked_account",
    commitIntent: "purchase",
    currencyHint: "USD",
    merchantHint: "AWS",
    ...overrides,
  };
}

async function main() {
  const originalLedgerPath = process.env.AGENT_BUCCET_UPL_LEDGER_PATH;
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-spend-boundary-"));
  process.env.AGENT_BUCCET_UPL_LEDGER_PATH = path.join(tempRoot, "user-path-ledger.json");

  try {
    await saveUserPathLedger({
      specVersion: 1,
      userApprovedLawPaths: [],
      userDeniedLawPaths: [],
    });

    const sessionId = `agent-buccet-spend-boundary-${Date.now()}`;
    const actorId = "user:spend-boundary-contract";
    const store = await createPersistentBoundaryRuntimeStore({
      sessionId,
      actorId,
    });
    const bodyguard = createBoundaryBodyguard(store);

    await store.issueGrant({
      resourceKind: "recipient",
      resourceValue: "merchant:aws",
      grantedActions: ["agent.spend"],
      issuedBy: actorId,
    });
    await store.issueGrant({
      resourceKind: "recipient",
      resourceValue: "merchant:evil",
      grantedActions: ["agent.spend"],
      issuedBy: actorId,
    });

    const unmapped = await bodyguard.spend.intent({
      spendIntent: spendIntent(),
      execute: async () => "should-not-run",
      successReason: "agent spend executed",
    });
    assert.equal(unmapped.allowed, false, "expected unmapped spend to be denied");
    assert.equal(unmapped.requiresApproval, false, "expected unmapped spend to deny without prompting");
    assert.match(
      unmapped.reason,
      /agent spend is denied by default/i,
      "expected unmapped spend denial to explain the spend default",
    );

    const allowRequest = createBoundarySpendRequest({
      config: store.getConfig(),
      spendIntent: spendIntent(),
    });
    const allowWitness = await appendBoundaryLedger("APPROVAL_GRANTED", {
      sessionId,
      actorId,
      requestId: allowRequest.requestId,
      actionKind: allowRequest.actionKind,
      target: allowRequest.target,
      decision: "allow",
      reason: "seed standing spend allow law",
      lawIds: ["UPL.SPEND.ALLOW.01"],
      createdAt: new Date().toISOString(),
    });
    const approvedLedger = await writeApprovedUserPathLaw({
      ledger: await loadUserPathLedger(),
      request: allowRequest,
      witness: allowWitness,
      session: store.getConfig().session,
      decision: { choice: "allow_as_law" },
    });
    store.replaceConfig({
      ...store.getConfig(),
      upl: approvedLedger,
      userLawIds: [
        ...new Set([
          ...(store.getConfig().userLawIds ?? []),
          ...getActiveUserLawIds(approvedLedger, store.getConfig().session),
        ]),
      ],
    });

    const approvedEntry = approvedLedger.userApprovedLawPaths[approvedLedger.userApprovedLawPaths.length - 1];
    assert.ok(approvedEntry?.trackConstraint, "expected spend allow rail to carry a track constraint");
    assert.equal(
      approvedEntry?.trackConstraint?.spendMaxAmountNormalized,
      50,
      "expected spend rail to bind the normalized limit",
    );
    assert.deepEqual(
      approvedEntry?.trackConstraint?.spendAllowedDestinationKinds,
      ["merchant"],
      "expected spend rail to bind the destination class",
    );
    assert.deepEqual(
      approvedEntry?.trackConstraint?.spendAllowedCommitIntents,
      ["purchase"],
      "expected spend rail to bind the commit intent",
    );

    const admitted = await bodyguard.spend.intent({
      spendIntent: spendIntent({
        amountRaw: "12.00",
        amountNormalized: 12,
      }),
      execute: async () => "spent-ok",
      successReason: "agent spend executed inside standing rail",
    });
    assert.equal(admitted.allowed, true, "expected lower-value spend inside the rail to be allowed");
    assert.equal(admitted.requiresApproval, false, "expected lawful spend rail to avoid re-prompt");
    assert.equal(admitted.executed, true, "expected lawful spend rail to execute");
    assert.equal(admitted.value, "spent-ok", "expected spend execution result to propagate");

    const overLimitPromise = bodyguard.spend.intent({
      spendIntent: spendIntent({
        amountRaw: "75.00",
        amountNormalized: 75,
      }),
      execute: async () => "should-not-run",
      successReason: "agent spend executed over corridor limit",
    });
    const pending = await waitForPending(() => bodyguard.approvals.listPending());
    assert.ok(pending.length > 0, "expected over-limit spend to surface for approval");
    assert.match(
      pending[0].request.reason,
      /exits approved execution corridor/i,
      "expected over-limit spend to surface as corridor drift",
    );
    bodyguard.approvals.denyOnce(pending[0].approvalId, {
      notes: "spend exceeds standing agent spend law corridor",
    });
    const overLimit = await overLimitPromise;
    assert.equal(overLimit.allowed, false, "expected denied over-limit spend not to execute");

    const denyRequest = createBoundarySpendRequest({
      config: store.getConfig(),
      spendIntent: spendIntent({
        amountRaw: "10.00",
        amountNormalized: 10,
        destination: "merchant:evil",
        merchantHint: "Evil Corp",
      }),
    });
    const denyWitness = await appendBoundaryLedger("APPROVAL_DENIED", {
      sessionId,
      actorId,
      requestId: denyRequest.requestId,
      actionKind: denyRequest.actionKind,
      target: denyRequest.target,
      decision: "deny",
      reason: "seed standing spend deny law",
      lawIds: ["UPL.SPEND.DENY.01"],
      createdAt: new Date().toISOString(),
    });
    const deniedLedger = await writeDeniedUserPathLaw({
      ledger: await loadUserPathLedger(),
      request: denyRequest,
      witness: denyWitness,
      session: store.getConfig().session,
      decision: { choice: "deny_as_law" },
    });
    store.replaceConfig({
      ...store.getConfig(),
      upl: deniedLedger,
      userLawIds: [
        ...new Set([
          ...(store.getConfig().userLawIds ?? []),
          ...getActiveUserLawIds(deniedLedger, store.getConfig().session),
        ]),
      ],
    });

    const denied = await bodyguard.spend.intent({
      spendIntent: spendIntent({
        amountRaw: "5.00",
        amountNormalized: 5,
        destination: "merchant:evil",
        merchantHint: "Evil Corp",
      }),
      execute: async () => "should-not-run",
      successReason: "agent spend executed inside denied corridor",
    });
    assert.equal(denied.allowed, false, "expected standing spend deny wall to block repeat motion");
    assert.equal(denied.requiresApproval, false, "expected standing spend deny wall to avoid re-prompt");

    console.log("Agent Buccet spend boundary contract");
    console.log(`unmapped spend denied: ${!unmapped.allowed}`);
    console.log(`standing spend rail admitted lawful variant: ${admitted.allowed}`);
    console.log(`over-limit spend surfaced to approval: ${pending.length > 0}`);
    console.log(`standing spend deny wall blocked: ${!denied.allowed}`);
  } finally {
    if (originalLedgerPath) {
      process.env.AGENT_BUCCET_UPL_LEDGER_PATH = originalLedgerPath;
    } else {
      delete process.env.AGENT_BUCCET_UPL_LEDGER_PATH;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
