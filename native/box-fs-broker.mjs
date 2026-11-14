/**
 * Experimental privileged native filesystem broker.
 *
 * SECURITY CONTRACT: This daemon and the native guard are installed under a
 * root-owned, non-group/other-writable directory tree. Only a separate,
 * trusted OS principal may reach the root-owned UNIX socket. Untrusted agents
 * cannot write the managed workspace or socket, even when they share a UID
 * with one another. Authorization is performed by the trusted controller;
 * this broker does NOT authenticate arbitrary same-UID agent calls.
 *
 * Not enabled by the production MCP route. No compatibility fallback.
 */
import net from "node:net";
import path from "node:path";
import { lstatSync, statSync, unlinkSync } from "node:fs";
import { chmod, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const LIMIT = 8 * 1024 * 1024;
const { argv } = process;
if (process.platform !== "linux" || process.geteuid?.() !== 0 || argv.length !== 5) {
  throw new Error("BUCCET_BROKER_DENIED: privileged Linux launch requires ROOT GUARD SOCKET");
}
const [, , managedRoot, guardPath, socketPath] = argv;
const operations = new Set(["read", "write", "append", "delete", "mkdir", "move"]);
function trustedTree(directory) {
  if (!path.isAbsolute(directory) || path.normalize(directory) !== directory) {
    throw new Error("BUCCET_BROKER_DENIED: trusted path must be absolute and normalized");
  }
  const segments = directory.slice(1).split("/").filter(Boolean);
  let entry = "/";
  for (const segment of segments) {
    entry = path.join(entry, segment);
    const st = lstatSync(entry);
    if (!st.isDirectory() || st.isSymbolicLink() || st.uid !== 0 || (st.mode & 0o022) !== 0) {
      throw new Error("BUCCET_BROKER_DENIED: path has attacker-writable or linked ancestor");
    }
  }
}
trustedTree(managedRoot);
trustedTree(path.dirname(guardPath));
trustedTree(path.dirname(socketPath));
if (path.dirname(socketPath) !== managedRoot) {
  throw new Error("BUCCET_BROKER_DENIED: socket must live in managed workspace");
}
const executable = statSync(guardPath);
if (!executable.isFile() || executable.uid !== 0 || (executable.mode & 0o022) !== 0 ||
    (executable.mode & 0o111) === 0) {
  throw new Error("BUCCET_BROKER_DENIED: untrusted native executable");
}
/**
 * A SIGKILL leaves a pathname behind after the kernel closes the listener.
 * Never unlink a live or untrusted object. Only the protected root principal
 * can modify this directory, and we verify both the socket identity AND
 * lack of a live listener before reclaiming the exact same inode.
 */
async function reclaimDeadBrokerSocket(candidate) {
  let observed;
  try { observed = lstatSync(candidate); }
  catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  if (!observed.isSocket() || observed.isSymbolicLink() || observed.uid !== 0) {
    throw new Error("BUCCET_BROKER_DENIED: existing socket is not independently root-owned");
  }
  const listener = await new Promise((resolve, reject) => {
    const probe = net.createConnection({ path: candidate });
    let done = false;
    const finish = (err, state) => {
      if (done) return;
      done = true;
      probe.destroy();
      if (err) reject(err); else resolve(state);
    };
    probe.setTimeout(700, () =>
      finish(new Error("BUCCET_BROKER_DENIED: socket liveness indeterminate")));
    probe.once("connect", () => finish(undefined, "live"));
    probe.once("error", error => {
      if (error.code === "ECONNREFUSED") finish(undefined, "dead");
      else if (error.code === "ENOENT") finish(undefined, "missing");
      else finish(error);
    });
  });
  if (listener === "live") {
    throw new Error("BUCCET_BROKER_DENIED: protected listener already active");
  }
  if (listener === "missing") return;
  let current;
  try { current = lstatSync(candidate); }
  catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  if (!current.isSocket() || current.uid !== 0 ||
      current.ino !== observed.ino || current.dev !== observed.dev) {
    throw new Error("BUCCET_BROKER_DENIED: socket identity changed during recovery");
  }
  unlinkSync(candidate);
  console.log("BUCCET_BROKER_STALE_ROOT_SOCKET_RECLAIMED");
}
await reclaimDeadBrokerSocket(socketPath);
function relativePath(p) {
  if (typeof p !== "string" || !p || Buffer.byteLength(p) > 4096 ||
      p.includes("\0") || p.startsWith("/") ||
      p.split("/").some(segment => !segment || segment === "." || segment === "..")) {
    throw new Error("BUCCET_BROKER_DENIED: invalid relative path");
  }
  return p;
}
async function requireIndependentPolicy(operation, paths) {
  // Policy is owned by the root broker principal, not by the agent or the
  // calling process. Check EVERY request; raw socket access is not a grant.
  const file = path.join(managedRoot, "policy.json");
  let st;
  try { st = lstatSync(file); }
  catch { throw new Error("BUCCET_BROKER_DENIED: protected operator policy unavailable"); }
  if (!st.isFile() || st.isSymbolicLink() || st.uid !== 0 ||
      (st.mode & 0o077) !== 0 || st.nlink !== 1 || st.size > 65536) {
    throw new Error("BUCCET_BROKER_DENIED: untrusted operator policy file");
  }
  let policy;
  try { policy = JSON.parse(await readFile(file, "utf8")); }
  catch { throw new Error("BUCCET_BROKER_DENIED: unreadable operator policy"); }
  if (!policy || policy.schema !== 1 || policy.root !== managedRoot ||
      !Array.isArray(policy.allowed) || policy.allowed.length > 64) {
    throw new Error("BUCCET_BROKER_DENIED: invalid operator policy");
  }
  const now = Date.now();
  const match = (entry, p) => entry && entry.op === operation &&
    typeof entry.prefix === "string" && !!entry.prefix &&
    !entry.prefix.startsWith("/") &&
    entry.prefix.split("/").every(part => part && part !== "." && part !== "..") &&
    (entry.expiresAt === undefined ||
      (typeof entry.expiresAt === "string" &&
       Number.isFinite(Date.parse(entry.expiresAt)) &&
       Date.parse(entry.expiresAt) > now)) &&
    (p === entry.prefix || p.startsWith(entry.prefix + "/"));
  if (!paths.every(p => policy.allowed.some(entry => match(entry, p)))) {
    throw new Error("BUCCET_BROKER_DENIED: independent operator policy denied action");
  }
}
async function runGuard(body) {
  if (!body || typeof body !== "object" || !operations.has(body.op)) {
    throw new Error("BUCCET_BROKER_DENIED: invalid operation");
  }
  const operation = body.op;
  const src = relativePath(body.path);
  const target = operation === "move" ? relativePath(body.to) : undefined;
  // Every operation, including read and both move paths, is bound to an
  // independently protected grant. No policy => no effects.
  await requireIndependentPolicy(operation, target ? [src, target] : [src]);
  const args = [operation, managedRoot, src];
  if (operation === "move") args.push(managedRoot, target);
  const content = operation === "write" || operation === "append" ? body.content : "";
  if (typeof content !== "string" || Buffer.byteLength(content) > LIMIT) {
    throw new Error("BUCCET_BROKER_DENIED: payload must be bounded text");
  }
  return await new Promise((resolve, reject) => {
    const proc = spawn(guardPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { PATH: "/usr/bin:/bin", LANG: "C" },
      cwd: "/",
    });
    let output = "";
    let error = "";
    let failed = false;
    const timeout = setTimeout(() => { failed = true; proc.kill("SIGKILL"); }, 15000);
    proc.stdout.on("data", chunk => {
      output += chunk.toString("utf8");
      if (Buffer.byteLength(output) > LIMIT) { failed = true; proc.kill("SIGKILL"); }
    });
    proc.stderr.on("data", chunk => { error += chunk.toString("utf8").slice(0, 512); });
    proc.on("error", reject);
    proc.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (failed || code !== 0) {
        // A killed/missing native guard could have crossed renameat before
        // its receipt; exit 74 explicitly means a post-mutation fsync failed.
        // Never tell clients their mutating effect was definitively denied.
        const uncertain = operation !== "read" &&
          (failed || signal !== null || code === 74 ||
            error.includes("BUCCET_FS_COMMIT_UNCERTAIN"));
        const reason = uncertain
          ? "BUCCET_BROKER_COMMIT_UNCERTAIN: inspect protected state before retry"
          : "BUCCET_BROKER_DENIED: " + (error.slice(0, 768) || "native guard unavailable");
        const failure = new Error(reason);
        failure.uncertain = uncertain;
        reject(failure);
      } else {
        resolve(output);
      }
    });
    proc.stdin.end(content);
    proc.stdin.on("error", () => {});
  });
}
// Kernel renameat is atomic per entry, but append is READ + COPY + RENAME.
// Overlapping privileged append processes can all report success while each
// publishes an inode copied from the same original bytes. Make EVERY native
// mutation a single-file-system transaction at this broker's effect boundary;
// read operations remain permitted in parallel because rename is atomic.
// Run the independent root-owned policy check INSIDE the queue, so a revoked
// grant cannot be cached while an operation waits its turn.
let mutationTail = Promise.resolve();
function executeGuard(request) {
  if (request?.op === "read") return runGuard(request);
  const next = mutationTail.then(() => runGuard(request));
  // A denied request must not block unrelated later authorized effects.
  mutationTail = next.then(() => undefined, () => undefined);
  return next;
}
const server = net.createServer((client) => {
  let body = "";
  let complete = false;
  client.on("data", async chunk => {
    if (complete) return;
    body += chunk.toString("utf8");
    if (Buffer.byteLength(body) > LIMIT + 8192) {
      complete = true;
      client.end(JSON.stringify({ ok: false, error: "request exceeds limit" }) + "\n");
      return;
    }
    const boundary = body.indexOf("\n");
    if (boundary < 0) return;
    complete = true;
    try {
      const request = JSON.parse(body.slice(0, boundary));
      const output = await executeGuard(request);
      client.end(JSON.stringify({ ok: true, output }) + "\n");
    } catch (error) {
      client.end(JSON.stringify({
        ok: false, uncertain: error?.uncertain === true,
        error: String(error?.message || "BUCCET_BROKER_DENIED").slice(0, 900),
      }) + "\n");
    }
  });
});
server.once("error", error => { console.error(error); process.exitCode = 1; });
server.listen(socketPath, async () => {
  try {
    await chmod(socketPath, 0o600);
    const socket = lstatSync(socketPath);
    if (socket.uid !== 0 || (socket.mode & 0o077) !== 0) throw new Error("socket rights changed");
    console.log("BUCCET_PROTECTED_BROKER_READY");
  } catch (error) {
    console.error("BUCCET_BROKER_DENIED:", error);
    server.close();
    process.exitCode = 1;
  }
});
process.once("SIGTERM", () => server.close());
