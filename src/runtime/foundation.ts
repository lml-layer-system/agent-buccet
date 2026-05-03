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
const FOUNDATION_RUNTIME_MUSCLE_RELATIVE_PATH = path.join(
  "data",
  "agent-buccet-law-foundation",
  "data",
  "working",
  "active-law-body",
  "runtime-muscle.json",
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
    cachedRuntimeMuscle = resolveFoundationPath(FOUNDATION_RUNTIME_MUSCLE_RELATIVE_PATH).then(async (runtimePath) => {
      const runtimeRaw = await fs.readFile(runtimePath, "utf8");
      const parsed = JSON.parse(runtimeRaw) as BoundaryRuntimeMuscle;
      if (!parsed.manifest || !Array.isArray(parsed.activeLawIds)) {
        throw new Error("runtime-muscle artifact is malformed");
      }
      return parsed;
    });
  }
  return cachedRuntimeMuscle;
}

export async function loadAgentBuccetRuntimeMuscleManifest(): Promise<BoundaryRuntimeMuscleManifest> {
  return (await loadAgentBuccetRuntimeMuscle()).manifest;
}
