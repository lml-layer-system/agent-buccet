/**
 * Pure, testable MCP host configuration selection for Buccet Box.
 *
 * The desktop app owns the installer experience, NOT approval authority.
 * In packaged mode the app itself supplies a Node runtime via
 * ELECTRON_RUN_AS_NODE and launches the bundled, versioned OSS runtime.
 */
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function chooseBoxRuntimeLaunch({
  packaged,
  executable,
  resourcesPath,
  home,
  sourceRoot,
  findExecutable,
  exists = existsSync,
}) {
  if (packaged) {
    // Do not fall back to an arbitrary PATH executable: that would let an
    // installed but outdated `buccet` silently replace the bundled runtime.
    const cli = path.join(resourcesPath, "agent-buccet", "bin", "buccet.ts");
    const bridge = path.join(resourcesPath, "agent-buccet", "src", "box", "bridge.ts");
    if (!exists(cli) || !exists(bridge)) {
      return { ok: false, error: "The bundled Buccet runtime is missing or incomplete. Reinstall the Box." };
    }
    return {
      ok: true,
      spec: {
        command: executable,
        args: [cli, "mcp"],
        env: {
          ELECTRON_RUN_AS_NODE: "1",
          AGENT_BUCCET_HOME: home,
          // Child daemons spawned by the CLI must also use this runtime.
          BUCCET_DAEMON_EXEC: executable,
        },
      },
    };
  }

  const binary = findExecutable("buccet");
  if (binary) return { ok: true, spec: { command: binary, args: ["mcp"] } };

  const node = findExecutable("node");
  const cli = path.join(sourceRoot, "cli", "buccet.ts");
  if (node && exists(cli)) {
    return { ok: true, spec: { command: node, args: [cli, "mcp"], env: { AGENT_BUCCET_HOME: home } } };
  }
  return {
    ok: false,
    error: "Buccet runtime not found. Use the packaged desktop app or install the public OSS runtime.",
  };
}

export function mergeBoxHostConfig(original, spec) {
  if (!original || typeof original !== "object" || Array.isArray(original)) {
    throw new Error("Host MCP config must be a JSON object");
  }
  if (!original.mcpServers) {
    original.mcpServers = {};
  }
  if (typeof original.mcpServers !== "object" || Array.isArray(original.mcpServers)) {
    throw new Error("The host's mcpServers field is invalid; no changes were made");
  }
  // Preserve every unrelated server. Replace only a Buccet entry after
  // explicit human approval in the native dialog.
  return {
    ...original,
    mcpServers: {
      ...original.mcpServers,
      buccet: spec,
    },
  };
}

export function macBoxApplicationsDirectory() {
  return path.join(os.homedir(), "Applications");
}
