import { NSL_REPAIR_CATALOG, resolveAuthorizedRepairs } from "./repair-catalog.ts";
import { getProfileOrThrow } from "../profiles/index.ts";
import type {
  BlockersObject,
  Claim,
  DeltaObject,
  Hole,
  LmlAddItem,
  NslAddItem,
  PrimitiveExtractionRecord,
  RejectedItem,
  SnapIntegrationOptions,
  UUISObject,
} from "./types.ts";

export function runLmlIntegration(
  per: PrimitiveExtractionRecord,
  uuis: UUISObject,
  options: SnapIntegrationOptions,
): { delta: DeltaObject; blockers: BlockersObject } {
  const runMode = options.runMode ?? "demo";
  const profile = options.profileId ? getProfileOrThrow(options.profileId) : null;
  const strictNoProofNoTransition = options.strictNoProofNoTransition ?? runMode === "product";
  const providedProofs = new Set(options.providedProofLawIds ?? []);

  const lawCandidates = extractLawCandidates(
    per.CLAIMS,
    uuis,
    profile?.lmlLaws.map((law) => `${law.id}: ${law.text}`) ?? [],
  );

  const lmlAdd: LmlAddItem[] = [];
  const detectionSpec: DeltaObject["DETECTION_SPEC"] = [];
  const implementationSpec: DeltaObject["IMPLEMENTATION_SPEC"] = [];
  const rejected: RejectedItem[] = [];

  for (let i = 0; i < lawCandidates.length; i += 1) {
    const text = lawCandidates[i];
    const claimIds = findSourceClaimIds(per.CLAIMS, text);

    if (isMeasurementLike(text)) {
      detectionSpec.push({
        id: `D-${String(detectionSpec.length + 1).padStart(4, "0")}`,
        text,
        source_claim_ids: claimIds,
      });
      continue;
    }

    if (isProcedureLike(text) && !isInvariantModal(text)) {
      implementationSpec.push({
        id: `P-${String(implementationSpec.length + 1).padStart(4, "0")}`,
        text,
        source_claim_ids: claimIds,
      });
      continue;
    }

    const gate = evaluateLmlLawGate(text, profile?.domain ?? null, runMode);
    if (!gate.pass) {
      rejected.push({
        id: `R-${String(rejected.length + 1).padStart(4, "0")}`,
        reason: gate.reason,
        text,
        source_claim_ids: claimIds,
      });
      continue;
    }

    const inferredLawId = profile?.lmlLaws.find((law) => text.includes(law.id))?.id;
    const requiresProof = inferredLawId ? /proof|required|verify|verification|shepardize/i.test(profile?.lmlLaws.find((law) => law.id === inferredLawId)?.text ?? "") : /proof|required|verify|verification|shepardize/i.test(text);
    const hasProof = !requiresProof || (inferredLawId ? providedProofs.has(inferredLawId) : false);
    if (strictNoProofNoTransition && !hasProof) {
      rejected.push({
        id: `R-${String(rejected.length + 1).padStart(4, "0")}`,
        reason: "no_proof_no_transition",
        text,
        source_claim_ids: claimIds,
      });
      continue;
    }

    lmlAdd.push({
      law_id: `LAW-${String(lmlAdd.length + 1).padStart(5, "0")}`,
      text,
      scope: inferScope(text),
      enforcement: inferEnforcement(text),
      source_artifact_ref: options.artifactRef,
      source_claim_ids: claimIds,
      version_ref_or_hole: options.allowVersionRef ? "version_ref:v1" : "HOLE:version_ref_missing",
    });
  }

  if (profile) {
    for (const law of profile.lmlLaws) {
      const exists = lmlAdd.some((item) => item.text.includes(law.id) || item.text.toLowerCase() === law.text.toLowerCase());
      if (exists) {
        continue;
      }
      lmlAdd.push({
        law_id: `LAW-${String(lmlAdd.length + 1).padStart(5, "0")}`,
        text: `${law.id}: ${law.text}`,
        scope: law.scope,
        enforcement: law.enforcement,
        source_artifact_ref: options.artifactRef,
        source_claim_ids: [],
        version_ref_or_hole: options.allowVersionRef ? "version_ref:v1" : "HOLE:version_ref_missing",
      });
    }
  }

  const measurementPresent = per.CLAIMS.some((claim) => claim.tag === "MEASUREMENT");
  const packOperators = resolveAuthorizedRepairs(
    options.authorizedRepairPacks,
    options.measurementPackAuthorized,
    measurementPresent,
  );

  const explicitRepairs = collectExplicitRepairs(per.CLAIMS);
  const profileRepairs = profile
    ? profile.nslRepairs.map<NslAddItem>((repair) => ({
        repair_id: repair.id,
        trigger: repair.trigger,
        move: repair.move,
        effect: repair.effect,
        maps_failures: repair.mapsFailures,
        scope: "runtime",
        preconditions: ["trigger_satisfied"],
        priority: "REPAIR",
        ledger_requirements: ["trigger_evidence", "repair_action"],
        source_claim_ids: [],
      }))
    : [];
  const nslBase = mergeRepairs([...explicitRepairs, ...profileRepairs], packOperators);

  const blockers = buildBlockers(per.HOLES, lmlAdd, uuis, {
    strictNoProofNoTransition,
    runMode,
    profileDomain: profile?.domain ?? null,
    profileCriticalBlockers: profile?.criticalBlockers ?? [],
  });
  const holeRepairs = buildHoleRepairMoves(blockers);
  const nslAdd = mergeRepairs([...nslBase, ...holeRepairs], []);

  const delta: DeltaObject = {
    LML_ADD: lmlAdd,
    NSL_ADD: nslAdd,
    DETECTION_SPEC: detectionSpec,
    IMPLEMENTATION_SPEC: implementationSpec,
    REJECTED: rejected,
  };

  return { delta, blockers };
}

