import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { availableParallelism } from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { enableBodyguardControl, adjudicateBoundaryRequest } from "./bodyguard.ts";
import { evaluateAdmission, initialAdmissionState, markCanyonLedgered } from "./admission.ts";
import { assertBoundaryGravityLawUpdateAllowed } from "./gravity-adapter/gravity-service.ts";
import { appendBoundaryLedger } from "./ledger.ts";
import { assessBoundarySubstrateIntercept } from "./substrate-live.ts";
import {
  loadBoundarySessionState,
  persistBoundarySessionState,
  restorePersistentBoundarySession,
  writeBoundarySessionQuarantineState,
} from "./state.ts";
import {
  listUserPathEntries,
  loadUserPathLedger,
  materializeBoundaryActionRequestFromUplEntry,
  writeDeniedUserPathLaw,
} from "./user-path-ledger.ts";
import type {
  BoundaryActionRequest,
  BoundaryAdmissionState,
  BoundaryPersistedSessionState,
  BoundaryQuarantineState,
  BoundaryRuntimeConfig,
  BoundarySession,
  BoundaryUplEntry,
  BoundaryUplScope,
} from "./types.ts";

type BoundaryQuarantinePreparedItem = {
  itemId: string;
  entryId: string;
  side: "approved" | "denied";
  hash: string;
  path: string;
  pathHash: string;
  request?: BoundaryActionRequest;
  preparationPit?: BoundaryQuarantineReportItem;
};

export type BoundaryQuarantineSnapshotItem = {
  itemId: string;
  entryId: string;
  side: "approved" | "denied";
  hash: string;
  entry: BoundaryUplEntry;
};

export type BoundaryQuarantineSnapshot = {
  schemaVersion: 1;
  kind: "buccet_quarantine_snapshot";
  sessionId: string;
  createdAt: string;
  reason: string;
  items: BoundaryQuarantineSnapshotItem[];
};

export type BoundaryQuarantineReportItem = {
  itemId: string;
  entryId: string;
  side: "approved" | "denied";
  hash: string;
  path: string;
  pathHash: string;
  actionKind?: string;
  target?: string;
  verdict: "survivor" | "pit";
  reason: string;
  lawIds: string[];
  resolution: "pending" | "denied_as_law" | "survivor";
};

export type BoundaryQuarantineSummaryCount = {
  value: string;
  count: number;
};

export type BoundaryQuarantinePitSummary = {
  pendingCount: number;
  deniedAsLawCount: number;
  approvedPitCount: number;
  deniedPitCount: number;
  topLawIds: BoundaryQuarantineSummaryCount[];
  topReasons: BoundaryQuarantineSummaryCount[];
  topActionKinds: BoundaryQuarantineSummaryCount[];
};

export type BoundaryQuarantinePitGroup = {
  groupId: string;
  depth: number;
  startIndex: number;
  endIndexExclusive: number;
  size: number;
  pitCount: number;
  approvedPitCount: number;
  deniedPitCount: number;
  itemIds: string[];
  primaryReason: string;
  topLawIds: BoundaryQuarantineSummaryCount[];
  topActionKinds: BoundaryQuarantineSummaryCount[];
};

export type BoundaryQuarantineReport = {
  schemaVersion: 1;
  kind: "buccet_quarantine_report";
  sessionId: string;
  createdAt: string;
  total: number;
  processedItems: number;
  complete: boolean;
  survivorCount: number;
  pitCount: number;
  totalShards: number;
  completedShards: number;
  shardSize: number;
  workerCount: number;
  pitSummary: BoundaryQuarantinePitSummary;
  pitGroups: BoundaryQuarantinePitGroup[];
  items: BoundaryQuarantineReportItem[];
};

type BoundaryQuarantineProgressShard = {
  shardId: string;
  depth: number;
  startIndex: number;
  endIndexExclusive: number;
  itemIds: string[];
  status: "pending" | "complete";
  survivorCount: number;
  pitCount: number;
  completedAt?: string;
};

type BoundaryQuarantineProgress = {
  schemaVersion: 1;
  kind: "buccet_quarantine_progress";
  sessionId: string;
  createdAt: string;
  snapshotHash: string;
  totalItems: number;
  processedItems: number;
  shardSize: number;
  workerCount: number;
  totalShards: number;
  completedShards: number;
  admissionState?: BoundaryAdmissionState;
  shards: BoundaryQuarantineProgressShard[];
  itemsById: Record<string, BoundaryQuarantineReportItem>;
};

type BoundaryQuarantineShardResult = {
  shardId: string;
  config: BoundaryRuntimeConfig;
  items: BoundaryQuarantineReportItem[];
  survivorCount: number;
  pitCount: number;
};

type BoundaryQuarantinePreparedShard = {
  shardId: string;
  items: BoundaryQuarantinePreparedItem[];
};

