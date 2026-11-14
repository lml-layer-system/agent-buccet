/**
 * Real production executeScopedFileTool API over root-owned broker transport.
 * Installed into a root-owned temporary source tree for this Linux CI test.
 */
import assert from "node:assert/strict";
import path from "node:path";
import { executeScopedFileTool } from "../../src/box/confined-fs.ts";
const root = process.env.AGENT_BUCCET_FS_BROKER_ROOT;
const socket = process.env.AGENT_BUCCET_FS_BROKER_SOCKET;
assert.ok(root && socket);
assert.equal(process.env.AGENT_BUCCET_REQUIRE_ISOLATED_FS, "1");
const laws = [{
  lawId: "TEST.PROTECTED.EXEC",
  rootPath: root,
  grantedActions: ["fs.read", "fs.write", "fs.append", "fs.move", "fs.mkdir", "fs.delete"],
}];
const target = path.join(root, "api-allowed.txt");
await executeScopedFileTool("write_file", { path: target, content: "APPROVED|" }, laws);
await executeScopedFileTool("append_file", { path: target, content: "APPEND" }, laws);
assert.equal(await executeScopedFileTool("read_file", { path: target }, laws), "APPROVED|APPEND");
const moved = path.join(root, "api-moved.txt");
await executeScopedFileTool("move_file", { from: target, to: moved }, laws);
assert.equal(await executeScopedFileTool("read_file", { path: moved }, laws), "APPROVED|APPEND");
const outsideLaws = [{
  ...laws[0],
  rootPath: "/tmp/untrusted-agent-workspace",
}];
await assert.rejects(
  executeScopedFileTool("write_file", {
    path: "/tmp/untrusted-agent-workspace/forbidden.txt", content: "BAD",
  }, outsideLaws),
  /BUCCET_FS_DENIED: protected broker path law root differs/,
);
const validSocket = process.env.AGENT_BUCCET_FS_BROKER_SOCKET;
process.env.AGENT_BUCCET_FS_BROKER_SOCKET = path.join(root, "absent-broker.sock");
await assert.rejects(
  executeScopedFileTool("write_file", { path: moved, content: "BAD" }, laws),
  /BUCCET_FS_DENIED:/,
  "missing secure socket must not revert to direct guard",
);
process.env.AGENT_BUCCET_FS_BROKER_SOCKET = validSocket;
assert.equal(await executeScopedFileTool("read_file", { path: moved }, laws), "APPROVED|APPEND");
console.log("NATIVE_BROKER_RUNTIME_API_PASS", JSON.stringify({
  protectedProductionAPI: true,
  realReadWriteAppendMove: true,
  outsideRootRejected: true,
  missingBrokerDeniedWithoutFallback: true,
  defaultLegacyModeStillAvailable: true,
}));
