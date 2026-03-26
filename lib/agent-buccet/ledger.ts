import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";
import { promises as fs } from "node:fs";
import net from "node:net";
import { once } from "node:events";
import path from "node:path";
import type {
  BoundaryLedgerCheckpoint,
  BoundaryDecision,
  BoundaryLedgerDecisionBlock,
  BoundaryLedgerDecisionVerdict,
  BoundaryLedgerEventType,
  BoundaryLedgerInput,
  BoundaryLedgerNextBlock,
  BoundaryLedgerNextOutcome,
  BoundaryLedgerOptionsBlock,
  BoundaryLedgerPathBlock,
  BoundaryLedgerPayload,
  BoundaryLedgerRecord,
} from "./types.ts";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const BOUNDARY_LEDGER_FILE = path.join(LEDGER_DIR, "agent-boundary-ledger.jsonl");
const BOUNDARY_LEDGER_WAL_FILE = path.join(LEDGER_DIR, "agent-boundary-ledger.wal.jsonl");
const INDEX_DIR = path.join(LEDGER_DIR, "indexes");
const ROLLUP_DIR = path.join(LEDGER_DIR, "rollups");
const LOCK_FILE = path.join(LEDGER_DIR, "agent-boundary-ledger.lock");
const KEYS_DIR = path.join(LEDGER_DIR, "keys");
const CHECKPOINT_DIR = path.join(LEDGER_DIR, "checkpoints");
const SIGNING_PRIVATE_KEY_FILE = path.join(KEYS_DIR, "ledger-signing-private.pem");
const SIGNING_PUBLIC_KEY_FILE = path.join(KEYS_DIR, "ledger-signing-public.pem");
const LOCK_STALE_MS = 5_000;

// ─── LIOPE — Ledger I/O Physics Envelope ──────────────────────────────────────
// Three dimensions:
//   Q1.8 — Atomic Shedding Ring Buffer: bounded queue, O(1) hot path, shed overflow
//   D2.8 — Max-IOPS Background Daemon: fixed-interval flush with file rollover
//   A3.8 — Signed Magnitude Storm Events: signed LEDGER_STORM_SUMMARY when shed > 0
//
// Invariants:
//   Hot path O(1) — never blocks on disk/memory
//   Physical disk flushes bounded to floor(1000 / LIOPE_FLUSH_INTERVAL_MS) per second
//   Memory bounded to LIOPE_MAX_QUEUE_SIZE entries
//   Material state transitions bypass the queue and write immediately
//   Shed repetition collapses into a single signed LEDGER_STORM_SUMMARY per flush window

const LIOPE_MAX_QUEUE_SIZE = Math.max(1, parseInt(process.env.BUCCET_LEDGER_MAX_QUEUE_SIZE ?? "10000", 10));
const LIOPE_FLUSH_INTERVAL_MS = Math.max(10, parseInt(process.env.BUCCET_LEDGER_FLUSH_INTERVAL_MS ?? "100", 10));
const LIOPE_MAX_FILE_SIZE_BYTES = Math.max(
  1024 * 1024,
  parseInt(process.env.BUCCET_LEDGER_MAX_FILE_SIZE_BYTES ?? String(10 * 1024 * 1024), 10),
);

// Material state transitions bypass LIOPE and are written immediately.
// Only five high-volume admission observation events go through the queue:
//   INGRESS_PROVENANCE_BLOCKED, INGRESS_DENIED, INGRESS_VELOCITY_TRIP,
//   INGRESS_DENSITY_TRIP, INGRESS_MASS_TRIP.
// INGRESS_STANDING_LAW_WRITTEN is material (exactly-once standing-deny authority
// record) and bypasses the queue even though it originates from the admission path.
//
// The storm scenario: 10M unique IPs hitting the admission boundary generates
// 10M INGRESS_* observation events — those are queued/shed. Each IP gets at most
// one INGRESS_STANDING_LAW_WRITTEN (material, immediately durable). Action
// lifecycle events (PROPOSED, DECIDED, BLOCKED, EXECUTED) are material and must
// be immediately durable — they are the law boundary record.
const LIOPE_MATERIAL_EVENTS = new Set<BoundaryLedgerEventType>([
  "SESSION_STARTED", "SESSION_RESTORED", "SESSION_PERSISTED", "SESSION_ENDED",
  "PATH_OPENED", "PATH_LAW_INSTANTIATED",
  "RECIPIENT_OPENED", "RECIPIENT_LAW_INSTANTIATED",
  "DOMAIN_OPENED", "DOMAIN_LAW_INSTANTIATED",
  "TOOL_OPENED", "TOOL_LAW_INSTANTIATED",
  "DATABASE_OPENED", "DATABASE_LAW_INSTANTIATED",
  "SYSTEM_OPENED", "SYSTEM_LAW_INSTANTIATED",
  "GRANT_ISSUED", "GRANT_REVOKED", "GRANT_EXPIRED",
  "UPL_ALLOW_RECORDED", "UPL_DENY_RECORDED",
  "ACTION_PROPOSED", "DECISION_RETURNED",
  "ACTION_BLOCKED", "ACTION_EXECUTED",
  "APPROVAL_REQUESTED", "APPROVAL_GRANTED", "APPROVAL_DENIED",
  "NSL_GRANT_OFFERED", "NSL_MOVE_SUGGESTED", "NSL_MOVE_CHOSEN",
  "USER_CONFIRMED_DENY",
  "PROPOSAL_REPLAYED",
  "GOVERNOR_TRIP",
  "PROCESS_LAUNCH_REQUESTED", "PROCESS_SPAWNED", "PROCESS_EXITED", "PROCESS_BLOCKED",
  "PROCESS_ENV_FILTERED",
  "PROCESS_WALL_CLOCK_KILL",
  "PROCESS_PHYSWRAP_ACTIVE", "PROCESS_PHYSWRAP_FALLBACK", "PROCESS_PHYSWRAP_CAP_WARNING",
  "INGRESS_STANDING_LAW_WRITTEN",
  "LEDGER_STORM_SUMMARY",
  // Queueable (not listed here): INGRESS_PROVENANCE_BLOCKED, INGRESS_DENIED,
  // INGRESS_VELOCITY_TRIP, INGRESS_DENSITY_TRIP, INGRESS_MASS_TRIP
]);

type LiopeQueueEntry = {
  eventType: BoundaryLedgerEventType;
  payload: BoundaryLedgerPayload;
};

