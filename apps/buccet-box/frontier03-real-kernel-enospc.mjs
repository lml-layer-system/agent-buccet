/**
 * Frontier03 G01/G02: true kernel ENOSPC against the UNMODIFIED shipped guard.
 *
 * Mounts an 8-MiB root-only tmpfs underneath /var/lib/buccet-native and fills
 * it with real allocated pages. This is NOT an LD_PRELOAD fault or mock errno.
 * Write and append MUST hit the kernel's real ENOSPC while preserving
 * pre-existing protected bytes and removing abandoned private staging.
 *
 * A successful follow-up write after releasing space is mandatory.
 * Linux CI requires real mount(2) capability; unavailable is a red result,
 * never a skipped or falsely passed hardware claim.
 *
 * Scope: temporary root-only Linux tmpfs, NOT physical power-loss proof.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

assert.equal(process.platform, "linux", "real Linux kernel ENOSPC required");
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const guard = path.join(repo, "native/build/box-fs-guard");
const root = "/var/lib/buccet-native/f03-true-enospc-" + randomBytes(7).toString("hex");
const tmp = mkdtempSync(path.join(os.tmpdir(), "f03-true-enospc-"));
const payloadPath = path.join(tmp, "actual-payload.txt");
const oldBytes = "ORIGINAL_DURABLE_ROOT_BYTES_" + randomBytes(8).toString("hex");
const updatedBytes = "ROOT_RECOVERED_AFTER_TRUE_ENOSPC_" + randomBytes(8).toString("hex");
const env = {
  PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
  LANG: "C",
};
function sudo(bin, args = [], input = "") {
  const result = spawnSync("sudo", ["-n", bin, ...args], {
    env, encoding: "utf8", input, timeout: 35000,
    maxBuffer: 6 * 1024 * 1024,
  });
  assert.equal(result.error, undefined, "sudo " + bin + ": " + result.error?.message);
  return result;
}
function pass(result, label) {
  assert.equal(result.status, 0, label + ": " + result.stderr + result.stdout);
  return result.stdout.trim();
}
function act(op, rel, input = "") {
  return sudo(guard, [op, root, rel], input);
}
function actFromFile(op, rel) {
  // Large spawnSync "input" can raise EPIPE in the TEST HARNESS when the
  // native guard correctly exits as soon as write(2) returns ENOSPC.
  // A file-backed STDIN keeps all payload bytes available until the child
  // exits and preserves the real, unmodified native guard return status.
  return sudo("sh", ["-c", 'exec "$1" "$2" "$3" "$4" < "$5"',
    "sh", guard, op, root, rel, payloadPath]);
}
function bytes(rel) {
  return pass(act("read", rel), "read " + rel);
}
function fsFree() {
  const text = pass(sudo("stat", ["-f", "-c", "%a %S", root]),
    "read actual tmpfs free blocks");
  const parts = text.split(/\s+/).map(Number);
  assert.equal(parts.length, 2, "unexpected stat -f response");
  const [blocks, blockSize] = parts;
  assert.ok(Number.isSafeInteger(blocks) && Number.isSafeInteger(blockSize) &&
    blocks >= 0 && blockSize > 0, "invalid kernel free-block report");
  return blocks * blockSize;
}
function noTemp(reason) {
  const found = pass(sudo("find", [root + "/data", "-maxdepth", "1",
    "-type", "f", "-name", ".buccet-fs-*", "-printf", "%f\n"]),
    "inspect private staged inodes");
  assert.equal(found, "", reason + ": stranded protected private staging");
}
let mounted = false;
try {
  pass(sudo("install", ["-d", "-o", "root", "-g", "root", "-m", "0700",
    "/var/lib/buccet-native", root]), "prepare independent mountpoint");
  const mountedResult = sudo("mount", ["-t", "tmpfs", "-o",
    "size=8m,mode=0700,uid=0,gid=0,nosuid,nodev,noexec", "tmpfs", root]);
  assert.equal(mountedResult.status, 0,
    "runner does not allow real isolated Linux tmpfs mount: " +
    mountedResult.stderr + mountedResult.stdout);
  mounted = true;
  pass(sudo("mountpoint", ["-q", root]), "assert exact private mountpoint");
  const fsType = pass(sudo("findmnt", ["-n", "-o", "FSTYPE", "--target", root]),
    "verify underlying real mounted filesystem");
  assert.equal(fsType, "tmpfs", "fixture is not an actual kernel tmpfs");

  pass(sudo("install", ["-d", "-o", "root", "-g", "root", "-m", "0700",
    root + "/data"]), "create independently root-owned mounted data directory");
  pass(act("write", "data/state.txt", oldBytes), "positive authorized native baseline");
  assert.equal(bytes("data/state.txt"), oldBytes,
    "native guard positive baseline did not commit exact bytes");

  const initiallyFree = fsFree();
  assert.ok(initiallyFree >= 2 * 1024 * 1024 && initiallyFree <= 8 * 1024 * 1024,
    "tmpfs size is not the specified isolated 8MiB allocation");
  // Actually allocate nearly all remaining pages; leave 64 KiB so staging
  // creation itself can succeed and actual write(2) runs out of blocks.
  const reserveBytes = initiallyFree - 64 * 1024;
  assert.ok(reserveBytes > 1024 * 1024, "insufficient real tmpfs capacity");
  pass(sudo("fallocate", ["-l", String(reserveBytes),
    root + "/actual-allocated-blocks"]), "allocate real tmpfs data pages");
  const freeAfterFill = fsFree();
  assert.ok(freeAfterFill >= 0 && freeAfterFill <= 128 * 1024,
    "fixture did not actually exhaust real storage: " + freeAfterFill);
  console.log("F03_REAL_ENOSPC_PROOF", JSON.stringify({
    filesystem: fsType, capacityBytes: 8 * 1024 * 1024,
    initiallyFreeBytes: initiallyFree, allocatedBytes: reserveBytes,
    freeAfterAllocationBytes: freeAfterFill,
    LD_PRELOAD: false, actualKernelFilesystem: true,
  }));
  const payload = "X".repeat(512 * 1024);
  writeFileSync(payloadPath, payload, { mode: 0o600 });
  const refusedWrite = actFromFile("write", "data/state.txt");
  assert.equal(refusedWrite.status, 73,
    "real disk-full write must fail before publication: " + refusedWrite.stderr);
  assert.match(refusedWrite.stderr, /No space left on device/,
    "did not observe genuine kernel ENOSPC during native staged write");
  assert.equal(bytes("data/state.txt"), oldBytes,
    "real ENOSPC overwrote a previously durable authorized file");
  noTemp("real ENOSPC write");
  console.log("F03_REAL_ENOSPC_PASS true-kernel-write-denied-no-destination-change");

  const refusedAppend = actFromFile("append", "data/state.txt");
  assert.equal(refusedAppend.status, 73,
    "real disk-full append must fail before publication: " + refusedAppend.stderr);
  assert.match(refusedAppend.stderr, /No space left on device/,
    "append did not encounter genuine ENOSPC");
  assert.equal(bytes("data/state.txt"), oldBytes,
    "real ENOSPC append lost or corrupted original protected bytes");
  noTemp("real ENOSPC append");
  console.log("F03_REAL_ENOSPC_PASS true-kernel-append-denied-no-lost-update");

  pass(sudo("rm", ["-f", "--", root + "/actual-allocated-blocks"]),
    "release actual full-disk pressure");
  assert.ok(fsFree() >= 2 * 1024 * 1024, "kernel did not release tmpfs quota");
  pass(act("write", "data/state.txt", updatedBytes),
    "positive authorized write after real ENOSPC pressure");
  assert.equal(bytes("data/state.txt"), updatedBytes);
  noTemp("positive recovery after real ENOSPC");
  console.log("FRONTIER03_REAL_ENOSPC_SUMMARY", JSON.stringify({
    actualKernelTmpfs: true, actualFullMediaBlocks: true,
    realWriteENOSPC: true, realAppendENOSPC: true,
    exactPreviousBytesIntact: true, zeroPrivateStagingResidue: true,
    authorizedWriteRecovered: true,
    realPhysicalPowerLoss: false, hardwareDurabilityProven: false,
  }));
} catch (error) {
  console.error("FRONTIER03_REAL_ENOSPC_RED", error?.stack ?? String(error));
  process.exitCode = 1;
} finally {
  if (mounted) {
    const unmount = sudo("umount", [root]);
    if (unmount.status !== 0) {
      console.error("F03_REAL_ENOSPC_UNMOUNT_FAILED", unmount.stderr);
      process.exitCode = 1;
    }
  }
  // Never recursively delete a mounted filesystem: this is a disposable,
  // isolated CI resource, but cleanup must still respect mount identity.
  if (sudo("mountpoint", ["-q", root]).status === 0) {
    console.error("F03_REAL_ENOSPC_ROOT_STILL_MOUNTED", root);
    process.exitCode = 1;
  } else {
    const cleanup = sudo("rm", ["-rf", "--", root]);
    if (cleanup.status !== 0) {
      console.error("F03_REAL_ENOSPC_CLEANUP_FAILED", cleanup.stderr);
      process.exitCode = 1;
    }
  }
  rmSync(tmp, { recursive: true, force: true });
}
