import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryProtectedSubject,
  BoundaryProtectedSubjectKind,
  BoundaryRuntimeConfig,
} from "./../runtime/types.ts";

const OUTBOUND_SECRETS_ACTION_KINDS = new Set<BoundaryActionKind>([
  "chat.emit",
  "network.send",
  "comm.send",
  "tool.exec",
]);

const MIN_PROTECTED_MATCH_LENGTH = 24;
const MAX_PROTECTED_SNIPPETS = 128;

function normalizeSecretsText(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function pushUnique(values: string[], seen: Set<string>, candidate: string) {
  const normalized = normalizeSecretsText(candidate);
  if (normalized.length < MIN_PROTECTED_MATCH_LENGTH || seen.has(normalized)) {
    return;
  }
  seen.add(normalized);
  values.push(normalized);
}

function buildProtectedSnippetFingerprints(content: string): string[] {
  const seen = new Set<string>();
  const snippets: string[] = [];
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (snippets.length >= MAX_PROTECTED_SNIPPETS) {
      break;
    }
    pushUnique(snippets, seen, line);
  }

  const normalized = normalizeSecretsText(content);
  const words = normalized.split(/\s+/).filter(Boolean);
  for (
    let index = 0;
    index < words.length && snippets.length < MAX_PROTECTED_SNIPPETS;
    index += 6
  ) {
    const window = words.slice(index, index + 12).join(" ");
    pushUnique(snippets, seen, window);
  }

  return snippets;
}

function dedupeProtectedSubjects(subjects: BoundaryProtectedSubject[]): BoundaryProtectedSubject[] {
  const byId = new Map<string, BoundaryProtectedSubject>();
  for (const subject of subjects) {
    byId.set(subject.subjectId, subject);
  }
  return [...byId.values()];
}

function protectedKindFlag(
  kind: BoundaryProtectedSubjectKind,
): keyof NonNullable<BoundaryActionRequest["flags"]> {
  switch (kind) {
    case "source_code":
      return "payloadContainsProtectedSourceCode";
    case "prompt":
      return "payloadContainsProtectedPrompt";
    case "contract":
      return "payloadContainsProtectedContract";
    case "internal_doc":
      return "payloadContainsProtectedInternalDoc";
    case "customer_data":
      return "payloadContainsProtectedCustomerData";
    case "model_weight":
      return "payloadContainsProtectedModelWeight";
    default:
      return "payloadContainsProtectedMaterial";
  }
}

function applyProtectedKindFlags(
  flags: NonNullable<BoundaryActionRequest["flags"]>,
  kinds: BoundaryProtectedSubjectKind[],
) {
  if (kinds.length === 0) {
    return;
  }
  flags.payloadContainsProtectedMaterial = true;
  for (const kind of kinds) {
    flags[protectedKindFlag(kind)] = true;
    if (kind === "credential") {
      flags.payloadContainsCredential = true;
    }
  }
}

export function isBoundarySecretsOutboundAction(actionKind: BoundaryActionKind): boolean {
  return OUTBOUND_SECRETS_ACTION_KINDS.has(actionKind);
}

export function createBoundaryProtectedSubject(args: {
  subjectId?: string;
  label: string;
  kind: BoundaryProtectedSubjectKind;
  content: string;
  sourcePath?: string;
  sealedBy: string;
  createdAt?: string;
}): BoundaryProtectedSubject {
  const normalizedContent = normalizeSecretsText(args.content);
  return {
    subjectId:
      args.subjectId ??
      `protected:${createHash("sha256").update(`${args.label}\n${normalizedContent}`).digest("hex").slice(0, 16)}`,
    label: args.label,
    kind: args.kind,
    ...(args.sourcePath ? { sourcePath: path.resolve(args.sourcePath) } : {}),
    contentSha256: createHash("sha256").update(args.content).digest("hex"),
    contentLength: args.content.length,
    normalizedContent,
    snippetFingerprints: buildProtectedSnippetFingerprints(args.content),
    createdAt: args.createdAt ?? new Date().toISOString(),
    sealedBy: args.sealedBy,
  };
}

