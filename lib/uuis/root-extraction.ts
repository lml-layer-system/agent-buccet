import { createHash } from "node:crypto";
import { getProfileOrThrow } from "@/lib/profiles";
import { runUIC } from "@/lib/snap";
import type { RootParent, RootSourceUnitKind } from "@/lib/nocr/types";
import { encodeUuisEnvelope } from "@/lib/uuis/encoder";

export type RootExtractionResult = {
  roots: RootParent[];
  sourceUnitCount: number;
  identityKernelCount: number;
  legalityRegionCount: number;
  metaLoopCount: number;
  directiveCount: number;
  codeUnitCount: number;
  mathUnitCount: number;
  sentenceCount: number;
  coverage: {
    extractedRootCount: number;
    expansionDelta: number;
    underEnumerated: boolean;
  };
};

export function extractRootParentsFromArtifact(
  artifact: string,
  options?: {
    classification?: "artifact" | "user_law";
    sourceLabel?: string;
  },
): RootExtractionResult {
  const normalized = artifact.trim();
  if (!normalized) {
    return {
      roots: [],
      sourceUnitCount: 0,
      identityKernelCount: 0,
      legalityRegionCount: 0,
      metaLoopCount: 0,
      directiveCount: 0,
      codeUnitCount: 0,
      mathUnitCount: 0,
      sentenceCount: 0,
      coverage: {
        extractedRootCount: 0,
        expansionDelta: 0,
        underEnumerated: false,
      },
    };
  }

  const profile = getProfileOrThrow("DOC_LAW_PROFILE");
  const per = runUIC(normalized, profile, "demo");
  const uuis = encodeUuisEnvelope(per, profile);
  const classification = options?.classification ?? "artifact";
  const sourceLabel = options?.sourceLabel ?? `${classification}:inline`;
  const sourceUnits = collectSourceUnits(normalized, per, uuis);
  const roots = sourceUnits.map((unit, index) =>
    materializeRoot(unit.text, classification, `${sourceLabel}:${unit.kind}:${index + 1}`),
  );

  return {
    roots,
    sourceUnitCount: sourceUnits.length,
    identityKernelCount: uuis.block1_identity_kernel.content.length,
    legalityRegionCount: uuis.block2_legality_region.content.length,
    metaLoopCount: uuis.block7_meta_update_loop.content.length,
    directiveCount: sourceUnits.filter((unit) => unit.kind === "directive").length,
    codeUnitCount: sourceUnits.filter((unit) => unit.kind === "code_unit").length,
    mathUnitCount: sourceUnits.filter((unit) => unit.kind === "math_unit").length,
    sentenceCount: sourceUnits.filter((unit) => unit.kind === "sentence").length,
    coverage: {
      extractedRootCount: roots.length,
      expansionDelta: roots.length - sourceUnits.length,
      underEnumerated: roots.length < sourceUnits.length,
    },
  };
}

function materializeRoot(text: string, classification: "artifact" | "user_law", sourceLabel: string): RootParent {
  const domain = inferDomain(text);
  const digest = createHash("sha256").update(`${classification}:${sourceLabel}:${text}`).digest("hex").slice(0, 12);
  return {
    id: `root.extracted.${domain}.${digest}`,
    domain,
    planet: domain,
    label: summarize(text),
    lawId: `EXTRACTED.${domain.toUpperCase()}.${digest}`,
    provenance: {
      classification,
      extractionStage: "uic_uuis_snap",
      sourceLabel,
      sourceDigest: digest,
    },
  };
}

function inferDomain(text: string): RootParent["domain"] {
  const lower = text.toLowerCase();

  if (/\b(trust|betrayal|loyalty|alliance|guidance|mentor|tribe fit|mirroring|human|identity|self|emotion|thought|intention|will|bro|brodie|girlfriend|gf|wife|husband|friend|patience|angry|mad|sad|apology|relationship|reality check|dont talk down)\b/.test(lower)) {
    return "human";
  }
  if (/\b(quantum|superposition|collapse|parallel admissibility|quantum snap|quantum spark|fixed-point|measurement|decoherence)\b/.test(lower)) {
    return "quantum";
  }
  if (/\b(coding|python|typescript|javascript|web search|search|code|api|function|test)\b/.test(lower)) {
    return "ability";
  }
  if (/\b(route|root|branch|nocr|uuis|snap|law|constraint|repair|projection|ledger|tree|state change|priority|prioritize|most important|without losing any piece|make sense of it|new planet|new universe|novelty)\b/.test(lower)) {
    return "meta";
  }
  return "sun";
}

function summarize(text: string): string {
  return text.length <= 96 ? text : `${text.slice(0, 93)}...`;
}

function collectSourceUnits(
  artifact: string,
  per: ReturnType<typeof runUIC>,
  uuis: ReturnType<typeof encodeUuisEnvelope>,
): Array<{ text: string; kind: RootSourceUnitKind }> {
  const ranked = [
    ...per.CLAIMS.map((claim) => ({ text: claim.text, kind: "claim" as const })),
    ...uuis.block1_identity_kernel.content.map((text) => ({ text, kind: "identity_kernel" as const })),
    ...uuis.block2_legality_region.content.map((text) => ({ text, kind: "legality_region" as const })),
    ...uuis.block7_meta_update_loop.content.map((text) => ({ text, kind: "meta_loop" as const })),
    ...extractDirectiveUnits(artifact).map((text) => ({ text, kind: "directive" as const })),
    ...extractCodeUnits(artifact).map((text) => ({ text, kind: "code_unit" as const })),
    ...extractMathUnits(artifact).map((text) => ({ text, kind: "math_unit" as const })),
    ...extractSentenceUnits(artifact).map((text) => ({ text, kind: "sentence" as const })),
  ].filter((entry) => entry.text.trim().length >= 12);

  const seen = new Set<string>();
  const ordered: Array<{ text: string; kind: RootSourceUnitKind }> = [];
  for (const entry of ranked) {
    const key = entry.text.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(entry);
  }
  return ordered;
}

function extractDirectiveUnits(artifact: string): string[] {
  return artifact
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 12)
    .filter((line) => /^(must|should|shall|always|never|if |when |do not|cannot|can not|only |all )/i.test(line));
}

function extractCodeUnits(artifact: string): string[] {
  const lines = artifact
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 12)
    .filter((line) => /(=>|::|:=|==|!=|<=|>=|\bdef\b|\bclass\b|\bfunction\b|\breturn\b|\bimport\b|\bconst\b|\blet\b)/.test(line));
  return unique(lines);
}

function extractMathUnits(artifact: string): string[] {
  const lines = artifact
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 12)
    .filter((line) => /[=+\-*/^]/.test(line) && /\d/.test(line));
  return unique(lines);
}

function extractSentenceUnits(artifact: string): string[] {
  return unique(
    artifact
      .split(/[\n\r]+|(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 20),
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
