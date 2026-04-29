import type { BoundaryActionKind } from "./types.ts";

export const AGENT_COMPREHENSION_STAGE_SEQUENCE = [
  "receive",
  "represent",
  "infer_intent",
  "bind_constraints",
  "select_method",
  "acquire_knowledge",
  "transform",
  "validate",
  "render",
  "return",
] as const;

export type AgentComprehensionStageId = (typeof AGENT_COMPREHENSION_STAGE_SEQUENCE)[number];

export const AGENT_TEAM_STAGE_IDS = [...AGENT_COMPREHENSION_STAGE_SEQUENCE, "all"] as const;

export type AgentTeamStageId = (typeof AGENT_TEAM_STAGE_IDS)[number];

export type AgentComprehensionStageStatus = "ready" | "completed" | "blocked";

export type AgentComprehensionMethod =
  | "whole-view-fracture-specialist-team"
  | "single-peer-bounded-pass"
  | "clarify-before-transform";

export type AgentComprehensionLawLayer = "truth" | "intent" | "execution";

export type AgentComprehensionStageRecord = {
  id: AgentComprehensionStageId;
  title: string;
  status: AgentComprehensionStageStatus;
  owners: string[];
  summary: string;
  inputs: string[];
  outputs: string[];
  constraints: string[];
};

export type AgentComprehensionPass = {
  passId: string;
  teamId: string;
  requestedBy: string;
  userRequest: string;
  declaredIntent: string;
  successCondition: string;
  method: AgentComprehensionMethod;
  wholeViewPrepared: boolean;
  lawLayers: AgentComprehensionLawLayer[];
  stages: AgentComprehensionStageRecord[];
};

export type AgentComprehensionPeerOwner = {
  id: string;
  specialty: string;
  ownsStep: AgentTeamStageId;
};

export type AgentComprehensionInitialPassArgs = {
  teamId: string;
  passId?: string;
  requestedBy?: string;
  userRequest: string;
  wholeViewPrepared: boolean;
  sourceCount: number;
  checkpointedSourceCount: number;
  totalLineCount: number;
  packetCount: number;
  projectionCount: number;
  spokespersonAgentId?: string;
  peers: AgentComprehensionPeerOwner[];
};

const STAGE_TITLES: Record<AgentComprehensionStageId, string> = {
  receive: "Receive",
  represent: "Represent",
  infer_intent: "Infer Intent",
  bind_constraints: "Bind Constraints",
  select_method: "Select Method",
  acquire_knowledge: "Acquire/Use Knowledge",
  transform: "Transform",
  validate: "Validate",
  render: "Render",
  return: "Return",
};

function defaultOwnersForStage(
  stage: AgentComprehensionStageId,
  peers: AgentComprehensionPeerOwner[],
  spokespersonAgentId?: string,
): string[] {
  if (stage === "render" || stage === "return") {
    const renderOwners = peers
      .filter((peer) => peer.ownsStep === stage || peer.ownsStep === "all")
      .map((peer) => peer.id);
    return [...new Set([...(renderOwners.length > 0 ? renderOwners : []), spokespersonAgentId ?? "pi-spokesperson"])];
  }
  if (
    stage === "receive" ||
    stage === "represent" ||
    stage === "infer_intent" ||
    stage === "bind_constraints" ||
    stage === "select_method"
  ) {
    return ["buccet-engine"];
  }
  if (stage === "acquire_knowledge") {
    const owners = peers
      .filter((peer) => peer.ownsStep === stage || peer.ownsStep === "all")
      .map((peer) => peer.id);
    return owners.length > 0 ? owners : ["buccet-engine"];
  }
  const owners = peers
    .filter((peer) => peer.ownsStep === stage || peer.ownsStep === "all")
    .map((peer) => peer.id);
  return owners.length > 0 ? owners : ["peer-field"];
}

