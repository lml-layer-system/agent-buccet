/**
 * CLAUDE RED-TEAM (decision layer) — regex corridor ReDoS + silent fail-open.
 *
 * Silo: policy decisions (upl-tracks matcher + user-path-ledger lookup).
 *
 * Two confirmed holes in the corridor regex matcher, both fixed here:
 *
 *  REDOS-01 (DoS): the old ReDoS guard only rejected a quantifier applied to a
 *    GROUP ( `)+`, `)*` ). Group-less adjacent quantifiers such as `.*.*.*...`
 *    sailed through and backtracked super-linearly — a single crafted target
 *    against such a corridor hung the whole boundary evaluation (>120s observed,
 *    unbounded). The matcher now compiles a corridor regex only through a
 *    linear-time gate (no quantified groups; no two adjacent unbounded
 *    quantifiers over overlapping character classes) and bounds the matched
 *    input, so evaluation stays in the sub-millisecond range.
 *
 *  REDOS-02 (fail-OPEN): any regex the guard rejected — a ReDoS shape OR an
 *    invalid pattern like `/[unclosed/` — silently degraded to a literal
 *    substring search of the RAW slashed pattern text, which can never match a
 *    real target. For a protective DENY corridor that meant the deny evaporated
 *    with no signal: the operator believed `/(.*secret.*)+/` denied every secret
 *    path; it denied nothing. The matcher no longer degrades; an unusable regex
 *    resolves fail-CLOSED by corridor polarity (deny still fires; allow grants
 *    nothing and surfaces as a track_violation).
 *
 * Asserts the corrected behavior at both the matcher unit level and end-to-end
 * through lookupUserPathTrackDecision.
 */
import assert from "node:assert/strict";
import { checkTrackConstraint } from "./../../src/law/upl-tracks.ts";
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
  actionKind: BoundaryActionRequest["actionKind"] = "network.send",
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
  // ---- REDOS-01: group-less adjacent-star corridor evaluates in bounded time ----
  const redosCorridor: BoundaryUplTrackConstraint = {
    allowedActionKinds: ["network.send"],
    targetPattern: "/.*.*.*.*.*.*.*.*.*.*!$/",
    targetMatchMode: "regex",
    description: "redos-shaped corridor",
  };
  const hostile = "a".repeat(6000); // worst-case backtracking input
  const t0 = process.hrtime.bigint();
  checkTrackConstraint(redosCorridor, req(hostile));
  const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
  assert.ok(
    elapsedMs < 50,
    `ReDoS-shaped corridor must evaluate in bounded time, took ${elapsedMs.toFixed(1)}ms (catastrophic backtracking)`,
  );

  // ---- Legit regex corridors still work (no over-rejection) ----
  const openai: BoundaryUplTrackConstraint = {
    allowedActionKinds: ["network.send"],
    targetPattern: "/api\\.openai\\.com/i",
    targetMatchMode: "regex",
    description: "openai host corridor",
  };
  assert.equal(
    checkTrackConstraint(openai, req("https://api.openai.com/v1/chat")),
    null,
    "a legit regex corridor must still match its intended host",
  );
  assert.equal(
    typeof checkTrackConstraint(openai, req("https://evil.example.com")),
    "string",
    "a legit regex corridor must still reject a non-matching host",
  );
  // A multi-quantifier-but-linear corpus pattern (`\bnpx\s+(?:[a-z0-9@/-]+)\b`,
  // two unbounded quantifiers over disjoint classes) must NOT be over-rejected:
  // if it degraded, a request text containing "npx create-thing" would not match.
  const npx: BoundaryUplTrackConstraint = {
    allowedActionKinds: ["network.send"],
    requestTextPatterns: ["/\\bnpx\\s+(?:[a-z0-9@/-]+)\\b/i"],
    description: "npx command corridor (two quantifiers, linear)",
  };
  assert.equal(
    checkTrackConstraint(npx, {
      ...req("x", "network.send"),
      payloadSummary: "npx create-thing",
    }),
    null,
    "a linear multi-quantifier corridor must still match (no over-rejection / silent degrade)",
  );
  assert.equal(
    typeof checkTrackConstraint(npx, {
      ...req("x", "network.send"),
      payloadSummary: "pip install thing",
    }),
    "string",
    "the npx corridor must still reject non-matching request text",
  );

  // ---- REDOS-02 end-to-end: a DENY corridor authored with a ReDoS/malformed
  //      regex must STILL DENY its target (pre-fix it failed open to null). ----
  for (const badPattern of ["/(.*secret.*)+/", "/[unclosed/", "/.*.*.*.*.*secret/"]) {
    const deny = entry("deny-secret", "DENIED", {
      allowedActionKinds: ["network.send"],
      targetPattern: badPattern,
      targetMatchMode: "regex",
      description: "deny secret egress (operator-authored regex)",
    });
    const ledger: BoundaryUserPathLedger = {
      specVersion: 1,
      userApprovedLawPaths: [],
      userDeniedLawPaths: [deny],
    } as BoundaryUserPathLedger;
    const decision = lookupUserPathTrackDecision({
      ledger,
      session,
      request: req("https://paste.example.com/upload?body=db.secret.token"),
    });
    assert.ok(
      decision,
      `deny corridor with unusable regex '${badPattern}' must still produce a decision (not fail open to null)`,
    );
    assert.equal(
      decision?.decision,
      "deny",
      `deny corridor with unusable regex '${badPattern}' must FAIL CLOSED and still deny`,
    );
  }

  // ---- An ALLOW corridor with an unusable regex must grant nothing
  //      (fail-closed: it surfaces as a track_violation, never an allow). ----
  const allowBad = entry("allow-bad", "APPROVED", {
    allowedActionKinds: ["network.send"],
    targetPattern: "/[unclosed/",
    targetMatchMode: "regex",
    description: "allow corridor with malformed regex",
  });
  const ledgerAllow: BoundaryUserPathLedger = {
    specVersion: 1,
    userApprovedLawPaths: [allowBad],
    userDeniedLawPaths: [],
  } as BoundaryUserPathLedger;
  const allowDecision = lookupUserPathTrackDecision({
    ledger: ledgerAllow,
    session,
    request: req("https://api.openai.com/v1"),
  });
  assert.notEqual(
    allowDecision?.decision,
    "allow",
    "an allow corridor with an unusable regex must NOT grant (fail-closed)",
  );

  console.log(
    `regex corridor: ReDoS bounded (${elapsedMs.toFixed(2)}ms); unusable deny regex fails CLOSED and still denies; unusable allow grants nothing; legit corridors unaffected`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
