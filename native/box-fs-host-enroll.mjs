/**
 * Privileged registration and revocation of independently owned MCP host
 * identities. Root-owned policy is the issuer; actor/session CLI labels alone
 * never confer authority. No secret is printed or added to a user home.
 *
 * A dedicated OS account must launch the trusted host and pass its proof on
 * inherited FD3. It must not share a UID with untrusted agent processes.
 *
 * Production installation MUST stage this file and Node in a protected,
 * administrator-controlled directory; a mutable checkout is not trusted code.
 */
import { randomBytes } from "node:crypto";
import { lstatSync } from "node:fs";
import { mkdir, open, readFile, rename, rm, chmod, chown } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function reject(reason) { throw Error("BUCCET_HOST_ENROLL_DENIED: " + reason); }
function trustedTree(target, isFile = false) {
  if (!path.isAbsolute(target) || path.normalize(target) !== target ||
      target === "/") reject("trusted target must be absolute");
  let entry = "/";
  for (const part of target.slice(1).split("/")) {
    if (!part || part === "." || part === "..") reject("invalid path component");
    entry = path.join(entry, part);
    let stat;
    try { stat = lstatSync(entry); }
    catch { reject("protected path does not exist"); }
    const leaf = entry === target;
    if (stat.isSymbolicLink() || stat.uid !== 0 ||
        (stat.mode & 0o022) !== 0 ||
        !(leaf && isFile ? stat.isFile() : stat.isDirectory())) {
      reject("path is not controlled by the independent root principal");
    }
  }
}
function identity(value, label) {
  if (typeof value !== "string" ||
      !/^[A-Za-z0-9_-]{8,96}$/.test(value)) reject("invalid " + label);
  return value;
}
function validatedUid(value) {
  if (!/^[1-9][0-9]{3,4}$/.test(value ?? "")) reject("invalid dedicated host UID");
  const uid = Number(value);
  if (!Number.isSafeInteger(uid) || uid < 1000 || uid > 60000 ||
      uid === 65534 || uid === process.geteuid()) {
    reject("host UID must be a dedicated non-root OS principal");
  }
  return uid;
}
const cwd = fileURLToPath(import.meta.url);
if (process.platform !== "linux" || process.geteuid?.() !== 0 ||
    process.argv.length < 6 || process.argv.length > 7) {
  reject("root Linux usage: HOST_ENROLL ROOT enroll|revoke SESSION ACTOR [DEDICATED_UID]");
}
const [root, command, sessionIdArg, actorIdArg, uidArg] = process.argv.slice(2);
if (command !== "enroll" && command !== "revoke") reject("invalid registration operation");
if ((command === "enroll" && !uidArg) ||
    (command === "revoke" && uidArg !== undefined)) reject("wrong registration arguments");
trustedTree(cwd, true);
trustedTree(process.execPath, true);
trustedTree(root);
const sessionId = identity(sessionIdArg, "session identity");
const actorId = identity(actorIdArg, "actor identity");
const uid = command === "enroll" ? validatedUid(uidArg) : null;
const registryPath = path.join(root, "host-identities.json");
trustedTree(registryPath, true);
const st = lstatSync(registryPath);
if ((st.mode & 0o077) !== 0 || st.nlink !== 1 || st.size > 65536) {
  reject("host registry permissions or size invalid");
}
let registry;
try { registry = JSON.parse(await readFile(registryPath, "utf8")); }
catch { reject("host registry unreadable"); }
if (registry?.schema !== 1 || registry.root !== root ||
    !Array.isArray(registry.allowed) || registry.allowed.length > 64 ||
    registry.allowed.some(entry => !entry ||
      typeof entry.sessionId !== "string" ||
      typeof entry.actorId !== "string" ||
      typeof entry.secretHex !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.secretHex))) {
  reject("host registry structure invalid");
}
const dirname = path.basename(root);
const runtime = path.join("/run/buccet-native-host-credentials", dirname);
const proofPath = path.join(runtime, sessionId + ".key");
if (command === "enroll") {
  if (registry.allowed.length >= 64 ||
      registry.allowed.some(entry => entry.sessionId === sessionId ||
        (entry.sessionId === sessionId && entry.actorId === actorId))) {
    reject("duplicate or over-capacity trusted host identity");
  }
  await mkdir(runtime, { mode: 0o711, recursive: true });
  trustedTree(path.dirname(runtime));
  // Root-owned 0711 directory: the dedicated host can traverse to its known
  // file but cannot list, replace or alter any other registered credentials.
  const rt = lstatSync(runtime);
  if (!rt.isDirectory() || rt.uid !== 0 || (rt.mode & 0o077) !== 0o011) {
    reject("untrusted host proof directory");
  }
  const secret = randomBytes(32).toString("hex");
  let fileCreated = false;
  try {
    const handle = await open(proofPath, "wx", 0o400);
    fileCreated = true;
    try {
      await handle.writeFile(secret + "\n", "utf8");
      await handle.sync();
    } finally { await handle.close(); }
    await chown(proofPath, uid, 0);
    await chmod(proofPath, 0o400);
    registry.allowed.push({ sessionId, actorId, secretHex: secret });
    const temporary = registryPath + ".tmp-" + randomBytes(8).toString("hex");
    const output = await open(temporary, "wx", 0o600);
    try {
      await output.writeFile(JSON.stringify(registry) + "\n", "utf8");
      await output.sync();
    } finally { await output.close(); }
    await chmod(temporary, 0o400);
    await rename(temporary, registryPath);
    console.log("BUCCET_HOST_ENROLLED " + JSON.stringify({
      sessionId, actorId, dedicatedUid: uid, proofFile: proofPath,
      secretNeverPrinted: true, credentialProtectedByOSPrincipal: true,
    }));
  } catch (error) {
    // A stranded host proof must not become an out-of-band authority.
    if (fileCreated) await rm(proofPath, { force: true }).catch(() => {});
    throw error;
  }
} else {
  const prior = registry.allowed.length;
  registry.allowed = registry.allowed.filter(entry =>
    !(entry.sessionId === sessionId && entry.actorId === actorId));
  if (registry.allowed.length === prior) reject("unknown identity to revoke");
  const temporary = registryPath + ".tmp-" + randomBytes(8).toString("hex");
  const output = await open(temporary, "wx", 0o600);
  try {
    await output.writeFile(JSON.stringify(registry) + "\n", "utf8");
    await output.sync();
  } finally { await output.close(); }
  await chmod(temporary, 0o400);
  await rename(temporary, registryPath);
  await rm(proofPath, { force: true });
  console.log("BUCCET_HOST_REVOKED " + JSON.stringify({
    sessionId, actorId, revokedAtRoot: true,
  }));
}
