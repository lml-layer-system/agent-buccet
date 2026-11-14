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

  // G06: a syntactically valid destination is not permission to allocate
  // directories while the SOURCE is still unknown. The native guard must
  // validate and pin the source inode before any destination parent mkdir.
  // Missing/symlink source are both definite denials with ZERO new effects.
  const invalidMoves = [
    ["src/does-not-exist.txt", "dst/missing-source-parent/moved.txt",
      root + "/dst/missing-source-parent"],
    ["src/untrusted-source-link.txt", "dst/symlink-source-parent/moved.txt",
      root + "/dst/symlink-source-parent"],
  ];
  must(sudo("ln", ["-s", "/etc/passwd", root + "/src/untrusted-source-link.txt"]),
    "stage non-followed source symlink");
  for (const [source, dest, parent] of invalidMoves) {
    assert.notEqual(sudo("test", ["-e", parent]).status, 0,
      "move negative fixture parent already exists");
    const deniedMove = act("move", source, dest);
    assert.equal(deniedMove.status, 73,
      "G06 unsupported move source must be denied " + source);
    assert.notEqual(sudo("test", ["-e", parent]).status, 0,
      "G06 denied move allocated privileged destination parent " + dest);
    assert.notEqual(sudo("test", ["-e", root + "/" + dest]).status, 0,
      "G06 denied move published a destination entry");
  }
  must(act("write", "src/move-positive.txt", "AUTHORIZED_CROSS_PARENT"),
    "prepare legitimate cross-parent move control");
  must(act("move", "src/move-positive.txt", "dst/move-positive-created/final.txt"),
    "positive move requiring protected directory creation");
  assert.equal(read("dst/move-positive-created/final.txt"),
    "AUTHORIZED_CROSS_PARENT");
  report("denied-source-move-does-not-create-privileged-destination-parent");


  resetTrace();
  must(act("delete", "dst/move.txt"), "durable native delete");
  assert.notEqual(sudo("test", ["-e", root + "/dst/move.txt"]).status, 0);
  ensureTrace("fsync:directory", 1);
  report("delete-parent-fsync");

  resetTrace();
  must(act("mkdir", "files/fresh-dir"), "durable native mkdir");
  ensureTrace("fsync:directory", 1);
  report("mkdir-parent-fsync");

  // G09 actuator boundary: mkdirat(...)=EEXIST is NOT proof the existing
  // leaf is a root-owned confined directory. A positive mkdir receipt over a
  // world-writable or untrusted-UID leaf would bless attacker-controlled state.
  // Deny it, leave the unsafe inode untouched, and preserve a real positive
  // control on an existing independently protected directory.
  const unsafeMode = root + "/files/existing-unsafe-mode";
  const unsafeOwner = root + "/files/existing-unsafe-owner";
  must(sudo("install", ["-d", "-o", "root", "-g", "root", "-m", "0777", unsafeMode]),
    "stage world-writable existing directory under protected parent");
  const unsafeModeBefore = must(sudo("stat", ["-c", "%u:%a:%F", unsafeMode]),
    "inspect world-writable root-owned existing directory").trim();
  assert.equal(unsafeModeBefore, "0:777:directory");
  const mkdirMode = act("mkdir", "files/existing-unsafe-mode");
  assert.equal(mkdirMode.status, 73,
    "G09 existing 0777 directory received FALSE protected mkdir success");
  assert.equal(must(sudo("stat", ["-c", "%u:%a:%F", unsafeMode]),
    "verify refused world-writable leaf unchanged").trim(), unsafeModeBefore);
  must(sudo("install", ["-d", "-o", "65534", "-g", "65534", "-m", "0700", unsafeOwner]),
    "stage untrusted-UID-owned existing directory");
  const unsafeOwnerBefore = must(sudo("stat", ["-c", "%u:%a:%F", unsafeOwner]),
    "inspect untrusted-UID-owned existing directory").trim();
  assert.equal(unsafeOwnerBefore, "65534:700:directory");
  const mkdirOwner = act("mkdir", "files/existing-unsafe-owner");
  assert.equal(mkdirOwner.status, 73,
    "G09 existing untrusted-UID-owned directory received FALSE protected mkdir success");
  assert.equal(must(sudo("stat", ["-c", "%u:%a:%F", unsafeOwner]),
    "verify refused untrusted owner unchanged").trim(), unsafeOwnerBefore);
  const mkdirSafe = act("mkdir", "files/fresh-dir");
  must(mkdirSafe, "idempotent root-owned protected mkdir positive control");
  assert.equal(must(sudo("stat", ["-c", "%u:%a:%F", root + "/files/fresh-dir"]),
    "verify positive protected directory").trim(), "0:700:directory");
  report("existing-mkdir-protects-inode-ownership-and-permissions");

  // G09/G05 denied-path atomicity: traversal validation must finish BEFORE
  // the guard creates missing intermediate directories. A path with a later
  // ".." or reserved internal component is never authorized; refusing it
  // after mkdirat leaves an unauthorized durable filesystem side effect.
  const maliciousPaths = [
    ["files/denied-parent-dotdot/../rejected.txt",
      root + "/files/denied-parent-dotdot"],
    ["files/denied-parent-ledger/.buccet-host-nonces/rejected.txt",
      root + "/files/denied-parent-ledger"],
  ];
  for (const [relative, directory] of maliciousPaths) {
    assert.notEqual(sudo("test", ["-e", directory]).status, 0,
      "red fixture had unexpected prior directory");
    const refused = act("write", relative, "FORBIDDEN_PATH_NO_SIDE_EFFECTS");
    assert.equal(refused.status, 73,
      "native rejected-path control failed to deny " + relative);
    assert.notEqual(sudo("test", ["-e", directory]).status, 0,
      "G09 invalid suffix caused unauthorized root-owned parent mkdir " + relative);
  }
  const goodDeepPath = "files/valid-prefix-created/approved.txt";
  must(act("write", goodDeepPath, "AUTHORIZED_DEEP_WRITE"),
    "positive authorized auto-created parent after prevalidation");
  assert.equal(read(goodDeepPath), "AUTHORIZED_DEEP_WRITE");
  report("rejected-path-does-not-create-intermediate-parent-directories");



  resetTrace();
  const diskFull = act("write", "files/payload.txt", "MUST_NOT_PUBLISH_FULL_DISK",
    { BUCCET_F03_WRITE_ENOSPC: 1 });
  assert.equal(diskFull.status, 73, "ENOSPC during native write must deny before publication");
  assert.match(diskFull.stderr, /BUCCET_FS_DENIED/);
  assert.equal(read("files/payload.txt"), "ORIGINAL|APPENDED");
  assert.match(traceContent(), /write:ENOSPC/,
    "ENOSPC fault must reach actual native write syscall");
  assert.ok(!traceContent().includes("rename:after"),
    "ENOSPC incorrectly advanced the native commit window");
  const diskResidue = sudo("find", [root + "/files", "-maxdepth", "1",
    "-type", "f", "-name", ".buccet-fs-*", "-printf", "%f\\n"]);
  assert.equal(diskResidue.status, 0);
  assert.equal(diskResidue.stdout.trim(), "",
    "ENOSPC left private staged bytes even though publication failed");
  report("actual-native-write-ENOSPC-no-effects-no-staging-residue");

  resetTrace();
  const precommit = act("write", "files/payload.txt", "SHOULD_NOT_PUBLISH",
    { BUCCET_F03_FILE_FSYNC_EIO: 1 });
  assert.equal(precommit.status, 73, "failed data fsync must refuse before rename");
  assert.match(precommit.stderr, /BUCCET_FS_DENIED/);
  assert.equal(read("files/payload.txt"), "ORIGINAL|APPENDED");
  assert.ok(!traceContent().includes("rename:after"));
  // The original target is safe, but orphaned private inode data is ALSO a
  // privileged partial state. An EIO before commit must remove its staging.
  const residue = sudo("find", [root + "/files", "-maxdepth", "1",
    "-type", "f", "-name", ".buccet-fs-*", "-printf", "%f\\n"]);
  assert.equal(residue.status, 0, "cannot inspect protected staging residue");
  assert.equal(residue.stdout.trim(), "",
    "ENOSPC/EIO left private native staging bytes after refusal");
  report("file-fsync-EIO-no-publication-or-staging-residue");

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
  // A SIGKILL bypasses all userspace error handlers. The next independently
  // privileged guard invocation must reconcile abandoned staging while under
  // the same kernel root lock; stale private approved bytes are not an
  // acceptable indefinitely persisted crash artifact.
  const stranded = sudo("find", [root + "/files", "-maxdepth", "1",
    "-type", "f", "-name", ".buccet-fs-*", "-printf", "%f\\n"]);
  assert.equal(stranded.status, 0, "cannot inspect root staging after crash");
  assert.equal(stranded.stdout.trim(), "",
    "native SIGKILL stranded root-only staged bytes after restart/read recovery");
  report("SIGKILL-before-rename-recovers-old-bytes-and-removes-abandoned-staging");

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
  const original = '    staged_parent = -1;\n    sync_directory_after_mutation(parent);';
  assert.equal(src.split(original).length, 2, "mutant fixture requires exact real guard statement");
  const mutantText = src.replace(original,
    '    staged_parent = -1;\n    /* MUTANT ONLY: removed directory fsync */');
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

  // G10 regression sensitivity: deliberately remove EACH NEW G09 structural
  // protection in isolated C builds. A weak test that merely checks the real
  // guard's success path would not catch these unsafe, externally visible
  // responses. Mutants are root-owned disposable TEST artifacts only.
  async function compileMutant(label, needle, replacement) {
    assert.equal(src.split(needle).length, 2,
      "mutant " + label + " requires exact native source anchor");
    const sourceFile = path.join(temp, label + ".c");
    const binaryFile = path.join(temp, label);
    const installedFile = root + "/" + label;
    await writeFile(sourceFile, src.replace(needle, replacement));
    must(run("cc", ["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
      sourceFile, "-o", binaryFile]), "compile test-only " + label);
    must(sudo("install", ["-o", "root", "-g", "root", "-m", "0500",
      binaryFile, installedFile]), "pin disposable " + label);
    return installedFile;
  }
  const mkdirMutant = await compileMutant("mutant-unsafe-mkdir",
    "    require_protected_directory(opened);\n    close(opened);",
    "    /* MUTANT ONLY: existing unsafe mkdir leaf is falsely trusted */\n    close(opened);");
  const unsafeMkdirReceipt = act("mkdir", "files/existing-unsafe-mode",
    undefined, {}, mkdirMutant);
  assert.equal(unsafeMkdirReceipt.status, 0,
    "mutant must reveal false protected success on existing 0777 directory");
  assert.equal(must(sudo("stat", ["-c", "%u:%a:%F", unsafeMode]),
    "unsafe mkdir mutant did not alter test fixture").trim(), "0:777:directory");
  report("mutation-sensitivity-unsafe-existing-mkdir-detected");

  const pathMutant = await compileMutant("mutant-partial-path-validation",
    "  preflight_relative_path(relative);\n  int fd = dup(rootfd);",
    "  /* MUTANT ONLY: skip all-component preflight under normal test env */\n" +
    "  if (getenv(\"BUCCET_F03_MUTANT_ENABLE_PREFLIGHT\")) preflight_relative_path(relative);\n" +
    "  int fd = dup(rootfd);");
  const mutantOrphan = root + "/files/mutant-rejected-parent";
  assert.notEqual(sudo("test", ["-e", mutantOrphan]).status, 0);
  const mutatedPath = act("write",
    "files/mutant-rejected-parent/../blocked.txt", "NO_EFFECT_IS_REQUIRED",
    {}, pathMutant);
  assert.equal(mutatedPath.status, 73,
    "mutant guard must still reject explicit traversal suffix");
  assert.equal(sudo("test", ["-d", mutantOrphan]).status, 0,
    "mutant must expose side-effected parent despite denying request");
  must(sudo("rm", ["-rf", "--", mutantOrphan]),
    "remove solely mutated test-only partial parent");
  report("mutation-sensitivity-denied-path-parent-side-effect-detected");


  console.log("FRONTIER03_NATIVE_COMMIT_FAULT_SUMMARY", JSON.stringify({
    nativeGuard: guard, actualKernelRename: true, injectedDirectoryEIO: true,
    injectedFileEIO: true, injectedNativeWriteENOSPC: true,
    sigkillBeforeAndAfterRename: true,
    crossDirectoryDurability: true, mutantBlindSpotDemonstrated: true,
    unsafeMkdirMutantDetected: true, partialPathValidationMutantDetected: true,
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
