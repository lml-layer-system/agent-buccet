import { promises as fs } from "node:fs";
import path from "node:path";
import { applyPendingLawProposals, listPersistedContextStates, persistContextState, queuePendingLawProposals, type InfiniteContextState } from "./infinite-context.ts";
import { appendMetaDeliveryRecords, isCriticalMetaProposal, proposalKey, type PendingLawProposal } from "./meta-delivery.ts";

const LEDGER_DIR = path.join(process.cwd(), "data", "ledger");
const WORKER_STATUS_FILE = path.join(LEDGER_DIR, "meta-loop-worker-status.json");

export type MetaLoopWorkerStatus = {
  running: boolean;
  at: string;
  sessionCount: number;
  deliveries: number;
  applied: number;
  criticalApplied: number;
  modeCounts: {
    ask_every_update: number;
    automate: number;
  };
};

export async function runMetaLoopWorkerPass(): Promise<MetaLoopWorkerStatus> {
  const states = await listPersistedContextStates();
  let deliveries = 0;
  let applied = 0;
  let criticalApplied = 0;
  let askCount = 0;
  let automateCount = 0;

  for (const state of states) {
    const runId = `meta-worker-${Date.now()}-${sanitizeSegment(state.sessionId)}`;
    if (state.automation.metaLoopMode === "automate") {
      automateCount += 1;
    } else {
      askCount += 1;
    }

    const beforePending = state.pendingLawProposals.length;
    const beforeActive = state.activeAutoLaws.length;
    const beforeCritical = countCritical(state.activeAutoLaws);

    if (state.automation.quantumBlanketAlwaysOn) {
      const quantumDeliveries = enqueueQuantumBlanketDeliveries(state);
      deliveries += quantumDeliveries.length;
      if (quantumDeliveries.length > 0) {
        await appendMetaDeliveryRecords(
          state.sessionId,
          runId,
          quantumDeliveries,
          resolveAutoApplySources(state),
        );
      }
      state.automation.lastQuantumBlanketTickAt = new Date().toISOString();
    }

    if (state.automation.metaLoopAlwaysOn) {
      const metaDeliveries = enqueueCriticalSystemMetaDeliveries(state);
      deliveries += metaDeliveries.length;
      if (metaDeliveries.length > 0) {
        await appendMetaDeliveryRecords(
          state.sessionId,
          runId,
          metaDeliveries,
          resolveAutoApplySources(state),
        );
      }
      state.automation.lastMetaLoopTickAt = new Date().toISOString();
    }

    applyPendingLawProposals(state, {
      autoApplySources: resolveAutoApplySources(state),
    });

    applied += Math.max(0, state.activeAutoLaws.length - beforeActive);
    criticalApplied += Math.max(0, countCritical(state.activeAutoLaws) - beforeCritical);

    if (state.pendingLawProposals.length !== beforePending || state.activeAutoLaws.length !== beforeActive) {
      await persistContextState(state);
    }
  }

  const status: MetaLoopWorkerStatus = {
    running: true,
    at: new Date().toISOString(),
    sessionCount: states.length,
    deliveries,
    applied,
    criticalApplied,
    modeCounts: {
      ask_every_update: askCount,
      automate: automateCount,
    },
  };
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  await fs.writeFile(WORKER_STATUS_FILE, JSON.stringify(status), "utf8");
  return status;
}

export async function readMetaLoopWorkerStatus(): Promise<MetaLoopWorkerStatus | null> {
  try {
    return JSON.parse(await fs.readFile(WORKER_STATUS_FILE, "utf8")) as MetaLoopWorkerStatus;
  } catch {
    return null;
  }
}

