import { promises as fs } from "node:fs";
import path from "node:path";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const CODING_REPO_PRESSURE_LEDGER_FILE = path.join(LEDGER_DIR, "coding-repo-pressure-ledger.jsonl");

export type CodingRepoPressureLedgerEventType = "REPO_PRESSURE_ALIGNMENT_COMPLETED";

export type CodingRepoPressureLedgerPayload = {
  createdAt: string;
  reportPath: string;
  planet: "ability";
  ontologyStatus: "aligned";
  lawIds: string[];
  metrics: Record<string, number>;
};

export type CodingRepoPressureLedgerRecord = {
  index: number;
  eventType: CodingRepoPressureLedgerEventType;
  payload: CodingRepoPressureLedgerPayload;
};

export async function appendCodingRepoPressureLedger(
  eventType: CodingRepoPressureLedgerEventType,
  payload: CodingRepoPressureLedgerPayload,
): Promise<CodingRepoPressureLedgerRecord> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const records = await readAllCodingRepoPressureLedgerRecords();
  const record: CodingRepoPressureLedgerRecord = {
    index: records.length,
    eventType,
    payload,
  };
  await fs.appendFile(CODING_REPO_PRESSURE_LEDGER_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function readAllCodingRepoPressureLedgerRecords(): Promise<CodingRepoPressureLedgerRecord[]> {
  try {
    const raw = await fs.readFile(CODING_REPO_PRESSURE_LEDGER_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CodingRepoPressureLedgerRecord);
  } catch {
    return [];
  }
}
