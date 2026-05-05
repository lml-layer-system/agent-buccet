import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  type BuccetPathSource,
  SPENDING_AGENT_VALUE_BOUNDARY_SOURCE,
  UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE,
  isBuiltinTeamBrainSourceId,
  resolveTeamBrainPathSource,
} from "./../context/path-memory.ts";
import {
  type TeamSourceCheckpointBody,
  type TeamSourceCheckpointRef,
  type TeamWholeView,
  buildTeamSourceCheckpoint,
  buildTeamWholeView,
  deleteTeamSourceCheckpoint,
  loadTeamSourceCheckpoint,
  persistTeamSourceCheckpoint,
  teamCheckpointRoot,
} from "./../context/path-source-checkpoints.ts";
import { AGENT_TEAM_STAGE_IDS, type AgentTeamStageId } from "./agent-comprehension-engine.ts";

/**
 * Team Workshop — the operator-facing surface for creating hyper-specialized
 * agent teams on the creativity face of Buccet.
 *
 * A team is a saved, named slice of the Buccet substrate:
 *  - a domain
 *  - a roster of peer agents (each with model hint, --owns-step, source slice,
 *    spend cap)
 *  - a brain instance (Universal Agent Comprehension Process for workshop teams,
 *    or the spend value-boundary brain for SPEND Buccets; auto-injected per class)
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

export type TeamInternalSourceRole = "brain" | "work_memory";

/**
 * Transport tells the runtime what a path source IS and how Buccet wires
 * it into the boundary surface:
 *
 *  - file        : on-disk markdown / code / json (the original path-source kind)
 *  - remote-llm  : remote inference endpoint (Anthropic, OpenAI, Gemini, ...)
 *  - local-llm   : local inference runtime (Ollama, llama.cpp, LM Studio, ...)
 *  - http-api    : generic HTTP knowledge endpoint (vector DBs, search, RAG)
 *  - engine      : the singular execution engine — Pi today — that runs as
 *                  the team's HANDS. The brain (spend boundary + AI/LLM + library)
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

export type RemoteLlmProvider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "mistral"
  | "groq"
  | "deepseek"
  | "custom";

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
  internalRole?: TeamInternalSourceRole;
  transport?: SourceTransport;
  remote?: RemoteLlmSourceConfig;
  local?: LocalLlmSourceConfig;
  httpApi?: HttpApiSourceConfig;
  engine?: EngineSourceConfig;
};

export type TeamPathSourceMemoryRecord = {
  id: string;
  kind: string;
  at: string;
  team: string;
  title: string;
  text: string;
  meta?: Record<string, unknown>;
};

/**
 * Default endpoint + auth + model hints for known providers. Operators can
 * override every field at registration time. Keys are never read or stored
 * here; we only carry the env-var name.
 */
export const REMOTE_LLM_PROVIDER_DEFAULTS: Record<
  RemoteLlmProvider,
  Partial<RemoteLlmSourceConfig>
