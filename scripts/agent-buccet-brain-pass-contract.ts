import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  BrainPassPreconditionError,
  preflightBrainPass,
  runBrainPass,
  teamCanBrainPass,
} from "../lib/agent-buccet/brain-pass.ts";
import { PiNotInstalledError } from "../lib/agent-buccet/pi-adapter.ts";
import {
  addTeamAgent,
  addTeamEngineSource,
  addTeamRemoteLlmSource,
  addTeamSource,
  createTeam,
  teamSlug,
} from "../lib/agent-buccet/team-workshop.ts";

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
 *   3) When all preflight passes but Pi is not installed (peer dep
 *      missing), `runBrainPass` throws `PiNotInstalledError` with an
 *      install hint in the message. The CLI catches this and falls back
 *      to the message-queue ack (covered in the CLI smoke test).
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
      ownsStep: "all",
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

    // ----- 3. Fully-configured team but Pi not installed → PiNotInstalledError
    // (Pi packages are peer deps and intentionally absent from this contract env.)
    let err: unknown;
    try {
      await runBrainPass({
        homePath: home,
        slug,
        userRequest: "ping",
      });
    } catch (e) {
      err = e;
    }
    assert.ok(err instanceof PiNotInstalledError, "Pi peer-dep absent → PiNotInstalledError");
    const msg = (err as Error).message;
    assert.match(msg, /not installed/i, "install hint mentions not installed");
    assert.match(msg, /@mariozechner\/pi-agent-core/, "install hint names the canonical Pi package");
    assert.match(msg, /@mariozechner\/pi-ai/, "install hint names the canonical pi-ai package");
    console.log("SUCCESS: runBrainPass surfaces a PiNotInstalledError with install hint when Pi is not installed.");

    // Confirm preflight itself does NOT crash without Pi — only the actual
    // run attempt does. This lets the CLI display "ready to run, just
    // install Pi" without spawning a session unnecessarily.
    const preflight = await preflightBrainPass({ homePath: home, slug });
    assert.equal(preflight.engineSource.kind, "engine:pi", "preflight returns the engine source");
    assert.equal(preflight.aiSource.kind, "remote-llm:anthropic", "preflight returns the AI source");
    assert.equal(preflight.agent.id, "lead", "preflight returns the target agent");
    console.log("SUCCESS: preflightBrainPass returns the resolved triple without invoking Pi.");

    // Touch a path-source file path through file transport for completeness.
    const docPath = path.join(home, "voice.md");
    await writeFile(docPath, "# Brand voice\n", "utf8");
    await addTeamSource({ homePath: home, slug, filePath: docPath, kind: "file:md" });
    const after = await preflightBrainPass({ homePath: home, slug });
    const fileRefs = after.manifest.pathSourceCorpus.filter((s) => s.kind === "file:md");
    assert.equal(fileRefs.length, 1, "file source persists alongside engine + ai");

    console.log("\n--- Brain Pass Contract Verified ---");
  } finally {
    await rm(home, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
