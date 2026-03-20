import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_BUCCET_META_LAW_REFERENCES } from "./meta.ts";
import type { BoundaryLaw } from "./types.ts";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const FOUNDATION_LAWS_RELATIVE_PATH = path.join("data", "lml-law-foundation", "laws.json");

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
  id?: string;
};

let cachedSunFoundationLawIds: Promise<string[]> | null = null;

function normalizeMetaReferenceLawId(lawId: number): string {
  return `BUCCET.META.${String(lawId).padStart(4, "0")}`;
}

async function loadSunFoundationLawIds(): Promise<string[]> {
  if (!cachedSunFoundationLawIds) {
    cachedSunFoundationLawIds = resolveFoundationLawsPath()
      .then((resolvedPath) => fs.readFile(resolvedPath, "utf8"))
      .then((raw) => JSON.parse(raw) as AgentBuccetFoundationLawSourceRecord[])
      .then((records) => records.map((record) => record.id).filter((id): id is string => typeof id === "string" && id.length > 0));
  }
  return cachedSunFoundationLawIds;
}

async function resolveFoundationLawsPath(): Promise<string> {
  const candidates = [
    path.join(moduleDir, "../../../", FOUNDATION_LAWS_RELATIVE_PATH),
    path.join(moduleDir, "../", FOUNDATION_LAWS_RELATIVE_PATH),
    path.join(process.cwd(), FOUNDATION_LAWS_RELATIVE_PATH),
  ];

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

export async function buildActiveAgentBuccetLawIds(args: {
  executableLaws: BoundaryLaw[];
  existingLawIds?: string[];
}): Promise<string[]> {
  const sunLawIds = await loadSunFoundationLawIds();
  const executableLawIds = args.executableLaws.map((law) => law.lawId);
  const metaReferenceLawIds = AGENT_BUCCET_META_LAW_REFERENCES.map((law) => normalizeMetaReferenceLawId(law.lawId));

  return [...new Set([
    ...AGENT_BUCCET_BASE_LAW_IDS,
    ...sunLawIds,
    ...metaReferenceLawIds,
    ...(args.existingLawIds ?? []),
    ...executableLawIds,
  ])];
}

export function getAgentBuccetBaseLawIds(): readonly string[] {
  return AGENT_BUCCET_BASE_LAW_IDS;
}
