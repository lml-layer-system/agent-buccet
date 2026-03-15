import { promises as fs } from "node:fs";
import path from "node:path";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const CODING_REAL_REPO_LEDGER_FILE = path.join(LEDGER_DIR, "coding-real-repo-ledger.jsonl");

export type CodingRealRepoLedgerEventType = "REAL_REPO_SUITE_RUN_COMPLETED";

export type CodingRealRepoCommandResult = {
  repo: string;
  command: string;
  ok: boolean;
  status?: "passed" | "failed" | "blocked";
  failureCount: number;
  summary: string;
};

export type CodingRealRepoLedgerPayload = {
  createdAt: string;
  reportPath: string;
  planet: "ability";
  ontologyStatus: "aligned";
  lawIds: string[];
  suiteId: string;
  repoResults: CodingRealRepoCommandResult[];
};

export type CodingRealRepoLedgerRecord = {
  index: number;
  eventType: CodingRealRepoLedgerEventType;
  payload: CodingRealRepoLedgerPayload;
};

export async function appendCodingRealRepoLedger(
  eventType: CodingRealRepoLedgerEventType,
  payload: CodingRealRepoLedgerPayload,
): Promise<CodingRealRepoLedgerRecord> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const records = await readAllCodingRealRepoLedgerRecords();
  const record: CodingRealRepoLedgerRecord = {
    index: records.length,
    eventType,
    payload,
  };
  await fs.appendFile(CODING_REAL_REPO_LEDGER_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function readAllCodingRealRepoLedgerRecords(): Promise<CodingRealRepoLedgerRecord[]> {
  try {
    const raw = await fs.readFile(CODING_REAL_REPO_LEDGER_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CodingRealRepoLedgerRecord);
  } catch {
    return [];
  }
}
