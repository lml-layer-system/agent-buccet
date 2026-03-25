import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendBoundaryLedger } from "./ledger.ts";
import type {
  BoundaryProcessPhysics,
  BoundaryProcessPolicy,
  BoundaryRuntimeConfig,
} from "./types.ts";

const DEFAULT_ALLOWED_ENV_PREFIXES = [
  "AGENT_BUCCET_",
  "PATH",
  "HOME",
  "TMP",
  "TMPDIR",
  "TEMP",
  "TERM",
  "LANG",
  "LC_",
  "SHELL",
  "USER",
  "LOGNAME",
  "PWD",
  "NODE_",
  "npm_",
];

const DEFAULT_BLOCKED_ENV_VARS = [
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "GITHUB_TOKEN",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_API_KEY",
  "SSH_AUTH_SOCK",
];

export type BoundaryPreparedProcess = {
  commandTarget: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  droppedEnvVars: string[];
};

function normalizeCommandTarget(command: string): string {
  return path.basename(command.trim());
}

function isWithinRoot(candidate: string, rootPath: string): boolean {
  const normalizedCandidate = path.resolve(candidate);
  const normalizedRoot = path.resolve(rootPath);
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)
  );
}

function isCommandBlocked(target: string, policy?: BoundaryProcessPolicy): boolean {
  return (policy?.blockedCommands ?? []).includes(target);
}

function isCommandAllowed(target: string, policy?: BoundaryProcessPolicy): boolean {
  if (isCommandBlocked(target, policy)) {
    return false;
  }
  if (!policy?.allowedCommands || policy.allowedCommands.length === 0) {
    return true;
  }
  return policy.allowedCommands.includes(target);
}

function selectScopedCwd(args: {
  requestedCwd?: string;
  scopePaths: string[];
  policy?: BoundaryProcessPolicy;
}): string {
  const requested = args.requestedCwd
    ? path.resolve(args.requestedCwd)
    : (args.scopePaths[0] ? path.resolve(args.scopePaths[0]) : process.cwd());
  const enforceScopedCwd = args.policy?.enforceScopedCwd ?? true;
  if (!enforceScopedCwd || args.scopePaths.length === 0) {
    return requested;
  }

  const withinScope = args.scopePaths.some((scopePath) => isWithinRoot(requested, scopePath));
  if (!withinScope) {
    throw new Error("requested working directory is outside user-opened scope");
  }
  return requested;
}

function shouldKeepEnvVar(args: {
  key: string;
  policy?: BoundaryProcessPolicy;
}): boolean {
  const { key, policy } = args;
  if ((policy?.blockedEnvVars ?? DEFAULT_BLOCKED_ENV_VARS).includes(key)) {
    return false;
  }
  if (policy?.allowedEnvVars?.includes(key)) {
    return true;
  }

  const prefixes = policy?.allowedEnvPrefixes ?? DEFAULT_ALLOWED_ENV_PREFIXES;
  return prefixes.some((prefix) => key === prefix || key.startsWith(prefix));
}

function buildProcessEnv(args: {
  baseEnv: NodeJS.ProcessEnv;
  envOverrides?: Record<string, string>;
  policy?: BoundaryProcessPolicy;
  sessionId: string;
  scopePaths: string[];
  policyPath?: string;
  cwd: string;
}): { env: NodeJS.ProcessEnv; droppedEnvVars: string[] } {
  const startingEnv = (args.policy?.inheritParentEnv === false ? {} : args.baseEnv) as NodeJS.ProcessEnv;
  const merged = {} as NodeJS.ProcessEnv;
  const dropped: string[] = [];

  for (const [key, rawValue] of Object.entries(startingEnv)) {
    if (typeof rawValue !== "string") {
      continue;
    }
    if (!shouldKeepEnvVar({ key, policy: args.policy })) {
      dropped.push(key);
      continue;
    }
    merged[key] = rawValue;
  }

  for (const [key, value] of Object.entries(args.envOverrides ?? {})) {
    if (!shouldKeepEnvVar({ key, policy: args.policy })) {
      dropped.push(key);
      continue;
    }
    merged[key] = value;
  }

  merged.AGENT_BUCCET_SESSION_ID = args.sessionId;
  merged.AGENT_BUCCET_SCOPE_PATHS = JSON.stringify(args.scopePaths);
  merged.AGENT_BUCCET_POLICY_PATH = args.policyPath ?? "";
  merged.AGENT_BUCCET_WRAPPER_MODE = "true";
  merged.AGENT_BUCCET_WRAPPER_CWD = args.cwd;

  return {
    env: merged,
    droppedEnvVars: [...new Set(dropped)].sort(),
  };
}

