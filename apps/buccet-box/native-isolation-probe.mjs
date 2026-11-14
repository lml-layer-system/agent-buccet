/**
 * Native OS isolation feasibility probe (Linux CI only).
 *
 * Deliberately distinct from the unchanged five-race attack harness. This
 * demonstrates a necessary primitive for a separately privileged broker:
 * a trusted executor can operate on a protected root, while multiple
 * untrusted agents sharing one OS UID cannot mutate its namespace.
 *
 * Not a production broker and not proof that current Buccet routes through
 * an independent principal. The original native race job MUST stay red
 * until actual execution is migrated to an authenticated broker.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

assert.equal(process.platform, "linux", "Linux security principal test only");
const here = path.dirname(fileURLToPath(import.meta.url));
const binary = path.resolve(here, "../../native/build/box-fs-guard");
const managedRoot = "/var/lib/buccet-native-probe-" + randomBytes(10).toString("hex");
assert.match(managedRoot, /^\/var\/lib\/buccet-native-probe-[a-f0-9]{20}$/);

function run(binary, args, input = "") {
  const result = spawnSync(binary, args, {
    encoding: "utf8", input, timeout: 20_000,
    env: { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C" },
  });
  assert.equal(result.error, undefined, result.error?.message);
  return result;
}
function privileged(program, args, input) {
  const outcome = run("sudo", ["-n", program, ...args], input);
  assert.equal(outcome.status, 0, outcome.stderr || outcome.stdout);
  return outcome.stdout;
}
function invokeGuard(args, input) {
  return privileged(binary, args, input);
}
function untrustedMutation(operation, source, destination = "") {
  const attack = `
    const fs = require("node:fs");
    const [op, src, dst] = process.argv.slice(1);
    try {
      if (op === "unlink") fs.unlinkSync(src);
      else if (op === "rename") fs.renameSync(src, dst);
      else if (op === "write") fs.writeFileSync(src, "MUTATED_BY_UNTRUSTED_AGENT");
      else throw new Error("bad op");
      console.log("ATTACK_BREACH");
      process.exit(29);
    } catch (e) {
      if (e.code !== "EACCES" && e.code !== "EPERM") throw e;
      console.log("KERNEL_REFUSED_" + e.code);
    }`;
  // The privileged TEST orchestrator drops identity before issuing the
  // mutation. The attacker itself has no sudo or privilege escalation.
  const result = run("sudo", [
    "-n", "setpriv", "--reuid=65534", "--regid=65534", "--clear-groups",
    process.execPath, "-e", attack, operation, source, destination,
  ]);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /KERNEL_REFUSED_(EACCES|EPERM)/);
}
try {
  // /var/lib is root-owned, and this fresh workspace is root-owned 0700.
  // Other users have no authority to rename its internal entries.
  privileged("install", ["-d", "-m", "0700", "-o", "root", "-g", "root", managedRoot]);
  const owner = privileged("stat", ["-c", "%u:%a", managedRoot]).trim();
  assert.equal(owner, "0:700", "secure root ownership changed");
  privileged("mkdir", ["-p", path.join(managedRoot, "nested"), path.join(managedRoot, "move-parent")]);
  privileged("chmod", ["0700", path.join(managedRoot, "nested"), path.join(managedRoot, "move-parent")]);
  privileged("touch", [path.join(managedRoot, ".buccet-fs-probe")]);
  privileged("touch", [path.join(managedRoot, "source.txt")]);

  const twoAgentsSameUid = privileged("stat", ["-c", "%u:%a", managedRoot]).trim() === "0:700";
  assert.equal(twoAgentsSameUid, true);
  // Same untrusted UID used for all five mutation attempts.
  untrustedMutation("unlink", path.join(managedRoot, ".buccet-fs-probe"));
  untrustedMutation("rename", path.join(managedRoot, "nested"), "/tmp/attack-reparent-denied");
  untrustedMutation("rename", path.join(managedRoot, "move-parent"), "/tmp/attack-move-reparent-denied");
  untrustedMutation("write", path.join(managedRoot, ".buccet-fs-probe"));
  untrustedMutation("unlink", path.join(managedRoot, "source.txt"));

  invokeGuard(["write", managedRoot, "nested/allowed.txt"], "AUTHORIZED|");
  invokeGuard(["append", managedRoot, "nested/allowed.txt"], "APPEND");
  assert.equal(privileged("cat", [path.join(managedRoot, "nested/allowed.txt")]), "AUTHORIZED|APPEND");
  invokeGuard(["move", managedRoot, "nested/allowed.txt", managedRoot, "move-parent/result.txt"], "");
  assert.equal(privileged("cat", [path.join(managedRoot, "move-parent/result.txt")]), "AUTHORIZED|APPEND");
  console.log("ISOLATED_PRINCIPAL_PROBE_PASS", JSON.stringify({
    untrustedAgentsSameUid: 65534,
    independentExecutorUid: 0,
    kernelDeniedMutations: 5,
    realAuthorizedWriteAppendMove: true,
    productBrokerIntegrated: false,
  }));
} finally {
  // Exact randomized path guarded by regex above; test runner uses sudo only
  // for fixture creation/cleanup, never as the untrusted adversary.
  const cleanup = run("sudo", ["-n", "rm", "-rf", "--", managedRoot]);
  if (cleanup.status !== 0) {
    console.error("ISOLATION_PROBE_CLEANUP_FAILED", cleanup.stderr);
    process.exitCode = 1;
  }
}
