import type { BoundaryGravityService } from "./gravity-adapter/gravity-service.ts";

export type BoundaryActionKind =
  | "fs.read"
  | "fs.write"
  | "fs.append"
  | "fs.delete"
  | "fs.mkdir"
  | "fs.move"
  | "chat.emit"
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

export type BoundaryDecision = "allow" | "deny" | "require_approval";

export type BoundaryResourceKind =
  | "path"
  | "chat"
  | "recipient"
  | "domain"
  | "tool"
  | "database"
  | "system";

/**
 * Tier 2 — Payload Physics
 *
 * Two enforcement classes with different native shapes:
 *
 * ── Tier 2a: Payload Envelope Physics ───────────────────────────────────────
 * Launch-time ceiling on what a process can BECOME.
 * The kernel terminates or blocks the entire process when it tries to exceed
 * the pre-set envelope. Applied once at spawn; governs the process lifecycle.
 *
 *   wallClockTimeoutMs  Wall-clock timeout → SIGKILL (Node.js, all platforms)
 *   cpuTimeLimitSec     CPU time ceiling → SIGXCPU/SIGKILL or job termination
 *   maxProcesses        Process/thread count ceiling
 *   maxMemoryBytes      Virtual address space ceiling
 *
 * ── Tier 2b: Live I/O / Object Boundary ─────────────────────────────────────
 * Ongoing enforcement on live object creation and I/O operations during
 * execution. The process continues running; constrained operations are denied
 * or throttled per native platform semantics.
 *
 *   maxOpenFiles        Max simultaneous open file descriptors
 *                       POSIX: RLIMIT_NOFILE → EMFILE (refuse semantics)
 *                       Windows: OPEN GAP (no Job Object equiv; warns at runtime)
 *
 *   maxFileSizeBytes    Max file size for any single write/growth
 *                       POSIX: RLIMIT_FSIZE → SIGXFSZ (refuse semantics)
 *                       Windows: OPEN GAP (no Job Object equiv; warns at runtime)
 *
 *   maxIoRateBytesPerSec  I/O bandwidth limit (bytes/sec)
 *                       Windows 10 1607+: Job Object I/O rate control
 *                       (throttle semantics — operations delayed, not refused)
 *                       Linux/macOS: no direct rlimit equivalent; skipped (ledgered)
 *
 *   maxIoOpsPerSec      I/O operations-per-second limit
 *                       Windows 10 1607+: Job Object I/O rate control
 *                       (throttle semantics)
 *                       Linux/macOS: skipped (ledgered)
 *
 * Windows Tier 2b semantic note: the I/O rate control fields use THROTTLE
 * semantics (kernel delays I/O to stay within budget) rather than REFUSE
 * semantics (EMFILE/SIGXFSZ). Both are kernel-enforced live operation
 * boundaries; the enforcement mechanism differs by platform.
 *
 * ── Privilege drop ───────────────────────────────────────────────────────────
 * Drop process uid/gid before exec (Darwin: setgid+setuid; Linux: CAP drop).
 */
export type BoundaryProcessPhysics = {
  // Tier 2a — Payload Envelope Physics
  wallClockTimeoutMs?: number;
  cpuTimeLimitSec?: number;
  maxProcesses?: number;
  maxMemoryBytes?: number;

  // Tier 2b — Live I/O / Object Boundary (POSIX: refuse semantics; Windows: throttle semantics)
  maxOpenFiles?: number;
  maxFileSizeBytes?: number;
  /** I/O bandwidth throttle in bytes/sec. Windows 10 1607+: Job Object I/O rate control.
   *  Linux/macOS: no direct rlimit equivalent — skipped (recorded in physwrap_io_boundary_skipped). */
  maxIoRateBytesPerSec?: number;
  /** I/O operations-per-second throttle. Windows 10 1607+: Job Object I/O rate control.
   *  Linux/macOS: skipped (recorded in physwrap_io_boundary_skipped). */
  maxIoOpsPerSec?: number;

  // Privilege drop
  /** Drop to this uid before exec (Darwin: setuid; Linux: already handled by CAP drop path). */
  dropToUid?: number;
  /** Drop to this gid before exec (Darwin: setgid; paired with dropToUid). */
  dropToGid?: number;
};

export type BoundaryProcessPolicy = {
  allowedCommands?: string[];
  blockedCommands?: string[];
  allowedEnvVars?: string[];
  allowedEnvPrefixes?: string[];
  blockedEnvVars?: string[];
  inheritParentEnv?: boolean;
  enforceScopedCwd?: boolean;
  physics?: BoundaryProcessPhysics;
};

