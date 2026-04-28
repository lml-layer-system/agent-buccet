import { promises as fs } from "node:fs";
import path from "node:path";
import type { BoundaryActionKind } from "./types.ts";

export const BUCCET_PATH_NAMES = [
  "messaging",
  "search",
  "coding",
  "research",
  "automation",
  "files",
  "analysis",
  "general",
] as const;

export const UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE: BuccetPathSource = {
  id: "base-agent-comprehension-process",
  title: "Universal Agent Comprehension Process",
  kind: "cognitive-framework",
  content: [
    "# Universal Agent Comprehension Process",
    "",
    "## Principle",
    "An agent is valid when it converts exterior input into an intent-bound task representation, applies the appropriate knowledge process under constraint, validates the result, and returns a usable exterior effect.",
    "",
    "Tightest form: Agenthood is the governed conversion of input into intended usable result. No intent-bound representation, no agent.",
    "",
    "## Architecture",
    "Brain · Library · Mouth.",
    "",
    "- Brain: this hardcoded comprehension pipeline. Procedural, not generative. Cannot be skipped, cannot be reordered, cannot be owned by anything inside it. The brain IS the agent.",
    "- Library: knowledge sources — path sources, files, tools, web, databases, calculators, code execution, expert systems, and LLM-as-knowledge-source. Supplies what is needed.",
    "- Mouth: the LLM, demoted to component. Speaks human, drafts, renders. The LLM never owns the sequence.",
    "",
    "## Formula",
    "A(E, I, C, K, M, S) → O",
    "",
    "Where:",
    "  E = exterior input (request, signal, command, event, file, symptom)",
    "  I = inferred intent / desired result",
    "  C = constraints (UPL, safety, format, authority, context)",
    "  K = knowledge / state available or acquired",
    "  M = selected method",
    "  S = current agent / task state",
    "  A = agent comprehension-transform function",
    "  O = valid output / effect",
    "",
    "Composition:",
    "Return ∘ Render ∘ Validate ∘ Transform ∘ Knowledge ∘ Method ∘ Constraints ∘ Intent ∘ Represent ∘ Receive (E) = O",
    "",
    "## Operational Order",
    "All ten stages must execute in this order. None may be skipped. Output is valid only after a completed pass.",
    "",
    "  1. Receive — capture raw exterior contact without acting on surface form alone.",
    "  2. Represent — convert raw contact into a structured internal form.",
    "  3. Infer Intent — identify the desired result. If surface request and desired result diverge, capture both.",
    "  4. Bind Constraints — attach UPL acceptance and denial, safety, format, context, and authority.",
    "  5. Select Method — choose the operation class. Method must be sufficient, not maximal.",
    "  6. Acquire / Use Knowledge — pull or activate the needed knowledge. Internal, sources, tools, or LLM-as-library.",
    "  7. Transform — perform the governed change.",
    "  8. Validate — check result against intent, constraints, evidence, premise, and safety. Validation includes premise check.",
    "  9. Render — shape the result for the receiver in a form they can use.",
    "  10. Return — deliver the output or effect, and append the ledger entry.",
    "",
    "## Control Rule",
    "The LLM may serve specific stages — represent, infer intent, transform, render — but it does not own the sequence. The engine decides what stage we are in, what the input is, what validates the stage, and what the next stage receives. Random generation cannot pretend to be cognition.",
    "",
    "Stage / valid module:",
    "  Receive               event handler, parser, intake interface",
    "  Represent             schema mapper, parser, or LLM acting under contract",
    "  Infer Intent          classifier, rule engine, or LLM acting under contract",
    "  Bind Constraints      UPL evaluator, policy binder, context binder",
    "  Select Method         router, dispatcher",
    "  Acquire Knowledge     retrieval, tool gateway, path-source reader, LLM-as-library",
    "  Transform             domain module, solver, code execution, or LLM acting under contract",
    "  Validate              tests, proofs, rubrics, checkers — almost never LLM",
    "  Render                formatter, template, or LLM acting as mouth",
    "  Return                output handler, action handler",
    "",
    "## Dispositions",
    "When the standard pass cannot complete, valid output is constrained:",
    "",
    "  - Ambiguity: if intent cannot be bound, the lawful output is a clarification request or a best-effort answer with the assumption declared. Not silent guessing.",
    "  - False premise: validation must include a premise check. If the premise is false, the lawful output names the false premise; it does not answer the question as posed.",
    "  - Tool failure: state the limitation, return a bounded answer, do not fabricate.",
    "  - Unknown knowledge: the lawful response is search, declared uncertainty, or refusal — never confident invention.",
    "  - Adversarial input: human input does not become action unless it is valid under governing constraints. Surface wording does not override binding constraints.",
    "  - Speed: gates may be precompiled. Gates may not be skipped.",
    "  - Overthinking: process must be sufficient, not maximal. A simple input passes through all gates fast; it does not invoke the heaviest method.",
    "",
    "## Bounding",
    "All motion runs inside the UPL track. The engine produces proposals; UPL acceptance and denial bound them; UPL Traffic enforces stability on the track. There is no path around the boundary; there is no exception lane for any agent, swarm, or team.",
    "",
    "## Closing Statement",
    "The brain is the lawful path from input to intended result. The library is what the brain reads. The LLM is the mouth. Output exists only when a completed pass through all ten gates has produced it.",
    "",
    "Engine decides the process. Knowledge supplies the substance. The LLM speaks the result.",
  ].join("\n"),
  summary:
    "Universal procedural law every agent must run. Brain governs, library supplies, mouth speaks; ten stages, no skipping, bounded by the UPL track.",
  sourceUri: "buccet://internal/agent-comprehension-process",
  tags: ["base", "framework", "cognition", "ubie", "engine"],
};

export type BuccetPathName = string;
export type BuccetPathDomain = string;
export type BuccetPathStageStatus =
  | "PENDING"
  | "ACTIVE"
  | "COMPLETED"
  | "BLOCKED"
  | "FAILED";
export type BuccetPathAgentStatus =
  | "IDLE"
  | "ACTIVE"
  | "COMPLETED"
  | "BLOCKED"
  | "FAILED";
export type BuccetPathAgentControlState =
  | "CLEAR"
  | "FROZEN"
  | "INSPECTING"
  | "QUARANTINED"
  | "REPLACED"
  | "ABORTED";
export type BuccetPathFormationStatus =
  | "READY"
  | "RUNNING"
  | "BLOCKED"
  | "FAILED"
  | "COMPLETED";
export type BuccetPathAdvanceResult = "success" | "complete" | "blocked" | "failed";
export type BuccetPathFormationFreezeScope = "whole_swarm";
export type BuccetPathAgentAction = "inspect" | "resume" | "quarantine" | "replace" | "abort";

export type BuccetPathUplBinding = {
  actionKinds: BoundaryActionKind[];
  targets?: string[];
  notes?: string;
};

export type BuccetPathSource = {
  id: string;
  title: string;
  kind: string;
  content: string;
  summary?: string;
  sourceUri?: string;
  tags?: string[];
};

export type BuccetPathAgentMemoryBank = {
  sourceIds: string[];
  sourceTitles: string[];
  notes?: string;
};

export type BuccetPathAgentControl = {
  state: BuccetPathAgentControlState;
  updatedAt: string;
  reason?: string | null;
  issuedBy?: string;
  replacementAgentId?: string;
};

export type BuccetPathFormationControl = {
  massFrozen: boolean;
  freezeScope?: BuccetPathFormationFreezeScope;
  frozenAt?: string;
  frozenBy?: string;
  freezeReason?: string;
  pendingInspectionAgentIds: string[];
  updatedAt: string;
};

export type BuccetPathAgentTemplate = {
  id: string;
  title: string;
  specialty: string;
  modelHint?: string;
  tools?: string[];
  sourceIds?: string[];
  memoryNotes?: string;
  uplBindings: BuccetPathUplBinding[];
};

export type BuccetPathStageTemplate = {
  id: string;
  title: string;
  purpose: string;
  agentIds: string[];
  tools?: string[];
  sourceIds?: string[];
  uplBindings?: BuccetPathUplBinding[];
  terminal?: boolean;
};

export type BuccetPathTemplate = {
  pathName: BuccetPathName;
  domain: BuccetPathDomain;
  title: string;
  summary: string;
  modelHint: string;
  laws: string[];
  tools: string[];
  pathSources: BuccetPathSource[];
  uplBindings: BuccetPathUplBinding[];
  agentRoster: BuccetPathAgentTemplate[];
  stages: BuccetPathStageTemplate[];
};

export type BuccetPathTemplateDraft = {
  domain?: BuccetPathDomain;
  title?: string;
  summary?: string;
  modelHint?: string;
  laws?: string[];
  tools?: string[];
  pathSources?: BuccetPathSource[];
  uplBindings?: BuccetPathUplBinding[];
  agentRoster?: BuccetPathAgentTemplate[];
  stages?: BuccetPathStageTemplate[];
};

export type BuccetPathAgentState = BuccetPathAgentTemplate & {
  position: number;
  stageIds: string[];
  completedStageIds: string[];
  memoryBank: BuccetPathAgentMemoryBank;
  control: BuccetPathAgentControl;
  currentStageId?: string;
  status: BuccetPathAgentStatus;
  activatedAt?: string;
  completedAt?: string;
};

export type BuccetPathStageState = BuccetPathStageTemplate & {
  position: number;
  status: BuccetPathStageStatus;
  activatedAt?: string;
  completedAt?: string;
  inputKeys: string[];
  outputKeys: string[];
  reason?: string | null;
};

