import type { BoundaryActionKind } from "./../runtime/types.ts";

/**
 * Agent comprehension acceptance lanes — the engine as law on the YES side.
 *
 * These lanes declare the lawful shape of an agent's pass through the
 * Universal Agent Comprehension Process: Receive → Represent → Infer Intent
 * → Bind Constraints → Select Method → Acquire/Use Knowledge → Transform →
 * Validate → Render → Return.
 *
 * They do not introduce a new engine; they make the existing engine explicit
 * inside UPL so that operators can inspect, mute, ratify, and extend the law
 * through the same acceptance flow as every other lane. The track extractor
 * compiles these lanes into the runtime corridor; UPL Traffic enforces that
 * agent motion stays on the corridor.
 *
 * Enforcement of the corresponding runtime invariants — intent binding,
 * stage order, validation provenance, premise check, no-fabrication —
 * already lives in the swarm classifier (`classifySwarmPath`), the bodyguard
 * verdict path, and Traffic. These lanes name the law that those enforcers
 * already serve. No new substrate.
 */

type TargetMatchMode = "prefix" | "exact" | "regex";

export type AgentComprehensionAcceptanceLane = {
  id: string;
  invariant: string;
  summary: string;
  stage:
    | "receive"
    | "represent"
    | "infer_intent"
    | "bind_constraints"
    | "select_method"
    | "acquire_knowledge"
    | "transform"
    | "validate"
    | "render"
    | "return"
    | "pipeline";
  actionKinds: BoundaryActionKind[];
  targetPattern: string;
  targetMatchMode: TargetMatchMode;
  requestTextPatterns: string[];
  brainSourceUri: string;
};

const BRAIN_SOURCE_URI = "buccet://internal/agent-comprehension-process";

/**
 * The comprehension contract surfaces most cleanly at the rendering boundary —
 * when an agent emits a result for human or peer consumption, the law of how
 * that result was produced is what the operator can audit. We bind these
 * lanes to `chat.emit` so they surface in UPL as named entries without
 * competing with the action-shaped lanes (fs.*, network.*, agent.spend,
 * tool.exec, etc.) that constrain particular operations on particular targets.
 *
 * Runtime enforcement of intent / validation / stage-order / no-fabrication
 * already lives in `classifySwarmPath` and the bodyguard verdict path; these
 * lanes name the law, they do not duplicate the enforcer.
 */
const COMPREHENSION_LANE_ACTION_KINDS: BoundaryActionKind[] = ["chat.emit"];

function lane(args: {
  id: string;
  invariant: string;
  summary: string;
  stage: AgentComprehensionAcceptanceLane["stage"];
  actionKinds?: BoundaryActionKind[];
  requestTextPatterns: string[];
}): AgentComprehensionAcceptanceLane {
  return {
    id: args.id,
    invariant: args.invariant,
    summary: args.summary,
    stage: args.stage,
    actionKinds: args.actionKinds ?? COMPREHENSION_LANE_ACTION_KINDS,
    targetPattern: args.invariant,
    targetMatchMode: "exact",
    requestTextPatterns: args.requestTextPatterns,
    brainSourceUri: BRAIN_SOURCE_URI,
  };
}

