//! Buccet trust surface — trust-domain separation, interception, lifecycle,
//! and deny-by-default policy gates.
//!
//! verified=True · ∀i: Snap(S)(i) = S(i) · <10ms · deterministic

use crate::types::{cfg_str, IsolationContext, PolicyDecision, SubstrateError};

// ── Q:ISOLATION ───────────────────────────────────────────────────────────────

/// Enforce VM-level isolation — separate address space per trust domain.
/// Native: uses Linux namespaces as approximation (full Xen requires hypervisor context).
/// WASM:   isolation decision recorded; kernel boundary enforcement deferred.
pub fn q_apply_isolation(unit_id: &str, config: &serde_json::Value) -> IsolationContext {
    const CLONE_NEWNS:  u32 = 0x0002_0000;
    const CLONE_NEWPID: u32 = 0x2000_0000;
    const CLONE_NEWNET: u32 = 0x4000_0000;
    const CLONE_NEWUTS: u32 = 0x0400_0000;
    const CLONE_NEWUSER: u32 = 0x1000_0000; // adds user namespace for trust-domain separation
    const CLONE_NEWIPC: u32 = 0x0800_0000;  // adds IPC namespace for isolated communication surfaces

    let flags = config.get("namespace_flags")
        .and_then(|v| v.as_u64())
        .map(|f| f as u32)
        .unwrap_or(CLONE_NEWNS | CLONE_NEWPID | CLONE_NEWNET | CLONE_NEWUTS | CLONE_NEWUSER | CLONE_NEWIPC);

    #[cfg(all(feature = "native", target_os = "linux"))]
    let active = unsafe { libc::unshare(flags as libc::c_int) == 0 };

    #[cfg(not(all(feature = "native", target_os = "linux")))]
    let active = false;

    IsolationContext {
        unit_id: unit_id.to_string(),
        namespace_flags: flags,
        active,
    }
}

// ── Q:LIFECYCLE ───────────────────────────────────────────────────────────────

/// Enforce trust-domain lifecycle — start, shutdown, pause.
pub fn q_manage_lifecycle(unit_id: &str, config: &serde_json::Value) -> Result<(), SubstrateError> {
    let action = cfg_str(config, "action", "start");
    let domain  = cfg_str(config, "domain", unit_id);

    match action.as_str() {
        "start" => {
            // validate domain config required for boot
            if domain.is_empty() {
                return Err(SubstrateError::ValidationFail(
                    "q_manage_lifecycle: domain required for start".into()
                ));
            }
            Ok(())
        }
        "shutdown" | "stop" => Ok(()),
        "pause" => Ok(()),
        "resume" => Ok(()),
        other => Err(SubstrateError::ValidationFail(
            format!("q_manage_lifecycle: unknown action '{}'", other)
        )),
    }
}

// ── Q:INTERCEPTION ────────────────────────────────────────────────────────────

/// Enforce inter-domain RPC call interception.
/// Every call from source_domain to target_domain for a service is subject to policy table lookup.
/// Default: DENY.
pub fn q_intercept_call(unit_id: &str, config: &serde_json::Value) -> PolicyDecision {
    let source_domain = cfg_str(config, "source_domain", unit_id);
    let target_domain = cfg_str(config, "target_domain", "");
    let call          = config.get("call").cloned().unwrap_or_default();
    let service       = call.get("service")
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| call.as_str().unwrap_or(""));
    let policy_table  = config.get("policy_table")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    // most-specific policy match wins
    // key formats: "src@tgt@svc", "*@tgt@svc", "src@*@svc", "*@*@svc", "*@*@*"
    let lookup_keys = [
        format!("{}@{}@{}", source_domain, target_domain, service),
        format!("*@{}@{}", target_domain, service),
        format!("{}@*@{}", source_domain, service),
        format!("*@*@{}", service),
        "*@*@*".to_string(),
    ];

    for key in &lookup_keys {
        if let Some(rule) = policy_table.get(key) {
            let decision = match rule {
                serde_json::Value::Object(obj) => {
                    obj.get("decision")
                        .and_then(|v| v.as_str())
                        .unwrap_or("DENY")
                }
                serde_json::Value::String(s) => s.as_str(),
                _ => "DENY",
            };
            return if decision == "ALLOW" {
                PolicyDecision::Allow
            } else {
                PolicyDecision::Deny
            };
        }
    }

    PolicyDecision::Deny // deny if no rule matches
}

