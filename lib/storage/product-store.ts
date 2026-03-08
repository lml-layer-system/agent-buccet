import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { CaseQuestion, CaseTimelineEvent, ProductCase, ProductStore } from "./product-types";

const PRODUCT_DATA_DIR = path.join(process.cwd(), "data", "product");
const PRODUCT_STORE_FILE = path.join(PRODUCT_DATA_DIR, "cases.json");

const DEFAULT_STORE: ProductStore = {
  cases: [],
};

async function ensureStore(): Promise<void> {
  await fs.mkdir(PRODUCT_DATA_DIR, { recursive: true });
  try {
    await fs.access(PRODUCT_STORE_FILE);
  } catch {
    await fs.writeFile(PRODUCT_STORE_FILE, JSON.stringify(DEFAULT_STORE, null, 2), "utf-8");
  }
}

async function readStore(): Promise<ProductStore> {
  await ensureStore();
  const raw = await fs.readFile(PRODUCT_STORE_FILE, "utf-8");
  return JSON.parse(raw) as ProductStore;
}

async function writeStore(store: ProductStore): Promise<void> {
  await fs.writeFile(PRODUCT_STORE_FILE, JSON.stringify(store, null, 2), "utf-8");
}

export async function listCasesForLawyer(lawyerId: string): Promise<ProductCase[]> {
  const store = await readStore();
  return store.cases.filter((entry) => entry.assignedLawyerId === lawyerId);
}

export async function listCasesForClient(clientId: string): Promise<ProductCase[]> {
  const store = await readStore();
  return store.cases.filter((entry) => entry.clientId === clientId);
}

export async function findCase(caseId: string): Promise<ProductCase | null> {
  const store = await readStore();
  return store.cases.find((entry) => entry.id === caseId) ?? null;
}

export async function createCase(input: {
  title: string;
  firmId: string;
  clientId: string;
  clientName: string;
  assignedLawyerId: string;
  createdBy: string;
}): Promise<ProductCase> {
  const store = await readStore();
  const now = new Date().toISOString();
  const caseId = randomUUID();
  const seedEvent: CaseTimelineEvent = {
    id: randomUUID(),
    caseId,
    stage: "intake",
    status: "in_progress",
    note: "Case created and intake started.",
    eta: null,
    visibility: "client",
    actorId: input.createdBy,
    ownerId: input.assignedLawyerId,
    objectType: "action",
    obligationBand: "B4",
    riskBand: "C6",
    dueAt: null,
    artifactRefs: [],
    createdAt: now,
  };

  const created: ProductCase = {
    id: caseId,
    firmId: input.firmId,
    title: input.title,
    clientId: input.clientId,
    clientName: input.clientName,
    assignedLawyerId: input.assignedLawyerId,
    nextStep: "Gather initial documents",
    currentStage: "intake",
    currentStatus: "in_progress",
    eta: null,
    createdAt: now,
    updatedAt: now,
    timeline: [seedEvent],
    questions: [],
    files: [],
    autoAckPresets: {
      questionReceived: "Thanks, I received your question. I'll review it in my update window.",
      uploadReceived: "Thanks, your document was received. I'll review it shortly.",
      waitingOnCourt: "We're currently waiting on the court. I'll post an update as soon as we hear back.",
    },
  };

  store.cases.push(created);
  await writeStore(store);
  return created;
}

export async function addTimelineUpdate(input: {
  caseId: string;
  actorId: string;
  stage: string;
  status: ProductCase["currentStatus"];
  note: string;
  eta?: string | null;
  dueAt?: string | null;
  nextStep?: string;
  visibility?: "client" | "private";
  ownerId?: string;
  objectType?: CaseTimelineEvent["objectType"];
  obligationBand?: CaseTimelineEvent["obligationBand"];
  riskBand?: CaseTimelineEvent["riskBand"];
  artifactRefs?: string[];
}): Promise<ProductCase | null> {
  const store = await readStore();
  const target = store.cases.find((entry) => entry.id === input.caseId);
  if (!target) {
    return null;
  }

  const event: CaseTimelineEvent = {
    id: randomUUID(),
    caseId: input.caseId,
    stage: input.stage,
    status: input.status,
    note: input.note,
    eta: input.eta ?? null,
    visibility: input.visibility ?? "client",
    actorId: input.actorId,
    ownerId: input.ownerId ?? target.assignedLawyerId,
    objectType: input.objectType ?? "action",
    obligationBand: input.obligationBand ?? "B4",
    riskBand: input.riskBand ?? "C6",
    dueAt: input.dueAt ?? null,
    artifactRefs: input.artifactRefs ?? [],
    createdAt: new Date().toISOString(),
  };

  target.timeline.unshift(event);
  target.currentStage = input.stage;
  target.currentStatus = input.status;
  target.eta = input.eta ?? null;
  target.nextStep = input.nextStep?.trim() ? input.nextStep : target.nextStep;
  target.updatedAt = new Date().toISOString();

  await writeStore(store);
  return target;
}

