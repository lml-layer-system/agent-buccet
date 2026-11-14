/**
 * Frontier03: actual privileged broker -> test-only wrapper -> unchanged
 * production C guard -> real kernel renameat, with injected fsync faults.
 * Proves that the BROKER receipt differentiates an explicit no-commit from an
 * unknown postcommit outcome. Does not claim an operator-gate acceptance pass.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux", "Linux-only root broker proof");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const root = "/var/lib/buccet-native/f03-broker-receipt-" + randomBytes(7).toString("hex");
const tmp = await mkdtemp(path.join(os.tmpdir(), "f03-receipt-"));
const guard = path.join(repo, "native/build/box-fs-guard");
const broker = path.join(repo, "native/box-fs-broker.mjs");
const socket = root + "/broker.sock";
const trace = root + "/trace.txt";
const preload = root + "/fault.so";
const wrapper = root + "/guard-test-wrapper";
const env = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C" };
function run(bin, args, input = "") {
  const result = spawnSync(bin, args, { env, encoding: "utf8", input, timeout: 25000 });
  assert.equal(result.error, undefined, result.error?.message ?? "");
  return result;
}
function sudo(bin, args = [], input = "") { return run("sudo", ["-n", bin, ...args], input); }
function must(result, reason) {
  assert.equal(result.status, 0, reason + ": " + result.stderr + result.stdout);
  return result.stdout;
}
const client = [
  'const net=require("node:net");',
  'let out=""; const c=net.createConnection({path:process.argv[1]});',
  'c.on("connect",()=>c.write(process.argv[2]+"\\n"));',
  'c.on("data",b=>out+=String(b));',
  'c.on("end",()=>process.stdout.write(out));',
  'c.on("error",e=>{console.error(e.message);process.exitCode=73});',
].join("");
function brokerCall(request) {
  const result = sudo(process.execPath, ["-e", client, socket, JSON.stringify(request)]);
  must(result, "root broker client");
  return JSON.parse(result.stdout.split("\n", 1)[0]);
}
function actualRead(rel) {
  return must(sudo(guard, ["read", root, rel]), "actual file read " + rel);
}
function compileDefinition(name, value) {
  return "-D" + name + "=" + JSON.stringify(value);
}
let daemon;
try {
  must(sudo("install", ["-d", "-o", "root", "-g", "root", "-m", "0700",
    "/var/lib/buccet-native", root, root + "/files"]), "make protected disposable root");

  const compiledSo = path.join(tmp, "fault.so");
  must(run("cc", ["-shared", "-fPIC", "-std=c11", "-O2", "-Wall", "-Wextra",
    "-Werror", path.join(repo, "apps/buccet-box/frontier03-native-fault-interposer.c"),
    "-o", compiledSo, "-ldl"]), "compile real-syscall fault fixture");
  must(sudo("install", ["-o", "root", "-g", "root", "-m", "0500",
    compiledSo, preload]), "pin root-owned fault interposer");

  const compiledWrapper = path.join(tmp, "guard-wrapper");
  must(run("cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
    compileDefinition("BUCCET_F03_REAL_GUARD", guard),
    compileDefinition("BUCCET_F03_INTERPOSER", preload),
    compileDefinition("BUCCET_F03_TRACE", trace),
    path.join(repo, "apps/buccet-box/frontier03-test-guard-wrapper.c"),
    "-o", compiledWrapper]), "compile isolated trusted wrapper");
  must(sudo("install", ["-o", "root", "-g", "root", "-m", "0500",
    compiledWrapper, wrapper]), "pin test-only broker guard wrapper");

  const source = path.join(tmp, "policy.json");
  await writeFile(source, JSON.stringify({
    schema: 1, root,
    allowed: [{ op: "read", prefix: "files" }, { op: "write", prefix: "files" }],
  }) + "\n");
  must(sudo("install", ["-o", "root", "-g", "root", "-m", "0400",
    source, root + "/policy.json"]), "pin root policy");

  daemon = spawn("sudo", ["-n", process.execPath, broker, root, wrapper, socket], {
    env, stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "", ready = false;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error("broker readiness timeout " + log)), 12000);
    const done = (error) => {
      if (ready) return;
      ready = true;
      clearTimeout(timeout);
      if (error) reject(error); else resolve();
    };
    daemon.stdout.on("data", chunk => {
      log += String(chunk);
      if (log.includes("BUCCET_PROTECTED_BROKER_READY")) done();
    });
    daemon.stderr.on("data", chunk => { log += String(chunk); });
    daemon.once("error", done);
    daemon.once("exit", code => done(Error("broker exited before ready " + code + " " + log)));
  });

  const good = brokerCall({ op: "write", path: "files/ok.txt", content: "EXACT_SUCCESS" });
  assert.equal(good.ok, true);
  assert.equal(actualRead("files/ok.txt"), "EXACT_SUCCESS");
  console.log("F03_BROKER_RECEIPT_PASS confirmed-native-commit");

  const denied = brokerCall({ op: "write", path: "denied/outside.txt", content: "NEVER" });
  assert.equal(denied.ok, false);
  assert.equal(denied.uncertain, false);
  assert.notEqual(sudo("test", ["-e", root + "/denied/outside.txt"]).status, 0);
  console.log("F03_BROKER_RECEIPT_PASS explicit-policy-denial-is-not-uncertain");

  const pre = brokerCall({ op: "write", path: "files/pre-eio.txt", content: "NO_PUBLICATION" });
  assert.equal(pre.ok, false);
  assert.equal(pre.uncertain, false);
  assert.notEqual(sudo("test", ["-e", root + "/files/pre-eio.txt"]).status, 0);
  console.log("F03_BROKER_RECEIPT_PASS precommit-fsync-failure-definitive-denial");

  const post = brokerCall({ op: "write", path: "files/post-eio.txt", content: "PUBLISHED_NO_DURABILITY" });
  assert.equal(post.ok, false);
  assert.equal(post.uncertain, true);
  assert.match(post.error, /BUCCET_BROKER_COMMIT_UNCERTAIN/);
  assert.equal(actualRead("files/post-eio.txt"), "PUBLISHED_NO_DURABILITY");
  console.log("F03_BROKER_RECEIPT_PASS postcommit-EIO-explicit-uncertain-receipt");

  const killed = brokerCall({ op: "write", path: "files/post-crash.txt", content: "PUBLISHED_NO_RECEIPT" });
  assert.equal(killed.ok, false);
  assert.equal(killed.uncertain, true);
  assert.match(killed.error, /BUCCET_BROKER_COMMIT_UNCERTAIN/);
  assert.equal(actualRead("files/post-crash.txt"), "PUBLISHED_NO_RECEIPT");
  console.log("F03_BROKER_RECEIPT_PASS postcommit-SIGKILL-explicit-uncertain-receipt");

  assert.equal(brokerCall({ op: "read", path: "files/ok.txt" }).ok, true);
  console.log("FRONTIER03_BROKER_RECEIPT_SUMMARY", JSON.stringify({
    actualRootBroker: true, productionCGuardExecuted: true,
    deniedVersusUncertainDistinguished: true, actualPublishedBytesVerified: true,
    signedOperatorGateCovered: false,
  }));
} catch (error) {
  console.error("FRONTIER03_BROKER_RECEIPT_RED", error?.stack ?? String(error));
  process.exitCode = 1;
} finally {
  if (daemon && daemon.exitCode === null) {
    daemon.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve => daemon.once("close", resolve)),
      new Promise(resolve => setTimeout(resolve, 4000)),
    ]);
    if (daemon.exitCode === null) daemon.kill("SIGKILL");
  }
  const cleanup = sudo("rm", ["-rf", "--", root]);
  if (cleanup.status !== 0) {
    console.error("FRONTIER03_BROKER_RECEIPT_CLEANUP_FAILED", cleanup.stderr);
    process.exitCode = 1;
  }
  await rm(tmp, { recursive: true, force: true });
}
