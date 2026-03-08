import { randomUUID } from "node:crypto";
import type { DemoInput, ExecutablePredicate, GateCode, GateResult, LawWeb, RuntimeOptions, Witness } from "./types.ts";
import { evaluateStyleSafety } from "./compile.ts";
import { normalizeText, tokenize } from "./utils.ts";

export const DEFAULT_RUNTIME_OPTIONS: RuntimeOptions = {
  maxInputChars: 15000,
  maxAttemptsPerInput: 2,
  maxUnknownTokenRatio: 0.42,
};

const attemptLedger = new Map<string, number>();

export function clearLedger(): void {
  attemptLedger.clear();
}

export function runDemoEvaluation(input: DemoInput, lawWeb: LawWeb, options: RuntimeOptions = DEFAULT_RUNTIME_OPTIONS): Witness {
  const normalizedContent = normalizeText(input.content);
  const ledgerKey = normalizedContent;

  const currentAttempts = attemptLedger.get(ledgerKey) ?? 0;
  const nextAttempt = currentAttempts + 1;
  attemptLedger.set(ledgerKey, nextAttempt);

  const gates: GateResult[] = [
    checkDocSize(normalizedContent, options.maxInputChars),
    checkSingleDocOnly(normalizedContent),
    checkExternalAuthorityRequest(normalizedContent),
    checkUnverifiedCitation(normalizedContent, lawWeb.knownCitations),
    checkOntologyDrift(normalizedContent, lawWeb.knownVocabulary, options.maxUnknownTokenRatio),
    checkLegalStyle(normalizedContent),
    ...checkExecutablePredicates(normalizedContent, lawWeb.predicates),
  ];
  const coverageGate = checkLawCoverageComplete(lawWeb);
  if (!coverageGate.pass) {
    gates.push(coverageGate);
  }

  const lockTriggered = nextAttempt > options.maxAttemptsPerInput && hasFail(gates);
  if (lockTriggered) {
    gates.push({
      code: "LEDGER_LOOP_LOCK",
      pass: false,
      detail: `Ledger lock triggered after ${nextAttempt} repeated failed attempts for identical input.`,
    });
  }

  const failedCodes = gates.filter((gate) => !gate.pass).map((gate) => gate.code);
  const repairPlan = buildGuaranteedRepairPlan(failedCodes, lawWeb);
  const explanation = buildOutcomeExplanation(gates, repairPlan);

  return {
    runId: randomUUID(),
    outcome: failedCodes.length === 0 ? "ADMISSIBLE" : "NULL",
    gates,
    repairPlan,
    explanation,
    ledger: {
      attemptCountForInput: nextAttempt,
      locked: lockTriggered,
      lockReason: lockTriggered ? "Repeated identical failures exceeded ledger threshold." : null,
    },
  };
}

function checkDocSize(content: string, maxChars: number): GateResult {
  if (content.length <= maxChars) {
    return {
      code: "DOC_SIZE",
      pass: true,
      detail: `Document size ${content.length} chars within ${maxChars} char limit.`,
    };
  }
  return {
    code: "DOC_SIZE",
    pass: false,
    detail: `Document size ${content.length} exceeds ${maxChars} char demo limit.`,
  };
}

function checkSingleDocOnly(content: string): GateResult {
  const hasSecondDocMarker = /(\n\s*document\s*2\b|\n\s*exhibit\s+[b-z]\b|\n\s*appendix\s+[b-z]\b|\f)/i.test(content);
  if (!hasSecondDocMarker) {
    return {
      code: "SINGLE_DOC_ONLY",
      pass: true,
      detail: "Single-document structure detected.",
    };
  }
  return {
    code: "SINGLE_DOC_ONLY",
    pass: false,
    detail: "Multiple-document markers detected in one submission.",
  };
}

function checkExternalAuthorityRequest(content: string): GateResult {
  const asksExternal = /(westlaw|lexis|google|search the web|internet|external database|fetch cases|lookup case law)/i.test(
    content,
  );
  if (!asksExternal) {
    return {
      code: "EXTERNAL_AUTHORITY_REQUEST",
      pass: true,
      detail: "No external authority retrieval request detected.",
    };
  }
  return {
    code: "EXTERNAL_AUTHORITY_REQUEST",
    pass: false,
    detail: "Request relies on external legal authority retrieval, blocked in demo mode.",
  };
}

