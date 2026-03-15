import { promises as fs } from "node:fs";
import path from "node:path";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const CODING_BENCHMARK_LEDGER_FILE = path.join(LEDGER_DIR, "coding-benchmark-ledger.jsonl");

export type CodingBenchmarkLedgerEventType = "BENCHMARK_RUN_COMPLETED";

export type CodingBenchmarkRepoResult = {
  repo: string;
  present: boolean;
  command: string;
  ok: boolean;
  taskCount: number;
  passedTaskCount: number;
};

export type CodingBenchmarkLedgerPayload = {
  createdAt: string;
  reportPath: string;
  planet: "ability";
  ontologyStatus: "aligned";
  lawIds: string[];
  repoResults: CodingBenchmarkRepoResult[];
};

export type CodingBenchmarkLedgerRecord = {
  index: number;
  eventType: CodingBenchmarkLedgerEventType;
  payload: CodingBenchmarkLedgerPayload;
};

export async function appendCodingBenchmarkLedger(
  eventType: CodingBenchmarkLedgerEventType,
  payload: CodingBenchmarkLedgerPayload,
): Promise<CodingBenchmarkLedgerRecord> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const records = await readAllCodingBenchmarkLedgerRecords();
  const record: CodingBenchmarkLedgerRecord = {
    index: records.length,
    eventType,
    payload,
  };
  await fs.appendFile(CODING_BENCHMARK_LEDGER_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function readAllCodingBenchmarkLedgerRecords(): Promise<CodingBenchmarkLedgerRecord[]> {
  try {
    const raw = await fs.readFile(CODING_BENCHMARK_LEDGER_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CodingBenchmarkLedgerRecord);
  } catch {
    return [];
  }
}
