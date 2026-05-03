import { readBoundarySessionTimeline } from "./ledger-audit.ts";
import {
  appendTeamPathSourceMemoryEntry,
  readTeamPathSourceMemoryEntries,
  type TeamManifest,
  type TeamPathSourceMemoryRecord,
  type TeamSlug,
} from "./../teams/team-workshop.ts";
import type {
  BoundaryDecision,
  BoundaryLedgerEventType,
  BoundaryLedgerRecord,
} from "./../runtime/types.ts";

const MIRRORED_SPEND_EVENT_TYPES = new Set<BoundaryLedgerEventType>([
  "ACTION_PROPOSED",
  "DECISION_RETURNED",
  "APPROVAL_REQUESTED",
  "APPROVAL_GRANTED",
  "APPROVAL_DENIED",
  "UPL_TRACK_VIOLATED",
  "PROPOSAL_REPLAYED",
  "ACTION_EXECUTED",
  "ACTION_BLOCKED",
]);

function readStringMeta(record: BoundaryLedgerRecord, key: string): string | null {
  const value = record.payload.metadata?.[key];
  return typeof value === "string" ? value : null;
}

function readNumberMeta(record: BoundaryLedgerRecord, key: string): number | null {
  const value = record.payload.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBooleanMeta(record: BoundaryLedgerRecord, key: string): boolean | null {
  const value = record.payload.metadata?.[key];
  return typeof value === "boolean" ? value : null;
}

function isSpendBoundaryTimelineRecord(record: BoundaryLedgerRecord): boolean {
  return (
    record.payload.actionKind === "agent.spend" &&
    MIRRORED_SPEND_EVENT_TYPES.has(record.eventType)
  );
}

function spendLedgerSummary(record: BoundaryLedgerRecord): string {
  const amountRaw = readStringMeta(record, "spend_amount_raw");
  const amountNormalized = readNumberMeta(record, "spend_amount_normalized");
  const currency = readStringMeta(record, "spend_currency");
  const destinationKind = readStringMeta(record, "spend_destination_kind") ?? "destination";
  const destination = readStringMeta(record, "spend_destination") ?? record.payload.target;
  const merchantHint = readStringMeta(record, "spend_merchant_hint");
  const principal = readStringMeta(record, "spend_principal") ?? "unknown-principal";
  const bucketId = readStringMeta(record, "spend_bucket_id") ?? "unknown-bucket";
  const commitIntent = readStringMeta(record, "spend_commit_intent") ?? "spend";
  const riskClass = readStringMeta(record, "spend_risk_class") ?? "unknown-risk";
  const recurring = readBooleanMeta(record, "spend_recurring");

  const amount =
    amountRaw ??
    (amountNormalized !== null ? String(amountNormalized) : "unknown-amount");
  const amountWithCurrency = currency ? `${amount} ${currency}` : amount;

  return [
    `${record.eventType} · ${commitIntent} ${amountWithCurrency} -> ${destinationKind}:${destination}${merchantHint ? ` (${merchantHint})` : ""}`,
    `principal=${principal} bucket=${bucketId} risk=${riskClass} recurring=${recurring === true ? "yes" : recurring === false ? "no" : "unknown"}`,
    `reason=${record.payload.reason}`,
  ].join("\n");
}

function spendLedgerTitle(record: BoundaryLedgerRecord): string {
  const decision = record.payload.decision ?? "pending";
  const commitIntent = readStringMeta(record, "spend_commit_intent") ?? "spend";
  return `spend:${record.eventType.toLowerCase()}:${decision}:${commitIntent}`;
}

function mirroredLedgerIndexes(records: TeamPathSourceMemoryRecord[]): Set<number> {
  const indexes = new Set<number>();
  for (const record of records) {
    const value = record.meta?.boundaryLedgerIndex;
    if (typeof value === "number" && Number.isFinite(value)) {
      indexes.add(value);
    }
  }
  return indexes;
}

export type SpendBoundaryProofSyncResult = {
  manifest: TeamManifest | null;
  appended: TeamPathSourceMemoryRecord[];
  sessionRecords: BoundaryLedgerRecord[];
  latestDecision: {
    decision: BoundaryDecision | null;
    reason: string;
    requestId?: string;
  } | null;
};

export async function syncTeamSpendBoundaryProofOfWork(args: {
  homePath: string;
  slug: TeamSlug;
  sessionId: string;
}): Promise<SpendBoundaryProofSyncResult> {
  const existing = await readTeamPathSourceMemoryEntries(args.homePath, args.slug);
  const seenLedgerIndexes = mirroredLedgerIndexes(existing);
  const sessionRecords = (await readBoundarySessionTimeline(args.sessionId))
    .filter(isSpendBoundaryTimelineRecord);

  const appended: TeamPathSourceMemoryRecord[] = [];
  let manifest: TeamManifest | null = null;
  for (const record of sessionRecords) {
    if (seenLedgerIndexes.has(record.index)) {
      continue;
    }
    const appendedRecord = await appendTeamPathSourceMemoryEntry({
      homePath: args.homePath,
      slug: args.slug,
      kind: "spend_boundary",
      title: spendLedgerTitle(record),
      text: spendLedgerSummary(record),
      meta: {
        boundaryLedgerIndex: record.index,
        boundaryEventType: record.eventType,
        boundaryDecision: record.payload.decision ?? null,
        boundaryRequestId: record.payload.requestId ?? null,
        boundaryTarget: record.payload.target,
        boundaryReason: record.payload.reason,
        ...record.payload.metadata,
      },
    });
    manifest = appendedRecord.manifest;
    appended.push(appendedRecord.record);
    seenLedgerIndexes.add(record.index);
  }

  const latestDecisionRecord = [...sessionRecords]
    .reverse()
    .find((record) => record.eventType === "DECISION_RETURNED");

  return {
    manifest,
    appended,
    sessionRecords,
    latestDecision: latestDecisionRecord
      ? {
        decision: latestDecisionRecord.payload.decision ?? null,
        reason: latestDecisionRecord.payload.reason,
        ...(latestDecisionRecord.payload.requestId
          ? { requestId: latestDecisionRecord.payload.requestId }
          : {}),
      }
      : null,
  };
}
