import { promises as fs } from "node:fs";
import path from "node:path";
import type { NslLedgerRecord, NslPlanetRootLaw } from "@/lib/nsl/types";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const NSL_PLANET_FILE = path.join(LEDGER_DIR, "nsl-planet-roots.jsonl");

export async function appendNslPlanetRootLaw(record: NslLedgerRecord): Promise<NslPlanetRootLaw> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const law = materializeNslPlanetRootLaw(record);
  await fs.appendFile(NSL_PLANET_FILE, `${JSON.stringify(law)}\n`, "utf8");
  return law;
}

export async function readAllNslPlanetRootLaws(): Promise<NslPlanetRootLaw[]> {
  try {
    const raw = await fs.readFile(NSL_PLANET_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as NslPlanetRootLaw);
  } catch {
    return [];
  }
}

export function materializeNslPlanetRootLaw(record: NslLedgerRecord): NslPlanetRootLaw {
  return {
    id: `NSL.PLANET.${record.eventType}.${String(record.index + 1).padStart(6, "0")}`,
    parentTag: `parent.nsl.${record.eventType.toLowerCase()}.${String(record.index + 1).padStart(6, "0")}`,
    planet: "nsl",
    sourceLedgerIndex: record.index,
    sourceEventType: record.eventType,
    text: `NSL ${record.eventType.toLowerCase()} record is immutable and parent-tagged on the NSL repair planet with repairs ${record.payload.triggeredRepairs.join(", ") || "none"} and failure classes ${record.payload.failureClasses.join(", ") || "none"}.`,
    createdAt: record.payload.createdAt,
  };
}

export function verifyNslLedgerPlanetParity(records: NslLedgerRecord[], laws: NslPlanetRootLaw[]): {
  ok: boolean;
  missingLawIds: string[];
  extraLawIds: string[];
} {
  const expectedIds = new Set(records.map((record) => materializeNslPlanetRootLaw(record).id));
  const actualIds = new Set(laws.map((law) => law.id));
  const missingLawIds = [...expectedIds].filter((id) => !actualIds.has(id));
  const extraLawIds = [...actualIds].filter((id) => !expectedIds.has(id));
  return {
    ok: missingLawIds.length === 0 && extraLawIds.length === 0,
    missingLawIds,
    extraLawIds,
  };
}
