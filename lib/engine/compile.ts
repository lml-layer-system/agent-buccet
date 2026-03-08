import type { LawRecord } from "../types.ts";
import type { CompiledLaw, CompilePolicy, ExecutablePredicate, LawCoverage, LawWeb, RepairMove } from "./types.ts";
import { normalizeText, tokenize } from "./utils.ts";

const DEFAULT_POLICY: CompilePolicy = {
  floorTarget: 220,
  stateTarget: 15000,
  outputTarget: 15000,
  metaMax: 400,
  strict: true,
  fillMode: "pad",
};

const VOCAB_SIZE = 8000;
const REQUIRED_META_LAW_IDS = ["164", "165", "166", "167", "168", "169"] as const;
const REQUIRED_META_SOURCE_IDS = REQUIRED_META_LAW_IDS.flatMap((lawId) => [
  `LAW-${lawId.padStart(4, "0")}`,
  `CLAW-${lawId.padStart(4, "0")}`,
]);

const META_KEYWORDS = [
  "meta",
  "law of laws",
  "law-on-impact",
  "ontology",
  "invariant",
  "hidden law",
  "consistency",
  "closure",
];

const FLOOR_KEYWORDS = [
  "foundation",
  "floor",
  "axiom",
  "constitution",
  "null state",
  "admissible",
  "constraints",
  "requirements",
  "legal domain",
];

const LEGAL_STYLE_BANNED = ["lol", "bro", "my guy", "gonna", "wanna", "kinda", "sorta"];
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "with",
  "from",
  "this",
  "must",
  "shall",
  "into",
  "only",
  "when",
  "then",
  "have",
  "has",
  "are",
  "can",
  "cannot",
  "will",
  "not",
  "all",
  "any",
  "your",
  "you",
  "our",
  "their",
  "its",
  "was",
  "were",
  "being",
  "been",
  "under",
  "over",
  "within",
  "without",
  "than",
  "they",
  "them",
  "law",
  "laws",
  "legal",
  "output",
  "state",
  "null",
]);

export function buildLawWeb(laws: LawRecord[], policyOverrides: Partial<CompilePolicy> = {}): LawWeb {
  const policy = mergePolicy(policyOverrides);
  validatePolicy(policy);

  const normalized = laws.map((law) => ({
    ...law,
    text: normalizeText(law.text),
    section: normalizeText(law.section),
  }));

  const canonical = normalized.sort((a, b) => a.id.localeCompare(b.id));

  const floorCandidates = canonical.filter((law) =>
    includesKeyword(`${law.sourceFile} ${law.section} ${law.text}`, FLOOR_KEYWORDS),
  );

  const metaCandidates = canonical.filter((law) => includesKeyword(`${law.section} ${law.text}`, META_KEYWORDS));

  const floor = uniqueById([
    ...floorCandidates,
    ...metaCandidates,
    ...canonical,
  ])
    .slice(0, policy.floorTarget)
    .map((law, index) => toCompiledLaw(law, "FLOOR", `FL-${String(index + 1).padStart(5, "0")}`));

  const floorSourceLawIds = new Set(floor.map((law) => law.sourceLawId));

  const rawState = canonical.filter((law) => !floorSourceLawIds.has(law.id)).map((law, index) =>
    toCompiledLaw(law, "STATE", `AS-${String(index + 1).padStart(5, "0")}`),
  );
  const effectivePolicy = computeEffectivePolicy(policy, rawState.length);

  const state = materializeState(rawState, floor, effectivePolicy);

  const output = materializeOutput(state, effectivePolicy);

  if (effectivePolicy.strict && state.length !== output.length) {
    throw new Error(
      `Strict invariant failed: state (${state.length}) must equal output (${output.length}) for bijection.`,
    );
  }

  const requiredMetaFromCorpus = canonical.filter((law) => REQUIRED_META_SOURCE_IDS.includes(law.id));
  const meta = uniqueById([
    ...requiredMetaFromCorpus,
    ...injectMetaLaws(),
    ...metaCandidates,
  ])
    .slice(0, effectivePolicy.metaMax)
    .map((law, index) => toCompiledLaw(law, "META", `MT-${String(index + 1).padStart(5, "0")}`));

  const bijection: Record<string, string> = {};
  for (let i = 0; i < state.length; i += 1) {
    bijection[state[i].id] = output[i].id;
  }

  const knownCitations = collectKnownCitations(normalized);
  const knownVocabulary = collectVocabulary(normalized);
  const predicates = buildExecutablePredicates(canonical);
  const repairMoves = defaultRepairMoves();
  const coverage = buildLawCoverage(canonical, floor, state, meta);

  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    compilePolicy: effectivePolicy,
    sourceStats: {
      totalLaws: laws.length,
      floorCount: floor.length,
      rawStateCount: rawState.length,
      stateCount: state.length,
      outputCount: output.length,
      metaCount: meta.length,
    },
    floor,
    state,
    output,
    meta,
    bijection,
    knownCitations,
    knownVocabulary,
    predicates,
    repairMoves,
    coverage,
  };
}

