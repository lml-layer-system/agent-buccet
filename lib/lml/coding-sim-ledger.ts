import { promises as fs } from "node:fs";
import path from "node:path";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const CODING_SIM_LEDGER_FILE = path.join(LEDGER_DIR, "coding-sim-ledger.jsonl");

export type CodingSimLedgerEventType = "SIM_RUN_COMPLETED";

export type CodingSimLedgerPayload = {
  createdAt: string;
  reportPath: string;
  scenarios: number;
  visitedNodes: number;
  survivors: number;
  pruned: number;
  structuralPruned: number;
  rootPruned: number;
  metaRootPruned: number;
  uncoveredMetaRoots: number;
  coveredFamilies: string[];
  missingFamilies: string[];
  byDimension: Record<string, number>;
  byTrunk: Record<string, number>;
  byRoot: Record<string, number>;
  byMetaRoot: Record<string, number>;
  byUniversalGroup: Record<string, number>;
  byFamilyDimension: Record<string, Record<string, number>>;
};

export type CodingSimLedgerRecord = {
  index: number;
  eventType: CodingSimLedgerEventType;
  payload: CodingSimLedgerPayload;
};

export async function appendCodingSimLedger(
  eventType: CodingSimLedgerEventType,
  payload: CodingSimLedgerPayload,
): Promise<CodingSimLedgerRecord> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const records = await readAllCodingSimLedgerRecords();
  const record: CodingSimLedgerRecord = {
    index: records.length,
    eventType,
    payload,
  };
  await fs.appendFile(CODING_SIM_LEDGER_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function readAllCodingSimLedgerRecords(): Promise<CodingSimLedgerRecord[]> {
  try {
    const raw = await fs.readFile(CODING_SIM_LEDGER_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as CodingSimLedgerRecord);
  } catch {
    return [];
  }
}