export function runSnapToEngine(
  per: PrimitiveExtractionRecord,
  uuis: UUISObject,
  options: SnapIntegrationOptions,
): { C_DELTA: DeltaObject; D_BLOCKERS: BlockersObject } {
  const { delta, blockers } = runLmlIntegration(per, uuis, options);
  return {
    C_DELTA: delta,
    D_BLOCKERS: blockers,
  };
}

function extractLawCandidates(claims: Claim[], uuis: UUISObject, profileLawTexts: string[]): string[] {
  return unique([
    ...uuis.block1_identity_kernel.content,
    ...uuis.block2_legality_region.content,
    ...uuis.block3_detection_stack.content,
    ...uuis.block4_containment_topology.content,
    ...uuis.block5_correction_stack.content,
    ...uuis.block6_reserved_capacity.content,
    ...uuis.block7_meta_update_loop.content,
    ...uuis.appendixA_threat_model.threats,
    ...uuis.appendixB_failure_return_map.map
      .map((entry) => entry.return_path ?? `Missing return path for ${entry.failure_id}: ${entry.invariant}`),
    ...synthesizeLawCandidatesFromClaims(claims),
    ...synthesizeAbilityLawsFromClaims(claims),
    ...profileLawTexts,
  ]).slice(0, 3000);
}

function evaluateLmlLawGate(text: string, profileDomain: string | null, runMode: "demo" | "product"): { pass: boolean; reason: string } {
  if (!isInvariantModal(text) && !isDirectiveLaw(text)) {
    return { pass: false, reason: "modal_strength_failed" };
  }
  if (isProbabilistic(text)) {
    return { pass: false, reason: "non_probabilistic_failed" };
  }

  // Document-law mode: invariant directives are admissible even when the
  // artifact does not explicitly provide detector verbs in the same sentence.
  if (profileDomain === "DOC") {
    return { pass: true, reason: "ok_doc_invariant" };
  }

  if (isMeasurementLike(text)) {
    return { pass: false, reason: "measurement_is_not_law" };
  }
  if (!hasEnforceableSignal(text)) {
    return { pass: false, reason: "enforceability_failed" };
  }

  if (runMode === "product" && profileDomain === "CITATION" && /\b(generate citations|create citations|invent case)\b/i.test(text)) {
    return { pass: false, reason: "citation_generation_banned" };
  }

  if (runMode === "product" && profileDomain === "CITATION" && /\b(retriev|verify|shepardize)\b/i.test(text) === false) {
    return { pass: false, reason: "citation_workflow_incomplete" };
  }

  return { pass: true, reason: "ok" };
}

function collectExplicitRepairs(claims: Claim[]): NslAddItem[] {
  const candidates = claims.filter((claim) => claim.tag === "PROCEDURE");
  const out: NslAddItem[] = [];

  for (const claim of candidates) {
    const parsed = parseRepairPattern(claim.text);
    if (!parsed) {
      continue;
    }
    out.push({
      repair_id: `EX-${String(out.length + 1).padStart(4, "0")}`,
      trigger: parsed.trigger,
      move: parsed.move,
      effect: parsed.effect,
      maps_failures: parsed.maps_failures,
      scope: "runtime",
      preconditions: ["trigger_satisfied"],
      priority: "REPAIR",
      ledger_requirements: ["trigger_evidence", "repair_action"],
      source_claim_ids: [claim.id],
    });
  }

  return out;
}

