import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  appendBoundaryLedger,
  createFileBoundaryLedgerWitness,
  createHttpBoundaryLedgerWitness,
  publishBoundaryLedgerCheckpoint,
  readAllBoundaryLedgerRecords,
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
  const beforePublishCount = (await readAllBoundaryLedgerRecords()).length;

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

  const requests: string[] = [];
  const server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => {
      requests.push(body);
      response.statusCode = 200;
      response.end("ok");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  assert(address && typeof address === "object");
  const witnessUrl = `http://127.0.0.1:${address.port}/witness`;

  const publishedHttp = await publishBoundaryLedgerCheckpoint({
    adapter: createHttpBoundaryLedgerWitness({
      targetUrl: witnessUrl,
      timeoutMs: 3000,
    }),
  });
  assert.equal(publishedHttp.receipt.target, witnessUrl);
  assert.equal(requests.length, 1);
  const delivered = JSON.parse(requests[0] ?? "{}") as { checkpoint_id?: string };
  assert.equal(delivered.checkpoint_id, publishedHttp.checkpoint.checkpoint_id);
  await new Promise<void>((resolve) => server.close(() => resolve()));

  let failed = false;
  try {
    await publishBoundaryLedgerCheckpoint({
      adapter: createHttpBoundaryLedgerWitness({
        targetUrl: "http://127.0.0.1:1/unreachable",
        timeoutMs: 250,
      }),
    });
  } catch {
    failed = true;
  }
  assert.equal(failed, true, "expected unreachable HTTP witness publish to fail");

  const afterPublishCount = (await readAllBoundaryLedgerRecords()).length;
  assert.equal(
    afterPublishCount,
    beforePublishCount,
    "witness publishing should not mutate append ledger path",
  );

  console.log("Agent Buccet ledger witness contract");
  console.log(`checkpoint: ${published.checkpoint.checkpoint_id}`);
  console.log(`witness target: ${published.receipt.target}`);
  console.log(`witness http target: ${publishedHttp.receipt.target}`);
  console.log("witness failure behavior: ok");
  console.log("append path unaffected: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
