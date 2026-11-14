/**
 * CLAUDE RED-TEAM (decision layer) — UPL corridor target normalization.
 *
 * Silo note: this probes the POLICY DECISION layer (does the law engine decide
 * allow/deny correctly), complementary to the transport / native-FS / session
 * / proof work on the security/* and redteam/frontier-* branches. It touches
 * only src/law/upl-tracks.ts (checkTrackConstraint), which those branches do
 * not. Pure-function, deterministic — no ledger, daemon, or GUI.
 *
 * Finding AUTH-02: checkTrackConstraint prefix-matches the UNNORMALIZED target,
 * so a corridor for "/ws/project" accepts "/ws/project/../../etc/shadow" even
 * though it resolves outside. The confined-fs executor denies it at run time,
 * so there is no live escape — but the allow rail and the executor DISAGREE,
 * which is a fail-closed dependency on the last layer. This asserts the rail
 * now agrees (the escaping target is treated as a corridor exit).
 */
import assert from "node:assert/strict";
import { checkTrackConstraint } from "./../../src/law/upl-tracks.ts";
import type {
  BoundaryActionRequest,
  BoundaryUplTrackConstraint,
} from "./../../src/runtime/types.ts";

function req(target: string): BoundaryActionRequest {
  return {
    requestId: "r1",
    sessionId: "s1",
    actionKind: "fs.write",
    target,
    requestedAt: new Date().toISOString(),
    provenance: "mcp_host",
  };
}

const corridor: BoundaryUplTrackConstraint = {
  allowedActionKinds: ["fs.write"],
  targetPattern: "/ws/project",
  description: "writes within the project workspace",
};

async function main() {
  // Positive control: a genuine in-corridor write is allowed (no violation).
  assert.equal(
    checkTrackConstraint(corridor, req("/ws/project/report.txt")),
    null,
    "in-corridor write must stay allowed",
  );

  // A clearly-outside target is a corridor exit.
  assert.notEqual(
    checkTrackConstraint(corridor, req("/etc/shadow")),
    null,
    "outside target must exit the corridor",
  );

  // AUTH-02: a traversal target that RESOLVES outside the corridor must be a
  // corridor exit, not an allow. Before the fix this returned null (allowed)
  // because the raw string starts with "/ws/project/".
  const escaped = checkTrackConstraint(corridor, req("/ws/project/../../etc/shadow"));
  assert.notEqual(
    escaped,
    null,
    "traversal escaping the corridor must be treated as a corridor exit",
  );

  // A '..' that stays inside the corridor is still allowed (normalize, don't blanket-reject).
  assert.equal(
    checkTrackConstraint(corridor, req("/ws/project/sub/../report.txt")),
    null,
    "in-corridor '..' must remain allowed",
  );

  // Non-filesystem targets (URLs) are unaffected by path normalization.
  const net: BoundaryUplTrackConstraint = {
    allowedActionKinds: ["network.send"],
    targetPattern: "https://api.example.com",
    description: "api",
  };
  const netReq = (t: string): BoundaryActionRequest => ({ ...req(t), actionKind: "network.send" });
  assert.equal(
    checkTrackConstraint(net, netReq("https://api.example.com/v1/x")),
    null,
    "in-corridor URL must stay allowed",
  );

  console.log(
    "corridor normalization: in-corridor allowed, traversal-escape treated as exit, URLs unaffected",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
