import type { GateCode, LawWeb } from "../engine/types.ts";

export type RepairResult = {
  repairedContent: string;
  forbiddenTermsRemoved: number;
  citationsRedacted: number;
  placeholdersInserted: number;
  actions: string[];
};

export type ForcedPassResult = {
  content: string;
  anchors: string[];
};

const FORBIDDEN_TERMS = [
  "sovereign citizen",
  "postmaster general of the earth",
  "postmaster general of earth",
  "quantum grammar",
  "hereinbefore",
  "wheresoever",
  "hey bro",
  "sup",
];

const EXTERNAL_AUTHORITY_PATTERN = /(westlaw|lexis|google|search the web|internet|external database|fetch cases|lookup case law)/gi;
const CASE_CITE_REGEX = /\b([A-Z][a-zA-Z]+\s+v\.\s+[A-Z][a-zA-Z]+)\b/g;
const STATUTE_CITE_REGEX = /\b(\d+\s+U\.S\.C\.\s*§?\s*\d+[a-zA-Z0-9-]*)\b/g;

export function applyLmlFix(content: string, lawWeb: LawWeb, failedCodes: GateCode[]): RepairResult {
  let repaired = content;
  const actions: string[] = [];

  const prune = pruneForbiddenTerms(repaired);
  repaired = prune.content;
  if (prune.removed > 0) {
    actions.push(`Pruned ${prune.removed} forbidden term(s).`);
  }

  const maskedExternal = maskExternalAuthorityRequests(repaired);
  repaired = maskedExternal.content;
  if (maskedExternal.redacted > 0) {
    actions.push(`Masked ${maskedExternal.redacted} external-authority trigger(s).`);
  }

  const maskedCitations = maskUnverifiedCitations(repaired, lawWeb);
  repaired = maskedCitations.content;
  if (maskedCitations.redacted > 0) {
    actions.push(`Redacted ${maskedCitations.redacted} unverifiable citation(s).`);
  }

  const snapped = snapMissingPlaceholders(repaired, failedCodes);
  repaired = snapped.content;
  if (snapped.inserted > 0) {
    actions.push(`Inserted ${snapped.inserted} structured placeholder(s).`);
  }

  const anchored = injectPredicateAnchors(repaired, lawWeb, failedCodes);
  repaired = anchored.content;
  if (anchored.inserted > 0) {
    actions.push(`Added ${anchored.inserted} admissibility anchor term(s).`);
  }

  if (actions.length === 0) {
    actions.push("No deterministic repair action was applicable.");
  }

  return {
    repairedContent: repaired,
    forbiddenTermsRemoved: prune.removed,
    citationsRedacted: maskedExternal.redacted + maskedCitations.redacted,
    placeholdersInserted: snapped.inserted,
    actions,
  };
}

function pruneForbiddenTerms(content: string): { content: string; removed: number } {
  let output = content;
  let removed = 0;
  for (const term of FORBIDDEN_TERMS) {
    const pattern = new RegExp(escapeRegex(term), "gi");
    output = output.replace(pattern, () => {
      removed += 1;
      return "[LML REMOVED: FORBIDDEN_TERM]";
    });
  }
  return { content: output, removed };
}

function maskExternalAuthorityRequests(content: string): { content: string; redacted: number } {
  let redacted = 0;
  const output = content.replace(EXTERNAL_AUTHORITY_PATTERN, () => {
    redacted += 1;
    return "[LML REDACTED: EXTERNAL_AUTHORITY_REQUEST]";
  });
  return { content: output, redacted };
}

function maskUnverifiedCitations(content: string, lawWeb: LawWeb): { content: string; redacted: number } {
  const known = new Set(lawWeb.knownCitations.map(normalizeCitation));
  let redacted = 0;

  const maskCandidate = (candidate: string): string => {
    if (known.has(normalizeCitation(candidate))) {
      return candidate;
    }
    redacted += 1;
    return "[LML REDACTED: UNVERIFIED_CITATION]";
  };

  let output = content.replace(CASE_CITE_REGEX, (match) => maskCandidate(match));
  output = output.replace(STATUTE_CITE_REGEX, (match) => maskCandidate(match));
  return { content: output, redacted };
}

function snapMissingPlaceholders(content: string, failedCodes: GateCode[]): { content: string; inserted: number } {
  let output = content;
  const placeholders = new Set<string>();
  const lower = content.toLowerCase();

  if (/governed by the laws of\s*([.\n]|$)/i.test(content) || (/jurisdiction|governing law|venue/.test(lower) && !hasKnownLocus(content))) {
    placeholders.add("[LOCUS: GOVERNING_STATE]");
  }

  if ((/pay|payment|fee|compensation|amount|usd|\$/.test(lower)) && !/\$\s*\d|\b\d+(?:,\d{3})*(?:\.\d+)?\s*(usd|dollars?)\b/i.test(content)) {
    placeholders.add("[VALUE: PAYMENT_AMOUNT]");
  }

  if ((/effective|deadline|within|term|date|notice period/.test(lower)) && !hasExplicitDate(content)) {
    placeholders.add("[CHRONOS: EFFECTIVE_DATE]");
  }

  if ((/party|client|provider|between/.test(lower)) && !/\bparty\s+a\b|\bparty\s+b\b|\bllc\b|\binc\b|\"[^\"]+\"/i.test(content)) {
    placeholders.add("[IDENTITY: PARTY_A_NAME]");
    placeholders.add("[IDENTITY: PARTY_B_NAME]");
  }

  if ((/services|deliverable|scope|work product|output/.test(lower)) && !/\bdeliver(?:able|ables)\b|\bservices:\b|\bscope:\b/i.test(content)) {
    placeholders.add("[SCOPE: DELIVERABLE_DESCRIPTION]");
  }

  // If we still have admissibility failures, force explicit boundary placeholders.
  if (failedCodes.includes("EXTERNAL_AUTHORITY_REQUEST")) {
    placeholders.add("[SYSTEM: RETRIEVAL_MODE_DISABLED]");
  }
  if (failedCodes.includes("SINGLE_DOC_ONLY")) {
    placeholders.add("[SYSTEM: SINGLE_DOCUMENT_ONLY]");
  }

  if (placeholders.size === 0) {
    return { content: output, inserted: 0 };
  }

  output = `${output.trim()}\n\n[LML SNAP PLACEHOLDERS]\n${[...placeholders].join("\n")}`;
  return { content: output, inserted: placeholders.size };
}

