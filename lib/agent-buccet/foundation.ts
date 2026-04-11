import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_BUCCET_TIME_LAW_REFERENCES } from "./time.ts";
import type {
  BoundaryLaw,
  BoundaryRuntimeMuscle,
  BoundaryRuntimeMuscleManifest,
} from "./types.ts";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const FOUNDATION_ACTIVE_LAW_BODY_MANIFEST_RELATIVE_PATH = path.join(
  "data",
  "agent-buccet-law-foundation",
  "data",
  "working",
  "active-law-body",
  "manifest.json",
);
const FOUNDATION_ACTIVE_LAW_BODY_RELATIVE_PATH = path.join(
  "data",
  "agent-buccet-law-foundation",
  "data",
  "working",
  "active-law-body",
  "projected-laws.json",
);

const AGENT_BUCCET_BASE_LAW_IDS = [
  "BUCCET.BASE.01",
  "BUCCET.BASE.02",
  "BUCCET.BASE.03",
  "BUCCET.BASE.04",
  "BUCCET.BASE.05",
  "BUCCET.BASE.06",
] as const;

export const AGENT_BUCCET_ACTIVE_FOUNDATION_EXCLUDED_LAW_IDS = [165, 166, 167, 169, 243] as const;

type ActiveLawBodyManifest = {
  generatedAt: string;
  baseProjectedLawCount: number;
  timeProjectedLawCount: number;
  projectedLawCount: number;
  familyCount: number;
};

type ProjectedLawRow = {
  projectedLawId: string;
  sourceLawId: string;
  gate?: string;
  category?: string;
};

let cachedRuntimeMuscle: Promise<BoundaryRuntimeMuscle> | null = null;

export function normalizeTimeReferenceLawId(lawId: number): string {
  return `BUCCET.META.${String(lawId).padStart(4, "0")}`;
}

function resolveFoundationCandidates(relativePath: string): string[] {
  return [
    path.join(moduleDir, "../../", relativePath),
    path.join(moduleDir, "../", relativePath),
    path.join(process.cwd(), relativePath),
  ];
}

async function resolveFoundationPath(relativePath: string): Promise<string> {
  for (const candidate of resolveFoundationCandidates(relativePath)) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(`unable to locate Agent Buccet foundation artifact at ${relativePath}`);
}

