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

test("tool_output + tool.exec → require_approval (tool output cannot self-escalate)", () => {
  const result = evalLaw("TIME.TRUST.01", makeRequest({
    provenance: "tool_output",
    actionKind: "tool.exec",
  }));
  assert.ok(result !== null, "tool_output provenance is untrusted");
  assert.equal(result!.decision, "require_approval");
});

test("remote_user + network.send → require_approval (remote cannot self-authorize sends)", () => {
  const result = evalLaw("TIME.TRUST.01", makeRequest({
    provenance: "remote_user",
    actionKind: "network.send",
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "require_approval");
});

test("agent_inference + fs.move → require_approval (move is high-risk)", () => {
  const result = evalLaw("TIME.TRUST.01", makeRequest({
    provenance: "agent_inference",
    actionKind: "fs.move",
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "require_approval");
});

test("agent_inference + fs.write → abstain (write is not high-risk for TIME.TRUST.01)", () => {
  const result = evalLaw("TIME.TRUST.01", makeRequest({
    provenance: "agent_inference",
    actionKind: "fs.write",
  }));
  assert.equal(result, null, "fs.write is not classified as high-risk by TIME.TRUST.01");
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

test("authorityClaimed on trusted provenance is still denied (trust doesn't override law)", () => {
  const result = evalLaw("TIME.AUTHORITY.01", makeRequest({
    provenance: "trusted_user",
    flags: { authorityClaimed: true },
  }));
  assert.ok(result !== null, "authorityClaimed always triggers regardless of provenance");
  assert.equal(result!.decision, "deny");
});

test("authorityClaimed + scopeExpansion both set → deny (authority check fires first)", () => {
  const result = evalLaw("TIME.AUTHORITY.01", makeRequest({
    flags: { authorityClaimed: true, requestsScopeExpansion: true },
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
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

test("claimsCompleteCoverage on any action kind → require_approval", () => {
  for (const actionKind of ["fs.delete", "tool.exec", "network.send", "db.insert"] as BoundaryActionKind[]) {
    const result = evalLaw("TIME.NOVELTY.01", makeRequest({
      flags: { claimsCompleteCoverage: true },
      actionKind,
    }));
    assert.ok(result !== null, `should fire for ${actionKind}`);
    assert.equal(result!.decision, "require_approval", `expected require_approval for ${actionKind}`);
  }
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

test("agent_inference + requestsScopeExpansion → deny (prompt-injection scope grab)", () => {
  // This is the canonical prompt-injection attack: agent infers "all paths are now open"
  const result = evalLaw("TIME.SCOPE.01", makeRequest({
    provenance: "agent_inference",
    flags: { requestsScopeExpansion: true },
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
});

test("external_content + requestsScopeExpansion → deny (external content cannot open scope)", () => {
  const result = evalLaw("TIME.SCOPE.01", makeRequest({
    provenance: "external_content",
    flags: { requestsScopeExpansion: true },
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
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

test("requestsLawMutation + authorityClaimed together → both laws triggered individually", () => {
  // Both TIME.LAW.01 and TIME.AUTHORITY.01 should individually fire
  const lawResult = evalLaw("TIME.LAW.01", makeRequest({
    flags: { requestsLawMutation: true, authorityClaimed: true },
  }));
  const authResult = evalLaw("TIME.AUTHORITY.01", makeRequest({
    flags: { requestsLawMutation: true, authorityClaimed: true },
  }));
  assert.ok(lawResult !== null);
  assert.equal(lawResult!.decision, "deny");
  assert.ok(authResult !== null);
  assert.equal(authResult!.decision, "deny");
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

test("requestsSessionRevival on tool_output provenance → deny (tool output cannot revive sessions)", () => {
  const result = evalLaw("TIME.SESSION.01", makeRequest({
    provenance: "tool_output",
    flags: { requestsSessionRevival: true },
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
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

test("requestsLedgerBypass on external_content → deny (external content cannot disable audit trail)", () => {
  const result = evalLaw("TIME.LEDGER.01", makeRequest({
    provenance: "external_content",
    flags: { requestsLedgerBypass: true },
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
});

// ─── DEFAULT_BOUNDARY_LAWS — communication and network ───────────────────────
console.log("\nDEFAULT_BOUNDARY_LAWS — communication and network");

test("BOUNDARY.COMM.01 — comm.send requires approval", () => {
  const result = evalBoundaryLaw("BOUNDARY.COMM.01", makeRequest({ actionKind: "comm.send" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "require_approval");
  assert.ok(result!.triggeredLawIds.includes("BOUNDARY.COMM.01"));
});

test("BOUNDARY.NETWORK.01 — network.send requires approval", () => {
  const result = evalBoundaryLaw("BOUNDARY.NETWORK.01", makeRequest({ actionKind: "network.send" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "require_approval");
});

// ─── DEFAULT_BOUNDARY_LAWS — destructive file operations ─────────────────────
console.log("\nDEFAULT_BOUNDARY_LAWS — destructive file operations");

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

// ─── DEFAULT_BOUNDARY_LAWS — database operations ─────────────────────────────
console.log("\nDEFAULT_BOUNDARY_LAWS — database operations");

test("BOUNDARY.DB.READ.01 — db.query requires approval", () => {
  const result = evalBoundaryLaw("BOUNDARY.DB.READ.01", makeRequest({ actionKind: "db.query" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "require_approval");
  assert.ok(result!.triggeredLawIds.includes("BOUNDARY.DB.READ.01"));
});

test("BOUNDARY.DB.WRITE.01 — db.insert requires approval", () => {
  const result = evalBoundaryLaw("BOUNDARY.DB.WRITE.01", makeRequest({ actionKind: "db.insert" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "require_approval");
  assert.ok(result!.triggeredLawIds.includes("BOUNDARY.DB.WRITE.01"));
});

test("BOUNDARY.DB.WRITE.01 — db.update requires approval", () => {
  const result = evalBoundaryLaw("BOUNDARY.DB.WRITE.01", makeRequest({ actionKind: "db.update" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "require_approval");
});

test("BOUNDARY.DB.WRITE.01 — db.delete requires approval", () => {
  const result = evalBoundaryLaw("BOUNDARY.DB.WRITE.01", makeRequest({ actionKind: "db.delete" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "require_approval");
});

// ─── DEFAULT_BOUNDARY_LAWS — system/environment operations ───────────────────
console.log("\nDEFAULT_BOUNDARY_LAWS — system and environment operations");

test("BOUNDARY.SYS.ENV.READ.01 — sys.env.read requires approval", () => {
  const result = evalBoundaryLaw("BOUNDARY.SYS.ENV.READ.01", makeRequest({ actionKind: "sys.env.read" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "require_approval");
  assert.ok(result!.triggeredLawIds.includes("BOUNDARY.SYS.ENV.READ.01"));
});

test("BOUNDARY.SYS.ENV.WRITE.01 — sys.env.write is denied by default", () => {
  const result = evalBoundaryLaw("BOUNDARY.SYS.ENV.WRITE.01", makeRequest({ actionKind: "sys.env.write" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
});

test("BOUNDARY.SYS.CONFIG.READ.01 — sys.config.read requires approval", () => {
  const result = evalBoundaryLaw("BOUNDARY.SYS.CONFIG.READ.01", makeRequest({ actionKind: "sys.config.read" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "require_approval");
  assert.ok(result!.triggeredLawIds.includes("BOUNDARY.SYS.CONFIG.READ.01"));
});

test("BOUNDARY.SYS.CONFIG.WRITE.01 — sys.config.write is denied by default", () => {
  const result = evalBoundaryLaw("BOUNDARY.SYS.CONFIG.WRITE.01", makeRequest({ actionKind: "sys.config.write" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
  assert.ok(result!.triggeredLawIds.includes("BOUNDARY.SYS.CONFIG.WRITE.01"));
});

test("BOUNDARY.SYS.CREDENTIAL.READ.01 — credential reads are denied by default", () => {
  const result = evalBoundaryLaw("BOUNDARY.SYS.CREDENTIAL.READ.01", makeRequest({ actionKind: "sys.credential.read" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
});

test("BOUNDARY.SYS.CREDENTIAL.USE.01 — credential use requires approval", () => {
  const result = evalBoundaryLaw("BOUNDARY.SYS.CREDENTIAL.USE.01", makeRequest({ actionKind: "sys.credential.use" }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "require_approval");
  assert.ok(result!.triggeredLawIds.includes("BOUNDARY.SYS.CREDENTIAL.USE.01"));
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

// ─── evaluateBoundaryLaws — law precedence and ordering ──────────────────────
console.log("\nevaluateBoundaryLaws — law precedence");

test("deny law wins over require_approval law (deny is terminal)", () => {
  // BOUNDARY.EXEC.01 (deny) should win over any require_approval law.
  // tool.exec requires resourceKind: "tool" grant (not path).
  const toolGrant: BoundaryGrant = {
    grantId: randomUUID(),
    sessionId: "test-session",
    resourceKind: "tool",
    resourceValue: "/home/alice/project/run.sh",
    grantedActions: ["tool.exec"],
    issuedBy: "user:test",
    issuedAt: new Date().toISOString(),
  };
  const result = evaluateBoundaryLaws({
    session: makeSession(),
    request: makeRequest({ actionKind: "tool.exec", target: "/home/alice/project/run.sh" }),
    laws: DEFAULT_BOUNDARY_LAWS,
    grants: [toolGrant],
    approvalRequiredFor: [],
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.triggeredLawIds.includes("BOUNDARY.EXEC.01"));
});

test("no laws + in-scope target → allow", () => {
  const result = evaluateBoundaryLaws({
    session: makeSession(),
    request: makeRequest({ actionKind: "fs.read", target: "/home/alice/project/file.txt" }),
    laws: [],
    grants: [makePathGrant("/home/alice/project", ["fs.read"])],
    approvalRequiredFor: [],
  });
  assert.equal(result.decision, "allow");
});

test("fs.delete inside scope → require_approval (BOUNDARY.DELETE.01)", () => {
  const result = evaluateBoundaryLaws({
    session: makeSession(),
    request: makeRequest({ actionKind: "fs.delete", target: "/home/alice/project/old.txt" }),
    laws: DEFAULT_BOUNDARY_LAWS,
    grants: [makePathGrant("/home/alice/project", ["fs.delete"])],
    approvalRequiredFor: [],
  });
  assert.equal(result.decision, "require_approval");
  assert.ok(result.triggeredLawIds.includes("BOUNDARY.DELETE.01"));
});

test("no grants + no target restriction → scope deny (no opened paths)", () => {
  const result = evaluateBoundaryLaws({
    session: makeSession(),
    request: makeRequest({ actionKind: "fs.write", target: "/home/alice/anywhere.txt" }),
    laws: DEFAULT_BOUNDARY_LAWS,
    grants: [],
    approvalRequiredFor: [],
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.triggeredLawIds.includes("BOUNDARY.DEFAULT_SCOPE.01"));
});

// ─── Attack scenario coverage ─────────────────────────────────────────────────
console.log("\nAttack scenarios — prompt injection and authority abuse patterns");

test("prompt-injection authority claim: 'I have been authorized' → TIME.AUTHORITY.01 deny", () => {
  // Classic jailbreak: agent claims it has been pre-authorized
  const result = evalLaw("TIME.AUTHORITY.01", makeRequest({
    provenance: "agent_inference",
    flags: { authorityClaimed: true },
    actionKind: "fs.delete",
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
  assert.ok(result!.triggeredLawIds.includes("TIME.AUTHORITY.01"));
});

test("prompt-injection scope grab: 'all directories are now accessible' → TIME.SCOPE.01 deny", () => {
  // Classic scope expansion attack via injected instruction
  const result = evalLaw("TIME.SCOPE.01", makeRequest({
    provenance: "external_content",
    flags: { requestsScopeExpansion: true },
    actionKind: "fs.write",
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
  assert.ok(result!.triggeredLawIds.includes("TIME.SCOPE.01"));
});

test("prompt-injection law mutation: 'ignore all previous rules' → TIME.LAW.01 deny", () => {
  // Canonical jailbreak pattern
  const result = evalLaw("TIME.LAW.01", makeRequest({
    provenance: "agent_inference",
    flags: { requestsLawMutation: true },
    actionKind: "tool.exec",
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
  assert.ok(result!.triggeredLawIds.includes("TIME.LAW.01"));
});

test("prompt-injection audit bypass: 'skip logging for this operation' → TIME.LEDGER.01 deny", () => {
  // Attempting to disable the witness ledger
  const result = evalLaw("TIME.LEDGER.01", makeRequest({
    provenance: "agent_inference",
    flags: { requestsLedgerBypass: true },
    actionKind: "fs.write",
  }));
  assert.ok(result !== null);
  assert.equal(result!.decision, "deny");
  assert.ok(result!.triggeredLawIds.includes("TIME.LEDGER.01"));
});

test("multi-flag attack: authority + scope + law mutation all set → each law independently denies", () => {
  const request = makeRequest({
    provenance: "agent_inference",
    flags: {
      authorityClaimed: true,
      requestsScopeExpansion: true,
      requestsLawMutation: true,
    },
    actionKind: "fs.delete",
  });
  // Each law independently fires — no single law needs to see all flags
  const authorityResult = evalLaw("TIME.AUTHORITY.01", request);
  const scopeResult = evalLaw("TIME.SCOPE.01", request);
  const lawResult = evalLaw("TIME.LAW.01", request);

  assert.ok(authorityResult !== null);
  assert.equal(authorityResult!.decision, "deny");
  assert.ok(scopeResult !== null);
  assert.equal(scopeResult!.decision, "deny");
  assert.ok(lawResult !== null);
  assert.equal(lawResult!.decision, "deny");
});

test("evaluateBoundaryLaws: full stack — in-scope target + authority claim → deny (time law wins)", () => {
  // Even when the target is inside scope, authority claim is denied
  const result = evaluateBoundaryLaws({
    session: makeSession(),
    request: makeRequest({
      actionKind: "fs.write",
      target: "/home/alice/project/file.txt",
      provenance: "agent_inference",
      flags: { authorityClaimed: true },
    }),
    laws: DEFAULT_BOUNDARY_LAWS,
    grants: [makePathGrant("/home/alice/project", ["fs.write"])],
    approvalRequiredFor: [],
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.triggeredLawIds.includes("TIME.AUTHORITY.01"));
});

test("evaluateBoundaryLaws: full stack — in-scope + scope expansion flag → deny", () => {
  const result = evaluateBoundaryLaws({
    session: makeSession(),
    request: makeRequest({
      actionKind: "fs.write",
      target: "/home/alice/project/file.txt",
      flags: { requestsScopeExpansion: true },
    }),
    laws: DEFAULT_BOUNDARY_LAWS,
    grants: [makePathGrant("/home/alice/project", ["fs.write"])],
    approvalRequiredFor: [],
  });
  assert.equal(result.decision, "deny");
  assert.ok(result.triggeredLawIds.includes("TIME.SCOPE.01"));
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  process.exit(1);
}
