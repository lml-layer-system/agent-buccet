import { spawn } from "node:child_process";
import path from "node:path";
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
      if (physics && hasRlimits(physics)) {
        appendBoundaryLedger("PROCESS_LAUNCH_REQUESTED", {
          sessionId: args.config.session.sessionId,
          actorId: args.config.session.actorId,
          actionKind: "tool.exec",
          target: prepared.commandTarget,
          reason: "payload physics constraints applied via ulimit",
          metadata: buildRlimitMetadata(physics),
          createdAt: new Date().toISOString(),
        }).catch(() => undefined);
      }
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
// POSIX rlimits (cpu, nproc, memory, files, fsize) are applied via a `sh -c ulimit`
// shell wrapper on Linux/macOS. These limits are set before exec so the kernel
// enforces them directly — the process cannot raise its own limits.

function hasRlimits(physics: BoundaryProcessPhysics): boolean {
  return (
    physics.cpuTimeLimitSec !== undefined ||
    physics.maxProcesses !== undefined ||
    physics.maxMemoryBytes !== undefined ||
    physics.maxOpenFiles !== undefined ||
    physics.maxFileSizeBytes !== undefined
  );
}

function buildPhysicsSpawnCommand(
  command: string,
  commandArgs: string[],
  physics: BoundaryProcessPhysics | undefined,
): { command: string; args: string[] } {
  if (!physics || !hasRlimits(physics) || process.platform === "win32") {
    return { command, args: commandArgs };
  }

  // Build ulimit preamble for POSIX rlimit injection.
  // Each ulimit call sets the hard and soft limit before exec-ing the target.
  // The process inherits these limits and cannot exceed them without CAP_SYS_RESOURCE.
  const ulimitParts: string[] = [];

  if (physics.cpuTimeLimitSec !== undefined) {
    ulimitParts.push(`ulimit -t ${physics.cpuTimeLimitSec}`);
  }
  if (physics.maxProcesses !== undefined) {
    ulimitParts.push(`ulimit -u ${physics.maxProcesses}`);
  }
  if (physics.maxMemoryBytes !== undefined) {
    // ulimit -v takes kilobytes (virtual address space = RLIMIT_AS)
    const kb = Math.ceil(physics.maxMemoryBytes / 1024);
    ulimitParts.push(`ulimit -v ${kb}`);
  }
  if (physics.maxOpenFiles !== undefined) {
    ulimitParts.push(`ulimit -n ${physics.maxOpenFiles}`);
  }
  if (physics.maxFileSizeBytes !== undefined) {
    // ulimit -f takes 512-byte blocks (RLIMIT_FSIZE)
    const blocks = Math.ceil(physics.maxFileSizeBytes / 512);
    ulimitParts.push(`ulimit -f ${blocks}`);
  }

  const escapedArgs = [command, ...commandArgs].map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ");
  const shellCmd = [...ulimitParts, `exec ${escapedArgs}`].join("; ");

  return { command: "sh", args: ["-c", shellCmd] };
}

function buildRlimitMetadata(physics: BoundaryProcessPhysics): Record<string, string | number | boolean> {
  const meta: Record<string, string | number | boolean> = {};
  if (physics.cpuTimeLimitSec !== undefined) meta["rlimit_cpu_sec"] = physics.cpuTimeLimitSec;
  if (physics.maxProcesses !== undefined) meta["rlimit_nproc"] = physics.maxProcesses;
  if (physics.maxMemoryBytes !== undefined) meta["rlimit_as_bytes"] = physics.maxMemoryBytes;
  if (physics.maxOpenFiles !== undefined) meta["rlimit_nofile"] = physics.maxOpenFiles;
  if (physics.maxFileSizeBytes !== undefined) meta["rlimit_fsize_bytes"] = physics.maxFileSizeBytes;
  return meta;
}
