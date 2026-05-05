import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  ACTIVE_DENIAL_CATALOG_SNAP_RELATIVE_PATH,
  ACTIVE_RUNTIME_MUSCLE_RELATIVE_PATH,
} from "./../../scripts/agent-buccet-runtime-snap-shared.ts";

const repoRoot = process.cwd();

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(repoRoot, relativePath), "utf8")) as T;
}

async function main() {
  const actualRuntimeMuscle = await readJson<{
    manifest?: {
      activeLawBodyCount?: number;
      hashes?: Record<string, unknown>;
      sizes?: Record<string, unknown>;
      artifactPaths?: { activeLawBodySource?: string };
    };
    activeLawIds?: string[];
  }>(
    ACTIVE_RUNTIME_MUSCLE_RELATIVE_PATH,
  );
  const actualDenialSnap = await readJson<{
    sourceArtifactPath?: string;
    lawIds?: string[];
  } & Record<string, unknown>>(
    ACTIVE_DENIAL_CATALOG_SNAP_RELATIVE_PATH,
  );
  const runtimeCount = actualRuntimeMuscle.activeLawIds?.length ?? 0;
  const denialCount = actualDenialSnap.lawIds?.length ?? 0;
  const privateSourceHashKey = "source" + "Sha256";
  const privateBodyHashKey = "materialized" + "ActiveLawBodySha256";
  const privateBodySizeKey = "materialized" + "ActiveLawBodyBytes";

  assert.equal(
    actualRuntimeMuscle.manifest?.artifactPaths?.activeLawBodySource,
    "private-law-source-redacted",
    "runtime-muscle snap must not expose the internal source path",
  );
  assert.equal(
    actualDenialSnap.sourceArtifactPath,
    "private-law-source-redacted",
    "denial-catalog snap must not expose the internal source path",
  );
  assert.equal(
    actualRuntimeMuscle.manifest?.hashes?.[privateBodyHashKey],
    undefined,
    "runtime-muscle snap must not expose an internal source hash",
  );
  assert.equal(
    actualRuntimeMuscle.manifest?.sizes?.[privateBodySizeKey],
    undefined,
    "runtime-muscle snap must not expose an internal source byte size",
  );
  assert.equal(
    actualDenialSnap[privateSourceHashKey],
    undefined,
    "denial-catalog snap must not expose an internal source hash",
  );
  assert.ok(
    Array.isArray(actualRuntimeMuscle.activeLawIds) && runtimeCount > 8000,
    "runtime-muscle snap must carry the public runtime law id inventory",
  );
  assert.ok(
    Array.isArray(actualDenialSnap.lawIds) && denialCount > 8000,
    "denial-catalog snap must carry the public law id inventory",
  );
  assert.equal(
    actualRuntimeMuscle.manifest?.activeLawBodyCount,
    runtimeCount,
    "runtime-muscle count must match active law ids",
  );
  assert.equal(
    runtimeCount,
    denialCount,
    "runtime and denial snap inventories should cover the same law id set",
  );

  console.log("Agent Buccet runtime snap contract");
  console.log(`  runtime muscle rows: ${runtimeCount}`);
  console.log(`  denial snap rows:    ${denialCount}`);
  console.log("  private law source:  redacted");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
