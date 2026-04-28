import type { BoundaryActionKind } from "./types.ts";

/**
 * Agent comprehension acceptance lanes — the engine as law on the YES side.
 *
 * These lanes declare the lawful shape of an agent's pass through the
 * Universal Agent Comprehension Process: Receive → Represent → Infer Intent
 * → Bind Constraints → Select Method → Acquire/Use Knowledge → Transform →
 * Validate → Render → Return.
 *
 * They do not introduce a new engine; they make the existing engine explicit
 * inside UPL so that operators can inspect, mute, ratify, and extend the law
 * through the same acceptance flow as every other lane. The track extractor
 * compiles these lanes into the runtime corridor; UPL Traffic enforces that
 * agent motion stays on the corridor.
 *
 * Enforcement of the corresponding runtime invariants — intent binding,
 * stage order, validation provenance, premise check, no-fabrication —
 * already lives in the swarm classifier (`classifySwarmPath`), the bodyguard
 * verdict path, and Traffic. These lanes name the law that those enforcers
 * already serve. No new substrate.
 */

type TargetMatchMode = "prefix" | "exact" | "regex";

export type AgentComprehensionAcceptanceLane = {
  id: string;
  invariant: string;
  summary: string;
  stage:
    | "receive"
    | "represent"
    | "infer_intent"
    | "bind_constraints"
    | "select_method"
    | "acquire_knowledge"
    | "transform"
    | "validate"
    | "render"
    | "return"
    | "pipeline";
  actionKinds: BoundaryActionKind[];
  targetPattern: string;
  targetMatchMode: TargetMatchMode;
  requestTextPatterns: string[];
  brainSourceUri: string;
};

const BRAIN_SOURCE_URI = "buccet://internal/agent-comprehension-process";

/**
 * The comprehension contract surfaces most cleanly at the rendering boundary —
 * when an agent emits a result for human or peer consumption, the law of how
 * that result was produced is what the operator can audit. We bind these
 * lanes to `chat.emit` so they surface in UPL as named entries without
 * competing with the action-shaped lanes (fs.*, network.*, agent.spend,
 * tool.exec, etc.) that constrain particular operations on particular targets.
 *
 * Runtime enforcement of intent / validation / stage-order / no-fabrication
 * already lives in `classifySwarmPath` and the bodyguard verdict path; these
 * lanes name the law, they do not duplicate the enforcer.
 */
const COMPREHENSION_LANE_ACTION_KINDS: BoundaryActionKind[] = ["chat.emit"];

function lane(args: {
  id: string;
  invariant: string;
  summary: string;
  stage: AgentComprehensionAcceptanceLane["stage"];
  actionKinds?: BoundaryActionKind[];
  requestTextPatterns: string[];
}): AgentComprehensionAcceptanceLane {
  return {
    id: args.id,
    invariant: args.invariant,
    summary: args.summary,
    stage: args.stage,
    actionKinds: args.actionKinds ?? COMPREHENSION_LANE_ACTION_KINDS,
    targetPattern: args.invariant,
    targetMatchMode: "exact",
    requestTextPatterns: args.requestTextPatterns,
    brainSourceUri: BRAIN_SOURCE_URI,
  };
}

