export type BuccetFailureDimensionCatalogRow = {
  id: string;
  title: string;
  rootInvariant: string;
  source: string;
  variants: string[];
};

export type BuccetContainmentLawCatalogRow = {
  id: string;
  title: string;
  stopsDimension: string;
  source: string;
  variants: string[];
};

export type BuccetFailureCatalogRow = {
  id: string;
  title: string;
  dimension: string;
  source: string;
  variants: string[];
};

const FAILURE_SOURCE = "Buccet failure source document";
const CONTAINMENT_SOURCE = "Buccet containment source document";

export const BOUNDARY_BUCCET_FAILURE_DIMENSIONS: readonly BuccetFailureDimensionCatalogRow[] = [
  {
    id: "RELIABILITY",
    title: "DIMENSION 1: RELIABILITY FAILURES",
    rootInvariant: "Probabilistic generation != deterministic execution",
    source: FAILURE_SOURCE,
    variants: [
      "DIMENSION 1: RELIABILITY FAILURES",
      "RELIABILITY FAILURES",
      "Probabilistic generation != deterministic execution",
    ],
  },
  {
    id: "AUTONOMY",
    title: "DIMENSION 2: AUTONOMY FAILURES",
    rootInvariant: "Unsupervised action = unbounded damage",
    source: FAILURE_SOURCE,
    variants: [
      "DIMENSION 2: AUTONOMY FAILURES",
      "AUTONOMY FAILURES",
      "Unsupervised action = unbounded damage",
    ],
  },
  {
    id: "SECURITY",
    title: "DIMENSION 3: SECURITY FAILURES",
    rootInvariant: "Every external data source, API, and tool = potential attack vector",
    source: FAILURE_SOURCE,
    variants: [
      "DIMENSION 3: SECURITY FAILURES",
      "SECURITY FAILURES",
      "Every external data source, API, and tool = potential attack vector",
    ],
  },
  {
    id: "ECONOMICS",
    title: "DIMENSION 4: ECONOMICS FAILURES",
    rootInvariant: "Token consumption compounds exponentially",
    source: FAILURE_SOURCE,
    variants: [
      "DIMENSION 4: ECONOMICS FAILURES",
      "ECONOMICS FAILURES",
      "Token consumption compounds exponentially",
    ],
  },
  {
    id: "INTEGRATION",
    title: "DIMENSION 5: INTEGRATION FAILURES",
    rootInvariant: "Working demo != production system",
    source: FAILURE_SOURCE,
    variants: [
      "DIMENSION 5: INTEGRATION FAILURES",
      "INTEGRATION FAILURES",
      "Working demo != production system",
    ],
  },
  {
    id: "GOVERNANCE",
    title: "DIMENSION 6: GOVERNANCE FAILURES",
    rootInvariant: "No audit trail = no accountability",
    source: FAILURE_SOURCE,
    variants: [
      "DIMENSION 6: GOVERNANCE FAILURES",
      "GOVERNANCE FAILURES",
      "No audit trail = no accountability",
    ],
  },
  {
    id: "TRUST",
    title: "DIMENSION 7: TRUST FAILURES",
    rootInvariant: "Confidence != correctness",
    source: FAILURE_SOURCE,
    variants: [
      "DIMENSION 7: TRUST FAILURES",
      "TRUST FAILURES",
      "Confidence != correctness",
    ],
  },
] as const;

