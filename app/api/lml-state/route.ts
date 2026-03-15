import { NextResponse } from "next/server";
import { clearAllOverlayLaws, getOrCreateContextState, persistContextState, setUserOverlayLaws } from "@/lib/lml/infinite-context";
import { compileCapabilityGraphFromRuntimeLaws, getAbilityPlanetInventory, getAiModelPlanetInventory, getHumanPlanetInventory, getMetaPlanetInventory, getPlanetSourceInventory, getQuantumRoleInventory, getUniverseGrouping, type RuntimeUserLaw } from "@/lib/lml/chat-runtime";
import { isCriticalMetaProposal } from "@/lib/lml/meta-delivery";
import { readMetaLoopWorkerStatus } from "@/lib/lml/meta-loop-worker";
import { readAllCodingSimLedgerRecords } from "@/lib/lml/coding-sim-ledger";
import { readAllMetaDeliveryLedgerRecords, readAllMetaDeliveryPlanetRootLaws, verifyMetaDeliveryLedgerPlanetParity } from "@/lib/meta";
import { buildRootRegistry } from "@/lib/lml/root-registry";
import { readAllNslLedgerRecords, readAllNslPlanetRootLaws, verifyNslLedgerPlanetParity } from "@/lib/nsl";
import { findBranchTreePlanetLawsByBranchId, findBranchTreePlanetLawsByTreeId, readAllNocrLedgerRecords, syncBranchTreePlanetFromNocrLedger, syncNocrPlanetFromLedger, verifyBranchTreePlanetParity, verifyNocrLedgerPlanetParity } from "@/lib/nocr";
import { getNocrRootSpace } from "@/lib/nocr";

type StateBody = {
  sessionId?: string;
  userLaws?: RuntimeUserLaw[];
  action?: "replace" | "clear";
  metaLoopMode?: "ask_every_update" | "automate";
};

type LedgerPreview = {
  eventType: string;
  at: string;
  text: string;
};

type SnapMatchPreview = {
  seedId: string;
  rootId: string;
  domain: string;
  reasonClass: string;
  score: number;
};

type CollapseMatchLedgerPreview = SnapMatchPreview & {
  branchId: string;
  treeId: string;
  at: string;
};

type NslDeterministicCodingRepairPreview = {
  eventType: string;
  at: string;
  reason: string;
};

type CodingSimLedgerPreview = {
  eventType: string;
  at: string;
  scenarios: number;
  visitedNodes: number;
  survivors: number;
  pruned: number;
  reportPath: string;
};

