import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildTeamWholeView } from "./../../src/context/path-source-checkpoints.ts";
import {
  addTeamAgent,
  addTeamSource,
  appendTeamPathSourceMemoryEntry,
  cherryPickTeamSnapshotSources,
  createTeam,
  listTeamContinuitySnapshots,
  loadTeam,
  loadTeamRuntimePreparation,
  prepareTeamRuntime,
  readTeamPathSourceMemoryEntries,
  rollbackTeamToContinuitySnapshot,
  teamSlug,
} from "./../../src/teams/team-workshop.ts";

async function main(): Promise<void> {
  console.log("--- Agent Buccet Team Continuity Contract ---");
  const home = await mkdtemp(path.join(tmpdir(), "buccet-team-continuity-contract-"));
  try {
    const slug = teamSlug("team-continuity-contract-team");
    await createTeam({
      homePath: home,
      name: "team-continuity-contract-team",
      domain: "continuity",
      summary: "team continuity contract",
    });

    const docA = path.join(home, "source-a.md");
    await writeFile(docA, "# Source A\n\nStable source.\n", "utf8");
    const manifestAfterA = await addTeamSource({
      homePath: home,
      slug,
      filePath: docA,
      kind: "file:md",
      title: "Source A",
    });
    const sourceAId = manifestAfterA.pathSourceCorpus.find(
      (source) => source.title === "Source A",
    )?.id;
    assert.ok(sourceAId, "source A must be present");

    await addTeamAgent({
      homePath: home,
      slug,
      agentId: "architect",
      title: "Architect",
      specialty: "stable refactor",
      ownsStep: "transform",
    });

    await prepareTeamRuntime({
      homePath: home,
      slug,
      markReady: true,
    });

    const historyAfterReady = await listTeamContinuitySnapshots(home, slug);
    const readySnapshot = [...historyAfterReady]
      .reverse()
      .find((entry) => entry.trigger.kind === "runtime_prepared");
    assert.ok(readySnapshot, "runtime preparation must capture an exact continuity snapshot");
    console.log("SUCCESS: continuity snapshots capture the pre-Batcave prepared state.");

    const docB = path.join(home, "source-b.md");
    await writeFile(docB, "# Source B\n\nExperimental source.\n", "utf8");
    const manifestAfterB = await addTeamSource({
      homePath: home,
      slug,
      filePath: docB,
      kind: "file:md",
      title: "Source B",
    });
    const sourceBId = manifestAfterB.pathSourceCorpus.find(
      (source) => source.title === "Source B",
    )?.id;
    assert.ok(sourceBId, "source B must be present");

    await addTeamAgent({
      homePath: home,
      slug,
      agentId: "reviewer",
      title: "Reviewer",
      specialty: "messy branch",
      ownsStep: "validate",
    });

    await appendTeamPathSourceMemoryEntry({
      homePath: home,
      slug,
      kind: "peer_result",
      title: "reviewer:validate",
      text: "Bad branch landed and needs rollback.",
      meta: { peerId: "reviewer" },
    });

    const historyAfterMess = await listTeamContinuitySnapshots(home, slug);
    const sourceBSnapshot = [...historyAfterMess]
      .reverse()
      .find(
        (entry) =>
          entry.trigger.kind === "source_added" && entry.trigger.title.endsWith(String(sourceBId)),
      );
    assert.ok(sourceBSnapshot, "source B addition must produce a continuity snapshot");

    const rolledBack = await rollbackTeamToContinuitySnapshot({
      homePath: home,
      slug,
      snapshotId: readySnapshot?.snapshotId,
    });
    assert.equal(
      rolledBack.manifest.status,
      "ready",
      "rollback restores the exact prepared team status",
    );

    const manifestAfterRollback = await loadTeam(home, slug);
    assert.ok(manifestAfterRollback, "team remains loadable after rollback");
    assert.ok(
      !manifestAfterRollback?.pathSourceCorpus.some((source) => source.id === sourceBId),
      "rollback removes later source additions from the live Buccet map",
    );
    assert.ok(
      !manifestAfterRollback?.agents.some((agent) => agent.id === "reviewer"),
      "rollback removes later roster changes from the live Buccet map",
    );
    const runtimeAfterRollback = await loadTeamRuntimePreparation(home, slug);
    assert.equal(
      runtimeAfterRollback?.teamStatus,
      "ready",
      "rollback restores runtime preparation too",
    );
    const memoryAfterRollback = await readTeamPathSourceMemoryEntries(home, slug);
    assert.equal(
      memoryAfterRollback.at(-1)?.kind,
      "runtime_prepared",
      "rollback restores the exact work-memory tail",
    );
    const wholeViewAfterRollback = await buildTeamWholeView({
      homePath: home,
      manifest: manifestAfterRollback!,
    });
    assert.ok(
      !wholeViewAfterRollback.sources.some((source) => source.sourceId === sourceBId),
      "rollback removes later whole-view sources too",
    );
    console.log(
      "SUCCESS: rollback restores the exact-time Buccet map, runtime, and work-memory state.",
    );

    const cherryPicked = await cherryPickTeamSnapshotSources({
      homePath: home,
      slug,
      snapshotId: sourceBSnapshot?.snapshotId,
      sourceIds: [sourceBId!],
    });
    assert.equal(cherryPicked.sources.length, 1, "cherry-pick returns the selected source");

    const manifestAfterCherryPick = await loadTeam(home, slug);
    assert.ok(
      manifestAfterCherryPick?.pathSourceCorpus.some((source) => source.id === sourceBId),
      "cherry-pick restores the selected source into the current Buccet",
    );
    assert.ok(
      !manifestAfterCherryPick?.agents.some((agent) => agent.id === "reviewer"),
      "cherry-pick does not drag unrelated roster changes forward",
    );
    const memoryAfterCherryPick = await readTeamPathSourceMemoryEntries(home, slug);
    assert.equal(
      memoryAfterCherryPick.at(-1)?.kind,
      "source_cherry_picked",
      "cherry-pick records a new committed continuity event",
    );
    const wholeViewAfterCherryPick = await buildTeamWholeView({
      homePath: home,
      manifest: manifestAfterCherryPick!,
    });
    assert.ok(
      wholeViewAfterCherryPick.sources.some((source) => source.sourceId === sourceBId),
      "cherry-picked source is visible in the current whole-view",
    );
    console.log(
      "SUCCESS: cherry-pick lifts selected source checkpoints forward without replaying the bad team state.",
    );

    console.log("\n--- Team Continuity Contract Verified ---");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
