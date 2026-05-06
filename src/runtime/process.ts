import { spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendBoundaryLedger } from "./../proof/ledger.ts";
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

const REQUIRED_HOOK_ENV_VARS = new Set([
  "BUCCET_SOCKET_PATH",
  "BUCCET_BRAIN_STATUS_PATH",
  "LD_PRELOAD",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_FORCE_FLAT_NAMESPACE",
]);

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

function isCommandAllowed(args: {
  target: string;
  policy?: BoundaryProcessPolicy;
  allowedCommandTargets?: string[];
}): boolean {
  if (isCommandBlocked(args.target, args.policy)) {
    return false;
  }

  const policyAllowed = (args.policy?.allowedCommands ?? []).includes(args.target);
  const currentApprovalAllowed = (args.allowedCommandTargets ?? []).includes(args.target);
  return policyAllowed || currentApprovalAllowed;
}

function selectScopedCwd(args: {
  requestedCwd?: string;
  scopePaths: string[];
  policy?: BoundaryProcessPolicy;
}): string {
  const requested = args.requestedCwd
    ? path.resolve(args.requestedCwd)
    : args.scopePaths[0]
      ? path.resolve(args.scopePaths[0])
      : process.cwd();
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
  if (REQUIRED_HOOK_ENV_VARS.has(key)) {
    return true;
  }
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
  const startingEnv = (
    args.policy?.inheritParentEnv === false ? {} : args.baseEnv
  ) as NodeJS.ProcessEnv;
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
  allowedCommandTargets?: string[];
  envOverrides?: Record<string, string>;
  policyPath?: string;
  requestedCwd?: string;
}): Promise<BoundaryPreparedProcess> {
  const commandTarget = normalizeCommandTarget(args.command);
  if (
    !isCommandAllowed({
      target: commandTarget,
      policy: args.config.processPolicy,
      allowedCommandTargets: args.allowedCommandTargets,
    })
  ) {
    throw new Error(
      "process command requires explicit standing law, allowlist, or current approval",
    );
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
  allowedCommandTargets?: string[];
  envOverrides?: Record<string, string>;
  policyPath?: string;
  requestedCwd?: string;
  ioMode?: "inherit" | "capture";
}): Promise<{
  exitCode: number;
  commandTarget: string;
  cwd: string;
  droppedEnvVars: string[];
  stdout: string;
  stderr: string;
}> {
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

  // PROCESS_PHYSWRAP_FALLBACK is known at spawn time — emit before spawn.
  // PROCESS_PHYSWRAP_ACTIVE is emitted post-exit so it captures complete runtime
  // truth: static coverage metadata + runtime-observed backend reinforcement
  // visibility (Darwin jetsam status). This answers "what was actually active?"
  if (physics && hasPhysicsConstraints(physics)) {
    if (spawnCommand.mode === "shell_ulimit") {
      await appendBoundaryLedger("PROCESS_PHYSWRAP_FALLBACK", {
        sessionId: args.config.session.sessionId,
        actorId: args.config.session.actorId,
        actionKind: "tool.exec",
        target: prepared.commandTarget,
        reason:
          "shell-ulimit fallback: physwrap binary not found — limits applied but CAP_SYS_RESOURCE not dropped",
        metadata: {
          ...buildRlimitMetadata(physics),
          physwrap_bin: PHYSWRAP_BIN,
          physwrap_platform: PHYSWRAP_PLATFORM,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Darwin jetsam status protocol: pass a temp file path to physwrap_mac.c via
  // BUCCET_PHYSWRAP_STATUS_FILE. physwrap_mac writes the memorystatus_control
  // outcome (active/failed/unavailable/not_configured) to this file before
  // execvp(). process.ts reads it post-exit and includes physwrap_macos_jetsam_reinforcement
  // in PROCESS_PHYSWRAP_ACTIVE so operators see the exact runtime enforcement truth.
  const darwinStatusPath =
    spawnCommand.mode === "physwrap" && process.platform === "darwin"
      ? path.join(
          os.tmpdir(),
          `buccet-physwrap-${Date.now()}-${Math.random().toString(36).slice(2)}.status`,
        )
      : undefined;

  const spawnEnv = darwinStatusPath
    ? { ...prepared.env, BUCCET_PHYSWRAP_STATUS_FILE: darwinStatusPath }
    : prepared.env;

  return new Promise((resolve, reject) => {
    const ioMode = args.ioMode ?? "inherit";
    let stdout = "";
    let stderr = "";
    const child = spawn(spawnCommand.command, spawnCommand.args, {
      stdio: ioMode === "capture" ? ["ignore", "pipe", "pipe"] : "inherit",
      env: spawnEnv,
      cwd: prepared.cwd,
    });

    if (ioMode === "capture") {
      child.stdout?.on("data", (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });
    }

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

      // Read Darwin backend runtime status before emitting PROCESS_PHYSWRAP_ACTIVE.
      // physwrap_mac.c writes the jetsam reinforcement outcome to BUCCET_PHYSWRAP_STATUS_FILE
      // before execvp(), so the file is present regardless of how the child later exits.
      // Values: "active" | "failed" | "unavailable" | "not_configured"
      // Special: "status_file_missing" if physwrap crashed before the write (e.g. setrlimit
      // failure at exit(2)), "status_read_error" if the file exists but cannot be parsed.
      // "n/a" on non-Darwin platforms — this field is always present in the ledger event.
      let darwinJetsamStatus = "n/a";
      if (darwinStatusPath) {
        try {
          if (existsSync(darwinStatusPath)) {
            const statusText = readFileSync(darwinStatusPath, "utf8");
            const m = statusText.match(/jetsam_reinforcement=(\S+)/);
            darwinJetsamStatus = m ? (m[1] ?? "status_parse_error") : "status_parse_error";
          } else {
            darwinJetsamStatus = "status_file_missing";
          }
        } catch {
          darwinJetsamStatus = "status_read_error";
        }
        try {
          unlinkSync(darwinStatusPath);
        } catch {
          /* ignore cleanup failure */
        }
      }

      // Emit PROCESS_PHYSWRAP_ACTIVE post-exit with complete runtime truth:
      //   - static per-class coverage (envelope/ioBoundary/privilege active+skipped)
      //   - runtime-observed backend reinforcement: physwrap_macos_jetsam_reinforcement
      // This event answers: "What exact native physics were active for this run?"
      if (physics && hasPhysicsConstraints(physics) && spawnCommand.mode === "physwrap") {
        const coverage = computePhyswrapLimitCoverage(physics);
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
            // Tier 2a: Payload Envelope Physics
            physwrap_envelope_active: coverage.envelope.active.join(","),
            physwrap_envelope_skipped: coverage.envelope.skipped.join(","),
            // Tier 2b: Live I/O / Object Boundary
            physwrap_io_boundary_active: coverage.ioBoundary.active.join(","),
            physwrap_io_boundary_skipped: coverage.ioBoundary.skipped.join(","),
            // Privilege drop
            physwrap_privilege_active: coverage.privilege.active.join(","),
            physwrap_privilege_skipped: coverage.privilege.skipped.join(","),
            // Darwin backend reinforcement: runtime-observed jetsam ceiling outcome.
            // "active"              — memorystatus_control applied successfully
            // "failed"              — memorystatus_control returned error; RLIMIT_AS active
            // "unavailable"         — symbol absent (weak_import NULL); RLIMIT_AS active
            // "not_configured"      — --as-kb not set; no memory limit applied
            // "status_file_missing" — physwrap crashed before writing (e.g. setrlimit failed)
            // "n/a"                 — non-Darwin platform
            physwrap_macos_jetsam_reinforcement: darwinJetsamStatus,
          },
          createdAt: new Date().toISOString(),
        }).catch(() => undefined);
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
        stdout,
        stderr,
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
  process.platform === "linux"
    ? "linux"
    : process.platform === "darwin"
      ? "macos"
      : process.platform === "win32"
        ? "windows"
        : "unknown";

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
    physics.maxIoRateBytesPerSec !== undefined ||
    physics.maxIoOpsPerSec !== undefined ||
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
 * Compute per-class physwrap enforcement coverage for the current platform.
 * Deterministic — no I/O. Returned values are recorded in ledger metadata.
 *
 * Two enforcement classes (see BoundaryProcessPhysics):
 *   envelope    — Tier 2a: launch-time ceiling (cpu, nproc, as)
 *   ioBoundary  — Tier 2b: live I/O / object boundary (nofile, fsize, io_rate, io_iops)
 *
 * Windows Tier 2b coverage (all surfaces active):
 *   nofile — buccet-ioboundary.dll hooks CreateFileA/W via IAT patching;
 *            returns ERROR_TOO_MANY_OPEN_FILES on limit (EMFILE semantics, refuse).
 *   fsize  — same DLL hooks WriteFile; returns ERROR_FILE_TOO_LARGE on limit
 *            (EFBIG/SIGXFSZ semantics, refuse).
 *   io_rate / io_iops — SetIoRateControlInformationJobObject (throttle semantics,
 *            Windows 10 1607+).
 */
function computePhyswrapLimitCoverage(physics: BoundaryProcessPhysics): {
  envelope: { active: string[]; skipped: string[] };
  ioBoundary: { active: string[]; skipped: string[] };
  privilege: { active: string[]; skipped: string[] };
} {
  const platform = PHYSWRAP_PLATFORM;

  const envelope = { active: [] as string[], skipped: [] as string[] };
  const ioBoundary = { active: [] as string[], skipped: [] as string[] };
  const privilege = { active: [] as string[], skipped: [] as string[] };

  // ── Tier 2a: Payload Envelope Physics ─────────────────────────────────────
  // CPU — enforced on all platforms
  if (physics.cpuTimeLimitSec !== undefined) envelope.active.push("cpu");

  // nproc: all platforms — RLIMIT_NPROC on Linux/macOS (per-user scope on macOS,
  //         per-process-tree on Linux), ActiveProcessLimit Job Object on Windows.
  //         macOS scope difference is documented in ledger via physwrap_envelope_active.
  if (physics.maxProcesses !== undefined) {
    envelope.active.push("nproc");
  }

  // as: all platforms — RLIMIT_AS on Linux/macOS (belt-and-suspenders:
  //     memorystatus_control jetsam ceiling applied alongside RLIMIT_AS on macOS
  //     for arm64 RSS coverage); ProcessMemoryLimit Job Object on Windows.
  if (physics.maxMemoryBytes !== undefined) {
    envelope.active.push("as");
  }

  // ── Tier 2b: Live I/O / Object Boundary ───────────────────────────────────
  // nofile: Linux/macOS via RLIMIT_NOFILE (EMFILE refuse);
  //         Windows via buccet-ioboundary.dll IAT hook on CreateFileA/W
  //         (ERROR_TOO_MANY_OPEN_FILES refuse semantics) — all platforms active
  if (physics.maxOpenFiles !== undefined) {
    ioBoundary.active.push("nofile");
  }

  // fsize: Linux/macOS via RLIMIT_FSIZE (SIGXFSZ refuse);
  //        Windows via buccet-ioboundary.dll IAT hook on WriteFile
  //        (ERROR_FILE_TOO_LARGE refuse semantics) — all platforms active
  if (physics.maxFileSizeBytes !== undefined) {
    ioBoundary.active.push("fsize");
  }

  // io_rate: Windows 10 1607+ via SetIoRateControlInformationJobObject (throttle semantics)
  // Linux/macOS: no direct rlimit equivalent — skipped
  if (physics.maxIoRateBytesPerSec !== undefined) {
    if (platform === "windows") ioBoundary.active.push("io_rate");
    else ioBoundary.skipped.push("io_rate");
  }

  // io_iops: Windows 10 1607+ via SetIoRateControlInformationJobObject (throttle semantics)
  // Linux/macOS: no direct rlimit equivalent — skipped
  if (physics.maxIoOpsPerSec !== undefined) {
    if (platform === "windows") ioBoundary.active.push("io_iops");
    else ioBoundary.skipped.push("io_iops");
  }

  // ── Privilege drop ─────────────────────────────────────────────────────────
  // uid/gid drop: Darwin only (setuid/setgid); Linux uses CAP drop (always on)
  if (physics.dropToUid !== undefined || physics.dropToGid !== undefined) {
    if (platform === "macos") privilege.active.push("uid_gid_drop");
    else privilege.skipped.push("uid_gid_drop");
  }

  return { envelope, ioBoundary, privilege };
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
    // Windows Tier 2b: I/O rate control (throttle semantics, Windows 10 1607+)
    if (process.platform === "win32") {
      if (physics.maxIoRateBytesPerSec !== undefined) {
        physwrapArgs.push("--io-rate-bps", String(physics.maxIoRateBytesPerSec));
      }
      if (physics.maxIoOpsPerSec !== undefined) {
        physwrapArgs.push("--io-max-iops", String(physics.maxIoOpsPerSec));
      }
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
    ulimitParts.push(
      `ulimit -St ${physics.cpuTimeLimitSec}; ulimit -Ht ${physics.cpuTimeLimitSec}`,
    );
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

  const escapedArgs = [command, ...commandArgs]
    .map((a) => `'${a.replace(/'/g, "'\\''")}'`)
    .join(" ");
  const shellCmd = [...ulimitParts, `exec ${escapedArgs}`].join("; ");

  return { command: "sh", args: ["-c", shellCmd], mode: "shell_ulimit" };
}

function buildRlimitMetadata(
  physics: BoundaryProcessPhysics,
): Record<string, string | number | boolean> {
  const meta: Record<string, string | number | boolean> = {};
  if (physics.cpuTimeLimitSec !== undefined) meta.rlimit_cpu_sec = physics.cpuTimeLimitSec;
  if (physics.maxProcesses !== undefined) meta.rlimit_nproc = physics.maxProcesses;
  if (physics.maxMemoryBytes !== undefined) meta.rlimit_as_bytes = physics.maxMemoryBytes;
  if (physics.maxOpenFiles !== undefined) meta.rlimit_nofile = physics.maxOpenFiles;
  if (physics.maxFileSizeBytes !== undefined) meta.rlimit_fsize_bytes = physics.maxFileSizeBytes;
  if (physics.maxIoRateBytesPerSec !== undefined)
    meta.io_rate_bytes_per_sec = physics.maxIoRateBytesPerSec;
  if (physics.maxIoOpsPerSec !== undefined) meta.io_max_iops = physics.maxIoOpsPerSec;
  if (physics.dropToUid !== undefined) meta.drop_uid = physics.dropToUid;
  if (physics.dropToGid !== undefined) meta.drop_gid = physics.dropToGid;
  return meta;
}
