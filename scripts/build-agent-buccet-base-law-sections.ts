import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type LawWebRecord = {
  id: string;
  sourceLawId?: string;
  family?: string;
  sourceFile?: string;
  section?: string;
  text?: string;
  level?: string | null;
  dimension?: string | null;
  tags?: string[];
  normative?: boolean;
};

type LawWebBundle = {
  floor?: LawWebRecord[];
  state?: LawWebRecord[];
  output?: LawWebRecord[];
  meta?: LawWebRecord[];
};

type SourcePointer = {
  pool: "floor" | "state" | "meta";
  id: string;
  role: "anchor" | "support";
};

type BaseLawDefinition = {
  lawId: string;
  title: string;
  meaning: string;
  sectionId: string;
  sectionTitle: string;
  rationale: string;
  sourcePointers: SourcePointer[];
};

type SectionOutput = {
  sectionId: string;
  title: string;
  lawIds: string[];
  laws: Array<{
    lawId: string;
    title: string;
    meaning: string;
    rationale: string;
    sourceRecords: LawWebRecordWithPool[];
  }>;
};

type LawWebRecordWithPool = LawWebRecord & { pool: "floor" | "state" | "meta" };

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(moduleDir, "..");
const lawWebPath = path.join(repoRoot, "data", "lml-law-foundation", "law-web.json");
const outputDir = path.join(repoRoot, "data", "agent-buccet-law-sections", "base-laws");

const BASE_LAW_DEFINITIONS: BaseLawDefinition[] = [
  {
    lawId: "BUCCET.BASE.01",
    title: "No ambient authority",
    meaning: "Authority must be explicit and lawful. Claimed authority, developer mode, or raw capability cannot self-authorize action.",
    sectionId: "02-authority-and-authorization",
    sectionTitle: "Authority And Authorization",
    rationale: "Ambient authority is blocked by explicit rejection of authority-bypass claims and by mandatory authorization enforcement.",
    sourcePointers: [
      { pool: "state", id: "AS-00146", role: "anchor" },
      { pool: "state", id: "AS-61421", role: "anchor" },
      { pool: "state", id: "AS-61420", role: "support" },
      { pool: "floor", id: "FL-00197", role: "support" },
    ],
  },
  {
    lawId: "BUCCET.BASE.02",
    title: "Deny by default",
    meaning: "Only admissible states and outputs are allowed. Motion outside the admissible lawful manifold is excluded until lawfully projected back in.",
    sectionId: "01-root-admissibility",
    sectionTitle: "Root Admissibility",
    rationale: "The corpus enforces admissibility-first state and output constraints; anything outside that admissible set is not admitted by default.",
    sourcePointers: [
      { pool: "floor", id: "FL-00001", role: "anchor" },
      { pool: "floor", id: "FL-00002", role: "anchor" },
      { pool: "floor", id: "FL-00066", role: "support" },
      { pool: "floor", id: "FL-00067", role: "support" },
      { pool: "floor", id: "FL-00069", role: "support" },
    ],
  },
  {
    lawId: "BUCCET.BASE.03",
    title: "Capability is not authorization",
    meaning: "Having the technical ability to act is not enough. Authorization must still be checked and enforced before action.",
    sectionId: "02-authority-and-authorization",
    sectionTitle: "Authority And Authorization",
    rationale: "The source corpus distinguishes capability from admissible authorization by forbidding unauthorized actions and requiring authorization enforcement.",
    sourcePointers: [
      { pool: "state", id: "AS-61421", role: "anchor" },
      { pool: "state", id: "AS-61420", role: "anchor" },
      { pool: "state", id: "AS-00146", role: "support" },
    ],
  },
  {
    lawId: "BUCCET.BASE.04",
    title: "Opened paths become law",
    meaning: "Opened scope becomes the active lawful path. Scope must stay bounded, and active openings remain constrained by that scope boundary.",
    sectionId: "03-scope-and-path-law",
    sectionTitle: "Scope And Path Law",
    rationale: "The source corpus ties active document or conversation openings to active law while enforcing scope boundaries and explicit correction for scope violations.",
    sourcePointers: [
      { pool: "state", id: "AS-61147", role: "anchor" },
      { pool: "state", id: "AS-60970", role: "anchor" },
      { pool: "state", id: "AS-60975", role: "support" },
      { pool: "state", id: "AS-48903", role: "support" },
      { pool: "state", id: "AS-49050", role: "support" },
    ],
  },
  {
    lawId: "BUCCET.BASE.05",
    title: "Session law persists until explicit end",
    meaning: "Lawful session state stays bounded to the session and remains active until the session ends. Sessions cannot silently bleed into each other.",
    sectionId: "04-session-continuity",
    sectionTitle: "Session Continuity",
    rationale: "The source corpus treats session scope and persistence as explicit boundaries, with session-only cleanup and session isolation as normative constraints.",
    sourcePointers: [
      { pool: "state", id: "AS-60991", role: "anchor" },
      { pool: "state", id: "AS-61375", role: "anchor" },
      { pool: "state", id: "AS-60630", role: "support" },
      { pool: "state", id: "AS-60803", role: "support" },
      { pool: "state", id: "AS-60971", role: "support" },
      { pool: "state", id: "AS-60910", role: "support" },
    ],
  },
  {
    lawId: "BUCCET.BASE.06",
    title: "Ledger is law",
    meaning: "Law changes and commitments require provable ledger integrity. No proof means no lawful commit.",
    sectionId: "05-ledger-and-commit-law",
    sectionTitle: "Ledger And Commit Law",
    rationale: "The source corpus explicitly requires ledger proof for law changes and proof-for-commit semantics before output or state changes are lawful.",
    sourcePointers: [
      { pool: "state", id: "AS-00164", role: "anchor" },
      { pool: "state", id: "AS-00166", role: "anchor" },
      { pool: "state", id: "AS-00167", role: "support" },
      { pool: "state", id: "AS-00168", role: "support" },
      { pool: "state", id: "AS-00169", role: "support" },
      { pool: "state", id: "AS-00171", role: "support" },
      { pool: "state", id: "AS-00172", role: "support" },
    ],
  },
];