const BASE_HEADLESS_DENIAL_WITNESS_ID = "BUCCET.HEADLESS.BASE.DENIALS.V1";
const QUARANTINE_MIN_SHARD_SIZE = 8;
const QUARANTINE_MEDIUM_SHARD_SIZE = 16;
const QUARANTINE_LARGE_SHARD_SIZE = 32;
const QUARANTINE_XL_SHARD_SIZE = 64;
const QUARANTINE_MAX_WORKERS = 4;
function resolveSessionsDir(configOrDir?: BoundaryRuntimeConfig | string): string {
  if (typeof configOrDir === "string" && configOrDir.trim()) {
    return path.resolve(configOrDir);
  }
  const sessionsDir = typeof configOrDir === "object" ? configOrDir?.persistence?.sessionsDir?.trim() : undefined;
  if (sessionsDir) {
    return path.resolve(sessionsDir);
  }
  return path.join(process.cwd(), "data", "agent-boundary", "sessions");
}

function resolveBoundaryQuarantinePaths(args: {
  sessionId: string;
  sessionsDir?: string;
}) {
  const sessionsDir = resolveSessionsDir(args.sessionsDir);
  return {
    snapshotPath: path.join(sessionsDir, `${args.sessionId}.quarantine.snapshot.json`),
    reportPath: path.join(sessionsDir, `${args.sessionId}.quarantine.report.json`),
    progressPath: path.join(sessionsDir, `${args.sessionId}.quarantine.progress.json`),
    lockPath: path.join(sessionsDir, `${args.sessionId}.quarantine.lock`),
  };
}

function hashQuarantineEntry(entry: BoundaryUplEntry): string {
  return createHash("sha256").update(JSON.stringify({
    id: entry.id,
    type: entry.type,
    pathHash: entry.pathHash,
    status: entry.status,
    scope: entry.scope,
    sessionId: entry.sessionId ?? null,
    domain: entry.domain ?? null,
    requestBasis: entry.requestBasis ?? null,
    trackConstraint: entry.trackConstraint ?? null,
  })).digest("hex");
}

function hashQuarantineSnapshot(snapshot: BoundaryQuarantineSnapshot): string {
  return createHash("sha256").update(JSON.stringify(snapshot.items.map((item) => ({
    itemId: item.itemId,
    entryId: item.entryId,
    hash: item.hash,
    side: item.side,
  })))).digest("hex");
}

function computeQuarantineShardSize(totalItems: number): number {
  if (totalItems <= QUARANTINE_MIN_SHARD_SIZE) {
    return Math.max(1, totalItems || 1);
  }
  if (totalItems <= 64) {
    return QUARANTINE_MIN_SHARD_SIZE;
  }
  if (totalItems <= 256) {
    return QUARANTINE_MEDIUM_SHARD_SIZE;
  }
  if (totalItems <= 1024) {
    return QUARANTINE_LARGE_SHARD_SIZE;
  }
  return QUARANTINE_XL_SHARD_SIZE;
}

function computeQuarantineWorkerCount(totalShards: number): number {
  if (totalShards <= 1) {
    return 1;
  }
  return Math.max(
    1,
    Math.min(
      totalShards,
      QUARANTINE_MAX_WORKERS,
      Math.max(2, availableParallelism()),
    ),
  );
}

