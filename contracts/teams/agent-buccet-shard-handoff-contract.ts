import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildTeamPeerTaskGraph,
  buildTeamWholeView,
  rebuildTeamShardLedger,
} from "./../../src/context/path-source-checkpoints.ts";
import {
  addTeamAgent,
  addTeamSource,
  appendTeamPathSourceMemoryEntry,
  createTeam,
  loadTeam,
  readTeamPathSourceMemoryEntries,
  removeTeamAgent,
  teamSlug,
} from "./../../src/teams/team-workshop.ts";

async function main(): Promise<void> {
  console.log("--- Agent Buccet Shard Handoff Contract ---");
  const home = await mkdtemp(path.join(tmpdir(), "buccet-shard-handoff-contract-"));
  try {
    const slug = teamSlug("shard-handoff-contract-team");
    await createTeam({
      homePath: home,
      name: "shard-handoff-contract-team",
      domain: "runtime",
      summary: "shard handoff contract",
    });

    const docPath = path.join(home, "runtime-map.md");
    const largeDoc = Array.from(
      { length: 260 },
      (_, index) => `line ${index + 1}: durable runtime map for shard continuity.`,
    ).join("\n");
    await writeFile(docPath, `${largeDoc}\n`, "utf8");
    const manifestAfterSource = await addTeamSource({
      homePath: home,
      slug,
      filePath: docPath,
      kind: "file:md",
      title: "Runtime Map",
    });
    const sourceId = manifestAfterSource.pathSourceCorpus.find((source) => source.title === "Runtime Map")?.id;
    assert.ok(sourceId, "runtime source must exist");

    await addTeamAgent({
      homePath: home,
      slug,
      agentId: "architect",
      title: "Architect",
      specialty: "refactor ownership",
      ownsStep: "transform",
      sourceIds: [sourceId!],
    });

    const manifestA = await loadTeam(home, slug);
    assert.ok(manifestA, "manifest A must load");
    const wholeViewA = await buildTeamWholeView({
      homePath: home,
      manifest: manifestA!,
    });
    const graphA = await buildTeamPeerTaskGraph({
      homePath: home,
      manifest: manifestA!,
      wholeView: wholeViewA,
      userRequest: "Refactor the runtime wall without losing continuity.",
      agents: manifestA!.agents,
      runId: "run-handoff-a",
    });
    const packetA = graphA.packets.find((packet) => packet.peerId === "architect");
    assert.ok(packetA, "architect packet must exist");
    assert.ok((packetA?.shards.length ?? 0) > 0, "architect packet must own at least one shard");
    const shardA = packetA!.shards[0]!;

    await appendTeamPathSourceMemoryEntry({
      homePath: home,
      slug,
      kind: "shard_dispatch",
      title: "architect:transform",
      text: packetA!.taskSlice,
      meta: {
        peerId: packetA!.peerId,
        packetId: packetA!.packetId,
        ownsStep: packetA!.ownsStep,
        sourceIds: packetA!.sourceIds,
        shardIds: packetA!.shards.map((shard) => shard.shardId),
        shards: packetA!.shards,
      },
    });
    await appendTeamPathSourceMemoryEntry({
      homePath: home,
      slug,
      kind: "peer_result",
      title: "architect:transform",
      text: "Architect completed the initial transform pass on the runtime shard.",
      meta: {
        peerId: packetA!.peerId,
        packetId: packetA!.packetId,
        ownsStep: packetA!.ownsStep,
        sourceIds: packetA!.sourceIds,
        shardIds: packetA!.shards.map((shard) => shard.shardId),
        shards: packetA!.shards,
        status: "completed",
      },
    });

    await removeTeamAgent({
      homePath: home,
      slug,
      agentId: "architect",
    });
    await addTeamAgent({
      homePath: home,
      slug,
      agentId: "surgeon",
      title: "Surgeon",
      specialty: "cleanup ownership",
      ownsStep: "transform",
      sourceIds: [sourceId!],
    });

    const manifestB = await loadTeam(home, slug);
    assert.ok(manifestB, "manifest B must load");
    const wholeViewB = await buildTeamWholeView({
      homePath: home,
      manifest: manifestB!,
    });
    const graphB = await buildTeamPeerTaskGraph({
      homePath: home,
      manifest: manifestB!,
      wholeView: wholeViewB,
      userRequest: "Refactor the runtime wall without losing continuity.",
      agents: manifestB!.agents,
      runId: "run-handoff-b",
    });
    const packetB = graphB.packets.find((packet) => packet.peerId === "surgeon");
    assert.ok(packetB, "surgeon packet must exist");
    const shardB = packetB!.shards.find((shard) => shard.shardId === shardA.shardId);
    assert.ok(shardB, "same source region + same stage + same request must keep the same shard id");
    assert.equal(shardB?.assignedPeerId, "surgeon", "new packet must claim the same shard under the new worker");

    await appendTeamPathSourceMemoryEntry({
      homePath: home,
      slug,
      kind: "shard_dispatch",
      title: "surgeon:transform",
      text: packetB!.taskSlice,
      meta: {
        peerId: packetB!.peerId,
        packetId: packetB!.packetId,
        ownsStep: packetB!.ownsStep,
        sourceIds: packetB!.sourceIds,
        shardIds: packetB!.shards.map((shard) => shard.shardId),
        shards: packetB!.shards,
      },
    });

    const workEntries = await readTeamPathSourceMemoryEntries(home, slug);
    const ledger = rebuildTeamShardLedger({
      graph: graphB,
      workEntries,
    });
    const shardState = ledger.find((shard) => shard.shardId === shardA.shardId);
    assert.ok(shardState, "ledger must reconstruct the shard from canonical memory");
    assert.equal(shardState?.currentPeerId, "surgeon", "latest dispatch must transfer current ownership");
    assert.equal(shardState?.currentStatus, "assigned", "latest dispatch leaves the shard ready for the next worker");
    assert.deepEqual(
      shardState?.history.map((event) => `${event.eventKind}:${event.peerId ?? "unknown"}:${event.status}`),
      [
        "dispatch:architect:assigned",
        "result:architect:completed",
        "dispatch:surgeon:assigned",
      ],
      "canonical memory must preserve the full handoff history",
    );
    console.log("SUCCESS: shard ids stay stable across worker swaps and canonical memory replays the handoff.");

    console.log("\n--- Shard Handoff Contract Verified ---");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
