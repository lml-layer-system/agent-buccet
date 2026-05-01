import { createHash, randomUUID } from "node:crypto";
import type {
  BoundaryActionKind,
  BoundaryLedgerRecord,
  BoundaryRequestProvenance,
  BoundaryReviewContext,
  BoundarySession,
  BoundarySpendCommitIntent,
  BoundarySpendDestinationKind,
  BoundarySpendPeriodWindow,
  BoundarySpendRiskClass,
  BoundarySpendSourceAuthorityKind,
  BoundaryUplRequestBasis,
  BoundaryUplScope,
  BoundaryUplTrackConstraint,
  BoundaryUserPathLedger,
  CompiledDocumentLaw,
} from "./../runtime/types.ts";
import { writeCompiledUserPathLaws } from "./../proof/user-path-ledger.ts";

export type BoundaryUplProcessStage =
  | "observed"
  | "boundary_identified"
  | "invariant_extracted"
  | "typed"
  | "drafted"
  | "reviewed"
  | "human_approved"
  | "compiled"
  | "active";

export type BoundaryUplCapabilityState = "deny" | "ask" | "allow";
export type BoundaryUplMutationKind = "add" | "narrow" | "widen" | "replace" | "suspend" | "restore" | "delete";
export type BoundaryUplDraftActorKind = "human" | "pi" | "agent" | "system";
export type BoundaryUplApprovalActorKind = "human";
export type BoundaryUplDomain =
  | "spend"
  | "create"
  | "defense"
  | "contract"
  | "identity"
  | "network"
  | "system"
  | "other";
export type BoundaryUplRecurringPolicy = "deny" | "ask" | "allow";
export type BoundaryUplSubstitutionPolicy =
  | "deny"
  | "ask"
  | "allow_same_handle"
  | "allow_within_bucket";
export type BoundaryUplHumanConfirmationRule =
  | "never"
  | "ask_before_commit"
  | "notify_before_commit"
  | "require_human_execution";
export type BoundaryUplReminderOffset = "14d" | "7d" | "3d" | "1d";
export type BoundaryUplProofRequirement = "none" | "record_match" | "artifact_required" | "receipt_required";
export type BoundaryUplSyncTarget = "session" | "team" | "buccet" | "future_buccets" | "global";

export type BoundaryStructuredUplRuntimeCorridor = {
  actionKinds: BoundaryActionKind[];
  primaryTarget: string;
  targetPatterns?: string[];
  targetMatchMode?: "prefix" | "exact" | "regex";
  provenance?: BoundaryRequestProvenance;
  reviewSurface?: BoundaryReviewContext["surface"];
  reviewInvariantLawId?: string;
};

export type BoundaryUplObservation = {
  observationId: string;
  title: string;
  summary: string;
  detectedAt: string;
  detectedBy: string;
  sourceText?: string;
};

export type BoundaryUplBoundaryDefinition = {
  boundaryId: string;
  title: string;
  crossing: string;
  consequence: string;
};

export type BoundaryUplInvariantDefinition = {
  invariantId: string;
  statement: string;
  allowed: string[];
  denied: string[];
  humanRequired: string[];
  headlessAllowed: string[];
};

export type BoundaryStructuredUplLaw = {
  lawKey: string;
  domain: BoundaryUplDomain;
  capability: string;
  state: BoundaryUplCapabilityState;
  scope: BoundaryUplScope;
  runtime: BoundaryStructuredUplRuntimeCorridor;
  bucketId?: string;
  principal?: string;
  approvedHandles: string[];
  approvedDestinationKinds: BoundarySpendDestinationKind[];
  approvedSourceAuthorityKinds: BoundarySpendSourceAuthorityKind[];
  approvedCommitIntents: BoundarySpendCommitIntent[];
  riskClasses: BoundarySpendRiskClass[];
  amountLimitNormalized?: number;
  periodLimitNormalized?: number;
  periodWindow?: BoundarySpendPeriodWindow;
  recurringPolicy: BoundaryUplRecurringPolicy;
  substitutionPolicy: BoundaryUplSubstitutionPolicy;
  humanConfirmationRule: BoundaryUplHumanConfirmationRule;
  reminderOffsets: BoundaryUplReminderOffset[];
  proofRequirement: BoundaryUplProofRequirement;
  notes?: string;
};

export type BoundaryUplMutation = {
  mutationId: string;
  kind: BoundaryUplMutationKind;
  lawKey: string;
  nextLaw?: BoundaryStructuredUplLaw;
  reason: string;
};