async function writeJsonFile(targetPath: string, payload: unknown): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function readJsonFile<T>(targetPath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(targetPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeQuarantineScope(entry: BoundaryUplEntry): BoundaryUplScope {
  return entry.scope;
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withQuarantineLock<T>(args: {
  sessionId: string;
  sessionsDir?: string;
  fn: () => Promise<T>;
}): Promise<T> {
  const { lockPath } = resolveBoundaryQuarantinePaths({
    sessionId: args.sessionId,
    sessionsDir: args.sessionsDir,
  });

  for (let attempt = 0; attempt < 200; attempt += 1) {
    let handle: fs.FileHandle | null = null;
    try {
      handle = await fs.open(lockPath, "wx");
      try {
        return await args.fn();
      } finally {
        await handle.close().catch(() => undefined);
        await fs.rm(lockPath, { force: true }).catch(() => undefined);
      }
    } catch (error) {
      await handle?.close().catch(() => undefined);
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
      await delay(50);
    }
  }

  throw new Error("quarantine replay lock timed out");
}

function buildInitialQuarantineProgress(snapshot: BoundaryQuarantineSnapshot): BoundaryQuarantineProgress {
  const shardSize = computeQuarantineShardSize(snapshot.items.length);
  const shards: BoundaryQuarantineProgressShard[] = [];
  for (let startIndex = 0, index = 0; startIndex < snapshot.items.length; startIndex += shardSize, index += 1) {
    const endIndexExclusive = Math.min(snapshot.items.length, startIndex + shardSize);
    const shardItems = snapshot.items.slice(startIndex, endIndexExclusive);
    shards.push({
      shardId: `quarantine-shard-${index + 1}`,
      depth: 0,
      startIndex,
      endIndexExclusive,
      itemIds: shardItems.map((item) => item.itemId),
      status: "pending",
      survivorCount: 0,
      pitCount: 0,
    });
  }

  return {
    schemaVersion: 1,
    kind: "buccet_quarantine_progress",
    sessionId: snapshot.sessionId,
    createdAt: new Date().toISOString(),
    snapshotHash: hashQuarantineSnapshot(snapshot),
    totalItems: snapshot.items.length,
    processedItems: 0,
    shardSize,
    workerCount: computeQuarantineWorkerCount(shards.length),
    totalShards: shards.length,
    completedShards: 0,
    shards,
    itemsById: {},
  };
}

function synthesizeQuarantineReport(args: {
  snapshot: BoundaryQuarantineSnapshot;
  progress: BoundaryQuarantineProgress;
  complete: boolean;
}): BoundaryQuarantineReport {
  const indexByItemId = new Map(args.snapshot.items.map((item, index) => [item.itemId, index]));
  const items = Object.values(args.progress.itemsById).sort((left, right) =>
    (indexByItemId.get(left.itemId) ?? 0) - (indexByItemId.get(right.itemId) ?? 0)
  );
  const pitSummary = buildPitSummary(items);
  const pitGroups = buildPitGroups({
    progress: args.progress,
    items,
  });

  return {
    schemaVersion: 1,
    kind: "buccet_quarantine_report",
    sessionId: args.snapshot.sessionId,
    createdAt: new Date().toISOString(),
    total: args.snapshot.items.length,
    processedItems: args.progress.processedItems,
    complete: args.complete,
    survivorCount: items.filter((item) => item.verdict === "survivor").length,
    pitCount: items.filter((item) => item.verdict === "pit").length,
    totalShards: args.progress.totalShards,
    completedShards: args.progress.completedShards,
    shardSize: args.progress.shardSize,
    workerCount: args.progress.workerCount,
    pitSummary,
    pitGroups,
    items,
  };
}

function buildMissingBasisPitItem(item: BoundaryQuarantineSnapshotItem): BoundaryQuarantineReportItem {
  return {
    itemId: item.itemId,
    entryId: item.entryId,
    side: item.side,
    hash: item.hash,
    path: item.entry.path,
    pathHash: item.entry.pathHash,
    verdict: "pit",
    reason: "entry has no request basis and cannot survive quarantine replay",
    lawIds: ["BOUNDARY.QUARANTINE.REQUEST_BASIS.01"],
    resolution: "pending",
  };
}

function summarizeCounts(values: string[]): BoundaryQuarantineSummaryCount[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim();
    if (!key) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value, count]) => ({ value, count }));
}

function buildPitSummary(items: BoundaryQuarantineReportItem[]): BoundaryQuarantinePitSummary {
  const pitItems = items.filter((item) => item.verdict === "pit");
  return {
    pendingCount: pitItems.filter((item) => item.resolution === "pending").length,
    deniedAsLawCount: pitItems.filter((item) => item.resolution === "denied_as_law").length,
    approvedPitCount: pitItems.filter((item) => item.side === "approved").length,
    deniedPitCount: pitItems.filter((item) => item.side === "denied").length,
    topLawIds: summarizeCounts(pitItems.flatMap((item) => item.lawIds)).slice(0, 5),
    topReasons: summarizeCounts(pitItems.map((item) => item.reason)).slice(0, 5),
    topActionKinds: summarizeCounts(pitItems.map((item) => item.actionKind ?? "-")).slice(0, 5),
  };
}

function buildPitGroup(args: {
  groupId: string;
  depth: number;
  startIndex: number;
  endIndexExclusive: number;
  items: BoundaryQuarantineReportItem[];
}): BoundaryQuarantinePitGroup {
  const pitItems = args.items.filter((item) => item.verdict === "pit");
  return {
    groupId: args.groupId,
    depth: args.depth,
    startIndex: args.startIndex,
    endIndexExclusive: args.endIndexExclusive,
    size: args.items.length,
    pitCount: pitItems.length,
    approvedPitCount: pitItems.filter((item) => item.side === "approved").length,
    deniedPitCount: pitItems.filter((item) => item.side === "denied").length,
    itemIds: pitItems.map((item) => item.itemId),
    primaryReason: summarizeCounts(pitItems.map((item) => item.reason))[0]?.value ?? "pit group",
    topLawIds: summarizeCounts(pitItems.flatMap((item) => item.lawIds)).slice(0, 3),
    topActionKinds: summarizeCounts(pitItems.map((item) => item.actionKind ?? "-")).slice(0, 3),
  };
}

