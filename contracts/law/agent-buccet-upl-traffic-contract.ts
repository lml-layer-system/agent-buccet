import assert from "node:assert/strict";
import path from "node:path";
import {
  describeUserPath,
  evaluateBoundaryUplTraffic,
  hashUserPath,
} from "./../../src/index.ts";
import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryRuntimeConfig,
  BoundarySession,
  BoundaryUplEntry,
  BoundaryUplEntryType,
  BoundaryUserPathLedger,
} from "./../../src/index.ts";

function makeSession(): BoundarySession {
  return {
    sessionId: "upl-traffic",
    actorId: "user:upl-traffic-contract",
    createdAt: "2026-04-02T00:00:00.000Z",
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
    sessionId: "upl-traffic",
    actionKind,
    target,
    payloadSummary,
    requestedAt: "2026-04-02T00:00:00.000Z",
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
    witness: "UPL.TRAFFIC.CONTRACT",
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

function makeConfig(ledger: BoundaryUserPathLedger): BoundaryRuntimeConfig {
  return {
    session: makeSession(),
    laws: [],
    grants: [],
    pathLaws: [],
    approvalRequiredFor: [],
    userLawIds: [],
    upl: ledger,
    runtimeMuscle: {
      manifest: {
        generatedAt: "2026-04-02T00:00:00.000Z",
        activeBaseLawCount: 1,
        activeTimeLawCount: 1,
        activeLawBodyCount: 1,
        substrateFamilyCount: 1,
        substrateSourceKernelCount: 1,
        hashes: {
          runtimeSubstrateSha256: "sha256:upl-traffic-contract",
          materializedActiveLawBodySha256: "sha256:upl-traffic-contract-body",
        },
        sizes: {
          runtimeSubstrateBytes: 1,
          materializedActiveLawBodyBytes: 1,
        },
        artifactPaths: {
          substrate: "upl-traffic-contract",
          activeLawBodySource: "upl-traffic-contract",
        },
      },
      substrate: {
        loadedAt: "2026-04-02T00:00:00.000Z",
      },
      activeLawIds: ["BUCCET.TIME.UPL.TRAFFIC.01"],
      timeLawIdsByGate: {
        bodyguard: ["BUCCET.TIME.UPL.TRAFFIC.01"],
      },
      timeLawIdsByCategory: {
        user_path_ledger: ["BUCCET.TIME.UPL.TRAFFIC.01"],
      },
    },
    persistence: {
      enabled: false,
    },
  };
}

async function main() {
  const workspace = path.join("/tmp", "agent-buccet-upl-traffic", "workspace");
  const secretsDir = path.join(workspace, "secrets");

  const ledger: BoundaryUserPathLedger = {
    specVersion: 1,
    userApprovedLawPaths: [
      makeEntry({
        id: "ALLOW.EXACT.READ.001",
        type: "APPROVED",
        request: makeRequest("fs.read", path.join(workspace, "README.md"), "read:utf8"),
        createdAt: "2026-04-02T00:00:00.000Z",
      }),
      makeEntry({
        id: "ALLOW.TRAFFIC.WRITE.002",
        type: "APPROVED",
        request: makeRequest("fs.write", path.join(workspace, "seed.txt"), "write:4bytes"),
        createdAt: "2026-04-02T00:00:01.000Z",
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
        id: "DENY.EXACT.READ.001",
        type: "DENIED",
        request: makeRequest("fs.read", path.join(secretsDir, ".env"), "read:utf8"),
        createdAt: "2026-04-02T00:00:02.000Z",
      }),
      makeEntry({
        id: "DENY.TRAFFIC.WRITE.002",
        type: "DENIED",
        request: makeRequest("fs.write", path.join(secretsDir, "seed.txt"), "write:4bytes"),
        createdAt: "2026-04-02T00:00:03.000Z",
        trackConstraint: {
          allowedActionKinds: ["fs.write"],
          targetPattern: secretsDir,
          targetMatchMode: "prefix",
          description: `fs.write blocked inside ${secretsDir}`,
        },
      }),
    ],
  };

  const config = makeConfig(ledger);

  const exactAllow = evaluateBoundaryUplTraffic({
    config,
    request: makeRequest("fs.read", path.join(workspace, "README.md"), "read:utf8"),
  });
  assert.equal(exactAllow.decision, "allow");
  assert.equal(exactAllow.trafficClass, "allow_rail");
  assert.ok(exactAllow.trafficTag?.startsWith("UPL.TRAFFIC.RAIL:sha256:"));
  assert.ok(exactAllow.triggeredLawIds.includes("ALLOW.EXACT.READ.001"));

  const exactDeny = evaluateBoundaryUplTraffic({
    config,
    request: makeRequest("fs.read", path.join(secretsDir, ".env"), "read:utf8"),
  });
  assert.equal(exactDeny.decision, "deny");
  assert.equal(exactDeny.trafficClass, "deny_wall");
  assert.ok(exactDeny.trafficTag?.startsWith("UPL.TRAFFIC.WALL:sha256:"));
  assert.ok(exactDeny.triggeredLawIds.includes("DENY.EXACT.READ.001"));

  const openRoad = evaluateBoundaryUplTraffic({
    config,
    request: makeRequest("fs.write", path.join(workspace, "notes", "todo.txt"), "write:12bytes"),
  });
  assert.equal(openRoad.decision, "allow");
  assert.ok(openRoad.triggeredLawIds.includes("ALLOW.TRAFFIC.WRITE.002"));

  const closedWall = evaluateBoundaryUplTraffic({
    config,
    request: makeRequest("fs.write", path.join(secretsDir, "blocked.txt"), "write:12bytes"),
  });
  assert.equal(closedWall.decision, "deny");
  assert.ok(closedWall.triggeredLawIds.includes("DENY.TRAFFIC.WRITE.002"));

  const drift = evaluateBoundaryUplTraffic({
    config,
    request: makeRequest("fs.write", path.join("/tmp", "outside-traffic", "blocked.txt"), "write:12bytes"),
  });
  assert.equal(drift.decision, "drift");
  assert.equal(drift.trafficClass, "allow_rail");
  assert.equal(drift.uplTrackViolated, true);
  assert.ok(drift.reason?.includes("exits approved execution corridor"));

  const noMatch = evaluateBoundaryUplTraffic({
    config,
    request: makeRequest("tool.exec", "git", "status"),
  });
  assert.equal(noMatch.decision, "no_match");

  console.log("Agent Buccet UPL Traffic contract");
  console.log(`exact allow: ${exactAllow.decision}`);
  console.log(`exact deny: ${exactDeny.decision}`);
  console.log(`open road: ${openRoad.decision}`);
  console.log(`closed wall: ${closedWall.decision}`);
  console.log(`drift: ${drift.decision}`);
  console.log(`no match: ${noMatch.decision}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
