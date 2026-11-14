/**
 * Proof-of-possession for a host registered by an independent root principal.
 *
 * The trusted launcher passes the 256-bit host secret over an inherited
 * descriptor, never in argv or the environment. A self-declared actor or
 * session string is not proof. The root-owned gate checks each HMAC against
 * its own protected registry, independently of the caller's session files.
 *
 * Same-UID ptrace/fd theft is outside this proof alone: the registered host
 * must be OS-separated from hostile agent processes for that threat model.
 */
import { createHmac, randomBytes } from "node:crypto";
import { readSync } from "node:fs";

type HostProof = { sessionId: string; actorId: string; key: Buffer };
let hostProof: HostProof | null = null;

export type ProtectedHostAttestation = {
  sessionId: string; actorId: string;
  issuedAt: string; nonce: string; mac: string;
};

export function configureProtectedFilesystemHost(args: {
  sessionId: string; actorId: string; fd: number;
}): void {
  if (hostProof) {
    throw new Error("BUCCET_HOST_DENIED: host identity already initialized");
  }
  if (!args.sessionId || !args.actorId || args.sessionId.length > 200 ||
      args.actorId.length > 200 ||
      !Number.isSafeInteger(args.fd) || args.fd < 3 || args.fd > 1024) {
    throw new Error("BUCCET_HOST_DENIED: invalid protected launcher identity or descriptor");
  }
  const bytes = Buffer.alloc(66);
  let offset = 0;
  try {
    while (offset < bytes.length) {
      const n = readSync(args.fd, bytes, offset, bytes.length - offset, null);
      if (n <= 0) break;
      offset += n;
      if (bytes.subarray(0, offset).includes(10)) break;
    }
  } catch {
    bytes.fill(0);
    throw new Error("BUCCET_HOST_DENIED: protected launcher descriptor unavailable");
  }
  const text = bytes.subarray(0, offset).toString("ascii");
  const matched = /^([a-f0-9]{64})\n?$/.exec(text);
  bytes.fill(0);
  if (!matched) {
    throw new Error("BUCCET_HOST_DENIED: invalid trusted launcher proof");
  }
  const key = Buffer.from(matched[1], "hex");
  hostProof = { sessionId: args.sessionId, actorId: args.actorId, key };
}

export function attestProtectedFilesystemRequest(request: Record<string, string>):
  ProtectedHostAttestation | undefined {
  if (!hostProof) return undefined;
  const issuedAt = new Date().toISOString();
  const nonce = randomBytes(16).toString("hex");
  const { sessionId, actorId, key } = hostProof;
  const serialized = JSON.stringify([
    "agent-buccet-protected-host-v1", sessionId, actorId, issuedAt, nonce, request,
  ]);
  const mac = createHmac("sha256", key).update(serialized).digest("hex");
  return { sessionId, actorId, issuedAt, nonce, mac };
}
