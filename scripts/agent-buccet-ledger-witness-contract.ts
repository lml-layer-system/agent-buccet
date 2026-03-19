import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  appendBoundaryLedger,
  createFileBoundaryLedgerWitness,
  publishBoundaryLedgerCheckpoint,
} from "../lib/lml/agent-boundary/index.ts";

async function main() {
  const targetPath = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-ledger-witness-")),
    "witness.jsonl",
  );

  await appendBoundaryLedger("ACTION_PROPOSED", {
    sessionId: "agent-buccet-ledger-witness",
    actorId: "system:ledger-witness-contract",
    requestId: "witness-contract",
    actionKind: "fs.read",
    target: "/tmp/witness-contract.txt",
    reason: "create checkpointable ledger record",
    createdAt: new Date().toISOString(),
  });

  const published = await publishBoundaryLedgerCheckpoint({
    adapter: createFileBoundaryLedgerWitness(targetPath),
  });

  const lines = (await fs.readFile(targetPath, "utf8"))
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  assert.equal(lines.length >= 1, true);
  const written = JSON.parse(lines.at(-1) ?? "{}") as { checkpoint_id?: string; signer_id?: string };
  assert.equal(written.checkpoint_id, published.checkpoint.checkpoint_id);
  assert.equal(written.signer_id, published.checkpoint.signer_id);

  console.log("Agent Buccet ledger witness contract");
  console.log(`checkpoint: ${published.checkpoint.checkpoint_id}`);
  console.log(`witness target: ${published.receipt.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
