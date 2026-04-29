import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE,
  type BuccetPathSource,
} from "./path-memory.ts";
import {
  buildTeamWholeView,
  buildTeamSourceCheckpoint,
  deleteTeamSourceCheckpoint,
  persistTeamSourceCheckpoint,
  type TeamSourceCheckpointRef,
  type TeamWholeView,
} from "./path-source-checkpoints.ts";
import {
  AGENT_TEAM_STAGE_IDS,
  type AgentTeamStageId,
} from "./agent-comprehension-engine.ts";

/**
 * Team Workshop — the operator-facing surface for creating hyper-specialized
 * agent teams on the creativity face of Buccet.
 *
 * A team is a saved, named slice of the Buccet substrate:
 *  - a domain
 *  - a roster of peer agents (each with model hint, --owns-step, source slice,
 *    spend cap)
 *  - a brain instance (the Universal Agent Comprehension Process auto-injected
 *    into every formation; the team carries a copy in its manifest for audit)
 *  - a path-source corpus (the team's library)
 *  - a UPL track snap reference (taken at create time so audits can replay)
 *  - per-agent conscience-spend trackers (running spend + cap per peer)
 *
 * Teams live under `<home>/teams/<slug>/manifest.json`. The defense face still
 * decides every action; teams just propose. The creative wall denies team
 * actions that would touch defense-face state.
 */

export const TEAM_MANIFEST_VERSION = "1";

export const COMPREHENSION_STAGE_IDS = AGENT_TEAM_STAGE_IDS;

export type ComprehensionStageId = AgentTeamStageId;

export type TeamAgent = {
  id: string;
  title: string;
  specialty: string;
  modelHint?: string;
  ownsStep: ComprehensionStageId;
  tools: string[];
  sourceIds: string[];
  memoryNotes?: string;
  spend: {
    capNormalized: number | null;
    spentNormalized: number;
  };
};

/**
 * Transport tells the runtime what a path source IS and how Buccet wires
 * it into the boundary surface:
 *
 *  - file        : on-disk markdown / code / json (the original path-source kind)
 *  - remote-llm  : remote inference endpoint (Anthropic, OpenAI, Gemini, ...)
 *  - local-llm   : local inference runtime (Ollama, llama.cpp, LM Studio, ...)
 *  - http-api    : generic HTTP knowledge endpoint (vector DBs, search, RAG)
 *  - engine      : the singular execution engine — Pi today — that runs as
 *                  the team's HANDS. The brain (UBIE + AI/LLM + library)
 *                  proposes; the engine carries proposals through Buccet's
 *                  boundary and only executes the lawful subset.
 *
 * Every transport routes through the boundary on every action:
 *   file       → fs.read       (gated by scope + UPL)
 *   remote-llm → network.send  (gated by UPL acceptance + spend)
 *   local-llm  → tool.exec     (gated by UPL acceptance + tool-exec rules)
 *   http-api   → network.send  (gated by UPL acceptance)
 *   engine     → declaratory (the engine itself emits no calls; the tools
 *                it dispatches do, through fs.* / tool.exec / network.send /
 *                agent.spend, all of which are already gated. The engine
 *                acceptance lane NAMES that Pi is this team's lawful hands)
 *
 * Output is also subject to the creative-wall denial — sources cannot write
 * back into UPL/scope/ledger state.
 */
export type SourceTransport = "file" | "remote-llm" | "local-llm" | "http-api" | "engine";

export type RemoteLlmProvider = "openai" | "anthropic" | "gemini" | "mistral" | "groq" | "deepseek" | "custom";

export type RemoteLlmSourceConfig = {
  provider: RemoteLlmProvider;
  endpoint: string;
  model: string;
  authEnvVar?: string;
  defaultParams?: Record<string, unknown>;
  rateCapPerMinute?: number;
};

export type LocalLlmProvider = "ollama" | "llama-cpp" | "lm-studio" | "mlx" | "vllm" | "custom";

export type LocalLlmSourceConfig = {
  provider: LocalLlmProvider;
  binary?: string;
  endpoint?: string;
  model: string;
  defaultParams?: Record<string, unknown>;
};

/**
 * Preset integrations for generic HTTP knowledge / retrieval (vector DB,
 * hybrid search, RAG gateways). Calls flow through `network.send`; UPL gates
 * every request. Operators can also use `--http custom --endpoint <url>`.
 *
 * Providers without a default base URL MUST pass `--endpoint` (their cluster /
 * tenancy URL varies per deployment).
 */