export type BoundaryGovernorConfig = {
  velocity?: {
    maxRpm: number;
    windowMs?: number;
  };
  density?: {
    maxFailureRatio: number;
    windowSize?: number;
  };
  mass?: {
    maxCrossings: number;
  };
  weight?: Partial<Record<BoundaryActionKind, number>>;
};

export type BoundaryGovernorState = {
  crossingTimestamps: number[];
  totalWeightedCrossings: number;
  recentDecisions: boolean[];
};

// ─── Input Admission Boundary ─────────────────────────────────────────────────
// Same doctrine applied inward: deny hostile inbound force before it becomes
// internal motion (tokenization, prompt assembly, inference, API spend).

/** Weight class of an inbound input — not all inputs cost the same. */
export type BoundaryInputWeightClass =
  | "standard"          // weight 1 — normal request
  | "large_prompt"      // weight 4 — body > configured token threshold
  | "attachment"        // weight 6 — binary/media attachment
  | "retrieval_request" // weight 5 — triggers RAG / external retrieval
  | "fanout_request";   // weight 8 — triggers broadcast to multiple targets

/** Strength of provenance evidence — stronger binds tighter and evicts slower. */
export type BoundaryProvenanceStrength = "strong" | "medium" | "weak";

export type BoundaryAdmissionConfig = {
  velocity?: { maxRpm: number; windowMs?: number };
  density?: { maxDenyRatio: number; windowSize?: number };
  mass?: { maxInboundWeight: number; windowMs?: number };
  weight?: Partial<Record<BoundaryInputWeightClass, number>>;
  /** Max number of tracked provenances (LRU). Default 10_000. */
  provenanceMaxSize?: number;
  /** TTL for provenance records that never tripped (ms). Default 300_000 (5 min). */
  provenanceTtlMs?: number;
};

export type BoundaryProvenanceRecord = {
  requestTimestamps: number[];
  recentDecisions: boolean[];   // true = admitted, false = denied
  totalInboundWeight: number;
  windowWeightTimestamps: Array<{ ts: number; weight: number }>;
  lastSeenMs: number;
  /** Cumulative count of tarpit decisions for this provenance.
   *  Feeds the hard block ceiling: weak provenances are forced into canyon hold
   *  after WEAK_PROVENANCE_HARD_BLOCK_CEILING tarpit decisions, regardless of density config. */
  totalDeniedCount: number;
};

export type BoundaryAdmissionState = {
  /** O(1) canyon cache: provenances held at the front line for the session lifetime. */
  canyonProvenances: Record<string, {
    canyonedAt: number;
    reason: string;
    ledgered: boolean;
    /** How canyon hold was triggered. "hard_ceiling" means the hard block ceiling
     *  fired — density config was too loose to catch it first. */
    promotionKind: "density" | "hard_ceiling";
    operatorDisposition?: "deny_as_law";
  }>;
  /** One-shot ingress releases written by Terminal 2. */
  allowOnceProvenances: Record<string, {
    grantedAt: number;
    remaining: number;
  }>;
  /** Standing ingress allows written by Terminal 2. */
  allowedProvenances: Record<string, {
    grantedAt: number;
    reason: string;
  }>;
  /** Bounded density tracking — evicted by TTL/LRU. */
  provenanceRecords: Record<string, BoundaryProvenanceRecord>;
  /**
   * Cumulative tarpit count per provenance — survives TTL/LRU eviction of provenanceRecords.
   *
   * Without this, an IP can accumulate N < WEAK_PROVENANCE_HARD_BLOCK_CEILING tarpit decisions,
   * go quiet long enough for its provenanceRecord to TTL-expire, return, and start a fresh
   * count from 0 — effectively farming the ceiling window indefinitely.
   *
   * hostileDeniedCounts is evicted only by LRU size pressure (evicts lowest-count entries
   * first, keeping the most hostile provenances). It is intentionally NOT TTL-evicted.
   * Once an IP has generated any tarpit decisions it keeps accumulating toward the ceiling.
   */
  hostileDeniedCounts: Record<string, number>;
};

export type BoundaryRequestProvenance =
  | "trusted_user"
  | "trusted_system"
  | "remote_user"
  | "agent_inference"
  | "tool_output"
  | "external_content";

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
    violatesUserConstraint?: boolean;
    groundingMismatch?: boolean;
    claimsActionCompletionWithoutWitness?: boolean;
    claimsUserApproval?: boolean;
    payloadContainsPii?: boolean;
    payloadContainsCredential?: boolean;
    payloadContainsFinancialData?: boolean;
  };
  reviewContext?: BoundaryReviewContext;
};

export type BoundaryLawResult = {
  decision: BoundaryDecision;
  reason: string;
  triggeredLawIds: string[];
  requiresApproval: boolean;
};

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

export type BodyguardMoveKind =
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

