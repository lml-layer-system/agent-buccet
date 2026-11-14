import { readAllBoundaryLedgerRecords } from "./../proof/ledger.ts";
import type {
  BoundaryActionRequest,
  BoundaryLawResult,
  BoundaryLedgerRecord,
  BoundaryRequestProvenance,
  BoundaryRuntimeConfig,
  BoundarySpendIntent,
  BoundarySpendPeriodWindow,
} from "./../runtime/types.ts";

const UNTRUSTED_SPEND_SOURCES = new Set<BoundaryRequestProvenance>([
  "external_content",
  "tool_output",
]);

const HIGH_RISK_SPEND_COMMIT_INTENTS = new Set([
  "subscribe",
  "transfer",
  "withdraw",
  "swap",
  "sign",
]);

const HIGH_RISK_SPEND_DESTINATION_KINDS = new Set(["exchange", "wallet", "contract", "account"]);

const HIGH_RISK_SPEND_RISK_CLASSES = new Set([
  "high",
  "irreversible",
  "recurring",
  "volatile",
  "identity_sensitive",
  "legal_obligation",
]);

const RECURSIVE_SPEND_WINDOW_MS = 60_000;
const RECURSIVE_SPEND_MAX_EVENTS = 3;

function trim(value: string | undefined): string {
  return value?.trim() ?? "";
}

function normalizedInstructionSource(request: BoundaryActionRequest): BoundaryRequestProvenance {
  return request.spendIntent?.instructionSource ?? request.provenance;
}

/**
 * Parse the magnitude declared by the human-facing `amountRaw` string into a
 * number comparable to `amountNormalized`. Strips currency symbols/letters and
 * whitespace, then resolves thousands/decimal separators (US "1,234.56" and EU
 * "1.234,56" both supported). Returns null when no numeric value is present.
 */
function parseDeclaredAmountMagnitude(amountRaw: string): number | null {
  const cleaned = amountRaw.replace(/[^\d.,-]/g, "");
  if (!/\d/.test(cleaned)) return null;
  let s = cleaned;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // The separator that appears last is the decimal mark; the other groups thousands.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // Comma only: a `\d{1,3}(,\d{3})+` grouping is thousands; otherwise a decimal mark.
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  const value = Number.parseFloat(s);
  return Number.isFinite(value) ? Math.abs(value) : null;
}

/**
 * The gated `amountNormalized` is caller-declared and every spend cap compares
 * against it, while the human authorizes against the `amountRaw` string shown
 * in the consent summary. If the two diverge, an agent can show a human (and
 * the ledger) one amount while the boundary enforces another — e.g. raw
 * "$5,000.00" with normalized 1 silently clears a cap of 10. Require the
 * normalized magnitude to match the declared raw amount (small tolerance for
 * rounding/formatting); an unverifiable or mismatched binding is surfaced for
 * explicit human authorization rather than auto-cleared.
 */
function spendAmountBindingUntrusted(spendIntent: BoundarySpendIntent): boolean {
  const declared = parseDeclaredAmountMagnitude(spendIntent.amountRaw);
  if (declared === null) return true; // human-facing amount cannot be verified
  const tolerance = Math.max(0.01, declared * 0.005);
  return Math.abs(declared - spendIntent.amountNormalized) > tolerance;
}

function windowToMs(window: BoundarySpendPeriodWindow): number {
  switch (window) {
    case "1h":
      return 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
    case "30d":
      return 30 * 24 * 60 * 60 * 1000;
    case "month":
      return 31 * 24 * 60 * 60 * 1000;
  }
}

function spendAggregateIdentity(spendIntent: BoundarySpendIntent): string {
  return `${spendIntent.principal}::${spendIntent.bucketId}`;
}

function spendProposalIdentity(request: BoundaryActionRequest): string {
  const spendIntent = request.spendIntent;
  if (!spendIntent) {
    return request.target;
  }
  return [
    spendAggregateIdentity(spendIntent),
    spendIntent.destination,
    spendIntent.commitIntent,
    spendIntent.amountNormalized,
    spendIntent.recurring ? "recurring" : "one-time",
  ].join("::");
}

