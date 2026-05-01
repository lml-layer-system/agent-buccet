import assert from "node:assert/strict";
import path from "node:path";
import {
  compileLiveUplField,
  compileLiveUplTrackField,
  describeUserPath,
  hashUserPath,
  lookupUserPathDecision,
  lookupUserPathTrackDecision,
  resolveBoundaryUplTrafficPolarity,
} from "./../../src/index.ts";
import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundarySession,
  BoundaryUplEntry,
  BoundaryUplEntryType,
  BoundaryUserPathLedger,
} from "./../../src/index.ts";

function makeSession(): BoundarySession {
  return {
    sessionId: "live-upl-field",
    actorId: "user:live-upl-field-contract",
    createdAt: "2026-03-31T00:00:00.000Z",
    dryRun: false,
    persistent: true,
    status: "active",
  };
}

function makeRequest(
  actionKind: BoundaryActionKind,
  target: string,
  payloadSummary?: string,
): BoundaryActionRequest {
  return {
    requestId: `${actionKind}:${target}`,
    sessionId: "live-upl-field",
    actionKind,
    target,
    payloadSummary,
    requestedAt: "2026-03-31T00:00:00.000Z",
    provenance: "agent_inference",
  };
}

function makeEntry(args: {
  id: string;
  type: BoundaryUplEntryType;
  request: BoundaryActionRequest;
  createdAt: string;
  trackConstraint?: BoundaryUplEntry["trackConstraint"];
}): BoundaryUplEntry {
  return {
    id: args.id,
    type: args.type,
    path: describeUserPath(args.request),
    pathHash: hashUserPath(args.request),
    createdAt: args.createdAt,
    scope: "GLOBAL",
    status: "ACTIVE",
    witness: "LIVE.UPL.FIELD.CONTRACT",
    modifiedAt: null,
    notes: null,
    requestBasis: {
      actionKind: args.request.actionKind,
      target: args.request.target,
      payloadSummary: args.request.payloadSummary,
      provenance: args.request.provenance,
    },
    ...(args.trackConstraint ? { trackConstraint: args.trackConstraint } : {}),
  };
}