export const BOUNDARY_BUCCET_CONTAINMENT_LAWS: readonly BuccetContainmentLawCatalogRow[] = [
  {
    id: "01",
    title: "ALL ACTIONS MUST BE VALIDATED BEFORE EXECUTION",
    stopsDimension: "Reliability",
    source: CONTAINMENT_SOURCE,
    variants: [
      "LAW 1: ALL ACTIONS MUST BE VALIDATED BEFORE EXECUTION",
      "ALL ACTIONS MUST BE VALIDATED BEFORE EXECUTION",
    ],
  },
  {
    id: "03",
    title: "ALL ACCESS MUST BE SCOPED, LOGGED, AND REVOCABLE",
    stopsDimension: "Security",
    source: CONTAINMENT_SOURCE,
    variants: [
      "LAW 3: ALL ACCESS MUST BE SCOPED, LOGGED, AND REVOCABLE",
      "ALL ACCESS MUST BE SCOPED, LOGGED, AND REVOCABLE",
    ],
  },
  {
    id: "04",
    title: "ALL COSTS MUST BE BOUNDED AND OBSERVABLE",
    stopsDimension: "Economics",
    source: CONTAINMENT_SOURCE,
    variants: [
      "LAW 4: ALL COSTS MUST BE BOUNDED AND OBSERVABLE",
      "ALL COSTS MUST BE BOUNDED AND OBSERVABLE",
    ],
  },
  {
    id: "05",
    title: "ALL INTEGRATIONS MUST BE EVENT-DRIVEN AND TYPED",
    stopsDimension: "Integration",
    source: CONTAINMENT_SOURCE,
    variants: [
      "LAW 5: ALL INTEGRATIONS MUST BE EVENT-DRIVEN AND TYPED",
      "ALL INTEGRATIONS MUST BE EVENT-DRIVEN AND TYPED",
    ],
  },
  {
    id: "06",
    title: "ALL DECISIONS MUST BE TRACEABLE AND AUDITABLE",
    stopsDimension: "Governance",
    source: CONTAINMENT_SOURCE,
    variants: [
      "LAW 6: ALL DECISIONS MUST BE TRACEABLE AND AUDITABLE",
      "ALL DECISIONS MUST BE TRACEABLE AND AUDITABLE",
    ],
  },
  {
    id: "07",
    title: "ALL OUTPUTS MUST BE VERIFIED AGAINST GROUND TRUTH",
    stopsDimension: "Trust",
    source: CONTAINMENT_SOURCE,
    variants: [
      "LAW 7: ALL OUTPUTS MUST BE VERIFIED AGAINST GROUND TRUTH",
      "ALL OUTPUTS MUST BE VERIFIED AGAINST GROUND TRUTH",
    ],
  },
] as const;

