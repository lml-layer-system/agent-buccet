import { promises as fs } from "node:fs";
import path from "node:path";

export type ContextDoc = {
  id: string;
  name: string;
  text: string;
};

export type ContextTurn = {
  step: number;
  user: string;
  assistant: string;
  admitted: boolean;
  reason: string;
  at: string;
};

export type InfiniteContextState = {
  sessionId: string;
  userOverlayLaws: Array<{ law_id: string; text: string; scope: string; enforcement: string }>;
  wm: {
    focus: string | null;
    stack: string[];
    goals: string[];
    bindings: Record<string, string>;
    constraints: string[];
    results: string[];
    marker: string;
  };
  ltm: {
    L0: ContextTurn[];
    L1: string[];
    L2: string[];
    L3: string[];
  };
  dependencies: Array<{ from: string; to: string }>;
  docs: ContextDoc[];
  pendingLawProposals: Array<{ text: string; scope: string; enforcement: string; source: string }>;
  activeAutoLaws: Array<{ text: string; scope: string; enforcement: string; source: string }>;
  step: number;
};

const CONTEXT_STORE = new Map<string, InfiniteContextState>();
const CONTEXT_DIR = path.join(process.cwd(), "data", "lml-context");
const MAX_L0 = 100;
const MAX_L1 = 1000;
const MAX_L2 = 10000;
const WM_CAP = 7;

export async function getOrCreateContextState(sessionId: string): Promise<InfiniteContextState> {
  const key = sanitizeSessionId(sessionId);
  const existing = CONTEXT_STORE.get(sessionId);
  if (existing) {
    return existing;
  }
  try {
    const loaded = await fs.readFile(path.join(CONTEXT_DIR, `${key}.json`), "utf8");
    const parsed = JSON.parse(loaded) as InfiniteContextState;
    CONTEXT_STORE.set(sessionId, parsed);
    return parsed;
  } catch {
    // fall through and create
  }
  const created: InfiniteContextState = {
    sessionId,
    userOverlayLaws: [],
    wm: {
      focus: null,
      stack: [],
      goals: [],
      bindings: {},
      constraints: [],
      results: [],
      marker: "init",
    },
    ltm: {
      L0: [],
      L1: [],
      L2: [],
      L3: [],
    },
    dependencies: [],
    docs: [],
    pendingLawProposals: [],
    activeAutoLaws: [],
    step: 0,
  };
  CONTEXT_STORE.set(sessionId, created);
  await persistContextState(created);
  return created;
}

export function applyPendingLawProposals(state: InfiniteContextState): number {
  if (state.pendingLawProposals.length === 0) {
    return 0;
  }
  const before = state.activeAutoLaws.length;
  const all = [...state.activeAutoLaws, ...state.pendingLawProposals];
  state.activeAutoLaws = uniqueLaws(all);
  state.pendingLawProposals = [];
  return state.activeAutoLaws.length - before;
}

export function mergeUserOverlayLaws(
  state: InfiniteContextState,
  incoming: Array<{ law_id: string; text: string; scope: string; enforcement: string }>,
): void {
  const map = new Map<string, { law_id: string; text: string; scope: string; enforcement: string }>();
  for (const law of state.userOverlayLaws) {
    map.set(`${law.text.toLowerCase()}|${law.scope}|${law.enforcement}`, law);
  }
  for (const law of incoming) {
    map.set(`${law.text.toLowerCase()}|${law.scope}|${law.enforcement}`, law);
  }
  state.userOverlayLaws = Array.from(map.values());
}

export function setUserOverlayLaws(
  state: InfiniteContextState,
  incoming: Array<{ law_id: string; text: string; scope: string; enforcement: string }>,
): void {
  state.userOverlayLaws = incoming;
}

export function clearAllOverlayLaws(state: InfiniteContextState): void {
  state.userOverlayLaws = [];
  state.pendingLawProposals = [];
  state.activeAutoLaws = [];
}

