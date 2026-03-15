import type { Witness } from "@/lib/engine/types";
import { evaluateCodingCandidate, runGpt2GeneratorOnly, type Gpt2GeneratorAttempt, type Gpt2GeneratorOptions } from "@/lib/demo/gpt2";
import { validateCodingArchitecture } from "@/lib/lml/coding-architecture";
import { classifyCodingFailureDimension } from "@/lib/lml/coding-failure-laws";
import { type CodingIntentSpec } from "@/lib/lml/coding-intent-spec";
import { validateCodingFloor } from "@/lib/lml/coding-physics";
import { validateCodingSecurity } from "@/lib/lml/coding-security";
import { validateCodingSemantics } from "@/lib/lml/coding-semantics";
import { validateCodingWitnessSet, type CodingSkeletonContract } from "@/lib/lml/coding-skeleton-laws";
import { validateCodingState } from "@/lib/lml/coding-state";
import { validateCodingSurface } from "@/lib/lml/coding-surface";
import { validateCodingDesign } from "@/lib/lml/coding-design";
import { validateCodingScale } from "@/lib/lml/coding-scale";
import { validateCodingDependencies } from "@/lib/lml/coding-dependencies";
import { validateCodingGrounding } from "@/lib/lml/coding-grounding";
import { validateCodingIntegration } from "@/lib/lml/coding-integration";
import { validateCodingLogic } from "@/lib/lml/coding-logic";
import { validateCodingExecution } from "@/lib/lml/coding-execution";
import { buildDirectCodingEmitterCandidates, type DirectCodingEmitterCandidate } from "@/lib/lml/coding-family-emitters";
import { buildCodingProjectGraphs, summarizeCodingProjectGraph } from "@/lib/lml/coding-project-graph";
import { materializeDirectCodingCandidate } from "@/lib/lml/coding-slot-contract";
import type { CodingRepoContext } from "@/lib/lml/coding-context";

export type CodingCollapseStage = "kappa" | "gamma" | "pi";

export type CodingCollapseCandidate = {
  id: string;
  label: string;
  source: "generator" | "direct";
  prompt?: string;
  directCandidate?: DirectCodingEmitterCandidate;
  options?: Gpt2GeneratorOptions;
};

export type CodingCollapseAttempt = {
  candidateId: string;
  label: string;
  ok: boolean;
  stage: CodingCollapseStage;
  reason: string;
  score: number;
  receipt: Gpt2GeneratorAttempt["receipt"];
  text: string;
};

export type CodingCollapseResult =
  | {
    ok: true;
    reason: string;
    text: string;
    receipt: Gpt2GeneratorAttempt["receipt"];
    attempts: CodingCollapseAttempt[];
  }
  | {
    ok: false;
    reason: string;
    receipt: Gpt2GeneratorAttempt["receipt"];
    attempts: CodingCollapseAttempt[];
  };

