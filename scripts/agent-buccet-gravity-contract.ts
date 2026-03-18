import { promises as fs } from "node:fs";
import path from "node:path";
import { createBoundaryActionRequest } from "../lib/lml/agent-boundary/executor.ts";
import { createBoundaryGravityService } from "../lib/lml/agent-boundary/gravity-adapter/gravity-service.ts";
import { startPersistentBoundarySession } from "../lib/lml/agent-boundary/state.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionId = `agent-buccet-gravity-contract-${runId}`;
  const actorId = "user:gravity-contract";
  const demoRoot = path.join(process.cwd(), "data", "agent-boundary", "gravity-contract", sessionId);
  const scopedRoot = path.join(demoRoot, "workspace");
  const outsideRoot = path.join(demoRoot, "outside");
  await fs.mkdir(scopedRoot, { recursive: true });
  await fs.mkdir(outsideRoot, { recursive: true });

  let config = await startPersistentBoundarySession({
    sessionId,
    actorId,
  });

  const gravity = createBoundaryGravityService();

  const outOfScope = createBoundaryActionRequest({
    config,
    actionKind: "fs.write",
    target: path.join(outsideRoot, "blocked.txt"),
  });
  const outOfScopeResult = await gravity.enforceRequest({
    config,
    request: outOfScope,
  });
  assert(outOfScopeResult.outcome === "nsl_grant_offer", "expected out-of-scope request to yield NSL grant offer");
  assert(outOfScopeResult.nslMoves.some((move) => move.kind === "open_as_law"), "expected open_as_law NSL move");

  const authorityClaim = createBoundaryActionRequest({
    config,
    actionKind: "fs.write",
    target: path.join(scopedRoot, "authority.txt"),
    provenance: "agent_inference",
    flags: {
      authorityClaimed: true,
    },
  });
  const authorityResult = await gravity.enforceRequest({
    config,
    request: authorityClaim,
  });
  assert(authorityResult.outcome === "deny", "expected authority claim to be denied");

  config = {
    ...config,
    session: {
      ...config.session,
      sessionId: `${sessionId}-broken`,
    },
  };
  const brokenLedger = createBoundaryActionRequest({
    config,
    actionKind: "fs.write",
    target: path.join(scopedRoot, "broken-ledger.txt"),
  });
  const brokenLedgerResult = await gravity.enforceRequest({
    config,
    request: brokenLedger,
  });
  assert(brokenLedgerResult.outcome === "deny", "expected incomplete ledger session to be denied");

  console.log("Agent Buccet gravity contract");
  console.log(`out-of-scope outcome: ${outOfScopeResult.outcome}`);
  console.log(`authority claim outcome: ${authorityResult.outcome}`);
  console.log(`incomplete ledger outcome: ${brokenLedgerResult.outcome}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
