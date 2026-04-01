import { createHash } from "node:crypto";
import path from "node:path";
import { appendBoundaryLedger } from "./ledger.ts";
import { getActiveUserLawIds, loadUserPathLedger, writeCompiledUserPathLaws } from "./user-path-ledger.ts";
import type {
  BoundaryActionKind,
  BoundaryRuntimeConfig,
  BoundaryUplScope,
  CompiledDocumentLaw,
} from "./types.ts";

export type BaseAcceptanceClass =
  | "workspace_read"
  | "workspace_mutation"
  | "local_organization"
  | "internal_artifacts";

type BaseAcceptanceSeed = {
  id: string;
  acceptanceClass: BaseAcceptanceClass;
  reason: string;
  actionKinds: BoundaryActionKind[];
  targetPattern?: string;
  targetPatterns?: string[];
  targetMatchMode?: "prefix" | "exact" | "regex";
  requestBasisTarget: string;
  requestBasisSummary: string;
};

const BASE_ACCEPTANCE_PROFILE_ID = "BUCCET.BASE.UPL.ACCEPTANCE.V1";
const SAFE_OUTPUT_DIR_NAMES = ["outputs", "reports", "artifacts"] as const;

function hashSeedWitnessId(rootPath: string, grantedActions: readonly BoundaryActionKind[]): string {
  return createHash("sha256")
    .update(`${rootPath}::${grantedActions.join(",")}`)
    .digest("hex")
    .slice(0, 12);
}

function buildNotes(seed: BaseAcceptanceSeed): string {
  return `[${seed.acceptanceClass}] Buccet base acceptance pack — ${seed.reason}`;
}

function resolveSafeOutputRoots(rootPath: string): string[] {
  return SAFE_OUTPUT_DIR_NAMES.map((name) => path.join(rootPath, name));
}

function buildBaseAcceptanceSeeds(args: {
  rootPath: string;
  grantedActions: readonly BoundaryActionKind[];
}): BaseAcceptanceSeed[] {
  const rootPath = path.resolve(args.rootPath);
  const seeds: BaseAcceptanceSeed[] = [];
  const granted = new Set(args.grantedActions);

  if (granted.has("fs.read")) {
    seeds.push({
      id: "ACCEPT.WORKSPACE.READ.001",
      acceptanceClass: "workspace_read",
      reason: "Read motion inside opened workspace is lawful.",
      actionKinds: ["fs.read"],
      targetPattern: rootPath,
      targetMatchMode: "prefix",
      requestBasisTarget: rootPath,
      requestBasisSummary: "base-acceptance:workspace-read",
    });
  }

  const workspaceMutationKinds = ["fs.write", "fs.append"].filter((kind) =>
    granted.has(kind as BoundaryActionKind)
  ) as BoundaryActionKind[];
  if (workspaceMutationKinds.length > 0) {
    seeds.push({
      id: "ACCEPT.WORKSPACE.MUTATION.002",
      acceptanceClass: "workspace_mutation",
      reason: "Scoped code and document mutation inside opened workspace is lawful.",
      actionKinds: workspaceMutationKinds,
      targetPattern: rootPath,
      targetMatchMode: "prefix",
      requestBasisTarget: rootPath,
      requestBasisSummary: "base-acceptance:workspace-mutation",
    });

    seeds.push({
      id: "ACCEPT.INTERNAL.ARTIFACTS.004",
      acceptanceClass: "internal_artifacts",
      reason: "Reports and artifact outputs inside standard workspace output roots are lawful.",
      actionKinds: workspaceMutationKinds,
      targetPatterns: resolveSafeOutputRoots(rootPath),
      targetMatchMode: "prefix",
      requestBasisTarget: path.join(rootPath, "outputs"),
      requestBasisSummary: "base-acceptance:internal-artifacts",
    });
  }

  const organizationKinds = ["fs.mkdir", "fs.move"].filter((kind) =>
    granted.has(kind as BoundaryActionKind)
  ) as BoundaryActionKind[];
  if (organizationKinds.length > 0) {
    seeds.push({
      id: "ACCEPT.LOCAL.ORGANIZATION.003",
      acceptanceClass: "local_organization",
      reason: "Non-destructive organization inside opened workspace is lawful.",
      actionKinds: organizationKinds,
      targetPattern: rootPath,
      targetMatchMode: "prefix",
      requestBasisTarget: rootPath,
      requestBasisSummary: "base-acceptance:local-organization",
    });
  }

  return seeds;
}

