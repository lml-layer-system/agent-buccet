import assert from "node:assert/strict";
import {
  benchmarkBuccetSystemSnap,
  BUCCET_CONSEQUENCE_BOUNDARIES,
  BUCCET_SUBSTRATE_PLANES,
  BUCCET_SYSTEM_NODES,
  BUCCET_TERMINALS,
  snapBuccetSystem,
} from "../lib/agent-buccet/system-substrate.ts";

async function main() {
  const substrate = snapBuccetSystem();

  assert.equal(substrate.systemGraph.nodes.length, BUCCET_SYSTEM_NODES.length, "expected full system graph node count");
  assert.equal(Object.keys(substrate.planes).length, BUCCET_SUBSTRATE_PLANES.length, "expected six substrate planes");
  assert.equal(Object.keys(substrate.terminals).length, BUCCET_TERMINALS.length, "expected three terminals");
  assert.equal(substrate.consequenceBoundaries.length, BUCCET_CONSEQUENCE_BOUNDARIES.length, "expected four consequence boundaries");
  assert.equal(substrate.orphanedNodes.length, 0, "expected lossless substrate snap with no orphaned nodes");
  assert.equal(substrate.isLossless, true, "expected lossless substrate snap");
  assert.equal(substrate.compression.nodeCount, BUCCET_SYSTEM_NODES.length, "expected full compression node count");
  assert.equal(substrate.compression.planeCount, BUCCET_SUBSTRATE_PLANES.length, "expected plane count in compression report");
  assert.ok(substrate.compression.ratio > 4, "expected real compression ratio greater than 4:1");

  assert.ok(substrate.planes.ControlPlane.includes("track_extractor"), "expected Track Extractor in ControlPlane");
  assert.ok(substrate.planes.AuthorityPlane.includes("upl"), "expected UPL in AuthorityPlane");
  assert.ok(substrate.planes.TranslationPlane.includes("intercept"), "expected intercept in TranslationPlane");
  assert.ok(substrate.planes.WitnessPlane.includes("ledger"), "expected ledger in WitnessPlane");
  assert.deepEqual(substrate.terminals.Terminal1.planes, ["TranslationPlane", "BoundaryPlane"], "expected Terminal1 front-line posture");

  const benchmark = benchmarkBuccetSystemSnap();
  assert.equal(benchmark.last.isLossless, true, "expected benchmark snap to stay lossless");
  assert.ok(benchmark.avgMs < 10, `expected average system snap below 10ms, got ${benchmark.avgMs.toFixed(6)}ms`);

  console.log("Agent Buccet system substrate contract");
  console.log(`lossless: ${substrate.isLossless}`);
  console.log(`nodes: ${substrate.compression.nodeCount}`);
  console.log(`planes: ${substrate.compression.planeCount}`);
  console.log(`compression ratio: ${substrate.compression.ratio}:1`);
  console.log(`avg snap time (ms): ${benchmark.avgMs.toFixed(6)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
