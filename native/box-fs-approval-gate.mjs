/**
 * Independently privileged, operator-controlled approval gate for native effects.
 *
 * A normal (unprivileged) Buccet MCP process may only SUBMIT an exact action
 * to the public request socket. It may not approve the request, read the
 * protected broker socket, edit policy.json, or execute the native guard.
 * A separate root-owned operator channel must authorize the exact operation,
 * target(s), and SHA-256 payload fingerprint before forwarding to the broker.
 *
 * Threat model: hostile non-root processes, including same-UID agents.
 * This does not protect against a compromised privileged operator/controller.
 */
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import net from "node:net";
import path from "node:path";
import { lstatSync } from "node:fs";
import { chmod, readFile, rm } from "node:fs/promises";

const MAX_CONTENT = 8 * 1024 * 1024;
const MAX_PENDING = 16;
const MAX_REQUEST_CONNECTIONS = 48;
const MAX_OPERATOR_CONNECTIONS = 8;
const MAX_PARTIAL_REQUEST_MS = 5_000;
const APPROVAL_MS = 60_000;
const VALID_OPS = new Set(["read", "write", "append", "delete", "mkdir", "move"]);

function deny(message) { throw new Error("BUCCET_GATE_DENIED: " + message); }
function trustedDirectory(directory) {
  if (typeof directory !== "string" || !path.isAbsolute(directory) ||
      path.normalize(directory) !== directory || directory === "/") deny("untrusted directory");
  let current = "/";
  for (const segment of directory.slice(1).split("/")) {
    if (!segment || segment === "." || segment === "..") deny("invalid directory component");
    current = path.join(current, segment);
    const stat = lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink() ||
        stat.uid !== 0 || (stat.mode & 0o022)) deny("directory is not independently root-protected");
  }
}
function protectedSocket(socketPath, parent) {
  if (path.dirname(socketPath) !== parent || path.basename(socketPath).startsWith(".")) {
    deny("untrusted socket placement");
  }
  const stat = lstatSync(socketPath);
  if (!stat.isSocket() || stat.uid !== 0 || (stat.mode & 0o077)) {
    deny("underlying native broker socket is not root-exclusive");
  }
}
function relative(value) {
  if (typeof value !== "string" || !value || value.startsWith("/") ||
      value.includes("\0") || Buffer.byteLength(value) > 4096 ||
      value.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    deny("invalid action relative path");
  }
  return value;
}
function validated(body) {
  if (!body || typeof body !== "object" || !VALID_OPS.has(body.op) ||
      (body.op === "move" ? typeof body.to !== "string" : body.to !== undefined)) {
    deny("invalid operation");
  }
  const op = body.op, target = relative(body.path);
  const to = op === "move" ? relative(body.to) : undefined;
  const content = op === "write" || op === "append" ? body.content : undefined;
  if ((op === "write" || op === "append") && typeof content !== "string") {
    deny("missing exact file payload");
  }
  if (content !== undefined && Buffer.byteLength(content, "utf8") > MAX_CONTENT) {
    deny("payload too large");
  }
  if (!["write", "append"].includes(op) && body.content !== undefined) {
    deny("unexpected payload");
  }
  return { op, path: target, ...(to !== undefined ? { to } : {}),
    ...(content !== undefined ? { content } : {}) };
}
function digest(request) {
  return createHash("sha256").update(JSON.stringify(request)).digest("hex");
}
// Host identity is asserted ONLY by a root-owned registry, not by MCP CLI
// names, mutable session files, or ordinary Box bearer-token evidence.
// Test-only unbound fallback is deliberately outside the installed service.
const usedHostNonces = new Map();
async function verifyRegisteredHost(managedRoot, body, proposal, consumeNonce) {
  const file = path.join(managedRoot, "host-identities.json");
  let stat;
  try { stat = lstatSync(file); }
  catch (error) {
    if (error?.code === "ENOENT" &&
        process.env.BUCCET_GATE_TEST_ALLOW_UNBOUND_HOST === "1") return null;
    deny("no independently provisioned host identities");
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.uid !== 0 ||
      (stat.mode & 0o077) !== 0 || stat.nlink !== 1 || stat.size > 65536) {
    deny("untrusted host identity registry");
  }
  let registry;
  try { registry = JSON.parse(await readFile(file, "utf8")); }
  catch { deny("invalid host identity registry"); }
  if (!registry || registry.schema !== 1 || registry.root !== managedRoot ||
      !Array.isArray(registry.allowed) || registry.allowed.length > 64) {
    deny("host registry is not bound to protected root");
  }
  const h = body?.host;
  if (!h || typeof h !== "object" ||
      typeof h.sessionId !== "string" || !h.sessionId || h.sessionId.length > 200 ||
      typeof h.actorId !== "string" || !h.actorId || h.actorId.length > 200 ||
      typeof h.issuedAt !== "string" || !Number.isFinite(Date.parse(h.issuedAt)) ||
      Math.abs(Date.now() - Date.parse(h.issuedAt)) > 120_000 ||
      typeof h.nonce !== "string" || !/^[a-f0-9]{32}$/.test(h.nonce) ||
      typeof h.mac !== "string" || !/^[a-f0-9]{64}$/.test(h.mac)) {
    deny("unattested or expired protected host request");
  }
  const entry = registry.allowed.find(item =>
    item && item.sessionId === h.sessionId && item.actorId === h.actorId);
  if (!entry || typeof entry.secretHex !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.secretHex) ||
      (entry.expiresAt !== undefined &&
        (typeof entry.expiresAt !== "string" ||
         !Number.isFinite(Date.parse(entry.expiresAt)) ||
         Date.parse(entry.expiresAt) <= Date.now()))) {
    deny("host identity not registered by privileged operator");
  }
  const signed = JSON.stringify([
    "agent-buccet-protected-host-v1",
    h.sessionId, h.actorId, h.issuedAt, h.nonce, proposal,
  ]);
  const expected = createHmac("sha256", Buffer.from(entry.secretHex, "hex"))
    .update(signed).digest();
  const supplied = Buffer.from(h.mac, "hex");
  if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) {
    deny("host proof not bound to approved exact operation");
  }
  const nonceKey = h.sessionId + "\u0000" + h.nonce;
  const now = Date.now();
  for (const [key, created] of usedHostNonces) {
    if (now - created > 2 * 60_000) usedHostNonces.delete(key);
  }
  if (consumeNonce) {
    if (usedHostNonces.size >= 4096) deny("host replay cache exhausted");
    if (usedHostNonces.has(nonceKey)) deny("host proof replay");
    usedHostNonces.set(nonceKey, now);
  }
  return { sessionId: h.sessionId, actorId: h.actorId, verified: true };
}
async function callBroker(socketPath, request) {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath);
    let ended = false, response = "";
    const timer = setTimeout(() => finish(new Error("privileged broker timed out")), 16_000);
    timer.unref();
    function finish(error, value) {
      if (ended) return;
      ended = true;
      clearTimeout(timer);
      client.destroy();
      if (error) reject(error); else resolve(value);
    }
    // Keep the connection half-open until the broker has completed the
    // operation and returned its receipt. end() here prematurely closes the
    // server response side on the native broker's default allowHalfOpen=false.
    client.on("connect", () => client.write(JSON.stringify(request) + "\n"));
    client.on("data", chunk => {
      response += chunk.toString("utf8");
      if (Buffer.byteLength(response) > MAX_CONTENT + 8192) {
        finish(new Error("broker response too large"));
      }
    });
    client.once("end", () => {
      try {
        const result = JSON.parse(response.split("\n", 1)[0]);
        if (!result || result.ok !== true || typeof result.output !== "string") {
          throw Error("protected broker refused operation");
        }
        finish(undefined, result.output);
      } catch (error) { finish(error); }
    });
    client.once("error", error => finish(error));
    client.once("close", () => {
      if (!ended) finish(new Error("broker disconnected without verified receipt"));
    });
  });
}
function send(socket, value) {
  if (!socket.destroyed && socket.writable) socket.end(JSON.stringify(value) + "\n");
}
function serveJSON(server, handler, maxBytes, maxConnections) {
  let connected = 0;
  server.on("connection", socket => {
    connected++;
    socket.once("close", () => { connected--; });
    if (connected > maxConnections) {
      send(socket, { ok: false, error: "connection capacity reached" });
      return;
    }
    let done = false, text = "";
    // Untrusted clients cannot tie up arbitrary FDs by sending no newline.
    socket.setTimeout(MAX_PARTIAL_REQUEST_MS, () => socket.destroy());
    socket.on("data", chunk => {
      if (done) return;
      text += chunk.toString("utf8");
      if (Buffer.byteLength(text) > maxBytes) {
        done = true; send(socket, { ok: false, error: "request too large" }); return;
      }
      const boundary = text.indexOf("\n");
      if (boundary < 0) return;
      done = true;
      try {
        const body = JSON.parse(text.slice(0, boundary));
        Promise.resolve(handler(socket, body)).catch(error =>
          send(socket, { ok: false, error: String(error.message).slice(0, 250) }));
      } catch {
        send(socket, { ok: false, error: "malformed request" });
      }
    });
  });
}
async function main() {
  const [managedRoot, nativeSocket, requestSocket, controlSocket, ...rest] = process.argv.slice(2);
  if (process.platform !== "linux" || process.geteuid?.() !== 0 ||
      rest.length || !managedRoot || !nativeSocket || !requestSocket || !controlSocket) {
    deny("requires Linux root service and ROOT BROKER REQUEST_SOCKET OPERATOR_SOCKET");
  }
  trustedDirectory(managedRoot);
  trustedDirectory(path.dirname(requestSocket));
  protectedSocket(nativeSocket, managedRoot);
  if (path.dirname(requestSocket) !== path.dirname(controlSocket) ||
      path.dirname(requestSocket) === managedRoot ||
      requestSocket === controlSocket ||
      path.basename(requestSocket) !== "request.sock" ||
      path.basename(controlSocket) !== "operator.sock") deny("invalid separated socket locations");
  for (const p of [requestSocket, controlSocket]) {
    try { lstatSync(p); deny("refusing existing socket"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const pending = new Map();
  let serial = Promise.resolve();
  function retire(id, reason) {
    const row = pending.get(id);
    if (!row) return false;
    pending.delete(id);
    clearTimeout(row.timer);
    if (reason) send(row.socket, { ok: false, error: reason });
    return true;
  }
  const requestServer = net.createServer();
  serveJSON(requestServer, async (socket, body) => {
    const proposal = validated(body);
    // The root operator's signed host registry is the trust root. Neither
    // a copied victim actor name nor an arbitrary request FD can authenticate.
    const host = await verifyRegisteredHost(managedRoot, body, proposal, true);
    if (socket.destroyed) return;
    if (pending.size >= MAX_PENDING) {
      send(socket, { ok: false, error: "approval queue full" }); return;
    }
    const requestId = randomUUID();
    const timer = setTimeout(() => retire(requestId, "operator approval expired"), APPROVAL_MS);
    timer.unref();
    pending.set(requestId, { requestId, digest: digest(proposal),
      proposal, host, hostProof: body?.host, socket, timer });
    socket.once("close", () => retire(requestId));
    socket.setTimeout(APPROVAL_MS + 6000, () => socket.destroy());
    // The untrusted client receives only the eventual approved response.
    // The root operator learns identity/digest over a private control socket.
  }, MAX_CONTENT + 8192, MAX_REQUEST_CONNECTIONS);

  const operatorServer = net.createServer();
  serveJSON(operatorServer, (socket, body) => {
    if (body?.command === "list") {
      send(socket, { ok: true, pending: [...pending.values()].map(row => ({
        requestId: row.requestId, sha256: row.digest,
        op: row.proposal.op, path: row.proposal.path, to: row.proposal.to ?? null,
        host: row.host,
        bytes: Buffer.byteLength(row.proposal.content ?? ""),
        preview: (row.proposal.content ?? "").slice(0, 160),
      })) });
      return;
    }
    if (body?.command === "inspect") {
      const row = typeof body.requestId === "string"
        ? pending.get(body.requestId) : null;
      if (!row) {
        send(socket, { ok: false, error: "no live request to inspect" }); return;
      }
      // Only the root operator channel exposes the ENTIRE exact request.
      // Public request clients never receive other actors' payloads.
      send(socket, { ok: true, requestId: row.requestId,
        sha256: row.digest, proposal: row.proposal, host: row.host });
      return;
    }
    if (body?.command !== "approve" && body?.command !== "deny") {
      send(socket, { ok: false, error: "unknown operator decision" }); return;
    }
    const id = body.requestId;
    const row = typeof id === "string" ? pending.get(id) : null;
    if (!row || body.sha256 !== row.digest) {
      send(socket, { ok: false, error: "unknown request or mismatched exact digest" }); return;
    }
    pending.delete(id); // one-time transition BEFORE any broker effect.
    clearTimeout(row.timer);
    if (body.command === "deny") {
      send(row.socket, { ok: false, error: "privileged operator denied" });
      send(socket, { ok: true, denied: true }); return;
    }
    send(socket, { ok: true, approved: true });
    if (row.socket.destroyed || !row.socket.writable) return;
    const effect = async () => {
      // Revocation by disconnect remains meaningful even if a previous
      // approved effect is still occupying the single broker queue.
      if (row.socket.destroyed || !row.socket.writable) return;
      // Revoking a registered host while an operation waits at the operator
      // console must deny it before the native syscall, even after a click.
      try {
        await verifyRegisteredHost(managedRoot,
          { host: row.hostProof }, row.proposal, false);
        const output = await callBroker(nativeSocket, row.proposal);
        send(row.socket, { ok: true, output });
      } catch {
        send(row.socket, { ok: false, error: "protected broker denied effect" });
      }
    };
    serial = serial.then(effect, effect);
  }, 2048, MAX_OPERATOR_CONNECTIONS);

  await new Promise((resolve, reject) => {
    requestServer.once("error", reject);
    requestServer.listen(requestSocket, resolve);
  });
  await chmod(requestSocket, 0o666);
  await new Promise((resolve, reject) => {
    operatorServer.once("error", reject);
    operatorServer.listen(controlSocket, resolve);
  });
  await chmod(controlSocket, 0o600);
  const [pub, priv] = [lstatSync(requestSocket), lstatSync(controlSocket)];
  if (pub.uid !== 0 || (pub.mode & 0o777) !== 0o666 ||
      priv.uid !== 0 || (priv.mode & 0o077)) deny("failed to establish independent operator socket");
  console.log("BUCCET_APPROVAL_GATE_READY");
  const shutdown = async () => {
    for (const id of pending.keys()) retire(id, "approval gate shutting down");
    requestServer.close();
    operatorServer.close();
    await rm(requestSocket, { force: true }).catch(() => {});
    await rm(controlSocket, { force: true }).catch(() => {});
  };
  process.once("SIGTERM", () => { void shutdown(); });
}
main().catch(error => {
  console.error("BUCCET_GATE_DENIED:", error?.message ?? "startup failed");
  process.exitCode = 73;
});
