import { promises as fs } from "node:fs";
import path from "node:path";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const CODING_EFUE_LEDGER_FILE = path.join(LEDGER_DIR, "coding-efue-ledger.jsonl");

export type CodingEfueLedgerEventType = "EFUE_LAW_ALIGNMENT_COMPLETED";

export type CodingEfueLedgerPayload = {
  createdAt: string;
  reportPath: string;
  planet: "ability";
  ontologyStatus: "aligned";
  lawRange: string;
  lawCount: number;
  hiddenFailureClassCount: number;
  dimensionCount: number;
  metaPrincipleCount: number;
};

export type CodingEfueLedgerRecord = {
  index: number;
  eventType: CodingEfueLedgerEventType;
  payload: CodingEfueLedgerPayload;
};

export async function appendCodingEfueLedger(
  eventType: CodingEfueLedgerEventType,
  payload: CodingEfueLedgerPayload,
): Promise<CodingEfueLedgerRecord> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const records = await readAllCodingEfueLedgerRecords();
  const record: CodingEfueLedgerRecord = {
    index: records.length,
    eventType,
    payload,
  };
  await fs.appendFile(CODING_EFUE_LEDGER_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function readAllCodingEfueLedgerRecords(): Promise<CodingEfueLedgerRecord[]> {
  try {
    const raw = await fs.readFile(CODING_EFUE_LEDGER_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CodingEfueLedgerRecord);
  } catch {
    return [];
  }
}
