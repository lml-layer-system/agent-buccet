/**
 * Brain Pass — the runtime loop for a Buccet team.
 *
 *   user input
 *      │
 *      ▼
 *   PI (engine path source, hands)
 *      │ packages: input + brain protocol (UBIE) + library + UPL track snap
 *      ▼
 *   AI / LLM (path source, the brain reasoner)
 *      │ runs UBIE; proposes actions
 *      ▼
 *   for each proposed action:
 *      Pi.beforeToolCall ──► enforceBoundaryProposal (UPL boundary)
 *         allow → Pi executes → afterToolCall → ledger witness → result back to AI
 *         deny  → { block, reason } → AI proposes lawful alternative or escalates
 *      ▼
 *   final answer or refusal → chat.emit (creative-side label) → operator
 *
 * `runBrainPass` is the thin orchestrator. It:
 *   1) loads the team manifest, resolves the engine source + AI source +
 *      target agent
 *   2) bootstraps a persistent boundary session for the run
 *   3) constructs a Pi `Agent` instance via the adapter (all hooks wired)
 *   4) calls `agent.prompt(userRequest)` and surfaces events to the caller
 *   5) ends the session cleanly so the ledger trail is complete
 *
 * Pi (`@mariozechner/pi-agent-core` + `@mariozechner/pi-ai`) is a PEER
 * dependency. If it's not installed, `runBrainPass` surfaces a friendly
 * install hint and lets the caller fall back to the message-queue ack.
 */

import path from "node:path";

import {
  type TeamPeerTaskGraph,
  type TeamPeerTaskPacket,
  type TeamWholeView,
  buildTeamPeerTaskGraph,
  buildTeamWholeView,
  renderProjectionBundle,
} from "./../context/path-source-checkpoints.ts";
import {
  PiNotInstalledError,
  buildBuccetGovernedPiAgent,
  tryLoadPiBindings,
} from "./../engines/pi/pi-adapter.ts";
import { syncTeamSpendBoundaryProofOfWork } from "./../proof/spend-boundary-proof.ts";
import {
  endPersistentBoundarySession,
  startPersistentBoundarySession,
} from "./../runtime/state.ts";
import type { BoundaryActionKind } from "./../runtime/types.ts";
import {
  type AgentComprehensionPass,
  buildInitialComprehensionPass,
  recordComprehensionRender,
  recordComprehensionReturn,
  recordComprehensionTransform,
  recordComprehensionValidation,
  recordComprehensionValueBoundary,
  renderComprehensionPassForPrompt,
} from "./agent-comprehension-engine.ts";
import {
  type CoherenceAdjudication,
  adjudicateMultiAgentCoherence,
  renderCoherenceGateReport,
} from "./coherence-adjudication.ts";
import {
  type TeamAgent,
  type TeamManifest,
  type TeamSlug,
  type TeamSourceRef,
  appendTeamPathSourceMemoryEntry,
  ensureTeamWorkMemorySource,
  loadTeam,
} from "./team-workshop.ts";

export type BrainPassEvent =
  | { type: "session_started"; sessionId: string; aiProvider: string; engineProvider: string }
  | { type: "rendering"; chunk: string }
  | { type: "completed"; output: string }
  | { type: "session_ended"; sessionId: string; reason: string };

export type RunBrainPassArgs = {
  homePath: string;
  slug: TeamSlug;
  agentId?: string;
  userRequest: string;
  onEvent?: (event: BrainPassEvent) => void;
};

export type RunBrainPassResult = {
  sessionId: string;
  output: string;
  events: BrainPassEvent[];
  manifest: TeamManifest;
  agent: TeamAgent;
  agents: TeamAgent[];
  wholeView: TeamWholeView;
  peerTaskGraph: TeamPeerTaskGraph;
  comprehensionPass: AgentComprehensionPass;
  peerResults: BrainPassPeerResult[];
  coherence: CoherenceAdjudication;
};

const _PI_RUN_GRANTED_ACTIONS: BoundaryActionKind[] = [
  "fs.read",
  "fs.write",
  "fs.append",
  "fs.delete",
  "fs.mkdir",
  "fs.move",
  "tool.exec",
  "network.send",
  "agent.spend",
  "chat.emit",
];

export class BrainPassPreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrainPassPreconditionError";
  }
}

