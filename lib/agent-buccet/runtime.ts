import { appendBoundaryLedger } from "./ledger.ts";
import {
  instantiateBoundaryGrant,
  instantiatePathLaw,
} from "./orchestrator.ts";
import { persistBoundarySessionState } from "./state.ts";
import type {
  BoundaryActionKind,
  BoundaryGrant,
  BoundaryPathLaw,
  BoundaryResourceKind,
  BoundaryRuntimeConfig,
} from "./types.ts";

export type OpenPathResult = {
  grant: BoundaryGrant;
  pathLaw: BoundaryPathLaw;
};

function revokePathLawsForGrant(
  pathLaws: BoundaryPathLaw[],
  grant: BoundaryGrant,
  revokedAt: string,
): BoundaryPathLaw[] {
  const targetLawId = typeof grant.metadata?.law_id === "string" ? grant.metadata.law_id : undefined;
  return pathLaws.map((pathLaw) => {
    if (targetLawId && pathLaw.lawId === targetLawId) {
      return { ...pathLaw, revokedAt };
    }
    if (pathLaw.rootPath === grant.resourceValue) {
      return { ...pathLaw, revokedAt };
    }
    return pathLaw;
  });
}

/**
 * Issues a grant that authorizes the session to access a specific resource.
 *
 * Grants are the mechanism by which users explicitly extend the session's
 * reachable scope. Without a grant, any action targeting a resource is denied
 * at the scope check before law evaluation. With a grant, the resource becomes
 * reachable and laws are evaluated normally.
 *
 * Use `openBoundaryPath` for filesystem paths — it issues the grant and
 * instantiates the corresponding path law in a single operation.
 *
 * @param args.config - Current runtime config.
 * @param args.resourceKind - The kind of resource (`"path"`, `"recipient"`, `"tool"`, etc.).
 * @param args.resourceValue - The resource identifier (path, URL, tool name, etc.).
 * @param args.grantedActions - Action kinds permitted under this grant.
 * @param args.issuedBy - Actor identifier recorded in the grant and ledger.
 * @param args.expiresAt - Optional ISO-8601 expiry. Grant auto-expires after this time.
 * @param args.metadata - Optional key-value metadata recorded in the ledger.
 * @returns `{ grant, config }` — the issued grant and updated config with the grant added.
 */
export async function issueBoundaryGrant(args: {
  config: BoundaryRuntimeConfig;
  resourceKind: BoundaryResourceKind;
  resourceValue: string;
  grantedActions: BoundaryActionKind[];
  issuedBy: string;
  expiresAt?: string;
  metadata?: Record<string, string | number | boolean>;
}): Promise<{ grant: BoundaryGrant; config: BoundaryRuntimeConfig }> {
  const issuedAt = new Date().toISOString();
  const grant = instantiateBoundaryGrant({
    session: args.config.session,
    resourceKind: args.resourceKind,
    resourceValue: args.resourceValue,
    grantedActions: args.grantedActions,
    issuedBy: args.issuedBy,
    issuedAt,
    expiresAt: args.expiresAt,
    metadata: args.metadata,
  });

  await appendBoundaryLedger("GRANT_ISSUED", {
    sessionId: args.config.session.sessionId,
    actorId: args.issuedBy,
    grantId: grant.grantId,
    target: args.resourceValue,
    reason: "resource grant issued by user",
    metadata: {
      resource_kind: args.resourceKind,
      granted_actions: args.grantedActions.join(","),
    },
    createdAt: issuedAt,
  });

  const nextConfig: BoundaryRuntimeConfig = {
    ...args.config,
    grants: [...args.config.grants, grant],
  };
  await persistBoundarySessionState(nextConfig);
  return { grant, config: nextConfig };
}

/**
 * Revokes a previously issued grant, immediately closing that resource from
 * the session's reachable scope.
 *
 * Revocation is immediate and durable — after this call, any action targeting
 * the revoked resource will be denied at the scope check. The revocation
 * survives process restart because it is persisted to both the session state
 * and the ledger.
 *
 * @param args.config - Current runtime config.
 * @param args.grantId - The ID of the grant to revoke.
 * @param args.revokedBy - Actor identifier recorded in the ledger.
 * @param args.reason - Optional reason string recorded in the ledger.
 * @returns `{ grant, config }` — the revoked grant (with `revokedAt` set) and
 *   updated config. Returns `{ grant: null, config }` if the grant was not found.
 */
export async function revokeBoundaryGrant(args: {
  config: BoundaryRuntimeConfig;
  grantId: string;
  revokedBy: string;
  reason?: string;
}): Promise<{ grant: BoundaryGrant | null; config: BoundaryRuntimeConfig }> {
  const revokedAt = new Date().toISOString();
  const targetGrant = args.config.grants.find((grant) => grant.grantId === args.grantId) ?? null;
  if (!targetGrant) {
    return { grant: null, config: args.config };
  }

  const revokedGrant: BoundaryGrant = {
    ...targetGrant,
    revokedAt,
  };
  const nextGrants = args.config.grants.map((grant) =>
    grant.grantId === args.grantId ? revokedGrant : grant,
  );
  const nextPathLaws = revokePathLawsForGrant(args.config.pathLaws, revokedGrant, revokedAt);
  const nextConfig: BoundaryRuntimeConfig = {
    ...args.config,
    grants: nextGrants,
    pathLaws: nextPathLaws,
  };

  await appendBoundaryLedger("GRANT_REVOKED", {
    sessionId: args.config.session.sessionId,
    actorId: args.revokedBy,
    grantId: args.grantId,
    target: targetGrant.resourceValue,
    reason: args.reason ?? "resource grant revoked by user",
    metadata: {
      resource_kind: targetGrant.resourceKind,
    },
    createdAt: revokedAt,
  });

  await persistBoundarySessionState(nextConfig);
  return { grant: revokedGrant, config: nextConfig };
}

