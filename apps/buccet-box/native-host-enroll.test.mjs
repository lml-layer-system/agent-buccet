/**
 * Privileged host credential issuance and revocation: no secrets on the
 * command line, no agent-owned registry, OS-protected credentials by UID,
 * no replayed enrollment, and revocation removes root-side authority.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

assert.equal(process.platform,"linux");
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const suffix=randomBytes(7).toString("hex");
const root="/var/lib/buccet-host-enrollment-"+suffix;
const staging="/var/lib/buccet-host-stage-"+suffix;
const nodeBinary=staging+"/node";
const adminTool=staging+"/host-enroll.mjs";
const registry=root+"/host-identities.json";
const sessionId="registeredhost_"+suffix;
const actorId="operatorhost_"+suffix;
const uid=45001;
const proof="/run/buccet-native-host-credentials/"+path.basename(root)+"/"+sessionId+".key";
const local=await mkdtemp(path.join(os.tmpdir(),"buccet-host-enroll-"));
const env={PATH:"/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",LANG:"C"};
function run(cmd,args) {
  const r=spawnSync(cmd,args,{encoding:"utf8",timeout:20000,env});
  assert.equal(r.error,undefined,r.error?.message);
  return r;
}
function sudo(cmd,args) { return run("sudo",["-n",cmd,...args]); }
function required(cmd,args) {
  const r=sudo(cmd,args);
  assert.equal(r.status,0,r.stderr+r.stdout);
  return r.stdout.trim();
}
const enrollment=(action,sid=sessionId,actor=actorId,targetUid=uid)=>{
  const args=[nodeBinary,adminTool,root,action,sid,actor];
  if(action==="enroll")args.push(String(targetUid));
  return sudo(args[0],args.slice(1));
};
try {
  required("install",["-d","-o","root","-g","root","-m","0700",root,staging]);
  required("install",["-o","root","-g","root","-m","0500",
    process.execPath,nodeBinary]);
  required("install",["-o","root","-g","root","-m","0400",
    path.join(repo,"native/box-fs-host-enroll.mjs"),adminTool]);
  const config=path.join(local,"host-identities.json");
  await writeFile(config,JSON.stringify({schema:1,root,allowed:[]})+"\n");
  required("install",["-o","root","-g","root","-m","0400",config,registry]);
  const deniedUnpriv=run("sudo",["-n","setpriv","--reuid=65534",
    "--regid=65534","--clear-groups",
    nodeBinary,adminTool,root,"enroll",sessionId,actorId,String(uid)]);
  assert.notEqual(deniedUnpriv.status,0,
    "unprivileged caller issued a root-trusted host identity");
  const invalidUid=enrollment("enroll",sessionId,actorId,65534);
  assert.notEqual(invalidUid.status,0,
    "untrusted nobody UID was accepted as independent host principal");

  const issued=enrollment("enroll");
  assert.equal(issued.status,0,issued.stderr+issued.stdout);
  assert.match(issued.stdout,/BUCCET_HOST_ENROLLED/);
  const registryJson=JSON.parse(required("cat",[registry]));
  assert.equal(registryJson.allowed.length,1);
  const stored=registryJson.allowed[0];
  assert.equal(stored.sessionId,sessionId);
  assert.equal(stored.actorId,actorId);
  assert.match(stored.secretHex,/^[a-f0-9]{64}$/);
  assert.equal(issued.stdout.includes(stored.secretHex),false,
    "issuer printed a privileged session secret");
  assert.equal(required("stat",["-c","%u:%a",registry]),"0:400");
  assert.equal(required("stat",["-c","%u:%a",proof]),String(uid)+":400");
  const hostRead=sudo("setpriv",[
    "--reuid="+uid,"--regid="+uid,"--clear-groups","cat",proof]);
  assert.equal(hostRead.status,0,"registered host cannot read its proof");
  assert.equal(hostRead.stdout.trim(),stored.secretHex);
  const hostileRead=sudo("setpriv",[
    "--reuid=65534","--regid=65534","--clear-groups","cat",proof]);
  assert.notEqual(hostileRead.status,0,
    "untrusted OS principal could steal trusted host proof");
  const repeat=enrollment("enroll");
  assert.notEqual(repeat.status,0,"duplicate host enrollment overwrote proof");
  const after=JSON.parse(required("cat",[registry]));
  assert.equal(after.allowed.length,1);
  assert.equal(after.allowed[0].secretHex,stored.secretHex);

  const revoked=enrollment("revoke");
  assert.equal(revoked.status,0,revoked.stderr+revoked.stdout);
  assert.match(revoked.stdout,/BUCCET_HOST_REVOKED/);
  assert.deepEqual(JSON.parse(required("cat",[registry])).allowed,[]);
  assert.notEqual(sudo("test",["-e",proof]).status,0,
    "revoked host retained its privileged proof file");
  assert.notEqual(enrollment("revoke").status,0,
    "revocation unexpectedly succeeded twice");
  console.log("HOST_REGISTRATION_ROOT_PROOF_PASS",JSON.stringify({
    independentRootIssuer:true,rootOnlyRegistry:true,
    dedicatedOSHostPrincipal:true,otherUIDCredentialTheftDenied:true,
    duplicateEnrollmentDenied:true,secretNotPrinted:true,
    revocationInvalidatesRootRegistry:true,issuerRunsFromRootProtectedCode:true,
  }));
} finally {
  const cleanup=sudo("rm",["-rf","--",root,staging,
    "/run/buccet-native-host-credentials/"+path.basename(root)]);
  if(cleanup.status!==0){
    console.error("HOST_ENROLL_TEST_CLEANUP_FAILED",cleanup.stderr);
    process.exitCode=1;
  }
  await rm(local,{force:true,recursive:true});
}
