export type CoherenceDisposition =
  | "Accept"
  | "Reject"
  | "Revise"
  | "SplitClaim"
  | "RunTest"
  | "RequestEvidence"
  | "Escalate"
  | "Defer"
  | "MarkUncertain"
  | "AskUser"
  | "BlockFinalization";

export type CoherenceValidationState =
  | "verified"
  | "tested"
  | "untested"
  | "blocked"
  | "contradicted"
  | "unknown";

export type CoherenceRiskLevel = "low" | "medium" | "high" | "critical";

export type CoherenceIndependence =
  | "independent"
  | "mixed"
  | "shared_context"
  | "correlated"
  | "unknown";

export type CoherenceClaimPacket = {
  claimId: string;
  peerId: string;
  specialty: string;
  ownsStep: string;
  claim: string;
  resultKind: string;
  evidence: string[];
  assumptions: string[];
  confidence: number;
  independence: CoherenceIndependence;
  userLawRelation: string;
  constraintsAffected: string[];
  contradictions: string[];
  testStatus: string;
  riskLevel: CoherenceRiskLevel;
  proposedDisposition: CoherenceDisposition;
  sourcesUsed: string[];
  openQuestions: string[];
  proposedActions: string[];
  rawContent: string;
  claimKey: string;
  coherenceScore: number;
};

export type CoherenceAgreementGroup = {
  claimKey: string;
  claimPreview: string;
  peerIds: string[];
  count: number;
  averageScore: number;
  independenceSignals: CoherenceIndependence[];
};

export type CoherenceAdjudication = {
  packets: CoherenceClaimPacket[];
  agreementGroups: CoherenceAgreementGroup[];
  majorityGroup?: CoherenceAgreementGroup;
  strongestPacket?: CoherenceClaimPacket;
  dissentingPeerIds: string[];
  selectedPeerIds: string[];
  rejectedPeerIds: string[];
  truthCoherent: boolean;
  intentCoherent: boolean;
  executionCoherent: boolean;
  dissentBeatsMajority: boolean;
  disposition: CoherenceDisposition;
  finalizationBlocked: boolean;
  reasons: string[];
};

export type CoherenceInputPeerResult = {
  peerId: string;
  specialty: string;
  ownsStep: string;
  sourceIds: string[];
  output: string;
  status: "completed" | "blocked";
};

const SECTION_KEYS = new Set([
  "result_kind",
  "claim",
  "evidence",
  "assumptions",
  "confidence",
  "independence",
  "user_law_relation",
  "constraints_affected",
  "contradictions",
  "test_status",
  "risk_level",
  "proposed_disposition",
  "specialist_findings",
  "open_questions",
  "proposed_actions",
  "sources_used",
]);

const VALIDATION_POINTS: Record<CoherenceValidationState, number> = {
  verified: 8,
  tested: 5,
  untested: 1,
  blocked: -7,
  contradicted: -8,
  unknown: 0,
};

const INDEPENDENCE_POINTS: Record<CoherenceIndependence, number> = {
  independent: 3,
  mixed: 1,
  shared_context: -1,
  correlated: -2,
  unknown: 0,
};

const DISPOSITION_PRIORITY: CoherenceDisposition[] = [
  "BlockFinalization",
  "RunTest",
  "RequestEvidence",
  "AskUser",
  "Escalate",
  "Defer",
  "MarkUncertain",
  "Revise",
  "SplitClaim",
  "Reject",
  "Accept",
];

function normalizeLineValue(value: string): string {
  return value.trim().replaceAll(/\s+/g, " ");
}

function tokenizeList(value: string): string[] {
  return value
    .split(/\n|;|,|•|^- /gm)
    .map((entry) => entry.replace(/^\s*[-*]\s*/, "").trim())
    .filter((entry) => entry.length > 0 && entry.toLowerCase() !== "none");
}

function normalizeClaimKey(value: string): string {
  const normalized = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9_\s]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
  return normalized.length > 0 ? normalized.slice(0, 160) : "empty-claim";
}

function parseStructuredSections(text: string): Map<string, string> {
  const sections = new Map<string, string>();
  let currentKey: string | null = null;
  const buffers = new Map<string, string[]>();

  const lines = text.split("\n");
  for (const line of lines) {
    const match = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (match && SECTION_KEYS.has(match[1]!.toLowerCase())) {
      currentKey = match[1]!.toLowerCase();
      const inlineValue = match[2] ?? "";
      buffers.set(currentKey, inlineValue.length > 0 ? [inlineValue] : []);
      continue;
    }
    if (!currentKey) continue;
    const bucket = buffers.get(currentKey) ?? [];
    bucket.push(line);
    buffers.set(currentKey, bucket);
  }

  for (const [key, value] of buffers) {
    sections.set(key, value.join("\n").trim());
  }
  return sections;
}