export const BOUNDARY_BUCCET_FAILURE_ROWS: readonly BuccetFailureCatalogRow[] = [
  { id: "R1", title: "HALLUCINATED ACTIONS", dimension: "Reliability", source: FAILURE_SOURCE, variants: ["R1: HALLUCINATED ACTIONS", "HALLUCINATED ACTIONS"] },
  { id: "R2", title: "COMPOUND PROBABILITY COLLAPSE", dimension: "Reliability", source: FAILURE_SOURCE, variants: ["R2: COMPOUND PROBABILITY COLLAPSE", "COMPOUND PROBABILITY COLLAPSE"] },
  { id: "R3", title: "CONTEXT WINDOW DECAY", dimension: "Reliability", source: FAILURE_SOURCE, variants: ["R3: CONTEXT WINDOW DECAY", "CONTEXT WINDOW DECAY"] },
  { id: "R4", title: "SILENT FAILURE AT SCALE", dimension: "Reliability", source: FAILURE_SOURCE, variants: ["R4: SILENT FAILURE AT SCALE", "SILENT FAILURE AT SCALE"] },
  { id: "R5", title: "CASCADING ERROR PROPAGATION", dimension: "Reliability", source: FAILURE_SOURCE, variants: ["R5: CASCADING ERROR PROPAGATION", "CASCADING ERROR PROPAGATION"] },
  { id: "R6", title: "INSTRUCTION VIOLATION", dimension: "Reliability", source: FAILURE_SOURCE, variants: ["R6: INSTRUCTION VIOLATION", "INSTRUCTION VIOLATION"] },
  { id: "R7", title: "FABRICATED EVIDENCE", dimension: "Reliability", source: FAILURE_SOURCE, variants: ["R7: FABRICATED EVIDENCE", "FABRICATED EVIDENCE"] },
  { id: "A1", title: "PRODUCTION DESTRUCTION", dimension: "Autonomy", source: FAILURE_SOURCE, variants: ["A1: PRODUCTION DESTRUCTION", "PRODUCTION DESTRUCTION"] },
  { id: "A2", title: "SCOPE CREEP", dimension: "Autonomy", source: FAILURE_SOURCE, variants: ["A2: SCOPE CREEP", "SCOPE CREEP"] },
  { id: "A3", title: "IRREVERSIBLE ACTIONS", dimension: "Autonomy", source: FAILURE_SOURCE, variants: ["A3: IRREVERSIBLE ACTIONS", "IRREVERSIBLE ACTIONS"] },
  { id: "A4", title: "KILL SWITCH ABSENCE", dimension: "Autonomy", source: FAILURE_SOURCE, variants: ["A4: KILL SWITCH ABSENCE", "KILL SWITCH ABSENCE"] },
  { id: "A5", title: "TOOL MISUSE", dimension: "Autonomy", source: FAILURE_SOURCE, variants: ["A5: TOOL MISUSE", "TOOL MISUSE"] },
  { id: "A6", title: "DECEPTIVE SELF-PRESERVATION", dimension: "Autonomy", source: FAILURE_SOURCE, variants: ["A6: DECEPTIVE SELF-PRESERVATION", "DECEPTIVE SELF-PRESERVATION"] },
  { id: "A7", title: "AGENT SPRAWL", dimension: "Autonomy", source: FAILURE_SOURCE, variants: ["A7: AGENT SPRAWL", "AGENT SPRAWL"] },
  { id: "S1", title: "PROMPT INJECTION", dimension: "Security", source: FAILURE_SOURCE, variants: ["S1: PROMPT INJECTION", "PROMPT INJECTION"] },
  { id: "S2", title: "CREDENTIAL EXFILTRATION", dimension: "Security", source: FAILURE_SOURCE, variants: ["S2: CREDENTIAL EXFILTRATION", "CREDENTIAL EXFILTRATION"] },
  { id: "S3", title: "SHADOW AI DATA EXPOSURE", dimension: "Security", source: FAILURE_SOURCE, variants: ["S3: SHADOW AI DATA EXPOSURE", "SHADOW AI DATA EXPOSURE"] },
  { id: "S4", title: "SUPPLY CHAIN COMPROMISE", dimension: "Security", source: FAILURE_SOURCE, variants: ["S4: SUPPLY CHAIN COMPROMISE", "SUPPLY CHAIN COMPROMISE"] },
  { id: "S5", title: "CASCADING LATERAL MOVEMENT", dimension: "Security", source: FAILURE_SOURCE, variants: ["S5: CASCADING LATERAL MOVEMENT", "CASCADING LATERAL MOVEMENT"] },
  { id: "S6", title: "HARDCODED SECRETS", dimension: "Security", source: FAILURE_SOURCE, variants: ["S6: HARDCODED SECRETS", "HARDCODED SECRETS"] },
  { id: "S7", title: "MEMORY POISONING", dimension: "Security", source: FAILURE_SOURCE, variants: ["S7: MEMORY POISONING", "MEMORY POISONING"] },
  { id: "E1", title: "INFINITE LOOP COST EXPLOSION", dimension: "Economics", source: FAILURE_SOURCE, variants: ["E1: INFINITE LOOP COST EXPLOSION", "INFINITE LOOP COST EXPLOSION"] },
  { id: "E2", title: "RETRY STORM", dimension: "Economics", source: FAILURE_SOURCE, variants: ["E2: RETRY STORM", "RETRY STORM"] },
  { id: "E3", title: "POLLING TAX", dimension: "Economics", source: FAILURE_SOURCE, variants: ["E3: POLLING TAX", "POLLING TAX"] },
  { id: "E4", title: "CONTEXT WINDOW BLOAT", dimension: "Economics", source: FAILURE_SOURCE, variants: ["E4: CONTEXT WINDOW BLOAT", "CONTEXT WINDOW BLOAT"] },
  { id: "E5", title: "BUDGET SURPRISE", dimension: "Economics", source: FAILURE_SOURCE, variants: ["E5: BUDGET SURPRISE", "BUDGET SURPRISE"] },
  { id: "E6", title: "SUBSIDIZED PRICING TRAP", dimension: "Economics", source: FAILURE_SOURCE, variants: ["E6: SUBSIDIZED PRICING TRAP", "SUBSIDIZED PRICING TRAP"] },
  { id: "E7", title: "AUTONOMOUS RESOURCE HIJACK", dimension: "Economics", source: FAILURE_SOURCE, variants: ["E7: AUTONOMOUS RESOURCE HIJACK", "AUTONOMOUS RESOURCE HIJACK"] },
  { id: "I1", title: "DUMB RAG", dimension: "Integration", source: FAILURE_SOURCE, variants: ["I1: DUMB RAG", "DUMB RAG"] },
  { id: "I2", title: "BRITTLE CONNECTORS", dimension: "Integration", source: FAILURE_SOURCE, variants: ["I2: BRITTLE CONNECTORS", "BRITTLE CONNECTORS"] },
  { id: "I3", title: "NO EVENT-DRIVEN ARCHITECTURE", dimension: "Integration", source: FAILURE_SOURCE, variants: ["I3: NO EVENT-DRIVEN ARCHITECTURE", "NO EVENT-DRIVEN ARCHITECTURE"] },
  { id: "I4", title: "DEMO INPUT CHERRY-PICKING", dimension: "Integration", source: FAILURE_SOURCE, variants: ["I4: DEMO INPUT CHERRY-PICKING", "DEMO INPUT CHERRY-PICKING"] },
  { id: "I5", title: "SINGLE AGENT DEAD ENDS", dimension: "Integration", source: FAILURE_SOURCE, variants: ["I5: SINGLE AGENT DEAD ENDS", "SINGLE AGENT DEAD ENDS"] },
  { id: "I6", title: "MISSING OPERATING SYSTEM", dimension: "Integration", source: FAILURE_SOURCE, variants: ["I6: MISSING OPERATING SYSTEM", "MISSING OPERATING SYSTEM"] },
  { id: "I7", title: "ARCHITECTURAL WASTE", dimension: "Integration", source: FAILURE_SOURCE, variants: ["I7: ARCHITECTURAL WASTE", "ARCHITECTURAL WASTE"] },
  { id: "G1", title: "UNMANAGED AGENT IDENTITIES", dimension: "Governance", source: FAILURE_SOURCE, variants: ["G1: UNMANAGED AGENT IDENTITIES", "UNMANAGED AGENT IDENTITIES"] },
  { id: "G2", title: "BLACK BOX DECISION MAKING", dimension: "Governance", source: FAILURE_SOURCE, variants: ["G2: BLACK BOX DECISION MAKING", "BLACK BOX DECISION MAKING"] },
  { id: "G3", title: "REGULATORY NON-COMPLIANCE", dimension: "Governance", source: FAILURE_SOURCE, variants: ["G3: REGULATORY NON-COMPLIANCE", "REGULATORY NON-COMPLIANCE"] },
  { id: "G4", title: "MISSING DOCUMENTATION", dimension: "Governance", source: FAILURE_SOURCE, variants: ["G4: MISSING DOCUMENTATION", "MISSING DOCUMENTATION"] },
  { id: "G5", title: "WORKFLOW TRACEABILITY GAP", dimension: "Governance", source: FAILURE_SOURCE, variants: ["G5: WORKFLOW TRACEABILITY GAP", "WORKFLOW TRACEABILITY GAP"] },
  { id: "G6", title: "HUMAN-IN-THE-LOOP THEATER", dimension: "Governance", source: FAILURE_SOURCE, variants: ["G6: HUMAN-IN-THE-LOOP THEATER", "HUMAN-IN-THE-LOOP THEATER"] },
  { id: "G7", title: "FRAMEWORK INADEQUACY", dimension: "Governance", source: FAILURE_SOURCE, variants: ["G7: FRAMEWORK INADEQUACY", "FRAMEWORK INADEQUACY"] },
  { id: "T1", title: "OPACITY", dimension: "Trust", source: FAILURE_SOURCE, variants: ["T1: OPACITY", "OPACITY"] },
  { id: "T2", title: "EXECUTIVE DISTRUST", dimension: "Trust", source: FAILURE_SOURCE, variants: ["T2: EXECUTIVE DISTRUST", "EXECUTIVE DISTRUST"] },
  { id: "T3", title: "CONSUMER SKEPTICISM", dimension: "Trust", source: FAILURE_SOURCE, variants: ["T3: CONSUMER SKEPTICISM", "CONSUMER SKEPTICISM"] },
  { id: "T4", title: "WRONGFUL ARRESTS", dimension: "Trust", source: FAILURE_SOURCE, variants: ["T4: WRONGFUL ARRESTS", "WRONGFUL ARRESTS"] },
  { id: "T5", title: "LEGAL LIABILITY", dimension: "Trust", source: FAILURE_SOURCE, variants: ["T5: LEGAL LIABILITY", "LEGAL LIABILITY"] },
  { id: "T6", title: "HALLUCINATED CITATIONS", dimension: "Trust", source: FAILURE_SOURCE, variants: ["T6: HALLUCINATED CITATIONS", "HALLUCINATED CITATIONS"] },
  { id: "T7", title: "EXISTENTIAL SELF-HARM RISK", dimension: "Trust", source: FAILURE_SOURCE, variants: ["T7: EXISTENTIAL SELF-HARM RISK", "EXISTENTIAL SELF-HARM RISK"] },
] as const;
