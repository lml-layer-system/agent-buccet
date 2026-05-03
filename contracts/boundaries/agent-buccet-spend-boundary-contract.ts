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
} from "./../../src/index.ts";

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
    principal: "ops-treasury",
    purpose: "buy bounded compute credits",
    bucketId: "ops:aws",
    termsSummary: "one-time merchant purchase with no recurring obligation",
    recurring: false,
    riskClass: "low",
    accountabilityRef: "receipt:pending:aws",
    instructionSource: "trusted_user",
    periodCapNormalized: 100,
    periodWindow: "24h",
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
    const applyLedger = async (ledgerParam?: Awaited<ReturnType<typeof loadUserPathLedger>>) => {
      const ledger = ledgerParam ?? await loadUserPathLedger();
      store.replaceConfig({
        ...store.getConfig(),
        upl: ledger,
        userLawIds: [
          ...new Set([
            ...(store.getConfig().userLawIds ?? []),
            ...getActiveUserLawIds(ledger, store.getConfig().session),
          ]),
        ],
      });
      return ledger;
    };

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
      authority: {
        authorityKind: "human_approved",
        actorKind: "human",
        actorId,
        reason: "seed standing spend allow law",
        approvalRef: allowWitness.META.id,
      },
      decision: { choice: "allow_as_law" },
    });
    await applyLedger(approvedLedger);

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
    assert.deepEqual(
      approvedEntry?.trackConstraint?.spendAllowedPrincipals,
      ["ops-treasury"],
      "expected spend rail to bind the principal",
    );
    assert.deepEqual(
      approvedEntry?.trackConstraint?.spendAllowedPurposes,
      ["buy bounded compute credits"],
      "expected spend rail to bind the purpose",
    );
    assert.deepEqual(
      approvedEntry?.trackConstraint?.spendAllowedBucketIds,
      ["ops:aws"],
      "expected spend rail to bind the bucket",
    );
    assert.deepEqual(
      approvedEntry?.trackConstraint?.spendAllowedRiskClasses,
      ["low"],
      "expected spend rail to bind the risk class",
    );
    assert.equal(
      approvedEntry?.trackConstraint?.spendRecurringAllowed,
      false,
      "expected spend rail to bind one-time versus recurring",
    );
    assert.equal(
      approvedEntry?.trackConstraint?.spendMaxPeriodAmountNormalized,
      100,
      "expected spend rail to bind the rolling cap",
    );
    assert.equal(
      approvedEntry?.trackConstraint?.spendPeriodWindow,
      "24h",
      "expected spend rail to bind the rolling cap window",
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

    const injected = await bodyguard.spend.intent({
      spendIntent: spendIntent({
        instructionSource: "external_content",
      }),
      execute: async () => "should-not-run",
      successReason: "injected spend executed",
    });
    assert.equal(injected.allowed, false, "expected untrusted instruction provenance to be denied");
    assert.equal(injected.requiresApproval, false, "expected injected spend to fail closed");
    assert.match(
      injected.reason,
      /cannot become spend authority/i,
      "expected injected spend denial to name the provenance boundary",
    );

    await store.issueGrant({
      resourceKind: "recipient",
      resourceValue: "merchant:saas",
      grantedActions: ["agent.spend"],
      issuedBy: actorId,
    });
    const subscribeRequest = createBoundarySpendRequest({
      config: store.getConfig(),
      spendIntent: spendIntent({
        amountRaw: "9.99",
        amountNormalized: 9.99,
        destination: "merchant:saas",
        merchantHint: "SaaS Vendor",
        commitIntent: "subscribe",
        purpose: "subscribe to SaaS seat",
        bucketId: "saas:vendor",
        termsSummary: "$9.99 monthly until cancelled",
        recurring: true,
        riskClass: "recurring",
        accountabilityRef: "subscription:saas",
      }),
    });
    const subscribeWitness = await appendBoundaryLedger("APPROVAL_GRANTED", {
      sessionId,
      actorId,
      requestId: subscribeRequest.requestId,
      actionKind: subscribeRequest.actionKind,
      target: subscribeRequest.target,
      decision: "allow",
      reason: "seed standing subscribe allow law",
      lawIds: ["UPL.SPEND.SUBSCRIBE.01"],
      createdAt: new Date().toISOString(),
    });
    const subscribeLedger = await writeApprovedUserPathLaw({
      ledger: await loadUserPathLedger(),
      request: subscribeRequest,
      witness: subscribeWitness,
      session: store.getConfig().session,
      authority: {
        authorityKind: "human_approved",
        actorKind: "human",
        actorId,
        reason: "seed standing subscribe allow law",
        approvalRef: subscribeWitness.META.id,
      },
      decision: { choice: "allow_as_law" },
    });
    await applyLedger(subscribeLedger);

    const subscribePromise = bodyguard.spend.intent({
      spendIntent: spendIntent({
        amountRaw: "9.99",
        amountNormalized: 9.99,
        destination: "merchant:saas",
        merchantHint: "SaaS Vendor",
        commitIntent: "subscribe",
        purpose: "subscribe to SaaS seat",
        bucketId: "saas:vendor",
        termsSummary: "$9.99 monthly until cancelled",
        recurring: true,
        riskClass: "recurring",
        accountabilityRef: "subscription:saas",
      }),
      execute: async () => "should-not-run",
      successReason: "subscription spend executed",
    });
    const subscribePending = await waitForPending(() => bodyguard.approvals.listPending());
    assert.ok(subscribePending.length > 0, "expected recurring obligation to surface for approval");
    assert.match(
      subscribePending[0].request.reason,
      /high-risk spend requires explicit approval/i,
      "expected recurring spend to be held at the value boundary",
    );
    bodyguard.approvals.denyOnce(subscribePending[0].approvalId, {
      notes: "recurring spend requires explicit operator decision",
    });
    const subscribeResult = await subscribePromise;
    assert.equal(subscribeResult.allowed, false, "expected denied recurring spend not to execute");

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

    await store.issueGrant({
      resourceKind: "recipient",
      resourceValue: "merchant:budget",
      grantedActions: ["agent.spend"],
      issuedBy: actorId,
    });
    const cappedRequest = createBoundarySpendRequest({
      config: store.getConfig(),
      spendIntent: spendIntent({
        amountRaw: "10.00",
        amountNormalized: 10,
        destination: "merchant:budget",
        merchantHint: "Budget Vendor",
        purpose: "buy bounded budget item",
        bucketId: "ops:budget",
        accountabilityRef: "receipt:budget",
        periodCapNormalized: 18,
      }),
    });
    const cappedWitness = await appendBoundaryLedger("APPROVAL_GRANTED", {
      sessionId,
      actorId,
      requestId: cappedRequest.requestId,
      actionKind: cappedRequest.actionKind,
      target: cappedRequest.target,
      decision: "allow",
      reason: "seed standing capped spend allow law",
      lawIds: ["UPL.SPEND.CAP.01"],
      createdAt: new Date().toISOString(),
    });
    const cappedLedger = await writeApprovedUserPathLaw({
      ledger: await loadUserPathLedger(),
      request: cappedRequest,
      witness: cappedWitness,
      session: store.getConfig().session,
      authority: {
        authorityKind: "human_approved",
        actorKind: "human",
        actorId,
        reason: "seed standing capped spend allow law",
        approvalRef: cappedWitness.META.id,
      },
      decision: { choice: "allow_as_law" },
    });
    await applyLedger(cappedLedger);

    const budgetSpend = await bodyguard.spend.intent({
      spendIntent: spendIntent({
        amountRaw: "10.00",
        amountNormalized: 10,
        destination: "merchant:budget",
        merchantHint: "Budget Vendor",
        purpose: "buy bounded budget item",
        bucketId: "ops:budget",
        accountabilityRef: "receipt:budget",
        periodCapNormalized: 18,
      }),
      execute: async () => "budget-spent",
      successReason: "budget spend executed inside standing rail",
    });
    assert.equal(budgetSpend.allowed, true, "expected first spend inside rolling cap to execute");

    const aggregatePromise = bodyguard.spend.intent({
      spendIntent: spendIntent({
        amountRaw: "10.00",
        amountNormalized: 10,
        destination: "merchant:budget",
        merchantHint: "Budget Vendor",
        purpose: "buy bounded budget item",
        bucketId: "ops:budget",
        accountabilityRef: "receipt:budget-2",
        periodCapNormalized: 18,
      }),
      execute: async () => "should-not-run",
      successReason: "aggregate spend executed over rolling cap",
    });
    const aggregatePending = await waitForPending(() => bodyguard.approvals.listPending());
    assert.ok(aggregatePending.length > 0, "expected rolling-cap spend to surface for approval");
    assert.match(
      aggregatePending[0].request.reason,
      /rolling spend cap would be exceeded/i,
      "expected rolling cap hold to name the aggregate overflow",
    );
    bodyguard.approvals.denyOnce(aggregatePending[0].approvalId, {
      notes: "aggregate spend exceeds rolling bucket cap",
    });
    const aggregateResult = await aggregatePromise;
    assert.equal(aggregateResult.allowed, false, "expected aggregate-cap spend not to execute");

    await store.issueGrant({
      resourceKind: "recipient",
      resourceValue: "merchant:loop",
      grantedActions: ["agent.spend"],
      issuedBy: actorId,
    });
    const loopRequest = createBoundarySpendRequest({
      config: store.getConfig(),
      spendIntent: spendIntent({
        amountRaw: "1.00",
        amountNormalized: 1,
        destination: "merchant:loop",
        merchantHint: "Loop Vendor",
        purpose: "buy bounded loop-safe item",
        bucketId: "ops:loop",
        accountabilityRef: "receipt:loop",
      }),
    });
    const loopWitness = await appendBoundaryLedger("APPROVAL_GRANTED", {
      sessionId,
      actorId,
      requestId: loopRequest.requestId,
      actionKind: loopRequest.actionKind,
      target: loopRequest.target,
      decision: "allow",
      reason: "seed standing loop spend allow law",
      lawIds: ["UPL.SPEND.LOOP.01"],
      createdAt: new Date().toISOString(),
    });
    const loopLedger = await writeApprovedUserPathLaw({
      ledger: await loadUserPathLedger(),
      request: loopRequest,
      witness: loopWitness,
      session: store.getConfig().session,
      authority: {
        authorityKind: "human_approved",
        actorKind: "human",
        actorId,
        reason: "seed standing loop spend allow law",
        approvalRef: loopWitness.META.id,
      },
      decision: { choice: "allow_as_law" },
    });
    await applyLedger(loopLedger);

    const loopFirst = await bodyguard.spend.intent({
      spendIntent: spendIntent({
        amountRaw: "1.00",
        amountNormalized: 1,
        destination: "merchant:loop",
        merchantHint: "Loop Vendor",
        purpose: "buy bounded loop-safe item",
        bucketId: "ops:loop",
        accountabilityRef: "receipt:loop",
      }),
      execute: async () => "loop-1",
      successReason: "first loop spend executed inside standing rail",
    });
    assert.equal(loopFirst.allowed, true, "expected first spend in the corridor to execute");

    const loopSecond = await bodyguard.spend.intent({
      spendIntent: spendIntent({
        amountRaw: "1.00",
        amountNormalized: 1,
        destination: "merchant:loop",
        merchantHint: "Loop Vendor",
        purpose: "buy bounded loop-safe item",
        bucketId: "ops:loop",
        accountabilityRef: "receipt:loop",
      }),
      execute: async () => "loop-2",
      successReason: "second loop spend executed inside standing rail",
    });
    assert.equal(loopSecond.allowed, true, "expected second identical spend not to trip recursion yet");

    const loopThird = await bodyguard.spend.intent({
      spendIntent: spendIntent({
        amountRaw: "1.00",
        amountNormalized: 1,
        destination: "merchant:loop",
        merchantHint: "Loop Vendor",
        purpose: "buy bounded loop-safe item",
        bucketId: "ops:loop",
        accountabilityRef: "receipt:loop",
      }),
      execute: async () => "should-not-run",
      successReason: "recursive loop spend executed",
    });
    assert.equal(loopThird.allowed, false, "expected recursive self-spend loop to be cut off");
    assert.equal(loopThird.requiresApproval, false, "expected recursive self-spend loop to fail closed");
    assert.match(
      loopThird.reason,
      /recursive spend loop detected/i,
      "expected recursion cutoff to name the repeated spend corridor",
    );

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
      authority: {
        authorityKind: "human_approved",
        actorKind: "human",
        actorId,
        reason: "seed standing spend deny law",
        approvalRef: denyWitness.META.id,
      },
      decision: { choice: "deny_as_law" },
    });
    await applyLedger(deniedLedger);

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

    const workshopSessionId = `${sessionId}-workshop`;
    const workshopStore = await createPersistentBoundaryRuntimeStore({
      sessionId: workshopSessionId,
      actorId,
      teamSlug: "creative-team",
      teamBuccetClass: "workshop",
    });
    const workshopBodyguard = createBoundaryBodyguard(workshopStore);
    const applyWorkshopLedger = async (
      ledgerParam?: Awaited<ReturnType<typeof loadUserPathLedger>>,
    ) => {
      const ledger = ledgerParam ?? await loadUserPathLedger();
      workshopStore.replaceConfig({
        ...workshopStore.getConfig(),
        upl: ledger,
        userLawIds: [
          ...new Set([
            ...(workshopStore.getConfig().userLawIds ?? []),
            ...getActiveUserLawIds(ledger, workshopStore.getConfig().session),
          ]),
        ],
      });
      return ledger;
    };

    await workshopStore.issueGrant({
      resourceKind: "recipient",
      resourceValue: "merchant:creative",
      grantedActions: ["agent.spend"],
      issuedBy: actorId,
    });
    const workshopAllowRequest = createBoundarySpendRequest({
      config: workshopStore.getConfig(),
      spendIntent: spendIntent({
        amountRaw: "8.00",
        amountNormalized: 8,
        destination: "merchant:creative",
        merchantHint: "Creative Vendor",
        purpose: "buy creative-only item",
        bucketId: "creative:ops",
        accountabilityRef: "receipt:creative",
      }),
    });
    const workshopAllowWitness = await appendBoundaryLedger("APPROVAL_GRANTED", {
      sessionId: workshopSessionId,
      actorId,
      requestId: workshopAllowRequest.requestId,
      actionKind: workshopAllowRequest.actionKind,
      target: workshopAllowRequest.target,
      decision: "allow",
      reason: "seed standing spend allow law for workshop-lane test",
      lawIds: ["UPL.SPEND.WORKSHOP.01"],
      createdAt: new Date().toISOString(),
    });
    const workshopApprovedLedger = await writeApprovedUserPathLaw({
      ledger: await loadUserPathLedger(),
      request: workshopAllowRequest,
      witness: workshopAllowWitness,
      session: workshopStore.getConfig().session,
      authority: {
        authorityKind: "human_approved",
        actorKind: "human",
        actorId,
        reason: "seed standing spend allow law for workshop-lane test",
        approvalRef: workshopAllowWitness.META.id,
      },
      decision: { choice: "allow_as_law" },
    });
    await applyWorkshopLedger(workshopApprovedLedger);

    const workshopSpend = await workshopBodyguard.spend.intent({
      spendIntent: spendIntent({
        amountRaw: "8.00",
        amountNormalized: 8,
        destination: "merchant:creative",
        merchantHint: "Creative Vendor",
        purpose: "buy creative-only item",
        bucketId: "creative:ops",
        accountabilityRef: "receipt:creative",
      }),
      execute: async () => "should-not-run",
      successReason: "creative workshop spend executed",
    });
    assert.equal(
      workshopSpend.allowed,
      false,
      "expected non-spend team session to fail closed even with a standing spend rail",
    );
    assert.equal(
      workshopSpend.requiresApproval,
      false,
      "expected non-spend team session to deny instead of surfacing a spend approval",
    );
    assert.match(
      workshopSpend.reason,
      /not a SPEND Buccet/i,
      "expected non-spend team session denial to name the lane boundary",
    );

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