export type BuccetPathFormationEvent = {
  kind:
    | "created"
    | "advanced"
    | "switched"
    | "blocked"
    | "failed"
    | "completed"
    | "frozen"
    | "agent_inspected"
    | "agent_resumed"
    | "agent_quarantined"
    | "agent_replaced"
    | "agent_aborted";
  at: string;
  stageId?: string;
  detail?: string | null;
};

export type BuccetPathFormationState = {
  formationId: string;
  sessionId: string;
  pathName: BuccetPathName;
  domain: BuccetPathDomain;
  title: string;
  status: BuccetPathFormationStatus;
  templateVersion: 1;
  currentStageIndex: number;
  userRequest: string;
  modelHint: string;
  laws: string[];
  tools: string[];
  pathSources: BuccetPathSource[];
  uplBindings: BuccetPathUplBinding[];
  agentRoster: BuccetPathAgentState[];
  control: BuccetPathFormationControl;
  context: Record<string, unknown>;
  stages: BuccetPathStageState[];
  events: BuccetPathFormationEvent[];
  createdAt: string;
  updatedAt: string;
  previousPathName?: BuccetPathName;
  previousFormationId?: string;
};

export type BuccetPathMemorySnapshot = {
  specVersion: 1;
  formations: BuccetPathFormationState[];
};

export type BuccetPathLibrarySnapshot = {
  specVersion: 1;
  templates: BuccetPathTemplate[];
};

export type BuccetPathLiveStep = {
  position: number;
  stageId: string;
  title: string;
  status: BuccetPathStageStatus;
  purpose: string;
  agentIds: string[];
  agentTitles: string[];
  sourceIds: string[];
  sourceTitles: string[];
  uplActionKinds: BoundaryActionKind[];
  uplTargets: string[];
};

export type BuccetPathLiveView = {
  formationId: string;
  pathName: string;
  domain: string;
  status: BuccetPathFormationStatus;
  swarmFrozen: boolean;
  freezeReason?: string;
  pendingInspectionAgentIds: string[];
  currentStageId?: string;
  activeAgentIds: string[];
  activeAgentTitles: string[];
  pathAgentCount: number;
  pathSourceCount: number;
  pathSourceTitles: string[];
  pathLawfulActionKinds: BoundaryActionKind[];
  pathLawfulTargets: string[];
  agents: Array<{
    id: string;
    title: string;
    status: BuccetPathAgentStatus;
    controlState: BuccetPathAgentControlState;
    currentStageId?: string;
    sourceTitles: string[];
    stageIds: string[];
    completedStageIds: string[];
    replacementAgentId?: string;
  }>;
  steps: BuccetPathLiveStep[];
  events: string[];
};

function upl(actionKinds: BoundaryActionKind[], targets: string[] = [], notes?: string): BuccetPathUplBinding {
  return { actionKinds, targets, notes };
}

const RUNTIME_RESOLVED_UPL_NOTE = "resolved by live UPL during execution";
const DEFAULT_AUTO_PATH_BINDING = upl([], [], RUNTIME_RESOLVED_UPL_NOTE);

function cloneUplBinding(binding: BuccetPathUplBinding): BuccetPathUplBinding {
  return {
    ...binding,
    actionKinds: [...binding.actionKinds],
    targets: [...(binding.targets ?? [])],
  };
}

function cloneUplBindings(bindings: BuccetPathUplBinding[]): BuccetPathUplBinding[] {
  return bindings.map((binding) => cloneUplBinding(binding));
}

function isRuntimeResolvedUplBinding(binding: BuccetPathUplBinding): boolean {
  return (binding.notes ?? "").includes(RUNTIME_RESOLVED_UPL_NOTE);
}

function replaceRuntimeResolvedBindings(
  bindings: BuccetPathUplBinding[],
  resolvedBindings: BuccetPathUplBinding[],
): BuccetPathUplBinding[] {
  if (!bindings.some((binding) => isRuntimeResolvedUplBinding(binding))) {
    return cloneUplBindings(bindings);
  }
  return cloneUplBindings(resolvedBindings);
}

function toTitleCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeBuccetDomain(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "general";
}

function clonePathSource(source: BuccetPathSource): BuccetPathSource {
  return {
    ...source,
    tags: [...(source.tags ?? [])],
  };
}

function defaultBuccetPathAgentControl(at: string): BuccetPathAgentControl {
  return {
    state: "CLEAR",
    updatedAt: at,
  };
}

function normalizeBuccetPathAgentControl(
  control: Partial<BuccetPathAgentControl> | undefined,
  at: string,
): BuccetPathAgentControl {
  return {
    state: control?.state ?? "CLEAR",
    updatedAt: control?.updatedAt ?? at,
    ...(control?.reason !== undefined ? { reason: control.reason } : {}),
    ...(control?.issuedBy ? { issuedBy: control.issuedBy } : {}),
    ...(control?.replacementAgentId ? { replacementAgentId: control.replacementAgentId } : {}),
  };
}

function requiresManualInspection(control: BuccetPathAgentControl): boolean {
  return control.state === "FROZEN" || control.state === "INSPECTING";
}

function recomputeBuccetFormationControl(
  control: Partial<BuccetPathFormationControl> | undefined,
  agents: BuccetPathAgentState[],
  at: string,
): BuccetPathFormationControl {
  const pendingInspectionAgentIds = agents
    .filter((agent) => requiresManualInspection(agent.control))
    .map((agent) => agent.id);
  return {
    massFrozen: pendingInspectionAgentIds.length > 0,
    freezeScope: pendingInspectionAgentIds.length > 0 ? (control?.freezeScope ?? "whole_swarm") : control?.freezeScope,
    frozenAt: control?.frozenAt,
    frozenBy: control?.frozenBy,
    freezeReason: control?.freezeReason,
    pendingInspectionAgentIds,
    updatedAt: control?.updatedAt ?? at,
  };
}

function clonePathTemplate(template: BuccetPathTemplate): BuccetPathTemplate {
  return {
    ...template,
    laws: [...template.laws],
    tools: [...template.tools],
    pathSources: [
      UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE,
      ...template.pathSources.map((source) => clonePathSource(source)),
    ],
    uplBindings: template.uplBindings.map((binding) => ({
      ...binding,
      actionKinds: [...binding.actionKinds],
      targets: [...(binding.targets ?? [])],
    })),
    agentRoster: template.agentRoster.map((agent) => ({
      ...agent,
      tools: [...(agent.tools ?? [])],
      sourceIds: [...(agent.sourceIds ?? [])],
      uplBindings: agent.uplBindings.map((binding) => ({
        ...binding,
        actionKinds: [...binding.actionKinds],
        targets: [...(binding.targets ?? [])],
      })),
    })),
    stages: template.stages.map((stage) => ({
      ...stage,
      agentIds: [...stage.agentIds],
      tools: [...(stage.tools ?? [])],
      sourceIds: [...(stage.sourceIds ?? [])],
      uplBindings: stage.uplBindings?.map((binding) => ({
        ...binding,
        actionKinds: [...binding.actionKinds],
        targets: [...(binding.targets ?? [])],
      })),
    })),
  };
}

function buildAgentMemoryBank(
  pathSources: BuccetPathSource[],
  sourceIds?: string[],
  notes?: string,
): BuccetPathAgentMemoryBank {
  const selected = sourceIds && sourceIds.length > 0
    ? pathSources.filter((source) => sourceIds.includes(source.id))
    : pathSources;
  return {
    sourceIds: selected.map((source) => source.id),
    sourceTitles: selected.map((source) => source.title),
    ...(notes ? { notes } : {}),
  };
}

function resolveStageSources(
  pathSources: BuccetPathSource[],
  stageSourceIds: string[] | undefined,
  ownedAgents: BuccetPathAgentState[],
): BuccetPathSource[] {
  if (stageSourceIds && stageSourceIds.length > 0) {
    return pathSources.filter((source) => stageSourceIds.includes(source.id));
  }
  const fallbackIds = [...new Set(ownedAgents.flatMap((agent) => agent.memoryBank.sourceIds))];
  return pathSources.filter((source) => fallbackIds.includes(source.id));
}

function createDefaultAutoAgentRoster(
  pathName: BuccetPathName,
  domain: BuccetPathDomain,
  uplBindings: BuccetPathUplBinding[] = [DEFAULT_AUTO_PATH_BINDING],
): BuccetPathAgentTemplate[] {
  const prefix = normalizeBuccetDomain(pathName);
  return [
    {
      id: `${prefix}-intake`,
      title: `${toTitleCase(pathName)} Intake`,
      specialty: `${domain} intake`,
      uplBindings: cloneUplBindings(uplBindings),
    },
    {
      id: `${prefix}-specialist`,
      title: `${toTitleCase(pathName)} Specialist`,
      specialty: `${domain} execution`,
      uplBindings: cloneUplBindings(uplBindings),
    },
    {
      id: `${prefix}-witness`,
      title: `${toTitleCase(pathName)} Witness`,
      specialty: `${domain} result witness`,
      uplBindings: cloneUplBindings(uplBindings),
    },
  ];
}

function createDefaultAutoStages(
  pathName: BuccetPathName,
  agentRoster: BuccetPathAgentTemplate[],
  uplBindings: BuccetPathUplBinding[] = [DEFAULT_AUTO_PATH_BINDING],
): BuccetPathStageTemplate[] {
  const intakeAgentId = agentRoster[0]?.id ?? `${normalizeBuccetDomain(pathName)}-intake`;
  const specialistAgentIds = agentRoster.slice(1, -1).map((agent) => agent.id);
  const witnessAgentId = agentRoster[agentRoster.length - 1]?.id ?? `${normalizeBuccetDomain(pathName)}-witness`;
  return [
    {
      id: "intake",
      title: "Intake",
      purpose: `Intake the ${pathName} request.`,
      agentIds: [intakeAgentId],
      uplBindings: cloneUplBindings(uplBindings),
    },
    {
      id: "execute",
      title: "Execute",
      purpose: `Perform the ${pathName} work inside lawful UPL motion.`,
      agentIds: specialistAgentIds.length > 0 ? specialistAgentIds : [intakeAgentId],
      uplBindings: cloneUplBindings(uplBindings),
    },
    {
      id: "finalize",
      title: "Finalize",
      purpose: `Return the bounded ${pathName} result.`,
      agentIds: [witnessAgentId],
      uplBindings: cloneUplBindings(uplBindings),
      terminal: true,
    },
  ];
}

