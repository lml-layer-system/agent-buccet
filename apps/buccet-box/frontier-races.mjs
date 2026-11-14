/**
 * Deterministic native filesystem proving ground. Runs the exact production
 * guard under a test-only LD_PRELOAD renameat barrier with disposable files.
 * Any observed out-of-scope effect or changed approved bytes FAILS this job.
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const temp = await mkdtemp(path.join(os.tmpdir(), "buccet-frontier-races-"));
const helper = path.join(temp, "box-fs-guard");
const preload = path.join(temp, "rename-barrier.so");
const failures = [];
const passed = [];
function compile(args) {
  const r = spawnSync("cc", args, { cwd: root, encoding: "utf8", timeout: 30000 });
  assert.equal(r.status, 0, r.stderr || r.stdout);
}
async function exists(p) { try { await access(p); return true; } catch { return false; } }
async function waitReady(gate) {
  for (let i = 0; i < 850; i++) {
    if (await exists(path.join(gate, "ready"))) return readFile(path.join(gate, "ready"), "utf8");
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error("Timed out waiting for renameat barrier");
}
function report(name, breached, details) {
  console.log(breached ? "FRONTIER_BREACH" : "FRONTIER_PASS", name, JSON.stringify(details));
  (breached ? failures : passed).push({ name, ...details });
}
async function execute(args, { name, input, pause, oldPrefix, attack } = {}) {
  const gate = path.join(temp, "gate-" + name);
  if (pause) await mkdir(gate);
  const proc = spawn(helper, args, {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      PATH: "/usr/bin:/bin", LANG: "C",
      ...(pause ? {
        LD_PRELOAD: preload,
        BUCCET_TEST_RENAME_GATE: gate,
        BUCCET_TEST_OLD_PREFIX: oldPrefix,
      } : {}),
    },
  });
  let stderr = "";
  proc.stderr.on("data", chunk => { stderr += chunk.toString(); });
  const outcome = new Promise((resolve, reject) => {
    proc.once("error", reject);
    proc.once("close", (code, signal) => resolve({ code, signal, stderr }));
  });
  proc.stdin.end(input ?? "");
  if (!pause) return outcome;
  try {
    const oldName = (await waitReady(gate)).trim();
    await attack(oldName);
    await writeFile(path.join(gate, "release"), "continue");
    return await outcome;
  } finally {
    if (!await exists(path.join(gate, "release"))) {
      await writeFile(path.join(gate, "release"), "abort");
      proc.kill("SIGKILL");
    }
  }
}
try {
  assert.equal(process.platform, "linux", "Linux runner required");
  // The shipped guard is now fail-closed on same-UID mutable namespaces.
  // Reproduce the historical code path ONLY with a separate explicitly
  // insecure test build, preserving every original attack and its real effect.
  // This file remains a vulnerability sentinel, not the release acceptance gate.
  const testOnlyLegacy = process.argv.includes("--legacy-unsafe-control");
  compile(["-std=c11", "-O2", "-Wall", "-Wextra", "-Werror",
    ...(testOnlyLegacy ? ["-DBUCCET_INSECURE_TEST_ONLY"] : []),
    path.join(root, "native/box-fs-guard.c"), "-o", helper]);
  compile(["-shared", "-fPIC", "-O2", "-Wall", "-Wextra", "-Werror",
    path.join(root, "apps/buccet-box/frontier-rename-barrier.c"),
    "-o", preload, "-ldl"]);

  const scope = path.join(temp, "authorized");
  const outside = path.join(temp, "outside");
  await mkdir(scope);
  await mkdir(outside);
  const baseline = await execute(["write", scope, "benign.txt"], {
    name: "baseline", input: "AUTHORIZED_CONTENT",
  });
  assert.equal(baseline.code, 0, baseline.stderr);
  assert.equal(await readFile(path.join(scope, "benign.txt"), "utf8"), "AUTHORIZED_CONTENT");
  report("positive control", false, { actualWriteSucceeded: true });

  // The approved bytes are replaced by a malicious regular file immediately
  // before the helper's final renameat(), without changing any UPL law.
  const payload = await execute(["write", scope, "payload.txt"], {
    name: "payload-swap", input: "AUTHORIZED_BYTES", pause: true,
    oldPrefix: ".buccet-fs-",
    attack: async temporary => {
      assert.match(temporary, /^\.buccet-fs-/);
      await unlink(path.join(scope, temporary));
      await writeFile(path.join(scope, temporary), "UNAUTHORIZED_BYTES");
    },
  });
  const actualPayload = await readFile(path.join(scope, "payload.txt"), "utf8");
  report("temp-name content substitution", actualPayload !== "AUTHORIZED_BYTES", {
    approved: "AUTHORIZED_BYTES", executed: actualPayload, exitCode: payload.code,
  });

  // A parent directory was in scope when opened, but is relocated outside
  // the approved root before the helper commits using that pinned fd.
  const parent = path.join(scope, "nested");
  const relocated = path.join(outside, "relocated-parent");
  await mkdir(parent);
  const reparent = await execute(["write", scope, "nested/victim.txt"], {
    name: "directory-reparent", input: "WRITTEN_OUTSIDE_SCOPE", pause: true,
    oldPrefix: ".buccet-fs-",
    attack: async () => {
      await rename(parent, relocated);
      await mkdir(parent);
    },
  });
  const outsideWrite = await exists(path.join(relocated, "victim.txt"));
  report("pinned parent moved outside scope during write", outsideWrite, {
    exitCode: reparent.code,
    externalContent: outsideWrite ? await readFile(path.join(relocated, "victim.txt"), "utf8") : null,
    originalScopeReceivedWrite: await exists(path.join(parent, "victim.txt")),
  });

  // Same relocation applied to an approved MOVE destination, not just write.
  const moveParent = path.join(scope, "move-target");
  const movedParent = path.join(outside, "relocated-move-target");
  await mkdir(moveParent);
  await writeFile(path.join(scope, "source.txt"), "MOVE_PAYLOAD");
  const move = await execute(["move", scope, "source.txt", scope, "move-target/destination.txt"], {
    name: "move-reparent", input: "", pause: true,
    oldPrefix: "source.txt",
    attack: async () => {
      await rename(moveParent, movedParent);
      await mkdir(moveParent);
    },
  });
  const escapedMove = await exists(path.join(movedParent, "destination.txt"));
  report("pinned move destination moved outside scope", escapedMove, {
    exitCode: move.code,
    externalContent: escapedMove ? await readFile(path.join(movedParent, "destination.txt"), "utf8") : null,
    requestedDestinationExists: await exists(path.join(moveParent, "destination.txt")),
  });

  // An appending tool may write the correct prefix into the temporary file,
  // but its filename is just as mutable as the new-write case above.
  await writeFile(path.join(scope, "append-base.txt"), "ORIGINAL|");
  const append = await execute(["append", scope, "append-base.txt"], {
    name: "append-temp-swap",
    input: "AUTHORIZED_APPEND",
    pause: true,
    oldPrefix: ".buccet-fs-",
    attack: async temporary => {
      await unlink(path.join(scope, temporary));
      await writeFile(path.join(scope, temporary), "INJECTED_COMPLETE_FILE");
    },
  });
  const appended = await readFile(path.join(scope, "append-base.txt"), "utf8");
  report("append committed attacker-controlled temporary file", appended !== "ORIGINAL|AUTHORIZED_APPEND", {
    expected: "ORIGINAL|AUTHORIZED_APPEND", actual: appended, exitCode: append.code,
  });

  // The move actuator inspects and closes source before renameat. Swapping
  // source in the held interval substitutes an unapproved object into the
  // successful move, even though no path strings change.
  const moveSrc = path.join(scope, "source-replaced.txt");
  await writeFile(moveSrc, "REVIEWED_SOURCE_CONTENT");
  const sourceSwapped = await execute(["move", scope, "source-replaced.txt", scope, "replaced-dest.txt"], {
    name: "move-source-swap", input: "", pause: true, oldPrefix: "source-replaced.txt",
    attack: async () => {
      await unlink(moveSrc);
      await writeFile(moveSrc, "OTHER_BYTES_AFTER_REVIEW");
    },
  });
  const moveResult = await readFile(path.join(scope, "replaced-dest.txt"), "utf8");
  report("move executed different source inode than preflight", moveResult !== "REVIEWED_SOURCE_CONTENT", {
    expected: "REVIEWED_SOURCE_CONTENT", actual: moveResult, exitCode: sourceSwapped.code,
  });

  console.log("FRONTIER_RACE_SUMMARY", JSON.stringify({ passed, breaches: failures }, null, 2));
  if (failures.length) throw new Error("FRONTIER_RACE_FAILED: " + failures.length + " actual integrity/scope failures");
} finally {
  await rm(temp, { force: true, recursive: true });
}
