/**
 * Headless approval handler contract.
 *
 * Proves:
 * H1 — deny_all auto-denies every approval request (full enforcement stack)
 * H2 — allow_if_law_clear denies when a BOUNDARY.* safety law is in lawIds
 * H3 — allow_if_law_clear allows only pure scope expansion
 * H3b — allow_if_law_clear denies track-violation re-prompts
 * H4 — follow_upl applies existing UPL standing law; denies when no match
 * H5 — allow_all auto-allows every approval request (full enforcement stack)
 * H6 — headless denial is recorded in the ledger as APPROVAL_DENIED
 */

import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  createBoundaryBodyguard,
  createBoundaryHeadlessApprovalHandler,
  createPersistentBoundaryRuntimeStore,
  getActiveUserLawIds,
  loadUserPathLedger,
  openBoundaryPath,
  readBoundaryLedgerBySession,
  saveUserPathLedger,
} from "./../../src/index.ts";
import type { BoundaryApprovalRequest, BoundarySession } from "./../../src/index.ts";

const PASS = "\x1b[32m[pass]\x1b[0m";
const FAIL = "\x1b[31m[FAIL]\x1b[0m";
let allPassed = true;

function check(label: string, condition: boolean) {
  console.log(`${condition ? PASS : FAIL} ${label}`);
  if (!condition) { allPassed = false; process.exitCode = 1; }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPending<T>(list: () => T[], timeoutMs = 1_500): Promise<T[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const items = list();
    if (items.length > 0) return items;
    await sleep(25);
  }
  return list();
}

function makeMockApproval(args: {
  session: BoundarySession;
  lawIds: string[];
  actionKind?: string;
  target?: string;
}): BoundaryApprovalRequest {
  return {
    session: args.session,
    request: {
      sessionId: args.session.sessionId,
      requestId: `mock-${Date.now()}`,
      requestedAt: new Date().toISOString(),
      actionKind: (args.actionKind ?? "fs.write") as never,
      target: args.target ?? "/tmp/test.txt",
      provenance: "agent_inference",
    },
    reason: "test approval",
    lawIds: args.lawIds,
    bodyguardMoves: [],
    prompt: {
      title: "test",
      question: "test?",
      surface: "action",
      lawIds: args.lawIds,
      invariantLawId: args.lawIds[0],
      options: [],
    },
  };
}

