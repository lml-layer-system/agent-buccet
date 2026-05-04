/**
 * Spend Brain Contract
 *
 * Invariants:
 *   1. buildBuccetSystemContext for a SPEND team injects the value-boundary brain,
 *      not the default Universal Agent Comprehension Process.
 *   2. SPEND system context contains a "same Pi flow, different domain law" note.
 *   3. SPEND system context section headers reflect SPEND class: includes
 *      "SPEND BUCCET" or "domain law" language.
 *   4. Workshop system context contains "Universal Agent Comprehension Process"
 *      and does NOT contain the SPEND note or value-boundary brain.
 *   5. SPEND brain content names "spend packet", "VALUE BOUNDARY", "Commit".
 *   6. Workshop brain content names "Universal Agent Comprehension Process"
 *      and the ten stages.
 *   7. Proof-of-work trace entries for a SPEND team include brain_pass_preflight
 *      with the value-boundary brain id in meta.
 *   8. The create trace CLI output for a SPEND team shows the expected shape
 *      (team slug, kinds present, no crash).
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  SPENDING_AGENT_UBIE_VALUE_BOUNDARY_SOURCE,
  UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE,
} from "./../../src/context/path-memory.ts";
import { buildBuccetSystemContext } from "./../../src/engines/pi/pi-adapter.ts";
import {
  buildProofOfWorkTraceOutput,
  renderProofOfWorkTraceText,
} from "./../../src/proof/create-trace.ts";
import {
  type TeamAgent,
  addTeamAgent,
  addTeamEngineSource,
  addTeamRemoteLlmSource,
  appendTeamPathSourceMemoryEntry,
  createTeam,
  loadTeam,
  readTeamPathSourceMemoryEntries,
  teamSlug,
} from "./../../src/teams/team-workshop.ts";

const cliPath = path.join(process.cwd(), "cli", "buccet.ts");

async function runBuccet(
  args: string[],
  env: Record<string, string>,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

/** Minimal TeamAgent stub for context building. */
function makeAgent(id: string, ownsStep: TeamAgent["ownsStep"]): TeamAgent {
  return {
    id,
    title: id,
    specialty: "contract agent",
    ownsStep,
    sourceIds: [] as string[],
    memoryNotes: undefined as string | undefined,
    tools: [] as string[],
    spend: {
      capNormalized: null as number | null,
      spentNormalized: 0,
    },
  };
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ab-spend-brain-"));
  const env = { AGENT_BUCCET_HOME: tempRoot };

  try {
    // ── Setup: SPEND team and workshop team ───────────────────────────────────────

    const spendSlug = teamSlug("spend-brain-team");
    const _spendManifest = await createTeam({
      homePath: tempRoot,
      name: "spend-brain-team",
      domain: "shopping",
      summary: "Spend brain contract team",
      createdBy: "contract",
      buccetClass: "spend",
    });
    await addTeamRemoteLlmSource({ homePath: tempRoot, slug: spendSlug, provider: "anthropic" });
    await addTeamEngineSource({ homePath: tempRoot, slug: spendSlug, provider: "pi" });
    await addTeamAgent({
      homePath: tempRoot,
      slug: spendSlug,
      agentId: "buyer",
      title: "Buyer Agent",
      specialty: "shopping and procurement",
      ownsStep: "transform",
    });

    const workshopSlug = teamSlug("workshop-brain-team");
    await createTeam({
      homePath: tempRoot,
      name: "workshop-brain-team",
      domain: "research",
      summary: "Workshop brain contract team",
      createdBy: "contract",
    });
    await addTeamRemoteLlmSource({ homePath: tempRoot, slug: workshopSlug, provider: "anthropic" });
    await addTeamEngineSource({ homePath: tempRoot, slug: workshopSlug, provider: "pi" });
    await addTeamAgent({
      homePath: tempRoot,
      slug: workshopSlug,
      agentId: "researcher",
      title: "Researcher",
      specialty: "research",
      ownsStep: "transform",
    });

    // Reload manifests so path-source corpus is current
    const loadedSpend = await loadTeam(tempRoot, spendSlug);
    const loadedWorkshop = await loadTeam(tempRoot, workshopSlug);
    assert.ok(loadedSpend, "spend manifest must load");
    assert.ok(loadedWorkshop, "workshop manifest must load");

    // ── 1. SPEND system context injects value-boundary brain ──────────────────────

    const spendCtx = buildBuccetSystemContext({
      manifest: loadedSpend!,
      agent: makeAgent("buyer", "transform"),
      uplTrackSnapDescription: "UPL corpus label: contract",
    });

    assert.ok(
      spendCtx.includes(SPENDING_AGENT_UBIE_VALUE_BOUNDARY_SOURCE.id) ||
        spendCtx.includes("Spending Agents") ||
        spendCtx.includes("Value Boundary"),
      "SPEND system context must include value-boundary brain content",
    );
    // The value-boundary brain prose names "Universal Agent Comprehension Process" in its
    // own text (it says "this replaces..."). Check for content UNIQUE to the default brain
    // instead — namely its formula and closing statement that don't appear in the spend brain.
    assert.ok(
      !spendCtx.includes("Agenthood is the governed conversion of input"),
      "SPEND system context must NOT contain default workshop brain content (unique formula line)",
    );

    // ── 2. SPEND system context contains 'same Pi flow, different domain law' note ─

    assert.ok(
      spendCtx.includes("same Pi flow") ||
        spendCtx.includes("domain law") ||
        spendCtx.includes("SPEND BUCCET"),
      "SPEND system context must contain same-Pi-flow / domain-law / SPEND BUCCET note",
    );
    assert.ok(
      spendCtx.includes("spend packet") ||
        spendCtx.includes("SpendPacket") ||
        spendCtx.includes("Commit"),
      "SPEND system context must reference spend packet or Commit",
    );

    // ── 3. SPEND brain content has required vocabulary ────────────────────────────

    assert.ok(
      spendCtx.includes("VALUE BOUNDARY") || spendCtx.includes("value boundary"),
      "SPEND system context must name the VALUE BOUNDARY gate",
    );
    assert.ok(
      spendCtx.includes("subscribe"),
      "SPEND system context must include 'subscribe' vocabulary",
    );
    assert.ok(
      spendCtx.includes("exchange"),
      "SPEND system context must include 'exchange' vocabulary",
    );
    assert.ok(
      spendCtx.includes("instruction provenance"),
      "SPEND system context must include 'instruction provenance'",
    );

    // ── 4. Workshop system context uses default brain, no SPEND note ──────────────

    const workshopCtx = buildBuccetSystemContext({
      manifest: loadedWorkshop!,
      agent: makeAgent("researcher", "transform"),
      uplTrackSnapDescription: "UPL corpus label: contract",
    });

    assert.ok(
      workshopCtx.includes("Universal Agent Comprehension Process"),
      "workshop system context must include the default comprehension brain",
    );
    assert.ok(
      !workshopCtx.includes("same Pi flow, different domain law"),
      "workshop system context must NOT contain SPEND domain-law note",
    );
    assert.ok(
      !workshopCtx.includes("No agent.spend action may reach Commit"),
      "workshop system context must NOT contain SPEND commit restriction",
    );
    assert.ok(
      !workshopCtx.includes("VALUE BOUNDARY"),
      "workshop system context must NOT contain VALUE BOUNDARY gate",
    );

    // ── 5. Workshop brain names the ten stages ────────────────────────────────────

    const workshopBrainContent = UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE.content;
    assert.ok(workshopBrainContent.includes("Receive"), "default brain must name Receive stage");
    assert.ok(workshopBrainContent.includes("Return"), "default brain must name Return stage");
    assert.ok(workshopBrainContent.includes("Validate"), "default brain must name Validate stage");

    // ── 6. Proof-of-work trace: SPEND team entries have expected shape ────────────

    await appendTeamPathSourceMemoryEntry({
      homePath: tempRoot,
      slug: spendSlug,
      kind: "brain_pass_preflight",
      title: `brain-pass:${spendSlug}`,
      text: "Pi prepared the whole-view for spend team.",
      meta: {
        brainSourceId: SPENDING_AGENT_UBIE_VALUE_BOUNDARY_SOURCE.id,
        buccetClass: "spend",
        sessionId: "contract-session-1",
      },
    });
    await appendTeamPathSourceMemoryEntry({
      homePath: tempRoot,
      slug: spendSlug,
      kind: "shard_dispatch",
      title: "buyer:transform",
      text: "Dispatching shard to buyer agent for transform.",
      meta: { peerId: "buyer", ownsStep: "transform" },
    });

    const spendRecords = await readTeamPathSourceMemoryEntries(tempRoot, spendSlug);
    assert.ok(spendRecords.length >= 2, "SPEND team must have at least 2 PoW entries");

    const preflight = spendRecords.find((r) => r.kind === "brain_pass_preflight");
    assert.ok(preflight, "SPEND PoW must include brain_pass_preflight entry");
    assert.ok(
      preflight?.meta?.brainSourceId === SPENDING_AGENT_UBIE_VALUE_BOUNDARY_SOURCE.id,
      "brain_pass_preflight meta must reference value-boundary brain id",
    );
    assert.ok(
      preflight?.meta?.buccetClass === "spend",
      "brain_pass_preflight meta must record buccetClass=spend",
    );

    // ── 7. renderProofOfWorkTraceText renders SPEND PoW correctly ─────────────────

    const traceOutput = buildProofOfWorkTraceOutput(spendSlug, spendRecords);
    const traceText = renderProofOfWorkTraceText(traceOutput);
    assert.ok(traceText.includes(spendSlug), "trace must name the spend team slug");
    assert.ok(traceText.includes("brain_pass_preflight"), "trace must show brain_pass_preflight");
    assert.ok(traceText.includes("shard_dispatch"), "trace must show shard_dispatch");
    assert.ok(
      !traceText.includes("No proof-of-work"),
      "SPEND team with entries must not show empty state",
    );

    // ── 8. CLI create trace for SPEND team exits 0 and renders entries ───────────

    const cliTraceResult = await runBuccet(["create", "trace", "spend-brain-team", "--json"], env);
    assert.equal(
      cliTraceResult.code,
      0,
      `CLI create trace must exit 0 for SPEND team; stderr: ${cliTraceResult.stderr}`,
    );
    const cliTraceJson = JSON.parse(cliTraceResult.stdout) as {
      team: string;
      totalEntries: number;
      entries: { kind: string }[];
    };
    assert.equal(cliTraceJson.team, spendSlug, "CLI trace JSON must name the spend team");
    assert.ok(cliTraceJson.totalEntries >= 2, "CLI trace must show at least 2 entries");
    assert.ok(
      cliTraceJson.entries.some((e) => e.kind === "brain_pass_preflight"),
      "CLI trace entries must include brain_pass_preflight",
    );

    console.log("Spend Brain Contract");
    console.log("SPEND system context:            value-boundary brain injected, not default");
    console.log("same Pi flow / domain law note:  present in SPEND system context");
    console.log("VALUE BOUNDARY in context:       present");
    console.log("'subscribe' + 'exchange' vocab:  present in SPEND system context");
    console.log("workshop system context:         default brain, no SPEND note, no VALUE BOUNDARY");
    console.log(
      "SPEND PoW entries:               brain_pass_preflight has brainSourceId + buccetClass",
    );
    console.log("renderProofOfWorkTraceText:      renders slug, kinds, no empty state");
    console.log("CLI create trace (SPEND):        exits 0, JSON has preflight entry");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
