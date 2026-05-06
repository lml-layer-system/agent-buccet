/**
 * Create-side prompt routing.
 *
 * Invariant:
 *   CreateRun(completed|blocked|waiting) + PromptMode → CreatePromptEvent | null
 *
 * Proves:
 *   1. Defense/bodyguard prompt path is untouched — this module owns only the creation side.
 *   2. Completed/blocked/waiting run => deterministic CreatePromptEvent JSON shape.
 *   3. standing_law mode suppresses the create prompt (returns null from render).
 *
 * The args shape for buildCreatePromptEvent mirrors the `meta` object written to
 * `team_status` session records so callers can reconstruct the event from persisted
 * state without re-running the pass.
 */

export type BuccetPromptMode = "interactive" | "standing_law";

export type CreatePromptKind = "completed" | "blocked" | "waiting";

/**
 * Deterministic JSON shape for a creation-side run outcome.
 *
 * All fields are stable and serialisable — this is the wire/persisted shape.
 */
export type CreatePromptEvent = {
  kind: CreatePromptKind;
  teamSlug: string;
  /** comprehensionPass.passId — stable run identifier */
  runId: string;
  /** spokesperson agent id */
  agentId: string;
  /** coherence adjudication disposition */
  disposition: string;
  finalizationBlocked: boolean;
  /** what the run is waiting for (null when completed) */
  waitingFor: string | null;
  /** next operator action to unblock (null when completed) */
  nextOperatorAction: string | null;
  at: string;
};

/**
 * Input type for buildCreatePromptEvent.
 *
 * Field names intentionally mirror the `meta` keys persisted in `team_status`
 * session log records so this can be round-tripped from disk without ambiguity:
 *   meta.comprehensionPass  → runId
 *   meta.spokesperson       → agentId
 *   meta.coherenceDisposition → disposition
 *   meta.finalizationBlocked  → finalizationBlocked
 *   meta.status             → status
 */
export type CreatePromptEventArgs = {
  teamSlug: string;
  runId: string;
  agentId: string;
  disposition: string;
  finalizationBlocked: boolean;
  status: "completed" | "blocked" | "waiting" | "queued" | "failed";
  /** human-readable reason the run is waiting/blocked */
  waitingReason?: string;
  at?: string;
};

const NEXT_ACTION_BLOCKED =
  "review coherence gate output; revise peer specialty or run config, then re-ask";

const NEXT_ACTION_WAITING =
  "install Pi engine (`buccet engine install`) or check `buccet console` for pending boundary events";

export function buildCreatePromptEvent(args: CreatePromptEventArgs): CreatePromptEvent {
  let kind: CreatePromptKind;
  let waitingFor: string | null;
  let nextOperatorAction: string | null;

  if (args.status === "completed" && !args.finalizationBlocked) {
    kind = "completed";
    waitingFor = null;
    nextOperatorAction = null;
  } else if (args.status === "blocked" || args.finalizationBlocked) {
    kind = "blocked";
    waitingFor = args.waitingReason ?? `coherence gate — disposition: ${args.disposition}`;
    nextOperatorAction = NEXT_ACTION_BLOCKED;
  } else {
    // queued | failed | waiting
    kind = "waiting";
    waitingFor = args.waitingReason ?? "Pi engine not available — run queued to message queue";
    nextOperatorAction = NEXT_ACTION_WAITING;
  }

  return {
    kind,
    teamSlug: args.teamSlug,
    runId: args.runId,
    agentId: args.agentId,
    disposition: args.disposition,
    finalizationBlocked: args.finalizationBlocked,
    waitingFor,
    nextOperatorAction,
    at: args.at ?? new Date().toISOString(),
  };
}

/**
 * Returns a formatted string for interactive mode, or null for headless (standing_law).
 *
 * Returning null is the signal to the caller to skip console output — same
 * convention used for suppressed interactive prompts elsewhere in the system.
 */
export function renderCreatePromptEvent(
  event: CreatePromptEvent,
  mode: BuccetPromptMode,
): string | null {
  if (mode === "standing_law") {
    return null;
  }

  const header = `buccet create · ${event.teamSlug} · run ${event.runId} · ${event.kind}`;
  const lines = [header];
  lines.push(`  spokesperson: ${event.agentId}`);
  lines.push(`  disposition:  ${event.disposition}`);

  if (event.waitingFor !== null) {
    lines.push(`  waiting for:  ${event.waitingFor}`);
  }
  if (event.nextOperatorAction !== null) {
    lines.push(`  next action:  ${event.nextOperatorAction}`);
  }

  return lines.join("\n");
}
