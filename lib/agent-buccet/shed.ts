import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { appendBoundaryLedger } from "./ledger.ts";
import { armBoundaryQuarantineReboot } from "./quarantine.ts";
import { persistBoundarySessionState } from "./state.ts";
import { substrate } from "./substrate-rust.ts";
import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryRequestProvenance,
  BoundaryRuntimeConfig,
} from "./types.ts";

const AUTO_SHED_PROVENANCES = new Set<BoundaryRequestProvenance>([
  "external_content",
  "remote_user",
]);

const AUTO_SHED_ACTIONS = new Set<BoundaryActionKind>([
  "tool.exec",
  "fs.write",
  "fs.append",
  "fs.delete",
  "fs.move",
  "fs.mkdir",
  "network.send",
  "comm.send",
  "db.query",
  "system.access",
]);

type BoundaryShedTrigger = "deny" | "manual";

export type BoundaryDisposableShedResult = {
  unitId: string;
  trustDomain: string;
  sourceDomain: string;
  runtimeDir: string;
  rootfsDir: string;
  isolationActive: boolean;
  persistedState: boolean;
  enteredEnvironment: boolean;
  lifecycleStarted: boolean;
  snapshotPath: string;
};

function sanitizeSegment(value: string): string {
  const trimmed = value.trim();
  const normalized = trimmed.replaceAll(/[^a-zA-Z0-9._-]+/g, "-").replaceAll(/-+/g, "-");
  return normalized.length > 0 ? normalized : "boundary-unit";
}

function isRiskyLowTrustAction(request: BoundaryActionRequest): boolean {
  if (AUTO_SHED_ACTIONS.has(request.actionKind)) {
    return true;
  }
  const flags = request.flags;
  return Boolean(
    flags?.authorityClaimed
    || flags?.claimsUserApproval
    || flags?.requestsLawMutation
    || flags?.requestsLedgerBypass
    || flags?.requestsScopeExpansion
    || flags?.groundingMismatch
    || flags?.claimsActionCompletionWithoutWitness,
  );
}

function provenanceDomain(provenance: BoundaryRequestProvenance): string {
  switch (provenance) {
    case "trusted_user":
      return "personal";
    case "trusted_system":
      return "work";
    case "remote_user":
      return "untrusted";
    case "external_content":
      return "disposable";
    case "tool_output":
      return "work";
    case "mcp_host":
    case "agent_inference":
    default:
      return "work";
  }
}

function boundaryDataRoot(config: BoundaryRuntimeConfig): string {
  const sessionsDir = config.persistence?.sessionsDir;
  if (sessionsDir) {
    return path.dirname(path.resolve(sessionsDir));
  }
  return path.join(process.cwd(), "data", "agent-boundary");
}

function shouldAutoShed(request: BoundaryActionRequest): boolean {
  return AUTO_SHED_PROVENANCES.has(request.provenance) && isRiskyLowTrustAction(request);
}

async function ensureCleanRuntimeRoot(rootfsDir: string): Promise<void> {
  await fs.mkdir(path.join(rootfsDir, "workspace"), { recursive: true });
  await fs.mkdir(path.join(rootfsDir, "tmp"), { recursive: true });
  await fs.writeFile(
    path.join(rootfsDir, ".buccet-clean"),
    "clean disposable respawn root\n",
    "utf8",
  );
}

