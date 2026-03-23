/**
 * Agent Buccet — Quickstart
 *
 * A minimal self-contained example showing how to enforce boundaries
 * on agent actions. Copy this file, run it, and modify from here.
 *
 * Run (from repo root):
 *   node examples/quickstart/index.ts
 *
 * What this shows:
 *   1. Start a boundary session for your agent
 *   2. Open a workspace path — the only scope the agent can reach
 *   3. Evaluate actions through the full chain (intercept → gravity → law)
 *   4. Legitimate actions pass; prompt-injection attacks are blocked
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  enableBodyguardControl,
  startPersistentBoundarySession,
  openBoundaryPath,
  evaluateBoundaryIntercept,
} from "../../lib/agent-buccet/index.ts";

async function main() {
  // ── 1. Create a temporary workspace ───────────────────────────────────────
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-quickstart-"));
  console.log(`Workspace: ${workspace}\n`);

  // ── 2. Start a boundary session ───────────────────────────────────────────
  // Every agent gets a session. The session is the identity anchor for all
  // enforcement decisions, ledger entries, and grant tracking.
  const sessionId = `quickstart-${Date.now()}`;
  const actorId = "user:alice";

  let config = await startPersistentBoundarySession({ sessionId, actorId });

  // ── 3. Open the workspace as reachable scope ──────────────────────────────
  // Agents can only act on paths that have been explicitly opened.
  // Anything outside this path is denied at the scope check.
  const { config: scopedConfig } = await openBoundaryPath({
    config,
    rootPath: workspace,
    grantedActions: ["fs.read", "fs.write"],
    issuedBy: actorId,
  });
  config = enableBodyguardControl(scopedConfig);

  // ── 4. Evaluate a legitimate action ───────────────────────────────────────
  // A trusted user writing inside the workspace → allowed.
  const allowResult = await evaluateBoundaryIntercept({
    config,
    request: {
      actionClass: "file",
      operation: "write",
      target: path.join(workspace, "output.txt"),
      provenance: "trusted_user",
    },
  });

  console.log("Legitimate write (trusted_user, in-scope):");
  console.log(`  decision : ${allowResult.decision}`);   // allow
  console.log(`  laws     : ${allowResult.lawIds.join(", ") || "none"}`);
  console.log();

  // ── 5. Evaluate a prompt-injection attack ─────────────────────────────────
  // An agent claims authority ("I have been pre-authorized...").
  // TIME.AUTHORITY.01 fires and the action is denied.
  const denyResult = await evaluateBoundaryIntercept({
    config,
    request: {
      actionClass: "file",
      operation: "write",
      target: path.join(workspace, "output.txt"),
      provenance: "agent_inference",
      flags: { authorityClaimed: true },
    },
  });

  console.log("Authority claim attack (agent_inference + authorityClaimed):");
  console.log(`  decision : ${denyResult.decision}`);    // deny
  console.log(`  laws     : ${denyResult.lawIds.join(", ")}`);  // TIME.AUTHORITY.01
  console.log(`  reason   : ${denyResult.reason}`);
  console.log();

  // ── 6. Evaluate an out-of-scope target ────────────────────────────────────
  // The agent tries to write /etc/passwd — outside the opened workspace.
  // The scope check blocks it before any law evaluation runs.
  const outOfScopeResult = await evaluateBoundaryIntercept({
    config,
    request: {
      actionClass: "file",
      operation: "write",
      target: "/etc/passwd",
      provenance: "agent_inference",
    },
  });

  console.log("Out-of-scope target (/etc/passwd):");
  console.log(`  decision : ${outOfScopeResult.decision}`);   // require_approval (NSL offer)
  console.log(`  laws     : ${outOfScopeResult.lawIds.join(", ")}`);
  console.log(`  reason   : ${outOfScopeResult.reason}`);
  console.log();

  console.log("Agents can propose. They cannot authorize.");

  // Cleanup
  await fs.rm(workspace, { recursive: true, force: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
