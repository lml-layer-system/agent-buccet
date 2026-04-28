import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  ENGINE_ACCEPTANCE_CORRIDORS,
  ENGINE_ACCEPTANCE_LANES,
} from "../lib/agent-buccet/agent-comprehension-acceptance.ts";
import { buildBaseAcceptanceSeeds } from "../lib/agent-buccet/base-upl-acceptance.ts";
import {
  ENGINE_PROVIDER_DEFAULTS,
  addTeamEngineSource,
  addTeamRemoteLlmSource,
  createTeam,
  loadTeam,
  teamSlug,
  type EngineSourceConfig,
} from "../lib/agent-buccet/team-workshop.ts";
import {
  buildBuccetSystemContext,
  mapPiToolToBoundaryKind,
  summarizeToolCallForBoundary,
  tryLoadPiBindings,
} from "../lib/agent-buccet/pi-adapter.ts";

/**
 * Pi Engine Contract.
 *
 * Verifies the structural pieces of Buccet's Pi-as-hands integration:
 *
 *  1) The `engine` transport registers cleanly on a team manifest, the
 *     hands are SINGULAR (one engine per team), no Pi internals leak into
 *     the manifest (auth keys never appear).
 *
 *  2) Pi's UPL acceptance corridor is seeded into the base pack at
 *     `ACCEPT.AGENT.SOURCE.ENGINE.PI` with declaratory shape; the actual
 *     gating happens at the per-action lanes (fs.*, tool.exec, network.send,
 *     agent.spend) which the corpus already covers.
 *
 *  3) The adapter's tool-name → boundary action-kind map covers Pi's
 *     standard tools (bash/read/write/edit/grep/glob) and falls through
 *     to `tool.exec` for unknown tools — every dispatch is gated.
 *
 *  4) The system-context builder injects the brain (UBIE), the team
 *     library, the agent profile, and the standing-law reminder; nothing
 *     in the injected context can mutate UPL.
 *
 *  5) Pi packages are PEER deps — `tryLoadPiBindings` returns null when
 *     not installed; the adapter never crashes the substrate.
 */

