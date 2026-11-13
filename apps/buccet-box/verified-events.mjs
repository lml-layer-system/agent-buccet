/**
 * The Box's activity feed must not take "allow" or "deny" from arbitrary
 * clients as evidence. Each decision MUST match an unmodified, Ed25519-signed
 * canonical Buccet ledger receipt from this instance's local ledger.
 *
 * A same-user process that can steal the *ledger signing private key* or
 * rewrite the root of trust is outside this trust model. This independently
 * blocks bearer-token-only event forgery, but is not a multi-user sandbox.
 */
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const MAX_LEDGER_BYTES = 32 * 1024 * 1024;
const MAX_EVENT_AGE_MS = 120_000;

function stableStringify(value) {
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return "{" + entries.map(([key, item]) =>
      JSON.stringify(key) + ":" + stableStringify(item)).join(",") + "}";
  }
  return JSON.stringify(value);
}

function canonicalHash(record) {
  const meta = record.META;
  const entry = {
    index: record.index, eventType: record.eventType, payload: record.payload,
    INPUT: record.INPUT, DECISION: record.DECISION, PATH: record.PATH,
    NEXT: record.NEXT, OPTIONS: record.OPTIONS,
    META: {
      id: meta.id, timestamp: meta.timestamp, prev_hash: meta.prev_hash,
      session_id: meta.session_id, depth: meta.depth,
      event_type: meta.event_type, hash_version: meta.hash_version,
    },
  };
  const serialized = JSON.parse(JSON.stringify(entry));
  return "sha256:" + createHash("sha256").update(stableStringify(serialized)).digest("hex");
}

/**
 * One independent signed-chain verifier for both decisions and operator prompts.
 * A bearer token never grants permission to invent either kind of event.
 */
async function readVerifiedLedgerRecords(home) {
  try {
    const folder = path.join(home, "data", "ledger");
    const [publicPem, stat] = await Promise.all([
      fs.readFile(path.join(folder, "keys", "ledger-signing-public.pem"), "utf8"),
      fs.stat(path.join(folder, "agent-boundary-ledger.jsonl")),
    ]);
    if (stat.size > MAX_LEDGER_BYTES || stat.size <= 0) return null;
    const key = createPublicKey(publicPem);
    const signerId = "ed25519:" +
      createHash("sha256").update(key.export({ format: "der", type: "spki" })).digest("hex");
    const lines = (await fs.readFile(path.join(folder, "agent-boundary-ledger.jsonl"), "utf8"))
      .split("\n").filter(Boolean);
    if (!lines.length) return null;
    const records = lines.map((line) => JSON.parse(line));
    let expectedPrev = "sha256:genesis";
    let expectedIndex = 0;
    for (const record of records) {
      const meta = record?.META;
      if (!meta || meta.hash_version !== "json-v2" ||
          record.index !== expectedIndex ||
          meta.prev_hash !== expectedPrev || meta.signer_id !== signerId ||
          meta.signature_algo !== "ed25519" || typeof meta.signature !== "string" ||
          typeof meta.hash !== "string" || canonicalHash(record) !== meta.hash ||
          !verifySignature(null, Buffer.from(meta.hash, "utf8"), key,
            Buffer.from(meta.signature, "base64"))) {
        return null;
      }
      expectedIndex += 1;
      expectedPrev = meta.hash;
    }
    return records;
  } catch {
    return null;
  }
}

/**
 * Returns the trusted event from the signed ledger, or null.
 * Caller-supplied fields only locate/match the signed receipt.
 */
export async function signedDecisionForEvent(home, body, { maxAgeMs = MAX_EVENT_AGE_MS } = {}) {
  if (!body || !["allow", "deny"].includes(body.decision) ||
      typeof body.requestId !== "string" || !body.requestId ||
      typeof body.actorId !== "string" || typeof body.actionKind !== "string" ||
      typeof body.target !== "string") {
    return null;
  }
  try {
    const records = await readVerifiedLedgerRecords(home);
    if (!records) return null;
    const expectedEventType = body.decision === "allow" ? "ACTION_EXECUTED" : "ACTION_BLOCKED";
    const receipt = records.findLast((record) =>
      record.eventType === expectedEventType &&
      record.payload?.requestId === body.requestId &&
      record.payload.actorId === body.actorId &&
      record.payload.actionKind === body.actionKind &&
      record.payload.target === body.target &&
      record.payload.decision === body.decision);
    if (!receipt) return null;
    const when = Date.parse(receipt.META.timestamp);
    if (!Number.isFinite(when) || Math.abs(Date.now() - when) > maxAgeMs) {
      return null;
    }
    return {
      requestId: receipt.payload.requestId,
      actorId: receipt.payload.actorId,
      actionKind: receipt.payload.actionKind,
      target: receipt.payload.target,
      decision: receipt.payload.decision,
      reason: receipt.payload.reason,
      receiptId: receipt.META.id,
      receiptHash: receipt.META.hash,
      verified: true,
    };
  } catch {
    // Missing, tampered, unsigned or unreadable audit evidence => no decision.
    return null;
  }
}

/**
 * Signed, recent APPROVAL_REQUESTED receipt is required before the Box
 * displays a decision prompt. All visible facts come from the signed ledger;
 * payloadSummary is shown only if its exact SHA-256 matches the signed hash.
 *
 * This protects against stolen-Bearer-only spoofed prompts, NOT a same-OS-user
 * process that can steal the ledger private signing key.
 */
export async function signedApprovalForRequest(home, body) {
  if (!body || typeof body.requestId !== "string" || !body.requestId ||
      typeof body.sessionId !== "string" || typeof body.actorId !== "string" ||
      typeof body.actionKind !== "string" || typeof body.target !== "string" ||
      (body.payloadSummary !== undefined && typeof body.payloadSummary !== "string")) {
    return null;
  }
  const records = await readVerifiedLedgerRecords(home);
  if (!records) return null;
  const payloadSummary = body.payloadSummary ?? "";
  const payloadHash = createHash("sha256").update(payloadSummary).digest("hex");
  const receipt = records.findLast((record) => {
    const p = record.payload;
    return record.eventType === "APPROVAL_REQUESTED" &&
      p?.requestId === body.requestId &&
      p?.sessionId === body.sessionId &&
      p?.actorId === body.actorId &&
      p?.actionKind === body.actionKind &&
      p?.target === body.target &&
      p?.decision === "require_approval" &&
      p?.metadata?.approvalPayloadHash === payloadHash;
  });
  if (!receipt) return null;
  const when = Date.parse(receipt.META.timestamp);
  if (!Number.isFinite(when) || Math.abs(Date.now() - when) > MAX_EVENT_AGE_MS) {
    return null;
  }
  // Do not resurrect an already-decided request by replaying its signed proof.
  const finished = records.some((record) => record.index > receipt.index &&
    ["ACTION_EXECUTED", "ACTION_BLOCKED", "APPROVAL_DENIED"].includes(record.eventType) &&
    record.payload?.requestId === body.requestId);
  if (finished) return null;
  return {
    requestId: receipt.payload.requestId,
    sessionId: receipt.payload.sessionId,
    actorId: receipt.payload.actorId,
    actionKind: receipt.payload.actionKind,
    target: receipt.payload.target,
    reason: receipt.payload.reason || "Buccet requires operator approval",
    lawIds: receipt.payload.lawIds ?? [],
    payloadSummary,
    question: `Should ${receipt.payload.actorId} perform ${receipt.payload.actionKind} on ${receipt.payload.target}?`,
  };
}
