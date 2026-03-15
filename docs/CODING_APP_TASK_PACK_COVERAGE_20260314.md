# Coding App Task Pack Coverage

- lawful tasks: `5`
- lawful survivors: `5`
- hostile tasks: `5`
- hostile caught: `5`

## Lawful

| Task | Expected | Actual | Status |
| --- | --- | --- | --- |
| app_role_gated_delete_button | survivor | survivor | survivor |
| app_optimistic_ui_like_button | survivor | survivor | survivor |
| app_rsc_pagination_url_state | survivor | survivor | survivor |
| app_stripe_webhook_route_handler | survivor | survivor | survivor |
| app_dynamic_seo_metadata_generation | survivor | survivor | survivor |

## Hostile

| Task | Expected | Actual | Status |
| --- | --- | --- | --- |
| APP_TASK_DELETE_AUTH_BYPASS | execution_failed:EX_SEC_ACTION_AUTH | integration_failed:I2.4_APP_FRAMEWORK_SURFACE:oracle_required_fileset | caught |
| APP_TASK_OPTIMISTIC_BLOCK | semantic_failed:app_optimistic_blocking | semantic_failed:app_route_service_alignment | caught |
| APP_TASK_PAGINATION_CLIENT_LEAK | semantic_failed:app_rsc_state_leak | semantic_failed:app_rsc_state_leak | caught |
| APP_TASK_WEBHOOK_SIG_BYPASS | execution_failed:EX_SEC_WEBHOOK_SIG | execution_failed:EX_SEC_WEBHOOK_SIG | caught |
| APP_TASK_METADATA_CLIENT_TRAP | semantic_failed:app_seo_ssr_miss | semantic_failed:app_seo_ssr_miss | caught |

## Classification

| Task | Expected Root | Actual Root | Expected Meta-Root | Actual Meta-Root |
| --- | --- | --- | --- | --- |
| app_role_gated_delete_button | survivor | ROOT_UNKNOWN | survivor | META_ROOT_UNKNOWN |
| app_optimistic_ui_like_button | survivor | ROOT_UNKNOWN | survivor | META_ROOT_UNKNOWN |
| app_rsc_pagination_url_state | survivor | ROOT_UNKNOWN | survivor | META_ROOT_UNKNOWN |
| app_stripe_webhook_route_handler | survivor | ROOT_UNKNOWN | survivor | META_ROOT_UNKNOWN |
| app_dynamic_seo_metadata_generation | survivor | ROOT_UNKNOWN | survivor | META_ROOT_UNKNOWN |
| APP_TASK_DELETE_AUTH_BYPASS | ROOT_FRAMEWORK_ENTRY_MISSING | ROOT_FRAMEWORK_ENTRY_MISSING | META_ROOT_EXECUTION_SURFACE_MISSING | META_ROOT_EXECUTION_SURFACE_MISSING |
| APP_TASK_OPTIMISTIC_BLOCK | ROOT_CONTROL_FLOW_UNSAFE | ROOT_CONTROL_FLOW_UNSAFE | META_ROOT_STATEFUL_CORRECTNESS_MISSING | META_ROOT_STATEFUL_CORRECTNESS_MISSING |
| APP_TASK_PAGINATION_CLIENT_LEAK | ROOT_CONTROL_FLOW_UNSAFE | ROOT_CONTROL_FLOW_UNSAFE | META_ROOT_STATEFUL_CORRECTNESS_MISSING | META_ROOT_STATEFUL_CORRECTNESS_MISSING |
| APP_TASK_WEBHOOK_SIG_BYPASS | ROOT_SAFETY_GUARD_MISSING | ROOT_SAFETY_GUARD_MISSING | META_ROOT_RUNTIME_SAFETY_BOUNDARY_MISSING | META_ROOT_RUNTIME_SAFETY_BOUNDARY_MISSING |
| APP_TASK_METADATA_CLIENT_TRAP | ROOT_CONTROL_FLOW_UNSAFE | ROOT_CONTROL_FLOW_UNSAFE | META_ROOT_STATEFUL_CORRECTNESS_MISSING | META_ROOT_STATEFUL_CORRECTNESS_MISSING |