export type BrainPassPreflight = {
  manifest: TeamManifest;
  engineSource: TeamSourceRef;
  aiSource: TeamSourceRef;
  agent: TeamAgent;
  agents: TeamAgent[];
  wholeView: TeamWholeView;
  peerTaskGraph: TeamPeerTaskGraph;
  comprehensionPass: AgentComprehensionPass;
};

export type BrainPassPeerResult = {
  packetId: string;
  peerId: string;
  specialty: string;
  ownsStep: string;
  sourceIds: string[];
  shardIds: string[];
  projectionCount: number;
  output: string;
  status: "completed" | "blocked";
  resultKind?: string;
  proposedDisposition?: string;
};

/**
 * Resolve the team's engine source, AI source, and target agent. Throws
 * a `BrainPassPreconditionError` with a friendly message when something
 * is missing — callers (CLI) print the message and fall back to the
 * existing message-queue ack.
 */
export async function preflightBrainPass(args: {
  homePath: string;
  slug: TeamSlug;
  agentId?: string;
  userRequest?: string;
}): Promise<BrainPassPreflight> {
  let manifest = await loadTeam(args.homePath, args.slug);
  if (!manifest) {
    throw new BrainPassPreconditionError(`No team named "${args.slug}".`);
  }
  manifest = (
    await ensureTeamWorkMemorySource({
      homePath: args.homePath,
      manifest,
    })
  ).manifest;

  const engineSource = manifest.pathSourceCorpus.find((s) => s.transport === "engine");
  if (!engineSource) {
    throw new BrainPassPreconditionError(
      `Team "${args.slug}" has no engine source — no hands. ` +
        `Register Pi with: \`buccet create add-source ${args.slug} --engine pi\`.`,
    );
  }

  const aiSource = manifest.pathSourceCorpus.find(
    (s) => s.transport === "remote-llm" || s.transport === "local-llm",
  );
  if (!aiSource) {
    throw new BrainPassPreconditionError(
      `Team "${args.slug}" has no AI source — the brain has no LLM. ` +
        `Register one with e.g. \`buccet create add-source ${args.slug} --remote anthropic\` ` +
        `or \`buccet create add-source ${args.slug} --local ollama --model llama3:8b\`.`,
    );
  }

  if (manifest.agents.length === 0) {
    throw new BrainPassPreconditionError(
      `Team "${args.slug}" has no peers yet. ` +
        `Add one with: \`buccet create add-agent ${args.slug} --name <id> --specialty "<text>"\`.`,
    );
  }

  let agents = manifest.agents.slice();
  if (args.agentId) {
    const selected = manifest.agents.find((entry) => entry.id === args.agentId) ?? null;
    if (!selected) {
      throw new BrainPassPreconditionError(`Team "${args.slug}" has no peer "${args.agentId}".`);
    }
    agents = [selected];
  }

  const wholeView = await buildTeamWholeView({
    homePath: args.homePath,
    manifest,
  });
  const peerTaskGraph = await buildTeamPeerTaskGraph({
    homePath: args.homePath,
    manifest,
    wholeView,
    userRequest: args.userRequest ?? "",
    agents,
  });
  const agent = selectSpokespersonAgent(agents);
  const comprehensionPass = buildInitialComprehensionPass({
    teamId: manifest.slug,
    requestedBy: `team-run:${manifest.slug}`,
    userRequest: args.userRequest ?? "",
    wholeViewPrepared: true,
    sourceCount: wholeView.sourceCount,
    checkpointedSourceCount: wholeView.checkpointedSourceCount,
    totalLineCount: wholeView.totalLineCount,
    packetCount: peerTaskGraph.packets.length,
    projectionCount: peerTaskGraph.packets.reduce(
      (sum, packet) => sum + packet.projectionHandles.length,
      0,
    ),
    spokespersonAgentId: agent.id,
    valueBoundaryRequired: manifest.buccetClass === "spend",
    peers: agents.map((entry) => ({
      id: entry.id,
      specialty: entry.specialty,
      ownsStep: entry.ownsStep,
    })),
  });

  return {
    manifest,
    engineSource,
    aiSource,
    agent,
    agents,
    wholeView,
    peerTaskGraph,
    comprehensionPass,
  };
}

function aiProviderLabel(source: TeamSourceRef): string {
  return (
    (source.remote?.provider as string | undefined) ??
    (source.local?.provider as string | undefined) ??
    "unknown"
  );
}

