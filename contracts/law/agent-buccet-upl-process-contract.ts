import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  activateCompiledBoundaryUplState,
  approveBoundaryUplReview,
  createStructuredUplLaw,
  compileApprovedBoundaryUplReview,
  compileStructuredUplLawToDocumentLaw,
  createEmptyUserPathLedger,
  draftBoundaryUplProcess,
  writeCompiledUserPathLaws,
  reviewBoundaryUplDraft,
  saveUserPathLedger,
  writeApprovedBoundaryUplReviewToLedger,
} from "../lib/agent-buccet/index.ts";

async function main() {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "agent-buccet-upl-process-"));
  const originalLedgerPath = process.env.AGENT_BUCCET_UPL_LEDGER_PATH;
  process.env.AGENT_BUCCET_UPL_LEDGER_PATH = path.join(tempRoot, "user-path-ledger.json");

  const session = {
    sessionId: `agent-buccet-upl-process-${Date.now()}`,
    actorId: "user:upl-process-contract",
    createdAt: new Date().toISOString(),
    dryRun: false,
    persistent: true,
    status: "active" as const,
    teamBuccetClass: "spend" as const,
  };

  const witness = {
    META: {
      id: "upl-process-witness",
      timestamp: new Date().toISOString(),
      actor: session.actorId,
    },
  } as never;

  try {
    const baselineLedger = await saveUserPathLedger(createEmptyUserPathLedger());

    const allowDraft = draftBoundaryUplProcess({
      observation: {
        title: "subscription drift risk",
        summary: "new spend bucket needs a bounded subscription rail",
        detectedAt: new Date().toISOString(),
        detectedBy: "pi",
        sourceText: "allow vercel subscription under monthly cap",
      },
      boundary: {
        title: "value boundary",
        crossing: "recommendation becomes recurring financial commitment",
        consequence: "subscription starts spending real money",
      },
      invariant: {
        statement: "subscription may commit only inside the exact spend corridor",
        allowed: ["approved provider inside cap"],
        denied: ["unapproved provider", "uncapped recurring commitment"],
        humanRequired: ["initial law activation"],
        headlessAllowed: ["bounded recurring commit after activation"],
      },
      draftedByKind: "pi",
      draftedBy: "pi",
      mutations: [
        {
          kind: "add",
          lawKey: "spend.subscription.vercel.monthly",
          reason: "open a narrow spend corridor for Vercel",
          nextLaw: {
            lawKey: "spend.subscription.vercel.monthly",
            domain: "spend",
            capability: "subscription.start",
            state: "allow",
            scope: "GLOBAL",
            runtime: {
              actionKinds: ["agent.spend"],
              primaryTarget: "provider:vercel",
              targetPatterns: ["provider:vercel"],
              targetMatchMode: "exact",
              provenance: "trusted_user",
            },
            bucketId: "software",
            principal: "ryan",
            approvedHandles: ["provider:vercel"],
            approvedDestinationKinds: ["merchant"],
            approvedSourceAuthorityKinds: ["card"],
            approvedCommitIntents: ["subscribe"],
            riskClasses: ["recurring"],
            amountLimitNormalized: 20,
            periodLimitNormalized: 20,
            periodWindow: "30d",
            recurringPolicy: "allow",
            substitutionPolicy: "deny",
            humanConfirmationRule: "notify_before_commit",
            reminderOffsets: ["14d", "7d", "3d", "1d"],
            proofRequirement: "receipt_required",
            notes: "bounded Vercel subscription corridor",
          },
        },
      ],
    });

    const allowReview = reviewBoundaryUplDraft({
      currentLaws: [],
      draft: allowDraft,
    });
    assert.equal(allowReview.deltas.length, 1, "expected one reviewed law delta");
    assert.equal(allowReview.deltas[0]?.after?.state, "allow", "expected allow state in reviewed delta");

    const allowApproved = approveBoundaryUplReview({
      review: allowReview,
      actorId: session.actorId,
    });
    const compiled = compileApprovedBoundaryUplReview({
      approved: allowApproved,
      syncTargets: ["buccet", "future_buccets"],
    });
    const active = activateCompiledBoundaryUplState({
      compiled,
    });
    assert.equal(active.stage, "active", "expected activated UPL state");
    assert.deepEqual(active.syncTargets, ["buccet", "future_buccets"], "expected normalized sync targets");

    const uplAfterAllow = await writeApprovedBoundaryUplReviewToLedger({
      ledger: createEmptyUserPathLedger(),
      approved: allowApproved,
      witness,
      session,
    });
    assert.equal(uplAfterAllow.userApprovedLawPaths.length, 1, "expected approved live UPL entry");
    const approvedEntry = uplAfterAllow.userApprovedLawPaths[0];
    assert.ok(approvedEntry, "expected approved entry");
    assert.equal(approvedEntry.requestBasis?.actionKind, "agent.spend", "expected spend action kind");
    assert.equal(approvedEntry.trackConstraint?.spendMaxAmountNormalized, 20, "expected spend cap in track");
    assert.deepEqual(approvedEntry.trackConstraint?.spendAllowedCommitIntents, ["subscribe"], "expected subscribe intent in track");
    assert.deepEqual(approvedEntry.trackConstraint?.spendAllowedBucketIds, ["software"], "expected bucket binding in track");

    const denyDraft = draftBoundaryUplProcess({
      observation: {
        title: "exchange side door",
        summary: "raw payment-link and exchange paths stay sealed",
        detectedAt: new Date().toISOString(),
        detectedBy: "pi",
      },
      boundary: {
        title: "financial side door",
        crossing: "generic network motion becomes financial consequence",
        consequence: "spend bypasses canonical spend lane",
      },
      invariant: {
        statement: "generic exchange side doors stay denied",
        allowed: [],
        denied: ["raw exchange endpoint side door"],
        humanRequired: [],
        headlessAllowed: [],
      },
      draftedByKind: "pi",
      draftedBy: "pi",
      mutations: [
        {
          kind: "add",
          lawKey: "spend.exchange.side-door",
          reason: "keep exchange side door sealed",
          nextLaw: {
            lawKey: "spend.exchange.side-door",
            domain: "spend",
            capability: "exchange.side_door",
            state: "deny",
            scope: "GLOBAL",
            runtime: {
              actionKinds: ["network.send"],
              primaryTarget: "https://api.exchange.example/order",
              targetPatterns: ["https://api.exchange.example/order"],
              targetMatchMode: "exact",
              provenance: "trusted_user",
            },
            approvedHandles: [],
            approvedDestinationKinds: ["exchange"],
            approvedSourceAuthorityKinds: [],
            approvedCommitIntents: ["swap"],
            riskClasses: ["volatile"],
            recurringPolicy: "deny",
            substitutionPolicy: "deny",
            humanConfirmationRule: "require_human_execution",
            reminderOffsets: [],
            proofRequirement: "record_match",
            notes: "deny raw exchange side door",
          },
        },
      ],
    });

    const denyApproved = approveBoundaryUplReview({
      review: reviewBoundaryUplDraft({
        currentLaws: [],
        draft: denyDraft,
      }),
      actorId: session.actorId,
    });
    const uplAfterDeny = await writeApprovedBoundaryUplReviewToLedger({
      ledger: createEmptyUserPathLedger(),
      approved: denyApproved,
      witness,
      session,
    });
    assert.equal(
      uplAfterDeny.userDeniedLawPaths.length,
      baselineLedger.userDeniedLawPaths.length + 1,
      "expected one additional denied live UPL entry",
    );
    const deniedEntry = uplAfterDeny.userDeniedLawPaths.at(-1);
    assert.equal(deniedEntry?.requestBasis?.actionKind, "network.send", "expected network send deny path");

    const askLaw = createStructuredUplLaw({
      lawKey: "spend.subscription.ask-only",
      domain: "spend",
      capability: "subscription.start",
      state: "ask",
      scope: "GLOBAL",
      runtime: {
        actionKinds: ["agent.spend"],
        primaryTarget: "provider:anthropic",
        targetPatterns: ["provider:anthropic"],
        targetMatchMode: "exact",
        provenance: "trusted_user",
      },
      bucketId: "api",
      principal: "ryan",
      approvedHandles: ["provider:anthropic"],
      approvedDestinationKinds: ["merchant"],
      approvedSourceAuthorityKinds: ["card"],
      approvedCommitIntents: ["subscribe"],
      riskClasses: ["recurring"],
      recurringPolicy: "ask",
      substitutionPolicy: "deny",
      humanConfirmationRule: "ask_before_commit",
      reminderOffsets: ["14d", "7d", "3d", "1d"],
      proofRequirement: "receipt_required",
      notes: "ask-only subscription lane",
    });
    assert.throws(
      () => compileStructuredUplLawToDocumentLaw(askLaw),
      /state=ask/,
      "expected ask-state activation to fail until live UPL supports a third lane",
    );

    await assert.rejects(
      () => writeCompiledUserPathLaws({
        ledger: createEmptyUserPathLedger(),
        compiledLaws: [{
          compiledLaw: compileStructuredUplLawToDocumentLaw(allowReview.afterLaws[0]!),
          witness,
        }],
        session,
        authority: {
          authorityKind: "trusted_system_sync",
          actorKind: "pi",
          actorId: "pi:policy-drafter",
          reason: "pi tries to write active upl directly",
        } as never,
      }),
      /actorKind=system/,
      "expected non-human/non-system direct active UPL write to fail closed",
    );

    console.log("Agent Buccet UPL process contract");
    console.log(`allow review delta count: ${allowReview.deltas.length}`);
    console.log(`allow entry activated: ${uplAfterAllow.userApprovedLawPaths.length === 1}`);
    console.log(`deny entry activated: ${uplAfterDeny.userDeniedLawPaths.length === baselineLedger.userDeniedLawPaths.length + 1}`);
    console.log("ask state blocked from activation: true");
  } finally {
    if (originalLedgerPath !== undefined) {
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
