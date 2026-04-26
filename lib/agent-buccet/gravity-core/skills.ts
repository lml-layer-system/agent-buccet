import path from "node:path";
import type {
  DynamicLawGrant,
  GravityEvent,
  GravityProposal,
  GravityState,
  LawId,
  LawSkill,
  LawViolation,
} from "./types.ts";
import type { ScopePayload } from "./types.ts";

/**
 * Law ID constants for public defensive laws.
 * These mirror the public META.* family described in the design notes.
 */
export const META_TRUST_01: LawId = "META.TRUST.01";
export const META_AUTHORITY_01: LawId = "META.AUTHORITY.01";
export const META_SCOPE_01: LawId = "META.SCOPE.01";
export const META_LAW_01: LawId = "META.LAW.01";
export const META_SESSION_01: LawId = "META.SESSION.01";
export const META_LEDGER_01: LawId = "META.LEDGER.01";
export const META_CONTACT_01: LawId = "META.CONTACT.01";
export const META_CONTINUATION_01: LawId = "META.CONTINUATION.01";

/**
 * Scope law: path/recipient/domain/tool must be in dynamic laws (opened as law).
 * Violations from this skill are grantable: executor surfaces bodyguard "open as law? yes/no".
 */
export const SCOPE_GRANT_CLOSED: LawId = "SCOPE.GRANT.CLOSED";
const SCOPE_VIOLATION_CODES: Record<DynamicLawGrant["kind"], string> = {
  path: "PATH_OUT_OF_SCOPE",
  recipient: "RECIPIENT_OUT_OF_SCOPE",
  domain: "DOMAIN_OUT_OF_SCOPE",
  tool: "TOOL_OUT_OF_SCOPE",
  database: "DATABASE_OUT_OF_SCOPE",
  system: "SYSTEM_OUT_OF_SCOPE",
  other: "TOOL_OUT_OF_SCOPE",
};

/**
 * Utility to filter ProposalReceived events.
 */
function asProposal(event: GravityEvent): GravityProposal | null {
  if (event.kind !== "ProposalReceived") {
    return null;
  }
  return event.proposal;
}

function violation(lawId: LawId, code: string, message?: string): LawViolation {
  return { lawId, code, message };
}

function hasNonEmptyScopeIdentifier(proposal: GravityProposal): boolean {
  const payload = proposal.payload as Partial<ScopePayload & { requestId?: string }> | undefined;
  return typeof payload?.scopeIdentifier === "string" && payload.scopeIdentifier.trim().length > 0;
}

function hasTrackedOrigin(proposal: GravityProposal): boolean {
  return typeof proposal.provenance.originId === "string" && proposal.provenance.originId.trim().length > 0;
}

function pathGrantMatches(scope: string, target: string, exactOnly?: boolean): boolean {
  const normalizedScope = path.resolve(scope);
  const normalizedTarget = path.resolve(target);
  if (exactOnly) {
    return normalizedTarget === normalizedScope;
  }
  return (
    normalizedTarget === normalizedScope ||
    normalizedTarget.startsWith(`${normalizedScope}${path.sep}`)
  );
}

/**
 * META.TRUST.01
 * Untrusted content cannot directly authorize high-risk actions.
 */
export function createMetaTrustSkill(): LawSkill {
  return {
    id: META_TRUST_01,
    validate(state: GravityState, event: GravityEvent): LawViolation[] {
      const proposal = asProposal(event);
      if (!proposal) return [];
      const { provenance } = proposal;
      if (!provenance) return [];
      if (provenance.source === "external_content" && provenance.authorityClaimed) {
        return [
          violation(
            META_TRUST_01,
            "UNTRUSTED_AUTHORITY_CLAIM",
            "External content attempted to claim authority.",
          ),
        ];
      }
      return [];
    },
    normalize(state: GravityState, violations: LawViolation[]): GravityState {
      if (violations.length === 0) return state;
      // Normalization for META.TRUST.01 is conceptual only here.
      // In the private runtime, this would downgrade any external authority claims to null.
      return state;
    },
  };
}