function extractTextOutput(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map(extractTextOutput)
      .filter((s) => s.length > 0)
      .join("\n");
  }
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (typeof v.text === "string") return v.text;
    if (typeof v.content === "string") return v.content;
    if (typeof v.output === "string") return v.output;
    if (typeof v.result === "string") return v.result;
    if (Array.isArray(v.messages)) {
      return v.messages
        .map((m) => {
          const mm = m as Record<string, unknown>;
          if (typeof mm.content === "string") return mm.content;
          return extractTextOutput(mm.content);
        })
        .filter((s) => s.length > 0)
        .join("\n");
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Run a single brain pass through Pi for a team. Returns the rendered
 * output along with the streamed events.
 *
 * If Pi is not installed (peer dep missing), throws `PiNotInstalledError`
 * — caller can catch and surface the install hint, then fall back to the
 * existing message-queue ack.
 */
export async function runBrainPass(args: RunBrainPassArgs): Promise<RunBrainPassResult> {
  let {
    manifest,
    engineSource,
    aiSource,
    agent,
    agents,
    wholeView,
    peerTaskGraph,
    comprehensionPass: initialComprehensionPass,
  } = await preflightBrainPass({
    homePath: args.homePath,
    slug: args.slug,
    agentId: args.agentId,
    userRequest: args.userRequest,
  });

  const bindings = await tryLoadPiBindings();
  if (!bindings) {
    throw new PiNotInstalledError();
  }

  const events: BrainPassEvent[] = [];
  const emit = (e: BrainPassEvent) => {
    events.push(e);
    args.onEvent?.(e);
  };

  const sessionId = `team:${manifest.slug}:run:${Date.now()}`;
  const actorId = `team-run:${manifest.slug}`;
  const sessionsDir = path.join(args.homePath, "sessions");

  const config = await startPersistentBoundarySession({
    sessionId,
    actorId,
    teamSlug: manifest.slug,
    teamBuccetClass: manifest.buccetClass === "spend" ? "spend" : "workshop",
    approvalRequiredFor: [],
    sessionsDir,
  });

  const aiProvider = aiProviderLabel(aiSource);
  emit({
    type: "session_started",
    sessionId,
    aiProvider,
    engineProvider: (engineSource.engine?.provider as string | undefined) ?? "pi",
  });

  let output = "";
  const peerResults: BrainPassPeerResult[] = [];
  let comprehensionPass = initialComprehensionPass;
  let coherence: CoherenceAdjudication = adjudicateMultiAgentCoherence({
    peers: [],
    userRequest: args.userRequest,
  });
  const appendWorkRecord = async (
    kind: string,
    title: string,
    text: string,
    meta?: Record<string, unknown>,
  ): Promise<void> => {
    const appended = await appendTeamPathSourceMemoryEntry({
      homePath: args.homePath,
      slug: args.slug,
      kind,
      title,
      text,
      meta,
    });
    manifest = appended.manifest;
  };
  const syncSpendProof = async (): Promise<void> => {
    if (manifest.buccetClass !== "spend") {
      return;
    }
    const mirrored = await syncTeamSpendBoundaryProofOfWork({
      homePath: args.homePath,
      slug: args.slug,
      sessionId,
    });
    if (mirrored.manifest) {
      manifest = mirrored.manifest;
    }
    if (mirrored.latestDecision) {
      comprehensionPass = recordComprehensionValueBoundary(comprehensionPass, {
        blocked: mirrored.latestDecision.decision !== "allow",
        disposition: mirrored.latestDecision.decision ?? "pending",
        reasons: [mirrored.latestDecision.reason],
      });
    }
  };
  try {
    await appendWorkRecord(
      "brain_pass_preflight",
      `brain-pass:${manifest.slug}`,
      "Pi prepared the whole-view, fracture graph, and comprehension engine before live reasoning.",
      {
        sessionId,
        agent: agent.id,
        aiProvider,
        engineProvider: (engineSource.engine?.provider as string | undefined) ?? "pi",
        wholeView: {
          sourceCount: wholeView.sourceCount,
          checkpointedSourceCount: wholeView.checkpointedSourceCount,
          totalLineCount: wholeView.totalLineCount,
          totalCharCount: wholeView.totalCharCount,
        },
        comprehensionPass,
        packets: peerTaskGraph.packets.map((packet) => ({
          packetId: packet.packetId,
          peerId: packet.peerId,
          ownsStep: packet.ownsStep,
          sourceIds: packet.sourceIds,
          shardIds: packet.shards.map((shard) => shard.shardId),
          projectionCount: packet.projectionHandles.length,
          taskSlice: packet.taskSlice,
        })),
        shardCount: peerTaskGraph.shards.length,
      },
    );
    for (const packet of peerTaskGraph.packets) {
      const peerAgent = agents.find((entry) => entry.id === packet.peerId);
      if (!peerAgent) continue;
      await appendWorkRecord(
        "shard_dispatch",
        `${peerAgent.id}:${packet.ownsStep}`,
        packet.taskSlice,
        {
          peerId: packet.peerId,
          packetId: packet.packetId,
          specialty: packet.specialty,
          ownsStep: packet.ownsStep,
          sourceIds: packet.sourceIds,
          shardIds: packet.shards.map((shard) => shard.shardId),
          shards: packet.shards,
          allowedOutputs: packet.allowedOutputs,
          allowedActionKinds: packet.allowedActionKinds,
          projectionHandles: packet.projectionHandles,
          constraints: packet.constraints,
        },
      );
      const projectionBundle = await renderProjectionBundle({
        homePath: args.homePath,
        slug: args.slug,
        manifest,
        packet,
      });
      const built = await buildBuccetGovernedPiAgent({
        config,
        manifest,
        agent: peerAgent,
        engineSource,
        aiSource,
        uplTrackSnapDescription: `UPL track snap taken at ${manifest.uplTrackSnap.takenAt}; live system UPL applies (allow/deny adjudicates every Pi tool dispatch).`,
      });
      const result = await built.promptFn(
        buildPeerPrompt({
          userRequest: args.userRequest,
          packet,
          wholeView,
          comprehensionPass,
          projectionBundle,
        }),
      );
      await syncSpendProof();
      const peerOutput = extractTextOutput(result).trim() || "(peer returned empty output)";
      peerResults.push({
        packetId: packet.packetId,
        peerId: peerAgent.id,
        specialty: peerAgent.specialty,
        ownsStep: peerAgent.ownsStep,
        sourceIds: packet.sourceIds,
        shardIds: packet.shards.map((shard) => shard.shardId),
        projectionCount: packet.projectionHandles.length,
        output: peerOutput,
        status: "completed",
        resultKind: extractTaggedScalar(peerOutput, "result_kind") ?? undefined,
        proposedDisposition: extractTaggedScalar(peerOutput, "proposed_disposition") ?? undefined,
      });
      await appendWorkRecord("peer_result", `${peerAgent.id}:${packet.ownsStep}`, peerOutput, {
        peerId: peerAgent.id,
        packetId: packet.packetId,
        specialty: peerAgent.specialty,
        ownsStep: peerAgent.ownsStep,
        sourceIds: packet.sourceIds,
        shardIds: packet.shards.map((shard) => shard.shardId),
        shards: packet.shards,
        projectionCount: packet.projectionHandles.length,
        status: "completed",
        resultKind: extractTaggedScalar(peerOutput, "result_kind") ?? undefined,
        proposedDisposition: extractTaggedScalar(peerOutput, "proposed_disposition") ?? undefined,
      });
    }

    comprehensionPass = recordComprehensionTransform(comprehensionPass, {
      peerSummaries: peerResults.map((peer) => ({
        peerId: peer.peerId,
        ownsStep: peer.ownsStep,
        resultKind: peer.resultKind,
        status: peer.status,
      })),
    });
    coherence = adjudicateMultiAgentCoherence({
      peers: peerResults,
      userRequest: args.userRequest,
    });
    await appendWorkRecord(
      "coherence_adjudication",
      `coherence:${coherence.disposition}`,
      coherence.reasons.join("\n"),
      {
        disposition: coherence.disposition,
        truthCoherent: coherence.truthCoherent,
        intentCoherent: coherence.intentCoherent,
        executionCoherent: coherence.executionCoherent,
        finalizationBlocked: coherence.finalizationBlocked,
        dissentBeatsMajority: coherence.dissentBeatsMajority,
        selectedPeerIds: coherence.selectedPeerIds,
        rejectedPeerIds: coherence.rejectedPeerIds,
      },
    );
    comprehensionPass = recordComprehensionValidation(comprehensionPass, {
      disposition: coherence.disposition,
      truthCoherent: coherence.truthCoherent,
      intentCoherent: coherence.intentCoherent,
      executionCoherent: coherence.executionCoherent,
      reasons: coherence.reasons,
      finalizationBlocked: coherence.finalizationBlocked,
    });

    if (coherence.finalizationBlocked) {
      output = renderCoherenceGateReport({
        userRequest: args.userRequest,
        adjudication: coherence,
      });
      comprehensionPass = recordComprehensionRender(comprehensionPass, {
        blocked: true,
        spokesperson: agent.id,
        outputPreview: output.slice(0, 240),
      });
      comprehensionPass = recordComprehensionReturn(comprehensionPass, {
        blocked: true,
        outputPreview: output.slice(0, 240),
      });
      await appendWorkRecord("pi_return", `return:${coherence.disposition}`, output, {
        blocked: true,
        spokesperson: agent.id,
        comprehensionPass,
      });
      emit({ type: "completed", output });
    } else {
      const built = await buildBuccetGovernedPiAgent({
        config,
        manifest,
        agent,
        engineSource,
        aiSource,
        uplTrackSnapDescription: `UPL track snap taken at ${manifest.uplTrackSnap.takenAt}; live system UPL applies (allow/deny adjudicates every Pi tool dispatch).`,
      });
      const result = await built.promptFn(
        buildReconcilePrompt({
          userRequest: args.userRequest,
          wholeView,
          peerResults,
          coherence,
          comprehensionPass,
        }),
      );
      await syncSpendProof();
      output = extractTextOutput(result).trim();
      if (output.length === 0) {
        output = "(brain pass returned empty output)";
      }
      comprehensionPass = recordComprehensionRender(comprehensionPass, {
        blocked: false,
        spokesperson: agent.id,
        outputPreview: output.slice(0, 240),
      });
      comprehensionPass = recordComprehensionReturn(comprehensionPass, {
        blocked: false,
        outputPreview: output.slice(0, 240),
      });
      await appendWorkRecord("pi_return", "return:completed", output, {
        blocked: false,
        spokesperson: agent.id,
        comprehensionPass,
      });
      emit({ type: "completed", output });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await syncSpendProof();
      await appendWorkRecord("brain_pass_failure", "brain-pass failed", message, {
        sessionId,
        agent: agent.id,
      });
    } catch {
      // Persistence failure must not mask the original error.
    }
    throw error;
  } finally {
    try {
      await endPersistentBoundarySession({
        config,
        endedBy: actorId,
        reason: `brain pass completed for ${manifest.slug}/${agent.id}`,
      });
    } catch {
      // Closing the session must never mask the original error.
    }
    emit({ type: "session_ended", sessionId, reason: "brain pass complete" });
  }

  return {
    sessionId,
    output,
    events,
    manifest,
    agent,
    agents,
    wholeView,
    peerTaskGraph,
    comprehensionPass,
    peerResults,
    coherence,
  };
}

/**
 * Lightweight check used by CLI entry points to decide whether to attempt
 * a brain pass at all. Returns true only if the team has both an engine
 * source and an AI source registered. Pi-not-installed is detected later
 * inside `runBrainPass` so the install hint surfaces with full context.
 */
export async function teamCanBrainPass(homePath: string, slug: TeamSlug): Promise<boolean> {
  const manifest = await loadTeam(homePath, slug);
  if (!manifest) return false;
  const hasEngine = manifest.pathSourceCorpus.some((s) => s.transport === "engine");
  const hasAi = manifest.pathSourceCorpus.some(
    (s) => s.transport === "remote-llm" || s.transport === "local-llm",
  );
  const hasAgent = manifest.agents.length > 0;
  return hasEngine && hasAi && hasAgent;
}

function selectSpokespersonAgent(agents: TeamAgent[]): TeamAgent {
  return (
    agents.find((entry) => entry.ownsStep === "render") ??
    agents.find((entry) => entry.ownsStep === "return") ??
    agents.find((entry) => entry.ownsStep === "all") ??
    agents[0]
  );
}

function formatWholeView(wholeView: TeamWholeView): string {
  const lines: string[] = [
    `Team whole-view: ${wholeView.sourceCount} sources, ${wholeView.checkpointedSourceCount} checkpointed, ${wholeView.totalLineCount} lines, ${wholeView.totalCharCount} chars.`,
  ];
  for (const source of wholeView.sources) {
    lines.push(
      `- ${source.sourceId} · ${source.title} · ${source.kind} · ${source.lineCount} lines · ${source.regionCount} regions`,
    );
  }
  return lines.join("\n");
}

function buildPeerPrompt(args: {
  userRequest: string;
  packet: TeamPeerTaskPacket;
  wholeView: TeamWholeView;
  comprehensionPass: AgentComprehensionPass;
  projectionBundle: string;
}): string {
  return [
    "You are one specialist peer inside a Buccet team run.",
    "Do not answer as the final spokesperson. Return only your specialist contribution for Pi to reconcile.",
    "The hardcoded comprehension engine owns the sequence. You are filling only your bounded stage contribution inside that engine.",
    "",
    "## User Request",
    args.userRequest,
    "",
    "## Comprehension Engine",
    renderComprehensionPassForPrompt(args.comprehensionPass),
    "",
    "## Whole View",
    formatWholeView(args.wholeView),
    "",
    "## Peer Packet",
    JSON.stringify(
      {
        peerId: args.packet.peerId,
        packetId: args.packet.packetId,
        specialty: args.packet.specialty,
        ownsStep: args.packet.ownsStep,
        taskSlice: args.packet.taskSlice,
        shardIds: args.packet.shards.map((shard) => shard.shardId),
        shards: args.packet.shards.map((shard) => ({
          shardId: shard.shardId,
          stableAddress: shard.stableAddress,
          title: shard.title,
          assignedPeerId: shard.assignedPeerId,
          eligiblePeerIds: shard.eligiblePeerIds,
        })),
        sourceIds: args.packet.sourceIds,
        projectionHandles: args.packet.projectionHandles.map((handle) => ({
          sourceId: handle.sourceId,
          stableAddress: handle.stableAddress,
          title: handle.title,
        })),
        constraints: args.packet.constraints,
        allowedOutputs: args.packet.allowedOutputs,
        allowedActionKinds: args.packet.allowedActionKinds,
      },
      null,
      2,
    ),
    "",
    "## Opened Projection Region",
    args.projectionBundle || args.packet.inputExcerpt || "(no projection bundle available)",
    "",
    "## Return Format",
    [
      "result_kind: <one of your allowed outputs>",
      "claim: <single claim sentence>",
      "evidence: <sources, tests, proofs, or none>",
      "confidence: <0.0-1.0>",
      "independence: <independent|mixed|shared_context|correlated|unknown>",
      "user_law_relation: <aligned|conflicts|supports|unspecified>",
      "constraints_affected: <safety,budget,privacy,... or none>",
      "contradictions: <contradictions or none>",
      "test_status: <verified|tested|untested|blocked|contradicted|unknown>",
      "risk_level: <low|medium|high|critical>",
      "proposed_disposition: <Accept|Reject|Revise|SplitClaim|RunTest|RequestEvidence|Escalate|Defer|MarkUncertain|AskUser|BlockFinalization>",
      "sources_used: <source ids or none>",
      "specialist_findings:",
      "<your bounded findings>",
      "assumptions:",
      "<assumptions or none>",
      "open_questions:",
      "<open questions or none>",
      "proposed_actions:",
      "<lawful proposals only, or none>",
    ].join("\n"),
  ].join("\n");
}

function buildReconcilePrompt(args: {
  userRequest: string;
  wholeView: TeamWholeView;
  peerResults: BrainPassPeerResult[];
  coherence: CoherenceAdjudication;
  comprehensionPass: AgentComprehensionPass;
}): string {
  return [
    "You are Pi acting as the Buccet team spokesperson.",
    "A Buccet coherence judge has already adjudicated the specialist outputs below.",
    "Do not override the coherence gate. Agreement is signal; coherence is authority.",
    "The hardcoded comprehension engine already owns the sequence; you are serving the render/return end of that engine only.",
    "Reconcile the specialist peer outputs into one final answer for the user only if the coherence disposition is Accept.",
    "If coherence is not Accept, explain the block/revise state instead of pretending finalization succeeded.",
    "",
    "## User Request",
    args.userRequest,
    "",
    "## Comprehension Engine",
    renderComprehensionPassForPrompt(args.comprehensionPass),
    "",
    "## Whole View",
    formatWholeView(args.wholeView),
    "",
    "## Peer Results",
    JSON.stringify(args.peerResults, null, 2),
    "",
    "## Coherence Adjudication",
    JSON.stringify(args.coherence, null, 2),
    "",
    "## Final Answer Rules",
    "- speak as the group spokesperson",
    "- preserve important disagreements",
    "- name blocked or missing work explicitly",
    "- propose only lawful actions",
  ].join("\n");
}

function extractTaggedScalar(text: string, key: string): string | null {
  const match = text.match(new RegExp(`^${key}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? null;
}