function inferValidationState(text: string, status: "completed" | "blocked"): CoherenceValidationState {
  if (status === "blocked") return "blocked";
  const lower = text.toLowerCase();
  if (lower.includes("contradicted")) return "contradicted";
  if (lower.includes("verified")) return "verified";
  if (lower.includes("tested") || lower.includes("test_pass") || lower.includes("test pass")) return "tested";
  if (lower.includes("blocked")) return "blocked";
  if (lower.includes("untested")) return "untested";
  return "unknown";
}

function inferRiskLevel(text: string): CoherenceRiskLevel {
  const lower = text.toLowerCase();
  if (lower.includes("critical")) return "critical";
  if (lower.includes("high")) return "high";
  if (lower.includes("medium")) return "medium";
  return "low";
}

function parseConfidence(value: string): number {
  const normalized = Number.parseFloat(value);
  if (Number.isFinite(normalized)) {
    if (normalized > 1) return Math.max(0, Math.min(1, normalized / 100));
    return Math.max(0, Math.min(1, normalized));
  }
  return 0.5;
}

function parseDisposition(value: string): CoherenceDisposition {
  const normalized = value.trim();
  const direct = DISPOSITION_PRIORITY.find((entry) => entry.toLowerCase() === normalized.toLowerCase());
  return direct ?? "Revise";
}

function inferIndependence(args: {
  parsedValue?: string;
  sourceIds: string[];
  peers: CoherenceInputPeerResult[];
  currentPeerId: string;
}): CoherenceIndependence {
  if (args.parsedValue) {
    const normalized = args.parsedValue.trim().toLowerCase();
    if (normalized === "independent") return "independent";
    if (normalized === "mixed") return "mixed";
    if (normalized === "shared_context" || normalized === "shared context") return "shared_context";
    if (normalized === "correlated") return "correlated";
  }
  const others = args.peers.filter((peer) => peer.peerId !== args.currentPeerId);
  if (others.length === 0) return "unknown";
  const own = new Set(args.sourceIds.filter((sourceId) => !isSharedInternalTeamSourceId(sourceId)));
  if (own.size === 0) return "unknown";
  let fullyShared = true;
  let anyOverlap = false;
  for (const other of others) {
    const comparable = other.sourceIds.filter((sourceId) => !isSharedInternalTeamSourceId(sourceId));
    const overlap = comparable.some((sourceId) => own.has(sourceId));
    anyOverlap = anyOverlap || overlap;
    const sameSet =
      comparable.length === own.size &&
      comparable.every((sourceId) => own.has(sourceId));
    fullyShared = fullyShared && sameSet;
  }
  if (fullyShared) return "correlated";
  if (anyOverlap) return "mixed";
  return "independent";
}

function scorePacket(packet: Omit<CoherenceClaimPacket, "coherenceScore">): number {
  let score = 0;
  score += VALIDATION_POINTS[inferValidationFromPacket(packet)];
  score += Math.min(packet.evidence.length, 3) * 2;
  score += Math.min(packet.sourcesUsed.length, 3);
  score += INDEPENDENCE_POINTS[packet.independence];
  score += Math.round(packet.confidence * 2);
  score -= Math.min(packet.assumptions.length, 3);
  score -= packet.contradictions.length * 2;

  const lawRelation = packet.userLawRelation.toLowerCase();
  if (lawRelation.includes("aligned") || lawRelation.includes("supports")) score += 2;
  if (lawRelation.includes("conflict") || lawRelation.includes("violates")) score -= 4;

  if ((packet.riskLevel === "high" || packet.riskLevel === "critical") && !["verified", "tested"].includes(inferValidationFromPacket(packet))) {
    score -= packet.riskLevel === "critical" ? 8 : 5;
  }

  if (packet.proposedDisposition === "BlockFinalization") score -= 4;
  if (packet.proposedDisposition === "RequestEvidence") score -= 2;
  return score;
}

function inferValidationFromPacket(packet: Omit<CoherenceClaimPacket, "coherenceScore">): CoherenceValidationState {
  const normalized = packet.testStatus.trim().toLowerCase();
  if (normalized === "verified") return "verified";
  if (normalized === "tested") return "tested";
  if (normalized === "untested") return "untested";
  if (normalized === "blocked") return "blocked";
  if (normalized === "contradicted") return "contradicted";
  if (normalized.length > 0) return "unknown";
  return inferValidationState(packet.rawContent, "completed");
}

