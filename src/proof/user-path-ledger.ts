import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBaseHeadlessDenialLedger } from "./../law/headless-base-denials.ts";
import { stableBoundaryNoveltyDescriptor } from "./../runtime/novelty.ts";
import type {
  BoundaryActiveUplWriteAuthority,
  BoundaryActionRequest,
  BoundaryApprovalDecision,
  CompiledDocumentLaw,
  BoundaryLedgerRecord,
  BoundaryRequestProvenance,
  BoundarySession,
  BoundaryUplEntry,
  BoundaryUplRequestBasis,
  BoundaryUplScope,
  BoundaryUplStatus,
  BoundaryUserPathLedger,
} from "./../runtime/types.ts";
import { buildAutoTrackConstraint, checkTrackConstraint, isTrackSurface } from "./../law/upl-tracks.ts";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const UPL_RELATIVE_PATH = path.join("data", "agent-buccet-law-foundation", "user-path-ledger.json");
export const SESSION_UPL_ENTRY_ID_PREFIX = "UPL-SESSION-";

function getDefaultLedger(): BoundaryUserPathLedger {
  return createBaseHeadlessDenialLedger();
}

export function createEmptyUserPathLedger(): BoundaryUserPathLedger {
  return {
    specVersion: 1,
    userApprovedLawPaths: [],
    userDeniedLawPaths: [],
  };
}

function stablePathDescriptor(request: BoundaryActionRequest) {
  return {
    actionKind: request.actionKind,
    target: request.target,
    payloadSummary: request.payloadSummary ?? null,
    spendIntent: request.spendIntent ?? null,
    authorityClaimed: request.flags?.authorityClaimed ?? false,
    claimsCompleteCoverage: request.flags?.claimsCompleteCoverage ?? false,
    requestsScopeExpansion: request.flags?.requestsScopeExpansion ?? false,
    requestsLawMutation: request.flags?.requestsLawMutation ?? false,
    requestsSessionRevival: request.flags?.requestsSessionRevival ?? false,
    requestsLedgerBypass: request.flags?.requestsLedgerBypass ?? false,
    violatesUserConstraint: request.flags?.violatesUserConstraint ?? false,
    groundingMismatch: request.flags?.groundingMismatch ?? false,
    claimsActionCompletionWithoutWitness: request.flags?.claimsActionCompletionWithoutWitness ?? false,
    claimsUserApproval: request.flags?.claimsUserApproval ?? false,
    noveltyDetected: request.flags?.noveltyDetected ?? false,
    noveltySelfOriginated: request.flags?.noveltySelfOriginated ?? false,
    novelty: stableBoundaryNoveltyDescriptor(request.novelty),
    reviewSurface: request.reviewContext?.surface ?? null,
    reviewInvariantLawId: request.reviewContext?.invariantLawId ?? null,
  };
}

function toRequestBasis(request: BoundaryActionRequest): BoundaryUplRequestBasis {
  return {
    actionKind: request.actionKind,
    target: request.target,
    payloadSummary: request.payloadSummary,
    spendIntent: request.spendIntent,
    provenance: request.provenance,
    novelty: request.novelty,
    flags: request.flags,
    reviewContext: request.reviewContext,
  };
}

function requestFromBasis(
  basis: BoundaryUplRequestBasis,
  sessionId: string,
): BoundaryActionRequest {
  return {
    requestId: "upl-basis-materialize",
    sessionId,
    actionKind: basis.actionKind,
    target: basis.target,
    payloadSummary: basis.payloadSummary,
    spendIntent: basis.spendIntent,
    requestedAt: new Date(0).toISOString(),
    provenance: basis.provenance ?? "agent_inference",
    novelty: basis.novelty,
    flags: basis.flags,
    reviewContext: basis.reviewContext,
  };
}

export function materializeBoundaryActionRequestFromUplEntry(args: {
  entry: BoundaryUplEntry;
  session: BoundarySession;
  provenance?: BoundaryRequestProvenance;
  requestId?: string;
  requestedAt?: string;
}): BoundaryActionRequest | null {
  if (!args.entry.requestBasis) {
    return null;
  }
  const materialized = requestFromBasis(args.entry.requestBasis, args.session.sessionId);
  return {
    ...materialized,
    requestId: args.requestId ?? materialized.requestId,
    requestedAt: args.requestedAt ?? new Date().toISOString(),
    provenance: args.provenance ?? args.entry.requestBasis.provenance ?? materialized.provenance,
  };
}

export function describeUserPath(request: BoundaryActionRequest): string {
  return `${request.actionKind} ${request.target}${request.payloadSummary ? ` :: ${request.payloadSummary}` : ""}`;
}

export function hashUserPath(request: BoundaryActionRequest): string {
  return createHash("sha256").update(JSON.stringify(stablePathDescriptor(request))).digest("hex");
}

