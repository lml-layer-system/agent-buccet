/**
 * Frontier03 G02: SIGKILL the actual privileged installer mid-transaction.
 *
 * Shell EXIT traps CANNOT run under SIGKILL. This forces creation of trusted
 * filesystem resources followed by an immediate kill of the installer parent.
 * An explicit recovery transaction must safely refuse live/unknown authority,
 * clean a verified uncommitted instance, and preserve existing broker data
 * across a separately killed operator-gate installation.
 *
 * Linux-only; disposable randomly named systemd units, no production effects.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux", "actual Linux systemd required");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const id = "f03-sigkill-" + randomBytes(5).toString("hex");
const root = "/var/lib/buccet-native/" + id;
const stage = "/var/lib/buccet-native/f03-stage-" + id;
const runDir = "/run/buccet-native-gates/" + id;
const brokerUnit = "buccet-native-" + id + ".service";
const gateUnit = "buccet-operator-gate-" + id + ".service";
const brokerMarker = "/var/lib/buccet-native/.buccet-broker-install-" + id + ".incomplete";
const gateMarker = "/run/buccet-native-gates/.buccet-gate-install-" + id + ".incomplete";
const tmp = await mkdtemp(path.join(os.tmpdir(), "f03-kill-install-"));
const env = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C" };
const files = {
  guard: path.join(repo, "native/build/box-fs-guard"),
  broker: path.join(repo, "native/box-fs-broker.mjs"),
  controller: path.join(repo, "native/box-fs-policy-controller.mjs"),
  gate: path.join(repo, "native/box-fs-approval-gate.mjs"),
  reviewer: path.join(repo, "native/box-fs-operator-review.mjs"),
  issuer: path.join(repo, "native/box-fs-host-enroll.mjs"),
  client: path.join(repo, "native/box-fs-broker-client.mjs"),
  installer: path.join(repo, "scripts/provision-native-broker.sh"),
  gateInstaller: path.join(repo, "scripts/provision-native-operator-gate.sh"),
};
function run(bin, args = [], input = "") {
  const out = spawnSync(bin, args, { env, input, encoding: "utf8", timeout: 27000 });
  assert.equal(out.error, undefined, out.error?.message ?? "");
  return out;
}
function sudo(bin, args = [], input = "") { return run("sudo", ["-n", bin, ...args], input); }
function good(result, label) {
  assert.equal(result.status, 0, label + ": " + result.stderr + result.stdout);
  return result.stdout.trim();
}
function absent(file, label) {
  assert.notEqual(sudo("test", ["-e", file]).status, 0, label);
  assert.notEqual(sudo("test", ["-L", file]).status, 0, label + " (symlink)");
}
function active(unit) { return sudo("systemctl", ["is-active", "--quiet", unit]).status === 0; }
const hash = async file => createHash("sha256").update(await readFile(file)).digest("hex");
let brokerBooted = false, gateBooted = false;
try {
  assert.equal(good(sudo("ps", ["-p", "1", "-o", "comm="]), "PID1 systemd"), "systemd");
  good(sudo("install", ["-d", "-o", "root", "-g", "root", "-m", "0700", stage]),
    "stage independent release root");
  for (const [name, src, mode] of [
    ["node", process.execPath, "0500"],
    ["install-broker.sh", files.installer, "0500"],
    ["install-gate.sh", files.gateInstaller, "0500"],
    ["broker-client.mjs", files.client, "0400"],
  ]) good(sudo("install", ["-o","root","-g","root","-m",mode,src,stage+"/"+name]),
    "stage verified " + name);
  const digest = {};
  for (const [key, file] of Object.entries(files)) digest[key] = await hash(file);
  const benv = [
    "BUCCET_BROKER_NODE=" + stage + "/node",
    "BUCCET_POLICY_CONTROLLER_SRC=" + files.controller,
    "BUCCET_POLICY_CONTROLLER_SHA256=" + digest.controller,
  ];
  const genv = [
    "BUCCET_BROKER_NODE=" + stage + "/node",
    "BUCCET_HOST_ENROLLER_SRC=" + files.issuer,
    "BUCCET_HOST_ENROLLER_SHA256=" + digest.issuer,
  ];
  const bargs = ["sh", stage + "/install-broker.sh", id,
    files.guard, files.broker, digest.guard, digest.broker];
  const gargs = ["sh", stage + "/install-gate.sh", id,
    files.gate, digest.gate, files.reviewer, digest.reviewer];

  // Root-owned test-only executable performs the REAL install, then sends
  // SIGKILL to the caller's installer shell, bypassing EXIT traps entirely.
  const injectDir = stage + "/kill-bin";
  good(sudo("install", ["-d","-o","root","-g","root","-m","0700",injectDir]),"kill fixture bin");
  const injectionFile = path.join(tmp, "kill-parent.sh");
  async function installKillWrapper(pattern) {
    await writeFile(injectionFile,
      '#!/bin/sh\nfor last; do :; done\n' +
      'case "$last" in ' + pattern + ')\n' +
      '  /usr/bin/install "$@" || exit $?\n' +
      '  /bin/kill -KILL "$PPID"\n' +
      '  exit 137;;\n' +
      'esac\nexec /usr/bin/install "$@"\n');
    good(sudo("install", ["-o","root","-g","root","-m","0500",
      injectionFile,injectDir+"/install"]), "pin root-only SIGKILL injector");
  }

  await installKillWrapper('*/box-fs-guard');
  const killedBroker = sudo("env", ["PATH="+injectDir+":/usr/bin:/bin",
    ...benv, ...bargs]);
  assert.notEqual(killedBroker.status, 0, "injected SIGKILL did not interrupt broker installer");
  assert.equal(sudo("test",["-f",root+"/box-fs-guard"]).status,0,
    "first installer did not reach actual native install side effect");
  absent("/etc/systemd/system/"+brokerUnit,"fault was required before unit install");
  console.log("F03_G02_ATTACK SIGKILL broker installer after privileged native code installed");
  const naive = sudo("env",[...benv,...bargs]);
  assert.notEqual(naive.status,0,"fresh installer blindly accepted crashed privileged tree");
  const recover = sudo("env",[...benv,...bargs,"--recover-incomplete"]);
  good(recover,"explicit interrupted broker installation recovery");
  absent(root,"broker SIGKILL recovery left privileged code root");
  absent(brokerMarker,"broker SIGKILL recovery left orphaned recovery marker");
  absent("/etc/systemd/system/"+brokerUnit,"broker recovery left service descriptor");
  assert.equal(active(brokerUnit),false);
  console.log("F03_G02_PASS SIGKILL broker install recovered without orphan authority");

  good(sudo("env",[...benv,...bargs]), "clean real broker install after SIGKILL recovery");
  brokerBooted = true;
  assert.equal(active(brokerUnit),true,"broker service did not boot after crash recovery");
  const policy = path.join(tmp,"policy.json");
  await writeFile(policy,JSON.stringify({schema:1,root,allowed:[
    {op:"write",prefix:"allowed"},{op:"read",prefix:"allowed"},
  ]})+"\n");
  good(sudo("install",["-o","root","-g","root","-m","0400",
    policy,root+"/policy.json"]),"install independent root policy");
  good(sudo(stage+"/node",[stage+"/broker-client.mjs",root+"/broker.sock",
    "write","allowed/ready.txt","PRESERVE_BROKER_DATA"]),"approved broker write");
  assert.equal(good(sudo(stage+"/node",[stage+"/broker-client.mjs",
    root+"/broker.sock","read","allowed/ready.txt"]),"broker read"),
    "PRESERVE_BROKER_DATA");

  await installKillWrapper('*/approval-gate.mjs');
  const killedGate = sudo("env",["PATH="+injectDir+":/usr/bin:/bin",
    ...genv,...gargs]);
  assert.notEqual(killedGate.status,0,"gate installer SIGKILL was not injected");
  assert.equal(sudo("test",["-f",root+"/approval-gate.mjs"]).status,0,
    "gate installer did not install protected script before SIGKILL");
  assert.equal(active(brokerUnit),true, "SIGKILL gate install damaged healthy broker");
  console.log("F03_G02_ATTACK SIGKILL operator gate installer after root gate code installed");
  const badRetry = sudo("env",[...genv,...gargs]);
  assert.notEqual(badRetry.status,0,"gate install blindly reused interrupted namespace");
  const recoverGate = sudo("env",[...genv,...gargs,"--recover-incomplete"]);
  good(recoverGate,"explicit interrupted gate installation recovery");
  absent(root+"/approval-gate.mjs","gate recovery left privileged script");
  absent(root+"/operator-review.mjs","gate recovery left reviewer code");
  absent(root+"/host-identities.json","gate recovery left host registry");
  absent(runDir,"gate recovery left public request namespace");
  absent(gateMarker,"gate recovery left stale recovery marker");
  assert.equal(active(gateUnit),false);
  assert.equal(active(brokerUnit),true,"gate recovery disabled existing broker");
  assert.equal(good(sudo(stage+"/node",[stage+"/broker-client.mjs",
    root+"/broker.sock","read","allowed/ready.txt"]),"post-gate-crash broker read"),
    "PRESERVE_BROKER_DATA");
  console.log("F03_G02_PASS SIGKILL gate install rollback preserved legitimate broker data");
  good(sudo("env",[...genv,...gargs]),"real gate install after interrupted recovery");
  gateBooted = true;
  assert.equal(active(gateUnit),true,"gate not active after recovered installation");
  console.log("FRONTIER03_INSTALLER_SIGKILL_RECOVERY_PASS",JSON.stringify({
    actualSystemd:true,brokerSIGKILL:true,gateSIGKILL:true,
    explicitRecovery:true,originalBrokerDataIntact:true,
    healthyReinstallation:true,fullPowerLoss:false,
  }));
} catch (error) {
  console.error("FRONTIER03_INSTALLER_SIGKILL_RECOVERY_RED",error?.stack??String(error));
  process.exitCode = 1;
} finally {
  for (const unit of [gateUnit,brokerUnit]) {
    sudo("systemctl",["stop",unit]);
    sudo("systemctl",["disable",unit]);
    sudo("rm",["-f","--","/etc/systemd/system/"+unit]);
  }
  sudo("systemctl",["daemon-reload"]);
  const cleanup=sudo("rm",["-rf","--",root,stage,runDir,brokerMarker,gateMarker]);
  if(cleanup.status!==0) {
    console.error("F03_INSTALLER_CLEANUP_FAILED",cleanup.stderr);
    process.exitCode=1;
  }
  await rm(tmp,{recursive:true,force:true});
}
