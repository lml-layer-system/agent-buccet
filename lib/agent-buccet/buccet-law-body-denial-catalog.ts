import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type BuccetLawBodyDenialCatalogRow = {
  projectedLawId: string;
};

type DenialCatalogSnap = {
  generatedAt?: string;
  sourceSha256?: string;
  sourceArtifactPath?: string;
  lawIds?: string[];
};

function loadProjectedLawRows(): BuccetLawBodyDenialCatalogRow[] {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(
      moduleDir,
      "../data/agent-buccet-law-foundation/data/working/active-law-body/denial-catalog-snap.json",
    ),
    path.resolve(
      moduleDir,
      "../../data/agent-buccet-law-foundation/data/working/active-law-body/denial-catalog-snap.json",
    ),
  ];
  const sourcePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!sourcePath) {
    throw new Error("unable to locate denial-catalog-snap.json for Buccet law-body denial catalog");
  }
  const raw = fs.readFileSync(sourcePath, "utf8");
  const parsed = JSON.parse(raw) as DenialCatalogSnap;

  return (parsed.lawIds ?? []).map((lawId, index) => ({
    projectedLawId: lawId || `BUCCET.UNKNOWN.LAW.${index + 1}`,
  }));
}

export const BOUNDARY_BUCCET_LAW_BODY_DENIAL_ROWS: readonly BuccetLawBodyDenialCatalogRow[] =
  loadProjectedLawRows();