export async function runCodingCollapse(args: {
  basePrompt: string;
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
  witness: Witness;
  repoContext?: CodingRepoContext | null;
}): Promise<CodingCollapseResult> {
  const candidates = buildCodingCollapseCandidates(args.basePrompt, args.contract, args.intentSpec, args.repoContext ?? null);
  const attempts: CodingCollapseAttempt[] = [];
  const survivors: Array<CodingCollapseAttempt> = [];

  for (const candidate of candidates) {
    const generated = candidate.source === "direct"
      ? await buildDirectAttempt(candidate)
      : await runGpt2GeneratorOnly({
        prompt: candidate.prompt ?? "",
        options: candidate.options ?? buildCandidateOptions(220, 48, 0.0, false),
      });
    if (!generated.ok) {
      const classified = classifyCodingFailureDimension(generated.receipt.generationFailureClass);
      attempts.push({
        candidateId: candidate.id,
        label: candidate.label,
        ok: false,
      stage: "pi",
      reason: `${classified.dimension}:${classified.classId}:${generated.receipt.generationFailureClass}`,
        score: 0,
        receipt: {
          ...generated.receipt,
          generationDetail: `${generated.receipt.generationDetail}|failure_dimension=${classified.dimension}|failure_class=${classified.classId}`,
        },
        text: "",
      });
      continue;
    }

    const sanitized = generated.text.trim();
    const kappa = await evaluateCandidateKappa({
      text: sanitized,
      contract: args.contract,
      intentSpec: args.intentSpec,
    });
    if (!kappa.ok) {
      const classified = classifyCodingFailureDimension(kappa.reason);
      attempts.push({
        candidateId: candidate.id,
        label: candidate.label,
        ok: false,
        stage: "kappa",
        reason: `${classified.dimension}:${classified.classId}:${kappa.reason}`,
        score: 0,
        receipt: {
          ...generated.receipt,
          generationDetail: `${generated.receipt.generationDetail}|failure_dimension=${classified.dimension}|failure_class=${classified.classId}|kappa=fail`,
        },
        text: sanitized,
      });
      continue;
    }

    const gamma = scoreCandidateGamma({
      text: sanitized,
      contract: args.contract,
      intentSpec: args.intentSpec,
      label: candidate.label,
      repoContext: args.repoContext ?? null,
    });

    const attempt: CodingCollapseAttempt = {
      candidateId: candidate.id,
      label: candidate.label,
      ok: true,
      stage: "gamma",
      reason: "admissible",
      score: gamma,
      receipt: {
        ...generated.receipt,
        generationDetail: `${generated.receipt.generationDetail}|kappa=pass|gamma=${gamma}|candidate=${candidate.label}`,
      },
      text: sanitized,
    };
    attempts.push(attempt);
    survivors.push(attempt);
  }

  if (survivors.length === 0) {
    const fallback = selectBestFailure(attempts);
    return {
      ok: false,
      reason: fallback?.reason ?? "context:C0_SPEC_GAP:collapse_no_survivor",
      receipt: fallback?.receipt ?? buildCollapseFailureReceipt("collapse_no_survivor"),
      attempts,
    };
  }

  const winner = survivors.sort((a, b) => b.score - a.score)[0];
  return {
    ok: true,
    reason: `coding_collapse_survivor:${winner.label}`,
    text: winner.text,
    receipt: {
      ...winner.receipt,
      generationDetail: `${winner.receipt.generationDetail}|pi=selected|survivors=${survivors.length}`,
    },
    attempts,
  };
}

function buildCodingCollapseCandidates(
  basePrompt: string,
  contract: CodingSkeletonContract,
  intentSpec: CodingIntentSpec,
  repoContext: CodingRepoContext | null,
): CodingCollapseCandidate[] {
  const wantsTests = contract.wantsTests;
  const language = contract.language;
  const specConstraints = intentSpec.constraints.join(", ") || "none";
  const witnessLine = contract.witnessSet.join(", ") || "fenced_code";
  const graphs = buildCodingProjectGraphs({ contract, intentSpec });
  const directEmitters = buildDirectCodingEmitterCandidates({ contract, intentSpec });
  const familyCandidates: CodingCollapseCandidate[] = [];
  const repoSummaryLine = repoContext
    ? `Repo context: ${repoContext.summary.join(" | ")}.`
    : "Repo context: none.";
  const repoGraphLine = repoContext
    ? `Repo graph: hot_modules=${repoContext.moduleGraph.hotModules.join(",") || "none"}; internal_imports=${repoContext.moduleGraph.internalImports.slice(0, 12).join(",") || "none"}.`
    : "Repo graph: none.";
  const repoBoundaryLine = repoContext
    ? `Repo boundaries: entry_to_routes=${repoContext.moduleGraph.boundaryHints.entryToRoutes.slice(0, 4).join(",") || "none"}; entry_to_services=${repoContext.moduleGraph.boundaryHints.entryToServices.slice(0, 4).join(",") || "none"}; routes_to_models=${repoContext.moduleGraph.boundaryHints.routesToModels.slice(0, 4).join(",") || "none"}; services_to_models=${repoContext.moduleGraph.boundaryHints.servicesToModels.slice(0, 4).join(",") || "none"}; service_to_auth=${repoContext.moduleGraph.boundaryHints.serviceToAuth.slice(0, 4).join(",") || "none"}; route_to_auth=${repoContext.moduleGraph.boundaryHints.routeToAuth.slice(0, 4).join(",") || "none"}; entry_to_runtime=${repoContext.moduleGraph.boundaryHints.entryToRuntime.slice(0, 4).join(",") || "none"}; parser_to_tokens=${repoContext.moduleGraph.boundaryHints.parserToTokens.slice(0, 4).join(",") || "none"}; compiler_stage_chain=${repoContext.moduleGraph.boundaryHints.compilerStageChain.slice(0, 4).join(",") || "none"}.`
    : "Repo boundaries: none.";

  for (const graph of graphs) {
    familyCandidates.push({
      id: `cand.graph.summary.${graph.family}.${graph.variant}`,
      label: `project_graph_summary_${graph.family}_${graph.variant}`,
      source: "generator",
      prompt: [
        basePrompt,
        "Collapse mode: project_graph_summary.",
        `Project graph: ${summarizeCodingProjectGraph(graph)}.`,
        repoSummaryLine,
        repoGraphLine,
        repoBoundaryLine,
        "Emit code that preserves this file graph and import/export surface exactly.",
      ].join("\n"),
      options: buildCandidateOptions(260, 56, 0.0, false),
    });
  }

  for (const directEmitter of directEmitters) {
    familyCandidates.push({
      id: directEmitter.id,
      label: directEmitter.label,
      source: "direct",
      directCandidate: directEmitter,
    });
  }

  return [
    {
      id: "cand.det",
      label: "deterministic_skeleton",
      source: "generator",
      prompt: [
        basePrompt,
        "Collapse mode: deterministic_skeleton.",
        repoSummaryLine,
        repoGraphLine,
        repoBoundaryLine,
        "Emit the smallest lawful implementation that satisfies the skeleton exactly.",
        "Do not emit optional extras.",
      ].join("\n"),
      options: buildCandidateOptions(220, 48, 0.0, false),
    },
    {
      id: "cand.wit",
      label: "witness_first",
      source: "generator",
      prompt: [
        basePrompt,
        "Collapse mode: witness_first.",
        `Satisfy witnesses first: ${witnessLine}.`,
        repoSummaryLine,
        repoGraphLine,
        repoBoundaryLine,
        wantsTests ? "Implementation block first, test block second." : "Single implementation block only.",
      ].join("\n"),
      options: buildCandidateOptions(260, 56, 0.0, false),
    },
    {
      id: "cand.min",
      label: "minimal_contract",
      source: "generator",
      prompt: [
        basePrompt,
        "Collapse mode: minimal_contract.",
        `Spec constraints: ${specConstraints}.`,
        repoSummaryLine,
        repoGraphLine,
        repoBoundaryLine,
        "Prefer short local reasoning and explicit failure paths.",
      ].join("\n"),
      options: buildCandidateOptions(180, 40, 0.0, false),
    },
    {
      id: "cand.shape",
      label: "shape_locked",
      source: "generator",
      prompt: [
        basePrompt,
        "Collapse mode: shape_locked.",
        `Language is ${language}.`,
        `Family is ${contract.family}.`,
        repoSummaryLine,
        repoGraphLine,
        repoBoundaryLine,
        "Keep the output shape exact and avoid commentary or helper text.",
      ].join("\n"),
      options: buildCandidateOptions(220, 48, 0.1, false),
    },
    ...familyCandidates,
  ];
}

