import type { DynamicLawGrant, GravityProposal } from "./types.ts";
import type { BodyguardGrantOffer } from "./bodyguard-routing.ts";

/**
 * Ledger event names for grant and bodyguard flow.
 * Executor/ledger layer records these so traces are complete and reconstructible.
 */
export const LEDGER_EVENTS = {
  BLOCKED: "BLOCKED",
  PATH_OPENED: "PATH_OPENED",
  PATH_LAW_INSTANTIATED: "PATH_LAW_INSTANTIATED",
  RECIPIENT_OPENED: "RECIPIENT_OPENED",
  RECIPIENT_LAW_INSTANTIATED: "RECIPIENT_LAW_INSTANTIATED",
  DOMAIN_OPENED: "DOMAIN_OPENED",
  DOMAIN_LAW_INSTANTIATED: "DOMAIN_LAW_INSTANTIATED",
  TOOL_OPENED: "TOOL_OPENED",
  TOOL_LAW_INSTANTIATED: "TOOL_LAW_INSTANTIATED",
  DATABASE_OPENED: "DATABASE_OPENED",
  DATABASE_LAW_INSTANTIATED: "DATABASE_LAW_INSTANTIATED",
  SYSTEM_OPENED: "SYSTEM_OPENED",
  SYSTEM_LAW_INSTANTIATED: "SYSTEM_LAW_INSTANTIATED",
  BODYGUARD_GRANT_OFFERED: "BODYGUARD_GRANT_OFFERED",
  USER_CONFIRMED_DENY: "USER_CONFIRMED_DENY",
  GRANT_ISSUED: "GRANT_ISSUED",
  PROPOSAL_REPLAYED: "PROPOSAL_REPLAYED",
} as const;

/**
 * Input to grant issuance when the user selects allow as law on the bodyguard scope prompt.
 * Bodyguard creates a DynamicLawGrant and ledgers PATH_OPENED / PATH_LAW_INSTANTIATED (or equivalent).
 */
export interface GrantIssuanceInput {
  scopeIdentifier: string;
  scopeKind: DynamicLawGrant["kind"];
  /** Optional expiry for temporary grants. */
  expiresAt?: number;
}

/**
 * Result of issuing a grant: the new grant and ledger event names to record.
 */
export interface GrantIssuanceResult {
  grant: DynamicLawGrant;
  ledgerEventOpened: string;
  ledgerEventLawInstantiated: string;
}

/**
 * Builds a new grant and ledger event names from BodyguardGrantOffer + optional expiry.
 * Caller persists the grant into state.dynamicLaws.grants and ledger.
 */
export function buildGrantFromOffer(
  offer: BodyguardGrantOffer,
  expiresAt?: number,
): GrantIssuanceResult {
  const now = Date.now();
  const grant: DynamicLawGrant = {
    id: `grant-${offer.scopeKind}-${now}-${offer.scopeIdentifier.replace(/\//g, "-").slice(0, 32)}`,
    kind: offer.scopeKind,
    scope: offer.scopeIdentifier,
    issuedAt: now,
    expiresAt,
  };
  const eventOpened =
    offer.scopeKind === "path"
      ? LEDGER_EVENTS.PATH_OPENED
      : offer.scopeKind === "recipient"
        ? LEDGER_EVENTS.RECIPIENT_OPENED
        : offer.scopeKind === "domain"
          ? LEDGER_EVENTS.DOMAIN_OPENED
          : offer.scopeKind === "tool"
            ? LEDGER_EVENTS.TOOL_OPENED
            : offer.scopeKind === "database"
              ? LEDGER_EVENTS.DATABASE_OPENED
              : LEDGER_EVENTS.SYSTEM_OPENED;
  const eventLaw =
    offer.scopeKind === "path"
      ? LEDGER_EVENTS.PATH_LAW_INSTANTIATED
      : offer.scopeKind === "recipient"
        ? LEDGER_EVENTS.RECIPIENT_LAW_INSTANTIATED
        : offer.scopeKind === "domain"
          ? LEDGER_EVENTS.DOMAIN_LAW_INSTANTIATED
          : offer.scopeKind === "tool"
            ? LEDGER_EVENTS.TOOL_LAW_INSTANTIATED
            : offer.scopeKind === "database"
              ? LEDGER_EVENTS.DATABASE_LAW_INSTANTIATED
              : LEDGER_EVENTS.SYSTEM_LAW_INSTANTIATED;
  return { grant, ledgerEventOpened: eventOpened, ledgerEventLawInstantiated: eventLaw };
}

/**
 * Contract for the bodyguard scope-law choice step.
 * Bodyguard presents this through the four-way approval surface and replays only when the user allows scope as law.
 */
export interface BodyguardOpenAsLawStep {
  kind: "open_as_law";
  /** Message explaining that the attempted scope is outside current law. */
  message: string;
  /** Exact scope to show and to grant if the user allows it as law. */
  scopeIdentifier: string;
  scopeKind: DynamicLawGrant["kind"];
  lawCode: string;
  /** Original proposal to replay after allow-as-law grant issuance. */
  proposal: GravityProposal;
  offer: BodyguardGrantOffer;
}

/**
 * Builds the scope-law choice step from a grant offer and the original proposal for replay after allow-as-law.
 */
export function buildOpenAsLawStep(
  offer: BodyguardGrantOffer,
  proposal: GravityProposal,
): BodyguardOpenAsLawStep {
  const actionLabel = offer.actionLabel ?? "use";
  const targetLabel =
    offer.scopeKind === "path"
      ? offer.scopeIdentifier
      : offer.scopeKind === "recipient"
        ? `recipient ${offer.scopeIdentifier}`
        : offer.scopeKind === "domain"
          ? `domain ${offer.scopeIdentifier}`
          : offer.scopeKind === "tool"
            ? `tool ${offer.scopeIdentifier}`
            : offer.scopeKind === "database"
              ? `database ${offer.scopeIdentifier}`
              : `system target ${offer.scopeIdentifier}`;
  const message = `You tried to ${actionLabel} ${targetLabel}, but it is outside current law.`;
  return {
    kind: "open_as_law",
    message,
    scopeIdentifier: offer.scopeIdentifier,
    scopeKind: offer.scopeKind,
    lawCode: offer.code,
    proposal,
    offer,
  };
}

// Legacy aliases for backward compatibility
export type NslOpenAsLawStep = BodyguardOpenAsLawStep;