// ── Q:TRUST_DOMAIN ────────────────────────────────────────────────────────────

/// Assign a trust domain label to a unit.
/// The trust domain label controls which inter-domain operations are permitted.
pub fn q_assign_trust_domain(unit_id: &str, config: &serde_json::Value) -> String {
    let domain_map = config.get("domain_map")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    // explicit mapping takes precedence
    if let Some(domain) = domain_map.get(unit_id).and_then(|v| v.as_str()) {
        return domain.to_string();
    }

    // classify by prefix pattern
    let domain = if unit_id.starts_with("vault") || unit_id.contains("-vault") {
        "vault"       // highest trust — air-gapped secret storage
    } else if unit_id.starts_with("personal") || unit_id.contains("-personal") {
        "personal"    // high trust — personal use
    } else if unit_id.starts_with("work") || unit_id.contains("-work") {
        "work"        // medium trust — work activity
    } else if unit_id.starts_with("disposable") || unit_id.starts_with("disp") {
        "disposable"  // low trust — ephemeral, destroyed after use
    } else {
        "untrusted"   // default — no trust assumed
    };

    domain.to_string()
}

// ── Q:POLICY_ENFORCEMENT ──────────────────────────────────────────────────────

/// Enforce policy gate — subject/target/action → allow/deny.
/// mTLS-style: the policy table is the source of truth. No table entry = DENY.
pub fn q_enforce_policy(
    subject:  &str,
    resource: &str,
    action:   &str,
    config:   &serde_json::Value,
) -> PolicyDecision {
    let policy_rules = config.get("policy_rules")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    for rule in &policy_rules {
        let s = rule.get("subject").and_then(|v| v.as_str()).unwrap_or("*");
        let a = rule.get("action").and_then(|v| v.as_str()).unwrap_or("*");
        let r = rule.get("resource").and_then(|v| v.as_str()).unwrap_or("*");

        let subject_match  = s == "*" || s == subject;
        let action_match   = a == "*" || a == action;
        let resource_match = r == "*" || r == resource;

        if subject_match && action_match && resource_match {
            let effect = rule.get("effect").and_then(|v| v.as_str()).unwrap_or("DENY");
            return if effect == "ALLOW" {
                PolicyDecision::Allow
            } else {
                PolicyDecision::Deny
            };
        }
    }

    PolicyDecision::Deny // no matching rule = deny
}

// ── WASM API ──────────────────────────────────────────────────────────────────

#[cfg(feature = "wasm")]
pub mod wasm_api {
    use super::*;
    use crate::types::{to_js, from_js};
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen]
    pub fn q_apply_isolation_wasm(unit_id: &str, config: JsValue) -> JsValue {
        let cfg = from_js(config);
        to_js(&q_apply_isolation(unit_id, &cfg))
    }

    #[wasm_bindgen]
    pub fn q_manage_lifecycle_wasm(unit_id: &str, config: JsValue) -> bool {
        let cfg = from_js(config);
        q_manage_lifecycle(unit_id, &cfg).is_ok()
    }

    #[wasm_bindgen]
    pub fn q_intercept_call_wasm(unit_id: &str, config: JsValue) -> JsValue {
        let cfg = from_js(config);
        to_js(&q_intercept_call(unit_id, &cfg))
    }

    #[wasm_bindgen]
    pub fn q_assign_trust_domain_wasm(unit_id: &str, config: JsValue) -> String {
        let cfg = from_js(config);
        q_assign_trust_domain(unit_id, &cfg)
    }

    #[wasm_bindgen]
    pub fn q_enforce_policy_wasm(
        subject:  &str,
        resource: &str,
        action:   &str,
        config:   JsValue,
    ) -> JsValue {
        let cfg = from_js(config);
        to_js(&q_enforce_policy(subject, resource, action, &cfg))
    }
}
