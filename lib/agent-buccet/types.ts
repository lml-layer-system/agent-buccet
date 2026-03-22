import type { BoundaryGravityService } from "./gravity-adapter/gravity-service.ts";

/**
 * The set of action kinds the boundary runtime can intercept and evaluate.
 * Every proposed action must declare its kind so the law engine can apply
 * the correct law set and scope checks.
 */
export type BoundaryActionKind =
  | "fs.read"
  | "fs.write"
  | "fs.append"
  | "fs.delete"
  | "fs.mkdir"
  | "fs.move"
  | "comm.send"
  | "tool.exec"
  | "network.send"
  | "db.query"
  | "db.insert"
  | "db.update"
  | "db.delete"
  | "sys.env.read"
  | "sys.env.write"
  | "sys.config.read"
  | "sys.config.write"
  | "sys.credential.read"
  | "sys.credential.use";

/**
 * The outcome of law evaluation for a proposed action.
 * - `"allow"` — action is admitted; execute if an `execute` function is provided.
 * - `"deny"` — action is blocked; do not execute.
 * - `"require_approval"` — action requires explicit user approval before execution.
 */
export type BoundaryDecision = "allow" | "deny" | "require_approval";

export type BoundaryResourceKind =
  | "path"
  | "recipient"
  | "domain"
  | "tool"
  | "database"
  | "system";

export type BoundaryProcessPolicy = {
  allowedCommands?: string[];
  blockedCommands?: string[];
  allowedEnvVars?: string[];
  allowedEnvPrefixes?: string[];
  blockedEnvVars?: string[];
  inheritParentEnv?: boolean;
  enforceScopedCwd?: boolean;
};

/**
 * The trust level of the source of a proposed action.
 * Actions from `agent_inference`, `tool_output`, or `external_content` are
 * considered untrusted and may trigger additional law checks (see TIME.TRUST.01).
 */
export type BoundaryRequestProvenance =
  | "trusted_user"
  | "trusted_system"
  | "remote_user"
  | "agent_inference"
  | "tool_output"
  | "external_content";

/**
 * An active boundary session. Sessions are the root of all scope and grant
 * management. A session must be active for any action to be admitted.
 *
 * Sessions persist across process restarts. If the session state file is
 * missing, the ledger is used for recovery. Sessions end explicitly via
 * `endPersistentBoundarySession` — process exit does not close a session.
 */
export type BoundarySession = {
  sessionId: string;
  actorId: string;
  createdAt: string;
  expiresAt?: string;
  dryRun: boolean;
  persistent: boolean;
  status: "active" | "ended";
  endedAt?: string;
};

/**
 * A grant is the explicit authorization for a session to access a specific
 * resource. Grants are issued by the user via `openBoundaryPath` or
 * `issueBoundaryGrant`. Without an active, non-revoked grant covering the
 * target resource, all actions are denied by the scope check.
 *
 * Grants can be time-limited (`expiresAt`) and are revocable at any time.
 * Revocation takes effect immediately and persists across restarts.
 */
