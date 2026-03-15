import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  NocrCollapseLedgerPayload,
  NocrCollapseMatchLedgerPayload,
  NocrClippedLedgerPayload,
  NocrFunnelLedgerPayload,
  NocrLedgerRecord,
  NocrLifecycleLedgerPayload,
  NocrPlanetRootLaw,
} from "@/lib/nocr/types";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const NOCR_PLANET_FILE = path.join(LEDGER_DIR, "nocr-planet-roots.jsonl");

export async function appendNocrPlanetRootLaw(record: NocrLedgerRecord): Promise<NocrPlanetRootLaw> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const law = materializeNocrPlanetRootLaw(record);
  await fs.appendFile(NOCR_PLANET_FILE, `${JSON.stringify(law)}\n`, "utf8");
  return law;
}

export async function readAllNocrPlanetRootLaws(): Promise<NocrPlanetRootLaw[]> {
  try {
    const raw = await fs.readFile(NOCR_PLANET_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as NocrPlanetRootLaw);
  } catch {
    return [];
  }
}

export function materializeNocrPlanetRootLaw(record: NocrLedgerRecord): NocrPlanetRootLaw {
  if (record.eventType === "FUNNEL_TAGGED") {
    const payload = record.payload as NocrFunnelLedgerPayload;
    return {
      id: `NOCR.PLANET.FUNNEL.${String(record.index + 1).padStart(6, "0")}`,
      parentTag: `parent.nocr.funnel.${String(record.index + 1).padStart(6, "0")}`,
      planet: "nocr",
      sourceLedgerIndex: record.index,
      sourceEventType: record.eventType,
      text: `NOCR funnel record ${payload.seedTag} is immutable and parent-tagged on the NOCR planet with root candidates ${payload.rootTags.join(", ")}.`,
      createdAt: payload.createdAt,
    };
  }

  if (record.eventType === "COLLAPSE_RESOLVED") {
    const payload = record.payload as NocrCollapseLedgerPayload;
    return {
      id: `NOCR.PLANET.COLLAPSE.${String(record.index + 1).padStart(6, "0")}`,
      parentTag: `parent.nocr.collapse.${String(record.index + 1).padStart(6, "0")}`,
      planet: "nocr",
      sourceLedgerIndex: record.index,
      sourceEventType: record.eventType,
      text: `NOCR collapse record ${payload.seedTag} -> ${payload.rootTag} is immutable and parent-tagged on the NOCR planet as branch ${payload.branchId} in tree ${payload.treeId}.`,
      createdAt: payload.createdAt,
    };
  }

  if (record.eventType === "COLLAPSE_MATCH_RESOLVED") {
    const payload = record.payload as NocrCollapseMatchLedgerPayload;
    return {
      id: `NOCR.PLANET.MATCH.${String(record.index + 1).padStart(6, "0")}`,
      parentTag: `parent.nocr.match.${String(record.index + 1).padStart(6, "0")}`,
      planet: "nocr",
      sourceLedgerIndex: record.index,
      sourceEventType: record.eventType,
      text: `NOCR collapse match ${payload.seedTag} -> ${payload.rootTag} is immutable and parent-tagged on the NOCR planet for branch ${payload.branchId} in tree ${payload.treeId}.`,
      createdAt: payload.createdAt,
    };
  }

  if (record.eventType === "COLLAPSE_CLIPPED") {
    const payload = record.payload as NocrClippedLedgerPayload;
    return {
      id: `NOCR.PLANET.CLIPPED.${String(record.index + 1).padStart(6, "0")}`,
      parentTag: `parent.nocr.clipped.${String(record.index + 1).padStart(6, "0")}`,
      planet: "nocr",
      sourceLedgerIndex: record.index,
      sourceEventType: record.eventType,
      text: `NOCR clipped collapse record ${payload.seedTag} is immutable and parent-tagged on the NOCR planet because no lawful parent/root lock occurred for requested domain ${payload.requestedDomain}.`,
      createdAt: payload.createdAt,
    };
  }

  const payload = record.payload as NocrLifecycleLedgerPayload;
  const prefix = record.eventType.replace(/_/g, ".");
  return {
    id: `NOCR.PLANET.${prefix}.${String(record.index + 1).padStart(6, "0")}`,
    parentTag: `parent.nocr.${record.eventType.toLowerCase()}.${String(record.index + 1).padStart(6, "0")}`,
    planet: "nocr",
    sourceLedgerIndex: record.index,
    sourceEventType: record.eventType,
    text: `NOCR ${payload.entity} ${payload.lifecycle} record is immutable and parent-tagged on the NOCR planet for branch ${payload.branchId} and tree ${payload.treeId}.`,
    createdAt: payload.createdAt,
  };
}

export function verifyNocrLedgerPlanetParity(records: NocrLedgerRecord[], laws: NocrPlanetRootLaw[]): {
  ok: boolean;
  missingLawIds: string[];
  extraLawIds: string[];
} {
  const expectedIds = new Set(records.map((record) => materializeNocrPlanetRootLaw(record).id));
  const actualIds = new Set(laws.map((law) => law.id));
  const missingLawIds = [...expectedIds].filter((id) => !actualIds.has(id));
  const extraLawIds = [...actualIds].filter((id) => !expectedIds.has(id));
  return {
    ok: missingLawIds.length === 0 && extraLawIds.length === 0,
    missingLawIds,
    extraLawIds,
  };
}

export async function syncNocrPlanetFromLedger(records: NocrLedgerRecord[]): Promise<NocrPlanetRootLaw[]> {
  const laws = await readAllNocrPlanetRootLaws();
  const existingIds = new Set(laws.map((law) => law.id));
  const appended: NocrPlanetRootLaw[] = [];
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  for (const record of records) {
    const law = materializeNocrPlanetRootLaw(record);
    if (existingIds.has(law.id)) {
      continue;
    }
    await fs.appendFile(NOCR_PLANET_FILE, `${JSON.stringify(law)}\n`, "utf8");
    existingIds.add(law.id);
    appended.push(law);
  }
  return [...laws, ...appended];
}

export function assertNocrLedgerPlanetParity(records: NocrLedgerRecord[], laws: NocrPlanetRootLaw[]): void {
  const parity = verifyNocrLedgerPlanetParity(records, laws);
  if (!parity.ok) {
    throw new Error(
      `NOCR ledger/planet parity failed. missing=${parity.missingLawIds.join(",") || "none"} extra=${parity.extraLawIds.join(",") || "none"}`,
    );
  }
}