> = {
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

export const LOCAL_LLM_PROVIDER_DEFAULTS: Record<
  LocalLlmProvider,
  Partial<LocalLlmSourceConfig>
> = {
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
  /**
   * When "spend", this Buccet is for agents that move real money or create financial obligations.
   * UPL / agent.spend rails are the control plane; not a general creative-only slice.
   */
  buccetClass?: "spend";
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

export type TeamContinuitySnapshotTrigger = {
  recordId: string;
  kind: string;
  title: string;
  at: string;
};

export type TeamContinuitySnapshotMeta = {
  schemaVersion: 1;
  snapshotId: string;
  teamId: string;
  at: string;
  trigger: TeamContinuitySnapshotTrigger;
  teamStatus: TeamManifest["status"];
  pathSourceCount: number;
  agentCount: number;
  checkpointCount: number;
  workMemoryRecordCount: number;
};

export type TeamContinuitySnapshot = {
  schemaVersion: 1;
  snapshotId: string;
  teamId: string;
  at: string;
  trigger: TeamContinuitySnapshotTrigger;
  manifest: TeamManifest;
  runtimePreparation: TeamRuntimePreparation | null;
  workMemoryBody: string;
  sourceCheckpoints: Array<{
    sourceId: string;
    checkpoint: TeamSourceCheckpointBody;
  }>;
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

export function teamWorkMemoryPath(homePath: string, slug: TeamSlug): string {
  return path.join(teamDir(homePath, slug), "path-source-memory.jsonl");
}

export function teamContinuityRoot(homePath: string, slug: TeamSlug): string {
  return path.join(teamDir(homePath, slug), "continuity");
}

export function teamContinuityIndexPath(homePath: string, slug: TeamSlug): string {
  return path.join(teamContinuityRoot(homePath, slug), "index.jsonl");
}

function teamContinuitySnapshotPath(homePath: string, slug: TeamSlug, snapshotId: string): string {
  return path.join(teamContinuityRoot(homePath, slug), `${snapshotId}.json`);
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
  await writeTeamManifestExact(homePath, manifest);
}

async function writeTeamManifestExact(homePath: string, manifest: TeamManifest): Promise<void> {
  const dir = teamDir(homePath, manifest.slug);
  await ensureDir(dir);
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await fs.writeFile(teamManifestPath(homePath, manifest.slug), manifestText, "utf8");
}

async function writeTeamRuntimePreparationExact(
  homePath: string,
  slug: TeamSlug,
  preparation: TeamRuntimePreparation | null,
): Promise<void> {
  const targetPath = teamRuntimePath(homePath, slug);
  await ensureDir(path.dirname(targetPath));
  if (!preparation) {
    await fs.rm(targetPath, { force: true });
    return;
  }
  await fs.writeFile(targetPath, `${JSON.stringify(preparation, null, 2)}\n`, "utf8");
}

export function teamWorkMemorySourceId(slug: TeamSlug): string {
  return `team-work-memory-${slug}`;
}

export function isSharedInternalTeamSourceId(sourceId: string): boolean {
  return isBuiltinTeamBrainSourceId(sourceId) || sourceId.startsWith("team-work-memory-");
}

/** Effective brain id for runtime / Pi / formation (SPEND class always uses the value-boundary brain). */
export function teamManifestBrainSourceId(manifest: TeamManifest): string {
  if (manifest.buccetClass === "spend") {
    return SPENDING_AGENT_VALUE_BOUNDARY_SOURCE.id;
  }
  return manifest.brainSourceId;
}

function teamWorkMemorySourceUri(slug: TeamSlug): string {
  return `buccet://team/${slug}/path-source-memory`;
}

function teamWorkMemorySourceSummary(slug: TeamSlug, updatedAt?: string): string {
  if (updatedAt) {
    return `Durable path-source work memory for ${slug}; last committed at ${updatedAt}.`;
  }
  return `Durable path-source work memory for ${slug}; Pi commits proof-of-work and operator history here.`;
}

function buildTeamWorkMemorySourceRef(args: {
  slug: TeamSlug;
  checkpoint: TeamSourceCheckpointRef;
  updatedAt?: string;
}): TeamSourceRef {
  return {
    id: teamWorkMemorySourceId(args.slug),
    title: "Buccet Path-Source Memory",
    kind: "memory:path-source",
    summary: teamWorkMemorySourceSummary(args.slug, args.updatedAt),
    sourceUri: teamWorkMemorySourceUri(args.slug),
    checkpoint: args.checkpoint,
    internalRole: "work_memory",
  };
}

async function writeTeamWorkMemoryCheckpoint(args: {
  homePath: string;
  manifest: TeamManifest;
  body: string;
  updatedAt?: string;
}): Promise<TeamSourceRef> {
  const built = buildTeamSourceCheckpoint({
    sourceId: teamWorkMemorySourceId(args.manifest.slug),
    title: "Buccet Path-Source Memory",
    kind: "memory:path-source",
    content: args.body,
    sourceUri: teamWorkMemorySourceUri(args.manifest.slug),
    summary: teamWorkMemorySourceSummary(args.manifest.slug, args.updatedAt),
  });
  await persistTeamSourceCheckpoint({
    homePath: args.homePath,
    slug: args.manifest.slug,
    checkpoint: built.checkpoint,
  });
  return buildTeamWorkMemorySourceRef({
    slug: args.manifest.slug,
    checkpoint: built.ref,
    updatedAt: args.updatedAt,
  });
}

export async function ensureTeamWorkMemorySource(args: {
  homePath: string;
  manifest: TeamManifest;
}): Promise<{ manifest: TeamManifest; source: TeamSourceRef }> {
  const targetPath = teamWorkMemoryPath(args.homePath, args.manifest.slug);
  let body = "";
  try {
    body = await fs.readFile(targetPath, "utf8");
  } catch {
    body = "";
  }
  await ensureDir(path.dirname(targetPath));
  try {
    await fs.access(targetPath);
  } catch {
    await fs.writeFile(targetPath, "", "utf8");
  }

  const source = await writeTeamWorkMemoryCheckpoint({
    homePath: args.homePath,
    manifest: args.manifest,
    body,
  });

  let changed = false;
  const existingIndex = args.manifest.pathSourceCorpus.findIndex((ref) => ref.id === source.id);
  if (existingIndex === -1) {
    args.manifest.pathSourceCorpus.push(source);
    changed = true;
  } else {
    const existing = args.manifest.pathSourceCorpus[existingIndex]!;
    const next = { ...existing, ...source };
    if (JSON.stringify(existing) !== JSON.stringify(next)) {
      args.manifest.pathSourceCorpus[existingIndex] = next;
      changed = true;
    }
  }
  for (const agent of args.manifest.agents) {
    const next = uniqueIds([source.id, ...agent.sourceIds]);
    if (JSON.stringify(next) !== JSON.stringify(agent.sourceIds)) {
      agent.sourceIds = next;
      changed = true;
    }
  }
  if (changed) {
    await saveTeam(args.homePath, args.manifest);
  }
  return { manifest: args.manifest, source };
}

function nextTeamWorkMemoryRecordId(): string {
  return `work-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nextTeamContinuitySnapshotId(record: TeamPathSourceMemoryRecord): string {
  const stamp = record.at.replaceAll(/[:.]/g, "-");
  return `snapshot-${stamp}-${record.id}`;
}

function countJsonlRecords(body: string): number {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

async function captureTeamContinuitySnapshot(args: {
  homePath: string;
  manifest: TeamManifest;
  record: TeamPathSourceMemoryRecord;
  workMemoryBody: string;
}): Promise<TeamContinuitySnapshotMeta> {
  const runtimePreparation = await loadTeamRuntimePreparation(args.homePath, args.manifest.slug);
  const sourceCheckpoints: TeamContinuitySnapshot["sourceCheckpoints"] = [];
  for (const source of args.manifest.pathSourceCorpus) {
    if (!source.checkpoint) continue;
    const checkpoint = await loadTeamSourceCheckpoint({
      homePath: args.homePath,
      slug: args.manifest.slug,
      ref: source.checkpoint,
    });
    if (!checkpoint) continue;
    sourceCheckpoints.push({
      sourceId: source.id,
      checkpoint,
    });
  }

  const snapshotId = nextTeamContinuitySnapshotId(args.record);
  const snapshot: TeamContinuitySnapshot = {
    schemaVersion: 1,
    snapshotId,
    teamId: args.manifest.slug,
    at: args.record.at,
    trigger: {
      recordId: args.record.id,
      kind: args.record.kind,
      title: args.record.title,
      at: args.record.at,
    },
    manifest: JSON.parse(JSON.stringify(args.manifest)) as TeamManifest,
    runtimePreparation,
    workMemoryBody: args.workMemoryBody,
    sourceCheckpoints,
  };
  const meta: TeamContinuitySnapshotMeta = {
    schemaVersion: 1,
    snapshotId,
    teamId: args.manifest.slug,
    at: args.record.at,
    trigger: snapshot.trigger,
    teamStatus: args.manifest.status,
    pathSourceCount: args.manifest.pathSourceCorpus.length,
    agentCount: args.manifest.agents.length,
    checkpointCount: sourceCheckpoints.length,
    workMemoryRecordCount: countJsonlRecords(args.workMemoryBody),
  };

  const root = teamContinuityRoot(args.homePath, args.manifest.slug);
  await ensureDir(root);
  await fs.writeFile(
    teamContinuitySnapshotPath(args.homePath, args.manifest.slug, snapshotId),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8",
  );
  await fs.appendFile(
    teamContinuityIndexPath(args.homePath, args.manifest.slug),
    `${JSON.stringify(meta)}\n`,
    "utf8",
  );
  return meta;
}

async function commitTeamStructuralMemory(args: {
  homePath: string;
  slug: TeamSlug;
  kind: string;
  title: string;
  text: string;
  meta?: Record<string, unknown>;
}): Promise<TeamManifest> {
  const appended = await appendTeamPathSourceMemoryEntry({
    homePath: args.homePath,
    slug: args.slug,
    kind: args.kind,
    title: args.title,
    text: args.text,
    ...(args.meta ? { meta: args.meta } : {}),
  });
  return appended.manifest;
}

export async function appendTeamPathSourceMemoryEntry(args: {
  homePath: string;
  slug: TeamSlug;
  kind: string;
  title: string;
  text: string;
  meta?: Record<string, unknown>;
}): Promise<{ manifest: TeamManifest; source: TeamSourceRef; record: TeamPathSourceMemoryRecord }> {
  const manifest = await loadTeam(args.homePath, args.slug);
  if (!manifest) {
    throw new Error(`Team "${args.slug}" not found`);
  }
  const ensured = await ensureTeamWorkMemorySource({
    homePath: args.homePath,
    manifest,
  });
  const record: TeamPathSourceMemoryRecord = {
    id: nextTeamWorkMemoryRecordId(),
    kind: args.kind,
    at: new Date().toISOString(),
    team: args.slug,
    title: args.title,
    text: args.text,
    ...(args.meta ? { meta: args.meta } : {}),
  };
  const targetPath = teamWorkMemoryPath(args.homePath, args.slug);
  await fs.appendFile(targetPath, `${JSON.stringify(record)}\n`, "utf8");
  const body = await fs.readFile(targetPath, "utf8");
  const source = await writeTeamWorkMemoryCheckpoint({
    homePath: args.homePath,
    manifest: ensured.manifest,
    body,
    updatedAt: record.at,
  });
  const index = ensured.manifest.pathSourceCorpus.findIndex((ref) => ref.id === source.id);
  if (index === -1) {
    ensured.manifest.pathSourceCorpus.push(source);
  } else {
    ensured.manifest.pathSourceCorpus[index] = {
      ...ensured.manifest.pathSourceCorpus[index]!,
      ...source,
    };
  }
  await saveTeam(args.homePath, ensured.manifest);
  await captureTeamContinuitySnapshot({
    homePath: args.homePath,
    manifest: ensured.manifest,
    record,
    workMemoryBody: body,
  });
  return { manifest: ensured.manifest, source, record };
}

export async function readTeamPathSourceMemoryEntries(
  homePath: string,
  slug: TeamSlug,
): Promise<TeamPathSourceMemoryRecord[]> {
  try {
    const raw = await fs.readFile(teamWorkMemoryPath(homePath, slug), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as TeamPathSourceMemoryRecord);
  } catch {
    return [];
  }
}

export async function listTeamContinuitySnapshots(
  homePath: string,
  slug: TeamSlug,
): Promise<TeamContinuitySnapshotMeta[]> {
  try {
    const raw = await fs.readFile(teamContinuityIndexPath(homePath, slug), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as TeamContinuitySnapshotMeta)
      .sort((left, right) => left.at.localeCompare(right.at));
  } catch {
    return [];
  }
}

export async function loadTeamContinuitySnapshot(args: {
  homePath: string;
  slug: TeamSlug;
  snapshotId: string;
}): Promise<TeamContinuitySnapshot | null> {
  try {
    const raw = await fs.readFile(
      teamContinuitySnapshotPath(args.homePath, args.slug, args.snapshotId),
      "utf8",
    );
    return JSON.parse(raw) as TeamContinuitySnapshot;
  } catch {
    return null;
  }
}

export async function rollbackTeamToContinuitySnapshot(args: {
  homePath: string;
  slug: TeamSlug;
  snapshotId: string;
}): Promise<{ manifest: TeamManifest; snapshot: TeamContinuitySnapshot }> {
  const snapshot = await loadTeamContinuitySnapshot(args);
  if (!snapshot) {
    throw new Error(`Continuity snapshot "${args.snapshotId}" not found for team "${args.slug}".`);
  }
  if (snapshot.teamId !== args.slug) {
    throw new Error(
      `Continuity snapshot "${args.snapshotId}" belongs to "${snapshot.teamId}", not "${args.slug}".`,
    );
  }
  await ensureDir(teamDir(args.homePath, args.slug));
  await fs.writeFile(teamWorkMemoryPath(args.homePath, args.slug), snapshot.workMemoryBody, "utf8");
  await fs.rm(teamCheckpointRoot(args.homePath, args.slug), { recursive: true, force: true });
  for (const entry of snapshot.sourceCheckpoints) {
    await persistTeamSourceCheckpoint({
      homePath: args.homePath,
      slug: args.slug,
      checkpoint: entry.checkpoint,
    });
  }
  await writeTeamRuntimePreparationExact(args.homePath, args.slug, snapshot.runtimePreparation);
  await writeTeamManifestExact(args.homePath, snapshot.manifest);
  return {
    manifest: snapshot.manifest,
    snapshot,
  };
}

export async function cherryPickTeamSnapshotSources(args: {
  homePath: string;
  slug: TeamSlug;
  snapshotId: string;
  sourceIds: string[];
}): Promise<{
  manifest: TeamManifest;
  snapshot: TeamContinuitySnapshot;
  sources: TeamSourceRef[];
}> {
  const snapshot = await loadTeamContinuitySnapshot({
    homePath: args.homePath,
    slug: args.slug,
    snapshotId: args.snapshotId,
  });
  if (!snapshot) {
    throw new Error(`Continuity snapshot "${args.snapshotId}" not found for team "${args.slug}".`);
  }
  const manifest = await loadTeam(args.homePath, args.slug);
  if (!manifest) {
    throw new Error(`Team "${args.slug}" not found`);
  }
  const requested = uniqueIds(args.sourceIds);
  if (requested.length === 0) {
    throw new Error("Cherry-pick requires at least one source id.");
  }
  const cherryPicked: TeamSourceRef[] = [];
  for (const sourceId of requested) {
    const source = snapshot.manifest.pathSourceCorpus.find((entry) => entry.id === sourceId);
    if (!source) {
      throw new Error(`Snapshot "${args.snapshotId}" has no source "${sourceId}".`);
    }
    if (source.internalRole === "brain" || source.internalRole === "work_memory") {
      throw new Error(`Source "${sourceId}" is internal to Buccet and cannot be cherry-picked.`);
    }
    if (source.checkpoint) {
      const checkpointEntry = snapshot.sourceCheckpoints.find(
        (entry) => entry.sourceId === sourceId,
      );
      if (!checkpointEntry) {
        throw new Error(
          `Snapshot "${args.snapshotId}" is missing checkpoint body for "${sourceId}".`,
        );
      }
      await persistTeamSourceCheckpoint({
        homePath: args.homePath,
        slug: args.slug,
        checkpoint: checkpointEntry.checkpoint,
      });
    }
    const copy = JSON.parse(JSON.stringify(source)) as TeamSourceRef;
    const existingIndex = manifest.pathSourceCorpus.findIndex((entry) => entry.id === sourceId);
    if (existingIndex === -1) {
      manifest.pathSourceCorpus.push(copy);
    } else {
      manifest.pathSourceCorpus[existingIndex] = copy;
    }
    cherryPicked.push(copy);
  }
  manifest.status = "draft";
  await saveTeam(args.homePath, manifest);
  const updatedManifest = await commitTeamStructuralMemory({
    homePath: args.homePath,
    slug: args.slug,
    kind: "source_cherry_picked",
    title: `source_cherry_picked:${args.snapshotId}`,
    text:
      `Cherry-picked ${cherryPicked.length} source${cherryPicked.length === 1 ? "" : "s"} from continuity snapshot ${args.snapshotId} into ${args.slug}: ` +
      `${cherryPicked.map((source) => `${source.title} (${source.id})`).join(", ")}.`,
    meta: {
      snapshotId: args.snapshotId,
      sourceIds: cherryPicked.map((source) => source.id),
      sourceKinds: cherryPicked.map((source) => source.kind),
    },
  });
  return {
    manifest: updatedManifest,
    snapshot,
    sources: cherryPicked,
  };
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
}): Promise<{
  manifest: TeamManifest;
  preparation: TeamRuntimePreparation;
  wholeView: TeamWholeView;
}> {
  let manifest = await loadTeam(args.homePath, args.slug);
  if (!manifest) {
    throw new Error(`Team "${args.slug}" not found`);
  }
  manifest = (
    await ensureTeamWorkMemorySource({
      homePath: args.homePath,
      manifest,
    })
  ).manifest;
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
  await fs.writeFile(
    teamRuntimePath(args.homePath, args.slug),
    `${JSON.stringify(preparation, null, 2)}\n`,
    "utf8",
  );
  manifest = await commitTeamStructuralMemory({
    homePath: args.homePath,
    slug: args.slug,
    kind: "runtime_prepared",
    title: `runtime_prepared:${args.slug}`,
    text:
      `Pi prepared the whole-view map for ${args.slug}: ${preparation.pathSourceCount} path sources, ` +
      `${preparation.peerCount} peers, ${preparation.checkpointedSourceCount} checkpoint-backed sources, ` +
      `${preparation.totalLineCount} lines visible before live input.`,
    meta: {
      preparedAt: preparation.preparedAt,
      teamStatus: preparation.teamStatus,
      canBrainPass: preparation.canBrainPass,
      spokespersonAgentId: preparation.spokespersonAgentId ?? null,
      pathSourceCount: preparation.pathSourceCount,
      checkpointedSourceCount: preparation.checkpointedSourceCount,
      totalCharCount: preparation.totalCharCount,
      totalLineCount: preparation.totalLineCount,
      peerCount: preparation.peerCount,
      sources: preparation.sources,
    },
  });
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
  /** Spend Buccets are for financial agents; see `buccet create spend`. */
  buccetClass?: "spend";
  uplTrackSnap?: Partial<TeamUplTrackSnap>;
};

const SPEND_BUCCET_NOTES_STAMP = [
  "[SPEND BUCCET — financial agents only]",
  "This slice is for agents that can move real money or create financial obligations (shopping, trading, subscriptions, bill pay, procurement, donations, cloud/API spend, and similar).",
  "It is not a general-purpose creative-coding or research-only Buccet — the mission is value-boundary work.",
  "The team brain is the spend value-boundary framework (`spending-agent-value-boundary`), not the default Universal Agent Comprehension Process.",
  "Standing Agent Buccet UPL laws, agent.spend tracks, and operator approvals in `buccet console` / `buccet upl` are the control plane for any value movement.",
  "If you did not intend a money-moving workload, use `buccet create <team> --domain ...` instead.",
].join("\n");

export async function createTeam(args: CreateTeamArgs): Promise<TeamManifest> {
  const slug = teamSlug(args.name);
  const existing = await loadTeam(args.homePath, slug);
  if (existing) {
    throw new Error(`Team "${slug}" already exists at ${teamDir(args.homePath, slug)}`);
  }

  const now = new Date().toISOString();
  const brainPath =
    args.buccetClass === "spend"
      ? SPENDING_AGENT_VALUE_BOUNDARY_SOURCE
      : UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE;
  const brain = teamBrainSourceRef(brainPath);
  const mergedNotes =
    [args.notes?.trim(), args.buccetClass === "spend" ? SPEND_BUCCET_NOTES_STAMP : ""]
      .filter(Boolean)
      .join("\n\n") || undefined;
  const manifest: TeamManifest = {
    manifestVersion: TEAM_MANIFEST_VERSION,
    slug,
    name: args.name,
    domain: args.domain,
    summary: args.summary ?? `${args.name} — hyper-specialized team for ${args.domain}.`,
    createdAt: now,
    updatedAt: now,
    createdBy: args.createdBy,
    ...(args.buccetClass === "spend" ? { buccetClass: "spend" as const } : {}),
    brainSourceId: brainPath.id,
    pathSourceCorpus: [brain],
    agents: [],
    uplTrackSnap: {
      takenAt: now,
      ...(args.uplTrackSnap ?? {}),
    },
    status: "draft",
    notes: mergedNotes,
  };
  await saveTeam(args.homePath, manifest);
  const ensured = await ensureTeamWorkMemorySource({
    homePath: args.homePath,
    manifest,
  });
  return commitTeamStructuralMemory({
    homePath: args.homePath,
    slug,
    kind: "team_created",
    title: `team_created:${slug}`,
    text:
      args.buccetClass === "spend"
        ? `Created SPEND Buccet ${slug} for ${args.domain}. spend value-boundary brain injected; path-source memory ready — real spend remains gated by UPL, agent.spend, and operator law.`
        : `Created team ${slug} for ${args.domain}. Persistent brain source and Buccet path-source memory are ready before live input.`,
    meta: {
      name: args.name,
      domain: args.domain,
      summary: ensured.manifest.summary,
      status: ensured.manifest.status,
      createdBy: args.createdBy ?? null,
      pathSourceCount: ensured.manifest.pathSourceCorpus.length,
      agentCount: ensured.manifest.agents.length,
      buccetClass: args.buccetClass ?? null,
    },
  });
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
  let manifest = await loadTeam(args.homePath, args.slug);
  if (!manifest) {
    throw new Error(`Team "${args.slug}" not found`);
  }
  manifest = (
    await ensureTeamWorkMemorySource({
      homePath: args.homePath,
      manifest,
    })
  ).manifest;
  if (manifest.agents.some((a) => a.id === args.agentId)) {
    throw new Error(`Team "${args.slug}" already has agent "${args.agentId}"`);
  }
  const ownsStep: ComprehensionStageId = args.ownsStep ?? "all";
  if (!COMPREHENSION_STAGE_IDS.includes(ownsStep)) {
    throw new Error(
      `Unknown comprehension stage "${ownsStep}". Allowed: ${COMPREHENSION_STAGE_IDS.join(", ")}`,
    );
  }

  const requestedSources = args.sourceIds ?? [];
  for (const sourceId of requestedSources) {
    if (!manifest.pathSourceCorpus.some((s) => s.id === sourceId)) {
      throw new Error(
        `Source "${sourceId}" is not in this team's corpus. Add it with \`buccet create add-source ${args.slug} <file>\` first.`,
      );
    }
  }

  const sourceIds = uniqueIds([
    teamManifestBrainSourceId(manifest),
    teamWorkMemorySourceId(args.slug),
    ...requestedSources,
  ]);
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
  return commitTeamStructuralMemory({
    homePath: args.homePath,
    slug: args.slug,
    kind: "agent_added",
    title: `agent_added:${args.agentId}`,
    text:
      `Added agent ${args.agentId} (${args.title}) to ${args.slug} for ${agent.specialty}; ` +
      `owns ${agent.ownsStep} and sees ${agent.sourceIds.length} sources including the shared Batcave memory.`,
    meta: {
      agentId: agent.id,
      title: agent.title,
      specialty: agent.specialty,
      ownsStep: agent.ownsStep,
      tools: agent.tools,
      sourceIds: agent.sourceIds,
      modelHint: agent.modelHint ?? null,
      spendCapNormalized: agent.spend.capNormalized,
    },
  });
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
  return commitTeamStructuralMemory({
    homePath: args.homePath,
    slug: args.slug,
    kind: "agent_removed",
    title: `agent_removed:${args.agentId}`,
    text: `Removed agent ${args.agentId} from ${args.slug}. Buccet continuity stays with path-source memory, not the worker.`,
    meta: {
      agentId: args.agentId,
      remainingAgentCount: manifest.agents.length,
    },
  });
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
    throw new Error(
      `Cannot read source "${resolved}": ${error instanceof Error ? error.message : String(error)}`,
    );
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
  return commitTeamStructuralMemory({
    homePath: args.homePath,
    slug: args.slug,
    kind: "source_added",
    title: `source_added:${sourceId}`,
    text: `Added source ${ref.title} (${ref.kind}) to ${args.slug}; whole-view can now project it before live input.`,
    meta: {
      sourceId: ref.id,
      title: ref.title,
      kind: ref.kind,
      sourceUri: ref.sourceUri ?? null,
      importedFromPath: ref.importedFromPath ?? null,
      checkpointDigest: ref.checkpoint?.digest ?? null,
      checkpointStoragePath: ref.checkpoint?.storagePath ?? null,
    },
  });
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
  return commitTeamStructuralMemory({
    homePath: args.homePath,
    slug: args.slug,
    kind: "source_added",
    title: `source_added:${sourceId}`,
    text: `Added remote LLM source ${ref.title} to ${args.slug}; Pi can now bind this provider during map prep and live work.`,
    meta: {
      sourceId: ref.id,
      title: ref.title,
      kind: ref.kind,
      transport: ref.transport,
      provider: remote.provider,
      endpoint: remote.endpoint,
      model: remote.model,
      authEnvVar: remote.authEnvVar ?? null,
    },
  });
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
  return commitTeamStructuralMemory({
    homePath: args.homePath,
    slug: args.slug,
    kind: "source_added",
    title: `source_added:${sourceId}`,
    text: `Added HTTP API source ${ref.title} to ${args.slug}; retrieval is now available to whole-view prep and live peers.`,
    meta: {
      sourceId: ref.id,
      title: ref.title,
      kind: ref.kind,
      transport: ref.transport,
      provider: httpApi.provider ?? null,
      endpoint: httpApi.endpoint,
      method: httpApi.method ?? null,
      authEnvVar: httpApi.authEnvVar ?? null,
    },
  });
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
    summary:
      args.summary ??
      `Local LLM via ${args.provider}${binary ? ` (${binary})` : ""}${endpoint ? ` at ${endpoint}` : ""}, model ${args.model}.`,
    sourceUri: endpoint ?? `local://${args.provider}/${args.model}`,
    transport: "local-llm",
    local,
  };
  manifest.pathSourceCorpus.push(ref);
  await saveTeam(args.homePath, manifest);
  return commitTeamStructuralMemory({
    homePath: args.homePath,
    slug: args.slug,
    kind: "source_added",
    title: `source_added:${sourceId}`,
    text: `Added local LLM source ${ref.title} to ${args.slug}; Pi can now bind this local provider during prep and runtime.`,
    meta: {
      sourceId: ref.id,
      title: ref.title,
      kind: ref.kind,
      transport: ref.transport,
      provider: local.provider,
      binary: local.binary ?? null,
      endpoint: local.endpoint ?? null,
      model: local.model,
    },
  });
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
    ...((args.agentCorePackage ?? defaults.agentCorePackage)
      ? { agentCorePackage: args.agentCorePackage ?? defaults.agentCorePackage }
      : {}),
    ...((args.aiPackage ?? defaults.aiPackage)
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
    sourceUri: engine.agentCorePackage
      ? `npm:${engine.agentCorePackage}`
      : `engine:${args.provider}`,
    transport: "engine",
    engine,
  };
  manifest.pathSourceCorpus.push(ref);
  await saveTeam(args.homePath, manifest);
  return commitTeamStructuralMemory({
    homePath: args.homePath,
    slug: args.slug,
    kind: "source_added",
    title: `source_added:${sourceId}`,
    text: `Added engine source ${ref.title} to ${args.slug}; Pi hands are now available to carry lawful actions through the boundary.`,
    meta: {
      sourceId: ref.id,
      title: ref.title,
      kind: ref.kind,
      transport: ref.transport,
      provider: engine.provider,
      toolExecution: engine.toolExecution,
      allowedTools: engine.allowedTools ?? [],
      agentCorePackage: engine.agentCorePackage ?? null,
      aiPackage: engine.aiPackage ?? null,
    },
  });
}