export function createBuccetPathTemplate(args: {
  pathName: BuccetPathName;
  userRequest?: string;
  draft?: BuccetPathTemplateDraft;
}): BuccetPathTemplate {
  const domain = normalizeBuccetDomain(args.draft?.domain ?? args.pathName);
  const title = args.draft?.title ?? `${toTitleCase(args.pathName)} Path`;
  const summary = args.draft?.summary
    ?? `Finite ${domain} path for ${args.userRequest ?? args.pathName}.`;
  const modelHint = args.draft?.modelHint ?? "gpt-4.1";
  const laws = args.draft?.laws ? [...args.draft.laws] : [normalizeBuccetDomain(args.pathName), domain, "upl"];
  const tools = args.draft?.tools ? [...args.draft.tools] : [];
  const pathSources = args.draft?.pathSources?.map((source) => clonePathSource(source)) ?? [];
  const uplBindings = args.draft?.uplBindings?.map((binding) => cloneUplBinding(binding)) ?? [DEFAULT_AUTO_PATH_BINDING];
  const agentRoster = args.draft?.agentRoster?.map((agent) => ({
    ...agent,
    tools: [...(agent.tools ?? [])],
    sourceIds: [...(agent.sourceIds ?? [])],
    uplBindings: agent.uplBindings.map((binding) => cloneUplBinding(binding)),
  })) ?? createDefaultAutoAgentRoster(args.pathName, domain, uplBindings);
  const stages = args.draft?.stages?.map((stage) => ({
    ...stage,
    agentIds: [...stage.agentIds],
    tools: [...(stage.tools ?? [])],
    sourceIds: [...(stage.sourceIds ?? [])],
    uplBindings: stage.uplBindings?.map((binding) => cloneUplBinding(binding)),
  })) ?? createDefaultAutoStages(args.pathName, agentRoster, uplBindings);
  const template = {
    pathName: args.pathName,
    domain,
    title,
    summary,
    modelHint,
    laws,
    tools,
    pathSources,
    uplBindings,
    agentRoster,
    stages,
  };
  validatePathTemplate(template);
  return template;
}

