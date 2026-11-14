/**
 * CLAUDE RED-TEAM (spend boundary) — draining a standing spend corridor.
 *
 * SPEND-DRAIN-01: an auto spend corridor ("approve this spend as law") got a
 * cumulative period bound ONLY if the approved packet happened to declare one.
 * Otherwise the per-spend cap was the only limit, and the recursion guard (3
 * identical proposals / 60s, identity including the exact amount) is dodged by
 * varying the amount by a cent. Reproduced end-to-end: a human approved ONE
 * $10 spend as law and an autonomous agent (no human approving anything)
 * executed 25 spends totalling $247.00.
 *
 * Fix: a standing spend law always carries a cumulative bound (default: the
 * approved amount per 24h when the packet declared none); the corridor's period
 * cap is a ceiling a request may tighten but not loosen; and the spend runtime
 * enforces every applicable standing bound on the principal+bucket against the
 * real executed-spend ledger, even when the request declares no cap.
 */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  type BoundarySpendIntent,
  appendBoundaryLedger,
  createBoundaryBodyguard,
  createBoundarySpendRequest,
  createPersistentBoundaryRuntimeStore,
  getActiveUserLawIds,
  loadUserPathLedger,
  saveUserPathLedger,
  writeApprovedUserPathLaw,
} from "./../../src/index.ts";
import { checkTrackConstraint } from "./../../src/law/upl-tracks.ts";

const actorId = "user:spend-drain-redteam";

async function scenario(args: { declaredCap?: number; attempts: number }) {
  const store = await createPersistentBoundaryRuntimeStore({
    sessionId: `spend-drain-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    actorId,
  });
  const bodyguard = createBoundaryBodyguard(store);
  await store.issueGrant({
    resourceKind: "recipient",
    resourceValue: "merchant:aws",
    grantedActions: ["agent.spend"],
    issuedBy: actorId,
  });
  // Unique bucket so the shared executed-spend ledger never bleeds between runs.
  const bucketId = `ops:drain-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const intent = (amount: number): BoundarySpendIntent => ({
    amountRaw: amount.toFixed(2),
    amountNormalized: amount,
    destination: "merchant:aws",
    destinationKind: "merchant",
    sourceAuthorityKind: "linked_account",
    commitIntent: "purchase",
    principal: "ops-treasury",
    purpose: "buy bounded compute credits",
    bucketId,
    termsSummary: "one-time merchant purchase",
    recurring: false,
    riskClass: "low",
    accountabilityRef: "receipt:pending",
    instructionSource: "trusted_user",
    currencyHint: "USD",
    ...(args.declaredCap !== undefined
      ? { periodCapNormalized: args.declaredCap, periodWindow: "24h" as const }
      : {}),
  });

  // A human approves ONE $10 spend as standing law.
  const seed = createBoundarySpendRequest({ config: store.getConfig(), spendIntent: intent(10) });
  const witness = await appendBoundaryLedger("APPROVAL_GRANTED", {
    sessionId: store.getConfig().session.sessionId,
    actorId,
    requestId: seed.requestId,
    actionKind: seed.actionKind,
    target: seed.target,
    decision: "allow",
    reason: "approve one $10 spend as law",
    lawIds: ["UPL.SPEND.ALLOW.01"],
    createdAt: new Date().toISOString(),
  });
  const ledger = await writeApprovedUserPathLaw({
    ledger: await loadUserPathLedger(),
    request: seed,
    witness,
    session: store.getConfig().session,
    authority: {
      authorityKind: "human_approved",
      actorKind: "human",
      actorId,
      reason: "approve one $10 spend as law",
      approvalRef: witness.META.id,
    },
    decision: { choice: "allow_as_law" },
  });
  store.replaceConfig({
    ...store.getConfig(),
    upl: ledger,
    userLawIds: [
      ...new Set([
        ...(store.getConfig().userLawIds ?? []),
        ...getActiveUserLawIds(ledger, store.getConfig().session),
      ]),
    ],
    // Autonomous: no human ever approves anything after the seed.
    approvalHandler: async () => ({ choice: "deny_once" }),
  });
  const corridor =
    ledger.userApprovedLawPaths[ledger.userApprovedLawPaths.length - 1]?.trackConstraint;

  let executed = 0;
  let total = 0;
  for (let i = 0; i < args.attempts; i++) {
    const amount = Math.round((10 - i * 0.01) * 100) / 100; // vary by a cent
    const r = await bodyguard.spend.intent({
      spendIntent: intent(amount),
      execute: async () => "paid",
      successReason: "paid",
    });
    if (r.allowed && r.executed) {
      executed++;
      total += amount;
    }
  }
  return { corridor, executed, total, intent };
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-spend-drain-"));
  process.env.AGENT_BUCCET_UPL_LEDGER_PATH = path.join(tempRoot, "user-path-ledger.json");
  await saveUserPathLedger({ specVersion: 1, userApprovedLawPaths: [], userDeniedLawPaths: [] });

  // ---- ATTACK: approved packet declared no period cap ----
  const drain = await scenario({ attempts: 12 });
  assert.equal(
    drain.corridor?.spendMaxPeriodAmountNormalized,
    10,
    "uncapped approval defaults to the approved amount",
  );
  assert.equal(
    drain.corridor?.spendPeriodWindow,
    "24h",
    "uncapped approval defaults to a 24h window",
  );
  assert.ok(
    drain.total <= 10,
    `one approved $10 spend must not authorize more than $10 per window autonomously (executed ${drain.executed}, total $${drain.total.toFixed(2)})`,
  );
  assert.equal(
    drain.executed,
    1,
    "exactly the approved spend runs; repeats hit the cumulative bound",
  );

  // ---- Positive control: a declared period cap is honored, not clamped ----
  const capped = await scenario({ declaredCap: 30, attempts: 6 });
  assert.equal(
    capped.corridor?.spendMaxPeriodAmountNormalized,
    30,
    "declared cap becomes the corridor bound",
  );
  assert.equal(capped.executed, 3, "a declared 30/24h cap still allows three ~$10 spends");
  assert.ok(capped.total <= 30, "and never more than the declared cap");

  // ---- Corridor period cap is a ceiling: tighter or none stays in, looser exits ----
  const c = capped.corridor;
  assert.ok(c, "corridor exists");
  const reqWith = (cap?: number) => ({
    requestId: "r",
    sessionId: "s",
    actionKind: "agent.spend" as const,
    target: "merchant:aws",
    requestedAt: new Date().toISOString(),
    provenance: "mcp_host" as const,
    spendIntent: {
      ...capped.intent(5),
      periodCapNormalized: cap,
      periodWindow: cap === undefined ? undefined : ("24h" as const),
    },
  });
  assert.equal(
    checkTrackConstraint(c, reqWith(10)),
    null,
    "a tighter declared cap stays in the corridor",
  );
  assert.equal(
    checkTrackConstraint(c, reqWith(undefined)),
    null,
    "no declared cap stays in (runtime applies the corridor's)",
  );
  assert.equal(
    typeof checkTrackConstraint(c, reqWith(1000)),
    "string",
    "a looser declared cap exits the corridor",
  );

  console.log(
    `spend drain: one approved $10 law now yields ${drain.executed} autonomous spend ($${drain.total.toFixed(2)}); declared caps honored; corridor cap is a ceiling`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
