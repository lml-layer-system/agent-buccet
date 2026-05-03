import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryGrant,
  BoundaryPathLaw,
  BoundaryResourceKind,
  BoundarySession,
} from "./types.ts";

export function isGrantActive(grant: BoundaryGrant, nowIso = new Date().toISOString()): boolean {
  if (grant.revokedAt) {
    return false;
  }
  if (grant.expiresAt && grant.expiresAt < nowIso) {
    return false;
  }
  return true;
}

export function grantsForAction(
  session: BoundarySession,
  actionKind: BoundaryActionKind,
  grants: BoundaryGrant[],
): BoundaryGrant[] {
  return grants
    .filter((grant) => grant.sessionId === session.sessionId)
    .filter((grant) => isGrantActive(grant))
    .filter((grant) => grant.grantedActions.includes(actionKind));
}

export function resourceKindForAction(actionKind: BoundaryActionKind): BoundaryResourceKind {
  if (actionKind.startsWith("fs.")) {
    return "path";
  }
  if (actionKind === "chat.emit") {
    return "chat";
  }
  if (actionKind === "agent.spend") {
    return "recipient";
  }
  if (actionKind === "comm.send") {
    return "recipient";
  }
  if (actionKind === "tool.exec") {
    return "tool";
  }
  if (actionKind === "network.send") {
    return "domain";
  }
  if (actionKind.startsWith("db.")) {
    return "database";
  }
  if (actionKind.startsWith("sys.")) {
    return "system";
  }
  return "path";
}

function domainMatches(target: string, resourceValue: string): boolean {
  const normalizedTarget = target.trim().toLowerCase();
  const normalizedResource = resourceValue.trim().toLowerCase();
  return (
    normalizedTarget === normalizedResource || normalizedTarget.endsWith(`.${normalizedResource}`)
  );
}

function recipientMatches(target: string, resourceValue: string): boolean {
  return target.trim().toLowerCase() === resourceValue.trim().toLowerCase();
}

function chatMatches(target: string, resourceValue: string): boolean {
  return target.trim().toLowerCase() === resourceValue.trim().toLowerCase();
}

function toolMatches(target: string, resourceValue: string): boolean {
  return target.trim() === resourceValue.trim();
}

function databaseMatches(target: string, resourceValue: string): boolean {
  return target.trim().toLowerCase() === resourceValue.trim().toLowerCase();
}

function systemMatches(target: string, resourceValue: string): boolean {
  const normalizedTarget = target.trim().toLowerCase();
  const normalizedResource = resourceValue.trim().toLowerCase();
  return normalizedTarget === normalizedResource;
}

export function targetMatchesGrant(request: BoundaryActionRequest, grant: BoundaryGrant): boolean {
  if (grant.resourceKind !== resourceKindForAction(request.actionKind)) {
    return false;
  }

  if (grant.resourceKind === "path") {
    if (grant.metadata?.exact_only === true) {
      return request.target === grant.resourceValue;
    }
    return (
      request.target === grant.resourceValue || request.target.startsWith(`${grant.resourceValue}/`)
    );
  }
  if (grant.resourceKind === "domain") {
    return domainMatches(request.target, grant.resourceValue);
  }
  if (grant.resourceKind === "chat") {
    return chatMatches(request.target, grant.resourceValue);
  }
  if (grant.resourceKind === "recipient") {
    return recipientMatches(request.target, grant.resourceValue);
  }
  if (grant.resourceKind === "tool") {
    return toolMatches(request.target, grant.resourceValue);
  }
  if (grant.resourceKind === "database") {
    return databaseMatches(request.target, grant.resourceValue);
  }
  if (grant.resourceKind === "system") {
    return systemMatches(request.target, grant.resourceValue);
  }
  return false;
}

export function isTargetReachable(
  request: BoundaryActionRequest,
  actionGrants: BoundaryGrant[],
): boolean {
  return actionGrants.some((grant) => targetMatchesGrant(request, grant));
}

export function instantiateBoundaryGrant(args: {
  session: BoundarySession;
  resourceKind: BoundaryResourceKind;
  resourceValue: string;
  grantedActions: BoundaryActionKind[];
  issuedBy: string;
  issuedAt?: string;
  expiresAt?: string;
  metadata?: Record<string, string | number | boolean>;
}): BoundaryGrant {
  const issuedAt = args.issuedAt ?? new Date().toISOString();
  const safeValue = args.resourceValue.replace(/[^a-zA-Z0-9/_@.-]+/g, "_");
  return {
    grantId: `grant:${args.resourceKind}:${args.session.sessionId}:${safeValue}`,
    sessionId: args.session.sessionId,
    resourceKind: args.resourceKind,
    resourceValue: args.resourceValue,
    grantedActions: args.grantedActions,
    issuedBy: args.issuedBy,
    issuedAt,
    expiresAt: args.expiresAt,
    metadata: args.metadata,
  };
}

export function instantiatePathLaw(args: {
  session: BoundarySession;
  rootPath: string;
  grantedActions: BoundaryActionKind[];
  issuedBy: string;
  instantiatedAt?: string;
  expiresAt?: string;
}): { grant: BoundaryGrant; pathLaw: BoundaryPathLaw } {
  const instantiatedAt = args.instantiatedAt ?? new Date().toISOString();
  const safeRoot = args.rootPath.replace(/[^a-zA-Z0-9/_-]+/g, "_");
  const lawId = `BOUNDARY.PATH.${args.session.sessionId}.${safeRoot}`;
  const grant = instantiateBoundaryGrant({
    session: args.session,
    resourceKind: "path",
    resourceValue: args.rootPath,
    grantedActions: args.grantedActions,
    issuedBy: args.issuedBy,
    issuedAt: instantiatedAt,
    expiresAt: args.expiresAt,
    metadata: {
      law_id: lawId,
      root_path: args.rootPath,
    },
  });
  const pathLaw: BoundaryPathLaw = {
    lawId,
    sessionId: args.session.sessionId,
    rootPath: args.rootPath,
    grantedActions: args.grantedActions,
    issuedBy: args.issuedBy,
    instantiatedAt,
    expiresAt: args.expiresAt,
  };
  return { grant, pathLaw };
}