function buildCandidateOptions(
  maxNewTokens: number,
  minNewTokens: number,
  temperature: number,
  doSample: boolean,
): Gpt2GeneratorOptions {
  return {
    maxNewTokens,
    minNewTokens,
    temperature,
    topP: 1.0,
    doSample,
    repetitionPenalty: 1.12,
    noRepeatNgramSize: 4,
  };
}

async function evaluateCandidateKappa(args: {
  text: string;
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
}): Promise<{ ok: boolean; reason: string }> {
  const blocks = extractCodeBlocks(args.text);
  if (blocks.length === 0) {
    return { ok: false, reason: "missing_code_blocks" };
  }
  if (!looksLikeCode(args.text)) {
    return { ok: false, reason: "output_does_not_look_like_code" };
  }
  const substrate = await evaluateCodingCandidate(args.text, args.contract.language);
  if (!substrate.ok) {
    return substrate;
  }
  const witness = validateCodingWitnessSet({ contract: args.contract, text: args.text, blocks });
  if (!witness.ok) {
    return { ok: false, reason: witness.reason };
  }
  const architecture = validateCodingArchitecture({ contract: args.contract, blocks });
  if (!architecture.ok) {
    return { ok: false, reason: architecture.reason };
  }
  const floor = validateCodingFloor({ contract: args.contract, text: args.text });
  if (!floor.ok) {
    return { ok: false, reason: floor.reason };
  }
  const semantics = validateCodingSemantics({
    contract: args.contract,
    intentSpec: args.intentSpec,
    text: args.text,
  });
  if (!semantics.ok) {
    return { ok: false, reason: semantics.reason };
  }
  const logic = validateCodingLogic({
    contract: args.contract,
    intentSpec: args.intentSpec,
    text: args.text,
  });
  if (!logic.ok) {
    return { ok: false, reason: logic.reason };
  }
  const security = validateCodingSecurity({
    contract: args.contract,
    intentSpec: args.intentSpec,
    text: args.text,
  });
  if (!security.ok) {
    return { ok: false, reason: security.reason };
  }
  const state = validateCodingState({
    contract: args.contract,
    intentSpec: args.intentSpec,
    text: args.text,
  });
  if (!state.ok) {
    return { ok: false, reason: state.reason };
  }
  const surface = validateCodingSurface({
    contract: args.contract,
    intentSpec: args.intentSpec,
    text: args.text,
    blocks,
  });
  if (!surface.ok) {
    return { ok: false, reason: surface.reason };
  }
  const design = validateCodingDesign({
    contract: args.contract,
    intentSpec: args.intentSpec,
    text: args.text,
  });
  if (!design.ok) {
    return { ok: false, reason: design.reason };
  }
  const scale = validateCodingScale({
    contract: args.contract,
    intentSpec: args.intentSpec,
    text: args.text,
  });
  if (!scale.ok) {
    return { ok: false, reason: scale.reason };
  }
  const dependencies = validateCodingDependencies({
    contract: args.contract,
    intentSpec: args.intentSpec,
    text: args.text,
  });
  if (!dependencies.ok) {
    return { ok: false, reason: dependencies.reason };
  }
  const grounding = validateCodingGrounding({
    contract: args.contract,
    intentSpec: args.intentSpec,
    text: args.text,
  });
  if (!grounding.ok) {
    return { ok: false, reason: grounding.reason };
  }
  const integration = validateCodingIntegration({
    contract: args.contract,
    intentSpec: args.intentSpec,
    text: args.text,
  });
  if (!integration.ok) {
    return { ok: false, reason: integration.reason };
  }
  const execution = validateCodingExecution({
    contract: args.contract,
    intentSpec: args.intentSpec,
    text: args.text,
  });
  if (!execution.ok) {
    return { ok: false, reason: execution.reason };
  }
  return { ok: true, reason: "ok" };
}

