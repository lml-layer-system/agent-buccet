import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  BoundaryRuntimeMuscle,
  BoundaryRuntimeMuscleManifest,
} from "../lib/agent-buccet/types.ts";

export const ACTIVE_LAW_BODY_MANIFEST_RELATIVE_PATH = path.join(
  "data",
  "agent-buccet-law-foundation",
  "data",
  "working",
  "active-law-body",
  "manifest.json",
);

export const ACTIVE_LAW_BODY_SOURCE_RELATIVE_PATH = path.join(
  "data",
  "agent-buccet-law-foundation",
  "data",
  "working",
  "active-law-body",
  "projected-laws.json",
);

export const ACTIVE_RUNTIME_MUSCLE_RELATIVE_PATH = path.join(
  "data",
  "agent-buccet-law-foundation",
  "data",
  "working",
  "active-law-body",
  "runtime-muscle.json",
);

export const ACTIVE_DENIAL_CATALOG_SNAP_RELATIVE_PATH = path.join(
  "data",
  "agent-buccet-law-foundation",
  "data",
  "working",
  "active-law-body",
  "denial-catalog-snap.json",
);

type ActiveLawBodyManifest = {
  generatedAt: string;
  baseProjectedLawCount: number;
  timeProjectedLawCount: number;
  projectedLawCount: number;
  familyCount: number;
};

export type ProjectedLawRow = {
  projectedLawId: string;
  sourceLawId: string;
  gate?: string;
  category?: string;
};

export type DenialCatalogSnap = {
  generatedAt: string;
  sourceSha256: string;
  sourceArtifactPath: string;
  lawIds: string[];
};

function sha256(buffer: string | Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalizeArtifactPath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function buildTimeIndexes(rows: ProjectedLawRow[]) {
  const timeLawIdsByGate: Record<string, string[]> = {};
  const timeLawIdsByCategory: Record<string, string[]> = {};

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

export function buildRuntimeMuscleArtifact(args: {
  sourceRows: ProjectedLawRow[];
  sourceRaw: string;
  sourceManifest: ActiveLawBodyManifest;
}): BoundaryRuntimeMuscle {
  if (args.sourceRows.length !== args.sourceManifest.projectedLawCount) {
    throw new Error(
      `active-law-body row count ${args.sourceRows.length} does not match manifest count ${args.sourceManifest.projectedLawCount}`,
    );
  }

  const sourceArtifactPath = normalizeArtifactPath(ACTIVE_LAW_BODY_SOURCE_RELATIVE_PATH);
  const runtimeArtifactPath = normalizeArtifactPath(ACTIVE_RUNTIME_MUSCLE_RELATIVE_PATH);
  const activeLawIds = args.sourceRows.map((row) => row.projectedLawId);
  const { timeLawIdsByGate, timeLawIdsByCategory } = buildTimeIndexes(args.sourceRows);
  const uniqueSourceKernelCount = new Set(args.sourceRows.map((row) => row.sourceLawId)).size;
  const snapPayload = {
    substrate: {
      source: runtimeArtifactPath,
      derivedFrom: "active-law-body",
      rowCount: args.sourceRows.length,
    },
    activeLawIds,
    timeLawIdsByGate,
    timeLawIdsByCategory,
  };
  const snapPayloadRaw = JSON.stringify(snapPayload);
  const manifest: BoundaryRuntimeMuscleManifest = {
    generatedAt: args.sourceManifest.generatedAt,
    activeBaseLawCount: args.sourceManifest.baseProjectedLawCount,
    activeTimeLawCount: args.sourceManifest.timeProjectedLawCount,
    activeLawBodyCount: args.sourceManifest.projectedLawCount,
    substrateFamilyCount: args.sourceManifest.familyCount,
    substrateSourceKernelCount: uniqueSourceKernelCount,
    hashes: {
      runtimeSubstrateSha256: sha256(snapPayloadRaw),
      materializedActiveLawBodySha256: sha256(args.sourceRaw),
    },
    sizes: {
      runtimeSubstrateBytes: Buffer.byteLength(snapPayloadRaw),
      materializedActiveLawBodyBytes: Buffer.byteLength(args.sourceRaw),
    },
    artifactPaths: {
      substrate: runtimeArtifactPath,
      activeLawBodySource: sourceArtifactPath,
    },
  };

  return {
    manifest,
    ...snapPayload,
  };
}

export function buildDenialCatalogSnap(args: {
  sourceRows: ProjectedLawRow[];
  sourceRaw: string;
  sourceManifest: ActiveLawBodyManifest;
}): DenialCatalogSnap {
  return {
    generatedAt: args.sourceManifest.generatedAt,
    sourceSha256: sha256(args.sourceRaw),
    sourceArtifactPath: normalizeArtifactPath(ACTIVE_LAW_BODY_SOURCE_RELATIVE_PATH),
    lawIds: args.sourceRows.map((row) => row.projectedLawId),
  };
}

export async function loadActiveLawBodySource(repoRoot: string): Promise<{
  manifest: ActiveLawBodyManifest;
  manifestRaw: string;
  sourceRows: ProjectedLawRow[];
  sourceRaw: string;
}> {
  const manifestPath = path.join(repoRoot, ACTIVE_LAW_BODY_MANIFEST_RELATIVE_PATH);
  const sourcePath = path.join(repoRoot, ACTIVE_LAW_BODY_SOURCE_RELATIVE_PATH);
  const [manifestRaw, sourceRaw] = await Promise.all([
    fs.readFile(manifestPath, "utf8"),
    fs.readFile(sourcePath, "utf8"),
  ]);

  return {
    manifest: JSON.parse(manifestRaw) as ActiveLawBodyManifest,
    manifestRaw,
    sourceRows: JSON.parse(sourceRaw) as ProjectedLawRow[],
    sourceRaw,
  };
}