export type HttpApiProvider =
  | "pinecone"
  | "qdrant"
  | "weaviate"
  | "chromadb"
  | "meilisearch"
  | "elasticsearch"
  | "algolia"
  | "custom";

export type HttpApiSourceConfig = {
  /** Registered preset name; omit only on backward-compat manifests written before presets existed. */
  provider?: HttpApiProvider;
  endpoint: string;
  method?: "GET" | "POST";
  authEnvVar?: string;
  defaultHeaders?: Record<string, string>;
  rateCapPerMinute?: number;
};

export const HTTP_API_PROVIDER_DEFAULTS: Record<HttpApiProvider, Partial<HttpApiSourceConfig>> = {
  pinecone: {
    endpoint: "https://api.pinecone.io",
    method: "POST",
    authEnvVar: "PINECONE_API_KEY",
  },
  qdrant: {
    authEnvVar: "QDRANT_API_KEY",
  },
  weaviate: {
    authEnvVar: "WEAVIATE_API_KEY",
  },
  chromadb: {
    endpoint: "http://127.0.0.1:8000",
    method: "POST",
  },
  meilisearch: {
    endpoint: "http://127.0.0.1:7700",
    method: "POST",
    authEnvVar: "MEILISEARCH_KEY",
  },
  elasticsearch: {
    endpoint: "http://127.0.0.1:9200",
    method: "POST",
  },
  algolia: {
    authEnvVar: "ALGOLIA_API_KEY",
  },
  custom: {},
};

/**
 * The execution engine that acts as a team's HANDS. Pi today is the
 * canonical (and only) provider; the architecture leaves room for an
 * operator to point at a compatible alternative without changing the
 * substrate. Pi is downloaded by the operator (e.g.
 * `npm i @mariozechner/pi-agent-core @mariozechner/pi-ai`) and registered
 * as a path source; Buccet's pi-adapter imports it as a peer dep at runtime.
 *
 * The engine itself emits no boundary calls — it is the body that dispatches
 * tools, and those tools (read/write/bash/network) flow through Buccet's
 * existing fs.* / tool.exec / network.send corridors via Pi's
 * `beforeToolCall` hook.
 */
export type EngineProvider = "pi" | "custom";

export type EngineSourceConfig = {
  provider: EngineProvider;
  agentCorePackage?: string;
  aiPackage?: string;
  toolExecution?: "parallel" | "sequential";
  allowedTools?: string[];
  installPath?: string;
  notes?: string;
};

export const ENGINE_PROVIDER_DEFAULTS: Record<EngineProvider, EngineSourceConfig> = {
  pi: {
    provider: "pi",
    agentCorePackage: "@mariozechner/pi-agent-core",
    aiPackage: "@mariozechner/pi-ai",
    toolExecution: "parallel",
    allowedTools: ["bash", "read", "write", "edit", "grep", "glob"],
  },
  custom: {
    provider: "custom",
  },
};

export type TeamSourceRef = {
  id: string;
  title: string;
  kind: string;
  summary?: string;
  sourceUri?: string;
  importedFromPath?: string;
  checkpoint?: TeamSourceCheckpointRef;
  transport?: SourceTransport;
  remote?: RemoteLlmSourceConfig;
  local?: LocalLlmSourceConfig;
  httpApi?: HttpApiSourceConfig;
  engine?: EngineSourceConfig;
};

/**
 * Default endpoint + auth + model hints for known providers. Operators can
 * override every field at registration time. Keys are never read or stored
 * here; we only carry the env-var name.
 */
export const REMOTE_LLM_PROVIDER_DEFAULTS: Record<RemoteLlmProvider, Partial<RemoteLlmSourceConfig>> = {
  openai: {
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    authEnvVar: "OPENAI_API_KEY",
  },
  anthropic: {
    endpoint: "https://api.anthropic.com/v1/messages",
    model: "claude-3-5-sonnet-latest",
    authEnvVar: "ANTHROPIC_API_KEY",
  },
  gemini: {
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models",
    model: "gemini-1.5-flash",
    authEnvVar: "GOOGLE_API_KEY",
  },
  mistral: {
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    model: "mistral-small-latest",
    authEnvVar: "MISTRAL_API_KEY",
  },
  groq: {
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.1-8b-instant",
    authEnvVar: "GROQ_API_KEY",
  },
  deepseek: {
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
    authEnvVar: "DEEPSEEK_API_KEY",
  },
  custom: {},
};