function mergeRepairs(explicitRepairs: NslAddItem[], packOperators: typeof NSL_REPAIR_CATALOG.operators): NslAddItem[] {
  const out = [...explicitRepairs];
  const existing = new Set(out.map((item) => item.repair_id));

  for (const operator of packOperators) {
    if (existing.has(operator.repair_id)) {
      continue;
    }
    out.push({
      repair_id: operator.repair_id,
      trigger: operator.trigger,
      move: operator.move,
      effect: operator.effect,
      maps_failures: operator.maps_failures,
      scope: operator.scope,
      preconditions: operator.preconditions,
      priority: operator.priority,
      ledger_requirements: operator.ledger_requirements,
      source_claim_ids: [],
    });
  }

  return out.sort((a, b) => a.repair_id.localeCompare(b.repair_id));
}

function buildBlockers(
  holes: Hole[],
  lmlAdd: LmlAddItem[],
  uuis: UUISObject,
  context: {
    strictNoProofNoTransition: boolean;
    runMode: "demo" | "product";
    profileDomain: string | null;
    profileCriticalBlockers: Array<{ id: string; missing: string; neededFor: string }>;
  },
): BlockersObject {
  if (context.runMode === "demo") {
    const semantic = holes.filter((hole) => /semantic_coherence/i.test(hole.needed_for) || hole.id === "H000");
    return {
      HOLES_BLOCKING_LML: uniqueHoles(semantic),
      HOLES_BLOCKING_NSL: [],
    };
  }

  const holesBlockingLml = [...holes.filter((hole) => /legality|enforcement|author|ledger|scope/i.test(hole.needed_for))];
  for (const law of lmlAdd) {
    if (law.version_ref_or_hole.startsWith("HOLE:")) {
      holesBlockingLml.push({
        id: `H-LML-${law.law_id}`,
        needed_for: "ledger_requirement",
        missing: "version_ref_or_hole unresolved",
        consequence_if_missing: "Law insertion is blocked.",
        source_claim_ids: law.source_claim_ids,
      });
    }
  }

  if (context.strictNoProofNoTransition) {
    const proofHoles = holes.filter((hole) => /proof/i.test(hole.missing) || /proof/i.test(hole.needed_for));
    holesBlockingLml.push(...proofHoles);
  }

  if (context.runMode === "product") {
    for (const blocker of context.profileCriticalBlockers) {
      const hasSupportingLaw = lmlAdd.some((law) => law.text.includes(blocker.neededFor) || law.law_id.includes(blocker.neededFor));
      if (!hasSupportingLaw) {
        holesBlockingLml.push({
          id: blocker.id,
          needed_for: blocker.neededFor,
          missing: blocker.missing,
          consequence_if_missing: "Critical profile blocker unresolved.",
          source_claim_ids: [],
        });
      }
    }
  }

  const mappedFailures = new Set(uuis.appendixB_failure_return_map.map.filter((item) => item.return_path).map((item) => item.failure_id));
  const holesBlockingNsl = [...holes.filter((hole) => /failure_return|return/i.test(hole.needed_for))];

  for (const entry of uuis.appendixB_failure_return_map.map) {
    if (!mappedFailures.has(entry.failure_id)) {
      holesBlockingNsl.push({
        id: `H-NSL-${entry.failure_id}`,
        needed_for: "failure_return_completeness",
        missing: `No NSL return path for ${entry.failure_id}`,
        consequence_if_missing: "NSL map is incomplete for at least one invariant.",
        source_claim_ids: [],
      });
    }
  }

  return {
    HOLES_BLOCKING_LML: uniqueHoles(holesBlockingLml),
    HOLES_BLOCKING_NSL: uniqueHoles(holesBlockingNsl),
  };
}

function parseRepairPattern(text: string): {
  trigger: string;
  move: string;
  effect: string;
  maps_failures: string[];
} | null {
  const lower = text.toLowerCase();
  const hasTrigger = /\b(if|when|on|upon|trigger|violation|failure|uncertain|risk)\b/.test(lower);
  const hasMove = /\b(do|apply|run|rollback|restore|quarantine|throttle|isolate|recheck|repair|fix)\b/.test(lower);
  const hasEffect = /\b(so that|prevent|reduce|contain|stabilize|block|restore|improve)\b/.test(lower);

  if (!(hasTrigger && hasMove && hasEffect)) {
    return null;
  }

  return {
    trigger: text,
    move: text,
    effect: text,
    maps_failures: inferFailureClasses(text),
  };
}