export type BoundaryUplDraft = {
  draftId: string;
  stage: "drafted";
  observation: BoundaryUplObservation;
  boundary: BoundaryUplBoundaryDefinition;
  invariant: BoundaryUplInvariantDefinition;
  draftedAt: string;
  draftedByKind: BoundaryUplDraftActorKind;
  draftedBy: string;
  mutations: BoundaryUplMutation[];
};

export type BoundaryUplLawDelta = {
  mutationId: string;
  kind: BoundaryUplMutationKind;
  lawKey: string;
  before: BoundaryStructuredUplLaw | null;
  after: BoundaryStructuredUplLaw | null;
  reason: string;
};

export type BoundaryUplReviewPacket = {
  reviewId: string;
  stage: "reviewed";
  draft: BoundaryUplDraft;
  reviewedAt: string;
  beforeLaws: BoundaryStructuredUplLaw[];
  afterLaws: BoundaryStructuredUplLaw[];
  deltas: BoundaryUplLawDelta[];
  candidateFingerprint: string;
};

export type BoundaryUplApproval = {
  approvalId: string;
  actorKind: BoundaryUplApprovalActorKind;
  actorId: string;
  approvedAt: string;
  reviewId: string;
  candidateFingerprint: string;
};

export type BoundaryApprovedUplReview = {
  stage: "human_approved";
  review: BoundaryUplReviewPacket;
  approval: BoundaryUplApproval;
};

export type BoundaryCompiledUplState = {
  versionId: string;
  stage: "compiled" | "active";
  compiledAt: string;
  activatedAt?: string;
  sourceDraftId: string;
  sourceReviewId: string;
  sourceApprovalId: string;
  fingerprint: string;
  activeLaws: BoundaryStructuredUplLaw[];
  syncTargets: BoundaryUplSyncTarget[];
};

function normalizeUniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function normalizeUniqueList<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort() as T[];
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function stableLawFingerprint(law: BoundaryStructuredUplLaw): string {
  return stableHash(law);
}

function cloneLaw(law: BoundaryStructuredUplLaw): BoundaryStructuredUplLaw {
  return {
    ...law,
    runtime: {
      ...law.runtime,
      actionKinds: [...law.runtime.actionKinds],
      ...(law.runtime.targetPatterns ? { targetPatterns: [...law.runtime.targetPatterns] } : {}),
    },
    approvedHandles: [...law.approvedHandles],
    approvedDestinationKinds: [...law.approvedDestinationKinds],
    approvedSourceAuthorityKinds: [...law.approvedSourceAuthorityKinds],
    approvedCommitIntents: [...law.approvedCommitIntents],
    riskClasses: [...law.riskClasses],
    reminderOffsets: [...law.reminderOffsets],
  };
}

function validateLaw(law: BoundaryStructuredUplLaw): void {
  if (!law.lawKey.trim()) {
    throw new Error("UPL law requires non-empty lawKey");
  }
  if (!law.capability.trim()) {
    throw new Error(`UPL law ${law.lawKey} requires non-empty capability`);
  }
  if (law.amountLimitNormalized !== undefined && law.amountLimitNormalized < 0) {
    throw new Error(`UPL law ${law.lawKey} amountLimitNormalized must be >= 0`);
  }
  if (law.periodLimitNormalized !== undefined && law.periodLimitNormalized < 0) {
    throw new Error(`UPL law ${law.lawKey} periodLimitNormalized must be >= 0`);
  }
  if (law.periodLimitNormalized !== undefined && !law.periodWindow) {
    throw new Error(`UPL law ${law.lawKey} requires periodWindow when periodLimitNormalized is set`);
  }
  if (law.runtime.actionKinds.length === 0) {
    throw new Error(`UPL law ${law.lawKey} requires at least one runtime action kind`);
  }
  if (!law.runtime.primaryTarget.trim()) {
    throw new Error(`UPL law ${law.lawKey} requires non-empty runtime primaryTarget`);
  }
}

function normalizeLaw(law: BoundaryStructuredUplLaw): BoundaryStructuredUplLaw {
  const normalized: BoundaryStructuredUplLaw = {
    ...law,
    lawKey: law.lawKey.trim(),
    capability: law.capability.trim(),
    runtime: {
      ...law.runtime,
      primaryTarget: law.runtime.primaryTarget.trim(),
      actionKinds: normalizeUniqueList(law.runtime.actionKinds),
      ...(law.runtime.targetPatterns
        ? { targetPatterns: normalizeUniqueStrings(law.runtime.targetPatterns) }
        : {}),
    },
    approvedHandles: normalizeUniqueStrings(law.approvedHandles),
    approvedDestinationKinds: normalizeUniqueList(law.approvedDestinationKinds),
    approvedSourceAuthorityKinds: normalizeUniqueList(law.approvedSourceAuthorityKinds),
    approvedCommitIntents: normalizeUniqueList(law.approvedCommitIntents),
    riskClasses: normalizeUniqueList(law.riskClasses),
    reminderOffsets: normalizeUniqueList(law.reminderOffsets),
    ...(law.bucketId ? { bucketId: law.bucketId.trim() } : {}),
    ...(law.principal ? { principal: law.principal.trim() } : {}),
    ...(law.notes ? { notes: law.notes.trim() } : {}),
  };
  validateLaw(normalized);
  return normalized;
}

