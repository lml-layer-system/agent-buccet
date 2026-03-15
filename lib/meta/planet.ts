import { promises as fs } from "node:fs";
import path from "node:path";
import type { MetaDeliveryLedgerRecord, MetaDeliveryPlanetRootLaw } from "./types";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const META_DELIVERY_PLANET_FILE = path.join(LEDGER_DIR, "meta-delivery-planet-roots.jsonl");

export async function appendMetaDeliveryPlanetRootLaw(record: MetaDeliveryLedgerRecord): Promise<MetaDeliveryPlanetRootLaw> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const law = materializeMetaDeliveryPlanetRootLaw(record);
  await fs.appendFile(META_DELIVERY_PLANET_FILE, `${JSON.stringify(law)}\n`, "utf8");
  return law;
}

export async function readAllMetaDeliveryPlanetRootLaws(): Promise<MetaDeliveryPlanetRootLaw[]> {
  try {
    const raw = await fs.readFile(META_DELIVERY_PLANET_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as MetaDeliveryPlanetRootLaw);
  } catch {
    return [];
  }
}

export function materializeMetaDeliveryPlanetRootLaw(record: MetaDeliveryLedgerRecord): MetaDeliveryPlanetRootLaw {
  return {
    id: `META.DELIVERY.${record.eventType}.${String(record.index + 1).padStart(6, "0")}`,
    parentTag: `parent.meta_delivery.${record.eventType.toLowerCase()}.${String(record.index + 1).padStart(6, "0")}`,
    planet: "meta_delivery",
    sourceLedgerIndex: record.index,
    sourceEventType: record.eventType,
    text: `Meta delivery ${record.eventType.toLowerCase()} record is immutable and parent-tagged for source ${record.payload.source} with enforcement ${record.payload.enforcement}.`,
    createdAt: record.payload.createdAt,
  };
}

export function verifyMetaDeliveryLedgerPlanetParity(
  records: MetaDeliveryLedgerRecord[],
  laws: MetaDeliveryPlanetRootLaw[],
): {
  ok: boolean;
  missingLawIds: string[];
  extraLawIds: string[];
} {
  const expectedIds = new Set(records.map((record) => materializeMetaDeliveryPlanetRootLaw(record).id));
  const actualIds = new Set(laws.map((law) => law.id));
  const missingLawIds = [...expectedIds].filter((id) => !actualIds.has(id));
  const extraLawIds = [...actualIds].filter((id) => !expectedIds.has(id));
  return {
    ok: missingLawIds.length === 0 && extraLawIds.length === 0,
    missingLawIds,
    extraLawIds,
  };
}
