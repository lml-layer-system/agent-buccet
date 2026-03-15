export type LedgerEventType = "SNAP_RUN" | "DEMO_MODEL_CALL";

export type LedgerPayload = {
  runId: string;
  profileId: string;
  profileVersion: string;
  profileImmutableHash: string;
  runMode: "demo" | "product";
  admissible: boolean;
  nullOutput: boolean;
  blockerCount: number;
  rejectedCount: number;
  artifactLength: number;
  createdAt: string;
};

export type LedgerRecord = {
  index: number;
  eventType: LedgerEventType;
  payload: LedgerPayload | DemoModelCallPayload;
  prevDigest: string | null;
  digest: string;
};

export type ReplayProof = {
  runId: string;
  found: boolean;
  verified: boolean;
  record: LedgerRecord | null;
  chainLength: number;
  verificationFailures: string[];
};

export type DemoModelCallPayload = {
  runId: string;
  provider: "gpt2-runtime";
  model: "gpt2";
  callId: string;
  inputDigest: string;
  createdAt: string;
};