function buildPitGroupsForRange(args: {
  items: BoundaryQuarantineReportItem[];
  startIndex: number;
  endIndexExclusive: number;
  depth: number;
  groupPrefix: string;
}): BoundaryQuarantinePitGroup[] {
  const slice = args.items.slice(args.startIndex, args.endIndexExclusive);
  const pitItems = slice.filter((item) => item.verdict === "pit");
  if (pitItems.length === 0) {
    return [];
  }
  if (pitItems.length === slice.length || slice.length <= 1) {
    return [
      buildPitGroup({
        groupId: args.groupPrefix,
        depth: args.depth,
        startIndex: args.startIndex,
        endIndexExclusive: args.endIndexExclusive,
        items: slice,
      }),
    ];
  }
  const midpoint = args.startIndex + Math.floor(slice.length / 2);
  return [
    ...buildPitGroupsForRange({
      items: args.items,
      startIndex: args.startIndex,
      endIndexExclusive: midpoint,
      depth: args.depth + 1,
      groupPrefix: `${args.groupPrefix}.L`,
    }),
    ...buildPitGroupsForRange({
      items: args.items,
      startIndex: midpoint,
      endIndexExclusive: args.endIndexExclusive,
      depth: args.depth + 1,
      groupPrefix: `${args.groupPrefix}.R`,
    }),
  ];
}

function buildPitGroups(args: {
  progress: BoundaryQuarantineProgress;
  items: BoundaryQuarantineReportItem[];
}): BoundaryQuarantinePitGroup[] {
  const shards = [...args.progress.shards].sort((left, right) => left.startIndex - right.startIndex);
  return shards.flatMap((shard) =>
    buildPitGroupsForRange({
      items: args.items,
      startIndex: shard.startIndex,
      endIndexExclusive: shard.endIndexExclusive,
      depth: shard.depth,
      groupPrefix: shard.shardId,
    })
  );
}

async function loadQuarantineState(args: {
  sessionId: string;
  sessionsDir?: string;
}): Promise<BoundaryPersistedSessionState | null> {
  return loadBoundarySessionState({
    sessionId: args.sessionId,
    sessionsDir: args.sessionsDir,
  });
}

async function readQuarantineSnapshot(quarantineState: BoundaryQuarantineState): Promise<BoundaryQuarantineSnapshot | null> {
  return readJsonFile<BoundaryQuarantineSnapshot>(quarantineState.snapshotPath);
}

async function readQuarantineReport(quarantineState: BoundaryQuarantineState): Promise<BoundaryQuarantineReport | null> {
  return readJsonFile<BoundaryQuarantineReport>(quarantineState.reportPath);
}

async function prepareQuarantineShardLocally(args: {
  session: BoundarySession;
  items: BoundaryQuarantineSnapshotItem[];
  shardId: string;
}): Promise<BoundaryQuarantinePreparedShard> {
  return {
    shardId: args.shardId,
    items: args.items.map((item) => {
      const request = materializeBoundaryActionRequestFromUplEntry({
        entry: item.entry,
        session: args.session,
        provenance: "external_content",
        requestId: `quarantine-${item.entry.id}`,
      });
      return {
        itemId: item.itemId,
        entryId: item.entryId,
        side: item.side,
        hash: item.hash,
        path: item.entry.path,
        pathHash: item.entry.pathHash,
        ...(request
          ? { request }
          : { preparationPit: buildMissingBasisPitItem(item) }),
      };
    }),
  };
}

async function prepareQuarantineShardWithWorker(args: {
  session: BoundarySession;
  items: BoundaryQuarantineSnapshotItem[];
  shardId: string;
}): Promise<BoundaryQuarantinePreparedShard> {
  return new Promise<BoundaryQuarantinePreparedShard>((resolve, reject) => {
    const worker = new Worker(new URL("./quarantine-worker.ts", import.meta.url), {
      workerData: args,
    });
    worker.once("message", (message) => {
      resolve(message as BoundaryQuarantinePreparedShard);
    });
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`quarantine worker exited with code ${code}`));
      }
    });
  });
}

async function prepareQuarantineShards(args: {
  session: BoundarySession;
  snapshot: BoundaryQuarantineSnapshot;
  shards: BoundaryQuarantineProgressShard[];
  workerCount: number;
}): Promise<BoundaryQuarantinePreparedShard[]> {
  const orderedShards = [...args.shards].sort((left, right) => left.startIndex - right.startIndex);
  if (orderedShards.length === 0) {
    return [];
  }
  const shardItems = orderedShards.map((shard) => ({
    shard,
    items: args.snapshot.items.slice(shard.startIndex, shard.endIndexExclusive),
  }));
  if (args.workerCount <= 1 || shardItems.length <= 1) {
    return Promise.all(shardItems.map(({ shard, items }) =>
      prepareQuarantineShardLocally({
        session: args.session,
        items,
        shardId: shard.shardId,
      })
    ));
  }

  const results = new Map<string, BoundaryQuarantinePreparedShard>();
  const queue = [...shardItems];
  const workers = Array.from({ length: Math.min(args.workerCount, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) {
        return;
      }
      try {
        const prepared = await prepareQuarantineShardWithWorker({
          session: args.session,
          items: next.items,
          shardId: next.shard.shardId,
        });
        results.set(next.shard.shardId, prepared);
      } catch {
        results.set(next.shard.shardId, await prepareQuarantineShardLocally({
          session: args.session,
          items: next.items,
          shardId: next.shard.shardId,
        }));
      }
    }
  });
  await Promise.all(workers);
  return orderedShards.map((shard) => results.get(shard.shardId)!).filter(Boolean);
}