export const LOCAL_LLM_PROVIDER_DEFAULTS: Record<LocalLlmProvider, Partial<LocalLlmSourceConfig>> = {
  ollama: {
    binary: "ollama",
    endpoint: "http://127.0.0.1:11434",
  },
  "llama-cpp": {
    binary: "llama-cli",
    endpoint: "http://127.0.0.1:8080",
  },
  "lm-studio": {
    binary: "lms",
    endpoint: "http://127.0.0.1:1234",
  },
  mlx: {
    binary: "mlx_lm.server",
    endpoint: "http://127.0.0.1:8080",
  },
  vllm: {
    binary: "vllm",
    endpoint: "http://127.0.0.1:8000",
  },
  custom: {},
};

export type TeamUplTrackSnap = {
  takenAt: string;
  ledgerPath?: string;
  acceptanceCount?: number;
  denialCount?: number;
  digest?: string;
};

export type TeamManifest = {
  manifestVersion: typeof TEAM_MANIFEST_VERSION;
  slug: string;
  name: string;
  domain: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  brainSourceId: string;
  pathSourceCorpus: TeamSourceRef[];
  agents: TeamAgent[];
  uplTrackSnap: TeamUplTrackSnap;
  status: "draft" | "ready" | "running" | "stopped";
  notes?: string;
};

export type TeamSlug = string;

export type TeamRuntimePreparedSource = {
  sourceId: string;
  title: string;
  kind: string;
  charCount: number;
  lineCount: number;
  regionCount: number;
};

export type TeamRuntimePreparation = {
  preparedAt: string;
  teamId: string;
  teamStatus: TeamManifest["status"];
  peerCount: number;
  pathSourceCount: number;
  checkpointedSourceCount: number;
  totalCharCount: number;
  totalLineCount: number;
  canBrainPass: boolean;
  spokespersonAgentId?: string;
  sources: TeamRuntimePreparedSource[];
};

export function teamSlug(name: string): TeamSlug {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(/[^a-z0-9_-]+/g, "-")
    .replaceAll(/(^-+|-+$)/g, "")
    .replaceAll(/-{2,}/g, "-");
  if (slug.length === 0) {
    throw new Error(`Team name "${name}" has no usable slug characters`);
  }
  return slug;
}

export function teamsRoot(homePath: string): string {
  return path.join(homePath, "teams");
}

export function teamDir(homePath: string, slug: TeamSlug): string {
  return path.join(teamsRoot(homePath), slug);
}

export function teamManifestPath(homePath: string, slug: TeamSlug): string {
  return path.join(teamDir(homePath, slug), "manifest.json");
}

export function teamRuntimePath(homePath: string, slug: TeamSlug): string {
  return path.join(teamDir(homePath, slug), "runtime.json");
}

async function ensureDir(targetPath: string): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });
}

export async function listTeams(homePath: string): Promise<TeamManifest[]> {
  const root = teamsRoot(homePath);
  let entries: string[];
  try {
    entries = await fs.readdir(root);
  } catch {
    return [];
  }
  const out: TeamManifest[] = [];
  for (const entry of entries) {
    const manifestPath = teamManifestPath(homePath, entry);
    try {
      const raw = await fs.readFile(manifestPath, "utf8");
      const parsed = JSON.parse(raw) as TeamManifest;
      if (parsed.manifestVersion === TEAM_MANIFEST_VERSION) {
        out.push(parsed);
      }
    } catch {
      // ignore broken team folders; operator can clean them up
    }
  }
  out.sort((a, b) => a.slug.localeCompare(b.slug));
  return out;
}

