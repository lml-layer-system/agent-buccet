import { promises as fs } from "node:fs";

export const PolicyDecision = {
  Allow: "Allow",
  Deny: "Deny",
} as const;

export type PolicyDecision = (typeof PolicyDecision)[keyof typeof PolicyDecision];

export type IsolationContext = {
  unit_id: string;
  namespace_flags: number;
  active: boolean;
};

export type ValidationResult = {
  passed: boolean;
  message: string;
};

export type BuccetAction = {
  op: string;
  key: string;
  value: unknown;
  old_value: unknown;
};

export type RouteResult = {
  endpoint: string;
  next_counter: number;
};

type RawBuccetSubstrateModule = {
  d_apply_isolation_wasm(unit_id: string, config: unknown): IsolationContext;
  d_control_network_wasm(unit_id: string, config: unknown): boolean;
  d_enforce_contract_wasm(unit_id: string, config: unknown): boolean;
  d_enforce_resource_limit_wasm(unit_id: string, config: unknown, limits: unknown): boolean;
  d_manage_lifecycle_wasm(unit_id: string, config: unknown): number | null;
  d_persist_state_wasm(unit_id: string, config: unknown): boolean;
  k_enforce_wasm(unit_id: string, config: unknown): PolicyDecision | keyof typeof PolicyDecision | string;
  k_orchestrate_wasm(unit_id: string, config: unknown): boolean;
  k_reconcile_state_wasm(unit_id: string, config: unknown): BuccetAction[];
  k_route_wasm(unit_id: string, config: unknown): RouteResult;
  k_schedule_wasm(candidates: unknown, constraints: unknown, config: unknown): string;
  k_validate_wasm(unit_id: string, config: unknown): ValidationResult;
  q_apply_isolation_wasm(unit_id: string, config: unknown): IsolationContext;
  q_assign_trust_domain_wasm(unit_id: string, config: unknown): string;
  q_enforce_policy_wasm(subject: string, resource: string, action: string, config: unknown): PolicyDecision | keyof typeof PolicyDecision | string;
  q_intercept_call_wasm(unit_id: string, config: unknown): PolicyDecision | keyof typeof PolicyDecision | string;
  q_manage_lifecycle_wasm(unit_id: string, config: unknown): boolean;
};

async function pathExists(target: URL): Promise<boolean> {
  return await fs.access(target).then(() => true).catch(() => false);
}

type RawBuccetSubstrateBootstrapModule = RawBuccetSubstrateModule & {
  __wbg_set_wasm(exports: WebAssembly.Exports): void;
};

async function resolveSubstrateAssetUrls(): Promise<{ bgModuleUrl: URL; wasmUrl: URL }> {
  const candidates = [
    {
      bgModuleUrl: new URL("../../native/buccet-substrate-rust/pkg/buccet_substrate_bg.js", import.meta.url),
      wasmUrl: new URL("../../native/buccet-substrate-rust/pkg/buccet_substrate_bg.wasm", import.meta.url),
    },
    {
      bgModuleUrl: new URL("../native/buccet-substrate-rust/pkg/buccet_substrate_bg.js", import.meta.url),
      wasmUrl: new URL("../native/buccet-substrate-rust/pkg/buccet_substrate_bg.wasm", import.meta.url),
    },
  ];

  for (const candidate of candidates) {
    if (await pathExists(candidate.bgModuleUrl) && await pathExists(candidate.wasmUrl)) {
      return candidate;
    }
  }

  throw new Error("unable to locate vendored Buccet Rust substrate package");
}

function normalizePolicyDecision(raw: PolicyDecision | keyof typeof PolicyDecision | string): PolicyDecision {
  if (raw === PolicyDecision.Allow || raw === "Allow") {
    return PolicyDecision.Allow;
  }
  return PolicyDecision.Deny;
}

export class BuccetSubstrate {
  private runtime: RawBuccetSubstrateModule | null = null;

  get ready(): boolean {
    return this.runtime !== null;
  }