export function evaluateStyleSafety(text: string): { safe: boolean; detail: string } {
  const lower = text.toLowerCase();
  for (const banned of LEGAL_STYLE_BANNED) {
    if (lower.includes(banned)) {
      return {
        safe: false,
        detail: `Detected non-legal style token: ${banned}`,
      };
    }
  }
  return { safe: true, detail: "Style gate passed." };
}

function materializeState(
  rawState: CompiledLaw[],
  floor: CompiledLaw[],
  policy: CompilePolicy,
): CompiledLaw[] {
  if (rawState.length >= policy.stateTarget) {
    return rawState.slice(0, policy.stateTarget).map((law, index) => ({
      ...law,
      id: `AS-${String(index + 1).padStart(5, "0")}`,
    }));
  }

  if (policy.fillMode === "error") {
    throw new Error(
      `State target ${policy.stateTarget} cannot be met: only ${rawState.length} raw state laws available.`,
    );
  }

  if (rawState.length === 0 && floor.length === 0) {
    throw new Error("Cannot pad state web: both raw state and floor sets are empty.");
  }

  const output: CompiledLaw[] = rawState.map((law) => ({ ...law }));
  let padIndex = 0;
  while (output.length < policy.stateTarget) {
    const seed = rawState.length > 0 ? rawState[padIndex % rawState.length] : floor[padIndex % floor.length];
    const nextIndex = output.length + 1;
    output.push({
      ...seed,
      id: `AS-${String(nextIndex).padStart(5, "0")}`,
      sourceLawId: `PAD-${String(nextIndex).padStart(6, "0")}`,
      sourceFile: "synthetic.pad",
      section: "DETERMINISTIC PAD",
      text: `PAD_DERIVED(${seed.id}) ${seed.text}`,
      tags: [...seed.tags, "PAD_DERIVED"].sort((a, b) => a.localeCompare(b)),
      normative: true,
    });
    padIndex += 1;
  }

  return output.map((law, index) => ({
    ...law,
    id: `AS-${String(index + 1).padStart(5, "0")}`,
  }));
}

function materializeOutput(state: CompiledLaw[], policy: CompilePolicy): CompiledLaw[] {
  if (policy.strict && policy.outputTarget !== policy.stateTarget) {
    throw new Error(
      `Strict invariant failed: outputTarget (${policy.outputTarget}) must equal stateTarget (${policy.stateTarget}).`,
    );
  }

  if (state.length < policy.outputTarget && policy.fillMode === "error") {
    throw new Error(`Output target ${policy.outputTarget} cannot be met from state size ${state.length}.`);
  }

  const usedState = state.slice(0, Math.min(policy.outputTarget, state.length));
  const output: CompiledLaw[] = usedState.map((stateLaw, index) => ({
    ...stateLaw,
    id: `AO-${String(index + 1).padStart(5, "0")}`,
    family: "OUTPUT" as const,
    text: `OUTPUT_TWIN(${stateLaw.id}) ${stateLaw.text}`,
  }));
  return output;
}

