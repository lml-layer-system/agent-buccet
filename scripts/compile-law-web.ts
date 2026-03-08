import { promises as fs } from "node:fs";
import path from "node:path";
import { buildLawWeb } from "../lib/engine/compile.ts";
import type { LawRecord } from "../lib/types.ts";
import type { CompilePolicy } from "../lib/engine/types.ts";
import { canonicalPlanetManifestToLawRecords, loadCanonicalPlanetManifest } from "../lib/planet/manifest.ts";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "generated");
const LAWS_FILE = path.join(DATA_DIR, "laws.json");
const OUTPUT_FILE = path.join(DATA_DIR, "law-web.json");

async function main() {
  const lawsRaw = await fs.readFile(LAWS_FILE, "utf8");
  const baseLaws = JSON.parse(lawsRaw) as LawRecord[];
  const canonical = await loadCanonicalPlanetManifest();
  const canonicalLaws = canonical ? canonicalPlanetManifestToLawRecords(canonical) : [];
  const laws = dedupeById([...baseLaws, ...canonicalLaws]);
  const policy = readPolicyFromEnv();

  const lawWeb = buildLawWeb(laws, policy);
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(lawWeb, null, 2));

  console.log(`Compiled law web: ${OUTPUT_FILE}`);
  console.log(
    `policy floor=${lawWeb.compilePolicy.floorTarget} state=${lawWeb.compilePolicy.stateTarget} output=${lawWeb.compilePolicy.outputTarget} metaMax=${lawWeb.compilePolicy.metaMax} strict=${String(lawWeb.compilePolicy.strict)} fillMode=${lawWeb.compilePolicy.fillMode}`,
  );
  console.log(
    `floor=${lawWeb.sourceStats.floorCount} rawState=${lawWeb.sourceStats.rawStateCount} state=${lawWeb.sourceStats.stateCount} output=${lawWeb.sourceStats.outputCount} meta=${lawWeb.sourceStats.metaCount}`,
  );
  if (canonical) {
    console.log(`canonical planet manifest loaded version=${canonical.version} laws=${canonical.total_laws}`);
  }
}

function readPolicyFromEnv(): Partial<CompilePolicy> {
  return {
    floorTarget: toNumber(process.env.LML_FLOOR_TARGET),
    stateTarget: toNumber(process.env.LML_STATE_TARGET),
    outputTarget: toNumber(process.env.LML_OUTPUT_TARGET),
    metaMax: toNumber(process.env.LML_META_MAX),
    strict: toBoolean(process.env.LML_STRICT),
    fillMode: toFillMode(process.env.LML_FILL_MODE),
  };
}

function toNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric policy value: ${value}`);
  }
  return parsed;
}

function toBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }
  throw new Error(`Invalid boolean policy value: ${value}`);
}

function toFillMode(value: string | undefined): CompilePolicy["fillMode"] | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "pad" || normalized === "error") {
    return normalized;
  }
  throw new Error(`Invalid fill mode policy value: ${value}`);
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
