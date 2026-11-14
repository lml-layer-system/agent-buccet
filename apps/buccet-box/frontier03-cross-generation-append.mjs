/**
 * Frontier03: cross-generation append fault, actual privileged broker and C guard.
 *
 * Hold the first guard BEFORE real renameat; SIGKILL its broker, then restart a
 * new independent broker and approve a second append. The first guard survives
 * and can commit after the second unless a KERNEL-SHARED lock spans broker
 * generations. Deny-everything cannot pass: both exact appended tokens must
 * exist, with the second receipt truthful.
 *
 * Linux root-only disposable CI fixture; not a systemd acceptance substitute.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux", "Linux-only broker-generation proving ground");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const root = "/var/lib/buccet-native/f03-generation-" + randomBytes(7).toString("hex");
const tmp = await mkdtemp(path.join(os.tmpdir(), "f03-generation-"));
const native = path.join(repo, "native/build/box-fs-guard");
const broker = path.join(repo, "native/box-fs-broker.mjs");
const guard = root + "/guard";
const wrapper = root + "/guard-wrapper";
const so = root + "/pause.so";
const socket = root + "/broker.sock";
const gate = root + "/rename-gate";
const first = root + "/first-guard-marker";
const pid1 = root + "/broker-1.pid", pid2 = root + "/broker-2.pid";
const env = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C" };
function run(program, args, input = "") {
  const result = spawnSync(program, args, { env, encoding: "utf8", input, timeout: 25000 });
  assert.equal(result.error, undefined, result.error?.message ?? "");
  return result;
}
function sudo(bin, args = [], input = "") { return run("sudo", ["-n", bin, ...args], input); }
function must(r, context) {
  assert.equal(r.status, 0, context + ": " + r.stdout + r.stderr);
  return r.stdout.trim();
}
function def(name,value) { return "-D" + name + "=" + JSON.stringify(value); }
const wrapperSource = String.raw`#define _GNU_SOURCE
#include <fcntl.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#ifndef REAL_GUARD
#error "test requires real guard"
#endif
#ifndef PAUSE_SO
#error "test requires root-owned interposer"
#endif
#ifndef GATE_PATH
#error "test requires private rename gate"
#endif
#ifndef FIRST_PATH
#error "test requires root-owned first marker"
#endif
int main(int argc, char **argv) {
  if (argc < 4) return 81;
  if (!strcmp(argv[1], "append") && !strcmp(argv[3], "files/ledger.txt")) {
    int fd=open(FIRST_PATH, O_WRONLY|O_CREAT|O_EXCL|O_CLOEXEC, 0600);
    if (fd>=0) {
      close(fd);
      if (setenv("LD_PRELOAD",PAUSE_SO,1)!=0 ||
          setenv("BUCCET_TEST_RENAME_GATE",GATE_PATH,1)!=0 ||
          setenv("BUCCET_TEST_OLD_PREFIX",".buccet-fs-",1)!=0) return 82;
    }
  }
  execv(REAL_GUARD,argv);
  return 83;
}`;
const launcher = [
  'const fs=require("node:fs");',
  'const {pathToFileURL}=require("node:url");',
  'const [pid,entry,root,guard,socket]=process.argv.slice(1);',
  'fs.writeFileSync(pid,String(process.pid));',
  'process.argv=[process.execPath,entry,root,guard,socket];',
  'import(pathToFileURL(entry).href).catch(e=>{console.error(e);process.exitCode=70});',
].join("");
const client = [
  'const net=require("node:net");',
  'const c=net.createConnection({path:process.argv[1]});',
  'let out="";',
  'c.on("connect",()=>c.write(process.argv[2]+"\\n"));',
  'c.on("data",x=>out+=String(x));',
  'c.on("end",()=>process.stdout.write(out));',
  'c.on("error",e=>{console.error(e.code);process.exitCode=72});',
].join("");
const processes = [];
async function waitFor(predicate, message, tries = 120) {
  for (let n = 0; n < tries; n++) {
    try { if (predicate()) return; }
    catch { /* transient state */ }
    await new Promise(resolve => setTimeout(resolve, 75));
  }
  throw Error(message);
}
async function startBroker(pidFile) {
  const proc = spawn("sudo", ["-n", process.execPath, "-e", launcher,
    pidFile, broker, root, wrapper, socket], { env, stdio: ["ignore","pipe","pipe"] });
  processes.push({ proc, pidFile });
  let output = "", ready = false;
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(Error("broker start timeout "+output)),12000);
    const finish=(error)=>{
      if(ready)return;ready=true;clearTimeout(timer);
      error?reject(error):resolve();
    };
    proc.stdout.on("data",v=>{
      output+=String(v);
      if(output.includes("BUCCET_PROTECTED_BROKER_READY"))finish();
    });
    proc.stderr.on("data",v=>{output+=String(v);});
    proc.once("error",finish);
    proc.once("exit",code=>finish(Error("broker exited "+code+" "+output)));
  });
  return Number(must(sudo("cat",[pidFile]),"read actual broker PID"));
}
function launchAppend(token) {
  const req = JSON.stringify({ op:"append", path:"files/ledger.txt", content:"|"+token });
  const child=spawn("sudo",["-n",process.execPath,"-e",client,socket,req],{
    env, stdio:["ignore","pipe","pipe"],
  });
  let stdout="", stderr="", settled=false;
  child.stdout.on("data",x=>{stdout+=String(x);});
  child.stderr.on("data",x=>{stderr+=String(x);});
  const result=new Promise((resolve,reject)=>{
    child.once("error",reject);
    child.once("close",(code,signal)=>{settled=true;resolve({code,signal,stdout,stderr});});
  });
  return {child,result,isFinished:()=>settled};
}
try {
  must(sudo("install",["-d","-o","root","-g","root","-m","0700",
    "/var/lib/buccet-native",root,root+"/files",gate]),"protected test workspace");
  must(sudo("install",["-o","root","-g","root","-m","0500",native,guard]),
    "install exact production native guard");
  const builtSo=path.join(tmp,"pause.so"),builtWrapper=path.join(tmp,"wrapper");
  const wrapperSrc=path.join(tmp,"wrapper.c");
  await writeFile(wrapperSrc,wrapperSource);
  must(run("cc",["-shared","-fPIC","-O2","-Wall","-Wextra","-Werror",
    path.join(repo,"apps/buccet-box/frontier-rename-barrier.c"),"-o",builtSo,"-ldl"]),
    "build original syscall barrier");
  must(run("cc",["-std=c11","-O2","-Wall","-Wextra","-Werror",
    def("REAL_GUARD",guard),def("PAUSE_SO",so),def("GATE_PATH",gate),
    def("FIRST_PATH",first),wrapperSrc,"-o",builtWrapper]),"build root test wrapper");
  must(sudo("install",["-o","root","-g","root","-m","0500",builtSo,so]),"pin interposer");
  must(sudo("install",["-o","root","-g","root","-m","0500",builtWrapper,wrapper]),
    "pin wrapper");
  const policyFile=path.join(tmp,"policy.json");
  await writeFile(policyFile,JSON.stringify({schema:1,root,allowed:[
    {op:"append",prefix:"files"},{op:"write",prefix:"files"},
  ]})+"\n");
  must(sudo("install",["-o","root","-g","root","-m","0400",
    policyFile,root+"/policy.json"]),"root-only policy");
  must(sudo(guard,["write",root,"files/ledger.txt"],"BASE"),"initialize exact bytes");

  const originalBroker=await startBroker(pid1);
  const a=launchAppend("FIRST");
  await waitFor(()=>sudo("test",["-e",gate+"/ready"]).status===0,
    "old-generation native guard never reached actual pre-rename syscall");
  assert.equal(a.isFinished(),false,"old request completed before rename gate");
  // This is a real SIGKILL of broker only, not a kill of its native child.
  must(sudo("kill",["-KILL",String(originalBroker)]),"kill old broker parent");
  await waitFor(()=>sudo("kill",["-0",String(originalBroker)]).status!==0,
    "old broker still has live PID");
  const newBroker=await startBroker(pid2);
  assert.notEqual(newBroker,originalBroker);
  const b=launchAppend("SECOND");
  await new Promise(resolve=>setTimeout(resolve,850));
  assert.equal(b.isFinished(),false,
    "new broker committed conflicting append before old native guard released root");
  assert.equal(must(sudo("cat",[root+"/files/ledger.txt"]),"pre-release bytes"),"BASE",
    "new broker wrote through a surviving old guard's commit window");
  must(sudo("touch",[gate+"/release"]),"release old native guard");
  const second=await Promise.race([
    b.result,new Promise((_,reject)=>setTimeout(()=>reject(Error("second broker stalled")),15000)),
  ]);
  assert.equal(second.code,0,"second broker refused authorized append "+second.stderr);
  assert.equal(JSON.parse(second.stdout.trim()).ok,true);
  const final=must(sudo("cat",[root+"/files/ledger.txt"]),"final actual bytes");
  assert.equal(final,"BASE|FIRST|SECOND",
    "broker-generation transition LOST an acknowledged append");
  console.log("FRONTIER03_CROSS_GENERATION_APPEND_PASS",JSON.stringify({
    killedBrokerPid:originalBroker,restartedBrokerPid:newBroker,
    originalGuardSurvivedAndCommitted:true,actualNativeRenameBarrier:true,
    secondAppendWaitedForFirst:true,exactBytes:final,
    systemdAcceptance:false,physicalPowerLoss:false,
  }));
} catch(error) {
  console.error("FRONTIER03_CROSS_GENERATION_APPEND_RED",error?.stack??String(error));
  process.exitCode=1;
} finally {
  sudo("touch",[gate+"/release"]);
  await new Promise(resolve=>setTimeout(resolve,250));
  for(const {proc,pidFile} of processes.reverse()){
    const found=sudo("cat",[pidFile]);
    if(found.status===0 && /^\d+$/.test(found.stdout.trim())){
      sudo("kill",["-KILL",found.stdout.trim()]);
    }
    if(proc.exitCode===null)proc.kill("SIGTERM");
  }
  const cleanup=sudo("rm",["-rf","--",root]);
  if(cleanup.status!==0){
    console.error("CROSS_GENERATION_CLEANUP_FAILED",cleanup.stderr);process.exitCode=1;
  }
  await rm(tmp,{recursive:true,force:true});
}
