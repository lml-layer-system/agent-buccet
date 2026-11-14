/**
 * Frontier03: actual privileged broker -> test-only wrapper -> unchanged
 * production C guard -> real kernel renameat, with injected fsync faults.
 * Proves that the BROKER and signed operator-gate receipts distinguish
 * definite denial from uncertain effects at the real native commit.
 */
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import net from "node:net";
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
const gateDir = "/run/buccet-native-gates/f03-receipt-" + randomBytes(6).toString("hex");
const gateRequestSocket = gateDir + "/request.sock";
const gateOperatorSocket = gateDir + "/operator.sock";
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
let daemon, gateDaemon;
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

  // The operator path below uses the actual root approval gate and correctly
  // HMAC-signed host requests; NO test-only host authentication bypass.
  must(sudo("install", ["-d", "-o", "root", "-g", "root", "-m", "0755",
    "/run/buccet-native-gates", gateDir]), "create separate root gate namespace");
  const who = {
    sessionId: "host_" + randomBytes(8).toString("hex"),
    actorId: "operator_" + randomBytes(8).toString("hex"),
    secretHex: randomBytes(32).toString("hex"),
  };
  const registryFile = path.join(tmp, "host-identities.json");
  await writeFile(registryFile, JSON.stringify({
    schema: 1, root, allowed: [who],
  }) + "\n");
  must(sudo("install", ["-o", "root", "-g", "root", "-m", "0400",
    registryFile, root + "/host-identities.json"]), "root-enroll host proof");
  const operatorCode = [
    'const net=require("node:net");',
    'const s=net.createConnection({path:process.argv[1]});',
    'let data="";',
    's.once("connect",()=>s.write(process.argv[2]+"\\n"));',
    's.on("data",v=>data+=String(v));',
    's.once("end",()=>process.stdout.write(data));',
    's.once("error",e=>{console.error(e.message);process.exitCode=73});',
  ].join("");
  function operator(command) {
    const res = sudo(process.execPath, ["-e", operatorCode,
      gateOperatorSocket, JSON.stringify(command)]);
    must(res, "root-only operator command");
    return JSON.parse(res.stdout.trim());
  }
  function hostSigned(request) {
    const issuedAt = new Date().toISOString();
    const nonce = randomBytes(16).toString("hex");
    const mac = createHmac("sha256", Buffer.from(who.secretHex, "hex"))
      .update(JSON.stringify(["agent-buccet-protected-host-v1",
        who.sessionId, who.actorId, issuedAt, nonce, request])).digest("hex");
    return { ...request, host: {
      sessionId: who.sessionId, actorId: who.actorId, issuedAt, nonce, mac,
    } };
  }
  async function submit(request) {
    const socket = net.createConnection({ path: gateRequestSocket });
    let raw = "", settled = false;
    const response = new Promise(resolve => {
      const finish = value => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      socket.on("data", chunk => { raw += String(chunk); });
      socket.once("end", () => {
        try { finish(JSON.parse(raw.split("\n", 1)[0])); }
        catch { finish({ ok: false, error: "incomplete gate receipt" }); }
      });
      socket.once("error", error => finish({ ok: false, error: error.message }));
      socket.once("close", () => finish({ ok: false, error: "closed without receipt" }));
    });
    await new Promise((resolve, reject) => {
      socket.once("connect", () => {
        socket.write(JSON.stringify(hostSigned(request)) + "\n");
        resolve();
      });
      socket.once("error", reject);
    });
    return response;
  }
  const gatePath = path.join(repo, "native/box-fs-approval-gate.mjs");
  gateDaemon = spawn("sudo", ["-n", process.execPath, gatePath,
    root, socket, gateRequestSocket, gateOperatorSocket], {
    env, stdio: ["ignore", "pipe", "pipe"],
  });
  let gateLogs = "";
  gateDaemon.stdout.on("data", chunk => { gateLogs += String(chunk); });
  gateDaemon.stderr.on("data", chunk => { gateLogs += String(chunk); });
  let gateReady = false;
  for (let i = 0; i < 100; i++) {
    const req = sudo("stat", ["-c", "%u:%a:%F", gateRequestSocket]);
    const op = sudo("stat", ["-c", "%u:%a:%F", gateOperatorSocket]);
    if (req.status === 0 && req.stdout.trim() === "0:666:socket" &&
        op.status === 0 && op.stdout.trim() === "0:600:socket") {
      gateReady = true; break;
    }
    if (gateDaemon.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(gateReady, true, "real signed operator gate not ready: " + gateLogs);
  async function approveAndReceive(proposal) {
    const response = await submit(proposal);
    let row;
    for (let n = 0; n < 60; n++) {
      row = operator({ command: "list" }).pending?.find(p => p.path === proposal.path);
      if (row) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(row, "root gate did not queue signed request " + proposal.path);
    assert.equal(row.host?.verified, true, "host HMAC not validated");
    const decision = operator({
      command: "approve", requestId: row.requestId, sha256: row.sha256,
    });
    assert.equal(decision.approved, true, "root operator approval failed");
    return response;
  }
  const gateGood = await approveAndReceive({
    op: "write", path: "files/gate-success.txt", content: "SIGNED_APPROVED_EXACT",
  });
  assert.equal(gateGood.ok, true);
  assert.equal(actualRead("files/gate-success.txt"), "SIGNED_APPROVED_EXACT");
  console.log("F03_GATE_RECEIPT_PASS legitimate-signed-root-approved-positive");

  const gatePost = await approveAndReceive({
    op: "write", path: "files/post-eio.txt", content: "GATE_PUBLISHED_UNCERTAIN",
  });
  assert.equal(gatePost.ok, false);
  assert.equal(gatePost.uncertain, true);
  assert.match(gatePost.error, /BUCCET_GATE_COMMIT_UNCERTAIN/);
  assert.equal(actualRead("files/post-eio.txt"), "GATE_PUBLISHED_UNCERTAIN");
  console.log("F03_GATE_RECEIPT_PASS signed-postcommit-EIO-uncertain-not-denied");

  const gateKill = await approveAndReceive({
    op: "write", path: "files/post-crash.txt", content: "GATE_PUBLISHED_KILLED",
  });
  assert.equal(gateKill.ok, false);
  assert.equal(gateKill.uncertain, true);
  assert.match(gateKill.error, /BUCCET_GATE_COMMIT_UNCERTAIN/);
  assert.equal(actualRead("files/post-crash.txt"), "GATE_PUBLISHED_KILLED");
  console.log("F03_GATE_RECEIPT_PASS signed-postcommit-SIGKILL-uncertain-not-denied");

  const gateDenied = await approveAndReceive({
    op: "write", path: "denied/nope.txt", content: "NOPE",
  });
  assert.equal(gateDenied.ok, false);
  assert.equal(gateDenied.uncertain, false);
  assert.notEqual(sudo("test", ["-e", root + "/denied/nope.txt"]).status, 0);
  console.log("F03_GATE_RECEIPT_PASS signed-policy-denial-definitive");

  console.log("FRONTIER03_BROKER_RECEIPT_SUMMARY", JSON.stringify({
    actualRootBroker: true, productionCGuardExecuted: true,
    deniedVersusUncertainDistinguished: true, actualPublishedBytesVerified: true,
    signedOperatorGateCovered: true,
  }));
} catch (error) {
  console.error("FRONTIER03_BROKER_RECEIPT_RED", error?.stack ?? String(error));
  process.exitCode = 1;
} finally {
  if (gateDaemon && gateDaemon.exitCode === null) {
    gateDaemon.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve => gateDaemon.once("close", resolve)),
      new Promise(resolve => setTimeout(resolve, 4000)),
    ]);
    if (gateDaemon.exitCode === null) gateDaemon.kill("SIGKILL");
  }
  sudo("rm", ["-rf", "--", gateDir]);
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
