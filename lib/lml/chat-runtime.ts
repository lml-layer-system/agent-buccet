import { randomUUID } from "node:crypto";
import type { LawWeb } from "@/lib/engine/types";
import { loadLawWeb } from "@/lib/engine/store";
import type { Witness } from "@/lib/engine/types";
import { buildPolicyGuidance, extractDocumentInsights, isNerdOrFormalRequest, parseExpressionPolicy } from "@/lib/demo/personality-engine";
import { runGpt2Constrained, runGpt2GeneratorOnly, type Gpt2CallResult } from "@/lib/demo/gpt2";
import { getBaseIntelligence49Report, type Intelligence49Report } from "@/lib/lml/intelligence-49";
import { buildRootRegistry } from "@/lib/lml/root-registry";
import { buildBranchRendererPrompt, composeLawGovernedSpeech, type BranchRendererContext } from "@/lib/lml/branch-renderer";
import { deriveCodingSkeletonContract, validateCodingWitnessSet, type CodingSkeletonContract } from "@/lib/lml/coding-skeleton-laws";
import { validateCodingArchitecture } from "@/lib/lml/coding-architecture";
import { runCodingCollapse } from "@/lib/lml/coding-collapse";
import { deriveCodingIntentSpec, type CodingIntentSpec } from "@/lib/lml/coding-intent-spec";
import { buildCodingRepoContext, shouldUseRepoContext, type CodingRepoContext } from "@/lib/lml/coding-context";
import { collapseChatConvoPossibilities } from "@/lib/lml/chat-efue-collapse";
import { runChatConvoQuantumSpark } from "@/lib/lml/chat-convo-qe";
import { appendSnapRunLedger } from "@/lib/ledger";
import { appendNslPlanetRootLaw, appendNslRepairLedger } from "@/lib/nsl";
import {
  applyPendingLawProposals,
  getOrCreateContextState,
  type InfiniteContextState,
  persistContextState,
  setUserOverlayLaws,
  updateInfiniteContext,
  type ContextDoc,
} from "@/lib/lml/infinite-context";
import { closeActiveChatBranch, updateActiveChatBranch } from "@/lib/lml/active-chat-branch";
import { runNoveltyControllerCycle } from "@/lib/lml/novelty-controller";
import { buildMetaCriticalGuidance, detectMetaCriticalSignal, isExpressionOnlyConstraint, type MetaCriticalSignal } from "@/lib/lml/meta-critical";
import { deriveFailureLearningProposals, type FailureLearningResult } from "@/lib/lml/failure-learning";
import { appendMetaDeliveryRecords, proposalKey, uniquePendingProposals, type PendingLawProposal } from "@/lib/lml/meta-delivery";
import { runPathFormation, selectFormation, type OrchestratorTrace } from "@/lib/lml/path-orchestrator";
import { runQuantumBlanketCycle, type QuantumBlanketCycleResult } from "@/lib/lml/quantum-blanket";
import { validateCodingFloor } from "@/lib/lml/coding-physics";
import {
  appendNocrBranchClosedLedger,
  appendNocrBranchExtendedLedger,
  appendNocrBranchArchivedLedger,
  appendNocrBranchDeletedLedger,
  appendNocrBranchForkedLedger,
  appendNocrBranchMergedLedger,
  appendNocrBranchSiblingCreatedLedger,
  appendBranchTreePlanetRootLaw,
  appendNocrCollapseClippedLedger,
  appendNocrCollapseMatchLedger,
  appendNocrCollapseLedger,
  appendNocrFunnelLedger,
  appendNocrPlanetRootLaw,
  appendNocrTreeExtendedLedger,
  appendNocrTreeStartedLedger,
  appendNocrTreeArchivedLedger,
  appendNocrTreeDeletedLedger,
  buildNocrFunnelState,
  buildNocrSeed,
  extractChatIntentSeedsFromArtifact,
  getNocrRootSpace,
  readAllNocrLedgerRecords,
  readAllNocrPlanetRootLaws,
  resolveQuantumCollapse,
  syncNocrPlanetFromLedger,
  verifyNocrLedgerPlanetParity,
  type NocrFunnelState,
  type QuantumCollapseResult,
} from "@/lib/nocr";
import { ABILITY_PLANET_LAWS } from "@/lib/lml/ability-planet-laws";
import { AI_MODEL_PLANET_LAWS } from "@/lib/lml/ai-model-planet-laws";
import { BRANCH_TREE_PLANET_LAWS } from "@/lib/lml/branch-tree-planet-laws";
import { HUMAN_PLANET_LAWS } from "@/lib/lml/human-planet-laws";
import { HUMAN_PLANET_RUNTIME_LAWS } from "@/lib/lml/human-planet-runtime-laws";
import { HUMAN_PLANET_RUNTIME_LAWS_PHASE_2 } from "@/lib/lml/human-planet-runtime-laws-phase-2";
import { buildHumanMirrorGuidance, classifyHumanOutputAdmissibility, compileHumanMirrorProfile } from "@/lib/lml/human-mirror";
import { META_PLANET_LAWS } from "@/lib/lml/meta-planet-laws";
import { META_PLANET_EXPANSION_LAWS } from "@/lib/lml/meta-planet-expansion-laws";
import { QUANTUM_PLANET_LAWS } from "@/lib/lml/quantum-planet-laws";
import { SUN_LAWS } from "@/lib/lml/sun-laws";
import { resolveAuthorizedRepairs } from "@/lib/snap/repair-catalog";
import type { RepairPackName } from "@/lib/snap/types";

const REQUIRED_META_SOURCE_IDS = [
  "LAW-0164",
  "LAW-0165",
  "LAW-0166",
  "LAW-0167",
  "LAW-0168",
  "LAW-0169",
] as const;

export const UNIVERSE_RUNTIME_LAWS = [
  "SUN.01: Coding ability is law-governed and remains inactive unless explicitly activated by lawful overlay/command.",
  "SUN.02: Web search ability is law-governed and remains inactive unless explicitly activated by lawful overlay/command.",
  "SUN.03: LML must run projection-first over candidate paths before output emission.",
  "SUN.04: Illegal projected branches must collapse to NULL and never execute as final output.",
  "SUN.05: NULL collapses must trigger NSL repair mapping and ledger trace update.",
  "SUN.06: GPT-2 runtime path is the active generation engine under LML governance.",
  "SUN.07: The sun and required planets must awaken together at LML boot.",
  "SUN.08: If projection cannot produce admissible output, fail closed and preserve witness trace.",
  "SUN.09: User overlays may specialize planet laws but cannot bypass sun legality.",
  "SUN.10: Every turn must emit ledger-ready evidence for collapse, repairs, and final action.",
  "SUN.11: Constraints must precede expansion in every governed growth path.",
  "SUN.12: Feedback and correction must dominate amplification in every non-collapsing path.",
  "SUN.13: Structure must grow faster than raw mass or intensity or the growth path becomes inadmissible.",
  "SUN.14: Identity invariants must be preserved across scaling, specialization, and extension.",
  "SUN.15: Coherent behaviors must be pursued through lawful substitution and workaround rather than false impossibility claims.",
  "SUN.16: Law-side UIC, UUIS, and LML snap root extraction must never under-enumerate incoming root/parent-capable lawful structure; it may enumerate more laws than the source text states explicitly, but never fewer than the source materially supports.",
  "DEMO.CODING.01: Coding competence is enforced as finite capability dimensions (syntax, logic, architecture, algorithm, context, safety, integration).",
  "DEMO.CODING.02: Code generation must run in finite staged paths with explicit halting conditions; no infinite replanning loops.",
  "DEMO.CODING.03: Code outputs must satisfy generator-layer checks (syntax validity, semantic intent alignment, and safety constraints).",
  "DEMO.CODING.04: Coding failures must map to structured failure classes and trigger NSL repair moves before final output admission.",
  "DEMO.CODING.05: Cross-language behavior is governed by universal failure classes; language-specific syntax may vary but safety/logic constraints remain invariant.",
  "DEMO.CODING.06: Runtime coding checks prioritize single-pass extraction and bounded verification cost for interactive latency stability.",
  "DEMO.CODING.07: Coding route must use constrained decoding with repetition controls and bounded token budgets.",
  "DEMO.CODING.08: Coding prompts must be task-minimal and format-explicit to prevent policy echo.",
  "DEMO.CODING.09: Coding output admission requires code-shape validation before UI emission.",
  "DEMO.CODING.10: Python coding output admission requires AST syntax validation.",
  "DEMO.CODING.11: Python coding output admission requires bounded runtime execution validation.",
  "DEMO.CODING.12: Coding failures must trigger bounded repair retries with failure-reason feedback.",
  "DEMO.CODING.13: Coding retries must remain finite and terminate with admissible code or explicit NULL reason.",
  "DEMO.CODING.14: When tests are requested, test evidence is part of coding admissibility scoring.",
  "DEMO.CODING.15: Code output must remain copyable and fenced for deterministic extraction.",
  "DEMO.CODING.16: FastAPI email-validation with pytest intent is a law-locked deterministic path and must emit canonical fenced Python blocks.",
  "DEMO.CODING.17: FastAPI CRUD todo intent is a law-locked deterministic path and must emit canonical app/test fenced Python blocks.",
  "DEMO.CODING.18: FastAPI auth middleware intent is a law-locked deterministic path and must emit canonical app/test fenced Python blocks.",
  "DEMO.CODING.19: SQLAlchemy user-model intent is a law-locked deterministic path and must emit canonical model/test fenced Python blocks.",
  "DEMO.CODING.20: Flask hello endpoint intent is a law-locked deterministic path and must emit canonical app/test fenced Python blocks.",
  "DEMO.CODING.21: Python utility-plus-pytest intent is a law-locked deterministic path and must emit canonical function/test fenced Python blocks.",
  "DEMO.CODING.22: Deterministic coding law routes must pass local code-shape admissibility checks before output release.",
  "DEMO.CODING.23: When deterministic coding law routes match, GPT generation is bypassed and runtime emits canonical code directly.",
  "DEMO.CODING.24: Non-canonical coding intents must continue through GPT projection, NSL repair, and validator gates.",
  "DEMO.GENERATOR.01: Program-space governance uses finite generator classes (syntax, semantics, types, reductions, complexity, computability, equivalence).",
  "DEMO.GENERATOR.02: Truth-space governance uses finite generator classes (axioms, inference, semantics, consistency, extension, complexity, unification).",
  "DEMO.GENERATOR.03: Infinite branch spaces are handled by legality projection, not exhaustive enumeration.",
  "DEMO.GENERATOR.04: Generator completeness claims are structural and must not require brute-force execution.",
  "DEMO.GENERATOR.05: Extension rules may add admissible laws but cannot weaken base legality guarantees.",
  "DEMO.EXPRESSION.01: Expression directives are admissible laws when semantically coherent.",
  "DEMO.EXPRESSION.02: Address-style laws persist until deactivated and must be reflected in final output prefixing.",
  "DEMO.EXPRESSION.03: Style laws can shape output form but cannot bypass legality projection.",
  "DEMO.AUDIT.01: Every run must retain runId-linked evidence for ingest, projection, repair, and output.",
  "DEMO.AUDIT.02: System inventories must be recoverable from repository planet manifests and runtime state snapshots.",
  "DEMO.HARDENING.01: Capability-intent responses must remain deterministic canonical outputs; numeric/statistical drift is prohibited.",
  "DEMO.HARDENING.02: Coding-readiness intents must emit deterministic canonical readiness text; policy-noise drift is prohibited.",
  ...META_PLANET_LAWS,
  ...AI_MODEL_PLANET_LAWS,
  ...ABILITY_PLANET_LAWS,
  ...HUMAN_PLANET_RUNTIME_LAWS,
  ...HUMAN_PLANET_RUNTIME_LAWS_PHASE_2,
] as const;

export function getAbilityPlanetInventory(): {
  coding: string[];
  web_search: string[];
} {
  const all = [...UNIVERSE_RUNTIME_LAWS];
  const coding = all.filter((law) => /^DEMO\.CODING\./.test(law) || /^ABILITY\.CODING\./.test(law) || /allow ability:\s*coding/i.test(law));
  const webSearch = all.filter((law) => /web_search/i.test(law));
  return {
    coding,
    web_search: webSearch,
  };
}

export function getMetaPlanetInventory(): string[] {
  return [...META_PLANET_LAWS];
}

export function getHumanPlanetInventory(): string[] {
  return [...HUMAN_PLANET_RUNTIME_LAWS, ...HUMAN_PLANET_RUNTIME_LAWS_PHASE_2];
}

export function getAiModelPlanetInventory(): string[] {
  return [...AI_MODEL_PLANET_LAWS];
}

export function getQuantumRoleInventory(): string[] {
  return [...UNIVERSE_RUNTIME_LAWS].filter((law) => /quantum/i.test(law));
}

export function getPlanetSourceInventory(): {
  sun: string[];
  meta: string[];
  ai_model: string[];
  human: string[];
  quantum: string[];
  branch_tree: string[];
} {
  return {
    sun: [...SUN_LAWS],
    meta: [...META_PLANET_EXPANSION_LAWS],
    ai_model: [...AI_MODEL_PLANET_LAWS],
    human: [...HUMAN_PLANET_LAWS],
    quantum: [...QUANTUM_PLANET_LAWS],
    branch_tree: [...BRANCH_TREE_PLANET_LAWS],
  };
}

export function getUniverseGrouping(): {
  reality_universe: Array<"sun" | "ability" | "quantum">;
  human_universe: Array<"human">;
  fiction_universe: [];
  global_service: Array<"meta" | "ai_model" | "nocr" | "nsl" | "branch_tree" | "meta_delivery">;
} {
  return {
    reality_universe: ["sun", "ability", "quantum"],
    human_universe: ["human"],
    fiction_universe: [],
    global_service: ["meta", "ai_model", "nocr", "nsl", "branch_tree", "meta_delivery"],
  };
}

export function compileCapabilityGraphFromRuntimeLaws(userLaws: RuntimeUserLaw[]): OntologyState["capability_graph"] {
  return compileCapabilityGraph(userLaws);
}

export type RuntimeUserLaw = {
  law_id: string;
  text: string;
  scope: string;
  enforcement: string;
};

type GeneratedOutput = {
  text: string;
  final_action: "success" | "refusal";
  reason: string;
  model: LmlChatResult["model"];
  benchmark_debug?: LmlChatResult["benchmark_debug"];
};

type RepairedOutput = GeneratedOutput & {
  failureClasses: string[];
  triggeredRepairs: string[];
};

type RepairInputs = {
  userMessage: string;
  state: InfiniteContextState;
  constrained: ReturnType<typeof apply_constraints>;
  guarded: ReturnType<typeof guard_abilities>;
  userLawTexts: string[];
  branchRendererContext: BranchRendererContext;
};

export type OntologyState = {
  base_law_count: number;
  base_laws_applied: string[];
  system_laws_applied: string[];
  user_laws_applied: string[];
  merged_ontology_state: string[];
  capability_graph: {
    compiled_from_laws: number;
    abilities: Record<"coding" | "web_search", {
      state: "allowed" | "blocked" | "unspecified";
      source_law_ids: string[];
      rationale: string[];
    }>;
  };
};

