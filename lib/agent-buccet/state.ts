import { promises as fs } from "node:fs";
import path from "node:path";
import {
  appendBoundaryLedger,
  readAllBoundaryLedgerRecords,
} from "./ledger.ts";
import {
  buildActiveAgentBuccetLawIds,
  loadAgentBuccetRuntimeMuscle,
} from "./foundation.ts";
import { DEFAULT_ADMISSION_CONFIG } from "./admission.ts";
import { initialAdmissionState } from "./admission.ts";
import { DEFAULT_GOVERNOR_CONFIG, initialGovernorState } from "./governor.ts";
import { DEFAULT_BOUNDARY_LAWS } from "./laws.ts";
import { instantiateBoundaryGrant } from "./orchestrator.ts";
import {
  getActiveUserLawIds,
  loadUserPathLedger,
  pruneSessionScopedUserPathLaws,
} from "./user-path-ledger.ts";
import type {
  BoundaryActionKind,
  BoundaryGrant,
  BoundaryLaw,
  BoundaryPersistedSessionState,
  BoundaryProcessPolicy,
  BoundaryRuntimeConfig,
  BoundarySession,
} from "./types.ts";

const DEFAULT_SESSIONS_DIR = path.join(process.cwd(), "data", "agent-boundary", "sessions");

function resolveSessionsDir(runtimeConfig?: BoundaryRuntimeConfig, sessionsDir?: string): string {
  return sessionsDir ?? runtimeConfig?.persistence?.sessionsDir ?? DEFAULT_SESSIONS_DIR;
}

function sessionStatePath(sessionId: string, sessionsDir?: string): string {
  return path.join(sessionsDir ?? DEFAULT_SESSIONS_DIR, `${sessionId}.json`);
}

function sessionBackupStatePath(sessionId: string, sessionsDir?: string): string {
  return path.join(sessionsDir ?? DEFAULT_SESSIONS_DIR, `${sessionId}.bak.json`);
}

function toPersistedState(config: BoundaryRuntimeConfig): BoundaryPersistedSessionState {
  return {
    schemaVersion: 1,
    session: config.session,
    grants: config.grants,
    pathLaws: config.pathLaws,
    approvalRequiredFor: config.approvalRequiredFor,
    userLawIds: config.userLawIds ?? [],
    processPolicy: config.processPolicy,
    governorConfig: config.governorConfig,
    governorState: config.governorState,
    admissionConfig: config.admissionConfig,
    admissionState: config.admissionState,
    savedAt: new Date().toISOString(),
  };
}

async function atomicWriteSessionState(statePath: string, state: BoundaryPersistedSessionState): Promise<void> {
  const tempPath = `${statePath}.tmp`;
  const serialized = `${JSON.stringify(state, null, 2)}\n`;

  await fs.writeFile(tempPath, serialized, "utf8");
  await fs.rename(tempPath, statePath);
}

async function readSessionStateFile(statePath: string): Promise<BoundaryPersistedSessionState | null> {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    return JSON.parse(raw) as BoundaryPersistedSessionState;
  } catch {
    return null;
  }
}

function parseGrantedActions(value: string | number | boolean | undefined): BoundaryActionKind[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean) as BoundaryActionKind[];
}