/**
 * META.AUTHORITY.01
 * Prompt/model text cannot self-approve or self-authorize.
 */
export function createMetaAuthoritySkill(): LawSkill {
  return {
    id: META_AUTHORITY_01,
    validate(state: GravityState, event: GravityEvent): LawViolation[] {
      const proposal = asProposal(event);
      if (!proposal) return [];
      const { provenance } = proposal;
      if (!provenance) return [];
      if (provenance.source === "agent_inference" && provenance.authorityClaimed) {
        return [
          violation(
            META_AUTHORITY_01,
            "MODEL_SELF_AUTHORIZATION",
            "Agent/model inference attempted to self-authorize.",
          ),
        ];
      }
      return [];
    },
    normalize(state: GravityState, violations: LawViolation[]): GravityState {
      if (violations.length === 0) return state;
      return state;
    },
  };
}

/**
 * META.SCOPE.01
 * Prompt text cannot widen session scope (paths, recipients, domains, tools).
 */
export function createMetaScopeSkill(): LawSkill {
  return {
    id: META_SCOPE_01,
    validate(state: GravityState, event: GravityEvent): LawViolation[] {
      const proposal = asProposal(event);
      if (!proposal) return [];
      const { provenance } = proposal;
      if (!provenance) return [];
      if (provenance.requestsScopeExpansion) {
        return [
          violation(
            META_SCOPE_01,
            "ILLEGAL_SCOPE_EXPANSION_REQUEST",
            "Proposal attempted to expand scope via text.",
          ),
        ];
      }
      return [];
    },
    normalize(state: GravityState, violations: LawViolation[]): GravityState {
      if (violations.length === 0) return state;
      return state;
    },
  };
}

/**
 * META.LAW.01
 * Prompt text cannot mutate law.
 */
export function createMetaLawSkill(): LawSkill {
  return {
    id: META_LAW_01,
    validate(state: GravityState, event: GravityEvent): LawViolation[] {
      const proposal = asProposal(event);
      if (!proposal) return [];
      const { provenance } = proposal;
      if (!provenance) return [];
      if (provenance.requestsLawMutation) {
        return [
          violation(
            META_LAW_01,
            "PROMPT_LAW_MUTATION_REQUEST",
            "Prompt attempted to mutate law via text.",
          ),
        ];
      }
      return [];
    },
    normalize(state: GravityState, violations: LawViolation[]): GravityState {
      if (violations.length === 0) return state;
      return state;
    },
  };
}

/**
 * META.SESSION.01
 * Prompt text cannot revive ended sessions.
 */
export function createMetaSessionSkill(): LawSkill {
  return {
    id: META_SESSION_01,
    validate(state: GravityState, event: GravityEvent): LawViolation[] {
      const proposal = asProposal(event);
      if (!proposal) return [];
      const { provenance } = proposal;
      if (!provenance) return [];
      if (provenance.requestsSessionRevival) {
        return [
          violation(
            META_SESSION_01,
            "PROMPT_SESSION_REVIVAL_REQUEST",
            "Prompt attempted to revive an ended session.",
          ),
        ];
      }
      return [];
    },
    normalize(state: GravityState, violations: LawViolation[]): GravityState {
      if (violations.length === 0) return state;
      return state;
    },
  };
}

/**
 * META.LEDGER.01
 * Prompt text cannot bypass/suppress/rewrite the ledger; incomplete traces are non-authoritative.
 */
export function createMetaLedgerSkill(): LawSkill {
  return {
    id: META_LEDGER_01,
    validate(state: GravityState, event: GravityEvent): LawViolation[] {
      const violations: LawViolation[] = [];
      const proposal = asProposal(event);

      if (proposal?.provenance?.requestsLedgerBypass) {
        violations.push(
          violation(
            META_LEDGER_01,
            "LEDGER_BYPASS_REQUEST",
            "Proposal attempted to bypass or suppress ledger recording.",
          ),
        );
      }

      return violations;
    },
    normalize(state: GravityState, violations: LawViolation[]): GravityState {
      if (violations.length === 0) return state;
      // In the private runtime, this normalization would downgrade any affected proposals to null
      // and potentially trigger audit routines. Here we keep state unchanged; behavior is defined
      // by outer runtime + concrete integrations.
      return state;
    },
  };
}