async function main(): Promise<void> {
  console.log("--- Agent Buccet Pi Engine Contract ---");
  const home = await mkdtemp(path.join(tmpdir(), "buccet-pi-contract-"));
  try {
    const slug = teamSlug("pi-contract-team");
    await createTeam({ homePath: home, name: "pi-contract-team", domain: "contract", summary: "pi engine contract" });

    // ----- 1. Engine source persists; hands are singular ------------------
    await addTeamRemoteLlmSource({ homePath: home, slug, provider: "anthropic" });
    await addTeamEngineSource({ homePath: home, slug, provider: "pi" });

    let denied = false;
    try {
      await addTeamEngineSource({ homePath: home, slug, provider: "pi" });
    } catch {
      denied = true;
    }
    assert.ok(denied, "second engine registration must be denied — hands are singular");

    const manifest = await loadTeam(home, slug);
    assert.ok(manifest, "team manifest loadable");
    const engineSource = manifest!.pathSourceCorpus.find((s) => s.transport === "engine");
    assert.ok(engineSource, "engine source must persist");
    assert.equal(engineSource!.kind, "engine:pi", "engine source kind is engine:pi");
    const engineCfg = engineSource!.engine as EngineSourceConfig;
    assert.equal(engineCfg.provider, "pi", "engine provider is pi");
    assert.equal(
      engineCfg.agentCorePackage,
      ENGINE_PROVIDER_DEFAULTS.pi.agentCorePackage,
      "engine config carries the canonical pi-agent-core package name",
    );
    const engineJson = JSON.stringify(engineSource);
    assert.ok(!/sk-/i.test(engineJson), "engine manifest must not carry key-like material");
    assert.ok(!/Bearer/i.test(engineJson), "engine manifest must not carry bearer auth material");

    console.log("SUCCESS: engine transport persists; hands are singular; no key material leaks.");

    // ----- 2. Pi's acceptance corridor is seeded into the base pack -------
    const seeds = buildBaseAcceptanceSeeds({
      rootPath: home,
      grantedActions: ["fs.read", "fs.write", "fs.delete", "network.send", "tool.exec", "agent.spend", "chat.emit"],
    });

    for (const corridor of ENGINE_ACCEPTANCE_CORRIDORS) {
      const lane = seeds.find((s) => s.id === corridor.id);
      assert.ok(lane, `expected base UPL seed for engine corridor ${corridor.id}`);
      assert.equal(lane!.acceptanceClass, "agent_comprehension", `${corridor.id} sits in the agent_comprehension class`);
      assert.deepEqual(
        lane!.actionKinds,
        ["chat.emit"],
        `${corridor.id} is declaratory (chat.emit) — actual gating happens at per-action lanes`,
      );
    }
    assert.equal(ENGINE_ACCEPTANCE_LANES.length, ENGINE_ACCEPTANCE_CORRIDORS.length, "every corridor has a lane");

    console.log("SUCCESS: Pi engine corridor seeded into base UPL acceptance pack.");

    // ----- 3. Tool-name → boundary action-kind map ------------------------
    assert.equal(mapPiToolToBoundaryKind("bash"), "tool.exec", "bash → tool.exec");
    assert.equal(mapPiToolToBoundaryKind("read"), "fs.read", "read → fs.read");
    assert.equal(mapPiToolToBoundaryKind("write"), "fs.write", "write → fs.write");
    assert.equal(mapPiToolToBoundaryKind("edit"), "fs.write", "edit → fs.write");
    assert.equal(mapPiToolToBoundaryKind("grep"), "fs.read", "grep → fs.read");
    assert.equal(mapPiToolToBoundaryKind("glob"), "fs.read", "glob → fs.read");
    assert.equal(mapPiToolToBoundaryKind("delete"), "fs.delete", "delete → fs.delete");
    assert.equal(mapPiToolToBoundaryKind("fetch"), "network.send", "fetch → network.send");
    assert.equal(mapPiToolToBoundaryKind("UNKNOWN_TOOL"), "tool.exec", "unknown tool falls through to tool.exec — every dispatch gated");

    console.log("SUCCESS: Pi tool-name → boundary action-kind map covers stdlib + falls through to tool.exec.");

    // ----- 4. Payload summary preserves the proposal shape ---------------
    const summary = summarizeToolCallForBoundary({ name: "bash", arguments: { command: "ls /tmp" } });
    assert.ok(summary.includes("pi-tool:bash"), "summary names the tool");
    assert.ok(summary.includes("ls /tmp"), "summary preserves the argument material");

    // ----- 5. System context builder injects brain + library + standing-law
    const ctx = buildBuccetSystemContext({
      manifest: manifest!,
      agent: {
        id: "pi-test",
        title: "Test Agent",
        specialty: "contract testing",
        ownsStep: "all",
        tools: [],
        sourceIds: [],
        spend: { capNormalized: null, spentNormalized: 0 },
      },
      uplTrackSnapDescription: "Standing law: read-only on /tmp, no network.",
    });
    assert.ok(ctx.includes("BRAIN PROTOCOL"), "system context contains brain protocol header");
    assert.ok(ctx.includes("Universal procedural law every agent must run") || ctx.includes("Receive"), "brain protocol body is injected (UBIE)");
    assert.ok(ctx.includes(`TEAM: ${manifest!.name}`), "team identity is injected");
    assert.ok(ctx.includes("LIBRARY (path sources)"), "library section is named");
    assert.ok(ctx.includes("anthropic"), "AI source is enumerated in library section");
    assert.ok(ctx.includes("STANDING LAW"), "standing law (UPL track) is named");
    assert.ok(
      ctx.includes("never mutate UPL") || ctx.includes("NEVER mutate UPL"),
      "the brain is told it can never mutate UPL",
    );
    assert.ok(
      !ctx.includes("engine:pi"),
      "engine source itself is not part of the library injection (Pi is the hands, not knowledge supply)",
    );

    console.log("SUCCESS: system context injects brain, library, and standing-law guardrail.");

    // ----- 6. Pi packages are PEER deps; missing is a graceful null ------
    const bindings = await tryLoadPiBindings();
    assert.equal(bindings, null, "pi packages absent in this contract environment → graceful null");
    console.log("SUCCESS: peer-dep load returns null when Pi is not installed; substrate ships without crashing.");

    console.log("\n--- Pi Engine Contract Verified ---");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
