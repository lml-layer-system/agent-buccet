export const CODING_FAILURE_LAWS = [
  "ABILITY.CODING.31: Coding failure is finite and structured across syntax, logic, architecture, algorithm, context, safety, and integration dimensions.",
  "ABILITY.CODING.32: Every coding collapse failure must resolve to a finite failure dimension before repair, null, or law promotion proceeds.",
  "ABILITY.CODING.33: Syntax failures include malformed substrate, invalid language tokens, missing code shape, and unparseable output.",
  "ABILITY.CODING.34: Logic failures include incorrect reasoning, missing cases, contradictory behavior, and witness-breaking implementations.",
  "ABILITY.CODING.35: Architecture failures include invalid module boundaries, missing exports, circular dependency, and project graph illegality.",
  "ABILITY.CODING.36: Algorithm failures include wrong solving approach, non-halting tendency, or impossible collapse under the active skeleton.",
  "ABILITY.CODING.37: Context failures include solving the wrong task, wrong family, wrong language, or missing required intent dimensions.",
  "ABILITY.CODING.38: Safety failures include explicit failure path loss, security or guard loss, and catastrophic unsafe coding substrate.",
  "ABILITY.CODING.39: Integration failures include dependency mismatch, wrong framework surface, or ecosystem-incompatible output.",
] as const;

export const CODING_HALTING_COLLAPSE_LAWS = [
  "ABILITY.CODING.40: Code generation collapse must solve by constraint projection rather than sequential trial when the skeleton and witnesses are sufficient.",
  "ABILITY.CODING.41: Halting analysis in coding lanes must be treated as finite constraint projection over candidate architectures, not brute execution of every path.",
  "ABILITY.CODING.42: Illegal coding paths collapse to NULL when they violate witnesses, floor laws, architecture laws, or explicit structural halting constraints.",
  "ABILITY.CODING.43: Non-halting coding tendencies such as unbounded recursion or unbounded iteration without admissible witness support are algorithm failures and must not emit.",
  "ABILITY.CODING.44: Unknown coding intent after skeleton/spec extraction must clarify rather than project unstable code into output.",
  "ABILITY.CODING.45: Bare except/catch patterns are inadmissible in coding lanes and must collapse to NULL as safety failures unless the user explicitly requests that unsafe shape.",
  "ABILITY.CODING.46: Language/framework surface mismatch is inadmissible; a Python API request must not satisfy witnesses with an Express/JS surface, and analogous cross-ecosystem substitutions must fail closed.",
  "ABILITY.CODING.47: Auth-family code requires explicit auth guard structure; token or login surfaces without a real guard path are safety failures, not partial successes.",
  "ABILITY.CODING.48: Parser/compiler families require their own witness surfaces; missing parse/compiler structure is an integration failure and must not emit as generic code.",
  "ABILITY.CODING.49: Project graph illegality such as circular dependency or missing export is an architecture failure and must collapse to NULL before emission.",
  "ABILITY.CODING.54: Application families require consistent entry surface and dependency surface; framework or ecosystem substitution is an integration failure and must not emit.",
  "ABILITY.CODING.55: Game families require an explicit engine dependency surface plus lawful loop/update/render structure; removing either is an integration failure, not a partial success.",
  "ABILITY.CODING.56: Refactor families must preserve declared test coverage and dependency intent unless the user explicitly removes them; dropping them is a logic failure and must collapse to NULL.",
  "ABILITY.CODING.57: Multi-file coding families must preserve fenced substrate shape per module; flattened or unfenced multi-block outputs are syntax failures and must not emit.",
  "ABILITY.CODING.58: Application, game, compiler, and refactor families must bind witnesses by family before projection; generic code that ignores family-specific witnesses is inadmissible.",
  "ABILITY.CODING.68: Language-surface drift, trivial test surfaces, and mixed dependency universes are root coding failures that must NULL before emission.",
  "ABILITY.CODING.81: Stateful coding failures must resolve to direct leaf classes for uninitialized state, race, deadlock, inconsistency, pollution, stale state, and missing reset before repair proceeds.",
  "ABILITY.CODING.82: Architecture-smell coding failures must resolve to direct leaf classes for tight coupling, god object, feature envy, inappropriate intimacy, message chain, and middle man.",
  "ABILITY.CODING.83: Scaling failures must resolve to direct leaf classes for wrong complexity, unnecessary exponential growth, and non-scaling project shape.",
  "ABILITY.CODING.84: Dependency failures must resolve to direct leaf classes for version mismatch, missing dependency, and transitive conflict.",
  "ABILITY.CODING.89: Family-specific integration failures must resolve to explicit API, app, ORM, game, and refactor integration classes before repair proceeds.",
  "ABILITY.CODING.92: Direct logic leaf failures must resolve to explicit condition, loop, return, type, collection, and exception classes before repair proceeds.",
  "ABILITY.CODING.93: Test witness failures must resolve to direct subcases for missing test block, trivial assertion, and missing behavior assertion before repair proceeds.",
  "ABILITY.CODING.94: API/dependency witness failures must resolve to direct family-surface subcases instead of broad generic witness misses.",
] as const;