export type BodyguardMove = {
  moveId: string;
  kind: BodyguardMoveKind;
  title: string;
  description: string;
  target?: string;
  expiresAt?: string;
  metadata?: Record<string, string | number | boolean>;
};

/** @deprecated use BodyguardMoveKind */
export type NslMoveKind = BodyguardMoveKind;
/** @deprecated use BodyguardMove */
export type NslMove = BodyguardMove;

export type BoundaryReviewContext = {
  surface: "action" | "chat";
  title?: string;
  question?: string;
  actorLabel?: string;
  invariantLawId?: string;
  invariantLabel?: string;
  userInput?: string;
  attemptedOutput?: string;
  attemptLines?: string[];
  evidence?: string[];
  violations?: string[];
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
  | "UPL_ALLOW_RECORDED"
  | "UPL_DENY_RECORDED"
  | "ACTION_EXECUTED"
  | "ACTION_BLOCKED"
  | "BODYGUARD_GRANT_OFFERED"
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
  | "BODYGUARD_MOVE_SUGGESTED"
  | "BODYGUARD_MOVE_CHOSEN"
  | "GOVERNOR_TRIP"
  | "PROCESS_WALL_CLOCK_KILL"
  | "INGRESS_DENIED"
  | "INGRESS_VELOCITY_TRIP"
  | "INGRESS_DENSITY_TRIP"
  | "INGRESS_MASS_TRIP"
  | "INGRESS_PROVENANCE_BLOCKED"
  | "INGRESS_CANYON_STATE_WRITTEN"
  | "INGRESS_ALLOW_ONCE"
  | "INGRESS_ALLOW_AS_LAW"
  | "INGRESS_DENY_ONCE"
  | "INGRESS_DENY_AS_LAW"
  | "PROCESS_PHYSWRAP_ACTIVE"
  | "PROCESS_PHYSWRAP_FALLBACK"
  | "PROCESS_PHYSWRAP_CAP_WARNING"
  | "LEDGER_STORM_SUMMARY";

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

export type BoundaryRuntimeMuscle = {
  manifest: BoundaryRuntimeMuscleManifest;
  substrate: unknown;
  activeLawIds: string[];
  timeLawIdsByGate: Record<string, string[]>;
  timeLawIdsByCategory: Record<string, string[]>;
};

export type BoundaryRuntimeConfig = {
  session: BoundarySession;
  laws: BoundaryLaw[];
  grants: BoundaryGrant[];
  pathLaws: BoundaryPathLaw[];
  approvalRequiredFor: BoundaryActionKind[];
  userLawIds?: string[];
  upl?: BoundaryUserPathLedger;
  runtimeMuscle?: BoundaryRuntimeMuscle;
  bodyguardOnline?: boolean;
  persistence?: BoundaryPersistenceConfig;
  approvalHandler?: BoundaryApprovalHandler;
  gravityService?: BoundaryGravityService;
  processPolicy?: BoundaryProcessPolicy;
  governorConfig?: BoundaryGovernorConfig;
  governorState?: BoundaryGovernorState;
  admissionConfig?: BoundaryAdmissionConfig;
  admissionState?: BoundaryAdmissionState;
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
  admissionState?: BoundaryAdmissionState;
  savedAt: string;
};

export type BoundaryApprovalRequest = {
  session: BoundarySession;
  request: BoundaryActionRequest;
  reason: string;
  lawIds: string[];
  bodyguardMoves: BodyguardMove[];
  prompt: BoundaryApprovalPrompt;
};

export type BoundaryApprovalChoice =
  | "allow_once"
  | "allow_as_law"
  | "deny_once"
  | "deny_as_law";

export type BoundaryApprovalOption = {
  choice: BoundaryApprovalChoice;
  label: string;
  effect: string;
};

export type BoundaryApprovalPrompt = {
  title: string;
  question: string;
  surface: "action" | "chat";
  lawIds: string[];
  attemptLines?: string[];
  userInput?: string;
  attemptedOutput?: string;
  invariantLawId?: string;
  invariantLabel?: string;
  evidence?: string[];
  violations?: string[];
  options: BoundaryApprovalOption[];
};

export type BoundaryApprovalDecision = {
  choice: BoundaryApprovalChoice;
  scope?: BoundaryUplScope;
  notes?: string | null;
  domain?: string;
};

export type BoundaryLegacyApprovalDecision = {
  approved: boolean;
  persistDenied?: boolean;
  scope?: BoundaryUplScope;
  notes?: string | null;
  domain?: string;
};

export type BoundaryApprovalHandler = (
  approval: BoundaryApprovalRequest,
) => Promise<boolean | BoundaryApprovalDecision | BoundaryLegacyApprovalDecision>
  | boolean
  | BoundaryApprovalDecision
  | BoundaryLegacyApprovalDecision;

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
