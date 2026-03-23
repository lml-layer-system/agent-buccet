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

export type BoundaryProcessPolicy = {
  allowedCommands?: string[];
  blockedCommands?: string[];
  allowedEnvVars?: string[];
  allowedEnvPrefixes?: string[];
  blockedEnvVars?: string[];
  inheritParentEnv?: boolean;
  enforceScopedCwd?: boolean;
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

export type BodyguardMoveKind = NslMoveKind;

export type BodyguardMove = NslMove;

export type BoundaryReviewContext = {
  surface: "action" | "chat";
  actorLabel?: string;
  invariantLawId?: string;
  invariantLabel?: string;
  userInput?: string;
  attemptedOutput?: string;
  evidence?: string[];
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
  | "NSL_MOVE_CHOSEN";

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
  commandPreview?: string[];
  userInput?: string;
  attemptedOutput?: string;
  invariantLawId?: string;
  invariantLabel?: string;
  evidence?: string[];
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