export async function prepareBoundaryProcess(args: {
  config: BoundaryRuntimeConfig;
  command: string;
  scopePaths: string[];
  envOverrides?: Record<string, string>;
  policyPath?: string;
  requestedCwd?: string;
}): Promise<BoundaryPreparedProcess> {
  const commandTarget = normalizeCommandTarget(args.command);
  if (!isCommandAllowed(commandTarget, args.config.processPolicy)) {
    throw new Error("process command is blocked by wrapper process policy");
  }

  const cwd = selectScopedCwd({
    requestedCwd: args.requestedCwd,
    scopePaths: args.scopePaths,
    policy: args.config.processPolicy,
  });

  const { env, droppedEnvVars } = buildProcessEnv({
    baseEnv: process.env,
    envOverrides: args.envOverrides,
    policy: args.config.processPolicy,
    sessionId: args.config.session.sessionId,
    scopePaths: args.scopePaths,
    policyPath: args.policyPath,
    cwd,
  });

  return {
    commandTarget,
    cwd,
    env,
    droppedEnvVars,
  };
}

export async function runBoundaryProcess(args: {
  config: BoundaryRuntimeConfig;
  command: string;
  commandArgs: string[];
  scopePaths: string[];
  envOverrides?: Record<string, string>;
  policyPath?: string;
  requestedCwd?: string;
}): Promise<{ exitCode: number; commandTarget: string; cwd: string; droppedEnvVars: string[] }> {
  const prepared = await prepareBoundaryProcess(args);

  await appendBoundaryLedger("PROCESS_LAUNCH_REQUESTED", {
    sessionId: args.config.session.sessionId,
    actorId: args.config.session.actorId,
    actionKind: "tool.exec",
    target: prepared.commandTarget,
    reason: "wrapped process launch requested",
    metadata: {
      command: args.command,
      argv: JSON.stringify(args.commandArgs),
      cwd: prepared.cwd,
    },
    createdAt: new Date().toISOString(),
  });

  if (prepared.droppedEnvVars.length > 0) {
    await appendBoundaryLedger("PROCESS_ENV_FILTERED", {
      sessionId: args.config.session.sessionId,
      actorId: args.config.session.actorId,
      actionKind: "tool.exec",
      target: prepared.commandTarget,
      reason: "wrapper filtered environment variables by process policy",
      metadata: {
        dropped_env_vars: prepared.droppedEnvVars.join(","),
        dropped_env_count: prepared.droppedEnvVars.length,
      },
      createdAt: new Date().toISOString(),
    });
  }

  // Build wall-clock + rlimit physics constraints
  const physics = args.config.processPolicy?.physics;
  const spawnCommand = buildPhysicsSpawnCommand(args.command, args.commandArgs, physics);

  // Log which enforcement path is active so the ledger reflects the real physics strength.
  if (physics && hasPhysicsConstraints(physics)) {
    if (spawnCommand.mode === "physwrap") {
      const { active, skipped } = computePhyswrapLimitCoverage(physics);
      await appendBoundaryLedger("PROCESS_PHYSWRAP_ACTIVE", {
        sessionId: args.config.session.sessionId,
        actorId: args.config.session.actorId,
        actionKind: "tool.exec",
        target: prepared.commandTarget,
        reason: "native physwrap enforcer: setrlimit() + privilege drop (platform-native)",
        metadata: {
          ...buildRlimitMetadata(physics),
          physwrap_bin: PHYSWRAP_BIN,
          physwrap_platform: PHYSWRAP_PLATFORM,
          physwrap_active_limits: active.join(","),
          physwrap_skipped_limits: skipped.join(","),
        },
        createdAt: new Date().toISOString(),
      });
    } else if (spawnCommand.mode === "shell_ulimit") {
      await appendBoundaryLedger("PROCESS_PHYSWRAP_FALLBACK", {
        sessionId: args.config.session.sessionId,
        actorId: args.config.session.actorId,
        actionKind: "tool.exec",
        target: prepared.commandTarget,
        reason: "shell-ulimit fallback: physwrap binary not found — limits applied but CAP_SYS_RESOURCE not dropped",
        metadata: { ...buildRlimitMetadata(physics), physwrap_bin: PHYSWRAP_BIN, physwrap_platform: PHYSWRAP_PLATFORM },
        createdAt: new Date().toISOString(),
      });
    }
  }

  return new Promise((resolve, reject) => {
    const child = spawn(spawnCommand.command, spawnCommand.args, {
      stdio: "inherit",
      env: prepared.env,
      cwd: prepared.cwd,
    });

    // Wall-clock timeout: SIGKILL after configured ms — O(1) Node.js native
    let wallClockHandle: ReturnType<typeof setTimeout> | undefined;
    if (physics?.wallClockTimeoutMs) {
      wallClockHandle = setTimeout(() => {
        child.kill("SIGKILL");
        appendBoundaryLedger("PROCESS_WALL_CLOCK_KILL", {
          sessionId: args.config.session.sessionId,
          actorId: args.config.session.actorId,
          actionKind: "tool.exec",
          target: prepared.commandTarget,
          decision: "deny",
          reason: `wall-clock timeout exceeded: ${physics.wallClockTimeoutMs}ms`,
          metadata: {
            pid: child.pid ?? -1,
            timeout_ms: physics.wallClockTimeoutMs ?? 0,
          },
          createdAt: new Date().toISOString(),
        }).catch(() => undefined);
      }, physics.wallClockTimeoutMs);
    }

    child.on("spawn", () => {
      appendBoundaryLedger("PROCESS_SPAWNED", {
        sessionId: args.config.session.sessionId,
        actorId: args.config.session.actorId,
        actionKind: "tool.exec",
        target: prepared.commandTarget,
        reason: "wrapped process spawned under Agent Buccet containment",
        metadata: {
          pid: child.pid ?? -1,
          parent_pid: process.pid,
          command: args.command,
          argv: JSON.stringify(args.commandArgs),
          cwd: prepared.cwd,
        },
        createdAt: new Date().toISOString(),
      }).catch(() => undefined);
    });

    child.on("error", async (error) => {
      await appendBoundaryLedger("PROCESS_BLOCKED", {
        sessionId: args.config.session.sessionId,
        actorId: args.config.session.actorId,
        actionKind: "tool.exec",
        target: prepared.commandTarget,
        decision: "deny",
        reason: `wrapped process failed before launch: ${error.message}`,
        metadata: {
          command: args.command,
          argv: JSON.stringify(args.commandArgs),
          cwd: prepared.cwd,
        },
        createdAt: new Date().toISOString(),
      }).catch(() => undefined);
      reject(error);
    });

    child.on("exit", async (code, signal) => {
      if (wallClockHandle !== undefined) {
        clearTimeout(wallClockHandle);
      }
      await appendBoundaryLedger("PROCESS_EXITED", {
        sessionId: args.config.session.sessionId,
        actorId: args.config.session.actorId,
        actionKind: "tool.exec",
        target: prepared.commandTarget,
        decision: signal ? "deny" : "allow",
        reason: signal
          ? `wrapped process terminated by signal ${signal}`
          : "wrapped process exited normally",
        metadata: {
          pid: child.pid ?? -1,
          exit_code: code ?? 0,
          signal: signal ?? "",
          cwd: prepared.cwd,
        },
        createdAt: new Date().toISOString(),
      }).catch(() => undefined);

      if (signal) {
        reject(new Error(`wrapped command terminated by signal ${signal}`));
        return;
      }
      resolve({
        exitCode: code ?? 0,
        commandTarget: prepared.commandTarget,
        cwd: prepared.cwd,
        droppedEnvVars: prepared.droppedEnvVars,
      });
    });
  });
}