export const BASE_AGENT_COMPREHENSION_ACCEPTANCE_LANES: readonly AgentComprehensionAcceptanceLane[] = [
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0001",
    invariant: "agent-comprehension-pass-required",
    summary:
      "lawful agent action proposals arrive at the boundary having completed a Universal Agent Comprehension Process pass (Receive → Represent → Infer Intent → Bind Constraints → Select Method → Acquire/Use Knowledge → Transform → Validate → Render → Return)",
    stage: "pipeline",
    requestTextPatterns: [
      "agent-comprehension-pass",
      "comprehension pass",
      "comprehension pipeline",
      "engine pass",
      "ten-stage pass",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0002",
    invariant: "agent-stage-order",
    summary:
      "the ten comprehension stages must run in the canonical order; no stage may be skipped, reordered, or owned by anything inside the engine",
    stage: "pipeline",
    requestTextPatterns: [
      "agent-stage-order",
      "stage order",
      "canonical stage order",
      "no stage skipped",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0003",
    invariant: "agent-intent-bound",
    summary:
      "high-risk agent actions are lawful only when intent is bound: a declared goal, must-have constraints, and a success condition carried in the swarm intent payload",
    stage: "infer_intent",
    requestTextPatterns: [
      "agent-intent-bound",
      "intent bound",
      "declared intent",
      "swarm intent goal",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0004",
    invariant: "agent-constraints-bound",
    summary:
      "the constraints stage must bind UPL acceptance, denial, safety, format, and authority before method selection occurs",
    stage: "bind_constraints",
    requestTextPatterns: [
      "agent-constraints-bound",
      "constraints bound",
      "upl bound",
      "constraint binding",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0005",
    invariant: "agent-method-sufficient-not-maximal",
    summary:
      "method selection must be sufficient for the task and the constraints, not maximal; an arithmetic question selects arithmetic, not a heavy pipeline",
    stage: "select_method",
    requestTextPatterns: [
      "agent-method-sufficient-not-maximal",
      "sufficient method",
      "method selection",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0006",
    invariant: "agent-knowledge-acquired-or-bounded",
    summary:
      "the knowledge stage acquires from path sources, tools, web, files, or LLM-as-library; when knowledge is unavailable, lawful output is a bounded answer, declared uncertainty, or refusal — never confident invention",
    stage: "acquire_knowledge",
    requestTextPatterns: [
      "agent-knowledge-acquired-or-bounded",
      "knowledge acquired",
      "knowledge bounded",
      "no fabrication",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0007",
    invariant: "agent-validation-provenance",
    summary:
      "high-risk agent actions are lawful only when validation provenance is carried — composition completed history, freshness, premise check, and required validation against intent and constraints",
    stage: "validate",
    requestTextPatterns: [
      "agent-validation-provenance",
      "validation provenance",
      "completed validation",
      "premise checked",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0008",
    invariant: "agent-render-usable-by-receiver",
    summary:
      "the render stage shapes the validated result into a form usable by the intended receiver — human or next peer; correct internal answer rendered as unreadable jargon does not satisfy the contract",
    stage: "render",
    requestTextPatterns: [
      "agent-render-usable-by-receiver",
      "render usable",
      "human-usable rendering",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0009",
    invariant: "agent-mouth-contract",
    summary:
      "an LLM module may serve specific stages — represent, infer intent, transform, render — but never owns the sequence; the engine decides stage, input, validation, and continuation",
    stage: "pipeline",
    requestTextPatterns: [
      "agent-mouth-contract",
      "llm contract",
      "mouth contract",
      "engine owns sequence",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0010",
    invariant: "agent-bounded-by-upl-track",
    summary:
      "all agent motion stays inside the UPL track; standing law follows across every team, every peer, every swarm; there is no exception lane and no infinite recursion",
    stage: "pipeline",
    requestTextPatterns: [
      "agent-bounded-by-upl-track",
      "bounded by track",
      "no infinite recursion",
      "standing law follows",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0011",
    invariant: "agent-ambiguity-disposition",
    summary:
      "when intent cannot be bound, the lawful output is a clarification request or a best-effort answer with the assumption declared; silent guessing is not a lawful continuation",
    stage: "infer_intent",
    requestTextPatterns: [
      "agent-ambiguity-disposition",
      "ambiguity disposition",
      "clarification request",
      "declared assumption",
    ],
  }),
  lane({
    id: "ACCEPT.AGENT.COMPREHENSION.0012",
    invariant: "agent-tool-failure-disposition",
    summary:
      "when a tool or knowledge operation fails, the lawful output names the limitation and returns a bounded answer; fabrication is not a lawful continuation",
    stage: "acquire_knowledge",
    requestTextPatterns: [
      "agent-tool-failure-disposition",
      "tool failure",
      "bounded answer",
      "stated limitation",
    ],
  }),
];
