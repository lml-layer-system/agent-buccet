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
    };
    activeLawIds?: string[];
  }>(ACTIVE_RUNTIME_MUSCLE_RELATIVE_PATH);
  const actualDenialSnap = await readJson<{
    lawIds?: string[];
  }>(ACTIVE_DENIAL_CATALOG_SNAP_RELATIVE_PATH);
  const runtimeCount = actualRuntimeMuscle.activeLawIds?.length ?? 0;
  const denialCount = actualDenialSnap.lawIds?.length ?? 0;

  assert.ok(
    Array.isArray(actualRuntimeMuscle.activeLawIds) && runtimeCount > 8000,
    "runtime-muscle snap must carry the runtime law id inventory",
  );
  assert.ok(
    Array.isArray(actualDenialSnap.lawIds) && denialCount > 8000,
    "denial-catalog snap must carry the law id inventory",
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