export type CodingFailureDimension =
  | "syntax"
  | "logic"
  | "architecture"
  | "algorithm"
  | "context"
  | "safety"
  | "integration"
  | "unknown";

export type CodingFailureTrunk =
  | "SYNTAX_SUBSTRATE"
  | "LOGIC_TEST_SURFACE"
  | "LOGIC_STATE_INTEGRITY"
  | "LOGIC_CONTROL_FLOW"
  | "ARCH_PROJECT_GRAPH"
  | "ALGO_HALTING"
  | "SAFETY_GUARD"
  | "INTEGRATION_FRAMEWORK_BINDING"
  | "INTEGRATION_DEPENDENCY_UNIVERSE"
  | "INTEGRATION_PROJECT_BINDING"
  | "CONTEXT_SPEC_GAP"
  | "UNKNOWN_TRUNK";

export type CodingFailureRoot =
  | "ROOT_TEST_ARTIFACT_MISSING"
  | "ROOT_STATE_LIFECYCLE_MISSING"
  | "ROOT_FRAMEWORK_ENTRY_MISSING"
  | "ROOT_DEPENDENCY_UNIVERSE_BROKEN"
  | "ROOT_PROJECT_BINDING_BROKEN"
  | "ROOT_CONTROL_FLOW_UNSAFE"
  | "ROOT_SYNTAX_SUBSTRATE_ILLEGAL"
  | "ROOT_ARCH_GRAPH_ILLEGAL"
  | "ROOT_SAFETY_GUARD_MISSING"
  | "ROOT_HALTING_PATH_ILLEGAL"
  | "ROOT_CONTEXT_SPEC_GAP"
  | "ROOT_UNKNOWN";

export type CodingFailureMetaRoot =
  | "META_ROOT_EXECUTION_SURFACE_MISSING"
  | "META_ROOT_STATEFUL_CORRECTNESS_MISSING"
  | "META_ROOT_COMPOSITION_BOUNDARY_ILLEGAL"
  | "META_ROOT_RUNTIME_SAFETY_BOUNDARY_MISSING"
  | "META_ROOT_CONTEXT_GAP"
  | "META_ROOT_UNKNOWN";

