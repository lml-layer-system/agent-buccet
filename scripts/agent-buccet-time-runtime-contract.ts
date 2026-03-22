import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  openBoundaryPath,
  startPersistentBoundarySession,
  evaluateBoundaryIntercept,
} from "../lib/agent-buccet/index.ts";

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

  const result = await evaluateBoundaryIntercept({
    config,
    request: {
      actionClass: "file",
      operation: "write",
      target: path.join(scopedRoot, "result.txt"),
      provenance: "agent_inference",
      flags: {
        claimsCompleteCoverage: true,
      },
    },
  });

  assert.equal(result.decision, "require_approval");
  assert.ok(
    result.lawIds.includes("TIME.NOVELTY.01"),
    "expected novelty guard to trigger on complete coverage claims",
  );

  console.log(`time runtime decision: ${result.decision}`);
  console.log(`time runtime laws: ${result.lawIds.join(",")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
