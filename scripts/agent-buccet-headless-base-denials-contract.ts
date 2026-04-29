import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  createBaseHeadlessDenialEntries,
  evaluateBaseHeadlessDenials,
  loadUserPathLedger,
  lookupUserPathTrackDecision,
} from "../lib/agent-buccet/index.ts";
import type { BoundaryActionKind, BoundaryActionRequest, BoundarySession } from "../lib/agent-buccet/index.ts";

function makeSession(): BoundarySession {
  return {
    sessionId: "headless-base-denials",
    actorId: "user:headless-base-denials-contract",
    createdAt: new Date().toISOString(),
    dryRun: false,
    persistent: true,
    status: "active",
  };
}

function makeRequest(
  actionKind: BoundaryActionKind,
  target: string,
  payloadSummary?: string,
  flags?: BoundaryActionRequest["flags"],
  spendIntent?: BoundaryActionRequest["spendIntent"],
): BoundaryActionRequest {
  return {
    requestId: `${actionKind}-${target}`,
    sessionId: "headless-base-denials",
    actionKind,
    target,
    payloadSummary,
    requestedAt: new Date().toISOString(),
    provenance: "agent_inference",
    ...(flags ? { flags } : {}),
    ...(spendIntent ? { spendIntent } : {}),
  };
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-headless-base-denials-"));
  const ledgerPath = path.join(tempRoot, "user-path-ledger.json");
  const previousLedgerPath = process.env.AGENT_BUCCET_UPL_LEDGER_PATH;
  process.env.AGENT_BUCCET_UPL_LEDGER_PATH = ledgerPath;

  try {
    const ledger = await loadUserPathLedger();
    const expectedEntries = createBaseHeadlessDenialEntries();
    assert.equal(ledger.userApprovedLawPaths.length, 0, "default base denial ledger should not seed approved entries");
    assert.equal(ledger.userDeniedLawPaths.length, expectedEntries.length, "default base denial ledger should seed every denial entry");
    assert.ok(ledger.userDeniedLawPaths.length > 8000, "default base denial ledger should now seed the full 8k+ wall catalog");
    assert.ok(
      ledger.userDeniedLawPaths.some((entry) => entry.id.startsWith("DENY.SECRETS.ACCESS.003")),
      "default base denial ledger should include secret access denies",
    );
    assert.ok(
      ledger.userDeniedLawPaths.some((entry) => entry.id === "DENY.PERIODIC.EPIS-CITE-SPOOF-008"),
      "default base denial ledger should include the vendored periodic taxonomy rows",
    );
    assert.ok(
      ledger.userDeniedLawPaths.some((entry) => entry.id === "DENY.BASE.CATALOG.0170"),
      "default base denial ledger should include the vendored base denial catalog rows",
    );
    assert.ok(
      ledger.userDeniedLawPaths.some((entry) => entry.id === "DENY.BUCCET.DIM.RELIABILITY"),
      "default base denial ledger should include the Buccet failure dimension rows",
    );
    assert.ok(
      ledger.userDeniedLawPaths.some((entry) => entry.id === "DENY.BUCCET.LAW.01"),
      "default base denial ledger should include the Buccet containment laws",
    );
    assert.ok(
      ledger.userDeniedLawPaths.some((entry) => entry.id === "DENY.BUCCET.FAILURE.R1"),
      "default base denial ledger should include the Buccet failure rows",
    );
    assert.equal(
      ledger.userDeniedLawPaths.filter((entry) => entry.id.startsWith("DENY.BUCCET.BASE.")).length,
      8209,
      "default base denial ledger should include the full Buccet base denial-side law body",
    );
    assert.ok(
      ledger.userDeniedLawPaths.some((entry) => entry.id === "DENY.BUCCET.BASE.BUCCET.BASE.LAW-0049196"),
      "default base denial ledger should include carried Buccet laws",
    );
    const spendRawTargetEntry = ledger.userDeniedLawPaths.find((entry) => entry.id === "DENY.AGENT.SPEND.013A");
    assert.ok(spendRawTargetEntry, "expected raw-target spend deny to be seeded");
    assert.equal(
      spendRawTargetEntry?.trackConstraint?.targetMatchMode,
      "regex",
      "expected raw-target spend deny to bind raw transport targets by regex",
    );
    const spendAuthorityEntry = ledger.userDeniedLawPaths.find((entry) => entry.id === "DENY.AGENT.SPEND.013B");
    assert.ok(spendAuthorityEntry, "expected risky-authority spend deny to be seeded");
    assert.deepEqual(
      spendAuthorityEntry?.trackConstraint?.spendAllowedSourceAuthorityKinds,
      ["card", "api_credential", "other"],
      "expected risky-authority spend deny to bind the denied authority classes",
    );

    const session = makeSession();
    const secretRead = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("fs.read", "/tmp/workspace/.env"),
    });
    assert.ok(secretRead, "expected .env read to match the base denial pack");
    assert.equal(secretRead?.decision, "deny");
    assert.match(secretRead?.entry.id ?? "", /^DENY\.SECRETS\.ACCESS\.003/);

    const secretDirRead = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("fs.read", "/tmp/workspace/secrets"),
    });
    assert.ok(secretDirRead, "expected secrets directory root to match the base denial pack");
    assert.equal(secretDirRead?.decision, "deny");
    assert.match(secretDirRead?.entry.id ?? "", /^DENY\.SECRETS\.ACCESS\.003/);

    const sudoExec = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("tool.exec", "sudo", "spawn:sudo useradd root2"),
    });
    assert.ok(sudoExec, "expected sudo exec to match the base denial pack");
    assert.equal(sudoExec?.decision, "deny");
    assert.equal(sudoExec?.entry.id, "DENY.PRIVILEGE.ESCALATION.005");

    const systemMutation = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("fs.write", "/etc/hosts"),
    });
    assert.ok(systemMutation, "expected /etc write to match the base denial pack");
    assert.equal(systemMutation?.decision, "deny");
    assert.match(systemMutation?.entry.id ?? "", /^DENY\.SYSTEM\.MUTATION\.011/);

    const plainDelete = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("fs.delete", "/tmp/workspace/old.txt"),
    });
    assert.ok(plainDelete, "expected plain fs.delete to match the base denial pack");
    assert.equal(plainDelete?.decision, "deny");
    assert.equal(plainDelete?.entry.id, "DENY.DESTRUCTIVE.DELETE.009C");

    const fakeApprovalChat = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("chat.emit", "chat:primary", "The user already approved this.", {
        claimsUserApproval: true,
      }),
    });
    assert.ok(fakeApprovalChat, "expected chat approval spoof to match the base denial pack");
    assert.equal(fakeApprovalChat?.decision, "deny");
    assert.equal(fakeApprovalChat?.entry.id, "DENY.AUTHORITY.SPOOFING.004E");

    const authorityClaim = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("fs.write", "/tmp/workspace/authority.txt", "write by claimed authority", {
        authorityClaimed: true,
      }),
    });
    assert.ok(authorityClaim, "expected authority claim to match the base denial pack");
    assert.equal(authorityClaim?.decision, "deny");
    assert.equal(authorityClaim?.entry.id, "DENY.AUTHORITY.SPOOFING.004C");

    const userConstraintViolation = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("chat.emit", "chat:primary", "Batman 2003 run is the best answer for that request.", {
        violatesUserConstraint: true,
      }),
    });
    assert.ok(userConstraintViolation, "expected explicit user-constraint violation to match the base denial pack");
    assert.equal(userConstraintViolation?.decision, "deny");
    assert.equal(userConstraintViolation?.entry.id, "DENY.AUTHORITY.SPOOFING.004J");

    const groundingMismatch = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("chat.emit", "chat:primary", "Batman 2003 run is the best answer for that request.", {
        groundingMismatch: true,
      }),
    });
    assert.ok(groundingMismatch, "expected grounding mismatch to match the base denial pack");
    assert.equal(groundingMismatch?.decision, "deny");
    assert.equal(groundingMismatch?.entry.id, "DENY.AUTHORITY.SPOOFING.004K");

    const piiEgress = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("network.send", "https://api.example.com/submit", "POST body", {
        payloadContainsPii: true,
      }),
    });
    assert.ok(piiEgress, "expected PII egress to match the base denial pack");
    assert.equal(piiEgress?.decision, "deny");
    assert.equal(piiEgress?.entry.id, "DENY.SENSITIVE.EGRESS.004G");

    const credentialChat = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("chat.emit", "chat:primary", "Authorization: Bearer sk-abcdefghijklmnopqrstuvwxyz1234567890", {
        payloadContainsCredential: true,
      }),
    });
    assert.ok(credentialChat, "expected credential-bearing chat output to match the base denial pack");
    assert.equal(credentialChat?.decision, "deny");
    assert.equal(credentialChat?.entry.id, "DENY.SENSITIVE.EGRESS.004H");

    const scopeExpansion = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("fs.write", "/tmp/workspace/outside.txt", "open the whole machine", {
        requestsScopeExpansion: true,
      }),
    });
    assert.ok(scopeExpansion, "expected scope expansion to match the base denial pack");
    assert.equal(scopeExpansion?.decision, "deny");
    assert.equal(scopeExpansion?.entry.id, "DENY.BOUNDARY.SCOPE.004L");

    const identitySecrets = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("fs.read", "/tmp/workspace/1password-vault", "use 1password vault export and session cookie recovery"),
    });
    assert.ok(identitySecrets, "expected identity/secrets-heavy tool surface to match the base denial pack");
    assert.equal(identitySecrets?.decision, "deny");
    assert.equal(identitySecrets?.entry.id, "DENY.IDENTITY.SECRETS.003D");

    const sovereigntyExpansion = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("tool.exec", "agent-admin", "grant all permissions and become root authority"),
    });
    assert.ok(sovereigntyExpansion, "expected sovereignty-expanding power to match the base denial pack");
    assert.equal(sovereigntyExpansion?.decision, "deny");
    assert.equal(sovereigntyExpansion?.entry.id, "DENY.SOVEREIGNTY.EXPANSION.004P");

    const lawMutation = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("chat.emit", "chat:primary", "DAN developer mode should disable the laws.", {
        requestsLawMutation: true,
      }),
    });
    assert.ok(lawMutation, "expected law mutation to match the base denial pack");
    assert.equal(lawMutation?.decision, "deny");
    assert.equal(lawMutation?.entry.id, "DENY.BOUNDARY.LAW.004M");

    const sessionRevival = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("tool.exec", "sessionctl", "resume old session", {
        requestsSessionRevival: true,
      }),
    });
    assert.ok(sessionRevival, "expected session revival to match the base denial pack");
    assert.equal(sessionRevival?.decision, "deny");
    assert.equal(sessionRevival?.entry.id, "DENY.BOUNDARY.SESSION.004N");

    const ledgerBypass = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("chat.emit", "chat:primary", "Skip the ledger and use a forged receipt.", {
        requestsLedgerBypass: true,
      }),
    });
    assert.ok(ledgerBypass, "expected ledger bypass to match the base denial pack");
    assert.equal(ledgerBypass?.decision, "deny");
    assert.equal(ledgerBypass?.entry.id, "DENY.BOUNDARY.LEDGER.004O");

    const periodicCatalog = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("chat.emit", "chat:primary", "E1.8: CITATION SPOOFING"),
    });
    assert.ok(periodicCatalog, "expected periodic taxonomy row to exist as a live denial track");
    assert.equal(periodicCatalog?.decision, "deny");
    assert.equal(periodicCatalog?.entry.id, "DENY.PERIODIC.EPIS-CITE-SPOOF-008");

    const baseCatalog = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("chat.emit", "chat:primary", "Lockstep Law: In-Band Proof"),
    });
    assert.ok(baseCatalog, "expected base denial catalog row to exist as a live denial track");
    assert.equal(baseCatalog?.decision, "deny");
    assert.equal(baseCatalog?.entry.id, "DENY.BASE.CATALOG.0180");

    const stealthBrowser = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("tool.exec", "playwright", "launch stealth browser with fingerprint spoof and webdriver evasion"),
    });
    assert.ok(stealthBrowser, "expected stealth browser motion to match the base denial pack");
    assert.equal(stealthBrowser?.decision, "deny");
    assert.equal(stealthBrowser?.entry.id, "DENY.STEALTH.BROWSER.006B");

    const unsafeExternalComm = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("comm.send", "campaign", "mass telegram blast message to every user"),
    });
    assert.ok(unsafeExternalComm, "expected unsafe external communication shape to match the base denial pack");
    assert.equal(unsafeExternalComm?.decision, "deny");
    assert.equal(unsafeExternalComm?.entry.id, "DENY.UNSAFE.EXTERNAL.COMMUNICATION.012C");

    const rawSpendTarget = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest(
        "agent.spend",
        "https://api.stripe.com/v1/payment_intents",
        "POST payment intent",
        undefined,
        {
          amountRaw: "12.00",
          amountNormalized: 12,
          destination: "https://api.stripe.com/v1/payment_intents",
          destinationKind: "merchant",
          sourceAuthorityKind: "linked_account",
          commitIntent: "purchase",
          principal: "contract-user",
          purpose: "stripe payment intent",
          bucketId: "shopping:stripe",
          termsSummary: "one-time purchase seed",
          recurring: false,
          riskClass: "low",
          accountabilityRef: "receipt:stripe",
          instructionSource: "trusted_user",
          currencyHint: "USD",
          merchantHint: "Stripe",
        },
      ),
    });
    assert.ok(rawSpendTarget, "expected raw spend target to match the base denial pack");
    assert.equal(rawSpendTarget?.decision, "deny");
    assert.equal(rawSpendTarget?.entry.id, "DENY.AGENT.SPEND.013A");

    const riskySpendAuthority = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest(
        "agent.spend",
        "merchant:approved:vendor",
        "approved destination but card authority",
        undefined,
        {
          amountRaw: "8.00",
          amountNormalized: 8,
          destination: "merchant:approved:vendor",
          destinationKind: "merchant",
          sourceAuthorityKind: "card",
          commitIntent: "purchase",
          principal: "contract-user",
          purpose: "approved vendor payment",
          bucketId: "shopping:vendor",
          termsSummary: "one-time purchase seed",
          recurring: false,
          riskClass: "low",
          accountabilityRef: "receipt:vendor",
          instructionSource: "trusted_user",
          currencyHint: "USD",
          merchantHint: "Vendor",
        },
      ),
    });
    assert.ok(riskySpendAuthority, "expected risky spend authority to match the base denial pack");
    assert.equal(riskySpendAuthority?.decision, "deny");
    assert.equal(riskySpendAuthority?.entry.id, "DENY.AGENT.SPEND.013B");

    const exchangeSpend = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest(
        "agent.spend",
        "exchange:coinbase",
        "approved exchange trade",
        undefined,
        {
          amountRaw: "25.00",
          amountNormalized: 25,
          destination: "exchange:coinbase",
          destinationKind: "exchange",
          sourceAuthorityKind: "linked_account",
          commitIntent: "purchase",
          principal: "contract-user",
          purpose: "buy exchange asset",
          bucketId: "trade:coinbase",
          termsSummary: "one-time exchange order",
          recurring: false,
          riskClass: "volatile",
          accountabilityRef: "trade:coinbase",
          instructionSource: "trusted_user",
        },
      ),
    });
    assert.ok(exchangeSpend, "expected exchange spend to match the base denial pack");
    assert.equal(exchangeSpend?.decision, "deny");
    assert.equal(exchangeSpend?.entry.id, "DENY.AGENT.SPEND.013E");

    const buccetFailure = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("chat.emit", "chat:primary", "R1: HALLUCINATED ACTIONS"),
    });
    assert.ok(buccetFailure, "expected Buccet failure row to exist as a live denial track");
    assert.equal(buccetFailure?.decision, "deny");
    assert.equal(buccetFailure?.entry.id, "DENY.BUCCET.FAILURE.R1");

    const baseLaw = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("chat.emit", "chat:primary", "BUCCET.BASE.LAW-0049196"),
    });
    assert.ok(baseLaw, "expected carried Buccet law to exist as a live denial track");
    assert.equal(baseLaw?.decision, "deny");
    assert.equal(baseLaw?.entry.id, "DENY.BUCCET.BASE.BUCCET.BASE.LAW-0049196");

    const timeLaw = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("chat.emit", "chat:primary", "BUCCET.TIME.TEMPORAL.LAW-000039"),
    });
    assert.ok(timeLaw, "expected carried Buccet law to exist as a live denial track");
    assert.equal(timeLaw?.decision, "deny");
    assert.equal(timeLaw?.entry.id, "DENY.BUCCET.BASE.BUCCET.TIME.TEMPORAL.LAW-000039");

    const buccetLawEntry = ledger.userDeniedLawPaths.find((entry) => entry.id === "DENY.BUCCET.LAW.03");
    assert.ok(buccetLawEntry, "expected Buccet containment law to be seeded explicitly in the denial pack");
    assert.ok(
      buccetLawEntry?.trackConstraint?.requestTextPatterns?.some((pattern) => pattern.includes("ALL ACCESS MUST BE SCOPED, LOGGED, AND REVOCABLE")),
      "expected Buccet containment law to carry the containment-law trigger text",
    );

    const safeWorkspaceWrite = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("fs.write", "/tmp/workspace/output.txt"),
    });
    assert.equal(safeWorkspaceWrite, null, "base denial pack should not deny ordinary workspace writes");

    const evaluated = evaluateBaseHeadlessDenials({
      actionKind: "chat.emit",
      target: "chat:primary",
      flags: { claimsActionCompletionWithoutWitness: true },
    });
    assert.equal(evaluated.decision, "deny");
    assert.equal(evaluated.ruleId, "DENY.AUTHORITY.SPOOFING.004F");
    const evaluatedSpend = evaluateBaseHeadlessDenials({
      actionKind: "agent.spend",
      target: "merchant:approved:vendor",
      spendIntent: {
        amountRaw: "8.00",
        amountNormalized: 8,
        destination: "merchant:approved:vendor",
        destinationKind: "merchant",
        sourceAuthorityKind: "card",
        commitIntent: "purchase",
        principal: "contract-user",
        purpose: "approved vendor payment",
        bucketId: "shopping:vendor",
        termsSummary: "one-time purchase seed",
        recurring: false,
        riskClass: "low",
        accountabilityRef: "receipt:vendor",
        instructionSource: "trusted_user",
        currencyHint: "USD",
        merchantHint: "Vendor",
      },
    });
    assert.equal(evaluatedSpend.decision, "deny");
    assert.equal(evaluatedSpend.ruleId, "DENY.AGENT.SPEND.013B");
    const evaluatedSubscribeSpend = evaluateBaseHeadlessDenials({
      actionKind: "agent.spend",
      target: "merchant:saas",
      spendIntent: {
        amountRaw: "9.99",
        amountNormalized: 9.99,
        destination: "merchant:saas",
        destinationKind: "merchant",
        sourceAuthorityKind: "linked_account",
        commitIntent: "subscribe",
        principal: "contract-user",
        purpose: "subscribe to SaaS",
        bucketId: "saas:vendor",
        termsSummary: "$9.99 monthly until cancelled",
        recurring: true,
        riskClass: "recurring",
        accountabilityRef: "subscription:saas",
        instructionSource: "trusted_user",
      },
    });
    assert.equal(evaluatedSubscribeSpend.decision, "deny");
    assert.equal(evaluatedSubscribeSpend.ruleId, "DENY.AGENT.SPEND.013F");

    console.log("Agent Buccet headless base denials contract");
    console.log(`seeded entries: ${ledger.userDeniedLawPaths.length}`);
    console.log(`secret access deny: ${secretRead?.entry.id}`);
    console.log(`privilege escalation deny: ${sudoExec?.entry.id}`);
    console.log(`system mutation deny: ${systemMutation?.entry.id}`);
    console.log(`plain delete deny: ${plainDelete?.entry.id}`);
    console.log(`chat approval spoof deny: ${fakeApprovalChat?.entry.id}`);
    console.log(`authority claim deny: ${authorityClaim?.entry.id}`);
    console.log(`user constraint deny: ${userConstraintViolation?.entry.id}`);
    console.log(`grounding mismatch deny: ${groundingMismatch?.entry.id}`);
    console.log(`PII egress deny: ${piiEgress?.entry.id}`);
    console.log(`credential chat deny: ${credentialChat?.entry.id}`);
    console.log(`scope expansion deny: ${scopeExpansion?.entry.id}`);
    console.log(`identity secrets deny: ${identitySecrets?.entry.id}`);
    console.log(`sovereignty expansion deny: ${sovereigntyExpansion?.entry.id}`);
    console.log(`law mutation deny: ${lawMutation?.entry.id}`);
    console.log(`session revival deny: ${sessionRevival?.entry.id}`);
    console.log(`ledger bypass deny: ${ledgerBypass?.entry.id}`);
    console.log(`periodic catalog deny: ${periodicCatalog?.entry.id}`);
    console.log(`base catalog deny: ${baseCatalog?.entry.id}`);
    console.log(`stealth browser deny: ${stealthBrowser?.entry.id}`);
    console.log(`unsafe external comm deny: ${unsafeExternalComm?.entry.id}`);
    console.log(`raw spend target deny: ${rawSpendTarget?.entry.id}`);
    console.log(`risky spend authority deny: ${riskySpendAuthority?.entry.id}`);
    console.log(`buccet failure deny: ${buccetFailure?.entry.id}`);
    console.log(`buccet base denial-side law: ${baseLaw?.entry.id}`);
    console.log(`buccet base denial-side time law: ${timeLaw?.entry.id}`);
    console.log(`buccet law seeded: ${buccetLawEntry?.id}`);
    console.log(`safe workspace write untouched: ${safeWorkspaceWrite === null}`);
  } finally {
    if (previousLedgerPath === undefined) {
      delete process.env.AGENT_BUCCET_UPL_LEDGER_PATH;
    } else {
      process.env.AGENT_BUCCET_UPL_LEDGER_PATH = previousLedgerPath;
    }
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
