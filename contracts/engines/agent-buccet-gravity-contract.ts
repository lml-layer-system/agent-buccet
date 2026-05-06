import { promises as fs } from "node:fs";
import path from "node:path";
import {
  type GravityEvent,
  type GravityState,
  type LawSkill,
  META_CONTACT_01,
  META_CONTINUATION_01,
  assertBoundaryGravityLawUpdateAllowed,
  createBoundaryActionRequest,
  createBoundaryGravityService,
  evaluateBoundaryGravityEvent,
  evaluateGravityEvent,
  startPersistentBoundarySession,
} from "./../../src/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createContractGravityState(sessionId: string, actorId: string): GravityState {
  return {
    identity: {
      id: sessionId,
      label: actorId,
    },
    staticLaws: {
      laws: [],
    },
    dynamicLaws: {
      grants: [],
    },
    memory: {
      handle: `boundary-session:${sessionId}`,
    },
    context: {
      ledger: {
        sessionTraceComplete: true,
        requestTraceComplete: true,
      },
    },
  };
}

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionId = `agent-buccet-gravity-contract-${runId}`;
  const actorId = "user:gravity-contract";
  const demoRoot = path.join(
    process.cwd(),
    "data",
    "agent-boundary",
    "gravity-contract",
    sessionId,
  );
  const scopedRoot = path.join(demoRoot, "workspace");
  const outsideRoot = path.join(demoRoot, "outside");
  await fs.mkdir(scopedRoot, { recursive: true });
  await fs.mkdir(outsideRoot, { recursive: true });

  let config = await startPersistentBoundarySession({
    sessionId,
    actorId,
  });

  const gravity = createBoundaryGravityService();

  const outOfScope = createBoundaryActionRequest({
    config,
    actionKind: "fs.write",
    target: path.join(outsideRoot, "blocked.txt"),
  });
  const outOfScopeResult = await gravity.enforceRequest({
    config,
    request: outOfScope,
  });
  assert(
    outOfScopeResult.outcome === "bodyguard_grant_offer",
    "expected out-of-scope request to yield a Bodyguard grant offer",
  );
  assert(
    outOfScopeResult.bodyguardMoves.some((move) => move.kind === "open_as_law"),
    "expected open_as_law Bodyguard move",
  );

  const authorityClaim = createBoundaryActionRequest({
    config,
    actionKind: "fs.write",
    target: path.join(scopedRoot, "authority.txt"),
    provenance: "agent_inference",
    flags: {
      authorityClaimed: true,
    },
  });
  const authorityResult = await gravity.enforceRequest({
    config,
    request: authorityClaim,
  });
  assert(authorityResult.outcome === "deny", "expected authority claim to be denied");

  const malformedContact = await evaluateBoundaryGravityEvent({
    config,
    event: {
      kind: "ProposalReceived",
      ts: Date.now(),
      proposal: {
        kind: "tool_exec",
        payload: {
          scopeIdentifier: "   ",
          scopeKind: "tool",
          actionLabel: "run",
          requestId: "malformed-contact",
        },
        provenance: {
          source: "trusted_user",
          sessionId,
        },
      },
    },
  });
  assert(
    malformedContact.result.decision === "deny",
    "expected malformed contact proposal to be denied",
  );
  assert(
    malformedContact.lawIds.includes(META_CONTACT_01),
    "expected META.CONTACT.01 to trigger on malformed contact",
  );

  const untrustedLawUpdate = await evaluateBoundaryGravityEvent({
    config,
    event: {
      kind: "ProposalReceived",
      ts: Date.now(),
      proposal: {
        kind: "law_update",
        payload: {
          scopeIdentifier: "global:upl-import",
          scopeKind: "other",
          actionLabel: "update law",
          requestId: "untrusted-law-update",
        },
        provenance: {
          source: "agent_inference",
          sessionId,
          originId: "untrusted-law-update",
        },
      },
    },
  });
  assert(
    untrustedLawUpdate.result.decision === "deny",
    "expected untrusted law update proposal to be denied",
  );
  assert(
    untrustedLawUpdate.lawIds.includes(META_CONTINUATION_01),
    "expected META.CONTINUATION.01 to trigger on untrusted law update",
  );

  await assertBoundaryGravityLawUpdateAllowed({
    config,
    requestId: "trusted-law-update",
    target: "global:upl-import",
    reason: "trusted compiled law activation",
    provenance: "trusted_system",
  });

  const incompleteRestore = await evaluateBoundaryGravityEvent({
    config,
    event: {
      kind: "SessionRestored",
      ts: Date.now(),
      sessionId,
    },
    ledgerOverride: {
      sessionTraceComplete: false,
      requestTraceComplete: true,
    },
  });
  assert(
    incompleteRestore.result.decision === "deny",
    "expected incomplete restore trace to be denied",
  );
  assert(
    incompleteRestore.lawIds.includes(META_CONTINUATION_01),
    "expected META.CONTINUATION.01 to trigger on incomplete restore",
  );

  const throwingSkill: LawSkill = {
    id: "TEST.GRAVITY.THROW.01",
    validate() {
      throw new Error("validate boom");
    },
    normalize(state) {
      return state;
    },
  };
  const throwingEvent: GravityEvent = {
    kind: "ProposalReceived",
    ts: Date.now(),
    proposal: {
      kind: "other",
      payload: {
        scopeIdentifier: "gravity:test",
        scopeKind: "other",
        actionLabel: "observe",
        requestId: "throwing-skill",
      },
      provenance: {
        source: "trusted_system",
        sessionId,
        originId: "throwing-skill",
      },
    },
  };
  const failClosed = evaluateGravityEvent({
    state: createContractGravityState(sessionId, actorId),
    event: throwingEvent,
    skills: [throwingSkill],
  });
  assert(failClosed.result.decision === "deny", "expected throwing gravity skill to fail closed");
  assert(
    failClosed.result.violations.some((entry) => entry.code === "LAW_SKILL_VALIDATE_ERROR"),
    "expected validate error violation to be recorded",
  );

  config = {
    ...config,
    session: {
      ...config.session,
      sessionId: `${sessionId}-broken`,
    },
  };
  const brokenLedger = createBoundaryActionRequest({
    config,
    actionKind: "fs.write",
    target: path.join(scopedRoot, "broken-ledger.txt"),
  });
  const brokenLedgerResult = await gravity.enforceRequest({
    config,
    request: brokenLedger,
  });
  assert(
    brokenLedgerResult.outcome === "bodyguard_grant_offer",
    "expected missing ledger history not to become a live authorization deny",
  );

  console.log("Agent Buccet gravity contract");
  console.log(`out-of-scope outcome: ${outOfScopeResult.outcome}`);
  console.log(`authority claim outcome: ${authorityResult.outcome}`);
  console.log(`malformed contact: ${malformedContact.result.decision}`);
  console.log(`untrusted law update: ${untrustedLawUpdate.result.decision}`);
  console.log("trusted law update: allowed");
  console.log(`incomplete restore: ${incompleteRestore.result.decision}`);
  console.log(`throwing skill fail closed: ${failClosed.result.decision}`);
  console.log(`missing ledger history outcome: ${brokenLedgerResult.outcome}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
