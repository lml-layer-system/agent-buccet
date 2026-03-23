import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BoundaryActionRequest,
  BoundaryApprovalDecision,
  BoundaryLedgerRecord,
  BoundarySession,
  BoundaryUplEntry,
  BoundaryUplScope,
  BoundaryUplStatus,
  BoundaryUserPathLedger,
} from "./types.ts";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const UPL_RELATIVE_PATH = path.join("data", "agent-buccet-law-foundation", "user-path-ledger.json");

function getDefaultLedger(): BoundaryUserPathLedger {
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
    reviewSurface: request.reviewContext?.surface ?? null,
    reviewInvariantLawId: request.reviewContext?.invariantLawId ?? null,
  };
}

export function describeUserPath(request: BoundaryActionRequest): string {
  return `${request.actionKind} ${request.target}${request.payloadSummary ? ` :: ${request.payloadSummary}` : ""}`;
}

export function hashUserPath(request: BoundaryActionRequest): string {
  return createHash("sha256").update(JSON.stringify(stablePathDescriptor(request))).digest("hex");
}

export function classifyUserPathDomain(request: BoundaryActionRequest): string {
  const [domain] = request.actionKind.split(".");
  return domain.toUpperCase();
}

async function resolveUserPathLedgerPath(): Promise<string> {
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
  await fs.writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
}

export async function loadUserPathLedger(): Promise<BoundaryUserPathLedger> {
  const ledgerPath = await resolveUserPathLedgerPath();
  try {
    const raw = await fs.readFile(ledgerPath, "utf8");
    return JSON.parse(raw) as BoundaryUserPathLedger;
  } catch {
    const ledger = getDefaultLedger();
    await writeLedger(ledger);
    return ledger;
  }
}

export async function saveUserPathLedger(ledger: BoundaryUserPathLedger): Promise<BoundaryUserPathLedger> {
  await writeLedger(ledger);
  return ledger;
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

type RankedEntry = {
  entry: BoundaryUplEntry;
  decision: "allow" | "deny";
  specificity: 0 | 1 | 2;
};

function entrySpecificity(entry: BoundaryUplEntry): 0 | 1 | 2 {
  if (entry.scope === "SESSION") return 2;
  if (entry.scope === "DOMAIN") return 1;
  return 0;
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

function supersedeConflictingEntries(args: {
  ledger: BoundaryUserPathLedger;
  request: BoundaryActionRequest;
  session: BoundarySession;
  scope: BoundaryUplScope;
  modifiedAt: string;
}): BoundaryUserPathLedger {
  const domain = classifyUserPathDomain(args.request);
  const muteIfConflicting = (entry: BoundaryUplEntry): BoundaryUplEntry => {
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
    userApprovedLawPaths: args.ledger.userApprovedLawPaths.map(muteIfConflicting),
    userDeniedLawPaths: args.ledger.userDeniedLawPaths.map(muteIfConflicting),
  };
}

export function lookupUserPathDecision(args: {
  ledger: BoundaryUserPathLedger;
  session: BoundarySession;
  request: BoundaryActionRequest;
}): { entry: BoundaryUplEntry; decision: "allow" | "deny" } | null {
  const pathHash = hashUserPath(args.request);
  const domain = classifyUserPathDomain(args.request);
  const matches: RankedEntry[] = [];

  for (const entry of args.ledger.userApprovedLawPaths) {
    if (!isEntryActiveForSession(entry, args.session)) continue;
    if (entry.pathHash === pathHash || (entry.scope === "DOMAIN" && entry.domain === domain)) {
      matches.push({ entry, decision: "allow", specificity: entrySpecificity(entry) });
    }
  }

  for (const entry of args.ledger.userDeniedLawPaths) {
    if (!isEntryActiveForSession(entry, args.session)) continue;
    if (entry.pathHash === pathHash || (entry.scope === "DOMAIN" && entry.domain === domain)) {
      matches.push({ entry, decision: "deny", specificity: entrySpecificity(entry) });
    }
  }

  matches.sort((left, right) => {
    if (right.specificity !== left.specificity) {
      return right.specificity - left.specificity;
    }
    if (left.entry.createdAt !== right.entry.createdAt) {
      return right.entry.createdAt.localeCompare(left.entry.createdAt);
    }
    if (left.decision !== right.decision) {
      return left.decision === "deny" ? -1 : 1;
    }
    return left.entry.id.localeCompare(right.entry.id);
  });

  const winner = matches[0];
  return winner ? { entry: winner.entry, decision: winner.decision } : null;
}

function normalizeScope(args: {
  decision?: BoundaryApprovalDecision;
  defaultScope?: BoundaryUplScope;
}): BoundaryUplScope {
  return args.decision?.scope ?? args.defaultScope ?? "GLOBAL";
}

function createEntry(args: {
  ledger: BoundaryUserPathLedger;
  request: BoundaryActionRequest;
  witness: BoundaryLedgerRecord;
  type: "APPROVED" | "DENIED";
  session: BoundarySession;
  decision?: BoundaryApprovalDecision;
}): BoundaryUplEntry {
  const scope = normalizeScope({ decision: args.decision });
  return {
    id: makeEntryId(args.ledger),
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
  };
}

export async function writeApprovedUserPathLaw(args: {
  ledger: BoundaryUserPathLedger;
  request: BoundaryActionRequest;
  witness: BoundaryLedgerRecord;
  session: BoundarySession;
  decision?: BoundaryApprovalDecision;
}): Promise<BoundaryUserPathLedger> {
  const scope = normalizeScope({ decision: args.decision });
  const nextLedger = supersedeConflictingEntries({
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
    decision: {
      ...args.decision,
      scope,
    },
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
  decision?: BoundaryApprovalDecision;
}): Promise<BoundaryUserPathLedger> {
  const scope = normalizeScope({ decision: args.decision });
  const nextLedger = supersedeConflictingEntries({
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
    decision: {
      ...args.decision,
      scope,
    },
  });
  const next = {
    ...nextLedger,
    userDeniedLawPaths: [...nextLedger.userDeniedLawPaths, entry],
  };
  return saveUserPathLedger(next);
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
  return saveUserPathLedger(next);
}

export function getActiveUserLawIds(ledger: BoundaryUserPathLedger, session: BoundarySession): string[] {
  const entries = [...ledger.userApprovedLawPaths, ...ledger.userDeniedLawPaths];
  return entries.filter((entry) => isEntryActiveForSession(entry, session)).map((entry) => entry.id);
}
