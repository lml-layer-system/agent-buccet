/**
 * Production operator-gate deployment acceptance: code hash pinning, strict
 * root-only reviewer, public request namespace, non-writable host code, and
 * refusal to let unprivileged callers install or overwrite privileged code.
 *
 * Files-only mode avoids modifying GitHub runners' persistent systemd units.
 * The actual gate and real effects are exercised by native-operator-gate.test.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform,"linux");
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const id="test-"+randomBytes(6).toString("hex");
const managed="/var/lib/buccet-native/"+id;
const runtime="/run/buccet-native-gates/"+id;
const stage="/var/lib/buccet-gate-installer-"+id;
const installer=stage+"/install.sh";
const nodeBinary=stage+"/node";
const gateSrc=path.join(repo,"native/box-fs-approval-gate.mjs");
const reviewSrc=path.join(repo,"native/box-fs-operator-review.mjs");
const guardSrc=path.join(repo,"native/build/box-fs-guard");
const brokerSrc=path.join(repo,"native/box-fs-broker.mjs");
const controllerSrc=path.join(repo,"native/box-fs-policy-controller.mjs");
const sourceInstaller=path.join(repo,"scripts/provision-native-operator-gate.sh");
const env={PATH:"/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",LANG:"C"};
function run(cmd,args) {
  const result=spawnSync(cmd,args,{encoding:"utf8",env,timeout:24000});
  assert.equal(result.error,undefined,result.error?.message);
  return result;
}
function required(cmd,args){
  const result=run(cmd,args);
  assert.equal(result.status,0,result.stderr+result.stdout);
  return result.stdout.trim();
}
const sudo=(cmd,args)=>required("sudo",["-n",cmd,...args]);
const digest=async file=>createHash("sha256").update(await readFile(file)).digest("hex");
try{
  sudo("install",["-d","-o","root","-g","root","-m","0700",managed,stage]);
  sudo("install",["-o","root","-g","root","-m","0500",sourceInstaller,installer]);
  sudo("install",["-o","root","-g","root","-m","0500",process.execPath,nodeBinary]);
  for(const [src,dst,mode] of [
    [guardSrc,managed+"/box-fs-guard","0500"],
    [brokerSrc,managed+"/broker.mjs","0400"],
    [controllerSrc,managed+"/policy-controller.mjs","0400"],
  ]){
    sudo("install",["-o","root","-g","root","-m",mode,src,dst]);
  }
  const policySrc=stage+"/policy.json";
  // Installer only reads metadata, but the policy is installed with root-only
  // provenance as it would be by the native broker deployment installer.
  sudo("sh",["-c",
    "printf '%s\\n' '{\"schema\":1,\"root\":\""+managed+"\",\"allowed\":[]}' > "+
    policySrc+" && chmod 0400 "+policySrc]);
  sudo("install",["-o","root","-g","root","-m","0400",policySrc,managed+"/policy.json"]);
  const gateHash=await digest(gateSrc);
  const reviewerHash=await digest(reviewSrc);
  const requestArgs=[installer,id,gateSrc,gateHash,reviewSrc,reviewerHash,"--files-only"];
  const nodeEnv="BUCCET_BROKER_NODE="+nodeBinary;
  const wrong=run("sudo",["-n","env",nodeEnv,"sh",installer,id,
    gateSrc,"0".repeat(64),reviewSrc,reviewerHash,"--files-only"]);
  assert.notEqual(wrong.status,0,"tampered protected gate passed hash verification");
  const untrusted=run("sudo",["-n","setpriv","--reuid=65534","--regid=65534",
    "--clear-groups","env",nodeEnv,"sh",...requestArgs]);
  assert.notEqual(untrusted.status,0,"agent installed privileged approval gate");
  assert.match(sudo("env",[nodeEnv,"sh",...requestArgs]),/BUCCET_GATE_PROVISIONED_FILES_ONLY/);
  assert.equal(sudo("stat",["-c","%u:%a",managed+"/approval-gate.mjs"]),"0:400");
  assert.equal(sudo("stat",["-c","%u:%a",managed+"/operator-review.mjs"]),"0:400");
  assert.equal(sudo("stat",["-c","%u:%a",managed+"/host-identities.json"]),"0:400");
  const emptyHosts=JSON.parse(sudo("cat",[managed+"/host-identities.json"]));
  assert.equal(emptyHosts.root,managed);
  assert.deepEqual(emptyHosts.allowed,[],
    "privileged installer must never trust caller-supplied actor grants");
  assert.equal(sudo("stat",["-c","%u:%a",runtime]),"0:755");
  assert.equal(sudo("sha256sum",[managed+"/approval-gate.mjs"]).split(" ")[0],gateHash);
  assert.equal(sudo("sha256sum",[managed+"/operator-review.mjs"]).split(" ")[0],reviewerHash);
  const repeat=run("sudo",["-n","env",nodeEnv,"sh",...requestArgs]);
  assert.notEqual(repeat.status,0,"privileged gate code was overwritten on repeat install");
  const agent=run("sudo",["-n","setpriv","--reuid=65534",
    "--regid=65534","--clear-groups","test","-r",managed+"/operator-review.mjs"]);
  assert.notEqual(agent.status,0,"untrusted user read the privileged reviewer");
  console.log("NATIVE_OPERATOR_INSTALL_PASS",JSON.stringify({
    codeSHA256Pinned:true,untrustedInstallerDenied:true,
    privilegeOwnerRootOnly:true,exactOperatorReviewerRootOnly:true,
    reviewCodeNotReadableByAgent:true,rootControlledPublicRequestDirectory:true,
    refusedOverwrite:true,activationNotPerformedInCI:true,
  }));
}finally{
  const cleaned=run("sudo",["-n","rm","-rf","--",managed,stage,runtime]);
  if(cleaned.status!==0){
    console.error("NATIVE_OPERATOR_INSTALL_CLEANUP_FAILED",cleaned.stderr);
    process.exitCode=1;
  }
}
