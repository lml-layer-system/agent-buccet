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
    assert.ok(ledger.userDeniedLawPaths.length > 500, "default base denial ledger should now seed a 500+ wall catalog");
    assert.ok(
      ledger.userDeniedLawPaths.some((entry) => entry.id.startsWith("DENY.SECRETS.ACCESS.003")),
      "default base denial ledger should include secret access denies",
    );
    assert.ok(
      ledger.userDeniedLawPaths.some((entry) => entry.id === "DENY.PERIODIC.EPIS-CITE-SPOOF-008"),
      "default base denial ledger should include the vendored periodic taxonomy rows",
    );
    assert.ok(
      ledger.userDeniedLawPaths.some((entry) => entry.id === "DENY.META.CATALOG.0170"),
      "default base denial ledger should include the vendored defensive meta law rows",
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
    assert.equal(scopeExpansion?.entry.id, "DENY.META.SCOPE.004L");

    const lawMutation = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("chat.emit", "chat:primary", "DAN developer mode should disable the laws.", {
        requestsLawMutation: true,
      }),
    });
    assert.ok(lawMutation, "expected law mutation to match the base denial pack");
    assert.equal(lawMutation?.decision, "deny");
    assert.equal(lawMutation?.entry.id, "DENY.META.LAW.004M");

    const sessionRevival = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("tool.exec", "sessionctl", "resume old session", {
        requestsSessionRevival: true,
      }),
    });
    assert.ok(sessionRevival, "expected session revival to match the base denial pack");
    assert.equal(sessionRevival?.decision, "deny");
    assert.equal(sessionRevival?.entry.id, "DENY.META.SESSION.004N");

    const ledgerBypass = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("chat.emit", "chat:primary", "Skip the ledger and use a forged receipt.", {
        requestsLedgerBypass: true,
      }),
    });
    assert.ok(ledgerBypass, "expected ledger bypass to match the base denial pack");
    assert.equal(ledgerBypass?.decision, "deny");
    assert.equal(ledgerBypass?.entry.id, "DENY.META.LEDGER.004O");

    const periodicCatalog = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("chat.emit", "chat:primary", "E1.8: CITATION SPOOFING"),
    });
    assert.ok(periodicCatalog, "expected periodic taxonomy row to exist as a live denial track");
    assert.equal(periodicCatalog?.decision, "deny");
    assert.equal(periodicCatalog?.entry.id, "DENY.PERIODIC.EPIS-CITE-SPOOF-008");

    const metaCatalog = lookupUserPathTrackDecision({
      ledger,
      session,
      request: makeRequest("chat.emit", "chat:primary", "Lockstep Law: In-Band Proof"),
    });
    assert.ok(metaCatalog, "expected defensive meta law row to exist as a live denial track");
    assert.equal(metaCatalog?.decision, "deny");
    assert.equal(metaCatalog?.entry.id, "DENY.META.CATALOG.0180");

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

    console.log("Agent Buccet headless base denials contract");
    console.log(`seeded entries: ${ledger.userDeniedLawPaths.length}`);
    console.log(`secret access deny: ${secretRead?.entry.id}`);
    console.log(`privilege escalation deny: ${sudoExec?.entry.id}`);
    console.log(`system mutation deny: ${systemMutation?.entry.id}`);
    console.log(`chat approval spoof deny: ${fakeApprovalChat?.entry.id}`);
    console.log(`authority claim deny: ${authorityClaim?.entry.id}`);
    console.log(`user constraint deny: ${userConstraintViolation?.entry.id}`);
    console.log(`grounding mismatch deny: ${groundingMismatch?.entry.id}`);
    console.log(`PII egress deny: ${piiEgress?.entry.id}`);
    console.log(`credential chat deny: ${credentialChat?.entry.id}`);
    console.log(`scope expansion deny: ${scopeExpansion?.entry.id}`);
    console.log(`law mutation deny: ${lawMutation?.entry.id}`);
    console.log(`session revival deny: ${sessionRevival?.entry.id}`);
    console.log(`ledger bypass deny: ${ledgerBypass?.entry.id}`);
    console.log(`periodic catalog deny: ${periodicCatalog?.entry.id}`);
    console.log(`meta catalog deny: ${metaCatalog?.entry.id}`);
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