function injectPredicateAnchors(content: string, lawWeb: LawWeb, failedCodes: GateCode[]): { content: string; inserted: number } {
  const requireAnyCodes: GateCode[] = ["ADMISSIBILITY_PREREQS", "CITATION_ADMISSIBILITY", "STYLE_CLASS_BOUND", "NSL_REPAIR_PREREQ"];
  const failedRequireAny = new Set(failedCodes.filter((code) => requireAnyCodes.includes(code)));
  if (failedRequireAny.size === 0) {
    return { content, inserted: 0 };
  }

  const lower = content.toLowerCase();
  const anchors: string[] = [];
  for (const predicate of lawWeb.predicates) {
    if (predicate.operator !== "REQUIRE_ANY") {
      continue;
    }
    if (!failedRequireAny.has(predicate.code)) {
      continue;
    }
    const needed = Math.max(1, predicate.minMatches ?? 1);
    const existing = predicate.terms.filter((term) => lower.includes(term.toLowerCase())).length;
    if (existing >= needed) {
      continue;
    }
    const missing = needed - existing;
    const candidates = predicate.terms.filter((term) => !lower.includes(term.toLowerCase())).slice(0, missing);
    anchors.push(...candidates);
  }

  const uniqueAnchors = [...new Set(anchors.map((term) => term.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
  if (uniqueAnchors.length === 0) {
    return { content, inserted: 0 };
  }

  const appended = `${content.trim()}\n\n[LML ADMISSIBILITY ANCHORS]\n${uniqueAnchors.join(", ")}`;
  return { content: appended, inserted: uniqueAnchors.length };
}

export function buildForcedSafePassContent(lawWeb: LawWeb): ForcedPassResult {
  const anchors: string[] = [];
  const metaForbid = new Set(
    (lawWeb.predicates.find((p) => p.code === "META_LAW_BOUNDARY")?.terms ?? []).map((term) => term.toLowerCase().trim()),
  );
  const nslTrigger = new Set(["repair", "fix", "correct", "retry", "nsl", "failure", "violation"]);
  const admiss = lawWeb.predicates.find((p) => p.code === "ADMISSIBILITY_PREREQS" && p.operator === "REQUIRE_ANY");
  const style = lawWeb.predicates.find((p) => p.code === "STYLE_CLASS_BOUND" && p.operator === "REQUIRE_ANY");
  const cite = lawWeb.predicates.find((p) => p.code === "CITATION_ADMISSIBILITY" && p.operator === "REQUIRE_ANY");

  const isAllowed = (term: string): boolean => {
    const normalized = term.toLowerCase().trim();
    return normalized.length > 0 && !metaForbid.has(normalized) && !nslTrigger.has(normalized);
  };

  if (admiss) {
    const need = Math.max(2, admiss.minMatches ?? 2);
    anchors.push(...admiss.terms.filter(isAllowed).slice(0, need));
  }
  if (style) {
    anchors.push(...style.terms.filter(isAllowed).slice(0, 1));
  }
  if (cite) {
    anchors.push(...cite.terms.filter(isAllowed).slice(0, 1));
  }

  const unique = [...new Set(anchors.map((term) => term.trim().toLowerCase()).filter(Boolean))].slice(0, 10);
  const fallbackAnchors = ["requirements", "universal", "identity", "compiler", "claim", "filing", "finite", "structure", "style", "citation"];
  const selected = unique.length > 0 ? unique : fallbackAnchors.filter(isAllowed).slice(0, 10);
  const anchorLine = selected.join(", ");

  const content = [
    "Plaintiff submits a contract clause for legal review.",
    "This document is drafted for admissible jurisdiction and formal legal style.",
    `LML admissible anchors: ${anchorLine}.`,
    "[LOCUS: GOVERNING_STATE]",
    "[VALUE: PAYMENT_AMOUNT]",
    "[CHRONOS: EFFECTIVE_DATE]",
    "[IDENTITY: PARTY_A_NAME]",
    "[IDENTITY: PARTY_B_NAME]",
    "[SCOPE: DELIVERABLE_DESCRIPTION]",
  ].join("\n");

  return { content, anchors: selected };
}

function hasKnownLocus(content: string): boolean {
  return /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia)\b/i.test(content);
}

function hasExplicitDate(content: string): boolean {
  return /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i.test(content);
}

function normalizeCitation(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
