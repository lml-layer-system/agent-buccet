import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  sendBoundaryLedgerWriterInput,
  type BoundaryLedgerWriterOutput,
} from "./../../src/index.ts";

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Agent Buccet ledger writer contract");

  const socketPath = path.join("/tmp", `agent-buccet-ledger-writer-${randomUUID()}.sock`);
  const cwd = process.cwd();
  const scriptPath = path.join(cwd, "bin", "agent-buccet-ledger-writer.ts");
  const fallbackPath = path.join(cwd, "scripts", "agent-buccet-ledger-writer.ts");
  const writerPath = cwd.includes(`${path.sep}dist${path.sep}agent-buccet`) ? scriptPath : fallbackPath;

  const child = spawn(process.execPath, [writerPath, "--socket", socketPath], {
    cwd,
    stdio: ["ignore", "ignore", "pipe"],
  });

  let ready = false;
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    if (chunk.includes("ledger writer running")) {
      ready = true;
    }
  });

  for (let attempt = 0; attempt < 50 && !ready; attempt += 1) {
    await wait(100);
  }
  assert.equal(ready, true, "ledger writer should be ready");

  const sessionId = `ledger-writer-contract-${randomUUID()}`;
  const response = await sendBoundaryLedgerWriterInput({
    target: { socketPath },
    input: {
      command: "append",
      eventType: "ACTION_PROPOSED",
      payload: {
        sessionId,
        actorId: "system:ledger-writer-contract",
        requestId: `req-${randomUUID()}`,
        actionKind: "fs.write",
        target: "/tmp/ledger-writer-contract.txt",
        reason: "writer append",
        createdAt: new Date().toISOString(),
      },
    },
  });

  assert.equal(response.type, "append_ok");
  const ok = response as Extract<BoundaryLedgerWriterOutput, { type: "append_ok" }>;
  assert.equal(ok.record.META.session_id, sessionId);
  console.log(`writer append id: ${ok.record.META.id}`);

  const status = await sendBoundaryLedgerWriterInput({
    target: { socketPath },
    input: { command: "status" },
  });
  assert.equal((status as { type: string }).type, "status");
  console.log(`writer status type: ${(status as { type: string }).type}`);

  const shutdown = await sendBoundaryLedgerWriterInput({
    target: { socketPath },
    input: { command: "shutdown" },
  });
  assert.equal((shutdown as { type: string }).type, "ack");
  console.log(`writer shutdown type: ${(shutdown as { type: string }).type}`);

  await once(child, "exit");
  await fs.rm(socketPath, { force: true }).catch(() => undefined);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
