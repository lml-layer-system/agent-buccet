/**
 * Agent Buccet Box local transport.
 *
 * A small local operator surface. It does not evaluate law and cannot execute
 * MCP tools. Only the public runtime/Bodyguard determines whether action lands.
 *
 * SECURITY: The token is a same-user capability, not a sandbox boundary.
 * Another process running as the same OS user can potentially access local
 * session files. Host runtime protection requires genuine intercept coverage.
 */
import http from "node:http";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { signedDecisionForEvent } from "./verified-events.mjs";

const ALLOW_CHOICES = new Set(["allow_once", "allow_as_law"]);
const CHOICES = new Set(["allow_once", "deny_once", "allow_as_law", "deny_as_law"]);
const MODES = new Set(["interactive", "autonomous"]);
const APPROVAL_TIMEOUT_MS = 5 * 60_000;
const MAX_BODY_BYTES = 32_768;
const MAX_ACTIVITY = 200;
// Minimum time a newly-surfaced request must be on screen before an ALLOW is
// accepted. Structurally defeats approval-fatigue / auto-advance: a click that
// lands faster than a human could have read a just-promoted request is refused.
// Denials are never delayed — denying fast is always safe.
const REVIEW_DWELL_MS = 650;
const clean = (value, limit = 2048) => typeof value === "string" ? value.slice(0, limit) : "";
const normalizeMode = (value) => MODES.has(value) ? value : "interactive";

// Canonical identity of a held proposal. The operator's decision is bound to
// THIS fingerprint, so a click can never be applied to a different request that
// has since taken the front of the queue.
function approvalFingerprint(row) {
  const canonical = JSON.stringify([
    "buccet-box-approval-v1",
    row.requestId, row.actorId, row.actionKind, row.target, row.payloadSummary ?? "",
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("request exceeds the local bridge limit"));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.once("end", () => {
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("expected an object");
        }
        resolve(parsed);
      } catch (error) { reject(error); }
    });
    req.once("error", reject);
  });
}