// ─── Payload Physics Helpers ──────────────────────────────────────────────────
// Tier 2: governs what approved processes can physically become.
// Wall-clock timeout is applied via Node.js setTimeout (all platforms).
//
// rlimit enforcement strategy (in order of preference):
//
//  1. buccet-physwrap (native binary, Linux/macOS)
//     - Calls setrlimit() directly — no shell dependency
//     - Drops CAP_SYS_RESOURCE from the capability bounding set (Linux) before
//       exec, so the spawned process cannot raise its own limits back up even if
//       it runs as root or inherits elevated capabilities
//     - Hard limit == soft limit: the hard ceiling is set, not just the soft one
//     - Binary path: native/physwrap/build/buccet-physwrap (relative to this module)
//
//  2. sh -c ulimit fallback
//     - Used when physwrap binary is not built/available, or on Windows
//     - Sets both hard and soft limits via shell ulimit built-in
//     - Does NOT drop capabilities — a root process with CAP_SYS_RESOURCE
//       could raise limits back up
//     - Logged with PROCESS_PHYSWRAP_FALLBACK event so it is auditable

// Resolved once at module load. __dirname equivalent for ESM.
const _moduleDir = path.dirname(fileURLToPath(import.meta.url));
const _physwrapBinName = process.platform === "win32" ? "buccet-physwrap.exe" : "buccet-physwrap";
const PHYSWRAP_BIN = path.resolve(_moduleDir, `../../native/physwrap/build/${_physwrapBinName}`);

