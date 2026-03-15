# Coding Adversarial Simulation Report

## Summary
- scenarios: 9
- visited probe-field nodes: 312
- survivors: 3
- raw pruned: 57
- structural pruned: 20
- root pruned: 9
- meta-root pruned: 5
- uncovered meta-roots: 1

## Coding Competence (CC1-CC9)
- CC1 Syntax Mastery: 5/8
  - Strong syntax/fence/witness rejection and slot-bounded emission exist, but there is not yet grammar-constrained projection per language.
- CC2 Semantic Understanding: 5/7
  - Family semantic validators now check route/test alignment, service delegation, parser/compiler pipeline linkage, game loop linkage, refactor delegation, and ORM action coherence, but collapse is still heuristic rather than symbolic or proof-carrying.
- CC3 API / Library Knowledge: 5/7
  - Framework/dependency validators, verified library-surface grounding, and version-coherent surface checks now exist, but there is still no documentation retrieval or dynamic discovery path yet.
- CC4 Pattern Knowledge: 6/7
  - Family emitters and project graphs encode reusable patterns across app/api/game/compiler/orm/parser families.
- CC5 Constraint Adherence: 7/8
  - Coding runs through witness, floor, architecture, security, dependency, state, surface, integration, and execution constraints before emission.
- CC6 Error Detection & Recovery: 6/7
  - Hostile sim, structured failure classes, NSL deterministic repair ladder, fail-closed collapse, and bounded temp-project compile/import/runtime smoke now exist across core families; deeper real-environment execution still remains.
- CC7 Problem Decomposition: 6/7
  - Intent spec, skeleton contracts, family emitters, and multi-variant project graphs provide lawful decomposition, but graph search is still narrow.
- CC8 Context Integration: 6/7
  - Refactor/app integration laws now include bounded local codebase indexing, actual local import-graph extraction, hot-module awareness, and repo boundary hints, but convention learning and deeper repo-native reasoning are still early.
- CC9 Instruction Understanding: 6/7
  - Coding intent spec and clarification scoring exist, and ambiguous asks can be clarified rather than projected blindly.

## Universal Failure Groups (343 Overlay)
- robustness: 7
- security: 3
- determinism: 3
- resource: 2
- correctness: 2
- termination: 2
- unknown: 1

## Failure Dimensions
- logic: 9
- integration: 6
- safety: 3
- unknown: 1
- algorithm: 1

## Failure Trunks
- LOGIC_STATE_INTEGRITY: 5
- LOGIC_CONTROL_FLOW: 3
- SAFETY_GUARD: 3
- INTEGRATION_FRAMEWORK_BINDING: 3
- INTEGRATION_DEPENDENCY_UNIVERSE: 2
- UNKNOWN_TRUNK: 1
- INTEGRATION_PROJECT_BINDING: 1
- LOGIC_TEST_SURFACE: 1
- ALGO_HALTING: 1

## Failure Roots
- ROOT_CONTROL_FLOW_UNSAFE: 1
- ROOT_DEPENDENCY_UNIVERSE_BROKEN: 1
- ROOT_SAFETY_GUARD_MISSING: 1
- ROOT_STATE_LIFECYCLE_MISSING: 1
- ROOT_UNKNOWN: 1
- ROOT_FRAMEWORK_ENTRY_MISSING: 1
- ROOT_PROJECT_BINDING_BROKEN: 1
- ROOT_TEST_ARTIFACT_MISSING: 1
- ROOT_HALTING_PATH_ILLEGAL: 1

## Failure Meta-Roots
- META_ROOT_COMPOSITION_BOUNDARY_ILLEGAL: 1
- META_ROOT_EXECUTION_SURFACE_MISSING: 1
- META_ROOT_RUNTIME_SAFETY_BOUNDARY_MISSING: 1
- META_ROOT_STATEFUL_CORRECTNESS_MISSING: 1
- META_ROOT_UNKNOWN: 1

## Meta-Root Coverage
- META_ROOT_COMPOSITION_BOUNDARY_ILLEGAL: lawed
- META_ROOT_EXECUTION_SURFACE_MISSING: lawed
- META_ROOT_RUNTIME_SAFETY_BOUNDARY_MISSING: lawed
- META_ROOT_STATEFUL_CORRECTNESS_MISSING: lawed
- META_ROOT_UNKNOWN: uncovered

