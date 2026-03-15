import { promises as fs } from "node:fs";
import path from "node:path";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const CODING_COVERAGE_LEDGER_FILE = path.join(LEDGER_DIR, "coding-coverage-ledger.jsonl");

export type CodingCoverageSlice = "app_task" | "hostile_family";
export type CodingCoverageLedgerEventType =
  | "APP_TASK_COVERAGE_COMPLETED"
  | "HOSTILE_PACK_COVERAGE_COMPLETED";

export type CodingCoverageLedgerPayload = {
  createdAt: string;
  reportPath: string;
  planet: "ability";
  ontologyStatus: "aligned";
  slice: CodingCoverageSlice;
  lawIds: string[];
  metrics: Record<string, number>;
};

export type CodingCoverageLedgerRecord = {
  index: number;
  eventType: CodingCoverageLedgerEventType;
  payload: CodingCoverageLedgerPayload;
};

export async function appendCodingCoverageLedger(
  eventType: CodingCoverageLedgerEventType,
  payload: CodingCoverageLedgerPayload,
): Promise<CodingCoverageLedgerRecord> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const records = await readAllCodingCoverageLedgerRecords();
  const record: CodingCoverageLedgerRecord = {
    index: records.length,
    eventType,
    payload,
  };
  await fs.appendFile(CODING_COVERAGE_LEDGER_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function readAllCodingCoverageLedgerRecords(): Promise<CodingCoverageLedgerRecord[]> {
  try {
    const raw = await fs.readFile(CODING_COVERAGE_LEDGER_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CodingCoverageLedgerRecord);
  } catch {
    return [];
  }
}
