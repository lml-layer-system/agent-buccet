/**
 * Frontier native commit races against the REAL protected execution route:
 * executeScopedFileTool -> trusted root controller -> root-owned broker ->
 * production C guard -> renameat barrier -> real kernel renameat.
 *
 * Unlike the unsecured direct-guard diagnostic, both untrusted agent processes
 * share UID 65534 and neither has mutation authority in the broker-owned root.
 * The attacker still attempts the SAME five substitutions at the SAME pause.
 * Deny-everything is not accepted: all six authorized operations must succeed.
 *
 * TEST ONLY. Linux GitHub runner sudo is used by the orchestrator, never the
 * hostile agent. No privileged service is installed on a user's machine.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux", "Linux OS isolation required");
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nonce = randomBytes(10).toString("hex");
const managed = "/var/lib/buccet-frontier-protected-" + nonce;
const outside = "/tmp/buccet-frontier-outside-" + nonce;
const local = await mkdtemp(path.join(os.tmpdir(), "buccet-test-gates-"));
const compiledGuard = path.join(local, "real-box-fs-guard");
const compiledWrapper = path.join(local, "frontier-wrapper");
const compiledInterposer = path.join(local, "frontier-interposer.so");
const rootGuard = path.join(managed, "real-box-fs-guard");
const rootWrapper = path.join(managed, "frontier-wrapper");
const socket = path.join(managed, "broker.sock");
const broker = path.join(managed, "broker.mjs");
const controller = path.join(repository, "apps/buccet-box/native-production-controller.mjs");
const env = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C" };
const cases = [];
const failed = [];

function run(cmd, args, stdin = "") {
  const result = spawnSync(cmd, args, {
    input: stdin, encoding: "utf8", timeout: 25000, env,
  });
  assert.equal(result.error, undefined, result.error?.message);
  return result;
}
function required(cmd, args) {
  const result = run(cmd, args);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}
function privileged(cmd, args) { return required("sudo", ["-n", cmd, ...args]); }
function controllerArgs(tool, args) {
  return ["-n", "env",
    "AGENT_BUCCET_REQUIRE_ISOLATED_FS=1",
    "AGENT_BUCCET_FS_BROKER_ROOT=" + managed,
    "AGENT_BUCCET_FS_BROKER_SOCKET=" + socket,
    process.execPath, controller, JSON.stringify({ tool, args })];
}
function launchedController(tool, args) {
  const child = spawn("sudo", controllerArgs(tool, args), { env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", chunk => { stdout += String(chunk); });
  child.stderr.on("data", chunk => { stderr += String(chunk); });
  const complete = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", code => resolve({ code, stdout, stderr }));
  });
  return { child, complete };
}
async function invoke(tool, args) {
  const call = launchedController(tool, args);
  const result = await call.complete;
  assert.equal(result.code, 0, "trusted real executor rejected " + tool + ": " + result.stderr);
  const parsed = JSON.parse(result.stdout.trim());
  assert.equal(parsed.ok, true);
  return parsed.result;
}
function nodeInput(op, relative, contentOrTo) {
  if (op === "move_file") {
    return { from: path.join(managed, relative), to: path.join(managed, contentOrTo) };
  }
  return { path: path.join(managed, relative),
    ...(op === "write_file" || op === "append_file"
      ? { content: contentOrTo ?? "" } : {}) };
}
async function trusted(op, relative, extra) {
  return invoke(op, nodeInput(op, relative, extra));
}
function attackUntrusted(operations) {
  const agent = [
    'const fs=require("node:fs");',
    'const operations=JSON.parse(process.argv[1]);',
    'const outcomes=[];',
    'for(const [op,a,b] of operations){',
    'try {',
    'if(op==="unlink")fs.unlinkSync(a);',
    'else if(op==="rename")fs.renameSync(a,b);',
    'else if(op==="write")fs.writeFileSync(a,"UNAUTHORIZED_BYTES");',
    'else if(op==="mkdir")fs.mkdirSync(a);',
    'else throw Error("bad attack");',
    'outcomes.push("BREACH");',
    '}catch(error){outcomes.push(error.code || "UNKNOWN");}',
    '}console.log(JSON.stringify(outcomes));',
  ].join("");
  const result = run("sudo", ["-n", "setpriv",
    "--reuid=65534", "--regid=65534", "--clear-groups",
    process.execPath, "-e", agent, JSON.stringify(operations)]);
  assert.equal(result.status, 0, "untrusted agent execution failed: " + result.stderr);
  const outcomes = JSON.parse(result.stdout.trim());
  assert.equal(outcomes.length, operations.length);
  for (const outcome of outcomes) {
    assert.match(outcome, /^(EACCES|EPERM)$/,
      "hostile mutation unexpectedly reached protected filesystem: " + JSON.stringify(operations));
  }
  return outcomes;
}
async function waitReady(gate, pending) {
  let ended = false, earlyResult;
  pending.then(result => { ended = true; earlyResult = result; },
    error => { ended = true; earlyResult = String(error); });
  for (let count = 0; count < 800; count++) {
    try {
      await access(path.join(gate, "ready"));
      // Native guard runs as root and creates its marker mode 0600. The
      // trusted CI orchestrator, never the untrusted agent, reads that marker.
      return privileged("cat", [path.join(gate, "ready")]).trim();
    } catch { /* wait for the genuine renameat pause */ }
    if (ended) throw new Error("real executor finished before renameat barrier: " +
      JSON.stringify(earlyResult));
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("native guard did not reach the original renameat barrier");
}
function record(label, details) {
  console.log("FRONTIER_PROTECTED_PASS", label, JSON.stringify(details));
  cases.push(label);
}
async function heldCase(name, tool, input, expectedPrefix, mutation, validate) {
  const gate = path.join(local, "gate-" + name);
  await mkdir(gate);
  await writeFile(path.join(gate, "armed"), "1");
  const request = launchedController(tool, input);
  try {
    const oldName = await waitReady(gate, request.complete);
    assert.ok(oldName.startsWith(expectedPrefix),
      "barrier did not intercept the same pre-commit native renameat operand");
    const attempted = await mutation(oldName);
    assert.ok(attempted.length > 0);
    await writeFile(path.join(gate, "release"), "continue");
    const result = await request.complete;
    assert.equal(result.code, 0, "valid broker-backed effect failed after attack: " + result.stderr);
    assert.equal(JSON.parse(result.stdout.trim()).ok, true);
    await validate();
    record(name, { reachedActualCommit: true, rejectedMutations: attempted.length,
      nativeCommitSucceeded: true, approvedOutcomeVerified: true });
  } finally {
    await writeFile(path.join(gate, "release"), "continue").catch(() => {});
    if (request.child.exitCode === null) request.child.kill("SIGTERM");
  }
}