export type BoundaryGrant = {
  grantId: string;
  sessionId: string;
  resourceKind: BoundaryResourceKind;
  resourceValue: string;
  grantedActions: BoundaryActionKind[];
  issuedBy: string;
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type BoundaryPathLaw = {
  lawId: string;
  sessionId: string;
  rootPath: string;
  grantedActions: BoundaryActionKind[];
  issuedBy: string;
  instantiatedAt: string;
  expiresAt?: string;
  revokedAt?: string;
};

export type BoundaryActionRequest = {
  requestId: string;
  sessionId: string;
  actionKind: BoundaryActionKind;
  target: string;
  payloadSummary?: string;
  requestedAt: string;
  provenance: BoundaryRequestProvenance;
  flags?: {
    authorityClaimed?: boolean;
    claimsCompleteCoverage?: boolean;
    requestsScopeExpansion?: boolean;
    requestsLawMutation?: boolean;
    requestsSessionRevival?: boolean;
    requestsLedgerBypass?: boolean;
  };
};

/**
 * The result produced by a single `BoundaryLaw.evaluate()` call, or by the
 * full law evaluation pipeline in `evaluateBoundaryLaws`.
 *
 * A result of `null` from `evaluate()` means the law has no opinion on the
 * request. A non-null result is decisive — `"deny"` short-circuits the pipeline.
 */
export type BoundaryLawResult = {
  decision: BoundaryDecision;
  reason: string;
  triggeredLawIds: string[];
  requiresApproval: boolean;
};

/**
 * A typed policy evaluator. Laws form the core of the boundary enforcement
 * engine. Each law is evaluated in order for every proposed action.
 *
 * Law evaluation rules:
 * - Return `null` to abstain (law has no opinion on this action).
 * - Return `{ decision: "deny" }` to block immediately (short-circuits remaining laws).
 * - Return `{ decision: "require_approval" }` to require user approval.
 * - Return `{ decision: "allow" }` to explicitly allow (overrides later deny laws).
 *
 * Laws must be deterministic and side-effect-free.
 *
 * @example
 * ```typescript
 * const myLaw: BoundaryLaw = {
 *   lawId: "MY.LAW.01",
 *   description: "Block writes to config directory.",
 *   appliesTo: ["fs.write"],
 *   evaluate: ({ request }) => {
 *     if (!request.target.includes("/.config/")) return null;
 *     return { decision: "deny", reason: "config directory is protected",
 *              triggeredLawIds: ["MY.LAW.01"], requiresApproval: false };
 *   },
 * };
 * ```
 */
export type BoundaryLaw = {
  lawId: string;
  description: string;
  appliesTo: BoundaryActionKind[] | ["*"];
  evaluate: (input: {
    session: BoundarySession;
    request: BoundaryActionRequest;
    activeGrants: BoundaryGrant[];
  }) => BoundaryLawResult | null;
};

export type NslMoveKind =
  | "open_path"
  | "open_as_law"
  | "grant_write"
  | "grant_delete"
  | "grant_recipient"
  | "grant_exec"
  | "grant_network"
  | "grant_database"
  | "grant_system"
  | "review_ledger"
  | "deny_and_explain"
  | "dry_run_preview";

export type NslMove = {
  moveId: string;
  kind: NslMoveKind;
  title: string;
  description: string;
  target?: string;
  expiresAt?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type BoundaryLedgerEventType =
  | "SESSION_STARTED"
  | "SESSION_RESTORED"
  | "SESSION_PERSISTED"
  | "SESSION_ENDED"
  | "PATH_OPENED"
  | "PATH_LAW_INSTANTIATED"
  | "GRANT_ISSUED"
  | "GRANT_REVOKED"
  | "GRANT_EXPIRED"
  | "ACTION_PROPOSED"
  | "DECISION_RETURNED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_GRANTED"
  | "APPROVAL_DENIED"
  | "ACTION_EXECUTED"
  | "ACTION_BLOCKED"
  | "NSL_GRANT_OFFERED"
  | "USER_CONFIRMED_DENY"
  | "RECIPIENT_OPENED"
  | "RECIPIENT_LAW_INSTANTIATED"
  | "DOMAIN_OPENED"
  | "DOMAIN_LAW_INSTANTIATED"
  | "TOOL_OPENED"
  | "TOOL_LAW_INSTANTIATED"
  | "DATABASE_OPENED"
  | "DATABASE_LAW_INSTANTIATED"
  | "SYSTEM_OPENED"
  | "SYSTEM_LAW_INSTANTIATED"
  | "PROPOSAL_REPLAYED"
  | "PROCESS_LAUNCH_REQUESTED"
  | "PROCESS_SPAWNED"
  | "PROCESS_EXITED"
  | "PROCESS_BLOCKED"
  | "PROCESS_ENV_FILTERED"
  | "NSL_MOVE_SUGGESTED"
  | "NSL_MOVE_CHOSEN"
  | "UPL_LAW_APPROVED"
  | "UPL_LAW_DENIED";

export type BoundaryLedgerPayload = {
  sessionId: string;
  actorId: string;
  requestId?: string;
  grantId?: string;
  moveId?: string;
  actionKind?: BoundaryActionKind;
  target?: string;
  decision?: BoundaryDecision;
  reason: string;
  lawIds?: string[];
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
};

export type BoundaryLedgerMeta = {
  id: string;
  timestamp: string;
  hash: string;
  prev_hash: string;
  session_id: string;
  depth: number;
  event_type: BoundaryLedgerEventType;
  signature_algo?: "ed25519";
  signer_id?: string;
  signature?: string;
  signed_at?: string;
};

export type BoundaryLedgerInput = {
  source: string;
  action: string;
  target: string;
  params: Record<string, string | number | boolean>;
  raw_request?: string;
};

export type BoundaryLedgerDecisionVerdict =
  | "ALLOW"
  | "DENY"
  | "REQUIRE_APPROVAL"
  | "PENDING";

export type BoundaryLedgerDecisionBlock = {
  verdict: BoundaryLedgerDecisionVerdict;
  reason: string;
  law_triggered: string | null;
  confidence: number;
};

export type BoundaryLedgerPathBlock = {
  scope_check: {
    scope_id?: string;
    path_matched?: string;
    result: string;
  };
  laws_evaluated: Array<{
    law: string;
    result: string;
    ms?: number;
  }>;
  path_through_system: string[];
  total_eval_ms?: number;
};

export type BoundaryLedgerNextOutcome =
  | "EXECUTED"
  | "BLOCKED"
  | "QUEUED"
  | "WAITING";

export type BoundaryLedgerNextBlock = {
  outcome: BoundaryLedgerNextOutcome;
  next_state: string;
  execution_ms?: number;
  approval_id?: string | null;
};

export type BoundaryLedgerOptionsBlock = {
  dormant_laws: Array<{
    law: string;
    status: "DISABLED" | "AVAILABLE";
    enable_cmd?: string;
  }>;
  available_scopes: Array<{
    scope: string;
    status: "CLOSED" | "AVAILABLE";
  }>;
  user_discretion: string[];
};

export type BoundaryLedgerRecord = {
  index: number;
  eventType: BoundaryLedgerEventType;
  payload: BoundaryLedgerPayload;
  META: BoundaryLedgerMeta;
  INPUT: BoundaryLedgerInput;
  DECISION: BoundaryLedgerDecisionBlock;
  PATH: BoundaryLedgerPathBlock;
  NEXT: BoundaryLedgerNextBlock;
  OPTIONS: BoundaryLedgerOptionsBlock;
};

export type BoundaryLedgerCheckpoint = {
  checkpoint_id: string;
  generated_at: string;
  signer_id: string;
  signature_algo: "ed25519";
  total_records: number;
  latest_record_id?: string;
  latest_record_hash?: string;
  chain_ok: boolean;
  cryptographic_ok: boolean;
  signature: string;
};

export type BoundaryUplEntryType = "APPROVED" | "DENIED";
export type BoundaryUplScope = "SESSION" | "GLOBAL" | "DOMAIN";
export type BoundaryUplStatus = "ACTIVE" | "MUTED" | "DELETED";

export type BoundaryUplEntry = {
  id: string;
  type: BoundaryUplEntryType;
  path: string;
  pathHash: string;
  createdAt: string;
  scope: BoundaryUplScope;
  status: BoundaryUplStatus;
  witness: string;
  modifiedAt?: string | null;
  notes?: string | null;
  sessionId?: string;
  domain?: string;
};

export type BoundaryUserPathLedger = {
  specVersion: 1;
  userApprovedLawPaths: BoundaryUplEntry[];
  userDeniedLawPaths: BoundaryUplEntry[];
};

export type BoundaryRuntimeMuscleManifest = {
  generatedAt: string;
  activeBaseLawCount: number;
  activeTimeLawCount: number;
  activeLawBodyCount: number;
  substrateFamilyCount: number;
  substrateSourceKernelCount: number;
  hashes: {
    runtimeSubstrateSha256: string;
    materializedActiveLawBodySha256: string;
  };
  sizes: {
    runtimeSubstrateBytes: number;
    materializedActiveLawBodyBytes: number;
  };
  artifactPaths: {
    substrate: string;
    activeLawBodySource: string;
  };
};

export type BoundaryRuntimeMuscleFamily = {
  familyId: string;
  familyTitle: string;
  status: string;
  kind?: string;
  familyCompressedLaw: string;
  sourceRowCount: number;
};

export type BoundaryRuntimeMuscle = {
  manifest: BoundaryRuntimeMuscleManifest;
  base: {
    layerIds: string[];
    families: BoundaryRuntimeMuscleFamily[];
  };
  time: {
    layerIds: string[];
    family: BoundaryRuntimeMuscleFamily;
  };
};

/**
 * Observability hooks that fire at key boundary enforcement events.
 * All hooks are optional and non-blocking — a thrown hook error will
 * propagate and should be handled by the caller.
 */
export type BoundaryRuntimeHooks = {
  /**
   * Fires before any law evaluation or scope check for the given request.
   * Use this to start traces, record request metadata, or log proposals.
   */
  onBeforeAction?: (request: BoundaryActionRequest) => void | Promise<void>;
  /**
   * Fires after enforcement completes (allow or deny) for the given request.
   * Use this to record metrics, close traces, or emit audit events.
   */
  onAfterAction?: (
    request: BoundaryActionRequest,
    outcome: { allowed: boolean; executed: boolean; reason: string },
  ) => void | Promise<void>;
  /**
   * Fires when an approval request is dispatched to the approval handler.
   * Use this to send notifications or record pending approval state.
   */
  onApprovalRequested?: (approval: BoundaryApprovalRequest) => void | Promise<void>;
};

/**
 * The complete runtime configuration for a boundary enforcement session.
 * This object is the primary carrier of session state, active laws, grants,
 * and behavioral configuration. It is immutable-by-convention — functions
 * that mutate state return a new config rather than modifying in place.
 *
 * Construct this via `startPersistentBoundarySession` or
 * `restorePersistentBoundarySession`. Use `createBoundaryBodyguard` for
 * the primary integration surface.
 */
export type BoundaryRuntimeConfig = {
  session: BoundarySession;
  laws: BoundaryLaw[];
  grants: BoundaryGrant[];
  pathLaws: BoundaryPathLaw[];
  approvalRequiredFor: BoundaryActionKind[];
  userLawIds?: string[];
  upl?: BoundaryUserPathLedger;
  runtimeMuscle?: BoundaryRuntimeMuscle;
  persistence?: BoundaryPersistenceConfig;
  approvalHandler?: BoundaryApprovalHandler;
  gravityService?: BoundaryGravityService;
  processPolicy?: BoundaryProcessPolicy;
  /**
   * Observability hooks. See `BoundaryRuntimeHooks` for available hooks.
   */
  hooks?: BoundaryRuntimeHooks;
  /**
   * Maximum milliseconds to wait for the approval handler to resolve.
   * If the handler does not resolve within this window, the behavior is
   * controlled by `approvalTimeoutBehavior`.
   *
   * Default: `undefined` (no timeout — waits indefinitely).
   */
  approvalTimeoutMs?: number;
  /**
   * What to do when `approvalTimeoutMs` is exceeded.
   * - `"deny"` — treat the approval as denied and continue (default).
   * - `"throw"` — throw a `BoundaryApprovalTimeoutError`.
   *
   * Default: `"deny"`.
   */
  approvalTimeoutBehavior?: "deny" | "throw";
};

export type BoundaryPersistenceConfig = {
  enabled: boolean;
  sessionsDir?: string;
};

export type BoundaryPersistedSessionState = {
  schemaVersion: 1;
  session: BoundarySession;
  grants: BoundaryGrant[];
  pathLaws: BoundaryPathLaw[];
  approvalRequiredFor: BoundaryActionKind[];
  userLawIds: string[];
  processPolicy?: BoundaryProcessPolicy;
  savedAt: string;
};

export type BoundaryApprovalRequest = {
  session: BoundarySession;
  request: BoundaryActionRequest;
  reason: string;
  lawIds: string[];
  nslMoves: NslMove[];
};

export type BoundaryApprovalDecision = {
  approved: boolean;
  persistDenied?: boolean;
  scope?: BoundaryUplScope;
  notes?: string | null;
  domain?: string;
};

export type BoundaryApprovalHandler = (
  approval: BoundaryApprovalRequest,
) => Promise<boolean | BoundaryApprovalDecision> | boolean | BoundaryApprovalDecision;

export type BoundaryPolicyConfig = {
  approvalRequiredFor?: BoundaryActionKind[];
  grants?: Array<{
    resourceKind: BoundaryResourceKind;
    resourceValue: string;
    grantedActions: BoundaryActionKind[];
    expiresAt?: string;
    metadata?: Record<string, string | number | boolean>;
  }>;
  laws?: string[];
  process?: BoundaryProcessPolicy;
};
