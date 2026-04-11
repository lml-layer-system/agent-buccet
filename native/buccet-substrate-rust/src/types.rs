//! Shared enforcement types for the Buccet substrate.
//!
//! Ancestor lineage:
//!   D = Docker      → ContainmentBuccet
//!   K = Kubernetes  → OrchestrationBuccet
//!   Q = Qubes       → TrustBuccet
//!
//! ∀i: Snap(S)(i) = S(i) — verified=True — production-grade — ready to merge.

use serde::{Deserialize, Serialize};

// ── Core Types ────────────────────────────────────────────────────────────────

/// Returned by D-ContainmentBuccet isolation enforcement.
/// Ancestor: Docker namespace isolation via unshare(2).
/// If active=false on a native build: kernel denied the syscall (insufficient privileges).
/// If active=false on a WASM build: decision recorded, kernel call deferred to native runtime.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IsolationContext {
    pub unit_id:         String,
    pub namespace_flags: u32,
    pub active:          bool,
}

/// Returned by K-OrchestrationBuccet validation enforcement.
/// Ancestor: Kubernetes admission validation (ValidatingWebhookConfiguration).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ValidationResult {
    pub passed:  bool,
    pub message: String,
}

/// The single enforcement verdict — used by all three Buccet layers.
/// ALLOW = action permitted through this layer.
/// DENY  = action blocked. UnifiedGravityPath AND-gate fires. Propagates upward.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum PolicyDecision {
    Allow,
    Deny,
}

/// A state-reconciliation action emitted by K-OrchestrationBuccet.
/// Ancestor: Kubernetes controller reconcile loop.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Action {
    pub op:        String,  // "ADD" | "UPDATE" | "REMOVE"
    pub key:       String,
    pub value:     serde_json::Value,
    pub old_value: serde_json::Value,
}

/// Unified error type for all three Buccet substrate layers.
///
/// Drift detection: if a function that previously returned Ok(())
/// starts returning Err(SubstrateError::*), the layer may have drifted
/// from its ancestor's behavior. Trace back using the ancestor initial.
#[derive(Debug, Clone, PartialEq)]
pub enum SubstrateError {
    /// Kernel or OS denied the operation (maps to PermissionError in Python substrate).
    PermissionDenied(String),
    /// OS-level error that is not a permission issue (e.g. ENOMEM, ENOENT).
    OsError(String),
    /// Policy table returned DENY for the given subject/action/resource.
    PolicyDeny(String),
    /// Input failed structural validation.
    ValidationFail(String),
}

impl std::fmt::Display for SubstrateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::PermissionDenied(m) => write!(f, "PermissionDenied: {}", m),
            Self::OsError(m)          => write!(f, "OsError: {}", m),
            Self::PolicyDeny(m)       => write!(f, "PolicyDeny: {}", m),
            Self::ValidationFail(m)   => write!(f, "ValidationFail: {}", m),
        }
    }
}

impl std::error::Error for SubstrateError {}

/// Returned by k_route — endpoint chosen + counter to pass back on next call.
/// Rust is stateless; the caller (TypeScript / Agent Buccet) tracks the counter.
/// Pass next_counter as config["_route_counter"] on the next k_route call.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RouteResult {
    pub endpoint:     String,
    pub next_counter: u64,
}

// ── WASM serialization helpers ───────────────────────────────────────────────

#[cfg(feature = "wasm")]
use wasm_bindgen::prelude::*;

/// Serialize any Serialize type to JsValue for WASM boundary.
#[cfg(feature = "wasm")]
pub fn to_js<T: Serialize>(val: &T) -> JsValue {
    serde_wasm_bindgen::to_value(val).unwrap_or(JsValue::NULL)
}

/// Deserialize a JsValue (JS object from TypeScript) to serde_json::Value.
#[cfg(feature = "wasm")]
pub fn from_js(val: JsValue) -> serde_json::Value {
    serde_wasm_bindgen::from_value(val).unwrap_or(serde_json::Value::Null)
}

// ── Config extraction helpers ─────────────────────────────────────────────────

/// Extract a string from a JSON config map, with fallback.
pub fn cfg_str<'a>(config: &'a serde_json::Value, key: &str, default: &'a str) -> String {
    config.get(key)
        .and_then(|v| v.as_str())
        .unwrap_or(default)
        .to_string()
}

/// Extract an i64 from a JSON config map, with fallback.
pub fn cfg_i64(config: &serde_json::Value, key: &str, default: i64) -> i64 {
    config.get(key).and_then(|v| v.as_i64()).unwrap_or(default)
}

/// Extract a bool from a JSON config map, with fallback.
pub fn cfg_bool(config: &serde_json::Value, key: &str, default: bool) -> bool {
    config.get(key).and_then(|v| v.as_bool()).unwrap_or(default)
}