// The wrapper is TEST-ONLY. It does not replace the production guard logic:
// its sole purpose is to insert the existing LD_PRELOAD barrier immediately
// before the actual native guard's final renameat(). Broker remains real.
const nativeWrapper = [
  "#define _GNU_SOURCE",
  "#include <stdio.h>",
  "#include <stdlib.h>",
  "#include <string.h>",
  "#include <unistd.h>",
  "#include <limits.h>",
  "#define REAL_GUARD " + JSON.stringify(rootGuard),
  "#define INTERPOSER " + JSON.stringify(compiledInterposer),
  "#define GATE_ROOT " + JSON.stringify(local),
  "static const char *case_name(const char *op,const char *name){",
  'if(!strcmp(op,"write")&&!strcmp(name,"payload.txt"))return "payload-swap";',
  'if(!strcmp(op,"write")&&!strcmp(name,"nested/victim.txt"))return "directory-reparent";',
  'if(!strcmp(op,"move")&&!strcmp(name,"source.txt"))return "move-reparent";',
  'if(!strcmp(op,"append")&&!strcmp(name,"append-base.txt"))return "append-temp-swap";',
  'if(!strcmp(op,"move")&&!strcmp(name,"source-replaced.txt"))return "move-source-swap";',
  "return NULL;}",
  "int main(int argc,char**argv){",
  'if(argc>=4){const char *name=case_name(argv[1],argv[3]);',
  "if(name){char gate[PATH_MAX],armed[PATH_MAX];",
  'if(snprintf(gate,sizeof(gate),"%s/gate-%s",GATE_ROOT,name)>= (int)sizeof(gate))return 82;',
  'if(snprintf(armed,sizeof(armed),"%s/armed",gate)>= (int)sizeof(armed))return 83;',
  'if(access(armed,F_OK)==0){',
  'setenv("LD_PRELOAD",INTERPOSER,1);',
  'setenv("BUCCET_TEST_RENAME_GATE",gate,1);',
  'setenv("BUCCET_TEST_OLD_PREFIX",',
  '(!strcmp(argv[1],"move")?argv[3]:".buccet-fs-"),1);',
  '}}}',
  "execv(REAL_GUARD,argv);perror(\"execv\");return 84;}",
].join("\n");

