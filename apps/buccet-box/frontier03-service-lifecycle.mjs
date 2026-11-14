/**
 * Frontier03 G01/G02 ACTUAL Linux systemd integration (disposable fixtures).
 *
 * This intentionally FAILS if either privileged daemon cannot recover from
 * SIGKILL, if an untrusted UID gains socket access, if pinned code cannot
 * install as a real service, or if authorized post-recovery effects fail.
 *
 * Never use --files-only as the successful lifecycle control.
 */
import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux", "G01/G02 real systemd test is Linux-only");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const id = "f03-" + randomBytes(6).toString("hex");
const root = "/var/lib/buccet-native/" + id;
const stage = "/var/lib/buccet-f03-stage-" + id;
const gateRun = "/run/buccet-native-gates/" + id;
const brokerSocket = root + "/broker.sock";
const gateRequest = gateRun + "/request.sock";
const gateOperator = gateRun + "/operator.sock";
const brokerUnit = "buccet-native-" + id + ".service";
const gateUnit = "buccet-operator-gate-" + id + ".service";
const tmp = await mkdtemp(path.join(os.tmpdir(), "buccet-f03-systemd-"));
const env = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C" };
const sources = {
  guard: path.join(repo, "native/build/box-fs-guard"),
  broker: path.join(repo, "native/box-fs-broker.mjs"),
  controller: path.join(repo, "native/box-fs-policy-controller.mjs"),
  gate: path.join(repo, "native/box-fs-approval-gate.mjs"),
  reviewer: path.join(repo, "native/box-fs-operator-review.mjs"),
  issuer: path.join(repo, "native/box-fs-host-enroll.mjs"),
  client: path.join(repo, "native/box-fs-broker-client.mjs"),
  brokerInstaller: path.join(repo, "scripts/provision-native-broker.sh"),
  gateInstaller: path.join(repo, "scripts/provision-native-operator-gate.sh"),
};
const digest = async file => createHash("sha256").update(await readFile(file)).digest("hex");
function run(program, args, { input = "", timeout = 25000 } = {}) {
  const r = spawnSync(program, args, { env, input, encoding: "utf8", timeout });
  assert.equal(r.error, undefined, String(r.error?.message ?? ""));
  return r;
}
function privileged(program, args, opts) {
  return run("sudo", ["-n", program, ...args], opts);
}
function must(program, args, opts) {
  const r = privileged(program, args, opts);
  assert.equal(r.status, 0, program + " failed: " + r.stderr + r.stdout);
  return r.stdout.trim();
}
function deny(program, args, reason) {
  const r = privileged(program, args);
  assert.notEqual(r.status, 0, reason + "\n" + r.stdout + r.stderr);
}
async function wait(predicate, description, timeout = 9000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const result = predicate();
      if (result) return result;
    } catch { /* service may be in a transient restart state */ }
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw Error("FRONTIER03_G01_FAILED: " + description);
}
function serviceState(unit) {
  const r = privileged("systemctl", ["is-active", unit]);
  return r.status === 0 && r.stdout.trim() === "active";
}
function serviceEvidence(unit) {
  return privileged("systemctl", ["show", "-p", "MainPID", "-p", "NRestarts",
    "-p", "ActiveState", "-p", "SubState", unit]).stdout.trim();
}
function rootBroker(op, rel, param) {
  const args = [stage + "/node", stage + "/broker-client.mjs",
    brokerSocket, op, rel];
  if (param !== undefined) args.push(param);
  return privileged(args[0], args.slice(1));
}
function mustBroker(op, rel, param) {
  const r = rootBroker(op, rel, param);
  assert.equal(r.status, 0, "real privileged effect refused: " + r.stderr + r.stdout);
  return r.stdout.trim();
}
function socketStatus(file, expected) {
  const r = privileged("stat", ["-c", "%u:%a:%F", file]);
  return r.status === 0 && r.stdout.trim() === expected;
}
function logs(unit) {
  const lines = privileged("journalctl", ["-u", unit, "--no-pager", "-n", "20"]).stdout;
  return lines.slice(-4200);
}
const operatorCode = [
  'const net=require("node:net");',
  'const s=net.createConnection({path:process.argv[1]});',
  'let out="";',
  's.once("connect",()=>s.write(process.argv[2]+"\\n"));',
  's.on("data",x=>out+=x);',
  's.once("end",()=>process.stdout.write(out));',
  's.once("error",e=>{console.error(e.code);process.exitCode=73});',
].join("");
function operator(command) {
  const r=privileged(stage+"/node",[
    "-e",operatorCode,gateOperator,JSON.stringify(command)]);
  assert.equal(r.status,0,"root-only operator socket unavailable: "+r.stderr);
  return JSON.parse(r.stdout.trim());
}
function signedRequest(request,who){
  const issuedAt=new Date().toISOString();
  const nonce=randomBytes(16).toString("hex");
  const mac=createHmac("sha256",Buffer.from(who.secretHex,"hex"))
    .update(JSON.stringify(["agent-buccet-protected-host-v1",
      who.sessionId,who.actorId,issuedAt,nonce,request])).digest("hex");
  return {...request,host:{
    sessionId:who.sessionId,actorId:who.actorId,issuedAt,nonce,mac,
  }};
}
async function submitPending(request,who,reuseEnvelope=null){
  const envelope = reuseEnvelope ?? signedRequest(request,who);
  const socket=net.createConnection({path:gateRequest});
  let raw="",settled=false;
  const response=new Promise(resolve=>{
    const finish=v=>{if(settled)return;settled=true;resolve(v);};
    socket.on("data",x=>raw+=String(x));
    socket.once("end",()=>{
      try{finish(JSON.parse(raw.split("\n",1)[0]));}
      catch{finish({ok:false,error:"no complete receipt"});}
    });
    socket.once("error",e=>finish({ok:false,error:e.code??"transport error"}));
    socket.once("close",()=>finish({ok:false,error:"closed"}));
  });
  await new Promise((resolve,reject)=>{
    socket.once("connect",()=>{
      socket.write(JSON.stringify(envelope)+"\n");
      resolve();
    });
    socket.once("error",reject);
  });
  return {socket,response,envelope};
}
let brokerInstalled = false, gateInstalled = false;
try {
  const pid1 = privileged("ps", ["-p","1","-o","comm="]);
  assert.equal(pid1.status,0,"unable to identify real init process");
  assert.equal(pid1.stdout.trim(),"systemd",
    "G01 demands ACTUAL systemd as PID 1 (not a fake systemctl binary)");
  const systemd = privileged("systemctl", ["is-system-running"]);
  assert.ok(["running","degraded","starting"].includes(systemd.stdout.trim()),
    "real systemd not usable: " + systemd.stdout + systemd.stderr);
  must("install", ["-d", "-o", "root", "-g", "root", "-m", "0700", stage]);
  for (const [name, source, mode] of [
    ["node", process.execPath, "0500"],
    ["install-broker.sh", sources.brokerInstaller, "0500"],
    ["install-gate.sh", sources.gateInstaller, "0500"],
    ["broker-client.mjs", sources.client, "0400"],
  ]) must("install", ["-o", "root", "-g", "root", "-m", mode, source, stage + "/" + name]);
  const h = {};
  for (const [key, file] of Object.entries(sources)) h[key] = await digest(file);
  const brokerEnv = [
    "BUCCET_BROKER_NODE=" + stage + "/node",
    "BUCCET_POLICY_CONTROLLER_SRC=" + sources.controller,
    "BUCCET_POLICY_CONTROLLER_SHA256=" + h.controller,
  ];
  const brokerArgs = [stage + "/install-broker.sh", id,
    sources.guard, sources.broker, h.guard, h.broker];

  // G02 negative: a forged release digest cannot create the privileged tree.
  const forgery = privileged("env", [...brokerEnv, "sh",
    ...brokerArgs.slice(0, -2), "0".repeat(64), h.broker]);
  assert.notEqual(forgery.status, 0, "G02: forged guard digest created privileged code");
  deny("test", ["-e", root], "G02: forged preflight had a filesystem side effect");
  console.log("F03_G02_PASS forged digest denied before root creation");

  const untrusted = privileged("setpriv", [
    "--reuid=65534", "--regid=65534", "--clear-groups", "env",
    ...brokerEnv, "sh", ...brokerArgs]);
  assert.notEqual(untrusted.status, 0, "G02: unprivileged installer obtained root authority");
  console.log("F03_G02_PASS unprivileged installer refused");

  // G02 adversarial partial-install fault: a root-owned trusted command
  // injects EIO after the managed directory exists, just as real disk errors
  // can happen after a series of successful privileged filesystem effects.
  // A failed privileged install MUST NOT leave an orphaned protected root.
  const faultRoot = stage + "/fault-bin";
  must("/usr/bin/install", ["-d", "-o", "root", "-g", "root", "-m", "0700", faultRoot]);
  const faultScript = path.join(tmp, "fault-install.sh");
  await writeFile(faultScript,
    '#!/bin/sh\nfor last; do :; done\n' +
    'case "$last" in */box-fs-guard) exit 74;; esac\n' +
    'exec /usr/bin/install "$@"\n');
  must("/usr/bin/install", ["-o", "root", "-g", "root", "-m", "0500",
    faultScript, faultRoot + "/install"]);
  const interrupted = privileged("env", [
    "PATH=" + faultRoot + ":/usr/bin:/bin",
    ...brokerEnv, "sh", ...brokerArgs,
  ]);
  assert.notEqual(interrupted.status, 0, "G02 injected install EIO did not abort");
  deny("test", ["-e", root],
    "G02: interrupted installation left orphaned privileged root (rollback missing)");
  deny("test", ["-e", "/etc/systemd/system/" + brokerUnit],
    "G02: interrupted installation created a live service unit");
  console.log("F03_G02_PASS injected partial native install rolled back without root residue");

  // RED control: installation may create the root and then report I/O error
  // BEFORE the caller records success. Rollback must still own that attempt.
  const rootCreateSrc = path.join(tmp, "fault-root-create.sh");
  await writeFile(rootCreateSrc,
    '#!/bin/sh\nfor last; do :; done\n' +
    'if [ "$last" = ' + JSON.stringify(root) +
    ' ]; then /usr/bin/install "$@" || exit $?; exit 79; fi\n' +
    'exec /usr/bin/install "$@"\n');
  must("/usr/bin/install", ["-o", "root", "-g", "root", "-m", "0500",
    rootCreateSrc, faultRoot + "/install"]);
  const createThenError = privileged("env", [
    "PATH=" + faultRoot + ":/usr/bin:/bin", ...brokerEnv, "sh", ...brokerArgs,
  ]);
  assert.notEqual(createThenError.status, 0,
    "G02 injected post-create installer failure was not observed");
  deny("test", ["-e", root],
    "G02 post-create I/O failure left a root because rollback flag was set too late");
  deny("test", ["-e", "/etc/systemd/system/" + brokerUnit],
    "G02 post-create I/O failure left a service");
  console.log("F03_G02_PASS root directory creation error still rolls back");


  // Inject failure after the broker has already written its systemd unit.
  // A transactional installer must remove the unit and protected root; a
  // path-only rollback would miss the privilege-bearing service descriptor.
  const ctlFaultDir=stage+"/systemctl-fault-bin";
  must("/usr/bin/install",["-d","-o","root","-g","root","-m","0700",ctlFaultDir]);
  const ctlFaultSrc=path.join(tmp,"systemctl-fault.sh");
  await writeFile(ctlFaultSrc,
    '#!/bin/sh\n' +
    'if [ "$1" = enable ]; then exit 76; fi\n' +
    'exec /usr/bin/systemctl "$@"\n');
  must("/usr/bin/install",["-o","root","-g","root","-m","0500",
    ctlFaultSrc,ctlFaultDir+"/systemctl"]);
  const brokerUnitFault=privileged("env",[
    "PATH="+ctlFaultDir+":/usr/bin:/bin",...brokerEnv,
    "sh",...brokerArgs,
  ]);
  assert.notEqual(brokerUnitFault.status,0,
    "G02 simulated systemctl failure did not stop installation");
  deny("test",["-e",root],
    "G02 installation left a privileged root after unit-activation error");
  deny("test",["-e","/etc/systemd/system/"+brokerUnit],
    "G02 installation left a service unit after activation error");
  assert.equal(serviceState(brokerUnit),false,
    "G02 failed install left privileged service active");
  console.log("F03_G02_PASS failed broker unit activation rolled back code and service");

  // G02 concurrency boundary: pause AFTER the first installer acquires its
  // filesystem lock but BEFORE it creates its root. A second root installer
  // sees no target yet and must STILL fail before allocating authority.
  const raceId = id + "-race";
  const raceRoot = "/var/lib/buccet-native/" + raceId;
  const raceUnit = "buccet-native-" + raceId + ".service";
  const raceBin = stage + "/race-bin";
  const raceReady = stage + "/race-ready";
  const raceRelease = stage + "/race-release";
  must("/usr/bin/install", ["-d", "-o", "root", "-g", "root", "-m", "0700", raceBin]);
  const raceScript = path.join(tmp, "race-install.sh");
  await writeFile(raceScript,
    '#!/bin/sh\nfor last; do :; done\n' +
    'if [ "$last" = ' + JSON.stringify(raceRoot) + ' ]; then\n' +
    '  /usr/bin/touch ' + JSON.stringify(raceReady) + '\n' +
    '  until [ -e ' + JSON.stringify(raceRelease) +
    ' ]; do /usr/bin/sleep 0.05; done\nfi\n' +
    'exec /usr/bin/install "$@"\n');
  must("/usr/bin/install", ["-o", "root", "-g", "root", "-m", "0500",
    raceScript, raceBin + "/install"]);
  const raceArgs = [stage + "/install-broker.sh", raceId,
    sources.guard, sources.broker, h.guard, h.broker];
  let raceOut = "", raceErr = "";
  const raceProc = spawn("sudo", ["-n", "env",
    "PATH=" + raceBin + ":/usr/bin:/bin", ...brokerEnv, "sh", ...raceArgs],
  { env, stdio: ["ignore", "pipe", "pipe"] });
  raceProc.stdout.on("data", chunk => { raceOut += String(chunk); });
  raceProc.stderr.on("data", chunk => { raceErr += String(chunk); });
  const raceFinished = new Promise((resolve, reject) => {
    raceProc.once("error", reject);
    raceProc.once("close", (code, signal) => resolve({ code, signal }));
  });
  try {
    await wait(() => privileged("test", ["-e", raceReady]).status === 0,
      "first installer never reached protected pre-root interleaving");
    deny("test", ["-e", raceRoot],
      "race fixture must pause BEFORE either installer makes the instance");
    const second = privileged("env", [...brokerEnv, "sh", ...raceArgs]);
    assert.notEqual(second.status, 0, "second privileged install bypassed transaction lock");
    assert.match(second.stderr, /another privileged installation is active/,
      "second install failed for a reason other than the lock");
    deny("test", ["-e", raceRoot], "competing installer created a root while locked");
    must("touch", [raceRelease]);
    const first = await raceFinished;
    assert.equal(first.code, 0, "first installer damaged by the losing race: " + raceErr + raceOut);
    assert.equal(serviceState(raceUnit), true, "winning installer service not running");
    assert.equal(socketStatus(raceRoot + "/broker.sock", "0:600:socket"), true);
    console.log("F03_G02_PASS competing root installers serialized before root creation");
  } finally {
    privileged("touch", [raceRelease]);
    if (raceProc.exitCode === null) {
      await Promise.race([raceFinished, new Promise(resolve => setTimeout(resolve, 2500))]);
      if (raceProc.exitCode === null) raceProc.kill("SIGKILL");
    }
    privileged("systemctl", ["stop", raceUnit]);
    privileged("systemctl", ["disable", raceUnit]);
    privileged("rm", ["-f", "--", "/etc/systemd/system/" + raceUnit]);
    privileged("systemctl", ["daemon-reload"]);
    privileged("rm", ["-rf", "--", raceRoot]);
  }


  const installed = privileged("env", [...brokerEnv, "sh", ...brokerArgs]);
  brokerInstalled = true;
  assert.equal(installed.status, 0, "G01 full broker service installation failed: " +
    installed.stderr + installed.stdout + "\n" + logs(brokerUnit));
  await wait(() => serviceState(brokerUnit) &&
    socketStatus(brokerSocket, "0:600:socket"), "broker not active after full systemd installation");
  console.log("F03_G01_PASS broker systemd boot " + JSON.stringify({
    unit: brokerUnit, state: serviceEvidence(brokerUnit),
  }));

  const policySource = path.join(tmp, "policy.json");
  await writeFile(policySource, JSON.stringify({ schema:1, root, allowed:[
    {op:"mkdir",prefix:"allowed"},
    {op:"write",prefix:"allowed"},
    {op:"read",prefix:"allowed"},
    {op:"append",prefix:"allowed"},
    {op:"move",prefix:"allowed"},
  ] }) + "\n");
  must("install", ["-o", "root", "-g", "root", "-m", "0400",
    policySource, root + "/policy.json"]);
  mustBroker("mkdir", "allowed");
  mustBroker("write", "allowed/ready.txt", "AUTHORIZED_BEFORE_CRASH");
  assert.equal(mustBroker("read", "allowed/ready.txt"), "AUTHORIZED_BEFORE_CRASH");

  const hostile = privileged("setpriv", [
    "--reuid=65534", "--regid=65534", "--clear-groups",
    "stat", brokerSocket]);
  assert.notEqual(hostile.status, 0, "G02: untrusted process reached private broker path");

  const gateEnv = [
    "BUCCET_BROKER_NODE=" + stage + "/node",
    "BUCCET_HOST_ENROLLER_SRC=" + sources.issuer,
    "BUCCET_HOST_ENROLLER_SHA256=" + h.issuer,
  ];
  const gateArgs = [stage + "/install-gate.sh", id, sources.gate,
    h.gate, sources.reviewer, h.reviewer];
  // G02 second fault point: native broker must survive a failed gate
  // installation, but partial reviewer code/host registry/public directory
  // may not be left active or registered with any privilege.
  const gateFaultBin = stage + "/gate-fault-bin";
  must("/usr/bin/install", ["-d", "-o", "root", "-g", "root",
    "-m", "0700", gateFaultBin]);
  const gateFaultSource = path.join(tmp, "fault-gate-install.sh");
  await writeFile(gateFaultSource,
    '#!/bin/sh\nfor last; do :; done\n' +
    'case "$last" in */approval-gate.mjs) exit 75;; esac\n' +
    'exec /usr/bin/install "$@"\n');
  must("/usr/bin/install", ["-o", "root", "-g", "root", "-m", "0500",
    gateFaultSource, gateFaultBin + "/install"]);
  const gateFault = privileged("env", [
    "PATH=" + gateFaultBin + ":/usr/bin:/bin",
    ...gateEnv, "sh", ...gateArgs,
  ]);
  assert.notEqual(gateFault.status, 0, "G02 injected gate install EIO did not abort");
  deny("test", ["-e", root + "/approval-gate.mjs"],
    "G02: failed gate install left privileged executable residue");
  deny("test", ["-e", root + "/host-identities.json"],
    "G02: failed gate install left an unintended registration");
  deny("test", ["-e", gateRun],
    "G02: failed gate install left a public request namespace");
  assert.equal(mustBroker("read", "allowed/ready.txt"),"AUTHORIZED_BEFORE_CRASH",
    "G02: failed gate installation damaged the running protected broker");
  console.log("F03_G02_PASS interrupted gate install rolled back without harming broker");

  // Second create-then-error checkpoint: the public request namespace can be
  // created before the installation command returns failure.
  const gateCreateSrc = path.join(tmp, "fault-gate-create.sh");
  await writeFile(gateCreateSrc,
    '#!/bin/sh\nfor last; do :; done\n' +
    'if [ "$last" = ' + JSON.stringify(gateRun) +
    ' ]; then /usr/bin/install "$@" || exit $?; exit 81; fi\n' +
    'exec /usr/bin/install "$@"\n');
  must("/usr/bin/install", ["-o", "root", "-g", "root", "-m", "0500",
    gateCreateSrc, gateFaultBin + "/install"]);
  const createGateThenError = privileged("env", [
    "PATH=" + gateFaultBin + ":/usr/bin:/bin", ...gateEnv, "sh", ...gateArgs,
  ]);
  assert.notEqual(createGateThenError.status, 0,
    "G02 injected post-create gate failure was not observed");
  deny("test", ["-e", gateRun],
    "G02 post-create gate failure left the public privileged request namespace");
  deny("test", ["-e", root + "/approval-gate.mjs"],
    "G02 post-create gate failure left a partial privileged script");
  assert.equal(mustBroker("read", "allowed/ready.txt"), "AUTHORIZED_BEFORE_CRASH");
  console.log("F03_G02_PASS gate namespace creation error rolls back");


  const gateUnitFault=privileged("env",[
    "PATH="+ctlFaultDir+":/usr/bin:/bin",...gateEnv,
    "sh",...gateArgs,
  ]);
  assert.notEqual(gateUnitFault.status,0,
    "G02 simulated gate service activation failure did not abort");
  deny("test",["-e","/etc/systemd/system/"+gateUnit],
    "G02 failed gate installation left a privileged systemd unit");
  deny("test",["-e",root+"/approval-gate.mjs"],
    "G02 failed gate activation left privileged executable code");
  deny("test",["-e",gateRun],
    "G02 failed gate activation left an attacker-visible request endpoint");
  assert.equal(serviceState(brokerUnit),true,
    "G02 failed operator gate activation damaged existing protected broker");
  assert.equal(mustBroker("read","allowed/ready.txt"),"AUTHORIZED_BEFORE_CRASH");
  console.log("F03_G02_PASS failed gate unit activation rolled back without collateral effects");

  const gateSetup = privileged("env", [...gateEnv, "sh", ...gateArgs]);
  gateInstalled = true;
  assert.equal(gateSetup.status, 0, "G01 full gate systemd installation failed: " +
    gateSetup.stderr + gateSetup.stdout + "\n" + logs(gateUnit));
  await wait(() => serviceState(gateUnit) &&
    socketStatus(gateRequest, "0:666:socket") &&
    socketStatus(gateOperator, "0:600:socket"), "operator gate not active after full systemd installation");
  console.log("F03_G01_PASS gate systemd boot " + JSON.stringify({
    unit: gateUnit, state: serviceEvidence(gateUnit),
  }));

  // Kernel-enforced isolation is a negative control; service stays usable.
  deny("setpriv", ["--reuid=65534", "--regid=65534", "--clear-groups",
    "stat", root + "/policy.json"], "G02: hostile UID read protected policy");
  mustBroker("append", "allowed/ready.txt", "|VALID_AFTER_INSTALL");
  assert.equal(mustBroker("read", "allowed/ready.txt"),
    "AUTHORIZED_BEFORE_CRASH|VALID_AFTER_INSTALL");

  const brokerBefore = serviceEvidence(brokerUnit);
  must("systemctl", ["kill", "--kill-whom=main", "-s", "SIGKILL", brokerUnit]);
  console.log("F03_G01_ATTACK broker SIGKILL at live production service " + brokerBefore);
  await wait(() => serviceState(brokerUnit) &&
    rootBroker("read","allowed/ready.txt").status === 0,
    "root-owned broker failed to recover from abrupt death and resume authorized read", 12000);
  assert.equal(mustBroker("read", "allowed/ready.txt"),
    "AUTHORIZED_BEFORE_CRASH|VALID_AFTER_INSTALL");
  console.log("F03_G01_PASS killed broker recovered " + serviceEvidence(brokerUnit));

  const gateBefore = serviceEvidence(gateUnit);
  must("systemctl", ["kill", "--kill-whom=main", "-s", "SIGKILL", gateUnit]);
  console.log("F03_G01_ATTACK gate SIGKILL at live production service " + gateBefore);
  await wait(() => serviceState(gateUnit) &&
    socketStatus(gateOperator, "0:600:socket") &&
    operator({command:"list"}).ok === true,
    "root-owned gate failed to recover LIVE root-only socket after abrupt death", 12000);
  console.log("F03_G01_PASS killed gate recovered " + serviceEvidence(gateUnit));

  // G01: signed request pending at the moment of SIGKILL is never reused
  // by the new daemon generation. A fresh, separately approved request must
  // still complete and commit its EXACT original bytes.
  const who={
    sessionId:"trustedhost_"+id.replaceAll("-",""),
    actorId:"trustedoperator_"+id.replaceAll("-",""),
    secretHex:randomBytes(32).toString("hex"),
  };
  const registry=path.join(tmp,"host-identities.json");
  await writeFile(registry,JSON.stringify({
    schema:1,root,allowed:[who],
  })+"\n");
  must("install",["-o","root","-g","root","-m","0400",
    registry,root+"/host-identities.json"]);

  // G03 OS identity boundary: the process with the untrusted runner's UID
  // and a separate unprivileged UID may know the actor/session NAMES but must
  // not be able to extract the independent root issuer's HMAC secret.
  const untrustedRegistry=run("cat",[root+"/host-identities.json"]);
  assert.notEqual(untrustedRegistry.status,0,
    "G03 same-UID agent could read root-issued host credential registry");
  deny("setpriv",["--reuid=65534","--regid=65534","--clear-groups",
    "cat",root+"/host-identities.json"],
    "G03 independently unprivileged UID read root-only host secret");
  const spoofedPath="allowed/forged-actor-label.txt";
  const spoofedProposal={op:"write",path:spoofedPath,content:"MUST_NOT_EXECUTE"};
  const spoofed=await submitPending(spoofedProposal,who,{
    ...spoofedProposal,
    host:{
      sessionId:who.sessionId,actorId:who.actorId,
      issuedAt:new Date().toISOString(),
      nonce:randomBytes(16).toString("hex"),
      mac:"0".repeat(64),
    },
  });
  const spoofedReceipt=await Promise.race([
    spoofed.response,
    new Promise(resolve=>setTimeout(()=>{
      spoofed.socket.destroy();
      resolve({ok:false,error:"missing explicit forged-proof rejection"});
    },2500)),
  ]);
  assert.equal(spoofedReceipt.ok,false,
    "G03 copied trusted actor label with fake MAC gained root gate access");
  assert.match(String(spoofedReceipt.error),/host proof|unattested|invalid/i,
    "G03 forged actor proof failed without a verified integrity reason");
  assert.equal(operator({command:"list"}).pending?.length,0,
    "G03 forged actor label entered root operator approval queue");
  deny("test",["-e",root+"/"+spoofedPath],
    "G03 forged host identity produced protected bytes");
  console.log("F03_G03_PASS same-UID secret denial and forged actor-MAC proof refusal");

  const gatePid=must("systemctl",["show","-p","MainPID","--value",gateUnit]).trim();
  assert.match(gatePid,/^[1-9][0-9]+$/,"real gate service PID unavailable");
  const procEnv=run("cat",["/proc/"+gatePid+"/environ"]);
  assert.notEqual(procEnv.status,0,
    "G03 untrusted same-UID agent read privileged gate process environment");
  const procFD=run("ls",["/proc/"+gatePid+"/fd"]);
  assert.notEqual(procFD.status,0,
    "G03 untrusted same-UID agent enumerated privileged gate descriptors");
  const procArgv=run("cat",["/proc/"+gatePid+"/cmdline"]);
  if (procArgv.status===0) {
    assert.ok(!procArgv.stdout.includes(who.secretHex),
      "G03 root host secret leaked in privileged gate argv");
  }
  const ledgerRoute=privileged(root+"/box-fs-guard",[
    "mkdir",root,".buccet-host-nonces/forged-native-entry"]);
  assert.notEqual(ledgerRoute.status,0,
    "G03 native filesystem path accepted reserved root host-nonce namespace");
  console.log("F03_G03_PASS same-UID proc/env/fd isolation and native ledger namespace denial");


  const staleName="allowed/old-unapproved.txt";
  const pending=await submitPending({
    op:"write",path:staleName,content:"SHOULD_NOT_EXECUTE",
  },who);
  const stale=await wait(()=>{
    const list=operator({command:"list"});
    return list.pending?.find(x=>x.path===staleName);
  },"root operator never saw signed pending attack");
  assert.equal(stale.host?.verified,true);
  must("systemctl",["kill","--kill-whom=main","-s","SIGKILL",gateUnit]);
  console.log("F03_G01_ATTACK gate SIGKILL while exact request pending "+
    JSON.stringify({requestId:stale.requestId,digest:stale.sha256}));
  await wait(()=>serviceState(gateUnit) &&
    socketStatus(gateRequest,"0:666:socket") &&
    socketStatus(gateOperator,"0:600:socket") &&
    operator({command:"list"}).ok === true,
    "gate failed to recover with LIVE operator listener and pending request invalidation",12000);
  const oldApproval=operator({
    command:"approve",requestId:stale.requestId,sha256:stale.sha256,
  });
  assert.equal(oldApproval.ok,false,"stale operator approval replayed after restart");
  const oldReceipt=await pending.response;
  assert.notEqual(oldReceipt.ok,true,"stale pre-crash request reported success");
  deny("test",["-e",root+"/"+staleName],
    "stale unapproved request executed in protected root");

  // G03 RED CONTROL: the exact same HMAC, nonce, issuedAt and payload consumed
  // by the crashed gate must NOT be accepted by the replacement gate. Denying
  // the old operator request ID alone is insufficient if a signed host packet
  // can be replayed into a fresh pending request after SIGKILL.
  const replay = await submitPending({
    op:"write",path:staleName,content:"SHOULD_NOT_EXECUTE",
  },who,pending.envelope);
  let replayQueued;
  for (let attempt=0; attempt<18; attempt++) {
    replayQueued=operator({command:"list"}).pending?.find(x=>x.path===staleName);
    if (replayQueued) break;
    await new Promise(resolve=>setTimeout(resolve,70));
  }
  if (replayQueued) {
    operator({command:"deny",requestId:replayQueued.requestId,
      sha256:replayQueued.sha256});
  }
  const replayResponse=await Promise.race([
    replay.response,
    new Promise(resolve=>setTimeout(()=>{
      replay.socket.destroy();
      resolve({ok:false,error:"missing explicit replay rejection"});
    },2500)),
  ]);
  assert.equal(replayQueued,undefined,
    "G03 pre-crash signed host proof reentered the replacement operator queue");
  assert.equal(replayResponse.ok,false);
  assert.match(String(replayResponse.error),/replay|stale|expired|invalid/i,
    "cross-generation host replay was not explicitly refused");
  deny("test",["-e",root+"/"+staleName],
    "G03 host proof replay caused unapproved protected effect");
  console.log("F03_G03_PASS precrash host-HMAC nonce cannot replay after gate SIGKILL");


  const newName="allowed/new-approved.txt";
  const fresh=await submitPending({
    op:"write",path:newName,content:"AUTHORIZED_AFTER_CRASH",
  },who);
  const current=await wait(()=>operator({command:"list"}).pending?.find(
    x=>x.path===newName),
    "new signed request failed to queue after restart");
  assert.equal(operator({
    command:"approve",requestId:current.requestId,sha256:current.sha256,
  }).approved,true);
  const receipt=await fresh.response;
  assert.equal(receipt.ok,true,"legitimate freshly approved request was not executed");
  assert.equal(mustBroker("read",newName),"AUTHORIZED_AFTER_CRASH");
  console.log("F03_G01_PASS stale request denied and new operator approved correct bytes");

  mustBroker("write", "allowed/after-restart.txt", "GENUINE_AUTHORIZED_EFFECT");
  assert.equal(mustBroker("read", "allowed/after-restart.txt"), "GENUINE_AUTHORIZED_EFFECT");
  console.log("FRONTIER03_G01_G02_LIFECYCLE_PASS", JSON.stringify({
    fullSystemdBoot:true, realBrokerAndGate:true,
    kernelUntrustedUIDDenied:true, forgedDigestDenied:true,
    realBrokerKillRecovery:true, realGateKillRecovery:true,
    crashedPendingApprovalInvalidated:true,
    crashedSignedHostProofReplayDenied:true,
    sameUIDHostSecretInaccessible:true, forgedActorMACDenied:true,
    sameUIDProcFDIsolation:true, protectedReplayLedgerPathReserved:true,
    newlySignedAndApprovedExactBytesCommitted:true,
    authorizedEffectsBeforeAndAfterRestart:true,
  }));
} catch (error) {
  console.error("FRONTIER03_G01_G02_RED", error?.stack ?? String(error));
  console.error("FRONTIER03_SERVICE_BROKER", serviceEvidence(brokerUnit));
  console.error("FRONTIER03_SERVICE_GATE", serviceEvidence(gateUnit));
  console.error("FRONTIER03_BROKER_JOURNAL", logs(brokerUnit));
  console.error("FRONTIER03_GATE_JOURNAL", logs(gateUnit));
  process.exitCode = 1;
} finally {
  for (const [installed,unit] of [[gateInstalled,gateUnit],[brokerInstalled,brokerUnit]]) {
    if (!installed) continue;
    privileged("systemctl", ["stop", unit]);
    privileged("systemctl", ["disable", unit]);
    privileged("rm", ["-f", "--", "/etc/systemd/system/" + unit]);
  }
  privileged("systemctl", ["daemon-reload"]);
  const cleaned=privileged("rm", ["-rf", "--", root, stage, gateRun]);
  if(cleaned.status!==0) {
    console.error("FRONTIER03_CLEANUP_FAILED", cleaned.stderr);
    process.exitCode=1;
  }
  await rm(tmp,{recursive:true,force:true});
}
