/* tslint:disable */
/* eslint-disable */

export function d_apply_isolation_wasm(unit_id: string, config: any): any;

/**
 * config.action: "create" | "destroy"
 */
export function d_control_network_wasm(unit_id: string, config: any): boolean;

export function d_enforce_contract_wasm(unit_id: string, config: any): boolean;

/**
 * config: { ...metadata }, limits: { memory?, cpu?, cpu_period?, pids? }
 * Order matches Python substrate: (unit_id, config, limits)
 */
export function d_enforce_resource_limit_wasm(unit_id: string, config: any, limits: any): boolean;

/**
 * Returns pid (f64) on "start" or alive "status", null otherwise.
 * Store the pid and pass as config._pid for stop/status calls.
 */
export function d_manage_lifecycle_wasm(unit_id: string, config: any): any;

export function d_persist_state_wasm(unit_id: string, config: any): boolean;

export function k_enforce_wasm(unit_id: string, config: any): any;

export function k_orchestrate_wasm(unit_id: string, config: any): boolean;

export function k_reconcile_state_wasm(unit_id: string, config: any): any;

/**
 * Returns { endpoint: string, next_counter: number }.
 * Pass next_counter back as config._route_counter on each subsequent call.
 */
export function k_route_wasm(unit_id: string, config: any): any;

export function k_schedule_wasm(candidates: any, constraints: any, config: any): string;

export function k_validate_wasm(unit_id: string, config: any): any;

export function q_apply_isolation_wasm(unit_id: string, config: any): any;

export function q_assign_trust_domain_wasm(unit_id: string, config: any): string;

export function q_enforce_policy_wasm(subject: string, resource: string, action: string, config: any): any;

export function q_intercept_call_wasm(unit_id: string, config: any): any;

export function q_manage_lifecycle_wasm(unit_id: string, config: any): boolean;
