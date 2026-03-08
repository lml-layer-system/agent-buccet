import type { CitationCandidate } from "./types.ts";

const CASE_REGEX = /\b([A-Z][a-zA-Z]+\s+v\.\s+[A-Z][a-zA-Z]+)\b/g;
const STATUTE_REGEX = /\b(\d+\s+U\.S\.C\.\s*§?\s*\d+[a-zA-Z0-9-]*)\b/g;

export function extractCitationCandidates(text: string): CitationCandidate[] {
  const out: CitationCandidate[] = [];

  for (const match of text.matchAll(CASE_REGEX)) {
    const raw = match[1];
    out.push({
      raw,
      normalized: raw.toLowerCase().replace(/\s+/g, " ").trim(),
      type: "case",
    });
  }

  for (const match of text.matchAll(STATUTE_REGEX)) {
    const raw = match[1];
    out.push({
      raw,
      normalized: raw.toLowerCase().replace(/\s+/g, " ").trim(),
      type: "statute",
    });
  }

  return dedupe(out);
}

function dedupe(values: CitationCandidate[]): CitationCandidate[] {
  const seen = new Set<string>();
  const out: CitationCandidate[] = [];
  for (const value of values) {
    if (seen.has(value.normalized)) {
      continue;
    }
    seen.add(value.normalized);
    out.push(value);
  }
  return out;
}

