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
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { signedApprovalForRequest, signedDecisionForEvent } from "./verified-events.mjs";

const CHOICES = new Set(["allow_once", "deny_once", "allow_as_law", "deny_as_law"]);
const MODES = new Set(["interactive", "autonomous"]);
const APPROVAL_TIMEOUT_MS = 5 * 60_000;
// Bound operator state even when an authenticated local peer floods requests.
const MAX_PENDING_APPROVALS = 32;
// An unconsumed signed intent is necessary, not a reusable approval ticket.
const MAX_RECENT_APPROVAL_CLAIMS = 4096;
const APPROVAL_CLAIM_RETENTION_MS = 10 * 60_000;
const MAX_BODY_BYTES = 32_768;
const MAX_ACTIVITY = 200;
const clean = (value, limit = 2048) => typeof value === "string" ? value.slice(0, limit) : "";
const normalizeMode = (value) => MODES.has(value) ? value : "interactive";

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
  const approvalClaimsPath = path.join(dir, "approval-claims.json");
  let mode = "interactive";
  let server = null;
  let token = "";
  let activity = [];
  const pending = new Map();
  const recentApprovalClaims = new Map();
  let claimsWriteQueue = Promise.resolve();

  function state() {
    return {
      mode,
      running: server !== null && server.listening,
      pending: [...pending].map(([approvalId, row]) => ({
        approvalId, requestId: row.requestId, actorId: row.actorId,
        actionKind: row.actionKind, target: row.target, reason: row.reason,
        lawIds: row.lawIds, payloadSummary: row.payloadSummary,
        question: row.question, createdAt: row.createdAt,
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

  // Consume approval identity before exposing an operator prompt. This is a
  // durable, one-way transition: disconnect, denial, timeout and restart do
  // NOT re-arm an old signed request. A fresh attempt needs a fresh requestId.
  function expireOldClaims() {
    const now = Date.now();
    for (const [requestId, claimedAt] of recentApprovalClaims) {
      if (now - claimedAt > APPROVAL_CLAIM_RETENTION_MS) {
        recentApprovalClaims.delete(requestId);
      }
    }
  }

  async function persistApprovalClaims() {
    // All writers serialize snapshots; an older disk snapshot must never
    // overwrite a newer claim during two simultaneous approvals.
    const write = async () => {
      const file = `${approvalClaimsPath}.tmp-${randomUUID()}`;
      let opened;
      try {
        opened = await fs.open(file, "wx", 0o600);
        await opened.writeFile(JSON.stringify([...recentApprovalClaims]));
        await opened.sync();
        await opened.close();
        opened = null;
        await fs.rename(file, approvalClaimsPath);
      } finally {
        if (opened) await opened.close().catch(() => {});
        await fs.unlink(file).catch(() => {});
      }
    };
    const promise = claimsWriteQueue.then(write);
    claimsWriteQueue = promise.catch(() => undefined);
    return promise;
  }

  function settle(approvalId, choice) {
    const row = pending.get(approvalId);
    if (!row || !CHOICES.has(choice)) return false;
    pending.delete(approvalId);
    clearTimeout(row.timer);
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
    // An in-flight request is bound to the exact Box server generation.
    // A restart or mode transition must not resurrect approval authority.
    const requestServer = server;
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

    if (mode === "autonomous") return send(200, { mode: "autonomous" });
    // A same-user bearer-token holder is not automatically a genuine MCP
    // runtime. Require signed proof that the real runtime proposed this exact
    // action, with the approved payload fingerprint.
    const verified = await signedApprovalForRequest(home, body);
    if (!verified) {
      return send(422, { error: "no verified pending action for approval" });
    }
    // Verification may have taken time. A changed mode or Box generation
    // invalidates the original interactive hold before any claim is created.
    if (server !== requestServer || !server?.listening || res.destroyed) {
      return send(503, { error: "approval bridge no longer active" });
    }
    if (mode !== "interactive") return send(200, { mode: "autonomous" });
    const { requestId, actionKind, target } = verified;
    // The signed ledger proves the proposal existed, but cannot prove its
    // receipt is being presented for the first time. Claim its identity once,
    // persist that transition, then and only then expose the prompt.
    expireOldClaims();
    if (recentApprovalClaims.has(requestId)) {
      return send(409, { error: "signed approval already consumed" });
    }
    if (pending.size >= MAX_PENDING_APPROVALS ||
        recentApprovalClaims.size >= MAX_RECENT_APPROVAL_CLAIMS) {
      return send(429, { error: "approval capacity exhausted" });
    }
    recentApprovalClaims.set(requestId, Date.now());
    try {
      await persistApprovalClaims();
    } catch (error) {
      // A failure to make the claim durable is a refusal, never a prompt.
      console.error("[buccet-box] approval claim persistence failure:", error);
      return send(503, { error: "approval claim storage unavailable" });
    }
    if (res.destroyed || server !== requestServer || !server?.listening) return;
    if (mode !== "interactive") return send(200, { mode: "autonomous" });

    const approvalId = randomUUID();
    const answer = await new Promise((resolve) => {
      const timer = setTimeout(() => settle(approvalId, "deny_once"), APPROVAL_TIMEOUT_MS);
      // The response stream, not the already-consumed request body, defines
      // whether an operator still has a live client waiting for this answer.
      // Aborted sockets must never leave actionable stale prompts behind.
      res.once("close", () => settle(approvalId, "deny_once"));
      pending.set(approvalId, {
        requestId,
        actorId: clean(verified.actorId, 200),
        actionKind,
        target,
        reason: clean(verified.reason),
        lawIds: verified.lawIds.slice(0, 32),
        payloadSummary: clean(verified.payloadSummary, 512),
        question: clean(verified.question, 1024),
        createdAt: new Date().toISOString(),
        timer,
        resolve,
      });
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
    // A missing file is a fresh installation. A damaged file is NOT a fresh
    // installation; refusing to start avoids replay after state corruption.
    recentApprovalClaims.clear();
    let savedClaims;
    try {
      savedClaims = await fs.readFile(approvalClaimsPath, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (savedClaims !== undefined) {
      if (Buffer.byteLength(savedClaims) > 512 * 1024) {
        throw new Error("approval claim store exceeds safe size");
      }
      const rows = JSON.parse(savedClaims);
      if (!Array.isArray(rows) || rows.length > MAX_RECENT_APPROVAL_CLAIMS ||
          rows.some((row) => !Array.isArray(row) || row.length !== 2 ||
            typeof row[0] !== "string" || !row[0] ||
            !Number.isSafeInteger(row[1]) || row[1] < 0)) {
        throw new Error("approval claim store invalid; refusing replay");
      }
      for (const [requestId, claimedAt] of rows) {
        if (recentApprovalClaims.has(requestId)) {
          throw new Error("duplicate approval claim persisted");
        }
        recentApprovalClaims.set(requestId, claimedAt);
      }
    }
    expireOldClaims();
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
