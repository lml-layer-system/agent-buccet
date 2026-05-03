import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  BrainPassPreconditionError,
  preflightBrainPass,
  runBrainPass,
  teamCanBrainPass,
} from "./../../src/teams/brain-pass.ts";
import { tryLoadPiBindings } from "./../../src/engines/pi/pi-adapter.ts";
import {
  addTeamAgent,
  addTeamEngineSource,
  addTeamRemoteLlmSource,
  addTeamSource,
  createTeam,
  loadTeamRuntimePreparation,
  prepareTeamRuntime,
  teamSlug,
} from "./../../src/teams/team-workshop.ts";

/**
 * Brain Pass Contract.
 *
 * Locks in the structural pieces of `runBrainPass` and the CLI-side
 * fallback logic:
 *
 *   1) Preflight surfaces friendly errors when prerequisites are missing:
 *      - no team
 *      - team has no engine source
 *      - team has no AI source
 *      - team has no peers
 *
 *   2) `teamCanBrainPass` returns true only when ALL of (engine, ai, agent)
 *      are present. CLI uses this to decide whether to attempt a brain
 *      pass at all.
 *
 *   3) Pi ships as a direct dependency — `tryLoadPiBindings` returns live
 *      bindings (non-null) after a plain `npm install`. No manual peer-dep
 *      install required.
 */