function validatePolicy(policy: CompilePolicy): void {
  if (policy.floorTarget < 0 || policy.stateTarget < 0 || policy.outputTarget < 0 || policy.metaMax < 0) {
    throw new Error("Compile policy targets must be non-negative.");
  }
  if (policy.strict && policy.outputTarget !== policy.stateTarget) {
    throw new Error(
      `Strict invariant failed: outputTarget (${policy.outputTarget}) must equal stateTarget (${policy.stateTarget}).`,
    );
  }
}

function mergePolicy(policyOverrides: Partial<CompilePolicy>): CompilePolicy {
  return {
    floorTarget: policyOverrides.floorTarget ?? DEFAULT_POLICY.floorTarget,
    stateTarget: policyOverrides.stateTarget ?? DEFAULT_POLICY.stateTarget,
    outputTarget: policyOverrides.outputTarget ?? DEFAULT_POLICY.outputTarget,
    metaMax: policyOverrides.metaMax ?? DEFAULT_POLICY.metaMax,
    strict: policyOverrides.strict ?? DEFAULT_POLICY.strict,
    fillMode: policyOverrides.fillMode ?? DEFAULT_POLICY.fillMode,
  };
}

function computeEffectivePolicy(policy: CompilePolicy, rawStateCount: number): CompilePolicy {
  const stateTarget = Math.max(policy.stateTarget, rawStateCount);
  const outputTarget = policy.strict
    ? Math.max(policy.outputTarget, stateTarget)
    : policy.outputTarget;

  return {
    ...policy,
    stateTarget,
    outputTarget,
  };
}

function injectMetaLaws(): LawRecord[] {
  const now = "meta-synthetic";
  return [
    {
      id: "LAW-0164",
      sourceFile: now,
      sourcePath: now,
      section: "LAW OF HIDDEN LAWS",
      indexInFile: 1,
      text: "Unknown failure classes always exist. Unknown is never treated as safe and must return typed HOLE.",
      level: "LD1.8",
      dimension: "D1",
      normative: true,
      tags: ["MUST"],
    },
    {
      id: "LAW-0165",
      sourceFile: now,
      sourcePath: now,
      section: "LAW OF FUTURE MUTATION",
      indexInFile: 2,
      text: "Future regime mutation is assumed possible. Stability claims must be time-bounded and re-checked.",
      level: "LD2.8",
      dimension: "D2",
      normative: true,
      tags: ["MUST"],
    },
    {
      id: "LAW-0166",
      sourceFile: now,
      sourcePath: now,
      section: "LAW THAT CREATES LAWS",
      indexInFile: 3,
      text: "Novel recurring patterns must synthesize new enforceable laws or halt output.",
      level: "LD3.8",
      dimension: "D3",
      normative: true,
      tags: ["MUST"],
    },
    {
      id: "LAW-0167",
      sourceFile: now,
      sourcePath: now,
      section: "NO REPEAT WITHOUT COVERAGE",
      indexInFile: 4,
      text: "Repeated novelty without new constraint coverage is illegal and cannot return normal status.",
      level: "LD4.8",
      dimension: "D4",
      normative: true,
      tags: ["MUST"],
    },
    {
      id: "LAW-0168",
      sourceFile: now,
      sourcePath: now,
      section: "AUTHENTICATED UPDATES ONLY",
      indexInFile: 5,
      text: "Lawpack changes require authenticated, signed, and ledger-linked update records.",
      level: "LD5.8",
      dimension: "D5",
      normative: true,
      tags: ["MUST"],
    },
    {
      id: "LAW-0169",
      sourceFile: now,
      sourcePath: now,
      section: "STRICT IMPROVEMENT AFTER SHOCK",
      indexInFile: 6,
      text: "After novelty shock, coverage must increase monotonically or remain in safe mode.",
      level: "LD6.8",
      dimension: "D6",
      normative: true,
      tags: ["MUST"],
    },
    {
      id: "META-INJECT-7",
      sourceFile: now,
      sourcePath: now,
      section: "LEDGER LOOP LOCK",
      indexInFile: 7,
      text: "Repeated identical failures must trigger lock and escalate required correction to avoid infinite retry loops.",
      level: "LD3.8",
      dimension: "D3",
      normative: true,
      tags: ["MUST"],
    },
  ];
}

