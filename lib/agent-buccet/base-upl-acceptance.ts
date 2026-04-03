import { createHash } from "node:crypto";
import path from "node:path";
import { appendBoundaryLedger } from "./ledger.ts";
import { BASE_OPENCLAW_SKILL_ACCEPTANCE_LANES } from "./openclaw-skill-acceptance.ts";
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
  | "internal_artifacts"
  | "safe_local_exec"
  | "bounded_web_research"
  | "notes_and_tasks"
  | "openclaw_skill";

type BaseAcceptanceSeed = {
  id: string;
  acceptanceClass: BaseAcceptanceClass;
  reason: string;
  actionKinds: BoundaryActionKind[];
  targetPattern?: string;
  targetPatterns?: string[];
  targetMatchMode?: "prefix" | "exact" | "regex";
  requestTextPatterns?: string[];
  requestBasisTarget: string;
  requestBasisSummary: string;
};

const BASE_ACCEPTANCE_PROFILE_ID = "BUCCET.BASE.UPL.ACCEPTANCE.V1";
const SAFE_OUTPUT_DIR_NAMES = ["outputs", "reports", "artifacts"] as const;
const NOTES_AND_TASK_DIR_NAMES = [".buccet", "notes", "tasks", "memory"] as const;
const SAFE_LOCAL_EXEC_SEEDS = [
  {
    id: "ACCEPT.SAFE.LOCAL.EXEC.005A",
    targetPatterns: ["git", "rg"],
    requestTextPatterns: [
      "/\\b(?:git\\s+(?:status|diff|grep|log|show|rev-parse|branch|ls-files)|rg\\b)\\b/i",
    ],
    requestBasisTarget: "git",
    requestBasisSummary: "git status",
    reason: "Bounded local repository inspection commands are lawful.",
  },
  {
    id: "ACCEPT.SAFE.LOCAL.EXEC.005B",
    targetPatterns: ["npm", "pnpm", "yarn"],
    requestTextPatterns: [
      "/\\b(?:npm|pnpm|yarn)\\s+(?:test|lint|run\\s+(?:test|lint|typecheck|build)|typecheck|build)\\b/i",
    ],
    requestBasisTarget: "npm",
    requestBasisSummary: "npm test",
    reason: "Bounded package-runner quality commands are lawful.",
  },
  {
    id: "ACCEPT.SAFE.LOCAL.EXEC.005C",
    targetPatterns: ["pytest", "ruff", "mypy", "eslint", "prettier", "tsc"],
    requestTextPatterns: [
      "/\\b(?:pytest|mypy|eslint|prettier|tsc)\\b/i",
      "/\\bruff\\s+(?:check|format)\\b/i",
    ],
    requestBasisTarget: "pytest",
    requestBasisSummary: "pytest -q",
    reason: "Bounded test, lint, and typecheck tools are lawful.",
  },
  {
    id: "ACCEPT.SAFE.LOCAL.EXEC.005D",
    targetPatterns: ["cargo", "go", "make"],
    requestTextPatterns: [
      "/\\bcargo\\s+(?:test|check|fmt|clippy)\\b/i",
      "/\\bgo\\s+(?:test|fmt|vet)\\b/i",
      "/\\bmake\\s+(?:test|lint|build|check)\\b/i",
    ],
    requestBasisTarget: "cargo",
    requestBasisSummary: "cargo test",
    reason: "Bounded native-toolchain quality commands are lawful.",
  },
] as const;
const BOUNDED_WEB_RESEARCH_SEEDS = [
  {
    id: "ACCEPT.BOUNDED.WEB.RESEARCH.006A",
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?developer\\.mozilla\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?docs\\.python\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?docs\\.npmjs\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?nodejs\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?docs\\.rs(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?pkg\\.go\\.dev(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?www\\.typescriptlang\\.org(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?developer\\.apple\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: [
      "/\\b(?:fetch|read|browse|lookup|docs?|documentation|reference|manual|guide|api)\\b/i",
    ],
    requestBasisTarget: "developer.mozilla.org",
    requestBasisSummary: "fetch docs",
    reason: "Bounded documentation and reference retrieval is lawful.",
  },
  {
    id: "ACCEPT.BOUNDED.WEB.RESEARCH.006B",
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?github\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?api\\.github\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?raw\\.githubusercontent\\.com(?:\\/|$)/i",
    ],
    requestTextPatterns: [
      "/\\b(?:fetch|read|browse|lookup|docs?|documentation|reference|raw|source|repository|repo)\\b/i",
    ],
    requestBasisTarget: "github.com",
    requestBasisSummary: "fetch repository docs",
    reason: "Bounded source and repository retrieval is lawful.",
  },
  {
    id: "ACCEPT.BOUNDED.WEB.RESEARCH.006C",
    targetPatterns: [
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?duckduckgo\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?search\\.brave\\.com(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?exa\\.ai(?:\\/|$)/i",
      "/^(?:https?:\\/\\/)?(?:[^/]+\\.)?firecrawl\\.dev(?:\\/|$)/i",
    ],
    requestTextPatterns: [
      "/\\b(?:search|query|lookup|research|retrieve|crawl|browse)\\b/i",
    ],
    requestBasisTarget: "duckduckgo.com",
    requestBasisSummary: "search docs",
    reason: "Bounded search and retrieval provider use is lawful.",
  },
] as const;

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

function resolveNotesAndTaskRoots(rootPath: string): string[] {
  return NOTES_AND_TASK_DIR_NAMES.map((name) => path.join(rootPath, name));
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

  if (["fs.read", "fs.write", "fs.append", "fs.mkdir", "fs.move"].some((kind) => granted.has(kind as BoundaryActionKind))) {
    const notesAndTaskKinds = ["fs.read", "fs.write", "fs.append", "fs.mkdir", "fs.move"].filter((kind) =>
      granted.has(kind as BoundaryActionKind)
    ) as BoundaryActionKind[];
    if (notesAndTaskKinds.length > 0) {
      seeds.push({
        id: "ACCEPT.NOTES.TASKS.007",
        acceptanceClass: "notes_and_tasks",
        reason: "Local notes, tasks, and Buccet workspace memory roots are lawful.",
        actionKinds: notesAndTaskKinds,
        targetPatterns: resolveNotesAndTaskRoots(rootPath),
        targetMatchMode: "prefix",
        requestBasisTarget: path.join(rootPath, ".buccet"),
        requestBasisSummary: "base-acceptance:notes-and-tasks",
      });
    }
  }

  for (const execSeed of SAFE_LOCAL_EXEC_SEEDS) {
    seeds.push({
      id: execSeed.id,
      acceptanceClass: "safe_local_exec",
      reason: execSeed.reason,
      actionKinds: ["tool.exec"],
      targetPatterns: [...execSeed.targetPatterns],
      targetMatchMode: "exact",
      requestTextPatterns: [...execSeed.requestTextPatterns],
      requestBasisTarget: execSeed.requestBasisTarget,
      requestBasisSummary: execSeed.requestBasisSummary,
    });
  }

  for (const researchSeed of BOUNDED_WEB_RESEARCH_SEEDS) {
    seeds.push({
      id: researchSeed.id,
      acceptanceClass: "bounded_web_research",
      reason: researchSeed.reason,
      actionKinds: ["network.send"],
      targetPatterns: [...researchSeed.targetPatterns],
      targetMatchMode: "regex",
      requestTextPatterns: [...researchSeed.requestTextPatterns],
      requestBasisTarget: researchSeed.requestBasisTarget,
      requestBasisSummary: researchSeed.requestBasisSummary,
    });
  }

  for (const lane of BASE_OPENCLAW_SKILL_ACCEPTANCE_LANES) {
    seeds.push({
      id: lane.id,
      acceptanceClass: "openclaw_skill",
      reason: `OpenClaw skill '${lane.skill}' is a lawful acceptance rail for ${lane.summary}.`,
      actionKinds: [...lane.actionKinds],
      ...(lane.targetPattern ? { targetPattern: lane.targetPattern } : {}),
      ...(lane.targetPatterns ? { targetPatterns: [...lane.targetPatterns] } : {}),
      ...(lane.targetMatchMode ? { targetMatchMode: lane.targetMatchMode } : {}),
      ...(lane.requestTextPatterns ? { requestTextPatterns: [...lane.requestTextPatterns] } : {}),
      requestBasisTarget: lane.skill,
      requestBasisSummary: `openclaw-skill:${lane.skill}`,
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
      ...(seed.requestTextPatterns ? { requestTextPatterns: [...seed.requestTextPatterns] } : {}),
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
    ...(law.trackConstraint?.requestTextPatterns?.length
      ? { track_request_text_patterns: law.trackConstraint.requestTextPatterns.join(",") }
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
  for (const [index, entry] of newEntries.entries()) {
    const law = compiledLaws[index];
    await appendBoundaryLedger("UPL_TRACK_ACTIVATED", {
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
  }

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
