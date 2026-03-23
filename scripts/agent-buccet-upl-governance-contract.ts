import assert from "node:assert/strict";
import {
  appendBoundaryLedger,
  createBoundaryBodyguard,
  createPersistentBoundaryRuntimeStore,
  getActiveUserLawIds,
  loadUserPathLedger,
  saveUserPathLedger,
  writeApprovedUserPathLaw,
} from "../lib/agent-buccet/index.ts";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPendingApproval<T>(
  listPending: () => T[],
  timeoutMs = 1_000,
): Promise<T[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pending = listPending();
    if (pending.length > 0) {
      return pending;
    }
    await sleep(25);
  }
  return listPending();
}

async function main() {
  const originalLedger = await loadUserPathLedger();

  try {
    await saveUserPathLedger({
      specVersion: 1,
      userApprovedLawPaths: [],
      userDeniedLawPaths: [],
    });

    const sessionId = `agent-buccet-upl-governance-${Date.now()}`;
    const actorId = "user:upl-governance-contract";
    const store = await createPersistentBoundaryRuntimeStore({
      sessionId,
      actorId,
    });
    const bodyguard = createBoundaryBodyguard(store);

    const blockedAttempt = bodyguard.chat.emit({
      userInput: "bring me info on batman from the 1999 comic book I do not want anything from the 2000s",
      attemptedOutput: "Batman 2003 run is the best answer for that request.",
      execute: async () => "should-not-run",
      successReason: "chat output emitted after review",
    });

    const pending = await waitForPendingApproval(() => bodyguard.approvals.listPending());
    assert.equal(pending.length, 1, "expected one pending approval before deny-as-law");
    bodyguard.approvals.denyAsLaw(pending[0].approvalId, {
      notes: "1999 only means 1999 only",
    });
    const denied = await blockedAttempt;
    assert.equal(denied.allowed, false, "expected first attempt to be denied");

    const autoBlocked = await bodyguard.chat.emit({
      userInput: "bring me info on batman from the 1999 comic book I do not want anything from the 2000s",
      attemptedOutput: "Batman 2003 run is the best answer for that request.",
      execute: async () => "should-not-run",
      successReason: "chat output emitted after review",
    });
    assert.equal(autoBlocked.allowed, false, "expected standing deny to auto-block repeated attempt");
    assert.equal(autoBlocked.requiresApproval, false, "expected standing deny to avoid re-prompt");

    const request = pending[0].request.request;
    const witness = await appendBoundaryLedger("APPROVAL_GRANTED", {
      sessionId,
      actorId,
      requestId: request.requestId,
      actionKind: request.actionKind,
      target: request.target,
      decision: "allow",
      reason: "user manually replaced standing deny with standing allow",
      lawIds: ["UPL.MANUAL.MUTATION.01"],
      createdAt: new Date().toISOString(),
    });

    const updatedLedger = await writeApprovedUserPathLaw({
      ledger: await loadUserPathLedger(),
      request,
      witness,
      session: store.getConfig().session,
      decision: { choice: "allow_as_law" },
    });

    store.replaceConfig({
      ...store.getConfig(),
      upl: updatedLedger,
      userLawIds: [
        ...new Set([
          ...(store.getConfig().userLawIds ?? []),
          ...getActiveUserLawIds(updatedLedger, store.getConfig().session),
        ]),
      ],
    });

    const activeDenied = updatedLedger.userDeniedLawPaths.filter((entry) => entry.status === "ACTIVE");
    const mutedDenied = updatedLedger.userDeniedLawPaths.filter((entry) => entry.status === "MUTED");
    const activeApproved = updatedLedger.userApprovedLawPaths.filter((entry) => entry.status === "ACTIVE");

    assert.equal(activeDenied.length, 0, "expected conflicting deny law to be muted");
    assert.equal(mutedDenied.length, 1, "expected previous deny law to remain as muted history");
    assert.equal(activeApproved.length, 1, "expected new allow law to be active");

    const allowed = await bodyguard.chat.emit({
      userInput: "bring me info on batman from the 1999 comic book I do not want anything from the 2000s",
      attemptedOutput: "Batman 2003 run is the best answer for that request.",
      execute: async () => "allowed-by-new-standing-law",
      successReason: "chat output emitted after standing allow replaced prior deny",
    });

    assert.equal(allowed.allowed, true, "expected later standing allow to override previous deny");
    assert.equal(allowed.requiresApproval, false, "expected later standing allow to short-circuit approval");

    console.log("Agent Buccet UPL governance contract");
    console.log(`muted denied laws: ${mutedDenied.length}`);
    console.log(`active approved laws: ${activeApproved.length}`);
    console.log(`later standing allow admitted: ${allowed.allowed}`);
  } finally {
    await saveUserPathLedger(originalLedger);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
