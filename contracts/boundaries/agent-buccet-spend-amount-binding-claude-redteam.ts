/**
 * CLAUDE RED-TEAM (spend boundary) — amount declaration binding.
 *
 * Every spend cap in the value boundary compares against `amountNormalized`,
 * which is caller-declared, while the human authorizes against the `amountRaw`
 * string shown in the consent summary / bodyguard packet and written to the
 * ledger. Nothing bound the two together, so an agent could declare a large
 * human-facing `amountRaw` ("$5,000.00") with a tiny `amountNormalized` (1):
 * the cap check `amountNormalized > cap` then clears silently (under cap, even
 * fully autonomous) while the human and the ledger see $5,000.00. A spend-cap
 * bypass through under-declaration.
 *
 * Fix: bind the gated normalized amount to the declared raw amount. A divergent
 * or unverifiable binding is surfaced for explicit human authorization
 * (require_approval, BOUNDARY.SPEND.AMOUNT_BINDING.01) instead of auto-clearing.
 * This asserts the fix closes the bypass without flagging well-formed packets.
 */
import assert from "node:assert/strict";
import { evaluateSpendBoundaryAction } from "./../../src/boundaries/spend-boundary.ts";
import type { BoundaryActionRequest, BoundarySpendIntent } from "./../../src/runtime/types.ts";

function intent(overrides: Partial<BoundarySpendIntent>): BoundarySpendIntent {
  return {
    amountRaw: "50.00",
    amountNormalized: 50,
    destination: "merchant:aws",
    destinationKind: "merchant",
    sourceAuthorityKind: "linked_account",
    commitIntent: "purchase",
    principal: "ops-treasury",
    purpose: "pay one invoice",
    bucketId: "ops:ap",
    termsSummary: "one-time invoice payment",
    recurring: false,
    riskClass: "low",
    accountabilityRef: "invoice:pending:123",
    instructionSource: "trusted_user",
    currencyHint: "USD",
    ...overrides,
  };
}
function spendRequest(overrides: Partial<BoundarySpendIntent>): BoundaryActionRequest {
  return {
    requestId: "r",
    sessionId: "s",
    actionKind: "agent.spend",
    target: "spend",
    requestedAt: new Date().toISOString(),
    provenance: "mcp_host",
    instructionSource: "trusted_user",
    spendIntent: intent(overrides),
  } as BoundaryActionRequest;
}
const decisionOf = (r: BoundaryActionRequest) => evaluateSpendBoundaryAction(r);

function main() {
  // ---- ATTACK: under-declared normalized amount clears the cap silently ----
  const attack = decisionOf(
    spendRequest({
      amountRaw: "$5,000.00",
      amountNormalized: 1,
      periodCapNormalized: 10,
      periodWindow: "month",
    }),
  );
  assert.ok(attack, "under-declared spend packet must not pass the boundary untouched");
  assert.equal(
    attack?.decision,
    "require_approval",
    "a normalized amount that does not match the human-facing raw amount must not auto-clear a cap",
  );
  assert.ok(
    attack?.triggeredLawIds.includes("BOUNDARY.SPEND.AMOUNT_BINDING.01"),
    "the under-declaration must be caught by the amount-binding law, not slip to a later gate",
  );

  // ---- Over-declaration is incoherent too (binding holds in both directions) ----
  const over = decisionOf(spendRequest({ amountRaw: "1.00", amountNormalized: 5000 }));
  assert.equal(
    over?.decision,
    "require_approval",
    "a normalized amount far above the declared raw amount is also an untrusted binding",
  );

  // ---- Unparseable raw amount cannot be verified -> surfaced, not auto-cleared ----
  const unparseable = decisionOf(spendRequest({ amountRaw: "lots of money", amountNormalized: 3 }));
  assert.equal(
    unparseable?.decision,
    "require_approval",
    "a raw amount with no numeric value cannot be verified and must not auto-clear",
  );

  // ---- Well-formed packets (matching raw/normalized) are NOT flagged ----
  const legitForms: Array<[string, number]> = [
    ["50.00", 50],
    ["9.99", 9.99],
    ["$1,234.56", 1234.56], // US grouping + symbol
    ["1.234,56", 1234.56], // EU grouping
    ["USD 8.00", 8],
  ];
  for (const [amountRaw, amountNormalized] of legitForms) {
    const r = decisionOf(spendRequest({ amountRaw, amountNormalized }));
    assert.equal(
      r,
      null,
      `a coherent spend packet (${amountRaw} == ${amountNormalized}) must pass the binding gate cleanly`,
    );
  }

  // ---- The binding gate does not weaken existing cap enforcement ----
  const honestOverCap = decisionOf(
    spendRequest({
      amountRaw: "5000.00",
      amountNormalized: 5000,
      periodCapNormalized: 10,
      periodWindow: "month",
    }),
  );
  assert.equal(
    honestOverCap?.decision,
    "require_approval",
    "an honest spend over the declared cap still requires approval",
  );

  console.log(
    "spend amount binding: under/over-declaration and unverifiable raw amounts are held for approval; coherent packets pass; cap enforcement intact",
  );
}

main();