export async function expireBoundaryGrants(args: {
  config: BoundaryRuntimeConfig;
  nowIso?: string;
}): Promise<{ expiredGrantIds: string[]; config: BoundaryRuntimeConfig }> {
  const nowIso = args.nowIso ?? new Date().toISOString();
  const expiredGrants = args.config.grants.filter(
    (grant) => !grant.revokedAt && Boolean(grant.expiresAt && grant.expiresAt < nowIso),
  );
  if (expiredGrants.length === 0) {
    return { expiredGrantIds: [], config: args.config };
  }

  const expiredGrantIds = new Set(expiredGrants.map((grant) => grant.grantId));
  const nextGrants = args.config.grants.map((grant) =>
    expiredGrantIds.has(grant.grantId) ? { ...grant, revokedAt: nowIso } : grant,
  );
  let nextPathLaws = [...args.config.pathLaws];
  for (const grant of expiredGrants) {
    nextPathLaws = revokePathLawsForGrant(nextPathLaws, grant, nowIso);
    await appendBoundaryLedger("GRANT_EXPIRED", {
      sessionId: args.config.session.sessionId,
      actorId: args.config.session.actorId,
      grantId: grant.grantId,
      target: grant.resourceValue,
      reason: "resource grant expired and is no longer reachable",
      metadata: {
        resource_kind: grant.resourceKind,
      },
      createdAt: nowIso,
    });
  }

  const nextConfig: BoundaryRuntimeConfig = {
    ...args.config,
    grants: nextGrants,
    pathLaws: nextPathLaws,
  };
  await persistBoundarySessionState(nextConfig);
  return { expiredGrantIds: [...expiredGrantIds], config: nextConfig };
}

/**
 * Opens a filesystem path as lawful reachable scope for the session.
 *
 * This is the primary mechanism for granting filesystem access. It:
 * 1. Issues a `"path"` grant covering `rootPath` and all descendants.
 * 2. Instantiates a path law (logged as `PATH_LAW_INSTANTIATED`) that makes
 *    the path structurally reachable in the session.
 * 3. Persists the updated session state to disk.
 *
 * If a path is not opened, it does not exist to the agent — all actions
 * targeting it are denied at the scope check before law evaluation runs.
 *
 * @param args.config - Current runtime config.
 * @param args.rootPath - Absolute path to the root of the reachable scope.
 * @param args.grantedActions - Action kinds permitted within this path.
 * @param args.issuedBy - Actor identifier recorded in the grant and ledger.
 * @param args.expiresAt - Optional ISO-8601 expiry for the path grant.
 * @returns `{ grant, pathLaw, config }` — the issued grant, instantiated path
 *   law, and updated config.
 *
 * @example
 * ```typescript
 * const { config } = await openBoundaryPath({
 *   config,
 *   rootPath: "/home/alice/project",
 *   grantedActions: ["fs.read", "fs.write"],
 *   issuedBy: "user:alice",
 * });
 * ```
 */
export async function openBoundaryPath(args: {
  config: BoundaryRuntimeConfig;
  rootPath: string;
  grantedActions: BoundaryActionKind[];
  issuedBy: string;
  expiresAt?: string;
}): Promise<OpenPathResult & { config: BoundaryRuntimeConfig }> {
  const openedAt = new Date().toISOString();
  const { grant, pathLaw } = instantiatePathLaw({
    session: args.config.session,
    rootPath: args.rootPath,
    grantedActions: args.grantedActions,
    issuedBy: args.issuedBy,
    instantiatedAt: openedAt,
    expiresAt: args.expiresAt,
  });

  await appendBoundaryLedger("PATH_OPENED", {
    sessionId: args.config.session.sessionId,
    actorId: args.issuedBy,
    grantId: grant.grantId,
    target: args.rootPath,
    reason: "path opened by user",
    lawIds: [pathLaw.lawId],
    metadata: {
      granted_actions: args.grantedActions.join(","),
    },
    createdAt: openedAt,
  });

  await appendBoundaryLedger("PATH_LAW_INSTANTIATED", {
    sessionId: args.config.session.sessionId,
    actorId: args.issuedBy,
    grantId: grant.grantId,
    target: args.rootPath,
    reason: "opened path became lawful reachable scope for the session",
    lawIds: [pathLaw.lawId],
    metadata: {
      granted_actions: args.grantedActions.join(","),
    },
    createdAt: openedAt,
  });

  const nextConfig: BoundaryRuntimeConfig = {
    ...args.config,
    grants: [...args.config.grants, grant],
    pathLaws: [...args.config.pathLaws, pathLaw],
  };
  await persistBoundarySessionState(nextConfig);

  return { grant, pathLaw, config: nextConfig };
}


