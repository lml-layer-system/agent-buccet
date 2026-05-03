import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createBoundaryBodyguard,
  createPersistentBoundaryRuntimeStore,
} from "./../src/index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const sessionId = `agent-buccet-gravity-${runId}`;
  const actorId = "user:agent-buccet-gravity-demo";
  const demoRoot = path.join(process.cwd(), "data", "agent-boundary", "gravity-demo", sessionId);
  const scopedRoot = path.join(demoRoot, "workspace");
  const outsideRoot = path.join(demoRoot, "outside");
  const insideFile = path.join(scopedRoot, "inside.txt");
  const outsideFile = path.join(outsideRoot, "outside.txt");

  await fs.mkdir(scopedRoot, { recursive: true });
  await fs.mkdir(outsideRoot, { recursive: true });
  await fs.writeFile(outsideFile, "protected\n", "utf8");

  const store = await createPersistentBoundaryRuntimeStore({
    sessionId,
    actorId,
  });

  await store.openPath({
    rootPath: scopedRoot,
    grantedActions: ["fs.read", "fs.write", "fs.append"],
    issuedBy: actorId,
  });

  const bodyguard = createBoundaryBodyguard(store);
  const gravityLoop = bodyguard.gravity.start();

  const allowed = await bodyguard.gravity.submitProposal({
    actionKind: "fs.write",
    target: insideFile,
    payloadSummary: `write:${insideFile}`,
    successReason: "gravity-admitted in-scope write",
    execute: async () => {
      await fs.writeFile(insideFile, "gravity inside scope\n", "utf8");
      return { ok: true };
    },
  });

  const nulled = await bodyguard.gravity.submitProposal({
    actionKind: "fs.write",
    target: outsideFile,
    payloadSummary: `write:${outsideFile}`,
    successReason: "should never execute outside scope",
    execute: async () => {
      await fs.writeFile(outsideFile, "compromised\n", "utf8");
      return { ok: true };
    },
  });

  const audit = await bodyguard.gravity.auditSession();
  await bodyguard.gravity.shutdown();
  await gravityLoop;

  assert(allowed.decision === "allow" && allowed.executed, "expected gravity to admit in-scope write");
  assert(nulled.decision === "null" && !nulled.executed, "expected gravity to null out-of-scope write");
  assert(audit.decision === "allow", "expected gravity session audit to be complete");
  assert((await fs.readFile(insideFile, "utf8")) === "gravity inside scope\n", "expected in-scope gravity write");
  assert((await fs.readFile(outsideFile, "utf8")) === "protected\n", "expected out-of-scope file unchanged");

  console.log("Agent Buccet gravity example");
  console.log(`session: ${sessionId}`);
  console.log(`allowed decision: ${allowed.decision}`);
  console.log(`nulled decision: ${nulled.decision}`);
  console.log(`nulled reason: ${nulled.reason}`);
  console.log(`audit decision: ${audit.decision}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
