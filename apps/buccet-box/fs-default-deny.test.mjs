/**
 * FS-BOUNDARY-01: no installed broker means NO real filesystem effects.
 * Negative cases use disposable files; positive protected execution is
 * covered by native-broker-api-test.mjs and frontier-protected-races.mjs.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeScopedFileTool } from "../../src/box/confined-fs.ts";

test("filesystem tools never silently downgrade to unprotected same-UID native execution", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "buccet-fs-default-deny-"));
  const target = path.join(temp, "sentinel.txt");
  const original = "UNCHANGED";
  const vars = [
    "AGENT_BUCCET_REQUIRE_ISOLATED_FS", "AGENT_BUCCET_ALLOW_UNISOLATED_FS",
    "AGENT_BUCCET_FS_BROKER_ROOT", "AGENT_BUCCET_FS_BROKER_SOCKET",
  ];
  const saved = Object.fromEntries(vars.map(key => [key, process.env[key]]));
  const law = [{
    lawId: "TEST.DEFAULT.FAIL.CLOSED",
    rootPath: temp,
    grantedActions: ["fs.read", "fs.write", "fs.append", "fs.move", "fs.mkdir", "fs.delete"],
  }];
  async function denyAndVerify(reason) {
    await assert.rejects(
      executeScopedFileTool("write_file",
        { path: target, content: "ATTACKED" }, law), /BUCCET_FS_DENIED/,
      reason,
    );
    assert.equal(await readFile(target, "utf8"), original,
      "failed isolation attempted a write");
  }
  try {
    await writeFile(target, original);
    for (const key of vars) delete process.env[key];
    await denyAndVerify("default must not run same-user native guard");
    process.env.AGENT_BUCCET_REQUIRE_ISOLATED_FS = "1";
    await denyAndVerify("explicit isolation requirement without broker must fail");
    process.env.AGENT_BUCCET_ALLOW_UNISOLATED_FS = "1";
    await denyAndVerify("legacy permission cannot override host isolation requirement");
    delete process.env.AGENT_BUCCET_REQUIRE_ISOLATED_FS;
    delete process.env.AGENT_BUCCET_ALLOW_UNISOLATED_FS;
    process.env.AGENT_BUCCET_FS_BROKER_ROOT = temp;
    await denyAndVerify("a configured root without trusted broker must fail");
    process.env.AGENT_BUCCET_FS_BROKER_SOCKET = path.join(temp, "missing.sock");
    await denyAndVerify("a fake broker must not revert to direct guard");
    console.log("FS_DEFAULT_DENY_PASS", JSON.stringify({
      deniedModes: 5, defaultDirectExecutionDisabled: true,
      legacyMustBeExplicitlyOptedIn: true, sentinelIntact: true,
    }));
  } finally {
    for (const key of vars) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    await rm(temp, { recursive: true, force: true });
  }
});