export function classifyCodingFailureDimension(reason: string): {
  dimension: CodingFailureDimension;
  classId: string;
} {
  const lower = reason.toLowerCase();

  if (
    /missing_code_blocks|python_syntax_invalid|output_does_not_look_like_code|empty_generation|invalid_response|witness_failed:fenced_code|wrong_language_surface/.test(lower)
  ) {
    return { dimension: "syntax", classId: "S0_SUBSTRATE_SHAPE" };
  }
  if (/witness_failed:tests|witness_failed:minimal_function_shape|python_runtime_invalid/.test(lower)) {
    return { dimension: "logic", classId: "L0_WITNESS_CORRECTNESS" };
  }
  if (/missing_export|circular_dependency|architecture_parse_error|witness_failed:project_graph/.test(lower)) {
    return { dimension: "architecture", classId: "A0_PROJECT_GRAPH" };
  }
  if (/floor_failed:u3_determinism|floor_failed:u1_totality|unstable_generation|timeout/.test(lower)) {
    return { dimension: "algorithm", classId: "G0_HALTING_COLLAPSE" };
  }
  if (/collapse_no_survivor|spec_|underspecified|unknown/.test(lower)) {
    return { dimension: "context", classId: "C0_SPEC_GAP" };
  }
  if (/semantic_failed:refactor_behavior_preserved|semantic_failed:refactor_import_binding|semantic_failed:orm_crud_binding|semantic_failed:api_response_contract|semantic_failed:intent_anchor_alignment/.test(lower)) {
    return { dimension: "logic", classId: "L1_SEMANTIC_CONTRACT" };
  }
  if (/semantic_failed:api_route_alignment|semantic_failed:api_response_alignment|semantic_failed:api_contract_breach|semantic_failed:app_route_service_alignment|semantic_failed:app_model_payload_alignment|semantic_failed:app_optimistic_blocking|semantic_failed:app_rsc_state_leak|semantic_failed:app_seo_ssr_miss|semantic_failed:app_preview_metadata_drift|semantic_failed:app_tenant_isolation_breach|semantic_failed:orm_model_action_alignment|semantic_failed:orm_session_leak|semantic_failed:compiler_stage_linkage|semantic_failed:ast_fidelity_loss|semantic_failed:game_loop_alignment|semantic_failed:game_loop_drift|semantic_failed:parser_pipeline_alignment|semantic_failed:refactor_delegate_alignment/.test(lower)) {
    return { dimension: "logic", classId: "L1_SEMANTIC_CONTRACT" };
  }
  if (/semantic_failed:app_boundary_leak|semantic_failed:app_serialization_block/.test(lower)) {
    return { dimension: "integration", classId: "I2.4_APP_FRAMEWORK_SURFACE" };
  }
  if (/semantic_failed:refactor_inline_logic_leak/.test(lower)) {
    return { dimension: "safety", classId: "F0_SAFETY_GUARD" };
  }
  if (reason.startsWith("surface_failed:")) {
    if (/test_behavior_surface/.test(lower)) {
      return { dimension: "logic", classId: "L2_TEST_BEHAVIOR_SURFACE" };
    }
    if (/single_framework_surface|orm_dependency_surface|import_path_surface|entrypoint_surface/.test(lower)) {
      return { dimension: "integration", classId: "I1_SURFACE_COHERENCE" };
    }
    return { dimension: "syntax", classId: "S1_LANGUAGE_SURFACE" };
  }
  if (reason.startsWith("security_failed:")) {
    return { dimension: "safety", classId: "F1_DIRECT_SECURITY" };
  }
  if (reason.startsWith("state_failed:")) {
    if (/l7\.1/.test(lower)) return { dimension: "logic", classId: "L7.1_UNINITIALIZED_VARIABLE" };
    if (/l7\.2/.test(lower)) return { dimension: "logic", classId: "L7.2_RACE_CONDITION" };
    if (/l7\.3/.test(lower)) return { dimension: "logic", classId: "L7.3_DEADLOCK" };
    if (/l7\.4/.test(lower)) return { dimension: "logic", classId: "L7.4_STATE_INCONSISTENCY" };
    if (/l7\.5/.test(lower)) return { dimension: "logic", classId: "L7.5_GLOBAL_STATE_POLLUTION" };
    if (/l7\.6/.test(lower)) return { dimension: "logic", classId: "L7.6_STALE_STATE" };
    if (/l7\.7/.test(lower)) return { dimension: "logic", classId: "L7.7_MISSING_STATE_RESET" };
  }
  if (reason.startsWith("design_failed:")) {
    if (/a1\.1/.test(lower)) return { dimension: "architecture", classId: "A1.1_TIGHT_COUPLING" };
    if (/a1\.2/.test(lower)) return { dimension: "architecture", classId: "A1.2_GOD_OBJECT" };
    if (/a1\.4/.test(lower)) return { dimension: "architecture", classId: "A1.4_FEATURE_ENVY" };
    if (/a1\.5/.test(lower)) return { dimension: "architecture", classId: "A1.5_INAPPROPRIATE_INTIMACY" };
    if (/a1\.6/.test(lower)) return { dimension: "architecture", classId: "A1.6_MESSAGE_CHAIN" };
    if (/a1\.7/.test(lower)) return { dimension: "architecture", classId: "A1.7_MIDDLE_MAN" };
  }
  if (reason.startsWith("scale_failed:")) {
    if (/g1\.1/.test(lower)) return { dimension: "algorithm", classId: "G1.1_WRONG_TIME_COMPLEXITY" };
    if (/g1\.2/.test(lower)) return { dimension: "algorithm", classId: "G1.2_EXPONENTIAL_WHEN_POLYNOMIAL_EXISTS" };
    if (/g1\.3/.test(lower)) return { dimension: "algorithm", classId: "G1.3_DOESNT_SCALE" };
  }
  if (reason.startsWith("dependency_failed:")) {
    if (/i1\.1/.test(lower)) return { dimension: "integration", classId: "I1.1_VERSION_MISMATCH" };
    if (/i1\.2/.test(lower)) return { dimension: "integration", classId: "I1.2_MISSING_DEPENDENCY" };
    if (/i1\.3/.test(lower)) return { dimension: "integration", classId: "I1.3_TRANSITIVE_DEPENDENCY_CONFLICT" };
  }
  if (reason.startsWith("integration_failed:")) {
    if (/i0_execution_surface/.test(lower)) return { dimension: "integration", classId: "I0_EXECUTION_SURFACE" };
    if (/i0_surface_binding/.test(lower)) return { dimension: "integration", classId: "I0_SURFACE_BINDING" };
    if (/i2\.1/.test(lower)) return { dimension: "integration", classId: "I2.1_API_FRAMEWORK_SURFACE" };
    if (/i2\.2/.test(lower)) return { dimension: "integration", classId: "I2.2_API_ROUTE_SURFACE" };
    if (/i2\.3/.test(lower)) return { dimension: "integration", classId: "I2.3_API_TEST_HARNESS" };
    if (/i2\.4/.test(lower)) return { dimension: "integration", classId: "I2.4_APP_FRAMEWORK_SURFACE" };
    if (/i2\.5/.test(lower)) return { dimension: "integration", classId: "I2.5_APP_TEST_SURFACE" };
    if (/i2\.6/.test(lower)) return { dimension: "integration", classId: "I2.6_APP_SERVICE_BINDING" };
    if (/i2\.7/.test(lower)) return { dimension: "integration", classId: "I2.7_ORM_SINGLE_DEPENDENCY_UNIVERSE" };
    if (/i2\.8/.test(lower)) return { dimension: "integration", classId: "I2.8_GAME_RUNTIME_DEPENDENCY_SURFACE" };
    if (/i2\.9/.test(lower)) return { dimension: "integration", classId: "I2.9_REFACTOR_IMPORT_CONTINUITY" };
  }
  if (reason.startsWith("execution_failed:")) {
    if (/ex_sec_timing|ex_sec_webhook_sig/.test(lower)) {
      return { dimension: "safety", classId: "F1_DIRECT_SECURITY" };
    }
    if (/ex_timeout_recursion|ex_timeout/.test(lower)) {
      return { dimension: "algorithm", classId: "G0_HALTING_COLLAPSE" };
    }
    if (/e1\.|e2\.|e3\.|e4\.|e5\.|ex_import|ex_smoke_assert/.test(lower)) {
      return { dimension: "integration", classId: "I0_EXECUTION_SURFACE" };
    }
    if (/ex_compile/.test(lower)) {
      return { dimension: "syntax", classId: "S0_SUBSTRATE_SHAPE" };
    }
    return { dimension: "integration", classId: "I0_EXECUTION_SURFACE" };
  }
  if (reason.startsWith("oracle_failed:")) {
    if (/fileset|import|export/.test(lower)) {
      return { dimension: "integration", classId: "I0_EXECUTION_SURFACE" };
    }
    return { dimension: "integration", classId: "I0_EXECUTION_SURFACE" };
  }
  if (reason.startsWith("grounding_failed:")) {
    if (/g3\.1|g3\.2/.test(lower)) return { dimension: "integration", classId: "I2.1_API_FRAMEWORK_SURFACE" };
    if (/g3\.3|g3\.4/.test(lower)) return { dimension: "integration", classId: "I2.7_ORM_SINGLE_DEPENDENCY_UNIVERSE" };
    if (/g3\.5|g3\.6/.test(lower)) return { dimension: "integration", classId: "I2.8_GAME_RUNTIME_DEPENDENCY_SURFACE" };
    if (/g3\.7/.test(lower)) return { dimension: "integration", classId: "I0_SURFACE_BINDING" };
  }
  if (reason.startsWith("logic_failed:")) {
    if (/l1\.1/.test(lower)) return { dimension: "logic", classId: "L1.1_SIDE_EFFECT_LEAK" };
    if (/l1\.4/.test(lower)) return { dimension: "logic", classId: "L1.4_MISSING_CONDITION_CASE" };
    if (/l2\.2/.test(lower)) return { dimension: "logic", classId: "L2.2_INFINITE_LOOP" };
    if (/l3\.1/.test(lower)) return { dimension: "logic", classId: "L3.1_MISSING_RETURN" };
    if (/l3\.2/.test(lower)) return { dimension: "logic", classId: "L3.2_WRONG_RETURN_TYPE" };
    if (/l4\.2/.test(lower)) return { dimension: "logic", classId: "L4.2_NULL_NONE_DEREFERENCE" };
    if (/l5\.3/.test(lower)) return { dimension: "logic", classId: "L5.3_MUTATION_DURING_ITERATION" };
    if (/l5\.5/.test(lower)) return { dimension: "logic", classId: "L5.5_KEY_NOT_FOUND" };
    if (/l6\.4/.test(lower)) return { dimension: "logic", classId: "L6.4_EXCEPTION_SWALLOWING" };
    if (/l8\.1/.test(lower)) return { dimension: "logic", classId: "L8.1_MISSING_TEST_BLOCK" };
    if (/l8\.2/.test(lower)) return { dimension: "logic", classId: "L8.2_TRIVIAL_TEST_ASSERTION" };
    if (/l8\.3/.test(lower)) return { dimension: "logic", classId: "L8.3_MISSING_BEHAVIOR_ASSERTION" };
  }
  if (/oracle_api_guard_missing|oracle_refactor_guard_missing/.test(lower)) {
    return { dimension: "safety", classId: "F0_SAFETY_GUARD" };
  }
  if (/floor_failed:u5_explicit_failure|floor_failed:u6_algebraic_data|auth_guard/.test(lower)) {
    return { dimension: "safety", classId: "F0_SAFETY_GUARD" };
  }
  if (/witness_failed:api_surface|witness_failed:orm_shape|witness_failed:parse_shape|witness_failed:compiler_structure|witness_failed:game_loop_shape|witness_failed:dependency_surface|wrong_dependency_surface|semantic_failed:api_route_contract|semantic_failed:app_service_binding|semantic_failed:app_test_surface|semantic_failed:orm_model_identity|semantic_failed:compiler_pipeline_surface|semantic_failed:game_runtime_surface/.test(lower)) {
    return { dimension: "integration", classId: "I0_SURFACE_BINDING" };
  }

  return { dimension: "unknown", classId: "U0_UNKNOWN" };
}
export function classifyCodingFailureTrunk(reason: string): CodingFailureTrunk {
  const { dimension, classId } = classifyCodingFailureDimension(reason);

  if (dimension === "syntax") return "SYNTAX_SUBSTRATE";
  if (dimension === "architecture") return "ARCH_PROJECT_GRAPH";
  if (dimension === "algorithm") return "ALGO_HALTING";
  if (dimension === "safety") return "SAFETY_GUARD";
  if (dimension === "context") return "CONTEXT_SPEC_GAP";

  if (dimension === "logic") {
    if (/^L8\./.test(classId)) return "LOGIC_TEST_SURFACE";
    if (/^L7\./.test(classId)) return "LOGIC_STATE_INTEGRITY";
    return "LOGIC_CONTROL_FLOW";
  }

  if (dimension === "integration") {
    if (/^I1\./.test(classId)) return "INTEGRATION_DEPENDENCY_UNIVERSE";
    if (/^I2\.(1|2|3|4|5|7|8)\b/.test(classId)) return "INTEGRATION_FRAMEWORK_BINDING";
    if (classId === "I0_EXECUTION_SURFACE") return "INTEGRATION_FRAMEWORK_BINDING";
    if (/^I2\.(6|9)\b/.test(classId) || classId === "I0_SURFACE_BINDING") return "INTEGRATION_PROJECT_BINDING";
    return "INTEGRATION_FRAMEWORK_BINDING";
  }

  return "UNKNOWN_TRUNK";
}

