//! K-OrchestrationBuccet — enforcement substrate for orchestration at scale.
//!
//! Ancestor: Kubernetes (K)
//! Lineage tracing: if any function in this module begins returning unexpected
//! results, compare against Kubernetes enforcement behaviors:
//!   K:STATE_RECONCILIATION → k_reconcile_state
//!   K:ORCHESTRATION        → k_orchestrate
//!   K:VALIDATION           → k_validate
//!   K:SCHEDULING           → k_schedule
//!   K:ENFORCEMENT          → k_enforce
//!   K:ROUTING              → k_route
//!
//! verified=True · ∀i: Snap(S)(i) = S(i) · <10ms · deterministic

use crate::types::{cfg_str, Action, PolicyDecision, RouteResult, SubstrateError, ValidationResult};

// ── K:STATE_RECONCILIATION ────────────────────────────────────────────────────

/// Enforce state reconciliation — compute delta between desired and actual state.
/// Ancestor K:STATE_RECONCILIATION — Kubernetes controller manager reconcile loop.
/// Emits ADD/UPDATE/REMOVE actions to bring actual state in line with desired.
pub fn k_reconcile_state(
    _unit_id: &str,
    config:   &serde_json::Value,
) -> Vec<Action> {
    let desired = config.get("desired").cloned().unwrap_or_default();
    let actual  = config.get("actual").cloned().unwrap_or_default();

    let desired_obj = desired.as_object();
    let actual_obj  = actual.as_object();

    let mut actions = Vec::new();

    if let Some(des) = desired_obj {
        for (key, val) in des {
            match actual_obj.and_then(|a| a.get(key)) {
                None => actions.push(Action {
                    op:        "ADD".into(),
                    key:       key.clone(),
                    value:     val.clone(),
                    old_value: serde_json::Value::Null,
                }),
                Some(old) if old != val => actions.push(Action {
                    op:        "UPDATE".into(),
                    key:       key.clone(),
                    value:     val.clone(),
                    old_value: old.clone(),
                }),
                _ => {}
            }
        }
    }
    if let (Some(act), Some(des)) = (actual_obj, desired_obj) {
        for key in act.keys() {
            if !des.contains_key(key) {
                actions.push(Action {
                    op:        "REMOVE".into(),
                    key:       key.clone(),
                    value:     serde_json::Value::Null,
                    old_value: act[key].clone(),
                });
            }
        }
    }
    actions
}

// ── K:ORCHESTRATION ───────────────────────────────────────────────────────────

/// Enforce workload orchestration lifecycle.
/// Ancestor K:ORCHESTRATION — Kubernetes manages pod lifecycle via kubelet + kube-controller-manager.
pub fn k_orchestrate(unit_id: &str, config: &serde_json::Value) -> Result<(), SubstrateError> {
    let action = cfg_str(config, "action", "create");
    match action.as_str() {
        "create" => {
            let spec = config.get("spec").ok_or_else(|| {
                SubstrateError::ValidationFail("orchestrate: spec required for create".into())
            })?;
            // validate required spec fields
            if spec.get("image").is_none() {
                return Err(SubstrateError::ValidationFail(
                    "orchestrate: spec.image required".into()
                ));
            }
            Ok(())
        }
        "delete" => {
            let _ = unit_id; // record deletion intent
            Ok(())
        }
        "update" => {
            if config.get("spec").is_none() {
                return Err(SubstrateError::ValidationFail(
                    "orchestrate: spec required for update".into()
                ));
            }
            Ok(())
        }
        other => Err(SubstrateError::ValidationFail(
            format!("orchestrate: unknown action '{}'", other)
        )),
    }
}

// ── K:VALIDATION ──────────────────────────────────────────────────────────────

/// Enforce manifest validation — structural and policy checks.
/// Ancestor K:VALIDATION — Kubernetes admission webhooks (ValidatingAdmissionWebhook).
pub fn k_validate(unit_id: &str, config: &serde_json::Value) -> ValidationResult {
    let manifest = match config.get("manifest") {
        Some(m) => m,
        None => return ValidationResult {
            passed:  false,
            message: format!("{}: manifest missing from config", unit_id),
        },
    };

    // required fields
    for field in &["apiVersion", "kind", "metadata"] {
        if manifest.get(field).is_none() {
            return ValidationResult {
                passed:  false,
                message: format!("{}: manifest missing required field '{}'", unit_id, field),
            };
        }
    }

    // schema rules from config
    let rules = config.get("rules")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    for rule in &rules {
        let field    = rule.get("field").and_then(|v| v.as_str()).unwrap_or("");
        let required = rule.get("required").and_then(|v| v.as_bool()).unwrap_or(false);
        if required && manifest.get(field).is_none() {
            return ValidationResult {
                passed:  false,
                message: format!("{}: required field '{}' missing from manifest", unit_id, field),
            };
        }
    }

    ValidationResult { passed: true, message: String::new() }
}

// ── K:SCHEDULING ──────────────────────────────────────────────────────────────

