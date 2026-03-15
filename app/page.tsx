"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { extractTextFromPdfBytes } from "@/lib/demo/pdf-text";

const DEFAULT_PROMPT = "What do you want your AI to be?";

type DocArtifact = {
  id: string;
  name: string;
  text: string;
};

type IngestedLaw = {
  law_id: string;
  text: string;
  scope: string;
  enforcement: string;
  source_claim_ids: string[];
};

type SnapRunResponse = {
  runId: string;
  root_extraction?: {
    count: number;
    source_units: number;
    extracted_root_count: number;
    expansion_delta: number;
    under_enumerated: boolean;
    identity_kernel_count: number;
    legality_region_count: number;
    meta_loop_count: number;
    directive_count?: number;
    code_unit_count?: number;
    math_unit_count?: number;
    sentence_count?: number;
    roots: Array<{
      id: string;
      domain: string;
      planet: string;
      lawId: string;
      label: string;
      provenance: {
        classification: string;
        extractionStage: string;
        sourceLabel: string;
        sourceDigest: string;
      };
    }>;
  };
  seed_extraction?: {
    quantum_spark_candidates: number;
    finite_seed_count: number;
    seeds: Array<{
      id: string;
      source: string;
      abilityRoute: string;
      text: string;
      origin: string;
      rank: number;
    }>;
  };
  A_PER: { CLAIMS: Array<{ id: string }> };
  B_UUIS: {
    block1_identity_kernel: { content: string[] };
    block2_legality_region: { content: string[] };
    block7_meta_update_loop: { content: string[] };
  };
  C_DELTA: { LML_ADD: IngestedLaw[] };
  D_BLOCKERS: {
    HOLES_BLOCKING_LML: Array<{ id: string }>;
    HOLES_BLOCKING_NSL: Array<{ id: string }>;
  };
};

type ChatTrace = {
  base_laws: string[];
  system_laws?: string[];
  user_laws: string[];
  merged_ontology: string[];
  active_constraints: string[];
  triggered_constraints: string[];
  ability_route: string;
  final_action: "success" | "refusal";
  reason: string;
  triggered_repairs?: string[];
  gate_failed?: string | null;
  failed_predicate?: string | null;
  failed_laws?: string[];
  failure_classes?: string[];
  null_state?: boolean;
  return_moves?: string[];
  null_staircase?: {
    state: "admitted" | "null_emitted";
    witness: {
      gate: string;
      predicate: string;
      violations: string[];
    };
    loop: string[];
  };
  path_orchestrator?: {
    formation_id: string;
    stage_count: number;
    terminated: boolean;
    termination_reason: string;
    stages: Array<{
      stage: string;
      status: string;
      detail: string;
    }>;
  };
  nocr_funnel?: {
    seed_tag: string;
    root_space_size: number;
    ledger_state: string;
    reason: string;
  };
  nocr_input?: {
    root_count: number;
    chat_exact_seed_count: number;
    chat_qe_seed_count: number;
  };
  quantum_collapse?: {
    seed_tag: string;
    root_tag: string | null;
    root_id: string | null;
    branch_id: string | null;
    tree_id: string | null;
    state_change_id: string | null;
    domain: string | null;
    reason: string;
    collapse_moment: string;
    lock_state: "locked" | "clipped";
    lock_reason_class?: string;
    match_score?: number;
    qe_generated_root_count?: number;
    qe_checked_root_count?: number;
    snap_match_count?: number;
    snap_matches?: Array<{
      seed_id: string;
      root_id: string;
      domain: string;
      reason_class: string;
      score: number;
    }>;
  };
  chat_seed_lane?: {
    exact_seed_count: number;
    primary_seed_id: string | null;
    primary_seed_origin: string | null;
    qe_candidate_count?: number;
    qe_seed_count?: number;
    primary_qe_seed_id?: string | null;
    primary_qe_seed_origin?: string | null;
  };
  chat_branch?: {
    action: "new" | "extend" | "fork" | "none";
    governance_reason?: string;
    active_branch_id: string | null;
    active_tree_id: string | null;
    branch_turn_count: number;
    branch_seed_count: number;
    branch_parent_count: number;
  };
  root_registry?: {
    static_count: number;
    extracted_count: number;
    total_count: number;
    source_units: number;
    extracted_root_count: number;
    expansion_delta: number;
    under_enumerated: boolean;
    identity_kernel_count: number;
    legality_region_count: number;
    directive_count?: number;
    code_unit_count?: number;
    math_unit_count?: number;
    sentence_count?: number;
    artifact_root_count: number;
    user_law_root_count: number;
  };
  nocr_parity?: {
    ok: boolean;
    fail_closed: boolean;
    missing_law_ids: string[];
    extra_law_ids: string[];
  };
  failure_learning?: {
    proposed_law_count: number;
    signature: string | null;
    sources: string[];
  };
  generation?: {
    status: "generated" | "fallback" | "deterministic";
    failure_class: string | null;
    detail: string | null;
  };
};

type ChatOntology = {
  base_law_count?: number;
  base_laws_applied: string[];
  user_laws_applied: string[];
  merged_ontology_state: string[];
};

type ChatContext = {
  sessionId: string;
  step: number;
  wm_focus: string | null;
  l0_size: number;
  l1_size: number;
  dependency_edges: number;
};

type ChatNovelty = {
  noveltyDetected: boolean;
  coverageIncomplete: boolean;
  proposedLawCount: number;
  activatedFromPriorCycle: number;
  ledgerIndex: number | null;
};

type ChatFailureLearning = {
  proposedLawCount: number;
  signature: string | null;
  sources: string[];
};