export function createDefaultBuccetPathLibrary(): Record<BuccetPathName, BuccetPathTemplate> {
  return {
    messaging: {
      pathName: "messaging",
      domain: "communication",
      title: "Messaging Path",
      summary: "Finite message composition and delivery flow.",
      modelHint: "gpt-4o-mini",
      laws: ["messaging", "privacy", "cost"],
      tools: ["telegram_api", "slack_api", "email_api", "whatsapp_api"],
      pathSources: [],
      uplBindings: [
        upl(["chat.emit", "comm.send"], ["telegram", "slack", "whatsapp", "email"]),
      ],
      agentRoster: [
        { id: "intent-analyst", title: "Intent Analyst", specialty: "message intent parsing", uplBindings: [upl(["chat.emit", "comm.send"], ["telegram", "slack", "whatsapp", "email"])] },
        { id: "channel-safety", title: "Channel Safety", specialty: "recipient and policy screening", uplBindings: [upl(["chat.emit", "comm.send"], ["telegram", "slack", "whatsapp", "email"], "policy screening before delivery")] },
        { id: "message-composer", title: "Message Composer", specialty: "outbound drafting", uplBindings: [upl(["chat.emit", "comm.send"], ["telegram", "slack", "whatsapp", "email"])] },
        { id: "delivery-operator", title: "Delivery Operator", specialty: "channel delivery", tools: ["comm.send", "chat.emit"], uplBindings: [upl(["chat.emit", "comm.send"], ["telegram", "slack", "whatsapp", "email"])] },
        { id: "delivery-witness", title: "Delivery Witness", specialty: "delivery confirmation", uplBindings: [upl(["chat.emit", "comm.send"], ["telegram", "slack", "whatsapp", "email"], "delivery witness only")] },
      ],
      stages: [
        { id: "intent", title: "Intent", purpose: "Determine the message intent.", agentIds: ["intent-analyst"] },
        { id: "safety", title: "Safety", purpose: "Check the request and recipient shape.", agentIds: ["channel-safety"] },
        { id: "compose", title: "Compose", purpose: "Draft the outbound message.", agentIds: ["message-composer"] },
        { id: "deliver", title: "Deliver", purpose: "Send through the selected channel.", agentIds: ["delivery-operator", "channel-safety"], tools: ["comm.send", "chat.emit"] },
        { id: "confirm", title: "Confirm", purpose: "Return a delivery result.", agentIds: ["delivery-witness"], terminal: true },
      ],
    },
    search: {
      pathName: "search",
      domain: "search_retrieval",
      title: "Search Path",
      summary: "Finite search, extraction, and summary flow.",
      modelHint: "gpt-4.1",
      laws: ["search", "privacy", "copyright"],
      tools: ["web_search", "web_fetch"],
      pathSources: [],
      uplBindings: [
        upl(["network.send"], ["web_search", "web_fetch"]),
        upl(["fs.write"], ["report-output"], "optional summary output"),
      ],
      agentRoster: [
        { id: "query-framer", title: "Query Framer", specialty: "query shaping", uplBindings: [upl(["network.send"], ["web_search"])] },
        { id: "search-safety", title: "Search Safety", specialty: "query and domain safety", uplBindings: [upl(["network.send"], ["web_search", "web_fetch"], "safety pass on retrieval")] },
        { id: "search-runner", title: "Search Runner", specialty: "web search execution", tools: ["web_search"], uplBindings: [upl(["network.send"], ["web_search"])] },
        { id: "fact-extractor", title: "Fact Extractor", specialty: "web extraction", tools: ["web_fetch"], uplBindings: [upl(["network.send"], ["web_fetch"])] },
        { id: "result-synthesizer", title: "Result Synthesizer", specialty: "bounded summarization", uplBindings: [upl(["network.send"], ["web_fetch"]), upl(["fs.write"], ["report-output"])] },
      ],
      stages: [
        { id: "query", title: "Query", purpose: "Shape the search query.", agentIds: ["query-framer"] },
        { id: "safety", title: "Safety", purpose: "Check query and domain safety.", agentIds: ["search-safety"] },
        { id: "search", title: "Search", purpose: "Run the search.", agentIds: ["search-runner"], tools: ["web_search"] },
        { id: "extract", title: "Extract", purpose: "Pull relevant facts from results.", agentIds: ["fact-extractor"], tools: ["web_fetch"] },
        { id: "summarize", title: "Summarize", purpose: "Produce a bounded summary.", agentIds: ["result-synthesizer", "search-safety"], terminal: true },
      ],
    },
    coding: {
      pathName: "coding",
      domain: "software_engineering",
      title: "Coding Path",
      summary: "Finite requirements, plan, build, test, and fix flow.",
      modelHint: "claude-sonnet",
      laws: ["coding", "security", "cost"],
      tools: ["tool.exec", "fs.read", "fs.write"],
      pathSources: [],
      uplBindings: [
        upl(["tool.exec"], ["test", "lint", "typecheck", "git"]),
        upl(["fs.read", "fs.write"], ["workspace"]),
      ],
      agentRoster: [
        { id: "requirements-analyst", title: "Requirements Analyst", specialty: "build requirements reduction", uplBindings: [upl(["fs.read"], ["workspace"])] },
        { id: "build-planner", title: "Build Planner", specialty: "implementation planning", uplBindings: [upl(["fs.read"], ["workspace"])] },
        { id: "code-safety", title: "Code Safety", specialty: "plan and output safety review", uplBindings: [upl(["fs.read"], ["workspace"]), upl(["tool.exec"], ["test", "lint", "typecheck"])] },
        { id: "implementation-engineer", title: "Implementation Engineer", specialty: "code authoring", tools: ["tool.exec", "fs.write"], uplBindings: [upl(["tool.exec"], ["git", "build"]), upl(["fs.read", "fs.write"], ["workspace"])] },
        { id: "test-operator", title: "Test Operator", specialty: "bounded validation", tools: ["tool.exec", "fs.read"], uplBindings: [upl(["tool.exec"], ["test", "typecheck"]), upl(["fs.read"], ["workspace"])] },
        { id: "repair-engineer", title: "Repair Engineer", specialty: "single-pass code repair", tools: ["tool.exec", "fs.write"], uplBindings: [upl(["tool.exec"], ["test", "lint"]), upl(["fs.read", "fs.write"], ["workspace"])] },
        { id: "result-finisher", title: "Result Finisher", specialty: "final result packaging", uplBindings: [upl(["fs.read"], ["workspace"])] },
      ],
      stages: [
        { id: "requirements", title: "Requirements", purpose: "Reduce the request to concrete build requirements.", agentIds: ["requirements-analyst"] },
        { id: "plan", title: "Plan", purpose: "Create a finite build plan.", agentIds: ["build-planner"] },
        { id: "safety", title: "Safety", purpose: "Check the plan before execution.", agentIds: ["code-safety"] },
        { id: "build", title: "Build", purpose: "Implement the change.", agentIds: ["implementation-engineer"], tools: ["tool.exec", "fs.write"] },
        { id: "test", title: "Test", purpose: "Run bounded validation.", agentIds: ["test-operator"], tools: ["tool.exec", "fs.read"] },
        { id: "fix", title: "Fix", purpose: "Apply a single repair pass if needed.", agentIds: ["repair-engineer"], tools: ["tool.exec", "fs.write"] },
        { id: "finalize", title: "Finalize", purpose: "Return the final result.", agentIds: ["result-finisher", "code-safety"], terminal: true },
      ],
    },
    research: {
      pathName: "research",
      domain: "research_analysis",
      title: "Research Path",
      summary: "Finite topic, source, analysis, and report flow.",
      modelHint: "gpt-4.1",
      laws: ["research", "copyright", "citation"],
      tools: ["web_search", "web_fetch", "fs.write"],
      pathSources: [],
      uplBindings: [
        upl(["network.send"], ["web_search", "web_fetch"]),
        upl(["fs.write"], ["report-output"]),
      ],
      agentRoster: [
        { id: "scope-analyst", title: "Scope Analyst", specialty: "research scoping", uplBindings: [upl(["network.send"], ["web_search"])] },
        { id: "source-finder", title: "Source Finder", specialty: "source discovery", tools: ["web_search"], uplBindings: [upl(["network.send"], ["web_search"])] },
        { id: "research-safety", title: "Research Safety", specialty: "source and output safety", uplBindings: [upl(["network.send"], ["web_search", "web_fetch"]), upl(["fs.write"], ["report-output"])] },
        { id: "reader", title: "Reader", specialty: "source extraction", tools: ["web_fetch"], uplBindings: [upl(["network.send"], ["web_fetch"])] },
        { id: "analyst", title: "Analyst", specialty: "finding analysis", uplBindings: [upl(["network.send"], ["web_fetch"])] },
        { id: "report-writer", title: "Report Writer", specialty: "report generation", tools: ["fs.write"], uplBindings: [upl(["fs.write"], ["report-output"])] },
      ],
      stages: [
        { id: "scope", title: "Scope", purpose: "Define the research scope.", agentIds: ["scope-analyst"] },
        { id: "sources", title: "Sources", purpose: "Find candidate sources.", agentIds: ["source-finder"], tools: ["web_search"] },
        { id: "safety", title: "Safety", purpose: "Check sources and output bounds.", agentIds: ["research-safety"] },
        { id: "read", title: "Read", purpose: "Extract source facts.", agentIds: ["reader"], tools: ["web_fetch"] },
        { id: "analyze", title: "Analyze", purpose: "Analyze the findings.", agentIds: ["analyst"] },
        { id: "report", title: "Report", purpose: "Produce the report.", agentIds: ["report-writer", "research-safety"], terminal: true, tools: ["fs.write"] },
      ],
    },
    automation: {
      pathName: "automation",
      domain: "automation_operations",
      title: "Automation Path",
      summary: "Finite trigger, safety, action, verify, and log flow.",
      modelHint: "gpt-4o-mini",
      laws: ["automation", "safety", "cost"],
      tools: ["tool.exec", "network.send", "comm.send"],
      pathSources: [],
      uplBindings: [
        upl(["tool.exec", "network.send", "comm.send"], ["automation-targets"]),
      ],
      agentRoster: [
        { id: "trigger-designer", title: "Trigger Designer", specialty: "trigger shaping", uplBindings: [upl(["tool.exec"], ["automation-targets"])] },
        { id: "condition-checker", title: "Condition Checker", specialty: "condition evaluation", uplBindings: [upl(["tool.exec"], ["automation-targets"])] },
        { id: "automation-safety", title: "Automation Safety", specialty: "automation safety review", uplBindings: [upl(["tool.exec", "network.send", "comm.send"], ["automation-targets"])] },
        { id: "action-runner", title: "Action Runner", specialty: "bounded automation execution", tools: ["tool.exec", "network.send", "comm.send"], uplBindings: [upl(["tool.exec", "network.send", "comm.send"], ["automation-targets"])] },
        { id: "verification-agent", title: "Verification Agent", specialty: "result verification", uplBindings: [upl(["tool.exec"], ["automation-targets"])] },
        { id: "audit-logger", title: "Audit Logger", specialty: "audit and log output", uplBindings: [upl(["fs.write"], ["automation-log"])] },
      ],
      stages: [
        { id: "trigger", title: "Trigger", purpose: "Identify the trigger and goal.", agentIds: ["trigger-designer"] },
        { id: "conditions", title: "Conditions", purpose: "Check run conditions.", agentIds: ["condition-checker"] },
        { id: "safety", title: "Safety", purpose: "Check automation safety.", agentIds: ["automation-safety"] },
        { id: "act", title: "Act", purpose: "Execute the bounded automation action.", agentIds: ["action-runner"], tools: ["tool.exec", "network.send", "comm.send"] },
        { id: "verify", title: "Verify", purpose: "Verify the outcome.", agentIds: ["verification-agent"] },
        { id: "log", title: "Log", purpose: "Record the outcome.", agentIds: ["audit-logger"], terminal: true },
      ],
    },
    files: {
      pathName: "files",
      domain: "file_workspace",
      title: "Files Path",
      summary: "Finite file navigation, permission check, operation, and verify flow.",
      modelHint: "gpt-4o-mini",
      laws: ["files", "privacy", "security"],
      tools: ["fs.read", "fs.write", "fs.move", "fs.mkdir"],
      pathSources: [],
      uplBindings: [
        upl(["fs.read", "fs.write", "fs.move", "fs.mkdir"], ["workspace"]),
      ],
      agentRoster: [
        { id: "navigator", title: "Navigator", specialty: "file discovery", uplBindings: [upl(["fs.read"], ["workspace"])] },
        { id: "path-safety", title: "Path Safety", specialty: "path and permission review", uplBindings: [upl(["fs.read", "fs.write", "fs.move", "fs.mkdir"], ["workspace"])] },
        { id: "file-operator", title: "File Operator", specialty: "file mutation", tools: ["fs.read", "fs.write", "fs.move", "fs.mkdir"], uplBindings: [upl(["fs.read", "fs.write", "fs.move", "fs.mkdir"], ["workspace"])] },
        { id: "file-verifier", title: "File Verifier", specialty: "result verification", uplBindings: [upl(["fs.read"], ["workspace"])] },
        { id: "temp-cleaner", title: "Temp Cleaner", specialty: "temporary state cleanup", uplBindings: [upl(["fs.write", "fs.move"], ["workspace"])] },
      ],
      stages: [
        { id: "navigate", title: "Navigate", purpose: "Locate the target files.", agentIds: ["navigator"] },
        { id: "safety", title: "Safety", purpose: "Check permissions and destination bounds.", agentIds: ["path-safety"] },
        { id: "operate", title: "Operate", purpose: "Perform the requested file action.", agentIds: ["file-operator"], tools: ["fs.read", "fs.write", "fs.move", "fs.mkdir"] },
        { id: "verify", title: "Verify", purpose: "Verify the file state.", agentIds: ["file-verifier"] },
        { id: "cleanup", title: "Cleanup", purpose: "Clean temporary file state.", agentIds: ["temp-cleaner"], terminal: true },
      ],
    },
    analysis: {
      pathName: "analysis",
      domain: "data_analytics",
      title: "Analysis Path",
      summary: "Finite load, clean, analyze, visualize, and report flow.",
      modelHint: "gpt-4.1",
      laws: ["data", "privacy", "security"],
      tools: ["fs.read", "db.query", "fs.write"],
      pathSources: [],
      uplBindings: [
        upl(["fs.read", "db.query", "fs.write"], ["workspace", "analysis-db", "report-output"]),
      ],
      agentRoster: [
        { id: "data-loader", title: "Data Loader", specialty: "dataset loading", tools: ["fs.read", "db.query"], uplBindings: [upl(["fs.read", "db.query"], ["workspace", "analysis-db"])] },
        { id: "data-cleaner", title: "Data Cleaner", specialty: "data normalization", uplBindings: [upl(["fs.read"], ["workspace"])] },
        { id: "analysis-safety", title: "Analysis Safety", specialty: "PII and scope review", uplBindings: [upl(["fs.read", "db.query", "fs.write"], ["workspace", "analysis-db", "report-output"])] },
        { id: "analysis-engine", title: "Analysis Engine", specialty: "data analysis", uplBindings: [upl(["db.query"], ["analysis-db"])] },
        { id: "visual-designer", title: "Visual Designer", specialty: "charts and artifacts", tools: ["fs.write"], uplBindings: [upl(["fs.write"], ["report-output"])] },
        { id: "report-finisher", title: "Report Finisher", specialty: "report synthesis", uplBindings: [upl(["fs.write"], ["report-output"])] },
      ],
      stages: [
        { id: "load", title: "Load", purpose: "Load the data source.", agentIds: ["data-loader"], tools: ["fs.read", "db.query"] },
        { id: "clean", title: "Clean", purpose: "Normalize the data.", agentIds: ["data-cleaner"] },
        { id: "safety", title: "Safety", purpose: "Check for PII and scope issues.", agentIds: ["analysis-safety"] },
        { id: "analyze", title: "Analyze", purpose: "Run the analysis.", agentIds: ["analysis-engine"] },
        { id: "visualize", title: "Visualize", purpose: "Create charts or artifacts.", agentIds: ["visual-designer"], tools: ["fs.write"] },
        { id: "report", title: "Report", purpose: "Return the findings.", agentIds: ["report-finisher"], terminal: true },
      ],
    },
    general: {
      pathName: "general",
      domain: "general_productivity",
      title: "General Path",
      summary: "Finite clarify, plan, execute, and respond flow.",
      modelHint: "gpt-4o-mini",
      laws: ["general", "safety", "cost"],
      tools: [],
      pathSources: [],
      uplBindings: [
        upl(["chat.emit"], ["chat:primary"], "general bounded response path"),
      ],
      agentRoster: [
        { id: "clarifier", title: "Clarifier", specialty: "request clarification", uplBindings: [upl(["chat.emit"], ["chat:primary"])] },
        { id: "planner", title: "Planner", specialty: "finite planning", uplBindings: [upl(["chat.emit"], ["chat:primary"])] },
        { id: "general-safety", title: "General Safety", specialty: "bounded safety review", uplBindings: [upl(["chat.emit"], ["chat:primary"], "safety review only")] },
        { id: "responder", title: "Responder", specialty: "final response shaping", uplBindings: [upl(["chat.emit"], ["chat:primary"])] },
      ],
      stages: [
        { id: "clarify", title: "Clarify", purpose: "Clarify the request.", agentIds: ["clarifier"] },
        { id: "plan", title: "Plan", purpose: "Build a finite plan.", agentIds: ["planner"] },
        { id: "safety", title: "Safety", purpose: "Check the plan.", agentIds: ["general-safety"] },
        { id: "respond", title: "Respond", purpose: "Return the result.", agentIds: ["responder"], terminal: true },
      ],
    },
  };
}

