/**
 * Create-Prompt Routing Contract
 *
 * Invariants:
 *   1. Defense/bodyguard prompt path is unchanged — create-prompt module does not
 *      interfere with boundary event rendering.
 *   2. Creation-side run outcome (completed/blocked/waiting) → deterministic
 *      CreatePromptEvent JSON shape with team/run/wait reason clearly named.
 *   3. headless (standing_law) mode suppresses the create prompt; interactive
 *      mode emits it.
 *
 * All assertions are pure-logic (no I/O, no servers) — the contract proves
 * the routing model, not the full brain-pass pipeline.
 */
import assert from "node:assert/strict";
import {
  buildCreatePromptEvent,
  renderCreatePromptEvent,
  type CreatePromptEvent,
  type BuccetPromptMode,
} from "./../../src/runtime/create-prompt.ts";

// ── 1. Defense prompt path — untouched ──────────────────────────────────────
// The create-prompt module exports no function that touches boundary events.
// Prove that renderCreatePromptEvent is purely additive and never returns a
// boundary-event string (which would start with "BODYGUARD" or "BOUNDARY").

const completedEvent = buildCreatePromptEvent({
  teamSlug: "research-team",
  runId: "research-team:comprehension-pass",
  agentId: "pi-spokesperson",
  disposition: "Accept",
  finalizationBlocked: false,
  status: "completed",
  at: "2026-04-28T00:00:00.000Z",
});

const rendered = renderCreatePromptEvent(completedEvent, "interactive");
assert.ok(rendered !== null, "interactive mode must render");
assert.ok(!rendered.startsWith("BODYGUARD"), "create prompt must not mimic defense prompt header");
assert.ok(!rendered.startsWith("BOUNDARY"), "create prompt must not mimic defense prompt header");
assert.ok(rendered.includes("buccet create"), "create prompt must identify itself");

// ── 2. Create prompt: completed run ─────────────────────────────────────────

assert.equal(completedEvent.kind, "completed");
assert.equal(completedEvent.teamSlug, "research-team");
assert.equal(completedEvent.runId, "research-team:comprehension-pass");
assert.equal(completedEvent.agentId, "pi-spokesperson");
assert.equal(completedEvent.disposition, "Accept");
assert.equal(completedEvent.finalizationBlocked, false);
assert.equal(completedEvent.waitingFor, null, "completed run has no waitingFor");
assert.equal(completedEvent.nextOperatorAction, null, "completed run has no nextOperatorAction");

const renderedCompleted = renderCreatePromptEvent(completedEvent, "interactive");
assert.ok(renderedCompleted !== null);
assert.ok(renderedCompleted.includes("research-team"), "rendered event must name the team");
assert.ok(renderedCompleted.includes("research-team:comprehension-pass"), "rendered event must name the run");
assert.ok(renderedCompleted.includes("completed"), "rendered event must state outcome");
assert.ok(renderedCompleted.includes("pi-spokesperson"), "rendered event must name the spokesperson");

// ── 3. Create prompt: blocked run ────────────────────────────────────────────

const blockedEvent = buildCreatePromptEvent({
  teamSlug: "analysis-team",
  runId: "analysis-team:comprehension-pass",
  agentId: "pi-spokesperson",
  disposition: "BlockFinalization",
  finalizationBlocked: true,
  status: "blocked",
  at: "2026-04-28T00:01:00.000Z",
});

assert.equal(blockedEvent.kind, "blocked");
assert.ok(blockedEvent.waitingFor !== null, "blocked run must report waitingFor");
assert.ok(blockedEvent.waitingFor!.includes("BlockFinalization"), "waitingFor must include disposition");
assert.ok(blockedEvent.nextOperatorAction !== null, "blocked run must report nextOperatorAction");

const renderedBlocked = renderCreatePromptEvent(blockedEvent, "interactive");
assert.ok(renderedBlocked !== null);
assert.ok(renderedBlocked.includes("blocked"), "rendered blocked event must state outcome");
assert.ok(renderedBlocked.includes("waiting for"), "rendered blocked event must include waitingFor label");
assert.ok(renderedBlocked.includes("next action"), "rendered blocked event must include nextOperatorAction label");

// ── 4. Create prompt: waiting run (queued — Pi not installed) ────────────────

const waitingEvent = buildCreatePromptEvent({
  teamSlug: "writer-team",
  runId: "writer-team:comprehension-pass",
  agentId: "pi-spokesperson",
  disposition: "Accept",
  finalizationBlocked: false,
  status: "queued",
  waitingReason: "Pi engine not installed",
  at: "2026-04-28T00:02:00.000Z",
});

