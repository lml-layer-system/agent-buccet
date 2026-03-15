export type MetaDeliveryEventType = "DELIVERY_QUEUED" | "DELIVERY_ACTIVATED";

export type MetaDeliveryPayload = {
  sessionId: string;
  runId: string | null;
  source: string;
  text: string;
  scope: string;
  enforcement: string;
  critical: boolean;
  createdAt: string;
};

export type MetaDeliveryLedgerRecord = {
  index: number;
  eventType: MetaDeliveryEventType;
  payload: MetaDeliveryPayload;
};

export type MetaDeliveryPlanetRootLaw = {
  id: string;
  parentTag: string;
  planet: "meta_delivery";
  sourceLedgerIndex: number;
  sourceEventType: MetaDeliveryEventType;
  text: string;
  createdAt: string;
};
