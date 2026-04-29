import { createHash } from "node:crypto";
import { brotliCompressSync, brotliDecompressSync } from "node:zlib";
import { promises as fs } from "node:fs";
import path from "node:path";

import type { BoundaryActionKind } from "./types.ts";
import type {
  TeamAgent,
  TeamManifest,
  TeamSlug,
  TeamSourceRef,
} from "./team-workshop.ts";

export const TEAM_SOURCE_CHECKPOINT_FORMAT = "buccet-checkpoint-v1";
const DEFAULT_REGION_LINE_SPAN = 200;
const DEFAULT_PROJECTION_CHAR_LIMIT = 12_000;

export type TeamSourceCheckpointRef = {
  format: typeof TEAM_SOURCE_CHECKPOINT_FORMAT;
  compression: "brotli-base64";
  digest: string;
  bodyHash: string;
  lineCount: number;
  charCount: number;
  regionCount: number;
  storagePath: string;
};

export type TeamSourceCheckpointRegion = {
  regionId: string;
  title: string;
  stableAddress: string;
  startLine: number;
  endLine: number;
  startOffset: number;
  endOffset: number;
  preview: string;
  hash: string;
};

export type TeamSourceCheckpointBody = {
  schemaVersion: 1;
  format: typeof TEAM_SOURCE_CHECKPOINT_FORMAT;
  compression: "brotli-base64";
  sourceId: string;
  title: string;
  kind: string;
  sourceUri?: string;
  importedFromPath?: string;
  summary?: string;
  createdAt: string;
  digest: string;
  bodyHash: string;
  charCount: number;
  lineCount: number;
  regionCount: number;
  encodedBody: string;
  regions: TeamSourceCheckpointRegion[];
};

export type TeamSourceProjectionKind = "whole-view" | "region" | "span";

export type TeamSourceProjectionHandle = {
  sourceId: string;
  regionId: string;
  kind: TeamSourceProjectionKind;
  title: string;
  stableAddress: string;
  startLine: number;
  endLine: number;
  preview: string;
};

export type TeamSourceProjection = {
  sourceId: string;
  title: string;
  kind: TeamSourceProjectionKind;
  stableAddress: string;
  startLine: number;
  endLine: number;
  preview: string;
  content: string;
};

export type TeamWholeViewSource = {
  sourceId: string;
  title: string;
  kind: string;
  sourceUri?: string;
  summary?: string;
  charCount: number;
  lineCount: number;
  regionCount: number;
  wholeHandle: TeamSourceProjectionHandle;
  regionHandles: TeamSourceProjectionHandle[];
};

export type TeamWholeView = {
  teamId: string;
  sourceCount: number;
  checkpointedSourceCount: number;
  totalCharCount: number;
  totalLineCount: number;
  sources: TeamWholeViewSource[];
};

export type TeamPeerTaskPacket = {
  teamId: string;
  runId: string;
  peerId: string;
  specialty: string;
  ownsStep: string;
  taskSlice: string;
  inputExcerpt: string;
  declaredIntent: string;
  constraints: string[];
  sourceIds: string[];
  projectionHandles: TeamSourceProjectionHandle[];
  requiredReadiness: string[];
  upstreamDependencies: string[];
  allowedOutputs: string[];
  allowedActionKinds: BoundaryActionKind[];
};

export type TeamPeerTaskGraph = {
  runId: string;
  packets: TeamPeerTaskPacket[];
};

export function teamCheckpointRoot(homePath: string, slug: TeamSlug): string {
  return path.join(homePath, "teams", slug, "checkpoints");
}

export function relativeCheckpointStoragePath(sourceId: string): string {
  return path.join("checkpoints", `${sourceId}.json`);
}

