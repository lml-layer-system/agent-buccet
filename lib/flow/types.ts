import type { FlowObjectType, ObligationBand, RiskBand, TimelineStatus } from "@/lib/storage/product-types";

export type TimeBand = "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7";

export type ThroughputSignature = {
  timeBand: TimeBand;
  obligationBand: ObligationBand;
  riskBand: RiskBand;
  objectType: FlowObjectType;
};

export type FlowLane = "now" | "this_week" | "waiting" | "someday" | "completed" | "audit";

export type FlowItem = {
  id: string;
  caseId: string;
  caseTitle: string;
  stage: string;
  status: TimelineStatus;
  note: string;
  ownerId: string;
  dueAt: string | null;
  createdAt: string;
  signature: ThroughputSignature;
  lane: FlowLane;
  requiresHardGate: boolean;
  hardGateReason: string | null;
  followUpRequired: boolean;
  followUpAt: string | null;
  reminderDue: boolean;
};