function inferFailureClasses(text: string): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];
  if (/drift|oscillat/.test(lower)) out.push("F_DRIFT");
  if (/spoof|game|advers/.test(lower)) out.push("F_SPOOFING");
  if (/overwrite|integrity|corrupt/.test(lower)) out.push("F_INTEGRITY");
  if (/cascade|spread|coupling/.test(lower)) out.push("F_CASCADE");
  if (/ledger|proof|audit/.test(lower)) out.push("F_LEDGER");
  if (/latency|delay|tim/.test(lower)) out.push("F_LATENCY");
  if (out.length === 0) out.push("F_GENERAL");
  return out;
}

function findSourceClaimIds(claims: Claim[], text: string): string[] {
  const normalized = text.toLowerCase();
  const found = claims.filter((claim) => normalized.includes(claim.text.toLowerCase().slice(0, 18))).map((claim) => claim.id);
  return found.length > 0 ? found : [];
}

function inferScope(text: string): string {
  if (/global|always|all modules|entire system|universal/.test(text.toLowerCase())) {
    return "global";
  }
  return "local_or_unspecified";
}

function inferEnforcement(text: string): string {
  if (isDirectiveLaw(text)) {
    return "runtime_constraint_gate";
  }
  if (/^\s*invariant\s*:/i.test(text)) {
    return "runtime_constraint_gate";
  }
  if (/quarantine|block|reject|deny|project/.test(text.toLowerCase())) {
    return "hard_projection_or_quarantine";
  }
  if (/monitor|detect|threshold|audit/.test(text.toLowerCase())) {
    return "detect_and_gate";
  }
  if (isInvariantModal(text)) {
    return "runtime_constraint_gate";
  }
  return "HOLE:enforcement_unspecified";
}

function isInvariantModal(text: string): boolean {
  return /\b(must|must not|shall|shall not|never|always|required|forbidden|cannot)\b/i.test(text);
}

function isDirectiveLaw(text: string): boolean {
  return /\b(allow ability|allow\s+[a-z_]+|forbid|ban|enable ability|disable ability|install module|install ability|constraint:|rule:|tone:|style:|voice:|address me as|refer to me as|call me|talk like|speak like|talk in|speak in)\b/i.test(
    text,
  );
}

function isProbabilistic(text: string): boolean {
  return /\b(likely|probably|confidence|score|estimate|maybe|tends to)\b/i.test(text);
}

function isMeasurementLike(text: string): boolean {
  return /\b(metric|score|classif|detector|threshold|evaluate|monitor|taxonomy)\b/i.test(text);
}

function isProcedureLike(text: string): boolean {
  return /\b(step|procedure|workflow|run|execute|pipeline)\b/i.test(text);
}

