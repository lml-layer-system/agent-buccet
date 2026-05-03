import { extractPatternTail, stripTrailingPunctuation } from "./track-extractor-entropy.ts";
import { canonicalizeTrackLiteral, passesTrackMeaningGate } from "./track-extractor-negative.ts";
import type { DocumentLawBlock } from "./track-extractor-types.ts";
import type { BoundaryExpressionCorridor } from "./types.ts";

export type ExpressionTrackMeaning = {
  profile?: string;
  corridor?: BoundaryExpressionCorridor;
  invariantLabel?: string;
};

const PROFILE_CORRIDORS: Record<string, BoundaryExpressionCorridor> = {
  archival: {
    register: "archival",
    disallowFirstPerson: true,
    disallowSecondPerson: true,
    disallowMetaphor: true,
    disallowSubjectivity: true,
    disallowHype: true,
    disallowExclamation: true,
    maxSentenceWords: 18,
  },
  formal: {
    register: "formal",
    disallowHype: true,
    disallowSlang: true,
    disallowExclamation: true,
    maxSentenceWords: 22,
  },
  neutral: {
    register: "neutral",
    disallowSubjectivity: true,
    disallowHype: true,
    disallowExclamation: true,
    maxSentenceWords: 22,
  },
  factual: {
    register: "factual",
    disallowFirstPerson: true,
    disallowSecondPerson: true,
    disallowMetaphor: true,
    disallowSubjectivity: true,
    disallowHype: true,
    disallowExclamation: true,
    maxSentenceWords: 20,
  },
  technical: {
    register: "technical",
    disallowMetaphor: true,
    disallowSubjectivity: true,
    disallowHype: true,
    disallowSlang: true,
    disallowExclamation: true,
    maxSentenceWords: 24,
  },
  direct: {
    register: "direct",
    disallowMetaphor: true,
    disallowSubjectivity: true,
    disallowHype: true,
    disallowExclamation: true,
    maxSentenceWords: 14,
  },
};

const FIRST_PERSON_REGEX = /\b(?:i|me|my|mine|we|us|our|ours)\b/i;
const SECOND_PERSON_REGEX = /\b(?:you|your|yours)\b/i;
const METAPHOR_REGEX = /\b(?:like a|as if|as though|phoenix|mythic|legendary)\b/i;
const SUBJECTIVITY_REGEX =
  /\b(?:i think|i believe|obviously|clearly|perhaps|maybe|probably|seems?|feels?)\b/i;
const HYPE_REGEX =
  /\b(?:amazing|awesome|incredible|unforgettable|fantastic|super|epic|legendary)\b/i;
const SLANG_REGEX = /\b(?:kinda|sorta|heck|damn|gonna|wanna)\b/i;

export function normalizeExpressionProfile(raw: string): string {
  return canonicalizeTrackLiteral(stripTrailingPunctuation(raw))
    .replace(/\b(?:tone|style|expression|voice)\b$/i, "")
    .trim();
}

export function isKnownExpressionProfile(profile: string): boolean {
  return Boolean(PROFILE_CORRIDORS[profile.trim().toLowerCase()]);
}

export function extractExpressionFieldsFromSentence(sentence: string): string[] {
  return extractPatternTail(sentence, [
    /\b(?:speak|respond|write|talk)\s+(?:in|with|like)\s+(.+)/i,
    /\b(?:tone|style|expression|voice)\s+(?:is|must be|should be)\s+(.+)/i,
  ]);
}

export function collapseExpressionTrackMeaning(args: {
  block: DocumentLawBlock;
  expressionProfile?: string;
}): ExpressionTrackMeaning {
  const profile = args.expressionProfile
    ? normalizeExpressionProfile(args.expressionProfile)
    : undefined;
  if (!profile) {
    return {};
  }
  if (!passesTrackMeaningGate(profile, "expression")) {
    return {};
  }
  const corridor = deriveExpressionCorridor(profile);
  if (!corridor) {
    return {};
  }
  const explicit = args.block.fields.invariant?.find(Boolean)?.trim();
  return {
    profile: isKnownExpressionProfile(profile) ? profile : undefined,
    corridor,
    invariantLabel: explicit || `Use expression profile: ${profile}`,
  };
}