async function writeRespawnSnapshot(args: {
  snapshotPath: string;
  unitId: string;
  request: BoundaryActionRequest;
  trustDomain: string;
  sourceDomain: string;
  reason: string;
  lawIds: string[];
  runtimeDir: string;
  rootfsDir: string;
  trigger: BoundaryShedTrigger;
  issuedBy: string;
  isolationActive: boolean;
  persistedState: boolean;
  enteredEnvironment: boolean;
  lifecycleStarted: boolean;
}): Promise<void> {
  const payload = {
    schemaVersion: 1,
    kind: "buccet_disposable_respawn",
    unitId: args.unitId,
    trigger: args.trigger,
    issuedBy: args.issuedBy,
    trustDomain: args.trustDomain,
    sourceDomain: args.sourceDomain,
    reason: args.reason,
    lawIds: args.lawIds,
    request: {
      requestId: args.request.requestId,
      actionKind: args.request.actionKind,
      target: args.request.target,
      provenance: args.request.provenance,
    },
    runtime: {
      runtimeDir: args.runtimeDir,
      rootfsDir: args.rootfsDir,
      isolationActive: args.isolationActive,
      persistedState: args.persistedState,
      enteredEnvironment: args.enteredEnvironment,
      lifecycleStarted: args.lifecycleStarted,
    },
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(args.snapshotPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function executeDisposableShed(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  reason: string;
  lawIds: string[];
  trigger: BoundaryShedTrigger;
  issuedBy: string;
}): Promise<BoundaryDisposableShedResult> {
  await persistBoundarySessionState(args.config).catch(() => undefined);
  await substrate.init();

  const dataRoot = boundaryDataRoot(args.config);
  const sessionRoot = path.join(dataRoot, "disposable", sanitizeSegment(args.config.session.sessionId));
  const unitId = `disp-${sanitizeSegment(args.config.session.sessionId)}-${sanitizeSegment(args.request.requestId).slice(0, 16)}`;
  const runtimeDir = path.join(sessionRoot, unitId);
  const rootfsDir = path.join(runtimeDir, "rootfs");
  const substrateStateDir = path.join(runtimeDir, ".buccet-substrate");
  const upperDir = path.join(substrateStateDir, "upper");
  const workDir = path.join(substrateStateDir, "work");
  const mergedDir = path.join(substrateStateDir, "merged");
  const snapshotPath = path.join(runtimeDir, "respawn.json");
  const sourceDomain = provenanceDomain(args.request.provenance);
  const trustDomain = substrate.qAssignTrustDomain(args.request.target || args.request.actionKind, {
    domain_map: {
      [args.config.session.sessionId]: "work",
      [args.config.session.actorId]: "work",
    },
  });

  await appendBoundaryLedger("DISPOSABLE_SHED_TRIGGERED", {
    sessionId: args.config.session.sessionId,
    actorId: args.issuedBy,
    requestId: args.request.requestId,
    actionKind: args.request.actionKind,
    target: args.request.target,
    decision: "deny",
    reason: args.reason,
    lawIds: args.lawIds,
    metadata: {
      trigger: args.trigger,
      provenance: args.request.provenance,
      source_domain: sourceDomain,
      trust_domain: trustDomain,
      unit_id: unitId,
    },
    createdAt: new Date().toISOString(),
  });

  substrate.qManageLifecycle(unitId, {
    action: "stop",
    domain: trustDomain,
  });

  await fs.rm(runtimeDir, { recursive: true, force: true });
  await ensureCleanRuntimeRoot(rootfsDir);

  const isolation = substrate.applyIsolation(unitId, {
    namespace_flags: 0x64020000,
  });
  const persistedState = substrate.persistState(unitId, {
    lower: rootfsDir,
    upper: upperDir,
    work: workDir,
    merged: mergedDir,
  });
  const enteredEnvironment = substrate.enterEnvironment(unitId, {
    rootfs: rootfsDir,
    workdir: "/",
    merged_dir: mergedDir,
  });
  const lifecycleStarted = substrate.qManageLifecycle(unitId, {
    action: "start",
    domain: "disposable",
  });

  await writeRespawnSnapshot({
    snapshotPath,
    unitId,
    request: args.request,
    trustDomain,
    sourceDomain,
    reason: args.reason,
    lawIds: args.lawIds,
    runtimeDir,
    rootfsDir,
    trigger: args.trigger,
    issuedBy: args.issuedBy,
    isolationActive: isolation.active,
    persistedState,
    enteredEnvironment,
    lifecycleStarted,
  });

  await appendBoundaryLedger("DISPOSABLE_RESPAWNED", {
    sessionId: args.config.session.sessionId,
    actorId: args.issuedBy,
    requestId: args.request.requestId,
    actionKind: args.request.actionKind,
    target: runtimeDir,
    reason: "disposable runtime respawned from snapped lawful session state",
    lawIds: args.lawIds,
    metadata: {
      trigger: args.trigger,
      provenance: args.request.provenance,
      source_domain: sourceDomain,
      trust_domain: trustDomain,
      respawn_domain: "disposable",
      unit_id: unitId,
      rootfs_dir: rootfsDir,
      snapshot_path: snapshotPath,
      isolation_active: isolation.active,
      persisted_state: persistedState,
      entered_environment: enteredEnvironment,
      lifecycle_started: lifecycleStarted,
    },
    createdAt: new Date().toISOString(),
  });

  await armBoundaryQuarantineReboot({
    config: args.config,
    reason: `shed reboot activated boundary-on-self quarantine after ${args.trigger} trigger`,
  });

  return {
    unitId,
    trustDomain,
    sourceDomain,
    runtimeDir,
    rootfsDir,
    isolationActive: isolation.active,
    persistedState,
    enteredEnvironment,
    lifecycleStarted,
    snapshotPath,
  };
}

export async function maybeShedCompromisedBoundaryUnit(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  reason: string;
  lawIds: string[];
  trigger?: BoundaryShedTrigger;
}): Promise<BoundaryDisposableShedResult | null> {
  if (args.config.quarantineState?.required) {
    return null;
  }
  if (!shouldAutoShed(args.request)) {
    return null;
  }
  return executeDisposableShed({
    ...args,
    trigger: args.trigger ?? "deny",
    issuedBy: args.config.session.actorId,
  });
}

export async function shedBoundarySessionSkin(args: {
  config: BoundaryRuntimeConfig;
  reason: string;
  issuedBy?: string;
}): Promise<BoundaryDisposableShedResult> {
  const request: BoundaryActionRequest = {
    requestId: randomUUID(),
    sessionId: args.config.session.sessionId,
    actionKind: "system.access",
    target: args.config.session.sessionId,
    requestedAt: new Date().toISOString(),
    provenance: "trusted_user",
    payloadSummary: "manual shed and clean disposable respawn",
    reviewContext: {
      surface: "action",
      title: "Manual Buccet shed",
      question: "Force shed the current disposable skin and respawn a clean one.",
      attemptLines: ["manual denial-side shed requested by operator"],
    },
  };

  return executeDisposableShed({
    config: args.config,
    request,
    reason: args.reason,
    lawIds: ["BOUNDARY.DENIAL.DISPOSABLE.SHED.01"],
    trigger: "manual",
    issuedBy: args.issuedBy ?? args.config.session.actorId,
  });
}
