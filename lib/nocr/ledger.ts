import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  NocrCollapseLedgerPayload,
  NocrCollapseMatchLedgerPayload,
  NocrClippedLedgerPayload,
  NocrFunnelLedgerPayload,
  NocrLedgerRecord,
  NocrLifecycleLedgerPayload,
} from "@/lib/nocr/types";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const NOCR_LEDGER_FILE = path.join(LEDGER_DIR, "nocr-ledger.jsonl");

export async function appendNocrFunnelLedger(payload: NocrFunnelLedgerPayload): Promise<NocrLedgerRecord> {
  return appendRecord("FUNNEL_TAGGED", payload);
}

export async function appendNocrCollapseLedger(payload: NocrCollapseLedgerPayload): Promise<NocrLedgerRecord> {
  return appendRecord("COLLAPSE_RESOLVED", payload);
}

export async function appendNocrCollapseMatchLedger(payload: NocrCollapseMatchLedgerPayload): Promise<NocrLedgerRecord> {
  return appendRecord("COLLAPSE_MATCH_RESOLVED", payload);
}

export async function appendNocrCollapseClippedLedger(payload: NocrClippedLedgerPayload): Promise<NocrLedgerRecord> {
  return appendRecord("COLLAPSE_CLIPPED", payload);
}

export async function appendNocrBranchExtendedLedger(payload: NocrLifecycleLedgerPayload): Promise<NocrLedgerRecord> {
  return appendRecord("BRANCH_EXTENDED", payload);
}

export async function appendNocrTreeExtendedLedger(payload: NocrLifecycleLedgerPayload): Promise<NocrLedgerRecord> {
  return appendRecord("TREE_EXTENDED", payload);
}

export async function appendNocrTreeStartedLedger(payload: NocrLifecycleLedgerPayload): Promise<NocrLedgerRecord> {
  return appendRecord("TREE_STARTED", payload);
}

export async function appendNocrBranchForkedLedger(payload: NocrLifecycleLedgerPayload): Promise<NocrLedgerRecord> {
  return appendRecord("BRANCH_FORKED", payload);
}

export async function appendNocrBranchSiblingCreatedLedger(payload: NocrLifecycleLedgerPayload): Promise<NocrLedgerRecord> {
  return appendRecord("BRANCH_SIBLING_CREATED", payload);
}

export async function appendNocrBranchMergedLedger(payload: NocrLifecycleLedgerPayload): Promise<NocrLedgerRecord> {
  return appendRecord("BRANCH_MERGED", payload);
}

export async function appendNocrBranchClosedLedger(payload: NocrLifecycleLedgerPayload): Promise<NocrLedgerRecord> {
  return appendRecord("BRANCH_CLOSED", payload);
}

export async function appendNocrBranchArchivedLedger(payload: NocrLifecycleLedgerPayload): Promise<NocrLedgerRecord> {
  return appendRecord("BRANCH_ARCHIVED", payload);
}

export async function appendNocrTreeArchivedLedger(payload: NocrLifecycleLedgerPayload): Promise<NocrLedgerRecord> {
  return appendRecord("TREE_ARCHIVED", payload);
}

export async function appendNocrBranchDeletedLedger(payload: NocrLifecycleLedgerPayload): Promise<NocrLedgerRecord> {
  return appendRecord("BRANCH_DELETED", payload);
}

export async function appendNocrTreeDeletedLedger(payload: NocrLifecycleLedgerPayload): Promise<NocrLedgerRecord> {
  return appendRecord("TREE_DELETED", payload);
}

export async function readAllNocrLedgerRecords(): Promise<NocrLedgerRecord[]> {
  try {
    const raw = await fs.readFile(NOCR_LEDGER_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as NocrLedgerRecord);
  } catch {
    return [];
  }
}

export async function findNocrRecordsBySeedTag(seedTag: string): Promise<NocrLedgerRecord[]> {
  const records = await readAllNocrLedgerRecords();
  return records.filter((record) => "seedTag" in record.payload && record.payload.seedTag === seedTag);
}

export async function findNocrRecordsByRootTag(rootTag: string): Promise<NocrLedgerRecord[]> {
  const records = await readAllNocrLedgerRecords();
  return records.filter((record) => "rootTag" in record.payload && record.payload.rootTag === rootTag);
}

export async function findNocrRecordsByBranchId(branchId: string): Promise<NocrLedgerRecord[]> {
  const records = await readAllNocrLedgerRecords();
  return records.filter((record) => "branchId" in record.payload && record.payload.branchId === branchId);
}

export async function findNocrRecordsByTreeId(treeId: string): Promise<NocrLedgerRecord[]> {
  const records = await readAllNocrLedgerRecords();
  return records.filter((record) => "treeId" in record.payload && record.payload.treeId === treeId);
}

async function appendRecord(
  eventType: NocrLedgerRecord["eventType"],
  payload:
    | NocrFunnelLedgerPayload
    | NocrCollapseLedgerPayload
    | NocrCollapseMatchLedgerPayload
    | NocrClippedLedgerPayload
    | NocrLifecycleLedgerPayload,
): Promise<NocrLedgerRecord> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const records = await readAllNocrLedgerRecords();
  const record: NocrLedgerRecord = {
    index: records.length,
    eventType,
    payload,
  };
  await fs.appendFile(NOCR_LEDGER_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}