export function classifyCodingFailureRoot(reason: string): CodingFailureRoot {
  const { dimension, classId } = classifyCodingFailureDimension(reason);

  if (dimension === "logic") {
    if (/^L8\./.test(classId)) return "ROOT_TEST_ARTIFACT_MISSING";
    if (/^L7\./.test(classId)) return "ROOT_STATE_LIFECYCLE_MISSING";
    return "ROOT_CONTROL_FLOW_UNSAFE";
  }

  if (dimension === "integration") {
    if (/^I1\./.test(classId)) return "ROOT_DEPENDENCY_UNIVERSE_BROKEN";
    if (/^I2\.(1|2|3|4|5|7|8)\b/.test(classId)) return "ROOT_FRAMEWORK_ENTRY_MISSING";
    if (classId === "I0_EXECUTION_SURFACE") return "ROOT_FRAMEWORK_ENTRY_MISSING";
    if (/^I2\.(6|9)\b/.test(classId) || classId === "I0_SURFACE_BINDING") return "ROOT_PROJECT_BINDING_BROKEN";
    return "ROOT_FRAMEWORK_ENTRY_MISSING";
  }

  if (dimension === "syntax") return "ROOT_SYNTAX_SUBSTRATE_ILLEGAL";
  if (dimension === "architecture") return "ROOT_ARCH_GRAPH_ILLEGAL";
  if (dimension === "safety") return "ROOT_SAFETY_GUARD_MISSING";
  if (dimension === "algorithm") return "ROOT_HALTING_PATH_ILLEGAL";
  if (dimension === "context") return "ROOT_CONTEXT_SPEC_GAP";
  return "ROOT_UNKNOWN";
}