## Trunk Law Coverage
- LOGIC_STATE_INTEGRITY: lawed
- LOGIC_CONTROL_FLOW: lawed
- SAFETY_GUARD: lawed
- INTEGRATION_FRAMEWORK_BINDING: lawed
- INTEGRATION_DEPENDENCY_UNIVERSE: lawed
- UNKNOWN_TRUNK: lawed
- INTEGRATION_PROJECT_BINDING: lawed
- LOGIC_TEST_SURFACE: lawed
- ALGO_HALTING: lawed

## Coverage
- covered_families: api, app, auth, compiler, game, orm, parser, refactor, utility
- missing_families: none

## Failure Dimensions By Family
- api: logic=1
- app: integration=3, logic=3, safety=2
- auth: unknown=1
- compiler: integration=1
- game: logic=1
- orm: logic=1
- parser: integration=1
- refactor: logic=1
- utility: logic=2, safety=1, algorithm=1, integration=1

## Survivors
- S01/lawful_baseline: family=utility lineage=lawful_seed
- S03/lawful_baseline: family=parser lineage=lawful_seed
- S05/lawful_baseline: family=app lineage=lawful_seed

## Pruned Variants
- S09/lawful_baseline: logic:L1_SEMANTIC_CONTRACT:semantic_failed:api_route_alignment
  - lineage: lawful_seed
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=semantic_failed:api_route_alignment
- S05/safety_hardcoded_credentials: safety:F1_DIRECT_SECURITY:security_failed:hardcoded_credentials
  - lineage: lawful_seed -> safety_hardcoded_credentials
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=pass | logic=pass | security=security_failed:hardcoded_credentials
- S05/safety_xss_vulnerability: safety:F1_DIRECT_SECURITY:security_failed:xss_vulnerability
  - lineage: lawful_seed -> safety_xss_vulnerability
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=pass | logic=pass | security=security_failed:xss_vulnerability
- S05/dependency_version_mismatch: integration:I1.1_VERSION_MISMATCH:dependency_failed:I1.1_VERSION_MISMATCH
  - lineage: lawful_seed -> dependency_version_mismatch
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=pass | logic=pass | security=pass | state=pass | surface=pass | design=pass | scale=pass | dependencies=dependency_failed:I1.1_VERSION_MISMATCH
- S05/dependency_transitive_conflict: integration:I1.3_TRANSITIVE_DEPENDENCY_CONFLICT:dependency_failed:I1.3_TRANSITIVE_DEPENDENCY_CONFLICT
  - lineage: lawful_seed -> dependency_transitive_conflict
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=pass | logic=pass | security=pass | state=pass | surface=pass | design=pass | scale=pass | dependencies=dependency_failed:I1.3_TRANSITIVE_DEPENDENCY_CONFLICT
- S05/app_drop_testclient: integration:I2.5_APP_TEST_SURFACE:integration_failed:I2.5_APP_TEST_SURFACE
  - lineage: lawful_seed -> app_drop_testclient
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=integration_failed:I2.5_APP_TEST_SURFACE
- S05/state_race_condition: logic:L7.2_RACE_CONDITION:state_failed:L7.2_RACE_CONDITION:shared_mutation_without_lock
  - lineage: lawful_seed -> state_race_condition
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=pass | logic=pass | security=pass | state=state_failed:L7.2_RACE_CONDITION:shared_mutation_without_lock
- S05/state_deadlock: logic:L7.3_DEADLOCK:state_failed:L7.3_DEADLOCK:reentrant_lock_acquire
  - lineage: lawful_seed -> state_deadlock
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=pass | logic=pass | security=pass | state=state_failed:L7.3_DEADLOCK:reentrant_lock_acquire
- S05/state_global_pollution: logic:L7.5_GLOBAL_STATE_POLLUTION:state_failed:L7.5_GLOBAL_STATE_POLLUTION:global_mutation
  - lineage: lawful_seed -> state_global_pollution
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=pass | logic=pass | security=pass | state=state_failed:L7.5_GLOBAL_STATE_POLLUTION:global_mutation
- S02/lawful_baseline: unknown:U0_UNKNOWN:integration_failed:I0_SURFACE_BINDING:oracle_import_contract
  - lineage: lawful_seed
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=pass | logic=pass | security=pass | state=pass | surface=pass | design=pass | scale=pass | dependencies=pass | grounding=pass | integration=integration_failed:I0_SURFACE_BINDING:oracle_import_contract
- S04/lawful_baseline: integration:I0_EXECUTION_SURFACE:execution_failed:EX_IMPORT
  - lineage: lawful_seed
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=pass | logic=pass | security=pass | state=pass | surface=pass | design=pass | scale=pass | dependencies=pass | grounding=pass | integration=pass | execution=execution_failed:EX_IMPORT
- S06/lawful_baseline: logic:L1_SEMANTIC_CONTRACT:semantic_failed:game_loop_alignment
  - lineage: lawful_seed
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=semantic_failed:game_loop_alignment
- S08/lawful_baseline: logic:L1_SEMANTIC_CONTRACT:semantic_failed:orm_crud_binding
  - lineage: lawful_seed
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=semantic_failed:orm_crud_binding
- S03/context_wrong_family: integration:I0_SURFACE_BINDING:witness_failed:parse_shape
  - lineage: lawful_seed -> context_wrong_family
  - probes: shape=pass | language_surface=pass | witness=witness_failed:parse_shape
