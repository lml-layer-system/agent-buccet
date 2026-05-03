import { promises as fs } from "node:fs";
import { instantiateBoundaryGrant } from "./../runtime/orchestrator.ts";
import type {
  BoundaryActionKind,
  BoundaryGrant,
  BoundaryLaw,
  BoundaryPolicyConfig,
  BoundaryProcessPolicy,
  BoundaryRuntimeConfig,
} from "./../runtime/types.ts";

const VALID_ACTION_KINDS: BoundaryActionKind[] = [
  "fs.read",
  "fs.write",
  "fs.append",
  "fs.delete",
  "fs.mkdir",
  "fs.move",
  "agent.spend",
  "chat.emit",
  "comm.send",
  "tool.exec",
  "network.send",
  "db.query",
  "db.insert",
  "db.update",
  "db.delete",
  "sys.env.read",
  "sys.env.write",
  "sys.config.read",
  "sys.config.write",
  "sys.credential.read",
  "sys.credential.use",
];

function assertValidActionKind(actionKind: string): asserts actionKind is BoundaryActionKind {
  if (!VALID_ACTION_KINDS.includes(actionKind as BoundaryActionKind)) {
    throw new Error(`unknown boundary action kind: ${actionKind}`);
  }
}

function assertValidPolicyConfig(policy: BoundaryPolicyConfig): void {
  for (const actionKind of policy.approvalRequiredFor ?? []) {
    assertValidActionKind(actionKind);
  }

  for (const grant of policy.grants ?? []) {
    for (const actionKind of grant.grantedActions) {
      assertValidActionKind(actionKind);
    }
  }

  assertValidProcessPolicy(policy.process);
}

function assertValidProcessPolicy(policy?: BoundaryProcessPolicy): void {
  if (!policy) {
    return;
  }

  const listFields = [
    policy.allowedCommands,
    policy.blockedCommands,
    policy.allowedEnvVars,
    policy.allowedEnvPrefixes,
    policy.blockedEnvVars,
  ];

  for (const field of listFields) {
    if (!field) {
      continue;
    }
    if (!Array.isArray(field) || field.some((value) => typeof value !== "string")) {
      throw new Error("invalid process policy field; expected string[]");
    }
  }

  if (policy.inheritParentEnv !== undefined && typeof policy.inheritParentEnv !== "boolean") {
    throw new Error("invalid process policy field inheritParentEnv; expected boolean");
  }

  if (policy.enforceScopedCwd !== undefined && typeof policy.enforceScopedCwd !== "boolean") {
    throw new Error("invalid process policy field enforceScopedCwd; expected boolean");
  }
}

export async function loadBoundaryPolicyConfig(policyPath: string): Promise<BoundaryPolicyConfig> {
  const raw = await fs.readFile(policyPath, "utf8");
  const parsed = JSON.parse(raw) as BoundaryPolicyConfig;
  assertValidPolicyConfig(parsed);
  return parsed;
}

export function resolveBoundaryLaws(args: {
  availableLaws: BoundaryLaw[];
  requestedLawIds?: string[];
}): BoundaryLaw[] {
  if (!args.requestedLawIds || args.requestedLawIds.length === 0) {
    return args.availableLaws;
  }

  const lawById = new Map(args.availableLaws.map((law) => [law.lawId, law]));
  const timeAliasToLiveLawId = new Map<string, string>([
    ["TIME.TRUST.01", "META.TRUST.01"],
    ["TIME.AUTHORITY.01", "META.AUTHORITY.01"],
    ["TIME.SCOPE.01", "META.SCOPE.01"],
    ["TIME.LAW.01", "META.LAW.01"],
    ["TIME.SESSION.01", "META.SESSION.01"],
    ["TIME.LEDGER.01", "META.LEDGER.01"],
    ["TIME.NOVELTY.01", "META.NOVELTY.01"],
  ]);
  return args.requestedLawIds.map((lawId) => {
    const resolvedLawId = lawById.has(lawId) ? lawId : (timeAliasToLiveLawId.get(lawId) ?? lawId);
    const law = lawById.get(resolvedLawId);
    if (!law) {
      throw new Error(`unknown boundary law id: ${lawId}`);
    }
    return law;
  });
}

export function applyBoundaryPolicyConfig(args: {
  config: BoundaryRuntimeConfig;
  policy: BoundaryPolicyConfig;
  availableLaws?: BoundaryLaw[];
  issuedBy?: string;
}): BoundaryRuntimeConfig {
  assertValidPolicyConfig(args.policy);

  const nextGrants: BoundaryGrant[] = [...args.config.grants];
  for (const grantSpec of args.policy.grants ?? []) {
    nextGrants.push(
      instantiateBoundaryGrant({
        session: args.config.session,
        resourceKind: grantSpec.resourceKind,
        resourceValue: grantSpec.resourceValue,
        grantedActions: grantSpec.grantedActions,
        issuedBy: args.issuedBy ?? args.config.session.actorId,
        expiresAt: grantSpec.expiresAt,
        metadata: grantSpec.metadata,
      }),
    );
  }

  const availableLaws = args.availableLaws ?? args.config.laws;
  const nextLaws = resolveBoundaryLaws({
    availableLaws,
    requestedLawIds: args.policy.laws,
  });

  return {
    ...args.config,
    laws: nextLaws,
    grants: nextGrants,
    approvalRequiredFor: args.policy.approvalRequiredFor ?? args.config.approvalRequiredFor,
    userLawIds: [
      ...new Set([...(args.config.userLawIds ?? []), ...nextLaws.map((law) => law.lawId)]),
    ],
    processPolicy: args.policy.process ?? args.config.processPolicy,
  };
}
