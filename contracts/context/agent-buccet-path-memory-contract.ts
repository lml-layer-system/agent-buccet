import assert from "node:assert/strict";
import {
  instantiateBuccetFormation,
  UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE,
} from "./../../src/context/path-memory.ts";

async function main() {
  console.log("--- Agent Buccet Path Memory Contract ---");
  console.log("Verifying that the 'agent brain' is correctly injected into new formations...");

  // 1. Instantiate a new formation for a generic path.
  const formation = instantiateBuccetFormation({
    sessionId: "path-memory-contract-session",
    userRequest: "Test request",
    pathName: "general",
  });

  // 2. Assert that the Universal Agent Comprehension Process source exists.
  const brainSource = formation.pathSources.find(
    (source) => source.id === "base-agent-comprehension-process"
  );

  assert.ok(brainSource, "TEST FAILED: The 'Universal Agent Comprehension Process' source was not found in the formation's pathSources.");
  
  // 3. Assert that it is the very first source, indicating it's foundational.
  assert.equal(formation.pathSources[0].id, UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE.id, "TEST FAILED: The 'agent brain' source is not the first, foundational path source.");

  console.log("SUCCESS: 'Universal Agent Comprehension Process' is present as the first path source.");


  // 4. Verify that agents within the formation have access to the brain in their memory bank.
  const agentWithBrain = formation.agentRoster[0];
  assert.ok(agentWithBrain, "TEST FAILED: No agents found in roster.");

  const hasBrainInMempry = agentWithBrain.memoryBank.sourceIds.includes(UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE.id);
  assert.ok(hasBrainInMempry, "TEST FAILED: Agent's memoryBank does not include the 'agent brain' source.");

  console.log("SUCCESS: Agent's memoryBank correctly contains the 'agent brain' source.");


  console.log("\n--- Path Memory Contract Verified ---");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
