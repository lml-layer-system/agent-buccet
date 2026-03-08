import type { LawRecord } from "../types.ts";

export type CompiledLaw = {
  id: string;
  sourceLawId: string;
  family: "FLOOR" | "STATE" | "OUTPUT" | "META";
  sourceFile: string;
  section: string;
  text: string;
  level: string | null;
  dimension: string | null;
  tags: string[];
  normative: boolean;
};

export type GateCode =
  | "DOC_SIZE"
  | "SINGLE_DOC_ONLY"
  | "EXTERNAL_AUTHORITY_REQUEST"
  | "UNVERIFIED_CITATION"
  | "CITATION_ADMISSIBILITY"
  | "ONTOLOGY_DRIFT"
  | "NON_LEGAL_STYLE"
  | "STYLE_CLASS_BOUND"
  | "NSL_REPAIR_PREREQ"
  | "ADMISSIBILITY_PREREQS"
  | "META_LAW_BOUNDARY"
  | "LEDGER_LOOP_LOCK";

export type GateResult = {
  code: GateCode;
  pass: boolean;
  detail: string;
};

export type RepairMove = {
  id: string;
  code: GateCode;
  title: string;
  instruction: string;
};

export type OutcomeExplanation = {
  blockedReasons: string[];
  acceptedReasons: string[];
  lmlRepairingPlan: Array<{
    title: string;
    instruction: string;
    source: "mapped" | "fallback";
  }>;
};

export type Witness = {
  runId: string;
  outcome: "ADMISSIBLE" | "NULL";
  gates: GateResult[];
  repairPlan: RepairMove[];
  explanation: OutcomeExplanation;
  ledger: {
    attemptCountForInput: number;
    locked: boolean;
    lockReason: string | null;
  };
};

export type ExecutablePredicate = {
  id: string;
  code: GateCode;
  operator: "REQUIRE_ANY" | "FORBID_ANY";
  terms: string[];
  minMatches?: number;
  description: string;
  sourceLawIds: string[];
};

export type LawCoverage = {
  totalSourceLaws: number;
  incorporatedSourceLaws: number;
  missingSourceLawIds: string[];
  requiredMetaLawIds: string[];
  presentRequiredMetaLawIds: string[];
  missingRequiredMetaLawIds: string[];
  complete: boolean;
};

export type LawWeb = {
  version: string;
  generatedAt: string;
  compilePolicy: CompilePolicy;
  sourceStats: {
    totalLaws: number;
    floorCount: number;
    rawStateCount: number;
    stateCount: number;
    outputCount: number;
    metaCount: number;
  };
  floor: CompiledLaw[];
  state: CompiledLaw[];
  output: CompiledLaw[];
  meta: CompiledLaw[];
  bijection: Record<string, string>;
  knownCitations: string[];
  knownVocabulary: string[];
  predicates: ExecutablePredicate[];
  repairMoves: RepairMove[];
  coverage: LawCoverage;
};

export type RuntimeOptions = {
  maxInputChars: number;
  maxAttemptsPerInput: number;
  maxUnknownTokenRatio: number;
};

export type DemoInput = {
  content: string;
  fileName?: string;
};

export type LawDataset = {
  laws: LawRecord[];
};

export type CompilePolicy = {
  floorTarget: number;
  stateTarget: number;
  outputTarget: number;
  metaMax: number;
  strict: boolean;
  fillMode: "pad" | "error";
};
