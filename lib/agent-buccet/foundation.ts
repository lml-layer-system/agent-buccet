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
const FOUNDATION_RUNTIME_MODULE_RELATIVE_PATH = path.join(
  "data",
  "agent-buccet-law-foundation",
  "runtime",
  "agent-buccet-law-substrate.js",
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
type RuntimeSubstrateModule = {
  loadRuntimeSubstrate: (options?: { substratePath?: string; repoRoot?: string }) => unknown;
  materializeRuntimeLawBody: (substrate: unknown) => Array<{ projectedLawId: string; gate?: string; category?: string }>;
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

async function resolveRuntimeModulePath(): Promise<string> {
  for (const candidate of resolveFoundationCandidates(FOUNDATION_RUNTIME_MODULE_RELATIVE_PATH)) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    `unable to locate Agent Buccet runtime law substrate module at ${FOUNDATION_RUNTIME_MODULE_RELATIVE_PATH}`,
  );
}

async function loadRuntimeSubstrateModule(): Promise<RuntimeSubstrateModule> {
  const modulePath = await resolveRuntimeModulePath();
  return import(modulePath) as Promise<RuntimeSubstrateModule>;
}

function buildTimeIndexes(rows: Array<{ projectedLawId: string; gate?: string; category?: string }>) {
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

  // Only carry forward existingLawIds that are valid in the current execution context.
  // This prevents stale law IDs from a different law configuration (e.g. DEFAULT_BOUNDARY_LAWS
  // session restored with wrapperLaws) from activating muscle rules they no longer belong to.
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
      resolveRuntimeMuscleManifestPath(),
      resolveRuntimeSubstratePath(),
      loadRuntimeSubstrateModule(),
    ]).then(async ([manifestPath, substratePath, runtimeModule]) => {
      const manifest = JSON.parse(
        await fs.readFile(manifestPath, "utf8"),
      ) as BoundaryRuntimeMuscleManifest;
      const substrate = runtimeModule.loadRuntimeSubstrate({ substratePath });
      const materialized = runtimeModule.materializeRuntimeLawBody(substrate);
      const { timeLawIdsByGate, timeLawIdsByCategory } = buildTimeIndexes(materialized);

      return {
        manifest,
        substrate,
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
