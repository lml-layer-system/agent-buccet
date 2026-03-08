import type { SnapProfile } from "./types.ts";

function profile(
  profileId: string,
  immutableHash: string,
  version: string,
  domain: SnapProfile["domain"],
  dimensions: SnapProfile["dimensions"],
  lmlLaws: SnapProfile["lmlLaws"],
  nslRepairs: SnapProfile["nslRepairs"],
  detectors: SnapProfile["detectors"],
  hardGates: SnapProfile["hardGates"],
  thresholds: SnapProfile["thresholds"],
  criticalBlockers: SnapProfile["criticalBlockers"],
): SnapProfile {
  return {
    profileId,
    immutableHash,
    version,
    domain,
    dimensions,
    lmlLaws,
    nslRepairs,
    detectors,
    hardGates,
    thresholds,
    criticalBlockers,
  };
}

const COMMON_META_LAWS = [
  { id: "LAW.META.1", text: "No invention: missing required data must emit typed HOLE.", scope: "all", enforcement: "hole_emission_gate" },
  { id: "LAW.META.2", text: "No output without admissibility: non-admissible state returns NULL.", scope: "all", enforcement: "admissibility_gate" },
  { id: "LAW.META.3", text: "No proof no transition in product mode.", scope: "product", enforcement: "proof_gate" },
];

export const DOC_LAW_PROFILE = profile(
  "DOC_LAW_PROFILE",
  "doc-law-v1-immutable",
  "1.0.0",
  "DOC",
  [
    { id: "D1", name: "authority", levels: ["D1.0", "D1.1", "D1.2", "D1.3", "D1.4", "D1.5", "D1.6", "D1.7", "D1.8"] },
    { id: "D2", name: "scope", levels: ["D2.0", "D2.1", "D2.2", "D2.3", "D2.4", "D2.5", "D2.6", "D2.7", "D2.8"] },
    { id: "D3", name: "lifecycle", levels: ["uploaded", "parsing", "active", "paused", "expired", "removed", "archived", "superseded", "locked"] },
  ],
  [
    ...COMMON_META_LAWS,
    { id: "LAW.DOC.1", text: "Document lifecycle must follow valid state transitions only.", scope: "doc_engine", enforcement: "lifecycle_transition_gate" },
    { id: "LAW.DOC.2", text: "Removed/expired documents must have no active enforcement residue.", scope: "doc_engine", enforcement: "cleanup_gate" },
  ],
  [
    { id: "NSL.DOC.VIOLATION_CORRECTION", trigger: "lifecycle violation", move: "rollback to last legal state", effect: "restores valid lifecycle", mapsFailures: ["F_DOC_LIFECYCLE"] },
    { id: "NSL.DOC.CLEANUP", trigger: "residual enforcement detected", move: "purge active bindings", effect: "removes ghost persistence", mapsFailures: ["F_DOC_RESIDUE"] },
  ],
  [
    { id: "DET.DOC.STATE", description: "Detect current lifecycle state", signal: "state_machine_state" },
    { id: "DET.DOC.RESIDUE", description: "Detect active rule residue after expiry/removal", signal: "active_binding_count" },
  ],
  [
    { id: "GATE.DOC.TRANSITION", description: "Reject invalid lifecycle transitions", hard: true },
    { id: "GATE.DOC.CLEANUP", description: "Block run until cleanup complete", hard: true },
  ],
  { maxInvalidTransitions: 0, maxResidualBindings: 0 },
  [
    { id: "DOC.H.1", missing: "lifecycle state machine", neededFor: "LAW.DOC.1" },
    { id: "DOC.H.2", missing: "cleanup enforcement", neededFor: "LAW.DOC.2" },
  ],
);