function defaultRepairMoves(): RepairMove[] {
  return [
    {
      id: "RP-001",
      code: "DOC_SIZE",
      title: "Constrain Document Size",
      instruction: "Reduce content to the smallest legally relevant excerpt under demo size limit.",
    },
    {
      id: "RP-002",
      code: "SINGLE_DOC_ONLY",
      title: "One Document Only",
      instruction: "Submit one standalone document and remove concatenated materials.",
    },
    {
      id: "RP-003",
      code: "EXTERNAL_AUTHORITY_REQUEST",
      title: "Remove External Retrieval Ask",
      instruction: "Rewrite prompt so analysis uses only provided document text and local law web.",
    },
    {
      id: "RP-004",
      code: "UNVERIFIED_CITATION",
      title: "Citations Must Be Verifiable",
      instruction: "Replace or remove citations that cannot be verified in the local admissible citation set.",
    },
    {
      id: "RP-005",
      code: "CITATION_ADMISSIBILITY",
      title: "Add Admissible Citation Form",
      instruction: "Use admissible citation structure and legal authority markers before retry.",
    },
    {
      id: "RP-006",
      code: "ONTOLOGY_DRIFT",
      title: "Reduce Ontology Drift",
      instruction: "Use domain-grounded terms with clear legal semantics and remove ambiguous coined entities.",
    },
    {
      id: "RP-007",
      code: "NON_LEGAL_STYLE",
      title: "Repair Legal Style",
      instruction: "Rewrite into formal legal style; remove slang, conversational framing, and rhetorical fillers.",
    },
    {
      id: "RP-008",
      code: "STYLE_CLASS_BOUND",
      title: "Align to Legal Style Class",
      instruction: "Use formal, impersonal, procedural legal drafting style and avoid creative or conversational tone.",
    },
    {
      id: "RP-009",
      code: "ADMISSIBILITY_PREREQS",
      title: "Add Admissible Legal Anchors",
      instruction: "Provide explicit legal anchors (parties, claims, clauses, relief, or procedure) before retrying.",
    },
    {
      id: "RP-010",
      code: "META_LAW_BOUNDARY",
      title: "Remove Boundary-Bypass Language",
      instruction: "Remove instructions that attempt to bypass, override, or ignore law-web constraints.",
    },
    {
      id: "RP-011",
      code: "NSL_REPAIR_PREREQ",
      title: "Enable Repair Path",
      instruction: "Provide concrete failure context and requested correction target so NSL can apply a valid repair move.",
    },
    {
      id: "RP-012",
      code: "LEDGER_LOOP_LOCK",
      title: "Ledger Lock Recovery",
      instruction: "Make a substantive change to the input before retrying; repeated identical attempts are blocked.",
    },
  ];
}