type CodingSimDimensionPreview = {
  dimension: string;
  count: number;
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId") ?? "default-session";
    const branchId = url.searchParams.get("branchId");
    const treeId = url.searchParams.get("treeId");
    const state = await getOrCreateContextState(sessionId);
    const runtimeAutoAsLaws: RuntimeUserLaw[] = state.activeAutoLaws.map((law, index) => ({
      law_id: `AUTO-${String(index + 1).padStart(4, "0")}`,
      text: law.text,
      scope: law.scope,
      enforcement: law.enforcement,
    }));
    const capabilityGraph = compileCapabilityGraphFromRuntimeLaws([...state.userOverlayLaws, ...runtimeAutoAsLaws]);
    const abilityPlanet = getAbilityPlanetInventory();
    const activeAbilityPlanet = {
      coding: capabilityGraph.abilities.coding.state === "allowed" ? abilityPlanet.coding : [],
      web_search: capabilityGraph.abilities.web_search.state === "allowed" ? abilityPlanet.web_search : [],
    };
    const metaPlanetLaws = getMetaPlanetInventory();
    const aiModelPlanetLaws = getAiModelPlanetInventory();
    const humanPlanetLaws = getHumanPlanetInventory();
    const quantumRoleLaws = getQuantumRoleInventory();
    const nocrLedgerRecords = await readAllNocrLedgerRecords();
    const nocrPlanetRootLaws = await syncNocrPlanetFromLedger(nocrLedgerRecords);
    const nocrPlanetParity = verifyNocrLedgerPlanetParity(nocrLedgerRecords, nocrPlanetRootLaws);
    const branchTreePlanetRootLaws = await syncBranchTreePlanetFromNocrLedger(nocrLedgerRecords);
    const branchTreePlanetParity = verifyBranchTreePlanetParity(nocrLedgerRecords, branchTreePlanetRootLaws);
    const nslLedgerRecords = await readAllNslLedgerRecords();
    const nslPlanetRootLaws = await readAllNslPlanetRootLaws();
    const nslPlanetParity = verifyNslLedgerPlanetParity(nslLedgerRecords, nslPlanetRootLaws);
    const metaDeliveryLedgerRecords = await readAllMetaDeliveryLedgerRecords();
    const metaDeliveryPlanetRootLaws = await readAllMetaDeliveryPlanetRootLaws();
    const metaDeliveryPlanetParity = verifyMetaDeliveryLedgerPlanetParity(metaDeliveryLedgerRecords, metaDeliveryPlanetRootLaws);
    const codingSimLedgerRecords = await readAllCodingSimLedgerRecords();
    const metaLoopWorker = await readMetaLoopWorkerStatus();
    const rootRegistry = buildRootRegistry({
      staticRoots: getNocrRootSpace(),
      artifactTexts: state.docs.map((doc) => doc.text),
      userLawTexts: [...state.userOverlayLaws, ...runtimeAutoAsLaws].map((law) => law.text),
    });
    const staticPlanetSourceInventory = getPlanetSourceInventory();
    const planetSourceInventory = {
      ...staticPlanetSourceInventory,
      nocr: nocrPlanetRootLaws.map((law) => law.text),
      nsl: nslPlanetRootLaws.map((law) => law.text),
      branch_tree: [
        ...(staticPlanetSourceInventory.branch_tree ?? []),
        ...branchTreePlanetRootLaws.map((law) => law.text),
      ],
    };
    const planetSourceCounts = {
      sun: planetSourceInventory.sun.length,
      meta: planetSourceInventory.meta.length,
      ai_model: planetSourceInventory.ai_model.length,
      human: planetSourceInventory.human.length,
      quantum: planetSourceInventory.quantum.length,
      nocr: planetSourceInventory.nocr.length,
      nsl: planetSourceInventory.nsl.length,
      branch_tree: planetSourceInventory.branch_tree.length,
    };
    const universeGrouping = getUniverseGrouping();
    const universeSourceInventory = {
      reality_universe: {
        sun: planetSourceInventory.sun,
        ability: [
          ...abilityPlanet.coding,
          ...abilityPlanet.web_search,
        ],
        quantum: planetSourceInventory.quantum,
      },
      human_universe: {
        human: planetSourceInventory.human,
      },
      fiction_universe: {
        fiction: [] as string[],
      },
      global_service: {
        meta: planetSourceInventory.meta,
        ai_model: planetSourceInventory.ai_model,
        nocr: planetSourceInventory.nocr,
        nsl: planetSourceInventory.nsl,
        branch_tree: planetSourceInventory.branch_tree,
        meta_delivery: metaDeliveryPlanetRootLaws.map((law) => law.text),
      },
    };
    const universeSourceCounts = {
      reality_universe: {
        sun: universeSourceInventory.reality_universe.sun.length,
        ability: universeSourceInventory.reality_universe.ability.length,
        quantum: universeSourceInventory.reality_universe.quantum.length,
        total:
          universeSourceInventory.reality_universe.sun.length
          + universeSourceInventory.reality_universe.ability.length
          + universeSourceInventory.reality_universe.quantum.length,
      },
      human_universe: {
        human: universeSourceInventory.human_universe.human.length,
        total: universeSourceInventory.human_universe.human.length,
      },
      fiction_universe: {
        fiction: 0,
        total: 0,
      },
      global_service: {
        meta: universeSourceInventory.global_service.meta.length,
        ai_model: universeSourceInventory.global_service.ai_model.length,
        nocr: universeSourceInventory.global_service.nocr.length,
        nsl: universeSourceInventory.global_service.nsl.length,
        branch_tree: universeSourceInventory.global_service.branch_tree.length,
        meta_delivery: universeSourceInventory.global_service.meta_delivery.length,
        total:
          universeSourceInventory.global_service.meta.length
          + universeSourceInventory.global_service.ai_model.length
          + universeSourceInventory.global_service.nocr.length
          + universeSourceInventory.global_service.nsl.length
          + universeSourceInventory.global_service.branch_tree.length
          + universeSourceInventory.global_service.meta_delivery.length,
      },
    };
    const metaSources = [
      "meta_projection_loop",
      "ai_model_planet_hardening",
      "quantum_blanket_seed",
      "novelty_cycle",
      "meta_failure_learning",
    ];
    const activeMetaPlanetLaws = state.activeAutoLaws.filter((law) =>
      metaSources.includes(law.source),
    );
    const criticalAutoMetaUpdates = activeMetaPlanetLaws.filter((law) => isCriticalMetaProposal(law));
    const pendingNonCriticalMetaUpdates = state.pendingLawProposals.filter((law) =>
      metaSources.includes(law.source)
      && !isCriticalMetaProposal(law),
    );
    const activeAiModelPlanetHardeningLaws = state.activeAutoLaws.filter((law) => law.source === "ai_model_planet_hardening");
    const quantumBlanketSuggestions = state.pendingLawProposals.filter((law) => law.source === "quantum_blanket_seed");
    const failureLearningSuggestions = state.pendingLawProposals.filter((law) => law.source === "meta_failure_learning");
    const aiModelPlanetSuggestions = state.pendingLawProposals.filter((law) => law.source === "ai_model_planet_hardening");
    const lastMetaDeliveryPreview = buildLedgerPreview(metaDeliveryLedgerRecords.at(-1), metaDeliveryPlanetRootLaws.at(-1)?.text ?? "");
    const lastNocrPreview = buildLedgerPreview(nocrLedgerRecords.at(-1), nocrPlanetRootLaws.at(-1)?.text ?? "");
    const lastBranchTreePreview = buildLedgerPreview(
      nocrLedgerRecords.filter((record) => ["COLLAPSE_RESOLVED", "COLLAPSE_MATCH_RESOLVED", "BRANCH_EXTENDED", "TREE_EXTENDED", "TREE_STARTED", "BRANCH_FORKED", "BRANCH_SIBLING_CREATED", "BRANCH_MERGED", "BRANCH_CLOSED", "BRANCH_ARCHIVED", "TREE_ARCHIVED", "BRANCH_DELETED", "TREE_DELETED"].includes(record.eventType)).at(-1),
      branchTreePlanetRootLaws.at(-1)?.text ?? "",
    );
    const lastCollapseMatchPreview = buildLastCollapseMatchPreview(nocrLedgerRecords);
    const lastCollapseMatchLedgerPreview = buildLastCollapseMatchLedgerPreview(nocrLedgerRecords);
    const branchTreeLifecycle = {
      collapse_resolved: nocrLedgerRecords.filter((record) => record.eventType === "COLLAPSE_RESOLVED").length,
      collapse_match_resolved: nocrLedgerRecords.filter((record) => record.eventType === "COLLAPSE_MATCH_RESOLVED").length,
      branch_extended: nocrLedgerRecords.filter((record) => record.eventType === "BRANCH_EXTENDED").length,
      tree_extended: nocrLedgerRecords.filter((record) => record.eventType === "TREE_EXTENDED").length,
      tree_started: nocrLedgerRecords.filter((record) => record.eventType === "TREE_STARTED").length,
      branch_forked: nocrLedgerRecords.filter((record) => record.eventType === "BRANCH_FORKED").length,
      branch_sibling_created: nocrLedgerRecords.filter((record) => record.eventType === "BRANCH_SIBLING_CREATED").length,
      branch_merged: nocrLedgerRecords.filter((record) => record.eventType === "BRANCH_MERGED").length,
      branch_closed: nocrLedgerRecords.filter((record) => record.eventType === "BRANCH_CLOSED").length,
      branch_archived: nocrLedgerRecords.filter((record) => record.eventType === "BRANCH_ARCHIVED").length,
      tree_archived: nocrLedgerRecords.filter((record) => record.eventType === "TREE_ARCHIVED").length,
      branch_deleted: nocrLedgerRecords.filter((record) => record.eventType === "BRANCH_DELETED").length,
      tree_deleted: nocrLedgerRecords.filter((record) => record.eventType === "TREE_DELETED").length,
      recent_archived: branchTreePlanetRootLaws
        .filter((law) => law.sourceEventType === "BRANCH_ARCHIVED" || law.sourceEventType === "TREE_ARCHIVED")
        .slice(-6)
        .map((law) => law.text),
      recent_deleted: branchTreePlanetRootLaws
        .filter((law) => law.sourceEventType === "BRANCH_DELETED" || law.sourceEventType === "TREE_DELETED")
        .slice(-6)
        .map((law) => law.text),
    };
    const branchTreeQuery = branchId
      ? {
        mode: "branch" as const,
        id: branchId,
        laws: (await findBranchTreePlanetLawsByBranchId(branchId)).map((law) => law.text),
      }
      : treeId
        ? {
          mode: "tree" as const,
          id: treeId,
          laws: (await findBranchTreePlanetLawsByTreeId(treeId)).map((law) => law.text),
        }
        : null;
    const lastNslPreview = buildLedgerPreview(nslLedgerRecords.at(-1), nslPlanetRootLaws.at(-1)?.text ?? "");
    const nslDeterministicCodingRepairRecords = nslLedgerRecords.filter((record) =>
      record.payload.reason.startsWith("NSL deterministic repair admitted for deterministic_coding_"),
    );
    const lastNslDeterministicCodingRepairPreview = buildNslDeterministicCodingRepairPreview(
      nslDeterministicCodingRepairRecords.at(-1),
    );
    const lastCodingSimPreview = buildCodingSimLedgerPreview(codingSimLedgerRecords.at(-1));
    const codingSimDominantDimensions = buildCodingSimDominantDimensions(codingSimLedgerRecords.at(-1));
    return NextResponse.json({
      sessionId: state.sessionId,
      userLaws: state.userOverlayLaws,
      activeAutoLaws: state.activeAutoLaws,
      pendingLawProposals: state.pendingLawProposals,
      automation: state.automation,
      metaLoopWorker,
      metaPlanetLaws,
      aiModelPlanetLaws,
      activeMetaPlanetLaws,
      criticalAutoMetaUpdates,
      pendingNonCriticalMetaUpdates,
      activeAiModelPlanetHardeningLaws,
      quantumBlanketSuggestions,
      failureLearningSuggestions,
      aiModelPlanetSuggestions,
      metaDeliveryLedgerCount: metaDeliveryLedgerRecords.length,
      metaDeliveryPlanetRootCount: metaDeliveryPlanetRootLaws.length,
      metaDeliveryPlanetRootLaws: metaDeliveryPlanetRootLaws.map((law) => law.text),
      metaDeliveryPlanetParity,
      lastMetaDeliveryPreview,
      humanPlanetLaws,
      quantumRoleLaws,
      nocrPlanetRootLaws: nocrPlanetRootLaws.map((law) => law.text),
      nocrPlanetParity,
      lastNocrPreview,
      branchTreePlanetRootLaws: branchTreePlanetRootLaws.map((law) => law.text),
      branchTreePlanetParity,
      lastBranchTreePreview,
      lastCollapseMatchPreview,
      lastCollapseMatchLedgerPreview,
      branchTreeLifecycle,
      branchTreeQuery,
      nslPlanetRootLaws: nslPlanetRootLaws.map((law) => law.text),
      nslPlanetParity,
      lastNslPreview,
      nslDeterministicCodingRepairCount: nslDeterministicCodingRepairRecords.length,
      lastNslDeterministicCodingRepairPreview,
      codingSimLedgerCount: codingSimLedgerRecords.length,
      lastCodingSimPreview,
      codingSimDominantDimensions,
      rootCoverage: {
        source_units: rootRegistry.extraction.sourceUnitCount,
        extracted_root_count: rootRegistry.extraction.extractedRootCount,
        expansion_delta: rootRegistry.extraction.expansionDelta,
        under_enumerated: rootRegistry.extraction.underEnumerated,
        static_root_count: rootRegistry.staticRoots.length,
        directive_count: rootRegistry.extraction.directiveCount,
        code_unit_count: rootRegistry.extraction.codeUnitCount,
        math_unit_count: rootRegistry.extraction.mathUnitCount,
        sentence_count: rootRegistry.extraction.sentenceCount,
        artifact_root_count: rootRegistry.extraction.artifactRootCount,
        user_law_root_count: rootRegistry.extraction.userLawRootCount,
        total_root_count: rootRegistry.allRoots.length,
      },
      planetSourceInventory,
      planetSourceCounts,
      universeGrouping,
      universeSourceInventory,
      universeSourceCounts,
      capabilityGraph,
      abilityPlanet,
      activeAbilityPlanet,
      docs: state.docs.map((doc) => ({ id: doc.id, name: doc.name, textLength: doc.text.length })),
      activeChat: state.activeChat,
      step: state.step,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to read LML state." }, { status: 500 });
  }
}

function buildLedgerPreview(
  record: { eventType: string; payload: { createdAt: string } } | undefined,
  text: string,
): LedgerPreview | null {
  if (!record) {
    return null;
  }
  return {
    eventType: record.eventType,
    at: record.payload.createdAt,
    text,
  };
}

function buildLastCollapseMatchPreview(
  records: Array<{
    eventType: string;
    payload: Record<string, unknown>;
  }>,
): SnapMatchPreview[] {
  const record = [...records].reverse().find((entry) => entry.eventType === "COLLAPSE_RESOLVED");
  if (!record || !Array.isArray(record.payload.snapMatches)) {
    return [];
  }
  return record.payload.snapMatches
    .map((match) => match as Record<string, unknown>)
    .map((match) => ({
      seedId: String(match.seedId ?? ""),
      rootId: String(match.rootId ?? ""),
      domain: String(match.domain ?? ""),
      reasonClass: String(match.reasonClass ?? ""),
      score: Number(match.score ?? 0),
    }));
}

function buildLastCollapseMatchLedgerPreview(
  records: Array<{
    eventType: string;
    payload: Record<string, unknown>;
  }>,
): CollapseMatchLedgerPreview[] {
  return records
    .filter((entry) => entry.eventType === "COLLAPSE_MATCH_RESOLVED")
    .slice(-8)
    .map((entry) => entry.payload)
    .map((payload) => ({
      seedId: String(payload.seedId ?? ""),
      rootId: String(payload.rootId ?? ""),
      domain: String(payload.domain ?? ""),
      reasonClass: String(payload.reasonClass ?? ""),
      score: Number(payload.score ?? 0),
      branchId: String(payload.branchId ?? ""),
      treeId: String(payload.treeId ?? ""),
      at: String(payload.createdAt ?? ""),
    }));
}

function buildNslDeterministicCodingRepairPreview(
  record: {
    eventType: string;
    payload: {
      createdAt?: string;
      reason?: string;
    };
  } | undefined,
): NslDeterministicCodingRepairPreview | null {
  if (!record) {
    return null;
  }
  return {
    eventType: record.eventType,
    at: String(record.payload.createdAt ?? ""),
    reason: String(record.payload.reason ?? ""),
  };
}

function buildCodingSimLedgerPreview(
  record: {
    eventType: string;
    payload: {
      createdAt: string;
      scenarios: number;
      visitedNodes: number;
      survivors: number;
      pruned: number;
      reportPath: string;
    };
  } | undefined,
): CodingSimLedgerPreview | null {
  if (!record) {
    return null;
  }
  return {
    eventType: record.eventType,
    at: record.payload.createdAt,
    scenarios: record.payload.scenarios,
    visitedNodes: record.payload.visitedNodes,
    survivors: record.payload.survivors,
    pruned: record.payload.pruned,
    reportPath: record.payload.reportPath,
  };
}

function buildCodingSimDominantDimensions(
  record: {
    payload: {
      byDimension?: Record<string, number>;
    };
  } | undefined,
): CodingSimDimensionPreview[] {
  if (!record?.payload.byDimension) {
    return [];
  }
  return Object.entries(record.payload.byDimension)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([dimension, count]) => ({ dimension, count }));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StateBody;
    const sessionId = body.sessionId ?? "default-session";
    const state = await getOrCreateContextState(sessionId);
    if (body.action === "clear") {
      clearAllOverlayLaws(state);
    } else if (Array.isArray(body.userLaws)) {
      setUserOverlayLaws(state, body.userLaws);
    }
    if (body.metaLoopMode === "ask_every_update" || body.metaLoopMode === "automate") {
      state.automation.metaLoopMode = body.metaLoopMode;
    }
    await persistContextState(state);
    return NextResponse.json({
      sessionId: state.sessionId,
      count: state.userOverlayLaws.length,
      automation: state.automation,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update LML state." }, { status: 500 });
  }
}
