import type { Claim, ClaimTag, Hole, PrimitiveExtractionRecord } from "./types.ts";
import type { RunMode, SnapProfile } from "../profiles/index.ts";

export function runUIC(artifact: string, profile?: SnapProfile, runMode: RunMode = "demo"): PrimitiveExtractionRecord {
  const normalized = normalizeArtifact(artifact);
  const claimTexts = [
    ...atomicize(normalized),
    ...extractCatalogDirectives(normalized),
    ...extractImperativeSentences(normalized),
  ];
  const claims: Claim[] = claimTexts.map((text, index) => ({
    id: `C${String(index + 1).padStart(4, "0")}`,
    text,
    tag: classifyClaim(text),
  }));

  const x = unique(claims.filter((claim) => claim.tag === "STATE").map((claim) => claim.text));
  const I = unique(claims.filter((claim) => claim.tag === "INVARIANT").map((claim) => claim.text));
  const delta = unique(claims.filter((claim) => claim.tag === "DISTURBANCE").map((claim) => claim.text));

  const modules_B = unique(
    claims
      .filter((claim) => claim.tag === "STATE" || claim.tag === "COUPLING")
      .filter((claim) => /\b(module|service|component|engine|stack|kernel|ledger)\b/i.test(claim.text))
      .map((claim) => claim.text),
  );

  const couplings_A = unique(claims.filter((claim) => claim.tag === "COUPLING").map((claim) => claim.text));
  const assumptions = unique(
    claims
      .filter((claim) => /\b(assume|assuming|assumption)\b/i.test(claim.text))
      .map((claim) => claim.text),
  );

  const holes = generateHoles(claims, {
    hasInvariant: I.length > 0,
    hasLegality: claims.some((claim) => /\b(forbidden|illegal|must not|never allowed|admissible)\b/i.test(claim.text)),
    hasDetection: claims.some((claim) => claim.tag === "MEASUREMENT"),
    hasCorrection: claims.some((claim) => claim.tag === "PROCEDURE" && /\b(repair|rollback|restore|recheck|return|quarantine|fix)\b/i.test(claim.text)),
    hasMetaAuth: claims.some((claim) => claim.tag === "META" && /\b(auth|authorize|approval|gate|ledger)\b/i.test(claim.text)),
    hasCouplingTopology: couplings_A.length > 0 && modules_B.length > 0,
  }, runMode);

  const dimensionClaims = profile ? extractDimensionClaims(normalized, profile) : {};
  const identityModel = buildUicIdentityModel(I, delta, couplings_A, claims, holes);

  return {
    profile_id: profile?.profileId,
    profile_version: profile?.version,
    run_mode: runMode,
    dimension_claims: dimensionClaims,
    x,
    I,
    delta,
    A_B: {
      modules_B,
      couplings_A,
    },
    CLAIMS: claims,
    ASSUMPTIONS: assumptions,
    HOLES: holes,
    UIC_IDENTITY: identityModel,
  };
}

function extractDimensionClaims(artifact: string, profile: SnapProfile): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const lower = artifact.toLowerCase();

  for (const dimension of profile.dimensions) {
    const matched = dimension.levels
      .filter((level) => lower.includes(level.toLowerCase()))
      .map((level) => `${dimension.id}:${level}`);
    if (matched.length > 0) {
      out[dimension.id] = matched;
    }
  }

  return out;
}

function normalizeArtifact(input: string): string {
  return input
    .replace(/\u0000/g, "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function atomicize(normalized: string): string[] {
  const raw = normalized
    .split(/\n+/)
    .flatMap((line) => line.split(/[•·]/))
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .flatMap((line) => line.split(/;\s+/))
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const line of raw) {
    if (line.length <= 900) {
      out.push(line);
      continue;
    }
    const pieces = line
      .split(/,\s+|\sand\s+(?=[a-z])|:\s+(?=[a-z])/i)
      .map((piece) => piece.trim())
      .filter(Boolean);
    if (pieces.length > 1) {
      out.push(...pieces);
    } else {
      out.push(line.slice(0, 900));
    }
  }
  return out;
}

