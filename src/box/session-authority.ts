/**
 * Capability-bound MCP session restoration.
 *
 * An actor ID and session ID identify a session; neither authenticates a
 * process. A trusted launcher must provision a high-entropy proof at session
 * creation and pass it to the MCP child on inherited FD 3 (never CLI args).
 *
 * This is NOT isolation against a same-UID process that can tamper with the
 * persisted session state, ptrace the trusted launcher, or steal that FD.
 * Such attackers need a separately privileged broker/OS identity.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { readSync } from "node:fs";

const DOMAIN = "agent-buccet:mcp-session-owner:v1\u0000";
const PROOF_PATTERN = /^[a-f0-9]{64}$/;

export function digestMcpSessionOwner(
  sessionId: string, actorId: string, proof: string,
): string {
  if (!PROOF_PATTERN.test(proof)) {
    throw new Error("BUCCET_SESSION_PROOF_INVALID: expected 32-byte hexadecimal proof");
  }
  return createHash("sha256")
    .update(DOMAIN)
    .update(sessionId)
    .update("\u0000")
    .update(actorId)
    .update("\u0000")
    .update(Buffer.from(proof, "hex"))
    .digest("hex");
}

export function verifyMcpSessionOwner(
  sessionId: string, actorId: string, digest: unknown, proof: string | null,
): boolean {
  if (typeof digest !== "string" || !PROOF_PATTERN.test(digest) ||
      typeof proof !== "string" || !PROOF_PATTERN.test(proof)) return false;
  const expected = Buffer.from(digest, "hex");
  const actual = Buffer.from(digestMcpSessionOwner(sessionId, actorId, proof), "hex");
  return timingSafeEqual(expected, actual);
}

/** Reads at most 65 bytes from a host-provided inherited pipe; never logs. */
export function readMcpSessionOwnerProof(fd = 3): string | null {
  const buffer = Buffer.alloc(66);
  let used = 0;
  try {
    while (used < buffer.length) {
      const bytes = readSync(fd, buffer, used, buffer.length - used, null);
      if (bytes === 0) break;
      used += bytes;
      if (buffer.subarray(0, used).includes(10)) break;
    }
  } catch {
    return null; // No trusted launcher FD: no authority.
  }
  const data = buffer.subarray(0, used).toString("utf8");
  const match = /^([a-f0-9]{64})\n?$/.exec(data);
  return match?.[1] ?? null;
}
