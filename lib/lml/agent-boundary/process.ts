import { spawn } from "node:child_process";
import path from "node:path";
import { appendBoundaryLedger } from "./ledger.ts";
import type {
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

  return new Promise((resolve, reject) => {
    const child = spawn(args.command, args.commandArgs, {
      stdio: "inherit",
      env: prepared.env,
      cwd: prepared.cwd,
    });

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
