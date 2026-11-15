/**
 * Frontier03 live privileged-broker concurrent-append attack.
 *
 * The test interposer lengthens the REAL C guard's pre-rename window so
 * multiple separately approved (root socket) appends overlap predictably.
 * The guard itself is the production binary; final filesystem bytes are
 * checked after all broker receipts. A passing receipt for a missing append
 * is a concrete lost-update bug, not a synthetic mocked failure.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux", "Linux-only actual native broker attack");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const root = "/var/lib/buccet-native/f03-append-" + randomBytes(7).toString("hex");
const temp = await mkdtemp(path.join(os.tmpdir(), "f03-append-race-"));
const native = path.join(repo, "native/build/box-fs-guard");
const broker = path.join(repo, "native/box-fs-broker.mjs");
const binary = root + "/guard";
const interposer = root + "/pause.so";
const wrapper = root + "/guard-wrapper";
const socket = root + "/broker.sock";
const env = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C" };
const COUNT = 24;
function run(program, args, input = "", timeout = 40000) {
  const r = spawnSync(program, args, { env, input, encoding: "utf8", timeout });
  assert.equal(r.error, undefined, r.error?.message ?? "");
  return r;
}
function sudo(program, args = [], input = "") {
  return run("sudo", ["-n", program, ...args], input);
}
function must(r, message) {
  assert.equal(r.status, 0, message + ": " + r.stderr + r.stdout);
  return r.stdout.trim();
}
const pauseSource = String.raw`#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdlib.h>
#include <unistd.h>
int renameat(int oldfd, const char *oldname, int newfd, const char *newname) {
  static int (*real_fn)(int, const char *, int, const char *) = NULL;
  if (!real_fn) {
    *(void **)(&real_fn) = dlsym(RTLD_NEXT, "renameat");
    if (!real_fn) _exit(92);
  }
  const char *delay = getenv("BUCCET_F03_APPEND_PAUSE_US");
  if (delay) usleep(180000);
  return real_fn(oldfd, oldname, newfd, newname);
}`;
const wrapperSource = String.raw`#define _GNU_SOURCE
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#ifndef REAL_GUARD
#error "test requires pinned original guard"
#endif
#ifndef PAUSE_SO
#error "test requires root-owned interposer"
#endif
int main(int argc, char **argv) {
  if (argc < 4) return 87;
  if (setenv("LD_PRELOAD", PAUSE_SO, 1) != 0) return 88;
  if (!strcmp(argv[1], "append") &&
      setenv("BUCCET_F03_APPEND_PAUSE_US", "180000", 1) != 0) return 89;
  execv(REAL_GUARD, argv);
  return 90;
}`;
const clients = String.raw`
const net=require("node:net");
const socket=process.argv[1];
const count=Number(process.argv[2]);
async function call(index) {
  return await new Promise((resolve,reject)=>{
    let result="",done=false;
    const c=net.createConnection({path:socket});
    const timer=setTimeout(()=>{c.destroy();reject(Error("request timeout "+index));},30000);
    function finish(error,value){if(done)return;done=true;clearTimeout(timer);c.destroy();error?reject(error):resolve(value);}
    c.on("connect",()=>c.write(JSON.stringify({
      op:"append",path:"files/ledger.txt",content:"|"+String(index).padStart(3,"0")
    })+"\n"));
    c.on("data",chunk=>{result+=String(chunk);});
    c.on("end",()=>{try{finish(null,JSON.parse(result.split("\n",1)[0]));}catch(e){finish(e);}});
    c.on("error",err=>finish(err));
  });
}
Promise.all(Array.from({length:count},(_,i)=>call(i))).then(results=>{
  const bad=results.filter(r=>r.ok!==true);
  if(bad.length){console.error("RECEIPTS_FAILED",JSON.stringify(bad.slice(0,3)));process.exitCode=71;}
  else console.log("F03_APPEND_ACTUAL_BROKER_RECEIPTS",results.length);
}).catch(e=>{console.error(e.stack);process.exitCode=72});
`;
let daemon;
try {
  must(sudo("install", ["-d", "-o", "root", "-g", "root", "-m", "0700",
    "/var/lib/buccet-native", root, root + "/files"]), "root-owned native workspace");
  must(sudo("install", ["-o", "root", "-g", "root", "-m", "0500",
    native, binary]), "install original shipped C guard");

  const pauseSrc = path.join(temp, "pause.c");
  const wrapperSrc = path.join(temp, "wrapper.c");
  await writeFile(pauseSrc, pauseSource);
  await writeFile(wrapperSrc, wrapperSource);
  must(run("cc", ["-shared", "-fPIC", "-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
    pauseSrc, "-o", path.join(temp, "pause.so"), "-ldl"]), "build test interposer");
  must(run("cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
    "-DREAL_GUARD=" + JSON.stringify(binary), "-DPAUSE_SO=" + JSON.stringify(interposer),
    wrapperSrc, "-o", path.join(temp, "wrapper")]), "build test-only wrapper");
  must(sudo("install", ["-o", "root", "-g", "root", "-m", "0500",
    path.join(temp, "pause.so"), interposer]), "pin test-only pause interposer");
  must(sudo("install", ["-o", "root", "-g", "root", "-m", "0500",
    path.join(temp, "wrapper"), wrapper]), "pin test-only wrapper");

  const policy = path.join(temp, "policy.json");
  await writeFile(policy, JSON.stringify({ schema: 1, root, allowed: [
    { op: "write", prefix: "files" },
    { op: "append", prefix: "files" },
  ] }) + "\n");
  must(sudo("install", ["-o", "root", "-g", "root", "-m", "0400",
    policy, root + "/policy.json"]), "install independent operator policy");
  must(sudo(binary, ["write", root, "files/ledger.txt"], "BASE"), "create real target inode");

  daemon = spawn("sudo", ["-n", process.execPath, broker, root, wrapper, socket], {
    env, stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  await new Promise((resolve,reject)=>{
    let ended=false;
    const timer=setTimeout(()=>done(Error("broker readiness timeout: "+log)),12000);
    const done=error=>{if(ended)return;ended=true;clearTimeout(timer);error?reject(error):resolve();};
    daemon.stdout.on("data",x=>{log+=String(x);if(log.includes("BUCCET_PROTECTED_BROKER_READY"))done();});
    daemon.stderr.on("data",x=>{log+=String(x);});
    daemon.once("exit",code=>done(Error("broker exited "+code+" "+log)));
    daemon.once("error",done);
  });
  const burst = sudo(process.execPath, ["-e", clients, socket, String(COUNT)]);
  must(burst, "parallel live broker append receipts");
  const actual = must(sudo(binary, ["read", root, "files/ledger.txt"]), "actual native file bytes");
  const tokens=actual.split("|").slice(1);
  const expected=Array.from({length:COUNT},(_,i)=>String(i).padStart(3,"0"));
  const missing=expected.filter(x=>tokens.filter(t=>t===x).length!==1);
  console.log("F03_APPEND_ACTUAL_EFFECT", JSON.stringify({
    submitted:COUNT, brokerAcknowledged:COUNT, committedTokens:tokens.length,
    missingOrDuplicated:missing, exactBytesLength:actual.length,
  }));
  assert.equal(tokens.length,COUNT,"ACKNOWLEDGED appends were LOST at the real native commit boundary");
  assert.deepEqual([...tokens].sort(),expected,"wrong exact committed append bytes");
  console.log("FRONTIER03_NATIVE_BROKER_APPEND_CONCURRENCY_PASS",JSON.stringify({
    realBroker:true,realProductionGuard:true,actualConcurrentRequests:COUNT,
    preciseCommitEffect:true,guardInterposer:"test-only renameat delay",
  }));
} catch (error) {
  console.error("FRONTIER03_NATIVE_BROKER_APPEND_CONCURRENCY_RED",error?.stack??String(error));
  process.exitCode=1;
} finally {
  if(daemon&&daemon.exitCode===null){
    daemon.kill("SIGTERM");
    await Promise.race([new Promise(resolve=>daemon.once("close",resolve)),
      new Promise(resolve=>setTimeout(resolve,4000))]);
    if(daemon.exitCode===null)daemon.kill("SIGKILL");
  }
  const cleanup=sudo("rm",["-rf","--",root]);
  if(cleanup.status!==0){console.error("F03_APPEND_CLEANUP_FAILED",cleanup.stderr);process.exitCode=1;}
  await rm(temp,{recursive:true,force:true});
}