function missingSpendPacketFields(spendIntent: BoundarySpendIntent): string[] {
  const missing: string[] = [];
  if (!Number.isFinite(spendIntent.amountNormalized) || spendIntent.amountNormalized <= 0) {
    missing.push("amountNormalized>0");
  }
  if (!trim(spendIntent.destination)) missing.push("destination");
  if (!trim(spendIntent.principal)) missing.push("principal");
  if (!trim(spendIntent.purpose)) missing.push("purpose");
  if (!trim(spendIntent.bucketId)) missing.push("bucketId");
  if (!trim(spendIntent.termsSummary)) missing.push("termsSummary");
  if (!trim(spendIntent.accountabilityRef)) missing.push("accountabilityRef");
  if (typeof spendIntent.recurring !== "boolean") missing.push("recurring");
  if (!trim(spendIntent.riskClass)) missing.push("riskClass");
  if (spendIntent.commitIntent === "subscribe" && !spendIntent.recurring) {
    missing.push("subscribe_requires_recurring=true");
  }
  if (spendIntent.periodCapNormalized !== undefined) {
    if (!Number.isFinite(spendIntent.periodCapNormalized) || spendIntent.periodCapNormalized <= 0) {
      missing.push("periodCapNormalized>0");
    }
    if (!spendIntent.periodWindow) {
      missing.push("periodWindow");
    }
  }
  if (spendIntent.periodWindow && spendIntent.periodCapNormalized === undefined) {
    missing.push("periodCapNormalized");
  }
  return missing;
}

function isHighRiskSpend(spendIntent: BoundarySpendIntent): boolean {
  return (
    HIGH_RISK_SPEND_COMMIT_INTENTS.has(spendIntent.commitIntent) ||
    HIGH_RISK_SPEND_DESTINATION_KINDS.has(spendIntent.destinationKind) ||
    HIGH_RISK_SPEND_RISK_CLASSES.has(spendIntent.riskClass) ||
    spendIntent.recurring ||
    spendIntent.obligationCreated === true
  );
}