function sha256(buffer: string | Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalizeArtifactPath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function buildTimeIndexes(rows: ProjectedLawRow[]) {
  const timeLawIdsByGate: Record<string, string[]> = Object.create(null);
  const timeLawIdsByCategory: Record<string, string[]> = Object.create(null);

  for (const row of rows) {
    if (!row.projectedLawId.startsWith("BUCCET.TIME.")) {
      continue;
    }
    if (row.gate) {
      if (!timeLawIdsByGate[row.gate]) {
        timeLawIdsByGate[row.gate] = [];
      }
      timeLawIdsByGate[row.gate].push(row.projectedLawId);
    }
    if (row.category) {
      if (!timeLawIdsByCategory[row.category]) {
        timeLawIdsByCategory[row.category] = [];
      }
      timeLawIdsByCategory[row.category].push(row.projectedLawId);
    }
  }

  return { timeLawIdsByGate, timeLawIdsByCategory };
}

export async function buildActiveAgentBuccetLawIds(args: {
  executableLaws: BoundaryLaw[];
  existingLawIds?: string[];
  runtimeMuscle?: BoundaryRuntimeMuscle;
}): Promise<string[]> {
  const runtimeMuscle = args.runtimeMuscle ?? await loadAgentBuccetRuntimeMuscle();
  const executableLawIds = args.executableLaws.map((law) => law.lawId);
  const timeReferenceLawIds = AGENT_BUCCET_TIME_LAW_REFERENCES.map((law) => normalizeTimeReferenceLawId(law.lawId));

  const knownLawIdSet = new Set([
    ...AGENT_BUCCET_BASE_LAW_IDS,
    ...runtimeMuscle.activeLawIds,
    ...timeReferenceLawIds,
    ...executableLawIds,
  ]);
  const validExistingLawIds = (args.existingLawIds ?? []).filter((id) =>
    knownLawIdSet.has(id) || id.startsWith("UPL-")
  );

  return [...new Set([
    ...AGENT_BUCCET_BASE_LAW_IDS,
    ...runtimeMuscle.activeLawIds,
    ...timeReferenceLawIds,
    ...validExistingLawIds,
    ...executableLawIds,
  ])];
}

export function getAgentBuccetBaseLawIds(): readonly string[] {
  return AGENT_BUCCET_BASE_LAW_IDS;
}

export async function loadAgentBuccetRuntimeMuscle(): Promise<BoundaryRuntimeMuscle> {
  if (!cachedRuntimeMuscle) {
    cachedRuntimeMuscle = Promise.all([
      resolveFoundationPath(FOUNDATION_ACTIVE_LAW_BODY_MANIFEST_RELATIVE_PATH),
      resolveFoundationPath(FOUNDATION_ACTIVE_LAW_BODY_RELATIVE_PATH),
    ]).then(async ([manifestPath, projectedLawBodyPath]) => {
      const [manifestRaw, projectedLawBodyRaw] = await Promise.all([
        fs.readFile(manifestPath, "utf8"),
        fs.readFile(projectedLawBodyPath, "utf8"),
      ]);
      const activeLawBodyManifest = JSON.parse(manifestRaw) as ActiveLawBodyManifest;
      const materialized = JSON.parse(projectedLawBodyRaw) as ProjectedLawRow[];
      if (materialized.length !== activeLawBodyManifest.projectedLawCount) {
        throw new Error(
          `active-law-body row count ${materialized.length} does not match manifest count ${activeLawBodyManifest.projectedLawCount}`,
        );
      }

      const activeLawBodyHash = sha256(projectedLawBodyRaw);
      const activeLawBodyBytes = Buffer.byteLength(projectedLawBodyRaw);
      const uniqueSourceKernelCount = new Set(materialized.map((row) => row.sourceLawId)).size;
      const artifactPath = normalizeArtifactPath(FOUNDATION_ACTIVE_LAW_BODY_RELATIVE_PATH);
      const manifest: BoundaryRuntimeMuscleManifest = {
        generatedAt: activeLawBodyManifest.generatedAt,
        activeBaseLawCount: activeLawBodyManifest.baseProjectedLawCount,
        activeTimeLawCount: activeLawBodyManifest.timeProjectedLawCount,
        activeLawBodyCount: activeLawBodyManifest.projectedLawCount,
        substrateFamilyCount: activeLawBodyManifest.familyCount,
        substrateSourceKernelCount: uniqueSourceKernelCount,
        hashes: {
          runtimeSubstrateSha256: activeLawBodyHash,
          materializedActiveLawBodySha256: activeLawBodyHash,
        },
        sizes: {
          runtimeSubstrateBytes: activeLawBodyBytes,
          materializedActiveLawBodyBytes: activeLawBodyBytes,
        },
        artifactPaths: {
          substrate: artifactPath,
          activeLawBodySource: artifactPath,
        },
      };
      const { timeLawIdsByGate, timeLawIdsByCategory } = buildTimeIndexes(materialized);

      return {
        manifest,
        substrate: {
          source: artifactPath,
          derivedFrom: "active-law-body",
          rowCount: materialized.length,
        },
        activeLawIds: materialized.map((row) => row.projectedLawId),
        timeLawIdsByGate,
        timeLawIdsByCategory,
      };
    });
  }
  return cachedRuntimeMuscle;
}

export async function loadAgentBuccetRuntimeMuscleManifest(): Promise<BoundaryRuntimeMuscleManifest> {
  return (await loadAgentBuccetRuntimeMuscle()).manifest;
}
