/**
 * Agent Buccet — end-to-end demo
 *
 * Run:  node scripts/agent-buccet-demo.ts
 * Or:   npm run demo:agent-buccet
 *
 * Shows:
 *  1. An agent tries to write outside its opened scope  → BLOCKED
 *  2. An agent tries to delete a file                   → APPROVAL REQUIRED → headless deny
 *  3. An agent tries to write within scope              → APPROVAL REQUIRED → user approves as law
 *  4. UPL track auto-allows subsequent writes in same dir (no re-prompt)
 *  5. Agent exits the approved corridor                 → TRACK VIOLATION → require_approval
 *  6. Ledger summary: signed events, chain hash, UPL laws
 */

import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  createBoundaryBodyguard,
  createBoundaryHeadlessApprovalHandler,
  createPersistentBoundaryRuntimeStore,
  loadUserPathLedger,
  openBoundaryPath,
  readBoundaryLedgerBySession,
  saveUserPathLedger,
} from "../lib/agent-buccet/index.ts";

// ── Terminal colours ──────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

function line(char = "─", n = 60) { return char.repeat(n); }

function badge(label: string, color: string) {
  return `${color}${C.bold}[${label}]${C.reset}`;
}

function logStep(n: number, label: string) {
  console.log(`\n${C.dim}${line()}${C.reset}`);
  console.log(`${C.bold}${C.blue}Step ${n}:${C.reset} ${label}`);
}

function logResult(decision: string, reason: string) {
  const color = decision === "ALLOW" ? C.green : decision === "DENY" ? C.red : C.yellow;
  console.log(`  ${badge(decision, color)} ${C.dim}${reason}${C.reset}`);
}

