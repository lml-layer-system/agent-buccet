import { promises as fs } from "node:fs";
import path from "node:path";
import type { NslLedgerEventType, NslLedgerRecord, NslRepairLedgerPayload } from "@/lib/nsl/types";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const NSL_LEDGER_FILE = path.join(LEDGER_DIR, "nsl-ledger.jsonl");

export async function appendNslRepairLedger(
  eventType: NslLedgerEventType,
  payload: NslRepairLedgerPayload,
): Promise<NslLedgerRecord> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const records = await readAllNslLedgerRecords();
  const record: NslLedgerRecord = {
    index: records.length,
    eventType,
    payload,
  };
  await fs.appendFile(NSL_LEDGER_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function readAllNslLedgerRecords(): Promise<NslLedgerRecord[]> {
  try {
    const raw = await fs.readFile(NSL_LEDGER_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as NslLedgerRecord);
  } catch {
    return [];
  }
}
