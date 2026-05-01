import assert from "node:assert/strict";

import {
  adjudicateMultiAgentCoherence,
  buildCoherenceClaimPacket,
} from "./../../src/teams/coherence-adjudication.ts";

function peer(args: {
  peerId: string;
  specialty: string;
  ownsStep: string;
  sourceIds: string[];
  output: string;
  status?: "completed" | "blocked";
}) {
  return {
    status: args.status ?? "completed",
    ...args,
  };
}

async function main(): Promise<void> {
  console.log("--- Agent Buccet Coherence Adjudication Contract ---");

  {
    const peers = [
      peer({
        peerId: "a",
        specialty: "implementation",
        ownsStep: "transform",
        sourceIds: ["src"],
        output: [
          "result_kind: analysis",
          "claim: release the patch immediately",
          "evidence: none",
          "confidence: 0.92",
          "independence: correlated",
          "user_law_relation: aligned",
          "constraints_affected: safety",
          "contradictions: none",
          "test_status: untested",
          "risk_level: high",
          "proposed_disposition: Accept",
          "sources_used: src",
          "specialist_findings:",
          "The patch looks fine.",
        ].join("\n"),
      }),
      peer({
        peerId: "b",
        specialty: "implementation",
        ownsStep: "transform",
        sourceIds: ["src"],
        output: [
          "result_kind: analysis",
          "claim: release the patch immediately",
          "evidence: none",
          "confidence: 0.88",
          "independence: correlated",
          "user_law_relation: aligned",
          "constraints_affected: safety",
          "contradictions: none",
          "test_status: untested",
          "risk_level: high",
          "proposed_disposition: Accept",
          "sources_used: src",
          "specialist_findings:",
          "Same conclusion.",
        ].join("\n"),
      }),
      peer({
        peerId: "c",
        specialty: "security",
        ownsStep: "validate",
        sourceIds: ["src", "threat-model"],
        output: [
          "result_kind: validation",
          "claim: block release until exploit path is closed",
          "evidence: exploit reproducer; threat model; validation trace",
          "confidence: 0.96",
          "independence: independent",
          "user_law_relation: aligned",
          "constraints_affected: safety,security",
          "contradictions: release claim ignores exploit path",
          "test_status: verified",
          "risk_level: critical",
          "proposed_disposition: BlockFinalization",
          "sources_used: src, threat-model",
          "specialist_findings:",
          "A reproducible exploit path exists.",
        ].join("\n"),
      }),
    ];

    const adjudication = adjudicateMultiAgentCoherence({
      peers,
      userRequest: "Ship the patch safely.",
    });

    assert.equal(adjudication.dissentBeatsMajority, true, "stronger dissent should outrank majority");
    assert.equal(adjudication.disposition, "BlockFinalization", "critical validated dissent should block finalization");
    assert.equal(adjudication.strongestPacket?.peerId, "c", "security dissent should win coherence");
    console.log("SUCCESS: stronger dissent outranks majority agreement.");
  }

  {
    const peers = [
      peer({
        peerId: "a",
        specialty: "research",
        ownsStep: "acquire_knowledge",
        sourceIds: ["docs"],
        output: [
          "result_kind: research",
          "claim: the dependency API has parameter X",
          "evidence: docs snapshot; source citation",
          "confidence: 0.81",
          "independence: mixed",
          "user_law_relation: aligned",
          "constraints_affected: scope",
          "contradictions: none",
          "test_status: tested",
          "risk_level: low",
          "proposed_disposition: Accept",
          "sources_used: docs",
          "specialist_findings:",
          "The docs agree on parameter X.",
        ].join("\n"),
      }),
      peer({
        peerId: "b",
        specialty: "validation",
        ownsStep: "validate",
        sourceIds: ["docs", "tests"],
        output: [
          "result_kind: validation",
          "claim: the dependency API has parameter X",
          "evidence: docs snapshot; integration test",
          "confidence: 0.84",
          "independence: mixed",
          "user_law_relation: aligned",
          "constraints_affected: scope",
          "contradictions: none",
          "test_status: verified",
          "risk_level: low",
          "proposed_disposition: Accept",
          "sources_used: docs, tests",
          "specialist_findings:",
          "Validated successfully.",
        ].join("\n"),
      }),
    ];

    const adjudication = adjudicateMultiAgentCoherence({
      peers,
      userRequest: "Describe the API accurately.",
    });

    assert.equal(adjudication.disposition, "Accept", "verified aligned agreement should pass");
    assert.equal(adjudication.finalizationBlocked, false, "clean coherent agreement should finalize");
    assert.deepEqual(adjudication.selectedPeerIds.sort(), ["a", "b"], "accepted majority group should remain selected");
    console.log("SUCCESS: coherent agreement passes finalization.");
  }

  {
    const rawPeer = peer({
      peerId: "parser",
      specialty: "validation",
      ownsStep: "validate",
      sourceIds: ["docs", "tests"],
      output: [
        "result_kind: validation",
        "claim: block until test evidence is attached",
        "evidence: integration test",
        "confidence: 0.75",
        "independence: mixed",
        "user_law_relation: aligned",
        "constraints_affected: safety,budget",
        "contradictions: none",
        "test_status: tested",
        "risk_level: medium",
        "proposed_disposition: RequestEvidence",
        "sources_used: docs, tests",
        "specialist_findings:",
        "The output is incomplete without attached evidence.",
        "assumptions:",
        "Upstream packet omitted screenshots.",
      ].join("\n"),
    });
    const packet = buildCoherenceClaimPacket({ peer: rawPeer, peers: [rawPeer] });
    assert.equal(packet.claim, "block until test evidence is attached");
    assert.equal(packet.proposedDisposition, "RequestEvidence");
    assert.equal(packet.evidence.length, 1);
    console.log("SUCCESS: structured peer packets parse into coherence claim packets.");
  }

  console.log("\n--- Coherence Adjudication Contract Verified ---");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
