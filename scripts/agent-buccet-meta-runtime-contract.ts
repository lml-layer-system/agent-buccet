import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  createBoundaryActionRequest,
  evaluateBoundaryAction,
  openBoundaryPath,
  startPersistentBoundarySession,
} from "../lib/lml/agent-boundary/index.ts";

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-meta-runtime-"));
  const scopedRoot = path.join(tempRoot, "workspace");
  await fs.mkdir(scopedRoot, { recursive: true });

  let config = await startPersistentBoundarySession({
    sessionId: "agent-buccet-meta-runtime-contract",
    actorId: "user:meta-runtime-contract",
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
  assert.equal(evaluated.result.decision, "require_approval");
  assert.ok(
    evaluated.result.triggeredLawIds.includes("META.NOVELTY.01"),
    "expected novelty guard to trigger on complete coverage claims",
  );

  console.log(`meta runtime decision: ${evaluated.result.decision}`);
  console.log(`meta runtime laws: ${evaluated.result.triggeredLawIds.join(",")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
