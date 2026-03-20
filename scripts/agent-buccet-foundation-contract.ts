import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  AGENT_BUCCET_META_EXCLUDED_SELF_UPDATING_LAW_IDS,
  buildActiveAgentBuccetLawIds,
  startPersistentBoundarySession,
} from "../lib/lml/agent-boundary/index.ts";

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-foundation-"));
  process.chdir(tempRoot);
  await fs.mkdir(path.join(tempRoot, "data", "lml-law-foundation"), { recursive: true });
  await fs.copyFile(
    path.join(import.meta.dirname, "..", "data", "lml-law-foundation", "laws.json"),
    path.join(tempRoot, "data", "lml-law-foundation", "laws.json"),
  );

  const config = await startPersistentBoundarySession({
    sessionId: "agent-buccet-foundation-contract",
    actorId: "user:foundation-contract",
  });
  const activeLawIds = config.userLawIds ?? [];

  assert.ok(activeLawIds.includes("BUCCET.BASE.01"), "expected base law ids to load into active runtime law identity");
  assert.ok(activeLawIds.includes("LAW-0000001"), "expected carried sun corpus ids to load into active runtime law identity");
  assert.ok(activeLawIds.includes("LAW-0068277"), "expected carried sun corpus tail ids to load into active runtime law identity");
  assert.ok(activeLawIds.includes("BUCCET.META.0001"), "expected carried defensive meta ids to load into active runtime law identity");
  assert.ok(activeLawIds.includes("META.AUTHORITY.01"), "expected live runtime meta ids to remain active");

  for (const excludedLawId of AGENT_BUCCET_META_EXCLUDED_SELF_UPDATING_LAW_IDS) {
    assert.equal(
      activeLawIds.includes(`BUCCET.META.${String(excludedLawId).padStart(4, "0")}`),
      false,
      `did not expect excluded carried meta law ${excludedLawId} to load`,
    );
  }

  const restored = await buildActiveAgentBuccetLawIds({
    executableLaws: config.laws,
    existingLawIds: activeLawIds,
  });
  assert.deepEqual(restored, activeLawIds, "expected runtime law identity to remain stable across reassembly");

  console.log(`active law ids: ${activeLawIds.length}`);
  console.log(`base law present: ${activeLawIds.includes("BUCCET.BASE.01")}`);
  console.log(`carried sun tail present: ${activeLawIds.includes("LAW-0068277")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
