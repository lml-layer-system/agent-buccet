import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "scripts", "buccet.ts");

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
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-spend-law-packs-"));
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

  const listResult = await runCli(["upl", "spend", "list", "--json"], env);
  assert.equal(listResult.code, 0, listResult.stderr);
  const listed = JSON.parse(listResult.stdout) as {
    packs: Array<{ id: string }>;
  };
  const packIds = listed.packs.map((pack) => pack.id);
  assert.ok(packIds.includes("merchant.purchase"));
  assert.ok(packIds.includes("subscription.provider"));
  assert.ok(packIds.includes("exchange.trade"));
  assert.ok(packIds.includes("platform.signup"));

  const showResult = await runCli(["upl", "spend", "show", "subscription.provider", "--json"], env);
  assert.equal(showResult.code, 0, showResult.stderr);
  const shown = JSON.parse(showResult.stdout) as {
    pack: {
      id: string;
      commitIntent: string;
      destinationKind: string;
      riskClass: string;
      lockedByDefault: string;
    };
  };
  assert.equal(shown.pack.id, "subscription.provider");
  assert.equal(shown.pack.commitIntent, "subscribe");
  assert.equal(shown.pack.destinationKind, "merchant");
  assert.equal(shown.pack.riskClass, "recurring");
  assert.match(shown.pack.lockedByDefault, /denied/i);

  const subscriptionDraft = await runCli([
    "upl",
    "spend",
    "draft",
    "subscription.provider",
    "--handle",
    "provider:vercel",
    "--principal",
    "ryan",
    "--bucket",
    "software",
    "--max-amount",
    "20",
    "--json",
  ], env);
  assert.equal(subscriptionDraft.code, 0, subscriptionDraft.stderr);
  const subscription = JSON.parse(subscriptionDraft.stdout) as {
    pack: { id: string };
    sourcePath: string;
    syncTargets: string[];
    review: {
      deltas: Array<{
        after: {
          runtime: { primaryTarget: string };
          approvedCommitIntents: string[];
          approvedDestinationKinds: string[];
          riskClasses: string[];
          recurringPolicy: string;
        } | null;
      }>;
    };
  };
  assert.equal(subscription.pack.id, "subscription.provider");
  assert.equal(subscription.sourcePath, "spend-pack:subscription.provider");
  assert.deepEqual(subscription.syncTargets, ["buccet", "future_buccets"]);
  assert.equal(subscription.review.deltas[0]?.after?.runtime.primaryTarget, "provider:vercel");
  assert.deepEqual(subscription.review.deltas[0]?.after?.approvedCommitIntents, ["subscribe"]);
  assert.deepEqual(subscription.review.deltas[0]?.after?.approvedDestinationKinds, ["merchant"]);
  assert.deepEqual(subscription.review.deltas[0]?.after?.riskClasses, ["recurring"]);
  assert.equal(subscription.review.deltas[0]?.after?.recurringPolicy, "allow");

  const applySubscription = await runCli(["upl", "apply", "latest", "--json"], env);
  assert.equal(applySubscription.code, 0, applySubscription.stderr);
  const applied = JSON.parse(applySubscription.stdout) as {
    activatedEntryIds: string[];
  };
  assert.equal(applied.activatedEntryIds.length, 1);

  const showApplied = await runCli(["upl", "show", applied.activatedEntryIds[0]!, "--json"], env);
  assert.equal(showApplied.code, 0, showApplied.stderr);
  const shownApplied = JSON.parse(showApplied.stdout) as {
    entry: { type: string; status: string };
  };
  assert.equal(shownApplied.entry.type, "APPROVED");
  assert.equal(shownApplied.entry.status, "ACTIVE");

  const exchangeDraft = await runCli([
    "upl",
    "spend",
    "draft",
    "exchange.trade",
    "--handle",
    "exchange:coinbase",
    "--principal",
    "ryan",
    "--bucket",
    "trading",
    "--max-amount",
    "100",
    "--period-limit",
    "300",
    "--period-window",
    "7d",
    "--source-authority",
    "api_credential",
    "--json",
  ], env);
  assert.equal(exchangeDraft.code, 0, exchangeDraft.stderr);
  const exchange = JSON.parse(exchangeDraft.stdout) as {
    review: {
      deltas: Array<{
        after: {
          approvedCommitIntents: string[];
          approvedDestinationKinds: string[];
          approvedSourceAuthorityKinds: string[];
          riskClasses: string[];
          periodLimitNormalized: number;
          periodWindow: string;
        } | null;
      }>;
    };
  };
  assert.deepEqual(exchange.review.deltas[0]?.after?.approvedCommitIntents, ["swap"]);
  assert.deepEqual(exchange.review.deltas[0]?.after?.approvedDestinationKinds, ["exchange"]);
  assert.deepEqual(exchange.review.deltas[0]?.after?.approvedSourceAuthorityKinds, ["api_credential"]);
  assert.deepEqual(exchange.review.deltas[0]?.after?.riskClasses, ["volatile"]);
  assert.equal(exchange.review.deltas[0]?.after?.periodLimitNormalized, 300);
  assert.equal(exchange.review.deltas[0]?.after?.periodWindow, "7d");

  const missingHandle = await runCli([
    "upl",
    "spend",
    "draft",
    "merchant.purchase",
    "--principal",
    "ryan",
    "--bucket",
    "shopping",
    "--max-amount",
    "25",
  ], env);
  assert.equal(missingHandle.code, 1);
  assert.match(missingHandle.stderr, /requires handle|handle/i);

  console.log("Agent Buccet spend-law-pack contract");
  console.log(`packs listed: ${packIds.length}`);
  console.log(`subscription draft target: ${subscription.review.deltas[0]?.after?.runtime.primaryTarget}`);
  console.log(`subscription apply activated: ${applied.activatedEntryIds.length === 1}`);
  console.log(`exchange draft risk: ${exchange.review.deltas[0]?.after?.riskClasses[0]}`);
  console.log(`missing handle blocked: ${/handle/i.test(missingHandle.stderr)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
