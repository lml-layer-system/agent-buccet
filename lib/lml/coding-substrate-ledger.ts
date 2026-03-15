import { promises as fs } from "node:fs";
import path from "node:path";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const CODING_SUBSTRATE_LEDGER_FILE = path.join(LEDGER_DIR, "coding-substrate-ledger.jsonl");

export type CodingSubstrateLedgerEventType = "SUBSTRATE_ALIGNMENT_COMPLETED";

export type CodingSubstrateLedgerPayload = {
  createdAt: string;
  reportPath: string;
  planet: "ability";
  ontologyStatus: "aligned";
  lawIds: string[];
  substrateFeatures: string[];
  integratedInputs: string[];
};

export type CodingSubstrateLedgerRecord = {
  index: number;
  eventType: CodingSubstrateLedgerEventType;
  payload: CodingSubstrateLedgerPayload;
};

export async function appendCodingSubstrateLedger(
  eventType: CodingSubstrateLedgerEventType,
  payload: CodingSubstrateLedgerPayload,
): Promise<CodingSubstrateLedgerRecord> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const records = await readAllCodingSubstrateLedgerRecords();
  const record: CodingSubstrateLedgerRecord = {
    index: records.length,
    eventType,
    payload,
  };
  await fs.appendFile(CODING_SUBSTRATE_LEDGER_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function readAllCodingSubstrateLedgerRecords(): Promise<CodingSubstrateLedgerRecord[]> {
  try {
    const raw = await fs.readFile(CODING_SUBSTRATE_LEDGER_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CodingSubstrateLedgerRecord);
  } catch {
    return [];
  }
}