function scoreCandidateGamma(args: {
  text: string;
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
  label: string;
  repoContext: CodingRepoContext | null;
}): number {
  const lower = args.text.toLowerCase();
  const blocks = extractCodeBlocks(args.text);
  let score = 0;

  score += blocks.length * 3;
  score += args.contract.wantsTests && /\bdef test_|pytest|assert\b/.test(lower) ? 4 : 0;
  score += args.contract.wantsApi && /\b@app\.(get|post|put|delete|patch)\b|fastapi|router\./.test(lower) ? 4 : 0;
  score += args.contract.family === "utility" && /\bdef\s+\w+\(/.test(lower) ? 3 : 0;
  score += args.contract.family === "compiler" && /\btoken|lexer|parser|ast|emit|compile\b/.test(lower) ? 3 : 0;
  score += args.contract.family === "game" && /\bupdate\(|render\(|loop\b/.test(lower) ? 3 : 0;
  score += args.contract.family === "app" && (/['"]use client['"]|['"]use server['"]|export default async function page|revalidatepath\(|generatemetadata\(/.test(lower)) ? 4 : 0;
  score += args.contract.family === "refactor" && /\bfrom\s+\w+|import\s+\w+|class\s+\w+|def\s+\w+\(/.test(lower) ? 2 : 0;
  score += args.intentSpec.constraints.includes("readability_first") && !/\blambda\b/.test(lower) ? 1 : 0;
  score += args.label === "witness_first" && args.contract.wantsTests ? 2 : 0;
  score += args.label === "minimal_contract" && args.text.length < 1800 ? 1 : 0;
  if (args.repoContext) {
    const entrypoints = args.repoContext.conventions.entrypoints;
    if (entrypoints.includes("app.py") && /#\s+app\.py|from app import app\b/.test(lower)) score += 2;
    if (entrypoints.includes("main.py") && /#\s+main\.py|from main import app\b/.test(lower)) score += 2;
    if (args.repoContext.conventions.hasServicesModule && /#\s+services?\.py|from services? import\b/.test(lower)) score += 2;
    if (args.repoContext.conventions.hasRoutesModule && /#\s+routes?\.py|from routes? import\b/.test(lower)) score += 2;
    if (args.repoContext.conventions.hasModelsModule && /#\s+models?\.py|from models? import\b/.test(lower)) score += 2;
    if (args.repoContext.conventions.usesPytest && /\bpytest|def test_/.test(lower)) score += 1;
    if (args.repoContext.conventions.usesFastApi && /\bfastapi\b/.test(lower)) score += 1;
    if (args.repoContext.conventions.usesSqlAlchemy && /\bsqlalchemy\b/.test(lower)) score += 1;
    if (args.repoContext.conventions.usesPygame && /\bpygame\b/.test(lower)) score += 1;
    if (args.repoContext.moduleGraph.boundaryHints.entryToRoutes.length > 0 && /from routes? import|import routes?\b/.test(lower)) score += 2;
    if (args.repoContext.moduleGraph.boundaryHints.entryToServices.length > 0 && /from services? import|import services?\b/.test(lower)) score += 2;
    if (args.repoContext.moduleGraph.boundaryHints.routesToModels.length > 0 && /from models? import|import models?\b/.test(lower)) score += 2;
    if (args.repoContext.moduleGraph.boundaryHints.servicesToModels.length > 0 && /from models? import|import models?\b/.test(lower)) score += 2;
    if (args.repoContext.moduleGraph.boundaryHints.serviceToAuth.length > 0 && /from (auth|auth_service|security) import|import (auth|auth_service|security)\b/.test(lower)) score += 2;
    if (args.repoContext.moduleGraph.boundaryHints.routeToAuth.length > 0 && /from (auth|auth_service|security) import|import (auth|auth_service|security)\b/.test(lower)) score += 2;
    if (args.repoContext.moduleGraph.boundaryHints.entryToRuntime.length > 0 && /from (runtime|loop|state|entities) import|import (runtime|loop|state|entities)\b/.test(lower)) score += 2;
    if (args.repoContext.moduleGraph.boundaryHints.parserToTokens.length > 0 && /from (tokens|ast_nodes?) import|import (tokens|ast_nodes?)\b/.test(lower)) score += 2;
    if (args.repoContext.moduleGraph.boundaryHints.compilerStageChain.length > 0 && /from (frontend|backend|emit|emitter|lexer|parser|tokens|ast_nodes?) import|import (frontend|backend|emit|emitter|lexer|parser|tokens|ast_nodes?)\b/.test(lower)) score += 2;
    const hotModules = args.repoContext.moduleGraph.hotModules;
    for (const hot of hotModules.slice(0, 4)) {
      const hotStem = hot.split(".").pop();
      if (hotStem && new RegExp(`\\b${escapeRegex(hotStem)}\\b`).test(lower)) {
        score += 1;
      }
    }
    const existingModuleHits = args.repoContext.moduleGraph.modules
      .filter((module) => {
        const stem = module.split(".").pop();
        return stem && new RegExp(`\\b${escapeRegex(stem)}\\b`).test(lower);
      })
      .length;
    score += Math.min(existingModuleHits, 3);
  }

  return score;
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

function looksLikeCode(text: string): boolean {
  if (text.includes("```")) return true;
  return /\b(def |class |import |from |return |if |for |while |const |function )/.test(text);
}

function selectBestFailure(attempts: CodingCollapseAttempt[]): CodingCollapseAttempt | null {
  if (attempts.length === 0) return null;
  return attempts.sort((a, b) => failurePriority(a.reason) - failurePriority(b.reason))[0];
}

function failurePriority(reason: string): number {
  if (/algorithm:.*timeout/.test(reason)) return 5;
  if (/syntax:.*missing_code_blocks|syntax:.*empty_generation/.test(reason)) return 10;
  if (/logic:.*witness_failed/.test(reason)) return 20;
  if (/architecture:.*architecture_|architecture:.*missing_export|architecture:.*circular_dependency/.test(reason)) return 30;
  if (/safety:.*floor_failed|algorithm:.*floor_failed/.test(reason)) return 40;
  if (/syntax:.*python_|logic:.*python_/.test(reason)) return 50;
  return 100;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildCollapseFailureReceipt(reason: string): Gpt2GeneratorAttempt["receipt"] {
  return {
    provider: "gpt2-runtime",
    model: "gpt2",
    callId: "coding-collapse-failure",
    inputDigest: `coding-collapse:${reason}`,
    at: new Date().toISOString(),
    generationStatus: "fallback",
    generationFailureClass: "invalid_response",
    generationDetail: `coding_collapse_failure:${reason}`,
  };
}

async function buildDirectAttempt(candidate: CodingCollapseCandidate): Promise<Gpt2GeneratorAttempt> {
  const materialized = candidate.directCandidate
    ? await materializeDirectCodingCandidate(candidate.directCandidate)
    : { text: "", usedGenerator: 0, usedFallback: 0 };
  return {
    ok: true,
    text: materialized.text,
    receipt: {
      provider: "gpt2-runtime",
      model: "gpt2",
      callId: `${candidate.id}:direct`,
      inputDigest: `direct:${candidate.id}`,
      at: new Date().toISOString(),
      generationStatus: "generated",
      generationFailureClass: "none",
      generationDetail: `direct_emitter:${candidate.label}|slot_generator=${materialized.usedGenerator}|slot_fallback=${materialized.usedFallback}`,
    },
  };
}