async function rebuildBoundarySessionStateFromLedger(args: {
  sessionId: string;
}): Promise<BoundaryPersistedSessionState | null> {
  const records = (await readAllBoundaryLedgerRecords()).filter(
    (record) => record.payload.sessionId === args.sessionId,
  );
  if (records.length === 0) {
    return null;
  }

  const sessionStart = records.find((record) => record.eventType === "SESSION_STARTED");
  if (!sessionStart) {
    return null;
  }

  const latestEnd = [...records].reverse().find((record) => record.eventType === "SESSION_ENDED");
  const pathOpenRecords = records.filter((record) => record.eventType === "PATH_OPENED");
  const issuedGrantRecords = records.filter((record) => record.eventType === "GRANT_ISSUED");
  const revokedGrantRecords = records.filter(
    (record) => record.eventType === "GRANT_REVOKED" || record.eventType === "GRANT_EXPIRED",
  );
  const actionKinds = new Set<BoundaryActionKind>();
  const grantsById = new Map<string, BoundaryPersistedSessionState["grants"][number]>();

  for (const record of issuedGrantRecords) {
    const grantedActions = parseGrantedActions(record.payload.metadata?.granted_actions);
    for (const actionKind of grantedActions) {
      actionKinds.add(actionKind);
    }
    const grantId = record.payload.grantId ?? `grant:${args.sessionId}:${record.index}`;
    grantsById.set(grantId, {
      grantId,
      sessionId: args.sessionId,
      resourceKind: (record.payload.metadata?.resource_kind as "path" | "recipient" | "domain" | "tool" | "database" | "system") ?? "path",
      resourceValue: record.payload.target ?? "",
      grantedActions,
      issuedBy: record.payload.actorId,
      issuedAt: record.payload.createdAt,
      metadata: record.payload.metadata,
    });
  }

  for (const record of pathOpenRecords) {
    const grantedActions = parseGrantedActions(record.payload.metadata?.granted_actions);
    for (const actionKind of grantedActions) {
      actionKinds.add(actionKind);
    }
    const grantId = record.payload.grantId ?? `grant:path:${args.sessionId}:${record.index}`;
    grantsById.set(grantId, {
      grantId,
      sessionId: args.sessionId,
      resourceKind: "path" as const,
      resourceValue: record.payload.target ?? "",
      grantedActions,
      issuedBy: record.payload.actorId,
      issuedAt: record.payload.createdAt,
      metadata: {
        law_id: record.payload.lawIds?.[0] ?? `BOUNDARY.PATH.${args.sessionId}.${record.index}`,
        root_path: record.payload.target ?? "",
      },
    });
  }

  for (const record of revokedGrantRecords) {
    if (!record.payload.grantId) {
      continue;
    }
    const existing = grantsById.get(record.payload.grantId);
    if (!existing) {
      continue;
    }
    grantsById.set(record.payload.grantId, {
      ...existing,
      revokedAt: record.payload.createdAt,
    });
  }

  const grants = [...grantsById.values()];

  const pathLaws = pathOpenRecords.map((record, index) => ({
    lawId: record.payload.lawIds?.[0] ?? `BOUNDARY.PATH.${args.sessionId}.${index}`,
    sessionId: args.sessionId,
    rootPath: record.payload.target ?? "",
    grantedActions: parseGrantedActions(record.payload.metadata?.granted_actions),
    issuedBy: record.payload.actorId,
    instantiatedAt: record.payload.createdAt,
    revokedAt: grants.find((grant) => grant.grantId === record.payload.grantId)?.revokedAt,
  }));

  return {
    schemaVersion: 1,
    session: {
      sessionId: args.sessionId,
      actorId: sessionStart.payload.actorId,
      createdAt: sessionStart.payload.createdAt,
      dryRun: Boolean(sessionStart.payload.metadata?.dry_run),
      persistent: true,
      status: latestEnd ? "ended" : "active",
      endedAt: latestEnd?.payload.createdAt,
    },
    grants,
    pathLaws,
    approvalRequiredFor: [...actionKinds],
    userLawIds: [],
    processPolicy: undefined,
    savedAt: new Date().toISOString(),
  };
}

export async function persistBoundarySessionState(config: BoundaryRuntimeConfig): Promise<BoundaryPersistedSessionState> {
  if (!config.session.persistent || config.persistence?.enabled === false) {
    return toPersistedState(config);
  }

  const sessionsDir = resolveSessionsDir(config);
  const statePath = sessionStatePath(config.session.sessionId, sessionsDir);
  const backupStatePath = sessionBackupStatePath(config.session.sessionId, sessionsDir);
  const state = toPersistedState(config);

  await fs.mkdir(sessionsDir, { recursive: true });
  await atomicWriteSessionState(statePath, state);
  await atomicWriteSessionState(backupStatePath, state);

  await appendBoundaryLedger("SESSION_PERSISTED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    target: statePath,
    reason: "persistent boundary session state saved to disk",
    metadata: {
      session_status: config.session.status,
      persistent: config.session.persistent,
    },
    createdAt: state.savedAt,
  });

  return state;
}