export function createBaseAcceptanceLaws(args: {
  rootPath: string;
  grantedActions: readonly BoundaryActionKind[];
  scope?: BoundaryUplScope;
}): CompiledDocumentLaw[] {
  const scope = args.scope ?? "SESSION";
  return buildBaseAcceptanceSeeds(args).map((seed) => ({
    type: "APPROVED",
    scope,
    notes: buildNotes(seed),
    requestBasis: {
      actionKind: seed.actionKinds[0] ?? "fs.read",
      target: seed.requestBasisTarget,
      payloadSummary: seed.requestBasisSummary,
      provenance: "trusted_system",
    },
    trackConstraint: {
      allowedActionKinds: [...seed.actionKinds],
      ...(seed.targetPattern ? { targetPattern: seed.targetPattern } : {}),
      ...(seed.targetPatterns ? { targetPatterns: [...seed.targetPatterns] } : {}),
      ...(seed.targetMatchMode ? { targetMatchMode: seed.targetMatchMode } : {}),
      description: `${seed.id} — ${seed.reason}`,
    },
  }));
}

function entryTrackMetadata(entryId: string, law: CompiledDocumentLaw) {
  return {
    upl_entry_id: entryId,
    upl_entry_type: law.type,
    track_description: law.trackConstraint?.description ?? "base acceptance corridor",
    track_allowed_kinds: law.trackConstraint?.allowedActionKinds.join(",") ?? "",
    ...(law.trackConstraint?.targetPattern
      ? { track_target_pattern: law.trackConstraint.targetPattern }
      : {}),
    ...(law.trackConstraint?.targetPatterns?.length
      ? { track_target_patterns: law.trackConstraint.targetPatterns.join(",") }
      : {}),
  };
}

export async function seedBaseAcceptanceIntoConfig(args: {
  config: BoundaryRuntimeConfig;
  rootPath: string;
  grantedActions: readonly BoundaryActionKind[];
  issuedBy: string;
  scope?: BoundaryUplScope;
}): Promise<BoundaryRuntimeConfig> {
  const compiledLaws = createBaseAcceptanceLaws({
    rootPath: args.rootPath,
    grantedActions: args.grantedActions,
    scope: args.scope ?? "SESSION",
  });
  if (compiledLaws.length === 0) {
    return args.config;
  }

  const ledger = args.config.upl ?? await loadUserPathLedger();
  const approvedCountBefore = ledger.userApprovedLawPaths.length;
  const witness = await appendBoundaryLedger("UPL_ALLOW_RECORDED", {
    sessionId: args.config.session.sessionId,
    actorId: args.issuedBy,
    requestId: `upl-base-acceptance-${hashSeedWitnessId(args.rootPath, args.grantedActions)}`,
    actionKind: compiledLaws[0].requestBasis.actionKind,
    target: path.resolve(args.rootPath),
    decision: "allow",
    reason: `Buccet base acceptance pack seeded for opened scope ${path.resolve(args.rootPath)}`,
    lawIds: [],
    metadata: {
      base_pack: "acceptance",
      root_path: path.resolve(args.rootPath),
      compiled_law_count: compiledLaws.length,
      granted_actions: args.grantedActions.join(","),
      upl_scope: args.scope ?? "SESSION",
    },
    createdAt: new Date().toISOString(),
  });

  const upl = await writeCompiledUserPathLaws({
    ledger,
    compiledLaws: compiledLaws.map((compiledLaw) => ({ compiledLaw, witness })),
    session: args.config.session,
  });

  const newEntries = upl.userApprovedLawPaths.slice(approvedCountBefore);
  await Promise.all(newEntries.map((entry, index) => {
    const law = compiledLaws[index];
    return appendBoundaryLedger("UPL_TRACK_ACTIVATED", {
      sessionId: args.config.session.sessionId,
      actorId: args.issuedBy,
      requestId: `upl-base-acceptance-track-${entry.id}`,
      actionKind: law?.requestBasis.actionKind ?? entry.requestBasis?.actionKind,
      target: law?.requestBasis.target ?? entry.requestBasis?.target ?? path.resolve(args.rootPath),
      decision: "allow",
      reason: `Buccet base acceptance corridor activated: ${law?.trackConstraint?.description ?? entry.trackConstraint?.description ?? entry.id}`,
      lawIds: [entry.id],
      metadata: entryTrackMetadata(entry.id, law ?? {
        type: "APPROVED",
        requestBasis: entry.requestBasis ?? {
          actionKind: "fs.read",
          target: path.resolve(args.rootPath),
        },
      }),
      createdAt: new Date().toISOString(),
    });
  }));

  return {
    ...args.config,
    upl,
    userLawIds: [
      ...new Set([
        ...(args.config.userLawIds ?? []),
        ...getActiveUserLawIds(upl, args.config.session),
      ]),
    ],
  };
}

export const BASE_UPL_ACCEPTANCE_PROFILE = {
  profileId: BASE_ACCEPTANCE_PROFILE_ID,
  profileName: "Buccet Base Acceptance Pack",
  mode: "runtime",
  description: "Built-in standing acceptance law seeded when the user opens lawful scope.",
  runtimeTruth: "authored approved and denied laws compile into one live UPL field at runtime",
  customizationSurface: "edit or import UPL law; runtime recomputes the live field from authored law",
} as const;
