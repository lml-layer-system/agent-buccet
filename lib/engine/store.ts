import { promises as fs } from "node:fs";
import path from "node:path";
import type { LawRecord } from "../types.ts";
import { buildLawWeb } from "./compile.ts";
import type { LawWeb } from "./types.ts";
import { canonicalPlanetManifestToLawRecords, loadCanonicalPlanetManifest } from "../planet/manifest.ts";

const DATA_DIR = path.join(process.cwd(), "data", "generated");
const LAWS_FILE = path.join(DATA_DIR, "laws.json");
const LAW_WEB_FILE = path.join(DATA_DIR, "law-web.json");

let cachedLawWeb: LawWeb | null = null;

export async function loadLaws(): Promise<LawRecord[]> {
  const raw = await fs.readFile(LAWS_FILE, "utf8");
  const baseLaws = JSON.parse(raw) as LawRecord[];
  const canonical = await loadCanonicalPlanetManifest();
  const canonicalLaws = canonical ? canonicalPlanetManifestToLawRecords(canonical) : [];
  return dedupeById([...baseLaws, ...canonicalLaws]);
}

export async function loadLawWeb(): Promise<LawWeb> {
  if (cachedLawWeb) {
    return cachedLawWeb;
  }

  try {
    const raw = await fs.readFile(LAW_WEB_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<LawWeb>;
    if (!parsed || !Array.isArray(parsed.predicates) || !parsed.coverage) {
      throw new Error("Compiled law web missing required enforcement metadata; forcing rebuild.");
    }
    cachedLawWeb = parsed as LawWeb;
    return cachedLawWeb;
  } catch {
    const laws = await loadLaws();
    const compiled = buildLawWeb(laws);
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(LAW_WEB_FILE, JSON.stringify(compiled, null, 2));
    cachedLawWeb = compiled;
    return compiled;
  }
}

export function clearLawWebCache(): void {
  cachedLawWeb = null;
}

function dedupeById(laws: LawRecord[]): LawRecord[] {
  const seen = new Set<string>();
  const output: LawRecord[] = [];
  for (const law of laws) {
    if (seen.has(law.id)) {
      continue;
    }
    seen.add(law.id);
    output.push(law);
  }
  return output;
}