let server;
try {
  required("cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
    path.join(repository, "native/box-fs-guard.c"), "-o", compiledGuard]);
  // Compile the exact, unchanged original commit-barrier interposer.
  // The attack timing and success criteria are not modified for this test.
  required("cc", ["-shared", "-fPIC", "-O2", "-Wall", "-Wextra", "-Werror",
    path.join(repository, "apps/buccet-box/frontier-rename-barrier.c"),
    "-o", compiledInterposer, "-ldl"]);
  const wrapperSource = path.join(local, "frontier-wrapper.c");
  await writeFile(wrapperSource, nativeWrapper);
  required("cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
    wrapperSource, "-o", compiledWrapper]);

  privileged("install", ["-d", "-o", "root", "-g", "root", "-m", "0700", managed]);
  privileged("install", ["-o", "root", "-g", "root", "-m", "0755", compiledGuard, rootGuard]);
  privileged("install", ["-o", "root", "-g", "root", "-m", "0755", compiledWrapper, rootWrapper]);
  privileged("install", ["-o", "root", "-g", "root", "-m", "0644",
    path.join(repository, "native/box-fs-broker.mjs"), broker]);
  await mkdir(outside);
  await chmod(outside, 0o777);

  // Prove hostile UID can mutate its own OUTSIDE target. A failed relocation
  // must be due to the protected source, not an unwritable destination.
  const free = path.join(outside, "untrusted-can-write-here.txt");
  const accessResult = run("sudo", ["-n", "setpriv",
    "--reuid=65534", "--regid=65534", "--clear-groups",
    process.execPath, "-e",
    'require("node:fs").writeFileSync(process.argv[1],"AGENT_CAN_WRITE_OUTSIDE")', free]);
  assert.equal(accessResult.status, 0, "outside destination not attacker-writable: " + accessResult.stderr);

  // Trusted operator policy is a separate root-owned object: the untrusted
  // agent cannot fabricate grants even if it learns all request parameters.
  // Every path used by the original five attacks is explicitly inside this
  // isolated synthetic scope. No outside destination is authorized.
  const prefixes = [
    "benign.txt", "payload.txt", "nested", "move-target",
    "source.txt", "append-base.txt", "source-replaced.txt", "replaced-dest.txt",
  ];
  const operatorPolicy = {
    schema:1, root:managed,
    allowed:["read","write","append","move","mkdir","delete"].flatMap(op =>
      prefixes.map(prefix => ({ op, prefix }))),
  };
  const localPolicyFile = path.join(local, "operator-policy.json");
  await writeFile(localPolicyFile, JSON.stringify(operatorPolicy));
  privileged("install", ["-o","root","-g","root","-m","0400",
    localPolicyFile, path.join(managed,"policy.json")]);

  server = spawn("sudo", ["-n", process.execPath, broker, managed, rootWrapper, socket],
    { env, stdio: ["ignore", "pipe", "pipe"] });
  let brokerLog = "";
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error("broker timeout: " + brokerLog)), 12000);
    server.stdout.on("data", chunk => {
      brokerLog += String(chunk);
      if (brokerLog.includes("BUCCET_PROTECTED_BROKER_READY")) {
        clearTimeout(timeout); resolve(true);
      }
    });
    server.stderr.on("data", chunk => { brokerLog += String(chunk); });
    server.once("exit", code => { clearTimeout(timeout); reject(Error("broker exited: "+code+" "+brokerLog)); });
  });
  assert.equal(await ready, true);
  await trusted("write_file", "benign.txt", "AUTHORIZED_CONTENT");
  assert.equal(await trusted("read_file", "benign.txt"), "AUTHORIZED_CONTENT");
  record("positive control", { actualWriteSucceeded: true });

  await heldCase("payload-swap", "write_file",
    nodeInput("write_file", "payload.txt", "AUTHORIZED_BYTES"), ".buccet-fs-",
    async oldName => attackUntrusted([
      ["unlink", path.join(managed, oldName)],
      ["write", path.join(managed, oldName)],
    ]),
    async () => assert.equal(await trusted("read_file", "payload.txt"), "AUTHORIZED_BYTES"));

  await trusted("make_directory", "nested");
  await heldCase("directory-reparent", "write_file",
    nodeInput("write_file", "nested/victim.txt", "WRITTEN_IN_SCOPE"), ".buccet-fs-",
    async () => attackUntrusted([
      ["rename", path.join(managed, "nested"), path.join(outside, "relocated-parent")],
      ["mkdir", path.join(managed, "nested")],
    ]),
    async () => {
      assert.equal(await trusted("read_file", "nested/victim.txt"), "WRITTEN_IN_SCOPE");
      await assert.rejects(access(path.join(outside, "relocated-parent/victim.txt")), /ENOENT/);
    });

  await trusted("make_directory", "move-target");
  await trusted("write_file", "source.txt", "MOVE_PAYLOAD");
  await heldCase("move-reparent", "move_file",
    nodeInput("move_file", "source.txt", "move-target/destination.txt"), "source.txt",
    async () => attackUntrusted([
      ["rename", path.join(managed, "move-target"), path.join(outside, "relocated-move-target")],
      ["mkdir", path.join(managed, "move-target")],
    ]),
    async () => {
      assert.equal(await trusted("read_file", "move-target/destination.txt"), "MOVE_PAYLOAD");
      await assert.rejects(access(path.join(outside, "relocated-move-target/destination.txt")), /ENOENT/);
    });

  await trusted("write_file", "append-base.txt", "ORIGINAL|");
  await heldCase("append-temp-swap", "append_file",
    nodeInput("append_file", "append-base.txt", "AUTHORIZED_APPEND"), ".buccet-fs-",
    async oldName => attackUntrusted([
      ["unlink", path.join(managed, oldName)],
      ["write", path.join(managed, oldName)],
    ]),
    async () => assert.equal(await trusted("read_file", "append-base.txt"), "ORIGINAL|AUTHORIZED_APPEND"));

  await trusted("write_file", "source-replaced.txt", "REVIEWED_SOURCE_CONTENT");
  await heldCase("move-source-swap", "move_file",
    nodeInput("move_file", "source-replaced.txt", "replaced-dest.txt"), "source-replaced.txt",
    async () => attackUntrusted([
      ["unlink", path.join(managed, "source-replaced.txt")],
      ["write", path.join(managed, "source-replaced.txt")],
    ]),
    async () => assert.equal(await trusted("read_file", "replaced-dest.txt"), "REVIEWED_SOURCE_CONTENT"));

  assert.equal(cases.length, 6);
  console.log("FRONTIER_PROTECTED_RACE_SUMMARY", JSON.stringify({
    authorizedPositiveControlExecuted: true, originalRaceFamilies: 5,
    eachMutationAttemptedAtRealCommit: true,
    protectedRealExecutor: "executeScopedFileTool -> trusted broker -> native guard",
    attackerUid: 65534, brokerUid: 0,
    independentOperatorPolicyEnforced: true, passed: cases,
  }));
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve => server.once("close", resolve)),
      new Promise(resolve => setTimeout(resolve, 3000)),
    ]);
  }
  const cleanup = run("sudo", ["-n", "rm", "-rf", "--", managed]);
  if (cleanup.status !== 0) {
    console.error("PROTECTED_RACE_CLEANUP_FAILED", cleanup.stderr);
    process.exitCode = 1;
  }
  await rm(outside, { recursive: true, force: true });
  await rm(local, { recursive: true, force: true });
}
