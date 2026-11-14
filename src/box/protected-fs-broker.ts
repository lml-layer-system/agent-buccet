/**
 * Client-side transport for an independently owned filesystem broker.
 *
 * Only a trusted controller principal with access to a root-owned mode-0600
 * socket should use this. An untrusted agent process is deliberately unable
 * to connect. This is a strict opt-in path pending installer/broker deployment.
 */
import net from "node:net";
import path from "node:path";
import { lstatSync } from "node:fs";

const MAX_BYTES = 8 * 1024 * 1024;
function deny(reason: string): never {
  throw new Error("BUCCET_FS_DENIED: protected broker " + reason);
}
function checkProtectedAncestors(directory: string): void {
  if (!path.isAbsolute(directory) || path.normalize(directory) !== directory) {
    deny("path must be absolute and normalized");
  }
  let current = "/";
  for (const component of directory.slice(1).split("/").filter(Boolean)) {
    current = path.join(current, component);
    const stat = lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== 0 ||
        (stat.mode & 0o022) !== 0) {
      deny("path contains an untrusted owner or writable ancestor");
    }
  }
}
function brokerIdentity(socketPath: string, managedRoot: string): void {
  if (!path.isAbsolute(socketPath) || !path.isAbsolute(managedRoot) ||
      path.dirname(socketPath) !== managedRoot ||
      path.normalize(socketPath) !== socketPath) {
    deny("socket and root mismatch");
  }
  checkProtectedAncestors(managedRoot);
  const socket = lstatSync(socketPath);
  if (!socket.isSocket() || socket.uid !== 0 || (socket.mode & 0o077) !== 0) {
    deny("socket lacks trusted root owner or exclusive access");
  }
}
export async function runProtectedFilesystemBroker(
  argv: string[], content: string | undefined, socketPath: string, managedRoot: string,
): Promise<string> {
  if (process.platform !== "linux") deny("platform has no verified OS broker");
  if (typeof socketPath !== "string" || typeof managedRoot !== "string") {
    deny("configuration incomplete");
  }
  if (argv.length !== 3 && argv.length !== 5) deny("invalid actuator arguments");
  const [op, sourceRoot, relative, destRoot, destRelative] = argv;
  if (sourceRoot !== managedRoot || (op === "move" && destRoot !== managedRoot)) {
    deny("path law root differs from protected broker root");
  }
  if (op === "move" ? argv.length !== 5 : argv.length !== 3) {
    deny("operation has incorrect argument count");
  }
  if (!["read", "write", "append", "delete", "mkdir", "move"].includes(op)) {
    deny("unregistered operation");
  }
  if (content !== undefined && Buffer.byteLength(content) > MAX_BYTES) deny("payload too large");
  brokerIdentity(socketPath, managedRoot);
  const request: Record<string, string> = { op, path: relative };
  if (op === "move") request.to = destRelative;
  if (op === "write" || op === "append") request.content = content ?? "";
  return new Promise<string>((resolve, reject) => {
    const socket = net.connect(socketPath);
    let response = "";
    let completed = false;
    const finish = (error?: Error, output?: string) => {
      if (completed) return;
      completed = true;
      clearTimeout(clock);
      socket.destroy();
      if (error) reject(error); else resolve(output ?? "");
    };
    const clock = setTimeout(() => finish(
      new Error("BUCCET_FS_DENIED: protected broker timed out")), 16_000);
    clock.unref();
    socket.once("connect", () => socket.write(JSON.stringify(request) + "\n"));
    socket.on("data", chunk => {
      response += chunk.toString("utf8");
      if (Buffer.byteLength(response) > MAX_BYTES + 4096) {
        finish(new Error("BUCCET_FS_DENIED: protected broker response too large"));
      }
    });
    socket.on("end", () => {
      try {
        const raw = JSON.parse(response.split("\n")[0]) as {
          ok?: boolean; output?: string; error?: string;
        };
        if (!raw.ok || typeof raw.output !== "string") {
          throw new Error("BUCCET_FS_DENIED: protected broker refused: " +
            String(raw.error ?? "unknown refusal").slice(0, 512));
        }
        finish(undefined, raw.output);
      } catch (error) {
        finish(error instanceof Error ? error : new Error("BUCCET_FS_DENIED: invalid broker result"));
      }
    });
    socket.once("error", error => finish(new Error(
      "BUCCET_FS_DENIED: protected broker connection failed: " + error.message)));
  });
}
