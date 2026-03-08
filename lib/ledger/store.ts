import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DemoModelCallPayload, LedgerPayload, LedgerRecord, ProductMutationPayload, ReplayProof } from "./types.ts";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const LEDGER_FILE = path.join(LEDGER_DIR, "snap-ledger.jsonl");

export async function appendSnapRunLedger(payload: LedgerPayload): Promise<LedgerRecord> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const records = await readAllLedgerRecords();

  const last = records.length > 0 ? records[records.length - 1] : null;
  const index = records.length;
  const prevDigest = last?.digest ?? null;
  const digest = computeDigest(index, payload, prevDigest);

  const record: LedgerRecord = {
    index,
    eventType: "SNAP_RUN",
    payload,
    prevDigest,
    digest,
  };

  await fs.appendFile(LEDGER_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function appendProductMutationLedger(payload: ProductMutationPayload): Promise<LedgerRecord> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const records = await readAllLedgerRecords();

  const last = records.length > 0 ? records[records.length - 1] : null;
  const index = records.length;
  const prevDigest = last?.digest ?? null;
  const digest = computeDigest(index, payload, prevDigest);

  const record: LedgerRecord = {
    index,
    eventType: "PRODUCT_MUTATION",
    payload,
    prevDigest,
    digest,
  };

  await fs.appendFile(LEDGER_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function appendDemoModelCallLedger(payload: DemoModelCallPayload): Promise<LedgerRecord> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  const records = await readAllLedgerRecords();

  const last = records.length > 0 ? records[records.length - 1] : null;
  const index = records.length;
  const prevDigest = last?.digest ?? null;
  const digest = computeDigest(index, payload, prevDigest);

  const record: LedgerRecord = {
    index,
    eventType: "DEMO_MODEL_CALL",
    payload,
    prevDigest,
    digest,
  };

  await fs.appendFile(LEDGER_FILE, `${JSON.stringify(record)}\n`, "utf8");
  return record;
}

export async function replaySnapRunById(runId: string): Promise<ReplayProof> {
  const records = await readAllLedgerRecords();
  const verificationFailures = verifyLedgerChain(records);
  const record = records.find((item) => isSnapRunRecord(item) && item.payload.runId === runId) ?? null;

  return {
    runId,
    found: Boolean(record),
    verified: verificationFailures.length === 0,
    record,
    chainLength: records.length,
    verificationFailures,
  };
}

export async function readAllLedgerRecords(): Promise<LedgerRecord[]> {
  try {
    const raw = await fs.readFile(LEDGER_FILE, "utf8");
    const lines = raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    const parsed: LedgerRecord[] = [];
    for (const line of lines) {
      parsed.push(JSON.parse(line) as LedgerRecord);
    }

    return parsed;
  } catch {
    return [];
  }
}

export function verifyLedgerChain(records: LedgerRecord[]): string[] {
  const failures: string[] = [];

  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    const expectedPrev = i === 0 ? null : records[i - 1].digest;
    if (record.prevDigest !== expectedPrev) {
      failures.push(`prevDigest mismatch at index ${i}`);
    }

    const expectedDigest = computeDigest(record.index, record.payload, record.prevDigest);
    if (record.digest !== expectedDigest) {
      failures.push(`digest mismatch at index ${i}`);
    }

    if (record.index !== i) {
      failures.push(`index mismatch at index ${i}`);
    }
  }

  return failures;
}

function computeDigest(
  index: number,
  payload: LedgerPayload | ProductMutationPayload | DemoModelCallPayload,
  prevDigest: string | null,
): string {
  const canonical = JSON.stringify({ index, payload, prevDigest });
  return createHash("sha256").update(canonical).digest("hex");
}

function isSnapRunRecord(
  record: LedgerRecord,
): record is LedgerRecord & { eventType: "SNAP_RUN"; payload: LedgerPayload } {
  return record.eventType === "SNAP_RUN" && "runId" in record.payload;
}
