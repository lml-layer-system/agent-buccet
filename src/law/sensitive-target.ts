/**
 * Sensitive-target classifier for the decision layer.
 *
 * Autonomous mode follows standing UPL without a human. A broad workspace
 * corridor therefore also authorizes every secret/credential file beneath it —
 * so an agent can rewrite `.env`, `~/.ssh/authorized_keys`, `.aws/credentials`
 * or `.git/config` with no human in the loop (AUTH-01, least-privilege gap).
 *
 * This classifies MUTATING actions against well-known credential/secret paths
 * so autonomous auto-allow can hold them for a human instead of silently
 * granting them. Conservative by design: it matches known secret filenames,
 * key/cert extensions, and credential directories only — ordinary source and
 * document files are never flagged, so legitimate autonomous work is unaffected.
 */
import type { BoundaryActionKind } from "./../runtime/types.ts";

const MUTATING_ACTIONS: ReadonlySet<BoundaryActionKind> = new Set<BoundaryActionKind>([
  "fs.write",
  "fs.append",
  "fs.delete",
  "fs.move",
  "sys.env.write",
  "sys.config.write",
  "sys.credential.use",
]);

// Exact basenames that are credential/secret material.
const SENSITIVE_BASENAMES: ReadonlySet<string> = new Set([
  ".env",
  ".envrc",
  ".netrc",
  ".npmrc",
  ".pypirc",
  ".git-credentials",
  "credentials",
  "id_rsa",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "authorized_keys",
  "shadow",
]);

// Credential/secret directories: a mutation anywhere beneath them is sensitive.
const SENSITIVE_DIR_SEGMENTS: ReadonlySet<string> = new Set([
  ".ssh",
  ".aws",
  ".gnupg",
  ".kube",
  ".docker",
  ".gcloud",
  ".config/gcloud",
]);

// Key / certificate / keystore extensions.
const SENSITIVE_EXTENSIONS: readonly string[] = [
  ".pem",
  ".key",
  ".pfx",
  ".p12",
  ".keystore",
  ".jks",
  ".asc",
  ".gpg",
];

function posixSegments(target: string): string[] {
  return target.replaceAll("\\", "/").split("/").filter(Boolean);
}

/**
 * True when `actionKind` mutates and `target` names credential/secret material
 * that autonomous mode should not auto-authorize without a human.
 */
export function isSensitiveMutationTarget(actionKind: BoundaryActionKind, target: string): boolean {
  if (!MUTATING_ACTIONS.has(actionKind)) return false;
  const value = typeof target === "string" ? target.trim() : "";
  if (!value) return false;

  // Secret/config env reads-as-writes and credential-use on any env/credential
  // surface are sensitive regardless of path shape.
  if (actionKind === "sys.credential.use" || actionKind === "sys.env.write") return true;

  const segments = posixSegments(value);
  if (segments.length === 0) return false;
  const base = (segments[segments.length - 1] ?? "").toLowerCase();

  if (SENSITIVE_BASENAMES.has(base)) return true;
  if (base.startsWith(".env.")) return true; // .env.production, .env.local, …
  if (SENSITIVE_EXTENSIONS.some((ext) => base.endsWith(ext))) return true;

  const lowerSegments = segments.map((s) => s.toLowerCase());
  for (const seg of lowerSegments) {
    if (SENSITIVE_DIR_SEGMENTS.has(seg)) return true;
  }
  // .git/config and .git/hooks are config/execution surfaces.
  const gitIdx = lowerSegments.indexOf(".git");
  if (gitIdx >= 0 && gitIdx < lowerSegments.length - 1) {
    const next = lowerSegments[gitIdx + 1];
    if (next === "config" || next === "hooks") return true;
  }
  return false;
}
