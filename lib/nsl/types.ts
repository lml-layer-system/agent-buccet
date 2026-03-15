export type NslLedgerEventType = "REPAIR_PASSTHROUGH" | "REPAIR_ADMITTED" | "REPAIR_NULL";

export type NslRepairLedgerPayload = {
  runId: string;
  reason: string;
  finalAction: "success" | "refusal";
  failureClasses: string[];
  triggeredRepairs: string[];
  createdAt: string;
};

export type NslLedgerRecord = {
  index: number;
  eventType: NslLedgerEventType;
  payload: NslRepairLedgerPayload;
};

export type NslPlanetRootLaw = {
  id: string;
  parentTag: string;
  planet: "nsl";
  sourceLedgerIndex: number;
  sourceEventType: NslLedgerEventType;
  text: string;
  createdAt: string;
};