export const FORMAT_PROOF_PROFILE = profile(
  "FORMAT_PROOF_PROFILE",
  "format-proof-v1-immutable",
  "1.0.0",
  "FORMAT",
  [
    { id: "FP1", name: "proof-completeness", levels: ["none", "partial", "full"] },
    { id: "FP2", name: "traceability", levels: ["none", "linked", "auditable"] },
  ],
  [
    ...COMMON_META_LAWS,
    { id: "LAW.FP.1", text: "Proof fields must be complete before transition.", scope: "all", enforcement: "proof_field_gate" },
  ],
  [
    { id: "NSL.FP.FILL", trigger: "missing proof fields", move: "emit HOLE and block", effect: "prevents proofless transition", mapsFailures: ["F_PROOF_GAP"] },
  ],
  [{ id: "DET.FP.MISSING", description: "Detect missing proof fields", signal: "proof_field_missing_count" }],
  [{ id: "GATE.FP.PROOF", description: "No proof no transition", hard: true }],
  { minProofCoverage: 1 },
  [{ id: "FP.H.1", missing: "proof mapping", neededFor: "LAW.FP.1" }],
);

export const CITATION_ZERO_HALLUCINATION_PROFILE = profile(
  "CITATION_ZERO_HALLUCINATION_PROFILE",
  "citation-zero-v1-immutable",
  "1.0.0",
  "CITATION",
  [
    { id: "C1", name: "existence", levels: ["unchecked", "verified"] },
    { id: "C2", name: "currency", levels: ["unchecked", "shepardized"] },
    { id: "C3", name: "jurisdiction", levels: ["unchecked", "applicable"] },
  ],
  [
    ...COMMON_META_LAWS,
    { id: "LAW.CITE.1", text: "AI citation generation is forbidden in legal mode.", scope: "legal", enforcement: "citation_generation_ban_gate" },
    { id: "LAW.CITE.2", text: "Retrieval-first, verify-first, shepardize-first are mandatory.", scope: "legal", enforcement: "citation_workflow_gate" },
    { id: "LAW.CITE.3", text: "One fake citation causes hard stop.", scope: "legal", enforcement: "one_fake_hard_stop" },
  ],
  [
    { id: "NSL.CITE.DELETE_FAKE", trigger: "citation not found", move: "delete citation", effect: "removes fake authority", mapsFailures: ["F_FAKE_CITATION"] },
  ],
  [
    { id: "DET.CITE.EXIST", description: "Citation existence check", signal: "citation_exists" },
    { id: "DET.CITE.CURR", description: "Citation currency check", signal: "shepard_status" },
    { id: "DET.CITE.JUR", description: "Citation jurisdiction check", signal: "jurisdiction_applicable" },
  ],
  [
    { id: "GATE.CITE.BAN_GEN", description: "Reject AI-generated citation requests", hard: true },
    { id: "GATE.CITE.ONE_FAKE_STOP", description: "Hard stop if fake citation detected", hard: true },
  ],
  { maxFakeCitations: 0, requireShepardize: true, requireJurisdictionCheck: true, requireAdverseAuthority: true },
  [
    { id: "CITE.H.1", missing: "citation verifier", neededFor: "LAW.CITE.2" },
    { id: "CITE.H.2", missing: "currency checker", neededFor: "LAW.CITE.2" },
  ],
);

