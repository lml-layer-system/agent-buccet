import { promises as fs } from "node:fs";
import path from "node:path";
import type { MetaDeliveryEventType, MetaDeliveryLedgerRecord, MetaDeliveryPayload } from "./types";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const META_DELIVERY_LEDGER_FILE = path.join(LEDGER_DIR, "meta-delivery-ledger.jsonl");

export async function appendMetaDeliveryLedger(
  eventType: MetaDeliveryEventType,
  payload: MetaDeliveryPayload,
): Promise<MetaDeliveryLedgerRecord> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const records = await readAllMetaDeliveryLedgerRecords();
  const record: MetaDeliveryLedgerRecord = {
    index: records.length,
    eventType,
    payload,
  };
  await fs.appendFile(META_DELIVERY_LEDGER_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function readAllMetaDeliveryLedgerRecords(): Promise<MetaDeliveryLedgerRecord[]> {
  try {
    const raw = await fs.readFile(META_DELIVERY_LEDGER_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as MetaDeliveryLedgerRecord);
  } catch {
    return [];
  }
}