assert.equal(waitingEvent.kind, "waiting");
assert.ok(waitingEvent.waitingFor !== null);
assert.ok(waitingEvent.waitingFor!.includes("Pi engine not installed"), "custom waitingReason must be preserved");
assert.ok(waitingEvent.nextOperatorAction !== null);

const renderedWaiting = renderCreatePromptEvent(waitingEvent, "interactive");
assert.ok(renderedWaiting !== null);
assert.ok(renderedWaiting.includes("waiting"), "rendered waiting event must state outcome");
assert.ok(renderedWaiting.includes("writer-team"), "rendered waiting event must name the team");

// ── 5. JSON shape is deterministic ───────────────────────────────────────────

const eventJson = JSON.parse(JSON.stringify(completedEvent)) as CreatePromptEvent;
assert.equal(eventJson.kind, "completed");
assert.equal(eventJson.teamSlug, "research-team");
assert.equal(eventJson.runId, "research-team:comprehension-pass");
assert.equal(eventJson.agentId, "pi-spokesperson");
assert.equal(eventJson.disposition, "Accept");
assert.equal(eventJson.finalizationBlocked, false);
assert.equal(eventJson.waitingFor, null);
assert.equal(eventJson.nextOperatorAction, null);
assert.equal(eventJson.at, "2026-04-28T00:00:00.000Z");

// ── 6. headless (standing_law) suppresses create prompt ──────────────────────

const headlessMode: BuccetPromptMode = "standing_law";

const suppressedCompleted = renderCreatePromptEvent(completedEvent, headlessMode);
assert.equal(suppressedCompleted, null, "headless must suppress completed create prompt");

const suppressedBlocked = renderCreatePromptEvent(blockedEvent, headlessMode);
assert.equal(suppressedBlocked, null, "headless must suppress blocked create prompt");

const suppressedWaiting = renderCreatePromptEvent(waitingEvent, headlessMode);
assert.equal(suppressedWaiting, null, "headless must suppress waiting create prompt");

// ── 7. interactive mode emits for all kinds ──────────────────────────────────

const interactiveMode: BuccetPromptMode = "interactive";

assert.notEqual(renderCreatePromptEvent(completedEvent, interactiveMode), null, "interactive must emit for completed");
assert.notEqual(renderCreatePromptEvent(blockedEvent, interactiveMode), null, "interactive must emit for blocked");
assert.notEqual(renderCreatePromptEvent(waitingEvent, interactiveMode), null, "interactive must emit for waiting");

// ── 8. Args shape mirrors persisted team_status meta ─────────────────────────
// Simulate reading the completed meta back from the JSONL session log and
// reconstructing the event — proves the shape round-trips cleanly.

const persistedMeta = {
  status: "completed" as const,
  spokesperson: "pi-spokesperson",
  comprehensionPass: "research-team:comprehension-pass",
  coherenceDisposition: "Accept",
  finalizationBlocked: false,
};

const eventFromPersistedMeta = buildCreatePromptEvent({
  teamSlug: "research-team",
  runId: persistedMeta.comprehensionPass,
  agentId: persistedMeta.spokesperson,
  disposition: persistedMeta.coherenceDisposition,
  finalizationBlocked: persistedMeta.finalizationBlocked,
  status: persistedMeta.status,
});

assert.equal(eventFromPersistedMeta.kind, "completed");
assert.equal(eventFromPersistedMeta.runId, "research-team:comprehension-pass");
assert.equal(eventFromPersistedMeta.agentId, "pi-spokesperson");
assert.equal(eventFromPersistedMeta.disposition, "Accept");

// ── 9. Fallback: Pi not installed → queued → kind=waiting ────────────────────
// Mirrors the PiNotInstalledError branch in tryBrainPass.

const queuedEvent = buildCreatePromptEvent({
  teamSlug: "research-team",
  runId: "research-team:queued-abc123",
  agentId: "pi-spokesperson",
  disposition: "Defer",
  finalizationBlocked: false,
  status: "queued",
  waitingReason: "Pi engine not installed — run queued to message queue",
  at: "2026-04-28T01:00:00.000Z",
});

assert.equal(queuedEvent.kind, "waiting", "queued status must resolve to kind=waiting");
assert.ok(queuedEvent.waitingFor !== null);
assert.ok(queuedEvent.waitingFor!.includes("Pi engine not installed"));
assert.ok(queuedEvent.nextOperatorAction !== null);

