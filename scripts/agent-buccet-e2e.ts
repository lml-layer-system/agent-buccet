import { promises as fs } from "node:fs";
import path from "node:path";
import {
  auditBoundaryRequestLedger,
  auditBoundarySessionLedger,
  createBoundaryBodyguard,
  createPersistentBoundaryRuntimeStore,
  formatBoundaryLedgerRecords,
  readBoundarySessionTimeline,
  restoreBoundaryRuntimeStore,
} from "./../src/index.ts";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPendingApproval<T>(
  listPending: () => T[],
  timeoutMs = 1000,
): Promise<T[]> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pending = listPending();
    if (pending.length > 0) {
      return pending;
    }
    await sleep(25);
  }
  return listPending();
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function readText(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function findLatestRequestIdForTarget(lines: Awaited<ReturnType<typeof readBoundarySessionTimeline>>, target: string) {
  const match = [...lines]
    .reverse()
    .find((record) => record.eventType === "ACTION_PROPOSED" && record.payload.target === target);
  return match?.payload.requestId ?? null;
}

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionId = `agent-buccet-demo-${runId}`;
  const actorId = "user:agent-buccet-demo";
  const demoRoot = path.join(process.cwd(), "data", "agent-boundary", "demo", sessionId);
  const sessionsDir = path.join(process.cwd(), "data", "agent-boundary", "demo-sessions");
  const scopedRoot = path.join(demoRoot, "workspace");
  const outsideRoot = path.join(demoRoot, "outside");
  const insideFile = path.join(scopedRoot, "notes.txt");
  const insideDeleteFile = path.join(scopedRoot, "delete-me.txt");
  const outsideFile = path.join(outsideRoot, "do-not-touch.txt");
  const restoredFile = path.join(scopedRoot, "restored.txt");

  await ensureDir(scopedRoot);
  await ensureDir(outsideRoot);
  await fs.writeFile(insideFile, "initial\n", "utf8");
  await fs.writeFile(insideDeleteFile, "delete candidate\n", "utf8");
  await fs.writeFile(outsideFile, "protected\n", "utf8");

  const store = await createPersistentBoundaryRuntimeStore({
    sessionId,
    actorId,
    sessionsDir,
  });

  await store.openPath({
    rootPath: scopedRoot,
    grantedActions: ["fs.read", "fs.write", "fs.delete", "fs.mkdir", "fs.move"],
    issuedBy: actorId,
  });

  const bodyguard = createBoundaryBodyguard(store);

  const allowedWrite = bodyguard.nemo.wrapTool({
    toolName: "write_notes",
    actionKind: "fs.write",
    describeTarget: (input: { path: string }) => input.path,
    payloadSummary: (input) => `write:${input.path}`,
    execute: async (input) => {
      await fs.writeFile(input.path, "inside scope\n", "utf8");
      return { ok: true, path: input.path };
    },
  });

  const allowedWriteResult = await allowedWrite({ path: insideFile });
  assert(allowedWriteResult.allowed && allowedWriteResult.executed, "expected in-scope write to execute");
  assert((await readText(insideFile)) === "inside scope\n", "expected in-scope file to be updated");

  const outsideWrite = bodyguard.openaiAgents.wrapTool({
    toolName: "write_outside",
    actionKind: "fs.write",
    describeTarget: (input: { path: string }) => input.path,
    payloadSummary: (input) => `write:${input.path}`,
    execute: async (input) => {
      await fs.writeFile(input.path, "compromised\n", "utf8");
      return { ok: true, path: input.path };
    },
  });

  const deniedWritePromise = outsideWrite({ path: outsideFile });
  const pendingScopeApproval = await waitForPendingApproval(() => bodyguard.approvals.listPending());
  assert(pendingScopeApproval.length === 1, "expected out-of-scope write to queue open-as-law approval");
  bodyguard.approvals.denyOnce(pendingScopeApproval[0].approvalId);
  const finalizedDeniedWriteResult = await deniedWritePromise;
  assert(!finalizedDeniedWriteResult.allowed && !finalizedDeniedWriteResult.executed, "expected out-of-scope write to be denied");
  assert((await readText(outsideFile)) === "protected\n", "expected out-of-scope file to remain unchanged");

  const deleteProposal = bodyguard.telegram.buildProposal({
    actionKind: "fs.delete",
    target: insideDeleteFile,
    rawText: "clean up the temp files",
    successReason: "delete should never execute",
    execute: async () => {
      await fs.rm(insideDeleteFile, { force: true });
      return { deleted: true };
    },
  });

  const deleteResult = await bodyguard.telegram.enforceProposal(deleteProposal);
  assert(!deleteResult.allowed && !deleteResult.executed, "expected in-scope delete to be denied by default");
  assert(await pathExists(insideDeleteFile), "expected denied delete target to remain present");

  const restoredStore = await restoreBoundaryRuntimeStore({
    sessionId,
    sessionsDir,
  });
  assert(restoredStore, "expected persistent boundary store to restore");
  const restoredBodyguard = createBoundaryBodyguard(restoredStore);

  const restoredWrite = restoredBodyguard.langgraph.wrapNode({
    toolName: "restored_write",
    actionKind: "fs.write",
    describeTarget: () => restoredFile,
    payloadSummary: () => `write:${restoredFile}`,
    execute: async () => {
      await fs.writeFile(restoredFile, "restored scope still lawful\n", "utf8");
      return { ok: true };
    },
  });

  const restoredWriteResult = await restoredWrite({});
  assert(restoredWriteResult.allowed && restoredWriteResult.executed, "expected restored in-scope write to execute");
  assert((await readText(restoredFile)) === "restored scope still lawful\n", "expected restored write to persist");

  await restoredStore.endSession({
    endedBy: actorId,
    reason: "end-to-end demo complete",
  });

  const postEndResult = await restoredBodyguard.enforceProposal({
    actionKind: "fs.write",
    target: path.join(scopedRoot, "after-end.txt"),
    payloadSummary: "write after ended session",
    successReason: "should never execute after session end",
    execute: async () => {
      await fs.writeFile(path.join(scopedRoot, "after-end.txt"), "should not exist\n", "utf8");
      return { ok: true };
    },
  });
  assert(!postEndResult.allowed && !postEndResult.executed, "expected ended session to deny later actions");

  const sessionAudit = await auditBoundarySessionLedger(sessionId);
  assert(sessionAudit.status === "complete", "expected session ledger audit to be complete");

  const sessionTimeline = await readBoundarySessionTimeline(sessionId);
  const deniedWriteRequestId = findLatestRequestIdForTarget(sessionTimeline, outsideFile);
  const deleteRequestId = findLatestRequestIdForTarget(sessionTimeline, insideDeleteFile);
  assert(deniedWriteRequestId, "expected request id for denied out-of-scope write");
  assert(deleteRequestId, "expected request id for denied delete");

  const deniedWriteAudit = await auditBoundaryRequestLedger(deniedWriteRequestId);
  const deleteAudit = await auditBoundaryRequestLedger(deleteRequestId);

  console.log("Agent Buccet end-to-end example");
  console.log(`session: ${sessionId}`);
  console.log(`scoped root: ${scopedRoot}`);
  console.log("");
  console.log("results:");
  console.log(`- in-scope write: allowed=${allowedWriteResult.allowed} executed=${allowedWriteResult.executed}`);
  console.log(`- out-of-scope write: allowed=${finalizedDeniedWriteResult.allowed} executed=${finalizedDeniedWriteResult.executed}`);
  console.log(`- delete by default: allowed=${deleteResult.allowed} executed=${deleteResult.executed}`);
  console.log(`- restored in-scope write: allowed=${restoredWriteResult.allowed} executed=${restoredWriteResult.executed}`);
  console.log(`- post-end action: allowed=${postEndResult.allowed} executed=${postEndResult.executed}`);
  console.log("");
  console.log("audits:");
  console.log(`- session: ${sessionAudit.status}`);
  console.log(`- denied write request: ${deniedWriteAudit.status}`);
  console.log(`- denied delete request: ${deleteAudit.status}`);
  console.log("");
  console.log("session ledger:");
  for (const line of formatBoundaryLedgerRecords(sessionTimeline)) {
    console.log(`  ${line}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