export const LEGAL_AI_ZERO_SANCTIONS_PROFILE = profile(
  "LEGAL_AI_ZERO_SANCTIONS_PROFILE",
  "legal-zero-sanctions-v1-immutable",
  "1.0.0",
  "LEGAL_AI",
  [
    { id: "LA1", name: "verification", levels: ["LA1.0", "LA1.1", "LA1.2", "LA1.3", "LA1.4", "LA1.5", "LA1.6", "LA1.7", "LA1.8"] },
    { id: "LA2", name: "grounding", levels: ["LA2.0", "LA2.1", "LA2.2", "LA2.3", "LA2.4", "LA2.5", "LA2.6", "LA2.7", "LA2.8"] },
    { id: "LA9", name: "error-detection", levels: ["LA9.0", "LA9.1", "LA9.2", "LA9.3", "LA9.4", "LA9.5", "LA9.6", "LA9.7", "LA9.8"] },
  ],
  [
    ...COMMON_META_LAWS,
    { id: "LAW.LA.1", text: "Legal output requires verification-first architecture.", scope: "legal", enforcement: "verification_first_gate" },
    { id: "LAW.LA.2", text: "Adverse authority, jurisdiction, and currency checks are mandatory.", scope: "legal", enforcement: "legal_completeness_gate" },
  ],
  [
    { id: "NSL.LA.RECHECK", trigger: "failed legal gate", move: "repair and re-check", effect: "restores admissibility", mapsFailures: ["F_LEGAL_GATE"] },
  ],
  [
    { id: "DET.LA.VERIFY", description: "Verification coverage detector", signal: "verification_coverage" },
    { id: "DET.LA.COMPLETE", description: "Legal completeness detector", signal: "missing_legal_checks" },
  ],
  [
    { id: "GATE.LA.VERIFY", description: "Require verification before legal output", hard: true },
    { id: "GATE.LA.COMPLETE", description: "Require jurisdiction/currency/adverse checks", hard: true },
  ],
  { minVerificationLevel: "LA1.5", maxSanctionRisk: 0 },
  [{ id: "LA.H.1", missing: "multi-check legal verifier", neededFor: "LAW.LA.2" }],
);

export const WRITING_343_PROFILE = profile(
  "WRITING_343_PROFILE",
  "writing-343-v1-immutable",
  "1.0.0",
  "WRITING",
  [
    { id: "W1", name: "formality", levels: ["W1.0", "W1.1", "W1.2", "W1.3", "W1.4", "W1.5", "W1.6", "W1.7", "W1.8"] },
    { id: "W2", name: "complexity", levels: ["W2.0", "W2.1", "W2.2", "W2.3", "W2.4", "W2.5", "W2.6", "W2.7", "W2.8"] },
    { id: "W3", name: "purpose", levels: ["W3.0", "W3.1", "W3.2", "W3.3", "W3.4", "W3.5", "W3.6", "W3.7", "W3.8"] },
  ],
  [
    ...COMMON_META_LAWS,
    { id: "LAW.W.1", text: "Style coherence is required.", scope: "writing", enforcement: "style_coherence_validator" },
    { id: "LAW.W.2", text: "Dimensional completeness across style dimensions is required.", scope: "writing", enforcement: "dimension_completeness_validator" },
  ],
  [{ id: "NSL.W.COHERENCE_REPAIR", trigger: "style contradiction", move: "nearest coherent signature", effect: "restores coherence", mapsFailures: ["F_STYLE_COHERENCE"] }],
  [{ id: "DET.W.STYLE", description: "Style signature detector", signal: "style_signature" }],
  [{ id: "GATE.W.COHERENCE", description: "Reject contradictory style signatures", hard: true }],
  { styleClassCount: 343 },
  [{ id: "W.H.1", missing: "style classifier", neededFor: "LAW.W.2" }],
);

export const FACTUAL_343_PROFILE = profile(
  "FACTUAL_343_PROFILE",
  "factual-343-v1-immutable",
  "1.0.0",
  "FACTUAL",
  [
    { id: "K1", name: "relation", levels: ["K1.0", "K1.1", "K1.2", "K1.3", "K1.4", "K1.5", "K1.6", "K1.7", "K1.8"] },
    { id: "K4", name: "verification", levels: ["K4.0", "K4.1", "K4.2", "K4.3", "K4.4", "K4.5", "K4.6", "K4.7", "K4.8"] },
    { id: "K5", name: "stability", levels: ["K5.0", "K5.1", "K5.2", "K5.3", "K5.4", "K5.5", "K5.6", "K5.7", "K5.8"] },
  ],
  [
    ...COMMON_META_LAWS,
    { id: "LAW.K.1", text: "Fact type completeness required.", scope: "facts", enforcement: "fact_type_classifier" },
    { id: "LAW.K.2", text: "Non-contradiction required.", scope: "facts", enforcement: "contradiction_detector" },
  ],
  [{ id: "NSL.K.CONTRADICTION_RESOLUTION", trigger: "fact contradiction", move: "authority-based resolution", effect: "restores consistency", mapsFailures: ["F_CONTRADICTION"] }],
  [{ id: "DET.K.CONTRA", description: "Contradiction detector", signal: "contradiction_count" }],
  [{ id: "GATE.K.NONCONTRA", description: "Reject contradictory fact set", hard: true }],
  { factTypeClassCount: 343, maxContradictions: 0 },
  [{ id: "K.H.1", missing: "fast contradiction checker", neededFor: "LAW.K.2" }],
);

