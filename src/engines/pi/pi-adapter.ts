/**
 * Pi Adapter — wires the Pi execution engine into Buccet's boundary.
 *
 * Pi (`@mariozechner/pi-agent-core` + `@mariozechner/pi-ai` by Mario
 * Zechner / `badlogic/pi-mono`) is the singular HANDS of a Buccet team.
 * It runs the LLM-driven agent loop, dispatches tools (bash / read /
 * write / edit / etc.), and is configured to route every action through
 * Buccet's boundary BEFORE execution.
 *
 * Layered architecture:
 *
 *   BRAIN   = spend boundary cognitive-framework path source: workshop teams use
 *           `base-agent-comprehension-process`; SPEND Buccets use
 *           `spending-agent-value-boundary` (value boundary / spend packet).
 *           +  AI/LLM  (path source, transport=remote-llm or local-llm)
 *           +  Library  (path sources, transport=file / http-api / etc.)
 *           Brain proposes; never mutates UPL.
 *
 *   UPL     = standing law; allow / deny / ask operator.
 *
 *   HANDS   = Pi  (path source, transport=engine, provider=pi).
 *           Pi receives the user input, packages it with the brain protocol +
 *           library + UPL track snap, calls the AI, and dispatches the AI's
 *           proposed actions. Each dispatch traverses Buccet's boundary via
 *           `beforeToolCall` → `enforceBoundaryProposal`. Denials return as
 *           `{ block: true, reason }` to Pi, which surfaces them to the AI
 *           so the AI can propose a lawful alternative or escalate.
 *
 * Pi ships as a direct dependency of agent-buccet — it installs
 * automatically with `npm install`. This adapter dynamic-imports Pi only
 * when actually needed so startup cost is zero until a brain pass fires.
 */

import { enforceBoundaryProposal } from "./../../boundaries/bodyguard.ts";
import {
  isBuiltinTeamBrainSourceId,
  resolveTeamBrainPathSource,
} from "./../../context/path-memory.ts";
import { appendBoundaryLedger } from "./../../proof/ledger.ts";
import type { BoundaryActionKind, BoundaryRuntimeConfig } from "./../../runtime/types.ts";
import {
  type EngineSourceConfig,
  type LocalLlmSourceConfig,
  type RemoteLlmSourceConfig,
  type TeamAgent,
  type TeamManifest,
  type TeamSourceRef,
  teamManifestBrainSourceId,
} from "./../../teams/team-workshop.ts";

const PI_AGENT_CORE_PKG = "@mariozechner/pi-agent-core";
const PI_AI_PKG = "@mariozechner/pi-ai";

