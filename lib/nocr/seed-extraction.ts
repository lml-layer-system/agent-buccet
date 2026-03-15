import { createHash } from "node:crypto";
import { runUIC } from "@/lib/snap";
import type { SeedChild } from "@/lib/nocr/types";
import {
  solveQuantumEfue,
  type QuantumEvolutionRule,
  type QuantumRequirement,
  type QuantumWitness,
} from "@/lib/nocr/unified-qe";

export type SeedExtractionResult = {
  quantumSparkCandidateCount: number;
  finiteSeedCount: number;
  seeds: SeedChild[];
};

export type ChatIntentSeedExtractionResult = {
  exactSeedCount: number;
  seeds: SeedChild[];
};

export function extractSeedChildrenFromArtifact(artifact: string): SeedExtractionResult {
  const normalized = artifact.trim();
  if (!normalized) {
    return {
      quantumSparkCandidateCount: 0,
      finiteSeedCount: 0,
      seeds: [],
    };
  }

  const per = runUIC(normalized, undefined, "demo");
  const qe = solveQuantumEfue<ArtifactSeedCandidate>({
    seed: { text: normalized, origin: "efue.sentence" },
    evolutionRules: buildArtifactEvolutionRules(normalized, per),
    requirements: artifactRequirements,
    witnesses: artifactWitnesses,
    maxDepth: 2,
    maxCheck: 512,
    maxAdmissible: 48,
    dedupeKey: (candidate) => candidate.text.trim().toLowerCase(),
    rootStateId: "qe.artifact.root",
  });
  const quantumSparkCandidateCount = qe.stats.generatedStateCount;
  const finiteSeeds = qe.admissible.map((state, index) => materializeSeed(state.content.text, state.content.origin, index));

  return {
    quantumSparkCandidateCount,
    finiteSeedCount: finiteSeeds.length,
    seeds: finiteSeeds,
  };
}

export function extractChatIntentSeedsFromArtifact(artifact: string): ChatIntentSeedExtractionResult {
  const normalized = artifact.trim();
  if (!normalized) {
    return {
      exactSeedCount: 0,
      seeds: [],
    };
  }

  const qe = solveQuantumEfue<ArtifactSeedCandidate>({
    seed: { text: normalized, origin: "chat_uic.sentence" },
    evolutionRules: buildChatIntentEvolutionRules(normalized),
    requirements: [
      {
        name: "min_length",
        predicate: (state) => state.content.text.trim().length >= 8,
      },
    ],
    witnesses: [
      {
        name: "always_exact_chat_lane",
        pattern: () => true,
      },
    ],
    maxDepth: 1,
    maxCheck: 128,
    maxAdmissible: 16,
    dedupeKey: (candidate) => candidate.text.trim().toLowerCase(),
    rootStateId: "qe.chat_intent.root",
  });

  return {
    exactSeedCount: qe.admissible.length,
    seeds: qe.admissible.map((state, index) => materializeSeed(state.content.text, state.content.origin, index)),
  };
}

function materializeSeed(
  text: string,
  origin: SeedChild["origin"],
  rank: number,
): SeedChild {
  const abilityRoute = inferAbilityRoute(text);
  const source = inferSource(abilityRoute);
  const digest = createHash("sha256").update(`${origin}:${text}`).digest("hex").slice(0, 12);
  return {
    id: `seed.extracted.${source}.${digest}`,
    source,
    text,
    abilityRoute,
    origin,
    rank,
  };
}

function inferAbilityRoute(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(coding|python|typescript|javascript|code|api|function|test|pytest|jest|vitest|regex|sql|fastapi|flask)\b/.test(lower)) {
    return "coding.governed";
  }
  if (/\b(search|web|lookup|browse|find online|internet)\b/.test(lower)) {
    return "web_search.governed";
  }
  if (/\b(refuse|blocked|forbidden|must not|illegal|deny)\b/.test(lower)) {
    return "guard.refusal";
  }
  return "chat.governed";
}

function inferSource(abilityRoute: string): SeedChild["source"] {
  if (abilityRoute.startsWith("coding.")) return "coding";
  if (abilityRoute.startsWith("web_search.")) return "web_search";
  if (abilityRoute === "guard.refusal") return "refusal";
  return "chat";
}

type ArtifactSeedCandidate = {
  text: string;
  origin: SeedChild["origin"];
};

function buildArtifactEvolutionRules(
  artifact: string,
  per: ReturnType<typeof runUIC>,
): Array<QuantumEvolutionRule<ArtifactSeedCandidate>> {
  const baseCandidates = collectBaseCandidates(artifact, per);
  return [
    {
      id: "qe.expand.base_candidates",
      apply: (state) => state.depth === 0
        ? baseCandidates.map((candidate, index) => ({
          id: `qe.seed.base.${index + 1}`,
          content: candidate,
          amplitude: originAmplitude(candidate.origin),
        }))
        : [],
    },
    {
      id: "qe.expand.clause_shards",
      apply: (state) => state.depth >= 1
        ? splitCandidateClauses(state.content).map((candidate, index) => ({
          id: `qe.seed.shard.${state.id}.${index + 1}`,
          content: candidate,
          amplitude: Math.max(0.2, state.amplitude * 0.72),
        }))
        : [],
    },
    {
      id: "qe.expand.normalized_variant",
      apply: (state) => state.depth >= 1
        ? buildNormalizedVariants(state.content).map((candidate, index) => ({
          id: `qe.seed.norm.${state.id}.${index + 1}`,
          content: candidate,
          amplitude: Math.max(0.18, state.amplitude * 0.68),
        }))
        : [],
    },
  ];
}