function normalizeMutation(mutation: BoundaryUplMutation): BoundaryUplMutation {
  const normalized: BoundaryUplMutation = {
    ...mutation,
    lawKey: mutation.lawKey.trim(),
    reason: mutation.reason.trim(),
  };
  if (!normalized.lawKey) {
    throw new Error("UPL mutation requires non-empty lawKey");
  }
  if (!normalized.reason) {
    throw new Error(`UPL mutation ${normalized.mutationId} requires non-empty reason`);
  }
  switch (normalized.kind) {
    case "add":
    case "narrow":
    case "widen":
    case "replace":
    case "restore":
      if (!normalized.nextLaw) {
        throw new Error(`UPL mutation ${normalized.mutationId} requires nextLaw for ${normalized.kind}`);
      }
      break;
    case "suspend":
    case "delete":
      break;
  }
  return {
    ...normalized,
    ...(normalized.nextLaw ? { nextLaw: normalizeLaw(normalized.nextLaw) } : {}),
  };
}

function asLawMap(laws: readonly BoundaryStructuredUplLaw[]): Map<string, BoundaryStructuredUplLaw> {
  const map = new Map<string, BoundaryStructuredUplLaw>();
  for (const law of laws) {
    const normalized = normalizeLaw(law);
    map.set(normalized.lawKey, normalized);
  }
  return map;
}

function sortedLaws(map: Map<string, BoundaryStructuredUplLaw>): BoundaryStructuredUplLaw[] {
  return [...map.values()].map(cloneLaw).sort((left, right) => left.lawKey.localeCompare(right.lawKey));
}

function applyMutationSet(args: {
  currentLaws: readonly BoundaryStructuredUplLaw[];
  mutations: readonly BoundaryUplMutation[];
}): BoundaryUplLawDelta[] {
  const working = asLawMap(args.currentLaws);
  const deltas: BoundaryUplLawDelta[] = [];
  for (const rawMutation of args.mutations) {
    const mutation = normalizeMutation(rawMutation);
    const before = working.get(mutation.lawKey) ?? null;
    const after = mutation.nextLaw ? normalizeLaw(mutation.nextLaw) : null;
    switch (mutation.kind) {
      case "add":
      case "restore":
      case "replace":
      case "narrow":
      case "widen":
        if (!after) {
          throw new Error(`UPL mutation ${mutation.mutationId} requires nextLaw`);
        }
        working.set(mutation.lawKey, after);
        break;
      case "suspend":
      case "delete":
        working.delete(mutation.lawKey);
        break;
    }
    deltas.push({
      mutationId: mutation.mutationId,
      kind: mutation.kind,
      lawKey: mutation.lawKey,
      before: before ? cloneLaw(before) : null,
      after: after ? cloneLaw(after) : null,
      reason: mutation.reason,
    });
  }
  return deltas;
}

export function createStructuredUplLaw(law: BoundaryStructuredUplLaw): BoundaryStructuredUplLaw {
  return normalizeLaw(law);
}

function buildRequestBasisFromStructuredLaw(law: BoundaryStructuredUplLaw): BoundaryUplRequestBasis {
  const reviewContext = law.runtime.reviewSurface
    ? {
      surface: law.runtime.reviewSurface,
      invariantLawId: law.runtime.reviewInvariantLawId,
      title: law.lawKey,
      question: law.capability,
    }
    : undefined;
  const actionKind = law.runtime.actionKinds[0];
  return {
    actionKind,
    target: law.runtime.primaryTarget,
    payloadSummary: `${law.domain}:${law.capability}:${law.state}`,
    provenance: law.runtime.provenance ?? "trusted_user",
    ...(reviewContext ? { reviewContext } : {}),
    ...(law.domain === "spend" || actionKind === "agent.spend"
      ? {
        spendIntent: {
          amountRaw: String(law.amountLimitNormalized ?? law.periodLimitNormalized ?? 0),
          amountNormalized: law.amountLimitNormalized ?? law.periodLimitNormalized ?? 0,
          destination: law.runtime.primaryTarget,
          destinationKind: law.approvedDestinationKinds[0] ?? "other",
          sourceAuthorityKind: law.approvedSourceAuthorityKinds[0] ?? "other",
          commitIntent: law.approvedCommitIntents[0] ?? "purchase",
          principal: law.principal ?? "unspecified_principal",
          purpose: law.capability,
          bucketId: law.bucketId ?? "default",
          termsSummary: law.notes ?? `${law.capability} structured UPL law`,
          recurring: law.recurringPolicy === "allow",
          riskClass: law.riskClasses[0] ?? "medium",
          accountabilityRef: `upl:${law.lawKey}`,
          instructionSource: law.runtime.provenance,
          periodCapNormalized: law.periodLimitNormalized,
          periodWindow: law.periodWindow,
          merchantHint: law.approvedHandles[0],
        },
      }
      : {}),
  };
}