// Q1.8: pre-allocated bounded ring buffer
const liopeQueue: LiopeQueueEntry[] = [];
let liopeShedCount = 0;
const liopeShedByClass = new Map<string, number>();
let liopeWindowStartMs = Date.now();

function liopeEnqueue(eventType: BoundaryLedgerEventType, payload: BoundaryLedgerPayload): void {
  if (liopeQueue.length >= LIOPE_MAX_QUEUE_SIZE) {
    // Shed: O(1) counter increment + class tracking
    liopeShedCount++;
    liopeShedByClass.set(eventType, (liopeShedByClass.get(eventType) ?? 0) + 1);
    return;
  }
  liopeQueue.push({ eventType, payload });
}

// D2.8: max-IOPS background daemon
let liopeDaemonHandle: ReturnType<typeof setInterval> | undefined;
let liopeFlushActive = false;
let liopeDaemonDisabled = false; // set by stopLiopeDaemon(); prevents restart after stop

function ensureLiopeDaemonRunning(): void {
  if (liopeDaemonDisabled) return; // permanently stopped (e.g. during contract tests)
  if (liopeDaemonHandle !== undefined) return;
  liopeDaemonHandle = setInterval(() => {
    if (liopeFlushActive) return; // skip if previous flush still running
    liopeFlushActive = true;
    liopeFlush().finally(() => { liopeFlushActive = false; });
  }, LIOPE_FLUSH_INTERVAL_MS);
  // unref: daemon must not prevent process exit
  if (typeof (liopeDaemonHandle as unknown as { unref?: () => void }).unref === "function") {
    (liopeDaemonHandle as unknown as { unref: () => void }).unref();
  }
}

async function liopeFlush(): Promise<void> {
  const pendingCount = liopeQueue.length;
  if (pendingCount === 0 && liopeShedCount === 0) return;

  // Drain queue snapshot
  const batch = liopeQueue.splice(0, pendingCount);
  const shedCount = liopeShedCount;
  const shedByClass = new Map(liopeShedByClass);
  const windowMs = Date.now() - liopeWindowStartMs;

  // Reset shed state for next window
  liopeShedCount = 0;
  liopeShedByClass.clear();
  liopeWindowStartMs = Date.now();

  if (batch.length === 0 && shedCount === 0) return;

  // A3.8: when shed > 0, prepend a signed LEDGER_STORM_SUMMARY event
  if (shedCount > 0) {
    const byClassObj: Record<string, number> = {};
    for (const [k, v] of shedByClass) byClassObj[k] = v;
    const firstEntry = batch[0];
    const stormPayload: BoundaryLedgerPayload = {
      sessionId: firstEntry?.payload.sessionId ?? "liope-storm",
      actorId: "ledger.liope",
      reason: `LIOPE: ${shedCount} events shed in ${windowMs}ms window`,
      createdAt: new Date().toISOString(),
      metadata: {
        shed_count: shedCount,
        window_ms: windowMs,
        by_class: JSON.stringify(byClassObj),
      },
    };
    batch.unshift({ eventType: "LEDGER_STORM_SUMMARY", payload: stormPayload });
  }

  await appendBoundaryLedgerBatch(batch);
}

async function rolloverLedgerFileIfNeeded(): Promise<void> {
  try {
    const stats = await fs.stat(BOUNDARY_LEDGER_FILE);
    if (stats.size >= LIOPE_MAX_FILE_SIZE_BYTES) {
      const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
      const archivePath = path.join(LEDGER_DIR, `agent-boundary-ledger.${timestamp}.jsonl`);
      await fs.rename(BOUNDARY_LEDGER_FILE, archivePath);
    }
  } catch {
    // file does not exist yet — no rollover needed
  }
}

/** Force an immediate LIOPE flush (drains the queue now, outside the daemon schedule). */
export async function flushLiopeQueue(): Promise<void> {
  return liopeFlush();
}

/** Stop the LIOPE background daemon and prevent it from restarting.
 *  Used in contract tests — once called, ensureLiopeDaemonRunning() is a no-op
 *  for the lifetime of the process, so daemon cannot restart via enqueue calls. */
export function stopLiopeDaemon(): void {
  liopeDaemonDisabled = true;
  if (liopeDaemonHandle !== undefined) {
    clearInterval(liopeDaemonHandle);
    liopeDaemonHandle = undefined;
  }
}

/** Current LIOPE queue depth + shed counter — for observability and contract tests. */
export function getLiopeStats(): { queueDepth: number; shedCount: number; shedByClass: Record<string, number> } {
  const shedByClass: Record<string, number> = {};
  for (const [k, v] of liopeShedByClass) shedByClass[k] = v;
  return { queueDepth: liopeQueue.length, shedCount: liopeShedCount, shedByClass };
}

export { LIOPE_MAX_QUEUE_SIZE, LIOPE_FLUSH_INTERVAL_MS, LIOPE_MAX_FILE_SIZE_BYTES, LIOPE_MATERIAL_EVENTS };

async function appendBoundaryLedgerBatch(entries: LiopeQueueEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const release = await acquireBoundaryLedgerLock();
  try {
    await ensureLedgerDir();
    await replayLedgerWal();
    await rolloverLedgerFileIfNeeded();
    const signer = await ensureBoundaryLedgerSigningIdentity();
    const existing = await readLedgerFile(BOUNDARY_LEDGER_FILE);
    const latest = existing.at(-1);
    let nextIndex = (latest?.index ?? -1) + 1;
    let prevHash = latest?.META.hash ?? "sha256:genesis";

    const lines: string[] = [];
    const records: BoundaryLedgerRecord[] = [];
    for (const entry of entries) {
      const record = buildBoundaryLedgerRecord({
        index: nextIndex,
        prevHash,
        eventType: entry.eventType,
        payload: entry.payload,
        signer,
      });
      lines.push(JSON.stringify(record));
      records.push(record);
      prevHash = record.META.hash;
      nextIndex++;
    }

    const batchContent = `${lines.join("\n")}\n`;
    await appendLineAtomic(BOUNDARY_LEDGER_WAL_FILE, batchContent);
    await appendLineAtomic(BOUNDARY_LEDGER_FILE, batchContent);
    await writeAtomic(BOUNDARY_LEDGER_WAL_FILE, "");
    for (const record of records) {
      await updateBoundaryLedgerIndexes(record);
    }
  } finally {
    await release();
  }
}

export type BoundaryLedgerWriterTarget =
  | { socketPath: string }
  | { host: string; port: number };