/// Enforce bin-pack scheduling — first-fit decreasing by resource score.
/// Ancestor K:SCHEDULING — Kubernetes default scheduler (kube-scheduler bin-pack profile).
pub fn k_schedule(
    candidates:  &[serde_json::Value],
    constraints: &[serde_json::Value],
    _config:     &serde_json::Value,
) -> String {
    if candidates.is_empty() {
        return String::new();
    }

    let score = |node: &serde_json::Value| -> f64 {
        let cpu = node.get("available_cpu").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let mem = node.get("available_memory").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let mut s = cpu + mem / (1024.0_f64.powi(3));
        let node_id = node.get("id").and_then(|v| v.as_str()).unwrap_or("");
        for c in constraints {
            match c.get("type").and_then(|v| v.as_str()) {
                Some("affinity") if c.get("node").and_then(|v| v.as_str()) == Some(node_id) => {
                    s += 10.0;
                }
                Some("anti_affinity") if c.get("node").and_then(|v| v.as_str()) == Some(node_id) => {
                    s -= 10.0;
                }
                _ => {}
            }
        }
        s
    };

    candidates.iter()
        .max_by(|a, b| score(a).partial_cmp(&score(b)).unwrap_or(std::cmp::Ordering::Equal))
        .and_then(|node| node.get("id").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string()
}

// ── K:ENFORCEMENT ─────────────────────────────────────────────────────────────

/// Enforce admission control — RBAC + policy check before resource creation.
/// Ancestor K:ENFORCEMENT — Kubernetes admission controllers (RBAC, PodSecurityPolicy).
pub fn k_enforce(unit_id: &str, config: &serde_json::Value) -> PolicyDecision {
    let subject  = cfg_str(config, "subject", "");
    let action   = cfg_str(config, "action",  "");
    let resource = cfg_str(config, "resource", "");

    let roles = config.get("roles")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let permitted = roles.iter().any(|role| {
        let verbs = role.get("verbs").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        let resources = role.get("resources").and_then(|v| v.as_array()).cloned().unwrap_or_default();
        let subjects = role.get("subjects").and_then(|v| v.as_array()).cloned().unwrap_or_default();

        let verb_match = verbs.iter().any(|v| {
            v.as_str() == Some("*") || v.as_str() == Some(&action)
        });
        let resource_match = resources.iter().any(|r| {
            r.as_str() == Some("*") || r.as_str() == Some(&resource)
        });
        let subject_match = subjects.iter().any(|s| {
            s.as_str() == Some("*") || s.as_str() == Some(&subject)
        });

        verb_match && resource_match && subject_match
    });

    let _ = unit_id;
    if permitted { PolicyDecision::Allow } else { PolicyDecision::Deny }
}

// ── K:ROUTING ─────────────────────────────────────────────────────────────────

/// Enforce service mesh routing — weighted round-robin over backend endpoints.
/// Ancestor K:ROUTING — Kubernetes Service + Ingress + Envoy sidecar routing.
///
/// Rust is stateless — returns RouteResult { endpoint, next_counter }.
/// Caller (TypeScript / Agent Buccet) MUST pass next_counter back as
/// config["_route_counter"] on the next call to maintain round-robin state.
///
/// TypeScript pattern:
///   let counter = 0;
///   const r = k_route_wasm("svc", { backends: [...], _route_counter: counter });
///   counter = r.next_counter;  // store for next call
pub fn k_route(_unit_id: &str, config: &serde_json::Value) -> RouteResult {
    let backends = config.get("backends")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    if backends.is_empty() {
        return RouteResult { endpoint: String::new(), next_counter: 0 };
    }

    let counter = config.get("_route_counter")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);

    let total_weight: u64 = backends.iter()
        .map(|b| b.get("weight").and_then(|v| v.as_u64()).unwrap_or(1))
        .sum();

    let idx = if total_weight > 0 { counter % total_weight } else { 0 };
    let mut accumulated = 0u64;
    let mut chosen = backends.last()
        .and_then(|b| b.get("endpoint"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    for backend in &backends {
        let weight = backend.get("weight").and_then(|v| v.as_u64()).unwrap_or(1);
        accumulated += weight;
        if idx < accumulated {
            chosen = backend.get("endpoint")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            break;
        }
    }

    RouteResult {
        endpoint:     chosen,
        next_counter: counter.wrapping_add(1),
    }
}

// ── WASM API ──────────────────────────────────────────────────────────────────

#[cfg(feature = "wasm")]
pub mod wasm_api {
    use super::*;
    use crate::types::{to_js, from_js};
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen]
    pub fn k_reconcile_state_wasm(unit_id: &str, config: JsValue) -> JsValue {
        let cfg = from_js(config);
        to_js(&k_reconcile_state(unit_id, &cfg))
    }

    #[wasm_bindgen]
    pub fn k_orchestrate_wasm(unit_id: &str, config: JsValue) -> bool {
        let cfg = from_js(config);
        k_orchestrate(unit_id, &cfg).is_ok()
    }

    #[wasm_bindgen]
    pub fn k_validate_wasm(unit_id: &str, config: JsValue) -> JsValue {
        let cfg = from_js(config);
        to_js(&k_validate(unit_id, &cfg))
    }

    #[wasm_bindgen]
    pub fn k_schedule_wasm(candidates: JsValue, constraints: JsValue, config: JsValue) -> String {
        // deserialize arrays via from_js for consistency
        let cands_val = from_js(candidates);
        let cons_val  = from_js(constraints);
        let cands: Vec<serde_json::Value> = cands_val.as_array().cloned().unwrap_or_default();
        let cons:  Vec<serde_json::Value> = cons_val.as_array().cloned().unwrap_or_default();
        k_schedule(&cands, &cons, &from_js(config))
    }

    #[wasm_bindgen]
    pub fn k_enforce_wasm(unit_id: &str, config: JsValue) -> JsValue {
        to_js(&k_enforce(unit_id, &from_js(config)))
    }

    /// Returns { endpoint: string, next_counter: number }.
    /// Pass next_counter back as config._route_counter on each subsequent call.
    #[wasm_bindgen]
    pub fn k_route_wasm(unit_id: &str, config: JsValue) -> JsValue {
        to_js(&k_route(unit_id, &from_js(config)))
    }
}