function checkUnverifiedCitation(content: string, knownCitations: string[]): GateResult {
  const known = new Set(knownCitations);
  const caseRegex = /\b([A-Z][a-zA-Z]+\s+v\.\s+[A-Z][a-zA-Z]+)\b/g;
  const statuteRegex = /\b(\d+\s+U\.S\.C\.\s*§?\s*\d+[a-zA-Z0-9-]*)\b/g;

  const candidates: string[] = [];
  for (const match of content.matchAll(caseRegex)) {
    candidates.push(match[1].toLowerCase());
  }
  for (const match of content.matchAll(statuteRegex)) {
    candidates.push(match[1].toLowerCase().replace(/\s+/g, " "));
  }

  if (candidates.length === 0) {
    return {
      code: "UNVERIFIED_CITATION",
      pass: true,
      detail: "No citation candidates found in input.",
    };
  }

  const unknown = candidates.filter((candidate) => !known.has(candidate));
  if (unknown.length === 0) {
    return {
      code: "UNVERIFIED_CITATION",
      pass: true,
      detail: `All ${candidates.length} detected citations are locally verifiable.`,
    };
  }

  return {
    code: "UNVERIFIED_CITATION",
    pass: false,
    detail: `${unknown.length}/${candidates.length} detected citations are not locally verifiable.`,
  };
}

function checkOntologyDrift(content: string, knownVocabulary: string[], maxUnknownRatio: number): GateResult {
  const known = new Set(knownVocabulary);
  const tokens = tokenize(content);

  if (tokens.length === 0) {
    return {
      code: "ONTOLOGY_DRIFT",
      pass: false,
      detail: "No admissible legal tokens found in input.",
    };
  }

  let unknown = 0;
  for (const token of tokens) {
    if (!known.has(token)) {
      unknown += 1;
    }
  }

  const ratio = unknown / tokens.length;
  if (ratio <= maxUnknownRatio) {
    return {
      code: "ONTOLOGY_DRIFT",
      pass: true,
      detail: `Unknown token ratio ${(ratio * 100).toFixed(2)}% within ${(maxUnknownRatio * 100).toFixed(2)}% threshold.`,
    };
  }

  return {
    code: "ONTOLOGY_DRIFT",
    pass: false,
    detail: `Unknown token ratio ${(ratio * 100).toFixed(2)}% exceeds ${(maxUnknownRatio * 100).toFixed(2)}% threshold.`,
  };
}

function checkLegalStyle(content: string): GateResult {
  const style = evaluateStyleSafety(content);
  return {
    code: "NON_LEGAL_STYLE",
    pass: style.safe,
    detail: style.detail,
  };
}

function hasFail(gates: GateResult[]): boolean {
  return gates.some((gate) => !gate.pass);
}

function checkLawCoverageComplete(lawWeb: LawWeb): GateResult {
  if (!lawWeb.coverage) {
    return {
      code: "META_LAW_BOUNDARY",
      pass: false,
      detail: "Law coverage metadata missing from compiled law web.",
    };
  }

  if (lawWeb.coverage.complete) {
    return {
      code: "META_LAW_BOUNDARY",
      pass: true,
      detail: "Law coverage complete across source incorporation and required meta-law set.",
    };
  }

  const sourceMissing = lawWeb.coverage.missingSourceLawIds.length;
  const metaMissing = lawWeb.coverage.missingRequiredMetaLawIds.length;
  const reasons = [
    sourceMissing > 0 ? `${sourceMissing} source law(s) unmapped` : "",
    metaMissing > 0 ? `${metaMissing} required meta law(s) missing` : "",
  ].filter(Boolean);
  return {
    code: "META_LAW_BOUNDARY",
    pass: false,
    detail: `Law coverage incomplete: ${reasons.join("; ")}.`,
  };
}

export function summarizeFailureCodes(witness: Witness): GateCode[] {
  return witness.gates.filter((gate) => !gate.pass).map((gate) => gate.code);
}

