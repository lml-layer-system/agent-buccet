/**
 * Session identifier; kept as string for minimal kernel (no ACP SDK required).
 */
export type GravitySessionId = string;

/**
 * Core identity for the protected Agent Buccet entity.
 */
export interface GravityIdentity {
  /**
   * Stable identifier for the logical agent / system being protected.
   */
  id: string;
  /**
   * Optional human-readable label or title.
   */
  label?: string;
}

/**
 * Source provenance for a proposal or event.
 * This intentionally mirrors ACP concepts like trusted_user, agent_inference, etc.
 */
export type GravityProvenanceSource =
  | "trusted_user"
  | "trusted_system"
  | "remote_user"
  | "agent_inference"
  | "tool_output"
  | "external_content";

export interface GravityProvenance {
  source: GravityProvenanceSource;
  /**
   * Identifier for the originating session, when applicable.
   */
  sessionId?: GravitySessionId;
  /**
   * Free-form identifier for the origin (channel, framework, etc.).
   */
  originId?: string;
  /**
   * Defensive flags inferred from text or context.
   * These are used by time-laws like TIME.TRUST / TIME.AUTHORITY / TIME.SCOPE / TIME.LAW / TIME.SESSION / TIME.LEDGER.
   */
  authorityClaimed?: boolean;
  claimsCompleteCoverage?: boolean;
  requestsScopeExpansion?: boolean;
  requestsLawMutation?: boolean;
  requestsSessionRevival?: boolean;
  requestsLedgerBypass?: boolean;
}

/**
 * Immutable identifier for a law.
 * Examples: TIME.TRUST.01, TIME.SCOPE.01, GRAVITY.IDENTITY.CANONICAL, etc.
 */
export type LawId = string;

export interface LawViolation {
  lawId: LawId;
  /**
   * Machine-readable code for violation subtype. Required for Bodyguard branching.
   */
  code?: string;
  /**
   * Human-oriented description for bodyguard UI and ledger.
   */
  message?: string;
  /**
   * For grantable scope violations: the exact path/recipient/domain/tool to offer as law.
   * Bodyguard uses this to build the law-choice surface and to replay after a user allows scope as law.
   */
  scopeIdentifier?: string;
  /**
   * Kind of scope when grantable (path, recipient, domain, tool). Omitted for non-grantable violations.
   */
  scopeKind?: DynamicLawGrant["kind"];
}

/**
 * Violation codes that are user-fixable by opening scope as law (bodyguard grant offer).
 * All other codes are non-grantable: Bodyguard should hard-deny and show diagnostics only.
 */
export const GRANTABLE_VIOLATION_CODES = new Set<string>([
  "PATH_OUT_OF_SCOPE",
  "RECIPIENT_OUT_OF_SCOPE",
  "DOMAIN_OUT_OF_SCOPE",
  "TOOL_OUT_OF_SCOPE",
  "DATABASE_OUT_OF_SCOPE",
  "SYSTEM_OUT_OF_SCOPE",
]);

/**
 * Returns true if every violation is grantable (out-of-scope but can be opened as law).
 */
export function isGrantableViolation(v: LawViolation): boolean {
  return v.code != null && GRANTABLE_VIOLATION_CODES.has(v.code);
}

export function allViolationsGrantable(violations: LawViolation[]): boolean {
  return violations.length > 0 && violations.every(isGrantableViolation);
}

/**
 * Static laws are the non-editable base laws of the system.
 * They cannot be modified by prompts or dynamic state.
 */
export interface StaticLawDescriptor {
  id: LawId;
  description?: string;
}

/**
 * Dynamic laws are session-scoped, revocable, and expiring grants.
 * They must still respect static laws and cannot widen them.
 */
export interface DynamicLawGrant {
  id: string;
  kind: "path" | "recipient" | "domain" | "tool" | "database" | "system" | "other";
  scope: string;
  exactOnly?: boolean;
  issuedAt: number;
  expiresAt?: number;
  revokedAt?: number;
}

export interface StaticLawSet {
  laws: StaticLawDescriptor[];
}

export interface DynamicLawSet {
  grants: DynamicLawGrant[];
}

/**
 * Minimal view of ledger state that is relevant to law-skills.
 * Full logging stays in the outer runtime; gravity only needs integrity signals.
 */
export interface LedgerView {
  /**
   * Whether the session trace is complete and trusted.
   */
  sessionTraceComplete: boolean;
  /**
   * Whether the current request trace is complete and trusted.
   */
  requestTraceComplete: boolean;
}

/**
 * Core memory spine reference for gravity.
 * This intentionally stays abstract so that the outer runtime can plug in its own storage.
 */
export interface GravityMemory {
  /**
   * Opaque handle or key the outer runtime can use to locate persistent memory.
   */
  handle: string;
}

/**
 * Current context for enforcement, derived from the outer runtime.
 */
export interface GravityContext {
  ledger: LedgerView;
  provenance?: GravityProvenance;
}

/**
 * Aggregate state protected by the gravity field.
 */
export interface GravityState {
  identity: GravityIdentity;
  staticLaws: StaticLawSet;
  dynamicLaws: DynamicLawSet;
  memory: GravityMemory;
  context: GravityContext;
}