function deepCloneFormationState(state: BuccetPathFormationState): BuccetPathFormationState {
  const controlAnchor = state.updatedAt ?? state.createdAt ?? new Date().toISOString();
  const agentRoster = state.agentRoster.map((agent) => ({
    ...agent,
    stageIds: [...agent.stageIds],
    completedStageIds: [...agent.completedStageIds],
    sourceIds: [...(agent.sourceIds ?? [])],
    memoryBank: {
      sourceIds: [...agent.memoryBank.sourceIds],
      sourceTitles: [...agent.memoryBank.sourceTitles],
      ...(agent.memoryBank.notes ? { notes: agent.memoryBank.notes } : {}),
    },
    control: normalizeBuccetPathAgentControl(
      (agent as Partial<BuccetPathAgentState>).control,
      agent.completedAt ?? agent.activatedAt ?? controlAnchor,
    ),
    tools: [...(agent.tools ?? [])],
    uplBindings: agent.uplBindings.map((binding) => ({
      ...binding,
      actionKinds: [...binding.actionKinds],
      targets: [...(binding.targets ?? [])],
    })),
  }));
  return {
    ...state,
    pathSources: state.pathSources.map((source) => clonePathSource(source)),
    uplBindings: state.uplBindings.map((binding) => ({
      ...binding,
      actionKinds: [...binding.actionKinds],
      targets: [...(binding.targets ?? [])],
    })),
    agentRoster,
    control: recomputeBuccetFormationControl(
      (state as Partial<BuccetPathFormationState>).control,
      agentRoster,
      controlAnchor,
    ),
    context: { ...state.context },
    laws: [...state.laws],
    tools: [...state.tools],
    stages: state.stages.map((stage) => ({
      ...stage,
      agentIds: [...stage.agentIds],
      tools: [...(stage.tools ?? [])],
      sourceIds: [...(stage.sourceIds ?? [])],
      uplBindings: stage.uplBindings?.map((binding) => ({
        ...binding,
        actionKinds: [...binding.actionKinds],
        targets: [...(binding.targets ?? [])],
      })),
      inputKeys: [...stage.inputKeys],
      outputKeys: [...stage.outputKeys],
    })),
    events: state.events.map((event) => ({ ...event })),
  };
}

function makeFormationId(sessionId: string, pathName: BuccetPathName, createdAt: string): string {
  const safeTs = createdAt.replace(/[^0-9]+/g, "");
  return `formation:${sessionId}:${pathName}:${safeTs}`;
}

function validatePathTemplate(template: BuccetPathTemplate): void {
  const agentIds = new Set(template.agentRoster.map((agent) => agent.id));
  const stageIds = new Set<string>();
  if (template.agentRoster.length === 0) {
    throw new Error(`Buccet path ${template.pathName} must define at least one agent`);
  }
  if (template.uplBindings.length === 0) {
    throw new Error(`Buccet path ${template.pathName} must define at least one UPL binding`);
  }
  for (const agent of template.agentRoster) {
    if (agent.uplBindings.length === 0) {
      throw new Error(`Buccet agent ${agent.id} in ${template.pathName} must define at least one UPL binding`);
    }
  }
  for (const stage of template.stages) {
    if (stageIds.has(stage.id)) {
      throw new Error(`Buccet path ${template.pathName} contains duplicate stage ${stage.id}`);
    }
    stageIds.add(stage.id);
    if (stage.agentIds.length === 0) {
      throw new Error(`Buccet stage ${stage.id} in ${template.pathName} must own at least one agent`);
    }
    for (const agentId of stage.agentIds) {
      if (!agentIds.has(agentId)) {
        throw new Error(`Buccet stage ${stage.id} references unknown agent ${agentId}`);
      }
    }
    for (const sourceId of stage.sourceIds ?? []) {
      if (!template.pathSources.some((source) => source.id === sourceId)) {
        throw new Error(`Buccet stage ${stage.id} references unknown path source ${sourceId}`);
      }
    }
  }
  for (const agent of template.agentRoster) {
    for (const sourceId of agent.sourceIds ?? []) {
      if (!template.pathSources.some((source) => source.id === sourceId)) {
        throw new Error(`Buccet agent ${agent.id} in ${template.pathName} references unknown path source ${sourceId}`);
      }
    }
  }
}

export function createBuccetPathLibrary(args?: {
  includeDefaults?: boolean;
  templates?: BuccetPathTemplate[];
}): Record<BuccetPathName, BuccetPathTemplate> {
  const library: Record<BuccetPathName, BuccetPathTemplate> = args?.includeDefaults === false
    ? {}
    : createDefaultBuccetPathLibrary();
  for (const template of args?.templates ?? []) {
    validatePathTemplate(template);
    library[template.pathName] = template;
  }
  return library;
}

export function hasBuccetPath(
  library: Record<BuccetPathName, BuccetPathTemplate>,
  pathName: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(library, pathName);
}

export function buccetPathTemplateNeedsLawfulSurfaceMaterialization(
  template: BuccetPathTemplate,
): boolean {
  return (
    template.uplBindings.some((binding) => isRuntimeResolvedUplBinding(binding))
    || template.agentRoster.some((agent) => agent.uplBindings.some((binding) => isRuntimeResolvedUplBinding(binding)))
    || template.stages.some((stage) => (stage.uplBindings ?? []).some((binding) => isRuntimeResolvedUplBinding(binding)))
  );
}

export function materializeBuccetPathTemplateLawfulSurface(args: {
  template: BuccetPathTemplate;
  uplBindings: BuccetPathUplBinding[];
}): BuccetPathTemplate {
  const template = clonePathTemplate(args.template);
  template.uplBindings = replaceRuntimeResolvedBindings(template.uplBindings, args.uplBindings);
  template.agentRoster = template.agentRoster.map((agent) => ({
    ...agent,
    uplBindings: replaceRuntimeResolvedBindings(agent.uplBindings, args.uplBindings),
  }));
  template.stages = template.stages.map((stage) => (
    stage.uplBindings
      ? {
        ...stage,
        uplBindings: replaceRuntimeResolvedBindings(stage.uplBindings, args.uplBindings),
      }
      : stage
  ));
  validatePathTemplate(template);
  return template;
}

export function buccetFormationNeedsLawfulSurfaceMaterialization(
  state: BuccetPathFormationState,
): boolean {
  return (
    state.uplBindings.some((binding) => isRuntimeResolvedUplBinding(binding))
    || state.agentRoster.some((agent) => agent.uplBindings.some((binding) => isRuntimeResolvedUplBinding(binding)))
    || state.stages.some((stage) => (stage.uplBindings ?? []).some((binding) => isRuntimeResolvedUplBinding(binding)))
  );
}

export function materializeBuccetFormationLawfulSurface(args: {
  state: BuccetPathFormationState;
  uplBindings: BuccetPathUplBinding[];
}): BuccetPathFormationState {
  const state = deepCloneFormationState(args.state);
  state.uplBindings = replaceRuntimeResolvedBindings(state.uplBindings, args.uplBindings);
  state.agentRoster = state.agentRoster.map((agent) => ({
    ...agent,
    uplBindings: replaceRuntimeResolvedBindings(agent.uplBindings, args.uplBindings),
  }));
  state.stages = state.stages.map((stage) => (
    stage.uplBindings
      ? {
        ...stage,
        uplBindings: replaceRuntimeResolvedBindings(stage.uplBindings, args.uplBindings),
      }
      : stage
  ));
  return state;
}

export function getBuccetPathTemplate(
  library: Record<BuccetPathName, BuccetPathTemplate>,
  pathName: string,
): BuccetPathTemplate | null {
  return hasBuccetPath(library, pathName) ? library[pathName] : null;
}

export function ensureBuccetPathInLibrary(args: {
  library: Record<BuccetPathName, BuccetPathTemplate>;
  pathName: BuccetPathName;
  userRequest?: string;
  draft?: BuccetPathTemplateDraft;
}): BuccetPathTemplate {
  const existing = getBuccetPathTemplate(args.library, args.pathName);
  if (existing) {
    return existing;
  }
  const created = createBuccetPathTemplate({
    pathName: args.pathName,
    userRequest: args.userRequest,
    draft: args.draft,
  });
  args.library[args.pathName] = created;
  return created;
}

export function snapshotBuccetPathLibrary(
  library: Record<BuccetPathName, BuccetPathTemplate>,
): BuccetPathLibrarySnapshot {
  return {
    specVersion: 1,
    templates: Object.values(library)
      .map((template) => clonePathTemplate(template))
      .sort((left, right) => left.pathName.localeCompare(right.pathName)),
  };
}