export function absoluteCheckpointPath(homePath: string, slug: TeamSlug, ref: TeamSourceCheckpointRef): string {
  return path.join(homePath, "teams", slug, ref.storagePath);
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildRegions(sourceId: string, content: string): TeamSourceCheckpointRegion[] {
  const normalized = content.replaceAll("\r\n", "\n");
  const lines = normalized.split("\n");
  const offsets: number[] = [];
  let runningOffset = 0;
  for (const line of lines) {
    offsets.push(runningOffset);
    runningOffset += line.length + 1;
  }

  const regions: TeamSourceCheckpointRegion[] = [];
  for (let index = 0; index < lines.length; index += DEFAULT_REGION_LINE_SPAN) {
    const startLine = index + 1;
    const endLine = Math.min(lines.length, index + DEFAULT_REGION_LINE_SPAN);
    const slice = lines.slice(index, endLine);
    const text = slice.join("\n");
    const preview = text.slice(0, 240);
    const stableAddress = `${sourceId}:L${startLine}-L${endLine}`;
    regions.push({
      regionId: `${sourceId}-region-${regions.length + 1}`,
      title: `lines ${startLine}-${endLine}`,
      stableAddress,
      startLine,
      endLine,
      startOffset: offsets[index] ?? 0,
      endOffset: (offsets[endLine - 1] ?? 0) + (lines[endLine - 1]?.length ?? 0),
      preview,
      hash: hashText(text).slice(0, 24),
    });
  }

  if (regions.length === 0) {
    regions.push({
      regionId: `${sourceId}-region-1`,
      title: "lines 1-1",
      stableAddress: `${sourceId}:L1-L1`,
      startLine: 1,
      endLine: 1,
      startOffset: 0,
      endOffset: 0,
      preview: "",
      hash: hashText("").slice(0, 24),
    });
  }
  return regions;
}

export function buildTeamSourceCheckpoint(args: {
  sourceId: string;
  title: string;
  kind: string;
  content: string;
  sourceUri?: string;
  importedFromPath?: string;
  summary?: string;
}): {
  checkpoint: TeamSourceCheckpointBody;
  ref: TeamSourceCheckpointRef;
} {
  const normalized = args.content.replaceAll("\r\n", "\n");
  const bodyHash = hashText(normalized);
  const encodedBody = brotliCompressSync(Buffer.from(normalized, "utf8")).toString("base64");
  const digest = createHash("sha256")
    .update(`${args.sourceId}::${args.title}::${args.kind}::${bodyHash}`)
    .digest("hex");
  const regions = buildRegions(args.sourceId, normalized);
  const checkpoint: TeamSourceCheckpointBody = {
    schemaVersion: 1,
    format: TEAM_SOURCE_CHECKPOINT_FORMAT,
    compression: "brotli-base64",
    sourceId: args.sourceId,
    title: args.title,
    kind: args.kind,
    sourceUri: args.sourceUri,
    importedFromPath: args.importedFromPath,
    summary: args.summary,
    createdAt: new Date().toISOString(),
    digest,
    bodyHash,
    charCount: normalized.length,
    lineCount: normalized.split("\n").length,
    regionCount: regions.length,
    encodedBody,
    regions,
  };
  const ref: TeamSourceCheckpointRef = {
    format: TEAM_SOURCE_CHECKPOINT_FORMAT,
    compression: "brotli-base64",
    digest,
    bodyHash,
    lineCount: checkpoint.lineCount,
    charCount: checkpoint.charCount,
    regionCount: checkpoint.regionCount,
    storagePath: relativeCheckpointStoragePath(args.sourceId),
  };
  return { checkpoint, ref };
}

export async function persistTeamSourceCheckpoint(args: {
  homePath: string;
  slug: TeamSlug;
  checkpoint: TeamSourceCheckpointBody;
}): Promise<void> {
  const root = teamCheckpointRoot(args.homePath, args.slug);
  await fs.mkdir(root, { recursive: true });
  const storagePath = path.join(root, `${args.checkpoint.sourceId}.json`);
  await fs.writeFile(storagePath, `${JSON.stringify(args.checkpoint, null, 2)}\n`, "utf8");
}

export async function deleteTeamSourceCheckpoint(args: {
  homePath: string;
  slug: TeamSlug;
  ref?: TeamSourceCheckpointRef;
}): Promise<void> {
  if (!args.ref) return;
  const targetPath = absoluteCheckpointPath(args.homePath, args.slug, args.ref);
  await fs.rm(targetPath, { force: true });
}

export async function loadTeamSourceCheckpoint(args: {
  homePath: string;
  slug: TeamSlug;
  ref: TeamSourceCheckpointRef;
}): Promise<TeamSourceCheckpointBody | null> {
  try {
    const raw = await fs.readFile(absoluteCheckpointPath(args.homePath, args.slug, args.ref), "utf8");
    const parsed = JSON.parse(raw) as TeamSourceCheckpointBody;
    if (parsed.format !== TEAM_SOURCE_CHECKPOINT_FORMAT) return null;
    return parsed;
  } catch {
    return null;
  }
}

function decodeCheckpointBody(checkpoint: TeamSourceCheckpointBody): string {
  const decoded = brotliDecompressSync(Buffer.from(checkpoint.encodedBody, "base64")).toString("utf8");
  return decoded;
}

function regionHandleFromCheckpoint(
  sourceId: string,
  region: TeamSourceCheckpointRegion,
): TeamSourceProjectionHandle {
  return {
    sourceId,
    regionId: region.regionId,
    kind: "region",
    title: region.title,
    stableAddress: region.stableAddress,
    startLine: region.startLine,
    endLine: region.endLine,
    preview: region.preview,
  };
}

function wholeHandleForCheckpoint(
  sourceId: string,
  lineCount: number,
  preview: string,
): TeamSourceProjectionHandle {
  return {
    sourceId,
    regionId: `${sourceId}-whole`,
    kind: "whole-view",
    title: "whole-view",
    stableAddress: `${sourceId}:whole`,
    startLine: 1,
    endLine: Math.max(1, lineCount),
    preview,
  };
}

export async function openProjectionHandle(args: {
  homePath: string;
  slug: TeamSlug;
  sourceRef: TeamSourceRef;
  handle: TeamSourceProjectionHandle;
}): Promise<TeamSourceProjection | null> {
  if (!args.sourceRef.checkpoint) return null;
  const checkpoint = await loadTeamSourceCheckpoint({
    homePath: args.homePath,
    slug: args.slug,
    ref: args.sourceRef.checkpoint,
  });
  if (!checkpoint) return null;
  if (args.handle.kind === "whole-view") {
    return {
      sourceId: checkpoint.sourceId,
      title: checkpoint.title,
      kind: args.handle.kind,
      stableAddress: args.handle.stableAddress,
      startLine: 1,
      endLine: checkpoint.lineCount,
      preview: args.handle.preview,
      content: [
        `source: ${checkpoint.title}`,
        `kind: ${checkpoint.kind}`,
        `lines: ${checkpoint.lineCount}`,
        `chars: ${checkpoint.charCount}`,
        `regions: ${checkpoint.regionCount}`,
        checkpoint.summary ? `summary: ${checkpoint.summary}` : "",
        "",
        "region-index:",
        ...checkpoint.regions.map((region) =>
          `- ${region.stableAddress} · ${region.title} · ${region.hash} · ${region.preview.replaceAll("\n", " ").slice(0, 120)}`,
        ),
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }
  const region = checkpoint.regions.find((entry) => entry.regionId === args.handle.regionId);
  if (!region) return null;
  const body = decodeCheckpointBody(checkpoint);
  const content = body.slice(region.startOffset, region.endOffset);
  return {
    sourceId: checkpoint.sourceId,
    title: checkpoint.title,
    kind: args.handle.kind,
    stableAddress: args.handle.stableAddress,
    startLine: region.startLine,
    endLine: region.endLine,
    preview: region.preview,
    content,
  };
}

export async function buildTeamWholeView(args: {
  homePath: string;
  manifest: TeamManifest;
}): Promise<TeamWholeView> {
  const sources: TeamWholeViewSource[] = [];
  let totalCharCount = 0;
  let totalLineCount = 0;
  let checkpointedSourceCount = 0;

  for (const source of args.manifest.pathSourceCorpus) {
    if (source.transport === "engine") continue;
    if (source.checkpoint) {
      const checkpoint = await loadTeamSourceCheckpoint({
        homePath: args.homePath,
        slug: args.manifest.slug,
        ref: source.checkpoint,
      });
      if (checkpoint) {
        checkpointedSourceCount += 1;
        totalCharCount += checkpoint.charCount;
        totalLineCount += checkpoint.lineCount;
        sources.push({
          sourceId: source.id,
          title: source.title,
          kind: source.kind,
          sourceUri: source.sourceUri,
          summary: source.summary,
          charCount: checkpoint.charCount,
          lineCount: checkpoint.lineCount,
          regionCount: checkpoint.regionCount,
          wholeHandle: wholeHandleForCheckpoint(
            source.id,
            checkpoint.lineCount,
            source.summary ?? checkpoint.regions[0]?.preview ?? source.title,
          ),
          regionHandles: checkpoint.regions.map((region) => regionHandleFromCheckpoint(source.id, region)),
        });
        continue;
      }
    }

    const summaryText = source.summary ?? source.title;
    totalCharCount += summaryText.length;
    totalLineCount += Math.max(1, summaryText.split("\n").length);
    sources.push({
      sourceId: source.id,
      title: source.title,
      kind: source.kind,
      sourceUri: source.sourceUri,
      summary: source.summary,
      charCount: summaryText.length,
      lineCount: Math.max(1, summaryText.split("\n").length),
      regionCount: 1,
      wholeHandle: {
        sourceId: source.id,
        regionId: `${source.id}-summary`,
        kind: "whole-view",
        title: source.title,
        stableAddress: `${source.id}:summary`,
        startLine: 1,
        endLine: Math.max(1, summaryText.split("\n").length),
        preview: summaryText.slice(0, 240),
      },
      regionHandles: [
        {
          sourceId: source.id,
          regionId: `${source.id}-summary`,
          kind: "whole-view",
          title: source.title,
          stableAddress: `${source.id}:summary`,
          startLine: 1,
          endLine: Math.max(1, summaryText.split("\n").length),
          preview: summaryText.slice(0, 240),
        },
      ],
    });
  }

  return {
    teamId: args.manifest.slug,
    sourceCount: sources.length,
    checkpointedSourceCount,
    totalCharCount,
    totalLineCount,
    sources,
  };
}

function agentNonBrainSourceIds(agent: TeamAgent): string[] {
  return agent.sourceIds.filter((id) => id !== "base-agent-comprehension-process");
}

function candidateWholeViewSourcesForAgent(agent: TeamAgent, wholeView: TeamWholeView): TeamWholeViewSource[] {
  const requested = new Set(agentNonBrainSourceIds(agent));
  if (requested.size === 0) {
    return wholeView.sources.filter((source) => !source.kind.startsWith("remote-llm:") && !source.kind.startsWith("local-llm:"));
  }
  const matched = wholeView.sources.filter((source) => requested.has(source.sourceId));
  if (matched.length > 0) return matched;
  return wholeView.sources.filter((source) => !source.kind.startsWith("remote-llm:") && !source.kind.startsWith("local-llm:"));
}

function defaultAllowedOutputsForStage(stage: string): string[] {
  if (stage === "render" || stage === "return") return ["render-fragment", "answer-fragment", "blocked"];
  if (stage === "validate") return ["validation", "blocked", "refusal"];
  if (stage === "infer_intent") return ["intent", "constraints", "blocked"];
  return ["analysis", "plan", "constraint", "blocked"];
}

function defaultAllowedActionKindsForStage(stage: string): BoundaryActionKind[] {
  if (stage === "acquire_knowledge") return ["fs.read", "network.send"];
  if (stage === "transform") return ["fs.read", "fs.write", "tool.exec"];
  if (stage === "render" || stage === "return") return ["chat.emit"];
  return ["fs.read"];
}

function buildInputExcerpt(previews: string[]): string {
  return previews
    .filter((value) => value.trim().length > 0)
    .join("\n\n")
    .slice(0, 1200);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function scoreHandleForAgent(args: {
  handle: TeamSourceProjectionHandle;
  source: TeamWholeViewSource;
  userRequest: string;
  agent: TeamAgent;
}): number {
  const terms = new Set([
    ...tokenize(args.userRequest),
    ...tokenize(args.agent.specialty),
    ...tokenize(args.agent.ownsStep),
    ...tokenize(args.source.title),
    ...tokenize(args.source.kind),
  ]);
  const haystack = `${args.handle.title} ${args.handle.preview} ${args.handle.stableAddress}`.toLowerCase();
  let score = args.handle.kind === "whole-view" ? 2 : 0;
  for (const term of terms) {
    if (haystack.includes(term)) score += 3;
  }
  if (args.agent.ownsStep === "render" || args.agent.ownsStep === "return") {
    score += args.handle.kind === "whole-view" ? 4 : 1;
  }
  if (args.agent.ownsStep === "acquire_knowledge" || args.agent.ownsStep === "transform") {
    score += args.handle.kind === "region" ? 2 : 0;
  }
  return score;
}

export async function buildTeamPeerTaskGraph(args: {
  homePath: string;
  manifest: TeamManifest;
  wholeView: TeamWholeView;
  userRequest: string;
  agents: TeamAgent[];
  runId?: string;
}): Promise<TeamPeerTaskGraph> {
  const runId = args.runId ?? `run-${Date.now().toString(36)}`;
  const packets: TeamPeerTaskPacket[] = [];
  const sourceNodesByAgent = new Map<string, TeamWholeViewSource[]>();
  const assignedHandles = new Map<string, TeamSourceProjectionHandle[]>();

  for (const agent of args.agents) {
    sourceNodesByAgent.set(agent.id, candidateWholeViewSourcesForAgent(agent, args.wholeView));
    assignedHandles.set(agent.id, []);
  }

  for (const source of args.wholeView.sources) {
    const eligibleAgents = args.agents.filter((agent) =>
      (sourceNodesByAgent.get(agent.id) ?? []).some((entry) => entry.sourceId === source.sourceId),
    );
    const receivers = eligibleAgents.length > 0 ? eligibleAgents : args.agents;
    for (const receiver of receivers) {
      assignedHandles.get(receiver.id)?.push(source.wholeHandle);
    }
    const claimed = new Set<string>();
    for (const receiver of receivers) {
      const ranked = source.regionHandles
        .map((handle) => ({
          handle,
          score: scoreHandleForAgent({
            handle,
            source,
            userRequest: args.userRequest,
            agent: receiver,
          }),
        }))
        .sort((a, b) => b.score - a.score || a.handle.startLine - b.handle.startLine);
      const chosen = ranked.find((entry) => !claimed.has(entry.handle.regionId)) ?? ranked[0];
      if (chosen) {
        assignedHandles.get(receiver.id)?.push(chosen.handle);
        claimed.add(chosen.handle.regionId);
      }
    }
    for (const handle of source.regionHandles) {
      if (claimed.has(handle.regionId)) continue;
      const receiver = receivers[(handle.startLine - 1) % receivers.length];
      assignedHandles.get(receiver.id)?.push(handle);
    }
  }

  for (const agent of args.agents) {
    const sourceNodes = sourceNodesByAgent.get(agent.id) ?? [];
    const handles = assignedHandles.get(agent.id) ?? [];
    const dedupedHandles = [...new Map(handles.map((handle) => [`${handle.sourceId}:${handle.regionId}`, handle])).values()];
    const constrainedHandles = dedupedHandles
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "whole-view" ? -1 : 1;
        return a.startLine - b.startLine;
      })
      .slice(0, 8);
    const previews = constrainedHandles.filter((handle) => handle.kind !== "whole-view").map((handle) => handle.preview);
    packets.push({
      teamId: args.manifest.slug,
      runId,
      peerId: agent.id,
      specialty: agent.specialty,
      ownsStep: agent.ownsStep,
      taskSlice:
        constrainedHandles.length > 0
          ? `${agent.specialty} over ${constrainedHandles.filter((handle) => handle.kind === "region").length} zoom regions`
          : `${agent.specialty} over whole-view summaries`,
      inputExcerpt: buildInputExcerpt(previews),
      declaredIntent: args.userRequest,
      constraints: [
        "Stay inside UPL-bound proposals only.",
        "Return specialist result to Pi; do not speak as final authority.",
        "Use only your assigned projection region handles plus whole-view context.",
      ],
      sourceIds: uniqueSourceIds(sourceNodes.map((source) => source.sourceId)),
      projectionHandles: constrainedHandles,
      requiredReadiness: ["team-ready", "projection-opened", "upl-bound"],
      upstreamDependencies: [],
      allowedOutputs: defaultAllowedOutputsForStage(agent.ownsStep),
      allowedActionKinds: defaultAllowedActionKindsForStage(agent.ownsStep),
    });
  }

  return { runId, packets };
}

function uniqueSourceIds(values: string[]): string[] {
  return [...new Set(values)];
}

export async function renderProjectionBundle(args: {
  homePath: string;
  slug: TeamSlug;
  manifest: TeamManifest;
  packet: TeamPeerTaskPacket;
  charLimit?: number;
}): Promise<string> {
  const limit = args.charLimit ?? DEFAULT_PROJECTION_CHAR_LIMIT;
  const refs = new Map(args.manifest.pathSourceCorpus.map((source) => [source.id, source]));
  let consumed = 0;
  const blocks: string[] = [];

  for (const handle of args.packet.projectionHandles) {
    const ref = refs.get(handle.sourceId);
    if (!ref) continue;
    let content = "";
    if (ref.checkpoint) {
      const projection = await openProjectionHandle({
        homePath: args.homePath,
        slug: args.slug,
        sourceRef: ref,
        handle,
      });
      if (!projection) continue;
      content = projection.content;
    } else {
      content = ref.summary ?? ref.title;
    }
    const remaining = limit - consumed;
    if (remaining <= 0) break;
    const bounded = content.slice(0, remaining);
    consumed += bounded.length;
    blocks.push([`### ${ref.title} · ${handle.stableAddress}`, bounded].join("\n"));
  }

  if (blocks.length === 0 && args.packet.inputExcerpt.trim().length > 0) {
    return args.packet.inputExcerpt;
  }
  return blocks.join("\n\n");
}