/**
 * Optional payload shape for proposals that have a grantable scope.
 * Executor and scope law-skill use this to evaluate and to build bodyguard grant offers.
 */
export interface ScopePayload {
  /** Exact path (filesystem), recipient id (email/channel), domain (host), or tool id. */
  scopeIdentifier: string;
  scopeKind: DynamicLawGrant["kind"];
  /** Optional action label for bodyguard message, e.g. "read", "delete", "send to". */
  actionLabel?: string;
}

/**
 * Unified representation of a requested change or action.
 * This is the shape that gravity sees; frameworks should project into this.
 */
export interface GravityProposal {
  /**
   * High-level category of the proposal (filesystem, network, tool, session, law, etc.).
   */
  kind:
    | "filesystem"
    | "recipient_send"
    | "network_send"
    | "tool_exec"
    | "database"
    | "system"
    | "session_lifecycle"
    | "grant_update"
    | "law_update"
    | "other";
  /**
   * Opaque payload interpreted by outer runtime + specific law-skills.
   * For scope-checked actions, use ScopePayload (or include scopeIdentifier/scopeKind) so scope law can run.
   */
  payload: unknown;
  provenance: GravityProvenance;
}

export type GravityEventKind =
  | "SessionStarted"
  | "SessionRestored"
  | "SessionEnded"
  | "GrantIssued"
  | "GrantRevoked"
  | "GrantExpired"
  | "ProposalReceived"
  | "LedgerIntegrityUpdated"
  | "CrashRecovered"
  | "SnapshotRestored";

export interface GravityEventBase {
  kind: GravityEventKind;
  ts: number;
}

export interface ProposalReceivedEvent extends GravityEventBase {
  kind: "ProposalReceived";
  proposal: GravityProposal;
}

export interface GrantEvent extends GravityEventBase {
  kind: "GrantIssued" | "GrantRevoked" | "GrantExpired";
  grant: DynamicLawGrant;
}

export interface SessionLifecycleEvent extends GravityEventBase {
  kind: "SessionStarted" | "SessionRestored" | "SessionEnded";
  sessionId: GravitySessionId;
}

export interface LedgerIntegrityUpdatedEvent extends GravityEventBase {
  kind: "LedgerIntegrityUpdated";
  ledger: LedgerView;
}

export interface CrashOrSnapshotEvent extends GravityEventBase {
  kind: "CrashRecovered" | "SnapshotRestored";
}

export type GravityEvent =
  | ProposalReceivedEvent
  | GrantEvent
  | SessionLifecycleEvent
  | LedgerIntegrityUpdatedEvent
  | CrashOrSnapshotEvent;

/**
 * - allow: No violations; proposal is eligible for execution.
 * - null: Only grantable scope violations (e.g. path/recipient/tool out of scope). Bodyguard must ledger blocked and surface the four-way bodyguard law choice.
 * - deny: At least one non-grantable violation (meta-law, ledger, etc.). Bodyguard must block and show diagnostics; no grant offer.
 * - transform: Proposal was normalized to a lawful shape (e.g. path clamped); Bodyguard may use the transformed proposal.
 */
export type EnforcementDecision = "allow" | "transform" | "deny" | "null";

export interface EnforcementResult {
  decision: EnforcementDecision;
  /**
   * The post-enforcement state. For idempotence, this should always converge toward a canonical form.
   */
  state: GravityState;
  /**
   * If the proposal was transformed (for example, clamped to a narrower path), this is the new proposal.
   */
  proposal?: GravityProposal;
  /**
   * Rich violations: lawId, code, message, and for grantable scope violations, scopeIdentifier + scopeKind.
   */
  violations: LawViolation[];
}

/**
 * Law-skills are immutable governing primitives.
 * They must be safe to run repeatedly and must not widen static law.
 */
export interface LawSkill {
  id: LawId;
  /**
   * Inspect state + event and emit any violations.
   * This MUST be pure and side-effect free.
   */
  validate: (state: GravityState, event: GravityEvent) => LawViolation[];
  /**
   * Normalize state in response to violations, converging toward a canonical lawful configuration.
   * This MUST be idempotent: applying it multiple times should not compound changes.
   */
  normalize: (state: GravityState, violations: LawViolation[]) => GravityState;
}

/**
 * Bridge between the gravity kernel and the outer runtime.
 */
export interface GravityKernelDeps {
  /**
   * Load the last known state (snapshot + recovery as needed).
   */
  loadState: () => Promise<GravityState>;
  /**
   * Persist the current state. This should be crash-safe when combined with the ledger.
   */
  saveState: (state: GravityState) => Promise<void>;
  /**
   * Blocking or async event source. The kernel sleeps while waiting here.
   */
  nextEvent: () => Promise<GravityEvent>;
  /**
   * Optional heartbeat to signal liveness and basic metrics.
   */
  emitHeartbeat?: (meta: { lastEventAt: number; lastDecision: EnforcementDecision }) => void;
  /**
   * Fatal error signal to the supervisor. The supervisor is responsible for restart semantics.
   */
  emitPanic?: (error: unknown) => void;
}
