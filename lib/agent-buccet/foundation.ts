import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_BUCCET_TIME_LAW_REFERENCES } from "./time.ts";
import type { BoundaryLaw, BoundaryRuntimeMuscle, BoundaryRuntimeMuscleFamily, BoundaryRuntimeMuscleManifest } from "./types.ts";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const FOUNDATION_LAWS_RELATIVE_PATH = path.join(
  "data",
  "agent-buccet-law-foundation",
  "data",
  "working",
  "active-law-body",
  "index.json",
);
const FOUNDATION_RUNTIME_SUBSTRATE_MANIFEST_RELATIVE_PATH = path.join(
  "data",
  "agent-buccet-law-foundation",
  "data",
  "working",
  "runtime-law-substrate",
  "manifest.json",
);
const FOUNDATION_RUNTIME_SUBSTRATE_RELATIVE_PATH = path.join(
  "data",
  "agent-buccet-law-foundation",
  "data",
  "working",
  "runtime-law-substrate",
  "agent-buccet-runtime-substrate.json",
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

export type AgentBuccetFoundationLawSourceRecord = {
  byId?: Record<string, number>;
};

let cachedSunFoundationLawIds: Promise<string[]> | null = null;
let cachedRuntimeMuscleManifest: Promise<BoundaryRuntimeMuscleManifest> | null = null;
let cachedRuntimeMuscle: Promise<BoundaryRuntimeMuscle> | null = null;

function normalizeTimeLawId(lawId: number): string {
  return `BUCCET.TIME.${String(lawId).padStart(4, "0")}`;
}

async function loadSunFoundationLawIds(): Promise<string[]> {
  if (!cachedSunFoundationLawIds) {
    cachedSunFoundationLawIds = resolveFoundationLawsPath()
      .then((resolvedPath) => fs.readFile(resolvedPath, "utf8"))
      .then((raw) => JSON.parse(raw) as AgentBuccetFoundationLawSourceRecord)
      .then((records) => Object.keys(records.byId ?? {}));
  }
  return cachedSunFoundationLawIds;
}

async function resolveFoundationLawsPath(): Promise<string> {
  const candidates = resolveFoundationCandidates(FOUNDATION_LAWS_RELATIVE_PATH);

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(`unable to locate Agent Buccet law foundation at ${FOUNDATION_LAWS_RELATIVE_PATH}`);
}

function resolveFoundationCandidates(relativePath: string): string[] {
  return [
    path.join(moduleDir, "../../../", relativePath),
    path.join(moduleDir, "../", relativePath),
    path.join(process.cwd(), relativePath),
  ];
}

async function resolveRuntimeMuscleManifestPath(): Promise<string> {
  for (const candidate of resolveFoundationCandidates(FOUNDATION_RUNTIME_SUBSTRATE_MANIFEST_RELATIVE_PATH)) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    `unable to locate Agent Buccet runtime law substrate manifest at ${FOUNDATION_RUNTIME_SUBSTRATE_MANIFEST_RELATIVE_PATH}`,
  );
}

export async function buildActiveAgentBuccetLawIds(args: {
  executableLaws: BoundaryLaw[];
  existingLawIds?: string[];
}): Promise<string[]> {
  const sunLawIds = await loadSunFoundationLawIds();
  const executableLawIds = args.executableLaws.map((law) => law.lawId);
  const timeReferenceLawIds = AGENT_BUCCET_TIME_LAW_REFERENCES.map((law) => normalizeTimeLawId(law.lawId));

  return [...new Set([
    ...AGENT_BUCCET_BASE_LAW_IDS,
    ...sunLawIds,
    ...timeReferenceLawIds,
    ...(args.existingLawIds ?? []),
    ...executableLawIds,
  ])];
}

export function getAgentBuccetBaseLawIds(): readonly string[] {
  return AGENT_BUCCET_BASE_LAW_IDS;
}

export async function loadAgentBuccetRuntimeMuscleManifest(): Promise<BoundaryRuntimeMuscleManifest> {
  if (!cachedRuntimeMuscleManifest) {
    cachedRuntimeMuscleManifest = resolveRuntimeMuscleManifestPath()
      .then((resolvedPath) => fs.readFile(resolvedPath, "utf8"))
      .then((raw) => JSON.parse(raw) as BoundaryRuntimeMuscleManifest);
  }
  return cachedRuntimeMuscleManifest;
}

async function resolveRuntimeSubstratePath(): Promise<string> {
  for (const candidate of resolveFoundationCandidates(FOUNDATION_RUNTIME_SUBSTRATE_RELATIVE_PATH)) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    `unable to locate Agent Buccet runtime law substrate at ${FOUNDATION_RUNTIME_SUBSTRATE_RELATIVE_PATH}`,
  );
}

type RawSubstrateFamily = {
  familyId: string;
  familyTitle: string;
  status: string;
  kind?: string;
  familyCompressedLaw: string;
  sourceRows: unknown[];
};

type RawSubstrateJson = {
  substrate: {
    base: {
      layerIds: string[];
      families: RawSubstrateFamily[];
    };
    time: {
      layerIds: string[];
      family: RawSubstrateFamily;
    };
  };
};

function mapRawFamily(f: RawSubstrateFamily): BoundaryRuntimeMuscleFamily {
  return {
    familyId: f.familyId,
    familyTitle: f.familyTitle,
    status: f.status,
    kind: f.kind,
    familyCompressedLaw: f.familyCompressedLaw,
    sourceRowCount: f.sourceRows.length,
  };
}

export async function loadAgentBuccetRuntimeMuscle(): Promise<BoundaryRuntimeMuscle> {
  if (!cachedRuntimeMuscle) {
    cachedRuntimeMuscle = Promise.all([
      loadAgentBuccetRuntimeMuscleManifest(),
      resolveRuntimeSubstratePath()
        .then((p) => fs.readFile(p, "utf8"))
        .then((raw) => JSON.parse(raw) as RawSubstrateJson),
    ]).then(([manifest, raw]) => ({
      manifest,
      base: {
        layerIds: raw.substrate.base.layerIds,
        families: raw.substrate.base.families.map(mapRawFamily),
      },
      time: {
        layerIds: raw.substrate.time.layerIds,
        family: mapRawFamily(raw.substrate.time.family),
      },
    }));
  }
  return cachedRuntimeMuscle;
}
