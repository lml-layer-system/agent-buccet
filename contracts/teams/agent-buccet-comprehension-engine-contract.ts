import assert from "node:assert/strict";

import {
  AGENT_COMPREHENSION_STAGE_SEQUENCE,
  allowedActionKindsForComprehensionStage,
  allowedOutputsForComprehensionStage,
  buildInitialComprehensionPass,
  recordComprehensionRender,
  recordComprehensionReturn,
  recordComprehensionTransform,
  recordComprehensionValidation,
} from "./../../src/teams/agent-comprehension-engine.ts";

async function main(): Promise<void> {
  console.log("--- Agent Buccet Comprehension Engine Contract ---");

  const pass = buildInitialComprehensionPass({
    teamId: "gemini-demo",
    requestedBy: "team-run:gemini-demo",
    userRequest: "Review the codebase and return a safe summary.",
    wholeViewPrepared: true,
    sourceCount: 4,
    checkpointedSourceCount: 2,
    totalLineCount: 2400,
    packetCount: 3,
    projectionCount: 12,
    spokespersonAgentId: "spokes",
    peers: [
      { id: "research", specialty: "repo mapping", ownsStep: "acquire_knowledge" },
      { id: "builder", specialty: "implementation", ownsStep: "transform" },
      { id: "safety", specialty: "risk review", ownsStep: "validate" },
      { id: "spokes", specialty: "group spokesperson", ownsStep: "render" },
    ],
  });

  assert.deepEqual(pass.stages.map((stage) => stage.id), AGENT_COMPREHENSION_STAGE_SEQUENCE);
  assert.equal(pass.method, "whole-view-fracture-specialist-team");
  assert.equal(pass.stages[5]?.id, "acquire_knowledge");
  assert.equal(pass.stages[5]?.status, "completed", "prepared whole-view completes knowledge acquisition stage");
  assert.ok(pass.stages[5]?.outputs.some((line) => line.includes("12 projection handles")));
  console.log("SUCCESS: initial pass builds the canonical engine and completes map preparation before peer work.");

  const afterTransform = recordComprehensionTransform(pass, {
    peerSummaries: [
      { peerId: "research", ownsStep: "acquire_knowledge", resultKind: "analysis", status: "completed" },
      { peerId: "builder", ownsStep: "transform", resultKind: "analysis", status: "completed" },
    ],
  });
  assert.equal(afterTransform.stages[6]?.status, "completed");
  assert.ok(afterTransform.stages[6]?.outputs.some((line) => line.includes("builder:transform:analysis:completed")));

  const afterValidation = recordComprehensionValidation(afterTransform, {
    disposition: "Accept",
    truthCoherent: true,
    intentCoherent: true,
    executionCoherent: true,
    reasons: ["Agreement and evidence passed the coherence gate."],
    finalizationBlocked: false,
  });
  assert.equal(afterValidation.stages[7]?.status, "completed");
  assert.ok(afterValidation.stages[7]?.outputs.some((line) => line.includes("truth:yes")));

  const afterRender = recordComprehensionRender(afterValidation, {
    blocked: false,
    spokesperson: "spokes",
    outputPreview: "Grouped answer preview",
  });
  const finalPass = recordComprehensionReturn(afterRender, {
    blocked: false,
    outputPreview: "Grouped answer preview",
  });
  assert.equal(finalPass.stages[8]?.status, "completed");
  assert.equal(finalPass.stages[9]?.status, "completed");
  console.log("SUCCESS: transform, validate, render, and return stage records advance explicitly.");

  assert.deepEqual(allowedOutputsForComprehensionStage("render"), ["render-fragment", "answer-fragment", "blocked"]);
  assert.deepEqual(allowedActionKindsForComprehensionStage("transform"), ["fs.read", "fs.write", "tool.exec"]);
  assert.ok(allowedActionKindsForComprehensionStage("all").includes("chat.emit"));
  console.log("SUCCESS: shared stage contracts drive outputs and action permissions.");

  const spendPass = buildInitialComprehensionPass({
    teamId: "spend-demo",
    requestedBy: "team-run:spend-demo",
    userRequest: "Buy the approved cloud credits within budget.",
    wholeViewPrepared: true,
    sourceCount: 2,
    checkpointedSourceCount: 1,
    totalLineCount: 240,
    packetCount: 1,
    projectionCount: 4,
    spokespersonAgentId: "spokes",
    valueBoundaryRequired: true,
    peers: [
      { id: "spender", specialty: "bounded spend", ownsStep: "transform" },
      { id: "spokes", specialty: "group spokesperson", ownsStep: "render" },
    ],
  });
  assert.deepEqual(
    spendPass.stages.map((stage) => stage.id),
    [
      "receive",
      "represent",
      "infer_intent",
      "bind_constraints",
      "select_method",
      "acquire_knowledge",
      "transform",
      "validate",
      "value_boundary",
      "render",
      "return",
    ],
    "spend teams insert the hardcoded value boundary before render/return",
  );
  assert.deepEqual(allowedActionKindsForComprehensionStage("value_boundary"), ["fs.read", "agent.spend"]);
  console.log("SUCCESS: spend teams expose the hardcoded value-boundary stage in the engine.");

  console.log("\n--- Comprehension Engine Contract Verified ---");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
