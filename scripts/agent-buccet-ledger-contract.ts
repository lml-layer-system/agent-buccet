import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  appendBoundaryLedger,
  buildBoundaryLedgerCheckpoint,
  queryBoundaryLedger,
  readBoundaryLedgerSigningIdentity,
  readBoundaryLedgerBySession,
  verifyBoundaryLedgerRecordSignature,
} from "../lib/agent-buccet/index.ts";

async function main() {
  const sessionId = `agent-buccet-ledger-contract-${randomUUID()}`;
  const actorId = "system:ledger-contract";
  const first = await appendBoundaryLedger("ACTION_PROPOSED", {
    sessionId,
    actorId,
    requestId: `req-${randomUUID()}`,
    actionKind: "fs.write",
    target: "/tmp/agent-buccet-ledger-contract.txt",
    reason: "proposal received",
    createdAt: new Date().toISOString(),
    metadata: {
      raw_request: "write a file",
      scope_result: "IN_SCOPE",
      path_through_system: "intercept > executor > ledger",
    },
  });

  const second = await appendBoundaryLedger("DECISION_RETURNED", {
    sessionId,
    actorId,
    requestId: first.payload.requestId,
    actionKind: "fs.write",
    target: "/tmp/agent-buccet-ledger-contract.txt",
    decision: "allow",
    reason: "path within scope, no law violations",
    lawIds: ["BOUNDARY.DEFAULT_SCOPE.01"],
    createdAt: new Date().toISOString(),
    metadata: {
      scope_result: "IN_SCOPE",
      path_through_system: "intercept > executor > law-engine > ledger",
      total_eval_ms: 0.04,
      outcome: "EXECUTED",
      next_state: "ready",
    },
  });

  const trace = await readBoundaryLedgerBySession(sessionId);
  assert.equal(trace.length >= 2, true);
  const tail = trace.slice(-2);
  assert.equal(tail[0].META.event_type, "ACTION_PROPOSED");
  assert.equal(tail[1].META.event_type, "DECISION_RETURNED");
  assert.equal(tail[0].META.id.startsWith("entry_"), true);
  assert.equal(tail[1].META.prev_hash, tail[0].META.hash);
  assert.equal(typeof tail[1].INPUT.source, "string");
  assert.equal(tail[1].DECISION.verdict, "ALLOW");
  assert.equal(Array.isArray(tail[1].PATH.path_through_system), true);
  assert.equal(typeof tail[1].NEXT.outcome, "string");
  assert.equal(Array.isArray(tail[1].OPTIONS.user_discretion), true);
  assert.equal(tail[0].META.signature_algo, "ed25519");
  assert.equal(typeof tail[0].META.signature, "string");
  assert.equal(typeof tail[0].META.signer_id, "string");

  const signatureCheck = await verifyBoundaryLedgerRecordSignature(tail[1]);
  assert.equal(signatureCheck.ok, true);

  const signingIdentity = await readBoundaryLedgerSigningIdentity();
  assert.equal(tail[1].META.signer_id, signingIdentity.signer_id);

  const checkpoint = await buildBoundaryLedgerCheckpoint();
  assert.equal(typeof checkpoint.signature, "string");
  assert.equal(checkpoint.signer_id, signingIdentity.signer_id);

  const allowResults = await queryBoundaryLedger({
    source: actorId,
    decision: "ALLOW",
    limit: 10,
  });
  assert.equal(allowResults.some((record) => record.META.session_id === sessionId), true);

  console.log("Agent Buccet ledger contract");
  console.log(`first id: ${first.META.id}`);
  console.log(`second id: ${second.META.id}`);
  console.log(`chain link ok: ${second.META.prev_hash === first.META.hash}`);
  console.log(`decision verdict: ${second.DECISION.verdict}`);
  console.log(`signed by: ${signingIdentity.signer_id}`);
  console.log(`checkpoint: ${checkpoint.checkpoint_id}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
