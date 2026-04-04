import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type BuccetLawBodyDenialCatalogRow = {
  projectedLawId: string;
  sourceLawId: string;
  familyId: string;
  familyTitle: string;
  kind: string;
  layer: string;
  layerTitle: string;
  runtimeSection: string;
  corpusPartition: "base" | "time";
  projectedText: string;
};

type RawProjectedLawRow = {
  projectedLawId?: string;
  sourceLawId?: string;
  familyId?: string;
  familyTitle?: string;
  kind?: string;
  layer?: string;
  layerTitle?: string;
  runtimeSection?: string;
  corpusPartition?: string;
  projectedText?: string;
};

function loadProjectedLawRows(): BuccetLawBodyDenialCatalogRow[] {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const sourcePath = path.resolve(
    moduleDir,
    "../../data/agent-buccet-law-foundation/data/working/active-law-body/projected-laws.json",
  );
  const raw = fs.readFileSync(sourcePath, "utf8");
  const parsed = JSON.parse(raw) as RawProjectedLawRow[];

  return parsed.map((row, index) => ({
    projectedLawId: row.projectedLawId ?? `BUCCET.UNKNOWN.LAW.${index + 1}`,
    sourceLawId: row.sourceLawId ?? `SOURCE-UNKNOWN-${index + 1}`,
    familyId: row.familyId ?? "BUCCET.UNKNOWN.FAMILY",
    familyTitle: row.familyTitle ?? "Unknown Buccet Family",
    kind: row.kind ?? "unknown",
    layer: row.layer ?? "UNKNOWN",
    layerTitle: row.layerTitle ?? "Unknown",
    runtimeSection: row.runtimeSection ?? "Unknown Runtime Section",
    corpusPartition: row.corpusPartition === "time" ? "time" : "base",
    projectedText: row.projectedText ?? row.familyTitle ?? `Buccet law ${index + 1}`,
  }));
}

export const BOUNDARY_BUCCET_LAW_BODY_DENIAL_ROWS: readonly BuccetLawBodyDenialCatalogRow[] =
  loadProjectedLawRows();