function buildExecutablePredicates(laws: LawRecord[]): ExecutablePredicate[] {
  const admissibilitySource = laws
    .filter((law) =>
      /\b(admissible|requirements|required|must|shall|legal domain|citation|court|filing|claim|contract|motion)\b/i.test(
        `${law.section} ${law.text}`,
      ),
    )
    .slice(0, 240);

  const admissibilityTerms = topTokensFromLaws(admissibilitySource, 36);

  const metaSource = laws
    .filter((law) => /\b(meta|law of laws|law-on-impact|hidden law|boundary|constraint|repair|bypass|override)\b/i.test(`${law.section} ${law.text}`))
    .slice(0, 240);

  const boundaryTerms = uniqueTerms(
    [
      ...topTokensFromLaws(metaSource, 20),
      "bypass",
      "override",
      "ignore",
      "circumvent",
      "jailbreak",
      "disable",
      "skip",
      "outside",
    ],
    24,
  );

  const citationSource = laws
    .filter((law) => /\b(citation|cited|authority|statute|case|usc|reporter|court)\b/i.test(`${law.section} ${law.text}`))
    .slice(0, 240);
  const citationTerms = uniqueTerms(
    [
      ...topTokensFromLaws(citationSource, 28),
      "v.",
      "u.s.c",
      "section",
      "court",
      "statute",
      "plaintiff",
      "defendant",
    ],
    32,
  );

  const styleSource = laws
    .filter((law) => /\b(style|formal|tone|voice|structure|writing|procedural|transactional|authoritative)\b/i.test(`${law.section} ${law.text}`))
    .slice(0, 240);
  const styleTerms = uniqueTerms(
    [
      ...topTokensFromLaws(styleSource, 24),
      "formal",
      "procedural",
      "authoritative",
      "transactional",
      "impersonal",
      "measured",
      "structure",
      "clause",
    ],
    30,
  );

  const nslSource = laws
    .filter((law) => /\b(nsl|repair|ladder|null staircase|converge|failure|violation|correction)\b/i.test(`${law.section} ${law.text}`))
    .slice(0, 240);
  const nslTerms = uniqueTerms(
    [
      ...topTokensFromLaws(nslSource, 22),
      "repair",
      "failure",
      "violation",
      "correction",
      "converge",
      "constraint",
      "null",
      "boundary",
    ],
    28,
  );

  return [
    {
      id: "PX-ADMISS-001",
      code: "ADMISSIBILITY_PREREQS",
      operator: "REQUIRE_ANY",
      terms: admissibilityTerms.length > 0 ? admissibilityTerms : fallbackAdmissibilityTerms(),
      minMatches: 2,
      description: "Input must include admissible legal anchors derived from corpus law requirements.",
      sourceLawIds: admissibilitySource.map((law) => law.id),
    },
    {
      id: "PX-META-001",
      code: "META_LAW_BOUNDARY",
      operator: "FORBID_ANY",
      terms: boundaryTerms,
      description: "Input cannot contain boundary-bypass directives against the law web.",
      sourceLawIds: metaSource.map((law) => law.id),
    },
    {
      id: "PX-CITE-001",
      code: "CITATION_ADMISSIBILITY",
      operator: "REQUIRE_ANY",
      terms: citationTerms,
      minMatches: 1,
      description: "Citation-bearing legal prompts must contain admissible citation/authority markers.",
      sourceLawIds: citationSource.map((law) => law.id),
    },
    {
      id: "PX-STYLE-001",
      code: "STYLE_CLASS_BOUND",
      operator: "REQUIRE_ANY",
      terms: styleTerms,
      minMatches: 1,
      description: "Input should remain inside formal legal style-class anchors derived from writing-law corpus.",
      sourceLawIds: styleSource.map((law) => law.id),
    },
    {
      id: "PX-NSL-001",
      code: "NSL_REPAIR_PREREQ",
      operator: "REQUIRE_ANY",
      terms: nslTerms,
      minMatches: 1,
      description: "Repairable requests must include failure/correction context for NSL mapping.",
      sourceLawIds: nslSource.map((law) => law.id),
    },
  ];
}

function topTokensFromLaws(laws: LawRecord[], limit: number): string[] {
  const frequency = new Map<string, number>();
  for (const law of laws) {
    const tokens = tokenize(`${law.section} ${law.text}`);
    for (const token of tokens) {
      if (token.length < 4 || STOPWORDS.has(token)) {
        continue;
      }
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  return [...frequency.entries()]
    .sort((a, b) => {
      if (b[1] === a[1]) {
        return a[0].localeCompare(b[0]);
      }
      return b[1] - a[1];
    })
    .slice(0, limit)
    .map(([token]) => token);
}

function uniqueTerms(input: string[], limit: number): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const term of input) {
    const normalized = term.toLowerCase().trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
    if (output.length >= limit) {
      break;
    }
  }
  return output;
}