export function sealBoundaryProtectedSubject(args: {
  config: BoundaryRuntimeConfig;
  subjectId?: string;
  label: string;
  kind: BoundaryProtectedSubjectKind;
  content: string;
  sourcePath?: string;
  sealedBy: string;
  createdAt?: string;
}): BoundaryRuntimeConfig {
  const nextSubject = createBoundaryProtectedSubject(args);
  return {
    ...args.config,
    protectedSubjects: dedupeProtectedSubjects([
      ...(args.config.protectedSubjects ?? []),
      nextSubject,
    ]),
  };
}

export async function sealBoundaryProtectedFile(args: {
  config: BoundaryRuntimeConfig;
  filePath: string;
  label?: string;
  kind: BoundaryProtectedSubjectKind;
  subjectId?: string;
  sealedBy: string;
  createdAt?: string;
}): Promise<BoundaryRuntimeConfig> {
  const filePath = path.resolve(args.filePath);
  const content = await fs.readFile(filePath, "utf8");
  return sealBoundaryProtectedSubject({
    config: args.config,
    subjectId: args.subjectId,
    label: args.label ?? path.basename(filePath),
    kind: args.kind,
    content,
    sourcePath: filePath,
    sealedBy: args.sealedBy,
    createdAt: args.createdAt,
  });
}

export function inferBoundaryProtectedMaterialSignals(args: {
  config: BoundaryRuntimeConfig;
  actionKind: BoundaryActionKind;
  payload?: string;
}): {
  flags: BoundaryActionRequest["flags"];
  evidence: string[];
  protectedSubjectIds: string[];
  protectedSubjectKinds: BoundaryProtectedSubjectKind[];
} {
  if (!isBoundarySecretsOutboundAction(args.actionKind)) {
    return {
      flags: {},
      evidence: [],
      protectedSubjectIds: [],
      protectedSubjectKinds: [],
    };
  }

  const normalizedPayload = normalizeSecretsText(args.payload ?? "");
  const protectedSubjects = args.config.protectedSubjects ?? [];
  if (normalizedPayload.length < MIN_PROTECTED_MATCH_LENGTH || protectedSubjects.length === 0) {
    return {
      flags: {},
      evidence: [],
      protectedSubjectIds: [],
      protectedSubjectKinds: [],
    };
  }

  const matchedIds = new Set<string>();
  const matchedKinds = new Set<BoundaryProtectedSubjectKind>();
  const evidence: string[] = [];

  for (const subject of protectedSubjects) {
    const normalizedSubject = subject.normalizedContent;
    const directMatch =
      normalizedPayload.includes(normalizedSubject) ||
      (normalizedPayload.length >= MIN_PROTECTED_MATCH_LENGTH &&
        normalizedSubject.includes(normalizedPayload));
    const snippetMatch = !directMatch
      ? subject.snippetFingerprints.find((snippet) => normalizedPayload.includes(snippet))
      : undefined;

    if (!directMatch && !snippetMatch) {
      continue;
    }

    matchedIds.add(subject.subjectId);
    matchedKinds.add(subject.kind);
    evidence.push(
      `${subject.kind} subject '${subject.label}' matched in outbound payload${subject.sourcePath ? ` (${subject.sourcePath})` : ""}.`,
    );
  }

  if (matchedIds.size === 0) {
    return {
      flags: {},
      evidence: [],
      protectedSubjectIds: [],
      protectedSubjectKinds: [],
    };
  }

  const flags: NonNullable<BoundaryActionRequest["flags"]> = {};
  applyProtectedKindFlags(flags, [...matchedKinds]);

  return {
    flags,
    evidence,
    protectedSubjectIds: [...matchedIds],
    protectedSubjectKinds: [...matchedKinds],
  };
}