export type BoundaryLedgerWriterInput =
  | {
      command: "append";
      eventType: BoundaryLedgerEventType;
      payload: BoundaryLedgerPayload;
    }
  | {
      command: "status";
    }
  | {
      command: "shutdown";
    };

export type BoundaryLedgerWriterOutput =
  | {
      type: "append_ok";
      record: BoundaryLedgerRecord;
    }
  | {
      type: "status";
      ok: boolean;
    }
  | {
      type: "ack";
      command: "shutdown";
    }
  | {
      type: "error";
      error: string;
    };

function safeParseLedgerLines(raw: string): BoundaryLedgerRecord[] {
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const parsed = JSON.parse(line) as Partial<BoundaryLedgerRecord>;
        return [normalizeBoundaryLedgerRecord(parsed)];
      } catch {
        return [];
      }
    });
}

function decisionToVerdict(decision?: BoundaryDecision): BoundaryLedgerDecisionVerdict {
  switch (decision) {
    case "allow":
      return "ALLOW";
    case "deny":
      return "DENY";
    case "require_approval":
      return "REQUIRE_APPROVAL";
    default:
      return "PENDING";
  }
}

function defaultDecisionForEvent(eventType: BoundaryLedgerEventType): BoundaryLedgerDecisionVerdict {
  if (eventType === "APPROVAL_REQUESTED" || eventType === "NSL_GRANT_OFFERED") {
    return "PENDING";
  }
  if (eventType === "ACTION_EXECUTED" || eventType === "SESSION_STARTED" || eventType === "SESSION_RESTORED") {
    return "ALLOW";
  }
  if (eventType === "UPL_ALLOW_RECORDED") {
    return "ALLOW";
  }
  if (eventType === "UPL_DENY_RECORDED") {
    return "DENY";
  }
  if (eventType === "ACTION_BLOCKED" || eventType === "APPROVAL_DENIED" || eventType === "USER_CONFIRMED_DENY") {
    return "DENY";
  }
  return "PENDING";
}

function defaultOutcomeForEvent(eventType: BoundaryLedgerEventType): BoundaryLedgerNextOutcome {
  if (eventType === "ACTION_EXECUTED" || eventType === "PROCESS_SPAWNED") {
    return "EXECUTED";
  }
  if (eventType === "UPL_ALLOW_RECORDED" || eventType === "UPL_DENY_RECORDED") {
    return "QUEUED";
  }
  if (
    eventType === "ACTION_BLOCKED" ||
    eventType === "APPROVAL_DENIED" ||
    eventType === "USER_CONFIRMED_DENY" ||
    eventType === "PROCESS_BLOCKED"
  ) {
    return "BLOCKED";
  }
  if (eventType === "APPROVAL_REQUESTED" || eventType === "NSL_GRANT_OFFERED") {
    return "WAITING";
  }
  return "QUEUED";
}

function buildLedgerInput(eventType: BoundaryLedgerEventType, payload: BoundaryLedgerPayload): BoundaryLedgerInput {
  const metadata = payload.metadata ?? {};
  const params = Object.fromEntries(
    Object.entries(metadata).filter(([key]) =>
      ![
        "raw_request",
        "scope_id",
        "path_matched",
        "scope_result",
        "path_through_system",
        "total_eval_ms",
        "outcome",
        "next_state",
        "execution_ms",
        "approval_id",
        "depth",
      ].includes(key),
    ),
  );

  return {
    source: payload.actorId,
    action: payload.actionKind ?? eventType,
    target: payload.target ?? "",
    params,
    raw_request: typeof metadata.raw_request === "string" ? metadata.raw_request : payload.reason,
  };
}

function buildLedgerDecision(eventType: BoundaryLedgerEventType, payload: BoundaryLedgerPayload): BoundaryLedgerDecisionBlock {
  return {
    verdict: payload.decision ? decisionToVerdict(payload.decision) : defaultDecisionForEvent(eventType),
    reason: payload.reason,
    law_triggered: payload.lawIds?.[0] ?? null,
    confidence: typeof payload.metadata?.confidence === "number" ? Number(payload.metadata.confidence) : 1,
  };
}

function buildLedgerPath(payload: BoundaryLedgerPayload): BoundaryLedgerPathBlock {
  const metadata = payload.metadata ?? {};
  const pathThroughSystem = typeof metadata.path_through_system === "string"
    ? metadata.path_through_system.split(" > ").filter(Boolean)
    : ["agent-buccet"];

  return {
    scope_check: {
      scope_id: typeof metadata.scope_id === "string" ? metadata.scope_id : undefined,
      path_matched: typeof metadata.path_matched === "string" ? metadata.path_matched : payload.target,
      result: typeof metadata.scope_result === "string" ? metadata.scope_result : "EVALUATED",
    },
    laws_evaluated: (payload.lawIds ?? []).map((lawId) => ({
      law: lawId,
      result: lawId === payload.lawIds?.[0] ? "TRIGGERED" : "PASS",
    })),
    path_through_system: pathThroughSystem,
    total_eval_ms: typeof metadata.total_eval_ms === "number" ? Number(metadata.total_eval_ms) : undefined,
  };
}

function buildLedgerNext(eventType: BoundaryLedgerEventType, payload: BoundaryLedgerPayload): BoundaryLedgerNextBlock {
  const metadata = payload.metadata ?? {};
  return {
    outcome: typeof metadata.outcome === "string"
      ? metadata.outcome as BoundaryLedgerNextOutcome
      : defaultOutcomeForEvent(eventType),
    next_state: typeof metadata.next_state === "string" ? metadata.next_state : "ready",
    execution_ms: typeof metadata.execution_ms === "number" ? Number(metadata.execution_ms) : undefined,
    approval_id: typeof metadata.approval_id === "string" ? metadata.approval_id : null,
  };
}

