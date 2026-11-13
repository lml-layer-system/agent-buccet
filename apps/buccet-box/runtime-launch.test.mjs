import assert from "node:assert/strict";
import test from "node:test";
import { chooseBoxRuntimeLaunch, mergeBoxHostConfig } from "./runtime-launch.mjs";

const bundled = {
  packaged: true,
  executable: "/Applications/Buccet Box.app/Contents/MacOS/Buccet Box",
  resourcesPath: "/Applications/Buccet Box.app/Contents/Resources",
  home: "/Users/alex/.buccet",
  sourceRoot: "/source",
  findExecutable: () => null,
};

test("packaged app connects via its own bundled OSS CLI without PATH or global install", () => {
  const result = chooseBoxRuntimeLaunch({
    ...bundled,
    exists: (p) =>
      p === "/Applications/Buccet Box.app/Contents/Resources/agent-buccet/bin/buccet.ts" ||
      p === "/Applications/Buccet Box.app/Contents/Resources/agent-buccet/src/box/bridge.ts",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.spec, {
    command: bundled.executable,
    args: ["/Applications/Buccet Box.app/Contents/Resources/agent-buccet/bin/buccet.ts", "mcp"],
    env: {
      ELECTRON_RUN_AS_NODE: "1",
      AGENT_BUCCET_HOME: bundled.home,
      BUCCET_DAEMON_EXEC: bundled.executable,
    },
  });
});

test("missing bundled runtime fails closed, never silently swaps to a PATH binary", () => {
  const result = chooseBoxRuntimeLaunch({
    ...bundled,
    exists: () => false,
    findExecutable: () => "/malicious/old/buccet",
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /missing or incomplete/);
});

test("developer mode can use an installed CLI or Node checkout, with correct precedence", () => {
  const basic = {
    ...bundled,
    packaged: false,
    findExecutable: (name) =>
      name === "buccet" ? "/Users/alex/.local/bin/buccet" : "/opt/homebrew/bin/node",
    exists: () => true,
  };
  assert.deepEqual(chooseBoxRuntimeLaunch(basic).spec, {
    command: "/Users/alex/.local/bin/buccet",
    args: ["mcp"],
  });
  const checkout = chooseBoxRuntimeLaunch({
    ...basic,
    findExecutable: (name) => name === "node" ? "/opt/homebrew/bin/node" : null,
  });
  assert.deepEqual(checkout.spec, {
    command: "/opt/homebrew/bin/node",
    args: ["/source/cli/buccet.ts", "mcp"],
    env: { AGENT_BUCCET_HOME: bundled.home },
  });
});

test("MCP host config changes only the Buccet entry and leaves other servers untouched", () => {
  const existing = {
    mcpServers: {
      other: { command: "python", args: ["service.py"] },
      buccet: { command: "old-buccet", args: ["mcp"] },
    },
    unrelated: { theme: "dark" },
  };
  const result = mergeBoxHostConfig(existing, { command: "bundled", args: ["mcp"] });
  assert.deepEqual(result.mcpServers.other, { command: "python", args: ["service.py"] });
  assert.deepEqual(result.mcpServers.buccet, { command: "bundled", args: ["mcp"] });
  assert.deepEqual(result.unrelated, existing.unrelated);
});
test("malformed host configs are rejected rather than erased", () => {
  assert.throws(() => mergeBoxHostConfig([], { command: "buccet" }), /object/);
  assert.throws(() => mergeBoxHostConfig({ mcpServers: [] }, { command: "buccet" }), /invalid/);
});