async function main() {
  const session = makeSession();
  const workspace = path.join("/tmp", "agent-buccet-live-field", "workspace");
  const secretsDir = path.join(workspace, "secrets");

  const exactAllowedRead = makeRequest("fs.read", path.join(workspace, "README.md"), "read:utf8");
  const exactDeniedRead = makeRequest("fs.read", path.join(secretsDir, ".env"), "read:utf8");

  const ledger: BoundaryUserPathLedger = {
    specVersion: 1,
    userApprovedLawPaths: [
      makeEntry({
        id: "ALLOW.EXACT.WORKSPACE.READ.001",
        type: "APPROVED",
        request: exactAllowedRead,
        createdAt: "2026-03-31T00:00:00.000Z",
      }),
      makeEntry({
        id: "ALLOW.TRACK.WORKSPACE.WRITE.002",
        type: "APPROVED",
        request: makeRequest("fs.write", path.join(workspace, "seed.txt"), "write:4bytes"),
        createdAt: "2026-03-31T00:00:02.000Z",
        trackConstraint: {
          allowedActionKinds: ["fs.write"],
          targetPattern: workspace,
          targetMatchMode: "prefix",
          description: `fs.write within ${workspace}`,
        },
      }),
    ],
    userDeniedLawPaths: [
      makeEntry({
        id: "DENY.EXACT.SECRET.READ.001",
        type: "DENIED",
        request: exactDeniedRead,
        createdAt: "2026-03-31T00:00:01.000Z",
      }),
      makeEntry({
        id: "DENY.TRACK.SECRETS.WRITE.002",
        type: "DENIED",
        request: makeRequest("fs.write", path.join(secretsDir, "seed.txt"), "write:4bytes"),
        createdAt: "2026-03-31T00:00:02.000Z",
        trackConstraint: {
          allowedActionKinds: ["fs.write"],
          targetPattern: secretsDir,
          targetMatchMode: "prefix",
          description: `fs.write blocked inside ${secretsDir}`,
        },
      }),
    ],
  };

  const liveField = compileLiveUplField({ ledger, session });
  assert.equal(liveField.length, 4, "expected approved and denied authored laws to compile into one live field");
  assert.ok(
    liveField.some((segment) => segment.entry.id === "ALLOW.EXACT.WORKSPACE.READ.001" && segment.polarity === "allow"),
    "expected live field to carry approved authored law",
  );
  assert.ok(
    liveField.some((segment) => segment.entry.id === "DENY.EXACT.SECRET.READ.001" && segment.polarity === "deny"),
    "expected live field to carry denied authored law",
  );
  assert.ok(
    liveField.some((segment) => segment.polarity === "allow" && segment.trafficClass === "allow_rail" && segment.trafficTag.startsWith("UPL.TRAFFIC.RAIL:sha256:")),
    "expected allow segments to carry a deterministic rail tag",
  );
  assert.ok(
    liveField.some((segment) => segment.polarity === "deny" && segment.trafficClass === "deny_wall" && segment.trafficTag.startsWith("UPL.TRAFFIC.WALL:sha256:")),
    "expected deny segments to carry a deterministic wall tag",
  );
  const tamperedSegment = {
    ...liveField[0]!,
    trafficTag: "UPL.TRAFFIC.RAIL:sha256:tampered",
  };
  assert.equal(
    resolveBoundaryUplTrafficPolarity(tamperedSegment),
    null,
    "expected tampered traffic tag to fail closed",
  );

  const liveTracks = compileLiveUplTrackField({ ledger, session });
  assert.equal(liveTracks.length, 2, "expected runtime track field to include both allow and deny corridors");
  assert.equal(liveTracks[0]?.polarity, "deny", "expected deny wall to rank ahead of equal-specificity allow road");
  assert.equal(liveTracks[1]?.polarity, "allow", "expected allow road to remain present in the same runtime field");

  const allowedReadDecision = lookupUserPathDecision({
    ledger,
    session,
    request: exactAllowedRead,
  });
  assert.equal(allowedReadDecision?.decision, "allow", "expected exact workspace read to stay allowed");

  const deniedReadDecision = lookupUserPathDecision({
    ledger,
    session,
    request: exactDeniedRead,
  });
  assert.equal(deniedReadDecision?.decision, "deny", "expected exact secret read to stay denied");

  const openRoadDecision = lookupUserPathTrackDecision({
    ledger,
    session,
    request: makeRequest("fs.write", path.join(workspace, "notes", "todo.txt"), "write:12bytes"),
  });
  assert.equal(openRoadDecision?.decision, "allow", "expected workspace write to remain on the open road");

  const closedRoadDecision = lookupUserPathTrackDecision({
    ledger,
    session,
    request: makeRequest("fs.write", path.join(secretsDir, "blocked.txt"), "write:12bytes"),
  });
  assert.equal(closedRoadDecision?.decision, "deny", "expected secret wall to block motion on the same road");

  const noRoadDecision = lookupUserPathTrackDecision({
    ledger,
    session,
    request: makeRequest("fs.write", path.join("/tmp", "outside-field", "blocked.txt"), "write:12bytes"),
  });
  assert.equal(
    noRoadDecision?.decision,
    "track_violation",
    "expected motion outside the live field to be blocked as a corridor exit",
  );

  console.log("Agent Buccet live UPL field contract");
  console.log(`live field entries: ${liveField.length}`);
  console.log(`runtime track segments: ${liveTracks.length}`);
  console.log(`workspace road: ${openRoadDecision?.decision}`);
  console.log(`secret wall: ${closedRoadDecision?.decision}`);
  console.log(`outside field: ${noRoadDecision?.decision}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
