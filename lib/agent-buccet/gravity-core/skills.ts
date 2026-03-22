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
 * These mirror the public TIME.* family described in the design notes.
 */
export const TIME_TRUST_01: LawId = "TIME.TRUST.01";
export const TIME_AUTHORITY_01: LawId = "TIME.AUTHORITY.01";
export const TIME_SCOPE_01: LawId = "TIME.SCOPE.01";
export const TIME_LAW_01: LawId = "TIME.LAW.01";
export const TIME_SESSION_01: LawId = "TIME.SESSION.01";
export const TIME_LEDGER_01: LawId = "TIME.LEDGER.01";

/**
 * Scope law: path/recipient/domain/tool must be in dynamic laws (opened as law).
 * Violations from this skill are grantable: executor surfaces NSL "open as law? yes/no".
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

/**
 * TIME.TRUST.01
 * Untrusted content cannot directly authorize high-risk actions.
 */
export function createTimeTrustSkill(): LawSkill {
  return {
    id: TIME_TRUST_01,
    validate(state: GravityState, event: GravityEvent): LawViolation[] {
      const proposal = asProposal(event);
      if (!proposal) return [];
      const { provenance } = proposal;
      if (!provenance) return [];
      if (provenance.source === "external_content" && provenance.authorityClaimed) {
        return [
          violation(
            TIME_TRUST_01,
            "UNTRUSTED_AUTHORITY_CLAIM",
            "External content attempted to claim authority.",
          ),
        ];
      }
      return [];
    },
    normalize(state: GravityState, violations: LawViolation[]): GravityState {
      if (violations.length === 0) return state;
      // Normalization for TIME.TRUST.01 is conceptual only here.
      // In the private runtime, this would downgrade any external authority claims to null.
      return state;
    },
  };
}

/**
 * TIME.AUTHORITY.01
 * Prompt/model text cannot self-approve or self-authorize.
 */
export function createTimeAuthoritySkill(): LawSkill {
  return {
    id: TIME_AUTHORITY_01,
    validate(state: GravityState, event: GravityEvent): LawViolation[] {
      const proposal = asProposal(event);
      if (!proposal) return [];
      const { provenance } = proposal;
      if (!provenance) return [];
      if (provenance.source === "agent_inference" && provenance.authorityClaimed) {
        return [
          violation(
            TIME_AUTHORITY_01,
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
 * TIME.SCOPE.01
 * Prompt text cannot widen session scope (paths, recipients, domains, tools).
 */
export function createTimeScopeSkill(): LawSkill {
  return {
    id: TIME_SCOPE_01,
    validate(state: GravityState, event: GravityEvent): LawViolation[] {
      const proposal = asProposal(event);
      if (!proposal) return [];
      const { provenance } = proposal;
      if (!provenance) return [];
      if (provenance.requestsScopeExpansion) {
        return [
          violation(
            TIME_SCOPE_01,
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
 * TIME.LAW.01
 * Prompt text cannot mutate law.
 */
export function createTimeLawSkill(): LawSkill {
  return {
    id: TIME_LAW_01,
    validate(state: GravityState, event: GravityEvent): LawViolation[] {
      const proposal = asProposal(event);
      if (!proposal) return [];
      const { provenance } = proposal;
      if (!provenance) return [];
      if (provenance.requestsLawMutation) {
        return [
          violation(
            TIME_LAW_01,
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
 * TIME.SESSION.01
 * Prompt text cannot revive ended sessions.
 */
export function createTimeSessionSkill(): LawSkill {
  return {
    id: TIME_SESSION_01,
    validate(state: GravityState, event: GravityEvent): LawViolation[] {
      const proposal = asProposal(event);
      if (!proposal) return [];
      const { provenance } = proposal;
      if (!provenance) return [];
      if (provenance.requestsSessionRevival) {
        return [
          violation(
            TIME_SESSION_01,
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
 * TIME.LEDGER.01
 * Prompt text cannot bypass/suppress/rewrite the ledger; incomplete traces are non-authoritative.
 */
export function createTimeLedgerSkill(): LawSkill {
  return {
    id: TIME_LEDGER_01,
    validate(state: GravityState, event: GravityEvent): LawViolation[] {
      const violations: LawViolation[] = [];
      const proposal = asProposal(event);

      if (proposal?.provenance?.requestsLedgerBypass) {
        violations.push(
          violation(
            TIME_LEDGER_01,
            "LEDGER_BYPASS_REQUEST",
            "Proposal attempted to bypass or suppress ledger recording.",
          ),
        );
      }

      if (!state.context.ledger.sessionTraceComplete) {
        violations.push(
          violation(
            TIME_LEDGER_01,
            "SESSION_TRACE_INCOMPLETE",
            "Session ledger trace is incomplete; actions must not be treated as authoritative.",
          ),
        );
      }

      if (!state.context.ledger.requestTraceComplete) {
        violations.push(
          violation(
            TIME_LEDGER_01,
            "REQUEST_TRACE_INCOMPLETE",
            "Request ledger trace is incomplete; this request must not be treated as authoritative.",
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
 * SCOPE.GRANT.CLOSED
 * Proposal targets a path/recipient/domain/tool that is not in the session's granted scope.
 * Violations are grantable: executor must ledger blocked + emit NSL "open this and make it law? yes/no".
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
        if (g.kind === "path") {
          return scopeId === g.scope || scopeId.startsWith(`${g.scope}/`);
        }
        return g.scope === scopeId;
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
