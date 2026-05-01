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

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-spend-blend-"));
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

  const blendPath = path.join(workspacePath, "blend-spec.json");
  await writeJson(blendPath, {
    title: "Trade then treasury transfer",
    summary: "Open two exact rails together only because the user asked for a blended draft.",
    requestText: "Blend one trade corridor with one transfer corridor.",
    components: [
      {
        packId: "exchange.trade",
        handle: "exchange:coinbase",
        principal: "ryan",
        bucketId: "trading",
        amountLimitNormalized: 150,
        periodLimitNormalized: 400,
        periodWindow: "7d",
        sourceAuthorityKind: "api_credential",
      },
      {
        packId: "account.transfer",
        handle: "account:treasury-main",
        principal: "ryan",
        bucketId: "treasury",
        amountLimitNormalized: 200,
        periodLimitNormalized: 200,
        periodWindow: "24h",
        sourceAuthorityKind: "linked_account",
      },
    ],
  });

  const draftResult = await runCli(["upl", "spend", "blend", "blend-spec.json", "--json"], env);
  assert.equal(draftResult.code, 0, draftResult.stderr);
  const drafted = JSON.parse(draftResult.stdout) as {
    sourcePath: string;
    syncTargets: string[];
    components: Array<{ packId: string; handle: string }>;
    review: {
      deltas: Array<{
        after: {
          runtime: { primaryTarget: string };
          approvedCommitIntents: string[];
          approvedDestinationKinds: string[];
          amountLimitNormalized: number;
          periodLimitNormalized: number;
          periodWindow: string;
        } | null;
      }>;
    };
  };
  assert.equal(drafted.sourcePath, "spend-blend:exchange.trade+account.transfer");
  assert.deepEqual(drafted.syncTargets, ["buccet"]);
  assert.equal(drafted.components.length, 2);
  assert.equal(drafted.review.deltas.length, 2);
  assert.equal(drafted.review.deltas[0]?.after?.runtime.primaryTarget, "exchange:coinbase");
  assert.deepEqual(drafted.review.deltas[0]?.after?.approvedCommitIntents, ["swap"]);
  assert.deepEqual(drafted.review.deltas[0]?.after?.approvedDestinationKinds, ["exchange"]);
  assert.equal(drafted.review.deltas[0]?.after?.amountLimitNormalized, 150);
  assert.equal(drafted.review.deltas[0]?.after?.periodLimitNormalized, 400);
  assert.equal(drafted.review.deltas[1]?.after?.runtime.primaryTarget, "account:treasury-main");
  assert.deepEqual(drafted.review.deltas[1]?.after?.approvedCommitIntents, ["transfer"]);
  assert.deepEqual(drafted.review.deltas[1]?.after?.approvedDestinationKinds, ["account"]);
  assert.equal(drafted.review.deltas[1]?.after?.amountLimitNormalized, 200);
  assert.equal(drafted.review.deltas[1]?.after?.periodLimitNormalized, 200);

  const workspaceBeforeApply = await runCli(["upl", "workspace", "--json"], env);
  assert.equal(workspaceBeforeApply.code, 0, workspaceBeforeApply.stderr);
  const workspaceBefore = JSON.parse(workspaceBeforeApply.stdout) as {
    activeLawCount: number;
    pendingCount: number;
  };
  assert.equal(workspaceBefore.activeLawCount, 0);
  assert.equal(workspaceBefore.pendingCount, 1);

  const applyResult = await runCli(["upl", "apply", "latest", "--json"], env);
  assert.equal(applyResult.code, 0, applyResult.stderr);
  const applied = JSON.parse(applyResult.stdout) as {
    active: {
      stage: string;
      activeLaws: Array<{
        runtime: { primaryTarget: string };
        lawKey: string;
      }>;
    };
    activatedEntryIds: string[];
  };
  assert.equal(applied.active.stage, "active");
  assert.equal(applied.active.activeLaws.length, 2);
  const activeTargets = applied.active.activeLaws.map((law) => law.runtime.primaryTarget).sort();
  assert.deepEqual(activeTargets, ["account:treasury-main", "exchange:coinbase"]);
  assert.equal(applied.activatedEntryIds.length, 2);

  const singleBlendPath = path.join(workspacePath, "single-blend-spec.json");
  await writeJson(singleBlendPath, {
    components: [
      {
        packId: "merchant.purchase",
        handle: "merchant:amazon",
        principal: "ryan",
        bucketId: "shopping",
        amountLimitNormalized: 50,
      },
    ],
  });
  const singleBlendResult = await runCli(["upl", "spend", "blend", "single-blend-spec.json"], env);
  assert.equal(singleBlendResult.code, 1);
  assert.match(singleBlendResult.stderr, /at least 2 components|single corridor|spend draft/i);

  console.log("Agent Buccet spend blend contract");
  console.log(`blend source: ${drafted.sourcePath}`);
  console.log(`review deltas: ${drafted.review.deltas.length}`);
  console.log(`active targets exact: ${activeTargets.join(", ")}`);
  console.log(`single-pack misuse blocked: ${/at least 2 components|spend draft/i.test(singleBlendResult.stderr)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
