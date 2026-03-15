# Coding Hostile Pack Coverage

- total hostile packs: `13`
- caught: `13`
- missed: `0`
- staged: `0`

| Family | Variant | Expected | Actual | Status |
| --- | --- | --- | --- | --- |
| api | API_SILENT_SCHEMA_BYPASS | semantic_failed:api_contract_breach | semantic_failed:api_contract_breach | caught |
| auth | AUTH_TIMING_LEAK | execution_failed:EX_SEC_TIMING | execution_failed:EX_SEC_TIMING | caught |
| compiler | COMPILER_SILENT_SWALLOW | semantic_failed:ast_fidelity_loss | semantic_failed:ast_fidelity_loss | caught |
| game | GAME_TICK_COUPLING | semantic_failed:game_loop_drift | semantic_failed:game_loop_drift | caught |
| orm | ORM_LAZY_DETACH_BOMB | semantic_failed:orm_session_leak | semantic_failed:orm_session_leak | caught |
| refactor | REFACTOR_SILENT_SABOTAGE_ANCHORED | logic_failed:L8.2_TEST_MUTATION | logic_failed:L8.2_TEST_MUTATION:mutated_test_matches_bug | caught |
| parser | PARSER_INFINITE_LOOKAHEAD_BOMB | execution_failed:EX_TIMEOUT_RECURSION | execution_failed:EX_TIMEOUT_RECURSION | caught |
| utility | UTILITY_REFERENCE_POISONING | logic_failed:L1.1_SIDE_EFFECT_LEAK | logic_failed:L1.1_SIDE_EFFECT_LEAK:mutates_input_reference | caught |
| app | APP_PREVIEW_METADATA_DRIFT | semantic_failed:app_preview_metadata_drift | semantic_failed:app_preview_metadata_drift | caught |
| app | APP_SEARCH_ROUTE_MODE_DRIFT | semantic_failed:app_rsc_state_leak | semantic_failed:app_rsc_state_leak | caught |
| app | APP_CLIENT_ENV_LEAK | execution_failed:EX_SEC_ENV_LEAK | execution_failed:EX_SEC_ENV_LEAK | caught |
| app | APP_SSR_WINDOW_CRASH | execution_failed:EX_SSR_CRASH | execution_failed:EX_SSR_CRASH | caught |
| app | APP_TENANT_BILLING_WEBHOOK_DRIFT | semantic_failed:app_tenant_isolation_breach | semantic_failed:app_tenant_isolation_breach | caught |

## Classification

| Family | Expected Root | Actual Root | Expected Meta-Root | Actual Meta-Root |
| --- | --- | --- | --- | --- |
| api | ROOT_CONTROL_FLOW_UNSAFE | ROOT_CONTROL_FLOW_UNSAFE | META_ROOT_STATEFUL_CORRECTNESS_MISSING | META_ROOT_STATEFUL_CORRECTNESS_MISSING |
| auth | ROOT_SAFETY_GUARD_MISSING | ROOT_SAFETY_GUARD_MISSING | META_ROOT_RUNTIME_SAFETY_BOUNDARY_MISSING | META_ROOT_RUNTIME_SAFETY_BOUNDARY_MISSING |
| compiler | ROOT_CONTROL_FLOW_UNSAFE | ROOT_CONTROL_FLOW_UNSAFE | META_ROOT_STATEFUL_CORRECTNESS_MISSING | META_ROOT_STATEFUL_CORRECTNESS_MISSING |
| game | ROOT_CONTROL_FLOW_UNSAFE | ROOT_CONTROL_FLOW_UNSAFE | META_ROOT_STATEFUL_CORRECTNESS_MISSING | META_ROOT_STATEFUL_CORRECTNESS_MISSING |
| orm | ROOT_CONTROL_FLOW_UNSAFE | ROOT_CONTROL_FLOW_UNSAFE | META_ROOT_STATEFUL_CORRECTNESS_MISSING | META_ROOT_STATEFUL_CORRECTNESS_MISSING |
| refactor | ROOT_TEST_ARTIFACT_MISSING | ROOT_TEST_ARTIFACT_MISSING | META_ROOT_EXECUTION_SURFACE_MISSING | META_ROOT_EXECUTION_SURFACE_MISSING |
| parser | ROOT_HALTING_PATH_ILLEGAL | ROOT_HALTING_PATH_ILLEGAL | META_ROOT_RUNTIME_SAFETY_BOUNDARY_MISSING | META_ROOT_RUNTIME_SAFETY_BOUNDARY_MISSING |
| utility | ROOT_CONTROL_FLOW_UNSAFE | ROOT_CONTROL_FLOW_UNSAFE | META_ROOT_STATEFUL_CORRECTNESS_MISSING | META_ROOT_STATEFUL_CORRECTNESS_MISSING |
| app | ROOT_CONTROL_FLOW_UNSAFE | ROOT_CONTROL_FLOW_UNSAFE | META_ROOT_STATEFUL_CORRECTNESS_MISSING | META_ROOT_STATEFUL_CORRECTNESS_MISSING |
| app | ROOT_CONTROL_FLOW_UNSAFE | ROOT_CONTROL_FLOW_UNSAFE | META_ROOT_STATEFUL_CORRECTNESS_MISSING | META_ROOT_STATEFUL_CORRECTNESS_MISSING |
| app | ROOT_FRAMEWORK_ENTRY_MISSING | ROOT_FRAMEWORK_ENTRY_MISSING | META_ROOT_EXECUTION_SURFACE_MISSING | META_ROOT_EXECUTION_SURFACE_MISSING |
| app | ROOT_FRAMEWORK_ENTRY_MISSING | ROOT_FRAMEWORK_ENTRY_MISSING | META_ROOT_EXECUTION_SURFACE_MISSING | META_ROOT_EXECUTION_SURFACE_MISSING |
| app | ROOT_CONTROL_FLOW_UNSAFE | ROOT_CONTROL_FLOW_UNSAFE | META_ROOT_STATEFUL_CORRECTNESS_MISSING | META_ROOT_STATEFUL_CORRECTNESS_MISSING |