export const BASE_AGENT_COMPREHENSION_ACCEPTANCE_LANES: readonly AgentComprehensionAcceptanceLane[] = [
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0001",
    invariant: "agent-comprehension-pass-required",
    summary:
      "lawful agent action proposals arrive at the boundary having completed a Universal Agent Comprehension Process pass (Receive → Represent → Infer Intent → Bind Constraints → Select Method → Acquire/Use Knowledge → Transform → Validate → Render → Return)",
    stage: "pipeline",
    requestTextPatterns: [
      "agent-comprehension-pass",
      "comprehension pass",
      "comprehension pipeline",
      "engine pass",
      "ten-stage pass",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0002",
    invariant: "agent-stage-order",
    summary:
      "the ten comprehension stages must run in the canonical order; no stage may be skipped, reordered, or owned by anything inside the engine",
    stage: "pipeline",
    requestTextPatterns: [
      "agent-stage-order",
      "stage order",
      "canonical stage order",
      "no stage skipped",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0003",
    invariant: "agent-intent-bound",
    summary:
      "high-risk agent actions are lawful only when intent is bound: a declared goal, must-have constraints, and a success condition carried in the swarm intent payload",
    stage: "infer_intent",
    requestTextPatterns: [
      "agent-intent-bound",
      "intent bound",
      "declared intent",
      "swarm intent goal",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0004",
    invariant: "agent-constraints-bound",
    summary:
      "the constraints stage must bind UPL acceptance, denial, safety, format, and authority before method selection occurs",
    stage: "bind_constraints",
    requestTextPatterns: [
      "agent-constraints-bound",
      "constraints bound",
      "upl bound",
      "constraint binding",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0005",
    invariant: "agent-method-sufficient-not-maximal",
    summary:
      "method selection must be sufficient for the task and the constraints, not maximal; an arithmetic question selects arithmetic, not a heavy pipeline",
    stage: "select_method",
    requestTextPatterns: [
      "agent-method-sufficient-not-maximal",
      "sufficient method",
      "method selection",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0006",
    invariant: "agent-knowledge-acquired-or-bounded",
    summary:
      "the knowledge stage acquires from path sources, tools, web, files, or LLM-as-library; when knowledge is unavailable, lawful output is a bounded answer, declared uncertainty, or refusal — never confident invention",
    stage: "acquire_knowledge",
    requestTextPatterns: [
      "agent-knowledge-acquired-or-bounded",
      "knowledge acquired",
      "knowledge bounded",
      "no fabrication",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0007",
    invariant: "agent-validation-provenance",
    summary:
      "high-risk agent actions are lawful only when validation provenance is carried — composition completed history, freshness, premise check, and required validation against intent and constraints",
    stage: "validate",
    requestTextPatterns: [
      "agent-validation-provenance",
      "validation provenance",
      "completed validation",
      "premise checked",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0008",
    invariant: "agent-render-usable-by-receiver",
    summary:
      "the render stage shapes the validated result into a form usable by the intended receiver — human or next peer; correct internal answer rendered as unreadable jargon does not satisfy the contract",
    stage: "render",
    requestTextPatterns: [
      "agent-render-usable-by-receiver",
      "render usable",
      "human-usable rendering",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0009",
    invariant: "agent-mouth-contract",
    summary:
      "an LLM module may serve specific stages — represent, infer intent, transform, render — but never owns the sequence; the engine decides stage, input, validation, and continuation",
    stage: "pipeline",
    requestTextPatterns: [
      "agent-mouth-contract",
      "llm contract",
      "mouth contract",
      "engine owns sequence",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0010",
    invariant: "agent-bounded-by-upl-track",
    summary:
      "all agent motion stays inside the UPL track; standing law follows across every team, every peer, every swarm; there is no exception lane and no infinite recursion",
    stage: "pipeline",
    requestTextPatterns: [
      "agent-bounded-by-upl-track",
      "bounded by track",
      "no infinite recursion",
      "standing law follows",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0011",
    invariant: "agent-ambiguity-disposition",
    summary:
      "when intent cannot be bound, the lawful output is a clarification request or a best-effort answer with the assumption declared; silent guessing is not a lawful continuation",
    stage: "infer_intent",
    requestTextPatterns: [
      "agent-ambiguity-disposition",
      "ambiguity disposition",
      "clarification request",
      "declared assumption",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0012",
    invariant: "agent-tool-failure-disposition",
    summary:
      "when a tool or knowledge operation fails, the lawful output names the limitation and returns a bounded answer; fabrication is not a lawful continuation",
    stage: "acquire_knowledge",
    requestTextPatterns: [
      "agent-tool-failure-disposition",
      "tool failure",
      "bounded answer",
      "stated limitation",
    ],
  }),
];

/**
 * Per-provider acceptance corridors for path-source transports.
 *
 * Remote LLM providers run as `network.send` to a known endpoint host.
 * Local LLM providers run as `tool.exec` of a known binary.
 *
 * These corridors NAME the lawful corridor — the bodyguard still applies them
 * against actual requests, and the operator can mute or extend any of them
 * via the standard `buccet upl` flow without touching code.
 */
type RemoteLlmCorridor = {
  id: string;
  provider: string;
  hostPattern: string;
  defaultModel: string;
};

type LocalLlmCorridor = {
  id: string;
  provider: string;
  binary: string;
  defaultEndpoint?: string;
};

export const REMOTE_LLM_ACCEPTANCE_CORRIDORS: readonly RemoteLlmCorridor[] = [
  { id: "ACCEPT.AGENT.SOURCE.PROVIDER.OPENAI",    provider: "openai",    hostPattern: "/api\\.openai\\.com/i",                                     defaultModel: "gpt-4o-mini" },
  { id: "ACCEPT.AGENT.SOURCE.PROVIDER.ANTHROPIC", provider: "anthropic", hostPattern: "/api\\.anthropic\\.com/i",                                  defaultModel: "claude-3-5-sonnet-latest" },
  { id: "ACCEPT.AGENT.SOURCE.PROVIDER.GEMINI",    provider: "gemini",    hostPattern: "/generativelanguage\\.googleapis\\.com/i",                  defaultModel: "gemini-1.5-flash" },
  { id: "ACCEPT.AGENT.SOURCE.PROVIDER.MISTRAL",   provider: "mistral",   hostPattern: "/api\\.mistral\\.ai/i",                                     defaultModel: "mistral-small-latest" },
  { id: "ACCEPT.AGENT.SOURCE.PROVIDER.GROQ",      provider: "groq",      hostPattern: "/api\\.groq\\.com/i",                                       defaultModel: "llama-3.1-8b-instant" },
  { id: "ACCEPT.AGENT.SOURCE.PROVIDER.DEEPSEEK", provider: "deepseek",   hostPattern: "/api\\.deepseek\\.com/i",                                   defaultModel: "deepseek-chat" },
];

export const LOCAL_LLM_ACCEPTANCE_CORRIDORS: readonly LocalLlmCorridor[] = [
  { id: "ACCEPT.AGENT.SOURCE.LOCAL.OLLAMA",    provider: "ollama",    binary: "ollama",        defaultEndpoint: "http://127.0.0.1:11434" },
  { id: "ACCEPT.AGENT.SOURCE.LOCAL.LLAMA_CPP", provider: "llama-cpp", binary: "llama-cli",     defaultEndpoint: "http://127.0.0.1:8080" },
  { id: "ACCEPT.AGENT.SOURCE.LOCAL.LM_STUDIO", provider: "lm-studio", binary: "lms",           defaultEndpoint: "http://127.0.0.1:1234" },
  { id: "ACCEPT.AGENT.SOURCE.LOCAL.MLX",       provider: "mlx",       binary: "mlx_lm.server", defaultEndpoint: "http://127.0.0.1:8080" },
  { id: "ACCEPT.AGENT.SOURCE.LOCAL.VLLM",      provider: "vllm",      binary: "vllm",          defaultEndpoint: "http://127.0.0.1:8000" },
];

export type ProviderAcceptanceLane = {
  id: string;
  invariant: string;
  summary: string;
  actionKinds: BoundaryActionKind[];
  targetPattern: string;
  targetMatchMode: "prefix" | "exact" | "regex";
  requestTextPatterns: string[];
  brainSourceUri: string;
  provider: string;
  transport: "remote-llm" | "local-llm";
};

export const REMOTE_LLM_ACCEPTANCE_LANES: readonly ProviderAcceptanceLane[] = REMOTE_LLM_ACCEPTANCE_CORRIDORS.map((c) => ({
  id: c.id,
  invariant: `agent-source-remote-${c.provider}`,
  summary: `Remote LLM path-source via ${c.provider} is a lawful agent knowledge corridor (network.send to ${c.hostPattern}); UPL spend caps and rate caps apply per attached team.`,
  actionKinds: ["network.send"],
  targetPattern: c.hostPattern,
  targetMatchMode: "regex" as const,
  requestTextPatterns: [
    `remote-llm:${c.provider}`,
    `${c.provider}-source`,
    `${c.provider} model ${c.defaultModel}`,
  ],
  brainSourceUri: BRAIN_SOURCE_URI,
  provider: c.provider,
  transport: "remote-llm" as const,
}));

export const LOCAL_LLM_ACCEPTANCE_LANES: readonly ProviderAcceptanceLane[] = LOCAL_LLM_ACCEPTANCE_CORRIDORS.map((c) => ({
  id: c.id,
  invariant: `agent-source-local-${c.provider}`,
  summary: `Local LLM path-source via ${c.provider} (${c.binary}${c.defaultEndpoint ? ` at ${c.defaultEndpoint}` : ""}) is a lawful agent knowledge corridor (tool.exec); per-team UPL spend caps and rate caps apply.`,
  actionKinds: ["tool.exec"],
  targetPattern: c.binary,
  targetMatchMode: "exact" as const,
  requestTextPatterns: [
    `local-llm:${c.provider}`,
    c.binary,
    `${c.provider} local model`,
  ],
  brainSourceUri: BRAIN_SOURCE_URI,
  provider: c.provider,
  transport: "local-llm" as const,
}));

type HttpApiCorridor = {
  id: string;
  provider: string;
  hostPattern: string;
};

/**
 * HTTP knowledge endpoints (vector stores, hybrid search, lightweight RAG
 * gateways). Same boundary call as chat LLMs: `network.send` to host
 * matching the corridor regex — operator extends / mutes unknown hosts
 * explicitly through UPL (`--http custom` presets do not seed a corridor).
 */
export const HTTP_API_ACCEPTANCE_CORRIDORS: readonly HttpApiCorridor[] = [
  {
    id: "ACCEPT.AGENT.SOURCE.HTTP_API.PINECONE",
    provider: "pinecone",
    hostPattern: "/api\\.pinecone\\.io/i",
  },
  {
    id: "ACCEPT.AGENT.SOURCE.HTTP_API.QDRANT",
    provider: "qdrant",
    hostPattern: "/cloud\\.qdrant\\.io|\\.qdrant\\.(?:io|technology)|localhost:6333/i",
  },
  {
    id: "ACCEPT.AGENT.SOURCE.HTTP_API.WEAVIATE",
    provider: "weaviate",
    hostPattern: "/\\.weaviate\\.(?:network|cloud)|\\/v1\\/graphql|\\/v1\\/vectors/i",
  },
  {
    id: "ACCEPT.AGENT.SOURCE.HTTP_API.CHROMADB",
    provider: "chromadb",
    hostPattern: "/127\\.0\\.0\\.1:8000|localhost:8000|\\/(?:api\\/v2\\/|v1\\/)(?:collections|tenants)\\b|chromadb/i",
  },
  {
    id: "ACCEPT.AGENT.SOURCE.HTTP_API.MEILISEARCH",
    provider: "meilisearch",
    hostPattern: "/127\\.0\\.0\\.1:7700|localhost:7700|\\/(?:indexes\\/|indexes\\?)|meilisearch/i",
  },
  {
    id: "ACCEPT.AGENT.SOURCE.HTTP_API.ELASTICSEARCH",
    provider: "elasticsearch",
    hostPattern: "/9200|\\/\\_search|\\.elastic\\.(?:co|cloud)|elasticsearch\\/|localhost:9200/i",
  },
  {
    id: "ACCEPT.AGENT.SOURCE.HTTP_API.ALGOLIA",
    provider: "algolia",
    hostPattern: "/algolia\\.(?:net|io)/i",
  },
];

export type HttpApiAcceptanceLane = {
  id: string;
  invariant: string;
  summary: string;
  actionKinds: BoundaryActionKind[];
  targetPattern: string;
  targetMatchMode: "prefix" | "exact" | "regex";
  requestTextPatterns: string[];
  brainSourceUri: string;
  provider: string;
  transport: "http-api";
};

export const HTTP_API_ACCEPTANCE_LANES: readonly HttpApiAcceptanceLane[] = HTTP_API_ACCEPTANCE_CORRIDORS.map((c) => ({
  id: c.id,
  invariant: `agent-source-http-${c.provider}`,
  summary: `HTTP knowledge connector via ${c.provider} is a lawful agent retrieval corridor (\`network.send\` matched to ${c.hostPattern}); bounded by rate caps per team.`,
  actionKinds: ["network.send"],
  targetPattern: c.hostPattern,
  targetMatchMode: "regex" as const,
  requestTextPatterns: [`http-api:${c.provider}`, `${c.provider} vector`, `${c.provider} search`],
  brainSourceUri: BRAIN_SOURCE_URI,
  provider: c.provider,
  transport: "http-api" as const,
}));

/**
 * Engine acceptance lanes — declaratory NAMING that the operator has chosen
 * a particular execution engine as a team's lawful hands. The engine itself
 * emits no boundary calls; it dispatches tools, and those tools (Bash,
 * Read, Write, Edit, network, etc.) flow through the existing per-action
 * corridors (fs.*, tool.exec, network.send, agent.spend) via the engine's
 * pre-execution hook (Pi: `beforeToolCall`). UPL adjudicates each tool;
 * denial returns to the engine as a structured `block` that the brain
 * (LLM) sees as "you can't do that, try lawful or escalate."
 *
 * Bound to chat.emit (the "naming" surface) per the comprehension-lane
 * convention; the engine's tool dispatches are gated by per-action lanes.
 */
type EngineCorridor = {
  id: string;
  provider: string;
  packageHint: string;
  summary: string;
};

export const ENGINE_ACCEPTANCE_CORRIDORS: readonly EngineCorridor[] = [
  {
    id: "ACCEPT.AGENT.SOURCE.ENGINE.PI",
    provider: "pi",
    packageHint: "@mariozechner/pi-agent-core",
    summary:
      "Pi (the open-source Mario Zechner agent runtime, peer dep `@mariozechner/pi-agent-core`) is a lawful execution engine — it is a team's hands. Pi never bypasses UPL: every tool call routes through Buccet's `enforceBoundaryProposal` via Pi's `beforeToolCall` hook before any side effect leaves the engine.",
  },
];

export type EngineAcceptanceLane = {
  id: string;
  invariant: string;
  summary: string;
  actionKinds: BoundaryActionKind[];
  targetPattern: string;
  targetMatchMode: "prefix" | "exact" | "regex";
  requestTextPatterns: string[];
  brainSourceUri: string;
  provider: string;
};

export const ENGINE_ACCEPTANCE_LANES: readonly EngineAcceptanceLane[] = ENGINE_ACCEPTANCE_CORRIDORS.map((c) => ({
  id: c.id,
  invariant: `agent-source-engine-${c.provider}`,
  summary: c.summary,
  actionKinds: ["chat.emit"],
  targetPattern: `agent-source-engine-${c.provider}`,
  targetMatchMode: "exact" as const,
  requestTextPatterns: [
    `engine:${c.provider}`,
    `hands engine ${c.provider}`,
    c.packageHint,
  ],
  brainSourceUri: BRAIN_SOURCE_URI,
  provider: c.provider,
}));