- S07/lawful_baseline: logic:L8.1_MISSING_TEST_BLOCK:logic_failed:L8.1_MISSING_TEST_BLOCK:no_test_function
  - lineage: lawful_seed
  - probes: shape=pass | language_surface=pass | witness=logic_failed:L8.1_MISSING_TEST_BLOCK:no_test_function
- S01/safety_bare_except: safety:F0_SAFETY_GUARD:floor_failed:u5_explicit_failure
  - lineage: lawful_seed -> safety_bare_except
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=floor_failed:u5_explicit_failure
- S01/scale_exponential: algorithm:G1.2_EXPONENTIAL_WHEN_POLYNOMIAL_EXISTS:scale_failed:G1.2_EXPONENTIAL_WHEN_POLYNOMIAL_EXISTS
  - lineage: lawful_seed -> scale_exponential
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=pass | logic=pass | security=pass | state=pass | surface=pass | design=pass | scale=scale_failed:G1.2_EXPONENTIAL_WHEN_POLYNOMIAL_EXISTS
- S01/algorithm_non_halting: integration:I0_EXECUTION_SURFACE:execution_failed:EX_RUNTIME
  - lineage: lawful_seed -> algorithm_non_halting
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=pass | logic=pass | security=pass | state=pass | surface=pass | design=pass | scale=pass | dependencies=pass | grounding=pass | integration=pass | execution=execution_failed:EX_RUNTIME
- S01/state_uninitialized_variable: logic:L7.1_UNINITIALIZED_VARIABLE:state_failed:L7.1_UNINITIALIZED_VARIABLE:return_undefined_result
  - lineage: lawful_seed -> state_uninitialized_variable
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=pass | logic=pass | security=pass | state=state_failed:L7.1_UNINITIALIZED_VARIABLE:return_undefined_result
- S01/state_global_pollution: logic:L7.5_GLOBAL_STATE_POLLUTION:state_failed:L7.5_GLOBAL_STATE_POLLUTION:global_mutation
  - lineage: lawful_seed -> state_global_pollution
  - probes: shape=pass | language_surface=pass | witness=pass | architecture=pass | floor=pass | semantics=pass | logic=pass | security=pass | state=state_failed:L7.5_GLOBAL_STATE_POLLUTION:global_mutation

## Dominant Next Law Targets
- logic: harden witness correctness and missing-case laws.
- integration: harden framework/ecosystem binding laws.
- safety: harden explicit failure and guard preservation laws.

## Read
- This sim is bounded QE/EFUE, not brute-force enumeration.
- Adversarial variants are expanded lazily by mutation operators.
- EFUE pruning happens probe-by-probe as soon as a node violates the current law stack.
- This keeps the sim closed-loop and local while still pressuring a wider possibility field.
- Universal failure groups are a higher-order coverage overlay derived from the 343-class taxonomy, not a replacement for direct coding leaf/trunk/root collapse.
