/**
 * Test the actual root-owned deployment artifact, not a hand-made fixture.
 * Separate from the MCP approval authority; installer never grants root
 * privileges to an untrusted agent or broadens the broker's socket mode.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const id = "test-" + randomBytes(7).toString("hex");
assert.match(id, /^test-[a-f0-9]{14}$/);
const root = "/var/lib/buccet-native/" + id;
const socket = path.join(root, "broker.sock");
const guard = path.join(root, "box-fs-guard");
const broker = path.join(root, "broker.mjs");
const provision = path.join(repo, "scripts/provision-native-broker.sh");
const nativeGuard = path.join(repo, "native/build/box-fs-guard");
const sourceBroker = path.join(repo, "native/box-fs-broker.mjs");
const client = path.join(repo, "native/box-fs-broker-client.mjs");
const env = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG:"C" };
function run(cmd, args) {
  const r = spawnSync(cmd, args, {encoding:"utf8", env, timeout:25000});
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
const args = [provision,id,nativeGuard,sourceBroker,guardHash,brokerHash,"--files-only"];
let server;
try {
  const bad = run("sudo", ["-n","sh",provision,id,nativeGuard,sourceBroker,"0".repeat(64),brokerHash,"--files-only"]);
  assert.notEqual(bad.status,0,"tampered artifact digest did not stop installation");
  const noPrivilege = run("sudo", ["-n","setpriv","--reuid=65534","--regid=65534",
    "--clear-groups","sh",...args]);
  assert.notEqual(noPrivilege.status,0,"untrusted user managed to provision broker");
  assert.match(sudo("sh",args),/BUCCET_PROVISIONED_FILES_ONLY/);
  assert.equal(sudo("stat",["-c","%u:%a",root]),"0:700");
  assert.equal(sudo("stat",["-c","%u:%a",guard]),"0:500");
  assert.equal(sudo("stat",["-c","%u:%a",broker]),"0:400");
  assert.equal(sudo("sha256sum",[guard]).split(" ")[0],guardHash);
  assert.equal(sudo("sha256sum",[broker]).split(" ")[0],brokerHash);

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
  const trusted=(op,pathname,content)=> {
    const argv=["-n",process.execPath,client,socket,op,pathname];
    if(content!==undefined)argv.push(content);
    return required("sudo",argv).trim();
  };
  trusted("mkdir","inner");
  trusted("write","inner/sentinel.txt","AUTHORIZED|");
  trusted("append","inner/sentinel.txt","APPEND");
  assert.equal(trusted("read","inner/sentinel.txt"),"AUTHORIZED|APPEND");
  trusted("move","inner/sentinel.txt","inner/result.txt");
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
    trustedPolicyControllerStillRequired:true,
  }));
} finally {
  if(server&&server.exitCode===null){
    server.kill("SIGTERM");
    await Promise.race([new Promise(r=>server.once("close",r)),
      new Promise(r=>setTimeout(r,3000))]);
  }
  // Only the randomized instance rooted under /var/lib/buccet-native.
  const cleanup=run("sudo",["-n","rm","-rf","--",root]);
  if(cleanup.status!==0){
    console.error("BUCCET_DEPLOYMENT_TEST_CLEANUP_FAILED",cleanup.stderr);
    process.exitCode=1;
  }
}