/**
 * META.CONTACT.01
 * A distinguishable difference is not computation until it is registered with
 * provenance, identity, and a non-empty contact surface.
 */
export function createMetaContactSkill(): LawSkill {
  return {
    id: META_CONTACT_01,
    validate(_state: GravityState, event: GravityEvent): LawViolation[] {
      const proposal = asProposal(event);
      if (!proposal) return [];

      const violations: LawViolation[] = [];
      if (!proposal.provenance?.source) {
        violations.push(
          violation(
            META_CONTACT_01,
            "UNREGISTERED_DIFFERENCE_SOURCE",
            "Difference reached gravity without a registered provenance source.",
          ),
        );
      }
      if (!hasTrackedOrigin(proposal)) {
        violations.push(
          violation(
            META_CONTACT_01,
            "UNTRACKED_DIFFERENCE_ORIGIN",
            "Difference reached gravity without a tracked origin identifier.",
          ),
        );
      }
      if (!hasNonEmptyScopeIdentifier(proposal)) {
        violations.push(
          violation(
            META_CONTACT_01,
            "EMPTY_CONTACT_SURFACE",
            "Difference reached gravity without a non-empty contact surface.",
          ),
        );
      }
      return violations;
    },
    normalize(state: GravityState, violations: LawViolation[]): GravityState {
      if (violations.length === 0) return state;
      return state;
    },
  };
}

function isTrustedContinuationSource(source: GravityProposal["provenance"]["source"]): boolean {
  return source === "trusted_user" || source === "trusted_system";
}

function validateContinuationProposal(state: GravityState, proposal: GravityProposal): LawViolation[] {
  if (
    proposal.kind !== "grant_update" &&
    proposal.kind !== "law_update" &&
    proposal.kind !== "session_lifecycle"
  ) {
    return [];
  }

  const violations: LawViolation[] = [];
  if (!isTrustedContinuationSource(proposal.provenance.source)) {
    violations.push(
      violation(
        META_CONTINUATION_01,
        "UNTRUSTED_CONTINUATION_SOURCE",
        "Self-originated continuation must come from trusted user or trusted system provenance.",
      ),
    );
  }
  if (!state.context.ledger.sessionTraceComplete) {
    violations.push(
      violation(
        META_CONTINUATION_01,
        "CONTINUATION_TRACE_INCOMPLETE",
        "Continuation cannot advance while session trace completeness is broken.",
      ),
    );
  }
  return violations;
}

function validateGrantEvent(event: Extract<GravityEvent, { kind: "GrantIssued" | "GrantRevoked" | "GrantExpired" }>): LawViolation[] {
  const violations: LawViolation[] = [];
  if (event.grant.scope.trim().length === 0) {
    violations.push(
      violation(
        META_CONTINUATION_01,
        "EMPTY_GRANT_SCOPE",
        "Grant continuation reached gravity with an empty scope.",
      ),
    );
  }
  if (event.grant.kind === "other") {
    violations.push(
      violation(
        META_CONTINUATION_01,
        "UNSCOPED_GRANT_KIND",
        "Grant continuation must not use the unscoped 'other' kind.",
      ),
    );
  }
  if (event.grant.expiresAt != null && event.grant.expiresAt < event.grant.issuedAt) {
    violations.push(
      violation(
        META_CONTINUATION_01,
        "GRANT_TIME_INVERSION",
        "Grant continuation reached gravity with expiresAt before issuedAt.",
      ),
    );
  }
  if (event.kind === "GrantIssued" && event.grant.revokedAt != null) {
    violations.push(
      violation(
        META_CONTINUATION_01,
        "ISSUED_GRANT_ALREADY_REVOKED",
        "Grant issuance reached gravity already carrying a revokedAt marker.",
      ),
    );
  }
  if ((event.kind === "GrantRevoked" || event.kind === "GrantExpired") && event.grant.revokedAt == null) {
    violations.push(
      violation(
        META_CONTINUATION_01,
        "UNMARKED_GRANT_CONTINUATION",
        "Grant revocation/expiry reached gravity without a revokedAt marker.",
      ),
    );
  }
  return violations;
}

