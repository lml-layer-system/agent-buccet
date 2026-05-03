import { loadUserPathLedger, writeCompiledUserPathLaws } from "./../proof/user-path-ledger.ts";
import type {
  BoundaryApprovalDecision,
  BoundaryLedgerRecord,
  BoundaryPolicySourceKind,
  BoundaryRuntimeConfig,
  BoundarySession,
  BoundaryUplRequestBasis,
  BoundaryUplScope,
  BoundaryUplTrackConstraint,
  BoundaryUserPathLedger,
  CompiledDocumentLaw,
} from "./../runtime/types.ts";

export type BoundaryPolicyBinding = {
  sourceKind: BoundaryPolicySourceKind;
  type: "APPROVED" | "DENIED";
  requestBasis: BoundaryUplRequestBasis;
  trackConstraint?: BoundaryUplTrackConstraint;
  scope?: BoundaryUplScope;
  notes?: string;
};

function describePolicySource(sourceKind: BoundaryPolicySourceKind): string {
  switch (sourceKind) {
    case "rlhf":
      return "RLHF";
    case "constitutional":
      return "constitutional policy";
    case "guardrail":
      return "external guardrail";
    case "domain_specific":
      return "domain-specific policy";
    case "regulator_business":
      return "regulator/business policy";
  }
}

export function compilePolicyBindingToLaw(binding: BoundaryPolicyBinding): CompiledDocumentLaw {
  return {
    type: binding.type,
    scope: binding.scope ?? "GLOBAL",
    notes: binding.notes ?? `${describePolicySource(binding.sourceKind)} binding`,
    requestBasis: {
      ...binding.requestBasis,
      provenance: binding.requestBasis.provenance ?? "trusted_system",
    },
    ...(binding.trackConstraint ? { trackConstraint: binding.trackConstraint } : {}),
  };
}

export async function writePolicyBindings(args: {
  ledger?: BoundaryUserPathLedger;
  bindings: BoundaryPolicyBinding[];
  witness: BoundaryLedgerRecord;
  session: BoundarySession;
}): Promise<BoundaryUserPathLedger> {
  const ledger = args.ledger ?? (await loadUserPathLedger());
  return writeCompiledUserPathLaws({
    ledger,
    compiledLaws: args.bindings.map((binding) => ({
      compiledLaw: compilePolicyBindingToLaw(binding),
      witness: args.witness,
    })),
    session: args.session,
    authority: {
      authorityKind: "trusted_system_sync",
      actorKind: "system",
      actorId: `system:policy-binding:${args.witness.META.id}`,
      reason: "trusted policy binding sync into live UPL",
    },
  });
}

export async function bindPolicySourcesIntoConfig(args: {
  config: BoundaryRuntimeConfig;
  bindings: BoundaryPolicyBinding[];
  witness: BoundaryLedgerRecord;
  decision?: Pick<BoundaryApprovalDecision, "scope" | "notes">;
}): Promise<BoundaryRuntimeConfig> {
  const bindings: BoundaryPolicyBinding[] = args.bindings.map((binding) => ({
    ...binding,
    scope: binding.scope ?? args.decision?.scope ?? "GLOBAL",
    ...(binding.notes !== undefined
      ? { notes: binding.notes }
      : args.decision?.notes !== undefined
        ? { notes: args.decision.notes ?? undefined }
        : {}),
  }));
  const upl = await writePolicyBindings({
    ledger: args.config.upl,
    bindings,
    witness: args.witness,
    session: args.config.session,
  });
  return {
    ...args.config,
    upl,
    userLawIds: [
      ...new Set([
        ...(args.config.userLawIds ?? []),
        ...upl.userApprovedLawPaths
          .filter((entry) => entry.status === "ACTIVE")
          .map((entry) => entry.id),
        ...upl.userDeniedLawPaths
          .filter((entry) => entry.status === "ACTIVE")
          .map((entry) => entry.id),
      ]),
    ],
  };
}