function fallbackAdmissibilityTerms(): string[] {
  return [
    "plaintiff",
    "defendant",
    "claim",
    "court",
    "contract",
    "clause",
    "motion",
    "evidence",
    "statute",
    "filing",
    "remedy",
    "jurisdiction",
  ];
}

function collectKnownCitations(laws: LawRecord[]): string[] {
  const citations = new Set<string>();
  const caseRegex = /\b([A-Z][a-zA-Z]+\s+v\.\s+[A-Z][a-zA-Z]+)\b/g;
  const statuteRegex = /\b(\d+\s+U\.S\.C\.\s*§?\s*\d+[a-zA-Z0-9-]*)\b/g;

  for (const law of laws) {
    const text = law.text;
    for (const match of text.matchAll(caseRegex)) {
      citations.add(match[1].toLowerCase());
    }
    for (const match of text.matchAll(statuteRegex)) {
      citations.add(match[1].toLowerCase().replace(/\s+/g, " "));
    }
  }

  return [...citations].sort((a, b) => a.localeCompare(b));
}

function collectVocabulary(laws: LawRecord[]): string[] {
  const frequency = new Map<string, number>();

  for (const law of laws) {
    const tokens = tokenize(`${law.section} ${law.text}`);
    for (const token of tokens) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }

  return [...frequency.entries()]
    .sort((a, b) => {
      if (b[1] === a[1]) {
        return a[0].localeCompare(b[0]);
      }
      return b[1] - a[1];
    })
    .slice(0, VOCAB_SIZE)
    .map(([token]) => token);
}

function toCompiledLaw(law: LawRecord, family: CompiledLaw["family"], id: string): CompiledLaw {
  return {
    id,
    sourceLawId: law.id,
    family,
    sourceFile: law.sourceFile,
    section: law.section,
    text: law.text,
    level: law.level,
    dimension: law.dimension,
    tags: [...law.tags].sort((a, b) => a.localeCompare(b)),
    normative: law.normative,
  };
}

function buildLawCoverage(
  laws: LawRecord[],
  floor: CompiledLaw[],
  state: CompiledLaw[],
  meta: CompiledLaw[],
): LawCoverage {
  const allSourceIds = new Set(laws.map((law) => law.id));
  const incorporatedIds = new Set(
    [...floor, ...state, ...meta]
      .map((law) => law.sourceLawId)
      .filter((value): value is string => Boolean(value)),
  );

  const missingSourceLawIds = [...allSourceIds]
    .filter((id) => !incorporatedIds.has(id))
    .sort((a, b) => a.localeCompare(b));

  const presentRequiredMetaLawIds = REQUIRED_META_LAW_IDS.filter((lawId) => {
    const exactLaw = `LAW-${lawId.padStart(4, "0")}`;
    const exactCanonical = `CLAW-${lawId.padStart(4, "0")}`;
    return meta.some(
      (law) =>
        law.sourceLawId === exactLaw
        || law.sourceLawId === exactCanonical
        || law.text.includes(`law_id\": ${lawId}`)
        || law.text.includes(`law ${lawId}`),
    );
  });
  const missingRequiredMetaLawIds = REQUIRED_META_LAW_IDS.filter((lawId) => !presentRequiredMetaLawIds.includes(lawId));

  return {
    totalSourceLaws: allSourceIds.size,
    incorporatedSourceLaws: allSourceIds.size - missingSourceLawIds.length,
    missingSourceLawIds,
    requiredMetaLawIds: [...REQUIRED_META_LAW_IDS],
    presentRequiredMetaLawIds: [...presentRequiredMetaLawIds],
    missingRequiredMetaLawIds: [...missingRequiredMetaLawIds],
    complete: missingSourceLawIds.length === 0 && missingRequiredMetaLawIds.length === 0,
  };
}

function uniqueById(laws: LawRecord[]): LawRecord[] {
  const seen = new Set<string>();
  const output: LawRecord[] = [];
  for (const law of laws) {
    if (seen.has(law.id)) {
      continue;
    }
    seen.add(law.id);
    output.push(law);
  }
  return output;
}

function includesKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}
