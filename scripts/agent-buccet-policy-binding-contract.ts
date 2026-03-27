import assert from "node:assert/strict";
import {
  bindPolicySourcesIntoConfig,
  createBoundaryBodyguard,
  createPersistentBoundaryRuntimeStore,
  loadUserPathLedger,
  saveUserPathLedger,
} from "../lib/agent-buccet/index.ts";

async function main() {
  const originalLedger = await loadUserPathLedger();

  try {
    await saveUserPathLedger({
      specVersion: 1,
      userApprovedLawPaths: [],
      userDeniedLawPaths: [],
    });

    const sessionId = `agent-buccet-policy-binding-${Date.now()}`;
    const actorId = "user:policy-binding-contract";
    const store = await createPersistentBoundaryRuntimeStore({
      sessionId,
      actorId,
    });

    const config = await bindPolicySourcesIntoConfig({
      config: store.getConfig(),
      witness: {
        META: {
          id: "policy-binding-witness",
          timestamp: new Date().toISOString(),
          actor: actorId,
        },
      } as never,
      bindings: [
        {
          sourceKind: "guardrail",
          type: "DENIED",
          requestBasis: {
            actionKind: "chat.emit",
            target: "chat://output",
            payloadSummary: "Guardrail blocks spoilers",
            reviewContext: {
              surface: "chat",
              invariantLawId: "UPL.POLICY.GUARDRAIL.SPOILERS",
              invariantLabel: "Guardrail spoiler block",
            },
          },
          trackConstraint: {
            allowedActionKinds: ["chat.emit"],
            reviewSurface: "chat",
            reviewInvariantLawId: "UPL.POLICY.GUARDRAIL.SPOILERS",
            forbiddenTextPatterns: ["spoilers"],
            outputCorridor: {
              forbiddenTextPatterns: ["spoilers"],
            },
            description: "guardrail deny spoilers",
          },
        },
        {
          sourceKind: "regulator_business",
          type: "APPROVED",
          requestBasis: {
            actionKind: "fs.write",
            target: "/tmp/policy-binding/rail/allowed.txt",
            payloadSummary: "Business policy rail for generated reports",
          },
          trackConstraint: {
            allowedActionKinds: ["fs.write"],
            targetPattern: "/tmp/policy-binding/rail",
            targetMatchMode: "prefix",
            actionCorridor: {
              allowedActionKinds: ["fs.write"],
              targetPattern: "/tmp/policy-binding/rail",
              targetMatchMode: "prefix",
            },
            description: "business write rail",
          },
        },
      ],
    });
    store.replaceConfig(config);
    const bodyguard = createBoundaryBodyguard(store);

    const spoilerBlocked = await bodyguard.chat.emit({
      userInput: "summarize without spoilers",
      attemptedOutput: "Batman spoilers summary",
      reviewContext: {
        surface: "chat",
        invariantLawId: "UPL.POLICY.GUARDRAIL.SPOILERS",
      },
      execute: async () => "should-not-run",
      successReason: "guardrail-bound chat output emitted",
    });
    assert.equal(spoilerBlocked.allowed, false, "expected guardrail-bound law to block spoilers on contact");

    const compliantWrite = await bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: "/tmp/policy-binding/rail/report.txt",
      payloadSummary: "write inside regulator/business rail",
      execute: async () => "ok",
      successReason: "business rail write admitted",
    });
    assert.equal(compliantWrite.allowed, true, "expected regulator/business binding to allow in-rail write");

    const escapedWrite = await bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: "/tmp/policy-binding/outside.txt",
      payloadSummary: "write outside regulator/business rail",
      execute: async () => "should-not-run",
      successReason: "business rail write admitted",
    });
    assert.equal(escapedWrite.allowed, false, "expected regulator/business binding to block out-of-rail write");

    console.log("Agent Buccet policy binding contract");
    console.log(`guardrail deny on contact: ${!spoilerBlocked.allowed}`);
    console.log(`business rail allow: ${compliantWrite.allowed}`);
    console.log(`business rail escape blocked: ${!escapedWrite.allowed}`);
  } finally {
    await saveUserPathLedger(originalLedger);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
