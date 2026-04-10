import {
  endPersistentBoundarySession,
  hydrateBoundaryRuntimeConfig,
  persistBoundarySessionState,
  restorePersistentBoundarySession,
  startPersistentBoundarySession,
  type BoundaryRuntimeHydrationMode,
} from "./state.ts";
import {
  expireBoundaryGrants,
  issueBoundaryGrant,
  openBoundaryPath,
  revokeBoundaryGrant,
} from "./runtime.ts";
import type {
  BoundaryActionKind,
  BoundaryLaw,
  BoundaryResourceKind,
  BoundaryRuntimeConfig,
} from "./types.ts";

export type BoundaryRuntimeStore = {
  getConfig(): BoundaryRuntimeConfig;
  replaceConfig(next: BoundaryRuntimeConfig): void;
  hydrate(): Promise<BoundaryRuntimeConfig>;
  persist(): Promise<void>;
  openPath(args: {
    rootPath: string;
    grantedActions: BoundaryActionKind[];
    issuedBy: string;
    expiresAt?: string;
    seedBaseAcceptance?: boolean;
  }): Promise<BoundaryRuntimeConfig>;
  issueGrant(args: {
    resourceKind: BoundaryResourceKind;
    resourceValue: string;
    grantedActions: BoundaryActionKind[];
    issuedBy: string;
    expiresAt?: string;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<BoundaryRuntimeConfig>;
  revokeGrant(args: {
    grantId: string;
    revokedBy: string;
    reason?: string;
  }): Promise<BoundaryRuntimeConfig>;
  expireGrants(nowIso?: string): Promise<BoundaryRuntimeConfig>;
  endSession(args: { endedBy: string; reason?: string }): Promise<BoundaryRuntimeConfig>;
};

export function createBoundaryRuntimeStore(initialConfig: BoundaryRuntimeConfig): BoundaryRuntimeStore {
  let current = initialConfig;

  return {
    getConfig: () => current,
    replaceConfig: (next) => {
      current = next;
    },
    hydrate: async () => {
      current = await hydrateBoundaryRuntimeConfig({ config: current });
      return current;
    },
    persist: async () => {
      await persistBoundarySessionState(current);
    },
    openPath: async ({ rootPath, grantedActions, issuedBy, expiresAt, seedBaseAcceptance }) => {
      const result = await openBoundaryPath({
        config: current,
        rootPath,
        grantedActions,
        issuedBy,
        expiresAt,
        seedBaseAcceptance,
      });
      current = result.config;
      return current;
    },
    issueGrant: async ({ resourceKind, resourceValue, grantedActions, issuedBy, expiresAt, metadata }) => {
      const result = await issueBoundaryGrant({
        config: current,
        resourceKind,
        resourceValue,
        grantedActions,
        issuedBy,
        expiresAt,
        metadata,
      });
      current = result.config;
      return current;
    },
    revokeGrant: async ({ grantId, revokedBy, reason }) => {
      const result = await revokeBoundaryGrant({
        config: current,
        grantId,
        revokedBy,
        reason,
      });
      current = result.config;
      return current;
    },
    expireGrants: async (nowIso) => {
      const result = await expireBoundaryGrants({
        config: current,
        nowIso,
      });
      current = result.config;
      return current;
    },
    endSession: async ({ endedBy, reason }) => {
      current = await endPersistentBoundarySession({
        config: current,
        endedBy,
        reason,
      });
      return current;
    },
  };
}

export async function createPersistentBoundaryRuntimeStore(args: {
  sessionId: string;
  actorId: string;
  dryRun?: boolean;
  expiresAt?: string;
  laws?: BoundaryLaw[];
  approvalRequiredFor?: BoundaryActionKind[];
  sessionsDir?: string;
  hydrationMode?: BoundaryRuntimeHydrationMode;
}): Promise<BoundaryRuntimeStore> {
  const config = await startPersistentBoundarySession(args);
  return createBoundaryRuntimeStore(config);
}

export async function restoreBoundaryRuntimeStore(args: {
  sessionId: string;
  laws?: BoundaryLaw[];
  sessionsDir?: string;
  hydrationMode?: BoundaryRuntimeHydrationMode;
}): Promise<BoundaryRuntimeStore | null> {
  const config = await restorePersistentBoundarySession(args);
  return config ? createBoundaryRuntimeStore(config) : null;
}