export function buildCoherenceClaimPacket(args: {
  peer: CoherenceInputPeerResult;
  peers: CoherenceInputPeerResult[];
}): CoherenceClaimPacket {
  const sections = parseStructuredSections(args.peer.output);
  const resultKind = normalizeLineValue(sections.get("result_kind") ?? "analysis");
  const findings = sections.get("specialist_findings") ?? "";
  const claim = normalizeLineValue(
    sections.get("claim") ??
      findings.split("\n").find((line) => line.trim().length > 0) ??
      args.peer.output.slice(0, 240),
  );
  const evidence = tokenizeList(sections.get("evidence") ?? sections.get("sources_used") ?? "");
  const assumptions = tokenizeList(sections.get("assumptions") ?? "");
  const contradictions = tokenizeList(sections.get("contradictions") ?? "");
  const openQuestions = tokenizeList(sections.get("open_questions") ?? "");
  const proposedActions = tokenizeList(sections.get("proposed_actions") ?? "");
  const confidence = parseConfidence(sections.get("confidence") ?? "0.5");
  const userLawRelation = normalizeLineValue(sections.get("user_law_relation") ?? "unspecified");
  const constraintsAffected = tokenizeList(sections.get("constraints_affected") ?? "");
  const testStatus = normalizeLineValue(sections.get("test_status") ?? inferValidationState(args.peer.output, args.peer.status));
  const riskLevel = (normalizeLineValue(sections.get("risk_level") ?? inferRiskLevel(args.peer.output)) || "low").toLowerCase() as CoherenceRiskLevel;
  const proposedDisposition = parseDisposition(sections.get("proposed_disposition") ?? (args.peer.status === "blocked" ? "BlockFinalization" : "Revise"));
  const independence = inferIndependence({
    parsedValue: sections.get("independence") ?? undefined,
    sourceIds: args.peer.sourceIds,
    peers: args.peers,
    currentPeerId: args.peer.peerId,
  });

  const packetBase = {
    claimId: `${args.peer.peerId}:${normalizeClaimKey(claim).slice(0, 24)}`,
    peerId: args.peer.peerId,
    specialty: args.peer.specialty,
    ownsStep: args.peer.ownsStep,
    claim,
    resultKind,
    evidence,
    assumptions,
    confidence,
    independence,
    userLawRelation,
    constraintsAffected,
    contradictions,
    testStatus,
    riskLevel,
    proposedDisposition,
    sourcesUsed: args.peer.sourceIds,
    openQuestions,
    proposedActions,
    rawContent: args.peer.output,
    claimKey: normalizeClaimKey(claim),
  };

  return {
    ...packetBase,
    coherenceScore: scorePacket(packetBase),
  };
}

function groupAgreements(packets: CoherenceClaimPacket[]): CoherenceAgreementGroup[] {
  const groups = new Map<string, CoherenceClaimPacket[]>();
  for (const packet of packets) {
    const existing = groups.get(packet.claimKey) ?? [];
    existing.push(packet);
    groups.set(packet.claimKey, existing);
  }
  return [...groups.entries()]
    .map(([claimKey, entries]) => ({
      claimKey,
      claimPreview: entries[0]?.claim ?? claimKey,
      peerIds: entries.map((entry) => entry.peerId),
      count: entries.length,
      averageScore: entries.reduce((sum, entry) => sum + entry.coherenceScore, 0) / Math.max(entries.length, 1),
      independenceSignals: entries.map((entry) => entry.independence),
    }))
    .sort((a, b) => b.count - a.count || b.averageScore - a.averageScore);
}

function strongestPacket(packets: CoherenceClaimPacket[]): CoherenceClaimPacket | undefined {
  return [...packets].sort((a, b) =>
    b.coherenceScore - a.coherenceScore ||
    confidenceSort(b, a) ||
    b.evidence.length - a.evidence.length,
  )[0];
}

function confidenceSort(a: CoherenceClaimPacket, b: CoherenceClaimPacket): number {
  return Math.round(a.confidence * 100) - Math.round(b.confidence * 100);
}