export function updateInfiniteContext(state: InfiniteContextState, turn: {
  user: string;
  assistant: string;
  admitted: boolean;
  reason: string;
  constraints: string[];
  docs?: ContextDoc[];
}): void {
  state.step += 1;
  const nextFocus = deriveSignalFocus(turn.user);
  if (nextFocus) {
    state.wm.focus = nextFocus;
  }
  state.wm.stack = pushCap(state.wm.stack, turn.user, 4);
  state.wm.results = pushCap(state.wm.results, turn.assistant, 4);
  state.wm.constraints = pushUniqueCap(state.wm.constraints, turn.constraints, 10);
  updateBindingsAndGoals(state, turn.user);
  state.wm.marker = `step_${String(state.step)}`;
  state.docs = mergeDocs(state.docs, turn.docs ?? []);

  const entry: ContextTurn = {
    step: state.step,
    user: turn.user,
    assistant: turn.assistant,
    admitted: turn.admitted,
    reason: turn.reason,
    at: new Date().toISOString(),
  };
  state.ltm.L0.push(entry);
  if (state.ltm.L0.length > MAX_L0) {
    const shifted = state.ltm.L0.shift();
    if (shifted) {
      state.ltm.L1.push(`[S${shifted.step}] ${trim(shifted.user, 90)} -> ${shifted.admitted ? "ok" : "refusal"}`);
    }
  }
  if (state.ltm.L1.length > MAX_L1) {
    const shifted = state.ltm.L1.shift();
    if (shifted) {
      state.ltm.L2.push(shifted);
    }
  }
  if (state.ltm.L2.length > MAX_L2) {
    state.ltm.L2.shift();
  }

  state.dependencies.push({ from: `u:${state.step}`, to: `a:${state.step}` });
  if (state.dependencies.length > 10000) {
    state.dependencies.shift();
  }

  pruneWorkingMemory(state);
}

export async function persistContextState(state: InfiniteContextState): Promise<void> {
  const key = sanitizeSessionId(state.sessionId);
  await fs.mkdir(CONTEXT_DIR, { recursive: true });
  await fs.writeFile(path.join(CONTEXT_DIR, `${key}.json`), JSON.stringify(state), "utf8");
}

function pruneWorkingMemory(state: InfiniteContextState): void {
  state.wm.stack = state.wm.stack.slice(-WM_CAP);
  state.wm.goals = state.wm.goals.slice(-WM_CAP);
  const bindings = Object.entries(state.wm.bindings).slice(-WM_CAP);
  state.wm.bindings = Object.fromEntries(bindings);
  state.wm.constraints = state.wm.constraints.slice(-WM_CAP);
  state.wm.results = state.wm.results.slice(-WM_CAP);
}

function mergeDocs(existing: ContextDoc[], incoming: ContextDoc[]): ContextDoc[] {
  const byId = new Map(existing.map((doc) => [doc.id, doc] as const));
  for (const doc of incoming) {
    byId.set(doc.id, doc);
  }
  return Array.from(byId.values());
}

function uniqueLaws<T extends { text: string; scope: string; enforcement: string }>(laws: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const law of laws) {
    byKey.set(`${law.text.toLowerCase()}|${law.scope}|${law.enforcement}`, law);
  }
  return Array.from(byKey.values());
}

function pushCap(list: string[], value: string, max: number): string[] {
  const out = [...list, value];
  return out.slice(-max);
}

function pushUniqueCap(base: string[], incoming: string[], max: number): string[] {
  const set = [...new Set([...base, ...incoming])];
  return set.slice(-max);
}

function trim(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}

function sanitizeSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120) || "default";
}

function updateBindingsAndGoals(state: InfiniteContextState, userMessage: string): void {
  const lower = userMessage.toLowerCase();

  if (/\b(don't|do not|stop|no longer)\b.*\b(my guy|slang|street|casual)\b/.test(lower)) {
    state.wm.bindings.expression_override = "requested";
  }
  if (/\b(address me as)\b/.test(lower)) {
    state.wm.bindings.addressing_rule = userMessage.trim();
  }
  if (/\b(summarize|what did you learn|what did u learn|what did you get|what u get)\b/.test(lower)) {
    state.wm.goals = pushCap(state.wm.goals, "doc_learning_summary", WM_CAP);
  }
  if (/\b(add law|ingest|apply lml|upload|document)\b/.test(lower)) {
    state.wm.goals = pushCap(state.wm.goals, "law_ingestion", WM_CAP);
  }
}

function deriveSignalFocus(userMessage: string): string | null {
  const value = userMessage.trim();
  if (!value) {
    return null;
  }
  const lower = value.toLowerCase();
  if (/^(yo|hey|hi|hello|sup|what up|ok|okay|k|yup|yep|nah|bro|my guy|bet)\W*$/.test(lower)) {
    return null;
  }
  if (value.length < 4) {
    return null;
  }
  return value;
}
