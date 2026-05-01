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
  syncTeamSpendBoundaryProofOfWork,
  writeApprovedUserPathLaw,
} from "../lib/agent-buccet/index.ts";
import {
  createTeam,
  readTeamPathSourceMemoryEntries,
  teamSlug,
} from "../lib/agent-buccet/team-workshop.ts";

async function main() {
  const originalLedgerPath = process.env.AGENT_BUCCET_UPL_LEDGER_PATH;
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-spend-proof-"));
  process.env.AGENT_BUCCET_UPL_LEDGER_PATH = path.join(tempRoot, "user-path-ledger.json");

  try {
    await saveUserPathLedger({
      specVersion: 1,
      userApprovedLawPaths: [],
      userDeniedLawPaths: [],
    });

    const slug = teamSlug("spend-proof-team");
    await createTeam({
      homePath: tempRoot,
      name: "spend-proof-team",
      domain: "shopping",
      summary: "spend proof contract",
      createdBy: "contract",
      buccetClass: "spend",
    });

    const sessionId = `agent-buccet-spend-proof-${Date.now()}`;
    const actorId = "user:spend-proof-contract";
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
      resourceValue: "merchant:proof",
      grantedActions: ["agent.spend"],
      issuedBy: actorId,
    });

    const spendIntent = {
      amountRaw: "15.00",
      amountNormalized: 15,
      destination: "merchant:proof",
      destinationKind: "merchant" as const,
      sourceAuthorityKind: "linked_account" as const,
      commitIntent: "purchase" as const,
      principal: "ops-treasury",
      purpose: "buy proof-of-work item",
      bucketId: "ops:proof",
      termsSummary: "one-time merchant purchase for proof-of-work mirroring",
      recurring: false,
      riskClass: "low" as const,
      accountabilityRef: "receipt:proof",
      instructionSource: "trusted_user" as const,
      periodCapNormalized: 100,
      periodWindow: "24h" as const,
      currencyHint: "USD",
      merchantHint: "Proof Vendor",
    };

    const allowRequest = createBoundarySpendRequest({
      config: store.getConfig(),
      spendIntent,
    });
    const allowWitness = await appendBoundaryLedger("APPROVAL_GRANTED", {
      sessionId,
      actorId,
      requestId: allowRequest.requestId,
      actionKind: allowRequest.actionKind,
      target: allowRequest.target,
      decision: "allow",
      reason: "seed standing spend proof allow law",
      lawIds: ["UPL.SPEND.PROOF.01"],
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
        reason: "seed standing spend proof allow law",
        approvalRef: allowWitness.META.id,
      },
      decision: { choice: "allow_as_law" },
    });
    await applyLedger(approvedLedger);

    const spend = await bodyguard.spend.intent({
      spendIntent,
      execute: async () => "spent-proof",
      successReason: "spend proof executed inside standing rail",
    });
    assert.equal(spend.allowed, true, "expected spend proof request to execute");
    assert.equal(spend.executed, true, "expected spend proof request to execute");

    const mirrored = await syncTeamSpendBoundaryProofOfWork({
      homePath: tempRoot,
      slug,
      sessionId,
    });
    assert.ok(mirrored.appended.length >= 3, "expected spend proof mirror to append session spend events");
    assert.equal(mirrored.latestDecision?.decision, "allow", "expected latest mirrored spend decision to be allow");

    const memory = await readTeamPathSourceMemoryEntries(tempRoot, slug);
    const spendProofEntries = memory.filter((record) => record.kind === "spend_boundary");
    assert.ok(spendProofEntries.length >= 3, "expected spend proof entries in path-source memory");
    assert.ok(
      spendProofEntries.some((record) => record.meta?.boundaryEventType === "ACTION_PROPOSED"),
      "expected mirrored spend proof to include ACTION_PROPOSED",
    );
    assert.ok(
      spendProofEntries.some((record) => record.meta?.boundaryEventType === "DECISION_RETURNED"),
      "expected mirrored spend proof to include DECISION_RETURNED",
    );
    assert.ok(
      spendProofEntries.some((record) => record.meta?.boundaryEventType === "ACTION_EXECUTED"),
      "expected mirrored spend proof to include ACTION_EXECUTED",
    );
    assert.ok(
      spendProofEntries.some((record) => record.text.includes("principal=ops-treasury")),
      "expected mirrored spend proof text to carry spend-packet principal",
    );
    assert.ok(
      spendProofEntries.every((record) => typeof record.meta?.boundaryLedgerIndex === "number"),
      "expected mirrored spend proof entries to retain the source ledger index",
    );

    const deduped = await syncTeamSpendBoundaryProofOfWork({
      homePath: tempRoot,
      slug,
      sessionId,
    });
    assert.equal(deduped.appended.length, 0, "expected repeat spend proof sync not to duplicate entries");

    console.log("Agent Buccet spend proof contract");
    console.log(`mirrored spend entries: ${spendProofEntries.length}`);
    console.log(`deduped repeat sync: ${deduped.appended.length === 0}`);
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
