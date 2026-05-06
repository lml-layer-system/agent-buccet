import { createHash } from "node:crypto";
import path from "node:path";
import type {
  BoundaryRuntimeMuscle,
  BoundaryRuntimeMuscleManifest,
} from "./../src/runtime/types.ts";

export const ACTIVE_LAW_BODY_MANIFEST_RELATIVE_PATH = path.join(
  "data",
  "agent-buccet-law-foundation",
  "data",
  "working",
  "active-law-body",
  "manifest.json",
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

  const runtimeArtifactPath = normalizeArtifactPath(ACTIVE_RUNTIME_MUSCLE_RELATIVE_PATH);
  const activeLawIds = args.sourceRows.map((row) => row.projectedLawId);
  const { timeLawIdsByGate, timeLawIdsByCategory } = buildTimeIndexes(args.sourceRows);
  const uniqueSourceKernelCount = new Set(args.sourceRows.map((row) => row.sourceLawId)).size;
  const snapPayload = {
    substrate: {
      source: runtimeArtifactPath,
      derivedFrom: "runtime-law-snapshot",
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
    },
    sizes: {
      runtimeSubstrateBytes: Buffer.byteLength(snapPayloadRaw),
    },
    artifactPaths: {
      substrate: runtimeArtifactPath,
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
    lawIds: args.sourceRows.map((row) => row.projectedLawId),
  };
}
