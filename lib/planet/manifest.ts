import { promises as fs } from "node:fs";
import path from "node:path";
import type { LawRecord } from "../types.ts";

const DEFAULT_CANONICAL_PLANET_MANIFEST_FILE = path.join(process.cwd(), "data", "generated", "canonical-planet-manifest.json");
const REQUIRED_META_IDS = [164, 165, 166, 167, 168, 169];

export type CanonicalPlanetManifestLaw = {
  law_id: number;
  name: string;
  category?: string;
  gate?: string;
  company?: string;
  state_form?: string;
  output_form?: string;
  detection_logic?: string;
  failure_mode?: string;
  text?: string;
};

export type CanonicalPlanetManifest = {
  version: string;
  total_laws: number;
  laws: CanonicalPlanetManifestLaw[];
};

export async function resolveCanonicalPlanetManifestPath(filePath?: string): Promise<string> {
  if (filePath) {
    return filePath;
  }
  if (process.env.LML_CANONICAL_PLANET_MANIFEST) {
    return process.env.LML_CANONICAL_PLANET_MANIFEST;
  }
  return DEFAULT_CANONICAL_PLANET_MANIFEST_FILE;
}

export async function loadCanonicalPlanetManifest(filePath?: string): Promise<CanonicalPlanetManifest | null> {
  try {
    const resolvedPath = await resolveCanonicalPlanetManifestPath(filePath);
    const raw = await fs.readFile(resolvedPath, "utf8");
    const parsed = JSON.parse(raw) as CanonicalPlanetManifest;
    validateCanonicalPlanetManifest(parsed, resolvedPath);
    return parsed;
  } catch {
    return null;
  }
}

export async function loadCanonicalPlanetManifestStrict(filePath?: string): Promise<CanonicalPlanetManifest> {
  const resolvedPath = await resolveCanonicalPlanetManifestPath(filePath);
  const raw = await fs.readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw) as CanonicalPlanetManifest;
  validateCanonicalPlanetManifest(parsed, resolvedPath);
  return parsed;
}

export function validateCanonicalPlanetManifest(pack: CanonicalPlanetManifest, source = "canonical-planet-manifest"): void {
  if (!pack || typeof pack !== "object") {
    throw new Error(`[${source}] canonical planet manifest must be an object.`);
  }
  if (!Array.isArray(pack.laws) || pack.laws.length === 0) {
    throw new Error(`[${source}] canonical planet manifest must include non-empty laws array.`);
  }
  if (typeof pack.total_laws !== "number" || pack.total_laws !== pack.laws.length) {
    throw new Error(
      `[${source}] canonical planet manifest total mismatch: total_laws=${String(pack.total_laws)} laws.length=${pack.laws.length}.`,
    );
  }

  const seen = new Set<number>();
  for (const law of pack.laws) {
    if (typeof law.law_id !== "number" || !Number.isFinite(law.law_id)) {
      throw new Error(`[${source}] law entry missing numeric law_id.`);
    }
    if (seen.has(law.law_id)) {
      throw new Error(`[${source}] duplicate law_id ${law.law_id}.`);
    }
    seen.add(law.law_id);
  }

  const missingMeta = REQUIRED_META_IDS.filter((id) => !seen.has(id));
  if (missingMeta.length > 0) {
    throw new Error(`[${source}] missing required meta laws: ${missingMeta.join(", ")}.`);
  }
}

export function canonicalPlanetManifestToLawRecords(pack: CanonicalPlanetManifest): LawRecord[] {
  return pack.laws.map((law, index) => {
    const text = compactText(
      law.text
      ?? law.output_form
      ?? law.state_form
      ?? law.detection_logic
      ?? law.failure_mode
      ?? law.name,
    );
    return {
      id: `CLAW-${String(law.law_id).padStart(4, "0")}`,
      sourceFile: `canonical:${pack.version}`,
      sourcePath: `canonical:${pack.version}`,
      section: compactText(`${law.category ?? "CANONICAL"} ${law.gate ?? ""} ${law.company ?? ""}`.trim() || "CANONICAL"),
      indexInFile: index + 1,
      text,
      level: null,
      dimension: null,
      normative: true,
      tags: ["CANONICAL", law.gate ?? "UNSPECIFIED_GATE"],
    };
  });
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
