import assert from "node:assert/strict";
import {
  BUCCET_CONSEQUENCE_BOUNDARIES,
  BUCCET_SUBSTRATE_PLANES,
  BUCCET_SYSTEM_NODES,
  BUCCET_TERMINALS,
  renderBuccetMetaEfueSubstrateProcessMarkdown,
  runBuccetMetaEfueSubstrateProcess,
} from "../lib/agent-buccet/index.ts";

async function main() {
  const process = runBuccetMetaEfueSubstrateProcess();
  const markdown = renderBuccetMetaEfueSubstrateProcessMarkdown(process);

  assert.ok(process.runtimeFacts.baseAcceptanceCount > 0, "expected acceptance side to be present in meta-EFUE process");
  assert.ok(process.runtimeFacts.baseDenialCount > 0, "expected denial side to be present in meta-EFUE process");
  assert.equal(process.runtimeFacts.defaultPathCount, 8, "expected default path library size");
  assert.equal(process.runtimeFacts.substrateNodeCount, BUCCET_SYSTEM_NODES.length, "expected full substrate node count");
  assert.equal(process.runtimeFacts.substratePlaneCount, BUCCET_SUBSTRATE_PLANES.length, "expected substrate plane count");
  assert.equal(process.runtimeFacts.substrateTerminalCount, BUCCET_TERMINALS.length, "expected terminal count");
  assert.equal(process.runtimeFacts.consequenceBoundaryCount, BUCCET_CONSEQUENCE_BOUNDARIES.length, "expected consequence boundary count");
  assert.equal(process.runtimeFacts.losslessCoverageCount, BUCCET_SYSTEM_NODES.length, "expected full node coverage in snapped body");
  assert.equal(process.runtimeFacts.orphanedNodeCount, 0, "expected no orphaned nodes in snapped body");
  assert.ok(process.runtimeFacts.repoArtifactCount > 0, "expected repo artifacts to be present in whole-body snap");
  assert.equal(process.runtimeFacts.repoSnapBodyCount, 9, "expected full repo snap body count");
  assert.equal(process.runtimeFacts.repoCoverageCount, process.runtimeFacts.repoArtifactCount, "expected full repo coverage in snapped body");
  assert.equal(process.runtimeFacts.repoOrphanedArtifactCount, 0, "expected no orphaned repo artifacts in snapped body");
  assert.ok(process.runtimeFacts.repoSnapCompressionRatio > 1, "expected real repo compression");
  assert.ok(process.runtimeFacts.repoSnapAvgMs < 10, `expected repo snap below 10ms, got ${process.runtimeFacts.repoSnapAvgMs.toFixed(6)}ms`);
  assert.equal(process.runtimeFacts.repoSnapDeterministic, true, "expected deterministic repeated repo snap");
  assert.ok(process.runtimeFacts.snapCompressionRatioToPlanes > 4, "expected strong node-to-plane compression");
  assert.ok(process.runtimeFacts.snapCompressionRatioToExecutableBody > 2, "expected real node-to-body compression");
  assert.ok(process.runtimeFacts.executableBodyCount > 0, "expected executable body primitive count");
  assert.ok(process.runtimeFacts.snapAvgMs < 10, `expected substrate snap below 10ms, got ${process.runtimeFacts.snapAvgMs.toFixed(6)}ms`);
  assert.ok(process.runtimeFacts.snapUnderTargetFactor > 1, "expected snap to beat the 10ms target");
  assert.equal(process.runtimeFacts.snapDeterministic, true, "expected deterministic repeated snap");
  assert.match(process.runtimeFacts.sameFunctionStatement, /same lawful consequence function/i, "expected same-function statement");
  assert.match(process.runtimeFacts.samePowerStatement, /same governing power/i, "expected same-power statement");
  assert.match(process.runtimeFacts.samePowerStatement, /repo artifacts/i, "expected repo-wide same-power statement");
  assert.match(process.runtimeFacts.newBodyStatement, /repo snap bodies/i, "expected new-body statement");
  assert.match(process.runtimeFacts.endToEndRuntimeStatement, /either UPL side/i, "expected explicit two-sided UPL growth statement");
  assert.match(process.runtimeFacts.endToEndRuntimeStatement, /end to end/i, "expected explicit end-to-end runtime statement");

  assert.equal(process.step1.infinite.length >= 6, true, "expected real infinite force surface");
  assert.equal(process.step1.finiteRequirements.length >= 10, true, "expected real finite requirement surface");
  assert.equal(process.step1.witnessPatterns.length >= 6, true, "expected real witness pattern surface");
  assert.equal(process.step2.formula, "S = I∞ ∩ F ∩ W", "expected formal collision formula");
  assert.match(process.step2.cardinality, /repo-and-runtime substrate/i, "expected whole-body cardinality");
  assert.match(process.step3.definition, /ExecutableFiniteSubstrate/, "expected finite substrate definition");
  assert.equal(process.step4.pseudocode.length, 8, "expected full executable collapse flow");
  assert.equal(process.step5.implementationSurface.length >= 6, true, "expected implementation surface");
  assert.equal(process.step7.proofSurface.length >= 5, true, "expected proof surface");

  assert.match(markdown, /## Step 1: Forces/, "expected step 1 in markdown");
  assert.match(markdown, /## Step 7: Verify Correctness/, "expected step 7 in markdown");
  assert.match(markdown, /UPL can keep growing/, "expected infinite growth result in markdown");
  assert.match(markdown, /the whole Buccet repo\/system can be snapped into one executable body/, "expected whole-repo snap result in markdown");
  assert.match(markdown, /measured snap avg:/, "expected measured performance in markdown");
  assert.match(markdown, /measured repo snap avg:/, "expected measured repo performance in markdown");
  assert.match(markdown, /### Exact Snap Result/, "expected explicit snap result section");
  assert.match(markdown, /Same function:/, "expected same-function result");
  assert.match(markdown, /Same power:/, "expected same-power result");
  assert.match(markdown, /New body:/, "expected new-body result");
  assert.match(markdown, /End-to-end runtime:/, "expected end-to-end runtime result");
  assert.match(markdown, /Compression: /, "expected explicit compression result");
  assert.match(markdown, /Deterministic: /, "expected deterministic result");
  assert.match(markdown, /UPL can keep growing on the acceptance side/, "expected explicit acceptance-side growth result");
  assert.match(markdown, /UPL can keep growing on the denial side/, "expected explicit denial-side growth result");
  assert.match(markdown, /repo snap compression:/, "expected repo compression result in markdown");

  console.log("Agent Buccet meta-EFUE substrate process contract");
  console.log(`acceptance entries: ${process.runtimeFacts.baseAcceptanceCount}`);
  console.log(`denial entries: ${process.runtimeFacts.baseDenialCount}`);
  console.log(`default paths: ${process.runtimeFacts.defaultPathCount}`);
  console.log(`substrate nodes: ${process.runtimeFacts.substrateNodeCount}`);
  console.log(`repo artifacts: ${process.runtimeFacts.repoArtifactCount}`);
  console.log(`compression to planes: ${process.runtimeFacts.snapCompressionRatioToPlanes}:1`);
  console.log(`compression to body: ${process.runtimeFacts.snapCompressionRatioToExecutableBody}:1`);
  console.log(`repo compression: ${process.runtimeFacts.repoSnapCompressionRatio}:1`);
  console.log(`avg snap time (ms): ${process.runtimeFacts.snapAvgMs.toFixed(6)}`);
  console.log(`avg repo snap time (ms): ${process.runtimeFacts.repoSnapAvgMs.toFixed(6)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