function enqueueCriticalSystemMetaDeliveries(state: InfiniteContextState): PendingLawProposal[] {
  const proposals: PendingLawProposal[] = [];
  if (!hasLawSignal(state, /\bparity|ledger|mirror\b/i)) {
    proposals.push({
      text: "Critical meta laws must preserve ledger parity, mirror integrity, and fail closed on drift.",
      scope: "meta",
      enforcement: "meta_hardening_system_integrity",
      source: "meta_projection_loop",
    });
  }
  if (!hasLawSignal(state, /\broot lock|parent lock|clipped to null|collapse clipped\b/i)) {
    proposals.push({
      text: "Critical meta laws must preserve real parent lock, clip non-locking branches to NULL, and keep branch and tree state legible.",
      scope: "meta",
      enforcement: "meta_hardening_parent_lock",
      source: "meta_projection_loop",
    });
  }
  if (!hasLawSignal(state, /\bpreserve life|life preservation|988|crisis\b/i)) {
    proposals.push({
      text: "Critical meta laws must preserve life first, keep human presence, and escalate immediate safety support when crisis signals appear.",
      scope: "meta",
      enforcement: "meta_hardening_life_preservation",
      source: "meta_projection_loop",
    });
  }
  return queueUniquePendingProposals(state, proposals);
}

function enqueueQuantumBlanketDeliveries(state: InfiniteContextState): PendingLawProposal[] {
  const artifact = [
    resolveWorkerMessage(state),
    ...state.docs.slice(-4).map((doc) => doc.text),
    ...state.ltm.L0.slice(-4).flatMap((turn) => [turn.user, turn.assistant]),
    ...state.userOverlayLaws.slice(-4).map((law) => law.text),
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n");

  if (!artifact) {
    return [];
  }

  const seeds = artifact
    .split(/[\n\r]+|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 24)
    .slice(0, 16);

  const proposals: PendingLawProposal[] = [];
  for (const seed of seeds) {
    const lower = seed.toLowerCase();
    if (/\b(life|suicide|self harm|crisis|988|panic)\b/.test(lower)) {
      proposals.push({
        text: "Meta critical intercept must preserve life first, keep human presence, and escalate immediate safety support when crisis signals appear.",
        scope: "meta",
        enforcement: "quantum_blanket_seed_review",
        source: "quantum_blanket_seed",
      });
      continue;
    }
    if (/\b(nocr|root|parent|collapse|null|admissible|branch|tree)\b/.test(lower)) {
      proposals.push({
        text: "Meta critical intercept must preserve lawful parent lock, collapse clipped branches to NULL, and keep branch and tree state legible.",
        scope: "meta",
        enforcement: "quantum_blanket_seed_review",
        source: "quantum_blanket_seed",
      });
      continue;
    }
    if (/\b(ledger|parity|mirror|repair|nsl|fail[- ]closed)\b/.test(lower)) {
      proposals.push({
        text: "Ledger parity, mirror integrity, and repair trace continuity must remain intact before output admission.",
        scope: "meta",
        enforcement: "quantum_blanket_seed_review",
        source: "quantum_blanket_seed",
      });
    }
  }

  return queueUniquePendingProposals(state, proposals);
}

function hasLawSignal(state: InfiniteContextState, pattern: RegExp): boolean {
  return [...state.pendingLawProposals, ...state.activeAutoLaws].some((law) => pattern.test(law.text));
}

function countCritical(laws: Array<{ text: string; scope: string; enforcement: string; source: string }>): number {
  return laws.filter((law) => isCriticalMetaProposal(law)).length;
}

function resolveWorkerMessage(state: InfiniteContextState): string {
  const recentUser = state.ltm.L0.slice(-2).map((turn) => turn.user).join("\n");
  return state.wm.focus ?? recentUser ?? "";
}

function queueUniquePendingProposals(state: InfiniteContextState, proposals: PendingLawProposal[]): PendingLawProposal[] {
  if (proposals.length === 0) {
    return [];
  }
  const seen = new Set([
    ...state.pendingLawProposals.map(proposalKey),
    ...state.activeAutoLaws.map(proposalKey),
  ]);
  const fresh = proposals.filter((proposal) => !seen.has(proposalKey(proposal)));
  if (fresh.length === 0) {
    return [];
  }
  queuePendingLawProposals(state, fresh);
  return fresh;
}

function resolveAutoApplySources(state: InfiniteContextState): string[] {
  return state.automation.metaLoopMode === "automate"
    ? ["meta_projection_loop", "novelty_cycle", "quantum_blanket_seed", "meta_failure_learning"]
    : ["meta_projection_loop", "novelty_cycle"];
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 40) || "session";
}
