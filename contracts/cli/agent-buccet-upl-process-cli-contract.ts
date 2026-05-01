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
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-upl-process-cli-"));
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

  const allowDraftPath = path.join(workspacePath, "allow-upl.json");
  await writeJson(allowDraftPath, {
    observation: {
      title: "subscription corridor",
      summary: "open one bounded subscription rail",
      detectedAt: new Date().toISOString(),
      detectedBy: "pi",
      sourceText: "allow vercel subscription under monthly cap",
    },
    boundary: {
      title: "value boundary",
      crossing: "recommendation becomes recurring commitment",
      consequence: "subscription can spend real money",
    },
    invariant: {
      statement: "subscription stays inside exact corridor",
      allowed: ["provider:vercel under cap"],
      denied: ["unapproved provider", "uncapped recurring commitment"],
      humanRequired: ["initial activation"],
      headlessAllowed: ["bounded recurring commit after activation"],
    },
    draftedByKind: "pi",
    draftedBy: "pi:policy-drafter",
    syncTargets: ["buccet", "future_buccets"],
    mutations: [
      {
        kind: "add",
        lawKey: "spend.subscription.vercel.monthly",
        reason: "open a narrow recurring corridor",
        nextLaw: {
          lawKey: "spend.subscription.vercel.monthly",
          domain: "spend",
          capability: "subscription.start",
          state: "allow",
          scope: "GLOBAL",
          runtime: {
            actionKinds: ["agent.spend"],
            primaryTarget: "provider:vercel",
            targetPatterns: ["provider:vercel"],
            targetMatchMode: "exact",
            provenance: "trusted_user",
          },
          bucketId: "software",
          principal: "ryan",
          approvedHandles: ["provider:vercel"],
          approvedDestinationKinds: ["merchant"],
          approvedSourceAuthorityKinds: ["card"],
          approvedCommitIntents: ["subscribe"],
          riskClasses: ["recurring"],
          amountLimitNormalized: 20,
          periodLimitNormalized: 20,
          periodWindow: "30d",
          recurringPolicy: "allow",
          substitutionPolicy: "deny",
          humanConfirmationRule: "notify_before_commit",
          reminderOffsets: ["14d", "7d", "3d", "1d"],
          proofRequirement: "receipt_required",
          notes: "bounded Vercel recurring corridor",
        },
      },
    ],
  });

  const draftResult = await runCli(["upl", "draft", "allow-upl.json", "--json"], env);
  assert.equal(draftResult.code, 0, draftResult.stderr);
  const drafted = JSON.parse(draftResult.stdout) as {
    syncTargets: string[];
    draft: { draftId: string };
    review: {
      reviewId: string;
      deltas: Array<{ after: { state: string } | null }>;
    };
  };
  assert.deepEqual(drafted.syncTargets, ["buccet", "future_buccets"]);
  assert.equal(drafted.review.deltas.length, 1);
  assert.equal(drafted.review.deltas[0]?.after?.state, "allow");

  const reviewResult = await runCli(["upl", "review", "latest", "--json"], env);
  assert.equal(reviewResult.code, 0, reviewResult.stderr);
  const reviewed = JSON.parse(reviewResult.stdout) as {
    stale: boolean;
    applied: boolean;
    review: { reviewId: string };
  };
  assert.equal(reviewed.stale, false);
  assert.equal(reviewed.applied, false);
  assert.equal(reviewed.review.reviewId, drafted.review.reviewId);

  const workspaceBeforeApply = await runCli(["upl", "workspace", "--json"], env);
  assert.equal(workspaceBeforeApply.code, 0, workspaceBeforeApply.stderr);
  const workspaceBefore = JSON.parse(workspaceBeforeApply.stdout) as {
    activeLawCount: number;
    pendingCount: number;
    appliedCount: number;
    records: Array<{ reviewId: string }>;
  };
  assert.equal(workspaceBefore.activeLawCount, 0);
  assert.equal(workspaceBefore.pendingCount, 1);
  assert.equal(workspaceBefore.appliedCount, 0);
  assert.equal(workspaceBefore.records.length, 1);

  const applyResult = await runCli(["upl", "apply", "latest", "--json"], env);
  assert.equal(applyResult.code, 0, applyResult.stderr);
  const applied = JSON.parse(applyResult.stdout) as {
    active: { stage: string; activeLaws: Array<{ lawKey: string }> };
    activatedEntryIds: string[];
  };
  assert.equal(applied.active.stage, "active");
  assert.equal(applied.active.activeLaws.length, 1);
  assert.equal(applied.active.activeLaws[0]?.lawKey, "spend.subscription.vercel.monthly");
  assert.equal(applied.activatedEntryIds.length, 1);

  const showApplied = await runCli(["upl", "show", applied.activatedEntryIds[0]!, "--json"], env);
  assert.equal(showApplied.code, 0, showApplied.stderr);
  const shown = JSON.parse(showApplied.stdout) as {
    entry: { type: string; status: string };
  };
  assert.equal(shown.entry.type, "APPROVED");
  assert.equal(shown.entry.status, "ACTIVE");

  const workspaceAfterApply = await runCli(["upl", "workspace", "--json"], env);
  assert.equal(workspaceAfterApply.code, 0, workspaceAfterApply.stderr);
  const workspaceAfter = JSON.parse(workspaceAfterApply.stdout) as {
    activeLawCount: number;
    pendingCount: number;
    appliedCount: number;
  };
  assert.equal(workspaceAfter.activeLawCount, 1);
  assert.equal(workspaceAfter.pendingCount, 0);
  assert.equal(workspaceAfter.appliedCount, 1);

  const widenOnePath = path.join(workspacePath, "widen-one.json");
  await writeJson(widenOnePath, {
    observation: {
      title: "raise software cap once",
      summary: "first cap revision",
      detectedAt: new Date().toISOString(),
      detectedBy: "pi",
    },
    boundary: {
      title: "value boundary",
      crossing: "cap change widens active spend corridor",
      consequence: "later commits can spend more",
    },
    invariant: {
      statement: "cap changes must be explicit and exact",
      allowed: ["specific provider with raised cap"],
      denied: ["implicit widening"],
      humanRequired: ["activation"],
      headlessAllowed: ["bounded recurring commit after activation"],
    },
    draftedByKind: "pi",
    draftedBy: "pi:policy-drafter",
    mutations: [
      {
        kind: "replace",
        lawKey: "spend.subscription.vercel.monthly",
        reason: "raise monthly cap to 25",
        nextLaw: {
          lawKey: "spend.subscription.vercel.monthly",
          domain: "spend",
          capability: "subscription.start",
          state: "allow",
          scope: "GLOBAL",
          runtime: {
            actionKinds: ["agent.spend"],
            primaryTarget: "provider:vercel",
            targetPatterns: ["provider:vercel"],
            targetMatchMode: "exact",
            provenance: "trusted_user",
          },
          bucketId: "software",
          principal: "ryan",
          approvedHandles: ["provider:vercel"],
          approvedDestinationKinds: ["merchant"],
          approvedSourceAuthorityKinds: ["card"],
          approvedCommitIntents: ["subscribe"],
          riskClasses: ["recurring"],
          amountLimitNormalized: 25,
          periodLimitNormalized: 25,
          periodWindow: "30d",
          recurringPolicy: "allow",
          substitutionPolicy: "deny",
          humanConfirmationRule: "notify_before_commit",
          reminderOffsets: ["14d", "7d", "3d", "1d"],
          proofRequirement: "receipt_required",
          notes: "first cap raise",
        },
      },
    ],
  });

  const widenTwoPath = path.join(workspacePath, "widen-two.json");
  await writeJson(widenTwoPath, {
    observation: {
      title: "raise software cap twice",
      summary: "second cap revision from same baseline",
      detectedAt: new Date().toISOString(),
      detectedBy: "pi",
    },
    boundary: {
      title: "value boundary",
      crossing: "parallel cap review from same baseline",
      consequence: "old review must not apply after field moves",
    },
    invariant: {
      statement: "stale review cannot activate after active law changes",
      allowed: ["exact review against current field"],
      denied: ["apply from stale baseline"],
      humanRequired: ["activation"],
      headlessAllowed: [],
    },
    draftedByKind: "pi",
    draftedBy: "pi:policy-drafter",
    mutations: [
      {
        kind: "replace",
        lawKey: "spend.subscription.vercel.monthly",
        reason: "raise monthly cap to 30",
        nextLaw: {
          lawKey: "spend.subscription.vercel.monthly",
          domain: "spend",
          capability: "subscription.start",
          state: "allow",
          scope: "GLOBAL",
          runtime: {
            actionKinds: ["agent.spend"],
            primaryTarget: "provider:vercel",
            targetPatterns: ["provider:vercel"],
            targetMatchMode: "exact",
            provenance: "trusted_user",
          },
          bucketId: "software",
          principal: "ryan",
          approvedHandles: ["provider:vercel"],
          approvedDestinationKinds: ["merchant"],
          approvedSourceAuthorityKinds: ["card"],
          approvedCommitIntents: ["subscribe"],
          riskClasses: ["recurring"],
          amountLimitNormalized: 30,
          periodLimitNormalized: 30,
          periodWindow: "30d",
          recurringPolicy: "allow",
          substitutionPolicy: "deny",
          humanConfirmationRule: "notify_before_commit",
          reminderOffsets: ["14d", "7d", "3d", "1d"],
          proofRequirement: "receipt_required",
          notes: "second cap raise",
        },
      },
    ],
  });

  const widenOneDraft = await runCli(["upl", "draft", "widen-one.json", "--json"], env);
  assert.equal(widenOneDraft.code, 0, widenOneDraft.stderr);
  const widenOne = JSON.parse(widenOneDraft.stdout) as { draft: { draftId: string } };

  const widenTwoDraft = await runCli(["upl", "draft", "widen-two.json", "--json"], env);
  assert.equal(widenTwoDraft.code, 0, widenTwoDraft.stderr);
  const widenTwo = JSON.parse(widenTwoDraft.stdout) as { draft: { draftId: string } };

  const applyWidenOne = await runCli(["upl", "apply", widenOne.draft.draftId, "--json"], env);
  assert.equal(applyWidenOne.code, 0, applyWidenOne.stderr);

  const staleApply = await runCli(["upl", "apply", widenTwo.draft.draftId, "--json"], env);
  assert.equal(staleApply.code, 1);
  assert.match(staleApply.stderr, /stale/i);

  const askDraftPath = path.join(workspacePath, "ask-only.json");
  await writeJson(askDraftPath, {
    observation: {
      title: "ask-only reminder",
      summary: "model ask as runtime disposition only",
      detectedAt: new Date().toISOString(),
      detectedBy: "pi",
    },
    boundary: {
      title: "human confirmation boundary",
      crossing: "ask-only rule tries to become active live lane",
      consequence: "would create a fuzzy middle lane",
    },
    invariant: {
      statement: "ask stays runtime disposition, not active lane",
      allowed: [],
      denied: ["ask lane activation"],
      humanRequired: [],
      headlessAllowed: [],
    },
    draftedByKind: "pi",
    draftedBy: "pi:policy-drafter",
    mutations: [
      {
        kind: "add",
        lawKey: "spend.subscription.ask-only",
        reason: "stage ask-only shape for explicit failure",
        nextLaw: {
          lawKey: "spend.subscription.ask-only",
          domain: "spend",
          capability: "subscription.start",
          state: "ask",
          scope: "GLOBAL",
          runtime: {
            actionKinds: ["agent.spend"],
            primaryTarget: "provider:anthropic",
            targetPatterns: ["provider:anthropic"],
            targetMatchMode: "exact",
            provenance: "trusted_user",
          },
          bucketId: "api",
          principal: "ryan",
          approvedHandles: ["provider:anthropic"],
          approvedDestinationKinds: ["merchant"],
          approvedSourceAuthorityKinds: ["card"],
          approvedCommitIntents: ["subscribe"],
          riskClasses: ["recurring"],
          recurringPolicy: "ask",
          substitutionPolicy: "deny",
          humanConfirmationRule: "ask_before_commit",
          reminderOffsets: ["14d", "7d", "3d", "1d"],
          proofRequirement: "receipt_required",
          notes: "ask remains runtime disposition",
        },
      },
    ],
  });

  const askDraft = await runCli(["upl", "draft", "ask-only.json", "--json"], env);
  assert.equal(askDraft.code, 0, askDraft.stderr);
  const asked = JSON.parse(askDraft.stdout) as { draft: { draftId: string } };

  const askApply = await runCli(["upl", "apply", asked.draft.draftId], env);
  assert.equal(askApply.code, 1);
  assert.match(askApply.stderr, /state=ask/);

  console.log("Agent Buccet UPL process CLI contract");
  console.log(`draft/review/apply path: ${drafted.review.reviewId}`);
  console.log(`workspace pending before apply: ${workspaceBefore.pendingCount}`);
  console.log(`workspace active after apply: ${workspaceAfter.activeLawCount}`);
  console.log(`stale review blocked: ${/stale/i.test(staleApply.stderr)}`);
  console.log(`ask activation blocked: ${/state=ask/.test(askApply.stderr)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