function extractImperativeSentences(normalized: string): string[] {
  const out: string[] = [];
  const lines = normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const imperative = /\b(must|must not|shall|shall not|never|always|required|forbidden|cannot|do not|don't|allow ability|forbid ability)\b/i;
  const contextHeadings = lines
    .filter((line) => /^#{1,6}\s+/.test(line) || /^[A-Z][A-Z0-9 _:-]{6,}$/.test(line))
    .slice(0, 200);
  const contextHint = contextHeadings.slice(0, 4).join(" | ");

  for (const line of lines) {
    if (!imperative.test(line)) {
      continue;
    }
    const clean = line.replace(/^[-*>\d.)\s]+/, "").trim();
    if (clean.length < 10) {
      continue;
    }
    if (clean.length > 1000) {
      out.push(clean.slice(0, 1000));
      continue;
    }
    out.push(clean);
  }

  if (out.length > 0 && contextHint) {
    out.push(`Context scope for directives: ${contextHint}.`);
  }
  return out;
}

function extractCatalogDirectives(normalized: string): string[] {
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  let inBehaviorSection = false;
  let inConstraintSection = false;
  const out: string[] = [];

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.includes("BEHAVIORS")) {
      inBehaviorSection = true;
      inConstraintSection = false;
      continue;
    }
    if (upper.includes("CONSTRAINTS")) {
      inConstraintSection = true;
      inBehaviorSection = false;
      continue;
    }
    const levelHeading = line.match(/^#{1,6}\s*LEVEL\s+([0-9.]+)\s*:\s*(.+)$/i);
    if (levelHeading) {
      out.push(`System must enforce level ${levelHeading[1]} ruleset: ${levelHeading[2].trim()}.`);
      continue;
    }
    const phaseHeading = line.match(/^#{1,6}\s*PHASE\s+([0-9]+)\s*:\s*(.+)$/i);
    if (phaseHeading) {
      out.push(`System must execute phase ${phaseHeading[1]} with admissibility gates: ${phaseHeading[2].trim()}.`);
      continue;
    }
    const stepHeading = line.match(/^#{1,6}\s*STEP\s+([0-9]+)\s*:\s*(.+)$/i);
    if (stepHeading) {
      out.push(`System must execute and verify pipeline step ${stepHeading[1]}: ${stepHeading[2].trim()}.`);
      continue;
    }
    const dimensionHeading = line.match(/^#{1,6}\s*DIMENSION\s+([0-9]+)\s*:\s*(.+)$/i);
    if (dimensionHeading) {
      out.push(`System must enforce dimension ${dimensionHeading[1]} constraints: ${dimensionHeading[2].trim()}.`);
      continue;
    }
    const groupHeading = line.match(/^#{1,6}\s*GROUP\s+([0-9]+)\s*:\s*(.+)$/i);
    if (groupHeading) {
      out.push(`System must cover group ${groupHeading[1]} failure surface: ${groupHeading[2].trim()}.`);
      continue;
    }
    const classHeading = line.match(/^#{1,6}\s*([A-Z]{1,6}\d+)\s*:\s*(.+)$/i);
    if (classHeading) {
      out.push(`System must install detection and return path for class ${classHeading[1]}: ${classHeading[2].trim()}.`);
      continue;
    }
    const completionHeading = line.match(/^#{1,6}\s*THE COMPLETE ([A-Z0-9 \-]+)$/i);
    if (completionHeading) {
      out.push(`System must enforce completeness invariant for: ${completionHeading[1].trim().toLowerCase()}.`);
      continue;
    }
    if (/^[A-Z]+\./.test(line) && !/^\d+\)/.test(line) && !line.includes("META-LAWS")) {
      inBehaviorSection = false;
      inConstraintSection = false;
    }

    const numbered = line.match(/^(\d+)\)\s+(.+)$/);
    if (!numbered) {
      continue;
    }

    const item = numbered[2].replace(/—.*/, "").trim();
    if (item.length < 3) {
      continue;
    }

    if (inBehaviorSection) {
      out.push(`System must model and enforce behavior class ${numbered[1]}: ${item}.`);
      continue;
    }
    if (inConstraintSection) {
      out.push(`System must enforce constraint class ${numbered[1]}: ${item}.`);
      continue;
    }
  }

  return out;
}

function classifyClaim(text: string): ClaimTag {
  const lower = text.toLowerCase();
  const policyPrefix =
    /^(tone|style|voice|persona|expression|behavior|speaking|speak|address|allow ability|allow|forbid|ban|constraint|rule|ability|grounding|memory|safety|compliance)\s*[:\-]/i;
  const naturalDirective =
    /^(address me as|refer to me as|call me|talk like|speak like|talk in|speak in|allow ability|forbid ability|enable ability|disable ability)\b/i;
  const imperativePolicy =
    /\b(do not|don't|never|must|must not|always|cannot|can only|only if|required)\b/i;

  if (
    policyPrefix.test(text) ||
    naturalDirective.test(text) ||
    imperativePolicy.test(lower) ||
    /\b(must|must not|shall|shall not|never|always|required|forbidden|cannot)\b/.test(lower)
  ) {
    return "INVARIANT";
  }
  if (/\b(noise|drift|attack|spoof|adversary|overload|latency|cascade|shock|uncertain|risk)\b/.test(lower)) {
    return "DISTURBANCE";
  }
  if (/\b(coupling|coupled|dependency|path|propagate|spread|bridge|module-to-module|edge)\b/.test(lower)) {
    return "COUPLING";
  }
  if (/\b(measure|metric|score|classif|threshold|detector|signal|evaluate|monitor)\b/.test(lower)) {
    return "MEASUREMENT";
  }
  if (/\b(repair|rollback|restore|recheck|quarantine|throttle|contain|return path|fix|correct)\b/.test(lower)) {
    return "PROCEDURE";
  }
  if (/\b(meta|law of laws|update|harden|ledger|auth|approval|policy)\b/.test(lower)) {
    return "META";
  }
  if (/\b(state|variable|module|kernel|region|stack|topology|capacity|budget|reserve)\b/.test(lower)) {
    return "STATE";
  }
  return "OTHER";
}

function generateHoles(
  claims: Claim[],
  flags: {
    hasInvariant: boolean;
    hasLegality: boolean;
    hasDetection: boolean;
    hasCorrection: boolean;
    hasMetaAuth: boolean;
    hasCouplingTopology: boolean;
  },
  runMode: RunMode,
): Hole[] {
  if (runMode === "demo") {
    return buildDemoSemanticHoles(claims);
  }

  const holes: Hole[] = [];

  if (flags.hasInvariant && !flags.hasDetection) {
    holes.push(
      mkHole(
        "H001",
        "invariant_enforcement",
        "No detector/measurement step is defined for invariant checks.",
        "Invariants cannot be verified during runtime.",
        claimIdsByTag(claims, "INVARIANT"),
      ),
    );
  }

  if (!flags.hasLegality) {
    holes.push(
      mkHole(
        "H002",
        "legality_projection",
        "Admissible vs forbidden boundary is not explicitly defined.",
        "Illegal states cannot be projected or quarantined deterministically.",
        claimIdsByKeyword(claims, /\b(legal|law|admissible|forbidden|illegal)\b/i),
      ),
    );
  }

  if (flags.hasInvariant && !flags.hasCorrection) {
    holes.push(
      mkHole(
        "H003",
        "failure_return_completeness",
        "No explicit return path is defined for invariant violations.",
        "Failure->Return map remains incomplete.",
        claimIdsByTag(claims, "INVARIANT"),
      ),
    );
  }

  if (!flags.hasMetaAuth) {
    holes.push(
      mkHole(
        "H004",
        "meta_update_authorization",
        "No authenticated ledger/update gate is explicitly specified.",
        "Law/update insertion cannot be admitted safely.",
        claimIdsByTag(claims, "META"),
      ),
    );
  }

  if (!flags.hasCouplingTopology) {
    holes.push(
      mkHole(
        "H005",
        "containment_topology",
        "Module list or coupling paths are missing/incomplete.",
        "Cascade containment cannot be guaranteed.",
        claimIdsByTag(claims, "COUPLING"),
      ),
    );
  }

  return holes;
}

function buildDemoSemanticHoles(claims: Claim[]): Hole[] {
  if (claims.length === 0) {
    return [
      mkHole(
        "H000",
        "semantic_coherence",
        "No meaningful directive or claim could be extracted from the artifact.",
        "Law synthesis is blocked until input has clear semantic content.",
        [],
      ),
    ];
  }
  const meaningful = claims.some((claim) => hasSemanticSignal(claim.text));
  if (meaningful) {
    return [];
  }
  return [
    mkHole(
      "H000",
      "semantic_coherence",
      "Input is syntactically readable but semantically incoherent for law extraction.",
      "Only incoherent input is blocked in demo mode.",
      claims.map((claim) => claim.id),
    ),
  ];
}

function hasSemanticSignal(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\b(must|must not|shall|never|required|forbidden|allow|forbid|enable|disable|address|refer to me as|call me|talk|speak|style|voice|ability|law|coding|code|web search)\b/.test(lower)) {
    return true;
  }
  const words = text.match(/[a-zA-Z]{2,}/g) ?? [];
  return words.length >= 3;
}

function mkHole(
  id: string,
  needed_for: string,
  missing: string,
  consequence_if_missing: string,
  source_claim_ids: string[],
): Hole {
  return {
    id,
    needed_for,
    missing,
    consequence_if_missing,
    source_claim_ids,
  };
}

function claimIdsByTag(claims: Claim[], tag: ClaimTag): string[] {
  return claims.filter((claim) => claim.tag === tag).map((claim) => claim.id);
}

function claimIdsByKeyword(claims: Claim[], pattern: RegExp): string[] {
  return claims.filter((claim) => pattern.test(claim.text)).map((claim) => claim.id);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function buildUicIdentityModel(
  invariants: string[],
  disturbances: string[],
  couplings: string[],
  claims: Claim[],
  holes: Hole[],
): NonNullable<PrimitiveExtractionRecord["UIC_IDENTITY"]> {
  const epsilon = 0.4;
  const invariantCount = invariants.length;
  const violatedByHoles = holes.filter((hole) =>
    /invariant_enforcement|failure_return_completeness|legality_projection/i.test(hole.needed_for)
  ).length;
  const weakInvariantClaims = claims.filter((claim) =>
    claim.tag === "INVARIANT" && /\b(maybe|probably|likely|optional)\b/i.test(claim.text)
  ).length;
  const violation = violatedByHoles + weakInvariantClaims;
  const normalizedViolation = invariantCount > 0 ? Math.min(1, violation / invariantCount) : 0;
  const inKEpsilon = normalizedViolation <= epsilon;

  const driftPressure = disturbances.length + Math.max(0, couplings.length - 2);
  const correctionCapacity = claims.filter((claim) =>
    claim.tag === "PROCEDURE" && /\b(repair|rollback|restore|recheck|quarantine|fix|correct|project)\b/i.test(claim.text)
  ).length;
  const containmentStrength = claims.filter((claim) =>
    /contain|firebreak|isolate|circuit breaker|coupling cap|boundary/i.test(claim.text)
  ).length;
  const forwardInvariantEstimate = inKEpsilon && correctionCapacity + containmentStrength >= Math.max(1, driftPressure);
  const attractorEstimate = forwardInvariantEstimate && correctionCapacity >= Math.max(1, Math.ceil(driftPressure / 2));

  return {
    invariant_count: invariantCount,
    target_signature: invariants.slice(0, 8).join(" || "),
    epsilon,
    violation,
    normalized_violation: normalizedViolation,
    in_K_epsilon: inKEpsilon,
    drift_pressure: driftPressure,
    correction_capacity: correctionCapacity,
    containment_strength: containmentStrength,
    forward_invariant_estimate: forwardInvariantEstimate,
    attractor_estimate: attractorEstimate,
    identity_statement:
      "Identity is K_epsilon forward-invariance under correction-dominant dynamics: x_{t+1}=K_R(D_R(x_t,nu_t)).",
  };
}
