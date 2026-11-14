/**
 * Frontier03: real C-guard syscall fault campaign (Linux, disposable root).
 *
 * Forces fsync EIO and SIGKILL immediately before/after the REAL renameat.
 * Distinguishes definite no-commit, postcommit uncertainty and durability.
 * This tests the actual native actuator, NOT the complete approval/receipt
 * pipeline and NOT real hardware power-off.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

assert.equal(process.platform, "linux", "Linux-only real syscall fault fixture");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nonce = randomBytes(7).toString("hex");
const root = "/var/lib/buccet-native/f03-commit-" + nonce;
const temp = await mkdtemp(path.join(os.tmpdir(), "f03-native-commit-"));
const guard = path.join(repo, "native/build/box-fs-guard");
const interposer = root + "/fault.so";
const trace = root + "/trace.txt";
const cleanEnv = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C" };

function run(program, args, input = "") {
  const r = spawnSync(program, args, {
    encoding: "utf8", env: cleanEnv, input, timeout: 25000,
  });
  assert.equal(r.error, undefined, r.error?.message ?? "");
  return r;
}
function sudo(cmd, args = [], input = "") {
  return run("sudo", ["-n", cmd, ...args], input);
}
function must(r, reason) {
  assert.equal(r.status, 0, reason + ": " + r.stderr + r.stdout);
  return r.stdout;
}
function act(op, rel, textOrDest, options = {}, binary = guard) {
  const vars = ["LD_PRELOAD=" + interposer, "BUCCET_F03_TRACE=" + trace,
    ...Object.entries(options).map(([k, v]) => k + "=" + String(v))];
  const args = [op, root, rel];
  if (op === "move") args.push(root, textOrDest);
  return sudo("env", [...vars, binary, ...args],
    op === "write" || op === "append" ? (textOrDest ?? "") : "");
}
function read(rel) {
  return must(sudo(guard, ["read", root, rel]), "read " + rel);
}
function resetTrace() {
  must(sudo("rm", ["-f", "--", trace]), "reset syscall trace");
}
function traceContent() {
  return must(sudo("cat", [trace]), "read syscall trace");
}
function ensureTrace(kind, expected) {
  const count = traceContent().split("\n").filter(s => s === kind).length;
  assert.ok(count >= expected, kind + " reached " + count + " times, expected " + expected);
  return count;
}
function killed(r, label) {
  assert.ok(r.signal === "SIGKILL" || r.status === 137,
    label + " must actually kill the native guard: " + JSON.stringify({
      signal: r.signal, status: r.status, stderr: r.stderr }));
}
function report(label, detail = {}) {
  console.log("F03_NATIVE_COMMIT_PASS", label, JSON.stringify(detail));
}
try {
  must(sudo("install", ["-d", "-o", "root", "-g", "root", "-m", "0700",
    "/var/lib/buccet-native", root, root + "/files", root + "/src", root + "/dst"]),
    "create independently protected fixture tree");

  const compiled = path.join(temp, "fault.so");
  must(run("cc", ["-shared", "-fPIC", "-std=c11", "-O2",
    "-Wall", "-Wextra", "-Werror",
    path.join(repo, "apps/buccet-box/frontier03-native-fault-interposer.c"),
    "-o", compiled, "-ldl"]), "compile syscall fault interposer");
  must(sudo("install", ["-o", "root", "-g", "root", "-m", "0500", compiled, interposer]),
    "install test-only instrumentation in protected root");

  resetTrace();
  must(act("write", "files/payload.txt", "ORIGINAL"), "durable real native write");
  assert.equal(read("files/payload.txt"), "ORIGINAL");
  assert.ok(traceContent().includes("fsync:file\n"));
  ensureTrace("fsync:directory", 1);
  report("write-file-and-directory-fsync", { actualBytes: "ORIGINAL" });

  resetTrace();
  must(act("append", "files/payload.txt", "|APPENDED"), "durable native append");
  assert.equal(read("files/payload.txt"), "ORIGINAL|APPENDED");
  ensureTrace("fsync:directory", 1);
  report("append-directory-fsync");

  must(act("write", "src/move.txt", "MOVE_EXACT"), "stage move fixture");
  resetTrace();
  must(act("move", "src/move.txt", "dst/move.txt"), "durable cross-parent move");
  assert.equal(read("dst/move.txt"), "MOVE_EXACT");
  assert.notEqual(sudo("test", ["-e", root + "/src/move.txt"]).status, 0);
  ensureTrace("fsync:directory", 2);
  report("cross-directory-move-both-parent-fsync");

  resetTrace();
  must(act("delete", "dst/move.txt"), "durable native delete");
  assert.notEqual(sudo("test", ["-e", root + "/dst/move.txt"]).status, 0);
  ensureTrace("fsync:directory", 1);
  report("delete-parent-fsync");

  resetTrace();
  must(act("mkdir", "files/fresh-dir"), "durable native mkdir");
  ensureTrace("fsync:directory", 1);
  report("mkdir-parent-fsync");

  resetTrace();
  const precommit = act("write", "files/payload.txt", "SHOULD_NOT_PUBLISH",
    { BUCCET_F03_FILE_FSYNC_EIO: 1 });
  assert.equal(precommit.status, 73, "failed data fsync must refuse before rename");
  assert.match(precommit.stderr, /BUCCET_FS_DENIED/);
  assert.equal(read("files/payload.txt"), "ORIGINAL|APPENDED");
  assert.ok(!traceContent().includes("rename:after"));
  report("file-fsync-EIO-no-publication");
  // A controlled pre-commit I/O failure must not accumulate root-only
  // temporary payloads. The vulnerable guard leaves .buccet-fs-* here,
  // eventually exhausting protected storage under repeated failed writes.
  const leakedStage = must(sudo("find", [
    root + "/files", "-maxdepth", "1", "-type", "f",
    "-name", ".buccet-fs-*", "-print",
  ]), "enumerate root-owned unpublished stages");
  assert.equal(leakedStage.trim(), "",
    "G01/G02: rejected precommit write left privileged temporary payload");
  report("file-fsync-EIO-no-stage-residue");
  // If cleanup's own directory fsync fails, the no-effect durability
  // guarantee is not established. Propagate UNCERTAIN rather than DENIED.
  resetTrace();
  const cleanupSyncEio = act("write", "files/payload.txt", "NEVER_PUBLISHED",
    { BUCCET_F03_FILE_FSYNC_EIO: 1, BUCCET_F03_DIR_FSYNC_EIO: 1 });
  assert.equal(cleanupSyncEio.status, 74,
    "failed staging cleanup durability must report uncertain, not denied");
  assert.match(cleanupSyncEio.stderr,
    /BUCCET_FS_COMMIT_UNCERTAIN: unable to sync staging cleanup/);
  assert.equal(read("files/payload.txt"), "ORIGINAL|APPENDED");
  assert.ok(!traceContent().includes("rename:after"));
  ensureTrace("fsync:directory", 1);
  report("staging-cleanup-fsync-EIO-explicit-uncertainty");

  // A failed renameat also exits before publication; clean the same private
  // staging inode and prove the authorized old bytes remain untouched.
  resetTrace();
  const renameEio = act("write", "files/payload.txt", "RENAME_REJECTED",
    { BUCCET_F03_RENAME_EIO: 1 });
  assert.equal(renameEio.status, 73, "precommit rename EIO must be a definite failure");
  assert.match(renameEio.stderr, /BUCCET_FS_DENIED/);
  assert.equal(read("files/payload.txt"), "ORIGINAL|APPENDED");
  assert.match(traceContent(), /rename:before/);
  assert.ok(!traceContent().includes("rename:after"));
  const postRenameStage = must(sudo("find", [
    root + "/files", "-maxdepth", "1", "-type", "f",
    "-name", ".buccet-fs-*", "-print",
  ]), "enumerate staged payloads after failed rename");
  assert.equal(postRenameStage.trim(), "", "failed rename left secret staging residue");
  report("rename-EIO-no-publication-or-stage-residue");

  // Repeating a controlled error must not accumulate a privileged inode or
  // mutate existing bytes. Cover append (copy-old + append-new) separately.
  for (let attempt = 0; attempt < 24; attempt++) {
    const denied = act("append", "files/payload.txt", "|REJECTED_" + attempt,
      { BUCCET_F03_FILE_FSYNC_EIO: 1 });
    assert.equal(denied.status, 73, "append precommit EIO unexpectedly succeeded");
  }
  assert.equal(read("files/payload.txt"), "ORIGINAL|APPENDED");
  const repeatedStage = must(sudo("find", [
    root + "/files", "-maxdepth", "1", "-type", "f",
    "-name", ".buccet-fs-*", "-print",
  ]), "enumerate repeat-failure staged payloads");
  assert.equal(repeatedStage.trim(), "", "repeated append failure accumulated staging residue");
  report("24-rejected-appends-no-privileged-stage-accumulation");

  resetTrace();
  const postcommit = act("write", "files/payload.txt", "EXISTS_BUT_DURABILITY_UNKNOWN",
    { BUCCET_F03_DIR_FSYNC_EIO: 1 });
  assert.equal(postcommit.status, 74, "post-rename failure must be UNCERTAIN");
  assert.match(postcommit.stderr, /BUCCET_FS_COMMIT_UNCERTAIN/);
  assert.equal(read("files/payload.txt"), "EXISTS_BUT_DURABILITY_UNKNOWN");
  ensureTrace("fsync:directory", 1);
  report("post-rename-dir-fsync-EIO-explicit-uncertainty");

  must(act("write", "src/uncertain.txt", "MOVE_DURABILITY_UNKNOWN"), "stage move fault");
  resetTrace();
  const moveFault = act("move", "src/uncertain.txt", "dst/uncertain.txt",
    { BUCCET_F03_DIR_FSYNC_EIO: 2 });
  assert.equal(moveFault.status, 74, "second parent fsync fault must be uncertain");
  assert.match(moveFault.stderr, /BUCCET_FS_COMMIT_UNCERTAIN/);
  assert.equal(read("dst/uncertain.txt"), "MOVE_DURABILITY_UNKNOWN");
  assert.notEqual(sudo("test", ["-e", root + "/src/uncertain.txt"]).status, 0);
  ensureTrace("fsync:directory", 2);
  report("cross-parent-second-fsync-EIO-explicit-uncertainty");

  resetTrace();
  const crashBefore = act("write", "files/payload.txt", "DO_NOT_COMMIT",
    { BUCCET_F03_CRASH_RENAME: "before" });
  killed(crashBefore, "pre-rename");
  assert.equal(read("files/payload.txt"), "EXISTS_BUT_DURABILITY_UNKNOWN");
  assert.match(traceContent(), /rename:before/);
  report("SIGKILL-before-actual-rename-leaves-previous-bytes");

  resetTrace();
  const crashAfter = act("write", "files/payload.txt", "PUBLISHED_NO_RECEIPT",
    { BUCCET_F03_CRASH_RENAME: "after" });
  killed(crashAfter, "post-rename");
  assert.equal(read("files/payload.txt"), "PUBLISHED_NO_RECEIPT");
  assert.match(traceContent(), /rename:after/);
  report("SIGKILL-after-actual-rename-publishes-without-receipt");

  // Mutation sensitivity: deliberately compile a TEST-ONLY guard missing the
  // post-rename directory fsync and prove it falsely returns success despite
  // the same EIO injection. Never install this mutant as the real broker guard.
  const src = await readFile(path.join(repo, "native/box-fs-guard.c"), "utf8");
  const original = 'if (renameat(parent, tmp, parent, leaf) < 0) fail("cannot commit confined output");\n    sync_directory_after_mutation(parent);';
  assert.equal(src.split(original).length, 2, "mutant fixture requires exact real guard statement");
  const mutantText = src.replace(original,
    'if (renameat(parent, tmp, parent, leaf) < 0) fail("cannot commit confined output");\n    /* MUTANT ONLY: removed directory fsync */');
  const mutantSrc = path.join(temp, "mutant.c");
  const mutantExe = path.join(temp, "mutant");
  await writeFile(mutantSrc, mutantText);
  must(run("cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
    mutantSrc, "-o", mutantExe]), "compile unsafe negative control");
  const rootMutant = root + "/mutant-guard";
  must(sudo("install", ["-o", "root", "-g", "root", "-m", "0500",
    mutantExe, rootMutant]), "install disposable test mutant");
  resetTrace();
  const unsafe = act("write", "files/mutant-only.txt", "FALSE_SUCCESS",
    { BUCCET_F03_DIR_FSYNC_EIO: 1 }, rootMutant);
  assert.equal(unsafe.status, 0, "mutant should expose missing durability barrier");
  assert.equal(read("files/mutant-only.txt"), "FALSE_SUCCESS");
  assert.equal(traceContent().includes("fsync:directory"), false);
  report("mutation-sensitivity-missing-dir-fsync-detected");

  console.log("FRONTIER03_NATIVE_COMMIT_FAULT_SUMMARY", JSON.stringify({
    nativeGuard: guard, actualKernelRename: true, injectedDirectoryEIO: true,
    injectedFileEIO: true, sigkillBeforeAndAfterRename: true,
    crossDirectoryDurability: true, mutantBlindSpotDemonstrated: true,
    wholeServiceGateAcceptance: false, realPowerLoss: false,
  }));
} catch (error) {
  console.error("FRONTIER03_NATIVE_COMMIT_FAULT_RED", error?.stack ?? String(error));
  process.exitCode = 1;
} finally {
  const cleaned = sudo("rm", ["-rf", "--", root]);
  if (cleaned.status !== 0) {
    console.error("FRONTIER03_NATIVE_COMMIT_CLEANUP_FAILED", cleaned.stderr);
    process.exitCode = 1;
  }
  await rm(temp, { recursive: true, force: true });
}
