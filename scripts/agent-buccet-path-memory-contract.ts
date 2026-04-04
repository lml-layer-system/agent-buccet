import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  advanceBuccetFormation,
  BuccetPathMemoryStore,
  canInstantiateBuccetFormation,
  classifyBuccetPathRequest,
  createBuccetPathLibrary,
  createBuccetPathTemplate,
  createDefaultBuccetPathLibrary,
  detectBuccetPathSwitch,
  describeBuccetFormationLiveView,
  ensureBuccetPathInLibrary,
  getBuccetPathTemplate,
  getCurrentBuccetStageAgents,
  getCurrentBuccetStage,
  hasBuccetPath,
  instantiateBuccetFormation,
  loadBuccetPathMemorySnapshot,
  renderBuccetFormationLiveView,
  saveBuccetPathMemorySnapshot,
  switchBuccetFormation,
} from "../lib/agent-buccet/index.ts";

async function main() {
  const library = createDefaultBuccetPathLibrary();
  assert.equal(classifyBuccetPathRequest("search the web for boundary docs"), "search", "expected search classification");
  assert.equal(classifyBuccetPathRequest("write code and run tests"), "coding", "expected coding classification");
  assert.equal(classifyBuccetPathRequest("send this on telegram"), "messaging", "expected messaging classification");
  assert.equal(hasBuccetPath(library, "search"), true, "expected exact path existence check");
  assert.equal(hasBuccetPath(library, "finance"), false, "expected unknown path to stay absent");
  assert.equal(canInstantiateBuccetFormation({ library, pathName: "search" }), true, "expected exact path instantiation check");
  assert.equal(canInstantiateBuccetFormation({ library, pathName: "finance" }), true, "expected exact path miss to stay instantiable");
  assert.equal(canInstantiateBuccetFormation({ library, pathName: "   " }), false, "expected blank path to fail instantiation");
  assert.equal(getBuccetPathTemplate(library, "search")?.pathName, "search", "expected exact path template lookup");
  const financeTemplate = ensureBuccetPathInLibrary({
    library,
    pathName: "finance",
    userRequest: "build a finance report",
  });
  assert.equal(financeTemplate.pathName, "finance", "expected missing path to materialize");
  assert.equal(hasBuccetPath(library, "finance"), true, "expected missing path to lock into library");
  assert.equal(financeTemplate.stages.at(-1)?.terminal, true, "expected auto-created path to stay finite");
  assert.equal(financeTemplate.agentRoster.length, 3, "expected auto-created path specialist roster");
  assert.match(
    renderBuccetFormationLiveView(instantiateBuccetFormation({
      sessionId: "session-finance-path",
      userRequest: "build a finance report",
      pathName: "finance",
      library,
    })),
    /path=finance/,
    "expected live view for auto-created path",
  );
  assert.match(
    renderBuccetFormationLiveView(instantiateBuccetFormation({
      sessionId: "session-finance-path",
      userRequest: "build a finance report",
      pathName: "finance",
      library,
    })),
    /path_lawful_action_kinds=runtime_resolved/,
    "expected runtime-resolved lawful surface for auto-created path",
  );

  let formation = instantiateBuccetFormation({
    sessionId: "session-path-memory",
    userRequest: "search the web for boundary docs",
    pathName: "search",
    library,
  });

  assert.equal(formation.pathName, "search", "expected search formation");
  assert.equal(formation.domain, "search_retrieval", "expected search domain label");
  assert.equal(formation.status, "RUNNING", "expected running formation");
  assert.equal(getCurrentBuccetStage(formation)?.id, "query", "expected first stage active");
  assert.equal(formation.agentRoster.length, 5, "expected explicit search specialist roster");
  assert.deepEqual(
    getCurrentBuccetStageAgents(formation).map((agent) => agent.id),
    ["query-framer"],
    "expected first search stage ownership",
  );
  assert.ok(
    formation.stages.every((stage) => stage.agentIds.length > 0),
    "expected every stage to have assigned agents",
  );
  assert.ok(
    library.search.stages.some((stage) => stage.agentIds.length > 1),
    "expected at least one multi-agent search stage",
  );
  assert.ok(
    library.coding.stages.some((stage) => stage.agentIds.length > 1),
    "expected at least one multi-agent coding stage",
  );

  const seenIndexes = [formation.currentStageIndex];
  while (formation.status === "RUNNING") {
    const stage = getCurrentBuccetStage(formation);
    assert(stage, "expected active stage while formation is running");
    formation = advanceBuccetFormation({
      state: formation,
      result: stage.terminal ? "complete" : "success",
      output: {
        [`${stage.id}_done`]: true,
        ...(stage.terminal ? { final_output: "boundary docs summary" } : {}),
      },
      reason: `${stage.id} finished`,
    });
    seenIndexes.push(formation.currentStageIndex);
  }

  assert.equal(formation.status, "COMPLETED", "expected formation to terminate cleanly");
  assert.ok(
    formation.agentRoster.every((agent) => agent.completedStageIds.length > 0 || agent.status === "COMPLETED"),
    "expected specialist agents to preserve completed stage history",
  );
  assert.equal(formation.context.final_output, "boundary docs summary", "expected terminal output");
  assert.ok(seenIndexes.every((value, index) => index === 0 || value >= seenIndexes[index - 1]), "expected forward-only stage indexes");
  assert.ok(seenIndexes[seenIndexes.length - 1] === formation.stages.length, "expected completed formation to advance to terminal index");

  assert.throws(
    () => advanceBuccetFormation({ state: formation, result: "success" }),
    /cannot advance terminal formation/,
    "expected terminal formation to reject re-entry",
  );

  const midFormation = advanceBuccetFormation({
    state: instantiateBuccetFormation({
      sessionId: "session-path-memory",
      userRequest: "research agent containment tradeoffs",
      pathName: "research",
      library,
    }),
    result: "success",
    output: { scope_done: true },
  });

  const switchDecision = detectBuccetPathSwitch({
    state: midFormation,
    newRequest: "send this to telegram",
    nextPathName: "messaging",
    library,
  });
  assert.equal(switchDecision.shouldSwitch, true, "expected path switch");
  assert.equal(switchDecision.nextPathName, "messaging", "expected messaging switch target");

  const switched = switchBuccetFormation({
    state: midFormation,
    newRequest: "send this to telegram",
    nextPathName: "messaging",
    library,
  });
  assert.equal(switched.pathName, "messaging", "expected switched formation path");
  assert.equal(switched.domain, "communication", "expected switched path domain");
  assert.equal(switched.previousPathName, "research", "expected previous path tracking");
  assert.equal(switched.context.previous_formation_id, midFormation.formationId, "expected previous formation memory");
  assert.equal(
    (switched.context.previous_context as Record<string, unknown>).scope_done,
    true,
    "expected previous context transfer",
  );
  assert.ok(
    switched.agentRoster.some((agent) => agent.id === "delivery-operator"),
    "expected messaging specialist roster after switch",
  );

  const customLibrary = createBuccetPathLibrary({
    templates: [{
      pathName: "brand-studio",
      domain: "creative_brand_ops",
      title: "Brand Studio Path",
      summary: "Large specialist swarm for brand asset production.",
      modelHint: "claude-sonnet",
      laws: ["brand", "design", "safety"],
      tools: ["fs.write", "chat.emit"],
      uplBindings: [
        { actionKinds: ["fs.write"], targets: ["brand-assets"] },
        { actionKinds: ["chat.emit"], targets: ["chat:primary"] },
      ],
      agentRoster: [
        { id: "brief-reader", title: "Brief Reader", specialty: "brief intake", uplBindings: [{ actionKinds: ["chat.emit"], targets: ["chat:primary"] }] },
        { id: "brand-strategist", title: "Brand Strategist", specialty: "brand direction", uplBindings: [{ actionKinds: ["chat.emit"], targets: ["chat:primary"] }] },
        { id: "copywriter", title: "Copywriter", specialty: "copy", uplBindings: [{ actionKinds: ["fs.write"], targets: ["brand-assets"] }] },
        { id: "art-director", title: "Art Director", specialty: "visual direction", uplBindings: [{ actionKinds: ["fs.write"], targets: ["brand-assets"] }] },
        { id: "layout-designer", title: "Layout Designer", specialty: "layout", uplBindings: [{ actionKinds: ["fs.write"], targets: ["brand-assets"] }] },
        { id: "qa-reviewer", title: "QA Reviewer", specialty: "quality review", uplBindings: [{ actionKinds: ["chat.emit"], targets: ["chat:primary"] }] },
        { id: "delivery-packer", title: "Delivery Packer", specialty: "delivery packaging", uplBindings: [{ actionKinds: ["fs.write"], targets: ["brand-assets"] }] },
      ],
      stages: [
        { id: "brief", title: "Brief", purpose: "Read the brief.", agentIds: ["brief-reader"] },
        { id: "direction", title: "Direction", purpose: "Set brand direction.", agentIds: ["brand-strategist", "art-director"] },
        { id: "draft", title: "Draft", purpose: "Draft copy and layouts.", agentIds: ["copywriter", "layout-designer"], uplBindings: [{ actionKinds: ["fs.write"], targets: ["brand-assets"] }] },
        { id: "qa", title: "QA", purpose: "Review the package.", agentIds: ["qa-reviewer", "brand-strategist"] },
        { id: "deliver", title: "Deliver", purpose: "Package the final result.", agentIds: ["delivery-packer"], terminal: true, uplBindings: [{ actionKinds: ["fs.write"], targets: ["brand-assets"] }] },
      ],
    }],
  });

  const customFormation = instantiateBuccetFormation({
    sessionId: "session-custom-path",
    userRequest: "build a brand package",
    pathName: "brand-studio",
    library: customLibrary,
  });
  assert.equal(customFormation.domain, "creative_brand_ops", "expected arbitrary custom domain");
  assert.equal(customFormation.agentRoster.length, 7, "expected arbitrary specialist swarm size");
  const liveView = describeBuccetFormationLiveView(customFormation);
  assert.equal(liveView.pathAgentCount, 7, "expected live view to expose full swarm count");
  assert.equal(liveView.currentStageId, "brief", "expected live view current stage");
  assert.ok(liveView.steps.some((step) => step.agentIds.length > 1), "expected multi-agent stage in live view");
  assert.ok(liveView.pathLawfulActionKinds.includes("fs.write"), "expected live view lawful binding surface");
  const rendered = renderBuccetFormationLiveView(customFormation);
  assert.match(rendered, /domain=creative_brand_ops/, "expected rendered live view to show domain");
  assert.match(rendered, /path_agent_count=7/, "expected rendered live view to show agent count");
  assert.match(rendered, /owners=Brand Strategist \+ Art Director/, "expected rendered live view to show specialist ownership");
  const autoCreatedCustomTemplate = createBuccetPathTemplate({
    pathName: "tax-ops",
    userRequest: "prepare tax workflow",
    draft: {
      domain: "finance_operations",
      agentRoster: [
        { id: "tax-intake", title: "Tax Intake", specialty: "tax intake", uplBindings: [{ actionKinds: [], targets: [] }] },
        { id: "tax-specialist", title: "Tax Specialist", specialty: "tax workflow", uplBindings: [{ actionKinds: [], targets: [] }] },
        { id: "tax-witness", title: "Tax Witness", specialty: "tax result witness", uplBindings: [{ actionKinds: [], targets: [] }] },
      ],
      stages: [
        { id: "intake", title: "Intake", purpose: "Intake tax request.", agentIds: ["tax-intake"], uplBindings: [{ actionKinds: [], targets: [] }] },
        { id: "execute", title: "Execute", purpose: "Run tax workflow.", agentIds: ["tax-specialist"], uplBindings: [{ actionKinds: [], targets: [] }] },
        { id: "finalize", title: "Finalize", purpose: "Finalize tax workflow.", agentIds: ["tax-witness"], uplBindings: [{ actionKinds: [], targets: [] }], terminal: true },
      ],
    },
  });
  const autoLibrary = createBuccetPathLibrary({ includeDefaults: false });
  const lockedTaxTemplate = ensureBuccetPathInLibrary({
    library: autoLibrary,
    pathName: "tax-ops",
    userRequest: "prepare tax workflow",
    draft: autoCreatedCustomTemplate,
  });
  assert.equal(lockedTaxTemplate.domain, "finance_operations", "expected auto-created custom domain");
  assert.equal(hasBuccetPath(autoLibrary, "tax-ops"), true, "expected tax path to lock into custom library");

  const store = new BuccetPathMemoryStore();
  store.remember(formation);
  store.remember(switched);
  store.remember(customFormation);
  assert.equal(store.list().length, 3, "expected remembered formations");
  assert.equal(store.findBySessionAndPath("session-path-memory", "messaging")?.formationId, switched.formationId, "expected path lookup");

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-path-memory-"));
  try {
    const snapshotPath = path.join(tempRoot, "path-memory.json");
    await saveBuccetPathMemorySnapshot(snapshotPath, store.snapshot());
    const loaded = await loadBuccetPathMemorySnapshot(snapshotPath);
    assert(loaded, "expected path memory snapshot to load");
    assert.equal(loaded.formations.length, 3, "expected persisted formation count");
    assert.equal(loaded.formations[1]?.pathName, "messaging", "expected switched path to persist");
    assert.equal(loaded.formations[2]?.pathName, "brand-studio", "expected custom path to persist");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }

  console.log("Agent Buccet path memory contract");
  console.log(`templates: ${Object.keys(library).length}`);
  console.log(`completed search steps: ${formation.stages.length}`);
  console.log(`switch target: ${switched.pathName}`);
  console.log(`store size: ${store.list().length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