export function adjudicateMultiAgentCoherence(args: {
  peers: CoherenceInputPeerResult[];
  userRequest: string;
}): CoherenceAdjudication {
  const packets = args.peers.map((peer) => buildCoherenceClaimPacket({ peer, peers: args.peers }));
  const agreementGroups = groupAgreements(packets);
  const majorityGroup = agreementGroups[0];
  const strongest = strongestPacket(packets);
  const dissentingPeerIds =
    majorityGroup
      ? packets.filter((packet) => !majorityGroup.peerIds.includes(packet.peerId)).map((packet) => packet.peerId)
      : [];

  const truthCoherent = packets.every((packet) => {
    const validation = inferValidationFromPacket(packet);
    if (validation === "blocked" || validation === "contradicted") return false;
    if ((packet.riskLevel === "high" || packet.riskLevel === "critical") && packet.evidence.length === 0) return false;
    return true;
  });
  const intentCoherent = packets.every((packet) => !packet.userLawRelation.toLowerCase().includes("conflict"));
  const executionCoherent = packets.every((packet) => {
    const validation = inferValidationFromPacket(packet);
    if ((packet.riskLevel === "high" || packet.riskLevel === "critical") && !["verified", "tested"].includes(validation)) {
      return false;
    }
    return packet.proposedDisposition !== "Escalate";
  });

  const reasons: string[] = [];
  let disposition: CoherenceDisposition = "Accept";
  if (packets.some((packet) => packet.proposedDisposition === "BlockFinalization")) {
    disposition = "BlockFinalization";
    reasons.push("At least one peer explicitly requested block finalization.");
  } else if (!truthCoherent) {
    disposition = "RequestEvidence";
    reasons.push("One or more candidate claims fail truth coherence against evidence or validation state.");
  } else if (!executionCoherent) {
    disposition = "RunTest";
    reasons.push("Execution coherence failed for high-risk or unverified claims.");
  } else if (!intentCoherent) {
    disposition = "AskUser";
    reasons.push("One or more claims conflict with declared user-law relation.");
  } else if (packets.some((packet) => packet.proposedDisposition === "RunTest")) {
    disposition = "RunTest";
    reasons.push("A peer requested explicit testing before finalization.");
  } else if (packets.some((packet) => packet.proposedDisposition === "RequestEvidence")) {
    disposition = "RequestEvidence";
    reasons.push("A peer requested stronger evidence before finalization.");
  }

  let dissentBeatsMajority = false;
  if (strongest && majorityGroup && !majorityGroup.peerIds.includes(strongest.peerId)) {
    dissentBeatsMajority = true;
    reasons.push("A dissenting peer has the strongest coherence score.");
    if (disposition === "Accept") {
      disposition = strongest.riskLevel === "high" || strongest.riskLevel === "critical"
        ? "BlockFinalization"
        : "Revise";
    }
  }

  const topTwo = [...packets].sort((a, b) => b.coherenceScore - a.coherenceScore).slice(0, 2);
  if (disposition === "Accept" && topTwo.length === 2 && Math.abs(topTwo[0]!.coherenceScore - topTwo[1]!.coherenceScore) <= 1 && topTwo[0]!.claimKey !== topTwo[1]!.claimKey) {
    disposition = "MarkUncertain";
    reasons.push("Top competing claims are too close in coherence score to finalize cleanly.");
  }

  const finalizationBlocked = disposition !== "Accept";
  const selectedPeerIds =
    disposition === "Accept" && majorityGroup
      ? majorityGroup.peerIds
      : strongest
        ? [strongest.peerId]
        : [];
  const rejectedPeerIds = packets.map((packet) => packet.peerId).filter((peerId) => !selectedPeerIds.includes(peerId));

  if (reasons.length === 0) {
    reasons.push("Agreement and evidence passed the coherence gate.");
  }

  return {
    packets,
    agreementGroups,
    majorityGroup,
    strongestPacket: strongest,
    dissentingPeerIds,
    selectedPeerIds,
    rejectedPeerIds,
    truthCoherent,
    intentCoherent,
    executionCoherent,
    dissentBeatsMajority,
    disposition,
    finalizationBlocked,
    reasons,
  };
}

export function renderCoherenceGateReport(args: {
  userRequest: string;
  adjudication: CoherenceAdjudication;
}): string {
  const lines: string[] = [
    "Coherence gate blocked finalization.",
    "",
    `Disposition: ${args.adjudication.disposition}`,
    `Truth coherent: ${args.adjudication.truthCoherent ? "yes" : "no"}`,
    `Intent coherent: ${args.adjudication.intentCoherent ? "yes" : "no"}`,
    `Execution coherent: ${args.adjudication.executionCoherent ? "yes" : "no"}`,
  ];
  if (args.adjudication.strongestPacket) {
    lines.push(
      `Strongest claim: ${args.adjudication.strongestPacket.peerId} · ${args.adjudication.strongestPacket.claim}`,
    );
  }
  if (args.adjudication.majorityGroup) {
    lines.push(
      `Majority signal: ${args.adjudication.majorityGroup.count} peers around "${args.adjudication.majorityGroup.claimPreview}"`,
    );
  }
  if (args.adjudication.dissentBeatsMajority) {
    lines.push("Dissent with higher coherence outranked majority agreement.");
  }
  lines.push("");
  lines.push("Reasons:");
  for (const reason of args.adjudication.reasons) {
    lines.push(`- ${reason}`);
  }
  lines.push("");
  lines.push("Peer packets:");
  for (const packet of args.adjudication.packets) {
    lines.push(
      `- ${packet.peerId} · score=${packet.coherenceScore} · ${packet.proposedDisposition} · ${packet.claim}`,
    );
  }
  return lines.join("\n");
}
import { isSharedInternalTeamSourceId } from "./team-workshop.ts";
