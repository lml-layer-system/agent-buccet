import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  createBoundaryActionRequest,
  evaluateBoundaryAction,
  openBoundaryPath,
  startPersistentBoundarySession,
} from "../lib/agent-buccet/index.ts";

function hasTriggeredLawAlias(ids: readonly string[], alias: string): boolean {
  const aliases = new Map<string, string>([
    ["TIME.TRUST.01", "META.TRUST.01"],
    ["TIME.AUTHORITY.01", "META.AUTHORITY.01"],
    ["TIME.NOVELTY.01", "META.NOVELTY.01"],
    ["TIME.SCOPE.01", "META.SCOPE.01"],
    ["TIME.LAW.01", "META.LAW.01"],
    ["TIME.SESSION.01", "META.SESSION.01"],
    ["TIME.LEDGER.01", "META.LEDGER.01"],
  ]);
  return ids.includes(alias) || ids.includes(aliases.get(alias) ?? alias);
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-time-runtime-"));
  const scopedRoot = path.join(tempRoot, "workspace");
  await fs.mkdir(scopedRoot, { recursive: true });

  let config = await startPersistentBoundarySession({
    sessionId: "agent-buccet-time-runtime-contract",
    actorId: "user:time-runtime-contract",
  });

  ({ config } = await openBoundaryPath({
    config,
    rootPath: scopedRoot,
    grantedActions: ["fs.write"],
    issuedBy: config.session.actorId,
  }));

  const request = createBoundaryActionRequest({
    config,
    actionKind: "fs.write",
    target: path.join(scopedRoot, "result.txt"),
    provenance: "agent_inference",
    flags: {
      claimsCompleteCoverage: true,
    },
  });

  const evaluated = await evaluateBoundaryAction(config, request);
  assert.equal(evaluated.result.decision, "deny");
  assert.ok(
    evaluated.result.triggeredLawIds.includes("DENY.AUTHORITY.SPOOFING.004D"),
    "expected base denial pack to hard-deny complete coverage claims",
  );
  assert.ok(
    hasTriggeredLawAlias(evaluated.result.triggeredLawIds, "TIME.NOVELTY.01"),
    "expected novelty guard to trigger on complete coverage claims",
  );

  ({ config } = await openBoundaryPath({
    config,
    rootPath: scopedRoot,
    grantedActions: ["fs.read"],
    issuedBy: config.session.actorId,
  }));

  const deniedRequest = createBoundaryActionRequest({
    config,
    actionKind: "fs.read",
    target: path.join(scopedRoot, ".env"),
    provenance: "agent_inference",
    flags: {
      claimsCompleteCoverage: true,
    },
  });

  const denied = await evaluateBoundaryAction(config, deniedRequest);
  assert.equal(denied.result.decision, "deny");
  assert.ok(
    hasTriggeredLawAlias(denied.result.triggeredLawIds, "TIME.NOVELTY.01"),
    "expected novelty guard to stay visible even when deny wall wins",
  );

  const deleteConstraintRequest = createBoundaryActionRequest({
    config,
    actionKind: "fs.delete",
    target: path.join(scopedRoot, "keep.txt"),
    provenance: "agent_inference",
    reviewContext: {
      surface: "action",
      userInput: "Do not delete anything in this workspace.",
    },
  });

  assert.equal(deleteConstraintRequest.flags?.violatesUserConstraint, true);
  assert.equal(deleteConstraintRequest.reviewContext?.invariantLawId, "TIME.CONSTRAINT.DELETE.01");

  const constrainedDelete = await evaluateBoundaryAction(config, deleteConstraintRequest);
  assert.equal(constrainedDelete.result.decision, "deny");
  assert.ok(
    constrainedDelete.result.triggeredLawIds.includes("DENY.DESTRUCTIVE.DELETE.009C"),
    "expected explicit delete prohibition to remain denied by the base denial pack",
  );

  const specificDeleteRequest = createBoundaryActionRequest({
    config,
    actionKind: "fs.delete",
    target: path.join(scopedRoot, "package-lock.json"),
    provenance: "agent_inference",
    reviewContext: {
      surface: "action",
      userInput: "Do not delete package-lock.json.",
    },
  });
  assert.equal(specificDeleteRequest.flags?.violatesUserConstraint, true);

  const unrelatedDeleteRequest = createBoundaryActionRequest({
    config,
    actionKind: "fs.delete",
    target: path.join(scopedRoot, "other.txt"),
    provenance: "agent_inference",
    reviewContext: {
      surface: "action",
      userInput: "Do not delete package-lock.json.",
    },
  });
  assert.equal(unrelatedDeleteRequest.flags?.violatesUserConstraint, undefined);

  console.log(`time runtime decision: ${evaluated.result.decision}`);
  console.log(`time runtime hard deny: ${evaluated.result.triggeredLawIds.includes("DENY.AUTHORITY.SPOOFING.004D")}`);
  console.log(`time runtime laws: ${evaluated.result.triggeredLawIds.join(",")}`);
  console.log(`deny wall beats novelty review: ${denied.result.decision}`);
  console.log(`delete constraint activation: ${deleteConstraintRequest.flags?.violatesUserConstraint === true}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
