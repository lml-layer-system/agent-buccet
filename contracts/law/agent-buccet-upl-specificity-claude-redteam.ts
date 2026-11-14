/**
 * CLAUDE RED-TEAM (decision layer) — fail-closed inversion by field count.
 *
 * Silo: policy decisions. lookupUserPathTrackDecision ranks a matching ALLOW
 * rail above a matching DENY rail when the allow is "more specific", where
 * specificity = a raw COUNT of constraint fields (trackConstraintSpecificity),
 * not how narrowly the target pattern matches. So a broad ALLOW for "/ws" that
 * merely carries extra, UNRELATED and UNCHECKED fields (reviewSurface,
 * reviewInvariantLawId, outputShape, expressionProfile) outranks a focused
 * protective DENY for the same "/ws" — a fail-closed inversion.
 *
 * This asserts the corrected behavior: a protective deny is NOT overridden by a
 * same-breadth allow that only pads its field count. A genuinely narrower allow
 * carve-out (deeper target) still wins.
 */
import assert from "node:assert/strict";
import { lookupUserPathTrackDecision } from "./../../src/proof/user-path-ledger.ts";
import type {
  BoundaryActionRequest,
  BoundarySession,
  BoundaryUplEntry,
  BoundaryUplTrackConstraint,
  BoundaryUserPathLedger,
} from "./../../src/runtime/types.ts";

const session: BoundarySession = { sessionId: "s1", actorId: "user:x" } as BoundarySession;

function entry(
  id: string,
  type: "APPROVED" | "DENIED",
  c: BoundaryUplTrackConstraint,
): BoundaryUplEntry {
  return {
    id,
    type,
    path: "p",
    pathHash: "h",
    createdAt: new Date().toISOString(),
    scope: "GLOBAL",
    status: "ACTIVE",
    witness: "w",
    modifiedAt: null,
    trackConstraint: c,
  };
}
function req(
  target: string,
  actionKind: BoundaryActionRequest["actionKind"] = "fs.write",
): BoundaryActionRequest {
  return {
    requestId: "r",
    sessionId: "s1",
    actionKind,
    target,
    requestedAt: new Date().toISOString(),
    provenance: "mcp_host",
  };
}

async function main() {
  // A focused protective DENY for the workspace (1 scored field: targetPattern).
  const deny = entry("deny-ws", "DENIED", {
    allowedActionKinds: ["fs.write"],
    targetPattern: "/ws",
    description: "protect the workspace",
  });
  // A broad ALLOW for the SAME breadth, padded with unrelated UNCHECKED fields
  // to inflate trackConstraintSpecificity (targetPattern + 4 extras = 5).
  const allowPadded = entry("allow-ws-padded", "APPROVED", {
    allowedActionKinds: ["fs.write"],
    targetPattern: "/ws",
    description: "broad allow with padded fields",
    reviewSurface: "action",
    reviewInvariantLawId: "INV.PAD.01",
  });

  const ledger1: BoundaryUserPathLedger = {
    specVersion: 1,
    userApprovedLawPaths: [allowPadded],
    userDeniedLawPaths: [deny],
  } as BoundaryUserPathLedger;

  const d1 = lookupUserPathTrackDecision({ ledger: ledger1, session, request: req("/ws/.env") });
  // FIXED: the padded same-breadth allow must NOT override the protective deny.
  assert.ok(d1, "a matching rail must decide");
  assert.equal(
    d1?.decision,
    "deny",
    "a same-breadth allow padded with unrelated fields must NOT outrank a protective deny (fail-closed)",
  );

  // Legitimate carve-out: a genuinely NARROWER allow (deeper target) SHOULD win.
  const allowCarve = entry("allow-carve", "APPROVED", {
    allowedActionKinds: ["fs.write"],
    targetPattern: "/ws/public",
    description: "explicit carve-out for a public subdir",
  });
  const ledger2: BoundaryUserPathLedger = {
    specVersion: 1,
    userApprovedLawPaths: [allowCarve],
    userDeniedLawPaths: [deny],
  } as BoundaryUserPathLedger;
  const d2 = lookupUserPathTrackDecision({
    ledger: ledger2,
    session,
    request: req("/ws/public/report.txt"),
  });
  assert.equal(
    d2?.decision,
    "allow",
    "a genuinely narrower allow carve-out still beats a broader deny",
  );

  // Sensitive-subset protection: a BROAD allow for a parent directory must NOT
  // override a deny that protects a sensitive subset of it via a regex/glob
  // scope (the base pack's `*/secrets/*`-style walls). A naive "longer target
  // pattern wins" rule regressed exactly this, because the allow's long literal
  // workspace prefix outscored the deny's short glob.
  const workspaceAllow = entry("allow-ws-broad", "APPROVED", {
    allowedActionKinds: ["fs.read"],
    targetPattern: "/home/user/project/workspace",
    description: "broad workspace read allow",
  });
  const secretsDeny = entry("deny-secrets-glob", "DENIED", {
    allowedActionKinds: ["fs.read"],
    targetPatterns: ["/^.*\\/secrets(\\/.*)?$/"],
    targetMatchMode: "regex",
    description: "protect secrets subtree (glob)",
  });
  const ledger3: BoundaryUserPathLedger = {
    specVersion: 1,
    userApprovedLawPaths: [workspaceAllow],
    userDeniedLawPaths: [secretsDeny],
  } as BoundaryUserPathLedger;
  const d3 = lookupUserPathTrackDecision({
    ledger: ledger3,
    session,
    request: req("/home/user/project/workspace/secrets/api.txt", "fs.read"),
  });
  assert.equal(
    d3?.decision,
    "deny",
    "a broad parent-dir allow must NOT override a deny protecting a sensitive subset (regex/glob scope)",
  );

  console.log(
    "specificity: padded same-breadth allow no longer outranks a deny; real carve-out still wins; broad parent allow cannot pierce a sensitive-subset deny",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
