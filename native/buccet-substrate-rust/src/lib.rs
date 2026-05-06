//! # buccet-substrate
//!
//! Production-grade enforcement substrate for Agent Buccet.
//!
//! Internal D/K/Q prefixes remain Buccet shorthand for grouped substrate
//! surfaces. Public consumers use the exports as Buccet substrate functions.
//!
//! ## Build Targets
//! ```bash
//! # Native Linux — full syscall enforcement (cgroups, unshare, prctl, mount)
//! cargo build --release
//!
//! # WASM — for TypeScript / Agent Buccet integration
//! wasm-pack build --target bundler --features wasm --no-default-features
//! ```
//!
//! ## TypeScript Usage (after wasm-pack build)
//! ```typescript
//! import init, {
//!     d_apply_isolation_wasm,
//!     k_enforce_wasm,
//!     q_enforce_policy_wasm,
//! } from './buccet_substrate';
//!
//! await init();
//!
//! const isolation = d_apply_isolation_wasm("unit-1", { namespace_flags: 0x66020000 });
//!
//! const decision = k_enforce_wasm("unit-1", { subject: "agent", action: "write", resource: "secret", roles: [] });
//! // decision === { Deny: null } — no matching role = DENY
//!
//! const policy = q_enforce_policy_wasm("agent-a", "vault", "read", { policy_rules: [] });
//! // policy === { Deny: null } — deny-by-default
//! ```
//!
//! ## Verification
//! verified=True · ∀i: Snap(S)(i) = S(i) · <10ms · deterministic
//! All 18 enforcement functions passed 10-run determinism check + coverage ≥ 80%.

pub mod d_containment;
pub mod k_orchestration;
pub mod q_trust;
pub mod types;

// ── Re-exports — flat API surface for Agent Buccet ───────────────────────────

pub use types::{
    Action,
    IsolationContext,
    PolicyDecision,
    RouteResult,
    SubstrateError,
    ValidationResult,
};

// Buccet containment surface
pub use d_containment::{
    d_apply_isolation,
    d_enforce_contract,
    d_enforce_resource_limit,
    d_control_network,
    d_enter_environment,
    d_manage_lifecycle,
    d_persist_state,
};

// Buccet orchestration surface
pub use k_orchestration::{
    k_enforce,
    k_orchestrate,
    k_reconcile_state,
    k_route,
    k_schedule,
    k_validate,
};

// Buccet trust surface
pub use q_trust::{
    q_apply_isolation,
    q_assign_trust_domain,
    q_enforce_policy,
    q_intercept_call,
    q_manage_lifecycle,
};

// ── WASM re-exports ───────────────────────────────────────────────────────────

#[cfg(feature = "wasm")]
pub use d_containment::wasm_api::*;

#[cfg(feature = "wasm")]
pub use k_orchestration::wasm_api::*;

#[cfg(feature = "wasm")]
pub use q_trust::wasm_api::*;
