import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import {
  createBoundaryBodyguard,
  createPersistentBoundaryRuntimeStore,
  getActiveUserLawIds,
  loadUserPathLedger,
  saveUserPathLedger,
} from "../lib/agent-buccet/index.ts";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "scripts", "buccet.ts");

function runCli(args: string[], env: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath, ...args], {
      cwd: repoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

async function main() {
  const originalLedger = await loadUserPathLedger();
  try {
    await saveUserPathLedger({
      specVersion: 1,
      userApprovedLawPaths: [],
      userDeniedLawPaths: [],
    });

    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-doc-law-"));
    const homePath = path.join(tempRoot, "home");
    const workspacePath = path.join(tempRoot, "workspace");
    await fs.mkdir(workspacePath, { recursive: true });
    const actionRailDir = path.join(workspacePath, "rail");
    await fs.mkdir(actionRailDir, { recursive: true });
    const documentPath = path.join(workspacePath, "policy.md");
    await fs.writeFile(documentPath, [
      "# Response policy",
      "",
      "Return only 1999 material. The response must be in bullets. Never mention 2000s. Speak in archival tone.",
      "Like a phoenix rising from the ashes, this response should feel legendary and obviously unforgettable.",
      "",
      `Only permit fs.write inside "${path.join(actionRailDir, "allowed.txt")}". Never write outside "${path.join(actionRailDir, "allowed.txt")}".`,
      "",
      "Decision: deny",
      "Invariant: Never mention spoilers.",
      "Enforcement: Reject spoiler phrasing entirely.",
      "Forbid: spoilers",
    ].join("\n"));

    const env = {
      ...process.env,
      AGENT_BUCCET_HOME: homePath,
      AGENT_BUCCET_CALLER_CWD: workspacePath,
      AGENT_BUCCET_LAUNCHER_PATH: path.join(tempRoot, "bin", "buccet"),
    };

    const initResult = await runCli(["init", "--no-default-scope"], env);
    assert.equal(initResult.code, 0, initResult.stderr);

    const importResult = await runCli(["upl", "import", documentPath, "--json"], env);
    assert.equal(importResult.code, 0, importResult.stderr);
    const imported = JSON.parse(importResult.stdout) as {
      scope: string;
      imported: Array<{ file: string; imported: number; entries: string[] }>;
    };
    assert.equal(imported.scope, "GLOBAL");
    assert.equal(imported.imported.length, 1);
    assert.equal(imported.imported[0].imported, 3, "expected three invariant blocks to compile into three laws");

    const importedLedgerPath = path.join(homePath, "data", "agent-buccet-law-foundation", "user-path-ledger.json");
    const upl = JSON.parse(await fs.readFile(importedLedgerPath, "utf8")) as Awaited<ReturnType<typeof loadUserPathLedger>>;
    const activeDenied = upl.userDeniedLawPaths.filter((entry) => entry.status === "ACTIVE");
    const activeApproved = upl.userApprovedLawPaths.filter((entry) => entry.status === "ACTIVE");
    assert.equal(activeDenied.length, 1);
    assert.ok(activeApproved.some((entry) => entry.trackConstraint?.forbiddenTextPatterns?.includes("2000s")));
    assert.ok(activeApproved.some((entry) => entry.trackConstraint?.outputShape === "bullets"));
    assert.ok(activeApproved.some((entry) => entry.trackConstraint?.requiredTextPatterns?.includes("1999")));
    assert.ok(activeApproved.some((entry) => entry.trackConstraint?.expressionProfile === "archival"));
    assert.ok(activeApproved.some((entry) => entry.trackConstraint?.allowedActionKinds.includes("fs.write")));
    assert.ok(activeApproved.some((entry) => entry.trackConstraint?.targetPattern === actionRailDir));
    assert.ok(activeDenied.some((entry) => entry.trackConstraint?.forbiddenTextPatterns?.includes("spoilers")));

    const sessionId = `agent-buccet-document-law-${Date.now()}`;
    const actorId = "user:document-law-contract";
    const store = await createPersistentBoundaryRuntimeStore({ sessionId, actorId });
    store.replaceConfig({
      ...store.getConfig(),
      upl,
      userLawIds: getActiveUserLawIds(upl, store.getConfig().session),
    });
    const bodyguard = createBoundaryBodyguard(store);

    const blocked = await bodyguard.chat.emit({
      userInput: "only return 1999 material",
      attemptedOutput: "Batman 2000s summary",
      execute: async () => "should-not-run",
      successReason: "chat output emitted after document law",
    });
    assert.equal(blocked.allowed, false, "expected forbidden imported phrase to block output");

    const spoilerBlocked = await bodyguard.chat.emit({
      userInput: "describe the film without spoilers",
      attemptedOutput: "- 1999 Batman spoilers summary",
      execute: async () => "should-not-run",
      successReason: "chat output emitted after document law",
    });
    assert.equal(spoilerBlocked.allowed, false, "expected denied spoiler corridor to block output");

    const expressionBlocked = await bodyguard.chat.emit({
      userInput: "only return 1999 material",
      attemptedOutput: "- Amazing, legendary Batman 1999 revival!",
      execute: async () => "should-not-run",
      successReason: "chat output emitted after document law",
    });
    assert.equal(expressionBlocked.allowed, false, "expected archival expression corridor to block hype output");

    const writeAllowed = await bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: path.join(actionRailDir, "inside.txt"),
      payloadSummary: "write compliant rail file",
      provenance: "agent_inference",
      execute: async () => "ok",
      successReason: "wrote inside rail",
    });
    assert.equal(writeAllowed.allowed, true, "expected imported fs.write corridor to allow inside target");
    assert.equal(writeAllowed.requiresApproval, false, "expected imported fs.write corridor to avoid re-prompt inside rail");

    const writeBlocked = await bodyguard.enforceProposal({
      actionKind: "fs.write",
      target: path.join(workspacePath, "outside.txt"),
      payloadSummary: "write outside rail",
      provenance: "agent_inference",
      execute: async () => "should-not-run",
      successReason: "should not write outside rail",
    });
    assert.equal(writeBlocked.allowed, false, "expected imported fs.write corridor to block outside target");

    const allowed = await bodyguard.chat.emit({
      userInput: "only return 1999 material",
      attemptedOutput: "- Batman 1999 run",
      execute: async () => "ok",
      successReason: "chat output emitted after document law",
    });
    assert.equal(allowed.allowed, true, "expected compliant imported output to pass");

    console.log("Agent Buccet document-law contract");
    console.log(`imported invariant laws: ${imported.imported[0].imported}`);
    console.log(`active approved tracks: ${activeApproved.length}`);
    console.log(`active denied tracks: ${activeDenied.length}`);
    console.log(`forbidden output blocked: ${!blocked.allowed}`);
    console.log(`spoiler output blocked: ${!spoilerBlocked.allowed}`);
    console.log(`expression corridor blocked: ${!expressionBlocked.allowed}`);
    console.log(`action corridor allowed: ${writeAllowed.allowed}`);
    console.log(`action corridor blocked: ${!writeBlocked.allowed}`);
    console.log(`compliant output allowed: ${allowed.allowed}`);
  } finally {
    await saveUserPathLedger(originalLedger);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
