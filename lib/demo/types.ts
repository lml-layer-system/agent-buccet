export type LmlStageStatus = "running" | "pass" | "needs_repair" | "blocked" | "ready";

export type LmlStage = {
  label: string;
  status: LmlStageStatus;
  detail: string;
};

export type LmlCheckItem = {
  name: "Citation verification" | "Jurisdiction check" | "Style boundary" | "Admissibility baseline";
  status: "pass" | "needs_repair";
  reason: string;
};

export type LmlRepairItem = {
  title: string;
  outcome: string;
};

export type Gpt2Response = {
  text: string;
  allowedSummary: string;
};

export type PublicDemoResponse = {
  demoMode: true;
  runMode?: "check" | "fixed";
  notice: string;
  lmlStages: LmlStage[];
  whyChecked: LmlCheckItem[];
  whyNeedsRepair: LmlRepairItem[];
  gpt2Response: Gpt2Response;
  repairAudit?: {
    attempted: boolean;
    initialIssueCount: number;
    remainingIssueCount: number;
    forbiddenTermsRemoved: number;
    citationsRedacted: number;
    placeholdersInserted: number;
    summary: string;
    actions: string[];
    repairedContent?: string;
  };
  humanReviewStatus: {
    status: "ready" | "needs_repair";
    summary: string;
  };
  modelReceipt: {
    provider: "gpt2-runtime";
    model: "gpt2";
    runId: string;
    callId: string;
    inputDigest: string;
    at: string;
  };
};