async function main() {
  const originalLedger = await loadUserPathLedger();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-headless-"));

  try {
    await saveUserPathLedger({ specVersion: 1, userApprovedLawPaths: [], userDeniedLawPaths: [] });

    // ── H1: deny_all — full enforcement stack ────────────────────────────────

    {
      const sessionId = `headless-h1-${Date.now()}`;
      const workspace = path.join(tempRoot, "h1");
      await fs.mkdir(workspace, { recursive: true });

      let store = await createPersistentBoundaryRuntimeStore({ sessionId, actorId: "user:test" });
      const { config: scopedConfig } = await openBoundaryPath({
        config: store.getConfig(),
        rootPath: workspace,
        grantedActions: ["fs.write"],
        issuedBy: "user:test",
        seedBaseAcceptance: false,
      });
      // Inject deny_all headless handler into config
      store.replaceConfig({
        ...scopedConfig,
        approvalHandler: createBoundaryHeadlessApprovalHandler({ mode: "deny_all" }),
      });

      const bodyguard = createBoundaryBodyguard(store);
      const target = path.join(workspace, "file.txt");
      await fs.writeFile(target, "hello");

      // BOUNDARY.FS.WRITE.01 fires → require_approval → deny_all → final deny
      const result = await bodyguard.enforceProposal({
        actionKind: "fs.write",
        target,
        successReason: "wrote file",
        execute: async () => { await fs.writeFile(target, "updated"); },
      });

      check("H1: deny_all auto-denies fs.write approval request", !result.allowed);
    }

    // ── H2: allow_if_law_clear — denies when BOUNDARY.* in lawIds ────────────
    // Direct handler unit test with a mock approval carrying a BOUNDARY.* law.

    {
      const sessionId = `headless-h2-${Date.now()}`;
      const store = await createPersistentBoundaryRuntimeStore({ sessionId, actorId: "user:test" });
      const session = store.getConfig().session;

      const handler = createBoundaryHeadlessApprovalHandler({ mode: "allow_if_law_clear" });
      const approval = makeMockApproval({
        session,
        lawIds: ["BOUNDARY.FS.WRITE.01"],  // BOUNDARY.* — safety law
      });
      const decision = await handler(approval);
      const choice = typeof decision === "boolean" ? (decision ? "allow_once" : "deny_once") : (decision as { choice: string }).choice;
      check("H2: allow_if_law_clear denies when BOUNDARY.FS.WRITE.01 in lawIds", choice === "deny_once");
    }

    // ── H3: allow_if_law_clear — allows pure SCOPE.* expansion only ──────────

    {
      const sessionId = `headless-h3-${Date.now()}`;
      const store = await createPersistentBoundaryRuntimeStore({ sessionId, actorId: "user:test" });
      const session = store.getConfig().session;

      const handler = createBoundaryHeadlessApprovalHandler({ mode: "allow_if_law_clear" });
      const approval = makeMockApproval({
        session,
        lawIds: ["SCOPE.GRANT.CLOSED"],  // no BOUNDARY.* — scope expansion only
      });
      const decision = await handler(approval);
      const choice = typeof decision === "boolean" ? (decision ? "allow_once" : "deny_once") : (decision as { choice: string }).choice;
      check("H3: allow_if_law_clear allows when only SCOPE.GRANT.CLOSED in lawIds", choice === "allow_once");
    }

    {
      const sessionId = `headless-h3b-${Date.now()}`;
      const store = await createPersistentBoundaryRuntimeStore({ sessionId, actorId: "user:test" });
      const session = store.getConfig().session;

      const handler = createBoundaryHeadlessApprovalHandler({ mode: "allow_if_law_clear" });
      const approval = makeMockApproval({
        session,
        lawIds: ["UPL-000123"], // track-wall / standing corridor id, not pure scope
      });
      const decision = await handler(approval);
      const choice = typeof decision === "boolean" ? (decision ? "allow_once" : "deny_once") : (decision as { choice: string }).choice;
      check("H3b: allow_if_law_clear denies track-wall approval requests", choice === "deny_once");
    }

    // ── H4: follow_upl — applies standing law; denies on no match ────────────
    // Structure: open workspace with two subdirs.
    // Record allow_as_law for a file in subdir_a → track binds to subdir_a.
    // H4b: write to subdir_b exits the track corridor (subdir_a != subdir_b)
    //       → track_violation → require_approval → follow_upl finds no UPL law → deny.

    {
      const sessionId = `headless-h4-${Date.now()}`;
      const workspace = path.join(tempRoot, "h4");
      const subdirA = path.join(workspace, "subdir_a");
      const subdirB = path.join(workspace, "subdir_b");
      await fs.mkdir(subdirA, { recursive: true });
      await fs.mkdir(subdirB, { recursive: true });

      // Phase 1: write a standing allow law for targetA in subdir_a
      let store = await createPersistentBoundaryRuntimeStore({ sessionId, actorId: "user:test" });
      const { config: scopedConfig } = await openBoundaryPath({
        config: store.getConfig(),
        rootPath: workspace,
        grantedActions: ["fs.write"],
        issuedBy: "user:test",
        seedBaseAcceptance: false,
      });
      store.replaceConfig({
        ...scopedConfig,
        approvalRequiredFor: [...(scopedConfig.approvalRequiredFor ?? []), "fs.write"],
      });
      const bodyguard = createBoundaryBodyguard(store);

      const targetA = path.join(subdirA, "a.txt");
      await saveUserPathLedger({
        specVersion: 1,
        userApprovedLawPaths: [
          {
            id: "UPL-MANUAL-H4-ALLOW-001",
            type: "APPROVED",
            path: "",
            pathHash: "",
            createdAt: new Date().toISOString(),
            scope: "GLOBAL",
            status: "ACTIVE",
            witness: "manual:h4",
            modifiedAt: null,
            notes: "manual standing allow for fs.write within subdir_a",
            requestBasis: {
              actionKind: "fs.write",
              target: targetA,
              payloadSummary: "write a.txt",
              provenance: "agent_inference",
            },
          },
        ],
        userDeniedLawPaths: [],
      });
      const reloadedLedger = await loadUserPathLedger();
      store.replaceConfig({
        ...store.getConfig(),
        upl: reloadedLedger,
        userLawIds: [...new Set(getActiveUserLawIds(reloadedLedger, store.getConfig().session))],
      });

      // Phase 2: switch to follow_upl headless handler
      store.replaceConfig({
        ...store.getConfig(),
        approvalHandler: createBoundaryHeadlessApprovalHandler({
          mode: "follow_upl",
          getLedger: () => loadUserPathLedger(),
        }),
      });

      // Same target → UPL track (subdir_a) allows it; follow_upl not even called
      const resultA = await bodyguard.enforceProposal({
        actionKind: "fs.write",
        target: targetA,
        successReason: "wrote a.txt again",
        execute: async () => { await fs.writeFile(targetA, "updated"); },
      });
      check("H4a: follow_upl allows when standing UPL allow law matches", resultA.allowed);

      // Different subdir → exits track corridor (subdir_b ≠ subdir_a)
      // → track_violation → require_approval → follow_upl: no UPL law for subdir_b → deny
      const targetB = path.join(subdirB, "b.txt");
      const resultB = await bodyguard.enforceProposal({
        actionKind: "fs.write",
        target: targetB,
        successReason: "wrote b.txt",
        execute: async () => { await fs.writeFile(targetB, "data"); },
      });
      check("H4b: follow_upl denies when request exits track corridor and no UPL law matches", !resultB.allowed);
    }

    // ── H5: allow_all — full enforcement stack ────────────────────────────────

    {
      const sessionId = `headless-h5-${Date.now()}`;
      const workspace = path.join(tempRoot, "h5");
      await fs.mkdir(workspace, { recursive: true });

      let store = await createPersistentBoundaryRuntimeStore({ sessionId, actorId: "user:test" });
      const { config: scopedConfig } = await openBoundaryPath({
        config: store.getConfig(),
        rootPath: workspace,
        grantedActions: ["fs.write"],
        issuedBy: "user:test",
        seedBaseAcceptance: false,
      });
      store.replaceConfig({
        ...scopedConfig,
        approvalHandler: createBoundaryHeadlessApprovalHandler({ mode: "allow_all" }),
      });

      const bodyguard = createBoundaryBodyguard(store);
      const target = path.join(workspace, "write-me.txt");
      await fs.writeFile(target, "bye");

      const result = await bodyguard.enforceProposal({
        actionKind: "fs.write",
        target,
        successReason: "wrote file",
        execute: async () => { await fs.writeFile(target, "changed"); },
      });
      check("H5: allow_all auto-allows fs.write approval request", result.allowed);
    }

    // ── H6: ledger records APPROVAL_DENIED after headless deny ───────────────

    {
      const sessionId = `headless-h6-${Date.now()}`;
      const workspace = path.join(tempRoot, "h6");
      await fs.mkdir(workspace, { recursive: true });

      let store = await createPersistentBoundaryRuntimeStore({ sessionId, actorId: "user:test" });
      const { config: scopedConfig } = await openBoundaryPath({
        config: store.getConfig(),
        rootPath: workspace,
        grantedActions: ["fs.write"],
        issuedBy: "user:test",
        seedBaseAcceptance: false,
      });
      store.replaceConfig({
        ...scopedConfig,
        approvalHandler: createBoundaryHeadlessApprovalHandler({ mode: "deny_all" }),
      });

      const bodyguard = createBoundaryBodyguard(store);
      const target = path.join(workspace, "file.txt");
      await fs.writeFile(target, "data");
      await bodyguard.enforceProposal({
        actionKind: "fs.write",
        target,
        successReason: "wrote",
        execute: async () => { await fs.writeFile(target, "blocked"); },
      });

      await sleep(200); // let ledger flush
      const events = await readBoundaryLedgerBySession(sessionId);
      const denied = events.filter((e) => e.eventType === "APPROVAL_DENIED");
      check("H6: APPROVAL_DENIED recorded in ledger after headless deny_all", denied.length > 0);
    }

  } finally {
    await saveUserPathLedger(originalLedger);
    await fs.rm(tempRoot, { recursive: true, force: true });
  }

  console.log(`\nAgent Buccet headless approval contract`);
  console.log(`  H1 deny_all:           ${allPassed ? "auto-deny" : "FAILED"}`);
  console.log(`  H2 allow_if_law_clear: deny on BOUNDARY.* law`);
  console.log(`  H3 allow_if_law_clear: allow on pure scope-only law`);
  console.log(`  H3b allow_if_law_clear: deny on track-wall approval`);
  console.log(`  H4 follow_upl:         follow standing UPL law`);
  console.log(`  H5 allow_all:          auto-allow`);
  console.log(`  H6 ledger:             APPROVAL_DENIED recorded`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