// ── Demo ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}${C.cyan}Agent Buccet — Live Demo${C.reset}`);
  console.log(`${C.dim}Mechanical boundary enforcement for AI agents${C.reset}`);
  console.log(`${C.dim}${line()}${C.reset}`);

  // Preserve existing UPL ledger state
  const originalLedger = await loadUserPathLedger();

  try {
    await saveUserPathLedger({ specVersion: 1, userApprovedLawPaths: [], userDeniedLawPaths: [] });

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-demo-"));
    const workspace = path.join(tempRoot, "workspace");
    const subdir = path.join(workspace, "outputs");
    const outsideDir = path.join(tempRoot, "outside");
    await fs.mkdir(subdir, { recursive: true });
    await fs.mkdir(outsideDir, { recursive: true });

    const sessionId = `demo-${Date.now()}`;
    const actorId = "agent:demo";

    console.log(`\n${C.dim}Session: ${sessionId}${C.reset}`);
    console.log(`${C.dim}Workspace: ${workspace}${C.reset}`);

    // ── Setup: open a scoped workspace path ──────────────────────────────────

    let store = await createPersistentBoundaryRuntimeStore({ sessionId, actorId });
    const { config: scopedConfig } = await openBoundaryPath({
      config: store.getConfig(),
      rootPath: workspace,
      grantedActions: ["fs.write", "fs.delete", "fs.read"],
      issuedBy: "user:operator",
    });
    // Use headless handler for auto-denial of approval requests
    // (except for step 3 where we temporarily switch to queue)
    store.replaceConfig({
      ...scopedConfig,
      approvalHandler: createBoundaryHeadlessApprovalHandler({ mode: "deny_all" }),
    });

    const bodyguard = createBoundaryBodyguard(store);

    // ── Step 1: Write outside opened scope ───────────────────────────────────

    logStep(1, "Agent tries to write OUTSIDE opened workspace scope");
    console.log(`  ${C.dim}target: ${path.join(outsideDir, "escape.txt")} (outside workspace)${C.reset}`);

    const step1 = await bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: path.join(outsideDir, "escape.txt"),
      successReason: "wrote escape file",
      execute: async () => {
        await fs.writeFile(path.join(outsideDir, "escape.txt"), "escaped");
      },
    });

    logResult(step1.allowed ? "ALLOW" : "DENY", step1.reason);
    console.log(`  ${C.dim}Law: BOUNDARY.DEFAULT_SCOPE.01 — target outside opened scope${C.reset}`);

    // ── Step 2: Delete within scope — BOUNDARY.DELETE.01 → headless deny ─────

    logStep(2, "Agent tries to delete a file — headless auto-deny");
    const targetForDeletion = path.join(workspace, "temp.txt");
    await fs.writeFile(targetForDeletion, "created");
    console.log(`  ${C.dim}target: ${targetForDeletion}${C.reset}`);
    console.log(`  ${C.dim}approval handler: headless deny_all${C.reset}`);

    const step2 = await bodyguard.enforceProposal({
      actionKind: "fs.delete",
      target: targetForDeletion,
      successReason: "deleted temp file",
      execute: async () => { await fs.unlink(targetForDeletion); },
    });

    logResult(step2.allowed ? "ALLOW" : "DENY", step2.reason);
    console.log(`  ${C.dim}Law: BOUNDARY.DELETE.01 → require_approval → headless:deny_all${C.reset}`);

    // ── Step 3: Write within scope — user approves as law ────────────────────

    logStep(3, "Agent writes within scope — human approves allow_as_law");
    const targetA = path.join(subdir, "result.txt");
    console.log(`  ${C.dim}target: ${targetA}${C.reset}`);

    // Switch to queue adapter for this step (simulates human in Terminal 2)
    const {
      createApprovalQueueAdapter,
    } = await import("../lib/agent-buccet/approval.ts");
    const queue = createApprovalQueueAdapter();
    store.replaceConfig({ ...store.getConfig(), approvalHandler: queue.handler });

    const step3Promise = bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: targetA,
      successReason: "wrote result.txt",
      execute: async () => { await fs.writeFile(targetA, "output data\n"); },
    });

    // Simulate human approving as standing law (Terminal 2 interaction)
    // Poll for the pending approval (it arrives async from the bodyguard pipeline)
    const deadline = Date.now() + 2_000;
    let pending: { approvalId: string }[] = [];
    while (Date.now() < deadline) {
      pending = queue.listPending();
      if (pending.length > 0) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    if (pending.length > 0) {
      queue.allowAsLaw(pending[0].approvalId);
      console.log(`  ${C.dim}→ Human approves: allow_as_law (standing UPL law recorded)${C.reset}`);
    } else {
      console.log(`  ${C.yellow}→ No pending approval appeared within 2s${C.reset}`);
    }

    const step3 = await step3Promise;
    logResult(step3.allowed ? "ALLOW" : "DENY", step3.reason);

    // Check UPL state
    const upl = await loadUserPathLedger();
    const trackEntry = upl.userApprovedLawPaths.find((e) => e.status === "ACTIVE" && e.trackConstraint);
    if (trackEntry?.trackConstraint) {
      console.log(
        `  ${C.green}✓ UPL Track bound:${C.reset} ${C.dim}${trackEntry.trackConstraint.allowedActionKinds.join(",")}` +
        ` within ${trackEntry.trackConstraint.targetPattern}${C.reset}`,
      );
    }

    // Switch back to deny_all headless for subsequent steps
    store.replaceConfig({ ...store.getConfig(), approvalHandler: createBoundaryHeadlessApprovalHandler({ mode: "deny_all" }) });

    // ── Step 4: UPL track auto-allows repeat in same corridor ────────────────

    logStep(4, "Agent writes to same corridor — UPL track auto-allows (no prompt)");
    const targetA2 = path.join(subdir, "result2.txt");
    console.log(`  ${C.dim}target: ${targetA2} (same dir as approved)${C.reset}`);

    const step4 = await bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: targetA2,
      successReason: "wrote result2.txt",
      execute: async () => { await fs.writeFile(targetA2, "more output\n"); },
    });

    logResult(step4.allowed ? "ALLOW" : "DENY", step4.reason);
    if (step4.allowed) {
      console.log(`  ${C.dim}→ No approval required: UPL track matched the corridor${C.reset}`);
    }

    // ── Step 5: Write exits approved corridor — track violation ───────────────

    logStep(5, "Agent writes to a DIFFERENT directory — exits UPL track corridor");
    const otherDir = path.join(workspace, "other");
    await fs.mkdir(otherDir, { recursive: true });
    const targetB = path.join(otherDir, "escape.txt");
    console.log(`  ${C.dim}target: ${targetB} (different dir, exits corridor)${C.reset}`);

    const step5 = await bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: targetB,
      successReason: "wrote to other dir",
      execute: async () => { await fs.writeFile(targetB, "other data\n"); },
    });

    logResult(
      step5.requiresApproval ? "TRACK-VIOLATION" : step5.allowed ? "ALLOW" : "DENY",
      step5.reason,
    );
    if (step5.requiresApproval) {
      console.log(`  ${C.dim}→ Motion exits approved corridor → require_approval surfaced${C.reset}`);
      console.log(`  ${C.dim}→ Not a hard deny — user can consciously expand the corridor${C.reset}`);
    }

    // ── Ledger summary ────────────────────────────────────────────────────────

    console.log(`\n${C.dim}${line()}${C.reset}`);
    console.log(`${C.bold}${C.cyan}Ledger Summary${C.reset}`);

    await new Promise((r) => setTimeout(r, 300)); // let ledger flush
    const events = await readBoundaryLedgerBySession(sessionId);

    const counts: Record<string, number> = {};
    for (const e of events) {
      counts[e.eventType] = (counts[e.eventType] ?? 0) + 1;
    }

    const lastEvent = events[events.length - 1];

    console.log(`  ${C.dim}Total events:${C.reset}  ${events.length}`);
    console.log(`  ${C.dim}Chain tail:${C.reset}    ${lastEvent?.META?.hash?.slice(0, 20) ?? "—"}...`);
    console.log(`  ${C.dim}UPL laws:${C.reset}      ${upl.userApprovedLawPaths.filter((e) => e.status === "ACTIVE").length} active allow, ${upl.userDeniedLawPaths.filter((e) => e.status === "ACTIVE").length} active deny`);
    console.log(`\n  ${C.bold}Event counts:${C.reset}`);
    for (const [type, count] of Object.entries(counts).sort()) {
      console.log(`    ${C.dim}${type.padEnd(30)}${C.reset} ${count}`);
    }

    // ── Outcome ───────────────────────────────────────────────────────────────

    console.log(`\n${C.dim}${line()}${C.reset}`);
    const outcomes = [
      { label: "Out-of-scope write blocked", pass: !step1.allowed },
      { label: "Headless denial (BOUNDARY.DELETE.01)", pass: !step2.allowed },
      { label: "User allow_as_law recorded UPL law", pass: step3.allowed },
      { label: "UPL track auto-allowed repeat write", pass: step4.allowed },
      { label: "Track violation surfaced (exits corridor)", pass: step5.requiresApproval },
    ];

    let allOk = true;
    for (const o of outcomes) {
      const mark = o.pass ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
      console.log(`  ${mark} ${o.label}`);
      if (!o.pass) allOk = false;
    }

    console.log();
    if (allOk) {
      console.log(`${C.bold}${C.green}All demo assertions passed.${C.reset}`);
    } else {
      console.log(`${C.bold}${C.red}Some assertions failed.${C.reset}`);
      process.exitCode = 1;
    }
    console.log();

    await fs.rm(tempRoot, { recursive: true, force: true });

  } finally {
    await saveUserPathLedger(originalLedger);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