  async init(): Promise<this> {
    if (this.runtime) {
      return this;
    }

    const { bgModuleUrl, wasmUrl } = await resolveSubstrateAssetUrls();
    const bootstrap = await import(bgModuleUrl.href) as RawBuccetSubstrateBootstrapModule;
    const wasmBytes = await fs.readFile(wasmUrl);
    const compiled = await WebAssembly.compile(wasmBytes);
    const instance = await WebAssembly.instantiate(compiled, {
      "./buccet_substrate_bg.js": bootstrap as unknown as WebAssembly.ModuleImports,
    });
    bootstrap.__wbg_set_wasm(instance.exports);
    const start = instance.exports.__wbindgen_start;
    if (typeof start === "function") {
      start();
    }
    this.runtime = bootstrap;
    return this;
  }

  private requireRuntime(): RawBuccetSubstrateModule {
    if (!this.runtime) {
      throw new Error("Buccet Rust substrate not initialized. Call await substrate.init() first.");
    }
    return this.runtime;
  }

  dApplyIsolation(unitId: string, config: Record<string, unknown>): IsolationContext {
    return this.requireRuntime().d_apply_isolation_wasm(unitId, config);
  }

  dControlNetwork(unitId: string, config: Record<string, unknown>): boolean {
    return this.requireRuntime().d_control_network_wasm(unitId, config);
  }

  dEnforceContract(unitId: string, config: Record<string, unknown>): boolean {
    return this.requireRuntime().d_enforce_contract_wasm(unitId, config);
  }

  dEnforceResourceLimit(unitId: string, config: Record<string, unknown>, limits: Record<string, unknown>): boolean {
    return this.requireRuntime().d_enforce_resource_limit_wasm(unitId, config, limits);
  }

  dManageLifecycle(unitId: string, config: Record<string, unknown>): number | null {
    return this.requireRuntime().d_manage_lifecycle_wasm(unitId, config);
  }

  dPersistState(unitId: string, config: Record<string, unknown>): boolean {
    return this.requireRuntime().d_persist_state_wasm(unitId, config);
  }

  kEnforce(unitId: string, config: Record<string, unknown>): PolicyDecision {
    return normalizePolicyDecision(this.requireRuntime().k_enforce_wasm(unitId, config));
  }

  enforce(unitId: string, config: Record<string, unknown>): PolicyDecision {
    return this.kEnforce(unitId, config);
  }

  kOrchestrate(unitId: string, config: Record<string, unknown>): boolean {
    return this.requireRuntime().k_orchestrate_wasm(unitId, config);
  }

  kReconcileState(unitId: string, config: Record<string, unknown>): BuccetAction[] {
    return this.requireRuntime().k_reconcile_state_wasm(unitId, config);
  }

  kRoute(unitId: string, config: Record<string, unknown>): RouteResult {
    return this.requireRuntime().k_route_wasm(unitId, config);
  }

  kSchedule(candidates: unknown[], constraints: unknown[], config: Record<string, unknown>): string {
    return this.requireRuntime().k_schedule_wasm(candidates, constraints, config);
  }

  kValidate(unitId: string, config: Record<string, unknown>): ValidationResult {
    return this.requireRuntime().k_validate_wasm(unitId, config);
  }

  qApplyIsolation(unitId: string, config: Record<string, unknown>): IsolationContext {
    return this.requireRuntime().q_apply_isolation_wasm(unitId, config);
  }

  qAssignTrustDomain(unitId: string, config: Record<string, unknown>): string {
    return this.requireRuntime().q_assign_trust_domain_wasm(unitId, config);
  }

  qEnforcePolicy(subject: string, resource: string, action: string, config: Record<string, unknown>): PolicyDecision {
    return normalizePolicyDecision(this.requireRuntime().q_enforce_policy_wasm(subject, resource, action, config));
  }

  qInterceptCall(unitId: string, config: Record<string, unknown>): PolicyDecision {
    return normalizePolicyDecision(this.requireRuntime().q_intercept_call_wasm(unitId, config));
  }

  qManageLifecycle(unitId: string, config: Record<string, unknown>): boolean {
    return this.requireRuntime().q_manage_lifecycle_wasm(unitId, config);
  }
}

export const substrate = new BuccetSubstrate();
