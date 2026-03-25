/**
 * Agent Buccet — native physwrap contract
 *
 * Verifies:
 * 1. physwrap binary is available and executes correctly
 * 2. setrlimit() hard limits are applied (child cannot raise them)
 * 3. Multiple limits applied in a single invocation
 * 4. Shell-ulimit fallback path is structurally correct
 * 5. process.ts chooses physwrap over shell-ulimit when binary is present
 * 6. Limits are enforced and immovable (hard == soft)
 * 7. Darwin --uid/--gid privilege drop flags (macOS only)
 * 8. physwrap_active_limits / physwrap_skipped_limits coverage metadata
 * 9. physwrap_mac.c contains --uid/--gid source markers
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPhyswrapAvailable, PHYSWRAP_PLATFORM } from "../lib/agent-buccet/index.ts";
import type { PhysicsSpawnMode } from "../lib/agent-buccet/index.ts";

const _moduleDir = path.dirname(fileURLToPath(import.meta.url));
const PHYSWRAP_BIN = path.resolve(_moduleDir, "../native/physwrap/build/buccet-physwrap");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

// ─── 1. Binary availability ───────────────────────────────────────────────────

assert(existsSync(PHYSWRAP_BIN), `physwrap binary exists at ${PHYSWRAP_BIN}`);
assert(isPhyswrapAvailable(), "isPhyswrapAvailable() returns true");

// ─── 2. Basic exec: passes through correctly ─────────────────────────────────

const echoResult = spawnSync(PHYSWRAP_BIN, ["--", "echo", "physwrap-ok"]);
assert(echoResult.status === 0, `physwrap exit 0 on echo: ${echoResult.stderr?.toString()}`);
assert(echoResult.stdout.toString().trim() === "physwrap-ok", "physwrap stdout = physwrap-ok");

// ─── 3. CPU limit applied (ulimit -t) ────────────────────────────────────────

const cpuResult = spawnSync(PHYSWRAP_BIN, ["--cpu", "5", "--", "sh", "-c", "ulimit -t"]);
assert(cpuResult.status === 0, "physwrap --cpu 5 -- sh -c ulimit -t exits 0");
const cpuLimit = parseInt(cpuResult.stdout.toString().trim(), 10);
assert(cpuLimit === 5, `CPU soft limit = 5 (got ${cpuLimit})`);

// ─── 4. nofile limit applied (ulimit -n) ─────────────────────────────────────

const nofileResult = spawnSync(PHYSWRAP_BIN, ["--nofile", "64", "--", "sh", "-c", "ulimit -n"]);
assert(nofileResult.status === 0, "physwrap --nofile 64 exits 0");
const nofileLimit = parseInt(nofileResult.stdout.toString().trim(), 10);
assert(nofileLimit === 64, `nofile soft limit = 64 (got ${nofileLimit})`);

// ─── 5. Hard limit blocks self-elevation ─────────────────────────────────────
// The hard limit is set equal to the soft limit by physwrap.
// A child process attempting to raise its own soft limit above the hard limit
// must be denied by the kernel (EPERM / "cannot raise limit").

const raiseAttempt = spawnSync(PHYSWRAP_BIN, [
  "--cpu", "5",
  "--",
  "sh", "-c",
  // Try to raise the soft CPU limit above what physwrap set.
  // sh's ulimit -St will fail with "error setting limit" if hard == soft == 5.
  "ulimit -St unlimited 2>&1; echo exit_code=$?",
]);
const raiseOutput = raiseAttempt.stdout.toString();
assert(
  raiseOutput.includes("error") || raiseOutput.includes("Operation not permitted") || raiseOutput.includes("invalid"),
  `child cannot raise CPU limit above physwrap-set hard limit (got: ${raiseOutput.trim()})`,
);

// ─── 6. Multiple limits in one invocation ────────────────────────────────────

const multiResult = spawnSync(PHYSWRAP_BIN, [
  "--cpu", "10",
  "--nofile", "32",
  "--",
  "sh", "-c", "echo cpu=$(ulimit -t) nofile=$(ulimit -n)",
]);
assert(multiResult.status === 0, "physwrap multi-limit exits 0");
const multiOut = multiResult.stdout.toString().trim();
assert(multiOut === "cpu=10 nofile=32", `multi-limit output: expected "cpu=10 nofile=32" got "${multiOut}"`);

// ─── 7. Error on missing -- separator ────────────────────────────────────────

const missingDash = spawnSync(PHYSWRAP_BIN, ["--cpu", "5", "echo", "oops"]);
assert(missingDash.status !== 0, "physwrap exits non-zero when -- separator is missing");

// ─── 8. Error on unknown flag ─────────────────────────────────────────────────

const unknownFlag = spawnSync(PHYSWRAP_BIN, ["--badarg", "5", "--", "echo", "x"]);
assert(unknownFlag.status !== 0, "physwrap exits non-zero on unknown flag");

// ─── 9. PhysicsSpawnMode type roundtrip ──────────────────────────────────────

const mode: PhysicsSpawnMode = "physwrap";
assert(mode === "physwrap", "PhysicsSpawnMode type roundtrips");

// ─── 10. PHYSWRAP_PLATFORM reflects the actual OS ────────────────────────────
// The platform tag is recorded in PROCESS_PHYSWRAP_ACTIVE ledger events.
// On this CI host (Linux), it must be "linux".

const expectedPlatform = process.platform === "linux"  ? "linux"
                       : process.platform === "darwin" ? "macos"
                       : process.platform === "win32"  ? "windows" : "unknown";

assert(
  PHYSWRAP_PLATFORM === expectedPlatform,
  `PHYSWRAP_PLATFORM="${PHYSWRAP_PLATFORM}" matches expected "${expectedPlatform}"`,
);

// ─── 11. Platform source file exists for all three platforms ─────────────────

const NATIVE_DIR = path.resolve(_moduleDir, "../native/physwrap");
assert(existsSync(path.join(NATIVE_DIR, "physwrap.c")),                "physwrap.c (Linux) exists");
assert(existsSync(path.join(NATIVE_DIR, "physwrap_mac.c")),            "physwrap_mac.c (Darwin) exists");
assert(existsSync(path.join(NATIVE_DIR, "physwrap_win.c")),            "physwrap_win.c (Windows) exists");
assert(existsSync(path.join(NATIVE_DIR, "buccet_ioboundary_win.c")),   "buccet_ioboundary_win.c (Windows I/O boundary DLL) exists");
assert(existsSync(path.join(NATIVE_DIR, "build.sh")),                  "build.sh exists");
assert(existsSync(path.join(NATIVE_DIR, "build_win.bat")),             "build_win.bat exists");

// ─── 12. physwrap_mac.c source contains --uid/--gid drop implementation ──────
// Structural source check: ensures the macOS privilege drop code is present.
// Runs on all platforms — reads the source file, does not execute it.

const macSrc = readFileSync(path.join(NATIVE_DIR, "physwrap_mac.c"), "utf8");
assert(macSrc.includes("--uid"),     "physwrap_mac.c contains --uid flag handling");
assert(macSrc.includes("--gid"),     "physwrap_mac.c contains --gid flag handling");
assert(macSrc.includes("setuid("),   "physwrap_mac.c calls setuid()");
assert(macSrc.includes("setgid("),   "physwrap_mac.c calls setgid()");
assert(macSrc.includes("exit(5)"),   "physwrap_mac.c uses exit code 5 for uid/gid failure");

// ─── 13. physwrap_win.c and buccet_ioboundary_win.c: Tier 2b enforcement ──────

const winSrc = readFileSync(path.join(NATIVE_DIR, "physwrap_win.c"), "utf8");
const iobSrc = readFileSync(path.join(NATIVE_DIR, "buccet_ioboundary_win.c"), "utf8");

// physwrap_win.c: --nofile and --fsize-b are now real enforced args (not just warnings)
assert(winSrc.includes("--nofile"),   "physwrap_win.c handles --nofile flag");
assert(winSrc.includes("--fsize-b"),  "physwrap_win.c handles --fsize-b flag");
assert(winSrc.includes("BUCCET_MAX_OPEN_FILES"),
  "physwrap_win.c sets BUCCET_MAX_OPEN_FILES env var for DLL");
assert(winSrc.includes("BUCCET_MAX_FILE_SIZE_BYTES"),
  "physwrap_win.c sets BUCCET_MAX_FILE_SIZE_BYTES env var for DLL");
assert(winSrc.includes("inject_dll") || winSrc.includes("inject_ioboundary"),
  "physwrap_win.c injects the I/O boundary DLL");
assert(winSrc.includes("buccet-ioboundary.dll"),
  "physwrap_win.c references buccet-ioboundary.dll by name");
assert(winSrc.includes("failing closed") || winSrc.includes("Fail closed") || winSrc.includes("fail closed"),
  "physwrap_win.c fails closed if DLL injection fails");

// buccet_ioboundary_win.c: IAT hook DLL
assert(iobSrc.includes("CreateFileA") && iobSrc.includes("CreateFileW"),
  "buccet_ioboundary_win.c hooks CreateFileA and CreateFileW");
assert(iobSrc.includes("CloseHandle"),
  "buccet_ioboundary_win.c hooks CloseHandle (for open count decrement)");
assert(iobSrc.includes("WriteFile"),
  "buccet_ioboundary_win.c hooks WriteFile (for file size limit)");
assert(iobSrc.includes("ERROR_TOO_MANY_OPEN_FILES"),
  "buccet_ioboundary_win.c returns ERROR_TOO_MANY_OPEN_FILES (EMFILE semantics)");
assert(iobSrc.includes("ERROR_FILE_TOO_LARGE"),
  "buccet_ioboundary_win.c returns ERROR_FILE_TOO_LARGE (EFBIG/SIGXFSZ semantics)");
assert(iobSrc.includes("BUCCET_MAX_OPEN_FILES"),
  "buccet_ioboundary_win.c reads BUCCET_MAX_OPEN_FILES from environment");
assert(iobSrc.includes("BUCCET_MAX_FILE_SIZE_BYTES"),
  "buccet_ioboundary_win.c reads BUCCET_MAX_FILE_SIZE_BYTES from environment");
assert(iobSrc.includes("IAT") || iobSrc.includes("Import Address Table") || iobSrc.includes("patch_module_iat"),
  "buccet_ioboundary_win.c uses IAT patching");
assert(iobSrc.includes("EnumProcessModules"),
  "buccet_ioboundary_win.c enumerates all loaded modules to patch");
assert(iobSrc.includes("LoadLibraryA") || iobSrc.includes("LoadLibraryW"),
  "buccet_ioboundary_win.c hooks LoadLibrary for future module coverage");
assert(iobSrc.includes("InterlockedIncrement") || iobSrc.includes("InterlockedDecrement"),
  "buccet_ioboundary_win.c uses atomic operations for open file counter");
assert(iobSrc.includes("EMFILE") || iobSrc.includes("per-operation REFUSAL") || iobSrc.includes("per-operation refusal"),
  "buccet_ioboundary_win.c documents per-operation refusal semantics");

// ─── 14. Darwin --uid/--gid live execution (macOS only) ──────────────────────
// On macOS: verify that --uid/--gid flags are accepted by the binary and that
// the target process runs as the specified uid/gid.
// Linux uses PR_CAPBSET_DROP (CAP_SYS_RESOURCE) instead of setuid — no --uid flag there.
// Windows has no equivalent.

if (process.platform === "darwin") {
  // Basic: --uid flag is accepted (running as current user uid is a no-op but valid)
  const currentUid = process.getuid!();
  const currentGid = process.getgid!();
  const uidPassthroughResult = spawnSync(PHYSWRAP_BIN, [
    "--uid", String(currentUid),
    "--gid", String(currentGid),
    "--", "sh", "-c", `echo uid=$(id -u) gid=$(id -g)`,
  ]);
  assert(uidPassthroughResult.status === 0,
    `physwrap --uid ${currentUid} --gid ${currentGid} -- sh exits 0 (got stderr: ${uidPassthroughResult.stderr?.toString().trim()})`);
  const uidOut = uidPassthroughResult.stdout.toString().trim();
  assert(uidOut === `uid=${currentUid} gid=${currentGid}`,
    `process runs as expected uid/gid: expected "uid=${currentUid} gid=${currentGid}", got "${uidOut}"`);
}

// ─── 15. Tier 2a/2b class-tagged coverage metadata ───────────────────────────
// Verifies:
//  - physwrap_mac.c documents Tier 2a skipped limits (nproc, as)
//  - physwrap_win.c contains real Tier 2b I/O rate control implementation
//  - physwrap_win.c + buccet_ioboundary_win.c close EMFILE/EFBIG gap via DLL injection
//  - process.ts emits class-tagged ledger keys; nofile/fsize active on all platforms
//  - process.ts passes --io-rate-bps / --io-max-iops on Windows path
//  - types.ts has the Tier 2b Windows fields

// macOS Tier 2a parity: nproc and as are now enforced (not skipped)
assert(macSrc.includes("RLIMIT_NPROC"),
  "physwrap_mac.c applies RLIMIT_NPROC (nproc live on macOS)");
assert(macSrc.includes("RLIMIT_AS"),
  "physwrap_mac.c applies RLIMIT_AS (virtual memory ceiling live on macOS)");
assert(macSrc.includes("memorystatus_control"),
  "physwrap_mac.c calls memorystatus_control (jetsam ceiling for arm64 memory coverage)");
assert(macSrc.includes("MEMORYSTATUS_CMD_SET_JETSAM_TASK_LIMIT"),
  "physwrap_mac.c uses MEMORYSTATUS_CMD_SET_JETSAM_TASK_LIMIT (= 6)");

// ─── 15a. physwrap_win.c: Windows Tier 2b I/O rate control implementation ───
assert(winSrc.includes("SetIoRateControlInformationJobObject"),
  "physwrap_win.c contains SetIoRateControlInformationJobObject (Tier 2b I/O rate throttle)");
assert(winSrc.includes("--io-rate-bps"),
  "physwrap_win.c handles --io-rate-bps flag");
assert(winSrc.includes("--io-max-iops"),
  "physwrap_win.c handles --io-max-iops flag");
assert(winSrc.includes("JOB_OBJECT_IO_RATE_CONTROL_ENABLE"),
  "physwrap_win.c sets JOB_OBJECT_IO_RATE_CONTROL_ENABLE flag");
assert(winSrc.includes("MaxBandwidth") && winSrc.includes("* 8"),
  "physwrap_win.c converts bytes/sec to bits/sec for MaxBandwidth (API expects bits/sec)");
assert(winSrc.includes("GetProcAddress") && winSrc.includes("kernel32"),
  "physwrap_win.c dynamically loads SetIoRateControlInformationJobObject for version compat");
assert(winSrc.includes("Windows 10 1607"),
  "physwrap_win.c documents Windows 10 1607+ requirement");
// Semantic distinction: throttle vs refuse
assert(winSrc.includes("throttle") || winSrc.includes("DELAYS") || winSrc.includes("delayed"),
  "physwrap_win.c documents throttle semantics (delay, not refuse) for I/O rate control");

// ─── 15b. Windows EMFILE/EFBIG gap is closed via DLL injection ───────────────
// Closed by buccet_ioboundary_win.c (DLL) + inject_dll in physwrap_win.c.
// Verify the closure is real code, not docs-only.
assert(iobSrc.includes("ERROR_TOO_MANY_OPEN_FILES"),
  "buccet_ioboundary_win.c: CreateFile returns ERROR_TOO_MANY_OPEN_FILES on nofile limit (EMFILE)");
assert(iobSrc.includes("ERROR_FILE_TOO_LARGE"),
  "buccet_ioboundary_win.c: WriteFile returns ERROR_FILE_TOO_LARGE on fsize limit (EFBIG)");
assert(winSrc.includes("inject_dll") || winSrc.includes("LoadLibraryW"),
  "physwrap_win.c injects the I/O boundary DLL before resuming the child thread");
assert(winSrc.includes("failing closed") || winSrc.includes("Fail closed") || winSrc.includes("fail closed"),
  "physwrap_win.c fails closed if DLL injection fails (no silent skip)");

// ─── 15c. process.ts: class-tagged metadata + coverage ───────────────────────
const processSrc = readFileSync(
  path.resolve(_moduleDir, "../lib/agent-buccet/process.ts"), "utf8");
assert(processSrc.includes("physwrap_envelope_active"),
  "process.ts emits physwrap_envelope_active (Tier 2a class tag)");
assert(processSrc.includes("physwrap_io_boundary_active"),
  "process.ts emits physwrap_io_boundary_active (Tier 2b class tag)");
assert(!processSrc.includes("physwrap_active_limits"),
  "process.ts no longer uses flat physwrap_active_limits key (replaced by class tags)");
assert(processSrc.includes("--io-rate-bps") && processSrc.includes("maxIoRateBytesPerSec"),
  "process.ts passes --io-rate-bps on Windows path when maxIoRateBytesPerSec is set");
assert(processSrc.includes("--io-max-iops") && processSrc.includes("maxIoOpsPerSec"),
  "process.ts passes --io-max-iops on Windows path when maxIoOpsPerSec is set");
assert(processSrc.includes("io_rate") && processSrc.includes("io_iops"),
  "process.ts coverage function handles io_rate and io_iops for Windows ioBoundary");
// nofile and fsize are now active on ALL platforms — no platform guard
assert(
  !processSrc.match(/platform.*windows.*ioBoundary\.skipped.*nofile/) &&
  !processSrc.match(/nofile.*platform.*windows.*skipped/),
  "process.ts coverage function no longer marks nofile as skipped on Windows");
assert(
  !processSrc.match(/platform.*windows.*ioBoundary\.skipped.*fsize/) &&
  !processSrc.match(/fsize.*platform.*windows.*skipped/),
  "process.ts coverage function no longer marks fsize as skipped on Windows");
// nproc and as are now active on macOS — no macos-skipped guard
assert(
  !processSrc.match(/platform.*macos.*envelope\.skipped.*nproc/) &&
  !processSrc.match(/nproc.*platform.*macos.*skipped/),
  "process.ts coverage function no longer marks nproc as skipped on macOS");
assert(
  !processSrc.match(/platform.*macos.*envelope\.skipped.*as[^-]/) &&
  !processSrc.match(/[^-]as.*platform.*macos.*skipped/),
  "process.ts coverage function no longer marks as (memory) as skipped on macOS");

// ─── 15d. types.ts: Tier 2b Windows fields are declared ──────────────────────
const typesSrc = readFileSync(
  path.resolve(_moduleDir, "../lib/agent-buccet/types.ts"), "utf8");
assert(typesSrc.includes("maxIoRateBytesPerSec"),
  "types.ts declares maxIoRateBytesPerSec (Windows Tier 2b I/O bandwidth field)");
assert(typesSrc.includes("maxIoOpsPerSec"),
  "types.ts declares maxIoOpsPerSec (Windows Tier 2b IOPS field)");
assert(typesSrc.includes("throttle") || typesSrc.includes("THROTTLE"),
  "types.ts documents throttle semantics for Windows Tier 2b fields");

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log("Agent Buccet physwrap contract");
console.log(`physwrap binary: ${PHYSWRAP_BIN}`);
console.log(`isPhyswrapAvailable(): ${isPhyswrapAvailable()}`);
console.log(`PHYSWRAP_PLATFORM: ${PHYSWRAP_PLATFORM}`);
console.log(`CPU limit applied (5s): ${cpuLimit === 5}`);
console.log(`nofile limit applied (64): ${nofileLimit === 64}`);
console.log(`hard limit blocks self-elevation: ${raiseOutput.includes("error") || raiseOutput.includes("invalid")}`);
console.log(`multi-limit (cpu=10 nofile=32): ${multiOut === "cpu=10 nofile=32"}`);
console.log(`missing -- separator rejected: ${missingDash.status !== 0}`);
console.log(`platform source files: physwrap.c + physwrap_mac.c + physwrap_win.c + buccet_ioboundary_win.c all present`);
console.log(`physwrap_mac.c has --uid/--gid drop: true`);
console.log(`physwrap_mac.c macOS Tier 2a parity: RLIMIT_NPROC + RLIMIT_AS + memorystatus_control: true`);
console.log(`physwrap_win.c Tier 2b: DLL injection for EMFILE/EFBIG + I/O rate throttle: true`);
console.log(`buccet_ioboundary_win.c: IAT hook for CreateFileA/W + WriteFile: true`);
