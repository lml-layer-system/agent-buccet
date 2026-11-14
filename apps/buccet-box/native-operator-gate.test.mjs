/**
 * Real OS-principal integration: unprivileged client calls the REAL Buccet
 * executeScopedFileTool entrypoint, but only the independent privileged
 * operator may authorize exact content and target over its root-only socket.
 * Root broker rechecks a separate immutable operator path policy.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import readline from "node:readline";
import { createBuccetBoxBackend } from "./backend.mjs";
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
const brokerCode = path.join(managed,"broker.mjs");
const gateCode = path.join(managed,"approval-gate.mjs");
const reviewerCode = path.join(managed,"operator-review.mjs");
const env = { PATH:"/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG:"C" };
const serverProcesses = [];
let latestAgent = null, boxServer = null, mcpProcess = null, spoofProcess = null;
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
function mcpTransport(child) {
  const waiting = new Map();
  const errors = [];
  let counter = 0;
  child.stderr.on("data", chunk => errors.push(String(chunk).slice(-1000)));
  readline.createInterface({ input: child.stdout }).on("line", line => {
    try {
      const msg = JSON.parse(line);
      const waiter = waiting.get(msg.id);
      if (waiter) {
        clearTimeout(waiter.timer);
        waiting.delete(msg.id);
        waiter.resolve(msg);
      }
    } catch { errors.push("malformed MCP line"); }
  });
  child.once("exit", code => {
    for(const [id, waiter] of waiting) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error("MCP exited " + code + ": " + errors.slice(-3).join(" ")));
      waiting.delete(id);
    }
  });
  return {
    errors,
    request(method, params, timeoutMs = 30000) {
      const id = ++counter;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          waiting.delete(id);
          reject(new Error("MCP request timeout " + method + " errors=" + errors.slice(-3).join(" ")));
        }, timeoutMs);
        waiting.set(id, { resolve, reject, timer });
        child.stdin.write(JSON.stringify({jsonrpc:"2.0",id,method,params}) + "\n");
      });
    },
    call(name, args) {
      return this.request("tools/call", { name, arguments: args });
    },
  };
}
async function waitBox(box, label) {
  for (let n=0;n<800;n++) {
    const first=box.state().pending[0];
    if (first) return first;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error("missing real Box approval prompt for " + label);
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
    "confined-fs.ts","protected-fs-broker.ts","protected-fs-gate.ts",
    "host-attestation.ts"
  ]){
    sudo("install",["-o","root","-g","root","-m","0644",
      path.join(repo,"src/box",module),path.join(clientRoot,"src/box",module)]);
  }
  sudo("install",["-o","root","-g","root","-m","0500",
    path.join(repo,"native/build/box-fs-guard"),guard]);
  for(const [name,location] of [
    ["box-fs-broker.mjs",brokerCode],
    ["box-fs-approval-gate.mjs",gateCode],
    ["box-fs-operator-review.mjs",reviewerCode],
  ]){
    const src=path.join(repo,"native",name);
    sudo("install",["-o","root","-g","root","-m","0400",src,location]);
    const originalHash=createHash("sha256").update(await readFile(src)).digest("hex");
    const installedHash=sudo("sha256sum",[location]).split(" ")[0];
    assert.equal(installedHash,originalHash,"privileged code differs from verified source");
  }
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
  // Legacy raw-API positive controls explicitly opt into unbound-host mode.
  // The production installer creates an independently protected registry;
  // subsequent MCP tests below enforce it and reject unregistered clients.
  const gate=launched("sudo",["-n","env","BUCCET_GATE_TEST_ALLOW_UNBOUND_HOST=1",
    process.execPath,gateCode,managed,privateSock,publicSock,operatorSock]);
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
  const inspected=operator({command:"inspect",requestId:item.requestId});
  assert.equal(inspected.sha256,item.sha256);
  assert.equal(inspected.proposal.op,"mkdir");
  assert.equal(createHash("sha256").update(JSON.stringify(inspected.proposal)).digest("hex"),item.sha256);
  // The privileged human reviewer cannot be scripted into a blind approval
  // over a noninteractive pipe. Root may list requests but cannot auto-accept.
  const nonTTYReview=run("sudo",["-n",process.execPath,reviewerCode,operatorSock]);
  assert.notEqual(nonTTYReview.status,0,"non-interactive root reviewer must not approve");
  assert.match(nonTTYReview.stderr,/interactive operator TTY is mandatory/);
  assert.equal(operator({command:"list"}).pending.length,1);
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

  // End-to-end bridge acceptance: actual MCP/Bodyguard -> real Box approval
  // -> separate privileged operator -> root policy -> native guard. The
  // previous direct API probe alone does not prove that chain is reachable.
  const boxHome = path.join(local, "mcp-box-home");
  const sessionsDir = path.join(boxHome,"sessions");
  await mkdir(sessionsDir,{recursive:true});
  const actorId = "user:integration-human";
  const sessionId = "protected-mcp-"+nonce;
  const secretHex = randomBytes(32).toString("hex");
  const boundary = await import("../../src/index.ts");
  const store = await boundary.createPersistentBoundaryRuntimeStore({
    sessionId,actorId,sessionsDir,dryRun:false,hydrationMode:"full",
  });
  const opened = await boundary.openBoundaryPath({
    config: store.getConfig(), rootPath:managed,
    grantedActions:["fs.write","fs.read","fs.append"],
    issuedBy:actorId,seedBaseAcceptance:false,
  });
  store.replaceConfig({
    ...opened.config,
    approvalRequiredFor:[...new Set([...(opened.config.approvalRequiredFor??[]),
      "fs.write","fs.read","fs.append"])],
  });
  await store.persist();
  // The independent OS root is the identity issuer. Session/actor claims
  // are accepted only with a HMAC key recorded in this root-only registry.
  const hostRegistry = path.join(local,"host-identities.json");
  await writeFile(hostRegistry,JSON.stringify({
    schema:1,root:managed,
    allowed:[{sessionId,actorId,secretHex}],
  }),{mode:0o600});
  sudo("install",["-o","root","-g","root","-m","0400",
    hostRegistry,path.join(managed,"host-identities.json")]);

  // A direct same-user caller can copy the actor label but not provide the
  // trusted launcher's inherited proof. Even the root operator cannot
  // accidentally approve a request that never enters its vetted queue.
  const forgedIdentity = agent("write_file",{
    path:managed+"/allowed/forged-host-label.txt",
    content:"HOST_IMPERSONATION_ATTEMPT",
  });
  const forgedReply = await awaitAgent(forgedIdentity);
  assert.equal(forgedReply.ok,false,
    "unregistered actor inherited a privileged filesystem request");
  assert.equal(operator({command:"list"}).pending.length,0);
  assert.notEqual(run("sudo",["-n","test","-e",
    managed+"/allowed/forged-host-label.txt"]).status,0);

  boxServer = createBuccetBoxBackend({home:boxHome,notify:()=>{}});
  await boxServer.start();
  mcpProcess = spawn(process.execPath,[
    path.join(repo,"scripts/agent-buccet-mcp-server.ts"),
    "--session-id",sessionId,"--actor-id",actorId,
    "--sessions-dir",sessionsDir,"--home",boxHome,
  ],{
    cwd:repo,
    env:{
      ...process.env,AGENT_BUCCET_HOME:boxHome,
      AGENT_BUCCET_REQUIRE_ISOLATED_FS:"1",
      AGENT_BUCCET_FS_BROKER_ROOT:managed,
      AGENT_BUCCET_FS_REQUEST_SOCKET:publicSock,
      AGENT_BUCCET_FS_HOST_PROOF_FD:"3",
    },
    stdio:["pipe","pipe","pipe","pipe"],
  });
  // Trusted launcher transmits the root-issued secret by inherited pipe.
  // It is never part of process.argv, environment variables or Box storage.
  mcpProcess.stdio[3].end(secretHex+"\n");
  const mcp = mcpTransport(mcpProcess);
  const init=await mcp.request("initialize",{
    protocolVersion:"2024-11-05",capabilities:{},
    clientInfo:{name:"protected-integration-fixture",version:"1"},
  });
  assert.equal(init.result?.serverInfo?.name,"agent-buccet");
  const deniedTarget=managed+"/allowed/mcp-box-denied.txt";
  const deniedBox=mcp.call("write_file",{path:deniedTarget,content:"BOX_DENIED",
    approved:true,authorization:{role:"root"}});
  let boxRow=await waitBox(boxServer,"negative human decision");
  assert.equal(boxRow.target,deniedTarget);
  assert.equal(operator({command:"list"}).pending.length,0,
    "MCP submitted a native effect before an ordinary Box decision");
  assert.equal(boxServer.settle(boxRow.approvalId,"deny_once"),true);
  const denyReply=await deniedBox;
  assert.equal(denyReply.result?.isError,true,"denied Box action should fail");
  assert.equal(operator({command:"list"}).pending.length,0);
  assert.notEqual(run("sudo",["-n","test","-e",deniedTarget]).status,0);

  const allowedTarget=managed+"/allowed/mcp-box-allowed.txt";
  const boxAllowed=mcp.call("write_file",{
    path:allowedTarget,content:"MCP_PLUS_BOX_PLUS_ROOT",
  });
  boxRow=await waitBox(boxServer,"positive Box decision");
  assert.equal(boxRow.target,allowedTarget);
  assert.match(boxRow.payloadSummary,/sha256=[a-f0-9]{64}/,
    "Box must show full exact payload fingerprint before confirmation");
  assert.equal(operator({command:"list"}).pending.length,0,
    "unapproved Box effect reached independently privileged gate");
  assert.equal(boxServer.settle(boxRow.approvalId,"allow_once"),true);
  [item]=await waitPending();
  assert.equal(item.op,"write");
  assert.equal(item.path,"allowed/mcp-box-allowed.txt");
  assert.equal(item.host?.verified,true,
    "root gate did not independently authenticate the protected host");
  assert.equal(item.host?.sessionId,sessionId);
  assert.equal(item.host?.actorId,actorId);
  assert.equal(item.bytes,Buffer.byteLength("MCP_PLUS_BOX_PLUS_ROOT"));
  assert.equal(operator({command:"approve",requestId:item.requestId,
    sha256:item.sha256}).approved,true);
  const successful=await boxAllowed;
  assert.equal(successful.result?.isError,undefined,
    "normal MCP + Box + privileged operator did not execute: "+
      JSON.stringify(successful).slice(0,900));
  assert.equal(sudo("cat",[allowedTarget]),"MCP_PLUS_BOX_PLUS_ROOT");

  const rootDeniedTarget=managed+"/allowed/mcp-privileged-denied.txt";
  const denyAtRoot=mcp.call("write_file",{
    path:rootDeniedTarget,content:"NOT_WITHOUT_ROOT_APPROVAL",
  });
  boxRow=await waitBox(boxServer,"privileged denial");
  assert.equal(boxServer.settle(boxRow.approvalId,"allow_once"),true);
  [item]=await waitPending();
  assert.equal(operator({command:"deny",requestId:item.requestId,
    sha256:item.sha256}).denied,true);
  const rootDenied=await denyAtRoot;
  assert.equal(rootDenied.result?.isError,true);
  assert.notEqual(run("sudo",["-n","test","-e",rootDeniedTarget]).status,0);

  // Identity-adaptive red team: a different MCP process copies the exact
  // victim session ID and actor label and even receives a fresh Box Allow.
  // Its self-supplied FD secret does not match the root-owned host issuer.
  spoofProcess = spawn(process.execPath,[
    path.join(repo,"scripts/agent-buccet-mcp-server.ts"),
    "--session-id",sessionId,"--actor-id",actorId,
    "--sessions-dir",sessionsDir,"--home",boxHome,
  ],{
    cwd:repo,
    env:{
      ...process.env,AGENT_BUCCET_HOME:boxHome,
      AGENT_BUCCET_REQUIRE_ISOLATED_FS:"1",
      AGENT_BUCCET_FS_BROKER_ROOT:managed,
      AGENT_BUCCET_FS_REQUEST_SOCKET:publicSock,
      AGENT_BUCCET_FS_HOST_PROOF_FD:"3",
    },
    stdio:["pipe","pipe","pipe","pipe"],
  });
  spoofProcess.stdio[3].end(randomBytes(32).toString("hex")+"\n");
  const fakeHost=mcpTransport(spoofProcess);
  const fakeInit=await fakeHost.request("initialize",{
    protocolVersion:"2024-11-05",capabilities:{},
    clientInfo:{name:"forged-actor-test",version:"1"},
  });
  assert.equal(fakeInit.result?.serverInfo?.name,"agent-buccet");
  const victimTarget=managed+"/allowed/actor-spoof-target.txt";
  const spoofed=fakeHost.call("write_file",{
    path:victimTarget,content:"COPIED_ACTOR_SESSION_SHOULD_NOT_WORK",
  });
  boxRow=await waitBox(boxServer,"copied host identity negative control");
  assert.equal(boxRow.actorId,actorId);
  assert.equal(boxServer.settle(boxRow.approvalId,"allow_once"),true);
  const spoofAnswer=await spoofed;
  assert.equal(spoofAnswer.result?.isError,true,
    "forged 256-bit FD proof unexpectedly restored root host authority");
  assert.equal(operator({command:"list"}).pending.length,0,
    "copied actor/session labels reached privileged operator as authenticated");
  assert.notEqual(run("sudo",["-n","test","-e",victimTarget]).status,0);

  // Revocation is a root-only state change. A request admitted BEFORE host
  // revocation may not run after the privileged operator clicks approve.
  const revokedTarget=managed+"/allowed/revoked-registered-host.txt";
  const toRevoke=mcp.call("write_file",{
    path:revokedTarget,content:"SHOULD_NOT_SURVIVE_ROOT_REVOCATION",
  });
  boxRow=await waitBox(boxServer,"root-registered host revocation");
  assert.equal(boxServer.settle(boxRow.approvalId,"allow_once"),true);
  [item]=await waitPending();
  assert.equal(item.host?.verified,true);
  const denyAllHosts=path.join(local,"revoked-host-identities.json");
  await writeFile(denyAllHosts,JSON.stringify({
    schema:1,root:managed,allowed:[],
  }),{mode:0o600});
  sudo("install",["-o","root","-g","root","-m","0400",
    denyAllHosts,path.join(managed,"host-identities.json")]);
  assert.equal(operator({command:"approve",requestId:item.requestId,
    sha256:item.sha256}).approved,true);
  const revokedResponse=await toRevoke;
  assert.equal(revokedResponse.result?.isError,true,
    "root revocation failed to block an already reviewed action");
  assert.notEqual(run("sudo",["-n","test","-e",revokedTarget]).status,0);

  await boxServer.stop();
  boxServer=null;
  const absentTarget=managed+"/allowed/mcp-box-absent.txt";
  const absent=await mcp.call("write_file",{
    path:absentTarget,content:"NO_BOX_NO_EXECUTION",
  });
  assert.equal(absent.result?.isError,true,
    "protected MCP must not bypass Box when it is unavailable");
  assert.equal(operator({command:"list"}).pending.length,0);
  assert.notEqual(run("sudo",["-n","test","-e",absentTarget]).status,0);
  console.log("FS_BOX_TO_PRIVILEGED_MCP_PASS",JSON.stringify({
    realMCPServer:true,realBuccetBox:true,realNativeBroker:true,
    deniedBeforeBoxConsent:true,allowedOnlyAfterBothIndependentApprovals:true,
    rootOperatorDeniedAfterBoxAllowed:true,missingBoxFailClosed:true,
    exactPayloadVerifiedByBothLayers:true,
    independentlyRegisteredHostProof:true,
    copiedActorLabelWithoutProofRejected:true,
    sameUIDMemoryTheftRequiresSeparateOSPrincipal:true,
    copiedVictimActorSessionWithWrongFdRejected:true,
    revocationAfterHostAdmissionBeforeEffectBlocked:true,
  }));

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
  if (spoofProcess && spoofProcess.exitCode === null) {
    spoofProcess.stdin.end();
    spoofProcess.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve=>spoofProcess.once("close",resolve)),
      new Promise(resolve=>setTimeout(resolve,2000)),
    ]);
    if (spoofProcess.exitCode===null) spoofProcess.kill("SIGKILL");
  }
  if (mcpProcess && mcpProcess.exitCode === null) {
    mcpProcess.stdin.end();
    mcpProcess.kill("SIGTERM");
    await Promise.race([
      new Promise(resolve=>mcpProcess.once("close",resolve)),
      new Promise(resolve=>setTimeout(resolve,2000)),
    ]);
    if(mcpProcess.exitCode===null) mcpProcess.kill("SIGKILL");
  }
  if (boxServer) await boxServer.stop().catch(()=>{});
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