function buildTrackConstraintFromStructuredLaw(law: BoundaryStructuredUplLaw): BoundaryUplTrackConstraint {
  return {
    allowedActionKinds: [...law.runtime.actionKinds],
    targetPattern: law.runtime.primaryTarget,
    ...(law.runtime.targetPatterns?.length ? { targetPatterns: [...law.runtime.targetPatterns] } : {}),
    targetMatchMode: law.runtime.targetMatchMode ?? "exact",
    ...(law.runtime.reviewSurface ? { reviewSurface: law.runtime.reviewSurface } : {}),
    ...(law.runtime.reviewInvariantLawId ? { reviewInvariantLawId: law.runtime.reviewInvariantLawId } : {}),
    ...(law.amountLimitNormalized !== undefined ? { spendMaxAmountNormalized: law.amountLimitNormalized } : {}),
    ...(law.approvedDestinationKinds.length ? { spendAllowedDestinationKinds: [...law.approvedDestinationKinds] } : {}),
    ...(law.approvedSourceAuthorityKinds.length ? { spendAllowedSourceAuthorityKinds: [...law.approvedSourceAuthorityKinds] } : {}),
    ...(law.approvedCommitIntents.length ? { spendAllowedCommitIntents: [...law.approvedCommitIntents] } : {}),
    ...(law.principal ? { spendAllowedPrincipals: [law.principal] } : {}),
    ...(law.capability ? { spendAllowedPurposes: [law.capability] } : {}),
    ...(law.bucketId ? { spendAllowedBucketIds: [law.bucketId] } : {}),
    ...(law.riskClasses.length ? { spendAllowedRiskClasses: [...law.riskClasses] } : {}),
    ...(law.recurringPolicy !== "ask" ? { spendRecurringAllowed: law.recurringPolicy === "allow" } : {}),
    ...(law.periodLimitNormalized !== undefined
      ? { spendMaxPeriodAmountNormalized: law.periodLimitNormalized }
      : {}),
    ...(law.periodWindow ? { spendPeriodWindow: law.periodWindow } : {}),
    description: `${law.domain}:${law.capability}:${law.state}`,
  };
}

export function compileStructuredUplLawToDocumentLaw(law: BoundaryStructuredUplLaw): CompiledDocumentLaw {
  const normalized = normalizeLaw(law);
  if (normalized.state === "ask") {
    throw new Error(
      `UPL law ${normalized.lawKey} is state=ask. The live UPL field is still two-lane (approved/denied), so ask cannot activate until the runtime grows a third lane.`,
    );
  }
  return {
    type: normalized.state === "deny" ? "DENIED" : "APPROVED",
    scope: normalized.scope,
    notes: normalized.notes ?? `${normalized.domain}:${normalized.capability}:${normalized.state}`,
    requestBasis: buildRequestBasisFromStructuredLaw(normalized),
    trackConstraint: buildTrackConstraintFromStructuredLaw(normalized),
  };
}

export function compileStructuredUplStateToDocumentLaws(state: BoundaryCompiledUplState): CompiledDocumentLaw[] {
  return state.activeLaws.map((law) => compileStructuredUplLawToDocumentLaw(law));
}

