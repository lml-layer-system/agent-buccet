import { promises as fs } from "node:fs";
import path from "node:path";
import { buildLawWeb } from "../lib/engine/compile.ts";
import type { LawRecord } from "../lib/types.ts";
import type { CompiledLaw, ExecutablePredicate, LawWeb } from "../lib/engine/types.ts";
import { canonicalPlanetManifestToLawRecords, loadCanonicalPlanetManifest } from "../lib/planet/manifest.ts";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "generated");
const LAWS_FILE = path.join(DATA_DIR, "laws.json");
const WEB_FILE = path.join(DATA_DIR, "law-web.json");

async function main() {
  const [lawsRaw, webRaw] = await Promise.all([fs.readFile(LAWS_FILE, "utf8"), fs.readFile(WEB_FILE, "utf8")]);
  const baseLaws = JSON.parse(lawsRaw) as LawRecord[];
  const canonical = await loadCanonicalPlanetManifest();
  const canonicalLaws = canonical ? canonicalPlanetManifestToLawRecords(canonical) : [];
  const laws = dedupeById([...baseLaws, ...canonicalLaws]);
  const web = JSON.parse(webRaw) as LawWeb;

  verifyCounts(web);
  verifyUniqueness(web);
  verifyBijection(web);
  verifyCoverage(web);
  verifyDeterministicRebuild(laws, web);
  verifyProhibitedTerms({ lawsRaw, webRaw, laws, web });

  console.log("Law web verification passed.");
  console.log(
    `counts floor=${web.sourceStats.floorCount} rawState=${web.sourceStats.rawStateCount} state=${web.sourceStats.stateCount} output=${web.sourceStats.outputCount} meta=${web.sourceStats.metaCount}`,
  );
  if (canonical) {
    console.log(`canonical planet manifest verified version=${canonical.version} laws=${canonical.total_laws}`);
  }
}

function verifyCoverage(web: LawWeb): void {
  assert(Boolean(web.coverage), "Law web coverage block missing.");
  assert(
    web.coverage.totalSourceLaws === web.coverage.incorporatedSourceLaws + web.coverage.missingSourceLawIds.length,
    "Coverage arithmetic mismatch for source law incorporation.",
  );
  assert(web.coverage.missingSourceLawIds.length === 0, "Coverage violation: unmapped source laws detected.");
  assert(
    web.coverage.missingRequiredMetaLawIds.length === 0,
    `Coverage violation: missing required meta laws (${web.coverage.missingRequiredMetaLawIds.join(", ")}).`,
  );
  assert(web.coverage.complete, "Coverage violation: law web is not marked complete.");
}

function verifyCounts(web: LawWeb): void {
  const { compilePolicy, sourceStats } = web;

  assert(sourceStats.floorCount === web.floor.length, "Floor count mismatch against floor array length.");
  assert(sourceStats.stateCount === web.state.length, "State count mismatch against state array length.");
  assert(sourceStats.outputCount === web.output.length, "Output count mismatch against output array length.");
  assert(sourceStats.metaCount === web.meta.length, "Meta count mismatch against meta array length.");

  if (compilePolicy.strict) {
    assert(
      sourceStats.floorCount === compilePolicy.floorTarget,
      `Strict floor target mismatch: expected ${compilePolicy.floorTarget}, got ${sourceStats.floorCount}.`,
    );
    assert(
      sourceStats.stateCount === compilePolicy.stateTarget,
      `Strict state target mismatch: expected ${compilePolicy.stateTarget}, got ${sourceStats.stateCount}.`,
    );
    assert(
      sourceStats.outputCount === compilePolicy.outputTarget,
      `Strict output target mismatch: expected ${compilePolicy.outputTarget}, got ${sourceStats.outputCount}.`,
    );
  }

  assert(sourceStats.stateCount === sourceStats.outputCount, "State/output cardinality mismatch.");
}

function verifyUniqueness(web: LawWeb): void {
  assertUniqueIds(web.floor, "floor");
  assertUniqueIds(web.state, "state");
  assertUniqueIds(web.output, "output");
  assertUniqueIds(web.meta, "meta");
  assertUniquePredicateIds(web.predicates);
}