async function evaluateReplayRequest(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  entryId: string;
}): Promise<{
  config: BoundaryRuntimeConfig;
  verdict: "survivor" | "pit";
  reason: string;
  lawIds: string[];
}> {
  let nextConfig = args.config;

  if (nextConfig.admissionConfig) {
    const admissionState = nextConfig.admissionState ?? initialAdmissionState();
    const admission = evaluateAdmission({
      config: nextConfig.admissionConfig,
      state: admissionState,
      request: {
        requestId: randomUUID(),
        provenance: `quarantine:${args.entryId}`,
        provenanceStrength: "weak",
        weightClass: "standard",
        receivedAtMs: Date.now(),
      },
      nowMs: Date.now(),
    });

    let finalAdmissionState = admission.state;
    if (admission.result.decision === "tarpit") {
      if (admission.result.promoted && !admission.state.canyonProvenances[`quarantine:${args.entryId}`]?.ledgered) {
        await appendBoundaryLedger("INGRESS_CANYON_STATE_WRITTEN", {
          sessionId: nextConfig.session.sessionId,
          actorId: nextConfig.session.actorId,
          decision: "deny",
          reason: admission.result.reason,
          lawIds: admission.result.lawId ? [admission.result.lawId] : [],
          metadata: {
            provenance: `quarantine:${args.entryId}`,
            provenance_strength: "weak",
            dimension: admission.result.dimension ?? "canyon",
            promotion_kind: admission.result.promotionKind ?? "density",
          },
          createdAt: new Date().toISOString(),
        });
        finalAdmissionState = markCanyonLedgered(admission.state, `quarantine:${args.entryId}`);
      }

      await appendBoundaryLedger("INGRESS_PROVENANCE_BLOCKED", {
        sessionId: nextConfig.session.sessionId,
        actorId: nextConfig.session.actorId,
        decision: "deny",
        reason: admission.result.reason,
        lawIds: admission.result.lawId ? [admission.result.lawId] : [],
        metadata: {
          provenance: `quarantine:${args.entryId}`,
          provenance_strength: "weak",
          dimension: admission.result.dimension ?? "canyon",
        },
        createdAt: new Date().toISOString(),
      });

      nextConfig = {
        ...nextConfig,
        admissionState: finalAdmissionState,
      };
      return {
        config: nextConfig,
        verdict: "pit",
        reason: admission.result.reason,
        lawIds: admission.result.lawId ? [admission.result.lawId] : ["BOUNDARY.ADMISSION.CANYON.01"],
      };
    }

    nextConfig = {
      ...nextConfig,
      admissionState: admission.state,
    };
  }

  const substrateIntercept = await assessBoundarySubstrateIntercept({
    config: nextConfig,
    request: args.request,
  });
  if (substrateIntercept.decision === "Deny") {
    return {
      config: nextConfig,
      verdict: "pit",
      reason: substrateIntercept.reason ?? "substrate denied quarantine replay request",
      lawIds: substrateIntercept.triggeredLawIds,
    };
  }

  const adjudication = await adjudicateBoundaryRequest({
    config: nextConfig,
    request: args.request,
  });
  if (adjudication.result.decision === "allow") {
    return {
      config: nextConfig,
      verdict: "survivor",
      reason: adjudication.result.reason,
      lawIds: adjudication.result.triggeredLawIds,
    };
  }

  return {
    config: nextConfig,
    verdict: "pit",
    reason: adjudication.result.reason,
    lawIds: adjudication.result.triggeredLawIds,
  };
}

