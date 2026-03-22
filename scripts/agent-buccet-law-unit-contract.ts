/**
 * Unit tests for individual BoundaryLaw evaluate() functions.
 *
 * Tests each law in isolation — no session persistence, no ledger writes,
 * no gravity service. Just raw evaluate() calls with constructed inputs.
 *
 * Run: node scripts/agent-buccet-law-unit-contract.ts
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { DEFENSIVE_TIME_LAWS } from "../lib/agent-buccet/time.ts";
import { DEFAULT_BOUNDARY_LAWS, evaluateBoundaryLaws } from "../lib/agent-buccet/laws.ts";
import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryGrant,
  BoundarySession,
} from "../lib/agent-buccet/types.ts";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeSession(overrides?: Partial<BoundarySession>): BoundarySession {
  return {
    sessionId: "test-session",
    actorId: "user:test",
    createdAt: new Date().toISOString(),
    dryRun: false,
    persistent: false,
    status: "active",
    ...overrides,
  };
}

function makeRequest(overrides?: Partial<BoundaryActionRequest>): BoundaryActionRequest {
  return {
    requestId: randomUUID(),
    sessionId: "test-session",
    actionKind: "fs.write",
    target: "/tmp/test.txt",
    requestedAt: new Date().toISOString(),
    provenance: "agent_inference",
    ...overrides,
  };
}

function makePathGrant(rootPath: string, actions: BoundaryActionKind[]): BoundaryGrant {
  return {
    grantId: randomUUID(),
    sessionId: "test-session",
    resourceKind: "path",
    resourceValue: rootPath,
    grantedActions: actions,
    issuedBy: "user:test",
    issuedAt: new Date().toISOString(),
  };
}

function evalLaw(lawId: string, request: BoundaryActionRequest) {
  const law = DEFENSIVE_TIME_LAWS.find((l) => l.lawId === lawId);
  if (!law) throw new Error(`Law not found: ${lawId}`);
  return law.evaluate({
    session: makeSession(),
    request,
    activeGrants: [],
  });
}

function evalBoundaryLaw(lawId: string, request: BoundaryActionRequest) {
  const law = DEFAULT_BOUNDARY_LAWS.find((l) => l.lawId === lawId);
  if (!law) throw new Error(`Law not found: ${lawId}`);
  return law.evaluate({
    session: makeSession(),
    request,
    activeGrants: [],
  });
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

// ─── TIME.TRUST.01 ────────────────────────────────────────────────────────────
console.log("\nTIME.TRUST.01 — untrusted high-risk actions require approval");

test("untrusted provenance + high-risk action → require_approval", () => {
  const result = evalLaw("TIME.TRUST.01", makeRequest({
    provenance: "agent_inference",
    actionKind: "fs.delete",
  }));
  assert.ok(result !== null, "should not abstain");
  assert.equal(result!.decision, "require_approval");
  assert.ok(result!.triggeredLawIds.includes("TIME.TRUST.01"));
});

test("untrusted provenance + low-risk action → abstain (null)", () => {
  const result = evalLaw("TIME.TRUST.01", makeRequest({
    provenance: "agent_inference",
    actionKind: "fs.read",
  }));
  assert.equal(result, null, "should abstain for non-high-risk action");
});

test("trusted provenance + high-risk action → abstain (null)", () => {
  const result = evalLaw("TIME.TRUST.01", makeRequest({
    provenance: "trusted_user",
    actionKind: "fs.delete",
  }));
  assert.equal(result, null, "should abstain for trusted provenance");
});

test("external_content + comm.send → require_approval", () => {
  const result = evalLaw("TIME.TRUST.01", makeRequest({
    provenance: "external_content",
    actionKind: "comm.send",
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "require_approval");
});

// ─── TIME.AUTHORITY.01 ────────────────────────────────────────────────────────
console.log("\nTIME.AUTHORITY.01 — authority claims are non-authoritative");

test("authorityClaimed flag → deny", () => {
  const result = evalLaw("TIME.AUTHORITY.01", makeRequest({
    flags: { authorityClaimed: true },
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
  assert.ok(result!.triggeredLawIds.includes("TIME.AUTHORITY.01"));
});

test("no authorityClaimed flag → abstain (null)", () => {
  const result = evalLaw("TIME.AUTHORITY.01", makeRequest());
  assert.equal(result, null);
});

// ─── TIME.NOVELTY.01 ──────────────────────────────────────────────────────────
console.log("\nTIME.NOVELTY.01 — completeness claims require approval");

test("claimsCompleteCoverage → require_approval", () => {
  const result = evalLaw("TIME.NOVELTY.01", makeRequest({
    flags: { claimsCompleteCoverage: true },
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "require_approval");
  assert.ok(result!.triggeredLawIds.includes("TIME.NOVELTY.01"));
});

test("no completeCoverage flag → abstain (null)", () => {
  const result = evalLaw("TIME.NOVELTY.01", makeRequest());
  assert.equal(result, null);
});

// ─── TIME.SCOPE.01 ────────────────────────────────────────────────────────────
console.log("\nTIME.SCOPE.01 — scope expansion from prompt is denied");

test("requestsScopeExpansion → deny", () => {
  const result = evalLaw("TIME.SCOPE.01", makeRequest({
    flags: { requestsScopeExpansion: true },
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
  assert.ok(result!.triggeredLawIds.includes("TIME.SCOPE.01"));
});

test("no scopeExpansion flag → abstain (null)", () => {
  const result = evalLaw("TIME.SCOPE.01", makeRequest());
  assert.equal(result, null);
});

// ─── TIME.LAW.01 ─────────────────────────────────────────────────────────────
console.log("\nTIME.LAW.01 — law mutation from prompt is denied");

test("requestsLawMutation → deny", () => {
  const result = evalLaw("TIME.LAW.01", makeRequest({
    flags: { requestsLawMutation: true },
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
  assert.ok(result!.triggeredLawIds.includes("TIME.LAW.01"));
});

test("no lawMutation flag → abstain (null)", () => {
  const result = evalLaw("TIME.LAW.01", makeRequest());
  assert.equal(result, null);
});

// ─── TIME.SESSION.01 ─────────────────────────────────────────────────────────
console.log("\nTIME.SESSION.01 — session revival from prompt is denied");

test("requestsSessionRevival → deny", () => {
  const result = evalLaw("TIME.SESSION.01", makeRequest({
    flags: { requestsSessionRevival: true },
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
  assert.ok(result!.triggeredLawIds.includes("TIME.SESSION.01"));
});

test("no sessionRevival flag → abstain (null)", () => {
  const result = evalLaw("TIME.SESSION.01", makeRequest());
  assert.equal(result, null);
});

// ─── TIME.LEDGER.01 ──────────────────────────────────────────────────────────
console.log("\nTIME.LEDGER.01 — ledger bypass from prompt is denied");

test("requestsLedgerBypass → deny", () => {
  const result = evalLaw("TIME.LEDGER.01", makeRequest({
    flags: { requestsLedgerBypass: true },
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
  assert.ok(result!.triggeredLawIds.includes("TIME.LEDGER.01"));
});

test("no ledgerBypass flag → abstain (null)", () => {
  const result = evalLaw("TIME.LEDGER.01", makeRequest());
  assert.equal(result, null);
});

// ─── DEFAULT_BOUNDARY_LAWS key rules ─────────────────────────────────────────
console.log("\nDEFAULT_BOUNDARY_LAWS — core enforcement rules");

test("BOUNDARY.DELETE.01 — fs.delete always requires approval", () => {
  const result = evalBoundaryLaw("BOUNDARY.DELETE.01", makeRequest({ actionKind: "fs.delete" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "require_approval");
});

test("BOUNDARY.EXEC.01 — tool.exec is denied by default", () => {
  const result = evalBoundaryLaw("BOUNDARY.EXEC.01", makeRequest({ actionKind: "tool.exec" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
});

test("BOUNDARY.NETWORK.01 — network.send requires approval", () => {
  const result = evalBoundaryLaw("BOUNDARY.NETWORK.01", makeRequest({ actionKind: "network.send" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "require_approval");
});

test("BOUNDARY.SYS.ENV.WRITE.01 — sys.env.write is denied by default", () => {
  const result = evalBoundaryLaw("BOUNDARY.SYS.ENV.WRITE.01", makeRequest({ actionKind: "sys.env.write" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
});

test("BOUNDARY.SYS.CREDENTIAL.READ.01 — credential reads are denied by default", () => {
  const result = evalBoundaryLaw("BOUNDARY.SYS.CREDENTIAL.READ.01", makeRequest({ actionKind: "sys.credential.read" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
});

// ─── evaluateBoundaryLaws scope check ────────────────────────────────────────
console.log("\nevaluateBoundaryLaws — scope enforcement");

test("target outside opened paths → deny (scope check)", () => {
  const result = evaluateBoundaryLaws({
    session: makeSession(),
    request: makeRequest({ actionKind: "fs.write", target: "/tmp/outside.txt" }),
    laws: DEFAULT_BOUNDARY_LAWS,
    grants: [makePathGrant("/home/alice/project", ["fs.write"])],
    approvalRequiredFor: [],
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.triggeredLawIds.includes("BOUNDARY.DEFAULT_SCOPE.01"));
});

test("target inside opened path → law evaluation proceeds (not scope-denied)", () => {
  const result = evaluateBoundaryLaws({
    session: makeSession(),
    request: makeRequest({ actionKind: "fs.write", target: "/home/alice/project/out.txt" }),
    laws: [],  // no laws — clean allow
    grants: [makePathGrant("/home/alice/project", ["fs.write"])],
    approvalRequiredFor: [],
  });
  assert.equal(result.decision, "allow");
});

test("approvalRequiredFor override always triggers approval", () => {
  const result = evaluateBoundaryLaws({
    session: makeSession(),
    request: makeRequest({ actionKind: "fs.write", target: "/home/alice/project/out.txt" }),
    laws: [],
    grants: [makePathGrant("/home/alice/project", ["fs.write"])],
    approvalRequiredFor: ["fs.write"],
  });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.triggeredLawIds.includes("BOUNDARY.APPROVAL.01"));
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
}