export function classifyUserPathDomain(request: BoundaryActionRequest): string {
  if (request.actionKind === "agent.spend") {
    return "SPEND";
  }
  const [domain] = request.actionKind.split(".");
  return domain.toUpperCase();
}

async function resolveUserPathLedgerPath(): Promise<string> {
  const explicitPath = process.env.AGENT_BUCCET_UPL_LEDGER_PATH?.trim();
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    return resolved;
  }

  const candidates = [
    path.join(moduleDir, "../../../", UPL_RELATIVE_PATH),
    path.join(moduleDir, "../", UPL_RELATIVE_PATH),
    path.join(process.cwd(), UPL_RELATIVE_PATH),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  const fallback = path.join(process.cwd(), UPL_RELATIVE_PATH);
  await fs.mkdir(path.dirname(fallback), { recursive: true });
  return fallback;
}

async function writeLedger(ledger: BoundaryUserPathLedger): Promise<void> {
  const ledgerPath = await resolveUserPathLedgerPath();
  await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
  // Atomic write: write to a temp file then rename so a mid-write crash cannot
  // corrupt or zero the standing law ledger. PID + timestamp prevents collisions
  // if multiple processes write concurrently.
  const tempPath = `${ledgerPath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, ledgerPath);
}

function normalizeEntry(rawEntry: BoundaryUplEntry): BoundaryUplEntry {
  let entry = {
    ...(rawEntry as BoundaryUplEntry & { lineage?: BoundaryUplEntry["sourceTrack"] }),
  };
  if (!entry.sourceTrack && entry.lineage) {
    const { lineage, ...rest } = entry;
    entry = {
      ...rest,
      sourceTrack: lineage,
    };
  }
  if (!entry.requestBasis) {
    return entry;
  }

  const basisRequest = requestFromBasis(entry.requestBasis, entry.sessionId ?? "upl-materialize");
  if (!entry.path) {
    entry = {
      ...entry,
      path: describeUserPath(basisRequest),
    };
  }
  if (!entry.pathHash) {
    entry = {
      ...entry,
      pathHash: hashUserPath(basisRequest),
    };
  }
  if (entry.scope === "DOMAIN" && !entry.domain) {
    entry = {
      ...entry,
      domain: classifyUserPathDomain(basisRequest),
    };
  }
  if (!entry.trackConstraint && isTrackSurface(basisRequest.actionKind)) {
    const trackConstraint = buildAutoTrackConstraint(basisRequest);
    if (trackConstraint) {
      entry = {
        ...entry,
        trackConstraint,
      };
    }
  }
  return entry;
}

function normalizeLedger(ledger: BoundaryUserPathLedger): BoundaryUserPathLedger {
  return {
    ...ledger,
    userApprovedLawPaths: ledger.userApprovedLawPaths.map(normalizeEntry),
    userDeniedLawPaths: ledger.userDeniedLawPaths.map(normalizeEntry),
  };
}

function entryFingerprint(entry: BoundaryUplEntry): string {
  return JSON.stringify(normalizeEntry(entry));
}

function stripBuiltInHeadlessDenialSeed(ledger: BoundaryUserPathLedger): BoundaryUserPathLedger {
  const normalized = normalizeLedger(ledger);
  const baseDeniedEntries = getDefaultLedger().userDeniedLawPaths;
  const baseDeniedFingerprints = new Map(
    baseDeniedEntries.map((entry) => [entry.id, entryFingerprint(entry)]),
  );

  return {
    ...normalized,
    userDeniedLawPaths: normalized.userDeniedLawPaths.filter((entry) => {
      const baseFingerprint = baseDeniedFingerprints.get(entry.id);
      if (!baseFingerprint) {
        return true;
      }
      return entryFingerprint(entry) !== baseFingerprint;
    }),
  };
}

function composeRuntimeLedger(overlayLedger: BoundaryUserPathLedger): BoundaryUserPathLedger {
  return mergeUserPathLedgers({
    baseLedger: getDefaultLedger(),
    overlayLedger,
  });
}

function assertActiveUplWriteAuthority(authority: BoundaryActiveUplWriteAuthority): void {
  if (!authority.actorId.trim()) {
    throw new Error("active UPL write requires non-empty actorId");
  }
  if (!authority.reason.trim()) {
    throw new Error("active UPL write requires non-empty reason");
  }
  switch (authority.authorityKind) {
    case "human_approved":
      if (authority.actorKind !== "human") {
        throw new Error("human_approved active UPL write requires actorKind=human");
      }
      if (!authority.approvalRef?.trim()) {
        throw new Error("human_approved active UPL write requires approvalRef");
      }
      return;
    case "trusted_system_sync":
    case "base_seed":
      if (authority.actorKind !== "system") {
        throw new Error(`${authority.authorityKind} active UPL write requires actorKind=system`);
      }
      return;
  }
}

export function mergeUserPathLedgers(args: {
  baseLedger: BoundaryUserPathLedger;
  overlayLedger?: BoundaryUserPathLedger | null;
}): BoundaryUserPathLedger {
  if (!args.overlayLedger) {
    return normalizeLedger(args.baseLedger);
  }

  const approvedById = new Map(args.baseLedger.userApprovedLawPaths.map((entry) => [entry.id, entry]));
  const deniedById = new Map(args.baseLedger.userDeniedLawPaths.map((entry) => [entry.id, entry]));

  for (const entry of args.overlayLedger.userApprovedLawPaths) {
    approvedById.set(entry.id, entry);
  }
  for (const entry of args.overlayLedger.userDeniedLawPaths) {
    deniedById.set(entry.id, entry);
  }

  return normalizeLedger({
    ...args.baseLedger,
    userApprovedLawPaths: [...approvedById.values()],
    userDeniedLawPaths: [...deniedById.values()],
  });
}

export function extractSessionScopedUserPathLedger(args: {
  ledger: BoundaryUserPathLedger;
  sessionId: string;
}): BoundaryUserPathLedger {
  return normalizeLedger({
    ...createEmptyUserPathLedger(),
    userApprovedLawPaths: args.ledger.userApprovedLawPaths.filter((entry) =>
      entry.scope === "SESSION" && entry.sessionId === args.sessionId
    ),
    userDeniedLawPaths: args.ledger.userDeniedLawPaths.filter((entry) =>
      entry.scope === "SESSION" && entry.sessionId === args.sessionId
    ),
  });
}

export function isSessionScopedUserPathLedger(args: {
  ledger: BoundaryUserPathLedger;
  sessionId: string;
}): boolean {
  return listUserPathEntries(args.ledger).every((entry) =>
    entry.scope === "SESSION" && entry.sessionId === args.sessionId
  );
}

export function hasUserPathEntries(ledger: BoundaryUserPathLedger): boolean {
  return ledger.userApprovedLawPaths.length > 0 || ledger.userDeniedLawPaths.length > 0;
}

export function isSessionOverlayEntryId(entryId: string): boolean {
  return entryId.startsWith(SESSION_UPL_ENTRY_ID_PREFIX);
}

export async function loadUserPathLedger(): Promise<BoundaryUserPathLedger> {
  const ledgerPath = await resolveUserPathLedgerPath();
  try {
    const raw = await fs.readFile(ledgerPath, "utf8");
    const parsed = JSON.parse(raw) as BoundaryUserPathLedger;
    const overlay = stripBuiltInHeadlessDenialSeed(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(overlay)) {
      await writeLedger(overlay);
    }
    return composeRuntimeLedger(overlay);
  } catch {
    const overlay = createEmptyUserPathLedger();
    await writeLedger(overlay);
    return composeRuntimeLedger(overlay);
  }
}

export async function saveUserPathLedger(ledger: BoundaryUserPathLedger): Promise<BoundaryUserPathLedger> {
  const overlay = stripBuiltInHeadlessDenialSeed(ledger);
  await writeLedger(overlay);
  return composeRuntimeLedger(overlay);
}

export function listUserPathEntries(ledger: BoundaryUserPathLedger): BoundaryUplEntry[] {
  return [...ledger.userApprovedLawPaths, ...ledger.userDeniedLawPaths];
}

export function findUserPathEntryById(
  ledger: BoundaryUserPathLedger,
  entryId: string,
): BoundaryUplEntry | null {
  return listUserPathEntries(ledger).find((entry) => entry.id === entryId) ?? null;
}

export function updateUserPathEntryStatuses(args: {
  ledger: BoundaryUserPathLedger;
  ids: string[];
  status: BoundaryUplStatus;
  modifiedAt: string;
}): {
  ledger: BoundaryUserPathLedger;
  changed: BoundaryUplEntry[];
  unchanged: BoundaryUplEntry[];
  missing: string[];
} {
  const wanted = new Set(args.ids);
  const changed: BoundaryUplEntry[] = [];
  const unchanged: BoundaryUplEntry[] = [];
  const seen = new Set<string>();

  const update = (entry: BoundaryUplEntry): BoundaryUplEntry => {
    if (!wanted.has(entry.id)) {
      return entry;
    }
    seen.add(entry.id);
    if (entry.status === args.status || (entry.status === "DELETED" && args.status !== "DELETED")) {
      unchanged.push(entry);
      return entry;
    }
    const next = {
      ...entry,
      status: args.status,
      modifiedAt: args.modifiedAt,
    };
    changed.push(next);
    return next;
  };

  const nextLedger = {
    ...args.ledger,
    userApprovedLawPaths: args.ledger.userApprovedLawPaths.map(update),
    userDeniedLawPaths: args.ledger.userDeniedLawPaths.map(update),
  };

  return {
    ledger: nextLedger,
    changed,
    unchanged,
    missing: args.ids.filter((id) => !seen.has(id)),
  };
}

function makeEntryId(ledger: BoundaryUserPathLedger): string {
  const total = ledger.userApprovedLawPaths.length + ledger.userDeniedLawPaths.length + 1;
  return `UPL-${String(total).padStart(6, "0")}`;
}

function isEntryActiveForSession(entry: BoundaryUplEntry, session: BoundarySession): boolean {
  if (entry.status !== "ACTIVE") {
    return false;
  }
  if (entry.scope === "SESSION") {
    return entry.sessionId === session.sessionId;
  }
  return true;
}

export type BoundaryLiveUplFieldEntry = {
  entry: BoundaryUplEntry;
  polarity: "allow" | "deny";
  specificity: 0 | 1 | 2;
  trafficClass: "allow_rail" | "deny_wall";
  trafficTag: string;
};

export function uplTrafficClassForPolarity(
  polarity: "allow" | "deny",
): "allow_rail" | "deny_wall" {
  return polarity === "allow" ? "allow_rail" : "deny_wall";
}

export function makeBoundaryUplTrafficTag(args: {
  entry: BoundaryUplEntry;
  polarity: "allow" | "deny";
}): string {
  const prefix = args.polarity === "allow" ? "UPL.TRAFFIC.RAIL" : "UPL.TRAFFIC.WALL";
  const digest = createHash("sha256")
    .update(JSON.stringify({
      polarity: args.polarity,
      id: args.entry.id,
      pathHash: args.entry.pathHash,
      scope: args.entry.scope,
      sessionId: args.entry.sessionId ?? null,
      domain: args.entry.domain ?? null,
    }))
    .digest("hex");
  return `${prefix}:sha256:${digest}`;
}

export function resolveBoundaryUplTrafficPolarity(
  segment: BoundaryLiveUplFieldEntry,
): "allow" | "deny" | null {
  const expectedClass = uplTrafficClassForPolarity(segment.polarity);
  if (segment.trafficClass !== expectedClass) {
    return null;
  }
  const expectedTag = makeBoundaryUplTrafficTag({
    entry: segment.entry,
    polarity: segment.polarity,
  });
  if (segment.trafficTag !== expectedTag) {
    return null;
  }
  return segment.polarity;
}

function entrySpecificity(entry: BoundaryUplEntry): 0 | 1 | 2 {
  if (entry.scope === "SESSION") return 2;
  if (entry.scope === "DOMAIN") return 1;
  return 0;
}

function trackConstraintSpecificity(entry: BoundaryUplEntry): number {
  const constraint = entry.trackConstraint;
  if (!constraint) {
    return 0;
  }

  let score = 0;
  if (constraint.targetPattern) score += 1;
  if (constraint.targetPatterns?.length) score += constraint.targetPatterns.length;
  if (constraint.requestTextPatterns?.length) score += constraint.requestTextPatterns.length;
  if (constraint.requiredFlags?.length) score += constraint.requiredFlags.length;
  if (constraint.reviewSurface) score += 1;
  if (constraint.reviewInvariantLawId) score += 1;
  if (constraint.requiredTextPatterns?.length) score += constraint.requiredTextPatterns.length;
  if (constraint.forbiddenTextPatterns?.length) score += constraint.forbiddenTextPatterns.length;
  if (constraint.outputShape) score += 1;
  if (constraint.outputCorridor?.requiredTextPatterns?.length) score += constraint.outputCorridor.requiredTextPatterns.length;
  if (constraint.outputCorridor?.forbiddenTextPatterns?.length) score += constraint.outputCorridor.forbiddenTextPatterns.length;
  if (constraint.completionGrammar) score += 1;
  if (constraint.completionCorridor?.grammar) score += 1;
  if (constraint.expressionProfile) score += 1;
  if (constraint.expressionCorridor) score += 1;
  if (constraint.actionCorridor?.targetPattern) score += 1;
  if (constraint.actionCorridor?.reviewSurface) score += 1;
  if (constraint.spendMaxAmountNormalized !== undefined) score += 1;
  if (constraint.spendAllowedDestinationKinds?.length) score += constraint.spendAllowedDestinationKinds.length;
  if (constraint.spendAllowedSourceAuthorityKinds?.length) score += constraint.spendAllowedSourceAuthorityKinds.length;
  if (constraint.spendAllowedCommitIntents?.length) score += constraint.spendAllowedCommitIntents.length;
  if (constraint.spendAllowedPrincipals?.length) score += constraint.spendAllowedPrincipals.length;
  if (constraint.spendAllowedPurposes?.length) score += constraint.spendAllowedPurposes.length;
  if (constraint.spendAllowedBucketIds?.length) score += constraint.spendAllowedBucketIds.length;
  if (constraint.spendAllowedRiskClasses?.length) score += constraint.spendAllowedRiskClasses.length;
  if (constraint.spendRecurringAllowed !== undefined) score += 1;
  if (constraint.spendMaxPeriodAmountNormalized !== undefined) score += 1;
  if (constraint.spendPeriodWindow !== undefined) score += 1;
  return score;
}

function compareLiveUplFieldEntries(
  left: BoundaryLiveUplFieldEntry,
  right: BoundaryLiveUplFieldEntry,
): number {
  if (left.polarity !== right.polarity) {
    return left.polarity === "deny" ? -1 : 1;
  }
  if (right.specificity !== left.specificity) {
    return right.specificity - left.specificity;
  }
  const leftTrackSpecificity = trackConstraintSpecificity(left.entry);
  const rightTrackSpecificity = trackConstraintSpecificity(right.entry);
  if (rightTrackSpecificity !== leftTrackSpecificity) {
    return rightTrackSpecificity - leftTrackSpecificity;
  }
  if (left.entry.createdAt !== right.entry.createdAt) {
    return right.entry.createdAt.localeCompare(left.entry.createdAt);
  }
  return left.entry.id.localeCompare(right.entry.id);
}

/**
 * Human authoring stays split into approved and denied UPL lists so the user can
 * inspect and customize both sides directly. Runtime does not keep that split.
 * Buccet compiles the active laws into one live field and evaluates motion
 * against that field.
 */
export function compileLiveUplField(args: {
  ledger: BoundaryUserPathLedger;
  session: BoundarySession;
}): BoundaryLiveUplFieldEntry[] {
  const field: BoundaryLiveUplFieldEntry[] = [];

  for (const entry of args.ledger.userApprovedLawPaths) {
    if (!isEntryActiveForSession(entry, args.session)) continue;
    field.push({
      entry,
      polarity: "allow",
      specificity: entrySpecificity(entry),
      trafficClass: uplTrafficClassForPolarity("allow"),
      trafficTag: makeBoundaryUplTrafficTag({ entry, polarity: "allow" }),
    });
  }

  for (const entry of args.ledger.userDeniedLawPaths) {
    if (!isEntryActiveForSession(entry, args.session)) continue;
    field.push({
      entry,
      polarity: "deny",
      specificity: entrySpecificity(entry),
      trafficClass: uplTrafficClassForPolarity("deny"),
      trafficTag: makeBoundaryUplTrafficTag({ entry, polarity: "deny" }),
    });
  }

  field.sort(compareLiveUplFieldEntries);
  return field;
}

export function compileLiveUplTrackField(args: {
  ledger: BoundaryUserPathLedger;
  session: BoundarySession;
}): BoundaryLiveUplFieldEntry[] {
  return compileLiveUplField(args).filter((segment) => Boolean(segment.entry.trackConstraint));
}

function entryMatchesScope(args: {
  entry: BoundaryUplEntry;
  request: BoundaryActionRequest;
  session: BoundarySession;
  scope: BoundaryUplScope;
  domain: string;
}): boolean {
  if (args.entry.scope !== args.scope) {
    return false;
  }
  if (args.scope === "SESSION") {
    return args.entry.sessionId === args.session.sessionId && args.entry.pathHash === hashUserPath(args.request);
  }
  if (args.scope === "DOMAIN") {
    return args.entry.domain === args.domain;
  }
  return args.entry.pathHash === hashUserPath(args.request);
}

function applyUserLawReplacement(args: {
  ledger: BoundaryUserPathLedger;
  request: BoundaryActionRequest;
  session: BoundarySession;
  scope: BoundaryUplScope;
  modifiedAt: string;
}): BoundaryUserPathLedger {
  const domain = classifyUserPathDomain(args.request);
  const markReplacedByUserLaw = (entry: BoundaryUplEntry): BoundaryUplEntry => {
    if (entry.status !== "ACTIVE") {
      return entry;
    }
    if (!entryMatchesScope({
      entry,
      request: args.request,
      session: args.session,
      scope: args.scope,
      domain,
    })) {
      return entry;
    }
    return {
      ...entry,
      status: "MUTED",
      modifiedAt: args.modifiedAt,
    };
  };

  return {
    ...args.ledger,
    userApprovedLawPaths: args.ledger.userApprovedLawPaths.map(markReplacedByUserLaw),
    userDeniedLawPaths: args.ledger.userDeniedLawPaths.map(markReplacedByUserLaw),
  };
}

export function lookupUserPathDecision(args: {
  ledger: BoundaryUserPathLedger;
  session: BoundarySession;
  request: BoundaryActionRequest;
}): { entry: BoundaryUplEntry; decision: "allow" | "deny" } | null {
  const pathHash = hashUserPath(args.request);
  const domain = classifyUserPathDomain(args.request);
  for (const segment of compileLiveUplField({
    ledger: args.ledger,
    session: args.session,
  })) {
    const decision = resolveBoundaryUplTrafficPolarity(segment);
    if (!decision) {
      continue;
    }
    if (
      segment.entry.pathHash === pathHash ||
      (segment.entry.scope === "DOMAIN" && segment.entry.domain === domain)
    ) {
      return { entry: segment.entry, decision };
    }
  }
  return null;
}

/**
 * Fallback lookup for requests that do not have an exact UPL pathHash match.
 * Scans active approved entries whose trackConstraint covers the incoming
 * actionKind and applies any-match semantics:
 *
 *   - If ANY covering track passes → allow (with that entry).
 *   - If ALL covering tracks reject → require_approval (track_violation with the
 *     most-recently-created violating entry so the reason is as specific as possible).
 *   - If no covering tracks exist → null (fall through to normal law evaluation).
 *
 * Any-match is correct when a user has approved multiple corridors for the same
 * action kind (e.g. "tool.exec npm" and "tool.exec git"). A request that satisfies
 * either corridor must be allowed without a second prompt.
 *
 * Surface scope: only Tool/Action and Chat/Output kinds are eligible.
 * Returns null immediately for Admission or Physics surface kinds.
 */
export function lookupUserPathTrackDecision(args: {
  ledger: BoundaryUserPathLedger;
  session: BoundarySession;
  request: BoundaryActionRequest;
}): { entry: BoundaryUplEntry; decision: "allow" | "deny" | "track_violation"; violation?: string } | null {
  // UPL Tracks are scoped to post-law execution surfaces only.
  if (!isTrackSurface(args.request.actionKind)) {
    return null;
  }

  type TrackMatch = BoundaryLiveUplFieldEntry & {
    decision: "allow" | "deny" | "track_violation";
    violation?: string;
  };

  const allowMatches: TrackMatch[] = [];
  const denyMatches: TrackMatch[] = [];
  const violations: TrackMatch[] = [];

  for (const segment of compileLiveUplTrackField({
    ledger: args.ledger,
    session: args.session,
  })) {
    const polarity = resolveBoundaryUplTrafficPolarity(segment);
    if (!polarity) continue;
    const constraint = segment.entry.trackConstraint;
    if (!constraint) continue;
    if (!constraint.allowedActionKinds.includes(args.request.actionKind)) continue;

    const violation = checkTrackConstraint(constraint, args.request);
    if (!violation) {
      if (polarity === "deny") {
        denyMatches.push({
          ...segment,
          decision: "deny",
        });
      } else {
        allowMatches.push({
          ...segment,
          decision: "allow",
        });
      }
      continue;
    }
    if (polarity === "allow") {
      violations.push({
        ...segment,
        decision: "track_violation",
        violation,
      });
    }
  }

  const rankTrackMatch = (left: TrackMatch, right: TrackMatch) => {
    return compareLiveUplFieldEntries(left, right);
  };

  denyMatches.sort(rankTrackMatch);
  allowMatches.sort(rankTrackMatch);
  violations.sort(rankTrackMatch);

  const bestDeny = denyMatches[0];
  const bestAllow = allowMatches[0];

  if (bestDeny) {
    return { entry: bestDeny.entry, decision: "deny" };
  }
  if (bestAllow) {
    return { entry: bestAllow.entry, decision: "allow" };
  }
  if (violations[0]) {
    return {
      entry: violations[0].entry,
      decision: "track_violation",
      violation: violations[0].violation,
    };
  }
  return null;
}

function normalizeScope(args: {
  decision?: BoundaryApprovalDecision;
  defaultScope?: BoundaryUplScope;
}): BoundaryUplScope {
  return args.decision?.scope ?? args.defaultScope ?? "GLOBAL";
}

function withNormalizedScope(
  decision: BoundaryApprovalDecision | undefined,
  scope: BoundaryUplScope,
): BoundaryApprovalDecision | undefined {
  return decision
    ? {
      ...decision,
      scope,
    }
    : undefined;
}

function createEntry(args: {
  ledger: BoundaryUserPathLedger;
  request: BoundaryActionRequest;
  witness: BoundaryLedgerRecord;
  type: "APPROVED" | "DENIED";
  session: BoundarySession;
  decision?: BoundaryApprovalDecision;
  trackConstraintOverride?: BoundaryUplEntry["trackConstraint"];
  sourceTrack?: BoundaryUplEntry["sourceTrack"];
  entryId?: string;
}): BoundaryUplEntry {
  const scope = normalizeScope({ decision: args.decision });
  // Attach a track constraint to every UPL entry that lives on a tracked surface.
  // That keeps standing user law from reopening into broad general agency after
  // the law is set in motion. Admission and Physics surfaces are excluded.
  const trackConstraint =
    args.trackConstraintOverride ?? (
      isTrackSurface(args.request.actionKind)
      ? buildAutoTrackConstraint(args.request)
      : undefined
    );
  return {
    id: args.entryId ?? makeEntryId(args.ledger),
    type: args.type,
    path: describeUserPath(args.request),
    pathHash: hashUserPath(args.request),
    createdAt: args.witness.META.timestamp,
    scope,
    status: "ACTIVE",
    witness: args.witness.META.id,
    modifiedAt: null,
    notes: args.decision?.notes ?? null,
    ...(scope === "SESSION" ? { sessionId: args.session.sessionId } : {}),
    ...(scope === "DOMAIN" ? { domain: args.decision?.domain ?? classifyUserPathDomain(args.request) } : {}),
    requestBasis: toRequestBasis(args.request),
    ...(trackConstraint ? { trackConstraint } : {}),
    ...(args.sourceTrack ? { sourceTrack: args.sourceTrack } : {}),
  };
}

export async function writeApprovedUserPathLaw(args: {
  ledger: BoundaryUserPathLedger;
  request: BoundaryActionRequest;
  witness: BoundaryLedgerRecord;
  session: BoundarySession;
  authority: BoundaryActiveUplWriteAuthority;
  decision?: BoundaryApprovalDecision;
}): Promise<BoundaryUserPathLedger> {
  assertActiveUplWriteAuthority(args.authority);
  const scope = normalizeScope({ decision: args.decision });
  const nextLedger = applyUserLawReplacement({
    ledger: args.ledger,
    request: args.request,
    session: args.session,
    scope,
    modifiedAt: args.witness.META.timestamp,
  });
  const entry = createEntry({
    ledger: nextLedger,
    request: args.request,
    witness: args.witness,
    type: "APPROVED",
    session: args.session,
    decision: withNormalizedScope(args.decision, scope),
  });
  const next = {
    ...nextLedger,
    userApprovedLawPaths: [...nextLedger.userApprovedLawPaths, entry],
  };
  return saveUserPathLedger(next);
}

export async function writeDeniedUserPathLaw(args: {
  ledger: BoundaryUserPathLedger;
  request: BoundaryActionRequest;
  witness: BoundaryLedgerRecord;
  session: BoundarySession;
  authority: BoundaryActiveUplWriteAuthority;
  decision?: BoundaryApprovalDecision;
}): Promise<BoundaryUserPathLedger> {
  assertActiveUplWriteAuthority(args.authority);
  const scope = normalizeScope({ decision: args.decision });
  const nextLedger = applyUserLawReplacement({
    ledger: args.ledger,
    request: args.request,
    session: args.session,
    scope,
    modifiedAt: args.witness.META.timestamp,
  });
  const entry = createEntry({
    ledger: nextLedger,
    request: args.request,
    witness: args.witness,
    type: "DENIED",
    session: args.session,
    decision: withNormalizedScope(args.decision, scope),
  });
  const next = {
    ...nextLedger,
    userDeniedLawPaths: [...nextLedger.userDeniedLawPaths, entry],
  };
  return saveUserPathLedger(next);
}

export async function writeCompiledUserPathLaw(args: {
  ledger: BoundaryUserPathLedger;
  compiledLaw: CompiledDocumentLaw;
  witness: BoundaryLedgerRecord;
  session: BoundarySession;
  authority: BoundaryActiveUplWriteAuthority;
}): Promise<BoundaryUserPathLedger> {
  return writeCompiledUserPathLaws({
    ledger: args.ledger,
    compiledLaws: [{ compiledLaw: args.compiledLaw, witness: args.witness }],
    session: args.session,
    authority: args.authority,
  });
}

export async function writeCompiledUserPathLaws(args: {
  ledger: BoundaryUserPathLedger;
  compiledLaws: Array<{
    compiledLaw: CompiledDocumentLaw;
    witness: BoundaryLedgerRecord;
  }>;
  session: BoundarySession;
  authority: BoundaryActiveUplWriteAuthority;
  skipReplacement?: boolean;
  persist?: boolean;
  entryIdFactory?: (args: {
    itemIndex: number;
    compiledLaw: CompiledDocumentLaw;
    ledger: BoundaryUserPathLedger;
  }) => string;
}): Promise<BoundaryUserPathLedger> {
  assertActiveUplWriteAuthority(args.authority);
  if (args.skipReplacement) {
    const approvedEntries = [...args.ledger.userApprovedLawPaths];
    const deniedEntries = [...args.ledger.userDeniedLawPaths];
    const nextLedger: BoundaryUserPathLedger = {
      ...args.ledger,
      userApprovedLawPaths: approvedEntries,
      userDeniedLawPaths: deniedEntries,
    };

    for (const [itemIndex, item] of args.compiledLaws.entries()) {
      const request = requestFromBasis(item.compiledLaw.requestBasis, args.session.sessionId);
      const decision: BoundaryApprovalDecision = {
        choice: item.compiledLaw.type === "APPROVED" ? "allow_as_law" : "deny_as_law",
        scope: item.compiledLaw.scope ?? "GLOBAL",
        notes: item.compiledLaw.notes ?? undefined,
      };
      const scope = normalizeScope({ decision });
      const entry = createEntry({
        ledger: nextLedger,
        request,
        witness: item.witness,
        type: item.compiledLaw.type,
        session: args.session,
        decision: withNormalizedScope(decision, scope),
        trackConstraintOverride: item.compiledLaw.trackConstraint,
        sourceTrack: item.compiledLaw.sourceTrack,
        entryId: args.entryIdFactory?.({
          itemIndex,
          compiledLaw: item.compiledLaw,
          ledger: nextLedger,
        }),
      });
      if (item.compiledLaw.type === "APPROVED") {
        approvedEntries.push(entry);
      } else {
        deniedEntries.push(entry);
      }
    }

    return args.persist === false ? normalizeLedger(nextLedger) : saveUserPathLedger(nextLedger);
  }

  let nextLedger = args.ledger;
  let approvedEntries = nextLedger.userApprovedLawPaths;
  let deniedEntries = nextLedger.userDeniedLawPaths;

  for (const [itemIndex, item] of args.compiledLaws.entries()) {
    const request = requestFromBasis(item.compiledLaw.requestBasis, args.session.sessionId);
    const decision: BoundaryApprovalDecision = {
      choice: item.compiledLaw.type === "APPROVED" ? "allow_as_law" : "deny_as_law",
      scope: item.compiledLaw.scope ?? "GLOBAL",
      notes: item.compiledLaw.notes ?? undefined,
    };
    const scope = normalizeScope({ decision });
    const workingLedger = {
      ...nextLedger,
      userApprovedLawPaths: approvedEntries,
      userDeniedLawPaths: deniedEntries,
    };
    nextLedger = args.skipReplacement
      ? workingLedger
      : applyUserLawReplacement({
        ledger: workingLedger,
        request,
        session: args.session,
        scope,
        modifiedAt: item.witness.META.timestamp,
      });
    const entry = createEntry({
      ledger: nextLedger,
      request,
      witness: item.witness,
      type: item.compiledLaw.type,
      session: args.session,
      decision: withNormalizedScope(decision, scope),
      trackConstraintOverride: item.compiledLaw.trackConstraint,
      sourceTrack: item.compiledLaw.sourceTrack,
      entryId: args.entryIdFactory?.({
        itemIndex,
        compiledLaw: item.compiledLaw,
        ledger: nextLedger,
      }),
    });
    approvedEntries = nextLedger.userApprovedLawPaths;
    deniedEntries = nextLedger.userDeniedLawPaths;
    if (item.compiledLaw.type === "APPROVED") {
      approvedEntries = [...approvedEntries, entry];
    } else {
      deniedEntries = [...deniedEntries, entry];
    }
  }

  const finalLedger = {
    ...nextLedger,
    userApprovedLawPaths: approvedEntries,
    userDeniedLawPaths: deniedEntries,
  };
  return args.persist === false ? normalizeLedger(finalLedger) : saveUserPathLedger(finalLedger);
}

export async function pruneSessionScopedUserPathLaws(args: {
  ledger: BoundaryUserPathLedger;
  sessionId: string;
}): Promise<BoundaryUserPathLedger> {
  const next = {
    ...args.ledger,
    userApprovedLawPaths: args.ledger.userApprovedLawPaths.filter(
      (entry) => !(entry.scope === "SESSION" && entry.sessionId === args.sessionId),
    ),
    userDeniedLawPaths: args.ledger.userDeniedLawPaths.filter(
      (entry) => !(entry.scope === "SESSION" && entry.sessionId === args.sessionId),
    ),
  };
  return isSessionScopedUserPathLedger({
    ledger: args.ledger,
    sessionId: args.sessionId,
  })
    ? normalizeLedger(next)
    : saveUserPathLedger(next);
}

export function getActiveUserLawIds(ledger: BoundaryUserPathLedger, session: BoundarySession): string[] {
  const entries = [...ledger.userApprovedLawPaths, ...ledger.userDeniedLawPaths];
  return entries.filter((entry) => isEntryActiveForSession(entry, session)).map((entry) => entry.id);
}