function stageRecord(args: {
  id: AgentComprehensionStageId;
  status: AgentComprehensionStageStatus;
  owners: string[];
  summary: string;
  inputs: string[];
  outputs?: string[];
  constraints?: string[];
}): AgentComprehensionStageRecord {
  return {
    id: args.id,
    title: STAGE_TITLES[args.id],
    status: args.status,
    owners: args.owners,
    summary: args.summary,
    inputs: args.inputs,
    outputs: args.outputs ?? [],
    constraints: args.constraints ?? [],
  };
}

function pickMethod(args: {
  userRequest: string;
  peerCount: number;
  projectionCount: number;
}): AgentComprehensionMethod {
  const normalized = args.userRequest.trim().toLowerCase();
  if (
    normalized.length > 0 &&
    (normalized === "make it better" || normalized === "help" || normalized === "?" || normalized.length < 3)
  ) {
    return "clarify-before-transform";
  }
  if (args.peerCount <= 1 && args.projectionCount <= 1) {
    return "single-peer-bounded-pass";
  }
  return "whole-view-fracture-specialist-team";
}

export function isAgentTeamStageId(value: string): value is AgentTeamStageId {
  return (AGENT_TEAM_STAGE_IDS as readonly string[]).includes(value);
}

export function allowedOutputsForComprehensionStage(stage: AgentTeamStageId): string[] {
  if (stage === "all") {
    return [
      "intent",
      "constraints",
      "analysis",
      "plan",
      "validation",
      "render-fragment",
      "answer-fragment",
      "blocked",
      "refusal",
    ];
  }
  if (stage === "render" || stage === "return") return ["render-fragment", "answer-fragment", "blocked"];
  if (stage === "validate") return ["validation", "blocked", "refusal"];
  if (stage === "infer_intent") return ["intent", "constraints", "blocked"];
  return ["analysis", "plan", "constraint", "blocked"];
}

export function allowedActionKindsForComprehensionStage(stage: AgentTeamStageId): BoundaryActionKind[] {
  if (stage === "all") return ["fs.read", "fs.write", "tool.exec", "network.send", "chat.emit"];
  if (stage === "acquire_knowledge") return ["fs.read", "network.send"];
  if (stage === "transform") return ["fs.read", "fs.write", "tool.exec"];
  if (stage === "render" || stage === "return") return ["chat.emit"];
  return ["fs.read"];
}