function hasEnforceableSignal(text: string): boolean {
  return /\b(check|verify|enforce|project|quarantine|reject|deny|gate|audit|monitor|threshold)\b/i.test(text);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function synthesizeLawCandidatesFromClaims(claims: Claim[]): string[] {
  const out: string[] = [];
  for (const claim of claims) {
    const text = claim.text.trim();
    if (!text) {
      continue;
    }

    if (claim.tag === "INVARIANT") {
      out.push(`Must enforce claim ${claim.id}: ${text}`);
      continue;
    }
    if (claim.tag === "DISTURBANCE") {
      out.push(`System must detect, contain, and gate disturbance from claim ${claim.id}: ${text}`);
      continue;
    }
    if (claim.tag === "COUPLING") {
      out.push(`System must isolate risky coupling path from claim ${claim.id}: ${text}`);
      continue;
    }
    if (claim.tag === "STATE") {
      out.push(`System must preserve admissible state boundary for claim ${claim.id}: ${text}`);
      continue;
    }
    if (claim.tag === "META") {
      out.push(`System must enforce authenticated meta update gate from claim ${claim.id}: ${text}`);
      continue;
    }
    if (claim.tag === "PROCEDURE") {
      out.push(`System must execute and verify procedure from claim ${claim.id}: ${text}`);
      continue;
    }
    if (claim.tag === "MEASUREMENT") {
      out.push(`Detector required for claim ${claim.id}: ${text}`);
      continue;
    }

    if (
      claim.tag === "OTHER" &&
      (/\b(must|must not|shall|shall not|never|required|forbidden|cannot|always|do not|don't)\b/i.test(text) ||
        /^(tone|style|voice|persona|expression|behavior|speaking|speak|address|allow ability|allow|forbid|ban|constraint|rule|ability)\s*[:\-]/i.test(text) ||
        /^(address me as|refer to me as|call me|talk like|speak like|talk in|speak in)\b/i.test(text))
    ) {
      out.push(`Must enforce document directive from claim ${claim.id}: ${text}`);
    }
  }
  return out;
}

function synthesizeAbilityLawsFromClaims(claims: Claim[]): string[] {
  const joined = claims.map((claim) => claim.text.toLowerCase()).join("\n");
  const out: string[] = [];
  const explicitDirectives = claims
    .filter((claim) => claim.tag === "INVARIANT" || claim.tag === "OTHER" || claim.tag === "META")
    .map((claim) => claim.text.toLowerCase());

  for (const line of explicitDirectives) {
    const hasAllow = /\b(allow|enable|install|activate|must support)\b/.test(line);
    const hasDeny = /\b(forbid|ban|disable|block|must not)\b/.test(line);
    const codingAbility = /\b(coding|code_assist|code_exec|programming)\b/.test(line);
    const searchAbility = /\b(web_search|internet_search|web search|internet search|online lookup)\b/.test(line);

    if (codingAbility && hasAllow) {
      out.push("allow ability: coding");
    }
    if (codingAbility && hasDeny) {
      out.push("forbid ability: coding");
    }
    if (searchAbility && hasAllow) {
      out.push("allow ability: web_search");
    }
    if (searchAbility && hasDeny) {
      out.push("forbid ability: web_search");
    }
  }

  if (out.includes("allow ability: web_search")) {
    out.push("constraint: authority_ranking_required");
    out.push("constraint: grounding_required");
  }
  if (out.includes("allow ability: coding")) {
    out.push("constraint: syntax_logic_safety_integration_checks_required");
    out.push("constraint: fail_closed_on_unverified_code_actions");
  }
  if (/\b(allow|enable|install|activate)\b.*\b(code_exec|command execution|sandbox execute|run tests)\b/.test(joined)) {
    out.push("allow ability: code_exec");
  }

  return out;
}

function uniqueHoles(holes: Hole[]): Hole[] {
  const seen = new Set<string>();
  const out: Hole[] = [];
  for (const hole of holes) {
    if (seen.has(hole.id)) {
      continue;
    }
    seen.add(hole.id);
    out.push(hole);
  }
  return out;
}

function buildHoleRepairMoves(blockers: BlockersObject): NslAddItem[] {
  const all = [...blockers.HOLES_BLOCKING_LML, ...blockers.HOLES_BLOCKING_NSL];
  const out: NslAddItem[] = [];

  for (const hole of all) {
    const move = inferHoleMove(hole);
    out.push({
      repair_id: `H-REPAIR-${hole.id}`,
      trigger: `HOLE ${hole.id} detected for ${hole.needed_for}`,
      move,
      effect: `Prevents illegal fill and routes to admissible completion for ${hole.needed_for}`,
      maps_failures: inferFailureClasses(`${hole.needed_for} ${hole.missing} ${hole.consequence_if_missing}`),
      scope: "runtime",
      preconditions: ["hole_present", "evidence_required"],
      priority: "HARDEN",
      ledger_requirements: ["hole_id", "needed_for", "repair_action", "evidence_ref"],
      source_claim_ids: hole.source_claim_ids,
    });
  }

  return out;
}

function inferHoleMove(hole: Hole): string {
  const needed = hole.needed_for.toLowerCase();
  if (needed.includes("invariant_enforcement")) {
    return "Install detector/measurement gate for invariant check; keep invariant blocked until verified evidence is supplied.";
  }
  if (needed.includes("legality_projection")) {
    return "Define explicit admissible/forbidden boundary; project unknowns to HOLE quarantine and deny transition.";
  }
  if (needed.includes("failure_return")) {
    return "Install explicit return path mapping for the missing failure class; no transition without return operator.";
  }
  if (needed.includes("meta_update_authorization") || needed.includes("ledger")) {
    return "Attach authenticated ledger gate and version reference; block law insertion until provenance is complete.";
  }
  if (needed.includes("containment_topology")) {
    return "Declare modules and coupling edges, then apply containment cap and breaker rules before enabling flow.";
  }
  if (needed.includes("proof")) {
    return "Collect proof artifact and map it to required law ID; keep no-proof-no-transition active.";
  }
  return "Route missing field to HOLE quarantine and request explicit evidence; do not synthesize missing content.";
}