export async function removeTeamSource(args: {
  homePath: string;
  slug: TeamSlug;
  sourceId: string;
}): Promise<TeamManifest> {
  if (isBuiltinTeamBrainSourceId(args.sourceId)) {
    throw new Error("The brain source is auto-injected and cannot be removed from a team.");
  }
  if (args.sourceId === teamWorkMemorySourceId(args.slug)) {
    throw new Error(
      "The Buccet path-source memory is auto-injected and cannot be removed from a team.",
    );
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
  return commitTeamStructuralMemory({
    homePath: args.homePath,
    slug: args.slug,
    kind: "source_removed",
    title: `source_removed:${args.sourceId}`,
    text: `Removed source ${removed?.title ?? args.sourceId} from ${args.slug}. The Batcave wall has been narrowed, but the structural history remains committed.`,
    meta: {
      sourceId: args.sourceId,
      title: removed?.title ?? null,
      kind: removed?.kind ?? null,
      sourceUri: removed?.sourceUri ?? null,
      remainingSourceCount: manifest.pathSourceCorpus.length,
    },
  });
}

function teamBrainSourceRef(source: BuccetPathSource): TeamSourceRef {
  return {
    id: source.id,
    title: source.title,
    kind: source.kind,
    summary: source.summary,
    sourceUri: source.sourceUri,
    internalRole: "brain",
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
  const digest = createHash("sha256")
    .update(`${filePath}::${content.length}`)
    .update(content)
    .digest("hex")
    .slice(0, 16);
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
    .update(
      `local-llm::${local.provider}::${local.binary ?? ""}::${local.endpoint ?? ""}::${local.model}`,
    )
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
  const brain = resolveTeamBrainPathSource(teamManifestBrainSourceId(manifest));
  const out: BuccetPathSource[] = [brain];
  for (const ref of manifest.pathSourceCorpus) {
    if (isBuiltinTeamBrainSourceId(ref.id)) continue;
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
