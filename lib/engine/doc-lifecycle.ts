export type DocLifecycleState =
  | "uploaded"
  | "parsing"
  | "active"
  | "paused"
  | "expired"
  | "removed"
  | "archived"
  | "superseded"
  | "locked";

export type DocLifecycleEvent =
  | "parse"
  | "activate"
  | "pause"
  | "resume"
  | "expire"
  | "remove"
  | "archive"
  | "supersede"
  | "lock";

export type DocLifecycleRecord = {
  id: string;
  state: DocLifecycleState;
  authority: number;
  scope: string;
  enforcementBindings: string[];
  updatedAt: string;
};

const TRANSITIONS: Record<DocLifecycleState, DocLifecycleState[]> = {
  uploaded: ["parsing", "removed", "locked"],
  parsing: ["active", "removed", "locked"],
  active: ["paused", "expired", "removed", "superseded", "locked"],
  paused: ["active", "expired", "removed", "locked"],
  expired: ["archived", "removed", "locked"],
  removed: [],
  archived: ["superseded", "locked"],
  superseded: ["archived", "removed", "locked"],
  locked: ["removed"],
};

const EVENT_TO_STATE: Record<DocLifecycleEvent, DocLifecycleState> = {
  parse: "parsing",
  activate: "active",
  pause: "paused",
  resume: "active",
  expire: "expired",
  remove: "removed",
  archive: "archived",
  supersede: "superseded",
  lock: "locked",
};

export function applyLifecycleEvent(record: DocLifecycleRecord, event: DocLifecycleEvent): DocLifecycleRecord {
  const next = EVENT_TO_STATE[event];
  const allowed = TRANSITIONS[record.state] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid transition: ${record.state} -> ${next}`);
  }

  const shouldCleanup = next === "removed" || next === "expired";
  return {
    ...record,
    state: next,
    enforcementBindings: shouldCleanup ? [] : record.enforcementBindings,
    updatedAt: new Date().toISOString(),
  };
}

export function resolveConflictStrictHierarchy(records: DocLifecycleRecord[]): DocLifecycleRecord | null {
  if (records.length === 0) {
    return null;
  }

  return [...records].sort((a, b) => {
    if (b.authority !== a.authority) {
      return b.authority - a.authority;
    }
    return a.id.localeCompare(b.id);
  })[0];
}