type ChatApiResponse = {
  answer: string;
  code: {
    blocks: Array<{
      language: string;
      code: string;
    }>;
    primary: {
      language: string;
      code: string;
    } | null;
  };
  trace: ChatTrace;
  ontology: ChatOntology;
  context: ChatContext;
  novelty: ChatNovelty;
  failure_learning: ChatFailureLearning;
  model: {
    provider: string;
    model: string;
    runId: string;
    callId: string;
    at: string;
    inputDigest: string;
    generationStatus?: "generated" | "fallback" | "deterministic";
    generationFailureClass?: string;
    generationDetail?: string;
  };
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type AutoLaw = {
  text: string;
  scope: string;
  enforcement: string;
  source: string;
};

type CapabilityGraph = {
  compiled_from_laws: number;
  abilities: Record<"coding" | "web_search", {
    state: "allowed" | "blocked" | "unspecified";
    source_law_ids: string[];
    rationale: string[];
  }>;
};

type PlanetSourceInventory = {
  sun: string[];
  meta: string[];
  ai_model: string[];
  human: string[];
  quantum: string[];
  nocr: string[];
  nsl: string[];
  branch_tree?: string[];
};

type PlanetSourceCounts = {
  sun: number;
  meta: number;
  ai_model: number;
  human: number;
  quantum: number;
  nocr: number;
  nsl: number;
  branch_tree?: number;
};

type LmlStateResponse = {
  userLaws?: IngestedLaw[];
  activeAutoLaws?: AutoLaw[];
  pendingLawProposals?: AutoLaw[];
  quantumBlanketSuggestions?: AutoLaw[];
  failureLearningSuggestions?: AutoLaw[];
  aiModelPlanetSuggestions?: AutoLaw[];
  automation?: {
    metaLoopMode: "ask_every_update" | "automate";
    metaLoopAlwaysOn: boolean;
    quantumBlanketAlwaysOn: boolean;
    modelPolicy: "model_agnostic";
    lastMetaLoopTickAt?: string | null;
    lastQuantumBlanketTickAt?: string | null;
  };
  metaLoopWorker?: {
    running: boolean;
    at: string;
    sessionCount: number;
    deliveries: number;
    applied: number;
    criticalApplied: number;
    modeCounts: {
      ask_every_update: number;
      automate: number;
    };
  } | null;
  metaDeliveryLedgerCount?: number;
  metaDeliveryPlanetRootCount?: number;
  metaDeliveryPlanetRootLaws?: string[];
  metaDeliveryPlanetParity?: {
    ok: boolean;
    missingLawIds: string[];
    extraLawIds: string[];
  };
  lastMetaDeliveryPreview?: {
    eventType: string;
    at: string;
    text: string;
  } | null;
  metaPlanetLaws?: string[];
  aiModelPlanetLaws?: string[];
  activeMetaPlanetLaws?: AutoLaw[];
  criticalAutoMetaUpdates?: AutoLaw[];
  pendingNonCriticalMetaUpdates?: AutoLaw[];
  activeAiModelPlanetHardeningLaws?: AutoLaw[];
  humanPlanetLaws?: string[];
  quantumRoleLaws?: string[];
  nocrPlanetRootLaws?: string[];
  nocrPlanetParity?: {
    ok: boolean;
    missingLawIds: string[];
    extraLawIds: string[];
  };
  lastNocrPreview?: {
    eventType: string;
    at: string;
    text: string;
  } | null;
  branchTreePlanetRootLaws?: string[];
  branchTreePlanetParity?: {
    ok: boolean;
    missingLawIds: string[];
    extraLawIds: string[];
  };
  lastBranchTreePreview?: {
    eventType: string;
    at: string;
    text: string;
  } | null;
  lastCollapseMatchPreview?: Array<{
    seedId: string;
    rootId: string;
    domain: string;
    reasonClass: string;
    score: number;
  }>;
  lastCollapseMatchLedgerPreview?: Array<{
    seedId: string;
    rootId: string;
    domain: string;
    reasonClass: string;
    score: number;
    branchId: string;
    treeId: string;
    at: string;
  }>;
  branchTreeLifecycle?: {
    collapse_resolved: number;
    collapse_match_resolved: number;
    branch_extended: number;
    tree_extended: number;
    tree_started: number;
    branch_forked: number;
    branch_sibling_created: number;
    branch_merged: number;
    branch_closed: number;
    branch_archived: number;
    tree_archived: number;
    branch_deleted: number;
    tree_deleted: number;
    recent_archived: string[];
    recent_deleted: string[];
  };
  branchTreeQuery?: {
    mode: "branch" | "tree";
    id: string;
    laws: string[];
  } | null;
  activeChat?: {
    activeBranchId: string | null;
    activeTreeId: string | null;
    branches: Array<{
      id: string;
      treeId: string;
      status: "active" | "closed";
      startedAt: string;
      updatedAt: string;
      turnCount: number;
      matchedSeedIds: string[];
      matchedRootIds: string[];
      abilityRoutes: string[];
      reasonTrail: string[];
      dominanceScore: number;
      lineageParentBranchId: string | null;
    }>;
  };
  nslPlanetRootLaws?: string[];
  nslPlanetParity?: {
    ok: boolean;
    missingLawIds: string[];
    extraLawIds: string[];
  };
  lastNslPreview?: {
    eventType: string;
    at: string;
    text: string;
  } | null;
  nslDeterministicCodingRepairCount?: number;
  lastNslDeterministicCodingRepairPreview?: {
    eventType: string;
    at: string;
    reason: string;
  } | null;
  codingSimLedgerCount?: number;
  lastCodingSimPreview?: {
    eventType: string;
    at: string;
    scenarios: number;
    visitedNodes: number;
    survivors: number;
    pruned: number;
    reportPath: string;
  } | null;
  codingSimDominantDimensions?: Array<{
    dimension: string;
    count: number;
  }>;
  rootCoverage?: {
    source_units: number;
    extracted_root_count: number;
    expansion_delta: number;
    under_enumerated: boolean;
    static_root_count: number;
    directive_count?: number;
    code_unit_count?: number;
    math_unit_count?: number;
    sentence_count?: number;
    artifact_root_count: number;
    user_law_root_count: number;
    total_root_count: number;
  };
  capabilityGraph?: CapabilityGraph;
  abilityPlanet?: Record<"coding" | "web_search", string[]>;
  activeAbilityPlanet?: Record<"coding" | "web_search", string[]>;
  planetSourceInventory?: PlanetSourceInventory;
  planetSourceCounts?: PlanetSourceCounts;
  universeGrouping?: {
    reality_universe: Array<"sun" | "ability" | "quantum">;
    human_universe: Array<"human">;
    fiction_universe: [];
    global_service: Array<"meta" | "ai_model" | "nocr" | "nsl" | "branch_tree" | "meta_delivery">;
  };
  universeSourceInventory?: {
    reality_universe: {
      sun: string[];
      ability: string[];
      quantum: string[];
    };
    human_universe: {
      human: string[];
    };
    fiction_universe: {
      fiction: string[];
    };
    global_service: {
      meta: string[];
      ai_model: string[];
      nocr: string[];
      nsl: string[];
      branch_tree: string[];
      meta_delivery: string[];
    };
  };
  universeSourceCounts?: {
    reality_universe: {
      sun: number;
      ability: number;
      quantum: number;
      total: number;
    };
    human_universe: {
      human: number;
      total: number;
    };
    fiction_universe: {
      fiction: number;
      total: number;
    };
    global_service: {
      meta: number;
      ai_model: number;
      nocr: number;
      nsl: number;
      branch_tree: number;
      meta_delivery: number;
      total: number;
    };
  };
};

export default function HomePage() {
  const [documents, setDocuments] = useState<DocArtifact[]>([]);
  const [manualLawText, setManualLawText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<SnapRunResponse | null>(null);
  const [activeUserLaws, setActiveUserLaws] = useState<IngestedLaw[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "System: sun active. User overlay law count: 0.",
    },
  ]);
  const [lastTrace, setLastTrace] = useState<ChatTrace | null>(null);
  const [lastModel, setLastModel] = useState<ChatApiResponse["model"] | null>(null);
  const [lastCode, setLastCode] = useState<ChatApiResponse["code"] | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [ingestRuns, setIngestRuns] = useState(0);
  const [sessionId, setSessionId] = useState("default-session");
  const [activeAutoLaws, setActiveAutoLaws] = useState<AutoLaw[]>([]);
  const [pendingLawProposals, setPendingLawProposals] = useState<AutoLaw[]>([]);
  const [quantumBlanketSuggestions, setQuantumBlanketSuggestions] = useState<AutoLaw[]>([]);
  const [failureLearningSuggestions, setFailureLearningSuggestions] = useState<AutoLaw[]>([]);
  const [aiModelPlanetSuggestions, setAiModelPlanetSuggestions] = useState<AutoLaw[]>([]);
  const [automation, setAutomation] = useState<NonNullable<LmlStateResponse["automation"]>>({
    metaLoopMode: "ask_every_update",
    metaLoopAlwaysOn: true,
    quantumBlanketAlwaysOn: true,
    modelPolicy: "model_agnostic",
    lastMetaLoopTickAt: null,
    lastQuantumBlanketTickAt: null,
  });
  const [metaLoopWorker, setMetaLoopWorker] = useState<LmlStateResponse["metaLoopWorker"]>(null);
  const [metaDeliveryLedgerCount, setMetaDeliveryLedgerCount] = useState(0);
  const [metaDeliveryPlanetRootCount, setMetaDeliveryPlanetRootCount] = useState(0);
  const [metaDeliveryPlanetRootLaws, setMetaDeliveryPlanetRootLaws] = useState<string[]>([]);
  const [metaDeliveryPlanetParity, setMetaDeliveryPlanetParity] = useState<LmlStateResponse["metaDeliveryPlanetParity"] | null>(null);
  const [metaPlanetLaws, setMetaPlanetLaws] = useState<string[]>([]);
  const [aiModelPlanetLaws, setAiModelPlanetLaws] = useState<string[]>([]);
  const [activeMetaPlanetLaws, setActiveMetaPlanetLaws] = useState<AutoLaw[]>([]);
  const [criticalAutoMetaUpdates, setCriticalAutoMetaUpdates] = useState<AutoLaw[]>([]);
  const [pendingNonCriticalMetaUpdates, setPendingNonCriticalMetaUpdates] = useState<AutoLaw[]>([]);
  const [activeAiModelPlanetHardeningLaws, setActiveAiModelPlanetHardeningLaws] = useState<AutoLaw[]>([]);
  const [nslDeterministicCodingRepairCount, setNslDeterministicCodingRepairCount] = useState(0);
  const [lastNslDeterministicCodingRepairPreview, setLastNslDeterministicCodingRepairPreview] = useState<LmlStateResponse["lastNslDeterministicCodingRepairPreview"]>(null);
  const [codingSimLedgerCount, setCodingSimLedgerCount] = useState(0);
  const [lastCodingSimPreview, setLastCodingSimPreview] = useState<LmlStateResponse["lastCodingSimPreview"]>(null);
  const [codingSimDominantDimensions, setCodingSimDominantDimensions] = useState<NonNullable<LmlStateResponse["codingSimDominantDimensions"]>>([]);
  const [humanPlanetLaws, setHumanPlanetLaws] = useState<string[]>([]);
  const [quantumRoleLaws, setQuantumRoleLaws] = useState<string[]>([]);
  const [nocrPlanetRootLaws, setNocrPlanetRootLaws] = useState<string[]>([]);
  const [nocrPlanetParity, setNocrPlanetParity] = useState<{ ok: boolean; missingLawIds: string[]; extraLawIds: string[] } | null>(null);
  const [lastNocrPreview, setLastNocrPreview] = useState<LmlStateResponse["lastNocrPreview"]>(null);
  const [branchTreePlanetRootLaws, setBranchTreePlanetRootLaws] = useState<string[]>([]);
  const [branchTreePlanetParity, setBranchTreePlanetParity] = useState<{ ok: boolean; missingLawIds: string[]; extraLawIds: string[] } | null>(null);
  const [lastBranchTreePreview, setLastBranchTreePreview] = useState<LmlStateResponse["lastBranchTreePreview"]>(null);
  const [lastCollapseMatchPreview, setLastCollapseMatchPreview] = useState<NonNullable<LmlStateResponse["lastCollapseMatchPreview"]>>([]);
  const [lastCollapseMatchLedgerPreview, setLastCollapseMatchLedgerPreview] = useState<NonNullable<LmlStateResponse["lastCollapseMatchLedgerPreview"]>>([]);
  const [branchTreeLifecycle, setBranchTreeLifecycle] = useState<LmlStateResponse["branchTreeLifecycle"] | null>(null);
  const [branchTreeQuery, setBranchTreeQuery] = useState<LmlStateResponse["branchTreeQuery"] | null>(null);
  const [activeChat, setActiveChat] = useState<LmlStateResponse["activeChat"] | null>(null);
  const [nslPlanetRootLaws, setNslPlanetRootLaws] = useState<string[]>([]);
  const [nslPlanetParity, setNslPlanetParity] = useState<{ ok: boolean; missingLawIds: string[]; extraLawIds: string[] } | null>(null);
  const [lastNslPreview, setLastNslPreview] = useState<LmlStateResponse["lastNslPreview"]>(null);
  const [lastMetaDeliveryPreview, setLastMetaDeliveryPreview] = useState<LmlStateResponse["lastMetaDeliveryPreview"]>(null);
  const [rootCoverage, setRootCoverage] = useState<LmlStateResponse["rootCoverage"] | null>(null);
  const [capabilityGraph, setCapabilityGraph] = useState<CapabilityGraph | null>(null);
  const [abilityPlanet, setAbilityPlanet] = useState<Record<"coding" | "web_search", string[]>>({
    coding: [],
    web_search: [],
  });
  const [activeAbilityPlanet, setActiveAbilityPlanet] = useState<Record<"coding" | "web_search", string[]>>({
    coding: [],
    web_search: [],
  });
  const [planetSourceInventory, setPlanetSourceInventory] = useState<PlanetSourceInventory>({
    sun: [],
    meta: [],
    ai_model: [],
    human: [],
    quantum: [],
    nocr: [],
    nsl: [],
    branch_tree: [],
  });
  const [planetSourceCounts, setPlanetSourceCounts] = useState<PlanetSourceCounts>({
    sun: 0,
    meta: 0,
    ai_model: 0,
    human: 0,
    quantum: 0,
    nocr: 0,
    nsl: 0,
    branch_tree: 0,
  });
  const [universeSourceInventory, setUniverseSourceInventory] = useState<NonNullable<LmlStateResponse["universeSourceInventory"]>>({
    reality_universe: { sun: [], ability: [], quantum: [] },
    human_universe: { human: [] },
    fiction_universe: { fiction: [] },
    global_service: { meta: [], ai_model: [], nocr: [], nsl: [], branch_tree: [], meta_delivery: [] },
  });
  const [universeSourceCounts, setUniverseSourceCounts] = useState<NonNullable<LmlStateResponse["universeSourceCounts"]>>({
    reality_universe: { sun: 0, ability: 0, quantum: 0, total: 0 },
    human_universe: { human: 0, total: 0 },
    fiction_universe: { fiction: 0, total: 0 },
    global_service: { meta: 0, ai_model: 0, nocr: 0, nsl: 0, branch_tree: 0, meta_delivery: 0, total: 0 },
  });

  const activeCount = activeUserLaws.length;
  const totalBlockers = (lastRun?.D_BLOCKERS.HOLES_BLOCKING_LML.length ?? 0) + (lastRun?.D_BLOCKERS.HOLES_BLOCKING_NSL.length ?? 0);
  const allDocText = useMemo(() => documents.map((doc) => doc.text).join("\n\n"), [documents]);
  const totalDocChars = useMemo(() => documents.reduce((sum, doc) => sum + doc.text.length, 0), [documents]);
  const lastRunUserLawCount = useMemo(() => {
    if (!lastRun) {
      return 0;
    }
    return lastRun.C_DELTA.LML_ADD.filter((law) => law.source_claim_ids.length > 0 || !isProfileSeedLaw(law.text)).length;
  }, [lastRun]);

  const stageStatus = useMemo(() => {
    const hasArtifact = Boolean(documents.length > 0 || manualLawText.trim());
    if (ingestLoading) {
      return [
        { label: "LML ingesting...", status: "running" as const, detail: "Receiving stacked artifacts and preparing runtime packet." },
        { label: "LML structuring...", status: "blocked" as const, detail: "Pending UIC/UUIS." },
        { label: "LML universe shifting...", status: "blocked" as const, detail: "Pending law synthesis." },
        { label: "LML user laws are active...", status: "blocked" as const, detail: "Pending activation." },
      ];
    }
    if (!lastRun) {
      return [
        { label: "LML ingesting...", status: "blocked" as const, detail: hasArtifact ? "Ready to run ingest." : "No artifact loaded." },
        { label: "LML structuring...", status: "blocked" as const, detail: "No run yet." },
        { label: "LML universe shifting...", status: "blocked" as const, detail: "No run yet." },
        { label: "LML user laws are active...", status: activeCount > 0 ? "pass" as const : "blocked" as const, detail: activeCount > 0 ? "User laws active." : "No user laws active." },
      ];
    }

    const uicPass = lastRun.A_PER.CLAIMS.length > 0;
    const uuisPass = lastRun.B_UUIS.block1_identity_kernel.content.length > 0
      || lastRun.B_UUIS.block2_legality_region.content.length > 0
      || lastRun.B_UUIS.block7_meta_update_loop.content.length > 0;
    const synthesisPass = lastRunUserLawCount > 0;
    const activationPass = activeCount > 0;

    return [
      { label: "LML ingesting...", status: "pass" as const, detail: `Run ${lastRun.runId} recorded.` },
      { label: "LML structuring...", status: uicPass && uuisPass ? "pass" as const : "blocked" as const, detail: `UIC claims=${lastRun.A_PER.CLAIMS.length}; UUIS=${uuisPass ? "ok" : "missing"}.` },
      { label: "LML universe shifting...", status: synthesisPass ? "pass" as const : "blocked" as const, detail: `${lastRunUserLawCount} user law(s) synthesized.` },
      { label: "LML user laws are active...", status: activationPass ? "pass" as const : "blocked" as const, detail: activationPass ? `${activeCount} law(s) active in session.` : "No active user laws." },
    ];
  }, [activeCount, documents.length, ingestLoading, lastRun, lastRunUserLawCount, manualLawText]);

  const pipelineState = useMemo<"red" | "amber" | "green">(() => {
    if (ingestLoading || chatLoading) {
      return "amber";
    }
    if (!lastRun || activeCount === 0) {
      return "red";
    }
    const uicPass = lastRun.A_PER.CLAIMS.length > 0;
    const uuisPass = lastRun.B_UUIS.block1_identity_kernel.content.length > 0
      || lastRun.B_UUIS.block2_legality_region.content.length > 0
      || lastRun.B_UUIS.block7_meta_update_loop.content.length > 0;
    const synthesisPass = lastRunUserLawCount > 0;
    return uicPass && uuisPass && synthesisPass && activeCount > 0 ? "green" : "red";
  }, [activeCount, chatLoading, ingestLoading, lastRun, lastRunUserLawCount]);

  useEffect(() => {
    const key = "lml_session_id";
    const existing = window.localStorage.getItem(key);
    if (existing) {
      setSessionId(existing);
      return;
    }
    const generated = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(key, generated);
    setSessionId(generated);
  }, []);

  useEffect(() => {
    if (!sessionId || sessionId === "default-session") {
      return;
    }
    void (async () => {
      const response = await fetch(`/api/lml-state?sessionId=${encodeURIComponent(sessionId)}`);
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as LmlStateResponse;
      if (Array.isArray(data.userLaws) && data.userLaws.length > 0) {
        const restored = data.userLaws.filter((law) =>
          !isFallbackLaw(law.law_id) &&
          !isPlaceholderLaw(law.text) &&
          !isLowSignalGeneratedLaw(law.text),
        );
        setActiveUserLaws((current) => mergeUniqueLaws(current, restored));
        if (restored.length !== data.userLaws.length) {
          await fetch("/api/lml-state", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, action: "replace", userLaws: restored }),
          });
        }
      }
      setActiveAutoLaws(Array.isArray(data.activeAutoLaws) ? data.activeAutoLaws : []);
      setPendingLawProposals(Array.isArray(data.pendingLawProposals) ? data.pendingLawProposals : []);
      setQuantumBlanketSuggestions(Array.isArray(data.quantumBlanketSuggestions) ? data.quantumBlanketSuggestions : []);
      setFailureLearningSuggestions(Array.isArray(data.failureLearningSuggestions) ? data.failureLearningSuggestions : []);
      setAiModelPlanetSuggestions(Array.isArray(data.aiModelPlanetSuggestions) ? data.aiModelPlanetSuggestions : []);
      setAutomation(data.automation ?? {
        metaLoopMode: "ask_every_update",
        metaLoopAlwaysOn: true,
        quantumBlanketAlwaysOn: true,
        modelPolicy: "model_agnostic",
        lastMetaLoopTickAt: null,
        lastQuantumBlanketTickAt: null,
      });
      setMetaLoopWorker(data.metaLoopWorker ?? null);
      setMetaDeliveryLedgerCount(data.metaDeliveryLedgerCount ?? 0);
      setMetaDeliveryPlanetRootCount(data.metaDeliveryPlanetRootCount ?? 0);
      setMetaDeliveryPlanetRootLaws(Array.isArray(data.metaDeliveryPlanetRootLaws) ? data.metaDeliveryPlanetRootLaws : []);
      setMetaDeliveryPlanetParity(data.metaDeliveryPlanetParity ?? null);
      setLastMetaDeliveryPreview(data.lastMetaDeliveryPreview ?? null);
      setMetaPlanetLaws(Array.isArray(data.metaPlanetLaws) ? data.metaPlanetLaws : []);
      setAiModelPlanetLaws(Array.isArray(data.aiModelPlanetLaws) ? data.aiModelPlanetLaws : []);
      setActiveMetaPlanetLaws(Array.isArray(data.activeMetaPlanetLaws) ? data.activeMetaPlanetLaws : []);
      setCriticalAutoMetaUpdates(Array.isArray(data.criticalAutoMetaUpdates) ? data.criticalAutoMetaUpdates : []);
      setPendingNonCriticalMetaUpdates(Array.isArray(data.pendingNonCriticalMetaUpdates) ? data.pendingNonCriticalMetaUpdates : []);
      setActiveAiModelPlanetHardeningLaws(Array.isArray(data.activeAiModelPlanetHardeningLaws) ? data.activeAiModelPlanetHardeningLaws : []);
      setNslDeterministicCodingRepairCount(typeof data.nslDeterministicCodingRepairCount === "number" ? data.nslDeterministicCodingRepairCount : 0);
      setLastNslDeterministicCodingRepairPreview(data.lastNslDeterministicCodingRepairPreview ?? null);
      setCodingSimLedgerCount(typeof data.codingSimLedgerCount === "number" ? data.codingSimLedgerCount : 0);
      setLastCodingSimPreview(data.lastCodingSimPreview ?? null);
      setCodingSimDominantDimensions(Array.isArray(data.codingSimDominantDimensions) ? data.codingSimDominantDimensions : []);
      setHumanPlanetLaws(Array.isArray(data.humanPlanetLaws) ? data.humanPlanetLaws : []);
      setQuantumRoleLaws(Array.isArray(data.quantumRoleLaws) ? data.quantumRoleLaws : []);
      setNocrPlanetRootLaws(Array.isArray(data.nocrPlanetRootLaws) ? data.nocrPlanetRootLaws : []);
      setNocrPlanetParity(data.nocrPlanetParity ?? null);
      setLastNocrPreview(data.lastNocrPreview ?? null);
      setBranchTreePlanetRootLaws(Array.isArray(data.branchTreePlanetRootLaws) ? data.branchTreePlanetRootLaws : []);
      setBranchTreePlanetParity(data.branchTreePlanetParity ?? null);
      setLastBranchTreePreview(data.lastBranchTreePreview ?? null);
      setLastCollapseMatchPreview(Array.isArray(data.lastCollapseMatchPreview) ? data.lastCollapseMatchPreview : []);
      setLastCollapseMatchLedgerPreview(Array.isArray(data.lastCollapseMatchLedgerPreview) ? data.lastCollapseMatchLedgerPreview : []);
      setBranchTreeLifecycle(data.branchTreeLifecycle ?? null);
      setBranchTreeQuery(data.branchTreeQuery ?? null);
      setActiveChat(data.activeChat ?? null);
      setNslPlanetRootLaws(Array.isArray(data.nslPlanetRootLaws) ? data.nslPlanetRootLaws : []);
      setNslPlanetParity(data.nslPlanetParity ?? null);
      setLastNslPreview(data.lastNslPreview ?? null);
      setRootCoverage(data.rootCoverage ?? null);
      setCapabilityGraph(data.capabilityGraph ?? null);
      setAbilityPlanet(data.abilityPlanet ?? { coding: [], web_search: [] });
      setActiveAbilityPlanet(data.activeAbilityPlanet ?? { coding: [], web_search: [] });
      setPlanetSourceInventory(data.planetSourceInventory ?? { sun: [], meta: [], ai_model: [], human: [], quantum: [], nocr: [], nsl: [], branch_tree: [] });
      setPlanetSourceCounts(data.planetSourceCounts ?? { sun: 0, meta: 0, ai_model: 0, human: 0, quantum: 0, nocr: 0, nsl: 0, branch_tree: 0 });
      setUniverseSourceInventory(data.universeSourceInventory ?? {
        reality_universe: { sun: [], ability: [], quantum: [] },
        human_universe: { human: [] },
        fiction_universe: { fiction: [] },
        global_service: { meta: [], ai_model: [], nocr: [], nsl: [], branch_tree: [], meta_delivery: [] },
      });
      setUniverseSourceCounts(data.universeSourceCounts ?? {
        reality_universe: { sun: 0, ability: 0, quantum: 0, total: 0 },
        human_universe: { human: 0, total: 0 },
        fiction_universe: { fiction: 0, total: 0 },
        global_service: { meta: 0, ai_model: 0, nocr: 0, nsl: 0, branch_tree: 0, meta_delivery: 0, total: 0 },
      });
    })();
  }, [sessionId]);

  const refreshMetaHardeningState = useCallback(async () => {
    if (!sessionId || sessionId === "default-session") {
      return;
    }
    const response = await fetch(`/api/lml-state?sessionId=${encodeURIComponent(sessionId)}`);
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as LmlStateResponse;
    setActiveAutoLaws(Array.isArray(data.activeAutoLaws) ? data.activeAutoLaws : []);
    setPendingLawProposals(Array.isArray(data.pendingLawProposals) ? data.pendingLawProposals : []);
    setQuantumBlanketSuggestions(Array.isArray(data.quantumBlanketSuggestions) ? data.quantumBlanketSuggestions : []);
    setFailureLearningSuggestions(Array.isArray(data.failureLearningSuggestions) ? data.failureLearningSuggestions : []);
    setAiModelPlanetSuggestions(Array.isArray(data.aiModelPlanetSuggestions) ? data.aiModelPlanetSuggestions : []);
    setAutomation(data.automation ?? {
      metaLoopMode: "ask_every_update",
      metaLoopAlwaysOn: true,
      quantumBlanketAlwaysOn: true,
      modelPolicy: "model_agnostic",
      lastMetaLoopTickAt: null,
      lastQuantumBlanketTickAt: null,
    });
    setMetaLoopWorker(data.metaLoopWorker ?? null);
    setMetaDeliveryLedgerCount(data.metaDeliveryLedgerCount ?? 0);
    setMetaDeliveryPlanetRootCount(data.metaDeliveryPlanetRootCount ?? 0);
    setMetaDeliveryPlanetRootLaws(Array.isArray(data.metaDeliveryPlanetRootLaws) ? data.metaDeliveryPlanetRootLaws : []);
    setMetaDeliveryPlanetParity(data.metaDeliveryPlanetParity ?? null);
    setLastMetaDeliveryPreview(data.lastMetaDeliveryPreview ?? null);
    setMetaPlanetLaws(Array.isArray(data.metaPlanetLaws) ? data.metaPlanetLaws : []);
    setAiModelPlanetLaws(Array.isArray(data.aiModelPlanetLaws) ? data.aiModelPlanetLaws : []);
    setActiveMetaPlanetLaws(Array.isArray(data.activeMetaPlanetLaws) ? data.activeMetaPlanetLaws : []);
    setCriticalAutoMetaUpdates(Array.isArray(data.criticalAutoMetaUpdates) ? data.criticalAutoMetaUpdates : []);
    setPendingNonCriticalMetaUpdates(Array.isArray(data.pendingNonCriticalMetaUpdates) ? data.pendingNonCriticalMetaUpdates : []);
    setActiveAiModelPlanetHardeningLaws(Array.isArray(data.activeAiModelPlanetHardeningLaws) ? data.activeAiModelPlanetHardeningLaws : []);
    setNslDeterministicCodingRepairCount(typeof data.nslDeterministicCodingRepairCount === "number" ? data.nslDeterministicCodingRepairCount : 0);
    setLastNslDeterministicCodingRepairPreview(data.lastNslDeterministicCodingRepairPreview ?? null);
    setCodingSimLedgerCount(typeof data.codingSimLedgerCount === "number" ? data.codingSimLedgerCount : 0);
    setLastCodingSimPreview(data.lastCodingSimPreview ?? null);
    setCodingSimDominantDimensions(Array.isArray(data.codingSimDominantDimensions) ? data.codingSimDominantDimensions : []);
    setHumanPlanetLaws(Array.isArray(data.humanPlanetLaws) ? data.humanPlanetLaws : []);
    setQuantumRoleLaws(Array.isArray(data.quantumRoleLaws) ? data.quantumRoleLaws : []);
    setNocrPlanetRootLaws(Array.isArray(data.nocrPlanetRootLaws) ? data.nocrPlanetRootLaws : []);
    setNocrPlanetParity(data.nocrPlanetParity ?? null);
    setLastNocrPreview(data.lastNocrPreview ?? null);
    setBranchTreePlanetRootLaws(Array.isArray(data.branchTreePlanetRootLaws) ? data.branchTreePlanetRootLaws : []);
    setBranchTreePlanetParity(data.branchTreePlanetParity ?? null);
    setLastBranchTreePreview(data.lastBranchTreePreview ?? null);
    setLastCollapseMatchPreview(Array.isArray(data.lastCollapseMatchPreview) ? data.lastCollapseMatchPreview : []);
    setLastCollapseMatchLedgerPreview(Array.isArray(data.lastCollapseMatchLedgerPreview) ? data.lastCollapseMatchLedgerPreview : []);
    setBranchTreeLifecycle(data.branchTreeLifecycle ?? null);
    setBranchTreeQuery(data.branchTreeQuery ?? null);
    setActiveChat(data.activeChat ?? null);
    setNslPlanetRootLaws(Array.isArray(data.nslPlanetRootLaws) ? data.nslPlanetRootLaws : []);
    setNslPlanetParity(data.nslPlanetParity ?? null);
    setLastNslPreview(data.lastNslPreview ?? null);
    setRootCoverage(data.rootCoverage ?? null);
    setCapabilityGraph(data.capabilityGraph ?? null);
    setAbilityPlanet(data.abilityPlanet ?? { coding: [], web_search: [] });
    setActiveAbilityPlanet(data.activeAbilityPlanet ?? { coding: [], web_search: [] });
    setPlanetSourceInventory(data.planetSourceInventory ?? { sun: [], meta: [], ai_model: [], human: [], quantum: [], nocr: [], nsl: [], branch_tree: [] });
    setPlanetSourceCounts(data.planetSourceCounts ?? { sun: 0, meta: 0, ai_model: 0, human: 0, quantum: 0, nocr: 0, nsl: 0, branch_tree: 0 });
    setUniverseSourceInventory(data.universeSourceInventory ?? {
      reality_universe: { sun: [], ability: [], quantum: [] },
      human_universe: { human: [] },
      fiction_universe: { fiction: [] },
      global_service: { meta: [], ai_model: [], nocr: [], nsl: [], branch_tree: [], meta_delivery: [] },
    });
    setUniverseSourceCounts(data.universeSourceCounts ?? {
      reality_universe: { sun: 0, ability: 0, quantum: 0, total: 0 },
      human_universe: { human: 0, total: 0 },
      fiction_universe: { fiction: 0, total: 0 },
      global_service: { meta: 0, ai_model: 0, nocr: 0, nsl: 0, branch_tree: 0, meta_delivery: 0, total: 0 },
    });
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || sessionId === "default-session") {
      return;
    }
    const interval = window.setInterval(() => {
      void refreshMetaHardeningState();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [refreshMetaHardeningState, sessionId]);

  async function updateMetaLoopMode(mode: "ask_every_update" | "automate") {
    if (!sessionId || sessionId === "default-session") {
      return;
    }
    await fetch("/api/lml-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, metaLoopMode: mode }),
    });
    await refreshMetaHardeningState();
  }

  async function onDocumentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setLoadError(null);
    try {
      const loaded: DocArtifact[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const lower = file.name.toLowerCase();
        let extracted = "";
        if (lower.endsWith(".pdf")) {
          const bytes = new Uint8Array(await file.arrayBuffer());
          extracted = await extractPdfViaApi(file.name, bytes);
          if (!extracted.trim()) {
            extracted = extractTextFromPdfBytes(bytes);
          }
        } else {
          extracted = await file.text();
        }
        const text = extracted.trim();
        if (!text) {
          continue;
        }
        loaded.push({
          id: `${file.name}-${Date.now()}-${i}`,
          name: file.name,
          text,
        });
      }
      if (loaded.length === 0) {
        setLoadError("No readable text extracted from selected files.");
        return;
      }
      setDocuments((current) => [...current, ...loaded]);
    } catch {
      setLoadError("Failed to load document(s).");
    }
  }

  async function ingestToLml() {
    const artifact = [allDocText.trim(), manualLawText.trim()].filter(Boolean).join("\n\n");
    if (!artifact) {
      return;
    }

    setIngestLoading(true);
    setIngestError(null);

    try {
      const response = await fetch("/api/snap-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artifact,
          profileId: "DOC_LAW_PROFILE",
          runMode: "demo",
        }),
      });

      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to ingest.");
      }

      const data = (await response.json()) as SnapRunResponse;
      const extractedUserLaws = data.C_DELTA.LML_ADD.filter(
        (law) =>
          (law.source_claim_ids.length > 0 || !isProfileSeedLaw(law.text)) &&
          !isPlaceholderLaw(law.text) &&
          !isLowSignalGeneratedLaw(law.text),
      );
      const blockerCount = data.D_BLOCKERS.HOLES_BLOCKING_LML.length + data.D_BLOCKERS.HOLES_BLOCKING_NSL.length;
      if (extractedUserLaws.length === 0) {
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            text:
              blockerCount > 0
                ? `System notice: extraction completed with ${blockerCount} blocker(s). No admissible user laws activated in this run.`
                : "System notice: extraction completed but no admissible user laws were activated.",
          },
        ]);
        setLastRun(data);
        return;
      }
      const merged = mergeUniqueLaws(activeUserLaws.filter((law) => !isFallbackLaw(law.law_id)), extractedUserLaws);
      setActiveUserLaws(merged);
      await fetch("/api/lml-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action: "replace", userLaws: merged }),
      });
      setLastRun(data);
      setIngestRuns((count) => count + 1);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text:
            blockerCount > 0
              ? `System notice: activated ${merged.length} user law(s); ${blockerCount} blocker(s) remain active for repair/evidence fill.`
              : `System notice: activated ${merged.length} user law(s) from ${documents.length} document(s).`,
        },
      ]);
      await refreshMetaHardeningState();
    } catch (error) {
      setIngestError(error instanceof Error ? error.message : "Failed to ingest.");
    } finally {
      setIngestLoading(false);
    }
  }

  async function askAgent() {
    const userPrompt = prompt.trim();
    if (!userPrompt) {
      return;
    }

    setChatLoading(true);
    setMessages((current) => [...current, { role: "user", text: userPrompt }]);
    try {
      const response = await fetch("/api/lml-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userPrompt,
          sessionId,
          userLaws: activeUserLaws.map((law) => ({
            law_id: law.law_id,
            text: law.text,
            scope: law.scope,
            enforcement: law.enforcement,
          })),
          documentText: allDocText,
          documents: documents.map((doc) => ({ id: doc.id, name: doc.name, text: doc.text })),
        }),
      });
      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to run chat.");
      }
      const data = (await response.json()) as ChatApiResponse;
      setLastTrace(data.trace);
      setLastModel(data.model);
      setLastCode(data.code);
      setCopyState("idle");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: data.answer,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: error instanceof Error ? error.message : "Failed to run chat.",
        },
      ]);
    } finally {
      setChatLoading(false);
      await refreshMetaHardeningState();
    }
  }

  function removeLaw(lawId: string) {
    const next = activeUserLaws.filter((law) => law.law_id !== lawId);
    setActiveUserLaws(next);
    void fetch("/api/lml-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "replace", userLaws: next }),
    });
    void refreshMetaHardeningState();
    setMessages((current) => [
      ...current,
      { role: "assistant", text: `System notice: law ${lawId} removed. Active overlay law entries: ${next.length}.` },
    ]);
  }

  async function copyCodeToClipboard() {
    const value = lastCode?.primary?.code;
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  function wipeAllLaws() {
    setActiveUserLaws([]);
    void fetch("/api/lml-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "clear" }),
    });
    void refreshMetaHardeningState();
    setMessages((current) => [
      ...current,
      { role: "assistant", text: "System notice: all user laws removed. Runtime recompiled to sun-only universe state." },
    ]);
  }

  function removeDocument(docId: string) {
    setDocuments((current) => current.filter((doc) => doc.id !== docId));
  }

  return (
    <main>
      <header className="hero">
        <div className="watermark">CUSTOMAIS-LML CUSTOMIZE AI IDE</div>
        <h1>We Turn Your Rules into Laws that Define AI Behavior.</h1>
        <p>The sun stays immutable. Stack unlimited docs/text as user overlay laws inside one loaded universe.</p>
      </header>

      <section className="grid triplet">
        <article className="card">
          <strong>AI Chat</strong>
          <div className="chatCodeRow">
            <div className="chatPane">
              <div className="list" style={{ maxHeight: "52vh" }}>
                {messages.map((message, index) => (
                  <div className="item" key={`${message.role}-${String(index)}`}>
                    <div><strong>{message.role === "assistant" ? "AI" : "You"}</strong></div>
                    <pre>{message.text}</pre>
                  </div>
                ))}
              </div>
              <div className="controls one-col">
                <textarea
                  value={prompt}
                  placeholder={DEFAULT_PROMPT}
                  onChange={(event) => setPrompt(event.target.value)}
                  rows={3}
                />
                <button type="button" onClick={() => void askAgent()} disabled={chatLoading}>
                  {chatLoading ? "Running LML..." : "Send"}
                </button>
              </div>
            </div>
            <div className="codePane">
              <strong>Generated Code</strong>
              {!lastCode || !lastCode.primary ? (
                <div className="meta">No code block in the latest response.</div>
              ) : (
                <div>
                  <div className="actions">
                    <button type="button" className="secondary" onClick={() => void copyCodeToClipboard()}>
                      Copy Code
                    </button>
                  </div>
                  <div className="meta">
                    language: {lastCode.primary.language} {copyState === "copied" ? "| copied" : copyState === "error" ? "| copy failed" : ""}
                  </div>
                  <pre className="codeBox">{lastCode.primary.code}</pre>
                </div>
              )}
            </div>
          </div>
          <details className="card" open>
            <summary><strong>Enforcement Trace</strong></summary>
            {!lastTrace ? <div className="meta">No trace yet.</div> : (
              <div className="list compact">
                <div className="item"><strong>gate_failed:</strong> {String(lastTrace.gate_failed ?? "none")}</div>
                <div className="item"><strong>failed_predicate:</strong> {String(lastTrace.failed_predicate ?? "none")}</div>
                <div className="item"><strong>null_state:</strong> {String(Boolean(lastTrace.null_state))}</div>
                <div className="item"><strong>ability_route:</strong> {lastTrace.ability_route}</div>
                <div className="item"><strong>system_laws:</strong> {(lastTrace.system_laws ?? []).length}</div>
                <div className="item"><strong>triggered_constraints:</strong> {(lastTrace.triggered_constraints ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>failed_laws:</strong> {(lastTrace.failed_laws ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>failure_classes:</strong> {(lastTrace.failure_classes ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>triggered_repairs:</strong> {(lastTrace.triggered_repairs ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>return_moves:</strong> {(lastTrace.return_moves ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>null_staircase.state:</strong> {lastTrace.null_staircase?.state ?? "none"}</div>
                <div className="item"><strong>null_staircase.witness:</strong> {lastTrace.null_staircase
                  ? `${lastTrace.null_staircase.witness.gate} / ${lastTrace.null_staircase.witness.predicate}`
                  : "none"}
                </div>
                <div className="item"><strong>null_staircase.violations:</strong> {(lastTrace.null_staircase?.witness.violations ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>null_staircase.loop:</strong> {(lastTrace.null_staircase?.loop ?? []).join(" -> ") || "none"}</div>
                <div className="item"><strong>path_orchestrator.formation:</strong> {lastTrace.path_orchestrator?.formation_id ?? "none"}</div>
                <div className="item"><strong>path_orchestrator.terminated:</strong> {String(lastTrace.path_orchestrator?.terminated ?? false)}</div>
                <div className="item"><strong>path_orchestrator.reason:</strong> {lastTrace.path_orchestrator?.termination_reason ?? "none"}</div>
                <div className="item"><strong>path_orchestrator.stages:</strong> {(lastTrace.path_orchestrator?.stages ?? [])
                  .map((stage) => `${stage.stage}:${stage.status}`)
                  .join(" | ") || "none"}
                </div>
                <div className="item"><strong>nocr.seed_tag:</strong> {lastTrace.nocr_funnel?.seed_tag ?? "none"}</div>
                <div className="item"><strong>nocr.root_space_size:</strong> {String(lastTrace.nocr_funnel?.root_space_size ?? 0)}</div>
                <div className="item"><strong>nocr.ledger_state:</strong> {lastTrace.nocr_funnel?.ledger_state ?? "none"}</div>
                <div className="item"><strong>nocr.reason:</strong> {lastTrace.nocr_funnel?.reason ?? "none"}</div>
                <div className="item"><strong>nocr_input.root_count:</strong> {String(lastTrace.nocr_input?.root_count ?? 0)}</div>
                <div className="item"><strong>nocr_input.chat_exact_seed_count:</strong> {String(lastTrace.nocr_input?.chat_exact_seed_count ?? 0)}</div>
                <div className="item"><strong>nocr_input.chat_qe_seed_count:</strong> {String(lastTrace.nocr_input?.chat_qe_seed_count ?? 0)}</div>
                <div className="item"><strong>chat_seed_lane.exact_seed_count:</strong> {String(lastTrace.chat_seed_lane?.exact_seed_count ?? 0)}</div>
                <div className="item"><strong>chat_seed_lane.primary_seed_id:</strong> {lastTrace.chat_seed_lane?.primary_seed_id ?? "none"}</div>
                <div className="item"><strong>chat_seed_lane.primary_seed_origin:</strong> {lastTrace.chat_seed_lane?.primary_seed_origin ?? "none"}</div>
                <div className="item"><strong>chat_seed_lane.qe_candidate_count:</strong> {String(lastTrace.chat_seed_lane?.qe_candidate_count ?? 0)}</div>
                <div className="item"><strong>chat_seed_lane.qe_seed_count:</strong> {String(lastTrace.chat_seed_lane?.qe_seed_count ?? 0)}</div>
                <div className="item"><strong>chat_seed_lane.primary_qe_seed_id:</strong> {lastTrace.chat_seed_lane?.primary_qe_seed_id ?? "none"}</div>
                <div className="item"><strong>chat_seed_lane.primary_qe_seed_origin:</strong> {lastTrace.chat_seed_lane?.primary_qe_seed_origin ?? "none"}</div>
                <div className="item"><strong>chat_branch.action:</strong> {lastTrace.chat_branch?.action ?? "none"}</div>
                <div className="item"><strong>chat_branch.governance_reason:</strong> {lastTrace.chat_branch?.governance_reason ?? "none"}</div>
                <div className="item"><strong>chat_branch.active_branch_id:</strong> {lastTrace.chat_branch?.active_branch_id ?? "none"}</div>
                <div className="item"><strong>chat_branch.active_tree_id:</strong> {lastTrace.chat_branch?.active_tree_id ?? "none"}</div>
                <div className="item"><strong>chat_branch.branch_turn_count:</strong> {String(lastTrace.chat_branch?.branch_turn_count ?? 0)}</div>
                <div className="item"><strong>chat_branch.branch_seed_count:</strong> {String(lastTrace.chat_branch?.branch_seed_count ?? 0)}</div>
                <div className="item"><strong>chat_branch.branch_parent_count:</strong> {String(lastTrace.chat_branch?.branch_parent_count ?? 0)}</div>
                <div className="item"><strong>collapse.root:</strong> {lastTrace.quantum_collapse?.root_id ?? "none"}</div>
                <div className="item"><strong>collapse.root_tag:</strong> {lastTrace.quantum_collapse?.root_tag ?? "none"}</div>
                <div className="item"><strong>collapse.branch_id:</strong> {lastTrace.quantum_collapse?.branch_id ?? "none"}</div>
                <div className="item"><strong>collapse.tree_id:</strong> {lastTrace.quantum_collapse?.tree_id ?? "none"}</div>
                <div className="item"><strong>collapse.state_change_id:</strong> {lastTrace.quantum_collapse?.state_change_id ?? "none"}</div>
                <div className="item"><strong>collapse.domain:</strong> {lastTrace.quantum_collapse?.domain ?? "none"}</div>
                <div className="item"><strong>collapse.lock_state:</strong> {lastTrace.quantum_collapse?.lock_state ?? "none"}</div>
                <div className="item"><strong>collapse.lock_reason_class:</strong> {lastTrace.quantum_collapse?.lock_reason_class ?? "none"}</div>
                <div className="item"><strong>collapse.match_score:</strong> {String(lastTrace.quantum_collapse?.match_score ?? 0)}</div>
                <div className="item"><strong>collapse.qe_generated_root_count:</strong> {String(lastTrace.quantum_collapse?.qe_generated_root_count ?? 0)}</div>
                <div className="item"><strong>collapse.qe_checked_root_count:</strong> {String(lastTrace.quantum_collapse?.qe_checked_root_count ?? 0)}</div>
                <div className="item"><strong>collapse.snap_match_count:</strong> {String(lastTrace.quantum_collapse?.snap_match_count ?? 0)}</div>
                <div className="item"><strong>collapse.reason:</strong> {lastTrace.quantum_collapse?.reason ?? "none"}</div>
                {(lastTrace.quantum_collapse?.snap_matches ?? []).slice(0, 6).map((match, idx) => (
                  <div className="item" key={`snap-match-${idx}`}>
                    <strong>{`snap_match_${idx + 1}:`}</strong> {`${match.seed_id} -> ${match.root_id} [${match.domain} | ${match.reason_class} | ${match.score}]`}
                  </div>
                ))}
                <div className="item"><strong>root_registry.static_count:</strong> {String(lastTrace.root_registry?.static_count ?? 0)}</div>
                <div className="item"><strong>root_registry.extracted_count:</strong> {String(lastTrace.root_registry?.extracted_count ?? 0)}</div>
                <div className="item"><strong>root_registry.total_count:</strong> {String(lastTrace.root_registry?.total_count ?? 0)}</div>
                <div className="item"><strong>root_registry.source_units:</strong> {String(lastTrace.root_registry?.source_units ?? 0)}</div>
                <div className="item"><strong>root_registry.extracted_root_count:</strong> {String(lastTrace.root_registry?.extracted_root_count ?? 0)}</div>
                <div className="item"><strong>root_registry.expansion_delta:</strong> {String(lastTrace.root_registry?.expansion_delta ?? 0)}</div>
                <div className="item"><strong>root_registry.under_enumerated:</strong> {String(lastTrace.root_registry?.under_enumerated ?? false)}</div>
                <div className="item"><strong>root_registry.identity_kernel_count:</strong> {String(lastTrace.root_registry?.identity_kernel_count ?? 0)}</div>
                <div className="item"><strong>root_registry.legality_region_count:</strong> {String(lastTrace.root_registry?.legality_region_count ?? 0)}</div>
                <div className="item"><strong>root_registry.directive_count:</strong> {String(lastTrace.root_registry?.directive_count ?? 0)}</div>
                <div className="item"><strong>root_registry.code_unit_count:</strong> {String(lastTrace.root_registry?.code_unit_count ?? 0)}</div>
                <div className="item"><strong>root_registry.math_unit_count:</strong> {String(lastTrace.root_registry?.math_unit_count ?? 0)}</div>
                <div className="item"><strong>root_registry.sentence_count:</strong> {String(lastTrace.root_registry?.sentence_count ?? 0)}</div>
                <div className="item"><strong>root_registry.artifact_root_count:</strong> {String(lastTrace.root_registry?.artifact_root_count ?? 0)}</div>
                <div className="item"><strong>root_registry.user_law_root_count:</strong> {String(lastTrace.root_registry?.user_law_root_count ?? 0)}</div>
                <div className="item"><strong>nocr_parity.ok:</strong> {String(lastTrace.nocr_parity?.ok ?? false)}</div>
                <div className="item"><strong>nocr_parity.fail_closed:</strong> {String(lastTrace.nocr_parity?.fail_closed ?? false)}</div>
                <div className="item"><strong>generation.status:</strong> {lastTrace.generation?.status ?? "none"}</div>
                <div className="item"><strong>generation.failure_class:</strong> {lastTrace.generation?.failure_class ?? "none"}</div>
                <div className="item"><strong>generation.detail:</strong> {lastTrace.generation?.detail ?? "none"}</div>
                <div className="item"><strong>nocr_parity.missing:</strong> {(lastTrace.nocr_parity?.missing_law_ids ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>nocr_parity.extra:</strong> {(lastTrace.nocr_parity?.extra_law_ids ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>failure_learning.proposed_law_count:</strong> {String(lastTrace.failure_learning?.proposed_law_count ?? 0)}</div>
                <div className="item"><strong>failure_learning.signature:</strong> {lastTrace.failure_learning?.signature ?? "none"}</div>
                <div className="item"><strong>failure_learning.sources:</strong> {(lastTrace.failure_learning?.sources ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>reason:</strong> {lastTrace.reason}</div>
              </div>
            )}
          </details>
          <details className="card" open>
            <summary><strong>Meta Planet</strong></summary>
            <div className="actions">
              <button
                type="button"
                className="secondary"
                disabled={automation.metaLoopMode === "ask_every_update"}
                onClick={() => void updateMetaLoopMode("ask_every_update")}
              >
                Ask Every Update
              </button>
              <button
                type="button"
                className="secondary"
                disabled={automation.metaLoopMode === "automate"}
                onClick={() => void updateMetaLoopMode("automate")}
              >
                Automate
              </button>
            </div>
            <div className="list compact">
              <div className="item"><strong>meta_loop_mode:</strong> {automation.metaLoopMode}</div>
              <div className="item"><strong>meta_loop_always_on:</strong> {String(automation.metaLoopAlwaysOn)}</div>
              <div className="item"><strong>quantum_blanket_always_on:</strong> {String(automation.quantumBlanketAlwaysOn)}</div>
              <div className="item"><strong>model_policy:</strong> {automation.modelPolicy}</div>
              <div className="item"><strong>worker_running:</strong> {String(metaLoopWorker?.running ?? false)}</div>
              <div className="item"><strong>worker_last_tick:</strong> {metaLoopWorker?.at ?? automation.lastMetaLoopTickAt ?? "none"}</div>
              <div className="item"><strong>worker_sessions:</strong> {String(metaLoopWorker?.sessionCount ?? 0)}</div>
              <div className="item"><strong>worker_deliveries:</strong> {String(metaLoopWorker?.deliveries ?? 0)}</div>
              <div className="item"><strong>worker_applied:</strong> {String(metaLoopWorker?.applied ?? 0)}</div>
              <div className="item"><strong>worker_critical_applied:</strong> {String(metaLoopWorker?.criticalApplied ?? 0)}</div>
              <div className="item"><strong>meta_last_tick:</strong> {automation.lastMetaLoopTickAt ?? "none"}</div>
              <div className="item"><strong>quantum_blanket_last_tick:</strong> {automation.lastQuantumBlanketTickAt ?? "none"}</div>
              <div className="item"><strong>meta_planet_base_laws:</strong> {metaPlanetLaws.length}</div>
              <div className="item"><strong>active_meta_planet_laws:</strong> {activeMetaPlanetLaws.length}</div>
              <div className="item"><strong>pending_meta_planet_proposals:</strong> {pendingLawProposals.length}</div>
              <div className="item"><strong>critical_auto_meta_updates:</strong> {criticalAutoMetaUpdates.length}</div>
              <div className="item"><strong>pending_non_critical_meta_updates:</strong> {pendingNonCriticalMetaUpdates.length}</div>
              <div className="item"><strong>quantum_blanket_seed_proposals:</strong> {quantumBlanketSuggestions.length}</div>
              <div className="item"><strong>failure_learning_seed_proposals:</strong> {failureLearningSuggestions.length}</div>
              <div className="item"><strong>active_ai_model_planet_hardening_laws:</strong> {activeAiModelPlanetHardeningLaws.length}</div>
              <div className="item"><strong>ai_model_planet_updates:</strong> {aiModelPlanetSuggestions.length}</div>
            </div>
            <div className="list compact">
              <div className="item"><strong>Critical Auto-Applied Meta Updates</strong></div>
              {(criticalAutoMetaUpdates.length === 0 ? activeMetaPlanetLaws.slice(0, 0) : criticalAutoMetaUpdates).slice(0, 8).map((law, idx) => (
                <div className="item" key={`meta-law-${idx}`}>
                  <div><strong>{law.source}</strong> [{law.scope} | {law.enforcement}]</div>
                  <div className="meta">{law.text}</div>
                </div>
              ))}
              {criticalAutoMetaUpdates.length === 0 ? <div className="item">No critical auto-applied updates.</div> : null}
            </div>
            <div className="list compact">
              <div className="item"><strong>Pending Non-Critical Meta Updates</strong></div>
              {pendingNonCriticalMetaUpdates.slice(0, 8).map((law, idx) => (
                <div className="item" key={`pending-meta-${idx}`}>
                  <div><strong>{law.source}</strong> [{law.scope} | {law.enforcement}]</div>
                  <div className="meta">{law.text}</div>
                </div>
              ))}
              {pendingNonCriticalMetaUpdates.length === 0 ? <div className="item">No pending non-critical updates.</div> : null}
            </div>
            <div className="list compact">
              <div className="item"><strong>Quantum Blanket Seed Suggestions</strong></div>
              {quantumBlanketSuggestions.slice(0, 4).map((law, idx) => (
                <div className="item" key={`quantum-blanket-${idx}`}>
                  <div><strong>quantum_blanket_seed</strong> [{law.scope} | {law.enforcement}]</div>
                  <div className="meta">{law.text}</div>
                </div>
              ))}
              {quantumBlanketSuggestions.length === 0 ? <div className="item">No quantum blanket seed suggestions.</div> : null}
            </div>
            <div className="list compact">
              <div className="item"><strong>Failure Learning Suggestions</strong></div>
              {failureLearningSuggestions.slice(0, 4).map((law, idx) => (
                <div className="item" key={`failure-learning-${idx}`}>
                  <div><strong>meta_failure_learning</strong> [{law.scope} | {law.enforcement}]</div>
                  <div className="meta">{law.text}</div>
                </div>
              ))}
              {failureLearningSuggestions.length === 0 ? <div className="item">No failure-learning suggestions.</div> : null}
            </div>
            <div className="list compact">
              <div className="item"><strong>AI Model Planet Hardening</strong></div>
              {activeAiModelPlanetHardeningLaws.slice(0, 6).map((law, idx) => (
                <div className="item" key={`active-ai-model-hardening-${idx}`}>
                  <div><strong>ai_model_planet_hardening</strong> [{law.scope} | {law.enforcement}]</div>
                  <div className="meta">{law.text}</div>
                </div>
              ))}
              {activeAiModelPlanetHardeningLaws.length === 0 ? <div className="item">No active AI model planet hardening laws yet.</div> : null}
            </div>
            <div className="list compact">
              <div className="item"><strong>AI Model Planet Updates</strong></div>
              {aiModelPlanetSuggestions.slice(0, 6).map((law, idx) => (
                <div className="item" key={`ai-model-hardening-${idx}`}>
                  <div><strong>ai_model_planet_hardening</strong> [{law.scope} | {law.enforcement}]</div>
                  <div className="meta">{law.text}</div>
                </div>
              ))}
              {aiModelPlanetSuggestions.length === 0 ? <div className="item">No AI model planet updates queued.</div> : null}
            </div>
          </details>
          <details className="card" open>
            <summary><strong>Meta Delivery Planet</strong></summary>
            <div className="list compact">
              <div className="item"><strong>meta_delivery_ledger_count:</strong> {metaDeliveryLedgerCount}</div>
              <div className="item"><strong>meta_delivery_planet_root_count:</strong> {metaDeliveryPlanetRootCount}</div>
              <div className="item"><strong>meta_delivery_parity.ok:</strong> {String(metaDeliveryPlanetParity?.ok ?? false)}</div>
              <div className="item"><strong>meta_delivery_parity.missing:</strong> {(metaDeliveryPlanetParity?.missingLawIds ?? []).join(" | ") || "none"}</div>
              <div className="item"><strong>meta_delivery_parity.extra:</strong> {(metaDeliveryPlanetParity?.extraLawIds ?? []).join(" | ") || "none"}</div>
              <div className="item"><strong>last_meta_delivery_event:</strong> {lastMetaDeliveryPreview?.eventType ?? "none"}</div>
              <div className="item"><strong>last_meta_delivery_at:</strong> {lastMetaDeliveryPreview?.at ?? "none"}</div>
              <div className="item"><strong>last_meta_delivery_text:</strong> {lastMetaDeliveryPreview?.text ?? "none"}</div>
            </div>
            <div className="list compact">
              <div className="item"><strong>Meta Delivery Planet Roots</strong></div>
              {metaDeliveryPlanetRootLaws.slice(0, 4).map((law, idx) => (
                <div className="item" key={`meta-delivery-root-${idx}`}>
                  <div><strong>meta_delivery_planet</strong></div>
                  <div className="meta">{law}</div>
                </div>
              ))}
              {metaDeliveryPlanetRootLaws.length === 0 ? <div className="item">No meta delivery planet roots yet.</div> : null}
            </div>
          </details>
          <details className="card" open>
            <summary><strong>Model Runtime</strong></summary>
            <div className="list compact">
              <div className="item">
                <strong>Active:</strong> {lastModel ? `${lastModel.provider} / ${lastModel.model}` : "gpt2-runtime / gpt2 (awaiting first turn)"}
              </div>
              <div className="item"><strong>Status:</strong> LIVE via LML runtime path</div>
              <div className="item"><strong>Call ID:</strong> {lastModel?.callId ?? "n/a"}</div>
              <div className="item"><strong>Run ID:</strong> {lastModel?.runId ?? "n/a"}</div>
              <div className="item"><strong>At:</strong> {lastModel?.at ?? "n/a"}</div>
              <div className="item"><strong>Catalog (placeholders):</strong></div>
              <div className="item">1. GPT-2 (Active)</div>
              <div className="item">2. GPT-4o (Inactive)</div>
              <div className="item">3. Claude 3.7 Sonnet (Inactive)</div>
              <div className="item">4. Llama 3.1 70B (Inactive)</div>
            </div>
          </details>
        </article>

        <article className="card">
          <strong>Law Entry</strong>
          <div className="controls one-col">
            <input type="file" accept=".pdf,.txt,.md,.rtf" multiple onChange={onDocumentChange} />
            <div className="meta">Docs stacked: {documents.length} | total chars: {totalDocChars.toLocaleString()}</div>
            {loadError ? <div className="danger">{loadError}</div> : null}
            <textarea
              placeholder="Type laws manually. You can add abilities, style/persona, addressing preference, safety constraints, behavior rules, and domain policies."
              value={manualLawText}
              onChange={(event) => setManualLawText(event.target.value)}
              rows={6}
            />
            <button type="button" onClick={() => void ingestToLml()} disabled={ingestLoading || (!allDocText.trim() && !manualLawText.trim())}>
              {ingestLoading ? "Applying LML..." : "Apply LML"}
            </button>
            {ingestError ? <div className="danger">{ingestError}</div> : null}
            {lastRun ? <div className="meta">run: {lastRun.runId} | blockers: {totalBlockers} | total ingests: {ingestRuns}</div> : null}
            {lastRun?.root_extraction || lastRun?.seed_extraction ? (
              <div className="meta">
                roots={lastRun.root_extraction?.count ?? 0} / source_units={lastRun.root_extraction?.source_units ?? 0} | quantum_candidates={lastRun.seed_extraction?.quantum_spark_candidates ?? 0} | finite_seeds={lastRun.seed_extraction?.finite_seed_count ?? 0}
              </div>
            ) : null}
          </div>
          <details className="card" open>
            <summary><strong>Stacked Docs ({documents.length})</strong></summary>
            <div className="list compact">
              {documents.length === 0 ? <div className="item">No docs loaded.</div> : null}
              {documents.map((doc) => (
                <div className="item" key={doc.id}>
                  <div><strong>{doc.name}</strong> ({doc.text.length.toLocaleString()} chars)</div>
                  <div className="actions">
                    <button type="button" className="secondary" onClick={() => removeDocument(doc.id)}>Remove Doc</button>
                  </div>
                </div>
              ))}
            </div>
          </details>
          <details className="card" open>
            <summary><strong>Double Extraction</strong></summary>
            <div className="list compact">
              <div className="item"><strong>root_extraction.count:</strong> {String(lastRun?.root_extraction?.count ?? 0)}</div>
              <div className="item"><strong>root_extraction.source_units:</strong> {String(lastRun?.root_extraction?.source_units ?? 0)}</div>
              <div className="item"><strong>root_extraction.extracted_root_count:</strong> {String(lastRun?.root_extraction?.extracted_root_count ?? 0)}</div>
              <div className="item"><strong>root_extraction.expansion_delta:</strong> {String(lastRun?.root_extraction?.expansion_delta ?? 0)}</div>
              <div className="item"><strong>root_extraction.under_enumerated:</strong> {String(lastRun?.root_extraction?.under_enumerated ?? false)}</div>
              <div className="item"><strong>root_extraction.identity_kernel_count:</strong> {String(lastRun?.root_extraction?.identity_kernel_count ?? 0)}</div>
              <div className="item"><strong>root_extraction.legality_region_count:</strong> {String(lastRun?.root_extraction?.legality_region_count ?? 0)}</div>
              <div className="item"><strong>root_extraction.directive_count:</strong> {String(lastRun?.root_extraction?.directive_count ?? 0)}</div>
              <div className="item"><strong>root_extraction.code_unit_count:</strong> {String(lastRun?.root_extraction?.code_unit_count ?? 0)}</div>
              <div className="item"><strong>root_extraction.math_unit_count:</strong> {String(lastRun?.root_extraction?.math_unit_count ?? 0)}</div>
              <div className="item"><strong>root_extraction.sentence_count:</strong> {String(lastRun?.root_extraction?.sentence_count ?? 0)}</div>
              <div className="item"><strong>seed_extraction.quantum_candidates:</strong> {String(lastRun?.seed_extraction?.quantum_spark_candidates ?? 0)}</div>
              <div className="item"><strong>seed_extraction.finite_seed_count:</strong> {String(lastRun?.seed_extraction?.finite_seed_count ?? 0)}</div>
              <div className="item">
                <div><strong>Root preview</strong></div>
                {((lastRun?.root_extraction?.roots ?? []).slice(0, 4)).map((root) => (
                  <div className="meta" key={root.id}>{root.domain} / {root.planet} / {root.label} / {root.provenance.classification} / {root.provenance.sourceLabel}</div>
                ))}
                {(lastRun?.root_extraction?.roots ?? []).length === 0 ? <div className="meta">No extracted roots.</div> : null}
              </div>
              <div className="item">
                <div><strong>Seed preview</strong></div>
                {((lastRun?.seed_extraction?.seeds ?? []).slice(0, 4)).map((seed) => (
                  <div className="meta" key={seed.id}>{seed.source} / {seed.abilityRoute} / {seed.origin} / rank={seed.rank} / {seed.text}</div>
                ))}
                {(lastRun?.seed_extraction?.seeds ?? []).length === 0 ? <div className="meta">No extracted seeds.</div> : null}
              </div>
            </div>
          </details>
          <details className="card" open>
            <summary><strong>Loaded Universe Laws ({activeCount})</strong></summary>
            <div className="actions">
              <button type="button" className="secondary" onClick={wipeAllLaws} disabled={activeCount === 0}>Deactivate All</button>
            </div>
            <div className="list compact">
              <div className="item">
                <strong>Ability states:</strong>{" "}
                coding={capabilityGraph?.abilities.coding.state ?? "unspecified"} | web_search={capabilityGraph?.abilities.web_search.state ?? "unspecified"}
              </div>
              <div className="item">
                <strong>Ability planet laws visible:</strong>{" "}
                coding={activeAbilityPlanet.coding.length} / {abilityPlanet.coding.length} | web_search={activeAbilityPlanet.web_search.length} / {abilityPlanet.web_search.length}
              </div>
            </div>
            <div className="list compact">
              {activeCount === 0 ? <div className="item">No user laws loaded.</div> : null}
              {activeUserLaws.map((law) => (
                <div className="item" key={law.law_id}>
                  <div><strong>{law.law_id}</strong> [{law.scope} | {law.enforcement}]</div>
                  <div className="meta">{law.text}</div>
                  <div className="actions">
                    <button type="button" className="secondary" onClick={() => removeLaw(law.law_id)}>Deactivate Law</button>
                  </div>
                </div>
              ))}
            </div>
            <details className="card" open>
              <summary><strong>Ability Planet</strong></summary>
              <div className="list compact">
                {activeAbilityPlanet.coding.length === 0 && activeAbilityPlanet.web_search.length === 0 ? (
                  <div className="item">Ability planet is not active.</div>
                ) : null}
                {activeAbilityPlanet.coding.length > 0 ? (
                  <div className="item">
                    <div><strong>Coding laws ({activeAbilityPlanet.coding.length})</strong></div>
                    {activeAbilityPlanet.coding.map((law, idx) => (
                      <div className="meta" key={`ability-coding-${idx}`}>{law}</div>
                    ))}
                  </div>
                ) : null}
                {activeAbilityPlanet.web_search.length > 0 ? (
                  <div className="item">
                    <div><strong>Web Search laws ({activeAbilityPlanet.web_search.length})</strong></div>
                    {activeAbilityPlanet.web_search.map((law, idx) => (
                      <div className="meta" key={`ability-web-${idx}`}>{law}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            </details>
            <details className="card" open>
              <summary><strong>NOCR Planet</strong></summary>
              <div className="list compact">
                <div className="item"><strong>nocr_planet_root_laws:</strong> {nocrPlanetRootLaws.length}</div>
                <div className="item"><strong>ledger_parity_ok:</strong> {String(nocrPlanetParity?.ok ?? false)}</div>
                <div className="item"><strong>missing_law_ids:</strong> {(nocrPlanetParity?.missingLawIds ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>extra_law_ids:</strong> {(nocrPlanetParity?.extraLawIds ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>last_nocr_event:</strong> {lastNocrPreview?.eventType ?? "none"}</div>
                <div className="item"><strong>last_nocr_at:</strong> {lastNocrPreview?.at ?? "none"}</div>
                <div className="item"><strong>last_nocr_text:</strong> {lastNocrPreview?.text ?? "none"}</div>
                {(nocrPlanetRootLaws.length === 0 ? ["No NOCR planet root laws yet."] : nocrPlanetRootLaws.slice(0, 6)).map((law, idx) => (
                  <div className="meta" key={`nocr-planet-${idx}`}>{law}</div>
                ))}
              </div>
            </details>
            <details className="card" open>
              <summary><strong>Branch / Tree Planet</strong></summary>
              <div className="list compact">
                <div className="item"><strong>branch_tree_planet_root_laws:</strong> {branchTreePlanetRootLaws.length}</div>
                <div className="item"><strong>ledger_parity_ok:</strong> {String(branchTreePlanetParity?.ok ?? false)}</div>
                <div className="item"><strong>missing_law_ids:</strong> {(branchTreePlanetParity?.missingLawIds ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>extra_law_ids:</strong> {(branchTreePlanetParity?.extraLawIds ?? []).join(" | ") || "none"}</div>
              <div className="item"><strong>last_branch_tree_event:</strong> {lastBranchTreePreview?.eventType ?? "none"}</div>
              <div className="item"><strong>last_branch_tree_at:</strong> {lastBranchTreePreview?.at ?? "none"}</div>
              <div className="item"><strong>last_branch_tree_text:</strong> {lastBranchTreePreview?.text ?? "none"}</div>
              <div className="item"><strong>collapse_resolved_count:</strong> {String(branchTreeLifecycle?.collapse_resolved ?? 0)}</div>
              <div className="item"><strong>collapse_match_resolved_count:</strong> {String(branchTreeLifecycle?.collapse_match_resolved ?? 0)}</div>
              <div className="item"><strong>branch_extended_count:</strong> {String(branchTreeLifecycle?.branch_extended ?? 0)}</div>
              <div className="item"><strong>tree_extended_count:</strong> {String(branchTreeLifecycle?.tree_extended ?? 0)}</div>
              <div className="item"><strong>tree_started_count:</strong> {String(branchTreeLifecycle?.tree_started ?? 0)}</div>
              <div className="item"><strong>branch_forked_count:</strong> {String(branchTreeLifecycle?.branch_forked ?? 0)}</div>
              <div className="item"><strong>branch_sibling_created_count:</strong> {String(branchTreeLifecycle?.branch_sibling_created ?? 0)}</div>
              <div className="item"><strong>branch_merged_count:</strong> {String(branchTreeLifecycle?.branch_merged ?? 0)}</div>
              <div className="item"><strong>branch_closed_count:</strong> {String(branchTreeLifecycle?.branch_closed ?? 0)}</div>
              <div className="item"><strong>branch_archived_count:</strong> {String(branchTreeLifecycle?.branch_archived ?? 0)}</div>
              <div className="item"><strong>tree_archived_count:</strong> {String(branchTreeLifecycle?.tree_archived ?? 0)}</div>
              <div className="item"><strong>branch_deleted_count:</strong> {String(branchTreeLifecycle?.branch_deleted ?? 0)}</div>
              <div className="item"><strong>tree_deleted_count:</strong> {String(branchTreeLifecycle?.tree_deleted ?? 0)}</div>
              {(branchTreePlanetRootLaws.length === 0 ? ["No branch/tree planet root laws yet."] : branchTreePlanetRootLaws.slice(0, 6)).map((law, idx) => (
                <div className="meta" key={`branch-tree-planet-${idx}`}>{law}</div>
              ))}
            </div>
            <div className="list compact">
              <div className="item"><strong>Last Collapse Snap Matches</strong></div>
              {lastCollapseMatchPreview.slice(0, 6).map((match, idx) => (
                <div className="meta" key={`collapse-match-preview-${idx}`}>{`${match.seedId} -> ${match.rootId} [${match.domain} | ${match.reasonClass} | ${match.score}]`}</div>
              ))}
              {lastCollapseMatchPreview.length === 0 ? <div className="item">No collapse snap matches persisted yet.</div> : null}
            </div>
            <div className="list compact">
              <div className="item"><strong>Atomized Collapse Match Events</strong></div>
              {lastCollapseMatchLedgerPreview.slice(0, 8).map((match, idx) => (
                <div className="meta" key={`collapse-match-ledger-${idx}`}>{`${match.seedId} -> ${match.rootId} [${match.domain} | ${match.reasonClass} | ${match.score}] / branch=${match.branchId} / tree=${match.treeId} / at=${match.at}`}</div>
              ))}
              {lastCollapseMatchLedgerPreview.length === 0 ? <div className="item">No atomized collapse match events yet.</div> : null}
            </div>
            <div className="list compact">
              <div className="item"><strong>Recent Archived Branch / Tree Events</strong></div>
              {(branchTreeLifecycle?.recent_archived ?? []).slice(-6).map((law, idx) => (
                <div className="meta" key={`branch-tree-archived-${idx}`}>{law}</div>
              ))}
              {(branchTreeLifecycle?.recent_archived ?? []).length === 0 ? <div className="item">No archived branch/tree events yet.</div> : null}
            </div>
            <div className="list compact">
              <div className="item"><strong>Recent Deleted Branch / Tree Events</strong></div>
              {(branchTreeLifecycle?.recent_deleted ?? []).slice(-6).map((law, idx) => (
                <div className="meta" key={`branch-tree-deleted-${idx}`}>{law}</div>
              ))}
              {(branchTreeLifecycle?.recent_deleted ?? []).length === 0 ? <div className="item">No deleted branch/tree events yet.</div> : null}
            </div>
            <div className="list compact">
              <div className="item"><strong>Current Trace Branch / Tree Query</strong></div>
              {lastTrace?.quantum_collapse?.branch_id ? (
                <div className="meta">{`Use /api/lml-state?sessionId=${encodeURIComponent(sessionId)}&branchId=${encodeURIComponent(lastTrace.quantum_collapse.branch_id)} for branch replay.`}</div>
              ) : <div className="item">No current branch id in trace.</div>}
              {lastTrace?.quantum_collapse?.tree_id ? (
                <div className="meta">{`Use /api/lml-state?sessionId=${encodeURIComponent(sessionId)}&treeId=${encodeURIComponent(lastTrace.quantum_collapse.tree_id)} for tree replay.`}</div>
              ) : <div className="item">No current tree id in trace.</div>}
              {branchTreeQuery ? (
                <>
                  <div className="item"><strong>active_query:</strong> {branchTreeQuery.mode} / {branchTreeQuery.id}</div>
                  {branchTreeQuery.laws.slice(0, 6).map((law, idx) => (
                    <div className="meta" key={`branch-tree-query-${idx}`}>{law}</div>
                  ))}
                  {branchTreeQuery.laws.length === 0 ? <div className="item">No laws for the queried branch/tree.</div> : null}
                </>
              ) : null}
            </div>
          </details>
            <details className="card" open>
              <summary><strong>NSL Repair Planet</strong></summary>
              <div className="list compact">
                <div className="item"><strong>nsl_planet_root_laws:</strong> {nslPlanetRootLaws.length}</div>
                <div className="item"><strong>nsl_deterministic_coding_repairs:</strong> {nslDeterministicCodingRepairCount}</div>
                <div className="item"><strong>ledger_parity_ok:</strong> {String(nslPlanetParity?.ok ?? false)}</div>
                <div className="item"><strong>missing_law_ids:</strong> {(nslPlanetParity?.missingLawIds ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>extra_law_ids:</strong> {(nslPlanetParity?.extraLawIds ?? []).join(" | ") || "none"}</div>
                <div className="item"><strong>last_nsl_event:</strong> {lastNslPreview?.eventType ?? "none"}</div>
                <div className="item"><strong>last_nsl_at:</strong> {lastNslPreview?.at ?? "none"}</div>
                <div className="item"><strong>last_nsl_text:</strong> {lastNslPreview?.text ?? "none"}</div>
                <div className="item"><strong>last_deterministic_coding_repair_event:</strong> {lastNslDeterministicCodingRepairPreview?.eventType ?? "none"}</div>
                <div className="item"><strong>last_deterministic_coding_repair_at:</strong> {lastNslDeterministicCodingRepairPreview?.at ?? "none"}</div>
                <div className="item"><strong>last_deterministic_coding_repair_reason:</strong> {lastNslDeterministicCodingRepairPreview?.reason ?? "none"}</div>
                {(nslPlanetRootLaws.length === 0 ? ["No NSL repair planet root laws yet."] : nslPlanetRootLaws.slice(0, 6)).map((law, idx) => (
                  <div className="meta" key={`nsl-planet-${idx}`}>{law}</div>
                ))}
              </div>
            </details>
            <details className="card" open>
              <summary><strong>Coding Sim Ledger</strong></summary>
              <div className="list compact">
                <div className="item"><strong>coding_sim_ledger_count:</strong> {codingSimLedgerCount}</div>
                <div className="item"><strong>last_coding_sim_event:</strong> {lastCodingSimPreview?.eventType ?? "none"}</div>
                <div className="item"><strong>last_coding_sim_at:</strong> {lastCodingSimPreview?.at ?? "none"}</div>
                <div className="item"><strong>last_coding_sim_scenarios:</strong> {String(lastCodingSimPreview?.scenarios ?? 0)}</div>
                <div className="item"><strong>last_coding_sim_visited_nodes:</strong> {String(lastCodingSimPreview?.visitedNodes ?? 0)}</div>
                <div className="item"><strong>last_coding_sim_survivors:</strong> {String(lastCodingSimPreview?.survivors ?? 0)}</div>
                <div className="item"><strong>last_coding_sim_pruned:</strong> {String(lastCodingSimPreview?.pruned ?? 0)}</div>
                <div className="item"><strong>last_coding_sim_report:</strong> {lastCodingSimPreview?.reportPath ?? "none"}</div>
              </div>
              <div className="list compact">
                <div className="item"><strong>Dominant Coding Failure Dimensions</strong></div>
                {codingSimDominantDimensions.slice(0, 6).map((item, idx) => (
                  <div className="meta" key={`coding-sim-dimension-${idx}`}>{`${item.dimension}: ${item.count}`}</div>
                ))}
                {codingSimDominantDimensions.length === 0 ? <div className="item">No coding sim runs ledgered yet.</div> : null}
              </div>
            </details>
            <details className="card" open>
              <summary><strong>AI Model Planet</strong></summary>
              <div className="list compact">
                <div className="item"><strong>active_ai_model_planet_laws:</strong> {aiModelPlanetLaws.length}</div>
                {(aiModelPlanetLaws.length === 0 ? ["No active AI model planet laws."] : aiModelPlanetLaws.slice(0, 8)).map((law, idx) => (
                  <div className="meta" key={`ai-model-planet-${idx}`}>{law}</div>
                ))}
              </div>
            </details>
            <details className="card" open>
              <summary><strong>Human Planet</strong></summary>
              <div className="list compact">
                <div className="item"><strong>active_human_planet_laws:</strong> {humanPlanetLaws.length}</div>
                <div className="item"><strong>runtime_pack_source:</strong> `LML convo mirror pt1-8`</div>
                {(humanPlanetLaws.length === 0 ? ["No active human planet laws."] : humanPlanetLaws.slice(0, 8)).map((law, idx) => (
                  <div className="meta" key={`human-planet-${idx}`}>{law}</div>
                ))}
              </div>
            </details>
            <details className="card" open>
              <summary><strong>Quantum Role</strong></summary>
              <div className="list compact">
                <div className="item"><strong>active_quantum_role_laws:</strong> {quantumRoleLaws.length}</div>
                {(quantumRoleLaws.length === 0 ? ["No active quantum role laws."] : quantumRoleLaws).map((law, idx) => (
                  <div className="meta" key={`quantum-role-${idx}`}>{law}</div>
                ))}
              </div>
            </details>
            <details className="card" open>
              <summary><strong>Active Chat Branch</strong></summary>
              <div className="list compact">
                <div className="item"><strong>active_branch_id:</strong> {activeChat?.activeBranchId ?? "none"}</div>
                <div className="item"><strong>active_tree_id:</strong> {activeChat?.activeTreeId ?? "none"}</div>
                <div className="item"><strong>tracked_branches:</strong> {String(activeChat?.branches.length ?? 0)}</div>
              </div>
              <div className="list compact">
                {(activeChat?.branches ?? []).slice(-4).reverse().map((branch) => (
                  <div className="item" key={branch.id}>
                    <div><strong>{branch.id}</strong> [{branch.status}]</div>
                    <div className="meta">tree={branch.treeId} turns={branch.turnCount} seeds={branch.matchedSeedIds.length} parents={branch.matchedRootIds.length}</div>
                    <div className="meta">dominance={branch.dominanceScore} lineage_parent={branch.lineageParentBranchId ?? "none"}</div>
                    <div className="meta">routes={branch.abilityRoutes.join(" | ") || "none"}</div>
                  </div>
                ))}
                {(activeChat?.branches ?? []).length === 0 ? <div className="item">No active chat branch yet.</div> : null}
              </div>
            </details>
            <details className="card" open>
              <summary><strong>Root Coverage</strong></summary>
              <div className="list compact">
                <div className="item"><strong>source_units:</strong> {String(rootCoverage?.source_units ?? 0)}</div>
                <div className="item"><strong>extracted_root_count:</strong> {String(rootCoverage?.extracted_root_count ?? 0)}</div>
                <div className="item"><strong>expansion_delta:</strong> {String(rootCoverage?.expansion_delta ?? 0)}</div>
                <div className="item"><strong>under_enumerated:</strong> {String(rootCoverage?.under_enumerated ?? false)}</div>
                <div className="item"><strong>static_root_count:</strong> {String(rootCoverage?.static_root_count ?? 0)}</div>
                <div className="item"><strong>directive_count:</strong> {String(rootCoverage?.directive_count ?? 0)}</div>
                <div className="item"><strong>code_unit_count:</strong> {String(rootCoverage?.code_unit_count ?? 0)}</div>
                <div className="item"><strong>math_unit_count:</strong> {String(rootCoverage?.math_unit_count ?? 0)}</div>
                <div className="item"><strong>sentence_count:</strong> {String(rootCoverage?.sentence_count ?? 0)}</div>
                <div className="item"><strong>artifact_root_count:</strong> {String(rootCoverage?.artifact_root_count ?? 0)}</div>
                <div className="item"><strong>user_law_root_count:</strong> {String(rootCoverage?.user_law_root_count ?? 0)}</div>
                <div className="item"><strong>total_root_count:</strong> {String(rootCoverage?.total_root_count ?? 0)}</div>
              </div>
            </details>
            <details className="card" open>
              <summary><strong>Universe Inventory</strong></summary>
              <div className="list compact">
                <div className="item"><strong>reality_universe_total:</strong> {universeSourceCounts.reality_universe.total}</div>
                <div className="item"><strong>human_universe_total:</strong> {universeSourceCounts.human_universe.total}</div>
                <div className="item"><strong>fiction_universe_total:</strong> {universeSourceCounts.fiction_universe.total}</div>
                <div className="item"><strong>global_service_total:</strong> {universeSourceCounts.global_service.total}</div>
              </div>
              <div className="list compact">
                <div className="item">
                  <div><strong>Reality Universe</strong></div>
                  <div className="meta">sun={universeSourceCounts.reality_universe.sun} | ability={universeSourceCounts.reality_universe.ability} | quantum={universeSourceCounts.reality_universe.quantum}</div>
                  {(universeSourceInventory.reality_universe.sun.length === 0 ? ["No sun laws."] : universeSourceInventory.reality_universe.sun.slice(0, 3)).map((law, idx) => (
                    <div className="meta" key={`reality-sun-${idx}`}>{law}</div>
                  ))}
                  {(universeSourceInventory.reality_universe.ability.length === 0 ? ["No ability laws."] : universeSourceInventory.reality_universe.ability.slice(0, 3)).map((law, idx) => (
                    <div className="meta" key={`reality-ability-${idx}`}>{law}</div>
                  ))}
                  {(universeSourceInventory.reality_universe.quantum.length === 0 ? ["No quantum laws."] : universeSourceInventory.reality_universe.quantum.slice(0, 3)).map((law, idx) => (
                    <div className="meta" key={`reality-quantum-${idx}`}>{law}</div>
                  ))}
                </div>
                <div className="item">
                  <div><strong>Human Universe</strong></div>
                  <div className="meta">human={universeSourceCounts.human_universe.human}</div>
                  {(universeSourceInventory.human_universe.human.length === 0 ? ["No human laws."] : universeSourceInventory.human_universe.human.slice(0, 6)).map((law, idx) => (
                    <div className="meta" key={`human-universe-${idx}`}>{law}</div>
                  ))}
                </div>
                <div className="item">
                  <div><strong>Fiction Universe</strong></div>
                  <div className="meta">fiction={universeSourceCounts.fiction_universe.fiction}</div>
                  <div className="meta">No fiction universe planets or laws are active yet.</div>
                </div>
                <div className="item">
                  <div><strong>Global Service</strong></div>
                  <div className="meta">meta={universeSourceCounts.global_service.meta} | ai_model={universeSourceCounts.global_service.ai_model} | nocr={universeSourceCounts.global_service.nocr} | nsl={universeSourceCounts.global_service.nsl} | branch_tree={universeSourceCounts.global_service.branch_tree} | meta_delivery={universeSourceCounts.global_service.meta_delivery}</div>
                </div>
              </div>
            </details>
            <details className="card" open>
              <summary><strong>Planet Source Inventory</strong></summary>
              <div className="list compact">
                <div className="item"><strong>sun_source_laws:</strong> {planetSourceCounts.sun}</div>
                <div className="item"><strong>meta_source_laws:</strong> {planetSourceCounts.meta}</div>
                <div className="item"><strong>ai_model_source_laws:</strong> {planetSourceCounts.ai_model}</div>
                <div className="item"><strong>human_source_laws:</strong> {planetSourceCounts.human}</div>
                <div className="item"><strong>quantum_source_laws:</strong> {planetSourceCounts.quantum}</div>
                <div className="item"><strong>nocr_source_laws:</strong> {planetSourceCounts.nocr}</div>
                <div className="item"><strong>nsl_source_laws:</strong> {planetSourceCounts.nsl}</div>
                <div className="item"><strong>branch_tree_source_laws:</strong> {planetSourceCounts.branch_tree ?? 0}</div>
                <div className="item"><strong>visibility:</strong> source inventory only for `human planet` and `quantum planet`; not enforced</div>
                <div className="item">
                  <div><strong>Sun preview</strong></div>
                  {(planetSourceInventory.sun.length === 0 ? ["No source laws."] : planetSourceInventory.sun.slice(0, 4)).map((law, idx) => (
                    <div className="meta" key={`source-sun-${idx}`}>{law}</div>
                  ))}
                </div>
                <div className="item">
                  <div><strong>Meta preview</strong></div>
                  {(planetSourceInventory.meta.length === 0 ? ["No source laws."] : planetSourceInventory.meta.slice(0, 4)).map((law, idx) => (
                    <div className="meta" key={`source-meta-${idx}`}>{law}</div>
                  ))}
                </div>
                <div className="item">
                  <div><strong>AI Model preview</strong></div>
                  {(planetSourceInventory.ai_model.length === 0 ? ["No source laws."] : planetSourceInventory.ai_model.slice(0, 4)).map((law, idx) => (
                    <div className="meta" key={`source-ai-model-${idx}`}>{law}</div>
                  ))}
                </div>
                <div className="item">
                  <div><strong>Human preview</strong></div>
                  {(planetSourceInventory.human.length === 0 ? ["No source laws."] : planetSourceInventory.human.slice(0, 4)).map((law, idx) => (
                    <div className="meta" key={`source-human-${idx}`}>{law}</div>
                  ))}
                </div>
                <div className="item">
                  <div><strong>Quantum preview</strong></div>
                  {(planetSourceInventory.quantum.length === 0 ? ["No source laws."] : planetSourceInventory.quantum.slice(0, 4)).map((law, idx) => (
                    <div className="meta" key={`source-quantum-${idx}`}>{law}</div>
                  ))}
                </div>
                <div className="item">
                  <div><strong>NOCR preview</strong></div>
                  {(planetSourceInventory.nocr.length === 0 ? ["No source laws."] : planetSourceInventory.nocr.slice(0, 4)).map((law, idx) => (
                    <div className="meta" key={`source-nocr-${idx}`}>{law}</div>
                  ))}
                </div>
                <div className="item">
                  <div><strong>NSL preview</strong></div>
                  {(planetSourceInventory.nsl.length === 0 ? ["No source laws."] : planetSourceInventory.nsl.slice(0, 4)).map((law, idx) => (
                    <div className="meta" key={`source-nsl-${idx}`}>{law}</div>
                  ))}
                </div>
                <div className="item">
                  <div><strong>Branch / Tree preview</strong></div>
                  {((planetSourceInventory.branch_tree ?? []).length === 0 ? ["No source laws."] : (planetSourceInventory.branch_tree ?? []).slice(0, 4)).map((law, idx) => (
                    <div className="meta" key={`source-branch-tree-${idx}`}>{law}</div>
                  ))}
                </div>
              </div>
            </details>
          </details>
          <details className="card">
            <summary><strong>Universe Growth</strong></summary>
            <div className="meta">User-added laws: {activeCount}</div>
            <div className="list compact">
              {activeUserLaws.length === 0 ? <div className="item">No user laws added yet.</div> : null}
              {activeUserLaws.map((law) => (
                <div className="item" key={`growth-${law.law_id}`}>
                  <div><strong>{law.law_id}</strong></div>
                  <div className="meta">{law.text}</div>
                </div>
              ))}
            </div>
          </details>
        </article>

        <article className="card">
          <strong>Installation Pipeline</strong>
          <div className="pipelineLightRow">
            <div className={`pipelineLight ${pipelineState}`} />
            <div className="meta">
              {pipelineState === "green" ? "Pipeline green light ON" : pipelineState === "amber" ? "Pipeline running..." : "Pipeline red (awaiting ingest)"}
            </div>
          </div>
          <div className="steps">
            {stageStatus.map((stage) => (
              <div key={stage.label} className={`step ${stage.status}`}>
                <div className="dot" />
                <div className="stepLabel">{stage.label}</div>
                <div className="meta">{stage.detail}</div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

function isProfileSeedLaw(text: string): boolean {
  return /^LAW\.[A-Z]+\.\d+:\s/.test(text.trim());
}

function mergeUniqueLaws(existing: IngestedLaw[], incoming: IngestedLaw[]): IngestedLaw[] {
  const byKey = new Map<string, IngestedLaw>();
  for (const law of existing) {
    byKey.set(lawKey(law), law);
  }
  for (const law of incoming) {
    byKey.set(lawKey(law), law);
  }
  return Array.from(byKey.values());
}

function lawKey(law: IngestedLaw): string {
  return `${law.text.toLowerCase()}|${law.scope}|${law.enforcement}`;
}

function isFallbackLaw(lawId: string): boolean {
  return lawId.startsWith("LAW-FALLBACK-");
}

function isPlaceholderLaw(text: string): boolean {
  return /non-negotiable continuity:\s*required/i.test(text.trim());
}

function isLowSignalGeneratedLaw(text: string): boolean {
  const value = text.trim().toLowerCase();
  return (
    /^must enforce claim\s+c\d+:/i.test(value) ||
    /^missing return path for f\d+:/i.test(value) ||
    /^detector required for claim\s+c\d+:/i.test(value) ||
    /^system must (detect|execute and verify|isolate risky coupling|preserve admissible state boundary)/i.test(value)
  );
}

async function extractPdfViaApi(filename: string, bytes: Uint8Array): Promise<string> {
  try {
    const response = await fetch("/api/extract-pdf-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename,
        contentBase64: bytesToBase64(bytes),
      }),
    });
    if (!response.ok) {
      return "";
    }
    const data = (await response.json()) as { text?: string };
    return (data.text ?? "").trim();
  } catch {
    return "";
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}
