import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  AGENT_BUCCET_TIME_EXCLUDED_SELF_UPDATING_LAW_IDS,
  buildActiveAgentBuccetLawIds,
  startPersistentBoundarySession,
} from "./../../src/index.ts";

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-foundation-"));
  process.chdir(tempRoot);
  await fs.cp(
    path.join(import.meta.dirname, "..", "..", "data", "agent-buccet-law-foundation"),
    path.join(tempRoot, "data", "agent-buccet-law-foundation"),
    { recursive: true },
  );

  const config = await startPersistentBoundarySession({
    sessionId: "agent-buccet-foundation-contract",
    actorId: "user:foundation-contract",
  });
  const activeLawIds = config.userLawIds ?? [];

  assert.ok(activeLawIds.includes("BUCCET.BASE.01"), "expected base law ids to load into active runtime law identity");
  assert.ok(activeLawIds.includes("BUCCET.BASE.LAW-0049196"), "expected carried base law ids to load into active runtime law identity");
  assert.ok(activeLawIds.includes("BUCCET.STATE.LAW-0049196"), "expected carried state law ids to load into active runtime law identity");
  assert.ok(activeLawIds.includes("BUCCET.OUTPUT.LAW-0049196"), "expected carried output law ids to load into active runtime law identity");
  assert.ok(activeLawIds.includes("BUCCET.TIME.BASE.LAW-MT-00420"), "expected carried time law ids to load into active runtime law identity");
  assert.ok(activeLawIds.includes("BUCCET.TIME.TEMPORAL.LAW-MT-00420"), "expected carried temporal time law ids to load into active runtime law identity");
  assert.ok(activeLawIds.includes("BUCCET.META.0001"), "expected carried defensive time ids to load into active runtime law identity");
  assert.ok(activeLawIds.includes("META.AUTHORITY.01"), "expected live defensive meta law ids to remain active");

  for (const excludedLawId of AGENT_BUCCET_TIME_EXCLUDED_SELF_UPDATING_LAW_IDS) {
    assert.equal(
      activeLawIds.includes(`BUCCET.META.${String(excludedLawId).padStart(4, "0")}`),
      false,
      `did not expect excluded carried time law ${excludedLawId} to load`,
    );
  }

  const restored = await buildActiveAgentBuccetLawIds({
    executableLaws: config.laws,
    existingLawIds: activeLawIds,
  });
  assert.deepEqual(restored, activeLawIds, "expected runtime law identity to remain stable across reassembly");

  console.log(`active law ids: ${activeLawIds.length}`);
  console.log(`base law present: ${activeLawIds.includes("BUCCET.BASE.01")}`);
  console.log(`carried temporal law present: ${activeLawIds.includes("BUCCET.TIME.TEMPORAL.LAW-MT-00420")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
