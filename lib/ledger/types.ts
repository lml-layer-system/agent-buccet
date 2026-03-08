export type LedgerEventType = "SNAP_RUN" | "PRODUCT_MUTATION" | "DEMO_MODEL_CALL";

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
  payload: LedgerPayload | ProductMutationPayload | DemoModelCallPayload;
  prevDigest: string | null;
  digest: string;
};

export type ProductMutationPayload = {
  mutationId: string;
  mutationType:
    | "CASE_CREATED"
    | "CASE_UPDATED"
    | "QUESTION_SUBMITTED"
    | "QUESTION_REPLIED"
    | "ARTIFACT_ATTACHED";
  caseId: string;
  actorId: string;
  role: "lawyer" | "staff" | "client";
  details: Record<string, string | number | boolean | null>;
  createdAt: string;
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