export async function loadTeam(homePath: string, slug: TeamSlug): Promise<TeamManifest | null> {
  try {
    const raw = await fs.readFile(teamManifestPath(homePath, slug), "utf8");
    const parsed = JSON.parse(raw) as TeamManifest;
    if (parsed.manifestVersion !== TEAM_MANIFEST_VERSION) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function saveTeam(homePath: string, manifest: TeamManifest): Promise<void> {
  manifest.updatedAt = new Date().toISOString();
  const dir = teamDir(homePath, manifest.slug);
  await ensureDir(dir);
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await fs.writeFile(teamManifestPath(homePath, manifest.slug), manifestText, "utf8");
}

export async function loadTeamRuntimePreparation(
  homePath: string,
  slug: TeamSlug,
): Promise<TeamRuntimePreparation | null> {
  try {
    const raw = await fs.readFile(teamRuntimePath(homePath, slug), "utf8");
    return JSON.parse(raw) as TeamRuntimePreparation;
  } catch {
    return null;
  }
}

function teamCanBrainPassFromManifest(manifest: TeamManifest): boolean {
  const hasEngine = manifest.pathSourceCorpus.some((s) => s.transport === "engine");
  const hasAi = manifest.pathSourceCorpus.some(
    (s) => s.transport === "remote-llm" || s.transport === "local-llm",
  );
  const hasAgent = manifest.agents.length > 0;
  return hasEngine && hasAi && hasAgent;
}

function selectTeamSpokespersonAgentId(manifest: TeamManifest): string | undefined {
  return (
    manifest.agents.find((entry) => entry.ownsStep === "render")?.id ??
    manifest.agents.find((entry) => entry.ownsStep === "return")?.id ??
    manifest.agents.find((entry) => entry.ownsStep === "all")?.id ??
    manifest.agents[0]?.id
  );
}

export async function prepareTeamRuntime(args: {
  homePath: string;
  slug: TeamSlug;
  markReady?: boolean;
}): Promise<{ manifest: TeamManifest; preparation: TeamRuntimePreparation; wholeView: TeamWholeView }> {
  const manifest = await loadTeam(args.homePath, args.slug);
  if (!manifest) {
    throw new Error(`Team "${args.slug}" not found`);
  }
  const wholeView = await buildTeamWholeView({
    homePath: args.homePath,
    manifest,
  });
  if (args.markReady && manifest.status !== "running") {
    manifest.status = "ready";
    await saveTeam(args.homePath, manifest);
  }
  const preparation: TeamRuntimePreparation = {
    preparedAt: new Date().toISOString(),
    teamId: manifest.slug,
    teamStatus: manifest.status,
    peerCount: manifest.agents.length,
    pathSourceCount: wholeView.sourceCount,
    checkpointedSourceCount: wholeView.checkpointedSourceCount,
    totalCharCount: wholeView.totalCharCount,
    totalLineCount: wholeView.totalLineCount,
    canBrainPass: teamCanBrainPassFromManifest(manifest),
    spokespersonAgentId: selectTeamSpokespersonAgentId(manifest),
    sources: wholeView.sources.map((source) => ({
      sourceId: source.sourceId,
      title: source.title,
      kind: source.kind,
      charCount: source.charCount,
      lineCount: source.lineCount,
      regionCount: source.regionCount,
    })),
  };
  await fs.writeFile(teamRuntimePath(args.homePath, args.slug), `${JSON.stringify(preparation, null, 2)}\n`, "utf8");
  return { manifest, preparation, wholeView };
}

export async function deleteTeam(homePath: string, slug: TeamSlug): Promise<boolean> {
  const dir = teamDir(homePath, slug);
  try {
    await fs.rm(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

export type CreateTeamArgs = {
  homePath: string;
  name: string;
  domain: string;
  summary?: string;
  createdBy?: string;
  notes?: string;
  uplTrackSnap?: Partial<TeamUplTrackSnap>;
};

export async function createTeam(args: CreateTeamArgs): Promise<TeamManifest> {
  const slug = teamSlug(args.name);
  const existing = await loadTeam(args.homePath, slug);
  if (existing) {
    throw new Error(`Team "${slug}" already exists at ${teamDir(args.homePath, slug)}`);
  }

  const now = new Date().toISOString();
  const brain = brainSourceRef();
  const manifest: TeamManifest = {
    manifestVersion: TEAM_MANIFEST_VERSION,
    slug,
    name: args.name,
    domain: args.domain,
    summary: args.summary ?? `${args.name} — hyper-specialized team for ${args.domain}.`,
    createdAt: now,
    updatedAt: now,
    createdBy: args.createdBy,
    brainSourceId: UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE.id,
    pathSourceCorpus: [brain],
    agents: [],
    uplTrackSnap: {
      takenAt: now,
      ...(args.uplTrackSnap ?? {}),
    },
    status: "draft",
    notes: args.notes,
  };
  await saveTeam(args.homePath, manifest);
  return manifest;
}

export type AddAgentArgs = {
  homePath: string;
  slug: TeamSlug;
  agentId: string;
  title: string;
  specialty: string;
  modelHint?: string;
  ownsStep?: ComprehensionStageId;
  tools?: string[];
  sourceIds?: string[];
  memoryNotes?: string;
  spendCapNormalized?: number | null;
};

export async function addTeamAgent(args: AddAgentArgs): Promise<TeamManifest> {
  const manifest = await loadTeam(args.homePath, args.slug);
  if (!manifest) {
    throw new Error(`Team "${args.slug}" not found`);
  }
  if (manifest.agents.some((a) => a.id === args.agentId)) {
    throw new Error(`Team "${args.slug}" already has agent "${args.agentId}"`);
  }
  const ownsStep: ComprehensionStageId = args.ownsStep ?? "all";
  if (!COMPREHENSION_STAGE_IDS.includes(ownsStep)) {
    throw new Error(`Unknown comprehension stage "${ownsStep}". Allowed: ${COMPREHENSION_STAGE_IDS.join(", ")}`);
  }

  const requestedSources = args.sourceIds ?? [];
  for (const sourceId of requestedSources) {
    if (!manifest.pathSourceCorpus.some((s) => s.id === sourceId)) {
      throw new Error(
        `Source "${sourceId}" is not in this team's corpus. Add it with \`buccet create add-source ${args.slug} <file>\` first.`,
      );
    }
  }

  const sourceIds = uniqueIds([UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE.id, ...requestedSources]);
  const agent: TeamAgent = {
    id: args.agentId,
    title: args.title,
    specialty: args.specialty,
    modelHint: args.modelHint,
    ownsStep,
    tools: uniqueIds(args.tools ?? []),
    sourceIds,
    memoryNotes: args.memoryNotes,
    spend: {
      capNormalized: args.spendCapNormalized ?? null,
      spentNormalized: 0,
    },
  };
  manifest.agents.push(agent);
  manifest.status = "draft";
  await saveTeam(args.homePath, manifest);
  return manifest;
}

export async function removeTeamAgent(args: {
  homePath: string;
  slug: TeamSlug;
  agentId: string;
}): Promise<TeamManifest> {
  const manifest = await loadTeam(args.homePath, args.slug);
  if (!manifest) {
    throw new Error(`Team "${args.slug}" not found`);
  }
  const before = manifest.agents.length;
  manifest.agents = manifest.agents.filter((a) => a.id !== args.agentId);
  if (manifest.agents.length === before) {
    throw new Error(`Team "${args.slug}" has no agent "${args.agentId}"`);
  }
  await saveTeam(args.homePath, manifest);
  return manifest;
}

export type AddSourceArgs = {
  homePath: string;
  slug: TeamSlug;
  filePath: string;
  title?: string;
  kind?: string;
  summary?: string;
};

export async function addTeamSource(args: AddSourceArgs): Promise<TeamManifest> {
  const manifest = await loadTeam(args.homePath, args.slug);
  if (!manifest) {
    throw new Error(`Team "${args.slug}" not found`);
  }
  const resolved = path.resolve(args.filePath);
  let content: string;
  try {
    content = await fs.readFile(resolved, "utf8");
  } catch (error) {
    throw new Error(`Cannot read source "${resolved}": ${error instanceof Error ? error.message : String(error)}`);
  }
  const sourceId = synthesizeSourceId(resolved, content);
  if (manifest.pathSourceCorpus.some((s) => s.id === sourceId)) {
    throw new Error(`Source "${sourceId}" is already in team "${args.slug}".`);
  }
  const ext = path.extname(resolved).slice(1) || "text";
  const checkpointBuilt = buildTeamSourceCheckpoint({
    sourceId,
    title: args.title ?? path.basename(resolved),
    kind: args.kind ?? `file:${ext}`,
    content,
    sourceUri: `file://${resolved}`,
    importedFromPath: resolved,
    summary: args.summary ?? `Imported from ${resolved}`,
  });
  await persistTeamSourceCheckpoint({
    homePath: args.homePath,
    slug: args.slug,
    checkpoint: checkpointBuilt.checkpoint,
  });
  const ref: TeamSourceRef = {
    id: sourceId,
    title: args.title ?? path.basename(resolved),
    kind: args.kind ?? `file:${ext}`,
    summary: args.summary ?? `Imported from ${resolved}`,
    sourceUri: `file://${resolved}`,
    importedFromPath: resolved,
    checkpoint: checkpointBuilt.ref,
  };
  manifest.pathSourceCorpus.push(ref);
  await saveTeam(args.homePath, manifest);
  return manifest;
}

export type AddRemoteLlmSourceArgs = {
  homePath: string;
  slug: TeamSlug;
  provider: RemoteLlmProvider;
  endpoint?: string;
  model?: string;
  authEnvVar?: string;
  rateCapPerMinute?: number;
  defaultParams?: Record<string, unknown>;
  title?: string;
  summary?: string;
};

export async function addTeamRemoteLlmSource(args: AddRemoteLlmSourceArgs): Promise<TeamManifest> {
  const manifest = await loadTeam(args.homePath, args.slug);
  if (!manifest) throw new Error(`Team "${args.slug}" not found`);

  const defaults = REMOTE_LLM_PROVIDER_DEFAULTS[args.provider] ?? {};
  const endpoint = args.endpoint ?? defaults.endpoint;
  const model = args.model ?? defaults.model;
  if (!endpoint) {
    throw new Error(`Provider "${args.provider}" has no default endpoint; pass --endpoint`);
  }
  if (!model) {
    throw new Error(`Provider "${args.provider}" has no default model; pass --model`);
  }
  const authEnvVar = args.authEnvVar ?? defaults.authEnvVar;

  const remote: RemoteLlmSourceConfig = {
    provider: args.provider,
    endpoint,
    model,
    ...(authEnvVar ? { authEnvVar } : {}),
    ...(args.rateCapPerMinute !== undefined ? { rateCapPerMinute: args.rateCapPerMinute } : {}),
    ...(args.defaultParams ? { defaultParams: args.defaultParams } : {}),
  };
  const sourceId = synthesizeRemoteSourceId(remote);
  if (manifest.pathSourceCorpus.some((s) => s.id === sourceId)) {
    throw new Error(`Source "${sourceId}" is already in team "${args.slug}".`);
  }
  const ref: TeamSourceRef = {
    id: sourceId,
    title: args.title ?? `${args.provider}:${model}`,
    kind: `remote-llm:${args.provider}`,
    summary: args.summary ?? `Remote LLM via ${args.provider} at ${endpoint}, model ${model}.`,
    sourceUri: endpoint,
    transport: "remote-llm",
    remote,
  };
  manifest.pathSourceCorpus.push(ref);
  await saveTeam(args.homePath, manifest);
  return manifest;
}

export type AddLocalLlmSourceArgs = {
  homePath: string;
  slug: TeamSlug;
  provider: LocalLlmProvider;
  binary?: string;
  endpoint?: string;
  model: string;
  defaultParams?: Record<string, unknown>;
  title?: string;
  summary?: string;
};

export type AddTeamHttpApiSourceArgs = {
  homePath: string;
  slug: TeamSlug;
  provider: HttpApiProvider;
  endpoint?: string;
  method?: "GET" | "POST";
  authEnvVar?: string;
  rateCapPerMinute?: number;
  defaultHeaders?: Record<string, string>;
  title?: string;
  summary?: string;
};

export async function addTeamHttpApiSource(args: AddTeamHttpApiSourceArgs): Promise<TeamManifest> {
  const manifest = await loadTeam(args.homePath, args.slug);
  if (!manifest) throw new Error(`Team "${args.slug}" not found`);

  const defaults = HTTP_API_PROVIDER_DEFAULTS[args.provider] ?? {};
  const endpoint = args.endpoint ?? defaults.endpoint;
  if (!endpoint) {
    throw new Error(
      `HTTP provider "${args.provider}" has no bundled default endpoint; pass --endpoint <url> (examples: cluster URL for Qdrant/Weaviate/Algolia).`,
    );
  }
  const authEnvVar = args.authEnvVar ?? defaults.authEnvVar;
  const method = args.method ?? defaults.method ?? ("POST" as const);

  const httpApi: HttpApiSourceConfig = {
    provider: args.provider,
    endpoint,
    method,
    ...(authEnvVar ? { authEnvVar } : {}),
    ...(args.rateCapPerMinute !== undefined ? { rateCapPerMinute: args.rateCapPerMinute } : {}),
    ...(args.defaultHeaders ? { defaultHeaders: args.defaultHeaders } : {}),
  };

  const sourceId = synthesizeHttpApiSourceId(httpApi);
  if (manifest.pathSourceCorpus.some((s) => s.id === sourceId)) {
    throw new Error(`Source "${sourceId}" is already in team "${args.slug}".`);
  }

  let titleHost = String(args.provider);
  try {
    titleHost = new URL(endpoint).hostname;
  } catch {
    titleHost = String(args.provider);
  }

  const ref: TeamSourceRef = {
    id: sourceId,
    title: args.title ?? `${args.provider}:${titleHost}`,
    kind: `http-api:${args.provider}`,
    summary:
      args.summary ??
      `HTTP knowledge / retrieval (${args.provider}) at ${endpoint}; calls flow as network.send, gated by UPL.`,
    sourceUri: endpoint,
    transport: "http-api",
    httpApi,
  };
  manifest.pathSourceCorpus.push(ref);
  await saveTeam(args.homePath, manifest);
  return manifest;
}

export async function addTeamLocalLlmSource(args: AddLocalLlmSourceArgs): Promise<TeamManifest> {
  const manifest = await loadTeam(args.homePath, args.slug);
  if (!manifest) throw new Error(`Team "${args.slug}" not found`);

  const defaults = LOCAL_LLM_PROVIDER_DEFAULTS[args.provider] ?? {};
  const binary = args.binary ?? defaults.binary;
  const endpoint = args.endpoint ?? defaults.endpoint;
  if (!args.model) {
    throw new Error(`Local provider "${args.provider}" requires --model`);
  }

  const local: LocalLlmSourceConfig = {
    provider: args.provider,
    ...(binary ? { binary } : {}),
    ...(endpoint ? { endpoint } : {}),
    model: args.model,
    ...(args.defaultParams ? { defaultParams: args.defaultParams } : {}),
  };
  const sourceId = synthesizeLocalSourceId(local);
  if (manifest.pathSourceCorpus.some((s) => s.id === sourceId)) {
    throw new Error(`Source "${sourceId}" is already in team "${args.slug}".`);
  }
  const ref: TeamSourceRef = {
    id: sourceId,
    title: args.title ?? `${args.provider}:${args.model}`,
    kind: `local-llm:${args.provider}`,
    summary: args.summary ?? `Local LLM via ${args.provider}${binary ? ` (${binary})` : ""}${endpoint ? ` at ${endpoint}` : ""}, model ${args.model}.`,
    sourceUri: endpoint ?? `local://${args.provider}/${args.model}`,
    transport: "local-llm",
    local,
  };
  manifest.pathSourceCorpus.push(ref);
  await saveTeam(args.homePath, manifest);
  return manifest;
}

export type AddEngineSourceArgs = {
  homePath: string;
  slug: TeamSlug;
  provider: EngineProvider;
  agentCorePackage?: string;
  aiPackage?: string;
  toolExecution?: "parallel" | "sequential";
  allowedTools?: string[];
  installPath?: string;
  title?: string;
  summary?: string;
  notes?: string;
};

export async function addTeamEngineSource(args: AddEngineSourceArgs): Promise<TeamManifest> {
  const manifest = await loadTeam(args.homePath, args.slug);
  if (!manifest) throw new Error(`Team "${args.slug}" not found`);

  const defaults = ENGINE_PROVIDER_DEFAULTS[args.provider] ?? ENGINE_PROVIDER_DEFAULTS.custom;
  const engine: EngineSourceConfig = {
    provider: args.provider,
    ...(args.agentCorePackage ?? defaults.agentCorePackage
      ? { agentCorePackage: args.agentCorePackage ?? defaults.agentCorePackage }
      : {}),
    ...(args.aiPackage ?? defaults.aiPackage
      ? { aiPackage: args.aiPackage ?? defaults.aiPackage }
      : {}),
    toolExecution: args.toolExecution ?? defaults.toolExecution ?? "parallel",
    allowedTools: args.allowedTools ?? defaults.allowedTools ?? [],
    ...(args.installPath ? { installPath: args.installPath } : {}),
    ...(args.notes ? { notes: args.notes } : {}),
  };

  // The team can have at most one engine source: hands are singular.
  const existingEngine = manifest.pathSourceCorpus.find((s) => s.transport === "engine");
  if (existingEngine) {
    throw new Error(
      `Team "${args.slug}" already has an engine source (${existingEngine.kind}). Remove it first with \`buccet create remove-source ${args.slug} --id ${existingEngine.id}\`.`,
    );
  }

  const sourceId = synthesizeEngineSourceId(engine);
  const ref: TeamSourceRef = {
    id: sourceId,
    title: args.title ?? args.provider,
    kind: `engine:${args.provider}`,
    summary:
      args.summary ??
      `Execution engine via ${args.provider}. Hands of the brain — every tool call routed through Buccet's boundary before execution.${
        engine.agentCorePackage ? ` Peer dep: ${engine.agentCorePackage}.` : ""
      }`,
    sourceUri: engine.agentCorePackage ? `npm:${engine.agentCorePackage}` : `engine:${args.provider}`,
    transport: "engine",
    engine,
  };
  manifest.pathSourceCorpus.push(ref);
  await saveTeam(args.homePath, manifest);
  return manifest;
}

export async function removeTeamSource(args: {
  homePath: string;
  slug: TeamSlug;
  sourceId: string;
}): Promise<TeamManifest> {
  if (args.sourceId === UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE.id) {
    throw new Error("The brain source is auto-injected and cannot be removed from a team.");
  }
  const manifest = await loadTeam(args.homePath, args.slug);
  if (!manifest) {
    throw new Error(`Team "${args.slug}" not found`);
  }
  const removed = manifest.pathSourceCorpus.find((s) => s.id === args.sourceId);
  const before = manifest.pathSourceCorpus.length;
  manifest.pathSourceCorpus = manifest.pathSourceCorpus.filter((s) => s.id !== args.sourceId);
  if (manifest.pathSourceCorpus.length === before) {
    throw new Error(`Team "${args.slug}" has no source "${args.sourceId}"`);
  }
  for (const agent of manifest.agents) {
    agent.sourceIds = agent.sourceIds.filter((id) => id !== args.sourceId);
  }
  await deleteTeamSourceCheckpoint({
    homePath: args.homePath,
    slug: args.slug,
    ref: removed?.checkpoint,
  });
  await saveTeam(args.homePath, manifest);
  return manifest;
}

function brainSourceRef(): TeamSourceRef {
  return {
    id: UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE.id,
    title: UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE.title,
    kind: UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE.kind,
    summary: UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE.summary,
    sourceUri: UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE.sourceUri,
  };
}

function uniqueIds(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function synthesizeSourceId(filePath: string, content: string): string {
  const digest = createHash("sha256").update(`${filePath}::${content.length}`).update(content).digest("hex").slice(0, 16);
  return `team-source-${digest}`;
}

function synthesizeRemoteSourceId(remote: RemoteLlmSourceConfig): string {
  const digest = createHash("sha256")
    .update(`remote-llm::${remote.provider}::${remote.endpoint}::${remote.model}`)
    .digest("hex")
    .slice(0, 16);
  return `team-source-remote-${digest}`;
}

function synthesizeLocalSourceId(local: LocalLlmSourceConfig): string {
  const digest = createHash("sha256")
    .update(`local-llm::${local.provider}::${local.binary ?? ""}::${local.endpoint ?? ""}::${local.model}`)
    .digest("hex")
    .slice(0, 16);
  return `team-source-local-${digest}`;
}

function synthesizeEngineSourceId(engine: EngineSourceConfig): string {
  const digest = createHash("sha256")
    .update(
      `engine::${engine.provider}::${engine.agentCorePackage ?? ""}::${engine.aiPackage ?? ""}`,
    )
    .digest("hex")
    .slice(0, 16);
  return `team-source-engine-${digest}`;
}

function synthesizeHttpApiSourceId(cfg: HttpApiSourceConfig): string {
  const digest = createHash("sha256")
    .update(`http-api::${cfg.provider ?? "custom"}::${cfg.endpoint}::${cfg.method ?? "POST"}`)
    .digest("hex")
    .slice(0, 16);
  return `team-source-http-${digest}`;
}

export function expandTeamPathSourcesForFormation(
  manifest: TeamManifest,
  resolvers: Map<string, BuccetPathSource>,
): BuccetPathSource[] {
  const out: BuccetPathSource[] = [UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE];
  for (const ref of manifest.pathSourceCorpus) {
    if (ref.id === UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE.id) continue;
    const resolved = resolvers.get(ref.id);
    if (resolved) {
      out.push(resolved);
    } else {
      out.push({
        id: ref.id,
        title: ref.title,
        kind: ref.kind,
        content: ref.summary ?? "(content not yet expanded)",
        summary: ref.summary,
        sourceUri: ref.sourceUri,
      });
    }
  }
  return out;
}
