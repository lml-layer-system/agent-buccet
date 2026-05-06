import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildTeamWholeView,
  openProjectionHandle,
} from "./../../src/context/path-source-checkpoints.ts";
import {
  addTeamAgent,
  addTeamSource,
  appendTeamPathSourceMemoryEntry,
  createTeam,
  loadTeam,
  prepareTeamRuntime,
  readTeamPathSourceMemoryEntries,
  teamSlug,
  teamWorkMemorySourceId,
} from "./../../src/teams/team-workshop.ts";

async function main(): Promise<void> {
  console.log("--- Agent Buccet Path-Source Memory Contract ---");
  const home = await mkdtemp(path.join(tmpdir(), "buccet-path-source-memory-contract-"));
  try {
    const slug = teamSlug("path-source-memory-contract-team");
    const created = await createTeam({
      homePath: home,
      name: "path-source-memory-contract-team",
      domain: "contract",
      summary: "path source memory contract",
    });

    const workMemoryId = teamWorkMemorySourceId(slug);
    const workMemorySource = created.pathSourceCorpus.find((source) => source.id === workMemoryId);
    assert.ok(workMemorySource, "every team auto-injects a path-source memory source");
    assert.equal(workMemorySource?.internalRole, "work_memory");
    assert.ok(workMemorySource?.checkpoint, "work memory source is checkpoint-backed immediately");
    console.log("SUCCESS: fresh teams carry checkpoint-backed path-source memory.");

    const creationEntries = await readTeamPathSourceMemoryEntries(home, slug);
    assert.equal(
      creationEntries.length,
      1,
      "fresh work memory records the pre-Batcave team creation event",
    );
    assert.equal(creationEntries[0]?.kind, "team_created");
    assert.ok(
      creationEntries[0]?.text.includes(
        "Persistent brain source and Buccet path-source memory are ready",
      ),
      "creation event must explain the pre-Batcave brain/memory readiness",
    );

    await appendTeamPathSourceMemoryEntry({
      homePath: home,
      slug,
      kind: "user_ask",
      title: "user_ask:path-source-memory-contract-team",
      text: "Refactor the runtime without losing continuity.",
      meta: { lane: "creative" },
    });
    await appendTeamPathSourceMemoryEntry({
      homePath: home,
      slug,
      kind: "shard_dispatch",
      title: "architect:transform",
      text: "Assigned the transform shard to architect.",
      meta: { peerId: "architect", ownsStep: "transform" },
    });

    const entries = await readTeamPathSourceMemoryEntries(home, slug);
    assert.equal(
      entries.length,
      3,
      "path-source memory accumulates committed records on top of structural setup",
    );
    assert.equal(entries[0]?.kind, "team_created");
    assert.equal(entries[1]?.kind, "user_ask");
    assert.equal(entries[2]?.kind, "shard_dispatch");

    await addTeamAgent({
      homePath: home,
      slug,
      agentId: "architect",
      title: "Architect",
      specialty: "runtime continuity",
      ownsStep: "transform",
    });
    const manifest = await loadTeam(home, slug);
    assert.ok(manifest, "manifest must remain loadable");
    const agent = manifest?.agents.find((entry) => entry.id === "architect");
    assert.ok(
      agent?.sourceIds.includes(workMemoryId),
      "agents automatically retain access to path-source memory",
    );

    const afterAgentEntries = await readTeamPathSourceMemoryEntries(home, slug);
    assert.equal(
      afterAgentEntries.at(-1)?.kind,
      "agent_added",
      "adding an agent deepens the pre-Batcave wall",
    );

    const docPath = path.join(home, "source.md");
    await writeFile(docPath, "# Map\n\nThe wall starts before the run.\n", "utf8");
    await addTeamSource({
      homePath: home,
      slug,
      filePath: docPath,
      kind: "file:md",
    });

    const afterSourceEntries = await readTeamPathSourceMemoryEntries(home, slug);
    assert.equal(
      afterSourceEntries.at(-1)?.kind,
      "source_added",
      "adding a source deepens the pre-Batcave wall",
    );

    await prepareTeamRuntime({
      homePath: home,
      slug,
      markReady: true,
    });

    const afterPreparationEntries = await readTeamPathSourceMemoryEntries(home, slug);
    assert.equal(
      afterPreparationEntries.at(-1)?.kind,
      "runtime_prepared",
      "runtime prep writes an explicit pre-Batcave map commit",
    );
    assert.ok(
      afterPreparationEntries.at(-1)?.text.includes("Pi prepared the whole-view map"),
      "runtime preparation event must describe the prepared map",
    );

    const refreshedManifest = await loadTeam(home, slug);
    assert.ok(refreshedManifest, "manifest must remain loadable after source/preparation commits");

    const wholeView = await buildTeamWholeView({
      homePath: home,
      manifest: refreshedManifest!,
    });
    const wholeMemory = wholeView.sources.find((source) => source.sourceId === workMemoryId);
    assert.ok(wholeMemory, "whole-view includes path-source memory");
    const opened = await openProjectionHandle({
      homePath: home,
      slug,
      sourceRef: refreshedManifest?.pathSourceCorpus.find((source) => source.id === workMemoryId)!,
      handle: wholeMemory?.wholeHandle,
    });
    assert.ok(
      opened?.content.includes("latest-work:"),
      "whole-view memory projection includes the latest work tail",
    );
    assert.ok(
      opened?.content.includes("Refactor the runtime without losing continuity."),
      "work memory retains committed ask text",
    );
    assert.ok(
      opened?.content.includes("Assigned the transform shard to architect."),
      "work memory retains committed shard dispatch text",
    );
    assert.ok(
      opened?.content.includes("Pi prepared the whole-view map"),
      "whole-view memory projection retains pre-Batcave prep commits",
    );
    console.log(
      "SUCCESS: committed work deepens the whole-view map and stays reopenable as path-source memory.",
    );

    console.log("\n--- Path-Source Memory Contract Verified ---");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