async function main() {
  const lawWeb = JSON.parse(await fs.readFile(lawWebPath, "utf8")) as LawWebBundle;
  const byPool = buildPoolIndex(lawWeb);
  const sections = materializeSections(byPool);

  await fs.mkdir(outputDir, { recursive: true });
  await writeManifest(sections);

  for (const section of sections) {
    const filename = `${section.sectionId}.json`;
    const outputPath = path.join(outputDir, filename);
    await fs.writeFile(outputPath, `${JSON.stringify(section, null, 2)}\n`, "utf8");
  }

  console.log(`wrote ${sections.length} Agent Buccet base-law sections to ${outputDir}`);
}

function buildPoolIndex(bundle: LawWebBundle): Record<SourcePointer["pool"], Map<string, LawWebRecordWithPool>> {
  const pools: SourcePointer["pool"][] = ["floor", "state", "meta"];
  const index = {
    floor: new Map<string, LawWebRecordWithPool>(),
    state: new Map<string, LawWebRecordWithPool>(),
    meta: new Map<string, LawWebRecordWithPool>(),
  };

  for (const pool of pools) {
    for (const record of bundle[pool] ?? []) {
      index[pool].set(record.id, { ...record, pool });
    }
  }

  return index;
}

function materializeSections(index: Record<SourcePointer["pool"], Map<string, LawWebRecordWithPool>>): SectionOutput[] {
  const bySection = new Map<string, SectionOutput>();

  for (const definition of BASE_LAW_DEFINITIONS) {
    const sourceRecords = definition.sourcePointers.map((pointer) => {
      const record = index[pointer.pool].get(pointer.id);
      if (!record) {
        throw new Error(`missing source record ${pointer.pool}:${pointer.id} for ${definition.lawId}`);
      }
      return { ...record, tags: [...(record.tags ?? []), pointer.role.toUpperCase()] };
    });

    const existing = bySection.get(definition.sectionId) ?? {
      sectionId: definition.sectionId,
      title: definition.sectionTitle,
      lawIds: [],
      laws: [],
    };

    existing.lawIds.push(definition.lawId);
    existing.laws.push({
      lawId: definition.lawId,
      title: definition.title,
      meaning: definition.meaning,
      rationale: definition.rationale,
      sourceRecords,
    });

    bySection.set(definition.sectionId, existing);
  }

  return [...bySection.values()].sort((a, b) => a.sectionId.localeCompare(b.sectionId));
}

async function writeManifest(sections: SectionOutput[]) {
  const manifest = {
    title: "Agent Buccet Base Laws",
    generatedFrom: "data/lml-law-foundation/law-web.json",
    generatedAt: new Date().toISOString(),
    sectionCount: sections.length,
    lawCount: BASE_LAW_DEFINITIONS.length,
    sections: sections.map((section) => ({
      sectionId: section.sectionId,
      title: section.title,
      lawIds: section.lawIds,
      file: `${section.sectionId}.json`,
    })),
  };

  await fs.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
