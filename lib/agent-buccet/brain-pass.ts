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
  buildBuccetGovernedPiAgent,
  PiNotInstalledError,
  tryLoadPiBindings,
} from "./pi-adapter.ts";
import {
  buildTeamPeerTaskGraph,
  buildTeamWholeView,
  renderProjectionBundle,
  type TeamPeerTaskGraph,
  type TeamPeerTaskPacket,
  type TeamWholeView,
} from "./path-source-checkpoints.ts";
import {
  endPersistentBoundarySession,
  startPersistentBoundarySession,
} from "./state.ts";
import {
  loadTeam,
  type TeamAgent,
  type TeamManifest,
  type TeamSlug,
  type TeamSourceRef,
} from "./team-workshop.ts";
import type { BoundaryActionKind } from "./types.ts";

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
  peerResults: BrainPassPeerResult[];
};

const PI_RUN_GRANTED_ACTIONS: BoundaryActionKind[] = [
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
};

export type BrainPassPeerResult = {
  peerId: string;
  specialty: string;
  ownsStep: string;
  sourceIds: string[];
  projectionCount: number;
  output: string;
  status: "completed" | "blocked";
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
  const manifest = await loadTeam(args.homePath, args.slug);
  if (!manifest) {
    throw new BrainPassPreconditionError(`No team named "${args.slug}".`);
  }

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
      throw new BrainPassPreconditionError(
        `Team "${args.slug}" has no peer "${args.agentId}".`,
      );
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

  return { manifest, engineSource, aiSource, agent, agents, wholeView, peerTaskGraph };
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
    return value.map(extractTextOutput).filter((s) => s.length > 0).join("\n");
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
  const { manifest, engineSource, aiSource, agent, agents, wholeView, peerTaskGraph } = await preflightBrainPass({
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
  try {
    for (const packet of peerTaskGraph.packets) {
      const peerAgent = agents.find((entry) => entry.id === packet.peerId);
      if (!peerAgent) continue;
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
          projectionBundle,
        }),
      );
      const peerOutput = extractTextOutput(result).trim() || "(peer returned empty output)";
      peerResults.push({
        peerId: peerAgent.id,
        specialty: peerAgent.specialty,
        ownsStep: peerAgent.ownsStep,
        sourceIds: packet.sourceIds,
        projectionCount: packet.projectionHandles.length,
        output: peerOutput,
        status: "completed",
      });
    }

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
      }),
    );
    output = extractTextOutput(result).trim();
    if (output.length === 0) {
      output = "(brain pass returned empty output)";
    }
    emit({ type: "completed", output });
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
    peerResults,
  };
}

/**
 * Lightweight check used by CLI entry points to decide whether to attempt
 * a brain pass at all. Returns true only if the team has both an engine
 * source and an AI source registered. Pi-not-installed is detected later
 * inside `runBrainPass` so the install hint surfaces with full context.
 */
export async function teamCanBrainPass(
  homePath: string,
  slug: TeamSlug,
): Promise<boolean> {
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
  projectionBundle: string;
}): string {
  return [
    "You are one specialist peer inside a Buccet team run.",
    "Do not answer as the final spokesperson. Return only your specialist contribution for Pi to reconcile.",
    "",
    "## User Request",
    args.userRequest,
    "",
    "## Whole View",
    formatWholeView(args.wholeView),
    "",
    "## Peer Packet",
    JSON.stringify(
      {
        peerId: args.packet.peerId,
        specialty: args.packet.specialty,
        ownsStep: args.packet.ownsStep,
        taskSlice: args.packet.taskSlice,
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
}): string {
  return [
    "You are Pi acting as the Buccet team spokesperson.",
    "Reconcile the specialist peer outputs below into one final answer for the user.",
    "Do not erase disagreement. Surface conflicts, missing evidence, and blocked edges clearly.",
    "",
    "## User Request",
    args.userRequest,
    "",
    "## Whole View",
    formatWholeView(args.wholeView),
    "",
    "## Peer Results",
    JSON.stringify(args.peerResults, null, 2),
    "",
    "## Final Answer Rules",
    "- speak as the group spokesperson",
    "- preserve important disagreements",
    "- name blocked or missing work explicitly",
    "- propose only lawful actions",
  ].join("\n");
}