function buildChatIntentEvolutionRules(
  artifact: string,
): Array<QuantumEvolutionRule<ArtifactSeedCandidate>> {
  const exactCandidates = collectChatIntentCandidates(artifact);
  return [
    {
      id: "qe.expand.chat_exact_candidates",
      apply: (state) => state.depth === 0
        ? exactCandidates.map((candidate, index) => ({
          id: `qe.chat.seed.${index + 1}`,
          content: candidate,
          amplitude: originAmplitude(candidate.origin),
        }))
        : [],
    },
  ];
}

function splitArtifactSentences(artifact: string): string[] {
  return unique(
    artifact
      .split(/[\n\r]+|(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 12),
  );
}

function extractDirectiveSeeds(artifact: string): string[] {
  return unique(
    artifact
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length >= 12)
      .filter((line) => /^(must|should|shall|always|never|if |when |do not|cannot|can not|only |all )/i.test(line)),
  );
}

function extractCodeLineSeeds(artifact: string): string[] {
  return unique(
    artifact
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length >= 12)
      .filter((line) => /(=>|::|:=|==|!=|<=|>=|\bdef\b|\bclass\b|\bfunction\b|\breturn\b|\bimport\b|\bconst\b|\blet\b)/.test(line)),
  );
}

function extractMathClauseSeeds(artifact: string): string[] {
  return unique(
    artifact
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length >= 12)
      .filter((line) => /[=+\-*/^]/.test(line) && /\d/.test(line)),
  );
}

const artifactRequirements: Array<QuantumRequirement<ArtifactSeedCandidate>> = [
  {
    name: "min_length",
    predicate: (state) => state.content.text.trim().length >= 12,
  },
  {
    name: "multi_token",
    predicate: (state) => state.content.text.trim().split(/\s+/).length >= 2,
  },
];

const artifactWitnesses: Array<QuantumWitness<ArtifactSeedCandidate>> = [
  {
    name: "typed_seed_origin",
    pattern: (content) => content.origin !== "efue.sentence",
  },
  {
    name: "lawlike_or_route_signal",
    pattern: (content) => /\b(must|should|shall|never|always|law|root|branch|tree|repair|constraint|code|function|test|equation|proof)\b/i.test(content.text),
  },
  {
    name: "structured_symbolic_signal",
    pattern: (content) => /(=>|::|:=|==|!=|<=|>=|[=+\-*/^])/.test(content.text),
  },
];

function collectBaseCandidates(
  artifact: string,
  per: ReturnType<typeof runUIC>,
): ArtifactSeedCandidate[] {
  const ranked = [
    ...per.x.map((text) => ({ text, origin: "quantum_spark.per_x" as const })),
    ...per.delta.map((text) => ({ text, origin: "quantum_spark.delta" as const })),
    ...per.CLAIMS.map((claim) => ({ text: claim.text, origin: "quantum_spark.claim" as const })),
    ...splitArtifactSentences(artifact).map((text) => ({ text, origin: "efue.sentence" as const })),
    ...extractDirectiveSeeds(artifact).map((text) => ({ text, origin: "efue.directive" as const })),
    ...extractCodeLineSeeds(artifact).map((text) => ({ text, origin: "efue.code_line" as const })),
    ...extractMathClauseSeeds(artifact).map((text) => ({ text, origin: "efue.math_clause" as const })),
  ].filter((entry) => entry.text.trim().length >= 12);

  const seen = new Set<string>();
  const ordered: ArtifactSeedCandidate[] = [];
  for (const entry of ranked) {
    const key = entry.text.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(entry);
  }
  return ordered;
}

function collectChatIntentCandidates(artifact: string): ArtifactSeedCandidate[] {
  const ranked = [
    ...splitArtifactSentences(artifact).map((text) => ({ text, origin: "chat_uic.sentence" as const })),
    ...extractDirectiveSeeds(artifact).map((text) => ({ text, origin: "chat_uic.directive" as const })),
    ...extractCodeLineSeeds(artifact).map((text) => ({ text, origin: "chat_uic.code_line" as const })),
    ...extractMathClauseSeeds(artifact).map((text) => ({ text, origin: "chat_uic.math_clause" as const })),
  ].filter((entry) => entry.text.trim().length >= 8);

  const seen = new Set<string>();
  const ordered: ArtifactSeedCandidate[] = [];
  for (const entry of ranked) {
    const key = entry.text.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ordered.push(entry);
  }
  return ordered;
}

function splitCandidateClauses(candidate: ArtifactSeedCandidate): ArtifactSeedCandidate[] {
  return unique(
    candidate.text
      .split(/(?<=[;:])\s+|\s+(?:and|or|then)\s+/i)
      .map((part) => part.trim())
      .filter((part) => part.length >= 12),
  ).map((text) => ({ text, origin: candidate.origin }));
}

function buildNormalizedVariants(candidate: ArtifactSeedCandidate): ArtifactSeedCandidate[] {
  const compact = candidate.text.replace(/\s+/g, " ").trim();
  const withoutOuterQuotes = compact.replace(/^["'`]+|["'`]+$/g, "");
  const variants = [compact, withoutOuterQuotes]
    .filter((text) => text.length >= 12);
  return unique(variants).map((text) => ({ text, origin: candidate.origin }));
}

function originAmplitude(origin: SeedChild["origin"]): number {
  switch (origin) {
    case "chat_uic.sentence":
      return 1.3;
    case "chat_uic.directive":
      return 1.35;
    case "chat_uic.code_line":
    case "chat_uic.math_clause":
      return 1.28;
    case "quantum_spark.per_x":
      return 1.2;
    case "quantum_spark.delta":
      return 1.1;
    case "quantum_spark.claim":
      return 1.15;
    case "efue.directive":
      return 1.05;
    case "efue.code_line":
    case "efue.math_clause":
      return 1.0;
    case "efue.sentence":
    default:
      return 0.92;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