export function draftBoundaryUplProcess(args: {
  observation: Omit<BoundaryUplObservation, "observationId"> & { observationId?: string };
  boundary: Omit<BoundaryUplBoundaryDefinition, "boundaryId"> & { boundaryId?: string };
  invariant: Omit<BoundaryUplInvariantDefinition, "invariantId"> & { invariantId?: string };
  draftedByKind: BoundaryUplDraftActorKind;
  draftedBy: string;
  mutations: Array<Omit<BoundaryUplMutation, "mutationId"> & { mutationId?: string }>;
}): BoundaryUplDraft {
  return {
    draftId: randomUUID(),
    stage: "drafted",
    observation: {
      observationId: args.observation.observationId ?? randomUUID(),
      ...args.observation,
    },
    boundary: {
      boundaryId: args.boundary.boundaryId ?? randomUUID(),
      ...args.boundary,
    },
    invariant: {
      invariantId: args.invariant.invariantId ?? randomUUID(),
      ...args.invariant,
    },
    draftedAt: new Date().toISOString(),
    draftedByKind: args.draftedByKind,
    draftedBy: args.draftedBy.trim(),
    mutations: args.mutations.map((mutation) => normalizeMutation({
      ...mutation,
      mutationId: mutation.mutationId ?? randomUUID(),
    })),
  };
}

export function reviewBoundaryUplDraft(args: {
  currentLaws: readonly BoundaryStructuredUplLaw[];
  draft: BoundaryUplDraft;
}): BoundaryUplReviewPacket {
  const beforeLaws = sortedLaws(asLawMap(args.currentLaws));
  const deltas = applyMutationSet({
    currentLaws: beforeLaws,
    mutations: args.draft.mutations,
  });
  const afterMap = asLawMap(beforeLaws);
  for (const delta of deltas) {
    if (delta.after) {
      afterMap.set(delta.lawKey, delta.after);
    } else {
      afterMap.delete(delta.lawKey);
    }
  }
  const afterLaws = sortedLaws(afterMap);
  return {
    reviewId: randomUUID(),
    stage: "reviewed",
    draft: args.draft,
    reviewedAt: new Date().toISOString(),
    beforeLaws,
    afterLaws,
    deltas,
    candidateFingerprint: stableHash(afterLaws.map(stableLawFingerprint)),
  };
}

export function approveBoundaryUplReview(args: {
  review: BoundaryUplReviewPacket;
  actorId: string;
}): BoundaryApprovedUplReview {
  return {
    stage: "human_approved",
    review: args.review,
    approval: {
      approvalId: randomUUID(),
      actorKind: "human",
      actorId: args.actorId.trim(),
      approvedAt: new Date().toISOString(),
      reviewId: args.review.reviewId,
      candidateFingerprint: args.review.candidateFingerprint,
    },
  };
}

export function compileApprovedBoundaryUplReview(args: {
  approved: BoundaryApprovedUplReview;
  syncTargets?: BoundaryUplSyncTarget[];
}): BoundaryCompiledUplState {
  if (args.approved.approval.actorKind !== "human") {
    throw new Error("only human approval may compile live UPL state");
  }
  if (args.approved.approval.candidateFingerprint !== args.approved.review.candidateFingerprint) {
    throw new Error("UPL approval fingerprint does not match reviewed law delta");
  }
  return {
    versionId: randomUUID(),
    stage: "compiled",
    compiledAt: new Date().toISOString(),
    sourceDraftId: args.approved.review.draft.draftId,
    sourceReviewId: args.approved.review.reviewId,
    sourceApprovalId: args.approved.approval.approvalId,
    fingerprint: args.approved.review.candidateFingerprint,
    activeLaws: args.approved.review.afterLaws.map(cloneLaw),
    syncTargets: normalizeUniqueList(args.syncTargets ?? ["buccet"]),
  };
}

export function activateCompiledBoundaryUplState(args: {
  compiled: BoundaryCompiledUplState;
  syncTargets?: BoundaryUplSyncTarget[];
}): BoundaryCompiledUplState {
  return {
    ...args.compiled,
    stage: "active",
    activatedAt: new Date().toISOString(),
    syncTargets: normalizeUniqueList(args.syncTargets ?? args.compiled.syncTargets),
  };
}

export async function writeApprovedBoundaryUplReviewToLedger(args: {
  ledger: BoundaryUserPathLedger;
  approved: BoundaryApprovedUplReview;
  witness: BoundaryLedgerRecord;
  session: BoundarySession;
}): Promise<BoundaryUserPathLedger> {
  const compiled = compileApprovedBoundaryUplReview({
    approved: args.approved,
  });
  return writeCompiledUserPathLaws({
    ledger: args.ledger,
    compiledLaws: compileStructuredUplStateToDocumentLaws(compiled).map((compiledLaw) => ({
      compiledLaw,
      witness: args.witness,
    })),
    session: args.session,
    authority: {
      authorityKind: "human_approved",
      actorKind: "human",
      actorId: args.approved.approval.actorId,
      reason: "human approved structured UPL review for activation",
      approvalRef: args.approved.approval.approvalId,
    },
  });
}
