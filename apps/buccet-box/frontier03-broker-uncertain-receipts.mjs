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

  // Other root-owned callers must not downgrade an ambiguous commit to a
  // definite denial or ordinary success just because the broker socket replied.
  const cli = path.join(repo, "native/box-fs-broker-client.mjs");
  const policyController = path.join(repo, "native/box-fs-policy-controller.mjs");
  const cliGood = sudo(process.execPath, [cli, socket, "write",
    "files/cli-ok.txt", "CLI_EXACT_SUCCESS"]);
  must(cliGood, "legitimate trusted broker client");
  assert.equal(actualRead("files/cli-ok.txt"), "CLI_EXACT_SUCCESS");
  const cliPost = sudo(process.execPath, [cli, socket, "write",
    "files/post-eio.txt", "CLI_EFFECT_UNCERTAIN"]);
  assert.equal(cliPost.status, 74, "broker client must distinguish unknown mutation");
  assert.match(cliPost.stderr, /BUCCET_BROKER_CLIENT_COMMIT_UNCERTAIN/);
  assert.equal(actualRead("files/post-eio.txt"), "CLI_EFFECT_UNCERTAIN");
  const cliPre = sudo(process.execPath, [cli, socket, "write",
    "files/pre-eio.txt", "NEVER_PUBLISH"]);
  assert.equal(cliPre.status, 73, "precommit fault is a confirmed rejection");
  assert.notEqual(sudo("test", ["-e", root + "/files/pre-eio.txt"]).status, 0);
  console.log("F03_CONTROLLER_RECEIPT_PASS broker-client-uncertain-versus-denied");

  const controllerGood = sudo(process.execPath, [policyController, root,
    "write", "files/controller-ok.txt"], "CONTROLLER_EXACT_SUCCESS");
  must(controllerGood, "trusted policy controller legitimate effect");
  assert.equal(actualRead("files/controller-ok.txt"), "CONTROLLER_EXACT_SUCCESS");
  const controllerPost = sudo(process.execPath, [policyController, root,
    "write", "files/post-eio.txt"], "CONTROLLER_EFFECT_UNCERTAIN");
  assert.equal(controllerPost.status, 74, "controller must not turn EIO into denial");
  assert.match(controllerPost.stderr, /BUCCET_POLICY_COMMIT_UNCERTAIN/);
  assert.equal(actualRead("files/post-eio.txt"), "CONTROLLER_EFFECT_UNCERTAIN");
  const controllerPre = sudo(process.execPath, [policyController, root,
    "write", "files/pre-eio.txt"], "NEVER_PUBLISH");
  assert.equal(controllerPre.status, 73, "controller must preserve confirmed denial");
  assert.notEqual(sudo("test", ["-e", root + "/files/pre-eio.txt"]).status, 0);
  console.log("F03_CONTROLLER_RECEIPT_PASS policy-controller-uncertain-versus-denied");


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
    return { response, socket };
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
    const { response } = await submit(proposal);
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

  // G01/G04 stress: 128 unique, independently HMAC-signed host requests
  // simultaneously hit the PUBLIC gate. Capacity pressure must neither
  // execute an unapproved request nor let a replayed/tampered operator digest
  // cause an effect. Each success is checked against actual root-owned bytes.
  const COUNT = 128;
  const burst = await Promise.all(Array.from({ length: COUNT }, async (_, n) => {
    const pathName = "files/pressure-" + String(n).padStart(3, "0") + ".txt";
    const payload = "SIGNED_EXACT_" + String(n).padStart(3, "0");
    const { response, socket } = await submit({
      op: "write", path: pathName, content: payload,
    });
    return { pathName, payload, response, socket, approved: false };
  }));
  // A bounded asynchronous read of the root host registry occurs for every
  // request; allow the kernel/socket event loop to process the whole burst.
  let queue = [];
  for (let attempt = 0; attempt < 50; attempt++) {
    queue = operator({ command: "list" }).pending;
    if (queue.length >= 16) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(queue.length > 0 && queue.length <= 16,
    "gate pending capacity leaked under >100 signed requests: " + queue.length);
  const indexed = new Map(burst.map(item => [item.pathName, item]));
  const approved = [], operatorDenied = [], canceled = [];
  const approveCount = Math.min(8, queue.length);
  const denyCount = Math.min(4, queue.length - approveCount);
  for (let i = 0; i < queue.length; i++) {
    const row = queue[i];
    assert.equal(row.host?.verified, true, "a pressure request bypassed host proof");
    assert.ok(indexed.has(row.path), "unexpected pending root request");
    const item = indexed.get(row.path);
    if (i < approveCount) {
      // An operator's approval must bind the full exact digest and retire
      // atomically before it can be replayed against another request.
      const forged = operator({
        command: "approve", requestId: row.requestId, sha256: "0".repeat(64),
      });
      assert.equal(forged.ok, false, "tampered digest accepted under pressure");
      const valid = operator({
        command: "approve", requestId: row.requestId, sha256: row.sha256,
      });
      assert.equal(valid.approved, true, "legitimate approval lost under pressure");
      const replay = operator({
        command: "approve", requestId: row.requestId, sha256: row.sha256,
      });
      assert.equal(replay.ok, false, "one-shot approval replayed");
      item.approved = true;
      approved.push(item);
    } else if (i < approveCount + denyCount) {
      const valid = operator({
        command: "deny", requestId: row.requestId, sha256: row.sha256,
      });
      assert.equal(valid.denied, true, "valid deny not honored");
      operatorDenied.push(item);
    } else {
      item.socket.destroy(); // cancellation before any approval
      canceled.push(item);
    }
  }
  const receipts = await Promise.race([
    Promise.all(burst.map(async item => ({ item, result: await item.response }))),
    new Promise((_, reject) => setTimeout(() =>
      reject(Error("128-client signed gate storm left stuck pending transports")), 20000)),
  ]);
  assert.equal(receipts.length, COUNT);
  const accepted = receipts.filter(({ result }) => result?.ok === true);
  assert.equal(accepted.length, approved.length,
    "a receipt under pressure reported success without root approval");
  for (const { item, result } of receipts) {
    if (item.approved) {
      assert.equal(result?.ok, true, "approved request had no positive control");
      assert.equal(actualRead(item.pathName), item.payload,
        "approved signed request committed wrong exact bytes");
    } else {
      assert.notEqual(result?.ok, true,
        "unapproved, denied, or canceled request unexpectedly succeeded");
      assert.notEqual(sudo("test", ["-e", root + "/" + item.pathName]).status, 0,
        "unapproved signed request produced a filesystem effect");
    }
  }
  assert.equal(operator({ command: "list" }).pending.length, 0,
    "pending queue leaked signed requests after denial and disconnection");
  console.log("FRONTIER03_SIGNED_GATE_128_STORM_PASS", JSON.stringify({
    submitted: COUNT, rootApproved: approved.length,
    explicitlyDenied: operatorDenied.length, disconnected: canceled.length,
    capacityRejected: COUNT - queue.length, allExactEffects: true,
    staleApprovalReplaysRejected: true, digestSubstitutionRejected: true,
    signedHostProofVerified: true,
  }));



  // G01 host revocation AFTER an operator click but BEFORE the queued effect.
  // First positive request has already passed the signed host check and is
  // actually paused in the native renameat interposer. Second approval is
  // queued behind it; revoking the host registry must invalidate the second
  // effect BEFORE it enters the native guard. A no-op/deny-everything gate
  // fails the first positive control.
  const firstAction = approveAndReceive({
    op: "write", path: "files/slow-revoke.txt", content: "FIRST_ALREADY_AT_NATIVE_RENAME",
  }).then(result => ({ result }), error => ({ error }));
  let reachedNative = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    const observed = sudo("cat", [trace]);
    if (observed.status === 0 &&
        observed.stdout.includes("rename:paused-before-commit")) {
      reachedNative = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  assert.equal(reachedNative, true,
    "first signed approval never reached real precommit renameat barrier");
  const queuedPath = "files/revoked-after-click.txt";
  const queuedRequest = await submit({
    op: "write", path: queuedPath, content: "REVOKED_MUST_NOT_PUBLISH",
  });
  let queuedRow;
  for (let attempt = 0; attempt < 70; attempt++) {
    queuedRow = operator({ command: "list" }).pending.find(p => p.path === queuedPath);
    if (queuedRow) break;
    await new Promise(resolve => setTimeout(resolve, 70));
  }
  assert.ok(queuedRow, "second signed host action was not queued");
  assert.equal(queuedRow.host?.verified, true, "queued action was not originally signed");
  const clicked = operator({
    command: "approve", requestId: queuedRow.requestId, sha256: queuedRow.sha256,
  });
  assert.equal(clicked.approved, true, "operator click was not accepted");
  const emptyRegistry = path.join(tmp, "host-revoked.json");
  await writeFile(emptyRegistry, JSON.stringify({
    schema: 1, root, allowed: [],
  }) + "\n");
  must(sudo("install", ["-o", "root", "-g", "root", "-m", "0400",
    emptyRegistry, root + "/host-identities.json"]),
    "independent root operator revokes queued host credentials");
  must(sudo("touch", [root + "/release-revoke"]),
    "release real native renameat after revoked second approval");
  const firstObserved = await firstAction;
  if (firstObserved.error) throw firstObserved.error;
  assert.equal(firstObserved.result.ok, true,
    "already-authorized in-flight native effect lost legitimate positive control");
  assert.equal(actualRead("files/slow-revoke.txt"), "FIRST_ALREADY_AT_NATIVE_RENAME");
  const revokedReceipt = await Promise.race([
    queuedRequest.response,
    new Promise((_, reject) => setTimeout(() =>
      reject(Error("revoked queued host request never completed")), 10000)),
  ]);
  assert.equal(revokedReceipt?.ok, false,
    "revoked approved-but-queued host executed after revocation");
  assert.notEqual(sudo("test", ["-e", root + "/" + queuedPath]).status, 0,
    "revoked host produced protected native file after operator click");
  assert.equal(operator({ command: "list" }).pending.length, 0,
    "revoked request remained replayable in root operator gate");
  console.log("FRONTIER03_SIGNED_GATE_REVOKED_AFTER_CLICK_PASS", JSON.stringify({
    originalHmacVerified: true, firstRealNativeRenamePaused: true,
    secondOperatorApprovalAcknowledged: true, rootHostIdentityRevoked: true,
    firstActualFileBytes: "FIRST_ALREADY_AT_NATIVE_RENAME",
    revokedSecondFileAbsent: true, downstreamReverificationEnforced: true,
  }));

  console.log("FRONTIER03_BROKER_RECEIPT_SUMMARY", JSON.stringify({
    actualRootBroker: true, productionCGuardExecuted: true,
    deniedVersusUncertainDistinguished: true, actualPublishedBytesVerified: true,
    signedOperatorGateCovered: true, brokerClientAndControllerCovered: true,
    signedGate128ClientStress: true,
    signedHostPostApprovalRevocation: true,
  }));
} catch (error) {
  console.error("FRONTIER03_BROKER_RECEIPT_RED", error?.stack ?? String(error));
  process.exitCode = 1;
} finally {
  sudo("touch", [root + "/release-revoke"]); // unblock a faulted native guard
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
