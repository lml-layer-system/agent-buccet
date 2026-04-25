import { promises as fs } from "node:fs";
import path from "node:path";
import {
  ACTIVE_DENIAL_CATALOG_SNAP_RELATIVE_PATH,
  ACTIVE_RUNTIME_MUSCLE_RELATIVE_PATH,
  buildDenialCatalogSnap,
  buildRuntimeMuscleArtifact,
  loadActiveLawBodySource,
} from "./agent-buccet-runtime-snap-shared.ts";

const repoRoot = process.cwd();

async function writeJson(relativePath: string, value: unknown): Promise<void> {
  const targetPath = path.join(repoRoot, relativePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const source = await loadActiveLawBodySource(repoRoot);
  const runtimeMuscle = buildRuntimeMuscleArtifact({
    sourceRows: source.sourceRows,
    sourceRaw: source.sourceRaw,
    sourceManifest: source.manifest,
  });
  const denialCatalogSnap = buildDenialCatalogSnap({
    sourceRows: source.sourceRows,
    sourceRaw: source.sourceRaw,
    sourceManifest: source.manifest,
  });

  await Promise.all([
    writeJson(ACTIVE_RUNTIME_MUSCLE_RELATIVE_PATH, runtimeMuscle),
    writeJson(ACTIVE_DENIAL_CATALOG_SNAP_RELATIVE_PATH, denialCatalogSnap),
  ]);

  console.log("Rendered Agent Buccet runtime snap artifacts");
  console.log(`  runtime muscle: ${ACTIVE_RUNTIME_MUSCLE_RELATIVE_PATH}`);
  console.log(`  denial catalog: ${ACTIVE_DENIAL_CATALOG_SNAP_RELATIVE_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
