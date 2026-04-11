import type {
  DynamicLawGrant,
  EnforcementResult,
  GravityProposal,
  LawViolation,
} from "./types.ts";
import { allViolationsGrantable } from "./types.ts";

/**
 * Result of mapping an EnforcementResult to a bodyguard routing decision.
 * Bodyguard branches on outcome and never silently says "no"; blocked becomes ledger + bodyguard grant offer.
 */
export type BodyguardOutcome =
  | { outcome: "allow"; result: EnforcementResult }
  | { outcome: "transform"; result: EnforcementResult }
  | { outcome: "bodyguard_grant_offer"; result: EnforcementResult; grantOffer: BodyguardGrantOffer }
  | { outcome: "deny"; result: EnforcementResult };

/**
 * Structured data for the bodyguard scope-law choice step.
 * Built from grantable violations so Bodyguard can ledger blocked, show the four-way prompt surface, and replay when the user allows scope as law.
 */
export interface BodyguardGrantOffer {
  /** First grantable violation's scope (exact path/recipient/domain/tool). */
  scopeIdentifier: string;
  scopeKind: DynamicLawGrant["kind"];
  /** Law id + code for ledger and UI, e.g. SCOPE.GRANT.CLOSED, PATH_OUT_OF_SCOPE. */
  lawId: string;
  code: string;
  /** Human message for the prompt, e.g. "This path is not in current law." */
  message: string;
  /** Optional action label for message: "You tried to [actionLabel] [target]." */
  actionLabel?: string;
  /** All violations for this proposal (for ledger and diagnostics). */
  violations: LawViolation[];
}

/**
 * Maps gravity EnforcementResult to a bodyguard routing decision.
 * - allow: proceed to boundary checks and execution.
 * - transform: use result.proposal if present and proceed.
 * - null (only grantable violations): ledger blocked + emit bodyguard grant offer; replay only if the user selects allow as law.
 * - deny (any non-grantable violation): block and show diagnostics; no grant offer.
 */
export function mapEnforcementResultToOutcome(
  result: EnforcementResult,
  proposal?: GravityProposal,
): BodyguardOutcome {
  if (result.decision === "allow") {
    return { outcome: "allow", result };
  }
  if (result.decision === "transform") {
    return { outcome: "transform", result };
  }
  if (result.decision === "null" && result.violations.length > 0) {
    const first = result.violations[0];
    const payload = proposal?.payload as { actionLabel?: string } | undefined;
    const grantOffer: BodyguardGrantOffer = {
      scopeIdentifier: first.scopeIdentifier ?? "",
      scopeKind: first.scopeKind ?? "other",
      lawId: first.lawId,
      code: first.code ?? "OUT_OF_SCOPE",
      message: first.message ?? "This scope is not in current law.",
      actionLabel: payload?.actionLabel,
      violations: result.violations,
    };
    return { outcome: "bodyguard_grant_offer", result, grantOffer };
  }
  return { outcome: "deny", result };
}

/**
 * Returns true if the result should drive a bodyguard grant offer (user can open scope as law).
 */
export function shouldOfferBodyguardGrant(result: EnforcementResult): boolean {
  return result.decision === "null" && allViolationsGrantable(result.violations);
}