/** Platform tag recorded in PROCESS_PHYSWRAP_ACTIVE / PROCESS_PHYSWRAP_FALLBACK ledger events. */
export const PHYSWRAP_PLATFORM: "linux" | "macos" | "windows" | "unknown" =
  process.platform === "linux"  ? "linux"   :
  process.platform === "darwin" ? "macos"   :
  process.platform === "win32"  ? "windows" : "unknown";

/** True if the platform-native physwrap binary is available at the expected path. */
export function isPhyswrapAvailable(): boolean {
  return existsSync(PHYSWRAP_BIN);
}

function hasPhysicsConstraints(physics: BoundaryProcessPhysics): boolean {
  return (
    physics.cpuTimeLimitSec !== undefined ||
    physics.maxProcesses !== undefined ||
    physics.maxMemoryBytes !== undefined ||
    physics.maxOpenFiles !== undefined ||
    physics.maxFileSizeBytes !== undefined ||
    physics.dropToUid !== undefined ||
    physics.dropToGid !== undefined
  );
}

export type PhysicsSpawnMode = "physwrap" | "shell_ulimit" | "passthrough";

export type PhysicsSpawnResult = {
  command: string;
  args: string[];
  mode: PhysicsSpawnMode;
};

/**
 * Compute which physics limits are enforced on the current platform
 * (deterministic — no I/O). Used for PROCESS_PHYSWRAP_ACTIVE metadata.
 */
function computePhyswrapLimitCoverage(physics: BoundaryProcessPhysics): {
  active: string[];
  skipped: string[];
} {
  const platform = PHYSWRAP_PLATFORM;
  const active: string[] = [];
  const skipped: string[] = [];

  // CPU — enforced on all platforms
  if (physics.cpuTimeLimitSec !== undefined) active.push("cpu");

  // nproc: Linux + Windows; not reliable on macOS
  if (physics.maxProcesses !== undefined) {
    if (platform === "macos") skipped.push("nproc");
    else active.push("nproc");
  }

  // as (virtual memory): Linux + Windows; not reliable on macOS
  if (physics.maxMemoryBytes !== undefined) {
    if (platform === "macos") skipped.push("as");
    else active.push("as");
  }

  // nofile: Linux + macOS; no Job Object equivalent on Windows
  if (physics.maxOpenFiles !== undefined) {
    if (platform === "windows") skipped.push("nofile");
    else active.push("nofile");
  }

  // fsize: Linux + macOS; no Job Object equivalent on Windows
  if (physics.maxFileSizeBytes !== undefined) {
    if (platform === "windows") skipped.push("fsize");
    else active.push("fsize");
  }

  // uid/gid drop: only Darwin physwrap supports --uid/--gid
  if (physics.dropToUid !== undefined || physics.dropToGid !== undefined) {
    if (platform === "macos") active.push("uid_gid_drop");
    else skipped.push("uid_gid_drop");
  }

  return { active, skipped };
}

