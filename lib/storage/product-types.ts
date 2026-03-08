export type ProductRole = "lawyer" | "staff" | "client";

export type TimelineStatus = "waiting" | "in_progress" | "delayed" | "complete";

export type CaseVisibility = "client" | "private";
export type ObligationBand = "B1" | "B2" | "B3" | "B4" | "B5" | "B6" | "B7";
export type RiskBand = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7";
export type FlowObjectType = "action" | "waiting" | "document" | "deadline" | "message" | "gate";

export type CaseTimelineEvent = {
  id: string;
  caseId: string;
  stage: string;
  status: TimelineStatus;
  note: string;
  eta: string | null;
  visibility: CaseVisibility;
  actorId: string;
  ownerId: string;
  objectType: FlowObjectType;
  obligationBand: ObligationBand;
  riskBand: RiskBand;
  dueAt: string | null;
  artifactRefs: string[];
  createdAt: string;
};

export type CaseQuestion = {
  id: string;
  caseId: string;
  clientId: string;
  text: string;
  autoAck: string;
  lawyerReply: string | null;
  createdAt: string;
  repliedAt: string | null;
};

export type CaseFile = {
  id: string;
  caseId: string;
  name: string;
  contentType: string;
  digest: string;
  sizeBytes: number;
  storageRef: string;
  visibility: CaseVisibility;
  uploadedBy: string;
  createdAt: string;
};

export type LawyerPresetAcks = {
  questionReceived: string;
  uploadReceived: string;
  waitingOnCourt: string;
};

export type ProductCase = {
  id: string;
  firmId: string;
  title: string;
  clientId: string;
  clientName: string;
  assignedLawyerId: string;
  nextStep: string;
  currentStage: string;
  currentStatus: TimelineStatus;
  eta: string | null;
  createdAt: string;
  updatedAt: string;
  timeline: CaseTimelineEvent[];
  questions: CaseQuestion[];
  files: CaseFile[];
  autoAckPresets: LawyerPresetAcks;
};

export type ProductStore = {
  cases: ProductCase[];
};