export class PiNotInstalledError extends Error {
  constructor(cause?: unknown) {
    super(
      [
        "Pi (the team's hands) is not installed in this project.",
        "Install it as a peer dependency:",
        "",
        `  npm i ${PI_AGENT_CORE_PKG} ${PI_AI_PKG}`,
        "",
        "Pi is the open-source agent runtime by Mario Zechner / badlogic/pi-mono.",
        "Buccet wires Pi into the UPL boundary at runtime; nothing changes about",
        "Pi itself — Buccet just plugs into Pi's `beforeToolCall` hook so every",
        "tool dispatch is verdicted before it executes.",
      ].join("\n"),
    );
    this.name = "PiNotInstalledError";
    if (cause) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export type PiAgentBindings = {
  agentCore: unknown;
  piAi: unknown;
};

let cachedBindings: PiAgentBindings | null | undefined;

/**
 * Lazily import Pi's packages. Returns null if either package is not
 * installed — the caller should surface a friendly install hint.
 */
export async function tryLoadPiBindings(): Promise<PiAgentBindings | null> {
  if (cachedBindings !== undefined) return cachedBindings;
  try {
    const [agentCore, piAi] = await Promise.all([
      import(/* @vite-ignore */ PI_AGENT_CORE_PKG as string),
      import(/* @vite-ignore */ PI_AI_PKG as string),
    ]);
    cachedBindings = { agentCore, piAi };
    return cachedBindings;
  } catch {
    cachedBindings = null;
    return null;
  }
}

export async function requirePiBindings(): Promise<PiAgentBindings> {
  const bindings = await tryLoadPiBindings();
  if (!bindings) throw new PiNotInstalledError();
  return bindings;
}

/**
 * Map a Pi tool name to the matching Buccet boundary action kind.
 *
 * Pi's default tools (bash/read/write/edit/grep/glob) cover the standard
 * coding-agent surface. Operators can add more via Pi's tool registry;
 * unknown tools default to `tool.exec` so they still go through the
 * boundary even if the mapping isn't perfect.
 */
export function mapPiToolToBoundaryKind(toolName: string): BoundaryActionKind {
  const normalized = toolName.toLowerCase();
  if (normalized === "bash" || normalized === "shell" || normalized === "exec") return "tool.exec";
  if (
    normalized === "read" ||
    normalized === "grep" ||
    normalized === "glob" ||
    normalized === "ls"
  )
    return "fs.read";
  if (
    normalized === "write" ||
    normalized === "edit" ||
    normalized === "patch" ||
    normalized === "create"
  )
    return "fs.write";
  if (normalized === "delete" || normalized === "rm") return "fs.delete";
  if (
    normalized === "fetch" ||
    normalized === "http" ||
    normalized === "network" ||
    normalized === "browser"
  )
    return "network.send";
  return "tool.exec";
}

export function summarizeToolCallForBoundary(call: PiToolCallLike): string {
  const argsRaw =
    call?.arguments !== undefined
      ? typeof call.arguments === "string"
        ? call.arguments
        : safeStringify(call.arguments)
      : "";
  const trimmed = argsRaw.length > 240 ? `${argsRaw.slice(0, 237)}...` : argsRaw;
  return `pi-tool:${call.name}${trimmed ? ` ${trimmed}` : ""}`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Shape of the call object Pi hands to `beforeToolCall` / `afterToolCall`.
 * We only depend on the fields we actually use, so minor Pi version
 * changes don't break the adapter.
 */
export type PiToolCallLike = {
  name: string;
  arguments?: unknown;
  id?: string;
};

export type PiBeforeToolCallResult =
  | undefined
  | { block?: false }
  | { block: true; reason: string };

export type PiAfterToolCallResult = unknown;

export type BuccetPiHookContext = {
  config: BoundaryRuntimeConfig;
  manifest: TeamManifest;
  agent: TeamAgent;
  engineSource: TeamSourceRef;
  aiSource: TeamSourceRef;
};

/**
 * Build the `beforeToolCall` hook Pi will run. The hook emits the
 * boundary proposal; if the verdict is `deny`, we return `{ block, reason }`
 * so Pi tells the LLM the action was unlawful and the LLM proposes a
 * lawful alternative or escalates.
 */
export function buildBuccetBeforeToolCall(ctx: BuccetPiHookContext) {
  return async function beforeToolCall(call: PiToolCallLike): Promise<PiBeforeToolCallResult> {
    const actionKind = mapPiToolToBoundaryKind(call.name);
    const target = inferToolTarget(call);
    const payloadSummary = summarizeToolCallForBoundary(call);

    const verdict = await enforceBoundaryProposal({
      config: ctx.config,
      proposal: {
        actionKind,
        target,
        payloadSummary,
        provenance: "agent_inference",
        execute: async () => undefined,
        successReason: `pi tool ${call.name} authorized for ${ctx.manifest.slug}/${ctx.agent.id}`,
      },
    });

    if (!verdict.allowed) {
      const reason =
        verdict.reason ??
        "blocked by Buccet UPL boundary; propose a lawful alternative or escalate";
      return { block: true, reason };
    }
    return undefined;
  };
}

function inferToolTarget(call: PiToolCallLike): string {
  const args = call.arguments;
  if (args && typeof args === "object") {
    const a = args as Record<string, unknown>;
    if (typeof a.path === "string") return a.path;
    if (typeof a.file === "string") return a.file;
    if (typeof a.command === "string") return a.command;
    if (typeof a.url === "string") return a.url;
    if (typeof a.target === "string") return a.target;
  }
  return call.name;
}

/**
 * Build the `afterToolCall` hook Pi will run. We witness the result in
 * the boundary ledger so it shows up in the audit trail with the team
 * slug + agent id.
 */
export function buildBuccetAfterToolCall(ctx: BuccetPiHookContext) {
  return async function afterToolCall(
    call: PiToolCallLike,
    result: unknown,
  ): Promise<PiAfterToolCallResult> {
    const actionKind = mapPiToolToBoundaryKind(call.name);
    const target = inferToolTarget(call);
    try {
      await appendBoundaryLedger("ACTION_EXECUTED", {
        sessionId: ctx.config.session.sessionId,
        actorId: ctx.config.session.actorId,
        actionKind,
        target,
        decision: "allow",
        reason: `pi tool ${call.name} dispatched in team ${ctx.manifest.slug}/${ctx.agent.id}`,
        metadata: {
          team: ctx.manifest.slug,
          agent: ctx.agent.id,
          tool: call.name,
          engineProvider:
            (ctx.engineSource.engine as EngineSourceConfig | undefined)?.provider ?? "pi",
          aiProvider:
            (ctx.aiSource.remote as RemoteLlmSourceConfig | undefined)?.provider ??
            (ctx.aiSource.local as LocalLlmSourceConfig | undefined)?.provider ??
            "unknown",
        },
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Witness failure must never break the agent loop; the verdict
      // itself was already recorded by enforceBoundaryProposal.
    }
    return result;
  };
}

/**
 * Build the system context Pi will inject before the LLM call. The
 * brain (spend boundary) sits at the head of the system prompt; the team's
 * library follows; the UPL track snap is named so the LLM knows it is
 * bound by it. Pi's `transformContext` calls this on every turn.
 */
export function buildBuccetSystemContext(args: {
  manifest: TeamManifest;
  agent: TeamAgent;
  uplTrackSnapDescription: string;
}): string {
  const lines: string[] = [];

  lines.push("=== BRAIN PROTOCOL ===");
  const brain = resolveTeamBrainPathSource(teamManifestBrainSourceId(args.manifest));
  lines.push(brain.content);
  lines.push("");

  if (args.manifest.buccetClass === "spend") {
    lines.push("=== SPEND BUCCET — same Pi flow, different domain law ===");
    lines.push(
      "Pi operates identically on this team — same beforeToolCall boundary hooks, same standing UPL law, " +
        "same tool execution pipeline. The domain changes: this team uses the spend value-boundary brain " +
        "(spending agents / agent buckets). No agent.spend action may reach Commit without a complete, " +
        "authorized spend packet. UPL and operator law are the enforcement plane; this brain is the " +
        "procedural law inside the SPEND slice.",
    );
    lines.push("");
  }

  lines.push(`=== TEAM: ${args.manifest.name} (${args.manifest.slug}) ===`);
  lines.push(`Domain: ${args.manifest.domain}`);
  lines.push(`Summary: ${args.manifest.summary}`);
  lines.push("");

  lines.push(`=== AGENT: ${args.agent.id} ===`);
  lines.push(`Title: ${args.agent.title}`);
  lines.push(`Specialty: ${args.agent.specialty}`);
  lines.push(`Owns step: ${args.agent.ownsStep}`);
  if (args.agent.memoryNotes) lines.push(`Notes: ${args.agent.memoryNotes}`);
  lines.push("");

  const requestedSourceIds = args.agent.sourceIds.filter(
    (sourceId) => !isBuiltinTeamBrainSourceId(sourceId),
  );
  const libraryRefs = args.manifest.pathSourceCorpus.filter((s) => {
    if (isBuiltinTeamBrainSourceId(s.id) || s.transport === "engine") {
      return false;
    }
    if (requestedSourceIds.length === 0) return true;
    return requestedSourceIds.includes(s.id);
  });
  if (libraryRefs.length > 0) {
    lines.push("=== LIBRARY (path sources) ===");
    for (const s of libraryRefs) {
      lines.push(`- ${s.id} · ${s.kind} · ${s.title}`);
      if (s.summary) lines.push(`    ${s.summary}`);
    }
    lines.push("");
  }

  lines.push("=== STANDING LAW (UPL track snap) ===");
  lines.push(args.uplTrackSnapDescription);
  lines.push("");
  lines.push(
    "You may PROPOSE actions; you may NEVER mutate UPL or widen scope. " +
      "If a proposed action is denied at the boundary, do not retry the " +
      "same shape — propose a lawful alternative, ask the operator (if " +
      "running interactive), or render a refusal as the lawful outcome.",
  );

  return lines.join("\n");
}

export type BuildBuccetGovernedPiAgentArgs = {
  config: BoundaryRuntimeConfig;
  manifest: TeamManifest;
  agent: TeamAgent;
  engineSource: TeamSourceRef;
  aiSource: TeamSourceRef;
  uplTrackSnapDescription: string;
};

export type BuccetGovernedPiAgent = {
  agent: unknown;
  promptFn: (input: string) => Promise<unknown>;
};

/**
 * Construct a Pi `Agent` instance with all Buccet hooks wired. Returns
 * the constructed agent and a thin `promptFn` callable for the
 * driver-loop wrapper.
 *
 * This is the integration seam. If Pi's exact `AgentOptions` type
 * changes between minor versions, only this builder needs to adjust;
 * the rest of Buccet sees a stable `BuccetGovernedPiAgent`.
 */
export async function buildBuccetGovernedPiAgent(
  args: BuildBuccetGovernedPiAgentArgs,
): Promise<BuccetGovernedPiAgent> {
  const { agentCore, piAi } = await requirePiBindings();

  const remote = args.aiSource.remote as RemoteLlmSourceConfig | undefined;
  const local = args.aiSource.local as LocalLlmSourceConfig | undefined;
  const aiProvider = remote?.provider ?? local?.provider ?? "openai";
  const aiModel = remote?.model ?? local?.model ?? "gpt-4o-mini";

  const ctx: BuccetPiHookContext = {
    config: args.config,
    manifest: args.manifest,
    agent: args.agent,
    engineSource: args.engineSource,
    aiSource: args.aiSource,
  };

  const beforeToolCall = buildBuccetBeforeToolCall(ctx);
  const afterToolCall = buildBuccetAfterToolCall(ctx);
  const systemContext = buildBuccetSystemContext({
    manifest: args.manifest,
    agent: args.agent,
    uplTrackSnapDescription: args.uplTrackSnapDescription,
  });

  const getApiKey = () => {
    const envVar = remote?.authEnvVar;
    if (!envVar) return undefined;
    const key = process.env[envVar];
    return typeof key === "string" && key.length > 0 ? key : undefined;
  };

  // pi-ai exposes `getModel(provider, model)` returning a model handle
  // Pi's Agent expects on `initialState.model`. Surface is dynamic; we
  // try the documented call and fall back to a generic shape.
  const piAiModule = piAi as { getModel?: (provider: string, model: string) => unknown };
  const modelHandle = piAiModule.getModel?.(aiProvider, aiModel) ?? {
    provider: aiProvider,
    model: aiModel,
  };

  const transformContext = (messages: unknown): unknown => {
    if (!Array.isArray(messages)) return messages;
    const head = messages[0] as { role?: string; content?: string } | undefined;
    if (head?.role === "system") {
      return [
        { role: "system", content: `${systemContext}\n\n${head.content ?? ""}` },
        ...messages.slice(1),
      ];
    }
    return [{ role: "system", content: systemContext }, ...messages];
  };

  const engineCfg = args.engineSource.engine as EngineSourceConfig | undefined;
  const toolExecution = engineCfg?.toolExecution ?? "parallel";

  const AgentCtor = (agentCore as { Agent?: new (opts: unknown) => unknown }).Agent;
  if (typeof AgentCtor !== "function") {
    throw new Error(
      `Loaded ${PI_AGENT_CORE_PKG} but it does not export an \`Agent\` class. Pi's API may have changed; please pin a compatible version or open an issue.`,
    );
  }

  const piAgent = new AgentCtor({
    initialState: {
      model: modelHandle,
    },
    getApiKey,
    beforeToolCall,
    afterToolCall,
    transformContext,
    toolExecution,
  });

  const promptFn = async (input: string): Promise<unknown> => {
    const a = piAgent as { prompt?: (s: string) => Promise<unknown> };
    if (typeof a.prompt !== "function") {
      throw new Error(
        `Pi Agent instance has no \`prompt\` method. Pi's API may have changed; ` +
          "please pin a compatible version or update the adapter.",
      );
    }
    return a.prompt(input);
  };

  return { agent: piAgent, promptFn };
}
