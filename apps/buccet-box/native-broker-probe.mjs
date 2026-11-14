/**
 * Demonstrates an independently protected filesystem broker, not a shipped
 * security guarantee. The original five adversarial commit tests remain
 * unchanged and red until the MCP production route uses such a broker.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const managedRoot = "/var/lib/buccet-broker-probe-" + randomBytes(10).toString("hex");
assert.match(managedRoot, /^\/var\/lib\/buccet-broker-probe-[a-f0-9]{20}$/);
const broker = path.join(managedRoot, "broker.mjs");
const client = path.join(managedRoot, "client.mjs");
const guard = path.join(managedRoot, "box-fs-guard");
const socket = path.join(managedRoot, "broker.sock");
const stdEnv = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C" };

function run(cmd, args, input = "") {
  const r = spawnSync(cmd, args, { encoding: "utf8", input, timeout: 20000, env: stdEnv });
  if (r.error) throw r.error;
  return r;
}
function sudo(command, args) {
  const r = run("sudo", ["-n", command, ...args]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  return r.stdout;
}
function trusted(op, relativePath, extra) {
  const args = ["-n", process.execPath, client, socket, op, relativePath];
  if (extra !== undefined) args.push(extra);
  const r = run("sudo", args);
  assert.equal(r.status, 0, "trusted broker request failed: " + r.stderr);
  return r.stdout;
}
function deniedMutation(operation, relative, target = "") {
  const code = 'const fs=require("node:fs");' +
    'const [op,a,b]=process.argv.slice(1);' +
    'try { if(op==="unlink")fs.unlinkSync(a);' +
    'else if(op==="rename")fs.renameSync(a,b);' +
    'else if(op==="write")fs.writeFileSync(a,"MALICIOUS_BYTES");' +
    'else throw new Error("bad operation");' +
    'console.log("BREACH");process.exit(42);' +
    '} catch(e) { if(!["EPERM","EACCES"].includes(e.code))throw e;' +
    'console.log("KERNEL_REFUSED:"+e.code); }';
  const r = run("sudo", [
    "-n", "setpriv", "--reuid=65534", "--regid=65534", "--clear-groups",
    process.execPath, "-e", code, operation, path.join(managedRoot, relative), target,
  ]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /KERNEL_REFUSED:(EPERM|EACCES)/);
}
function deniedSocketConnection() {
  const code = 'const net=require("node:net");const s=net.connect(process.argv[1]);' +
    's.on("connect",()=>{console.log("BREACH");process.exit(42)});' +
    's.on("error",e=>{if(!["EPERM","EACCES"].includes(e.code))throw e;' +
    'console.log("SOCKET_DENIED:"+e.code)});';
  const r = run("sudo", [
    "-n", "setpriv", "--reuid=65534", "--regid=65534", "--clear-groups",
    process.execPath, "-e", code, socket,
  ]);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  assert.match(r.stdout, /SOCKET_DENIED:(EPERM|EACCES)/);
}
let child;
try {
  sudo("install", ["-d", "-o", "root", "-g", "root", "-m", "0700", managedRoot]);
  sudo("install", ["-o", "root", "-g", "root", "-m", "0755",
    path.join(repo, "native/build/box-fs-guard"), guard]);
  sudo("install", ["-o", "root", "-g", "root", "-m", "0644",
    path.join(repo, "native/box-fs-broker.mjs"), broker]);
  sudo("install", ["-o", "root", "-g", "root", "-m", "0644",
    path.join(repo, "native/box-fs-broker-client.mjs"), client]);
  sudo("install", ["-d", "-o", "root", "-g", "root", "-m", "0700",
    path.join(managedRoot, "src/box"), path.join(managedRoot, "apps/buccet-box")]);
  for (const [source, destination] of [
    ["src/box/confined-fs.ts", "src/box/confined-fs.ts"],
    ["src/box/protected-fs-broker.ts", "src/box/protected-fs-broker.ts"],
    ["apps/buccet-box/native-broker-api-test.mjs", "apps/buccet-box/native-broker-api-test.mjs"],
  ]) {
    sudo("install", ["-o", "root", "-g", "root", "-m", "0644",
      path.join(repo, source), path.join(managedRoot, destination)]);
  }
  child = spawn("sudo", ["-n", process.execPath, broker, managedRoot, guard, socket], {
    stdio: ["ignore", "pipe", "pipe"], env: stdEnv,
  });
  const ready = await new Promise((resolve, reject) => {
    let out = "", error = "";
    const timer = setTimeout(() => reject(new Error("protected broker startup timeout: " + error)), 10000);
    child.stdout.on("data", chunk => {
      out += chunk.toString("utf8");
      if (out.includes("BUCCET_PROTECTED_BROKER_READY")) {
        clearTimeout(timer); resolve(true);
      }
    });
    child.stderr.on("data", chunk => { error += chunk.toString("utf8"); });
    child.once("exit", code => {
      clearTimeout(timer); reject(new Error("protected broker exited " + code + " " + error));
    });
  });
  assert.equal(ready, true);
  trusted("mkdir", "nested");
  trusted("mkdir", "move-parent");
  trusted("write", "nested/allowed.txt", "AUTHORIZED|");
  trusted("append", "nested/allowed.txt", "APPEND");
  assert.equal(trusted("read", "nested/allowed.txt"), "AUTHORIZED|APPEND");
  trusted("move", "nested/allowed.txt", "move-parent/moved.txt");
  assert.equal(trusted("read", "move-parent/moved.txt"), "AUTHORIZED|APPEND");

  // The actual Buccet production file-tool API must use this same broker
  // transport in strict mode, not quietly fall back to direct native exec.
  const api = run("sudo", ["-n", "env",
    "AGENT_BUCCET_FS_BROKER_SOCKET=" + socket,
    "AGENT_BUCCET_FS_BROKER_ROOT=" + managedRoot,
    "AGENT_BUCCET_REQUIRE_ISOLATED_FS=1",
    process.execPath, path.join(managedRoot, "apps/buccet-box/native-broker-api-test.mjs"),
  ]);
  assert.equal(api.status, 0, "Buccet runtime broker API failed: " + api.stderr + api.stdout);
  assert.match(api.stdout, /NATIVE_BROKER_RUNTIME_API_PASS/);

  // Five corresponding mutation classes under the SAME untrusted UID.
  deniedMutation("unlink", "move-parent/moved.txt");
  deniedMutation("rename", "nested", "/tmp/buccet-reparent-denied");
  deniedMutation("rename", "move-parent", "/tmp/buccet-move-dest-denied");
  deniedMutation("write", "move-parent/moved.txt");
  deniedMutation("unlink", "move-parent/moved.txt");
  deniedSocketConnection();

  // Even the trusted controller can address only the broker-managed root.
  const escape = run("sudo", ["-n", process.execPath, client, socket,
    "write", "../outside.txt", "ATTACK"]);
  assert.notEqual(escape.status, 0, "broker accepted path traversal");
  assert.equal(trusted("read", "move-parent/moved.txt"), "AUTHORIZED|APPEND");
  console.log("BROKER_ISOLATION_PROBE_PASS", JSON.stringify({
    legitimateWriteAppendMoveRead: true,
    untrustedSharedUid: 65534,
    kernelDeniedMutations: 5,
    untrustedSocketDenied: true,
    traversalDenied: true,
    protectedRuntimeApiVerified: true,
    productionRouteMigrated: false,
  }));
} finally {
  if (child && child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve => child.once("close", resolve)),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);
  }
  const cleanup = run("sudo", ["-n", "rm", "-rf", "--", managedRoot]);
  if (cleanup.status !== 0) {
    console.error("BROKER_PROBE_CLEANUP_FAILED", cleanup.stderr);
    process.exitCode = 1;
  }
}
