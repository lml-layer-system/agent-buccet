import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "cli", "buccet.ts");

function runCli(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
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
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-spend-proposals-"));
  const homePath = path.join(tempRoot, "home");
  const workspacePath = path.join(tempRoot, "workspace");
  const uplLedgerPath = path.join(tempRoot, "upl-ledger.json");
  await fs.mkdir(workspacePath, { recursive: true });

  const env = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_CALLER_CWD: workspacePath,
    AGENT_BUCCET_LAUNCHER_PATH: path.join(tempRoot, "bin", "buccet"),
    AGENT_BUCCET_UPL_LEDGER_PATH: uplLedgerPath,
  };

  const initResult = await runCli(["init"], env);
  assert.equal(initResult.code, 0, initResult.stderr);

  const workspaceBefore = await runCli(["upl", "workspace", "--json"], env);
  assert.equal(workspaceBefore.code, 0, workspaceBefore.stderr);
  const before = JSON.parse(workspaceBefore.stdout) as {
    pendingCount: number;
    activeLawCount: number;
  };

  const subscriptionProposal = await runCli([
    "upl",
    "spend",
    "propose",
    "set up a recurring Vercel subscription under twenty dollars per month",
    "--json",
  ], env);
  assert.equal(subscriptionProposal.code, 0, subscriptionProposal.stderr);
  const subscription = JSON.parse(subscriptionProposal.stdout) as {
    requiresHumanPick: boolean;
    singlePackOnlyByDefault: boolean;
    blendRequested: boolean;
    suggestedSyncTargets: string[];
    candidates: Array<{
      pack: { id: string };
      matchedSignals: string[];
      reasons: string[];
    }>;
    notes: string[];
  };
  assert.equal(subscription.requiresHumanPick, true);
  assert.equal(subscription.singlePackOnlyByDefault, true);
  assert.equal(subscription.blendRequested, false);
  assert.deepEqual(subscription.suggestedSyncTargets, ["buccet"]);
  assert.equal(subscription.candidates[0]?.pack.id, "subscription.provider");
  assert.ok(subscription.candidates.length <= 3);
  assert.ok(subscription.candidates[0]?.matchedSignals.includes("subscription") || subscription.candidates[0]?.matchedSignals.includes("recurring"));
  assert.ok(subscription.notes.some((note) => note.includes("No spend pack is auto-selected")));

  const multiProposal = await runCli([
    "upl",
    "spend",
    "propose",
    "trade on coinbase and transfer profits back to my bank account",
    "--json",
  ], env);
  assert.equal(multiProposal.code, 0, multiProposal.stderr);
  const multi = JSON.parse(multiProposal.stdout) as {
    multipleBoundaryClassesDetected: boolean;
    candidates: Array<{ pack: { id: string } }>;
    notes: string[];
  };
  const multiIds = multi.candidates.map((candidate) => candidate.pack.id);
  assert.equal(multi.multipleBoundaryClassesDetected, true);
  assert.ok(multiIds.includes("exchange.trade"));
  assert.ok(multiIds.includes("account.transfer"));
  assert.ok(multi.notes.some((note) => note.includes("Pick one pack first")));

  const blendProposal = await runCli([
    "upl",
    "spend",
    "propose",
    "blend exchange trading with account transfer into one draft",
    "--json",
  ], env);
  assert.equal(blendProposal.code, 0, blendProposal.stderr);
  const blend = JSON.parse(blendProposal.stdout) as {
    blendRequested: boolean;
    singlePackOnlyByDefault: boolean;
    notes: string[];
  };
  assert.equal(blend.blendRequested, true);
  assert.equal(blend.singlePackOnlyByDefault, true);
  assert.ok(blend.notes.some((note) => note.includes("no blended draft")));

  const slackProposal = await runCli([
    "upl",
    "spend",
    "propose",
    "add five slack seats for the team workspace under our monthly software budget",
    "--json",
  ], env);
  assert.equal(slackProposal.code, 0, slackProposal.stderr);
  const slack = JSON.parse(slackProposal.stdout) as {
    candidates: Array<{
      pack: { id: string };
      matchedSignals: string[];
    }>;
  };
  assert.equal(slack.candidates[0]?.pack.id, "license.seat");
  assert.ok(slack.candidates[0]?.matchedSignals.includes("slack"));
  assert.ok(slack.candidates[0]?.matchedSignals.includes("seats") || slack.candidates[0]?.matchedSignals.includes("seat"));

  const brokerageProposal = await runCli([
    "upl",
    "spend",
    "propose",
    "rebalance my robinhood portfolio and place the trade inside my investing bucket",
    "--json",
  ], env);
  assert.equal(brokerageProposal.code, 0, brokerageProposal.stderr);
  const brokerage = JSON.parse(brokerageProposal.stdout) as {
    candidates: Array<{
      pack: { id: string };
      matchedSignals: string[];
    }>;
  };
  assert.equal(brokerage.candidates[0]?.pack.id, "exchange.trade");
  assert.ok(brokerage.candidates[0]?.matchedSignals.includes("robinhood"));
  assert.ok(brokerage.candidates[0]?.matchedSignals.includes("rebalance") || brokerage.candidates[0]?.matchedSignals.includes("portfolio"));

  const travelProposal = await runCli([
    "upl",
    "spend",
    "propose",
    "book a hotel for the trip and keep the booking under our travel cap",
    "--json",
  ], env);
  assert.equal(travelProposal.code, 0, travelProposal.stderr);
  const travel = JSON.parse(travelProposal.stdout) as {
    candidates: Array<{ pack: { id: string } }>;
  };
  assert.equal(travel.candidates[0]?.pack.id, "travel.booking");

  const billProposal = await runCli([
    "upl",
    "spend",
    "propose",
    "pay the utility bill before the due date from the operations account",
    "--json",
  ], env);
  assert.equal(billProposal.code, 0, billProposal.stderr);
  const bill = JSON.parse(billProposal.stdout) as {
    candidates: Array<{ pack: { id: string } }>;
  };
  assert.equal(bill.candidates[0]?.pack.id, "bill.payment");

  const workspaceAfter = await runCli(["upl", "workspace", "--json"], env);
  assert.equal(workspaceAfter.code, 0, workspaceAfter.stderr);
  const after = JSON.parse(workspaceAfter.stdout) as {
    pendingCount: number;
    activeLawCount: number;
  };
  assert.equal(after.pendingCount, before.pendingCount);
  assert.equal(after.activeLawCount, before.activeLawCount);

  console.log("Agent Buccet spend proposal contract");
  console.log(`subscription top pack: ${subscription.candidates[0]?.pack.id}`);
  console.log(`multiple classes detected: ${multi.multipleBoundaryClassesDetected}`);
  console.log(`blend request blocked to single-pack: ${blend.singlePackOnlyByDefault}`);
  console.log(`slack seat request top pack: ${slack.candidates[0]?.pack.id}`);
  console.log(`brokerage trade top pack: ${brokerage.candidates[0]?.pack.id}`);
  console.log(`travel booking top pack: ${travel.candidates[0]?.pack.id}`);
  console.log(`bill payment top pack: ${bill.candidates[0]?.pack.id}`);
  console.log(`workspace unchanged: ${after.pendingCount === before.pendingCount && after.activeLawCount === before.activeLawCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