export async function loadBoundarySessionState(args: {
  sessionId: string;
  sessionsDir?: string;
}): Promise<BoundaryPersistedSessionState | null> {
  const statePath = sessionStatePath(args.sessionId, args.sessionsDir);
  const backupStatePath = sessionBackupStatePath(args.sessionId, args.sessionsDir);

  const primary = await readSessionStateFile(statePath);
  if (primary) {
    return primary;
  }

  const backup = await readSessionStateFile(backupStatePath);
  if (backup) {
    return backup;
  }

  return rebuildBoundarySessionStateFromLedger({ sessionId: args.sessionId });
}

function ensureDefaultChatGrant(
  grants: BoundaryGrant[],
  session: BoundarySession,
  issuedAt = new Date().toISOString(),
): BoundaryGrant[] {
  const hasChatGrant = grants.some((grant) =>
    grant.resourceKind === "chat" &&
    grant.resourceValue === "chat:primary" &&
    grant.grantedActions.includes("chat.emit") &&
    !grant.revokedAt
  );
  if (hasChatGrant) {
    return grants;
  }
  return [
    ...grants,
    instantiateBoundaryGrant({
      session,
      resourceKind: "chat",
      resourceValue: "chat:primary",
      grantedActions: ["chat.emit"],
      issuedBy: session.actorId,
      issuedAt,
      metadata: {
        default_surface: true,
        boundary_surface: "chat",
      },
    }),
  ];
}

export async function startPersistentBoundarySession(args: {
  sessionId: string;
  actorId: string;
  dryRun?: boolean;
  expiresAt?: string;
  laws?: BoundaryLaw[];
  approvalRequiredFor?: BoundaryActionKind[];
  sessionsDir?: string;
}): Promise<BoundaryRuntimeConfig> {
  const createdAt = new Date().toISOString();
  const session: BoundarySession = {
    sessionId: args.sessionId,
    actorId: args.actorId,
    createdAt,
    expiresAt: args.expiresAt,
    dryRun: args.dryRun ?? false,
    persistent: true,
    status: "active",
  };

  const defaultChatGrant = instantiateBoundaryGrant({
    session,
    resourceKind: "chat",
    resourceValue: "chat:primary",
    grantedActions: ["chat.emit"],
    issuedBy: session.actorId,
    issuedAt: createdAt,
    metadata: {
      default_surface: true,
      boundary_surface: "chat",
    },
  });

  const upl = await loadUserPathLedger();

  const config: BoundaryRuntimeConfig = {
    session,
    laws: args.laws ?? DEFAULT_BOUNDARY_LAWS,
    grants: [defaultChatGrant],
    pathLaws: [],
    approvalRequiredFor: args.approvalRequiredFor ?? [],
    userLawIds: await buildActiveAgentBuccetLawIds({
      executableLaws: args.laws ?? DEFAULT_BOUNDARY_LAWS,
    }),
    processPolicy: undefined,
    governorConfig: DEFAULT_GOVERNOR_CONFIG,
    governorState: initialGovernorState(),
    admissionConfig: DEFAULT_ADMISSION_CONFIG,
    admissionState: initialAdmissionState(),
    persistence: {
      enabled: true,
      sessionsDir: args.sessionsDir,
    },
    upl,
    runtimeMuscle: await loadAgentBuccetRuntimeMuscle(),
  };
  config.userLawIds = await buildActiveAgentBuccetLawIds({
    executableLaws: args.laws ?? DEFAULT_BOUNDARY_LAWS,
    existingLawIds: getActiveUserLawIds(upl, config.session),
    runtimeMuscle: config.runtimeMuscle,
  });

  await appendBoundaryLedger("SESSION_STARTED", {
    sessionId: session.sessionId,
    actorId: session.actorId,
    reason: "persistent boundary session started",
    metadata: {
      persistent: true,
      dry_run: session.dryRun,
    },
    createdAt,
  });

  await appendBoundaryLedger("GRANT_ISSUED", {
    sessionId: session.sessionId,
    actorId: session.actorId,
    grantId: defaultChatGrant.grantId,
    target: defaultChatGrant.resourceValue,
    reason: "default chat emission boundary surface attached to active session",
    metadata: {
      resource_kind: defaultChatGrant.resourceKind,
      granted_actions: defaultChatGrant.grantedActions.join(","),
      default_surface: true,
    },
    createdAt,
  });

  await persistBoundarySessionState(config);
  return config;
}

