/**
 * Unprivileged Buccet -> independent root-controlled approval gate transport.
 * The requester gets NO broker credentials or ability to approve its proposal.
 * The gate's operator.sock is a distinct root-only OS capability.
 */
import net from "node:net";
import path from "node:path";
import { lstatSync } from "node:fs";

const MAX_BYTES = 8 * 1024 * 1024;
function deny(reason: string): never {
  throw new Error("BUCCET_FS_DENIED: operator gate " + reason);
}
function trustedPublicGate(socketPath: string, managedRoot: string): void {
  if (process.platform !== "linux") deny("unsupported platform");
  if (!path.isAbsolute(managedRoot) || path.normalize(managedRoot) !== managedRoot ||
      managedRoot === "/" || !path.isAbsolute(socketPath) ||
      path.normalize(socketPath) !== socketPath ||
      path.basename(socketPath) !== "request.sock") {
    deny("invalid protected root or gate path");
  }
  let ancestor = "/";
  for (const segment of path.dirname(socketPath).slice(1).split("/")) {
    if (!segment || segment === "." || segment === "..") deny("invalid gate ancestor");
    ancestor = path.join(ancestor, segment);
    let st;
    try { st = lstatSync(ancestor); } catch { deny("operator gate unavailable"); }
    if (!st.isDirectory() || st.isSymbolicLink() ||
        st.uid !== 0 || (st.mode & 0o022) !== 0) {
      deny("gate parent is mutable by an untrusted process");
    }
  }
  let socket;
  try { socket = lstatSync(socketPath); } catch { deny("request socket unavailable"); }
  if (!socket.isSocket() || socket.uid !== 0 ||
      (socket.mode & 0o022) !== 0 || (socket.mode & 0o600) !== 0o600) {
    // Root-owned 0666 UNIX socket is intentionally reachable for REQUESTS,
    // never for operator decisions. Its root-owned parent prevents replacement.
    deny("untrusted or inaccessible request socket");
  }
}
export async function runProtectedApprovalGate(
  argv: string[], content: string | undefined,
  socketPath: string, managedRoot: string,
): Promise<string> {
  if (argv.length !== 3 && argv.length !== 5) deny("incorrect actuator arguments");
  const [op, fromRoot, relative, toRoot, toRelative] = argv;
  if (fromRoot !== managedRoot || (op === "move" && toRoot !== managedRoot) ||
      (op === "move" ? argv.length !== 5 : argv.length !== 3)) {
    deny("path law root differs from privileged managed root");
  }
  if (!["read","write","append","delete","mkdir","move"].includes(op) ||
      typeof relative !== "string" || !relative ||
      (op === "move" && (typeof toRelative !== "string" || !toRelative))) {
    deny("invalid requested operation");
  }
  if (content !== undefined && Buffer.byteLength(content) > MAX_BYTES) {
    deny("payload exceeds bound");
  }
  trustedPublicGate(socketPath, managedRoot);
  const request: Record<string, string> = { op, path: relative };
  if (op === "move") request.to = toRelative!;
  if (op === "write" || op === "append") request.content = content ?? "";
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ path: socketPath });
    let settled = false, reply = "";
    const timer = setTimeout(() => finish(new Error("privileged approval expired")), 70_000);
    timer.unref();
    function finish(error?: Error, output?: string) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error); else resolve(output ?? "");
    }
    socket.once("connect", () => socket.write(JSON.stringify(request) + "\n"));
    socket.on("data", (chunk: Buffer) => {
      reply += chunk.toString("utf8");
      if (Buffer.byteLength(reply) > MAX_BYTES + 8192) {
        finish(new Error("privileged approval response too large"));
      }
    });
    socket.once("end", () => {
      try {
        const parsed = JSON.parse(reply.split("\n",1)[0]) as {
          ok?: boolean; output?: string; error?: string;
        };
        if (parsed?.ok !== true || typeof parsed.output !== "string") {
          throw Error("independent privileged operator denied: " +
            String(parsed?.error ?? "no valid decision").slice(0, 250));
        }
        finish(undefined, parsed.output);
      } catch (error) {
        finish(new Error("BUCCET_FS_DENIED: " +
          (error instanceof Error ? error.message : "malformed operator decision")));
      }
    });
    socket.once("error", error => finish(new Error(
      "BUCCET_FS_DENIED: protected approval gate unavailable: " + error.message)));
    socket.once("close", () => {
      if (!settled) finish(new Error("BUCCET_FS_DENIED: operator gate disconnected"));
    });
  });
}