export function buildInitialComprehensionPass(args: AgentComprehensionInitialPassArgs): AgentComprehensionPass {
  const passId = args.passId ?? `${args.teamId}:comprehension-pass`;
  const requestedBy = args.requestedBy ?? `team-run:${args.teamId}`;
  const peers = args.peers;
  const method = pickMethod({
    userRequest: args.userRequest,
    peerCount: peers.length,
    projectionCount: args.projectionCount,
  });
  const sharedConstraints = [
    "Truth coherence must survive evidence, premise check, and contradiction.",
    "Intent coherence must stay aligned with user law and declared goal.",
    "Execution coherence must stay inside UPL, safety, privacy, and project limits.",
  ];

  return {
    passId,
    teamId: args.teamId,
    requestedBy,
    userRequest: args.userRequest,
    declaredIntent: args.userRequest.trim() || "return a bounded lawful result for the user request",
    successCondition: "return a user-usable answer or a lawful blocked state after coherence and UPL gates complete",
    method,
    wholeViewPrepared: args.wholeViewPrepared,
    lawLayers: ["truth", "intent", "execution"],
    stages: [
      stageRecord({
        id: "receive",
        status: "completed",
        owners: defaultOwnersForStage("receive", peers, args.spokespersonAgentId),
        summary: "Exterior input was captured by the Buccet engine before any peer reasoning began.",
        inputs: ["user request"],
        outputs: [args.userRequest],
        constraints: sharedConstraints,
      }),
      stageRecord({
        id: "represent",
        status: "completed",
        owners: defaultOwnersForStage("represent", peers, args.spokespersonAgentId),
        summary: "The request was normalized into a bounded team-run representation.",
        inputs: ["raw user request"],
        outputs: ["bounded request representation"],
        constraints: sharedConstraints,
      }),
      stageRecord({
        id: "infer_intent",
        status: "completed",
        owners: defaultOwnersForStage("infer_intent", peers, args.spokespersonAgentId),
        summary: "Declared user intent was bound before any method or tool motion.",
        inputs: ["bounded request representation"],
        outputs: [args.userRequest.trim() || "intent unavailable"],
        constraints: [
          ...sharedConstraints,
          "If intent cannot be bound cleanly, lawful continuation is clarification or explicit assumption.",
        ],
      }),
      stageRecord({
        id: "bind_constraints",
        status: "completed",
        owners: defaultOwnersForStage("bind_constraints", peers, args.spokespersonAgentId),
        summary: "UPL, safety, privacy, format, and project constraints were attached before the peer field moved.",
        inputs: ["declared intent", "team UPL track snap"],
        outputs: sharedConstraints,
        constraints: sharedConstraints,
      }),
      stageRecord({
        id: "select_method",
        status: "completed",
        owners: defaultOwnersForStage("select_method", peers, args.spokespersonAgentId),
        summary: `The Buccet engine selected ${method} as the sufficient method for this run.`,
        inputs: ["declared intent", "constraint set", "team topology"],
        outputs: [method],
        constraints: sharedConstraints,
      }),
      stageRecord({
        id: "acquire_knowledge",
        status: args.wholeViewPrepared ? "completed" : "ready",
        owners: defaultOwnersForStage("acquire_knowledge", peers, args.spokespersonAgentId),
        summary: args.wholeViewPrepared
          ? "The whole-view map and projection shards were prepared before live reasoning."
          : "The engine must open the whole-view map before peer reasoning can begin.",
        inputs: ["path sources", "checkpoint bodies"],
        outputs: [
          `${args.sourceCount} path sources`,
          `${args.checkpointedSourceCount} checkpointed sources`,
          `${args.totalLineCount} visible whole-view lines`,
          `${args.packetCount} peer packets`,
          `${args.projectionCount} projection handles`,
        ],
        constraints: [
          ...sharedConstraints,
          "Knowledge is opened through path sources; peers do not own raw storage directly.",
        ],
      }),
      stageRecord({
        id: "transform",
        status: "ready",
        owners: defaultOwnersForStage("transform", peers, args.spokespersonAgentId),
        summary: "The specialist field must work bounded shards and return structured claims to Pi.",
        inputs: ["whole-view map", "projection shards", "peer specialties"],
        constraints: [
          ...sharedConstraints,
          "Peers do not speak as final authority.",
        ],
      }),
      stageRecord({
        id: "validate",
        status: "ready",
        owners: defaultOwnersForStage("validate", peers, args.spokespersonAgentId),
        summary: "A coherence judge must test claims against truth, intent, and execution law before finalization.",
        inputs: ["peer claims", "evidence", "contradictions"],
        constraints: sharedConstraints,
      }),
      stageRecord({
        id: "render",
        status: "ready",
        owners: defaultOwnersForStage("render", peers, args.spokespersonAgentId),
        summary: "Pi renders only after validation, speaking as the group spokesperson rather than the whole mind.",
        inputs: ["validated claim set", "coherence disposition"],
        constraints: [
          ...sharedConstraints,
          "Render must be usable by the receiver.",
        ],
      }),
      stageRecord({
        id: "return",
        status: "ready",
        owners: defaultOwnersForStage("return", peers, args.spokespersonAgentId),
        summary: "The result returns only after the bounded render completes and the ledger-worthy state is known.",
        inputs: ["rendered answer or blocked state"],
        constraints: sharedConstraints,
      }),
    ],
  };
}