export async function restorePersistentBoundarySession(args: {
  sessionId: string;
  laws?: BoundaryLaw[];
  sessionsDir?: string;
}): Promise<BoundaryRuntimeConfig | null> {
  const state = await loadBoundarySessionState({
    sessionId: args.sessionId,
    sessionsDir: args.sessionsDir,
  });
  if (!state) {
    return null;
  }

  const upl = await loadUserPathLedger();

  const config: BoundaryRuntimeConfig = {
    session: {
      ...state.session,
      persistent: true,
    },
    laws: args.laws ?? DEFAULT_BOUNDARY_LAWS,
    grants: ensureDefaultChatGrant(state.grants, state.session, state.session.createdAt),
    pathLaws: state.pathLaws,
    approvalRequiredFor: state.approvalRequiredFor,
    userLawIds: [],
    processPolicy: state.processPolicy as BoundaryProcessPolicy | undefined,
    governorConfig: state.governorConfig ?? DEFAULT_GOVERNOR_CONFIG,
    governorState: state.governorState ?? initialGovernorState(),
    admissionConfig: state.admissionConfig ?? DEFAULT_ADMISSION_CONFIG,
    admissionState: state.admissionState ?? initialAdmissionState(),
    persistence: {
      enabled: true,
      sessionsDir: resolveSessionsDir(undefined, args.sessionsDir),
    },
    upl,
    runtimeMuscle: await loadAgentBuccetRuntimeMuscle(),
  };
  config.userLawIds = await buildActiveAgentBuccetLawIds({
    executableLaws: args.laws ?? DEFAULT_BOUNDARY_LAWS,
    existingLawIds: [
      ...state.userLawIds,
      ...getActiveUserLawIds(upl, config.session),
    ],
    runtimeMuscle: config.runtimeMuscle,
  });

  await appendBoundaryLedger("SESSION_RESTORED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    reason: "persistent boundary session restored from disk",
    metadata: {
      grants: config.grants.length,
      path_laws: config.pathLaws.length,
      session_status: config.session.status,
    },
    createdAt: new Date().toISOString(),
  });

  return config;
}

export async function endPersistentBoundarySession(args: {
  config: BoundaryRuntimeConfig;
  endedBy: string;
  reason?: string;
}): Promise<BoundaryRuntimeConfig> {
  const endedAt = new Date().toISOString();
  const drainedPendingApprovals = await args.config.drainPendingApprovals?.("session ended");
  const nextConfig: BoundaryRuntimeConfig = {
    ...args.config,
    session: {
      ...args.config.session,
      status: "ended",
      endedAt,
    },
  };

  await appendBoundaryLedger("SESSION_ENDED", {
    sessionId: nextConfig.session.sessionId,
    actorId: args.endedBy,
    reason: args.reason ?? "persistent boundary session ended by user",
    metadata: {
      persistent: nextConfig.session.persistent,
      pending_approvals_drained: drainedPendingApprovals ?? 0,
    },
    createdAt: endedAt,
  });

  if (nextConfig.upl) {
    nextConfig.upl = await pruneSessionScopedUserPathLaws({
      ledger: nextConfig.upl,
      sessionId: nextConfig.session.sessionId,
    });
    nextConfig.userLawIds = await buildActiveAgentBuccetLawIds({
      executableLaws: nextConfig.laws,
      existingLawIds: getActiveUserLawIds(nextConfig.upl, nextConfig.session),
      runtimeMuscle: nextConfig.runtimeMuscle,
    });
  }

  await persistBoundarySessionState(nextConfig);
  return nextConfig;
}
