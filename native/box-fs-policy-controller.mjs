/**
 * OS-trusted policy controller for the independently owned native broker.
 *
 * Not an agent-accessible API. An operator/privileged host must launch this
 * installed, root-owned program under a distinct OS principal. The signed
 * grant / approval layer remains responsible for when that host may execute.
 *
 * This controller REFUSES self-declared agent laws: only a root-owned policy
 * file within the protected root can authorize a real filesystem operation.
 */
import net from "node:net";
import path from "node:path";
import { lstatSync } from "node:fs";
import { readFile } from "node:fs/promises";

const MAX_PAYLOAD = 8 * 1024 * 1024;
const MAX_RESPONSE = MAX_PAYLOAD + 8192;
const operations = new Set(["read", "write", "append", "delete", "mkdir", "move"]);

function denied(reason) {
  throw new Error("BUCCET_POLICY_DENIED: " + reason);
}
function trustedTree(root) {
  if (typeof root !== "string" || !path.isAbsolute(root) ||
      path.normalize(root) !== root || root === "/") {
    denied("invalid protected root");
  }
  let entry = "/";
  for (const part of root.slice(1).split("/")) {
    if (!part || part === "." || part === "..") denied("invalid root component");
    entry = path.join(entry, part);
    let st;
    try { st = lstatSync(entry); }
    catch { denied("protected root does not exist"); }
    if (!st.isDirectory() || st.isSymbolicLink() ||
        st.uid !== 0 || (st.mode & 0o022) !== 0) {
      denied("untrusted protected root ancestry");
    }
  }
}
function safeRelative(p) {
  if (typeof p !== "string" || !p || Buffer.byteLength(p) > 4096 ||
      p.startsWith("/") || p.includes("\u0000") ||
      p.split("/").some(part => !part || part === "." || part === "..")) {
    denied("invalid relative path");
  }
  return p;
}
function approvedEntry(record, op, paths, now) {
  if (!record || typeof record !== "object" ||
      record.op !== op || typeof record.prefix !== "string" ||
      !record.prefix || record.prefix.startsWith("/") ||
      record.prefix.split("/").some(part => !part || part === "." || part === "..")) {
    return false;
  }
  if (record.expiresAt !== undefined &&
      (typeof record.expiresAt !== "string" ||
       !Number.isFinite(Date.parse(record.expiresAt)) ||
       Date.parse(record.expiresAt) <= now)) return false;
  return paths.every(p => p === record.prefix || p.startsWith(record.prefix + "/"));
}
async function readPolicy(root) {
  const file = path.join(root, "policy.json");
  let st;
  try { st = lstatSync(file); }
  catch { denied("operator policy unavailable"); }
  if (!st.isFile() || st.isSymbolicLink() || st.uid !== 0 ||
      (st.mode & 0o077) !== 0 || st.nlink !== 1 || st.size > 65536) {
    denied("operator policy not protected by the independent principal");
  }
  let text;
  try { text = await readFile(file, "utf8"); }
  catch { denied("cannot read protected operator policy"); }
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { denied("malformed operator policy"); }
  if (!parsed || parsed.schema !== 1 || parsed.root !== root ||
      !Array.isArray(parsed.allowed) || parsed.allowed.length > 64) {
    denied("operator policy does not bind this protected root");
  }
  return parsed.allowed;
}
async function boundedInput() {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > MAX_PAYLOAD) denied("filesystem content exceeds bounded limit");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function communicate(socketPath, payload) {
  const serialized = JSON.stringify(payload) + "\n";
  if (Buffer.byteLength(serialized) > MAX_PAYLOAD + 8192) {
    denied("protected action too large");
  }
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ path: socketPath });
    let finished = false, response = "";
    function complete(error, result) {
      if (finished) return;
      finished = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(result);
    }
    socket.setTimeout(16000, () => complete(new Error("protected broker timed out")));
    socket.once("connect", () => socket.write(serialized));
    socket.on("data", chunk => {
      response += chunk.toString("utf8");
      if (Buffer.byteLength(response) > MAX_RESPONSE) {
        complete(new Error("protected response exceeded size limit"));
      }
    });
    socket.once("error", error => complete(new Error("broker unavailable: " + error.message)));
    socket.once("end", () => {
      try {
        const result = JSON.parse(response.split("\n", 1)[0]);
        if (!result || result.ok !== true || typeof result.output !== "string") {
          throw new Error("broker refused effect");
        }
        complete(null, result.output);
      } catch (error) { complete(error); }
    });
    socket.once("close", () => {
      if (!finished) complete(new Error("broker disconnected before verified receipt"));
    });
  });
}
async function main() {
  if (process.platform !== "linux" || process.geteuid?.() !== 0) {
    denied("trusted OS controller principal required");
  }
  const [root, op, relative, to, ...extras] = process.argv.slice(2);
  if (extras.length || !operations.has(op) ||
      (op === "move" ? to === undefined : to !== undefined)) {
    denied("invalid controller operation");
  }
  trustedTree(root);
  const src = safeRelative(relative);
  const dst = op === "move" ? safeRelative(to) : undefined;
  const paths = dst ? [src, dst] : [src];
  const policy = await readPolicy(root);
  if (!policy.some(entry => approvedEntry(entry, op, paths, Date.now()))) {
    denied("no independent operator-approved path authority");
  }
  // The independent broker has root-only directory and socket permissions.
  const socketPath = path.join(root, "broker.sock");
  let socketSt;
  try { socketSt = lstatSync(socketPath); }
  catch { denied("privileged broker unavailable"); }
  if (!socketSt.isSocket() || socketSt.uid !== 0 ||
      (socketSt.mode & 0o077) !== 0) denied("untrusted broker socket");
  const content = (op === "write" || op === "append") ? await boundedInput() : "";
  const output = await communicate(socketPath, {
    op, path: src,
    ...(dst !== undefined ? { to: dst } : {}),
    ...(op === "write" || op === "append" ? { content } : {}),
  });
  process.stdout.write(output);
}
main().catch(error => {
  console.error("BUCCET_POLICY_DENIED:", error instanceof Error ? error.message : "policy check failed");
  process.exitCode = 73;
});