function authenticated(req, token) {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7), "utf8");
  const expected = Buffer.from(token, "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function createBuccetBoxBackend({
  home = process.env.AGENT_BUCCET_HOME || path.join(os.homedir(), ".buccet"),
  onChange = () => {},
  notify = () => {},
} = {}) {
  const dir = path.join(home, "box");
  const bridgePath = path.join(dir, "bridge.json");
  const modePath = path.join(dir, "mode.json");
  const activityPath = path.join(dir, "activity.json");
  let mode = "interactive";
  let server = null;
  let token = "";
  let activity = [];
  const pending = new Map();
  // Which held request is currently at the front of the queue, and when it
  // arrived there. A decision is only "review-ready" once it has been presented
  // for REVIEW_DWELL_MS, so the auto-advanced next request cannot inherit the
  // momentum of the click that cleared the previous one.
  let headId = null;
  let headPresentedAt = 0;

  function refreshHead() {
    const front = pending.keys().next().value ?? null;
    if (front !== headId) {
      headId = front;
      headPresentedAt = front ? Date.now() : 0;
    }
  }

  function state() {
    refreshHead();
    const now = Date.now();
    return {
      mode,
      running: server !== null && server.listening,
      pending: [...pending].map(([approvalId, row], index) => ({
        approvalId, requestId: row.requestId, actorId: row.actorId,
        actionKind: row.actionKind, target: row.target, reason: row.reason,
        lawIds: row.lawIds, payloadSummary: row.payloadSummary,
        question: row.question, createdAt: row.createdAt,
        fingerprint: row.fingerprint,
        // Only the front request carries a review clock; it becomes allowable
        // REVIEW_DWELL_MS after it surfaced.
        reviewReadyInMs: index === 0 ? Math.max(0, REVIEW_DWELL_MS - (now - headPresentedAt)) : REVIEW_DWELL_MS,
      })),
      activity: activity.map((entry) => ({ ...entry })),
    };
  }

  function emit() { onChange(state()); }

  async function persistActivity() {
    const file = `${activityPath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(file, JSON.stringify(activity), { mode: 0o600 });
    await fs.rename(file, activityPath);
  }

  // `operator` carries the decision made in the window: the fingerprint of the
  // request that was actually on screen, used to bind the click to that exact
  // proposal and to enforce the review dwell. Internal callers (timeout, mode
  // switch, shutdown) omit it and always settle immediately (deny).
  function settle(approvalId, choice, operator = null) {
    const row = pending.get(approvalId);
    if (!row || !CHOICES.has(choice)) return false;
    if (operator) {
      // The decision must match the exact proposal the operator reviewed...
      if (operator.fingerprint !== row.fingerprint) return false;
      // ...and an ALLOW must not land before a human could have read a
      // freshly-surfaced front request.
      refreshHead();
      if (ALLOW_CHOICES.has(choice) && approvalId === headId &&
          Date.now() - headPresentedAt < REVIEW_DWELL_MS) {
        return false;
      }
    }
    pending.delete(approvalId);
    clearTimeout(row.timer);
    refreshHead();
    row.resolve({ mode: "interactive", choice });
    emit();
    return true;
  }

  async function setMode(next) {
    if (!MODES.has(next)) throw new Error("invalid mode");
    // Switching modes never silently authorizes an already-frozen proposal.
    if (mode !== next) {
      for (const id of [...pending.keys()]) settle(id, "deny_once");
    }
    mode = next;
    await fs.writeFile(modePath, JSON.stringify({ mode }), { mode: 0o600 });
    emit();
    return state();
  }

  async function handle(req, res) {
    const send = (code, body) => {
      if (res.writableEnded || res.destroyed) return;
      res.writeHead(code, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(body));
    };

    if (!authenticated(req, token)) return send(401, { error: "unauthorized" });
    if (req.method !== "POST") return send(405, { error: "method not allowed" });
    const route = new URL(req.url || "/", "http://127.0.0.1").pathname;
    if (route !== "/v1/approval" && route !== "/v1/event") {
      return send(404, { error: "not found" });
    }

    let body;
    try { body = await readBody(req); }
    catch { return send(400, { error: "invalid input" }); }

    if (route === "/v1/event") {
      if (body.decision !== "allow" && body.decision !== "deny") {
        return send(400, { error: "invalid verdict" });
      }
      // A bearer token only authorizes access to this local endpoint.
      // It cannot mint evidence of an action. Read the signed receipt
      // and derive ALL displayed decision fields from the verified ledger.
      const verified = await signedDecisionForEvent(home, body);
      if (!verified) return send(422, { error: "no verified ledger receipt for this event" });
      if (activity.some((row) => row.requestId === verified.requestId &&
            row.decision === verified.decision)) {
        return send(409, { error: "duplicate signed decision" });
      }
      const entry = {
        id: randomUUID(), ...verified,
        occurredAt: new Date().toISOString(),
      };
      activity = [entry, ...activity].slice(0, MAX_ACTIVITY);
      try { await persistActivity(); }
      catch (error) { console.error("[buccet-box] activity persistence failed:", error); }
      notify({ type: "decision", ...entry });
      emit();
      return send(200, { recorded: true });
    }

    const requestId = clean(body.requestId, 200);
    const actionKind = clean(body.actionKind, 100);
    const target = clean(body.target);
    if (!requestId || !actionKind || !target) {
      return send(400, { error: "missing approval identity" });
    }
    if (mode === "autonomous") return send(200, { mode: "autonomous" });

    const approvalId = randomUUID();
    const answer = await new Promise((resolve) => {
      const timer = setTimeout(() => settle(approvalId, "deny_once"), APPROVAL_TIMEOUT_MS);
      const row = {
        requestId,
        actorId: clean(body.actorId, 200),
        actionKind,
        target,
        reason: clean(body.reason),
        lawIds: Array.isArray(body.lawIds) ? body.lawIds.filter((x) => typeof x === "string").slice(0, 32) : [],
        payloadSummary: clean(body.payloadSummary, 512),
        question: clean(body.question, 1024),
        createdAt: new Date().toISOString(),
        timer,
        resolve,
      };
      row.fingerprint = approvalFingerprint(row);
      pending.set(approvalId, row);
      refreshHead();
      notify({ type: "approval", actionKind, target });
      emit();
    });
    return send(200, answer);
  }

  async function start() {
    if (server) throw new Error("box already started");
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    try {
      const saved = JSON.parse(await fs.readFile(modePath, "utf8"));
      mode = normalizeMode(saved.mode);
    } catch { mode = "interactive"; }
    try {
      const saved = JSON.parse(await fs.readFile(activityPath, "utf8"));
      activity = [];
      if (Array.isArray(saved)) {
        for (const row of saved.slice(0, MAX_ACTIVITY)) {
          if (row?.verified !== true || typeof row.receiptHash !== "string") continue;
          const verified = await signedDecisionForEvent(home, row, { maxAgeMs: Infinity });
          if (verified && verified.receiptHash === row.receiptHash) {
            activity.push({ id: clean(row.id, 200), ...verified, occurredAt: row.occurredAt });
          }
        }
      }
    } catch { activity = []; }

    token = randomBytes(32).toString("hex");
    server = http.createServer((req, res) => {
      handle(req, res).catch((error) => {
        console.error("[buccet-box] local bridge error:", error);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "bridge failure" }));
        } else {
          res.end();
        }
      });
    });
    try {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("missing TCP port");
      const origin = `http://127.0.0.1:${addr.port}/`;
      await fs.writeFile(bridgePath, JSON.stringify({ version: 1, origin, token }), { mode: 0o600 });
      emit();
      return { origin, bridgePath };
    } catch (error) {
      server?.close();
      server = null;
      throw error;
    }
  }

  async function stop() {
    for (const id of [...pending.keys()]) settle(id, "deny_once");
    if (server) {
      const active = server;
      server = null;
      await new Promise((resolve) => active.close(resolve));
    }
    try {
      const settings = JSON.parse(await fs.readFile(bridgePath, "utf8"));
      if (settings.token === token) await fs.unlink(bridgePath);
    } catch { /* bridge removed or superseded */ }
    emit();
  }

  return { start, stop, state, settle, setMode };
}
