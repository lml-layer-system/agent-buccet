import type { RunMode } from "../profiles/types.ts";

export type ClaimTag =
  | "STATE"
  | "INVARIANT"
  | "DISTURBANCE"
  | "COUPLING"
  | "PROCEDURE"
  | "MEASUREMENT"
  | "META"
  | "OTHER";

export type Hole = {
  id: string;
  needed_for: string;
  missing: string;
  consequence_if_missing: string;
  source_claim_ids: string[];
};

export type Claim = {
  id: string;
  text: string;
  tag: ClaimTag;
};

export type PrimitiveExtractionRecord = {
  profile_id?: string;
  profile_version?: string;
  run_mode?: RunMode;
  dimension_claims?: Record<string, string[]>;
  x: string[];
  I: string[];
  delta: string[];
  A_B: {
    modules_B: string[];
    couplings_A: string[];
  };
  CLAIMS: Claim[];
  ASSUMPTIONS: string[];
  HOLES: Hole[];
  UIC_IDENTITY?: {
    invariant_count: number;
    target_signature: string;
    epsilon: number;
    violation: number;
    normalized_violation: number;
    in_K_epsilon: boolean;
    drift_pressure: number;
    correction_capacity: number;
    containment_strength: number;
    forward_invariant_estimate: boolean;
    attractor_estimate: boolean;
    identity_statement: string;
  };
};

export type UUISBlock = {
  content: string[];
  holes: string[];
};

export type FailureReturnItem = {
  failure_id: string;
  invariant: string;
  return_path: string | null;
  hole_id: string | null;
};

export type UUISObject = {
  profile_id?: string;
  profile_version?: string;
  run_mode?: RunMode;
  legality_matrix?: {
    allowed_pairs: string[];
    forbidden_pairs: string[];
  };
  failure_return_completeness?: {
    total_failures: number;
    mapped_failures: number;
    complete: boolean;
  };
  block1_identity_kernel: UUISBlock;
  block2_legality_region: UUISBlock;
  block3_detection_stack: UUISBlock;
  block4_containment_topology: UUISBlock;
  block5_correction_stack: UUISBlock;
  block6_reserved_capacity: UUISBlock;
  block7_meta_update_loop: UUISBlock;
  appendixA_threat_model: {
    threats: string[];
    holes: string[];
  };
  appendixB_failure_return_map: {
    map: FailureReturnItem[];
    holes: string[];
  };
};

export type LmlAddItem = {
  law_id: string;
  text: string;
  scope: string;
  enforcement: string;
  source_artifact_ref: string;
  source_claim_ids: string[];
  version_ref_or_hole: string;
};

export type NslAddItem = {
  repair_id: string;
  trigger: string;
  move: string;
  effect: string;
  maps_failures: string[];
  scope: string;
  preconditions: string[];
  priority: "PANIC" | "RESTORE" | "REPAIR" | "HARDEN";
  ledger_requirements: string[];
  source_claim_ids: string[];
};

export type DetectionSpecItem = {
  id: string;
  text: string;
  source_claim_ids: string[];
};

export type ImplementationSpecItem = {
  id: string;
  text: string;
  source_claim_ids: string[];
};

export type RejectedItem = {
  id: string;
  reason: string;
  text: string;
  source_claim_ids: string[];
};

export type DeltaObject = {
  LML_ADD: LmlAddItem[];
  NSL_ADD: NslAddItem[];
  DETECTION_SPEC: DetectionSpecItem[];
  IMPLEMENTATION_SPEC: ImplementationSpecItem[];
  REJECTED: RejectedItem[];
  ENFORCEMENT_REPORT?: {
    admissible: boolean;
    null_output: boolean;
    failed_enforcement_classes: string[];
    triggered_repairs: string[];
    generator: {
      drift: number;
      correction: number;
      containment: number;
      stable: boolean;
    };
  };
};

export type BlockersObject = {
  HOLES_BLOCKING_LML: Hole[];
  HOLES_BLOCKING_NSL: Hole[];
};

export type SnapOutput = {
  A_PER: PrimitiveExtractionRecord;
  B_UUIS: UUISObject;
  C_DELTA: DeltaObject;
  D_BLOCKERS: BlockersObject;
};

export type RepairOperator = {
  repair_id: string;
  trigger: string;
  move: string;
  effect: string;
  maps_failures: string[];
  scope: string;
  preconditions: string[];
  priority: "PANIC" | "RESTORE" | "REPAIR" | "HARDEN";
  ledger_requirements: string[];
  family:
    | "UNCERTAINTY"
    | "DRIFT"
    | "INTEGRITY"
    | "SPOOFING"
    | "OOD"
    | "CASCADE"
    | "LEDGER"
    | "RESOURCE"
    | "LATENCY"
    | "MIS_CORRECTION"
    | "META_HARDENING";
};

export type RepairPackName =
  | "NSL.REPAIR_PACK.MEASUREMENT"
  | "NSL.REPAIR_PACK.DRIFT"
  | "NSL.REPAIR_PACK.INTEGRITY"
  | "NSL.REPAIR_PACK.CONTAINMENT"
  | "NSL.REPAIR_PACK.LEDGER"
  | "NSL.REPAIR_PACK.RESOURCE"
  | "NSL.REPAIR_PACK.LATENCY"
  | "NSL.REPAIR_PACK.OOD"
  | "NSL.REPAIR_PACK.META_HARDENING"
  | "NSL.REPAIR_PACK.ALL";

export type RepairCatalog = {
  operators: RepairOperator[];
  packs: Record<RepairPackName, string[]>;
};

export type SnapIntegrationOptions = {
  artifactRef: string;
  profileId?: string;
  profileVersion?: string;
  runMode?: RunMode;
  authorizedRepairPacks: RepairPackName[];
  measurementPackAuthorized: boolean;
  allowVersionRef: boolean;
  strictNoProofNoTransition?: boolean;
  providedProofLawIds?: string[];
};
