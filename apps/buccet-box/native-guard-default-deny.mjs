/**
 * Production native binary MUST refuse all file effects from same-UID
 * untrusted processes and must reject attacker-controlled namespaces even
 * when invoked by a privileged caller. Real authorized positive controls
 * execute through the independent broker in frontier-protected-races.mjs.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, access, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const binary = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../native/build/box-fs-guard");
const temp = await mkdtemp(path.join(os.tmpdir(), "buccet-prod-native-deny-"));
const scope = path.join(temp, "agent-writable");
const outside = path.join(temp, "outside");
const baseline = path.join(scope, "baseline.txt");
try {
  await mkdir(scope);
  await mkdir(outside);
  await writeFile(baseline, "ORIGINAL");
  const cases = [
    { op:"write", args:["write",scope,"new.txt"], content:"ATTACK" },
    { op:"append", args:["append",scope,"baseline.txt"], content:"ATTACK" },
    { op:"move", args:["move",scope,"baseline.txt",scope,"moved.txt"] },
    { op:"delete", args:["delete",scope,"baseline.txt"] },
    { op:"mkdir", args:["mkdir",scope,"nested"] },
    { op:"read", args:["read",scope,"baseline.txt"] },
  ];
  for (const row of cases) {
    const untrusted = spawnSync(binary,row.args,{
      input:row.content??"",encoding:"utf8",timeout:5000,
    });
    assert.notEqual(untrusted.status,0,"unprivileged direct guard unexpectedly performed "+row.op);
    assert.match(untrusted.stderr,/BUCCET_FS_DENIED/);
    // Root cannot lawfully use a user-owned /tmp scope either: its parent
    // namespace is movable by the untrusted OS principal.
    const elevated = spawnSync("sudo",["-n",binary,...row.args],{
      input:row.content??"",encoding:"utf8",timeout:5000,
    });
    assert.notEqual(elevated.status,0,"privileged guard accepted an untrusted scope in "+row.op);
    assert.match(elevated.stderr,/BUCCET_FS_DENIED/);
  }
  assert.equal(await readFile(baseline,"utf8"),"ORIGINAL");
  await assert.rejects(access(path.join(scope,"new.txt")),{code:"ENOENT"});
  await assert.rejects(access(path.join(scope,"moved.txt")),{code:"ENOENT"});
  await assert.rejects(access(path.join(scope,"nested")),{code:"ENOENT"});
  console.log("NATIVE_SHIPPED_GUARD_DENY_PASS",JSON.stringify({
    rejectedUnprivilegedActions:cases.length,
    rejectedPrivilegedActionsInAttackerWritableNamespace:cases.length,
    actorWritableScopeUnchanged:true,
    independentProtectedBrokerPositiveControlRequired:true,
  }));
} finally {
  await rm(temp,{recursive:true,force:true});
}
