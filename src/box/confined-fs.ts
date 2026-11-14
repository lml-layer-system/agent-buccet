/**
 * Scoped filesystem actuator. Bodyguard/UPL decides authority; this layer
 * performs effects relative to pinned directory fds. Missing guard => deny.
 * Not an OS-wide sandbox.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BoundaryActionKind, BoundaryPathLaw } from "../runtime/types.ts";
import { runProtectedFilesystemBroker } from "./protected-fs-broker.ts";

const toolActions: Record<string, BoundaryActionKind> = {
  read_file: "fs.read", write_file: "fs.write", append_file: "fs.append",
  delete_file: "fs.delete", make_directory: "fs.mkdir", move_file: "fs.move",
};
const guardBinary = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), "../../native/build/box-fs-guard",
);
const MAX_IO_BYTES = 8 * 1024 * 1024;
const MAX_PATH_BYTES = 4096;

function takeString(data: Record<string, unknown>, key: string): string {
  const result = data[key];
  if (typeof result !== "string" || !result || result.includes("\0") ||
      Buffer.byteLength(result) > MAX_PATH_BYTES) {
    throw new Error("BUCCET_FS_DENIED: invalid " + key);
  }
  return result;
}

function scopedPath(target: string, action: BoundaryActionKind, laws: BoundaryPathLaw[]) {
  if (!path.isAbsolute(target) || target.split(path.sep).includes("..")) {
    throw new Error("BUCCET_FS_DENIED: target is not a clean absolute path");
  }
  const now = Date.now();
  const candidates = laws
    .filter((law) => !law.revokedAt && law.grantedActions.includes(action) &&
      (!law.expiresAt || Date.parse(law.expiresAt) > now))
    .map((law) => {
      const root = path.resolve(law.rootPath);
      const relative = path.relative(root, target);
      return { root, relative };
    })
    .filter(({ root, relative }) =>
      path.isAbsolute(root) && relative.length > 0 && !path.isAbsolute(relative) &&
      relative !== ".." && !relative.startsWith(".." + path.sep))
    .sort((a, b) => b.root.length - a.root.length);
  const selected = candidates[0];
  if (!selected) throw new Error("BUCCET_FS_DENIED: no active scoped path authority");
  return selected;
}

function runGuard(args: string[], content?: string): Promise<string> {
  const brokerSocket = process.env.AGENT_BUCCET_FS_BROKER_SOCKET;
  const brokerRoot = process.env.AGENT_BUCCET_FS_BROKER_ROOT;
  const isolationRequired = process.env.AGENT_BUCCET_REQUIRE_ISOLATED_FS === "1";
  if (isolationRequired || brokerSocket || brokerRoot) {
    if (!brokerSocket || !brokerRoot) {
      throw new Error("BUCCET_FS_DENIED: trusted filesystem broker required but unavailable");
    }
    // No direct-execution fallback after a broker was requested. A failed
    // credential check, unsupported OS or missing daemon is a denial.
    return runProtectedFilesystemBroker(args, content, brokerSocket, brokerRoot);
  }
  // Compatibility-only legacy path. This is NOT the final security boundary
  // against an adversarial process sharing the executor's OS identity.
  if (process.platform === "win32" || !existsSync(guardBinary)) {
    throw new Error("BUCCET_FS_DENIED: native filesystem guard unavailable");
  }
  if (content !== undefined && Buffer.byteLength(content, "utf8") > MAX_IO_BYTES) {
    throw new Error("BUCCET_FS_DENIED: input size exceeds confined actuator limit");
  }
  return new Promise((resolve, reject) => {
    const child = spawn(guardBinary, args, {
      stdio: ["pipe", "pipe", "pipe"], env: { PATH: "/usr/bin:/bin", LANG: "C" },
    });
    let output = "";
    let errorOutput = "";
    let exceeded = false;
    let settled = false;
    const complete = (err?: Error) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(output);
    };
    const clock = setTimeout(() => {
      child.kill("SIGKILL");
      complete(new Error("BUCCET_FS_DENIED: filesystem actuator timed out"));
    }, 15_000);
    clock.unref();
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
      if (Buffer.byteLength(output, "utf8") > MAX_IO_BYTES) {
        exceeded = true;
        child.kill("SIGKILL");
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      errorOutput += chunk.toString("utf8").slice(0, 512);
      if (errorOutput.length > 2048) errorOutput = errorOutput.slice(0, 2048);
    });
    child.on("error", (error) => {
      clearTimeout(clock);
      complete(new Error("BUCCET_FS_DENIED: actuator failed: " + error.message));
    });
    child.on("close", (code) => {
      clearTimeout(clock);
      if (exceeded) return complete(new Error("BUCCET_FS_DENIED: read output too large"));
      if (code !== 0) return complete(new Error(
        errorOutput.trim() || "BUCCET_FS_DENIED: actuator exit " + code,
      ));
      complete();
    });
    if (content === undefined) child.stdin.end();
    else child.stdin.end(content);
    child.stdin.on("error", () => {});
  });
}

/** Called exclusively AFTER canonical Bodyguard authorizes execution. */
export async function executeScopedFileTool(
  toolName: string, input: Record<string, unknown>, pathLaws: BoundaryPathLaw[],
): Promise<string> {
  const action = toolActions[toolName];
  if (!action) throw new Error("BUCCET_FS_DENIED: unregistered filesystem operation");

  if (toolName === "move_file") {
    const from = takeString(input, "from");
    const to = takeString(input, "to");
    const source = scopedPath(from, action, pathLaws);
    const destination = scopedPath(to, action, pathLaws);
    await runGuard(["move", source.root, source.relative, destination.root, destination.relative]);
    return "Moved " + from + " → " + to;
  }
  const target = takeString(input, "path");
  const scope = scopedPath(target, action, pathLaws);
  if (toolName === "read_file") return runGuard(["read", scope.root, scope.relative]);
  if (toolName === "write_file" || toolName === "append_file") {
    const content = input.content;
    if (typeof content !== "string") {
      throw new Error("BUCCET_FS_DENIED: file payload must be a string");
    }
    await runGuard([toolName === "write_file" ? "write" : "append", scope.root, scope.relative], content);
    return (toolName === "write_file" ? "Written " : "Appended ") +
      Buffer.byteLength(content) + " bytes to " + target;
  }
  await runGuard([toolName === "delete_file" ? "delete" : "mkdir", scope.root, scope.relative]);
  return toolName === "delete_file" ? "Deleted " + target : "Created directory " + target;
}
