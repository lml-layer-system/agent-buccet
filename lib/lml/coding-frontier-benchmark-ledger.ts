import { promises as fs } from "node:fs";
import path from "node:path";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const CODING_FRONTIER_BENCHMARK_LEDGER_FILE = path.join(LEDGER_DIR, "coding-frontier-benchmark-ledger.jsonl");

export type CodingFrontierBenchmarkLedgerEventType = "FRONTIER_BENCHMARK_WAVE_COMPLETED";

export type CodingFrontierBenchmarkLedgerPayload = {
  createdAt: string;
  reportPath: string;
  planet: "ability";
  ontologyStatus: "aligned";
  lawIds: string[];
  benchmark: string;
  waveId: string;
  runtime: string;
  instanceIds: string[];
  totalInstances: number;
  passedInstances: number;
  blockedInstances: number;
  summary: string;
};

export type CodingFrontierBenchmarkLedgerRecord = {
  index: number;
  eventType: CodingFrontierBenchmarkLedgerEventType;
  payload: CodingFrontierBenchmarkLedgerPayload;
};

export async function appendCodingFrontierBenchmarkLedger(
  eventType: CodingFrontierBenchmarkLedgerEventType,
  payload: CodingFrontierBenchmarkLedgerPayload,
): Promise<CodingFrontierBenchmarkLedgerRecord> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const records = await readAllCodingFrontierBenchmarkLedgerRecords();
  const record: CodingFrontierBenchmarkLedgerRecord = {
    index: records.length,
    eventType,
    payload,
  };
  await fs.appendFile(CODING_FRONTIER_BENCHMARK_LEDGER_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function readAllCodingFrontierBenchmarkLedgerRecords(): Promise<CodingFrontierBenchmarkLedgerRecord[]> {
  try {
    const raw = await fs.readFile(CODING_FRONTIER_BENCHMARK_LEDGER_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CodingFrontierBenchmarkLedgerRecord);
  } catch {
    return [];
  }
}