async function processQuarantineShard(args: {
  config: BoundaryRuntimeConfig;
  shard: BoundaryQuarantineProgressShard;
  prepared: BoundaryQuarantinePreparedShard;
}): Promise<BoundaryQuarantineShardResult> {
  let config = args.config;

  const reportItems: BoundaryQuarantineReportItem[] = [];
  for (const item of args.prepared.items) {
    if (!item.request) {
      const reportItem = item.preparationPit ?? {
        itemId: item.itemId,
        entryId: item.entryId,
        side: item.side,
        hash: item.hash,
        path: item.path,
        pathHash: item.pathHash,
        verdict: "pit",
        reason: "entry has no request basis and cannot survive quarantine replay",
        lawIds: ["BOUNDARY.QUARANTINE.REQUEST_BASIS.01"],
        resolution: "pending",
      };
      reportItems.push(reportItem);
      await appendBoundaryLedger("QUARANTINE_ITEM_PITTED", {
        sessionId: config.session.sessionId,
        actorId: config.session.actorId,
        decision: "deny",
        reason: reportItem.reason,
        lawIds: reportItem.lawIds,
        metadata: {
          item_id: item.itemId,
          entry_id: item.entryId,
          side: item.side,
          entry_hash: item.hash,
          shard_id: args.shard.shardId,
        },
        createdAt: new Date().toISOString(),
      });
      continue;
    }

    const replay = await evaluateReplayRequest({
      config,
      request: item.request,
      entryId: item.entryId,
    });
    config = replay.config;

    const reportItem: BoundaryQuarantineReportItem = {
      itemId: item.itemId,
      entryId: item.entryId,
      side: item.side,
      hash: item.hash,
      path: item.path,
      pathHash: item.pathHash,
      actionKind: item.request.actionKind,
      target: item.request.target,
      verdict: replay.verdict,
      reason: replay.reason,
      lawIds: replay.lawIds,
      resolution: replay.verdict === "pit" ? "pending" : "survivor",
    };
    reportItems.push(reportItem);

    if (reportItem.verdict === "pit") {
      await appendBoundaryLedger("QUARANTINE_ITEM_PITTED", {
        sessionId: config.session.sessionId,
        actorId: config.session.actorId,
        requestId: item.request.requestId,
        actionKind: item.request.actionKind,
        target: item.request.target,
        decision: "deny",
        reason: reportItem.reason,
        lawIds: reportItem.lawIds,
        metadata: {
          item_id: item.itemId,
          entry_id: item.entryId,
          side: item.side,
          entry_hash: item.hash,
          shard_id: args.shard.shardId,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return {
    shardId: args.shard.shardId,
    config,
    items: reportItems,
    survivorCount: reportItems.filter((item) => item.verdict === "survivor").length,
    pitCount: reportItems.filter((item) => item.verdict === "pit").length,
  };
}

function applyShardResultToProgress(args: {
  progress: BoundaryQuarantineProgress;
  result: BoundaryQuarantineShardResult;
}): BoundaryQuarantineProgress {
  const nextProgress: BoundaryQuarantineProgress = {
    ...args.progress,
    itemsById: {
      ...args.progress.itemsById,
    },
    shards: args.progress.shards.map((shard) => ({ ...shard })),
  };

  for (const item of args.result.items) {
    nextProgress.itemsById[item.itemId] = item;
  }

  const shard = nextProgress.shards.find((candidate) => candidate.shardId === args.result.shardId);
  if (shard) {
    shard.status = "complete";
    shard.survivorCount = args.result.survivorCount;
    shard.pitCount = args.result.pitCount;
    shard.completedAt = new Date().toISOString();
  }

  nextProgress.processedItems = Object.keys(nextProgress.itemsById).length;
  nextProgress.completedShards = nextProgress.shards.filter((candidate) => candidate.status === "complete").length;
  nextProgress.admissionState = args.result.config.admissionState;
  return nextProgress;
}

async function loadOrCreateQuarantineProgress(args: {
  quarantineState: BoundaryQuarantineState;
  snapshot: BoundaryQuarantineSnapshot;
}): Promise<{ progress: BoundaryQuarantineProgress; created: boolean; progressPath: string }> {
  const progressPath = resolveBoundaryQuarantinePaths({
    sessionId: args.snapshot.sessionId,
    sessionsDir: path.dirname(args.quarantineState.snapshotPath),
  }).progressPath;
  const existing = await readJsonFile<BoundaryQuarantineProgress>(progressPath);
  const snapshotHash = hashQuarantineSnapshot(args.snapshot);
  if (existing && existing.snapshotHash === snapshotHash) {
    return {
      progress: existing,
      created: false,
      progressPath,
    };
  }

  const progress = buildInitialQuarantineProgress(args.snapshot);
  await writeJsonFile(progressPath, progress);
  return {
    progress,
    created: true,
    progressPath,
  };
}

export async function armBoundaryQuarantineReboot(args: {
  config: BoundaryRuntimeConfig;
  reason: string;
}): Promise<BoundaryQuarantineState> {
  const createdAt = new Date().toISOString();
  const { snapshotPath, reportPath, progressPath } = resolveBoundaryQuarantinePaths({
    sessionId: args.config.session.sessionId,
    sessionsDir: args.config.persistence?.sessionsDir,
  });

  const items = listUserPathEntries(args.config.upl ?? await loadUserPathLedger())
    .filter((entry) => entry.status === "ACTIVE")
    .filter((entry) => entry.witness !== BASE_HEADLESS_DENIAL_WITNESS_ID)
    .map((entry) => ({
      itemId: `pit-${entry.id}`,
      entryId: entry.id,
      side: entry.type === "APPROVED" ? ("approved" as const) : ("denied" as const),
      hash: hashQuarantineEntry(entry),
      entry,
    }));

  const snapshot: BoundaryQuarantineSnapshot = {
    schemaVersion: 1,
    kind: "buccet_quarantine_snapshot",
    sessionId: args.config.session.sessionId,
    createdAt,
    reason: args.reason,
    items,
  };

  await fs.rm(reportPath, { force: true });
  await fs.rm(progressPath, { force: true });
  await writeJsonFile(snapshotPath, snapshot);

  const quarantineState: BoundaryQuarantineState = {
    required: true,
    status: "pending_replay",
    triggeredAt: createdAt,
    reason: args.reason,
    snapshotPath,
    reportPath,
  };
  await writeBoundarySessionQuarantineState({
    sessionId: args.config.session.sessionId,
    sessionsDir: args.config.persistence?.sessionsDir,
    quarantineState,
  });

  await appendBoundaryLedger("QUARANTINE_REQUIRED", {
    sessionId: args.config.session.sessionId,
    actorId: args.config.session.actorId,
    decision: "deny",
    reason: args.reason,
    metadata: {
      snapshot_path: snapshotPath,
      report_path: reportPath,
      progress_path: progressPath,
      upl_items: items.length,
    },
    createdAt,
  });

  return quarantineState;
}

export async function ensureBoundaryQuarantineReport(args: {
  sessionId: string;
  sessionsDir?: string;
  maxShards?: number;
}): Promise<BoundaryQuarantineReport | null> {
  return withQuarantineLock({
    sessionId: args.sessionId,
    sessionsDir: args.sessionsDir,
    fn: async () => ensureBoundaryQuarantineReportUnlocked(args),
  });
}

async function ensureBoundaryQuarantineReportUnlocked(args: {
  sessionId: string;
  sessionsDir?: string;
  maxShards?: number;
}): Promise<BoundaryQuarantineReport | null> {
  const sessionState = await loadQuarantineState(args);
  const quarantineState = sessionState?.quarantineState;
  if (!quarantineState?.required) {
    return null;
  }

  const existingReport = await readQuarantineReport(quarantineState);
  if (existingReport && quarantineState.status === "pending_resolution") {
    return existingReport;
  }

  const snapshot = await readQuarantineSnapshot(quarantineState);
  if (!snapshot) {
    return null;
  }

  const {
    progress: initialProgress,
    created,
    progressPath,
  } = await loadOrCreateQuarantineProgress({
    quarantineState,
    snapshot,
  });
  let progress = initialProgress;

  let config = await restorePersistentBoundarySession({
    sessionId: args.sessionId,
    sessionsDir: args.sessionsDir,
    hydrationMode: "full",
  });
  if (!config) {
    return null;
  }
  config = enableBodyguardControl(config);
  if (progress.admissionState) {
    config = {
      ...config,
      admissionState: progress.admissionState,
    };
  }

  if (created) {
    await appendBoundaryLedger("QUARANTINE_REPLAY_STARTED", {
      sessionId: config.session.sessionId,
      actorId: config.session.actorId,
      decision: "deny",
      reason: "shed reboot activated boundary-on-self replay against snapped UPL corpus",
      metadata: {
        items: snapshot.items.length,
        snapshot_path: quarantineState.snapshotPath,
        progress_path: progressPath,
        shard_size: progress.shardSize,
        worker_count: progress.workerCount,
      },
      createdAt: new Date().toISOString(),
    });
  }

  const pendingShards = progress.shards.filter((shard) => shard.status !== "complete");
  const shardLimit = typeof args.maxShards === "number"
    ? Math.max(1, args.maxShards)
    : pendingShards.length;
  const activeShards = pendingShards.slice(0, shardLimit);
  const preparedShards = await prepareQuarantineShards({
    session: config.session,
    snapshot,
    shards: activeShards,
    workerCount: Math.min(progress.workerCount, activeShards.length || 1),
  });
  for (const prepared of preparedShards) {
    const shard = activeShards.find((candidate) => candidate.shardId === prepared.shardId);
    if (!shard) {
      continue;
    }
    const result = await processQuarantineShard({
      config,
      shard,
      prepared,
    });
    config = result.config;
    progress = applyShardResultToProgress({
      progress,
      result,
    });
    await writeJsonFile(progressPath, progress);
  }

  const complete = progress.completedShards === progress.totalShards;
  const report = synthesizeQuarantineReport({
    snapshot,
    progress,
    complete,
  });

  if (!complete) {
    return report;
  }

  await writeJsonFile(quarantineState.reportPath, report);
  await writeBoundarySessionQuarantineState({
    sessionId: args.sessionId,
    sessionsDir: args.sessionsDir,
    quarantineState: {
      ...quarantineState,
      status: "pending_resolution",
    },
  });

  await appendBoundaryLedger("QUARANTINE_REPLAY_COMPLETED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    decision: "deny",
    reason: "quarantine replay finished; runtime remains asleep until pit resolution",
    metadata: {
      total: report.total,
      processed_items: report.processedItems,
      survivors: report.survivorCount,
      pit: report.pitCount,
      total_shards: report.totalShards,
      completed_shards: report.completedShards,
      report_path: quarantineState.reportPath,
      progress_path: progressPath,
    },
    createdAt: report.createdAt,
  });

  return report;
}

function decisionForEntry(entry: BoundaryUplEntry) {
  return {
    choice: "deny_as_law" as const,
    scope: normalizeQuarantineScope(entry),
    ...(entry.domain ? { domain: entry.domain } : {}),
    notes: "quarantine replay pit deny as law",
  };
}

export async function applyBoundaryQuarantinePitDenials(args: {
  sessionId: string;
  sessionsDir?: string;
  itemIds?: string[];
}): Promise<BoundaryQuarantineReport | null> {
  return withQuarantineLock({
    sessionId: args.sessionId,
    sessionsDir: args.sessionsDir,
    fn: async () => {
      const sessionState = await loadQuarantineState(args);
      const quarantineState = sessionState?.quarantineState;
      if (!quarantineState?.required) {
        return null;
      }

      const snapshot = await readQuarantineSnapshot(quarantineState);
      const report = await ensureBoundaryQuarantineReportUnlocked(args);
      if (!snapshot || !report) {
        return null;
      }
      if (!report.complete) {
        return report;
      }

      let config = await restorePersistentBoundarySession({
        sessionId: args.sessionId,
        sessionsDir: args.sessionsDir,
        hydrationMode: "full",
      });
      if (!config) {
        return null;
      }
      config = enableBodyguardControl(config);

      const selectedIds = new Set(
        args.itemIds && args.itemIds.length > 0
          ? args.itemIds
          : report.items.filter((item) => item.verdict === "pit" && item.resolution === "pending").map((item) => item.itemId),
      );
      const snapshotByItemId = new Map(snapshot.items.map((item) => [item.itemId, item]));

      let upl = config.upl ?? await loadUserPathLedger();
      const nextItems = report.items.map((item) => ({ ...item }));
      for (const item of nextItems) {
        if (item.verdict !== "pit" || item.resolution !== "pending" || !selectedIds.has(item.itemId)) {
          continue;
        }
        const snapshotItem = snapshotByItemId.get(item.itemId);
        if (!snapshotItem) {
          continue;
        }
        const request = materializeBoundaryActionRequestFromUplEntry({
          entry: snapshotItem.entry,
          session: config.session,
          provenance: "external_content",
          requestId: `pit-deny-${snapshotItem.entry.id}`,
        });
        if (!request) {
          continue;
        }

        const witness = await appendBoundaryLedger("QUARANTINE_DENY_RECORDED", {
          sessionId: config.session.sessionId,
          actorId: config.session.actorId,
          requestId: request.requestId,
          actionKind: request.actionKind,
          target: request.target,
          decision: "deny",
          reason: "user denied quarantined replay item as law",
          lawIds: item.lawIds,
          metadata: {
            item_id: item.itemId,
            entry_id: item.entryId,
            side: item.side,
            entry_hash: item.hash,
          },
          createdAt: new Date().toISOString(),
        });

        await assertBoundaryGravityLawUpdateAllowed({
          config,
          requestId: `upl-quarantine-deny:${snapshotItem.entry.id}`,
          target: `${snapshotItem.entry.scope.toLowerCase()}:upl-quarantine-deny:${snapshotItem.entry.id}`,
          reason: "Quarantine replay recorded standing UPL denial",
          provenance: "trusted_user",
        });

        upl = await writeDeniedUserPathLaw({
          ledger: upl,
          request,
          witness,
          session: config.session,
          decision: decisionForEntry(snapshotItem.entry),
        });
        item.resolution = "denied_as_law";
      }

      const nextReport: BoundaryQuarantineReport = {
        ...report,
        pitSummary: buildPitSummary(nextItems),
        items: nextItems,
      };
      await writeJsonFile(quarantineState.reportPath, nextReport);

      const unresolvedPitCount = nextItems.filter((item) => item.verdict === "pit" && item.resolution === "pending").length;
      const nextConfig: BoundaryRuntimeConfig = {
        ...config,
        upl,
        quarantineState: unresolvedPitCount === 0
          ? {
            ...quarantineState,
            required: false,
            status: "cleared",
          }
          : quarantineState,
      };
      await writeJsonFile(
        resolveBoundaryQuarantinePaths({
          sessionId: args.sessionId,
          sessionsDir: args.sessionsDir,
        }).reportPath,
        nextReport,
      );
      await persistBoundarySessionState(nextConfig);

      if (unresolvedPitCount === 0) {
        await appendBoundaryLedger("QUARANTINE_CLEARED", {
          sessionId: config.session.sessionId,
          actorId: config.session.actorId,
          decision: "allow",
          reason: "all quarantined replay items were resolved into law; clean boot may continue",
          metadata: {
            report_path: quarantineState.reportPath,
          },
          createdAt: new Date().toISOString(),
        });
      }

      return nextReport;
    },
  });
}

export async function getBoundaryQuarantineStatus(args: {
  sessionId: string;
  sessionsDir?: string;
}): Promise<{
  quarantineState: BoundaryQuarantineState | null;
  report: BoundaryQuarantineReport | null;
}> {
  const state = await loadQuarantineState(args);
  const quarantineState = state?.quarantineState ?? null;
  if (!quarantineState) {
    return {
      quarantineState: null,
      report: null,
    };
  }
  return {
    quarantineState,
    report: await ensureBoundaryQuarantineReport(args),
  };
}