function verifyBijection(web: LawWeb): void {
  const stateIds = new Set(web.state.map((law) => law.id));
  const outputIds = new Set(web.output.map((law) => law.id));
  const mappingEntries = Object.entries(web.bijection);

  assert(mappingEntries.length === web.state.length, "Bijection cardinality mismatch against state size.");

  const mappedOutputs = new Set<string>();
  for (const [stateId, outputId] of mappingEntries) {
    assert(stateIds.has(stateId), `Bijection references unknown state id: ${stateId}`);
    assert(outputIds.has(outputId), `Bijection references unknown output id: ${outputId}`);
    assert(!mappedOutputs.has(outputId), `Bijection output id mapped multiple times: ${outputId}`);
    mappedOutputs.add(outputId);
  }

  assert(mappedOutputs.size === outputIds.size, "Bijection does not cover all output ids.");
}

function verifyDeterministicRebuild(laws: LawRecord[], web: LawWeb): void {
  const rebuilt = buildLawWeb(laws, web.compilePolicy);

  assert(signature(rebuilt) === signature(web), "Deterministic rebuild signature mismatch.");
  assert(rebuilt.state.length === web.state.length, "Deterministic rebuild state count mismatch.");
  assert(rebuilt.output.length === web.output.length, "Deterministic rebuild output count mismatch.");
  assert(rebuilt.floor.length === web.floor.length, "Deterministic rebuild floor count mismatch.");
  assert(rebuilt.meta.length === web.meta.length, "Deterministic rebuild meta count mismatch.");

  for (let i = 0; i < web.state.length; i += 1) {
    assert(rebuilt.state[i].id === web.state[i].id, `State id mismatch at index ${i}.`);
    assert(rebuilt.output[i].id === web.output[i].id, `Output id mismatch at index ${i}.`);
  }
}

function assertUniqueIds(laws: CompiledLaw[], label: string): void {
  const seen = new Set<string>();
  for (const law of laws) {
    assert(!seen.has(law.id), `Duplicate ${label} id detected: ${law.id}`);
    seen.add(law.id);
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function verifyProhibitedTerms(input: {
  lawsRaw: string;
  webRaw: string;
  laws: LawRecord[];
  web: LawWeb;
}): void {
  const bannedPatterns: Array<{ label: string; regex: RegExp }> = [
    { label: "sha256/sha-256", regex: /\bsha[-\s]?256\b/i },
    { label: "hashlib", regex: /\bhashlib\b/i },
    { label: "hash*", regex: /hash/i },
  ];

  const textFields: string[] = [];
  for (const law of input.laws) {
    textFields.push(law.text, law.section, law.sourceFile, law.sourcePath);
  }
  for (const law of input.web.floor) {
    textFields.push(law.text, law.section, law.sourceFile);
  }
  for (const law of input.web.state) {
    textFields.push(law.text, law.section, law.sourceFile);
  }
  for (const law of input.web.output) {
    textFields.push(law.text, law.section, law.sourceFile);
  }
  for (const law of input.web.meta) {
    textFields.push(law.text, law.section, law.sourceFile);
  }
  textFields.push(...input.web.knownVocabulary, ...input.web.knownCitations);
  for (const predicate of input.web.predicates) {
    textFields.push(predicate.id, predicate.description, ...predicate.terms, ...predicate.sourceLawIds);
  }
  textFields.push(input.lawsRaw, input.webRaw);

  for (const pattern of bannedPatterns) {
    const hit = textFields.find((value) => pattern.regex.test(value));
    assert(!hit, `Prohibited term detected (${pattern.label}) in generated artifacts.`);
  }
}

function signature(web: LawWeb): string {
  return JSON.stringify({
    version: web.version,
    compilePolicy: web.compilePolicy,
    sourceStats: web.sourceStats,
    floor: web.floor,
    state: web.state,
    output: web.output,
    meta: web.meta,
    bijection: web.bijection,
    knownCitations: web.knownCitations,
    knownVocabulary: web.knownVocabulary,
    predicates: web.predicates,
    repairMoves: web.repairMoves,
  });
}

function assertUniquePredicateIds(predicates: ExecutablePredicate[]): void {
  const seen = new Set<string>();
  for (const predicate of predicates) {
    assert(!seen.has(predicate.id), `Duplicate predicate id detected: ${predicate.id}`);
    seen.add(predicate.id);
  }
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