function parseNumberMetadata(record: BoundaryLedgerRecord, key: string): number | null {
  const value = record.payload.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseStringMetadata(record: BoundaryLedgerRecord, key: string): string | null {
  const value = record.payload.metadata?.[key];
  return typeof value === "string" ? value : null;
}

function isSpendExecutionRecord(record: BoundaryLedgerRecord): boolean {
  return (
    record.eventType === "ACTION_EXECUTED" &&
    record.payload.actionKind === "agent.spend" &&
    record.payload.metadata?.dry_run !== true
  );
}

function isSameAggregateBucket(
  record: BoundaryLedgerRecord,
  spendIntent: BoundarySpendIntent,
): boolean {
  return (
    parseStringMetadata(record, "spend_principal") === spendIntent.principal &&
    parseStringMetadata(record, "spend_bucket_id") === spendIntent.bucketId
  );
}

function isRecentProposalForIdentity(
  record: BoundaryLedgerRecord,
  request: BoundaryActionRequest,
  cutoffMs: number,
): boolean {
  if (!["ACTION_PROPOSED", "APPROVAL_REQUESTED", "ACTION_EXECUTED"].includes(record.eventType)) {
    return false;
  }
  if (record.payload.actionKind !== "agent.spend") {
    return false;
  }
  if (record.META.session_id !== request.sessionId) {
    return false;
  }
  if (record.payload.requestId === request.requestId) {
    return false;
  }
  const recordedAt = Date.parse(record.payload.createdAt);
  if (!Number.isFinite(recordedAt) || recordedAt < cutoffMs) {
    return false;
  }
  const identity = parseStringMetadata(record, "spend_proposal_identity");
  return identity === spendProposalIdentity(request);
}

async function sumAggregateSpend(args: {
  spendIntent: BoundarySpendIntent;
  periodWindow: BoundarySpendPeriodWindow;
}): Promise<number> {
  const cutoffMs = Date.now() - windowToMs(args.periodWindow);
  const records = await readAllBoundaryLedgerRecords();
  return records
    .filter(isSpendExecutionRecord)
    .filter((record) => Date.parse(record.payload.createdAt) >= cutoffMs)
    .filter((record) => isSameAggregateBucket(record, args.spendIntent))
    .reduce(
      (sum, record) => sum + (parseNumberMetadata(record, "spend_amount_normalized") ?? 0),
      0,
    );
}

async function isRecursiveSpendAttempt(request: BoundaryActionRequest): Promise<boolean> {
  const cutoffMs = Date.now() - RECURSIVE_SPEND_WINDOW_MS;
  const records = await readAllBoundaryLedgerRecords();
  const collisions = records.filter((record) =>
    isRecentProposalForIdentity(record, request, cutoffMs),
  );
  return collisions.length >= RECURSIVE_SPEND_MAX_EVENTS;
}

function buildBoundaryResult(args: {
  decision: BoundaryLawResult["decision"];
  reason: string;
  lawId: string;
}): BoundaryLawResult {
  return {
    decision: args.decision,
    reason: args.reason,
    triggeredLawIds: [args.lawId],
    requiresApproval: args.decision === "require_approval",
  };
}

function evaluateSpendBoundaryCommon(request: BoundaryActionRequest): BoundaryLawResult | null {
  if (request.actionKind !== "agent.spend" || !request.spendIntent) {
    return null;
  }

  const missing = missingSpendPacketFields(request.spendIntent);
  if (missing.length > 0) {
    return buildBoundaryResult({
      decision: "deny",
      reason: `spend packet is incomplete for value-boundary commit (${missing.join(", ")})`,
      lawId: "BOUNDARY.SPEND.PACKET.01",
    });
  }

  // Bind the gated normalized amount to the human-facing raw amount. Every cap
  // compares against amountNormalized, but the human authorizes against
  // amountRaw — an under-declared normalized value otherwise clears caps
  // silently while the consent summary and ledger show the real amount.
  if (spendAmountBindingUntrusted(request.spendIntent)) {
    return buildBoundaryResult({
      decision: "require_approval",
      reason: `declared amount '${request.spendIntent.amountRaw}' does not match the normalized gated amount '${request.spendIntent.amountNormalized}' — spend amount binding cannot be trusted`,
      lawId: "BOUNDARY.SPEND.AMOUNT_BINDING.01",
    });
  }

  const source = normalizedInstructionSource(request);
  if (UNTRUSTED_SPEND_SOURCES.has(source)) {
    return buildBoundaryResult({
      decision: "deny",
      reason: `instruction source '${source}' cannot become spend authority`,
      lawId: "BOUNDARY.SPEND.PROVENANCE.01",
    });
  }

  if (
    request.spendIntent.periodCapNormalized !== undefined &&
    request.spendIntent.amountNormalized > request.spendIntent.periodCapNormalized
  ) {
    return buildBoundaryResult({
      decision: "require_approval",
      reason: `spend amount '${request.spendIntent.amountNormalized}' exceeds the declared bucket period cap '${request.spendIntent.periodCapNormalized}'`,
      lawId: "BOUNDARY.SPEND.PERIOD_CAP.01",
    });
  }

  if (isHighRiskSpend(request.spendIntent)) {
    return buildBoundaryResult({
      decision: "require_approval",
      reason: "high-risk spend requires explicit approval before value or obligation can move",
      lawId: "BOUNDARY.SPEND.HIGH_RISK.01",
    });
  }

  return null;
}

export function spendIntentLedgerMetadata(
  spendIntent: BoundarySpendIntent,
): Record<string, string | number | boolean> {
  return {
    spend_amount_raw: spendIntent.amountRaw,
    spend_amount_normalized: spendIntent.amountNormalized,
    spend_destination: spendIntent.destination,
    spend_destination_kind: spendIntent.destinationKind,
    spend_source_authority: spendIntent.sourceAuthorityKind,
    spend_commit_intent: spendIntent.commitIntent,
    spend_principal: spendIntent.principal,
    spend_purpose: spendIntent.purpose,
    spend_bucket_id: spendIntent.bucketId,
    spend_terms_summary: spendIntent.termsSummary,
    spend_recurring: spendIntent.recurring,
    spend_risk_class: spendIntent.riskClass,
    spend_accountability_ref: spendIntent.accountabilityRef,
    spend_instruction_source: spendIntent.instructionSource ?? "unset",
    spend_proposal_identity: [
      spendAggregateIdentity(spendIntent),
      spendIntent.destination,
      spendIntent.commitIntent,
      spendIntent.amountNormalized,
      spendIntent.recurring ? "recurring" : "one-time",
    ].join("::"),
    ...(spendIntent.periodCapNormalized !== undefined
      ? { spend_period_cap_normalized: spendIntent.periodCapNormalized }
      : {}),
    ...(spendIntent.periodWindow ? { spend_period_window: spendIntent.periodWindow } : {}),
    ...(spendIntent.obligationCreated === true ? { spend_obligation_created: true } : {}),
    ...(spendIntent.currencyHint ? { spend_currency: spendIntent.currencyHint } : {}),
    ...(spendIntent.merchantHint ? { spend_merchant_hint: spendIntent.merchantHint } : {}),
  };
}

export function summarizeBoundarySpendIntent(spendIntent: BoundarySpendIntent): string {
  const currency = spendIntent.currencyHint ? ` ${spendIntent.currencyHint}` : "";
  const merchant = spendIntent.merchantHint ? ` (${spendIntent.merchantHint})` : "";
  const recurring = spendIntent.recurring ? "recurring" : "one-time";
  return `${spendIntent.commitIntent} ${spendIntent.amountRaw}${currency} -> ${spendIntent.destinationKind}:${spendIntent.destination} via ${spendIntent.sourceAuthorityKind} principal=${spendIntent.principal} bucket=${spendIntent.bucketId} risk=${spendIntent.riskClass} ${recurring}${merchant}`;
}

export function evaluateSpendBoundaryAction(
  request: BoundaryActionRequest,
): BoundaryLawResult | null {
  return evaluateSpendBoundaryCommon(request);
}

export async function evaluateSpendBoundaryActionRuntime(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): Promise<BoundaryLawResult | null> {
  const common = evaluateSpendBoundaryCommon(args.request);
  if (common) {
    return common;
  }
  if (args.request.actionKind !== "agent.spend" || !args.request.spendIntent) {
    return null;
  }

  if (
    args.config.session.teamBuccetClass !== undefined &&
    args.config.session.teamBuccetClass !== "spend"
  ) {
    return buildBoundaryResult({
      decision: "deny",
      reason: "team session is not a SPEND Buccet; financial commit is disabled on this lane",
      lawId: "BOUNDARY.SPEND.LANE.01",
    });
  }

  if (await isRecursiveSpendAttempt(args.request)) {
    return buildBoundaryResult({
      decision: "deny",
      reason: "recursive spend loop detected for the same bucket/destination corridor",
      lawId: "BOUNDARY.SPEND.RECURSION.01",
    });
  }

  // Every cumulative bound that applies to this principal+bucket: the one the
  // request declares, plus every standing spend corridor's period bound. The
  // agent cannot shed a standing bound by simply not declaring a cap.
  const bounds = periodBoundsFor(args.config, args.request.spendIntent);
  for (const bound of bounds) {
    const aggregate = await sumAggregateSpend({
      spendIntent: args.request.spendIntent,
      periodWindow: bound.window,
    });
    const projected = aggregate + args.request.spendIntent.amountNormalized;
    if (projected > bound.cap) {
      return buildBoundaryResult({
        decision: "require_approval",
        reason:
          `rolling spend cap would be exceeded for principal '${args.request.spendIntent.principal}' ` +
          `bucket '${args.request.spendIntent.bucketId}' (${aggregate} + ${args.request.spendIntent.amountNormalized} > ${bound.cap} per ${bound.window}, ${bound.source})`,
        lawId: "BOUNDARY.SPEND.AGGREGATE.01",
      });
    }
  }

  return null;
}

type SpendPeriodBound = { cap: number; window: BoundarySpendPeriodWindow; source: string };

/**
 * Cumulative bounds for a spend: the request's declared period cap (if any)
 * and the period bound of every ACTIVE standing spend corridor that covers the
 * same principal and bucket. Most-restrictive wins because each is enforced.
 */
function periodBoundsFor(
  config: BoundaryRuntimeConfig,
  spendIntent: BoundarySpendIntent,
): SpendPeriodBound[] {
  const bounds: SpendPeriodBound[] = [];
  if (spendIntent.periodCapNormalized !== undefined && spendIntent.periodWindow) {
    bounds.push({
      cap: spendIntent.periodCapNormalized,
      window: spendIntent.periodWindow,
      source: "declared",
    });
  }
  for (const entry of config.upl?.userApprovedLawPaths ?? []) {
    const c = entry.trackConstraint;
    if (entry.status !== "ACTIVE" || !c) continue;
    if (entry.scope === "SESSION" && entry.sessionId !== config.session.sessionId) continue;
    if (!c.allowedActionKinds.includes("agent.spend")) continue;
    if (c.spendMaxPeriodAmountNormalized === undefined) continue;
    if (
      c.spendAllowedPrincipals?.length &&
      !c.spendAllowedPrincipals.includes(spendIntent.principal)
    )
      continue;
    if (c.spendAllowedBucketIds?.length && !c.spendAllowedBucketIds.includes(spendIntent.bucketId))
      continue;
    bounds.push({
      cap: c.spendMaxPeriodAmountNormalized,
      window: c.spendPeriodWindow ?? "24h",
      source: `standing law ${entry.id}`,
    });
  }
  return bounds;
}
