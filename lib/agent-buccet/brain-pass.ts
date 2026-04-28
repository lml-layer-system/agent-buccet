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

  const agent = (args.agentId
    ? manifest.agents.find((a) => a.id === args.agentId)
    : manifest.agents[0]) ?? null;
  if (!agent) {
    throw new BrainPassPreconditionError(
      `Team "${args.slug}" has no peers yet. ` +
        `Add one with: \`buccet create add-agent ${args.slug} --name <id> --specialty "<text>"\`.`,
    );
  }

  return { manifest, engineSource, aiSource, agent };
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
  const { manifest, engineSource, aiSource, agent } = await preflightBrainPass({
    homePath: args.homePath,
    slug: args.slug,
    agentId: args.agentId,
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

  const sessionId = `team:${manifest.slug}:${agent.id}:${Date.now()}`;
  const actorId = `team-agent:${manifest.slug}:${agent.id}`;
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
  try {
    const built = await buildBuccetGovernedPiAgent({
      config,
      manifest,
      agent,
      engineSource,
      aiSource,
      uplTrackSnapDescription: `UPL track snap taken at ${manifest.uplTrackSnap.takenAt}; live system UPL applies (allow/deny adjudicates every Pi tool dispatch).`,
    });

    const result = await built.promptFn(args.userRequest);
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