export async function attachCaseArtifact(input: {
  caseId: string;
  uploadedBy: string;
  name: string;
  contentType: string;
  digest: string;
  sizeBytes: number;
  storageRef: string;
  visibility?: "client" | "private";
}): Promise<ProductCase | null> {
  const store = await readStore();
  const target = store.cases.find((entry) => entry.id === input.caseId);
  if (!target) {
    return null;
  }

  target.files.unshift({
    id: randomUUID(),
    caseId: input.caseId,
    name: input.name,
    contentType: input.contentType,
    digest: input.digest,
    sizeBytes: input.sizeBytes,
    storageRef: input.storageRef,
    visibility: input.visibility ?? "private",
    uploadedBy: input.uploadedBy,
    createdAt: new Date().toISOString(),
  });

  target.updatedAt = new Date().toISOString();
  await writeStore(store);
  return target;
}

export async function listFlowCasesForLawyer(lawyerId: string): Promise<ProductCase[]> {
  const store = await readStore();
  return store.cases.filter((entry) => entry.assignedLawyerId === lawyerId);
}

export async function resolveCaseArtifactRefs(
  caseId: string,
  providedRefs: string[] = [],
  limit = 3,
): Promise<string[]> {
  const normalizedProvided = providedRefs.map((entry) => entry.trim()).filter(Boolean);
  if (normalizedProvided.length > 0) {
    return normalizedProvided;
  }

  const item = await findCase(caseId);
  if (!item) {
    return [];
  }

  return item.files.slice(0, limit).map((file) => file.storageRef);
}

export async function addClientQuestion(input: {
  caseId: string;
  clientId: string;
  text: string;
}): Promise<{ updated: ProductCase; question: CaseQuestion } | null> {
  const store = await readStore();
  const target = store.cases.find((entry) => entry.id === input.caseId && entry.clientId === input.clientId);
  if (!target) {
    return null;
  }

  const question: CaseQuestion = {
    id: randomUUID(),
    caseId: input.caseId,
    clientId: input.clientId,
    text: input.text,
    autoAck: target.autoAckPresets.questionReceived,
    lawyerReply: null,
    createdAt: new Date().toISOString(),
    repliedAt: null,
  };

  target.questions.unshift(question);
  target.updatedAt = new Date().toISOString();
  await writeStore(store);
  return { updated: target, question };
}

export async function listLawyerQuestions(lawyerId: string): Promise<Array<CaseQuestion & { caseTitle: string; clientName: string }>> {
  const store = await readStore();
  const out: Array<CaseQuestion & { caseTitle: string; clientName: string }> = [];

  for (const item of store.cases) {
    if (item.assignedLawyerId !== lawyerId) {
      continue;
    }
    for (const question of item.questions) {
      out.push({
        ...question,
        caseTitle: item.title,
        clientName: item.clientName,
      });
    }
  }

  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function replyToQuestion(input: {
  caseId: string;
  questionId: string;
  lawyerId: string;
  reply: string;
}): Promise<ProductCase | null> {
  const store = await readStore();
  const target = store.cases.find((entry) => entry.id === input.caseId && entry.assignedLawyerId === input.lawyerId);
  if (!target) {
    return null;
  }

  const question = target.questions.find((entry) => entry.id === input.questionId);
  if (!question) {
    return null;
  }

  question.lawyerReply = input.reply;
  question.repliedAt = new Date().toISOString();
  target.updatedAt = new Date().toISOString();

  await writeStore(store);
  return target;
}