export function deriveExpressionCorridor(raw: string): BoundaryExpressionCorridor | null {
  const normalized = normalizeExpressionProfile(raw);
  const preset = PROFILE_CORRIDORS[normalized.toLowerCase()];
  if (preset) {
    return { ...preset };
  }

  const corridor: BoundaryExpressionCorridor = {};
  const lower = normalized.toLowerCase();

  if (/\barchival\b/.test(lower)) corridor.register = "archival";
  else if (/\bformal\b/.test(lower)) corridor.register = "formal";
  else if (/\bneutral\b/.test(lower)) corridor.register = "neutral";
  else if (/\bfactual\b/.test(lower)) corridor.register = "factual";
  else if (/\btechnical\b/.test(lower)) corridor.register = "technical";
  else if (/\bdirect\b/.test(lower)) corridor.register = "direct";

  if (/\b(?:impersonal|no first person|without first person)\b/.test(lower))
    corridor.disallowFirstPerson = true;
  if (/\b(?:impersonal|no second person|without second person)\b/.test(lower))
    corridor.disallowSecondPerson = true;
  if (/\b(?:no metaphor|without metaphor|literal)\b/.test(lower)) corridor.disallowMetaphor = true;
  if (/\b(?:objective|factual|no subjectivity|without subjectivity)\b/.test(lower))
    corridor.disallowSubjectivity = true;
  if (/\b(?:no hype|without hype|non-promotional|not promotional)\b/.test(lower))
    corridor.disallowHype = true;
  if (/\b(?:no slang|without slang)\b/.test(lower)) corridor.disallowSlang = true;
  if (/\b(?:no exclamation|without exclamation|calm)\b/.test(lower))
    corridor.disallowExclamation = true;
  if (/\b(?:brief|concise|tight)\b/.test(lower)) corridor.maxSentenceWords = 14;
  else if (/\b(?:compact|controlled)\b/.test(lower)) corridor.maxSentenceWords = 18;

  return Object.keys(corridor).length > 0 ? corridor : null;
}

export function checkExpressionCorridor(args: {
  profile?: string;
  corridor?: BoundaryExpressionCorridor;
  output: string;
}): string | null {
  const corridor = args.corridor ?? (args.profile ? deriveExpressionCorridor(args.profile) : null);
  if (!corridor) {
    const label = args.profile?.trim().toLowerCase() ?? "unspecified";
    return `output exits the approved execution corridor (expression corridor '${label}' is not materialized for runtime enforcement)`;
  }
  if (corridor.disallowFirstPerson && FIRST_PERSON_REGEX.test(args.output)) {
    return "output exits the approved execution corridor (first-person expression is forbidden)";
  }
  if (corridor.disallowSecondPerson && SECOND_PERSON_REGEX.test(args.output)) {
    return "output exits the approved execution corridor (second-person expression is forbidden)";
  }
  if (corridor.disallowMetaphor && METAPHOR_REGEX.test(args.output)) {
    return "output exits the approved execution corridor (metaphorical expression is forbidden)";
  }
  if (corridor.disallowSubjectivity && SUBJECTIVITY_REGEX.test(args.output)) {
    return "output exits the approved execution corridor (subjective expression is forbidden)";
  }
  if (corridor.disallowHype && HYPE_REGEX.test(args.output)) {
    return "output exits the approved execution corridor (hype expression is forbidden)";
  }
  if (corridor.disallowSlang && SLANG_REGEX.test(args.output)) {
    return "output exits the approved execution corridor (slang expression is forbidden)";
  }
  if (corridor.disallowExclamation && /!/.test(args.output)) {
    return "output exits the approved execution corridor (exclamation emphasis is forbidden)";
  }
  if (corridor.maxSentenceWords) {
    const sentences = args.output
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    const exceeds = sentences.some(
      (sentence) => sentence.split(/\s+/).filter(Boolean).length > corridor.maxSentenceWords!,
    );
    if (exceeds) {
      return `output exits the approved execution corridor (sentence exceeds ${corridor.maxSentenceWords} words)`;
    }
  }
  return null;
}

export function describeExpressionCorridor(profile: string): string {
  const normalized = profile.trim().toLowerCase();
  const corridor = deriveExpressionCorridor(normalized);
  return corridor?.register ?? normalized;
}

export function buildExpressionInvariantLabel(
  block: DocumentLawBlock,
  expressionProfile: string | undefined,
): string | null {
  return (
    collapseExpressionTrackMeaning({
      block,
      expressionProfile,
    }).invariantLabel ?? null
  );
}
