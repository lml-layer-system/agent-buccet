import {
  readAllBoundaryLedgerRecords,
  readBoundaryLedgerByRequest,
  readBoundaryLedgerBySession,
} from "./ledger.ts";
import type {
  BoundaryLedgerEventType,
  BoundaryLedgerRecord,
} from "./types.ts";

export type BoundaryLedgerAuditStatus = "complete" | "incomplete" | "missing";

const REQUEST_REQUIRED_EVENTS: BoundaryLedgerEventType[] = [
  "ACTION_PROPOSED",
  "DECISION_RETURNED",
];

const REQUEST_TERMINAL_EVENTS: BoundaryLedgerEventType[] = [
  "ACTION_EXECUTED",
  "ACTION_BLOCKED",
  "APPROVAL_DENIED",
  "APPROVAL_GRANTED",
];

function hasTerminalDecisionReturned(trace: BoundaryLedgerRecord[]): boolean {
  const latestDecision = [...trace]
    .reverse()
    .find((record) => record.eventType === "DECISION_RETURNED");
  if (!latestDecision) {
    return false;
  }
  return (
    latestDecision.payload.decision === "allow" ||
    latestDecision.payload.decision === "deny"
  );
}

const SESSION_REQUIRED_EVENTS: BoundaryLedgerEventType[] = [
  "SESSION_STARTED",
  "SESSION_PERSISTED",
];

export async function readBoundaryRequestTrace(requestId: string): Promise<BoundaryLedgerRecord[]> {
  const records = await readBoundaryLedgerByRequest(requestId);
  return records.sort((a, b) => a.index - b.index);
}

export async function readBoundarySessionTimeline(sessionId: string): Promise<BoundaryLedgerRecord[]> {
  const records = await readBoundaryLedgerBySession(sessionId);
  return records.sort((a, b) => a.index - b.index);
}

export async function auditBoundaryRequestLedger(requestId: string): Promise<{
  status: BoundaryLedgerAuditStatus;
  trace: BoundaryLedgerRecord[];
  missingEventTypes: BoundaryLedgerEventType[];
  reason: string;
}> {
  const trace = await readBoundaryRequestTrace(requestId);
  if (trace.length === 0) {
    return {
      status: "missing",
      trace,
      missingEventTypes: [...REQUEST_REQUIRED_EVENTS],
      reason: "request has no ledger trace and should not be trusted",
    };
  }

  const seen = new Set(trace.map((record) => record.eventType));
  const missingRequired = REQUEST_REQUIRED_EVENTS.filter((eventType) => !seen.has(eventType));
  const hasTerminal = REQUEST_TERMINAL_EVENTS.some((eventType) => seen.has(eventType));
  const hasTerminalDecision = hasTerminalDecisionReturned(trace);
  const missingEventTypes =
    hasTerminal || hasTerminalDecision
      ? missingRequired
      : [...missingRequired, ...REQUEST_TERMINAL_EVENTS];

  if (missingEventTypes.length > 0) {
    return {
      status: "incomplete",
      trace,
      missingEventTypes,
      reason: "request trace is incomplete; boundary runtime should treat it as non-authoritative",
    };
  }

  return {
    status: "complete",
    trace,
    missingEventTypes: [],
    reason: "request trace is complete and ledgered",
  };
}

export async function auditBoundarySessionLedger(sessionId: string): Promise<{
  status: BoundaryLedgerAuditStatus;
  trace: BoundaryLedgerRecord[];
  missingEventTypes: BoundaryLedgerEventType[];
  reason: string;
}> {
  const trace = await readBoundarySessionTimeline(sessionId);
  if (trace.length === 0) {
    return {
      status: "missing",
      trace,
      missingEventTypes: [...SESSION_REQUIRED_EVENTS],
      reason: "session has no ledger timeline and should not be trusted",
    };
  }

  const seen = new Set(trace.map((record) => record.eventType));
  const missingEventTypes = SESSION_REQUIRED_EVENTS.filter((eventType) => !seen.has(eventType));
  if (missingEventTypes.length > 0) {
    return {
      status: "incomplete",
      trace,
      missingEventTypes,
      reason: "session timeline is incomplete; persisted authority should be treated cautiously",
    };
  }

  return {
    status: "complete",
    trace,
    missingEventTypes: [],
    reason: "session timeline is complete and ledgered",
  };
}

export function formatBoundaryLedgerRecords(records: BoundaryLedgerRecord[]): string[] {
  return records.map((record) => {
    const parts = [
      `#${record.index}`,
      record.eventType,
      record.payload.createdAt,
      `session=${record.payload.sessionId}`,
    ];
    if (record.payload.requestId) {
      parts.push(`request=${record.payload.requestId}`);
    }
    if (record.payload.actionKind) {
      parts.push(`action=${record.payload.actionKind}`);
    }
    if (record.payload.target) {
      parts.push(`target=${record.payload.target}`);
    }
    if (record.payload.decision) {
      parts.push(`decision=${record.payload.decision}`);
    }
    parts.push(`reason=${record.payload.reason}`);
    return parts.join(" | ");
  });
}

export async function readLatestBoundaryAuditSnapshot(): Promise<BoundaryLedgerRecord | null> {
  const records = await readAllBoundaryLedgerRecords();
  return records.length > 0 ? records[records.length - 1] : null;
}
