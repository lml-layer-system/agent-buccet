import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { resolveCanonicalPlanetManifestPath } from "../lib/planet/manifest.ts";

const FREEZE = {
  canonicalVersion: "5.0.0-COMPLETE-EXPANDED",
  canonicalTotalLaws: 232,
  canonicalSha256: "4f8f2187fbe5439bda8180dc08d06f2caa4747aeff074ba40ff9f314bfa8d2cd",
  totalSourceLaws: 68509,
  floorCount: 220,
  stateCount: 68289,
  outputCount: 68289,
  metaCount: 400,
  requiredMeta: ["164", "165", "166", "167", "168", "169"],
} as const;

const ROOT = process.cwd();
const LAW_WEB_FILE = path.join(ROOT, "data", "generated", "law-web.json");

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export async function verifyFreeze(): Promise<void> {
  const canonicalFile = await resolveCanonicalPlanetManifestPath();
  const [canonicalRaw, webRaw] = await Promise.all([
    fs.readFile(canonicalFile),
    fs.readFile(LAW_WEB_FILE, "utf8"),
  ]);
  const canonical = JSON.parse(canonicalRaw.toString("utf8")) as {
    version: string;
    total_laws: number;
    laws: unknown[];
  };
  const web = JSON.parse(webRaw) as {
    sourceStats: {
      floorCount: number;
      stateCount: number;
      outputCount: number;
      metaCount: number;
    };
    coverage: {
      totalSourceLaws: number;
      complete: boolean;
      missingSourceLawIds: string[];
      requiredMetaLawIds: string[];
      presentRequiredMetaLawIds: string[];
      missingRequiredMetaLawIds: string[];
    };
  };

  const canonicalHash = createHash("sha256").update(canonicalRaw).digest("hex");

  assert(canonical.version === FREEZE.canonicalVersion, `Freeze drift: canonical version mismatch (${canonical.version}).`);
  assert(canonical.total_laws === FREEZE.canonicalTotalLaws, `Freeze drift: canonical total_laws mismatch (${canonical.total_laws}).`);
  assert(Array.isArray(canonical.laws) && canonical.laws.length === FREEZE.canonicalTotalLaws, "Freeze drift: canonical laws array length mismatch.");
  assert(canonicalHash === FREEZE.canonicalSha256, "Freeze drift: canonical SHA-256 mismatch.");

  assert(web.coverage.totalSourceLaws === FREEZE.totalSourceLaws, `Freeze drift: totalSourceLaws mismatch (${web.coverage.totalSourceLaws}).`);
  assert(web.sourceStats.floorCount === FREEZE.floorCount, `Freeze drift: floorCount mismatch (${web.sourceStats.floorCount}).`);
  assert(web.sourceStats.stateCount === FREEZE.stateCount, `Freeze drift: stateCount mismatch (${web.sourceStats.stateCount}).`);
  assert(web.sourceStats.outputCount === FREEZE.outputCount, `Freeze drift: outputCount mismatch (${web.sourceStats.outputCount}).`);
  assert(web.sourceStats.metaCount === FREEZE.metaCount, `Freeze drift: metaCount mismatch (${web.sourceStats.metaCount}).`);

  assert(web.coverage.complete, "Freeze drift: coverage.complete is false.");
  assert(web.coverage.missingSourceLawIds.length === 0, "Freeze drift: missingSourceLawIds is non-empty.");
  assert(web.coverage.missingRequiredMetaLawIds.length === 0, "Freeze drift: missingRequiredMetaLawIds is non-empty.");
  assert(
    JSON.stringify(web.coverage.requiredMetaLawIds) === JSON.stringify(FREEZE.requiredMeta),
    "Freeze drift: required meta-law set mismatch.",
  );
  assert(
    JSON.stringify(web.coverage.presentRequiredMetaLawIds) === JSON.stringify(FREEZE.requiredMeta),
    "Freeze drift: present required meta-law set mismatch.",
  );
}

async function main() {
  await verifyFreeze();
  console.log("Freeze verification passed.");
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
