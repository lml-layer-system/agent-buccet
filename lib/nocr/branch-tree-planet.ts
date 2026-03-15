import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  BranchTreePlanetRootLaw,
  NocrCollapseLedgerPayload,
  NocrCollapseMatchLedgerPayload,
  NocrLedgerRecord,
  NocrLifecycleLedgerPayload,
} from "@/lib/nocr/types";
import { findNocrRecordsByBranchId, findNocrRecordsByTreeId } from "@/lib/nocr/ledger";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const BRANCH_TREE_PLANET_FILE = path.join(LEDGER_DIR, "branch-tree-planet-roots.jsonl");

export function isBranchTreePlanetEligibleRecord(
  record: NocrLedgerRecord,
): record is NocrLedgerRecord & {
  eventType: BranchTreePlanetRootLaw["sourceEventType"];
} {
  return record.eventType === "COLLAPSE_RESOLVED"
    || record.eventType === "COLLAPSE_MATCH_RESOLVED"
    || record.eventType === "BRANCH_EXTENDED"
    || record.eventType === "TREE_EXTENDED"
    || record.eventType === "TREE_STARTED"
    || record.eventType === "BRANCH_FORKED"
    || record.eventType === "BRANCH_SIBLING_CREATED"
    || record.eventType === "BRANCH_MERGED"
    || record.eventType === "BRANCH_CLOSED"
    || record.eventType === "BRANCH_ARCHIVED"
    || record.eventType === "TREE_ARCHIVED"
    || record.eventType === "BRANCH_DELETED"
    || record.eventType === "TREE_DELETED";
}

export async function appendBranchTreePlanetRootLaw(record: NocrLedgerRecord): Promise<BranchTreePlanetRootLaw | null> {
  if (!isBranchTreePlanetEligibleRecord(record)) {
    return null;
  }
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const law = materializeBranchTreePlanetRootLaw(record);
  await fs.appendFile(BRANCH_TREE_PLANET_FILE, `${JSON.stringify(law)}\n`, "utf8");
  return law;
}

export async function readAllBranchTreePlanetRootLaws(): Promise<BranchTreePlanetRootLaw[]> {
  try {
    const raw = await fs.readFile(BRANCH_TREE_PLANET_FILE, "utf8");
    return raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as BranchTreePlanetRootLaw);
  } catch {
    return [];
  }
}

export function materializeBranchTreePlanetRootLaw(
  record: NocrLedgerRecord & { eventType: BranchTreePlanetRootLaw["sourceEventType"] },
): BranchTreePlanetRootLaw {
  if (record.eventType === "COLLAPSE_RESOLVED") {
    const payload = record.payload as NocrCollapseLedgerPayload;
    return {
      id: `BRANCH.TREE.COLLAPSE.${String(record.index + 1).padStart(6, "0")}`,
      parentTag: `parent.branch_tree.collapse.${String(record.index + 1).padStart(6, "0")}`,
      planet: "branch_tree",
      sourceLedgerIndex: record.index,
      sourceEventType: record.eventType,
      text: `Branch-tree lock ${payload.branchId} in ${payload.treeId} is immutable and parent-tagged on the branch/tree planet for seed ${payload.seedTag} meeting root ${payload.rootTag}.`,
      createdAt: payload.createdAt,
    };
  }

  if (record.eventType === "COLLAPSE_MATCH_RESOLVED") {
    const payload = record.payload as NocrCollapseMatchLedgerPayload;
    return {
      id: `BRANCH.TREE.MATCH.${String(record.index + 1).padStart(6, "0")}`,
      parentTag: `parent.branch_tree.match.${String(record.index + 1).padStart(6, "0")}`,
      planet: "branch_tree",
      sourceLedgerIndex: record.index,
      sourceEventType: record.eventType,
      text: `Branch-tree snap match ${payload.seedTag} meeting ${payload.rootTag} is immutable and parent-tagged on the branch/tree planet for branch ${payload.branchId} in tree ${payload.treeId}.`,
      createdAt: payload.createdAt,
    };
  }

  const payload = record.payload as NocrLifecycleLedgerPayload;
  return {
    id: `BRANCH.TREE.${record.eventType}.${String(record.index + 1).padStart(6, "0")}`,
    parentTag: `parent.branch_tree.${record.eventType.toLowerCase()}.${String(record.index + 1).padStart(6, "0")}`,
    planet: "branch_tree",
    sourceLedgerIndex: record.index,
    sourceEventType: record.eventType,
    text: `Branch-tree lifecycle ${record.eventType.toLowerCase()} is immutable and parent-tagged on the branch/tree planet for branch ${payload.branchId} in tree ${payload.treeId}.`,
    createdAt: payload.createdAt,
  };
}

export function verifyBranchTreePlanetParity(
  records: NocrLedgerRecord[],
  laws: BranchTreePlanetRootLaw[],
): {
  ok: boolean;
  missingLawIds: string[];
  extraLawIds: string[];
} {
  const eligible = records.filter(isBranchTreePlanetEligibleRecord);
  const expectedIds = new Set(eligible.map((record) => materializeBranchTreePlanetRootLaw(record).id));
  const actualIds = new Set(laws.map((law) => law.id));
  const missingLawIds = [...expectedIds].filter((id) => !actualIds.has(id));
  const extraLawIds = [...actualIds].filter((id) => !expectedIds.has(id));
  return {
    ok: missingLawIds.length === 0 && extraLawIds.length === 0,
    missingLawIds,
    extraLawIds,
  };
}

export async function syncBranchTreePlanetFromNocrLedger(records: NocrLedgerRecord[]): Promise<BranchTreePlanetRootLaw[]> {
  const laws = await readAllBranchTreePlanetRootLaws();
  const existingIds = new Set(laws.map((law) => law.id));
  const appended: BranchTreePlanetRootLaw[] = [];
  for (const record of records.filter(isBranchTreePlanetEligibleRecord)) {
    const law = materializeBranchTreePlanetRootLaw(record);
    if (existingIds.has(law.id)) {
      continue;
    }
    await fs.mkdir(LEDGER_DIR, { recursive: true });
    await fs.appendFile(BRANCH_TREE_PLANET_FILE, `${JSON.stringify(law)}\n`, "utf8");
    existingIds.add(law.id);
    appended.push(law);
  }
  return [...laws, ...appended];
}

export async function findBranchTreePlanetLawsByBranchId(branchId: string): Promise<BranchTreePlanetRootLaw[]> {
  const records = await findNocrRecordsByBranchId(branchId);
  return records
    .filter(isBranchTreePlanetEligibleRecord)
    .map((record) => materializeBranchTreePlanetRootLaw(record));
}

export async function findBranchTreePlanetLawsByTreeId(treeId: string): Promise<BranchTreePlanetRootLaw[]> {
  const records = await findNocrRecordsByTreeId(treeId);
  return records
    .filter(isBranchTreePlanetEligibleRecord)
    .map((record) => materializeBranchTreePlanetRootLaw(record));
}
