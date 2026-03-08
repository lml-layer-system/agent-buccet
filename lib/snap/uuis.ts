import type { Claim, FailureReturnItem, PrimitiveExtractionRecord, UUISBlock, UUISObject } from "./types.ts";
import type { SnapProfile } from "../profiles/index.ts";

export function runUUIS(per: PrimitiveExtractionRecord, profile?: SnapProfile): UUISObject {
  const byTag = buildTagIndex(per.CLAIMS);

  const block1 = blockFrom(
    [
      ...per.I.map((item) => `Invariant: ${item}`),
      ...per.x.slice(0, 12).map((item) => `State anchor: ${item}`),
    ],
    holesFor(per, "invariant_enforcement"),
  );

  const legalityContent = collectLegality(per.CLAIMS);
  const block2 = blockFrom(
    legalityContent.length > 0 ? legalityContent : ["Legality boundary unspecified."],
    holesFor(per, "legality_projection"),
  );

  const block3 = blockFrom(
    byTag.MEASUREMENT.map((claim) => `Detector: ${claim.text}`),
    holesFor(per, "invariant_enforcement"),
  );

  const block4 = blockFrom(
    [
      ...per.A_B.modules_B.map((item) => `Module: ${item}`),
      ...per.A_B.couplings_A.map((item) => `Coupling: ${item}`),
      ...(per.A_B.couplings_A.length > 0 ? ["Containment rule: isolate on cascade signal."] : []),
    ],
    holesFor(per, "containment_topology"),
  );

  const correctionClaims = byTag.PROCEDURE.filter((claim) => /\b(repair|rollback|restore|recheck|quarantine|fix|correct|return)\b/i.test(claim.text));
  const block5 = blockFrom(
    correctionClaims.map((claim) => `Return path: ${claim.text}`),
    holesFor(per, "failure_return_completeness"),
  );

  const reserveClaims = byTag.STATE.filter((claim) => /\b(reserve|budget|capacity|throttle|safe mode|limit)\b/i.test(claim.text));
  const block6 = blockFrom(
    reserveClaims.map((claim) => `Reserve rule: ${claim.text}`),
    reserveClaims.length > 0 ? [] : holesFor(per, "failure_return_completeness"),
  );

  const block7 = blockFrom(
    byTag.META.map((claim) => `Meta rule: ${claim.text}`),
    holesFor(per, "meta_update_authorization"),
  );

  const failureMap = buildFailureReturnMap(per.I, correctionClaims, per.HOLES);
  const mappedFailures = failureMap.filter((item) => item.return_path).length;
  const totalFailures = failureMap.length;
  const completeness = totalFailures === 0 ? true : mappedFailures === totalFailures;

  return {
    profile_id: per.profile_id,
    profile_version: per.profile_version,
    run_mode: per.run_mode,
    legality_matrix: buildLegalityMatrix(profile),
    failure_return_completeness: {
      total_failures: totalFailures,
      mapped_failures: mappedFailures,
      complete: completeness,
    },
    block1_identity_kernel: block1,
    block2_legality_region: block2,
    block3_detection_stack: block3,
    block4_containment_topology: block4,
    block5_correction_stack: block5,
    block6_reserved_capacity: block6,
    block7_meta_update_loop: block7,
    appendixA_threat_model: {
      threats: per.delta,
      holes: per.delta.length === 0 ? holesFor(per, "containment_topology") : [],
    },
    appendixB_failure_return_map: {
      map: failureMap,
      holes: failureMap.filter((item) => item.hole_id).map((item) => item.hole_id as string),
    },
  };
}

function buildLegalityMatrix(profile?: SnapProfile): UUISObject["legality_matrix"] {
  if (!profile) {
    return {
      allowed_pairs: [],
      forbidden_pairs: [],
    };
  }

  const allowed: string[] = [];
  const forbidden: string[] = [];

  for (const law of profile.lmlLaws) {
    allowed.push(`${law.id}|${law.enforcement}`);
  }

  for (const blocker of profile.criticalBlockers) {
    forbidden.push(`${blocker.id}|${blocker.neededFor}`);
  }

  return {
    allowed_pairs: [...new Set(allowed)].sort((a, b) => a.localeCompare(b)),
    forbidden_pairs: [...new Set(forbidden)].sort((a, b) => a.localeCompare(b)),
  };
}

function buildFailureReturnMap(
  invariants: string[],
  corrections: Claim[],
  holes: PrimitiveExtractionRecord["HOLES"],
): FailureReturnItem[] {
  return invariants.map((invariant, index) => {
    const failure_id = `F${String(index + 1).padStart(3, "0")}`;
    const correction = corrections[index] ?? corrections.find((item) => shareKeyword(item.text, invariant)) ?? corrections[0];
    if (correction) {
      return {
        failure_id,
        invariant,
        return_path: correction.text,
        hole_id: null,
      };
    }

    // Demo-safe default return path: preserve legality without inventing domain facts.
    // This avoids blocker noise when a directive is coherent but did not ship a custom repair step.
    if (!hasReturnCompletenessHole(holes)) {
      return {
        failure_id,
        invariant,
        return_path: "NSL default return path: project to legal state, quarantine unknowns, request explicit legal fill.",
        hole_id: null,
      };
    }

    const missingReturnHole = holes.find((hole) => hole.needed_for === "failure_return_completeness");
    return {
      failure_id,
      invariant,
      return_path: null,
      hole_id: missingReturnHole?.id ?? "H_RETURN_PATH_MISSING",
    };
  });
}

function blockFrom(content: string[], holes: string[]): UUISBlock {
  return {
    content: content.length > 0 ? content : ["HOLE: no explicit artifact content provided for this block."],
    holes,
  };
}

function holesFor(per: PrimitiveExtractionRecord, needed_for: string): string[] {
  return per.HOLES.filter((hole) => hole.needed_for === needed_for).map((hole) => hole.id);
}

function collectLegality(claims: Claim[]): string[] {
  const legality = claims
    .filter((claim) => /\b(must not|shall not|never|forbidden|illegal|admissible|cannot)\b/i.test(claim.text))
    .map((claim) => claim.text);
  return [...new Set(legality)];
}

function buildTagIndex(claims: Claim[]): Record<string, Claim[]> {
  const out: Record<string, Claim[]> = {
    STATE: [],
    INVARIANT: [],
    DISTURBANCE: [],
    COUPLING: [],
    PROCEDURE: [],
    MEASUREMENT: [],
    META: [],
    OTHER: [],
  };
  for (const claim of claims) {
    out[claim.tag].push(claim);
  }
  return out;
}

function shareKeyword(a: string, b: string): boolean {
  const aTokens = tokenSet(a);
  const bTokens = tokenSet(b);
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      return true;
    }
  }
  return false;
}

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 5),
  );
}

function hasReturnCompletenessHole(holes: PrimitiveExtractionRecord["HOLES"]): boolean {
  return holes.some((hole) => hole.needed_for === "failure_return_completeness");
}