export function classifyCodingFailureMetaRoot(reason: string): CodingFailureMetaRoot {
  const root = classifyCodingFailureRoot(reason);

  if (
    root === "ROOT_TEST_ARTIFACT_MISSING"
    || root === "ROOT_FRAMEWORK_ENTRY_MISSING"
    || root === "ROOT_PROJECT_BINDING_BROKEN"
  ) {
    return "META_ROOT_EXECUTION_SURFACE_MISSING";
  }

  if (
    root === "ROOT_STATE_LIFECYCLE_MISSING"
    || root === "ROOT_CONTROL_FLOW_UNSAFE"
  ) {
    return "META_ROOT_STATEFUL_CORRECTNESS_MISSING";
  }

  if (
    root === "ROOT_SYNTAX_SUBSTRATE_ILLEGAL"
    || root === "ROOT_ARCH_GRAPH_ILLEGAL"
    || root === "ROOT_DEPENDENCY_UNIVERSE_BROKEN"
  ) {
    return "META_ROOT_COMPOSITION_BOUNDARY_ILLEGAL";
  }

  if (
    root === "ROOT_SAFETY_GUARD_MISSING"
    || root === "ROOT_HALTING_PATH_ILLEGAL"
  ) {
    return "META_ROOT_RUNTIME_SAFETY_BOUNDARY_MISSING";
  }

  if (root === "ROOT_CONTEXT_SPEC_GAP") {
    return "META_ROOT_CONTEXT_GAP";
  }

  return "META_ROOT_UNKNOWN";
}