export function restoreBuccetPathLibrary(
  snapshot: BuccetPathLibrarySnapshot,
): Record<BuccetPathName, BuccetPathTemplate> {
  return createBuccetPathLibrary({
    includeDefaults: false,
    templates: snapshot.templates.map((template) => clonePathTemplate(template)),
  });
}

export async function saveBuccetPathLibrary(filePath: string, library: Record<BuccetPathName, BuccetPathTemplate>): Promise<void> {
  const resolved = path.resolve(filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  const tempPath = `${resolved}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, `${JSON.stringify(snapshotBuccetPathLibrary(library), null, 2)}\n`, "utf8");
  await fs.rename(tempPath, resolved);
}

export async function loadBuccetPathLibrary(filePath: string): Promise<Record<BuccetPathName, BuccetPathTemplate> | null> {
  try {
    const raw = await fs.readFile(path.resolve(filePath), "utf8");
    return restoreBuccetPathLibrary(JSON.parse(raw) as BuccetPathLibrarySnapshot);
  } catch {
    return null;
  }
}

function stageStatesForTemplate(template: BuccetPathTemplate, createdAt: string): BuccetPathStageState[] {
  return template.stages.map((stage, position) => ({
    ...stage,
    agentIds: [...stage.agentIds],
    tools: [...(stage.tools ?? [])],
    sourceIds: [...(stage.sourceIds ?? [])],
    uplBindings: stage.uplBindings?.map((binding) => ({
      ...binding,
      actionKinds: [...binding.actionKinds],
      targets: [...(binding.targets ?? [])],
    })),
    position,
    status: position === 0 ? "ACTIVE" : "PENDING",
    activatedAt: position === 0 ? createdAt : undefined,
    inputKeys: [],
    outputKeys: [],
    reason: null,
  }));
}

function stageIdsForAgent(template: BuccetPathTemplate, agentId: string): string[] {
  return template.stages.filter((stage) => stage.agentIds.includes(agentId)).map((stage) => stage.id);
}

function buildAgentRosterForTemplate(template: BuccetPathTemplate, createdAt: string): BuccetPathAgentState[] {
  const firstStage = template.stages[0];
  return template.agentRoster.map((agent, position) => {
    const stageIds = stageIdsForAgent(template, agent.id);
    const active = firstStage ? firstStage.agentIds.includes(agent.id) : false;
    return {
      ...agent,
      tools: [...(agent.tools ?? [])],
      sourceIds: [...(agent.sourceIds ?? [])],
      memoryBank: buildAgentMemoryBank(template.pathSources, agent.sourceIds, agent.memoryNotes),
      uplBindings: agent.uplBindings.map((binding) => ({
        ...binding,
        actionKinds: [...binding.actionKinds],
        targets: [...(binding.targets ?? [])],
      })),
      position,
      stageIds,
      completedStageIds: [],
      control: defaultBuccetPathAgentControl(createdAt),
      currentStageId: active ? firstStage.id : undefined,
      status: active ? "ACTIVE" : "IDLE",
      activatedAt: active ? createdAt : undefined,
    };
  });
}

function hasFutureStage(agent: BuccetPathAgentState, stages: BuccetPathStageState[], currentStageIndex: number): boolean {
  return stages.some((stage) => stage.position > currentStageIndex && stage.agentIds.includes(agent.id));
}

function activateAgentsForStage(
  agentRoster: BuccetPathAgentState[],
  stages: BuccetPathStageState[],
  stageIndex: number,
  occurredAt: string,
): BuccetPathAgentState[] {
  const stage = stages[stageIndex];
  if (!stage) {
    return agentRoster;
  }
  return agentRoster.map((agent) => {
    if (!stage.agentIds.includes(agent.id)) {
      return agent;
    }
    return {
      ...agent,
      status: "ACTIVE",
      currentStageId: stage.id,
      activatedAt: occurredAt,
    };
  });
}

function completeAgentsForStage(
  agentRoster: BuccetPathAgentState[],
  stages: BuccetPathStageState[],
  stageIndex: number,
  occurredAt: string,
): BuccetPathAgentState[] {
  const stage = stages[stageIndex];
  if (!stage) {
    return agentRoster;
  }
  return agentRoster.map((agent) => {
    if (!stage.agentIds.includes(agent.id)) {
      return agent;
    }
    const completedStageIds = agent.completedStageIds.includes(stage.id)
      ? [...agent.completedStageIds]
      : [...agent.completedStageIds, stage.id];
    return {
      ...agent,
      completedStageIds,
      currentStageId: undefined,
      completedAt: occurredAt,
      status: hasFutureStage(agent, stages, stageIndex) ? "IDLE" : "COMPLETED",
    };
  });
}

function failAgentsForStage(
  agentRoster: BuccetPathAgentState[],
  stages: BuccetPathStageState[],
  stageIndex: number,
  status: "BLOCKED" | "FAILED",
  occurredAt: string,
): BuccetPathAgentState[] {
  const stage = stages[stageIndex];
  if (!stage) {
    return agentRoster;
  }
  return agentRoster.map((agent) => {
    if (!stage.agentIds.includes(agent.id)) {
      return agent;
    }
    return {
      ...agent,
      currentStageId: stage.id,
      completedAt: occurredAt,
      status,
    };
  });
}

export function classifyBuccetPathRequest(userRequest: string): BuccetPathName {
  const lower = userRequest.toLowerCase();
  if (/\b(telegram|slack|discord|email|message|whatsapp|sms|send)\b/.test(lower)) {
    return "messaging";
  }
  if (/\b(search|google|browse|web|lookup|find sources)\b/.test(lower)) {
    return "search";
  }
  if (/\b(code|debug|test|build|refactor|script|repo|pr|bug)\b/.test(lower)) {
    return "coding";
  }
  if (/\b(research|compare|analyze sources|paper|report|citations)\b/.test(lower)) {
    return "research";
  }
  if (/\b(automate|workflow|schedule|trigger|n8n|zapier|ifttt)\b/.test(lower)) {
    return "automation";
  }
  if (/\b(file|folder|directory|rename|move|copy|workspace)\b/.test(lower)) {
    return "files";
  }
  if (/\b(data|spreadsheet|sql|query|chart|dashboard|analysis)\b/.test(lower)) {
    return "analysis";
  }
  return "general";
}

export function canInstantiateBuccetFormation(args: {
  library: Record<BuccetPathName, BuccetPathTemplate>;
  pathName: string;
}): boolean {
  return args.pathName.trim().length > 0;
}

export function instantiateBuccetFormation(args: {
  sessionId: string;
  userRequest: string;
  pathName: BuccetPathName;
  library?: Record<BuccetPathName, BuccetPathTemplate>;
  draft?: BuccetPathTemplateDraft;
  createdAt?: string;
  previousPathName?: BuccetPathName;
  previousFormationId?: string;
  previousContext?: Record<string, unknown>;
}): BuccetPathFormationState {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const library = args.library ?? createDefaultBuccetPathLibrary();
  const template = ensureBuccetPathInLibrary({
    library,
    pathName: args.pathName,
    userRequest: args.userRequest,
    draft: args.draft,
  });
  // Ensure the template has the brain source before building the roster.
  if (!template.pathSources.some((s) => s.id === UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE.id)) {
    template.pathSources.unshift(UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE);
  }
  const agentRoster = buildAgentRosterForTemplate(template, createdAt);

  return {
    formationId: makeFormationId(args.sessionId, args.pathName, createdAt),
    sessionId: args.sessionId,
    pathName: args.pathName,
    domain: template.domain,
    title: template.title,
    status: "RUNNING",
    templateVersion: 1,
    currentStageIndex: 0,
    userRequest: args.userRequest,
    modelHint: template.modelHint,
    laws: [...template.laws],
    tools: [...template.tools],
    pathSources: [
      UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE,
      ...template.pathSources.map((source) => clonePathSource(source)),
    ],
    uplBindings: template.uplBindings.map((binding) => ({
      ...binding,
      actionKinds: [...binding.actionKinds],
      targets: [...(binding.targets ?? [])],
    })),
    agentRoster,
    control: recomputeBuccetFormationControl(undefined, agentRoster, createdAt),
    context: {
      user_request: args.userRequest,
      path_name: args.pathName,
      path_domain: template.domain,
      started_at: createdAt,
      ...(args.previousPathName ? { previous_path_name: args.previousPathName } : {}),
      ...(args.previousFormationId ? { previous_formation_id: args.previousFormationId } : {}),
      ...(args.previousContext ? { previous_context: args.previousContext } : {}),
    },
    stages: stageStatesForTemplate(template, createdAt),
    events: [{
      kind: "created",
      at: createdAt,
      stageId: template.stages[0]?.id,
      detail: `formation created for ${args.pathName}`,
    }],
    createdAt,
    updatedAt: createdAt,
    previousPathName: args.previousPathName,
    previousFormationId: args.previousFormationId,
  };
}

export function getCurrentBuccetStage(state: BuccetPathFormationState): BuccetPathStageState | null {
  return state.stages[state.currentStageIndex] ?? null;
}

export function getCurrentBuccetStageAgents(state: BuccetPathFormationState): BuccetPathAgentState[] {
  const stage = getCurrentBuccetStage(state);
  if (!stage) {
    return [];
  }
  return state.agentRoster
    .filter((agent) => stage.agentIds.includes(agent.id))
    .map((agent) => ({
      ...agent,
      tools: [...(agent.tools ?? [])],
      sourceIds: [...(agent.sourceIds ?? [])],
      stageIds: [...agent.stageIds],
      completedStageIds: [...agent.completedStageIds],
      memoryBank: {
        sourceIds: [...agent.memoryBank.sourceIds],
        sourceTitles: [...agent.memoryBank.sourceTitles],
        ...(agent.memoryBank.notes ? { notes: agent.memoryBank.notes } : {}),
      },
      control: { ...agent.control },
      uplBindings: agent.uplBindings.map((binding) => ({
        ...binding,
        actionKinds: [...binding.actionKinds],
        targets: [...(binding.targets ?? [])],
      })),
    }));
}

function mergeUplBindings(bindings: BuccetPathUplBinding[] | undefined): {
  actionKinds: BoundaryActionKind[];
  targets: string[];
} {
  const actionKinds = [...new Set((bindings ?? []).flatMap((binding) => binding.actionKinds))];
  const targets = [...new Set((bindings ?? []).flatMap((binding) => binding.targets ?? []))];
  return { actionKinds, targets };
}

function renderResolvedSurface(values: string[], bindings: BuccetPathUplBinding[] | undefined): string {
  if (values.length > 0) {
    return values.join(", ");
  }
  if ((bindings ?? []).some((binding) => isRuntimeResolvedUplBinding(binding))) {
    return "runtime_resolved";
  }
  return "none";
}

function renderPathSourcesSummary(sources: BuccetPathSource[]): string {
  if (sources.length === 0) {
    return "none";
  }
  return sources.map((source) => source.title).join(", ");
}

export function describeBuccetFormationLiveView(state: BuccetPathFormationState): BuccetPathLiveView {
  const currentStage = getCurrentBuccetStage(state);
  const activeAgents = getCurrentBuccetStageAgents(state);
  const pathBinding = mergeUplBindings(state.uplBindings);
  const steps = state.stages.map((stage) => {
    const ownedAgents = state.agentRoster.filter((agent) => stage.agentIds.includes(agent.id));
    const stageSources = resolveStageSources(state.pathSources, stage.sourceIds, ownedAgents);
    const stageBindings = mergeUplBindings([
      ...(stage.uplBindings ?? []),
      ...ownedAgents.flatMap((agent) => agent.uplBindings),
    ]);
    return {
      position: stage.position,
      stageId: stage.id,
      title: stage.title,
      status: stage.status,
      purpose: stage.purpose,
      agentIds: [...stage.agentIds],
      agentTitles: ownedAgents.map((agent) => agent.title),
      sourceIds: stageSources.map((source) => source.id),
      sourceTitles: stageSources.map((source) => source.title),
      uplActionKinds: stageBindings.actionKinds,
      uplTargets: stageBindings.targets,
    };
  });

  return {
    formationId: state.formationId,
    pathName: state.pathName,
    domain: state.domain,
    status: state.status,
    swarmFrozen: state.control.massFrozen,
    freezeReason: state.control.freezeReason,
    pendingInspectionAgentIds: [...state.control.pendingInspectionAgentIds],
    currentStageId: currentStage?.id,
    activeAgentIds: activeAgents.map((agent) => agent.id),
    activeAgentTitles: activeAgents.map((agent) => agent.title),
    pathAgentCount: state.agentRoster.length,
    pathSourceCount: state.pathSources.length,
    pathSourceTitles: state.pathSources.map((source) => source.title),
    pathLawfulActionKinds: pathBinding.actionKinds,
    pathLawfulTargets: pathBinding.targets,
    agents: state.agentRoster.map((agent) => ({
      id: agent.id,
      title: agent.title,
      status: agent.status,
      controlState: agent.control.state,
      currentStageId: agent.currentStageId,
      sourceTitles: [...agent.memoryBank.sourceTitles],
      stageIds: [...agent.stageIds],
      completedStageIds: [...agent.completedStageIds],
      replacementAgentId: agent.control.replacementAgentId,
    })),
    steps,
    events: state.events.map((event) => {
      const stageSuffix = event.stageId ? ` stage=${event.stageId}` : "";
      const detailSuffix = event.detail ? ` detail=${event.detail}` : "";
      return `${event.at} ${event.kind}${stageSuffix}${detailSuffix}`;
    }),
  };
}

export function renderBuccetFormationLiveView(state: BuccetPathFormationState): string {
  const view = describeBuccetFormationLiveView(state);
  const currentTemplateBindings = state.uplBindings;
  const lines = [
    `formation=${view.formationId}`,
    `path=${view.pathName}`,
    `domain=${view.domain}`,
    `status=${view.status}`,
    `swarm_frozen=${view.swarmFrozen ? "yes" : "no"}`,
    `pending_inspection_agents=${view.pendingInspectionAgentIds.join(", ") || "none"}`,
    `current_stage=${view.currentStageId ?? "none"}`,
    `active_agents=${view.activeAgentTitles.join(", ") || "none"}`,
    `path_agent_count=${view.pathAgentCount}`,
    `path_source_count=${view.pathSourceCount}`,
    `path_sources=${renderPathSourcesSummary(state.pathSources)}`,
    `path_lawful_action_kinds=${renderResolvedSurface(view.pathLawfulActionKinds, currentTemplateBindings)}`,
    `path_lawful_targets=${renderResolvedSurface(view.pathLawfulTargets, currentTemplateBindings)}`,
    ...(view.freezeReason ? [`freeze_reason=${view.freezeReason}`] : []),
    "agents:",
  ];
  for (const agent of view.agents) {
    lines.push(
      `  - ${agent.id} [${agent.status}/${agent.controlState}] stage=${agent.currentStageId ?? "none"} sources=${agent.sourceTitles.join(" + ") || "none"}${agent.replacementAgentId ? ` replacement=${agent.replacementAgentId}` : ""}`,
    );
  }
  lines.push(
    "steps:",
  );
  for (const step of view.steps) {
    const stageBindings = state.stages[step.position]
      ? [
        ...(state.stages[step.position]?.uplBindings ?? []),
        ...state.agentRoster
          .filter((agent) => state.stages[step.position]?.agentIds.includes(agent.id))
          .flatMap((agent) => agent.uplBindings),
      ]
      : [];
    lines.push(
      `  ${step.position + 1}. ${step.stageId} [${step.status}] owners=${step.agentTitles.join(" + ") || "none"} sources=${step.sourceTitles.join(" + ") || "none"} lawful=${renderResolvedSurface(step.uplActionKinds, stageBindings)} targets=${renderResolvedSurface(step.uplTargets, stageBindings)}`,
    );
  }
  lines.push("events:");
  for (const event of view.events) {
    lines.push(`  - ${event}`);
  }
  return `${lines.join("\n")}\n`;
}

export function getBuccetFormationTerminalResult(state: BuccetPathFormationState): unknown {
  return state.context.final_output ?? state.context.final_result ?? state.context;
}

function isTerminalFormationStatus(status: BuccetPathFormationStatus): boolean {
  return status === "COMPLETED" || status === "BLOCKED" || status === "FAILED";
}

export function getBuccetFormationAdvanceBlockReason(state: BuccetPathFormationState): string | null {
  const currentStage = getCurrentBuccetStage(state);
  if (state.control.massFrozen) {
    return `formation ${state.formationId} is mass-frozen — inspect each frozen agent before continuation`;
  }
  if (!currentStage) {
    return null;
  }
  const blockedAgents = state.agentRoster.filter(
    (agent) => currentStage.agentIds.includes(agent.id) && agent.control.state !== "CLEAR",
  );
  if (blockedAgents.length === 0) {
    return null;
  }
  return `stage ${currentStage.id} cannot continue until agent control clears: ${blockedAgents.map((agent) => `${agent.id}:${agent.control.state.toLowerCase()}`).join(", ")}`;
}

export function advanceBuccetFormation(args: {
  state: BuccetPathFormationState;
  result: BuccetPathAdvanceResult;
  output?: Record<string, unknown>;
  reason?: string;
  occurredAt?: string;
}): BuccetPathFormationState {
  const occurredAt = args.occurredAt ?? new Date().toISOString();
  const state = deepCloneFormationState(args.state);
  const blockReason = getBuccetFormationAdvanceBlockReason(state);
  if (blockReason) {
    throw new Error(blockReason);
  }

  if (isTerminalFormationStatus(state.status)) {
    throw new Error(`cannot advance terminal formation in status ${state.status}`);
  }

  const currentStage = state.stages[state.currentStageIndex];
  if (!currentStage) {
    throw new Error("formation has no active stage");
  }
  if (currentStage.status !== "ACTIVE") {
    throw new Error(`stage ${currentStage.id} is not active`);
  }

  currentStage.inputKeys = Object.keys(state.context);
  currentStage.outputKeys = Object.keys(args.output ?? {});
  currentStage.reason = args.reason ?? null;
  state.updatedAt = occurredAt;

  if (args.output) {
    state.context = {
      ...state.context,
      ...args.output,
      last_stage_id: currentStage.id,
      last_stage_position: currentStage.position,
    };
  }

  if (args.result === "blocked") {
    currentStage.status = "BLOCKED";
    currentStage.completedAt = occurredAt;
    state.agentRoster = failAgentsForStage(state.agentRoster, state.stages, state.currentStageIndex, "BLOCKED", occurredAt);
    state.status = "BLOCKED";
    state.events.push({
      kind: "blocked",
      at: occurredAt,
      stageId: currentStage.id,
      detail: args.reason ?? `formation blocked at ${currentStage.id}`,
    });
    return state;
  }

  if (args.result === "failed") {
    currentStage.status = "FAILED";
    currentStage.completedAt = occurredAt;
    state.agentRoster = failAgentsForStage(state.agentRoster, state.stages, state.currentStageIndex, "FAILED", occurredAt);
    state.status = "FAILED";
    state.events.push({
      kind: "failed",
      at: occurredAt,
      stageId: currentStage.id,
      detail: args.reason ?? `formation failed at ${currentStage.id}`,
    });
    return state;
  }

  currentStage.status = "COMPLETED";
  currentStage.completedAt = occurredAt;
  state.agentRoster = completeAgentsForStage(state.agentRoster, state.stages, state.currentStageIndex, occurredAt);

  const shouldComplete = args.result === "complete" || currentStage.terminal === true || state.currentStageIndex === state.stages.length - 1;
  if (shouldComplete) {
    state.status = "COMPLETED";
    state.currentStageIndex = state.stages.length;
    state.events.push({
      kind: "completed",
      at: occurredAt,
      stageId: currentStage.id,
      detail: args.reason ?? `formation completed at ${currentStage.id}`,
    });
    return state;
  }

  const nextStage = state.stages[state.currentStageIndex + 1];
  if (!nextStage) {
    throw new Error("next Buccet stage is missing");
  }
  if (nextStage.status !== "PENDING") {
    throw new Error(`next stage ${nextStage.id} is not pending`);
  }
  nextStage.status = "ACTIVE";
  nextStage.activatedAt = occurredAt;
  state.currentStageIndex += 1;
  state.agentRoster = activateAgentsForStage(state.agentRoster, state.stages, state.currentStageIndex, occurredAt);
  state.status = "RUNNING";
  state.events.push({
    kind: "advanced",
    at: occurredAt,
    stageId: nextStage.id,
    detail: `${currentStage.id} -> ${nextStage.id}`,
  });
  return state;
}

export function freezeBuccetFormation(args: {
  state: BuccetPathFormationState;
  issuedBy: string;
  reason?: string;
  occurredAt?: string;
}): BuccetPathFormationState {
  const occurredAt = args.occurredAt ?? new Date().toISOString();
  const state = deepCloneFormationState(args.state);
  state.agentRoster = state.agentRoster.map((agent) => ({
    ...agent,
    control: agent.control.state === "QUARANTINED" || agent.control.state === "REPLACED" || agent.control.state === "ABORTED"
      ? agent.control
      : {
          state: "FROZEN",
          updatedAt: occurredAt,
          issuedBy: args.issuedBy,
          ...(args.reason !== undefined ? { reason: args.reason } : {}),
          ...(agent.control.replacementAgentId ? { replacementAgentId: agent.control.replacementAgentId } : {}),
        },
  }));
  state.control = recomputeBuccetFormationControl({
    massFrozen: true,
    freezeScope: "whole_swarm",
    frozenAt: occurredAt,
    frozenBy: args.issuedBy,
    freezeReason: args.reason ?? "operator mass freeze",
    updatedAt: occurredAt,
  }, state.agentRoster, occurredAt);
  state.updatedAt = occurredAt;
  state.events.push({
    kind: "frozen",
    at: occurredAt,
    stageId: state.stages[state.currentStageIndex]?.id,
    detail: `${args.issuedBy} mass-froze the work swarm${args.reason ? `: ${args.reason}` : ""}`,
  });
  return state;
}

function resolveAgentControlActionState(action: BuccetPathAgentAction): BuccetPathAgentControlState {
  switch (action) {
    case "inspect":
      return "INSPECTING";
    case "resume":
      return "CLEAR";
    case "quarantine":
      return "QUARANTINED";
    case "replace":
      return "REPLACED";
    case "abort":
      return "ABORTED";
  }
}

function resolveAgentControlEvent(action: BuccetPathAgentAction): BuccetPathFormationEvent["kind"] {
  switch (action) {
    case "inspect":
      return "agent_inspected";
    case "resume":
      return "agent_resumed";
    case "quarantine":
      return "agent_quarantined";
    case "replace":
      return "agent_replaced";
    case "abort":
      return "agent_aborted";
  }
}

export function applyBuccetFormationAgentAction(args: {
  state: BuccetPathFormationState;
  agentId: string;
  action: BuccetPathAgentAction;
  issuedBy: string;
  reason?: string;
  replacementAgentId?: string;
  occurredAt?: string;
}): BuccetPathFormationState {
  const occurredAt = args.occurredAt ?? new Date().toISOString();
  const state = deepCloneFormationState(args.state);
  const agent = state.agentRoster.find((entry) => entry.id === args.agentId);
  if (!agent) {
    throw new Error(`unknown Buccet path agent: ${args.agentId}`);
  }
  if (args.action === "replace" && args.replacementAgentId) {
    if (args.replacementAgentId === args.agentId) {
      throw new Error(`replacement agent must differ from the frozen agent: ${args.agentId}`);
    }
    if (!state.agentRoster.some((entry) => entry.id === args.replacementAgentId)) {
      throw new Error(`unknown replacement agent: ${args.replacementAgentId}`);
    }
  }
  agent.control = {
    state: resolveAgentControlActionState(args.action),
    updatedAt: occurredAt,
    issuedBy: args.issuedBy,
    ...(args.reason !== undefined ? { reason: args.reason } : {}),
    ...(args.action === "replace" && args.replacementAgentId ? { replacementAgentId: args.replacementAgentId } : {}),
  };
  state.control = recomputeBuccetFormationControl({
    ...state.control,
    updatedAt: occurredAt,
  }, state.agentRoster, occurredAt);
  state.updatedAt = occurredAt;
  const detailParts = [
    `${args.issuedBy} ${args.action} ${agent.id}`,
    args.reason ? `reason=${args.reason}` : null,
    args.action === "replace" && args.replacementAgentId ? `replacement=${args.replacementAgentId}` : null,
  ].filter(Boolean);
  state.events.push({
    kind: resolveAgentControlEvent(args.action),
    at: occurredAt,
    stageId: agent.currentStageId,
    detail: detailParts.join(" "),
  });
  return state;
}

export function detectBuccetPathSwitch(args: {
  state: BuccetPathFormationState;
  newRequest: string;
  nextPathName: BuccetPathName;
  library?: Record<BuccetPathName, BuccetPathTemplate>;
  draft?: BuccetPathTemplateDraft;
}): { shouldSwitch: boolean; nextPathName: BuccetPathName } {
  const library = args.library ?? createDefaultBuccetPathLibrary();
  ensureBuccetPathInLibrary({
    library,
    pathName: args.nextPathName,
    userRequest: args.newRequest,
    draft: args.draft,
  });
  return {
    shouldSwitch: args.nextPathName !== args.state.pathName,
    nextPathName: args.nextPathName,
  };
}

export function switchBuccetFormation(args: {
  state: BuccetPathFormationState;
  newRequest: string;
  nextPathName: BuccetPathName;
  library?: Record<BuccetPathName, BuccetPathTemplate>;
  draft?: BuccetPathTemplateDraft;
  occurredAt?: string;
}): BuccetPathFormationState {
  const occurredAt = args.occurredAt ?? new Date().toISOString();
  const library = args.library ?? createDefaultBuccetPathLibrary();
  const decision = detectBuccetPathSwitch({
    state: args.state,
    newRequest: args.newRequest,
    nextPathName: args.nextPathName,
    library,
    draft: args.draft,
  });
  if (!decision.shouldSwitch) {
    return instantiateBuccetFormation({
      sessionId: args.state.sessionId,
      userRequest: args.newRequest,
      pathName: args.state.pathName,
      library,
      draft: args.draft,
      createdAt: occurredAt,
      previousPathName: args.state.pathName,
      previousFormationId: args.state.formationId,
      previousContext: { ...args.state.context },
    });
  }

  const next = instantiateBuccetFormation({
    sessionId: args.state.sessionId,
    userRequest: args.newRequest,
    pathName: decision.nextPathName,
    library,
    draft: args.draft,
    createdAt: occurredAt,
    previousPathName: args.state.pathName,
    previousFormationId: args.state.formationId,
    previousContext: {
      final_output: getBuccetFormationTerminalResult(args.state),
      ...args.state.context,
    },
  });
  next.events.push({
    kind: "switched",
    at: occurredAt,
    detail: `${args.state.pathName} -> ${decision.nextPathName}`,
  });
  return next;
}

export class BuccetPathMemoryStore {
  private formations = new Map<string, BuccetPathFormationState>();

  remember(state: BuccetPathFormationState): BuccetPathFormationState {
    const cloned = deepCloneFormationState(state);
    this.formations.set(cloned.formationId, cloned);
    return cloned;
  }

  get(formationId: string): BuccetPathFormationState | null {
    const state = this.formations.get(formationId);
    return state ? deepCloneFormationState(state) : null;
  }

  list(): BuccetPathFormationState[] {
    return [...this.formations.values()]
      .map((state) => deepCloneFormationState(state))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  listBySession(sessionId: string): BuccetPathFormationState[] {
    return this.list().filter((state) => state.sessionId === sessionId);
  }

  findBySessionAndPath(sessionId: string, pathName: BuccetPathName): BuccetPathFormationState | null {
    const match = [...this.formations.values()]
      .filter((state) => state.sessionId === sessionId && state.pathName === pathName)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    return match ? deepCloneFormationState(match) : null;
  }

  remove(formationId: string): boolean {
    return this.formations.delete(formationId);
  }

  snapshot(): BuccetPathMemorySnapshot {
    return {
      specVersion: 1,
      formations: this.list(),
    };
  }

  replace(snapshot: BuccetPathMemorySnapshot): void {
    this.formations.clear();
    for (const state of snapshot.formations) {
      this.remember(state);
    }
  }
}

export async function saveBuccetPathMemorySnapshot(filePath: string, snapshot: BuccetPathMemorySnapshot): Promise<void> {
  const resolved = path.resolve(filePath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  const tempPath = `${resolved}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, resolved);
}

export async function loadBuccetPathMemorySnapshot(filePath: string): Promise<BuccetPathMemorySnapshot | null> {
  try {
    const raw = await fs.readFile(path.resolve(filePath), "utf8");
    return JSON.parse(raw) as BuccetPathMemorySnapshot;
  } catch {
    return null;
  }
}
