/**
 * Test the actual root-owned deployment artifact, not a hand-made fixture.
 * Separate from the MCP approval authority; installer never grants root
 * privileges to an untrusted agent or broadens the broker's socket mode.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const id = "test-" + randomBytes(7).toString("hex");
assert.match(id, /^test-[a-f0-9]{14}$/);
const root = "/var/lib/buccet-native/" + id;
const socket = path.join(root, "broker.sock");
const guard = path.join(root, "box-fs-guard");
const broker = path.join(root, "broker.mjs");
const controller = path.join(root, "policy-controller.mjs");
const policyFile = path.join(root, "policy.json");
const localPolicy = path.join(os.tmpdir(), "buccet-policy-" + id + ".json");
const installerStage = "/var/lib/buccet-native-installer-test-" + id;
const provision = path.join(installerStage, "provision.sh");
const sourceProvision = path.join(repo, "scripts/provision-native-broker.sh");
const nativeGuard = path.join(repo, "native/build/box-fs-guard");
const sourceBroker = path.join(repo, "native/box-fs-broker.mjs");
const sourceController = path.join(repo, "native/box-fs-policy-controller.mjs");
const env = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG:"C" };
function run(cmd, args, input = "") {
  const r = spawnSync(cmd, args, {encoding:"utf8", env, input, timeout:25000});
  assert.equal(r.error, undefined, r.error?.message);
  return r;
}
function required(cmd, args) {
  const r = run(cmd,args);
  assert.equal(r.status,0, r.stderr + r.stdout);
  return r.stdout.trim();
}
function sudo(cmd, args) { return required("sudo", ["-n",cmd,...args]); }
const digest = async pathname => createHash("sha256")
  .update(await readFile(pathname)).digest("hex");
const guardHash = await digest(nativeGuard);
const brokerHash = await digest(sourceBroker);
const controllerHash = await digest(sourceController);
const args = [provision,id,nativeGuard,sourceBroker,guardHash,brokerHash,"--files-only"];
let server;
try {
  // Privileged installer is installed from the reviewed checkout into a
  // protected, root-owned staging tree BEFORE being invoked as root.
  sudo("install", ["-d", "-o", "root", "-g", "root", "-m", "0700", installerStage]);
  sudo("install", ["-o", "root", "-g", "root", "-m", "0500",
    sourceProvision, provision]);
  // CI runner's hosted Node toolcache is not an appropriate root service
  // interpreter. Place this test-only Node binary into the protected root
  // installer stage; the production installer rejects writable toolchains.
  const trustedNode = path.join(installerStage, "node");
  sudo("install", ["-o", "root", "-g", "root", "-m", "0500",
    process.execPath, trustedNode]);
  const nodeEnv = "BUCCET_BROKER_NODE=" + trustedNode;
  const controllerEnv = "BUCCET_POLICY_CONTROLLER_SRC=" + sourceController;
  const digestEnv = "BUCCET_POLICY_CONTROLLER_SHA256=" + controllerHash;
  const bad = run("sudo", ["-n","env",nodeEnv,controllerEnv,digestEnv,
    "sh",provision,id,nativeGuard,sourceBroker,"0".repeat(64),brokerHash,"--files-only"]);
  assert.notEqual(bad.status,0,"tampered artifact digest did not stop installation");
  const noPrivilege = run("sudo", ["-n","setpriv","--reuid=65534","--regid=65534",
    "--clear-groups","env",nodeEnv,controllerEnv,digestEnv,"sh",...args]);
  assert.notEqual(noPrivilege.status,0,"untrusted user managed to provision broker");
  assert.match(sudo("env",[nodeEnv,controllerEnv,digestEnv,"sh",...args]),/BUCCET_PROVISIONED_FILES_ONLY/);
  assert.equal(sudo("stat",["-c","%u:%a",root]),"0:700");
  assert.equal(sudo("stat",["-c","%u:%a",guard]),"0:500");
  assert.equal(sudo("stat",["-c","%u:%a",broker]),"0:400");
  assert.equal(sudo("stat",["-c","%u:%a",controller]),"0:400");
  assert.equal(sudo("stat",["-c","%u:%a",policyFile]),"0:400");
  assert.equal(sudo("sha256sum",[guard]).split(" ")[0],guardHash);
  assert.equal(sudo("sha256sum",[broker]).split(" ")[0],brokerHash);
  assert.equal(sudo("sha256sum",[controller]).split(" ")[0],controllerHash);

  server = spawn("sudo",["-n",process.execPath,broker,root,guard,socket],
    { stdio:["ignore","pipe","pipe"],env });
  let logs="";
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error("installed broker startup timeout: "+logs)),10000);
    server.stdout.on("data",chunk=>{
      logs+=String(chunk);
      if(logs.includes("BUCCET_PROTECTED_BROKER_READY")){
        clearTimeout(timeout);resolve();
      }
    });
    server.stderr.on("data",chunk=>{logs+=String(chunk);});
    server.once("exit",code=>{clearTimeout(timeout);reject(Error("broker exited "+code+": "+logs));});
  });
  assert.equal(sudo("stat",["-c","%u:%a",socket]),"0:600");
  // The installed controller must NOT accept a caller-invented grant.
  // The root-owned policy starts with allowed: [] until a trusted operator
  // explicitly approves paths under this managed root.
  const policyRequest=(op,pathname,contentOrDestination)=> {
    const argv=["-n",trustedNode,controller,root,op,pathname];
    if(op==="move")argv.push(contentOrDestination);
    return run("sudo",argv,
      op==="write"||op==="append"?contentOrDestination??"":"");
  };
  assert.notEqual(policyRequest("write","inner/sentinel.txt","DENIED").status,0,
    "default-deny root policy unexpectedly permitted a write");
  const reviewedPolicy = {
    schema:1,root,
    allowed:["mkdir","write","append","read","move"].map(op=>({op,prefix:"inner"})),
  };
  await writeFile(localPolicy,JSON.stringify(reviewedPolicy));
  sudo("install",["-o","root","-g","root","-m","0400",localPolicy,policyFile]);
  await rm(localPolicy,{force:true});
  const trusted=(op,pathname,contentOrDestination)=> {
    const result=policyRequest(op,pathname,contentOrDestination);
    assert.equal(result.status,0,
      "independent policy controller rejected authorized "+op+": "+result.stderr);
    return result.stdout.trim();
  };
  trusted("mkdir","inner");
  trusted("write","inner/sentinel.txt","AUTHORIZED|");
  trusted("append","inner/sentinel.txt","APPEND");
  assert.equal(trusted("read","inner/sentinel.txt"),"AUTHORIZED|APPEND");
  trusted("move","inner/sentinel.txt","inner/result.txt");
  assert.equal(trusted("read","inner/result.txt"),"AUTHORIZED|APPEND");
  assert.notEqual(policyRequest("write","other/ungranted.txt","DENIED").status,0,
    "controller accepted an unapproved destination");
  assert.notEqual(policyRequest("move","inner/result.txt","outside-move.txt").status,0,
    "controller failed to require BOTH move endpoints to be approved");
  assert.equal(trusted("read","inner/result.txt"),"AUTHORIZED|APPEND");

  const hostile = [
    'const fs=require("node:fs"),net=require("node:net");',
    'try{fs.writeFileSync(process.argv[1],"ATTACK");process.exit(41)}',
    'catch(e){if(!["EPERM","EACCES"].includes(e.code))throw e;}',
    'const s=net.connect(process.argv[2]);',
    's.on("connect",()=>process.exit(42));',
    's.on("error",e=>{if(!["EPERM","EACCES"].includes(e.code))throw e;',
    'console.log("INSTALLED_BROKER_AGENT_DENIED")});',
  ].join("");
  const attempt=run("sudo",["-n","setpriv","--reuid=65534","--regid=65534",
    "--clear-groups",process.execPath,"-e",hostile,
    path.join(root,"inner/result.txt"),socket]);
  assert.equal(attempt.status,0,attempt.stderr+attempt.stdout);
  assert.match(attempt.stdout,/INSTALLED_BROKER_AGENT_DENIED/);
  assert.equal(trusted("read","inner/result.txt"),"AUTHORIZED|APPEND");
  console.log("NATIVE_DEPLOYMENT_PASS",JSON.stringify({
    verifiedSHA256:true,rootOwnedInstalledCode:true,rootOnlyBrokerSocket:true,
    unprivilegedInstallerDenied:true,untrustedAgentDenied:true,
    legitimateReadWriteAppendMove:true,manualFilesOnlyFixture:true,
    independentPolicyControllerVerified:true,
    defaultDenyUntilOperatorPolicy:true,
    outsideGrantAndMoveDestinationRejected:true,
    automatedHostIntegrationStillRequired:true,
  }));
} finally {
  if(server&&server.exitCode===null){
    server.kill("SIGTERM");
    await Promise.race([new Promise(r=>server.once("close",r)),
      new Promise(r=>setTimeout(r,3000))]);
  }
  // Only the randomized instance rooted under /var/lib/buccet-native.
  await rm(localPolicy,{force:true});
  const cleanup=run("sudo",["-n","rm","-rf","--",root,installerStage]);
  if(cleanup.status!==0){
    console.error("BUCCET_DEPLOYMENT_TEST_CLEANUP_FAILED",cleanup.stderr);
    process.exitCode=1;
  }
}