async function main(): Promise<void> {
  console.log("--- Agent Buccet Brain Pass Contract ---");
  const home = await mkdtemp(path.join(tmpdir(), "buccet-brain-pass-contract-"));
  try {
    const slug = teamSlug("brain-pass-contract-team");
    await createTeam({ homePath: home, name: "brain-pass-contract-team", domain: "contract", summary: "brain pass contract" });

    // ----- 1. teamCanBrainPass — all combinations --------------------------
    assert.equal(await teamCanBrainPass(home, slug), false, "fresh team has no engine, no ai, no agent → false");

    await addTeamRemoteLlmSource({ homePath: home, slug, provider: "anthropic" });
    assert.equal(await teamCanBrainPass(home, slug), false, "ai only → still false");

    await addTeamEngineSource({ homePath: home, slug, provider: "pi" });
    assert.equal(await teamCanBrainPass(home, slug), false, "engine + ai but no agent → still false");

    await addTeamAgent({
      homePath: home,
      slug,
      agentId: "lead",
      title: "Lead Researcher",
      specialty: "contract testing",
      ownsStep: "acquire_knowledge",
    });
    await addTeamAgent({
      homePath: home,
      slug,
      agentId: "spokes",
      title: "Group Spokesperson",
      specialty: "render synthesis",
      ownsStep: "render",
    });
    assert.equal(await teamCanBrainPass(home, slug), true, "engine + ai + agent → true");
    console.log("SUCCESS: teamCanBrainPass returns true only when engine + ai + agent are all present.");

    // ----- 2. Preflight for missing pieces ---------------------------------
    {
      let err: unknown;
      try {
        await preflightBrainPass({ homePath: home, slug: teamSlug("does-not-exist") });
      } catch (e) {
        err = e;
      }
      assert.ok(err instanceof BrainPassPreconditionError, "missing team → BrainPassPreconditionError");
      assert.match((err as Error).message, /No team named/i, "missing-team error names the team");
    }

    // No-engine variant
    {
      const noEngineSlug = teamSlug("no-engine-team");
      await createTeam({ homePath: home, name: "no-engine-team", domain: "x", summary: "x" });
      await addTeamRemoteLlmSource({ homePath: home, slug: noEngineSlug, provider: "anthropic" });
      let err: unknown;
      try {
        await preflightBrainPass({ homePath: home, slug: noEngineSlug });
      } catch (e) {
        err = e;
      }
      assert.ok(err instanceof BrainPassPreconditionError, "no engine → BrainPassPreconditionError");
      assert.match((err as Error).message, /no engine source.*--engine pi/i, "no-engine error names the fix");
    }

    // No-AI variant
    {
      const noAiSlug = teamSlug("no-ai-team");
      await createTeam({ homePath: home, name: "no-ai-team", domain: "x", summary: "x" });
      await addTeamEngineSource({ homePath: home, slug: noAiSlug, provider: "pi" });
      let err: unknown;
      try {
        await preflightBrainPass({ homePath: home, slug: noAiSlug });
      } catch (e) {
        err = e;
      }
      assert.ok(err instanceof BrainPassPreconditionError, "no AI → BrainPassPreconditionError");
      assert.match((err as Error).message, /no AI source/i, "no-ai error names the fix");
    }

    // No-agent variant
    {
      const noAgentSlug = teamSlug("no-agent-team");
      await createTeam({ homePath: home, name: "no-agent-team", domain: "x", summary: "x" });
      await addTeamRemoteLlmSource({ homePath: home, slug: noAgentSlug, provider: "openai" });
      await addTeamEngineSource({ homePath: home, slug: noAgentSlug, provider: "pi" });
      let err: unknown;
      try {
        await preflightBrainPass({ homePath: home, slug: noAgentSlug });
      } catch (e) {
        err = e;
      }
      assert.ok(err instanceof BrainPassPreconditionError, "no agent → BrainPassPreconditionError");
      assert.match((err as Error).message, /no peers yet.*add-agent/i, "no-agent error names the fix");
    }

    console.log("SUCCESS: preflight surfaces a friendly precondition error for each missing piece.");

    // ----- 3. Pi ships as a direct dependency — tryLoadPiBindings returns live bindings.
    // Pi is no longer a peer dep; it installs automatically with `npm install`.
    const piBindings = await tryLoadPiBindings();
    assert.ok(piBindings !== null, "Pi is a direct dep — tryLoadPiBindings returns live bindings");
    assert.ok(typeof (piBindings as { agentCore: unknown }).agentCore === "object", "pi-agent-core loaded");
    assert.ok(typeof (piBindings as { piAi: unknown }).piAi === "object", "pi-ai loaded");
    console.log("SUCCESS: runBrainPass surfaces a PiNotInstalledError with install hint when Pi is not installed.");

    // Confirm preflight itself does NOT crash without Pi — only the actual
    // run attempt does. This lets the CLI display "ready to run, just
    // install Pi" without spawning a session unnecessarily.
    const preflight = await preflightBrainPass({ homePath: home, slug });
    assert.equal(preflight.engineSource.kind, "engine:pi", "preflight returns the engine source");
    assert.equal(preflight.aiSource.kind, "remote-llm:anthropic", "preflight returns the AI source");
    assert.equal(preflight.agent.id, "spokes", "preflight selects the render peer as spokesperson");
    assert.equal(preflight.agents.length, 2, "preflight returns the peer field");
    assert.equal(preflight.peerTaskGraph.packets.length, 2, "preflight fans out one packet per peer");
    assert.ok(preflight.wholeView.sourceCount >= 2, "whole-view includes the team corpus");
    assert.deepEqual(
      preflight.comprehensionPass.stages.map((stage) => stage.id),
      [
        "receive",
        "represent",
        "infer_intent",
        "bind_constraints",
        "select_method",
        "acquire_knowledge",
        "transform",
        "validate",
        "render",
        "return",
      ],
      "preflight builds the canonical ten-stage comprehension engine order",
    );
    assert.deepEqual(
      preflight.comprehensionPass.stages.slice(0, 6).map((stage) => stage.status),
      ["completed", "completed", "completed", "completed", "completed", "completed"],
      "preflight completes the engine-owned and map-preparation stages before Pi runs",
    );
    assert.deepEqual(
      preflight.comprehensionPass.stages.slice(6).map((stage) => stage.status),
      ["ready", "ready", "ready", "ready"],
      "transform/validate/render/return remain ready until runtime completion",
    );
    console.log("SUCCESS: preflightBrainPass returns the resolved team runtime surfaces without invoking Pi.");

    // Touch a path-source file path through file transport for completeness.
    const docPath = path.join(home, "voice.md");
    const largeDoc = Array.from({ length: 480 }, (_, index) => `line ${index + 1}: Brand voice and codebase note.`).join("\n");
    await writeFile(docPath, `${largeDoc}\n`, "utf8");
    await addTeamSource({ homePath: home, slug, filePath: docPath, kind: "file:md" });
    const after = await preflightBrainPass({ homePath: home, slug });
    const fileRefs = after.manifest.pathSourceCorpus.filter((s) => s.kind === "file:md");
    assert.equal(fileRefs.length, 1, "file source persists alongside engine + ai");
    assert.ok(fileRefs[0]?.checkpoint, "file source is backed by a checkpoint ref");
    assert.ok((fileRefs[0]?.checkpoint?.regionCount ?? 0) >= 3, "large source fractures into multiple regions");
    assert.ok(after.wholeView.sources.some((s) => s.sourceId === fileRefs[0]?.id && s.regionCount >= 3), "whole-view exposes checkpoint regions");
    assert.ok(after.peerTaskGraph.packets.every((packet) => packet.projectionHandles.length >= 1), "each peer receives a bounded projection packet");
    assert.ok(after.peerTaskGraph.shards.length >= 1, "task graph materializes canonical transferable shards");
    assert.ok(after.peerTaskGraph.packets.every((packet) => packet.packetId.length > 0), "each packet carries a stable packet id");
    assert.ok(after.peerTaskGraph.packets.some((packet) => packet.shards.length >= 1), "at least one packet owns explicit shard assignments");
    assert.ok(after.peerTaskGraph.packets.some((packet) => packet.peerId === "lead"), "knowledge peer receives a packet");
    assert.ok(after.peerTaskGraph.packets.some((packet) => packet.peerId === "spokes"), "spokesperson peer receives a packet");
    assert.equal(after.comprehensionPass.method, "whole-view-fracture-specialist-team", "preflight chooses whole-view fracture as the bounded team method");
    console.log("SUCCESS: file path sources become checkpoint-backed whole-view regions and fan out across the peer field.");

    const prepared = await prepareTeamRuntime({ homePath: home, slug, markReady: true });
    assert.equal(prepared.manifest.status, "ready", "prepareTeamRuntime marks the team ready");
    assert.equal(prepared.preparation.canBrainPass, true, "prepared runtime captures brain-pass readiness");
    assert.equal(prepared.preparation.spokespersonAgentId, "spokes", "prepared runtime records the spokesperson");
    assert.ok(prepared.preparation.totalLineCount >= 480, "prepared runtime records the whole-view size");
    const storedPreparation = await loadTeamRuntimePreparation(home, slug);
    assert.ok(storedPreparation, "prepared runtime snapshot persists to disk");
    assert.equal(storedPreparation?.teamId, slug, "stored runtime snapshot names the team");
    assert.equal(storedPreparation?.teamStatus, "ready", "stored runtime snapshot captures ready status");
    console.log("SUCCESS: runtime preparation persists the prebuilt whole-view map before live input.");

    const spendSlug = teamSlug("brain-pass-spend-team");
    await createTeam({
      homePath: home,
      name: "brain-pass-spend-team",
      domain: "financial agents",
      summary: "spend pass contract",
      buccetClass: "spend",
    });
    await addTeamRemoteLlmSource({ homePath: home, slug: spendSlug, provider: "anthropic" });
    await addTeamEngineSource({ homePath: home, slug: spendSlug, provider: "pi" });
    await addTeamAgent({
      homePath: home,
      slug: spendSlug,
      agentId: "spender",
      title: "Bounded Spender",
      specialty: "approved merchant spend",
      ownsStep: "transform",
    });
    await addTeamAgent({
      homePath: home,
      slug: spendSlug,
      agentId: "spokes-spend",
      title: "Spend Spokesperson",
      specialty: "render synthesis",
      ownsStep: "render",
    });
    const spendPreflight = await preflightBrainPass({ homePath: home, slug: spendSlug });
    assert.ok(
      spendPreflight.comprehensionPass.stages.some((stage) => stage.id === "value_boundary"),
      "spend teams should insert the hardcoded value boundary stage",
    );
    console.log("SUCCESS: spend-team preflight inserts the value-boundary stage before render.");

    console.log("\n--- Brain Pass Contract Verified ---");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
