import { promises as fs } from "node:fs";
import path from "node:path";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const CODING_BENCHMARK_TIER2_LEDGER_FILE = path.join(LEDGER_DIR, "coding-benchmark-tier2-ledger.jsonl");

export type CodingBenchmarkTier2LedgerEventType = "BENCHMARK_TIER2_RUN_COMPLETED";

export type CodingBenchmarkTier2CommandResult = {
  repo: string;
  command: string;
  ok: boolean;
  failureCount: number;
  summary: string;
};

export type CodingBenchmarkTier2LedgerPayload = {
  createdAt: string;
  reportPath: string;
  planet: "ability";
  ontologyStatus: "aligned";
  lawIds: string[];
  repoResults: CodingBenchmarkTier2CommandResult[];
};

export type CodingBenchmarkTier2LedgerRecord = {
  index: number;
  eventType: CodingBenchmarkTier2LedgerEventType;
  payload: CodingBenchmarkTier2LedgerPayload;
};

export async function appendCodingBenchmarkTier2Ledger(
  eventType: CodingBenchmarkTier2LedgerEventType,
  payload: CodingBenchmarkTier2LedgerPayload,
): Promise<CodingBenchmarkTier2LedgerRecord> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const records = await readAllCodingBenchmarkTier2LedgerRecords();
  const record: CodingBenchmarkTier2LedgerRecord = {
    index: records.length,
    eventType,
    payload,
  };
  await fs.appendFile(CODING_BENCHMARK_TIER2_LEDGER_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function readAllCodingBenchmarkTier2LedgerRecords(): Promise<CodingBenchmarkTier2LedgerRecord[]> {
  try {
    const raw = await fs.readFile(CODING_BENCHMARK_TIER2_LEDGER_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CodingBenchmarkTier2LedgerRecord);
  } catch {
    return [];
  }
}
