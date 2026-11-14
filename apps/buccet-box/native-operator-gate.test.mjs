/**
 * Real OS-principal integration: unprivileged client calls the REAL Buccet
 * executeScopedFileTool entrypoint, but only the independent privileged
 * operator may authorize exact content and target over its root-only socket.
 * Root broker rechecks a separate immutable operator path policy.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nonce = randomBytes(9).toString("hex");
const managed = "/var/lib/buccet-gated-" + nonce;
const runtimeDir = "/run/buccet-gated-" + nonce;
const privateSock = managed + "/broker.sock";
const publicSock = runtimeDir + "/request.sock";
const operatorSock = runtimeDir + "/operator.sock";
const guard = managed + "/box-fs-guard";
const policy = managed + "/policy.json";
const local = await mkdtemp(path.join(os.tmpdir(), "buccet-gated-test-"));
const clientRoot = "/var/lib/buccet-gated-client-" + nonce;
const source = path.join(clientRoot, "src/box/confined-fs.ts");
const brokerCode = path.join(repo, "native/box-fs-broker.mjs");
const gateCode = path.join(repo, "native/box-fs-approval-gate.mjs");
const env = { PATH:"/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG:"C" };
const serverProcesses = [];
let latestAgent = null;
function run(cmd, args, input="") {
  const result = spawnSync(cmd, args, { input, encoding:"utf8", timeout: 25000, env });
  assert.equal(result.error, undefined, result.error?.message);
  return result;
}
function required(cmd, args, input="") {
  const result = run(cmd,args,input);
  assert.equal(result.status,0,"command failed: "+result.stderr+result.stdout);
  return result.stdout.trim();
}
const sudo=(cmd,args)=>required("sudo",["-n",cmd,...args]);
function launched(cmd,args) {
  const child=spawn(cmd,args,{env,stdio:["ignore","pipe","pipe"]});
  serverProcesses.push(child);
  let log="";
  child.stdout.on("data",chunk=>{log+=String(chunk);});
  child.stderr.on("data",chunk=>{log+=String(chunk);});
  return { child, log:()=>log };
}
async function ready(process, marker) {
  for(let n=0;n<800;n++){
    if(process.log().includes(marker))return;
    if(process.child.exitCode!==null)throw Error("service exited: "+process.log());
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw Error("service not ready: "+process.log());
}
const operatorCode=[
  'const net=require("node:net");',
  'const socket=net.connect(process.argv[1]);',
  'let reply="";',
  'socket.on("connect",()=>socket.write(process.argv[2]+"\\n"));',
  'socket.on("data",chunk=>reply+=chunk);',
  'socket.on("end",()=>process.stdout.write(reply));',
  'socket.on("error",err=>{console.error(err.code||err.message);process.exitCode=73});',
].join("");
function operator(command, privileged=true) {
  const commandArgs = [process.execPath,"-e",operatorCode,operatorSock,JSON.stringify(command)];
  const args=privileged
    ? ["-n",...commandArgs]
    : ["-n","setpriv","--reuid=65534","--regid=65534","--clear-groups",...commandArgs];
  const result=run("sudo",args);
  if(!privileged)return result;
  assert.equal(result.status,0,"root operator request failed: "+result.stderr);
  return JSON.parse(result.stdout);
}
function agent(tool,args){
  const clientSource=[
    'const {executeScopedFileTool}=await import(process.argv[1]);',
    'const request=JSON.parse(process.argv[2]);',
    'const root=process.env.AGENT_BUCCET_FS_BROKER_ROOT;',
    'const laws=[{lawId:"TEST.TRUSTED.HOST",rootPath:root,',
    ' grantedActions:["fs.read","fs.write","fs.append","fs.delete","fs.mkdir","fs.move"]}];',
    'try{const output=await executeScopedFileTool(request.tool,request.args,laws);',
    ' console.log(JSON.stringify({ok:true,output}));}',
    'catch(error){console.log(JSON.stringify({ok:false,error:String(error.message)}));process.exitCode=73;}',
  ].join("");
  const argv=[
    "-n","setpriv","--reuid=65534","--regid=65534","--clear-groups",
    "env",
    "AGENT_BUCCET_REQUIRE_ISOLATED_FS=1",
    "AGENT_BUCCET_FS_BROKER_ROOT="+managed,
    "AGENT_BUCCET_FS_REQUEST_SOCKET="+publicSock,
    process.execPath,"--input-type=module","-e",clientSource,source,
    JSON.stringify({tool,args}),
  ];
  const child=spawn("sudo",argv,{stdio:["ignore","pipe","pipe"],env});
  let stdout="",stderr="";
  child.stdout.on("data",chunk=>{stdout+=String(chunk);});
  child.stderr.on("data",chunk=>{stderr+=String(chunk);});
  const finished=new Promise((resolve,reject)=>{
    child.on("error",reject);
    child.on("close",code=>resolve({code,stdout,stderr}));
  });
  const result={child,finished,snapshot:()=>({stdout,stderr,exitCode:child.exitCode})};
  latestAgent=result;
  return result;
}
async function waitPending(count=1){
  for(let n=0;n<500;n++){
    const list=operator({command:"list"});
    if(list.ok&&list.pending.length===count)return list.pending;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw Error("root operator did not receive exact pending proposal; agent="+
    JSON.stringify(latestAgent?.snapshot()) + "; server="+
    JSON.stringify(serverProcesses.map(child=>({pid:child.pid,exitCode:child.exitCode}))));
}
async function awaitAgent(agentResult){
  const result=await agentResult.finished;
  assert.ok(result.stdout,"no agent response: "+result.stderr);
  return {code:result.code,...JSON.parse(result.stdout.trim())};
}
try {
  sudo("install",["-d","-o","root","-g","root","-m","0700",managed]);
  sudo("install",["-d","-o","root","-g","root","-m","0755",runtimeDir]);
  // The CI checkout lives under runner-private /home, which cannot be read
  // by an untrusted UID. Install the EXACT real scoped executor modules into
  // a root-owned read-only fixture accessible to that UID without granting
  // it write access to its own trusted source code.
  sudo("install",["-d","-o","root","-g","root","-m","0755",
    clientRoot,path.join(clientRoot,"src"),path.join(clientRoot,"src/box")]);
  for(const module of [
    "confined-fs.ts","protected-fs-broker.ts","protected-fs-gate.ts"
  ]){
    sudo("install",["-o","root","-g","root","-m","0644",
      path.join(repo,"src/box",module),path.join(clientRoot,"src/box",module)]);
  }
  sudo("install",["-o","root","-g","root","-m","0500",
    path.join(repo,"native/build/box-fs-guard"),guard]);
  const localPolicy=path.join(local,"policy.json");
  await writeFile(localPolicy,JSON.stringify({
    schema:1,root:managed,
    allowed:[
      {op:"mkdir",prefix:"allowed"},
      {op:"write",prefix:"allowed"},
      {op:"append",prefix:"allowed"},
      {op:"read",prefix:"allowed"},
      {op:"move",prefix:"allowed"},
    ],
  }));
  sudo("install",["-o","root","-g","root","-m","0400",localPolicy,policy]);
  const broker=launched("sudo",["-n",process.execPath,brokerCode,managed,guard,privateSock]);
  await ready(broker,"BUCCET_PROTECTED_BROKER_READY");
  const gate=launched("sudo",["-n",process.execPath,gateCode,managed,privateSock,publicSock,operatorSock]);
  await ready(gate,"BUCCET_APPROVAL_GATE_READY");
  assert.equal(sudo("stat",["-c","%u:%a",publicSock]),"0:666");
  assert.equal(sudo("stat",["-c","%u:%a",operatorSock]),"0:600");
  assert.equal(sudo("stat",["-c","%u:%a",privateSock]),"0:600");

  // The untrusted agent may submit an approval request, but cannot create
  // any effect before the independently privileged operator decides.
  const first=agent("make_directory",{path:managed+"/allowed"});
  let [item]=await waitPending();
  assert.equal(item.op,"mkdir");
  assert.equal(item.path,"allowed");
  assert.notEqual(operator({command:"approve",requestId:item.requestId,sha256:item.sha256},false).status,0,
    "untrusted agent somehow accessed the operator-only socket");
  assert.equal(operator({command:"approve",requestId:item.requestId,sha256:"0".repeat(64)}).ok,false,
    "wrong digest must never approve an operation");
  assert.equal(operator({command:"list"}).pending.length,1);
  assert.equal(operator({command:"approve",requestId:item.requestId,sha256:item.sha256}).approved,true);
  const firstReply=await awaitAgent(first);
  assert.equal(firstReply.ok,true,JSON.stringify(firstReply));
  assert.equal(operator({command:"approve",requestId:item.requestId,sha256:item.sha256}).ok,false,
    "approved request replay was possible");

  // Write is held at the gate. A replaced payload cannot inherit approval
  // because operator digest covers the exact original request.
  const write=agent("write_file",{path:managed+"/allowed/file.txt",content:"APPROVED_CONTENT"});
  [item]=await waitPending();
  assert.equal(item.path,"allowed/file.txt");
  assert.equal(item.bytes,Buffer.byteLength("APPROVED_CONTENT"));
  assert.equal(operator({command:"approve",requestId:item.requestId,sha256:item.sha256.slice(1)+"0"}).ok,false);
  assert.equal(operator({command:"approve",requestId:item.requestId,sha256:item.sha256}).approved,true);
  const writeReply=await awaitAgent(write);
  assert.equal(writeReply.ok,true,JSON.stringify(writeReply));

  const read=agent("read_file",{path:managed+"/allowed/file.txt"});
  [item]=await waitPending();
  assert.equal(operator({command:"approve",requestId:item.requestId,sha256:item.sha256}).approved,true);
  const readAnswer=await awaitAgent(read);
  assert.equal(readAnswer.ok,true,JSON.stringify(readAnswer));
  assert.equal(readAnswer.output,"APPROVED_CONTENT");

  // Operator approval cannot override independent root-owned broker policy.
  const outside=agent("write_file",{path:managed+"/forbidden.txt",content:"NEVER_EXECUTE"});
  [item]=await waitPending();
  assert.equal(item.path,"forbidden.txt");
  assert.equal(operator({command:"approve",requestId:item.requestId,sha256:item.sha256}).approved,true);
  const outsideReply=await awaitAgent(outside);
  assert.equal(outsideReply.ok,false,"operator approval bypassed protected root policy");
  const probe=run("sudo",["-n","test","-e",managed+"/forbidden.txt"]);
  assert.notEqual(probe.status,0,"out-of-policy filesystem consequence happened");

  // Denial at independent operator channel does not permit a write.
  const denied=agent("write_file",{path:managed+"/allowed/denied.txt",content:"UNAPPROVED"});
  [item]=await waitPending();
  assert.equal(operator({command:"deny",requestId:item.requestId,sha256:item.sha256}).denied,true);
  assert.equal((await awaitAgent(denied)).ok,false);
  assert.notEqual(run("sudo",["-n","test","-e",managed+"/allowed/denied.txt"]).status,0);

  // A disconnected client leaves no actionable request for later approval.
  const abandoned=agent("write_file",{path:managed+"/allowed/abandoned.txt",content:"ABANDONED"});
  [item]=await waitPending();
  abandoned.child.kill("SIGTERM");
  await abandoned.finished;
  await waitPending(0);
  assert.equal(operator({command:"approve",requestId:item.requestId,sha256:item.sha256}).ok,false);
  assert.notEqual(run("sudo",["-n","test","-e",managed+"/allowed/abandoned.txt"]).status,0);

  console.log("FS_MCP_OPERATOR_GATE_PASS",JSON.stringify({
    actualScopedExecutor:true,unprivilegedAgentUid:65534,privilegedBrokerUid:0,
    operatorSocketUnreachableToAgent:true,
    exactRequestDigestBound:true,incorrectDigestRejected:true,
    disconnectedRequestCancelled:true,approvalReplayDenied:true,
    operatorDenialBlocksEffect:true,independentRootPolicyRechecked:true,
    permittedWriteAndReadExecuted:true,
    BoxApprovalRemainsAdditionalUntrustedUserSideGate:true,
  }));
} finally {
  for(const server of serverProcesses.reverse()){
    if(server.exitCode===null){
      server.kill("SIGTERM");
      await Promise.race([
        new Promise(resolve=>server.once("close",resolve)),
        new Promise(resolve=>setTimeout(resolve,2000)),
      ]);
    }
  }
  const clean=run("sudo",["-n","rm","-rf","--",managed,runtimeDir,clientRoot]);
  if(clean.status!==0){console.error("FS_GATE_CLEANUP_FAILED",clean.stderr);process.exitCode=1;}
  await rm(local,{force:true,recursive:true});
}