function updateStage(
  pass: AgentComprehensionPass,
  stageId: AgentComprehensionStageId,
  patch: Partial<Omit<AgentComprehensionStageRecord, "id" | "title" | "owners">> & {
    appendOutputs?: string[];
  },
): AgentComprehensionPass {
  return {
    ...pass,
    stages: pass.stages.map((stage) => {
      if (stage.id !== stageId) return stage;
      return {
        ...stage,
        status: patch.status ?? stage.status,
        summary: patch.summary ?? stage.summary,
        inputs: patch.inputs ?? stage.inputs,
        outputs: [...stage.outputs, ...(patch.appendOutputs ?? []), ...(patch.outputs ?? [])],
        constraints: patch.constraints ?? stage.constraints,
      };
    }),
  };
}

export function recordComprehensionTransform(pass: AgentComprehensionPass, args: {
  peerSummaries: Array<{ peerId: string; ownsStep: string; resultKind?: string; status: "completed" | "blocked" }>;
}): AgentComprehensionPass {
  const summaries = args.peerSummaries.map((peer) =>
    `${peer.peerId}:${peer.ownsStep}:${peer.resultKind ?? "analysis"}:${peer.status}`,
  );
  return updateStage(pass, "transform", {
    status: args.peerSummaries.some((peer) => peer.status === "blocked") ? "blocked" : "completed",
    summary: "The specialist field returned structured shard work to Pi.",
    appendOutputs: summaries,
  });
}

export function recordComprehensionValidation(pass: AgentComprehensionPass, args: {
  disposition: string;
  truthCoherent: boolean;
  intentCoherent: boolean;
  executionCoherent: boolean;
  reasons: string[];
  finalizationBlocked: boolean;
}): AgentComprehensionPass {
  return updateStage(pass, "validate", {
    status: args.finalizationBlocked ? "blocked" : "completed",
    summary: `Coherence adjudication finished with disposition ${args.disposition}.`,
    appendOutputs: [
      `truth:${args.truthCoherent ? "yes" : "no"}`,
      `intent:${args.intentCoherent ? "yes" : "no"}`,
      `execution:${args.executionCoherent ? "yes" : "no"}`,
      ...args.reasons,
    ],
  });
}

export function recordComprehensionRender(pass: AgentComprehensionPass, args: {
  blocked: boolean;
  spokesperson: string;
  outputPreview: string;
}): AgentComprehensionPass {
  return updateStage(pass, "render", {
    status: args.blocked ? "blocked" : "completed",
    summary: args.blocked
      ? "Pi rendered the blocked/revise state as the group spokesperson."
      : "Pi rendered the validated team answer as the group spokesperson.",
    appendOutputs: [`spokesperson:${args.spokesperson}`, args.outputPreview],
  });
}

export function recordComprehensionReturn(pass: AgentComprehensionPass, args: {
  blocked: boolean;
  outputPreview: string;
}): AgentComprehensionPass {
  return updateStage(pass, "return", {
    status: args.blocked ? "blocked" : "completed",
    summary: args.blocked
      ? "The engine returned a blocked continuation instead of pretending completion."
      : "The engine returned a bounded final answer.",
    appendOutputs: [args.outputPreview],
  });
}

export function renderComprehensionPassForPrompt(pass: AgentComprehensionPass): string {
  return [
    `Pass: ${pass.passId}`,
    `Method: ${pass.method}`,
    `Intent: ${pass.declaredIntent}`,
    `Whole-view prepared: ${pass.wholeViewPrepared ? "yes" : "no"}`,
    `Law layers: ${pass.lawLayers.join(", ")}`,
    "",
    ...pass.stages.map((stage) =>
      [
        `- ${stage.title} [${stage.status}]`,
        `  owners: ${stage.owners.join(", ")}`,
        `  summary: ${stage.summary}`,
        stage.outputs.length > 0 ? `  outputs: ${stage.outputs.join(" | ")}` : "",
      ]
        .filter((line) => line.length > 0)
        .join("\n"),
    ),
  ].join("\n");
}
