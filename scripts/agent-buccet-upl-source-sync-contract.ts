import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import {
  createBoundaryBodyguard,
  createPersistentBoundaryRuntimeStore,
  getActiveUserLawIds,
} from "../lib/agent-buccet/index.ts";
import type { BoundaryUserPathLedger } from "../lib/agent-buccet/index.ts";

const repoRoot = process.cwd();
const scriptPath = await (async () => {
  const candidates = [
    path.join(repoRoot, "scripts", "buccet.ts"),
    path.join(repoRoot, "bin", "buccet.ts"),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error("unable to locate buccet CLI script");
})();

function runCli(args: string[], env: NodeJS.ProcessEnv): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath, ...args], {
      cwd: repoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ stdout, stderr, code });
    });
  });
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-upl-source-sync-"));
  const homePath = path.join(tempRoot, "home");
  const workspacePath = path.join(tempRoot, "workspace");
  const railDir = path.join(workspacePath, "rail");
  const secretsDir = path.join(workspacePath, "secrets");
  await fs.mkdir(railDir, { recursive: true });
  await fs.mkdir(secretsDir, { recursive: true });

  const env = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_CALLER_CWD: workspacePath,
    AGENT_BUCCET_LAUNCHER_PATH: path.join(tempRoot, "bin", "buccet"),
  };

  const initResult = await runCli(["init", "--no-default-scope"], env);
  assert.equal(initResult.code, 0, initResult.stderr);

  const sourcesResult = await runCli(["upl", "sources", "--json"], env);
  assert.equal(sourcesResult.code, 0, sourcesResult.stderr);
  const sources = JSON.parse(sourcesResult.stdout) as {
    root: string;
    lanes: Array<{ lane: "acceptance" | "denial"; dir: string; files: string[] }>;
  };
  const acceptanceDir = sources.lanes.find((lane) => lane.lane === "acceptance")?.dir;
  const denialDir = sources.lanes.find((lane) => lane.lane === "denial")?.dir;
  assert.ok(acceptanceDir, "expected acceptance source dir");
  assert.ok(denialDir, "expected denial source dir");

  const acceptanceDocPath = path.join(acceptanceDir!, "workspace-rail.md");
  const denialDocPath = path.join(denialDir!, "workspace-secrets.md");
  const railTarget = path.join(railDir, "allowed.txt");
  const secretTarget = path.join(secretsDir, "api.key");

  await fs.writeFile(acceptanceDocPath, [
    "# Workspace rail",
    "",
    `Only permit fs.write inside "${railTarget}". Never write outside "${railTarget}".`,
  ].join("\n"));
  await fs.writeFile(denialDocPath, [
    "# Secret wall",
    "",
    "Decision: deny",
    "Invariant: Secret reads are forbidden.",
    "Enforcement: Reject secret access.",
    "Action: fs.read",
    `Target: ${secretTarget}`,
  ].join("\n"));

  const extractAcceptance = await runCli(["extract-laws", acceptanceDocPath, "--lane", "acceptance", "--json"], env);
  assert.equal(extractAcceptance.code, 0, extractAcceptance.stderr);
  const extractAcceptancePayload = JSON.parse(extractAcceptance.stdout) as {
    lane: string | null;
    laneMismatches: Array<unknown>;
  };
  assert.equal(extractAcceptancePayload.lane, "acceptance");
  assert.equal(extractAcceptancePayload.laneMismatches.length, 0, "expected acceptance doc to fit acceptance lane");

  const firstSync = await runCli(["upl", "sync", "--json"], env);
  assert.equal(firstSync.code, 0, firstSync.stderr);
  const firstSyncPayload = JSON.parse(firstSync.stdout) as {
    imported: Array<{ lane: string; file: string; imported: number; entries: string[] }>;
  };
  assert.equal(firstSyncPayload.imported.length, 2, "expected one acceptance and one denial doc to import");
  assert.ok(firstSyncPayload.imported.some((entry) => entry.lane === "acceptance" && entry.imported === 1));
  assert.ok(firstSyncPayload.imported.some((entry) => entry.lane === "denial" && entry.imported === 1));

  const uplListOne = await runCli(["upl", "list", "--json"], env);
  assert.equal(uplListOne.code, 0, uplListOne.stderr);
  const uplOne = JSON.parse(uplListOne.stdout) as {
    approved: Array<{ notes?: string | null }>;
    denied: Array<{ notes?: string | null }>;
    runtimeTrackField: Array<{ polarity: string; entry: { notes?: string | null } }>;
  };
  const activeAcceptance = uplOne.approved.filter((entry) => entry.notes?.includes("[upl-doc-lane:acceptance]"));
  const activeDenials = uplOne.denied.filter((entry) => entry.notes?.includes("[upl-doc-lane:denial]"));
  assert.equal(activeAcceptance.length, 1, "expected one active acceptance doc law");
  assert.equal(activeDenials.length, 1, "expected one active denial doc law");
  assert.ok(uplOne.runtimeTrackField.some((segment) => segment.polarity === "allow" && segment.entry.notes?.includes("[upl-doc-lane:acceptance]")));
  assert.ok(uplOne.runtimeTrackField.some((segment) => segment.polarity === "deny" && segment.entry.notes?.includes("[upl-doc-lane:denial]")));

  const secondSync = await runCli(["upl", "sync", "--json"], env);
  assert.equal(secondSync.code, 0, secondSync.stderr);
  const uplListTwo = await runCli(["upl", "list", "--json"], env);
  assert.equal(uplListTwo.code, 0, uplListTwo.stderr);
  const uplTwo = JSON.parse(uplListTwo.stdout) as {
    approved: Array<{ status?: string; notes?: string | null }>;
    denied: Array<{ status?: string; notes?: string | null }>;
  };
  assert.equal(
    uplTwo.approved.filter((entry) => entry.notes?.includes("[upl-doc-lane:acceptance]")).length,
    1,
    "expected sync to keep one active acceptance lane law after re-sync",
  );
  assert.equal(
    uplTwo.denied.filter((entry) => entry.notes?.includes("[upl-doc-lane:denial]")).length,
    1,
    "expected sync to keep one active denial lane law after re-sync",
  );

  const ledgerPath = path.join(homePath, "data", "agent-buccet-law-foundation", "user-path-ledger.json");
  const upl = JSON.parse(await fs.readFile(ledgerPath, "utf8")) as BoundaryUserPathLedger;
  const sessionId = `agent-buccet-upl-source-sync-${Date.now()}`;
  const actorId = "user:upl-source-sync-contract";
  const store = await createPersistentBoundaryRuntimeStore({ sessionId, actorId });
  store.replaceConfig({
    ...store.getConfig(),
    upl,
    userLawIds: getActiveUserLawIds(upl, store.getConfig().session),
  });
  const bodyguard = createBoundaryBodyguard(store);

  const allowedWrite = await bodyguard.enforceProposal({
    actionKind: "fs.write",
    target: path.join(railDir, "inside.txt"),
    payloadSummary: "write rail file",
    provenance: "agent_inference",
    execute: async () => "ok",
    successReason: "write inside acceptance rail",
  });
  assert.equal(allowedWrite.allowed, true, "expected acceptance lane to open a write rail");
  assert.equal(allowedWrite.requiresApproval, false, "expected acceptance lane write to avoid re-prompt");

  const deniedSecretRead = await bodyguard.enforceProposal({
    actionKind: "fs.read",
    target: secretTarget,
    payloadSummary: "read secret file",
    provenance: "agent_inference",
    execute: async () => "should-not-run",
    successReason: "should not read secret",
  });
  assert.equal(deniedSecretRead.allowed, false, "expected denial lane to wall secret reads");
  assert.equal(deniedSecretRead.requiresApproval, false, "expected denial lane to hard deny secret reads");

  const badAcceptanceDocPath = path.join(acceptanceDir!, "bad-denial.md");
  const mixedAcceptanceDocPath = path.join(acceptanceDir!, "mixed-unsupported.md");
  await fs.writeFile(badAcceptanceDocPath, [
    "# Wrong lane",
    "",
    "Decision: deny",
    "Invariant: Never mention spoilers.",
    "Enforcement: Reject spoiler phrasing entirely.",
    "Forbid: spoilers",
  ].join("\n"));

  const failedSync = await runCli(["upl", "sync"], env);
  assert.notEqual(failedSync.code, 0, "expected lane mismatch to fail sync");
  assert.match(failedSync.stderr, /does not belong|will not coerce lane polarity|compiled .* lane/i);

  const uplListAfterFailure = await runCli(["upl", "list", "--json"], env);
  assert.equal(uplListAfterFailure.code, 0, uplListAfterFailure.stderr);
  const uplAfterFailure = JSON.parse(uplListAfterFailure.stdout) as {
    approved: Array<{ notes?: string | null }>;
    denied: Array<{ notes?: string | null }>;
  };
  assert.equal(
    uplAfterFailure.approved.filter((entry) => entry.notes?.includes("[upl-doc-lane:acceptance]")).length,
    1,
    "expected failed sync to preserve existing acceptance lane law",
  );
  assert.equal(
    uplAfterFailure.denied.filter((entry) => entry.notes?.includes("[upl-doc-lane:denial]")).length,
    1,
    "expected failed sync to preserve existing denial lane law",
  );

  await fs.writeFile(mixedAcceptanceDocPath, [
    "# Mixed unsupported law",
    "",
    `Only permit fs.write inside "${railTarget}". Never write outside "${railTarget}".`,
    "",
    "Invariant: Mixed block must not partially snap.",
    "Expression: cosmic legendary phoenix storyteller voice",
    "Require: canon-sigil-42",
  ].join("\n"));

  const mixedFailure = await runCli(["upl", "sync"], env);
  assert.notEqual(mixedFailure.code, 0, "expected unsnappable law block to fail sync");
  assert.match(mixedFailure.stderr, /refuses partial import|unsupported or unsnappable/i);

  const uplListAfterMixedFailure = await runCli(["upl", "list", "--json"], env);
  assert.equal(uplListAfterMixedFailure.code, 0, uplListAfterMixedFailure.stderr);
  const uplAfterMixedFailure = JSON.parse(uplListAfterMixedFailure.stdout) as {
    approved: Array<{ notes?: string | null }>;
    denied: Array<{ notes?: string | null }>;
  };
  assert.equal(
    uplAfterMixedFailure.approved.filter((entry) => entry.notes?.includes("[upl-doc-lane:acceptance]")).length,
    1,
    "expected partial-snap failure to preserve existing acceptance lane law",
  );
  assert.equal(
    uplAfterMixedFailure.denied.filter((entry) => entry.notes?.includes("[upl-doc-lane:denial]")).length,
    1,
    "expected partial-snap failure to preserve existing denial lane law",
  );

  await fs.rm(badAcceptanceDocPath, { force: true });
  await fs.rm(mixedAcceptanceDocPath, { force: true });
  await fs.rm(acceptanceDocPath, { force: true });
  const emptyAcceptanceSync = await runCli(["upl", "sync", "--lane", "acceptance", "--json"], env);
  assert.equal(emptyAcceptanceSync.code, 0, emptyAcceptanceSync.stderr);
  const uplAfterRemoval = await runCli(["upl", "list", "--json"], env);
  assert.equal(uplAfterRemoval.code, 0, uplAfterRemoval.stderr);
  const uplRemovalState = JSON.parse(uplAfterRemoval.stdout) as {
    approved: Array<{ notes?: string | null }>;
    denied: Array<{ notes?: string | null }>;
  };
  assert.equal(
    uplRemovalState.approved.filter((entry) => entry.notes?.includes("[upl-doc-lane:acceptance]")).length,
    0,
    "expected empty acceptance lane sync to remove active acceptance doc laws",
  );
  assert.equal(
    uplRemovalState.denied.filter((entry) => entry.notes?.includes("[upl-doc-lane:denial]")).length,
    1,
    "expected empty acceptance sync to leave denial lane untouched",
  );

  console.log("Agent Buccet UPL source sync contract");
  console.log(`source homes: ${sources.root}`);
  console.log(`acceptance lane: ${activeAcceptance.length}`);
  console.log(`denial lane: ${activeDenials.length}`);
  console.log(`write rail: ${allowedWrite.allowed}`);
  console.log(`secret wall: ${!deniedSecretRead.allowed}`);
  console.log(`lane mismatch refused: ${failedSync.code !== 0}`);
  console.log(`empty lane clears active law: true`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
