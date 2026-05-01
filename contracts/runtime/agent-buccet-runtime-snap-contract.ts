import assert from "node:assert/strict";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  ACTIVE_DENIAL_CATALOG_SNAP_RELATIVE_PATH,
  ACTIVE_RUNTIME_MUSCLE_RELATIVE_PATH,
  buildDenialCatalogSnap,
  buildRuntimeMuscleArtifact,
  loadActiveLawBodySource,
} from "./../../scripts/agent-buccet-runtime-snap-shared.ts";

const repoRoot = process.cwd();

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(repoRoot, relativePath), "utf8")) as T;
}

async function main() {
  const source = await loadActiveLawBodySource(repoRoot);
  const expectedRuntimeMuscle = buildRuntimeMuscleArtifact({
    sourceRows: source.sourceRows,
    sourceRaw: source.sourceRaw,
    sourceManifest: source.manifest,
  });
  const expectedDenialSnap = buildDenialCatalogSnap({
    sourceRows: source.sourceRows,
    sourceRaw: source.sourceRaw,
    sourceManifest: source.manifest,
  });

  const actualRuntimeMuscle = await readJson<typeof expectedRuntimeMuscle>(ACTIVE_RUNTIME_MUSCLE_RELATIVE_PATH);
  const actualDenialSnap = await readJson<typeof expectedDenialSnap>(ACTIVE_DENIAL_CATALOG_SNAP_RELATIVE_PATH);

  assert.deepEqual(
    actualRuntimeMuscle,
    expectedRuntimeMuscle,
    "runtime-muscle snap is stale; rerun render-agent-buccet-runtime-snaps.ts",
  );
  assert.deepEqual(
    actualDenialSnap,
    expectedDenialSnap,
    "denial-catalog snap is stale; rerun render-agent-buccet-runtime-snaps.ts",
  );

  console.log("Agent Buccet runtime snap contract");
  console.log(`  source rows:         ${source.sourceRows.length}`);
  console.log(`  runtime muscle rows: ${actualRuntimeMuscle.activeLawIds.length}`);
  console.log(`  denial snap rows:    ${actualDenialSnap.lawIds.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