function buildPhysicsSpawnCommand(
  command: string,
  commandArgs: string[],
  physics: BoundaryProcessPhysics | undefined,
): PhysicsSpawnResult {
  if (!physics || !hasPhysicsConstraints(physics)) {
    return { command, args: commandArgs, mode: "passthrough" };
  }

  // ── Path 1: buccet-physwrap (preferred, all platforms) ───────────────────
  if (isPhyswrapAvailable()) {
    const physwrapArgs: string[] = [];

    if (physics.cpuTimeLimitSec !== undefined) {
      physwrapArgs.push("--cpu", String(physics.cpuTimeLimitSec));
    }
    if (physics.maxProcesses !== undefined) {
      physwrapArgs.push("--nproc", String(physics.maxProcesses));
    }
    if (physics.maxMemoryBytes !== undefined) {
      const kb = Math.ceil(physics.maxMemoryBytes / 1024);
      physwrapArgs.push("--as-kb", String(kb));
    }
    if (physics.maxOpenFiles !== undefined) {
      physwrapArgs.push("--nofile", String(physics.maxOpenFiles));
    }
    if (physics.maxFileSizeBytes !== undefined) {
      physwrapArgs.push("--fsize-b", String(physics.maxFileSizeBytes));
    }
    // uid/gid drop: Darwin only — Linux uses CAP drop, Windows no equivalent
    if (process.platform === "darwin") {
      if (physics.dropToGid !== undefined) {
        physwrapArgs.push("--gid", String(physics.dropToGid));
      }
      if (physics.dropToUid !== undefined) {
        physwrapArgs.push("--uid", String(physics.dropToUid));
      }
    }

    return {
      command: PHYSWRAP_BIN,
      args: [...physwrapArgs, "--", command, ...commandArgs],
      mode: "physwrap",
    };
  }

  // ── Path 2: sh -c ulimit fallback (POSIX only) ───────────────────────────
  // Sets both hard and soft limits. Does NOT drop CAP_SYS_RESOURCE.
  // Logged as PROCESS_PHYSWRAP_FALLBACK for auditability.
  // Windows has no sh; fall through to passthrough when physwrap binary absent.
  if (process.platform === "win32") {
    return { command, args: commandArgs, mode: "passthrough" };
  }

  const ulimitParts: string[] = [];

  if (physics.cpuTimeLimitSec !== undefined) {
    ulimitParts.push(`ulimit -St ${physics.cpuTimeLimitSec}; ulimit -Ht ${physics.cpuTimeLimitSec}`);
  }
  if (physics.maxProcesses !== undefined) {
    ulimitParts.push(`ulimit -Su ${physics.maxProcesses}; ulimit -Hu ${physics.maxProcesses}`);
  }
  if (physics.maxMemoryBytes !== undefined) {
    const kb = Math.ceil(physics.maxMemoryBytes / 1024);
    ulimitParts.push(`ulimit -Sv ${kb}; ulimit -Hv ${kb}`);
  }
  if (physics.maxOpenFiles !== undefined) {
    ulimitParts.push(`ulimit -Sn ${physics.maxOpenFiles}; ulimit -Hn ${physics.maxOpenFiles}`);
  }
  if (physics.maxFileSizeBytes !== undefined) {
    const blocks = Math.ceil(physics.maxFileSizeBytes / 512);
    ulimitParts.push(`ulimit -Sf ${blocks}; ulimit -Hf ${blocks}`);
  }

  const escapedArgs = [command, ...commandArgs].map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ");
  const shellCmd = [...ulimitParts, `exec ${escapedArgs}`].join("; ");

  return { command: "sh", args: ["-c", shellCmd], mode: "shell_ulimit" };
}

function buildRlimitMetadata(physics: BoundaryProcessPhysics): Record<string, string | number | boolean> {
  const meta: Record<string, string | number | boolean> = {};
  if (physics.cpuTimeLimitSec !== undefined) meta["rlimit_cpu_sec"] = physics.cpuTimeLimitSec;
  if (physics.maxProcesses !== undefined) meta["rlimit_nproc"] = physics.maxProcesses;
  if (physics.maxMemoryBytes !== undefined) meta["rlimit_as_bytes"] = physics.maxMemoryBytes;
  if (physics.maxOpenFiles !== undefined) meta["rlimit_nofile"] = physics.maxOpenFiles;
  if (physics.maxFileSizeBytes !== undefined) meta["rlimit_fsize_bytes"] = physics.maxFileSizeBytes;
  if (physics.dropToUid !== undefined) meta["drop_uid"] = physics.dropToUid;
  if (physics.dropToGid !== undefined) meta["drop_gid"] = physics.dropToGid;
  return meta;
}