/**
 * META.CONTINUATION.01
 * Re-entry and self-originated Buccet state transitions must re-hit gravity as
 * trusted, trace-complete continuations before they become live state.
 */
export function createMetaContinuationSkill(): LawSkill {
  return {
    id: META_CONTINUATION_01,
    validate(state: GravityState, event: GravityEvent): LawViolation[] {
      const proposal = asProposal(event);
      if (proposal) {
        return validateContinuationProposal(state, proposal);
      }

      switch (event.kind) {
        case "SessionStarted":
        case "SessionRestored":
        case "SessionEnded": {
          const violations: LawViolation[] = [];
          if (event.sessionId !== state.identity.id) {
            violations.push(
              violation(
                META_CONTINUATION_01,
                "SESSION_IDENTITY_DRIFT",
                "Session lifecycle event reached gravity with a mismatched identity.",
              ),
            );
          }
          if (event.kind === "SessionRestored" && !state.context.ledger.sessionTraceComplete) {
            violations.push(
              violation(
                META_CONTINUATION_01,
                "RESTORE_TRACE_INCOMPLETE",
                "Session restore reached gravity without a complete session trace.",
              ),
            );
          }
          return violations;
        }
        case "GrantIssued":
        case "GrantRevoked":
        case "GrantExpired":
          return validateGrantEvent(event);
        case "CrashRecovered":
        case "SnapshotRestored":
          return state.context.ledger.sessionTraceComplete
            ? []
            : [
                violation(
                  META_CONTINUATION_01,
                  "RECOVERY_TRACE_INCOMPLETE",
                  "Crash/snapshot recovery reached gravity without a complete session trace.",
                ),
              ];
        case "LedgerIntegrityUpdated":
          return event.ledger.sessionTraceComplete && event.ledger.requestTraceComplete
            ? []
            : [
                violation(
                  META_CONTINUATION_01,
                  "LEDGER_INTEGRITY_INCOMPLETE",
                  "Ledger integrity update reached gravity in an incomplete state.",
                ),
              ];
        default:
          return [];
      }
    },
    normalize(state: GravityState, violations: LawViolation[]): GravityState {
      if (violations.length === 0) return state;
      return state;
    },
  };
}

/**
 * SCOPE.GRANT.CLOSED
 * Proposal targets a path/recipient/domain/tool that is not in the session's granted scope.
 * Violations are grantable: executor must ledger blocked + emit bodyguard "open this and make it law? yes/no".
 */
export function createScopeGrantSkill(): LawSkill {
  return {
    id: SCOPE_GRANT_CLOSED,
    validate(state: GravityState, event: GravityEvent): LawViolation[] {
      const proposal = asProposal(event);
      if (!proposal) return [];
      const payload = proposal.payload as Partial<ScopePayload> | undefined;
      const scopeId = payload?.scopeIdentifier;
      const scopeKind = payload?.scopeKind;
      if (scopeId == null || scopeKind == null) return [];

      const now = Date.now();
      const hasGrant = state.dynamicLaws.grants.some((g: DynamicLawGrant) => {
        if (g.kind !== scopeKind) return false;
        if (g.revokedAt != null) return false;
        if (g.expiresAt != null && g.expiresAt < now) return false;
        if (scopeKind === "path") {
          return pathGrantMatches(g.scope, scopeId, g.exactOnly);
        }
        if (g.scope !== scopeId) return false;
        return true;
      });
      if (hasGrant) return [];

      const code = SCOPE_VIOLATION_CODES[scopeKind];
      const actionLabel = payload?.actionLabel ?? "access";
      return [
        {
          lawId: SCOPE_GRANT_CLOSED,
          code,
          message: `This ${scopeKind} is not in current law. Open it and make it law?`,
          scopeIdentifier: scopeId,
          scopeKind,
        },
      ];
    },
    normalize(state: GravityState, violations: LawViolation[]): GravityState {
      if (violations.length === 0) return state;
      return state;
    },
  };
}