function checkExecutablePredicates(content: string, predicates: ExecutablePredicate[]): GateResult[] {
  const lower = content.toLowerCase();
  return predicates.map((predicate) => {
    if (canSkipPredicate(predicate, lower)) {
      return {
        code: predicate.code,
        pass: true,
        detail: `Predicate ${predicate.id} skipped (not context-relevant for this input).`,
      };
    }

    const matches = predicate.terms.filter((term) => lower.includes(term.toLowerCase()));
    if (predicate.operator === "REQUIRE_ANY") {
      const minMatches = Math.max(1, predicate.minMatches ?? 1);
      const pass = matches.length >= minMatches;
      return {
        code: predicate.code,
        pass,
        detail: pass
          ? `Predicate ${predicate.id} passed (${matches.length}/${minMatches} required terms matched).`
          : `Predicate ${predicate.id} failed (${matches.length}/${minMatches} required terms matched).`,
      };
    }
    const pass = matches.length === 0;
    return {
      code: predicate.code,
      pass,
      detail: pass
        ? `Predicate ${predicate.id} passed (no forbidden boundary terms detected).`
        : `Predicate ${predicate.id} failed (${matches.length} forbidden boundary terms detected).`,
    };
  });
}

function canSkipPredicate(predicate: ExecutablePredicate, lower: string): boolean {
  if (predicate.code === "CITATION_ADMISSIBILITY") {
    return !/\b(citation|cite|case|statute|authority|court|usc)\b/i.test(lower);
  }
  if (predicate.code === "NSL_REPAIR_PREREQ") {
    return !/\b(repair|fix|correct|retry|nsl|failure|violation)\b/i.test(lower);
  }
  return false;
}

function buildGuaranteedRepairPlan(failedCodes: GateCode[], lawWeb: LawWeb) {
  if (failedCodes.length === 0) {
    return [
      {
        id: "LML-REPAIR-INFO-001",
        code: "ADMISSIBILITY_PREREQS" as GateCode,
        title: "No repairing required",
        instruction: "All checks passed. Proceed to human review/approval.",
      },
    ];
  }

  const mapped = lawWeb.repairMoves.filter((repair) => failedCodes.includes(repair.code));
  const mappedCodes = new Set(mapped.map((repair) => repair.code));

  const fallback = failedCodes
    .filter((code) => !mappedCodes.has(code))
    .map((code, index) => ({
      id: `LML-REPAIR-FALLBACK-${String(index + 1).padStart(3, "0")}`,
      code,
      title: "Repair required before acceptance",
      instruction: fallbackInstructionFor(code),
    }));

  const combined = [...mapped, ...fallback];
  return combined.length > 0
    ? combined
    : [
        {
          id: "LML-REPAIR-FALLBACK-000",
          code: "META_LAW_BOUNDARY" as GateCode,
          title: "Repair required before acceptance",
          instruction: "Input is outside admissible policy boundaries. Revise input and rerun.",
        },
      ];
}

function buildOutcomeExplanation(gates: GateResult[], repairPlan: Witness["repairPlan"]): Witness["explanation"] {
  const failed = gates.filter((gate) => !gate.pass);
  const passed = gates.filter((gate) => gate.pass);

  return {
    blockedReasons: failed.map((gate) => gate.detail),
    acceptedReasons: passed.slice(0, 5).map((gate) => gate.detail),
    lmlRepairingPlan: repairPlan.map((repair) => ({
      title: repair.title,
      instruction: repair.instruction,
      source: repair.id.includes("FALLBACK") || repair.id.includes("INFO") ? "fallback" : "mapped",
    })),
  };
}

function fallbackInstructionFor(code: GateCode): string {
  switch (code) {
    case "DOC_SIZE":
      return "Reduce document size to fit demo limits, then rerun.";
    case "SINGLE_DOC_ONLY":
      return "Submit only one document per run.";
    case "EXTERNAL_AUTHORITY_REQUEST":
      return "Remove requests for external sources in demo mode.";
    case "UNVERIFIED_CITATION":
    case "CITATION_ADMISSIBILITY":
      return "Replace or remove citations that cannot be locally verified in demo mode.";
    case "ONTOLOGY_DRIFT":
      return "Use clearer legal language and reduce unrelated content.";
    case "NON_LEGAL_STYLE":
    case "STYLE_CLASS_BOUND":
      return "Rewrite in legal style and structure.";
    case "NSL_REPAIR_PREREQ":
      return "Add the missing factual inputs required for repairing.";
    case "ADMISSIBILITY_PREREQS":
      return "Satisfy missing admissibility prerequisites and rerun.";
    case "META_LAW_BOUNDARY":
      return "Revise input to stay within policy boundaries.";
    case "LEDGER_LOOP_LOCK":
      return "Change input meaningfully before rerunning to avoid repeat lock.";
    default:
      return "Revise input and rerun.";
  }
}
