/**
 * Trusted-controller transport to the privileged native filesystem broker.
 *
 * SECURITY BOUNDARY
 * - The calling process must be the separately protected controller principal.
 * - The broker socket and its parent are root-owned and inaccessible to agents.
 * - The native actuator's managed root is NOT an arbitrary caller-selected root.
 * - Any missing credential, broker, platform, or malformed reply fails CLOSED.
 *
 * This file does not authenticate untrusted agents. Bodyguard/UPL must have
 * authorized the exact action before the trusted controller calls it.
 */
import net from "node:net";
import path from "node:path";

const LIMIT = 8 * 1024 * 1024;
const MAX_RESPONSE_BYTES = LIMIT + 16 * 1024;

export type ProtectedOperation = "read" | "write" | "append" | "delete" | "mkdir" | "move";

export function requireProtectedRoot(root: string): {
  root: string; socket: string;
} {
  if (process.platform !== "linux") {
    throw new Error("BUCCET_FS_DENIED: protected broker is unavailable on this operating system");
  }
  // With the current root-only broker socket, only a distinct trusted root
  // controller can request effects. Never elevate an agent to make this pass.
  if (process.geteuid?.() !== 0) {
    throw new Error("BUCCET_FS_DENIED: protected broker requires trusted controller identity");
  }
  const configuredRoot = process.env.BUCCET_FS_BROKER_ROOT;
  const socket = process.env.BUCCET_FS_BROKER_SOCKET;
  if (!configuredRoot || !socket ||
      !path.isAbsolute(configuredRoot) ||
      path.normalize(configuredRoot) !== configuredRoot ||
      configuredRoot === "/" || root !== configuredRoot ||
      !path.isAbsolute(socket) || path.normalize(socket) !== socket ||
      path.dirname(socket) !== configuredRoot) {
    throw new Error("BUCCET_FS_DENIED: authorized scope does not match protected broker root");
  }
  return { root: configuredRoot, socket };
}

export async function executeProtectedBroker(
  socketPath: string, request: {
    op: ProtectedOperation;
    path: string;
    to?: string;
    content?: string;
  },
): Promise<string> {
  if (typeof request.path !== "string" || !request.path ||
      request.path.startsWith("/") ||
      request.path.split("/").some((segment) => !segment || segment === "." || segment === "..") ||
      Buffer.byteLength(request.path, "utf8") > 4096 ||
      (request.to !== undefined &&
        (typeof request.to !== "string" || !request.to ||
          request.to.startsWith("/") ||
          request.to.split("/").some((segment) => !segment || segment === "." || segment === "..") ||
          Buffer.byteLength(request.to, "utf8") > 4096)) ||
      (request.content !== undefined && Buffer.byteLength(request.content, "utf8") > LIMIT)) {
    throw new Error("BUCCET_FS_DENIED: malformed protected broker request");
  }
  const payload = JSON.stringify(request) + "\n";
  if (Buffer.byteLength(payload) > LIMIT + 8192) {
    throw new Error("BUCCET_FS_DENIED: protected broker request too large");
  }
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ path: socketPath });
    let finished = false;
    let data = "";
    const finalize = (error?: Error, output = "") => {
      if (finished) return;
      finished = true;
      client.destroy();
      if (error) reject(error);
      else resolve(output);
    };
    client.setTimeout(16000, () =>
      finalize(new Error("BUCCET_FS_DENIED: protected broker request timeout")));
    client.on("connect", () => client.write(payload));
    client.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf8");
      if (Buffer.byteLength(data, "utf8") > MAX_RESPONSE_BYTES) {
        finalize(new Error("BUCCET_FS_DENIED: protected broker output too large"));
      }
    });
    client.on("error", (error) =>
      finalize(new Error("BUCCET_FS_DENIED: protected broker unavailable: " + error.message)));
    client.on("end", () => {
      try {
        const line = data.split("\n", 1)[0];
        const parsed: unknown = JSON.parse(line ?? "");
        if (!parsed || typeof parsed !== "object") throw Error("invalid broker receipt");
        const result = parsed as { ok?: unknown; output?: unknown; error?: unknown };
        if (result.ok !== true || typeof result.output !== "string") {
          throw Error(typeof result.error === "string"
            ? result.error.slice(0, 512) : "broker denied request");
        }
        if (Buffer.byteLength(result.output, "utf8") > LIMIT) {
          throw Error("broker response exceeds output limit");
        }
        finalize(undefined, result.output);
      } catch (error) {
        finalize(new Error("BUCCET_FS_DENIED: " +
          (error instanceof Error ? error.message : "unverified broker response")));
      }
    });
    client.on("close", () => {
      if (!finished) finalize(new Error("BUCCET_FS_DENIED: broker disconnected without verified response"));
    });
  });
}