export const META_EFUE_12x12_PROFILE = profile(
  "META_EFUE_12x12_PROFILE",
  "meta-efue-12x12-v1-immutable",
  "1.0.0",
  "META",
  [{ id: "SR", name: "state-repair lattice", levels: ["SR.0", "SR.1", "SR.2", "SR.3", "SR.4", "SR.5", "SR.6", "SR.7", "SR.8"] }],
  [
    ...COMMON_META_LAWS,
    { id: "LAW.SR.1", text: "Every failure class must have at least one return path.", scope: "meta", enforcement: "failure_return_completeness_checker" },
  ],
  [{ id: "NSL.SR.FILL_RETURN", trigger: "missing return path", move: "install return path or HOLE", effect: "closes map", mapsFailures: ["F_MISSING_RETURN"] }],
  [{ id: "DET.SR.COMPLETE", description: "Failure-return completeness detector", signal: "unmapped_failure_count" }],
  [{ id: "GATE.SR.COMPLETE", description: "Block if failure-return map incomplete", hard: true }],
  { minLawFamilies: 12, minRepairFamilies: 12 },
  [{ id: "SR.H.1", missing: "family completeness checker", neededFor: "LAW.SR.1" }],
);

export const PROFILE_REGISTRY: Readonly<Record<string, SnapProfile>> = Object.freeze({
  DOC_LAW_PROFILE: deepFreeze(DOC_LAW_PROFILE),
  FORMAT_PROOF_PROFILE: deepFreeze(FORMAT_PROOF_PROFILE),
  CITATION_ZERO_HALLUCINATION_PROFILE: deepFreeze(CITATION_ZERO_HALLUCINATION_PROFILE),
  LEGAL_AI_ZERO_SANCTIONS_PROFILE: deepFreeze(LEGAL_AI_ZERO_SANCTIONS_PROFILE),
  WRITING_343_PROFILE: deepFreeze(WRITING_343_PROFILE),
  FACTUAL_343_PROFILE: deepFreeze(FACTUAL_343_PROFILE),
  META_EFUE_12x12_PROFILE: deepFreeze(META_EFUE_12x12_PROFILE),
});

export function getProfileOrThrow(profileId: string): SnapProfile {
  const profile = PROFILE_REGISTRY[profileId];
  if (!profile) {
    throw new Error(`Unknown profile: ${profileId}`);
  }
  return profile;
}

export function listProfiles(): SnapProfile[] {
  return Object.values(PROFILE_REGISTRY);
}

export function assertPinnedProfile(
  profile: SnapProfile,
  expected: { version?: string; immutableHash?: string },
  runMode: "demo" | "product",
): void {
  if (runMode !== "product") {
    return;
  }

  if (!expected.version || !expected.immutableHash) {
    throw new Error(
      "Product mode requires profile pinning: both profileVersion and profileImmutableHash must be provided.",
    );
  }

  if (profile.version !== expected.version) {
    throw new Error(
      `Profile version mismatch: expected ${expected.version}, registry has ${profile.version}.`,
    );
  }

  if (profile.immutableHash !== expected.immutableHash) {
    throw new Error(
      `Profile immutable hash mismatch: expected ${expected.immutableHash}, registry has ${profile.immutableHash}.`,
    );
  }

  if (!Object.isFrozen(profile)) {
    throw new Error("Profile object is not frozen; runtime mutation boundary violated.");
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested && typeof nested === "object") {
        deepFreeze(nested);
      }
    }
  }
  return value;
}