const renderedQueued = renderCreatePromptEvent(queuedEvent, "interactive");
assert.ok(renderedQueued !== null, "queued fallback must emit in interactive mode");
assert.ok(renderedQueued!.includes("waiting"), "rendered queued event must state outcome");
assert.ok(renderedQueued!.includes("research-team"), "rendered queued event must name team");

assert.equal(renderCreatePromptEvent(queuedEvent, "standing_law"), null,
  "headless must suppress queued fallback prompt");

// ── 10. Fallback: BrainPassPreconditionError → blocked ───────────────────────
// Mirrors the BrainPassPreconditionError branch in tryBrainPass.

const precondEvent = buildCreatePromptEvent({
  teamSlug: "research-team",
  runId: "research-team:blocked-def456",
  agentId: "pi-spokesperson",
  disposition: "BlockFinalization",
  finalizationBlocked: true,
  status: "blocked",
  waitingReason: "team has no engine source configured",
  at: "2026-04-28T01:01:00.000Z",
});

assert.equal(precondEvent.kind, "blocked", "blocked status must resolve to kind=blocked");
assert.ok(precondEvent.waitingFor !== null);
assert.ok(precondEvent.waitingFor!.includes("team has no engine source configured"),
  "precondition reason must be preserved in waitingFor");
assert.ok(precondEvent.nextOperatorAction !== null);

const renderedPrecond = renderCreatePromptEvent(precondEvent, "interactive");
assert.ok(renderedPrecond !== null, "precondition blocked fallback must emit in interactive mode");
assert.ok(renderedPrecond!.includes("blocked"), "rendered precond event must state outcome");
assert.ok(renderedPrecond!.includes("waiting for"), "rendered precond event must include waitingFor label");

assert.equal(renderCreatePromptEvent(precondEvent, "standing_law"), null,
  "headless must suppress precondition blocked fallback prompt");

// ── 11. Fallback: general error → status=failed → kind=waiting ───────────────
// Mirrors the catch-all branch in tryBrainPass.

const failedEvent = buildCreatePromptEvent({
  teamSlug: "research-team",
  runId: "research-team:failed-ghi789",
  agentId: "pi-spokesperson",
  disposition: "Defer",
  finalizationBlocked: false,
  status: "failed",
  waitingReason: "network timeout reaching AI provider",
  at: "2026-04-28T01:02:00.000Z",
});

assert.equal(failedEvent.kind, "waiting", "failed status must route through kind=waiting");
assert.ok(failedEvent.waitingFor !== null);
assert.ok(failedEvent.waitingFor!.includes("network timeout"), "error reason must appear in waitingFor");
assert.ok(failedEvent.nextOperatorAction !== null);

const renderedFailed = renderCreatePromptEvent(failedEvent, "interactive");
assert.ok(renderedFailed !== null, "failed fallback must emit in interactive mode");
assert.ok(renderedFailed!.includes("waiting"), "rendered failed event must state waiting outcome");
assert.ok(renderedFailed!.includes("network timeout"), "rendered failed event must include error reason");

assert.equal(renderCreatePromptEvent(failedEvent, "standing_law"), null,
  "headless must suppress failed fallback prompt");

// ── 12. All three fallbacks suppressed by headless ────────────────────────────

assert.equal(renderCreatePromptEvent(queuedEvent, "standing_law"), null,
  "standing_law suppresses queued");
assert.equal(renderCreatePromptEvent(precondEvent, "standing_law"), null,
  "standing_law suppresses blocked precondition");
assert.equal(renderCreatePromptEvent(failedEvent, "standing_law"), null,
  "standing_law suppresses failed");

console.log("Create-Prompt Routing Contract");
console.log("defense prompt path:                      untouched (no BODYGUARD/BOUNDARY prefix)");
console.log("completed run event:                      kind=completed · waitingFor=null");
console.log("blocked run event:                        kind=blocked · waitingFor=disposition");
console.log("waiting run event:                        kind=waiting · custom reason preserved");
console.log("JSON shape:                               deterministic round-trip");
console.log("headless (standing_law) — completed:      null");
console.log("headless (standing_law) — blocked:        null");
console.log("headless (standing_law) — waiting:        null");
console.log("interactive — all kinds:                  emitted");
console.log("persisted meta round-trip:                matches");
console.log("fallback queued (Pi not installed):       kind=waiting · emitted interactive · null headless");
console.log("fallback blocked (precondition):          kind=blocked · emitted interactive · null headless");
console.log("fallback failed (general error):          kind=waiting · emitted interactive · null headless");
console.log("all three fallbacks — standing_law:       null");
