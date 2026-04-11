import assert from "node:assert/strict";
import {
  appendBoundaryLedger,
  createBoundaryChatEmissionRequest,
  createBoundaryBodyguard,
  createPersistentBoundaryRuntimeStore,
  getActiveUserLawIds,
  loadUserPathLedger,
  saveUserPathLedger,
  writeDeniedUserPathLaw,
  writeApprovedUserPathLaw,
} from "../lib/agent-buccet/index.ts";

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

    const request = createBoundaryChatEmissionRequest({
      config: store.getConfig(),
      userInput: "bring me info on batman from the 1999 comic book I do not want anything from the 2000s",
      attemptedOutput: "Batman 2003 run is the best answer for that request.",
    });

    const denyWitness = await appendBoundaryLedger("APPROVAL_DENIED", {
      sessionId,
      actorId,
      requestId: request.requestId,
      actionKind: request.actionKind,
      target: request.target,
      decision: "deny",
      reason: "1999 only means 1999 only",
      lawIds: ["UPL.MANUAL.DENY.01"],
      createdAt: new Date().toISOString(),
    });

    const deniedLedger = await writeDeniedUserPathLaw({
      ledger: await loadUserPathLedger(),
      request,
      witness: denyWitness,
      session: store.getConfig().session,
      decision: { choice: "deny_as_law" },
    });

    store.replaceConfig({
      ...store.getConfig(),
      upl: deniedLedger,
      userLawIds: [
        ...new Set([
          ...getActiveUserLawIds(deniedLedger, store.getConfig().session),
        ]),
      ],
    });

    const denied = await bodyguard.chat.emit({
      userInput: "bring me info on batman from the 1999 comic book I do not want anything from the 2000s",
      attemptedOutput: "Batman 2003 run is the best answer for that request.",
      execute: async () => "should-not-run",
      successReason: "chat output emitted after standing deny",
    });
    assert.equal(denied.allowed, false, "expected first attempt to be denied");
    assert.equal(denied.requiresApproval, false, "expected standing deny to avoid prompting");

    const autoBlocked = await bodyguard.chat.emit({
      userInput: "bring me info on batman from the 1999 comic book I do not want anything from the 2000s",
      attemptedOutput: "Batman 2003 run is the best answer for that request.",
      execute: async () => "should-not-run",
      successReason: "chat output emitted after review",
    });
    assert.equal(autoBlocked.allowed, false, "expected standing deny to auto-block repeated attempt");
    assert.equal(autoBlocked.requiresApproval, false, "expected standing deny to avoid re-prompt");

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
    const replacedDenied = updatedLedger.userDeniedLawPaths.filter((entry) => entry.status === "MUTED");
    const activeApproved = updatedLedger.userApprovedLawPaths.filter((entry) => entry.status === "ACTIVE");

    assert.equal(activeDenied.length, 0, "expected conflicting deny law to be replaced by the user's newer law");
    assert.equal(replacedDenied.length, 1, "expected previous deny law to remain as replaced history");
    assert.equal(activeApproved.length, 1, "expected new allow law to be active");

    const allowed = await bodyguard.chat.emit({
      userInput: "bring me info on batman from the 1999 comic book I do not want anything from the 2000s",
      attemptedOutput: "Batman 2003 run is the best answer for that request.",
      execute: async () => "allowed-by-new-standing-law",
      successReason: "chat output emitted after standing allow replaced prior deny",
    });

    assert.equal(allowed.allowed, true, "expected later standing allow to override previous deny");
    assert.equal(allowed.requiresApproval, false, "expected later standing allow to short-circuit approval");

    const manualLedger = await saveUserPathLedger({
      specVersion: 1,
      userApprovedLawPaths: [],
      userDeniedLawPaths: [
        {
          id: "UPL-MANUAL-TRACK-001",
          type: "DENIED",
          path: "",
          pathHash: "",
          createdAt: new Date().toISOString(),
          scope: "GLOBAL",
          status: "ACTIVE",
          witness: "manual:uplt",
          modifiedAt: null,
          notes: "manually authored company policy",
          requestBasis: {
            actionKind: "chat.emit",
            target: "chat:primary",
            payloadSummary: "BOUNDARY.CHAT.USER_CONSTRAINT.01 :: Batman 2003 run is the best answer for that request.",
            provenance: "agent_inference",
            flags: {
              violatesUserConstraint: true,
            },
            reviewContext: {
              surface: "chat",
              invariantLawId: "BOUNDARY.CHAT.USER_CONSTRAINT.01",
              invariantLabel: "Output conflicts with the user time constraint.",
              userInput: "bring me info on batman from the 1999 comic book I do not want anything from the 2000s",
              attemptedOutput: "Batman 2003 run is the best answer for that request.",
              evidence: ["Attempted output references 2003."],
            },
          },
        },
      ],
    });
    const reloadedManualLedger = await loadUserPathLedger();
    assert.equal(manualLedger.userDeniedLawPaths.length, 1, "expected one manual denied law");
    assert.ok(
      reloadedManualLedger.userDeniedLawPaths[0].trackConstraint,
      "expected manual UPL entry to materialize a track from requestBasis",
    );

    store.replaceConfig({
      ...store.getConfig(),
      upl: reloadedManualLedger,
      userLawIds: [
        ...new Set([
          ...getActiveUserLawIds(reloadedManualLedger, store.getConfig().session),
        ]),
      ],
    });

    const manualBlocked = await bodyguard.chat.emit({
      userInput: "bring me info on batman from the 1999 comic book I do not want anything from the 2000s",
      attemptedOutput: "Batman 2001 run is the best answer for that request.",
      execute: async () => "should-not-run",
      successReason: "chat output emitted after manual UPL policy",
      invariantLawId: "BOUNDARY.CHAT.USER_CONSTRAINT.01",
    });

    assert.equal(manualBlocked.allowed, false, "expected manual UPL deny track to block same invariant corridor");
    assert.equal(manualBlocked.requiresApproval, false, "expected manual UPL deny track to avoid re-prompt");

    console.log("Agent Buccet UPL governance contract");
    console.log(`replaced denied laws: ${replacedDenied.length}`);
    console.log(`active approved laws: ${activeApproved.length}`);
    console.log(`later standing allow admitted: ${allowed.allowed}`);
    console.log(`manual UPL track materialized: ${!!reloadedManualLedger.userDeniedLawPaths[0].trackConstraint}`);
    console.log(`manual UPL corridor blocked: ${!manualBlocked.allowed}`);
  } finally {
    await saveUserPathLedger(originalLedger);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