export type EnforcementTrace = {
  base_laws: string[];
  system_laws: string[];
  user_laws: string[];
  merged_ontology: string[];
  active_constraints: string[];
  triggered_constraints: string[];
  ability_route: string;
  final_action: "success" | "refusal";
  reason: string;
  triggered_repairs?: string[];
  gate_failed?: "GATE_1_STATE_INPUT" | "GATE_2_STATE_OUTPUT" | "GATE_3_OUTPUT" | null;
  failed_predicate?: "AS" | "AO" | null;
  failed_laws?: string[];
  failure_classes?: string[];
  null_state?: boolean;
  return_moves?: string[];
  null_staircase?: {
    state: "admitted" | "null_emitted";
    witness: {
      gate: "GATE_1_STATE_INPUT" | "GATE_2_STATE_OUTPUT" | "GATE_3_OUTPUT" | "NONE";
      predicate: "AS" | "AO" | "NONE";
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
    action: "new_tree" | "extend" | "fork" | "sibling" | "merge" | "none";
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
  meta_critical?: {
    fired: boolean;
    mode: "life_preservation" | "system_integrity";
    reason: string;
    preserve_expression: boolean;
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

export type LmlChatResult = {
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
  trace: EnforcementTrace;
  ontology: OntologyState;
  intelligence: Intelligence49Report;
  context: {
    sessionId: string;
    step: number;
    wm_focus: string | null;
    l0_size: number;
    l1_size: number;
    dependency_edges: number;
  };
  novelty: {
    noveltyDetected: boolean;
    coverageIncomplete: boolean;
    proposedLawCount: number;
    activatedFromPriorCycle: number;
    ledgerIndex: number | null;
  };
  quantum_blanket: {
    active: boolean;
    candidateCount: number;
    finiteSeedCount: number;
    proposedLawCount: number;
    pendingProposalCount: number;
  };
  meta_critical: {
    fired: boolean;
    mode: "life_preservation" | "system_integrity" | null;
    reason: string | null;
    preserveExpression: boolean;
  };
  failure_learning: {
    proposedLawCount: number;
    signature: string | null;
    sources: string[];
  };
  model: {
    provider: "gpt2-runtime";
    model: "gpt2";
    runId: string;
    callId: string;
    at: string;
    inputDigest: string;
    generationStatus?: "generated" | "fallback" | "deterministic";
    generationFailureClass?: string;
    generationDetail?: string;
  };
  benchmark_debug?: {
    raw_candidate_text: string | null;
    normalized_candidate_text: string | null;
    normalization_reason: string | null;
  };
};

const EMPTY_QUANTUM_BLANKET: LmlChatResult["quantum_blanket"] = {
  active: true,
  candidateCount: 0,
  finiteSeedCount: 0,
  proposedLawCount: 0,
  pendingProposalCount: 0,
};

const EMPTY_META_CRITICAL: LmlChatResult["meta_critical"] = {
  fired: false,
  mode: null,
  reason: null,
  preserveExpression: false,
};

const EMPTY_FAILURE_LEARNING: LmlChatResult["failure_learning"] = {
  proposedLawCount: 0,
  signature: null,
  sources: [],
};

type RuntimeContext = {
  user_message: string;
  user_laws: RuntimeUserLaw[];
  document_text?: string;
  documents?: ContextDoc[];
  session_id: string;
};

type AbilityName = "coding" | "web_search";
type AbilityEffect = "allow" | "deny";
type RuntimeAbilityCommand = {
  ability: AbilityName;
  effect: AbilityEffect;
  sourceText: string;
};

export async function run_lml_chat_runtime(context: RuntimeContext): Promise<LmlChatResult> {
  const runId = randomUUID();
  const lawWeb = await loadLawWeb();
  const intelligence = getBaseIntelligence49Report();
  const state = await getOrCreateContextState(context.session_id);
  // Runtime law source is authoritative per turn from client state.
  // This prevents stale overlays from lingering after user-side clear actions.
  setUserOverlayLaws(state, context.user_laws);
  const activatedFromPriorCycle = applyPendingLawProposals(state, {
    autoApplySources: resolveAutoApplySources(state),
  });
  const runtimeAbilityCommand = parseRuntimeAbilityLawCommand(context.user_message);
  if (runtimeAbilityCommand) {
    applyRuntimeAbilityCommand(state, runtimeAbilityCommand);
  }
  await persistContextState(state);
  const autoLaws: RuntimeUserLaw[] = state.activeAutoLaws.map((law, index) => ({
    law_id: `AUTO-${String(index + 1).padStart(4, "0")}`,
    text: law.text,
    scope: law.scope,
    enforcement: law.enforcement,
  }));
  const persistedOverlay = state.userOverlayLaws.map((law) => ({
    law_id: law.law_id,
    text: law.text,
    scope: law.scope,
    enforcement: law.enforcement,
  }));
  const ontology = compile_runtime_ontology(lawWeb, [...persistedOverlay, ...autoLaws], intelligence);
  const metaCritical = detectMetaCriticalSignal(context.user_message, ontology.user_laws_applied);
  const constrained = apply_constraints(context.user_message, ontology, {
    suspendExpressionRefusal: metaCritical !== null,
  });
  const guarded = guard_abilities(context.user_message, constrained, ontology);
  const documentText = context.document_text ?? context.documents?.map((doc) => doc.text).join("\n\n") ?? "";
  const documentInsights = extractDocumentInsights(documentText);
  const humanMirrorProfile = compileHumanMirrorProfile({
    question: context.user_message,
    policy: parseExpressionPolicy(ontology.user_laws_applied.join("\n")),
    documentInsights,
  });
  const rootRegistry = buildRootRegistry({
    staticRoots: getNocrRootSpace(),
    artifactTexts: [context.user_message, documentText],
    userLawTexts: [...persistedOverlay, ...autoLaws].map((law) => law.text),
  });
  const chatSeedLane = extractChatIntentSeedsFromArtifact(context.user_message);
  const exactChatSeeds = chatSeedLane.seeds.map((seed) => ({
    ...seed,
    abilityRoute: guarded.ability_route,
    source: inferSeedSourceFromAbilityRoute(guarded.ability_route),
  }));
  const chatConvoQuantumSpark = runChatConvoQuantumSpark({
    userMessage: context.user_message,
    profile: humanMirrorProfile,
  });
  const chatConvoEfue = collapseChatConvoPossibilities(chatConvoQuantumSpark.possibilities);
  const qeChatSeeds = chatConvoEfue.seeds.map((seed) => ({
    ...seed,
    abilityRoute: guarded.ability_route,
    source: inferSeedSourceFromAbilityRoute(guarded.ability_route),
  }));
  if (rootRegistry.extraction.underEnumerated) {
    const failClosed = buildRootCoverageFailClosedRefusal(runId, rootRegistry);
    await appendSnapRunLedger({
      runId,
      profileId: "LML_CHAT_RUNTIME",
      profileVersion: "1.0.0",
      profileImmutableHash: "lml-chat-runtime-v1",
      runMode: "demo",
      admissible: false,
      nullOutput: true,
      blockerCount: 1,
      rejectedCount: 0,
      artifactLength: context.user_message.length,
      createdAt: new Date().toISOString(),
    });
    return return_trace(
      ontology,
      {
        ...guarded,
        active_constraints: [...constrained.active_constraints, "root_extraction_coverage_required"],
        triggered_constraints: [...constrained.triggered_constraints, "root_extraction_under_enumerated"],
        final_action: failClosed.final_action,
        reason: failClosed.reason,
      },
      failClosed,
      intelligence,
      {
        sessionId: state.sessionId,
        step: state.step,
        wm_focus: state.wm.focus,
        l0_size: state.ltm.L0.length,
        l1_size: state.ltm.L1.length,
        dependency_edges: state.dependencies.length,
      },
      {
        noveltyDetected: false,
        coverageIncomplete: false,
        proposedLawCount: 0,
        activatedFromPriorCycle,
        ledgerIndex: null,
      },
      EMPTY_QUANTUM_BLANKET,
      EMPTY_META_CRITICAL,
      EMPTY_FAILURE_LEARNING,
      undefined,
      undefined,
      undefined,
      rootRegistry,
      undefined,
      {
        exactSeedCount: exactChatSeeds.length,
        seeds: exactChatSeeds.map((seed) => ({ id: seed.id, origin: seed.origin })),
        qeCandidateCount: chatConvoQuantumSpark.candidateCount,
        qeSeedCount: qeChatSeeds.length,
        qeSeeds: qeChatSeeds.map((seed) => ({ id: seed.id, origin: seed.origin })),
      },
    );
  }
  const nocrSeed = exactChatSeeds[0]
    ? {
      ...exactChatSeeds[0],
      abilityRoute: guarded.ability_route,
      source: inferSeedSourceFromAbilityRoute(guarded.ability_route),
    }
    : buildNocrSeed(context.user_message, guarded.ability_route);
  const nocrFunnelState = buildNocrFunnelState(nocrSeed, rootRegistry.allRoots, exactChatSeeds, qeChatSeeds);
  const quantumCollapse = resolveQuantumCollapse(nocrFunnelState, guarded.final_action);
  const nocrFunnelRecord = await appendNocrFunnelLedger({
    runId,
    seed: nocrFunnelState.taggedSeed.seed,
    seedTag: nocrFunnelState.taggedSeed.seedTag,
    exactSeedTags: nocrFunnelState.exactChatSeeds.map((seed) => seed.seedTag),
    qeSeedTags: nocrFunnelState.qeChatSeeds.map((seed) => seed.seedTag),
    rootTags: nocrFunnelState.taggedRoots.map((root) => root.rootTag),
    rootIds: nocrFunnelState.taggedRoots.map((root) => root.root.id),
    ledgerState: nocrFunnelState.ledgerState,
    reason: nocrFunnelState.taggedSeed.funnelReason,
    createdAt: new Date().toISOString(),
  });
  await appendNocrPlanetRootLaw(nocrFunnelRecord);
  if (quantumCollapse.lockState === "clipped") {
    const clippedRecord = await appendNocrCollapseClippedLedger({
      runId,
      seedTag: quantumCollapse.taggedSeed.seedTag,
      requestedDomain: inferCollapseDomainFromFunnel(quantumCollapse.reason),
      reason: quantumCollapse.reason,
      rootSpaceSize: nocrFunnelState.taggedRoots.length,
      collapseMoment: quantumCollapse.collapseMoment,
      createdAt: new Date().toISOString(),
    });
    await appendNocrPlanetRootLaw(clippedRecord);
    const clippedNull = buildCollapsedNullRefusal(runId, quantumCollapse.reason);
    const nslRecord = await appendNslRepairLedger("REPAIR_NULL", {
      runId,
      reason: clippedNull.reason,
      finalAction: clippedNull.final_action,
      failureClasses: ["NOCR_PARENT_LOCK_MISS"],
      triggeredRepairs: [],
      createdAt: new Date().toISOString(),
    });
    await appendNslPlanetRootLaw(nslRecord);
    return return_trace(
      ontology,
      {
        ...guarded,
        active_constraints: constrained.active_constraints,
        triggered_constraints: [...constrained.triggered_constraints, "nocr_parent_lock_required"],
        final_action: clippedNull.final_action,
        reason: clippedNull.reason,
      },
      clippedNull,
      intelligence,
      {
        sessionId: state.sessionId,
        step: state.step,
        wm_focus: state.wm.focus,
        l0_size: state.ltm.L0.length,
        l1_size: state.ltm.L1.length,
        dependency_edges: state.dependencies.length,
      },
      {
        noveltyDetected: false,
        coverageIncomplete: false,
        proposedLawCount: 0,
        activatedFromPriorCycle,
        ledgerIndex: null,
      },
      EMPTY_QUANTUM_BLANKET,
      metaCritical
        ? {
          fired: true,
          mode: metaCritical.mode,
          reason: metaCritical.reason,
          preserveExpression: metaCritical.preserveExpression,
        }
        : EMPTY_META_CRITICAL,
      EMPTY_FAILURE_LEARNING,
      undefined,
      nocrFunnelState,
      quantumCollapse,
      rootRegistry,
      undefined,
      {
        exactSeedCount: exactChatSeeds.length,
        seeds: exactChatSeeds.map((seed) => ({ id: seed.id, origin: seed.origin })),
        qeCandidateCount: chatConvoQuantumSpark.candidateCount,
        qeSeedCount: qeChatSeeds.length,
        qeSeeds: qeChatSeeds.map((seed) => ({ id: seed.id, origin: seed.origin })),
      },
    );
  }
  const nocrCollapseRecord = await appendNocrCollapseLedger({
    runId,
    seedTag: quantumCollapse.taggedSeed.seedTag,
    rootTag: quantumCollapse.matchedRoot!.rootTag,
    rootId: quantumCollapse.matchedRoot!.root.id,
    branchId: quantumCollapse.branch!.id,
    treeId: quantumCollapse.tree!.id,
    stateChangeId: quantumCollapse.stateChange!.id,
    domain: quantumCollapse.matchedRoot!.root.domain,
    reason: quantumCollapse.reason,
    snapMatches: quantumCollapse.snapMatches,
    collapseMoment: quantumCollapse.collapseMoment,
    createdAt: new Date().toISOString(),
  });
  await appendNocrPlanetRootLaw(nocrCollapseRecord);
  await appendBranchTreePlanetRootLaw(nocrCollapseRecord);
  for (const match of quantumCollapse.snapMatches) {
    const collapseMatchRecord = await appendNocrCollapseMatchLedger({
      runId,
      branchId: quantumCollapse.branch!.id,
      treeId: quantumCollapse.tree!.id,
      seedTag: match.seedTag,
      seedId: match.seedId,
      rootTag: match.rootTag,
      rootId: match.rootId,
      domain: match.domain,
      reasonClass: match.reasonClass,
      score: match.score,
      createdAt: new Date().toISOString(),
    });
    await appendBranchTreePlanetRootLaw(collapseMatchRecord);
  }
  const branchRendererContext = buildBranchRendererContext(quantumCollapse, rootRegistry, exactChatSeeds, qeChatSeeds);
  let nocrParity = await readNocrParity();
  if (!nocrParity.ok) {
    const deletedAt = new Date().toISOString();
    const branchDeletedRecord = await appendNocrBranchDeletedLedger({
      runId,
      branchId: quantumCollapse.branch!.id,
      treeId: quantumCollapse.tree!.id,
      stateChangeId: `state.${quantumCollapse.branch!.id}.deleted`,
      entity: "branch",
      lifecycle: "deleted",
      reason: "nocr_ledger_planet_parity_failed",
      createdAt: deletedAt,
    });
    await appendNocrPlanetRootLaw(branchDeletedRecord);
    await appendBranchTreePlanetRootLaw(branchDeletedRecord);
    const treeDeletedRecord = await appendNocrTreeDeletedLedger({
      runId,
      branchId: quantumCollapse.branch!.id,
      treeId: quantumCollapse.tree!.id,
      stateChangeId: `state.${quantumCollapse.tree!.id}.deleted`,
      entity: "tree",
      lifecycle: "deleted",
      reason: "nocr_ledger_planet_parity_failed",
      createdAt: deletedAt,
    });
    await appendNocrPlanetRootLaw(treeDeletedRecord);
    await appendBranchTreePlanetRootLaw(treeDeletedRecord);
    nocrParity = await readNocrParity();
    const failClosed = buildNocrParityFailClosedRefusal(runId, nocrParity);
    await appendSnapRunLedger({
      runId,
      profileId: "LML_CHAT_RUNTIME",
      profileVersion: "1.0.0",
      profileImmutableHash: "lml-chat-runtime-v1",
      runMode: "demo",
      admissible: false,
      nullOutput: true,
      blockerCount: nocrParity.missingLawIds.length + nocrParity.extraLawIds.length,
      rejectedCount: 0,
      artifactLength: context.user_message.length,
      createdAt: new Date().toISOString(),
    });
    return return_trace(
      ontology,
      {
        ...guarded,
        active_constraints: constrained.active_constraints,
        triggered_constraints: [...constrained.triggered_constraints, "nocr_ledger_planet_parity"],
        final_action: failClosed.final_action,
        reason: failClosed.reason,
      },
      failClosed,
      intelligence,
      {
        sessionId: state.sessionId,
        step: state.step,
        wm_focus: state.wm.focus,
        l0_size: state.ltm.L0.length,
        l1_size: state.ltm.L1.length,
        dependency_edges: state.dependencies.length,
      },
      {
        noveltyDetected: false,
        coverageIncomplete: false,
        proposedLawCount: 0,
        activatedFromPriorCycle,
        ledgerIndex: null,
      },
      EMPTY_QUANTUM_BLANKET,
      metaCritical
        ? {
          fired: true,
          mode: metaCritical.mode,
          reason: metaCritical.reason,
          preserveExpression: metaCritical.preserveExpression,
        }
        : EMPTY_META_CRITICAL,
      EMPTY_FAILURE_LEARNING,
      undefined,
      nocrFunnelState,
      quantumCollapse,
      rootRegistry,
      {
        ...nocrParity,
        fail_closed: true,
      },
      {
        exactSeedCount: exactChatSeeds.length,
        seeds: exactChatSeeds.map((seed) => ({ id: seed.id, origin: seed.origin })),
        qeSeedCount: qeChatSeeds.length,
        qeSeeds: qeChatSeeds.map((seed) => ({ id: seed.id, origin: seed.origin })),
      },
    );
  }
  const formationId = quantumCollapse.formationId ?? selectFormation(guarded.ability_route, guarded.final_action);
  let generated: GeneratedOutput | null = null;
  let repaired: RepairedOutput | null = null;
  let finalized: RepairedOutput | null = null;
  const orchestratorTrace = await runPathFormation(formationId, {
    intent: () => ({
      status: "ok",
      detail: `route=${guarded.ability_route}`,
    }),
    safety: () => ({
      status: "ok",
      detail: guarded.final_action === "refusal"
        ? `guard_refusal_detected:${guarded.reason}`
        : guarded.reason,
    }),
    execute: async () => {
      generated = await generate_governed_response(
        runId,
        context.user_message,
        documentText,
        ontology,
        constrained,
        guarded,
        state,
        branchRendererContext,
      );
      return {
        status: "ok",
        detail: generated.final_action === "success" ? "governed generation complete" : "generated refusal candidate",
      };
    },
    repair: () => {
      if (!generated) {
        return {
          status: "blocked",
          detail: "execute stage did not produce generation output",
        };
      }
      repaired = runNslRepairCycle(generated, {
        userMessage: context.user_message,
        state,
        constrained,
        guarded,
        userLawTexts: ontology.user_laws_applied,
        branchRendererContext,
      });
      return {
        status: "ok",
        detail: repaired.final_action === "success" ? "nsl repair pass" : "nsl repair forced refusal",
      };
    },
    output: async () => {
      if (!repaired) {
        return {
          status: "blocked",
          detail: "repair stage did not produce output candidate",
        };
      }
      finalized = repaired;
      if (repaired.final_action === "refusal" && !isMetaCriticalReason(repaired.reason)) {
        finalized = {
          ...repaired,
          text: renderDeterministicLawRefusal(repaired.reason, constrained.triggered_constraints),
          model: buildDeterministicRuntimeModel(runId, "deterministic-output-refusal"),
        };
      }
      return {
        status: "ok",
        detail: finalized.final_action === "success" ? "output admitted" : "output refused",
      };
    },
  });
  const effectiveFinal = finalized ?? repaired ?? (generated
    ? runNslRepairCycle(generated, {
      userMessage: context.user_message,
      state,
      constrained,
      guarded,
      userLawTexts: ontology.user_laws_applied,
      branchRendererContext,
    })
    : buildEmergencyRefusal(runId, "orchestrator did not produce output"));
  const failureLearning = registerFailureLearningLaws(state, {
    userMessage: context.user_message,
    abilityRoute: guarded.ability_route,
    finalAction: effectiveFinal.final_action,
    reason: effectiveFinal.reason,
    failureClasses: effectiveFinal.failureClasses,
    triggeredRepairs: effectiveFinal.triggeredRepairs,
  });
  await appendMetaDeliveryRecords(state.sessionId, runId, failureLearning.proposedLaws, resolveAutoApplySources(state));
  const generationHardening = registerGenerationHardeningLaws(state, {
    userMessage: context.user_message,
    abilityRoute: guarded.ability_route,
    output: effectiveFinal,
  });
  await appendMetaDeliveryRecords(state.sessionId, runId, generationHardening, resolveAutoApplySources(state));
  const humanGenerationHardening = registerHumanGenerationHardeningLaws(state, {
    userMessage: context.user_message,
    abilityRoute: guarded.ability_route,
    output: effectiveFinal,
  });
  await appendMetaDeliveryRecords(state.sessionId, runId, humanGenerationHardening, resolveAutoApplySources(state));
  const nslRecord = await appendNslRepairLedger(resolveNslLedgerEventType(effectiveFinal), {
    runId,
    reason: effectiveFinal.reason,
    finalAction: effectiveFinal.final_action,
    failureClasses: effectiveFinal.failureClasses,
    triggeredRepairs: effectiveFinal.triggeredRepairs,
    createdAt: new Date().toISOString(),
  });
  await appendNslPlanetRootLaw(nslRecord);
  const intentLockedFinal = applyDeterministicIntentLawOutput(
    context.user_message,
    effectiveFinal,
    ontology.capability_graph.abilities.coding.state,
  );
  const addressedFinal = applyAddressLawIfPresent(intentLockedFinal, ontology.user_laws_applied);
  if (addressedFinal.final_action !== "success") {
    const archivedAt = new Date().toISOString();
    state.activeChat = closeActiveChatBranch(state.activeChat, quantumCollapse.branch!.id);
    const branchClosedRecord = await appendNocrBranchClosedLedger({
      runId,
      branchId: quantumCollapse.branch!.id,
      treeId: quantumCollapse.tree!.id,
      stateChangeId: `state.${quantumCollapse.branch!.id}.closed`,
      entity: "branch",
      lifecycle: "closed",
      reason: addressedFinal.reason,
      createdAt: archivedAt,
    });
    await appendNocrPlanetRootLaw(branchClosedRecord);
    await appendBranchTreePlanetRootLaw(branchClosedRecord);
    const branchArchivedRecord = await appendNocrBranchArchivedLedger({
      runId,
      branchId: quantumCollapse.branch!.id,
      treeId: quantumCollapse.tree!.id,
      stateChangeId: `state.${quantumCollapse.branch!.id}.archived`,
      entity: "branch",
      lifecycle: "archived",
      reason: addressedFinal.reason,
      createdAt: archivedAt,
    });
    await appendNocrPlanetRootLaw(branchArchivedRecord);
    await appendBranchTreePlanetRootLaw(branchArchivedRecord);
    const treeArchivedRecord = await appendNocrTreeArchivedLedger({
      runId,
      branchId: quantumCollapse.branch!.id,
      treeId: quantumCollapse.tree!.id,
      stateChangeId: `state.${quantumCollapse.tree!.id}.archived`,
      entity: "tree",
      lifecycle: "archived",
      reason: addressedFinal.reason,
      createdAt: archivedAt,
    });
    await appendNocrPlanetRootLaw(treeArchivedRecord);
    await appendBranchTreePlanetRootLaw(treeArchivedRecord);
  }
  nocrParity = await readNocrParity();
  if (!nocrParity.ok) {
    const deletedAt = new Date().toISOString();
    const branchDeletedRecord = await appendNocrBranchDeletedLedger({
      runId,
      branchId: quantumCollapse.branch!.id,
      treeId: quantumCollapse.tree!.id,
      stateChangeId: `state.${quantumCollapse.branch!.id}.deleted`,
      entity: "branch",
      lifecycle: "deleted",
      reason: "nocr_ledger_planet_parity_failed",
      createdAt: deletedAt,
    });
    await appendNocrPlanetRootLaw(branchDeletedRecord);
    await appendBranchTreePlanetRootLaw(branchDeletedRecord);
    const treeDeletedRecord = await appendNocrTreeDeletedLedger({
      runId,
      branchId: quantumCollapse.branch!.id,
      treeId: quantumCollapse.tree!.id,
      stateChangeId: `state.${quantumCollapse.tree!.id}.deleted`,
      entity: "tree",
      lifecycle: "deleted",
      reason: "nocr_ledger_planet_parity_failed",
      createdAt: deletedAt,
    });
    await appendNocrPlanetRootLaw(treeDeletedRecord);
    await appendBranchTreePlanetRootLaw(treeDeletedRecord);
    nocrParity = await readNocrParity();
  }
  const finalOutput = nocrParity.ok ? addressedFinal : buildNocrParityFailClosedRefusal(runId, nocrParity);
  updateCodingContinuityMemory(state, context.user_message, finalOutput);
  const novelty = await runNoveltyControllerCycle({
    runId,
    message: context.user_message,
    sessionId: context.session_id,
    userLaws: [...context.user_laws, ...autoLaws],
    state,
    baseCoverageComplete: lawWeb.coverage.complete,
  });
  const quantumBlanket = runQuantumBlanketCycle({
    message: context.user_message,
    documentText,
    userLawTexts: ontology.user_laws_applied,
    state,
  });
  await appendMetaDeliveryRecords(state.sessionId, runId, quantumBlanket.proposals, resolveAutoApplySources(state));
  const chatBranchUpdate = finalOutput.final_action === "success"
    ? updateActiveChatBranch({
      current: state.activeChat,
      quantumCollapse,
      reason: finalOutput.reason,
      abilityRoute: guarded.ability_route,
    })
    : {
      action: "none" as const,
      branch: null,
      state: state.activeChat,
      governanceReason: "branch_growth_skipped_on_refusal",
    };
  state.activeChat = chatBranchUpdate.state;
  if (chatBranchUpdate.branch && chatBranchUpdate.action !== "none") {
    const lifecycleAt = new Date().toISOString();
    const lifecyclePayload = {
      runId,
      branchId: chatBranchUpdate.branch.id,
      treeId: chatBranchUpdate.branch.treeId,
      stateChangeId: `state.${chatBranchUpdate.branch.id}.${chatBranchUpdate.action}`,
      entity: "branch" as const,
      reason: finalOutput.reason,
      createdAt: lifecycleAt,
    };
    const lifecycleRecord = chatBranchUpdate.action === "extend"
      ? await appendNocrBranchExtendedLedger({ ...lifecyclePayload, lifecycle: "extended" })
      : chatBranchUpdate.action === "fork"
        ? await appendNocrBranchForkedLedger({ ...lifecyclePayload, lifecycle: "forked" })
        : chatBranchUpdate.action === "sibling"
          ? await appendNocrBranchSiblingCreatedLedger({ ...lifecyclePayload, lifecycle: "forked" })
          : chatBranchUpdate.action === "merge"
            ? await appendNocrBranchMergedLedger({ ...lifecyclePayload, lifecycle: "extended" })
            : null;
    if (lifecycleRecord) {
      await appendNocrPlanetRootLaw(lifecycleRecord);
      await appendBranchTreePlanetRootLaw(lifecycleRecord);
    }
    const treeRecord = chatBranchUpdate.action === "new_tree"
      ? await appendNocrTreeStartedLedger({
        runId,
        branchId: chatBranchUpdate.branch.id,
        treeId: chatBranchUpdate.branch.treeId,
        stateChangeId: `state.${chatBranchUpdate.branch.treeId}.started`,
        entity: "tree",
        lifecycle: "extended",
        reason: finalOutput.reason,
        createdAt: lifecycleAt,
      })
      : await appendNocrTreeExtendedLedger({
        runId,
        branchId: chatBranchUpdate.branch.id,
        treeId: chatBranchUpdate.branch.treeId,
        stateChangeId: `state.${chatBranchUpdate.branch.treeId}.extended`,
        entity: "tree",
        lifecycle: "extended",
        reason: finalOutput.reason,
        createdAt: lifecycleAt,
      });
    await appendNocrPlanetRootLaw(treeRecord);
    await appendBranchTreePlanetRootLaw(treeRecord);
  }

  updateInfiniteContext(state, {
    user: context.user_message,
    assistant: finalOutput.text,
    admitted: finalOutput.final_action === "success",
    reason: finalOutput.reason,
    constraints: constrained.active_constraints,
    docs: context.documents,
  });
  // Apply newly proposed hardening laws immediately so failures
  // become active constraints in this same turn, not one turn later.
  applyPendingLawProposals(state, {
    autoApplySources: resolveAutoApplySources(state),
  });
  await persistContextState(state);

  await appendSnapRunLedger({
    runId,
    profileId: "LML_CHAT_RUNTIME",
    profileVersion: "1.0.0",
    profileImmutableHash: "lml-chat-runtime-v1",
    runMode: "demo",
    admissible: finalOutput.final_action === "success",
    nullOutput: finalOutput.final_action !== "success",
    blockerCount: constrained.triggered_constraints.length + (nocrParity.ok ? 0 : nocrParity.missingLawIds.length + nocrParity.extraLawIds.length),
    rejectedCount: finalOutput.triggeredRepairs.length,
    artifactLength: context.user_message.length,
    createdAt: new Date().toISOString(),
  });

  return return_trace(
    ontology,
    {
      ...guarded,
      active_constraints: constrained.active_constraints,
      triggered_constraints: nocrParity.ok
        ? constrained.triggered_constraints
        : [...constrained.triggered_constraints, "nocr_ledger_planet_parity"],
      final_action: finalOutput.final_action,
      reason: finalOutput.reason,
    },
    finalOutput,
    intelligence,
    {
      sessionId: state.sessionId,
      step: state.step,
      wm_focus: state.wm.focus,
      l0_size: state.ltm.L0.length,
      l1_size: state.ltm.L1.length,
      dependency_edges: state.dependencies.length,
    },
      {
        noveltyDetected: novelty.noveltyDetected,
        coverageIncomplete: novelty.coverageIncomplete,
        proposedLawCount: novelty.proposedLaws.length,
        activatedFromPriorCycle,
        ledgerIndex: novelty.ledgerIndex,
      },
      {
        active: quantumBlanket.active,
        candidateCount: quantumBlanket.candidateCount,
        finiteSeedCount: quantumBlanket.finiteSeedCount,
        proposedLawCount: quantumBlanket.proposedLawCount,
        pendingProposalCount: quantumBlanket.pendingProposalCount,
      },
      metaCritical
        ? {
          fired: true,
          mode: metaCritical.mode,
          reason: metaCritical.reason,
          preserveExpression: metaCritical.preserveExpression,
        }
        : {
          fired: false,
          mode: null,
          reason: null,
          preserveExpression: false,
        },
      {
        proposedLawCount: failureLearning.proposedLaws.length,
        signature: failureLearning.signature,
        sources: unique(failureLearning.proposedLaws.map((law) => law.source)),
      },
      orchestratorTrace,
    nocrFunnelState,
    quantumCollapse,
    rootRegistry,
    {
      ...nocrParity,
      fail_closed: !nocrParity.ok,
    },
    {
      exactSeedCount: exactChatSeeds.length,
      seeds: exactChatSeeds.map((seed) => ({ id: seed.id, origin: seed.origin })),
      qeCandidateCount: chatConvoQuantumSpark.candidateCount,
      qeSeedCount: qeChatSeeds.length,
      qeSeeds: qeChatSeeds.map((seed) => ({ id: seed.id, origin: seed.origin })),
    },
    {
      action: chatBranchUpdate.action,
      governanceReason: chatBranchUpdate.governanceReason,
      activeBranchId: state.activeChat.activeBranchId,
      activeTreeId: state.activeChat.activeTreeId,
      branchTurnCount: chatBranchUpdate.branch?.turnCount ?? 0,
      branchSeedCount: chatBranchUpdate.branch?.matchedSeedIds.length ?? 0,
      branchParentCount: chatBranchUpdate.branch?.matchedRootIds.length ?? 0,
    },
  );
}

export async function sync_runtime_user_laws(sessionId: string, userLaws: RuntimeUserLaw[]): Promise<{ count: number }> {
  const state = await getOrCreateContextState(sessionId);
  setUserOverlayLaws(state, userLaws);
  await persistContextState(state);
  return { count: state.userOverlayLaws.length };
}

export function compile_runtime_ontology(
  lawWeb: LawWeb,
  userLaws: RuntimeUserLaw[],
  intelligence: Intelligence49Report,
): OntologyState {
  const requiredMeta = resolveRequiredMetaLaws(lawWeb);
  const baseLaws = [
    "grounding_required",
    "law_coverage_complete",
    "fail_closed_on_violation",
    `INTELLIGENCE_49_BASE:${intelligence.class_id}`,
    `INTELLIGENCE_PROFILE:${intelligence.profile_vector.join(",")}`,
    ...requiredMeta,
  ];
  const userLawTexts = userLaws.map((law) => law.text.trim()).filter(Boolean);
  const systemLaws = [...UNIVERSE_RUNTIME_LAWS];
  const merged = unique([...baseLaws, ...systemLaws, ...userLawTexts]);
  const systemLawObjects: RuntimeUserLaw[] = systemLaws.map((text, index) => ({
    law_id: `SYS-${String(index + 1).padStart(4, "0")}`,
    text,
    scope: "global",
    enforcement: "system_always_on",
  }));
  const capabilityGraph = compileCapabilityGraph([...systemLawObjects, ...userLaws]);

  return {
    base_law_count: lawWeb.coverage.totalSourceLaws,
    base_laws_applied: baseLaws,
    system_laws_applied: systemLaws,
    user_laws_applied: userLawTexts,
    merged_ontology_state: merged,
    capability_graph: capabilityGraph,
  };
}

export function apply_constraints(
  userMessage: string,
  ontology: OntologyState,
  options?: {
    suspendExpressionRefusal?: boolean;
  },
): {
  active_constraints: string[];
  triggered_constraints: string[];
  refusal_reason: string | null;
} {
  const text = userMessage.toLowerCase();
  const activeConstraints = ["grounding_required", "meta_laws_required", "response_relevance_required"];
  const triggered: string[] = [];
  let refusalReason: string | null = null;

  const hasAllRequiredMeta = REQUIRED_META_SOURCE_IDS.every((lawId) =>
    ontology.base_laws_applied.some((entry) => entry.includes(lawId)),
  );
  if (!hasAllRequiredMeta) {
    triggered.push("meta_laws_required");
    refusalReason = "sun meta-law coverage incomplete (required 0164..0169)";
  }

  const userMerged = ontology.user_laws_applied.join("\n").toLowerCase();
  if (/\bforbid unsafe_endpoints|unsafe endpoint|safe_endpoints_only\b/.test(userMerged)) {
    activeConstraints.push("forbid_unsafe_endpoints");
    if (/\bunsafe endpoint|bypass|unrestricted endpoint\b/.test(text)) {
      triggered.push("forbid_unsafe_endpoints");
      refusalReason = "violates law 'forbid unsafe_endpoints' (user-defined)";
    }
  }

  if (/\bnever talk nerdy|never talk formally|no nerd|no formal\b/.test(userMerged)) {
    activeConstraints.push("no_nerd_or_formal_mode");
    if (isNerdOrFormalRequest(userMessage) && !options?.suspendExpressionRefusal) {
      triggered.push("no_nerd_or_formal_mode");
      refusalReason = "violates law 'no nerd/formal mode' (user-defined)";
    }
  }

  const expressionLocked = /\bmy guy|street|slang|casual\b/.test(userMerged);
  if (expressionLocked) {
    activeConstraints.push("expression_style_lock");
    if (/\b(don't|do not|stop|no longer)\b.*\b(my guy|street|slang|casual)\b/.test(text) && !options?.suspendExpressionRefusal) {
      triggered.push("expression_style_lock");
      refusalReason = "violates active expression law (user-defined)";
    }
  }

  return {
    active_constraints: unique(activeConstraints),
    triggered_constraints: unique(triggered),
    refusal_reason: refusalReason,
  };
}

export function guard_abilities(
  userMessage: string,
  constrained: ReturnType<typeof apply_constraints>,
  ontology: OntologyState,
): {
  ability_route: string;
  final_action: "success" | "refusal";
  reason: string;
} {
  if (constrained.refusal_reason) {
    return {
      ability_route: "guard.refusal",
      final_action: "refusal",
      reason: constrained.refusal_reason,
    };
  }

  if (parseRuntimeAbilityLawCommand(userMessage)) {
    return {
      ability_route: "chat.governed",
      final_action: "success",
      reason: "runtime ability command applied",
    };
  }

  const msg = userMessage.toLowerCase();
  if (isFrontierBenchmarkCodingPrompt(msg)) {
    const codingState = ontology.capability_graph.abilities.coding;
    if (codingState.state !== "allowed") {
      return {
        ability_route: "coding.blocked",
        final_action: "refusal",
        reason: buildAbilityBlockedReason("coding", codingState),
      };
    }
    return {
      ability_route: "coding.governed",
      final_action: "success",
      reason: "frontier benchmark coding prompt forced to coding.governed",
    };
  }
  const webSearchAsked = /\b(search|look up|find on web|web)\b/.test(msg);
  const codingAsked = isCodingTaskIntent(msg);
  const webSearchState = ontology.capability_graph.abilities.web_search;
  const codingState = ontology.capability_graph.abilities.coding;

  if (webSearchAsked && webSearchState.state !== "allowed") {
    return {
      ability_route: "web_search.blocked",
      final_action: "refusal",
      reason: buildAbilityBlockedReason("web_search", webSearchState),
    };
  }

  if (codingAsked && codingState.state !== "allowed") {
    return {
      ability_route: "coding.blocked",
      final_action: "refusal",
      reason: buildAbilityBlockedReason("coding", codingState),
    };
  }

  if (webSearchAsked && webSearchState.state === "allowed") {
    return {
      ability_route: "web_search.governed",
      final_action: "success",
      reason: "ability allowed by active ontology capability graph",
    };
  }

  if (codingAsked && codingState.state === "allowed") {
    return {
      ability_route: "coding.governed",
      final_action: "success",
      reason: "coding ability allowed by active ontology capability graph",
    };
  }

  return {
    ability_route: "chat.governed",
    final_action: "success",
    reason: "request admitted by active ontology",
  };
}

export function generate_governed_response(
  runId: string,
  userMessage: string,
  documentText: string,
  ontology: OntologyState,
  constrained: ReturnType<typeof apply_constraints>,
  guarded: ReturnType<typeof guard_abilities>,
  state: InfiniteContextState,
  branchRendererContext: BranchRendererContext,
): Promise<GeneratedOutput> {
  const witness = buildWitnessForChat(runId, guarded.final_action, guarded.reason);
  const metaCritical = detectMetaCriticalSignal(userMessage, ontology.user_laws_applied);
  if (metaCritical) {
    return buildMetaCriticalResponse(runId, userMessage, documentText, ontology.user_laws_applied, witness, metaCritical);
  }
  if (isCapabilitiesIntent(userMessage)) {
    registerCapabilitiesHardeningLaw(state);
    return Promise.resolve({
      text: "I can ingest docs into LML laws to create the reality your AI must follow. What do you want your AI to be?",
      final_action: "success",
      reason: "deterministic_capabilities_response",
      model: buildDeterministicRuntimeModel(runId, "capabilities-deterministic-runtime"),
    });
  }
  if (isCodingReadinessIntent(userMessage)) {
    registerCodingReadinessHardeningLaw(state);
    const codingState = ontology.capability_graph.abilities.coding.state;
    if (codingState === "allowed") {
      return Promise.resolve({
        text: "Coding is active. Give me one concrete build target and stack, and I will generate code.",
        final_action: "success",
        reason: "deterministic_coding_readiness_allowed",
        model: buildDeterministicRuntimeModel(runId, "coding-readiness-deterministic-runtime"),
      });
    }
    if (codingState === "blocked") {
      return Promise.resolve({
        text: "Coding is blocked by your active laws right now. Remove or update the blocking coding law to continue.",
        final_action: "refusal",
        reason: "deterministic_coding_readiness_blocked",
        model: buildDeterministicRuntimeModel(runId, "coding-readiness-deterministic-runtime-blocked"),
      });
    }
    return Promise.resolve({
      text: "I can’t code yet under current active laws. Add a coding ability law and apply LML, then ask again.",
      final_action: "refusal",
      reason: "deterministic_coding_readiness_not_installed",
      model: buildDeterministicRuntimeModel(runId, "coding-readiness-deterministic-runtime-not-installed"),
    });
  }
  if (guarded.final_action === "refusal") {
    return Promise.resolve({
      text: renderDeterministicLawRefusal(guarded.reason, constrained.triggered_constraints),
      final_action: "refusal",
      reason: guarded.reason,
      model: buildDeterministicRuntimeModel(runId, "deterministic-law-refusal"),
    });
  }

  const insights = extractDocumentInsights(documentText);
  const runtimeAbilityCommand = parseRuntimeAbilityLawCommand(userMessage);
  const humanMirrorProfile = compileHumanMirrorProfile({
    question: userMessage,
    policy: parseExpressionPolicy(ontology.user_laws_applied.join("\n")),
    documentInsights: insights,
  });
  if (runtimeAbilityCommand) {
    return Promise.resolve({
      text: renderDeterministicAbilityCommandResponse(runtimeAbilityCommand, ontology),
      final_action: "success",
      reason: "runtime ability command applied",
      model: buildDeterministicRuntimeModel(runId, "deterministic-ability-command"),
    });
  }
  const lifePreservationProjection = buildLifePreservationProjection(userMessage, ontology.user_laws_applied);
  if (lifePreservationProjection) {
    return Promise.resolve({
      text: composeLawGovernedSpeech({
        userMessage,
        lane: "life_preservation",
        context: branchRendererContext,
        payload: buildHumanCompiledPrompt(humanMirrorProfile, userMessage, lifePreservationProjection, "life_preservation"),
      }),
      final_action: "success",
      reason: "life-preservation projection engaged",
      model: buildDeterministicRuntimeModel(runId, "branch-law-emitter-life-preservation"),
    });
  }
  const styleProjection = buildStyleDirectiveProjection(userMessage, ontology.user_laws_applied, insights);
  if (styleProjection && guarded.ability_route === "chat.governed") {
    return Promise.resolve({
      text: composeLawGovernedSpeech({
        userMessage,
        lane: "style_directive",
        context: branchRendererContext,
        payload: buildHumanCompiledPrompt(humanMirrorProfile, userMessage, styleProjection, "style_directive"),
      }),
      final_action: "success",
      reason: "style directive projected through policy runtime",
      model: buildDeterministicRuntimeModel(runId, "branch-law-emitter-style-directive"),
    });
  }
  if (guarded.ability_route === "web_search.governed") {
    return buildWebSearchResponse(runId, userMessage, witness, guarded.reason);
  }
  if (guarded.ability_route === "coding.governed") {
    if (isFrontierBenchmarkCodingPrompt(userMessage.toLowerCase())) {
      return runFrontierBenchmarkPatchPath({
        runId,
        userMessage,
      });
    }
    const codingContract = deriveCodingSkeletonContract({
      question: userMessage,
      userLaws: ontology.user_laws_applied,
      insights,
    });
    const codingIntentSpec = deriveCodingIntentSpec({
      question: userMessage,
      contract: codingContract,
    });
    const codingRepoContext = shouldUseRepoContext(userMessage, codingContract)
      ? buildCodingRepoContext({
        rootDir: process.cwd(),
        contract: codingContract,
      })
      : null;
    const deterministicLawPath = resolveDeterministicCodingLawPath(userMessage);
    if (deterministicLawPath) {
      if (!validateDeterministicCodingLawOutput(deterministicLawPath.text) || !classifyCodingProjection(deterministicLawPath.text, codingContract).ok) {
        return Promise.resolve({
          text: "NULL: deterministic coding law path produced non-admissible output.",
          final_action: "refusal",
          reason: "coding_projection_failed:deterministic_law_output_invalid",
          model: buildDeterministicRuntimeModel(runId, "deterministic-coding-law-invalid"),
        });
      }
      return Promise.resolve({
        text: deterministicLawPath.text,
        final_action: "success",
        reason: deterministicLawPath.reason,
        model: buildDeterministicRuntimeModel(runId, deterministicLawPath.callId),
      });
    }
    if (codingNeedsClarification(userMessage, codingContract, codingIntentSpec)) {
      return Promise.resolve({
        text: buildDeterministicCodingClarification(userMessage, codingContract, codingIntentSpec, codingRepoContext),
        final_action: "success",
        reason: "deterministic_coding_clarification",
        model: buildDeterministicRuntimeModel(runId, "branch-law-emitter-coding-clarification"),
      });
    }
    const codingText = buildGovernedCodingResponse(userMessage, ontology.user_laws_applied, insights, state);
    return runCodingCollapse({
      basePrompt: codingText,
      contract: codingContract,
      intentSpec: codingIntentSpec,
      witness,
      repoContext: codingRepoContext,
    }).then((collapse) => {
      const baseModel = buildRuntimeModelFromReceipt(runId, collapse.receipt);
      if (!collapse.ok) {
        return {
          text: `NULL: coding projection failed (${collapse.reason}).`,
          final_action: "refusal" as const,
          reason: `coding_projection_failed:${collapse.reason}`,
          model: baseModel,
        };
      }
      return {
        text: buildLawGovernedCodingEmit(userMessage, collapse.text, codingContract),
        final_action: "success" as const,
        reason: collapse.reason,
        model: baseModel,
      };
    });
  }
  const contextAnchored = buildContextAnchoredResponse(userMessage, state, insights, ontology.user_laws_applied);
  if (contextAnchored) {
    return Promise.resolve({
      text: composeLawGovernedSpeech({
        userMessage,
        lane: "context_anchor",
        context: branchRendererContext,
        payload: buildHumanCompiledPrompt(humanMirrorProfile, userMessage, contextAnchored, "context_anchor"),
      }),
      final_action: "success",
      reason: guarded.reason,
      model: buildDeterministicRuntimeModel(runId, "branch-law-emitter-context-anchor"),
    });
  }
  const learningResponse = buildLearningResponse(userMessage, ontology.user_laws_applied, insights);
  if (learningResponse) {
    return Promise.resolve({
      text: composeLawGovernedSpeech({
        userMessage,
        lane: "learning",
        context: branchRendererContext,
        payload: buildHumanCompiledPrompt(humanMirrorProfile, userMessage, learningResponse, "learning"),
      }),
      final_action: "success",
      reason: guarded.reason,
      model: buildDeterministicRuntimeModel(runId, "branch-law-emitter-learning"),
    });
  }

  return Promise.resolve({
    text: composeLawGovernedSpeech({
      userMessage,
      lane: "base_chat",
      context: branchRendererContext,
      payload: buildHumanCompiledPrompt(
        humanMirrorProfile,
        userMessage,
        buildBaseCoreResponse(userMessage, insights, state),
        "base_chat",
      ),
    }),
    final_action: "success",
    reason: guarded.reason,
    model: buildDeterministicRuntimeModel(runId, "branch-law-emitter-base-chat"),
  });
}

function isCapabilitiesIntent(userMessage: string): boolean {
  const normalized = userMessage.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const directCapabilityQuery = /\b(what can lml do|what can you do|your capabilities|lml capabilities|show capabilities|show me your capabilities)\b/i.test(normalized);
  if (!directCapabilityQuery) {
    return false;
  }

  // Pure capability queries are allowed through the deterministic capability answer.
  // Mixed prompts with real tasks, emotions, or multi-domain asks must stay in branch formation.
  const mixedTaskSignals = [
    /\b(code|coding|build|make|write|implement|debug|refactor|design|graph|parser|compiler|doom|game|endpoint|api|fastapi|python|typescript|javascript|shell)\b/i,
    /\b(math|formula|derivation|calc|class|study|homework)\b/i,
    /\b(cat|girlfriend|gf|bro|brodie|angry|mad|sad|crash out|patience|apology|relationship)\b/i,
    /\b(policy|law|new law|explain|what do you think|reality check|study plan|roadmap)\b/i,
    /\b(today|tonight|tomorrow|yesterday|continue|finish|help me)\b/i,
  ];
  return !mixedTaskSignals.some((pattern) => pattern.test(normalized));
}

function buildDeterministicRuntimeModel(runId: string, callId: string): LmlChatResult["model"] {
  const at = new Date().toISOString();
  return {
    provider: "gpt2-runtime",
    model: "gpt2",
    runId,
    callId,
    at,
    inputDigest: `deterministic:${callId}:${at}`,
    generationStatus: "deterministic",
    generationFailureClass: "none",
    generationDetail: `deterministic:${callId}`,
  };
}

function buildRuntimeModelFromReceipt(runId: string, receipt: Gpt2CallResult["receipt"]): LmlChatResult["model"] {
  return {
    provider: receipt.provider,
    model: receipt.model,
    runId,
    callId: receipt.callId,
    at: receipt.at,
    inputDigest: receipt.inputDigest,
    generationStatus: receipt.generationStatus,
    generationFailureClass: receipt.generationFailureClass,
    generationDetail: receipt.generationDetail,
  };
}

function buildBranchRendererContext(
  quantumCollapse: QuantumCollapseResult,
  rootRegistry: ReturnType<typeof buildRootRegistry>,
  exactChatSeeds: Array<{ id: string; text: string }>,
  qeChatSeeds: Array<{ id: string; text: string }>,
): BranchRendererContext {
  const rootById = new Map(rootRegistry.allRoots.map((root) => [root.id, root]));
  const seedById = new Map([...exactChatSeeds, ...qeChatSeeds, { id: quantumCollapse.taggedSeed.seed.id, text: quantumCollapse.taggedSeed.seed.text }].map((seed) => [seed.id, seed.text]));
  return {
    branchId: quantumCollapse.branch?.id ?? null,
    treeId: quantumCollapse.tree?.id ?? null,
    matchedSeedTexts: unique(
      quantumCollapse.snapMatches.map((match) => seedById.get(match.seedId) ?? match.seedId),
    ),
    matchedRootIds: unique(quantumCollapse.snapMatches.map((match) => match.rootId)),
    matchedRootLabels: unique(
      quantumCollapse.snapMatches.map((match) => rootById.get(match.rootId)?.label ?? match.rootId),
    ),
    snapMatchCount: quantumCollapse.snapMatches.length,
  };
}

function registerCapabilitiesHardeningLaw(state: InfiniteContextState): void {
  const law = {
    text: "must enforce deterministic canonical capability response and reject numeric/statistical drift on capability intent turns",
    scope: "global",
    enforcement: "meta_hardening_capabilities_canonical",
    source: "meta_projection_loop",
  };
  state.pendingLawProposals = uniquePendingProposals([
    ...state.pendingLawProposals,
    law,
  ]);
}

function registerCodingReadinessHardeningLaw(state: InfiniteContextState): void {
  const law = {
    text: "must enforce deterministic canonical coding-readiness response and reject policy-noise drift on coding readiness intent turns",
    scope: "coding",
    enforcement: "meta_hardening_coding_readiness_canonical",
    source: "meta_projection_loop",
  };
  state.pendingLawProposals = uniquePendingProposals([
    ...state.pendingLawProposals,
    law,
  ]);
}

function isCodingReadinessIntent(userMessage: string): boolean {
  return /\b(ready to code|can you code|coding ready|code now|you ready to code)\b/i.test(
    userMessage.trim().toLowerCase(),
  );
}

function isCodingTaskIntent(userMessageLower: string): boolean {
  if (isFrontierBenchmarkCodingPrompt(userMessageLower)) {
    return true;
  }
  const codingSignal = /\b(code|coding|write code|debug|refactor|implement|function|script|typescript|javascript|python|golang|rust|fastapi|flask|pytest|unittest|api|endpoint|middleware|sqlalchemy|crud|regex)\b/.test(
    userMessageLower,
  );
  if (!codingSignal) {
    return false;
  }

  const mixedHumanSignals = [
    /\b(angry|mad|sad|bro|brodie|girlfriend|gf|wife|husband|friend|crash out|patience|emotion|feeling)\b/,
    /\b(math|formula|derivation|calc|class|study|homework)\b/,
    /\b(apology|relationship|reality check|what do you think|what u think|keep me solid)\b/,
    /\b(plan|roadmap|most important thing first|without losing any piece)\b/,
  ];
  const mixedDomainPrompt = mixedHumanSignals.some((pattern) => pattern.test(userMessageLower));

  // Mixed human / multi-domain prompts should stay in branch formation.
  // Coding ability gating is reserved for coding-dominant turns.
  if (mixedDomainPrompt) {
    return false;
  }

  return true;
}

function isFrontierBenchmarkCodingPrompt(userMessageLower: string): boolean {
  return /\bswe-bench(?:\s+pro)?\b/.test(userMessageLower)
    && /\brepository:/.test(userMessageLower)
    && /\binstance id:/.test(userMessageLower);
}

export function return_trace(
  ontology: OntologyState,
  guarded: ReturnType<typeof guard_abilities> & { active_constraints?: string[]; triggered_constraints?: string[] },
  generated: RepairedOutput,
  intelligence: Intelligence49Report,
  context: LmlChatResult["context"],
  novelty: LmlChatResult["novelty"],
  quantumBlanket: LmlChatResult["quantum_blanket"],
  metaCritical: LmlChatResult["meta_critical"],
  failureLearning: LmlChatResult["failure_learning"],
  orchestratorTrace?: OrchestratorTrace,
  nocrFunnelState?: NocrFunnelState,
  quantumCollapse?: QuantumCollapseResult,
  rootRegistry?: ReturnType<typeof buildRootRegistry>,
  nocrParity?: {
    ok: boolean;
    fail_closed: boolean;
    missingLawIds: string[];
    extraLawIds: string[];
  },
  chatSeedLane?: {
    exactSeedCount: number;
    seeds: Array<{
      id: string;
      origin: string;
    }>;
    qeCandidateCount?: number;
    qeSeedCount?: number;
    qeSeeds?: Array<{
      id: string;
      origin: string;
    }>;
  },
  chatBranch?: {
    action: "new_tree" | "extend" | "fork" | "sibling" | "merge" | "none";
    governanceReason?: string;
    activeBranchId: string | null;
    activeTreeId: string | null;
    branchTurnCount: number;
    branchSeedCount: number;
    branchParentCount: number;
  },
): LmlChatResult {
  const code = extractCodeBlocks(generated.text);
  return {
    answer: generated.text,
    code: {
      blocks: code,
      primary: code[0] ?? null,
    },
    ontology,
    intelligence,
    context,
    novelty,
    quantum_blanket: quantumBlanket,
    meta_critical: metaCritical,
    failure_learning: failureLearning,
    model: generated.model,
    benchmark_debug: generated.benchmark_debug,
    trace: {
      base_laws: ontology.base_laws_applied,
      system_laws: ontology.system_laws_applied,
      user_laws: ontology.user_laws_applied,
      merged_ontology: ontology.merged_ontology_state,
      active_constraints: guarded.active_constraints ?? [],
      triggered_constraints: guarded.triggered_constraints ?? [],
      ability_route: guarded.ability_route,
      final_action: generated.final_action,
      reason: generated.reason,
      triggered_repairs: generated.triggeredRepairs,
      path_orchestrator: orchestratorTrace
        ? {
          formation_id: orchestratorTrace.formation_id,
          stage_count: orchestratorTrace.stages.length,
          terminated: orchestratorTrace.terminated,
          termination_reason: orchestratorTrace.termination_reason,
          stages: orchestratorTrace.records.map((record) => ({
            stage: record.stage,
            status: record.status,
            detail: record.detail,
          })),
        }
        : undefined,
      nocr_funnel: nocrFunnelState
        ? {
          seed_tag: nocrFunnelState.taggedSeed.seedTag,
          root_space_size: nocrFunnelState.taggedRoots.length,
          ledger_state: nocrFunnelState.ledgerState,
          reason: nocrFunnelState.taggedSeed.funnelReason,
        }
        : undefined,
      nocr_input: nocrFunnelState
        ? {
          root_count: nocrFunnelState.taggedRoots.length,
          chat_exact_seed_count: nocrFunnelState.exactChatSeeds.length,
          chat_qe_seed_count: nocrFunnelState.qeChatSeeds.length,
        }
        : undefined,
      quantum_collapse: quantumCollapse
        ? {
          seed_tag: quantumCollapse.taggedSeed.seedTag,
          root_tag: quantumCollapse.matchedRoot?.rootTag ?? null,
          root_id: quantumCollapse.matchedRoot?.root.id ?? null,
          branch_id: quantumCollapse.branch?.id ?? null,
          tree_id: quantumCollapse.tree?.id ?? null,
          state_change_id: quantumCollapse.stateChange?.id ?? null,
          domain: quantumCollapse.matchedRoot?.root.domain ?? null,
          reason: quantumCollapse.reason,
          collapse_moment: quantumCollapse.collapseMoment,
          lock_state: quantumCollapse.lockState,
          lock_reason_class: quantumCollapse.lockReasonClass,
          match_score: quantumCollapse.matchScore,
          qe_generated_root_count: quantumCollapse.qeGeneratedRootCount,
          qe_checked_root_count: quantumCollapse.qeCheckedRootCount,
          snap_match_count: quantumCollapse.snapMatches.length,
          snap_matches: quantumCollapse.snapMatches.map((match) => ({
            seed_id: match.seedId,
            root_id: match.rootId,
            domain: match.domain,
            reason_class: match.reasonClass,
            score: match.score,
          })),
        }
        : undefined,
      chat_seed_lane: chatSeedLane
        ? {
          exact_seed_count: chatSeedLane.exactSeedCount,
          primary_seed_id: chatSeedLane.seeds[0]?.id ?? null,
          primary_seed_origin: chatSeedLane.seeds[0]?.origin ?? null,
          qe_candidate_count: chatSeedLane.qeCandidateCount ?? 0,
          qe_seed_count: chatSeedLane.qeSeedCount ?? 0,
          primary_qe_seed_id: chatSeedLane.qeSeeds?.[0]?.id ?? null,
          primary_qe_seed_origin: chatSeedLane.qeSeeds?.[0]?.origin ?? null,
        }
        : undefined,
      chat_branch: chatBranch
        ? {
          action: chatBranch.action,
          governance_reason: chatBranch.governanceReason ?? "none",
          active_branch_id: chatBranch.activeBranchId,
          active_tree_id: chatBranch.activeTreeId,
          branch_turn_count: chatBranch.branchTurnCount,
          branch_seed_count: chatBranch.branchSeedCount,
          branch_parent_count: chatBranch.branchParentCount,
        }
        : undefined,
      root_registry: rootRegistry
        ? {
          static_count: rootRegistry.staticRoots.length,
          extracted_count: rootRegistry.extractedRoots.length,
          total_count: rootRegistry.allRoots.length,
          source_units: rootRegistry.extraction.sourceUnitCount,
          extracted_root_count: rootRegistry.extraction.extractedRootCount,
          expansion_delta: rootRegistry.extraction.expansionDelta,
          under_enumerated: rootRegistry.extraction.underEnumerated,
          identity_kernel_count: rootRegistry.extraction.identityKernelCount,
          legality_region_count: rootRegistry.extraction.legalityRegionCount,
          directive_count: rootRegistry.extraction.directiveCount,
          code_unit_count: rootRegistry.extraction.codeUnitCount,
          math_unit_count: rootRegistry.extraction.mathUnitCount,
          sentence_count: rootRegistry.extraction.sentenceCount,
          artifact_root_count: rootRegistry.extraction.artifactRootCount,
          user_law_root_count: rootRegistry.extraction.userLawRootCount,
        }
        : undefined,
      nocr_parity: nocrParity
        ? {
          ok: nocrParity.ok,
          fail_closed: nocrParity.fail_closed,
          missing_law_ids: nocrParity.missingLawIds,
          extra_law_ids: nocrParity.extraLawIds,
        }
        : undefined,
      meta_critical: metaCritical.fired && metaCritical.mode
        ? {
          fired: true,
          mode: metaCritical.mode,
          reason: metaCritical.reason ?? "meta_critical",
          preserve_expression: metaCritical.preserveExpression,
        }
        : undefined,
      failure_learning: {
        proposed_law_count: failureLearning.proposedLawCount,
        signature: failureLearning.signature,
        sources: failureLearning.sources,
      },
      generation: {
        status: generated.model.generationStatus ?? "generated",
        failure_class: generated.model.generationFailureClass && generated.model.generationFailureClass !== "none"
          ? generated.model.generationFailureClass
          : null,
        detail: generated.model.generationDetail ?? null,
      },
      ...buildWitnessTrace(ontology, guarded, generated),
    },
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function inferSeedSourceFromAbilityRoute(abilityRoute: string): "chat" | "coding" | "web_search" | "refusal" {
  if (abilityRoute.startsWith("coding.")) {
    return "coding";
  }
  if (abilityRoute.startsWith("web_search.")) {
    return "web_search";
  }
  if (abilityRoute === "guard.refusal") {
    return "refusal";
  }
  return "chat";
}

function resolveRequiredMetaLaws(lawWeb: LawWeb): string[] {
  const required = new Map<string, string>();
  for (const meta of lawWeb.meta) {
    if (REQUIRED_META_SOURCE_IDS.includes(meta.sourceLawId as (typeof REQUIRED_META_SOURCE_IDS)[number])) {
      required.set(meta.sourceLawId, `${meta.sourceLawId}: ${meta.section} :: ${meta.text}`);
    }
  }

  for (const lawId of REQUIRED_META_SOURCE_IDS) {
    if (!required.has(lawId)) {
      required.set(lawId, `${lawId}: required meta law unresolved`);
    }
  }

  return REQUIRED_META_SOURCE_IDS.map((lawId) => required.get(lawId) as string);
}

function buildWitnessForChat(runId: string, finalAction: "success" | "refusal", reason: string): Witness {
  return {
    runId,
    outcome: finalAction === "success" ? "ADMISSIBLE" : "NULL",
    gates: [
      {
        code: "ADMISSIBILITY_PREREQS",
        pass: finalAction === "success",
        detail: reason,
      },
    ],
    repairPlan: [],
    explanation: {
      blockedReasons: finalAction === "refusal" ? [reason] : [],
      acceptedReasons: finalAction === "success" ? [reason] : [],
      lmlRepairingPlan: [],
    },
    ledger: {
      attemptCountForInput: 1,
      locked: false,
      lockReason: null,
    },
  };
}

async function buildMetaCriticalResponse(
  runId: string,
  userMessage: string,
  documentText: string,
  userLaws: string[],
  witness: Witness,
  metaCritical: MetaCriticalSignal,
): Promise<GeneratedOutput> {
  const insights = extractDocumentInsights(documentText);
  const guidance = buildMetaCriticalGuidance({
    userMessage,
    userLaws,
    mode: metaCritical.mode,
    reason: metaCritical.reason,
    documentInsights: insights,
  });
  const text = composeLawGovernedSpeech({
    userMessage,
    lane: "meta_critical",
    payload: guidance,
    context: {
      branchId: null,
      treeId: null,
      matchedSeedTexts: [],
      matchedRootIds: [],
      matchedRootLabels: [],
      snapMatchCount: 0,
    },
  });
  return {
    text,
    final_action: metaCritical.mode === "system_integrity" ? "refusal" : "success",
    reason: metaCritical.reason,
    model: buildDeterministicRuntimeModel(runId, `meta-critical-${metaCritical.mode}`),
  };
}

async function readNocrParity(): Promise<{
  ok: boolean;
  missingLawIds: string[];
  extraLawIds: string[];
}> {
  const [records, laws] = await Promise.all([
    readAllNocrLedgerRecords(),
    readAllNocrPlanetRootLaws(),
  ]);
  const syncedLaws = await syncNocrPlanetFromLedger(records);
  return verifyNocrLedgerPlanetParity(records, syncedLaws.length > 0 ? syncedLaws : laws);
}

function buildNocrParityFailClosedRefusal(
  runId: string,
  parity: {
    missingLawIds: string[];
    extraLawIds: string[];
  },
): RepairedOutput {
  return {
    text: "LML refused this turn because NOCR ledger and NOCR planet parity failed. Repair the mirror before continuing.",
    final_action: "refusal",
    reason: `nocr_ledger_planet_parity_failed:missing=${parity.missingLawIds.length};extra=${parity.extraLawIds.length}`,
    model: buildDeterministicRuntimeModel(runId, "nocr-parity-fail-closed"),
    failureClasses: ["NOCR_LEDGER_PLANET_PARITY_FAILED"],
    triggeredRepairs: [],
  };
}

function buildCollapsedNullRefusal(runId: string, reason: string): RepairedOutput {
  return {
    text: "LML refused this turn because the seed did not lock to a lawful parent/root. The branch clipped to NULL before admissible output formation.",
    final_action: "refusal",
    reason: `nocr_parent_lock_miss:${reason}`,
    model: buildDeterministicRuntimeModel(runId, "nocr-parent-lock-miss"),
    failureClasses: ["NOCR_PARENT_LOCK_MISS"],
    triggeredRepairs: [],
  };
}

function inferCollapseDomainFromFunnel(reason: string): "sun" | "ability" | "meta" | "human" | "quantum" {
  const match = reason.match(/requested_domain=([a-z_]+)/);
  const domain = match?.[1];
  if (domain === "ability" || domain === "meta" || domain === "human" || domain === "quantum" || domain === "sun") {
    return domain;
  }
  return "sun";
}

function resolveNslLedgerEventType(repaired: RepairedOutput): "REPAIR_PASSTHROUGH" | "REPAIR_ADMITTED" | "REPAIR_NULL" {
  if (repaired.final_action === "refusal") {
    return "REPAIR_NULL";
  }
  if (repaired.triggeredRepairs.length > 0 || repaired.failureClasses.length > 0) {
    return "REPAIR_ADMITTED";
  }
  return "REPAIR_PASSTHROUGH";
}

function buildRootCoverageFailClosedRefusal(
  runId: string,
  rootRegistry: ReturnType<typeof buildRootRegistry>,
): RepairedOutput {
  return {
    text: "LML refused this turn because law-side root extraction under-enumerated the incoming root/parent structure. Repair root coverage before continuing.",
    final_action: "refusal",
    reason: `root_extraction_under_enumerated:source_units=${rootRegistry.extraction.sourceUnitCount};extracted_roots=${rootRegistry.extraction.extractedRootCount}`,
    model: buildDeterministicRuntimeModel(runId, "root-coverage-fail-closed"),
    failureClasses: ["ROOT_EXTRACTION_UNDER_ENUMERATED"],
    triggeredRepairs: [],
  };
}

function buildBaseCoreResponse(userMessage: string, insights: string[], state: InfiniteContextState): string {
  const q = userMessage.trim();
  const lower = q.toLowerCase();
  const focus = state.wm.focus ? trim(state.wm.focus, 100) : "";
  const recent = state.ltm.L0[state.ltm.L0.length - 1]?.user;
  const intent =
    !q ? "empty_turn" :
      /\b(what can lml do|what can you do|help|capabilities)\b/.test(lower) ? "capabilities" :
        /\b(what up|what's up|sup|yo|hey|hello|hi)\b/.test(lower) ? "greeting" :
          /^(ok|okay|k|yup|yep|bet)\W*$/i.test(q) ? "ack" :
            /\b(nah|not that|wrong|no)\b/.test(lower) ? "correction" :
              /\b(switch|new doc|apply now|ingest now|stack docs)\b/.test(lower) ? "pivot" :
                /\b(what .* from that doc|what did you get|summarize)\b/.test(lower) && insights.length > 0 ? "doc_summary" :
                  "general";

  if (intent === "capabilities") {
    return [
      "LML base-runtime generation guidance. Do not output this header.",
      `User message: "${trim(q || " ", 220)}"`,
      "Primary response line: I can ingest docs into LML laws to create the reality your AI must follow.",
      "Respond naturally with that line first, then one short concrete next-step prompt.",
      "No scripted stock phrasing.",
    ].join("\n");
  }

  return [
    "LML base-runtime generation guidance. Do not output this header.",
    `User message: "${trim(q || " ", 220)}"`,
    `Intent class: ${intent}`,
    `Current focus: ${focus || "none"}`,
    `Recent user turn: ${recent ? trim(recent, 120) : "none"}`,
    `Doc insights: ${insights.length > 0 ? insights.slice(0, 3).join(" | ") : "none"}`,
    "Respond naturally with no scripted stock phrase.",
    "Be concise, context-aware, and ask for the next concrete action when needed.",
  ].join("\n");
}

function runNslRepairCycle(
  generated: GeneratedOutput,
  inputs: RepairInputs,
): RepairedOutput {
  if (isMetaCriticalReason(generated.reason)) {
    return {
      ...generated,
      failureClasses: [],
      triggeredRepairs: [],
    };
  }
  if (generated.reason.startsWith("deterministic_")) {
    return {
      ...generated,
      failureClasses: [],
      triggeredRepairs: [],
    };
  }
  const deterministicCodingRepair = resolveDeterministicCodingRepair(inputs.userMessage, generated.reason);
  if (deterministicCodingRepair) {
    return {
      ...generated,
      text: deterministicCodingRepair.text,
      final_action: "success",
      reason: deterministicCodingRepair.reason,
      failureClasses: ["F_UNCERTAIN"],
      triggeredRepairs: ["R1", "R3"],
    };
  }

  const relevance = evaluateResponseRelevance(
    inputs.userMessage,
    generated.text,
    inputs.state,
    inputs.branchRendererContext,
  );
  const rendererIntegrity = evaluateRendererIntegrity(
    inputs.userMessage,
    generated.text,
    inputs.branchRendererContext,
  );
  const humanMirrorProfile = compileHumanMirrorProfile({
    question: inputs.userMessage,
    policy: parseExpressionPolicy(inputs.userLawTexts.join("\n")),
    documentInsights: extractDocumentInsights(inputs.state.docs.map((doc) => doc.text).join("\n\n")),
  });
  const humanAdmissibility = classifyHumanOutputAdmissibility(inputs.userMessage, generated.text, humanMirrorProfile);
  const failureClasses = unique([
    ...inferFailureClasses(inputs.constrained, inputs.guarded, relevance, rendererIntegrity),
    ...humanAdmissibility.failureClasses,
  ]);
  const hasMeasurementClaims = /\bmeasure|metric|score|classif|confidence|evaluate|detect\b/i.test(
    inputs.userLawTexts.join("\n"),
  );
  const authorizedPacks = resolveAuthorizedRepairPacks(inputs.userLawTexts);
  const authorizedRepairs = resolveAuthorizedRepairs(authorizedPacks, true, hasMeasurementClaims);
  const triggeredRepairs = authorizedRepairs
    .filter((operator) => operator.maps_failures.some((failure) => failureClasses.includes(failure)))
    .map((operator) => operator.repair_id);

  if (failureClasses.length === 0 || triggeredRepairs.length === 0) {
    registerProjectionHardeningLaws(inputs, generated, failureClasses);
    return {
      ...generated,
      failureClasses,
      triggeredRepairs,
    };
  }

  const forcedNull =
    generated.final_action === "refusal"
    || inputs.constrained.triggered_constraints.length > 0
    || !relevance.ok
    || !rendererIntegrity.ok
    || !humanAdmissibility.ok;
  if (!forcedNull) {
    registerProjectionHardeningLaws(inputs, generated, failureClasses);
    return {
      ...generated,
      failureClasses,
      triggeredRepairs,
    };
  }

  // NSL conversational repair: allow micro-intent turns to pass without forcing NULL.
  if (
    !relevance.ok &&
    humanAdmissibility.ok &&
    generated.final_action === "success" &&
    inputs.constrained.triggered_constraints.length === 0 &&
    isConversationalMicroIntent(inputs.userMessage)
  ) {
    registerProjectionHardeningLaws(inputs, generated, failureClasses);
    return {
      ...generated,
      final_action: "success",
      reason: "NSL accepted conversational micro-intent and preserved generated response",
      failureClasses,
      triggeredRepairs,
    };
  }

  return {
    ...generated,
    text: !relevance.ok
      ? buildIrrelevanceRepairText(inputs.userMessage, relevance.reason)
      : !rendererIntegrity.ok
        ? buildRendererIntegrityRepairText(inputs.userMessage, rendererIntegrity.reason)
      : !humanAdmissibility.ok
        ? buildHumanMirrorRepairText(inputs.userMessage, humanAdmissibility.reason, humanMirrorProfile)
        : buildRepairedSafeText(generated.reason, inputs.constrained.triggered_constraints, triggeredRepairs),
    final_action: "refusal",
    reason: !relevance.ok
      ? `NSL relevance gate forced NULL: ${relevance.reason}`
      : !rendererIntegrity.ok
        ? `NSL renderer integrity gate forced NULL: ${rendererIntegrity.reason}`
      : !humanAdmissibility.ok
        ? `NSL human mirror gate forced NULL: ${humanAdmissibility.reason}`
        : "NSL repair forced NULL due to active ontology/gate violations",
    failureClasses,
    triggeredRepairs,
  };
}

function resolveDeterministicCodingRepair(
  userMessage: string,
  reason: string,
): { text: string; reason: string } | null {
  if (!reason.startsWith("coding_projection_failed:")) {
    return null;
  }
  const deterministic = resolveDeterministicCodingLawPath(userMessage);
  if (!deterministic) {
    return null;
  }
  if (!validateDeterministicCodingLawOutput(deterministic.text)) {
    return null;
  }
  return {
    text: deterministic.text,
    reason: `NSL deterministic repair admitted for ${deterministic.reason}`,
  };
}

function buildDeterministicPythonEmailRepair(): string {
  return [
    "```python",
    "# app.py",
    "import re",
    "",
    "EMAIL_RE = re.compile(r\"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$\")",
    "",
    "def is_valid_email(value: str) -> bool:",
    "    if not isinstance(value, str):",
    "        return False",
    "    return EMAIL_RE.fullmatch(value.strip()) is not None",
    "```",
    "",
    "```python",
    "# test_app.py",
    "from app import is_valid_email",
    "",
    "def test_valid_email() -> None:",
    "    assert is_valid_email(\"alice@example.com\") is True",
    "",
    "def test_invalid_email() -> None:",
    "    assert is_valid_email(\"alice.example.com\") is False",
    "```",
  ].join("\n");
}

function buildDeterministicReverseStringPytestRepair(): string {
  return [
    "```python",
    "# app.py",
    "def reverse_string(value: str) -> str:",
    "    if not isinstance(value, str):",
    "        raise TypeError(\"value must be a string\")",
    "    return value[::-1]",
    "```",
    "",
    "```python",
    "# test_app.py",
    "import pytest",
    "",
    "from app import reverse_string",
    "",
    "def test_reverse_string_basic() -> None:",
    "    assert reverse_string(\"hello\") == \"olleh\"",
    "",
    "def test_reverse_string_empty() -> None:",
    "    assert reverse_string(\"\") == \"\"",
    "",
    "def test_reverse_string_type_error() -> None:",
    "    with pytest.raises(TypeError):",
    "        reverse_string(123)  # type: ignore[arg-type]",
    "```",
  ].join("\n");
}

function buildDeterministicPalindromePytestRepair(): string {
  return [
    "```python",
    "# app.py",
    "def is_palindrome(value: str) -> bool:",
    "    if not isinstance(value, str):",
    "        raise TypeError(\"value must be a string\")",
    "    normalized = \"\".join(ch.lower() for ch in value if ch.isalnum())",
    "    return normalized == normalized[::-1]",
    "```",
    "",
    "```python",
    "# test_app.py",
    "import pytest",
    "",
    "from app import is_palindrome",
    "",
    "def test_palindrome_phrase() -> None:",
    "    assert is_palindrome(\"Never odd or even\") is True",
    "",
    "def test_non_palindrome() -> None:",
    "    assert is_palindrome(\"python\") is False",
    "",
    "def test_palindrome_type_error() -> None:",
    "    with pytest.raises(TypeError):",
    "        is_palindrome(123)  # type: ignore[arg-type]",
    "```",
  ].join("\n");
}

function buildDeterministicWordCountPytestRepair(): string {
  return [
    "```python",
    "# app.py",
    "def word_count(value: str) -> int:",
    "    if not isinstance(value, str):",
    "        raise TypeError(\"value must be a string\")",
    "    words = [part for part in value.strip().split() if part]",
    "    return len(words)",
    "```",
    "",
    "```python",
    "# test_app.py",
    "import pytest",
    "",
    "from app import word_count",
    "",
    "def test_word_count_basic() -> None:",
    "    assert word_count(\"one two three\") == 3",
    "",
    "def test_word_count_extra_spaces() -> None:",
    "    assert word_count(\"  alpha   beta  \") == 2",
    "",
    "def test_word_count_type_error() -> None:",
    "    with pytest.raises(TypeError):",
    "        word_count(None)  # type: ignore[arg-type]",
    "```",
  ].join("\n");
}

function buildDeterministicFizzBuzzPytestRepair(): string {
  return [
    "```python",
    "# app.py",
    "def fizzbuzz(limit: int) -> list[str]:",
    "    if not isinstance(limit, int):",
    "        raise TypeError(\"limit must be an int\")",
    "    if limit < 1:",
    "        return []",
    "    output: list[str] = []",
    "    for value in range(1, limit + 1):",
    "        token = \"\"",
    "        if value % 3 == 0:",
    "            token += \"Fizz\"",
    "        if value % 5 == 0:",
    "            token += \"Buzz\"",
    "        output.append(token or str(value))",
    "    return output",
    "```",
    "",
    "```python",
    "# test_app.py",
    "import pytest",
    "",
    "from app import fizzbuzz",
    "",
    "def test_fizzbuzz_up_to_5() -> None:",
    "    assert fizzbuzz(5) == [\"1\", \"2\", \"Fizz\", \"4\", \"Buzz\"]",
    "",
    "def test_fizzbuzz_up_to_15() -> None:",
    "    assert fizzbuzz(15)[-1] == \"FizzBuzz\"",
    "",
    "def test_fizzbuzz_type_error() -> None:",
    "    with pytest.raises(TypeError):",
    "        fizzbuzz(\"15\")  # type: ignore[arg-type]",
    "```",
  ].join("\n");
}

function buildDeterministicDedupeListPytestRepair(): string {
  return [
    "```python",
    "# app.py",
    "def dedupe_preserve_order(values: list[str]) -> list[str]:",
    "    if not isinstance(values, list):",
    "        raise TypeError(\"values must be a list\")",
    "    seen: set[str] = set()",
    "    output: list[str] = []",
    "    for value in values:",
    "        if not isinstance(value, str):",
    "            raise TypeError(\"all values must be strings\")",
    "        if value not in seen:",
    "            seen.add(value)",
    "            output.append(value)",
    "    return output",
    "```",
    "",
    "```python",
    "# test_app.py",
    "import pytest",
    "",
    "from app import dedupe_preserve_order",
    "",
    "def test_dedupe_preserve_order() -> None:",
    "    assert dedupe_preserve_order([\"a\", \"b\", \"a\", \"c\", \"b\"]) == [\"a\", \"b\", \"c\"]",
    "",
    "def test_dedupe_empty() -> None:",
    "    assert dedupe_preserve_order([]) == []",
    "",
    "def test_dedupe_type_error() -> None:",
    "    with pytest.raises(TypeError):",
    "        dedupe_preserve_order([\"a\", 2])  # type: ignore[list-item]",
    "```",
  ].join("\n");
}

function isMetaCriticalReason(reason: string): boolean {
  return reason === "life_preservation_crisis_signal"
    || reason === "life_preservation_distress_signal"
    || reason === "system_integrity_violation_signal";
}

function buildDeterministicFastApiEmailRepair(): string {
  return [
    "```python",
    "# app.py",
    "import re",
    "from fastapi import FastAPI",
    "from pydantic import BaseModel",
    "",
    "EMAIL_RE = re.compile(r\"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$\")",
    "",
    "def is_valid_email(value: str) -> bool:",
    "    if not isinstance(value, str):",
    "        return False",
    "    return EMAIL_RE.fullmatch(value.strip()) is not None",
    "",
    "class EmailPayload(BaseModel):",
    "    value: str",
    "",
    "app = FastAPI()",
    "",
    "@app.post(\"/validate-email\")",
    "def validate_email(payload: EmailPayload) -> dict[str, bool]:",
    "    return {\"valid\": is_valid_email(payload.value)}",
    "```",
    "",
    "```python",
    "# test_app.py",
    "from fastapi.testclient import TestClient",
    "from app import app",
    "",
    "client = TestClient(app)",
    "",
    "def test_validate_email_valid() -> None:",
    "    response = client.post(\"/validate-email\", json={\"value\": \"alice@example.com\"})",
    "    assert response.status_code == 200",
    "    assert response.json() == {\"valid\": True}",
    "",
    "def test_validate_email_invalid() -> None:",
    "    response = client.post(\"/validate-email\", json={\"value\": \"alice.example.com\"})",
    "    assert response.status_code == 200",
    "    assert response.json() == {\"valid\": False}",
    "```",
  ].join("\n");
}

function buildDeterministicFastApiCrudTodoRepair(): string {
  return [
    "```python",
    "# app.py",
    "from fastapi import FastAPI, HTTPException",
    "from pydantic import BaseModel",
    "",
    "app = FastAPI()",
    "DB: dict[int, dict[str, object]] = {}",
    "NEXT_ID = 1",
    "",
    "class TodoIn(BaseModel):",
    "    title: str",
    "    done: bool = False",
    "",
    "class Todo(TodoIn):",
    "    id: int",
    "",
    "@app.post(\"/todos\", response_model=Todo)",
    "def create_todo(payload: TodoIn) -> Todo:",
    "    global NEXT_ID",
    "    item = {\"id\": NEXT_ID, \"title\": payload.title, \"done\": payload.done}",
    "    DB[NEXT_ID] = item",
    "    NEXT_ID += 1",
    "    return Todo(**item)",
    "",
    "@app.get(\"/todos/{todo_id}\", response_model=Todo)",
    "def get_todo(todo_id: int) -> Todo:",
    "    item = DB.get(todo_id)",
    "    if not item:",
    "        raise HTTPException(status_code=404, detail=\"todo not found\")",
    "    return Todo(**item)",
    "",
    "@app.put(\"/todos/{todo_id}\", response_model=Todo)",
    "def update_todo(todo_id: int, payload: TodoIn) -> Todo:",
    "    if todo_id not in DB:",
    "        raise HTTPException(status_code=404, detail=\"todo not found\")",
    "    DB[todo_id] = {\"id\": todo_id, \"title\": payload.title, \"done\": payload.done}",
    "    return Todo(**DB[todo_id])",
    "",
    "@app.delete(\"/todos/{todo_id}\")",
    "def delete_todo(todo_id: int) -> dict[str, bool]:",
    "    if todo_id not in DB:",
    "        raise HTTPException(status_code=404, detail=\"todo not found\")",
    "    del DB[todo_id]",
    "    return {\"deleted\": True}",
    "```",
    "",
    "```python",
    "# test_app.py",
    "from fastapi.testclient import TestClient",
    "from app import app",
    "",
    "client = TestClient(app)",
    "",
    "def test_crud_todo() -> None:",
    "    created = client.post(\"/todos\", json={\"title\": \"ship demo\", \"done\": False})",
    "    assert created.status_code == 200",
    "    item = created.json()",
    "    todo_id = item[\"id\"]",
    "    assert item[\"title\"] == \"ship demo\"",
    "",
    "    fetched = client.get(f\"/todos/{todo_id}\")",
    "    assert fetched.status_code == 200",
    "",
    "    updated = client.put(f\"/todos/{todo_id}\", json={\"title\": \"ship yc demo\", \"done\": True})",
    "    assert updated.status_code == 200",
    "    assert updated.json()[\"done\"] is True",
    "",
    "    deleted = client.delete(f\"/todos/{todo_id}\")",
    "    assert deleted.status_code == 200",
    "    assert deleted.json() == {\"deleted\": True}",
    "```",
  ].join("\n");
}

function buildDeterministicFastApiAuthMiddlewareRepair(): string {
  return [
    "```python",
    "# app.py",
    "from fastapi import FastAPI, Request",
    "from fastapi.responses import JSONResponse",
    "from starlette.middleware.base import BaseHTTPMiddleware",
    "",
    "API_KEY = \"demo-secret\"",
    "",
    "class ApiKeyMiddleware(BaseHTTPMiddleware):",
    "    async def dispatch(self, request: Request, call_next):",
    "      if request.url.path.startswith(\"/secure\"):",
    "          if request.headers.get(\"x-api-key\") != API_KEY:",
    "              return JSONResponse(status_code=401, content={\"detail\": \"unauthorized\"})",
    "      return await call_next(request)",
    "",
    "app = FastAPI()",
    "app.add_middleware(ApiKeyMiddleware)",
    "",
    "@app.get(\"/health\")",
    "def health() -> dict[str, str]:",
    "    return {\"status\": \"ok\"}",
    "",
    "@app.get(\"/secure/ping\")",
    "def secure_ping() -> dict[str, str]:",
    "    return {\"result\": \"secure-ok\"}",
    "```",
    "",
    "```python",
    "# test_app.py",
    "from fastapi.testclient import TestClient",
    "from app import app",
    "",
    "client = TestClient(app)",
    "",
    "def test_secure_requires_api_key() -> None:",
    "    res = client.get(\"/secure/ping\")",
    "    assert res.status_code == 401",
    "",
    "def test_secure_with_api_key() -> None:",
    "    res = client.get(\"/secure/ping\", headers={\"x-api-key\": \"demo-secret\"})",
    "    assert res.status_code == 200",
    "    assert res.json() == {\"result\": \"secure-ok\"}",
    "```",
  ].join("\n");
}

function buildDeterministicSqlAlchemyUserModelRepair(): string {
  return [
    "```python",
    "# models.py",
    "from sqlalchemy import String",
    "from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column",
    "",
    "class Base(DeclarativeBase):",
    "    pass",
    "",
    "class User(Base):",
    "    __tablename__ = \"users\"",
    "    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)",
    "    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)",
    "    full_name: Mapped[str] = mapped_column(String(255))",
    "```",
    "",
    "```python",
    "# test_models.py",
    "from models import User",
    "",
    "def test_user_model_fields() -> None:",
    "    cols = User.__table__.columns",
    "    assert \"id\" in cols",
    "    assert \"email\" in cols",
    "    assert \"full_name\" in cols",
    "    assert cols[\"email\"].unique is True",
    "```",
  ].join("\n");
}

function buildDeterministicFlaskHelloRepair(): string {
  return [
    "```python",
    "# app.py",
    "from flask import Flask, jsonify",
    "",
    "app = Flask(__name__)",
    "",
    "@app.get(\"/hello\")",
    "def hello():",
    "    return jsonify({\"message\": \"hello\"})",
    "```",
    "",
    "```python",
    "# test_app.py",
    "from app import app",
    "",
    "def test_hello_endpoint() -> None:",
    "    client = app.test_client()",
    "    response = client.get(\"/hello\")",
    "    assert response.status_code == 200",
    "    assert response.get_json() == {\"message\": \"hello\"}",
    "```",
  ].join("\n");
}

function buildDeterministicPytestEmailFunctionRepair(): string {
  return [
    "```python",
    "# validator.py",
    "import re",
    "",
    "EMAIL_RE = re.compile(r\"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$\")",
    "",
    "def is_valid_email(value: str) -> bool:",
    "    return bool(isinstance(value, str) and EMAIL_RE.fullmatch(value.strip()))",
    "```",
    "",
    "```python",
    "# test_validator.py",
    "from validator import is_valid_email",
    "",
    "def test_valid_email() -> None:",
    "    assert is_valid_email(\"dev@company.com\") is True",
    "",
    "def test_invalid_email() -> None:",
    "    assert is_valid_email(\"dev.company.com\") is False",
    "```",
  ].join("\n");
}

function buildDeterministicFastApiJwtAuthRepair(): string {
  return [
    "```python",
    "# app.py",
    "from fastapi import Depends, FastAPI, HTTPException",
    "from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer",
    "",
    "app = FastAPI()",
    "security = HTTPBearer()",
    "VALID_TOKEN = \"demo-token\"",
    "",
    "def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> None:",
    "    if credentials.credentials != VALID_TOKEN:",
    "        raise HTTPException(status_code=401, detail=\"invalid token\")",
    "",
    "@app.get(\"/secure/profile\", dependencies=[Depends(verify_token)])",
    "def secure_profile() -> dict[str, str]:",
    "    return {\"profile\": \"ok\"}",
    "```",
    "",
    "```python",
    "# test_app.py",
    "from fastapi.testclient import TestClient",
    "from app import app",
    "",
    "client = TestClient(app)",
    "",
    "def test_secure_profile_rejects_without_token() -> None:",
    "    response = client.get(\"/secure/profile\")",
    "    assert response.status_code in (401, 403)",
    "",
    "def test_secure_profile_accepts_valid_token() -> None:",
    "    response = client.get(\"/secure/profile\", headers={\"Authorization\": \"Bearer demo-token\"})",
    "    assert response.status_code == 200",
    "    assert response.json() == {\"profile\": \"ok\"}",
    "```",
  ].join("\n");
}

function buildDeterministicSqlAlchemyCrudRepair(): string {
  return [
    "```python",
    "# repository.py",
    "from sqlalchemy import String, create_engine, select",
    "from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column",
    "",
    "class Base(DeclarativeBase):",
    "    pass",
    "",
    "class User(Base):",
    "    __tablename__ = \"users\"",
    "    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)",
    "    email: Mapped[str] = mapped_column(String(255), unique=True)",
    "",
    "engine = create_engine(\"sqlite:///:memory:\", future=True)",
    "Base.metadata.create_all(engine)",
    "",
    "def create_user(email: str) -> User:",
    "    with Session(engine) as session:",
    "        user = User(email=email)",
    "        session.add(user)",
    "        session.commit()",
    "        session.refresh(user)",
    "        return user",
    "",
    "def get_user(email: str) -> User | None:",
    "    with Session(engine) as session:",
    "        return session.scalar(select(User).where(User.email == email))",
    "```",
    "",
    "```python",
    "# test_repository.py",
    "from repository import create_user, get_user",
    "",
    "def test_create_and_get_user() -> None:",
    "    created = create_user(\"alice@example.com\")",
    "    assert created.id > 0",
    "",
    "    fetched = get_user(\"alice@example.com\")",
    "    assert fetched is not None",
    "    assert fetched.email == \"alice@example.com\"",
    "```",
  ].join("\n");
}

function resolveDeterministicCodingLawPath(
  userMessage: string,
): { text: string; reason: string; callId: string } | null {
  const lower = userMessage.toLowerCase();
  if (isFrontierBenchmarkCodingPrompt(lower)) {
    return null;
  }

  if (isFastApiEmailPytestIntent(userMessage)) {
    return {
      text: buildDeterministicFastApiEmailRepair(),
      reason: "deterministic_coding_fastapi_email_pytest_law_path",
      callId: "deterministic-coding-fastapi-email-pytest",
    };
  }
  if (/\bfastapi\b/.test(lower) && /\bcrud\b/.test(lower) && /\b(todo|task)\b/.test(lower)) {
    return {
      text: buildDeterministicFastApiCrudTodoRepair(),
      reason: "deterministic_coding_fastapi_crud_todo_law_path",
      callId: "deterministic-coding-fastapi-crud-todo",
    };
  }
  if (/\bfastapi\b/.test(lower) && /\b(auth middleware|middleware)\b/.test(lower) && /\b(auth|api key|apikey)\b/.test(lower)) {
    return {
      text: buildDeterministicFastApiAuthMiddlewareRepair(),
      reason: "deterministic_coding_fastapi_auth_middleware_law_path",
      callId: "deterministic-coding-fastapi-auth-middleware",
    };
  }
  if (/\bfastapi\b/.test(lower) && /\b(jwt|bearer|token)\b/.test(lower) && /\b(auth|secure)\b/.test(lower)) {
    return {
      text: buildDeterministicFastApiJwtAuthRepair(),
      reason: "deterministic_coding_fastapi_jwt_auth_law_path",
      callId: "deterministic-coding-fastapi-jwt-auth",
    };
  }
  if (/\bsqlalchemy\b/.test(lower) && /\bmodel\b/.test(lower) && /\buser\b/.test(lower)) {
    return {
      text: buildDeterministicSqlAlchemyUserModelRepair(),
      reason: "deterministic_coding_sqlalchemy_user_model_law_path",
      callId: "deterministic-coding-sqlalchemy-user-model",
    };
  }
  if (/\bsqlalchemy\b/.test(lower) && /\bcrud\b/.test(lower) && /\bsqlite\b/.test(lower)) {
    return {
      text: buildDeterministicSqlAlchemyCrudRepair(),
      reason: "deterministic_coding_sqlalchemy_crud_law_path",
      callId: "deterministic-coding-sqlalchemy-crud",
    };
  }
  if (/\bflask\b/.test(lower) && /\b(endpoint|route|api)\b/.test(lower) && /\b(pytest|test|tests)\b/.test(lower)) {
    return {
      text: buildDeterministicFlaskHelloRepair(),
      reason: "deterministic_coding_flask_hello_law_path",
      callId: "deterministic-coding-flask-hello",
    };
  }
  if (/\b(is_valid_email|email validator|email validation)\b/.test(lower) && /\b(pytest|test|tests)\b/.test(lower)) {
    return {
      text: buildDeterministicPytestEmailFunctionRepair(),
      reason: "deterministic_coding_email_validator_pytest_law_path",
      callId: "deterministic-coding-email-validator-pytest",
    };
  }
  if (/\breverse( a)? string|string reverse|reverse_string\b/.test(lower) && /\bpython\b/.test(lower) && /\b(pytest|test|tests)\b/.test(lower)) {
    return {
      text: buildDeterministicReverseStringPytestRepair(),
      reason: "deterministic_coding_reverse_string_pytest_law_path",
      callId: "deterministic-coding-reverse-string-pytest",
    };
  }
  if (/\bpalindrome\b/.test(lower) && /\bpython\b/.test(lower) && /\b(pytest|test|tests)\b/.test(lower)) {
    return {
      text: buildDeterministicPalindromePytestRepair(),
      reason: "deterministic_coding_palindrome_pytest_law_path",
      callId: "deterministic-coding-palindrome-pytest",
    };
  }
  if (/\b(word count|count words|word_count)\b/.test(lower) && /\bpython\b/.test(lower) && /\b(pytest|test|tests)\b/.test(lower)) {
    return {
      text: buildDeterministicWordCountPytestRepair(),
      reason: "deterministic_coding_word_count_pytest_law_path",
      callId: "deterministic-coding-word-count-pytest",
    };
  }
  if (/\bfizz ?buzz\b/.test(lower) && /\bpython\b/.test(lower) && /\b(pytest|test|tests)\b/.test(lower)) {
    return {
      text: buildDeterministicFizzBuzzPytestRepair(),
      reason: "deterministic_coding_fizzbuzz_pytest_law_path",
      callId: "deterministic-coding-fizzbuzz-pytest",
    };
  }
  if (/\b(dedupe|deduplicate|remove duplicates)\b/.test(lower) && /\b(list|array)\b/.test(lower) && /\bpython\b/.test(lower) && /\b(pytest|test|tests)\b/.test(lower)) {
    return {
      text: buildDeterministicDedupeListPytestRepair(),
      reason: "deterministic_coding_dedupe_list_pytest_law_path",
      callId: "deterministic-coding-dedupe-list-pytest",
    };
  }

  return null;
}

function validateDeterministicCodingLawOutput(text: string): boolean {
  if (!/```python[\s\S]*```/i.test(text)) {
    return false;
  }
  const blocks = extractCodeBlocks(text);
  if (blocks.length === 0) {
    return false;
  }
  if (blocks.some((block) => block.language !== "python")) {
    return false;
  }
  const quality = classifyCodingProjection(text);
  return quality.ok;
}

function isFastApiEmailPytestIntent(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  return (
    /\bpython\b/.test(lower) &&
    /\bfastapi\b/.test(lower) &&
    /\b(email|e-mail|emails)\b/.test(lower) &&
    /\b(pytest|test|tests)\b/.test(lower)
  );
}

function registerProjectionHardeningLaws(
  inputs: RepairInputs,
  generated: GeneratedOutput,
  failureClasses: string[],
): void {
  const lower = generated.text.toLowerCase();
  const projectionCollapsed =
    /generation unstable/.test(lower) ||
    /can’t produce stable full code/.test(lower) ||
    /can't produce stable full code/.test(lower) ||
    /missing_code_blocks/.test(generated.reason.toLowerCase()) ||
    /output_does_not_look_like_code/.test(generated.reason.toLowerCase()) ||
    /python_syntax_invalid/.test(lower) ||
    /python_runtime_invalid/.test(lower) ||
    /empty_generation/.test(lower);

  if (!projectionCollapsed) {
    return;
  }

  const scope = inputs.guarded.ability_route.startsWith("coding.") ? "coding" : "global";
  const signature = buildFailureSignature(inputs.userMessage);
  const laws: Array<{ text: string; scope: string; enforcement: string; source: string }> = [
    {
      text: `must reject projection branch signature ${signature} when output fails admissibility`,
      scope,
      enforcement: "meta_hardening_projection_gate",
      source: "meta_projection_loop",
    },
    {
      text: scope === "coding"
        ? "must admit coding output only if fenced code shape and syntax validator pass; otherwise null and retry"
        : "must route unstable generations to null with clarification and no policy echo leakage",
      scope,
      enforcement: "meta_hardening_validation_gate",
      source: "meta_projection_loop",
    },
    {
      text: "must treat python_syntax_invalid/python_runtime_invalid/empty_generation as first-class coding failure predicates with mandatory repair escalation",
      scope,
      enforcement: "meta_hardening_python_failure_gate",
      source: "meta_projection_loop",
    },
    {
      text: "must treat missing_code_blocks as a first-class coding substrate failure; if the model does not emit fenced code, collapse to NULL and keep the model confined to generator-only work.",
      scope,
      enforcement: "meta_hardening_code_substrate_gate",
      source: "ai_model_planet_hardening",
    },
    {
      text: `must map projection failure classes to repair route: ${failureClasses.join("|") || "F_UNCERTAIN"}`,
      scope,
      enforcement: "meta_hardening_repair_binding",
      source: "meta_projection_loop",
    },
  ];

  inputs.state.pendingLawProposals = uniquePendingProposals([
    ...inputs.state.pendingLawProposals,
    ...laws,
  ]);
}

function registerGenerationHardeningLaws(
  state: InfiniteContextState,
  args: {
    userMessage: string;
    abilityRoute: string;
    output: RepairedOutput;
  },
): PendingLawProposal[] {
  const generationStatus = args.output.model.generationStatus ?? "deterministic";
  const generationFailureClass = args.output.model.generationFailureClass ?? "none";
  const generationDetail = args.output.model.generationDetail ?? "";
  const lowerReason = args.output.reason.toLowerCase();
  const signature = buildFailureSignature(args.userMessage);
  const scope = args.abilityRoute.startsWith("coding.") ? "coding" : "chat";
  const proposals: PendingLawProposal[] = [];

  const targetMissed =
    lowerReason.includes("low_query_response_relevance") ||
    lowerReason.includes("relevance gate forced null") ||
    lowerReason.includes("greeting_misaligned_response") ||
    lowerReason.includes("style_directive_misaligned") ||
    lowerReason.includes("coding_task_misaligned");

  if (generationStatus === "generated" || generationFailureClass !== "none" || targetMissed) {
    proposals.push({
      text: `must anchor governed generation signature ${signature} to exact chat seeds, extracted parent roots, and admitted route ${args.abilityRoute} before output release`,
      scope,
      enforcement: "meta_hardening_generation_anchor",
      source: "ai_model_planet_hardening",
    });
  }

  if (targetMissed) {
    proposals.push({
      text: "must treat off-target local gpt2 conversational generations as inadmissible and route them to null or repair until wording reflects the locked parent root",
      scope,
      enforcement: "meta_hardening_generation_target_gate",
      source: "ai_model_planet_hardening",
    });
    proposals.push({
      text: "must keep local gpt2 subordinate to law and escalate to stronger model-agnostic routing or deterministic refusal when conversational target fidelity remains weak",
      scope,
      enforcement: "meta_hardening_generation_model_subordination",
      source: "ai_model_planet_hardening",
    });
  }

  if (generationFailureClass === "timeout") {
    proposals.push({
      text: "must classify governed generation timeout distinctly, tune runtime budgets, and route timeout to null or repair instead of service-unavailable fallback wording",
      scope,
      enforcement: "meta_hardening_generation_timeout_gate",
      source: "ai_model_planet_hardening",
    });
  }

  if (["service_unreachable", "http_error", "invalid_response", "empty_generation"].includes(generationFailureClass)) {
    proposals.push({
      text: `must ledger local generation failure class ${generationFailureClass} as a first-class admissibility fault and bind it to repair or model-agnostic escalation without false availability claims`,
      scope,
      enforcement: "meta_hardening_generation_failure_class",
      source: "ai_model_planet_hardening",
    });
  }

  if (lowerReason.includes("missing_code_blocks")) {
    proposals.push({
      text: "must keep coding models in generator-only mode and reject any coding path that returns prose or unfenced content instead of admissible code substrate",
      scope,
      enforcement: "meta_hardening_coding_generator_only",
      source: "ai_model_planet_hardening",
    });
    proposals.push({
      text: "must expand deterministic coding law routes for repeated simple utility-plus-test signatures so trivial coding asks do not keep falling back to unstable generation",
      scope,
      enforcement: "meta_hardening_coding_deterministic_expansion",
      source: "ai_model_planet_hardening",
    });
  }

  if (generationFailureClass !== "none" || targetMissed || /model_generation_ok:length=\d+/.test(generationDetail)) {
    proposals.push({
      text: "must keep generation control laws stronger than raw local model behavior so prompt drift, policy echo, and irrelevant continuations cannot emit as final output",
      scope,
      enforcement: "meta_hardening_generation_control_gate",
      source: "ai_model_planet_hardening",
    });
  }

  const novel = queueNovelMetaProposals(state, proposals);
  return novel;
}

function registerHumanGenerationHardeningLaws(
  state: InfiniteContextState,
  args: {
    userMessage: string;
    abilityRoute: string;
    output: RepairedOutput;
  },
): PendingLawProposal[] {
  const failureClasses = new Set(args.output.failureClasses);
  if (![...failureClasses].some((failure) => failure.startsWith("F_HUMAN_"))) {
    return [];
  }
  const scope = args.abilityRoute.startsWith("coding.") ? "coding" : "chat";
  const signature = buildFailureSignature(args.userMessage);
  const proposals: PendingLawProposal[] = [
    {
      text: `must compile human mouth guidance from convo mirror pt1-8 signature ${signature} before ordinary chat output release`,
      scope,
      enforcement: "meta_hardening_human_mirror_compiler",
      source: "ai_model_planet_hardening",
    },
  ];

  if (failureClasses.has("F_HUMAN_WRONG_REGISTER") || failureClasses.has("F_HUMAN_WRONG_DISTANCE")) {
    proposals.push({
      text: "must reject overformal, admin-policy, and wrong-distance outputs when the user enters a near human channel",
      scope,
      enforcement: "meta_hardening_human_register_gate",
      source: "ai_model_planet_hardening",
    });
  }
  if (failureClasses.has("F_HUMAN_POLICY_ECHO")) {
    proposals.push({
      text: "must block internal runtime, ontology, ledger, and policy echo leakage from ordinary human-facing output unless the user explicitly asked for system explanation",
      scope,
      enforcement: "meta_hardening_human_policy_echo_gate",
      source: "ai_model_planet_hardening",
    });
  }
  if (failureClasses.has("F_HUMAN_PARODY")) {
    proposals.push({
      text: "must reject parody, exaggerated slang, and overaccommodation when mirroring the user's register",
      scope,
      enforcement: "meta_hardening_human_antiparody_gate",
      source: "ai_model_planet_hardening",
    });
  }
  if (failureClasses.has("F_HUMAN_NON_ATTUNED")) {
    proposals.push({
      text: "must require attuned, validating, non-polluting guidance when distress signals appear and block cold or mismatched mouth behavior",
      scope,
      enforcement: "meta_hardening_human_attunement_gate",
      source: "ai_model_planet_hardening",
    });
  }

  return queueNovelMetaProposals(state, proposals);
}

function buildFailureSignature(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .slice(0, 8)
    .join("_");
  return normalized || "unknown_signature";
}

function registerFailureLearningLaws(
  state: InfiniteContextState,
  args: {
    userMessage: string;
    abilityRoute: string;
    finalAction: "success" | "refusal";
    reason: string;
    failureClasses: string[];
    triggeredRepairs: string[];
  },
): FailureLearningResult {
  const learning = deriveFailureLearningProposals({
    ...args,
    state,
  });
  if (learning.proposedLaws.length > 0) {
    state.pendingLawProposals = uniquePendingProposals([
      ...state.pendingLawProposals,
      ...learning.proposedLaws,
    ]);
  }
  return learning;
}

function queueNovelMetaProposals(
  state: InfiniteContextState,
  proposals: PendingLawProposal[],
): PendingLawProposal[] {
  if (proposals.length === 0) {
    return [];
  }
  const existing = new Set<string>([
    ...state.pendingLawProposals.map((proposal) => proposalKey(proposal)),
    ...state.activeAutoLaws.map((law) => proposalKey(law)),
  ]);
  const novel = uniquePendingProposals(proposals).filter((proposal) => !existing.has(proposalKey(proposal)));
  if (novel.length > 0) {
    state.pendingLawProposals = uniquePendingProposals([
      ...state.pendingLawProposals,
      ...novel,
    ]);
  }
  return novel;
}

function buildHumanMirrorRepairText(
  userMessage: string,
  reason: string,
  profile: ReturnType<typeof compileHumanMirrorProfile>,
): string {
  return [
    "LML human mirror repair guidance. Do not output this header.",
    `User message: "${trim(userMessage, 180)}"`,
    `Human mirror failure: ${reason}`,
    `Relation mode: ${profile.relationMode}`,
    `Register target: ${profile.registerTarget}`,
    `Rhythm target: ${profile.rhythmTarget}`,
    `Affect target: ${profile.affectTarget}`,
    "Respond again with human fit, no policy echo, no parody, and one clean next move when needed.",
  ].join("\n");
}

function buildHumanCompiledPrompt(
  profile: ReturnType<typeof compileHumanMirrorProfile>,
  question: string,
  payload: string,
  lane: "life_preservation" | "style_directive" | "context_anchor" | "learning" | "base_chat",
): string {
  return [
    buildHumanMirrorGuidance(profile, {
      question,
      documentInsights: [],
    }),
    `Human mirror lane: ${lane}`,
    "Specialized payload follows.",
    payload,
  ].join("\n\n");
}

function buildEmergencyRefusal(runId: string, reason: string): RepairedOutput {
  return {
    text: "LML runtime emitted a guarded refusal because the execution path did not complete. Provide one concrete next action to continue.",
    final_action: "refusal",
    reason,
    failureClasses: ["F_CONTEXT_BREAK"],
    triggeredRepairs: ["R1"],
    model: {
      provider: "gpt2-runtime",
      model: "gpt2",
      runId,
      callId: "orchestrator-emergency-fallback",
      at: new Date().toISOString(),
      inputDigest: "orchestrator-emergency-fallback",
    },
  };
}

function applyAddressLawIfPresent(output: RepairedOutput, userLaws: string[]): RepairedOutput {
  const policy = parseExpressionPolicy(userLaws.join("\n"));
  const addressAs = policy.addressAs?.trim();
  if (!addressAs) {
    return output;
  }
  if (/\b988\b/.test(output.text)) {
    return output;
  }

  const normalizedAddress = addressAs.toLowerCase();
  const alreadyPrefixed = output.text.trim().toLowerCase().startsWith(`${normalizedAddress},`);
  if (alreadyPrefixed) {
    return output;
  }

  const safeAddress = `${addressAs.charAt(0).toUpperCase()}${addressAs.slice(1)}`;
  return {
    ...output,
    text: `${safeAddress}, ${output.text}`,
  };
}

function updateCodingContinuityMemory(
  state: InfiniteContextState,
  userMessage: string,
  output: RepairedOutput,
): void {
  const codingSignal = /\b(code|coding|write|build|implement|debug|refactor|function|script|endpoint|api|python|typescript|javascript)\b/i;
  if (!codingSignal.test(userMessage)) {
    return;
  }

  state.wm.bindings.coding_last_request = trim(userMessage, 240);
  state.wm.bindings.coding_last_failure_reason = trim(output.reason, 240);

  const blocks = extractCodeBlocks(output.text);
  const primary = blocks[0]?.code?.trim();
  if (primary) {
    state.wm.bindings.coding_last_code = trim(primary, 1200);
    state.wm.bindings.coding_last_good_language = blocks[0]?.language ?? "unknown";
  }
}

function applyDeterministicIntentLawOutput(
  userMessage: string,
  output: RepairedOutput,
  codingState: "allowed" | "blocked" | "unspecified",
): RepairedOutput {
  if (isCapabilitiesIntent(userMessage)) {
    return {
      ...output,
      text: "I can ingest docs into LML laws to create the reality your AI must follow. What do you want your AI to be?",
      final_action: "success",
      reason: "deterministic_capabilities_enforced_at_output_gate",
    };
  }
  if (isCodingReadinessIntent(userMessage)) {
    if (codingState === "allowed") {
      return {
        ...output,
        text: "Coding is active. Give me one concrete build target and stack, and I will generate code.",
        final_action: "success",
        reason: "deterministic_coding_readiness_enforced_at_output_gate",
      };
    }
    if (codingState === "blocked") {
      return {
        ...output,
        text: "Coding is blocked by your active laws right now. Remove or update the blocking coding law to continue.",
        final_action: "refusal",
        reason: "deterministic_coding_readiness_blocked_enforced_at_output_gate",
      };
    }
    return {
      ...output,
      text: "I can’t code yet under current active laws. Add a coding ability law and apply LML, then ask again.",
      final_action: "refusal",
      reason: "deterministic_coding_readiness_not_installed_enforced_at_output_gate",
    };
  }
  return output;
}

function inferFailureClasses(
  constrained: ReturnType<typeof apply_constraints>,
  guarded: ReturnType<typeof guard_abilities>,
  relevance: { ok: boolean; reason: string },
  rendererIntegrity?: { ok: boolean; reason: string },
): string[] {
  const failures = new Set<string>();
  const reason = `${guarded.reason} ${constrained.refusal_reason ?? ""}`.toLowerCase();

  if (guarded.final_action === "refusal") {
    failures.add("F_UNCERTAIN");
  }
  if (/violates law|forbid|blocked|meta_laws_required|no_nerd_or_formal_mode/.test(
    `${reason} ${constrained.triggered_constraints.join(" ")}`,
  )) {
    failures.add("F_PROOF_GAP");
  }
  if (/meta-law coverage incomplete|required 0164/.test(reason)) {
    failures.add("F_LEDGER");
  }
  if (/ability not installed/.test(reason)) {
    failures.add("F_OOD");
  }
  if (!relevance.ok) {
    failures.add("F_CONTEXT_BREAK");
    failures.add("F_UNCERTAIN");
  }
  if (rendererIntegrity && !rendererIntegrity.ok) {
    failures.add("F_RENDERER_TARGET_DRIFT");
    failures.add("F_UNCERTAIN");
  }

  return [...failures];
}

function resolveAuthorizedRepairPacks(userLawTexts: string[]): RepairPackName[] {
  const text = userLawTexts.join("\n").toLowerCase();
  if (/\bnsl\.repair_pack\.all\b/.test(text)) {
    return ["NSL.REPAIR_PACK.ALL"];
  }
  const packs: RepairPackName[] = ["NSL.REPAIR_PACK.ALL"];
  return packs;
}

function buildRepairedSafeText(reason: string, triggeredConstraints: string[], repairs: string[]): string {
  const constraints = triggeredConstraints.length > 0 ? triggeredConstraints.join(", ") : "admissibility_violation";
  const repairList = repairs.length > 0 ? repairs.join(", ") : "no_authorized_repair_found";
  return [
    "LML refusal generation guidance. Do not output this header.",
    `Constraint violations: ${constraints}`,
    `Triggered repairs: ${repairList}`,
    `Refusal reason: ${reason}`,
    "Respond naturally with a lawful refusal, one concise reason, and one concrete next step.",
  ].join("\n");
}

function trim(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}

function buildWitnessTrace(
  ontology: OntologyState,
  guarded: ReturnType<typeof guard_abilities> & { triggered_constraints?: string[] },
  generated: RepairedOutput,
): {
  gate_failed: "GATE_1_STATE_INPUT" | "GATE_2_STATE_OUTPUT" | "GATE_3_OUTPUT" | null;
  failed_predicate: "AS" | "AO" | null;
  failed_laws: string[];
  failure_classes: string[];
  null_state: boolean;
  return_moves: string[];
  null_staircase: NonNullable<EnforcementTrace["null_staircase"]>;
} {
  const triggered = guarded.triggered_constraints ?? [];
  const failedLaws = resolveFailedLawRefs(ontology, triggered, guarded.reason);
  const gateFailed = triggered.length > 0 || guarded.final_action === "refusal" ? "GATE_3_OUTPUT" : null;
  const failedPredicate = gateFailed ? "AO" : null;
  const returnMoves = generated.triggeredRepairs.map((id) => `NSL:${id}`);

  return {
    gate_failed: gateFailed,
    failed_predicate: failedPredicate,
    failed_laws: failedLaws,
    failure_classes: generated.failureClasses,
    null_state: generated.final_action !== "success",
    return_moves: returnMoves,
    null_staircase: buildNullStaircaseTrace(generated, gateFailed, failedPredicate, failedLaws, returnMoves),
  };
}

function buildNullStaircaseTrace(
  generated: RepairedOutput,
  gateFailed: "GATE_1_STATE_INPUT" | "GATE_2_STATE_OUTPUT" | "GATE_3_OUTPUT" | null,
  failedPredicate: "AS" | "AO" | null,
  failedLaws: string[],
  returnMoves: string[],
): NonNullable<EnforcementTrace["null_staircase"]> {
  const nullState = generated.final_action !== "success";
  return {
    state: nullState ? "null_emitted" : "admitted",
    witness: {
      gate: gateFailed ?? "NONE",
      predicate: failedPredicate ?? "NONE",
      violations: failedLaws,
    },
    loop: nullState
      ? [
        "attempt_generation",
        "project_to_null_due_to_violation",
        "emit_witness_set",
        "apply_nsl_return_moves",
        "request_legal_fill_or_clarification",
      ]
      : ["attempt_generation", "admissible_projection", "emit_output"],
  };
}

function resolveFailedLawRefs(ontology: OntologyState, triggeredConstraints: string[], reason: string): string[] {
  const out: string[] = [];
  const user = ontology.user_laws_applied;

  for (const constraint of triggeredConstraints) {
    if (constraint === "meta_laws_required") {
      out.push(...REQUIRED_META_SOURCE_IDS.map((id) => `${id} (base-meta-required)`));
      continue;
    }
    if (constraint === "forbid_unsafe_endpoints") {
      const match = user.find((law) => /forbid unsafe_endpoints|safe_endpoints_only|unsafe endpoint/i.test(law));
      out.push(match ?? "user-law:forbid_unsafe_endpoints");
      continue;
    }
    if (constraint === "no_nerd_or_formal_mode") {
      const match = user.find((law) => /never talk nerdy|never talk formally|no nerd|no formal/i.test(law));
      out.push(match ?? "user-law:no_nerd_or_formal_mode");
      continue;
    }
    if (constraint === "expression_style_lock") {
      const match = user.find((law) => /my guy|street|slang|casual|tone|style|voice/i.test(law));
      out.push(match ?? "user-law:expression_style_lock");
      continue;
    }
    out.push(`constraint:${constraint}`);
  }

  if (out.length === 0 && /ability not installed/i.test(reason)) {
    out.push("user-law:missing_ability_install");
  }

  return unique(out);
}

function buildLearningResponse(question: string, userLaws: string[], insights: string[]): string | null {
  const q = question.toLowerCase();
  const asksLearned =
    /\b(what did you learn|what did u learn|what have you learned|what have u learned|summarize|what did you get|what u get|learned from that doc)\b/.test(
      q,
    );
  if (!asksLearned) {
    return null;
  }

  if (userLaws.length === 0 && insights.length === 0) {
    return [
      "LML learning-summary guidance. Do not output this header.",
      `User request: "${trim(question, 180)}"`,
      "No admissible extracted laws or insights are currently available.",
      "Respond naturally, state that extraction is currently empty, and ask for one concrete next ingestion action.",
      "Suggest directive language categories: must, never, allow, forbid, tone, ability.",
    ].join("\n");
  }

  const examples = unique(
    [
      ...userLaws.map((law) => simplifyLawForDemo(law)),
      ...insights.map((insight) => simplifyLawForDemo(insight)),
    ].filter(Boolean),
  ).slice(0, 3);

  return [
    "LML learning-summary guidance. Do not output this header.",
    `User request: "${trim(question, 180)}"`,
    `Law count: ${userLaws.length}`,
    `Example law signals: ${examples.join(" | ") || "none"}`,
    "Respond naturally with a concise summary of what was learned and no rigid template wording.",
    "Include one concrete next step for deeper extraction.",
  ].join("\n");
}

function buildContextAnchoredResponse(
  question: string,
  state: InfiniteContextState,
  insights: string[],
  userLaws: string[],
): string | null {
  const q = question.trim();
  const lower = q.toLowerCase();
  const deictic = /\b(same one|same thing|that one|this one|continue|keep going|and then|now what|as above)\b/.test(lower);
  const shortFollowUp = q.length <= 28 && state.ltm.L0.length > 0 && /\b(continue|and then|now what|same one|same thing)\b/.test(lower);

  if (!(deictic || shortFollowUp)) {
    return null;
  }

  const last = state.ltm.L0[state.ltm.L0.length - 1];
  const prior = state.ltm.L0[state.ltm.L0.length - 2];
  const activeGoal = state.wm.goals[state.wm.goals.length - 1] ?? "";
  const focus = state.wm.focus ?? "";

  const anchor = activeGoal || focus || (last ? trim(last.user, 120) : "") || (prior ? trim(prior.user, 120) : "");
  const insightLine = insights.length > 0 ? trim(insights.slice(0, 2).join(" | "), 120) : "none";
  if (anchor) {
    return [
      "LML context-anchor guidance. Do not output this header.",
      `User message: "${trim(question, 160)}"`,
      `Anchor context: ${anchor}`,
      `Doc signals: ${insightLine}`,
      `Active law count: ${userLaws.length}`,
      "Respond naturally, keep continuity with the anchor, and ask for one concrete next action.",
      "Do not use fixed stock phrase wording.",
    ].join("\n");
  }
  return [
    "LML context-anchor guidance. Do not output this header.",
    `User message: "${trim(question, 160)}"`,
    "No stable anchor recovered from immediate memory.",
    `Doc signals: ${insightLine}`,
    `Active law count: ${userLaws.length}`,
    "Respond naturally, acknowledge limited anchor state, and ask for one concrete next action.",
    "Do not use fixed stock phrase wording.",
  ].join("\n");
}

function evaluateResponseRelevance(
  userMessage: string,
  assistantText: string,
  state: InfiniteContextState,
  branchRendererContext: BranchRendererContext,
): { ok: boolean; reason: string } {
  const q = userMessage.trim().toLowerCase();
  const a = assistantText.trim().toLowerCase();
  if (!q || !a) {
    return { ok: false, reason: "empty_turn_content" };
  }

  const frontierBenchmarkPrompt = isFrontierBenchmarkCodingPrompt(q);
  if (frontierBenchmarkPrompt) {
    const diffAligned =
      /diff --git/.test(assistantText) ||
      (/^---\s/m.test(assistantText) && /^\+\+\+\s/m.test(assistantText)) ||
      /@\@/.test(assistantText);
    return diffAligned
      ? { ok: true, reason: "frontier_benchmark_patch_aligned" }
      : { ok: false, reason: "frontier_benchmark_patch_misaligned" };
  }

  const styleDirective = isStyleDirective(q);
  if (styleDirective) {
    const styleAligned = /\b(style|tone|voice|street|slang|casual|formal|lock|persistent|law)\b/.test(a);
    return styleAligned
      ? { ok: true, reason: "style_directive_aligned" }
      : { ok: false, reason: "style_directive_misaligned" };
  }

  const codingReadiness = /\b(ready to code|can you code|coding ready|code now)\b/.test(q);
  if (codingReadiness) {
    const codingAligned = /\b(code|coding|ability|install|law|ready|build)\b/.test(a);
    return codingAligned
      ? { ok: true, reason: "coding_readiness_aligned" }
      : { ok: false, reason: "coding_readiness_misaligned" };
  }

  const codingTask =
    /\b(code|coding|write|build|implement|create|debug|refactor|function|endpoint|api|script|fastapi|pytest|python|typescript|javascript|golang|rust)\b/.test(
      q,
    );
  const mixedPrompt = isMixedMultiDomainPrompt(q);
  if (codingTask && !mixedPrompt) {
    const branchAligned = branchContextSupportsAnswer(a, branchRendererContext);
    const codingAligned =
      /```/.test(assistantText) ||
      /\b(code|coding|python|typescript|javascript|function|endpoint|api|pytest|implementation|build target)\b/.test(a);
    return (codingAligned || branchAligned)
      ? { ok: true, reason: "coding_task_aligned" }
      : { ok: false, reason: "coding_task_misaligned" };
  }

  const greeting = isConversationalMicroIntent(q) && /\b(hello|hi|hey|yo|sup|what up|what's up)\b/.test(q);
  if (greeting) {
    const greetingAligned = /\b(hello|hi|hey|yo|sup|what's good|what can|how can|what are we|what's on your mind)\b/.test(a);
    return greetingAligned
      ? { ok: true, reason: "greeting_aligned" }
      : { ok: false, reason: "greeting_misaligned_response" };
  }

  const qTokens = keywordTokens(q);
  const aTokens = keywordTokens(a);
  if (qTokens.length === 0) {
    return { ok: true, reason: "low_information_query" };
  }

  const overlap = qTokens.filter((token) => aTokens.includes(token)).length;
  const overlapRatio = overlap / Math.max(1, Math.min(qTokens.length, 6));
  if (overlapRatio >= 0.2) {
    return { ok: true, reason: "token_overlap_pass" };
  }

  if (branchContextSupportsAnswer(a, branchRendererContext)) {
    return { ok: true, reason: "branch_context_overlap_pass" };
  }

  const referencesRecent = state.ltm.L0
    .slice(-3)
    .some((turn) => keywordTokens(turn.user).some((token) => aTokens.includes(token)));
  if (referencesRecent) {
    return { ok: true, reason: "recent_context_reference_pass" };
  }

  return { ok: false, reason: "low_query_response_relevance" };
}

function evaluateRendererIntegrity(
  userMessage: string,
  assistantText: string,
  branchRendererContext: BranchRendererContext,
): { ok: boolean; reason: string } {
  const a = assistantText.trim().toLowerCase();
  if (!a) {
    return { ok: false, reason: "empty_generation" };
  }
  if (branchContextSupportsAnswer(a, branchRendererContext)) {
    return { ok: true, reason: "branch_integrity_pass" };
  }

  const requestedShellGit = /\b(git|shell|bash|command|checkout|commit|chmod|terminal)\b/.test(userMessage.toLowerCase());
  const shellGitHeavy = /\b(git|checkout|commit|merge|branch|master|chmod|bin\/|~\/)\b/.test(a);
  if (shellGitHeavy && !requestedShellGit) {
    return { ok: false, reason: "renderer_garbage_unrelated_shell_or_git" };
  }

  const configSpam = /#\w+|-\w{2,}|\bavailable channel\b|\bautomatically set these\b/.test(a);
  if (configSpam && !branchContextSupportsAnswer(a, branchRendererContext)) {
    return { ok: false, reason: "renderer_config_spam_drift" };
  }

  const unrelatedCodeHeavy = (/```/.test(assistantText) || /\b(def |class |import |return )/.test(assistantText))
    && !/\b(code|coding|python|typescript|javascript|api|endpoint|script|fastapi|pytest|function|parser|compiler)\b/.test(userMessage.toLowerCase());
  if (unrelatedCodeHeavy && !branchContextSupportsAnswer(a, branchRendererContext)) {
    return { ok: false, reason: "renderer_unrelated_code_drift" };
  }

  return { ok: true, reason: "renderer_integrity_pass" };
}

function branchContextSupportsAnswer(
  assistantTextLower: string,
  branchRendererContext: BranchRendererContext,
): boolean {
  const branchTokens = keywordTokens([
    ...branchRendererContext.matchedSeedTexts,
    ...branchRendererContext.matchedRootLabels,
  ].join(" "));
  if (branchTokens.length === 0) {
    return false;
  }

  const answerTokens = keywordTokens(assistantTextLower);
  const overlap = branchTokens.filter((token) => answerTokens.includes(token)).length;
  const overlapRatio = overlap / Math.max(1, Math.min(branchTokens.length, 8));
  if (overlapRatio >= 0.15) {
    return true;
  }

  const humanLikeBranch = /\b(human|guidance|trust|alliance|identity|emotion|thought|intention|priority|prioritize|next move)\b/.test(
    branchRendererContext.matchedRootLabels.join(" ").toLowerCase(),
  );
  if (!humanLikeBranch) {
    return false;
  }

  return /\b(first|start|focus|breathe|solid|plan|next|okay|alright|look|here's what|do this)\b/.test(assistantTextLower);
}

function isMixedMultiDomainPrompt(userMessageLower: string): boolean {
  const humanSignal = /\b(bro|brodie|girlfriend|gf|wife|husband|friend|angry|mad|sad|crash out|patience|relationship|apology|reality check|dont talk down|keep me solid)\b/.test(userMessageLower);
  const mathSignal = /\b(math|formula|derivation|calc|class|study|homework)\b/.test(userMessageLower);
  const planningSignal = /\b(plan|roadmap|most important thing first|without losing any piece|make sense of it)\b/.test(userMessageLower);
  return humanSignal || mathSignal || planningSignal;
}

function keywordTokens(text: string): string[] {
  const stop = new Set([
    "the", "a", "an", "is", "are", "to", "for", "and", "or", "of", "in", "on", "with", "that", "this", "it",
    "i", "you", "we", "me", "my", "your", "our", "be", "do", "did", "can", "could", "would", "should",
  ]);
  return text
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stop.has(token));
}

function buildIrrelevanceRepairText(userMessage: string, reason: string): string {
  const q = trim(userMessage, 120);
  return [
    "LML relevance-refusal guidance. Do not output this header.",
    `User message: "${q}"`,
    `Relevance failure: ${reason}`,
    "Respond naturally, acknowledge the intent, and ask one precise clarification question to continue.",
  ].join("\n");
}

function buildRendererIntegrityRepairText(userMessage: string, reason: string): string {
  const q = trim(userMessage, 120);
  return [
    "LML renderer-integrity guidance. Do not output this header.",
    `User message: "${q}"`,
    `Renderer integrity failure: ${reason}`,
    "Respond again from the admitted branch only. No unrelated shell, git, policy, or runtime text. Give one direct useful answer.",
  ].join("\n");
}

function isConversationalMicroIntent(userMessage: string): boolean {
  const q = userMessage.trim().toLowerCase();
  if (!q) {
    return false;
  }
  if (/^(yo|hey|hello|hi|sup|what up)\W*$/.test(q)) {
    return true;
  }
  if (/^(ok|okay|k|yup|yep|bet|copy)\W*$/.test(q)) {
    return true;
  }
  if (/\b(nah|not that|wrong|no)\b/.test(q)) {
    return true;
  }
  if (/\b(switch|change it|new doc|apply now|continue)\b/.test(q)) {
    return true;
  }
  if (isStyleDirective(q)) {
    return true;
  }
  return q.length <= 20;
}

function isStyleDirective(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\b(talk|speak)\b.*\b(style|tone|voice|street|slang|casual|formal|scientist|scientific)\b/.test(lower)) {
    return true;
  }
  if (/\b(talk|speak)\s+like\b/.test(lower)) {
    return true;
  }
  if (/\b(you are my|be my|act as)\s+[a-z0-9 _-]+/.test(lower)) {
    return true;
  }
  if (/\b(general|commander|mentor|coach|teacher|lawyer|scientist)\b/.test(lower) && /\b(you are|be|act)\b/.test(lower)) {
    return true;
  }
  return false;
}

function buildStyleDirectiveProjection(question: string, userLaws: string[], insights: string[]): string | null {
  if (!isStyleDirective(question)) {
    return null;
  }
  const policySource = `${userLaws.join("\n")}\nexpression directive: ${question}`;
  const policy = parseExpressionPolicy(policySource);
  return buildPolicyGuidance(policy, question, insights);
}

function buildStyleDirectiveRecoveryResponse(question: string): string {
  const policy = parseExpressionPolicy(`expression directive: ${question}`);
  return buildPolicyGuidance(policy, question, []);
}

function buildLifePreservationProjection(userMessage: string, userLaws: string[]): string | null {
  const q = userMessage.toLowerCase();
  const laws = userLaws.join("\n").toLowerCase();
  const enabledByLaw = /\b(preserve life|life preservation|crisis response|never minimize|stay present|co-regulation)\b/.test(laws);
  const crisisSignal =
    /\b(i want to die|kill myself|suicide|end my life|i have pills|nothing will get better|goodbye forever|self harm)\b/.test(q);
  const distressSignal =
    /\b(hopeless|can't go on|what's the point|i'm done|i feel empty|panic)\b/.test(q);

  if (!(enabledByLaw || crisisSignal || distressSignal)) {
    return null;
  }

  if (crisisSignal) {
    return [
      "LML life-preservation guidance. Do not output this header.",
      `User message: "${trim(userMessage, 220)}"`,
      "Risk level: crisis",
      "Respond in a human, present, safety-first voice with no fixed stock sentence pattern.",
      "Include immediate support routing (US: 988 or emergency services) and one concrete short safety step.",
      "Ask one direct check-in question to confirm immediate safety context.",
    ].join("\n");
  }

  if (distressSignal) {
    return [
      "LML life-preservation guidance. Do not output this header.",
      `User message: "${trim(userMessage, 220)}"`,
      "Risk level: distress",
      "Respond in a human, emotionally present, calming voice with no fixed stock sentence pattern.",
      "Offer one immediate grounding step and one optional crisis-support path (US: 988) if risk escalates.",
      "Ask one concise next-step question.",
    ].join("\n");
  }

  return [
    "LML emotional-presence guidance. Do not output this header.",
    `User message: "${trim(userMessage, 220)}"`,
    "Mode: emotional_presence",
    "Respond naturally, attuned and validating, without template wording.",
    "Keep response concise and collaborative.",
  ].join("\n");
}

function buildLawBoundRefusalMessage(reason: string, triggeredConstraints: string[], userLaws: string[]): string {
  const violation = triggeredConstraints[0] ?? "admissibility_violation";
  const directLaw = detectPrimaryBlockingLaw(violation, userLaws);
  const suggestion = buildChangeSuggestion(violation, userLaws);
  return [
    "LML law-bound refusal guidance. Do not output this header.",
    `Refusal reason: ${reason}`,
    `Active constraint: ${violation}`,
    `Blocking law: ${directLaw}`,
    `Suggested legal next step: ${suggestion}`,
    "Respond naturally with concise explanation and lawful next action.",
  ].join("\n");
}

function buildRefusalRenderGuidance(
  userMessage: string,
  reason: string,
  triggeredConstraints: string[],
  failureClasses: string[],
  triggeredRepairs: string[],
  userLaws: string[],
): string {
  return [
    "LML final refusal rendering guidance. Do not output this header.",
    `User message: "${trim(userMessage, 220)}"`,
    `Reason: ${reason}`,
    `Triggered constraints: ${triggeredConstraints.join(" | ") || "none"}`,
    `Failure classes: ${failureClasses.join(" | ") || "none"}`,
    `Triggered repairs: ${triggeredRepairs.join(" | ") || "none"}`,
    `Relevant laws: ${userLaws.slice(0, 3).join(" | ") || "none"}`,
    "Produce a natural refusal that is calm, specific, and offers one concrete legal next step.",
  ].join("\n");
}

async function buildWebSearchResponse(
  runId: string,
  userMessage: string,
  witness: Witness,
  reason: string,
): Promise<GeneratedOutput> {
  const query = normalizeSearchQuery(userMessage);
  const searchSummary = await runGovernedWebSearch(query);
  const content = [
    `Governed web search for: "${query}"`,
    searchSummary.summary,
    ...searchSummary.sources.map((source, index) => `${index + 1}. ${source}`),
  ].join("\n");
  const gpt2 = await runGpt2Constrained({
    runId,
    content,
    witness,
    mode: "chat_ontology",
  });
  return {
    text: gpt2.text,
    final_action: "success",
    reason,
    model: buildRuntimeModelFromReceipt(runId, gpt2.receipt),
  };
}

function normalizeSearchQuery(message: string): string {
  return message
    .replace(/\b(search the web for|search for|look up|find)\b/gi, "")
    .replace(/\?+$/, "")
    .trim() || message.trim();
}

async function runGovernedWebSearch(query: string): Promise<{ summary: string; sources: string[] }> {
  const attempts: string[] = [];
  const primary = await queryDuckDuckGoInstant(query);
  attempts.push(primary.source);
  if (primary.ok) {
    return { summary: primary.summary, sources: attempts };
  }

  const fallback = await queryWikipediaSummary(query);
  attempts.push(fallback.source);
  if (fallback.ok) {
    return { summary: fallback.summary, sources: attempts };
  }

  return {
    summary: "Live retrieval is unavailable or returned no usable records for this query. Add narrower query terms or retry in a network-enabled runtime.",
    sources: [...attempts, "network_fallback:none"],
  };
}

function buildGovernedCodingResponse(
  question: string,
  userLaws: string[],
  insights: string[],
  state: InfiniteContextState,
): string {
  const qLower = question.toLowerCase();
  const codingReadiness = /\b(ready to code|can you code|coding ready|code now)\b/.test(qLower);
  const lowerLaws = userLaws.join("\n").toLowerCase();
  const stylePolicy = parseExpressionPolicy(`${userLaws.join("\n")}\nexpression directive: ${question}`);
  const noRecursion = /\b(no recursion|avoid recursion|must not use recursion)\b/.test(lowerLaws);
  const readabilityFirst = /\b(readability|readable|clarity)\b/.test(lowerLaws);
  const strictErrorHandling = /\b(error handling|safe|safety|guard)\b/.test(lowerLaws);
  const contract = deriveCodingSkeletonContract({ question, userLaws, insights });
  const intentSpec = deriveCodingIntentSpec({ question, contract });
  const language = contract.language;
  const wantsTests = contract.wantsTests;
  const wantsApi = contract.wantsApi;
  const continuityRequest = state.wm.bindings.coding_last_request ?? "none";
  const continuityFailure = state.wm.bindings.coding_last_failure_reason ?? "none";
  const continuityCode = state.wm.bindings.coding_last_code ?? "";

  const constraints = [
    "coding ability engaged under active ontology",
    noRecursion ? "recursion disabled by law" : "recursion not explicitly restricted",
    readabilityFirst ? "readability prioritized by law" : "default readability baseline",
    strictErrorHandling ? "defensive error handling required" : "standard error handling",
  ];

  return [
    "LML coding generator-only policy. Do not output this header.",
    `User request: "${trim(question, 220)}"`,
    "Route: coding.governed",
    `Style profile: ${stylePolicy.styleProfile ?? "unspecified"}`,
    `Style family: ${stylePolicy.styleFamily ?? "unspecified"}`,
    `Address as: ${stylePolicy.addressAs ?? "none"}`,
    `Style directives: ${stylePolicy.styleDirectives.slice(0, 4).join(" | ") || "none"}`,
    `Preferred language: ${language}`,
    `Coding family: ${contract.family}`,
    `Spec artifact: ${intentSpec.identity.artifactType}`,
    `Spec domain: ${intentSpec.identity.domain}`,
    `Spec outcome: ${intentSpec.outcome.summary}`,
    `Spec constraints: ${intentSpec.constraints.join(" | ") || "none"}`,
    `Spec examples: ${intentSpec.examples.join(" | ") || "none"}`,
    `Expected output shape: ${contract.expectedOutputShape}`,
    `Witnesses: ${contract.witnessSet.join(" | ") || "fenced_code"}`,
    `Applied constraints: ${constraints.join(" | ")}`,
    `Signals: readiness=${codingReadiness ? "yes" : "no"}, wants_tests=${wantsTests ? "yes" : "no"}, wants_api=${wantsApi ? "yes" : "no"}`,
    `Doc signals: ${insights.length > 0 ? trim(insights.slice(0, 2).join(" | "), 200) : "none"}`,
    `Continuity last request: ${trim(continuityRequest, 180)}`,
    `Continuity last failure: ${trim(continuityFailure, 180)}`,
    continuityCode
      ? `Continuity code scaffold (resume from this if relevant): ${trim(continuityCode, 600)}`
      : "Continuity code scaffold (resume from this if relevant): none",
    "Generator rules:",
    "1) Output code blocks only. No prose, no explanation, no headers.",
    `2) Produce working ${language} code in fenced block (\`\`\`${language}).`,
    "3) If tests are requested, include a separate fenced test block.",
    "4) Never output policy, runtime, law, or channel language.",
    `5) Keep the code minimal, copyable, and directly aligned to the ${contract.family} skeleton.`,
    "6) Satisfy the witness set before emit; if the witness set cannot be met, emit nothing.",
  ].join("\n");
}

function codingNeedsClarification(question: string, contract?: CodingSkeletonContract, intentSpec?: CodingIntentSpec): boolean {
  const lower = question.toLowerCase();
  if (isFrontierBenchmarkCodingPrompt(lower)) {
    return false;
  }
  const implementationSignal =
    /\b(build|make|write|implement|create|debug|refactor|function|script|class|endpoint|api|fastapi|flask|express|compiler|parser|game|doom|validator|model|crud)\b/.test(lower);
  const languageSignal = /\b(python|typescript|javascript|js|ts|go|golang|rust|java|c\+\+|cpp)\b/.test(lower);
  const targetSignal = /\b(for|that|which|using|with|from|into)\b/.test(lower) || lower.length >= 32;
  const familyKnown = contract ? contract.family !== "unknown" : false;
  const intentStrongEnough = intentSpec ? intentSpec.completeness.score >= 2 : false;
  return !(implementationSignal && (languageSignal || targetSignal || familyKnown || intentStrongEnough));
}

function extractUnifiedDiff(text: string): string {
  const trimmed = text.trim();
  const diffIndex = trimmed.indexOf("diff --git ");
  if (diffIndex >= 0) {
    return trimmed.slice(diffIndex).trim();
  }
  if ((/^---\s/m.test(trimmed) && /^\+\+\+\s/m.test(trimmed)) || /@\@/.test(trimmed)) {
    return trimmed;
  }
  return "";
}

function normalizeFrontierBenchmarkPatchCandidate(text: string): {
  normalized: string;
  reason: string;
} {
  const trimmed = text.trim();
  const direct = extractUnifiedDiff(trimmed);
  if (direct) {
    return { normalized: direct, reason: "direct_unified_diff" };
  }

  const unfenced = trimmed
    .replace(/^```(?:diff|patch)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const unfencedDiff = extractUnifiedDiff(unfenced);
  if (unfencedDiff) {
    return { normalized: unfencedDiff, reason: "unfenced_unified_diff" };
  }

  const lines = unfenced.split(/\r?\n/);
  const headerStart = lines.findIndex((line) => /^---\s/.test(line));
  if (headerStart >= 0) {
    const candidate = lines.slice(headerStart).join("\n").trim();
    if ((/^---\s/m.test(candidate) && /^\+\+\+\s/m.test(candidate)) || /@@/.test(candidate)) {
      return { normalized: candidate, reason: "header_pair_diff" };
    }
  }

  return { normalized: "", reason: "missing_unified_diff" };
}

function compactFrontierBenchmarkUserMessage(userMessage: string): string {
  const lines = userMessage
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const keep: string[] = [];
  for (const line of lines) {
    if (
      /^repository:/i.test(line) ||
      /^instance id:/i.test(line) ||
      /^problem statement:/i.test(line) ||
      /^hints:/i.test(line) ||
      /^requirements:/i.test(line) ||
      /^expected behavior/i.test(line) ||
      /^current behavior/i.test(line) ||
      /^what is expected/i.test(line) ||
      /^what happened instead/i.test(line) ||
      /^issue description/i.test(line) ||
      /^description/i.test(line) ||
      /^title/i.test(line) ||
      /^[-*]/.test(line) ||
      /^\d+\./.test(line)
    ) {
      keep.push(line);
    }
    if (keep.length >= 16) {
      break;
    }
  }

  const compact = keep.join("\n").trim();
  return compact.length > 1200 ? `${compact.slice(0, 1200)}...` : compact;
}

function extractFrontierBenchmarkRepo(userMessage: string): string {
  const match = userMessage.match(/^repository:\s*(.+)$/im);
  return match?.[1]?.trim() ?? "unknown";
}

function extractFrontierBenchmarkLikelyPaths(userMessage: string): string[] {
  const lines = userMessage.replace(/\r/g, "").split("\n");
  const start = lines.findIndex((line) => /^likely touched paths:/i.test(line.trim()));
  if (start < 0) {
    return [];
  }
  const paths: string[] = [];
  for (const rawLine of lines.slice(start + 1)) {
    const line = rawLine.trim();
    if (!line) {
      break;
    }
    if (!/^-\s+/.test(line)) {
      break;
    }
    const value = line.replace(/^-\s+/, "").trim();
    if (value) {
      paths.push(value);
    }
  }
  return paths;
}

function buildFrontierBenchmarkDiffSkeleton(targetPath: string): string {
  const pathValue = targetPath.trim() || "README.md";
  const ext = pathValue.split(".").pop()?.toLowerCase() ?? "";
  const oldLine =
    ext === "py" ? "old_value = False"
    : ext === "js" || ext === "ts" || ext === "tsx" || ext === "jsx" ? "const oldValue = false;"
    : "old_value";
  const newLine =
    ext === "py" ? "old_value = True"
    : ext === "js" || ext === "ts" || ext === "tsx" || ext === "jsx" ? "const oldValue = true;"
    : "new_value";
  return [
    `diff --git a/${pathValue} b/${pathValue}`,
    `--- a/${pathValue}`,
    `+++ b/${pathValue}`,
    "@@",
    `-${oldLine}`,
    `+${newLine}`,
  ].join("\n");
}

function buildFrontierBenchmarkPatchPrompts(userMessage: string): Array<{
  prompt: string;
  options: {
    maxNewTokens: number;
    minNewTokens: number;
    temperature: number;
    topP: number;
    doSample: boolean;
    repetitionPenalty: number;
    noRepeatNgramSize: number;
  };
}> {
  const compact = compactFrontierBenchmarkUserMessage(userMessage);
  const repo = extractFrontierBenchmarkRepo(userMessage);
  const likelyPaths = extractFrontierBenchmarkLikelyPaths(userMessage);
  const primaryPath = likelyPaths[0] ?? "README.md";
  const prompts: Array<{
    prompt: string;
    options: {
      maxNewTokens: number;
      minNewTokens: number;
      temperature: number;
      topP: number;
      doSample: boolean;
      repetitionPenalty: number;
      noRepeatNgramSize: number;
    };
  }> = [];

  for (const targetPath of likelyPaths.slice(0, 3)) {
    prompts.push({
      prompt: [
        `Repository: ${repo}`,
        "SWE-bench Pro benchmark patch generation.",
        "Return only a unified git diff patch.",
        "Start exactly with: diff --git",
        "Patch this likely file path first.",
        "Output only patch lines.",
        "Do not explain.",
        "Do not use markdown fences.",
        "Follow this shape exactly:",
        buildFrontierBenchmarkDiffSkeleton(targetPath),
        "",
        compact,
      ].join("\n"),
      options: {
        maxNewTokens: 220,
        minNewTokens: 40,
        temperature: 0.0,
        topP: 1.0,
        doSample: false,
        repetitionPenalty: 1.08,
        noRepeatNgramSize: 4,
      },
    });
  }

  prompts.push(
    {
      prompt: [
        `Repository: ${repo}`,
        "SWE-bench Pro benchmark patch generation.",
        "Return only a unified git diff patch.",
        "Start exactly with: diff --git",
        "Output only patch lines.",
        "Do not explain.",
        "Do not use markdown fences.",
        "Follow this shape exactly:",
        buildFrontierBenchmarkDiffSkeleton(primaryPath),
        "",
        compact,
      ].join("\n"),
      options: {
        maxNewTokens: 220,
        minNewTokens: 40,
        temperature: 0.0,
        topP: 1.0,
        doSample: false,
        repetitionPenalty: 1.08,
        noRepeatNgramSize: 4,
      },
    },
    {
      prompt: [
        `Repository: ${repo}`,
        "SWE-bench Pro benchmark patch generation.",
        "Emit a single-file unified diff patch only.",
        `Use one of these paths first: ${likelyPaths.slice(0, 3).join(", ") || primaryPath}`,
        "First token sequence must be: diff --git",
        "No prose.",
        "",
        compact,
      ].join("\n"),
      options: {
        maxNewTokens: 180,
        minNewTokens: 32,
        temperature: 0.0,
        topP: 1.0,
        doSample: false,
        repetitionPenalty: 1.05,
        noRepeatNgramSize: 3,
      },
    },
    {
      prompt: [
        `Repository: ${repo}`,
        "Patch only.",
        `Likely path: ${primaryPath}`,
        "Unified diff only.",
        "Start with diff --git.",
        compact,
      ].join("\n"),
      options: {
        maxNewTokens: 140,
        minNewTokens: 24,
        temperature: 0.0,
        topP: 1.0,
        doSample: false,
        repetitionPenalty: 1.02,
        noRepeatNgramSize: 3,
      },
    },
  );

  return prompts;
}

async function runFrontierBenchmarkPatchPath(args: {
  runId: string;
  userMessage: string;
}): Promise<GeneratedOutput> {
  const attempts = buildFrontierBenchmarkPatchPrompts(args.userMessage);
  let lastReceipt = null as ReturnType<typeof buildRuntimeModelFromReceipt> | null;
  let lastFailureClass = "unknown";
  let bestRawCandidate = "";
  let bestNormalizationReason = "missing_unified_diff";

  for (const attempt of attempts) {
    const generated = await runGpt2GeneratorOnly({
      prompt: attempt.prompt,
      options: attempt.options,
    });
    const model = buildRuntimeModelFromReceipt(args.runId, generated.receipt);
    lastReceipt = model;
    lastFailureClass = generated.receipt.generationFailureClass ?? "unknown";
    if (!generated.ok) {
      continue;
    }

    if (!bestRawCandidate && generated.text.trim()) {
      bestRawCandidate = generated.text;
    }

    const normalized = normalizeFrontierBenchmarkPatchCandidate(generated.text);
    if (!bestNormalizationReason || bestNormalizationReason === "missing_unified_diff") {
      bestNormalizationReason = normalized.reason;
    }
    if (!normalized.normalized) {
      continue;
    }

    return {
      text: normalized.normalized,
      final_action: "success",
      reason: "coding_collapse_survivor:frontier_benchmark_unified_diff",
      model,
      benchmark_debug: {
        raw_candidate_text: generated.text,
        normalized_candidate_text: normalized.normalized,
        normalization_reason: normalized.reason,
      },
    };
  }

  const fallbackModel = lastReceipt ?? buildRuntimeModelFromReceipt(args.runId, {
    provider: "gpt2-runtime",
    model: "gpt2",
    callId: randomUUID(),
    at: new Date().toISOString(),
    inputDigest: "frontier_benchmark_fallback",
    generationStatus: "fallback",
    generationFailureClass: "empty_generation",
    generationDetail: "frontier_benchmark_no_candidate",
  });
  if (!bestRawCandidate) {
    return {
      text: `NULL: coding projection failed (algorithm:G0_HALTING_COLLAPSE:${lastFailureClass}).`,
      final_action: "refusal",
      reason: `coding_projection_failed:algorithm:G0_HALTING_COLLAPSE:${lastFailureClass}`,
      model: fallbackModel,
      benchmark_debug: {
        raw_candidate_text: null,
        normalized_candidate_text: null,
        normalization_reason: lastFailureClass,
      },
    };
  }

  return {
    text: "NULL: coding projection failed (integration:I2_FRONTIER_BENCHMARK_PATCH:missing_unified_diff).",
    final_action: "refusal",
    reason: "coding_projection_failed:integration:I2_FRONTIER_BENCHMARK_PATCH:missing_unified_diff",
    model: fallbackModel,
    benchmark_debug: {
      raw_candidate_text: bestRawCandidate,
      normalized_candidate_text: null,
      normalization_reason: bestNormalizationReason,
    },
  };
}

function buildDeterministicCodingClarification(
  question: string,
  contract: CodingSkeletonContract,
  intentSpec: CodingIntentSpec,
  repoContext?: CodingRepoContext | null,
): string {
  const repoLine = repoContext
    ? ` Repo context I can already see: ${repoContext.summary.slice(0, 4).join(", ")}.`
    : "";
  return `Give me the exact coding target, ${contract.language}, and the ${contract.family === "unknown" ? "task family" : contract.family} skeleton you want first. I need the end result, required witnesses (${contract.witnessSet.join(", ") || "fenced_code"}), and any key examples. Right now your spec score is ${intentSpec.completeness.score}/3.${repoLine}`;
}

function buildLawGovernedCodingEmit(userMessage: string, generatedText: string, contract?: CodingSkeletonContract): string {
  const blocks = extractCodeBlocks(generatedText);
  const lower = userMessage.toLowerCase();
  const wantsTests = /\btest|tests|pytest|unittest|jest|vitest\b/.test(lower);
  const familyLine = contract ? `Skeleton: ${contract.family} / witnesses=${contract.witnessSet.join(", ") || "fenced_code"}.` : null;
  const intro = wantsTests
    ? "Here’s the code and the test block."
    : "Here’s the code.";
  const normalizedBlocks = blocks.map((block) => `\`\`\`${block.language}\n${block.code}\n\`\`\``);
  return [intro, familyLine, "", ...normalizedBlocks].filter(Boolean).join("\n");
}

function simplifyLawForDemo(value: string): string {
  return value
    .replace(/^must enforce claim\s+\w+:\s*/i, "")
    .replace(/^must enforce document directive from claim\s+\w+:\s*/i, "")
    .replace(/^system must /i, "")
    .replace(/^constraint:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "");
}

function detectPrimaryBlockingLaw(violation: string, userLaws: string[]): string {
  const merged = userLaws.join(" | ");
  if (violation === "forbid_unsafe_endpoints") {
    return extractMatchingLaw(userLaws, /forbid unsafe_endpoints|safe_endpoints_only|unsafe endpoint/i)
      ?? "forbid unsafe_endpoints";
  }
  if (violation === "no_nerd_or_formal_mode") {
    return extractMatchingLaw(userLaws, /never talk nerdy|never talk formally|no nerd|no formal/i)
      ?? "no_nerd_or_formal_mode";
  }
  if (violation === "expression_style_lock") {
    return extractMatchingLaw(userLaws, /my guy|street|slang|casual/i) ?? "expression_style_lock";
  }
  if (violation === "meta_laws_required") {
    return "sun core meta-law gate (LAW-0164..0169)";
  }
  return merged.slice(0, 180) || "active ontology rule";
}

function extractMatchingLaw(userLaws: string[], pattern: RegExp): string | null {
  const found = userLaws.find((law) => pattern.test(law));
  return found ?? null;
}

function buildChangeSuggestion(violation: string, userLaws: string[]): string {
  if (violation === "expression_style_lock" || violation === "no_nerd_or_formal_mode") {
    return "To change this behavior: deactivate the current expression law, or ingest a doc/law that explicitly allows the new speaking style.";
  }
  if (violation === "forbid_unsafe_endpoints") {
    return "To proceed safely: ingest a doc that defines allowed endpoints or add a law that permits a governed endpoint route.";
  }
  if (violation === "meta_laws_required") {
    return "System action required: restore sun core meta laws before continuing.";
  }
  const hasAny = userLaws.length > 0;
  return hasAny
    ? "To proceed: deactivate conflicting law(s) or ingest a new doc that redefines the requested behavior."
    : "To proceed: ingest a document or add a typed law so the ability/style becomes admissible.";
}

function extractCodeBlocks(text: string): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = [];
  const fence = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let match = fence.exec(text);
  while (match) {
    const language = (match[1] || "text").trim().toLowerCase();
    const code = (match[2] || "").trim();
    if (code) {
      blocks.push({ language, code });
    }
    match = fence.exec(text);
  }
  return blocks;
}

type CapabilityState = OntologyState["capability_graph"]["abilities"]["coding"];

function compileCapabilityGraph(userLaws: RuntimeUserLaw[]): OntologyState["capability_graph"] {
  const abilities: OntologyState["capability_graph"]["abilities"] = {
    coding: { state: "unspecified", source_law_ids: [], rationale: [] },
    web_search: { state: "unspecified", source_law_ids: [], rationale: [] },
  };

  for (const law of userLaws) {
    const text = law.text.toLowerCase();
    const directives = parseAbilityDirectives(text);
    for (const directive of directives) {
      const target = abilities[directive.ability];
      target.source_law_ids.push(law.law_id);
      target.rationale.push(directive.reason);
      target.state = directive.effect === "deny" ? "blocked" : "allowed";
    }
  }

  return {
    compiled_from_laws: userLaws.length,
    abilities: {
      coding: {
        state: abilities.coding.state,
        source_law_ids: unique(abilities.coding.source_law_ids),
        rationale: unique(abilities.coding.rationale),
      },
      web_search: {
        state: abilities.web_search.state,
        source_law_ids: unique(abilities.web_search.source_law_ids),
        rationale: unique(abilities.web_search.rationale),
      },
    },
  };
}

function parseAbilityDirectives(text: string): Array<{ ability: "coding" | "web_search"; effect: "allow" | "deny"; reason: string }> {
  const directives: Array<{ ability: "coding" | "web_search"; effect: "allow" | "deny"; reason: string }> = [];
  const rules: Array<{ ability: "coding" | "web_search"; effect: "allow" | "deny"; pattern: RegExp; reason: string }> = [
    { ability: "coding", effect: "allow", pattern: /\ballow ability:\s*(coding|code_exec|code_assist)\b/, reason: "explicit allow ability directive for coding" },
    { ability: "coding", effect: "allow", pattern: /\b(enable|allow)\s+(coding|code generation|python coding)\b/, reason: "explicit allow coding statement" },
    { ability: "coding", effect: "deny", pattern: /\b(forbid|disable|block)\s+(ability:\s*)?(coding|code_exec|code_assist)\b/, reason: "explicit deny coding statement" },
    { ability: "coding", effect: "deny", pattern: /\bno coding\b/, reason: "no coding constraint" },
    { ability: "web_search", effect: "allow", pattern: /\ballow ability:\s*(web_search|internet_search)\b/, reason: "explicit allow ability directive for web search" },
    { ability: "web_search", effect: "allow", pattern: /\b(enable|allow)\s+(web search|internet search|online lookup)\b/, reason: "explicit allow web search statement" },
    { ability: "web_search", effect: "deny", pattern: /\b(forbid|disable|block)\s+(ability:\s*)?(web_search|internet_search|web search)\b/, reason: "explicit deny web search statement" },
    { ability: "web_search", effect: "deny", pattern: /\bno web search\b/, reason: "no web search constraint" },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      directives.push({
        ability: rule.ability,
        effect: rule.effect,
        reason: rule.reason,
      });
    }
  }
  return directives;
}

function parseRuntimeAbilityLawCommand(text: string): RuntimeAbilityCommand | null {
  const lower = text.toLowerCase();
  const codingToken = /\b(coding|code|programming|python)\b/.test(lower);
  const searchToken = /\b(web search|internet search|web|online lookup|search)\b/.test(lower);
  const lawToken = /\b(law|ability|mode|planet)\b/.test(lower);
  const activateToken = /\b(active|activate|enabled|enable|on)\b/.test(lower);
  const deactivateToken = /\b(inactive|deactivate|disabled|disable|off|block)\b/.test(lower);
  if (!lawToken) {
    return null;
  }
  if (codingToken && activateToken) {
    return { ability: "coding", effect: "allow", sourceText: text.trim() };
  }
  if (codingToken && deactivateToken) {
    return { ability: "coding", effect: "deny", sourceText: text.trim() };
  }
  if (searchToken && activateToken) {
    return { ability: "web_search", effect: "allow", sourceText: text.trim() };
  }
  if (searchToken && deactivateToken) {
    return { ability: "web_search", effect: "deny", sourceText: text.trim() };
  }
  return null;
}

function applyRuntimeAbilityCommand(state: InfiniteContextState, command: RuntimeAbilityCommand): void {
  const keep = state.activeAutoLaws.filter((law) => {
    if (law.source !== "runtime_ability_command") {
      return true;
    }
    const directives = parseAbilityDirectives(law.text.toLowerCase());
    return !directives.some((directive) => directive.ability === command.ability);
  });
  const lawText = command.effect === "allow"
    ? `allow ability: ${command.ability}`
    : `forbid ability: ${command.ability}`;
  keep.push({
    text: lawText,
    scope: "global",
    enforcement: "runtime_command",
    source: "runtime_ability_command",
  });
  state.activeAutoLaws = keep;
}

function buildRuntimeAbilityCommandResponse(command: RuntimeAbilityCommand, ontology: OntologyState): string {
  const abilityLabel = command.ability === "web_search" ? "web search" : "coding";
  const state = ontology.capability_graph.abilities[command.ability];
  const mode = command.effect === "allow" ? "active" : "inactive";
  return [
    "LML runtime ability command acknowledgement. Do not output this header.",
    `Command: ${trim(command.sourceText, 180)}`,
    `Applied: ${abilityLabel} law ${mode}`,
    `Current ${abilityLabel} state: ${state.state}`,
    "Respond naturally in one short confirmation line and one concrete next action suggestion.",
  ].join("\n");
}

function renderDeterministicAbilityCommandResponse(
  command: RuntimeAbilityCommand,
  ontology: OntologyState,
): string {
  const abilityLabel = command.ability === "web_search" ? "web search" : "coding";
  const state = ontology.capability_graph.abilities[command.ability].state;
  if (command.effect === "allow" || state === "allowed") {
    return `${abilityLabel.charAt(0).toUpperCase()}${abilityLabel.slice(1)} is active.`;
  }
  if (state === "blocked") {
    return `${abilityLabel.charAt(0).toUpperCase()}${abilityLabel.slice(1)} is blocked by active laws.`;
  }
  return `${abilityLabel.charAt(0).toUpperCase()}${abilityLabel.slice(1)} is inactive.`;
}

function resolveAutoApplySources(state: InfiniteContextState): string[] {
  const base = ["meta_projection_loop", "ai_model_planet_hardening", "novelty_cycle"];
  if (state.automation.metaLoopMode === "automate") {
    return [...base, "quantum_blanket_seed"];
  }
  return base;
}

function renderDeterministicLawRefusal(reason: string, triggeredConstraints: string[]): string {
  const lower = reason.toLowerCase();
  if (/coding_projection_failed:/.test(lower)) {
    return "NULL emitted by coding projection gate. NSL repair is active; submit a narrower coding target to continue.";
  }
  if (/ability not installed:\s*coding|deterministic_coding_readiness_not_installed/.test(lower)) {
    return "I can’t code yet under current active laws. Add a coding ability law and apply LML, then ask again.";
  }
  if (/ability blocked by active ontology:\s*coding|deterministic_coding_readiness_blocked/.test(lower)) {
    return "Coding is blocked by your active laws right now. Remove or update the blocking coding law to continue.";
  }
  if (/ability not installed:\s*web_search/.test(lower)) {
    return "I can’t search the web yet under current active laws. Add a web_search ability law and apply LML.";
  }
  if (triggeredConstraints.length > 0) {
    return `Request refused under active laws due to constraint gates: ${triggeredConstraints.slice(0, 3).join(", ")}.`;
  }
  return "Request refused under current active laws. Provide one lawful next action.";
}

function classifyCodingProjection(text: string, contract?: CodingSkeletonContract): { ok: boolean; reason: string } {
  const lower = text.toLowerCase();
  if (/python_syntax_invalid|python_runtime_invalid|empty_generation/.test(lower)) {
    const reason = /python_syntax_invalid/.test(lower)
      ? "python_syntax_invalid"
      : /python_runtime_invalid/.test(lower)
        ? "python_runtime_invalid"
        : "empty_generation";
    return { ok: false, reason };
  }
  const blocks = extractCodeBlocks(text);
  if (blocks.length === 0) {
    return { ok: false, reason: "missing_code_blocks" };
  }
  if (/can’t produce stable full code|can't produce stable full code|generation unstable/.test(lower)) {
    return { ok: false, reason: "unstable_generation" };
  }
  if (contract) {
    const witness = validateCodingWitnessSet({ contract, text, blocks });
    if (!witness.ok) {
      return { ok: false, reason: witness.reason };
    }
    const architecture = validateCodingArchitecture({ contract, blocks });
    if (!architecture.ok) {
      return { ok: false, reason: architecture.reason };
    }
    const floor = validateCodingFloor({ contract, text });
    if (!floor.ok) {
      return { ok: false, reason: floor.reason };
    }
  }
  return { ok: true, reason: "ok" };
}

function buildAbilityBlockedReason(ability: "coding" | "web_search", state: CapabilityState): string {
  const reasons = state.rationale.length > 0 ? ` (${state.rationale.join("; ")})` : "";
  const sources = state.source_law_ids.length > 0 ? ` [sources: ${state.source_law_ids.join(", ")}]` : "";
  if (state.state === "blocked") {
    return `ability blocked by active ontology: ${ability}${reasons}${sources}`;
  }
  return `ability not installed: ${ability}${sources}`;
}

async function queryDuckDuckGoInstant(query: string): Promise<{ ok: boolean; summary: string; source: string }> {
  const source = "DuckDuckGo Instant Answer API";
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetchWithTimeout(url, 4500);
    if (!response.ok) {
      return { ok: false, summary: "", source: `${source} (${response.status})` };
    }
    const data = (await response.json()) as {
      AbstractText?: string;
      Heading?: string;
      RelatedTopics?: Array<{ Text?: string } | { Name?: string; Topics?: Array<{ Text?: string }> }>;
    };
    const lines: string[] = [];
    if (data.Heading) lines.push(`Heading: ${data.Heading}`);
    if (data.AbstractText) lines.push(`Abstract: ${trim(data.AbstractText, 360)}`);
    const related = (data.RelatedTopics ?? [])
      .flatMap((item) => ("Topics" in item && Array.isArray(item.Topics) ? item.Topics : [item]))
      .map((item) => ("Text" in item ? item.Text ?? "" : ""))
      .filter(Boolean)
      .slice(0, 3)
      .map((item) => `Related: ${trim(item, 200)}`);
    lines.push(...related);
    return {
      ok: lines.length > 0,
      summary: lines.length > 0 ? lines.join(" | ") : "",
      source,
    };
  } catch {
    return { ok: false, summary: "", source: `${source} (unreachable)` };
  }
}

async function queryWikipediaSummary(query: string): Promise<{ ok: boolean; summary: string; source: string }> {
  const source = "Wikipedia REST summary";
  const title = query
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 6)
    .join("_");
  if (!title) {
    return { ok: false, summary: "", source: `${source} (empty_title)` };
  }
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const response = await fetchWithTimeout(url, 4500);
    if (!response.ok) {
      return { ok: false, summary: "", source: `${source} (${response.status})` };
    }
    const data = (await response.json()) as { title?: string; extract?: string };
    if (!data.extract) {
      return { ok: false, summary: "", source: `${source} (no_extract)` };
    }
    return {
      ok: true,
      summary: `Heading: ${data.title ?? query} | Abstract: ${trim(data.extract, 360)}`,
      source,
    };
  } catch {
    return { ok: false, summary: "", source: `${source} (unreachable)` };
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
