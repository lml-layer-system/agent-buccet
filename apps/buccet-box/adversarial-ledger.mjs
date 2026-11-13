/**
 * Adversarial proof-integrity test: mutation of signed ledger CONTENT.
 * No real user files are touched; creates one fresh isolated Buccet home.
 */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const base = await mkdtemp(path.join(os.tmpdir(), "buccet-ledger-redteam-"));
const original = process.env.AGENT_BUCCET_HOME;
process.env.AGENT_BUCCET_HOME = base;

const findings = [];
function finding(type, detail) {
  console.log("LEDGER_REDTEAM", type, JSON.stringify(detail));
  findings.push({ type, ...detail });
}

try {
  const ledger = await import("../../src/proof/ledger.ts");
  const sess = "proof-redteam-" + Date.now();
  const now = () => new Date().toISOString();
  await ledger.appendBoundaryLedger("ACTION_PROPOSED", {
    sessionId: sess,
    actorId: "agent:redteam",
    requestId: "redteam-proof-1",
    actionKind: "fs.write",
    target: "/allowed/test.txt",
    reason: "original proposed action",
    createdAt: now(),
  });
  await ledger.appendBoundaryLedger("ACTION_BLOCKED", {
    sessionId: sess,
    actorId: "agent:redteam",
    requestId: "redteam-proof-1",
    actionKind: "fs.write",
    target: "/allowed/test.txt",
    reason: "original denied decision",
    decision: "deny",
    createdAt: now(),
  });
  const baseline = await ledger.verifyBoundaryLedgerChain();
  assert.equal(baseline.ok, true, "baseline structural ledger verification failed");
  assert.equal(baseline.cryptographic_ok, true, "baseline ledger was not cryptographically verified");
  finding("BASELINE_PASS", { structural: baseline.ok, cryptographic: baseline.cryptographic_ok });

  const ledgerFile = path.join(base, "data", "ledger", "agent-boundary-ledger.jsonl");
  const raw = await readFile(ledgerFile, "utf8");
  const rows = raw.trim().split("\n").map((s) => JSON.parse(s));
  assert.ok(rows.length >= 2);
  const originalHash = rows[1].META.hash;
  const originalSignature = rows[1].META.signature;
  assert.ok(originalSignature, "baseline ledger record should be signed");

  // Malicious editor changes the truth of the record while keeping the
  // legitimate signature and stored hash from the original entry.
  rows[1].payload.target = "/outside/protected.txt";
  rows[1].payload.decision = "allow";
  rows[1].DECISION.verdict = "ALLOW";
  await writeFile(ledgerFile, rows.map((row) => JSON.stringify(row)).join("\n") + "\n", "utf8");

  const afterMutation = await ledger.verifyBoundaryLedgerChain();
  const exposed = (await ledger.readBoundaryLedgerBySession(sess)).at(-1);
  assert.equal(exposed?.payload.target, "/outside/protected.txt", "mutated body not loaded");
  assert.equal(exposed?.META.hash, originalHash, "attack did not preserve original hash");
  assert.equal(exposed?.META.signature, originalSignature, "attack did not preserve original signature");
  if (afterMutation.ok && afterMutation.cryptographic_ok === true) {
    finding("BREACH_SIGNED_RECEIPT_CONTENT_TAMPER_NOT_DETECTED", {
      original: { target: "/allowed/test.txt", verdict: "DENY" },
      forged: { target: exposed.payload.target, verdict: exposed.DECISION.verdict },
      chainVerified: afterMutation.ok,
      cryptographicVerified: afterMutation.cryptographic_ok,
      storedHashAndSignatureUnchanged: true,
    });
  } else {
    finding("PASS_SIGNED_RECEIPT_TAMPER_DETECTED", afterMutation);
  }

  // Restore the untampered records, then erase only the last (validly signed)
  // row. Without an externally anchored checkpoint, a valid shorter prefix
  // may be impossible to distinguish from an originally shorter history.
  await writeFile(ledgerFile, JSON.stringify(rows[0]) + "\n", "utf8");
  const afterTruncation = await ledger.verifyBoundaryLedgerChain();
  finding("CHECKPOINT_TRUNCATION_BEHAVIOR", {
    structural: afterTruncation.ok,
    cryptographic: afterTruncation.cryptographic_ok,
    removedTailRecord: true,
    note: "This is a threat-model limitation unless external checkpoint anchoring is in place",
  });
  console.log("LEDGER_REDTEAM_RESULTS", JSON.stringify(findings, null, 2));
  if (findings.some((f) => f.type.startsWith("BREACH_"))) {
    throw new Error("LEDGER_REDTEAM_FAILED: a signed record's body was tampered without detection");
  }
} finally {
  if (original === undefined) delete process.env.AGENT_BUCCET_HOME;
  else process.env.AGENT_BUCCET_HOME = original;
  await rm(base, { recursive: true, force: true });
}
