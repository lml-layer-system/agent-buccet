/* @ts-self-types="./buccet_substrate.d.ts" */
import * as wasm from "./buccet_substrate_bg.wasm";
import { __wbg_set_wasm } from "./buccet_substrate_bg.js";

__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export {
    d_apply_isolation_wasm, d_control_network_wasm, d_enforce_contract_wasm, d_enforce_resource_limit_wasm, d_manage_lifecycle_wasm, d_persist_state_wasm, k_enforce_wasm, k_orchestrate_wasm, k_reconcile_state_wasm, k_route_wasm, k_schedule_wasm, k_validate_wasm, q_apply_isolation_wasm, q_assign_trust_domain_wasm, q_enforce_policy_wasm, q_intercept_call_wasm, q_manage_lifecycle_wasm
} from "./buccet_substrate_bg.js";