function buildLedgerOptions(payload: BoundaryLedgerPayload): BoundaryLedgerOptionsBlock {
  const metadata = payload.metadata ?? {};
  const dormantLaw = typeof metadata.dormant_law === "string"
    ? [{ law: metadata.dormant_law, status: "DISABLED" as const }]
    : [];
  const availableScope = typeof metadata.available_scope === "string"
    ? [{ scope: metadata.available_scope, status: "CLOSED" as const }]
    : [];
  const userDiscretion = typeof metadata.user_discretion === "string"
    ? [metadata.user_discretion]
    : [];

  return {
    dormant_laws: dormantLaw,
    available_scopes: availableScope,
    user_discretion: userDiscretion,
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function computeEntryHash(entry: Omit<BoundaryLedgerRecord, "META"> & { META: Omit<BoundaryLedgerRecord["META"], "hash"> }): string {
  const canonical = stableStringify(entry);
  return `sha256:${createHash("sha256").update(canonical).digest("hex")}`;
}

function makeEntryId(index: number): string {
  return `entry_${String(index).padStart(10, "0")}`;
}

function normalizeBoundaryLedgerRecord(record: Partial<BoundaryLedgerRecord>): BoundaryLedgerRecord {
  const index = typeof record.index === "number" ? record.index : 0;
  const eventType = record.eventType ?? record.META?.event_type ?? "ACTION_PROPOSED";
  const payload = record.payload ?? {
    sessionId: record.META?.session_id ?? "unknown-session",
    actorId: record.INPUT?.source ?? "unknown-source",
    requestId: undefined,
    actionKind: undefined,
    target: record.INPUT?.target,
    decision: record.DECISION?.verdict === "ALLOW"
      ? "allow"
      : record.DECISION?.verdict === "DENY"
        ? "deny"
        : record.DECISION?.verdict === "REQUIRE_APPROVAL"
          ? "require_approval"
          : undefined,
    reason: record.DECISION?.reason ?? "legacy ledger record",
    lawIds: record.DECISION?.law_triggered ? [record.DECISION.law_triggered] : [],
    metadata: {},
    createdAt: record.META?.timestamp ?? new Date(0).toISOString(),
  } satisfies BoundaryLedgerPayload;

  const META = record.META ?? {
    id: makeEntryId(index || 1),
    timestamp: payload.createdAt,
    hash: "sha256:legacy",
    prev_hash: index <= 1 ? "sha256:genesis" : "sha256:legacy-prev",
    session_id: payload.sessionId,
    depth: typeof payload.metadata?.depth === "number" ? Number(payload.metadata.depth) : 0,
    event_type: eventType,
  };

  const INPUT = record.INPUT ?? buildLedgerInput(eventType, payload);
  const DECISION = record.DECISION ?? buildLedgerDecision(eventType, payload);
  const PATH = record.PATH ?? buildLedgerPath(payload);
  const NEXT = record.NEXT ?? buildLedgerNext(eventType, payload);
  const OPTIONS = record.OPTIONS ?? buildLedgerOptions(payload);

  return {
    index,
    eventType,
    payload,
    META: {
      ...META,
      signature_algo: META.signature_algo,
      signer_id: META.signer_id,
      signature: META.signature,
      signed_at: META.signed_at,
    },
    INPUT,
    DECISION,
    PATH,
    NEXT,
    OPTIONS,
  };
}

async function ensureLedgerDir() {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  await fs.mkdir(INDEX_DIR, { recursive: true });
  await fs.mkdir(ROLLUP_DIR, { recursive: true });
  await fs.mkdir(KEYS_DIR, { recursive: true });
  await fs.mkdir(CHECKPOINT_DIR, { recursive: true });
}

function signerIdFromPublicKeyPem(publicKeyPem: string): string {
  const der = createPublicKey(publicKeyPem).export({ format: "der", type: "spki" }) as Buffer;
  return `ed25519:${createHash("sha256").update(der).digest("hex")}`;
}

async function ensureBoundaryLedgerSigningIdentity(): Promise<{
  privateKeyPem: string;
  publicKeyPem: string;
  signerId: string;
}> {
  await ensureLedgerDir();
  const [privateKeyPem, publicKeyPem] = await Promise.all([
    fs.readFile(SIGNING_PRIVATE_KEY_FILE, "utf8").catch(() => ""),
    fs.readFile(SIGNING_PUBLIC_KEY_FILE, "utf8").catch(() => ""),
  ]);

  if (privateKeyPem && publicKeyPem) {
    return {
      privateKeyPem,
      publicKeyPem,
      signerId: signerIdFromPublicKeyPem(publicKeyPem),
    };
  }

  const generated = generateKeyPairSync("ed25519");
  const nextPrivateKeyPem = generated.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const nextPublicKeyPem = generated.publicKey.export({ format: "pem", type: "spki" }).toString();
  await fs.writeFile(SIGNING_PRIVATE_KEY_FILE, nextPrivateKeyPem, { mode: 0o600 });
  await fs.writeFile(SIGNING_PUBLIC_KEY_FILE, nextPublicKeyPem, { mode: 0o644 });
  return {
    privateKeyPem: nextPrivateKeyPem,
    publicKeyPem: nextPublicKeyPem,
    signerId: signerIdFromPublicKeyPem(nextPublicKeyPem),
  };
}

function signBoundaryLedgerHash(hash: string, privateKeyPem: string): string {
  return cryptoSign(
    null,
    Buffer.from(hash, "utf8"),
    createPrivateKey(privateKeyPem),
  ).toString("base64");
}

function verifyBoundaryLedgerHashSignature(args: {
  hash: string;
  signature: string;
  publicKeyPem: string;
}): boolean {
  try {
    return cryptoVerify(
      null,
      Buffer.from(args.hash, "utf8"),
      createPublicKey(args.publicKeyPem),
      Buffer.from(args.signature, "base64"),
    );
  } catch {
    return false;
  }
}

async function readLedgerFile(targetPath: string): Promise<BoundaryLedgerRecord[]> {
  try {
    const raw = await fs.readFile(targetPath, "utf8");
    return safeParseLedgerLines(raw);
  } catch {
    return [];
  }
}

async function writeAtomic(targetPath: string, contents: string): Promise<void> {
  const tempPath = `${targetPath}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, contents, "utf8");
  await fs.rename(tempPath, targetPath);
}

async function appendLineAtomic(targetPath: string, line: string): Promise<void> {
  const existing = await fs.readFile(targetPath, "utf8").catch(() => "");
  await writeAtomic(targetPath, `${existing}${line}`);
}

type BoundaryLedgerLockMetadata = {
  pid: number;
  createdAt: string;
};

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function readBoundaryLedgerLockMetadata(): Promise<BoundaryLedgerLockMetadata | null> {
  try {
    const raw = await fs.readFile(LOCK_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<BoundaryLedgerLockMetadata>;
    if (typeof parsed.pid !== "number" || typeof parsed.createdAt !== "string") {
      return null;
    }
    return {
      pid: parsed.pid,
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

async function clearStaleBoundaryLedgerLock(): Promise<boolean> {
  const metadata = await readBoundaryLedgerLockMetadata();
  if (metadata && !isProcessAlive(metadata.pid)) {
    await fs.rm(LOCK_FILE, { force: true }).catch(() => undefined);
    return true;
  }

  try {
    const stats = await fs.stat(LOCK_FILE);
    if (Date.now() - stats.mtimeMs > LOCK_STALE_MS) {
      await fs.rm(LOCK_FILE, { force: true }).catch(() => undefined);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

async function acquireBoundaryLedgerLock(maxAttempts = 200, waitMs = 10): Promise<() => Promise<void>> {
  await ensureLedgerDir();
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const handle = await fs.open(LOCK_FILE, "wx");
      await handle.writeFile(
        `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`,
        "utf8",
      );
      return async () => {
        await handle.close().catch(() => undefined);
        await fs.rm(LOCK_FILE, { force: true }).catch(() => undefined);
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      if (await clearStaleBoundaryLedgerLock()) {
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
  throw new Error("timed out acquiring boundary ledger lock");
}

async function replayLedgerWal(): Promise<void> {
  const walEntries = await readLedgerFile(BOUNDARY_LEDGER_WAL_FILE);
  if (walEntries.length === 0) {
    return;
  }

  for (const record of walEntries) {
    await appendLineAtomic(BOUNDARY_LEDGER_FILE, `${JSON.stringify(record)}\n`);
    await updateBoundaryLedgerIndexes(record);
  }

  await writeAtomic(BOUNDARY_LEDGER_WAL_FILE, "");
}

function timeIndexPath(timestamp: string): string {
  const [date, time] = timestamp.split("T");
  const hour = time?.slice(0, 2) ?? "00";
  return path.join(INDEX_DIR, "by_time", `${date}-${hour}.idx`);
}

function sanitizeIndexKey(value: string): string {
  return value.replaceAll(/[^a-zA-Z0-9._-]+/g, "_");
}

async function appendIndexEntry(filePath: string, value: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await appendLineAtomic(filePath, `${value}\n`);
}

async function updateBoundaryLedgerIndexes(record: BoundaryLedgerRecord): Promise<void> {
  const source = sanitizeIndexKey(record.INPUT.source || "unknown-source");
  const action = sanitizeIndexKey(record.INPUT.action || "unknown-action");
  const decision = sanitizeIndexKey(record.DECISION.verdict);

  await appendIndexEntry(timeIndexPath(record.META.timestamp), record.META.id);
  await appendIndexEntry(path.join(INDEX_DIR, "by_source", `${source}.idx`), record.META.id);
  await appendIndexEntry(path.join(INDEX_DIR, "by_action", `${action}.idx`), record.META.id);
  await appendIndexEntry(path.join(INDEX_DIR, "by_decision", `${decision}.idx`), record.META.id);

  for (const law of record.PATH.laws_evaluated) {
    await appendIndexEntry(
      path.join(INDEX_DIR, "by_law", `${sanitizeIndexKey(law.law)}.idx`),
      record.META.id,
    );
  }
}

function buildBoundaryLedgerIndexEntries(record: BoundaryLedgerRecord): Array<{ filePath: string; value: string }> {
  const entries = [
    { filePath: timeIndexPath(record.META.timestamp), value: record.META.id },
    { filePath: path.join(INDEX_DIR, "by_source", `${sanitizeIndexKey(record.INPUT.source || "unknown-source")}.idx`), value: record.META.id },
    { filePath: path.join(INDEX_DIR, "by_action", `${sanitizeIndexKey(record.INPUT.action || "unknown-action")}.idx`), value: record.META.id },
    { filePath: path.join(INDEX_DIR, "by_decision", `${sanitizeIndexKey(record.DECISION.verdict)}.idx`), value: record.META.id },
  ];

  for (const law of record.PATH.laws_evaluated) {
    entries.push({
      filePath: path.join(INDEX_DIR, "by_law", `${sanitizeIndexKey(law.law)}.idx`),
      value: record.META.id,
    });
  }

  return entries;
}

function buildBoundaryLedgerRecord(args: {
  index: number;
  prevHash: string;
  eventType: BoundaryLedgerEventType;
  payload: BoundaryLedgerPayload;
  signer?: {
    privateKeyPem: string;
    signerId: string;
  };
}): BoundaryLedgerRecord {
  const INPUT = buildLedgerInput(args.eventType, args.payload);
  const DECISION = buildLedgerDecision(args.eventType, args.payload);
  const PATH = buildLedgerPath(args.payload);
  const NEXT = buildLedgerNext(args.eventType, args.payload);
  const OPTIONS = buildLedgerOptions(args.payload);
  const METAWithoutHash = {
    id: makeEntryId(args.index),
    timestamp: args.payload.createdAt,
    prev_hash: args.prevHash,
    session_id: args.payload.sessionId,
    depth: typeof args.payload.metadata?.depth === "number" ? Number(args.payload.metadata.depth) : 0,
    event_type: args.eventType,
  };

  const hash = computeEntryHash({
    index: args.index,
    eventType: args.eventType,
    payload: args.payload,
    INPUT,
    DECISION,
    PATH,
    NEXT,
    OPTIONS,
    META: METAWithoutHash,
  });
  const signature = args.signer
    ? signBoundaryLedgerHash(hash, args.signer.privateKeyPem)
    : undefined;

  return {
    index: args.index,
    eventType: args.eventType,
    payload: args.payload,
    META: {
      ...METAWithoutHash,
      hash,
      signature_algo: signature ? "ed25519" : undefined,
      signer_id: signature ? args.signer?.signerId : undefined,
      signature,
      signed_at: signature ? args.payload.createdAt : undefined,
    },
    INPUT,
    DECISION,
    PATH,
    NEXT,
    OPTIONS,
  };
}

export async function readAllBoundaryLedgerRecords(): Promise<BoundaryLedgerRecord[]> {
  await ensureLedgerDir();
  await replayLedgerWal();
  const records = await readLedgerFile(BOUNDARY_LEDGER_FILE);
  return records.sort((left, right) => left.index - right.index);
}

async function appendBoundaryLedgerLocal(
  eventType: BoundaryLedgerEventType,
  payload: BoundaryLedgerPayload,
): Promise<BoundaryLedgerRecord> {
  const release = await acquireBoundaryLedgerLock();
  try {
    await ensureLedgerDir();
    await replayLedgerWal();
    const signer = await ensureBoundaryLedgerSigningIdentity();
    const existing = await readLedgerFile(BOUNDARY_LEDGER_FILE);
    const latest = existing.at(-1);
    const nextIndex = (latest?.index ?? -1) + 1;
    const prevHash = latest?.META.hash ?? "sha256:genesis";
    const record = buildBoundaryLedgerRecord({
      index: nextIndex,
      prevHash,
      eventType,
      payload,
      signer,
    });

    await appendLineAtomic(BOUNDARY_LEDGER_WAL_FILE, `${JSON.stringify(record)}\n`);
    await appendLineAtomic(BOUNDARY_LEDGER_FILE, `${JSON.stringify(record)}\n`);
    await writeAtomic(BOUNDARY_LEDGER_WAL_FILE, "");
    await updateBoundaryLedgerIndexes(record);
    return record;
  } finally {
    await release();
  }
}

function resolveLedgerWriterTargetFromEnv(): BoundaryLedgerWriterTarget | null {
  const socketPath = process.env.AGENT_BUCCET_LEDGER_WRITER_SOCKET;
  if (socketPath) {
    return { socketPath };
  }

  const host = process.env.AGENT_BUCCET_LEDGER_WRITER_HOST;
  const port = process.env.AGENT_BUCCET_LEDGER_WRITER_PORT;
  if (host && port) {
    return {
      host,
      port: Number(port),
    };
  }

  return null;
}

async function connectToBoundaryLedgerWriter(target: BoundaryLedgerWriterTarget): Promise<net.Socket> {
  const socket = "socketPath" in target
    ? net.createConnection(target.socketPath)
    : net.createConnection({ host: target.host, port: target.port });
  await once(socket, "connect");
  return socket;
}

export async function sendBoundaryLedgerWriterInput(args: {
  target: BoundaryLedgerWriterTarget;
  input: BoundaryLedgerWriterInput;
}): Promise<BoundaryLedgerWriterOutput> {
  const socket = await connectToBoundaryLedgerWriter(args.target);
  socket.write(`${JSON.stringify(args.input)}\n`);

  let buffer = "";
  for await (const chunk of socket) {
    buffer += chunk.toString();
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex === -1) {
      continue;
    }
    const line = buffer.slice(0, newlineIndex).trim();
    if (!line) {
      buffer = buffer.slice(newlineIndex + 1);
      continue;
    }
    socket.end();
    return JSON.parse(line) as BoundaryLedgerWriterOutput;
  }

  throw new Error("ledger writer closed before responding");
}

export async function appendBoundaryLedger(
  eventType: BoundaryLedgerEventType,
  payload: BoundaryLedgerPayload,
): Promise<BoundaryLedgerRecord> {
  const writerTarget = resolveLedgerWriterTargetFromEnv();
  if (writerTarget) {
    const response = await sendBoundaryLedgerWriterInput({
      target: writerTarget,
      input: {
        command: "append",
        eventType,
        payload,
      },
    });

    if (response.type === "error") {
      throw new Error(response.error);
    }
    if (response.type !== "append_ok") {
      throw new Error(`unexpected ledger writer response: ${response.type}`);
    }

    return normalizeBoundaryLedgerRecord(response.record);
  }

  // LIOPE local routing:
  // Material state transitions bypass the queue — always written immediately.
  // Observation events go through the Q1.8 ring buffer (O(1) hot path).
  if (LIOPE_MATERIAL_EVENTS.has(eventType)) {
    return appendBoundaryLedgerLocal(eventType, payload);
  }

  // Observation event: O(1) enqueue, D2.8 daemon flushes in background
  ensureLiopeDaemonRunning();
  liopeEnqueue(eventType, payload);

  // Return a lightweight pending placeholder — the event is durably written
  // by the next daemon flush. Callers that require immediate durability should
  // use a material event type so the bypass path is taken above.
  return normalizeBoundaryLedgerRecord({
    index: -1,
    eventType,
    payload,
    META: {
      id: "liope:pending",
      timestamp: payload.createdAt,
      hash: "sha256:pending",
      prev_hash: "sha256:pending",
      session_id: payload.sessionId,
      depth: 0,
      event_type: eventType,
    },
  });
}

export async function readBoundaryLedgerBySession(sessionId: string): Promise<BoundaryLedgerRecord[]> {
  const records = await readAllBoundaryLedgerRecords();
  return records.filter((record) => record.META.session_id === sessionId);
}

export async function readBoundaryLedgerByRequest(requestId: string): Promise<BoundaryLedgerRecord[]> {
  const records = await readAllBoundaryLedgerRecords();
  return records.filter((record) => record.payload.requestId === requestId);
}

export async function readBoundaryLedgerByEventType(
  eventType: BoundaryLedgerEventType,
): Promise<BoundaryLedgerRecord[]> {
  const records = await readAllBoundaryLedgerRecords();
  return records.filter((record) => record.META.event_type === eventType);
}

export async function readLatestBoundarySessionRecord(
  sessionId: string,
): Promise<BoundaryLedgerRecord | null> {
  const records = await readBoundaryLedgerBySession(sessionId);
  return records.length > 0 ? records[records.length - 1] : null;
}

export async function queryBoundaryLedger(args: {
  from?: string;
  to?: string;
  source?: string;
  action?: string;
  decision?: BoundaryLedgerDecisionVerdict;
  law?: string;
  limit?: number;
}): Promise<BoundaryLedgerRecord[]> {
  const records = await readAllBoundaryLedgerRecords();
  return records
    .filter((record) => !args.from || record.META.timestamp >= args.from)
    .filter((record) => !args.to || record.META.timestamp <= args.to)
    .filter((record) => !args.source || record.INPUT.source === args.source)
    .filter((record) => !args.action || record.INPUT.action === args.action)
    .filter((record) => !args.decision || record.DECISION.verdict === args.decision)
    .filter((record) => !args.law || record.PATH.laws_evaluated.some((law) => law.law === args.law))
    .slice(0, args.limit ?? 100);
}

export async function readBoundaryLedgerStats(args: { from?: string; to?: string } = {}) {
  const records = await queryBoundaryLedger({ ...args, limit: Number.MAX_SAFE_INTEGER });
  const byDecision = records.reduce<Record<string, number>>((accumulator, record) => {
    accumulator[record.DECISION.verdict] = (accumulator[record.DECISION.verdict] ?? 0) + 1;
    return accumulator;
  }, {});
  const bySource = records.reduce<Record<string, number>>((accumulator, record) => {
    accumulator[record.INPUT.source] = (accumulator[record.INPUT.source] ?? 0) + 1;
    return accumulator;
  }, {});
  return {
    total_entries: records.length,
    by_decision: byDecision,
    by_source: bySource,
  };
}

export async function readBoundaryLedgerSigningIdentity(): Promise<{
  signer_id: string;
  public_key_pem: string;
  public_key_path: string;
}> {
  const { publicKeyPem, signerId } = await ensureBoundaryLedgerSigningIdentity();
  return {
    signer_id: signerId,
    public_key_pem: publicKeyPem,
    public_key_path: SIGNING_PUBLIC_KEY_FILE,
  };
}

export async function verifyBoundaryLedgerRecordSignature(record: BoundaryLedgerRecord): Promise<{
  ok: boolean;
  reason?: string;
}> {
  if (!record.META.signature || !record.META.signer_id || !record.META.signature_algo) {
    return {
      ok: false,
      reason: "record is unsigned",
    };
  }

  const { publicKeyPem, signerId } = await ensureBoundaryLedgerSigningIdentity();
  if (record.META.signer_id !== signerId) {
    return {
      ok: false,
      reason: "signer id does not match local ledger public key",
    };
  }

  return {
    ok: verifyBoundaryLedgerHashSignature({
      hash: record.META.hash,
      signature: record.META.signature,
      publicKeyPem,
    }),
    reason: "signature verification failed",
  };
}

export async function verifyBoundaryLedgerChain(): Promise<{
  ok: boolean;
  brokenAt?: string;
  reason?: string;
  checkedFrom?: string;
  cryptographic_ok?: boolean;
  signed_records?: number;
  unsigned_records?: number;
  signer_ids?: string[];
}> {
  const records = await readAllBoundaryLedgerRecords();
  const firstCanonicalIndex = records.findIndex((record) => record.META.hash !== "sha256:legacy");

  if (firstCanonicalIndex === -1) {
    return {
      ok: true,
      reason: "ledger contains only legacy pre-EFUE entries; no canonical hash chain to verify yet",
      cryptographic_ok: false,
      signed_records: 0,
      unsigned_records: 0,
      signer_ids: [],
    };
  }

  let prevHash = records[firstCanonicalIndex - 1]?.META.hash ?? "sha256:genesis";
  let expectedIndex = records[firstCanonicalIndex].index;
  let signedRecords = 0;
  let unsignedRecords = 0;
  const signerIds = new Set<string>();

  for (let index = firstCanonicalIndex; index < records.length; index += 1) {
    const record = records[index];
    if (record.index !== expectedIndex) {
      return {
        ok: false,
        brokenAt: record.META.id,
        reason: "sequential index gap detected",
        checkedFrom: records[firstCanonicalIndex].META.id,
      };
    }

    if (record.META.prev_hash !== prevHash) {
      return {
        ok: false,
        brokenAt: record.META.id,
        reason: "hash chain mismatch detected",
        checkedFrom: records[firstCanonicalIndex].META.id,
      };
    }

    prevHash = record.META.hash;
    expectedIndex += 1;

    if (record.META.signature && record.META.signer_id) {
      signedRecords += 1;
      signerIds.add(record.META.signer_id);
      const verified = await verifyBoundaryLedgerRecordSignature(record);
      if (!verified.ok) {
        return {
          ok: true,
          cryptographic_ok: false,
          brokenAt: record.META.id,
          reason: verified.reason,
          checkedFrom: records[firstCanonicalIndex].META.id,
          signed_records: signedRecords,
          unsigned_records: unsignedRecords,
          signer_ids: [...signerIds],
        };
      }
    } else {
      unsignedRecords += 1;
    }
  }
  return {
    ok: true,
    reason: firstCanonicalIndex > 0 ? "legacy prefix skipped; canonical chain verified" : undefined,
    checkedFrom: records[firstCanonicalIndex].META.id,
    cryptographic_ok: unsignedRecords === 0 && signedRecords > 0,
    signed_records: signedRecords,
    unsigned_records: unsignedRecords,
    signer_ids: [...signerIds],
  };
}

export type BoundaryLedgerRollup = {
  period: string;
  total_entries: number;
  by_decision: Record<string, number>;
  by_source: Record<string, number>;
  notable_denials: Array<{
    id: string;
    source: string;
    action: string;
    target: string;
    reason: string;
  }>;
  generated_at: string;
};

export async function buildBoundaryLedgerRollup(args: {
  period: string;
  from?: string;
  to?: string;
  limitNotableDenials?: number;
}): Promise<BoundaryLedgerRollup> {
  const records = await queryBoundaryLedger({
    from: args.from,
    to: args.to,
    limit: Number.MAX_SAFE_INTEGER,
  });

  const byDecision = records.reduce<Record<string, number>>((accumulator, record) => {
    accumulator[record.DECISION.verdict] = (accumulator[record.DECISION.verdict] ?? 0) + 1;
    return accumulator;
  }, {});

  const bySource = records.reduce<Record<string, number>>((accumulator, record) => {
    accumulator[record.INPUT.source] = (accumulator[record.INPUT.source] ?? 0) + 1;
    return accumulator;
  }, {});

  const notableDenials = records
    .filter((record) => record.DECISION.verdict === "DENY")
    .slice(0, args.limitNotableDenials ?? 10)
    .map((record) => ({
      id: record.META.id,
      source: record.INPUT.source,
      action: record.INPUT.action,
      target: record.INPUT.target,
      reason: record.DECISION.reason,
    }));

  return {
    period: args.period,
    total_entries: records.length,
    by_decision: byDecision,
    by_source: bySource,
    notable_denials: notableDenials,
    generated_at: new Date().toISOString(),
  };
}

export async function writeBoundaryLedgerRollup(args: {
  period: string;
  from?: string;
  to?: string;
  limitNotableDenials?: number;
}): Promise<BoundaryLedgerRollup> {
  await ensureLedgerDir();
  const rollup = await buildBoundaryLedgerRollup(args);
  const fileName = `${args.period.replaceAll(/[^a-zA-Z0-9._-]+/g, "_")}.json`;
  await writeAtomic(path.join(ROLLUP_DIR, fileName), `${JSON.stringify(rollup, null, 2)}\n`);
  return rollup;
}

export async function readBoundaryLedgerRollups(): Promise<BoundaryLedgerRollup[]> {
  await ensureLedgerDir();
  const entries = await fs.readdir(ROLLUP_DIR, { withFileTypes: true }).catch(() => []);
  const rollups: BoundaryLedgerRollup[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    try {
      const raw = await fs.readFile(path.join(ROLLUP_DIR, entry.name), "utf8");
      rollups.push(JSON.parse(raw) as BoundaryLedgerRollup);
    } catch {
      continue;
    }
  }
  return rollups.sort((left, right) => left.period.localeCompare(right.period));
}

export async function sealBoundaryLedgerSignatures(): Promise<{
  sealed: boolean;
  backupPath: string;
  signedRecords: number;
}> {
  await ensureLedgerDir();
  const records = await readLedgerFile(BOUNDARY_LEDGER_FILE);
  if (records.length === 0) {
    return {
      sealed: false,
      backupPath: "",
      signedRecords: 0,
    };
  }

  const signer = await ensureBoundaryLedgerSigningIdentity();
  const backupPath = `${BOUNDARY_LEDGER_FILE}.seal.bak.${new Date().toISOString().replaceAll(/[:.]/g, "-")}`;
  const sealedRecords = records.map((record) => {
    if (record.META.signature && record.META.signer_id && record.META.signature_algo) {
      return record;
    }
    return {
      ...record,
      META: {
        ...record.META,
        signature_algo: "ed25519" as const,
        signer_id: signer.signerId,
        signature: signBoundaryLedgerHash(record.META.hash, signer.privateKeyPem),
        signed_at: record.META.timestamp,
      },
    };
  });
  const signedRecords = sealedRecords.filter((record, index) =>
    !(records[index]?.META.signature && records[index]?.META.signer_id && records[index]?.META.signature_algo)
  ).length;

  if (signedRecords === 0) {
    return {
      sealed: false,
      backupPath: "",
      signedRecords: 0,
    };
  }

  await fs.copyFile(BOUNDARY_LEDGER_FILE, backupPath);
  await writeAtomic(
    BOUNDARY_LEDGER_FILE,
    sealedRecords.map((record) => JSON.stringify(record)).join("\n").concat("\n"),
  );

  return {
    sealed: true,
    backupPath,
    signedRecords,
  };
}

export async function buildBoundaryLedgerCheckpoint(): Promise<BoundaryLedgerCheckpoint> {
  await ensureLedgerDir();
  const records = await readAllBoundaryLedgerRecords();
  const verify = await verifyBoundaryLedgerChain();
  const latest = records.at(-1);
  const signer = await ensureBoundaryLedgerSigningIdentity();
  const generatedAt = new Date().toISOString();
  const body = stableStringify({
    generated_at: generatedAt,
    signer_id: signer.signerId,
    total_records: records.length,
    latest_record_id: latest?.META.id,
    latest_record_hash: latest?.META.hash,
    chain_ok: verify.ok,
    cryptographic_ok: verify.cryptographic_ok ?? false,
  });
  const checkpointId = `sha256:${createHash("sha256").update(body).digest("hex")}`;
  return {
    checkpoint_id: checkpointId,
    generated_at: generatedAt,
    signer_id: signer.signerId,
    signature_algo: "ed25519",
    total_records: records.length,
    latest_record_id: latest?.META.id,
    latest_record_hash: latest?.META.hash,
    chain_ok: verify.ok,
    cryptographic_ok: verify.cryptographic_ok ?? false,
    signature: signBoundaryLedgerHash(checkpointId, signer.privateKeyPem),
  };
}

export async function writeBoundaryLedgerCheckpoint(): Promise<BoundaryLedgerCheckpoint> {
  await ensureLedgerDir();
  const checkpoint = await buildBoundaryLedgerCheckpoint();
  const fileName = `${checkpoint.generated_at.replaceAll(/[:.]/g, "-")}.checkpoint.json`;
  await writeAtomic(path.join(CHECKPOINT_DIR, fileName), `${JSON.stringify(checkpoint, null, 2)}\n`);
  return checkpoint;
}

export async function readBoundaryLedgerCheckpoints(): Promise<BoundaryLedgerCheckpoint[]> {
  await ensureLedgerDir();
  const entries = await fs.readdir(CHECKPOINT_DIR, { withFileTypes: true }).catch(() => []);
  const checkpoints: BoundaryLedgerCheckpoint[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    try {
      const raw = await fs.readFile(path.join(CHECKPOINT_DIR, entry.name), "utf8");
      checkpoints.push(JSON.parse(raw) as BoundaryLedgerCheckpoint);
    } catch {
      continue;
    }
  }
  return checkpoints.sort((left, right) => left.generated_at.localeCompare(right.generated_at));
}

export async function repairBoundaryLedgerChain(): Promise<{
  repaired: boolean;
  backupPath: string;
  totalRecords: number;
}> {
  await ensureLedgerDir();
  const records = await readLedgerFile(BOUNDARY_LEDGER_FILE);
  if (records.length === 0) {
    return {
      repaired: false,
      backupPath: "",
      totalRecords: 0,
    };
  }

  const backupPath = `${BOUNDARY_LEDGER_FILE}.bak.${new Date().toISOString().replaceAll(/[:.]/g, "-")}`;
  await fs.copyFile(BOUNDARY_LEDGER_FILE, backupPath);

  let prevHash = "sha256:genesis";
  const signer = await ensureBoundaryLedgerSigningIdentity();
  const repaired = records.map((record, index) => {
    const next = buildBoundaryLedgerRecord({
      index,
      prevHash,
      eventType: record.eventType,
      payload: {
        ...record.payload,
        createdAt: record.META.timestamp,
      },
      signer,
    });
    prevHash = next.META.hash;
    return next;
  });

  await writeAtomic(
    BOUNDARY_LEDGER_FILE,
    repaired.map((record) => JSON.stringify(record)).join("\n").concat("\n"),
  );
  await fs.rm(INDEX_DIR, { recursive: true, force: true }).catch(() => undefined);
  await fs.mkdir(INDEX_DIR, { recursive: true });
  const batchedIndexWrites = new Map<string, string[]>();
  for (const record of repaired) {
    for (const entry of buildBoundaryLedgerIndexEntries(record)) {
      const batch = batchedIndexWrites.get(entry.filePath) ?? [];
      batch.push(entry.value);
      batchedIndexWrites.set(entry.filePath, batch);
    }
  }
  for (const [filePath, values] of batchedIndexWrites.entries()) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await writeAtomic(filePath, `${values.join("\n")}\n`);
  }

  return {
    repaired: true,
    backupPath,
    totalRecords: repaired.length,
  };
}

export { appendBoundaryLedgerLocal };
