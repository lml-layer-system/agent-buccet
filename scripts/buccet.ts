#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import type { BoundaryActionKind } from "../lib/agent-buccet/index.ts";

type BuccetConfig = {
  schemaVersion: 1;
  sessionId: string;
  actorId: string;
  createdAt: string;
  updatedAt: string;
  defaultScopes: string[];
  dryRun: boolean;
};

type ParsedGlobal = {
  command: string;
  rest: string[];
};

const FULL_FS_SCOPE_ACTIONS: BoundaryActionKind[] = [
  "fs.read",
  "fs.write",
  "fs.append",
  "fs.delete",
  "fs.mkdir",
  "fs.move",
];

function usage(): never {
  console.error([
    "Usage:",
    "  buccet init [--session-id <id>] [--actor-id <id>] [--scope <path>] [--dry-run] [--no-default-scope]",
    "  buccet console                                            — open the bodyguard console (Terminal 2)",
    "  buccet doctor                                             — health check: platform, backend, intercept, ledger",
    "  buccet run [--scope <path>] [--cwd <path>] [--session-id <id>] [--actor-id <id>] [--dry-run] -- <command> [args...]",
    "  buccet status [--json]",
    "  buccet logs [--limit <n>] [--json]",
    "  buccet scope add <path> [--actions <csv>]",
    "  buccet scope list [--json]",
    "  buccet hook build",
    "  buccet hook start",
    "  buccet hook status [--json]",
    "  buccet hook env [--json]",
    "  buccet hook run -- <command> [args...]",
    "  buccet hook stop",
    "  buccet swarm list [--json]",
    "  buccet swarm approve <group-id> [--issued-by <id>] [--reason <text>] [--json]",
    "  buccet swarm deny <group-id> [--denied-by <id>] [--reason <text>] [--json]",
    "  buccet uninstall",
  ].join("\n"));
  process.exit(1);
}

function currentScriptDir(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

function shortSocketPath(homePath: string, label: string): string {
  const digest = createHash("sha256").update(`${homePath}:${label}`).digest("hex").slice(0, 12);
  return path.join(os.tmpdir(), `buccet-${label}-${digest}.sock`);
}

function parseGlobal(argv: string[]): ParsedGlobal {
  const command = argv[0];
  if (!command) {
    usage();
  }
  return {
    command,
    rest: argv.slice(1),
  };
}

function resolveHome(): string {
  return path.resolve(process.env.AGENT_BUCCET_HOME ?? path.join(os.homedir(), ".buccet"));
}

function resolveCallerCwd(): string {
  return path.resolve(process.env.AGENT_BUCCET_CALLER_CWD ?? process.cwd());
}

function defaultActorId(): string {
  const username = os.userInfo().username.replaceAll(/[^a-zA-Z0-9._-]+/g, "_");
  return `user:${username}`;
}

async function ensureDir(targetPath: string): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.map((entry) => path.resolve(entry)))];
}

function parseCsvActions(raw: string | undefined): BoundaryActionKind[] {
  if (!raw) {
    return FULL_FS_SCOPE_ACTIONS;
  }
  return raw.split(",").map((part) => part.trim()).filter(Boolean) as BoundaryActionKind[];
}

async function loadConfig(configPath: string): Promise<BuccetConfig | null> {
  try {
    const raw = await fs.readFile(configPath, "utf8");
    return JSON.parse(raw) as BuccetConfig;
  } catch {
    return null;
  }
}

async function saveConfig(configPath: string, config: BuccetConfig): Promise<void> {
  await ensureDir(path.dirname(configPath));
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function baseConfig(args: {
  sessionId: string;
  actorId: string;
  defaultScopes: string[];
  dryRun: boolean;
}): BuccetConfig {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    sessionId: args.sessionId,
    actorId: args.actorId,
    createdAt: now,
    updatedAt: now,
    defaultScopes: uniquePaths(args.defaultScopes),
    dryRun: args.dryRun,
  };
}

function resolveHomePaths(homePath: string) {
  const runDir = path.join(homePath, "run");
  const nativeDir = path.join(homePath, "native");
  const installedNativeSourceDir = path.join(homePath, "current", "native", "deep-intercept");
  const repoNativeSourceDir = path.resolve(currentScriptDir(), "..", "native", "deep-intercept");
  const nativeBuildDir = path.join(nativeDir, "build");
  const isMac = process.platform === "darwin";
  const nativeLibraryName = isMac ? "libbuccet-hook.dylib" : "libbuccet-hook.so";
  return {
    homePath,
    configPath: path.join(homePath, "config.json"),
    sessionsDir: path.join(homePath, "data", "agent-boundary", "sessions"),
    launcherPath: process.env.AGENT_BUCCET_LAUNCHER_PATH ?? path.join(os.homedir(), ".local", "bin", "buccet"),
    runDir,
    interceptSocketPath: shortSocketPath(homePath, "intercept"),
    gravityBridgeSocketPath: shortSocketPath(homePath, "bridge"),
    brainStatusPath: path.join(runDir, "brain-status.json"),
    hookPidPath: path.join(runDir, "hook-daemon.pid"),
    installedNativeSourceDir,
    repoNativeSourceDir,
    nativeBuildDir,
    nativeLibraryPath: path.join(nativeBuildDir, nativeLibraryName),
  };
}

async function runSubprocess(args: {
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
}): Promise<{ code: number; stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(args.command, args.args, {
      cwd: args.cwd,
      env: args.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });
  });
}

async function readJsonIfExists<T>(targetPath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(targetPath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function resolveNativeSourceDir(home: ReturnType<typeof resolveHomePaths>): Promise<string> {
  if (await pathExists(path.join(home.installedNativeSourceDir, "gravity.c"))) {
    return home.installedNativeSourceDir;
  }
  return home.repoNativeSourceDir;
}

async function pidAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function importBoundary(homePath: string) {
  await ensureDir(homePath);
  process.chdir(homePath);
  return import("../lib/agent-buccet/index.ts");
}

async function ensureStore(boundary: Awaited<ReturnType<typeof importBoundary>>, args: {
  config: BuccetConfig;
  sessionsDir: string;
}) {
  const restored = await boundary.restoreBoundaryRuntimeStore({
    sessionId: args.config.sessionId,
    sessionsDir: args.sessionsDir,
  });
  if (restored) {
    return restored;
  }
  return boundary.createPersistentBoundaryRuntimeStore({
    sessionId: args.config.sessionId,
    actorId: args.config.actorId,
    dryRun: args.config.dryRun,
    sessionsDir: args.sessionsDir,
  });
}

async function ensureScopes(boundary: Awaited<ReturnType<typeof importBoundary>>, args: {
  store: Awaited<ReturnType<typeof ensureStore>>;
  scopePaths: string[];
  actorId: string;
  grantedActions?: BoundaryActionKind[];
}) {
  const grantedActions = args.grantedActions ?? FULL_FS_SCOPE_ACTIONS;
  const existing = new Set(
    args.store.getConfig().pathLaws
      .filter((law) => !law.revokedAt)
      .map((law) => path.resolve(law.rootPath)),
  );

  for (const scopePath of uniquePaths(args.scopePaths)) {
    if (existing.has(scopePath)) {
      continue;
    }
    await args.store.openPath({
      rootPath: scopePath,
      grantedActions,
      issuedBy: args.actorId,
    });
  }
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

function printLogRecord(record: {
  META: { timestamp: string; event_type: string; id: string };
  DECISION: { verdict: string; reason: string };
  INPUT: { action: string; target: string; source: string };
}) {
  console.log([
    record.META.timestamp,
    record.META.event_type,
    record.DECISION.verdict,
    record.INPUT.action,
    record.INPUT.target || "-",
    record.DECISION.reason,
  ].join(" | "));
}

async function handleInit(rest: string[]) {
  const homePath = resolveHome();
  const callerCwd = resolveCallerCwd();
  const home = resolveHomePaths(homePath);
  const boundary = await importBoundary(homePath);

  let sessionId = "agent-buccet-default";
  let actorId = defaultActorId();
  let dryRun = false;
  let includeDefaultScope = true;
  const scopes: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--session-id") {
      sessionId = rest[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--actor-id") {
      actorId = rest[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--scope") {
      scopes.push(path.resolve(callerCwd, rest[index + 1] ?? usage()));
      index += 1;
      continue;
    }
    if (token === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (token === "--no-default-scope") {
      includeDefaultScope = false;
      continue;
    }
    usage();
  }

  const config = await loadConfig(home.configPath) ?? baseConfig({
    sessionId,
    actorId,
    defaultScopes: [],
    dryRun,
  });
  const nextConfig: BuccetConfig = {
    ...config,
    sessionId,
    actorId,
    dryRun,
    defaultScopes: uniquePaths([
      ...config.defaultScopes,
      ...(includeDefaultScope ? [callerCwd] : []),
      ...scopes,
    ]),
    updatedAt: new Date().toISOString(),
  };

  const store = await ensureStore(boundary, {
    config: nextConfig,
    sessionsDir: home.sessionsDir,
  });
  await ensureScopes(boundary, {
    store,
    scopePaths: nextConfig.defaultScopes,
    actorId: nextConfig.actorId,
  });
  await store.persist();
  await saveConfig(home.configPath, nextConfig);

  const platformLabel = detectPlatformLabel();
  const backendLabel = detectBackendLabel();
  const nativeReady = await pathExists(home.nativeLibraryPath);
  const protectionMode = nativeReady ? "strong_path" : "compatibility_path";

  console.log(``);
  console.log(`  Agent Buccet`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Platform:         ${platformLabel}`);
  console.log(`  Backend:          ${backendLabel}`);
  console.log(`  Protection mode:  ${protectionMode}`);

  // Auto-enable the libc-level intercept layer.
  // If a C compiler is available, build the native hook library and start the
  // hook daemon so that LD_PRELOAD / DYLD_INSERT_LIBRARIES interception is
  // active immediately after init — no separate `buccet hook build && buccet hook start` needed.
  // If the compiler is not found, Agent Buccet continues in user-space bridge mode.
  let interceptLine = "compatibility_path (run 'buccet hook build' after installing gcc)";
  try {
    await ensureDir(home.nativeBuildDir);
    await ensureDir(home.runDir);
    const nativeSourceDir = await resolveNativeSourceDir(home);
    const compileArgs = process.platform === "darwin"
      ? ["-dynamiclib", "-fPIC", "-o", home.nativeLibraryPath, path.join(nativeSourceDir, "gravity.c"), "-ldl"]
      : ["-shared", "-fPIC", "-o", home.nativeLibraryPath, path.join(nativeSourceDir, "gravity.c"), "-ldl"];
    const buildResult = await runSubprocess({
      command: process.env.CC ?? "cc",
      args: compileArgs,
      cwd: home.homePath,
    });
    if (buildResult.code !== 0) {
      interceptLine = "compatibility_path (native build failed; run 'buccet hook build' after installing gcc)";
    } else {
      const existingPid = await fs.readFile(home.hookPidPath, "utf8")
        .then((raw) => Number(raw.trim()))
        .catch(() => 0);
      if (existingPid && await pidAlive(existingPid)) {
        interceptLine = `strong_path (libc-level, pid ${existingPid})`;
      } else {
        const daemonScriptPath = path.join(currentScriptDir(), "agent-buccet-hook-daemon.ts");
        const daemonExec = process.env.BUCCET_DAEMON_EXEC ?? process.execPath;
        const hookChild = spawn(daemonExec, [
          daemonScriptPath,
          "--session-id", nextConfig.sessionId,
          "--actor-id", nextConfig.actorId,
          "--sessions-dir", home.sessionsDir,
          "--intercept-socket", home.interceptSocketPath,
          "--bridge-socket", home.gravityBridgeSocketPath,
          "--brain-status-file", home.brainStatusPath,
          "--pid-file", home.hookPidPath,
        ], {
          cwd: home.homePath,
          detached: true,
          stdio: "ignore",
          env: { ...process.env, AGENT_BUCCET_HOME: home.homePath },
        });
        hookChild.unref();
        interceptLine = "strong_path (libc-level)";
      }
    }
  } catch {
    interceptLine = "compatibility_path (cc not found; run 'buccet hook build' after installing gcc)";
  }

  console.log(`  Intercept:        ${interceptLine}`);
  console.log(`  Ledger:           active`);
  console.log(`  Session:          ${nextConfig.sessionId}`);
  console.log(`  Scopes:           ${nextConfig.defaultScopes.length}`);
  console.log(``);
  console.log(`  This terminal is now your protected execution lane.`);
  console.log(``);
  console.log(`  Open a second terminal and run:`);
  console.log(``);
  console.log(`    buccet console`);
  console.log(``);
}

async function handleStatus(rest: string[]) {
  const asJson = rest.includes("--json");
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  const boundary = await importBoundary(homePath);
  const config = await loadConfig(home.configPath);

  if (!config) {
    const payload = {
      initialized: false,
      home: home.homePath,
    };
    if (asJson) {
      printJson(payload);
      return;
    }
    console.log(`Agent Buccet is not initialized.`);
    console.log(`home: ${home.homePath}`);
    return;
  }

  const sessionState = await boundary.loadBoundarySessionState({
    sessionId: config.sessionId,
    sessionsDir: home.sessionsDir,
  });
  const ledgerVerify = await boundary.verifyBoundaryLedgerChain();
  const ledgerEntries = await boundary.readBoundaryLedgerBySession(config.sessionId);

  // Read witness status from the installed release manifest (written at build time).
  const releaseManifestPath = path.join(home.homePath, "current", "releases", "latest.json");
  const releaseManifest = await fs.readFile(releaseManifestPath, "utf8")
    .then((raw) => JSON.parse(raw) as { witness?: { status?: string; mode?: string; target?: string; fallback?: boolean; generated_at?: string } })
    .catch(() => null);
  const witnessStatus = releaseManifest?.witness ?? null;

  const payload = {
    initialized: true,
    home: home.homePath,
    sessionId: config.sessionId,
    actorId: config.actorId,
    sessionStatus: sessionState?.session.status ?? "missing",
    scopes: (sessionState?.pathLaws ?? []).filter((law) => !law.revokedAt).map((law) => law.rootPath),
    grants: (sessionState?.grants ?? []).filter((grant) => !grant.revokedAt).length,
    ledger: {
      entries: ledgerEntries.length,
      chainOk: ledgerVerify.ok,
      checkedFrom: ledgerVerify.checkedFrom,
    },
    witness: witnessStatus
      ? {
          status: witnessStatus.status ?? "unknown",
          mode: witnessStatus.mode ?? "unknown",
          target: witnessStatus.target ?? "unknown",
          fallback: witnessStatus.fallback ?? false,
          published_at: witnessStatus.generated_at ?? null,
        }
      : null,
  };

  if (asJson) {
    printJson(payload);
    return;
  }

  console.log(`Agent Buccet status`);
  console.log(`home: ${payload.home}`);
  console.log(`session: ${payload.sessionId}`);
  console.log(`actor: ${payload.actorId}`);
  console.log(`session status: ${payload.sessionStatus}`);
  console.log(`scopes: ${payload.scopes.length}`);
  console.log(`active grants: ${payload.grants}`);
  console.log(`ledger entries: ${payload.ledger.entries}`);
  console.log(`ledger chain: ${payload.ledger.chainOk ? "ok" : "broken"}`);
  if (payload.witness) {
    console.log(`witness: ${payload.witness.target}`);
    console.log(`witness.mode: ${payload.witness.mode}`);
    console.log(`witness.status: ${payload.witness.status}${payload.witness.fallback ? " (fallback: local file)" : ""}`);
    if (payload.witness.published_at) {
      console.log(`witness.published: ${payload.witness.published_at}`);
    }
  } else {
    console.log(`witness: unavailable (run package build to generate)`);
  }
}

async function handleLogs(rest: string[]) {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  const boundary = await importBoundary(homePath);
  const config = await loadConfig(home.configPath);
  if (!config) {
    throw new Error("Agent Buccet is not initialized. Run `buccet init` first.");
  }

  let limit = 20;
  const asJson = rest.includes("--json");
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === "--limit") {
      limit = Number(rest[index + 1] ?? usage());
      index += 1;
    }
  }

  const records = await boundary.readBoundaryLedgerBySession(config.sessionId);
  const tail = records.slice(-limit);

  if (asJson) {
    printJson(tail);
    return;
  }

  for (const record of tail) {
    printLogRecord(record);
  }
}

async function handleScope(rest: string[]) {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  const callerCwd = resolveCallerCwd();
  const boundary = await importBoundary(homePath);
  const config = await loadConfig(home.configPath);
  if (!config) {
    throw new Error("Agent Buccet is not initialized. Run `buccet init` first.");
  }

  const subcommand = rest[0];
  if (subcommand === "list") {
    const asJson = rest.includes("--json");
    const sessionState = await boundary.loadBoundarySessionState({
      sessionId: config.sessionId,
      sessionsDir: home.sessionsDir,
    });
    const scopes = (sessionState?.pathLaws ?? []).map((law) => ({
      rootPath: law.rootPath,
      status: law.revokedAt ? "revoked" : "active",
      grantedActions: law.grantedActions,
    }));
    if (asJson) {
      printJson(scopes);
      return;
    }
    for (const scope of scopes) {
      console.log(`${scope.status} | ${scope.rootPath} | ${scope.grantedActions.join(",")}`);
    }
    return;
  }

  if (subcommand !== "add") {
    usage();
  }

  const rawTarget = rest[1] ?? usage();
  let actions = FULL_FS_SCOPE_ACTIONS;
  for (let index = 2; index < rest.length; index += 1) {
    if (rest[index] === "--actions") {
      actions = parseCsvActions(rest[index + 1] ?? usage());
      index += 1;
      continue;
    }
    usage();
  }

  const scopePath = path.resolve(callerCwd, rawTarget);
  const store = await ensureStore(boundary, {
    config,
    sessionsDir: home.sessionsDir,
  });
  await ensureScopes(boundary, {
    store,
    scopePaths: [scopePath],
    actorId: config.actorId,
    grantedActions: actions,
  });
  await store.persist();
  const nextConfig: BuccetConfig = {
    ...config,
    defaultScopes: uniquePaths([...config.defaultScopes, scopePath]),
    updatedAt: new Date().toISOString(),
  };
  await saveConfig(home.configPath, nextConfig);
  console.log(`opened scope: ${scopePath}`);
}

async function handleRun(rest: string[]) {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  const callerCwd = resolveCallerCwd();
  const boundary = await importBoundary(homePath);

  let dryRun = false;
  let sessionId: string | undefined;
  let actorId: string | undefined;
  let requestedCwd: string | undefined;
  const extraScopes: string[] = [];
  const separatorIndex = rest.indexOf("--");
  if (separatorIndex === -1) {
    usage();
  }

  const optionArgs = rest.slice(0, separatorIndex);
  const commandArgs = rest.slice(separatorIndex + 1);
  const command = commandArgs[0];
  if (!command) {
    usage();
  }

  for (let index = 0; index < optionArgs.length; index += 1) {
    const token = optionArgs[index];
    if (token === "--scope") {
      extraScopes.push(path.resolve(callerCwd, optionArgs[index + 1] ?? usage()));
      index += 1;
      continue;
    }
    if (token === "--cwd") {
      requestedCwd = path.resolve(callerCwd, optionArgs[index + 1] ?? usage());
      index += 1;
      continue;
    }
    if (token === "--session-id") {
      sessionId = optionArgs[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--actor-id") {
      actorId = optionArgs[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--dry-run") {
      dryRun = true;
      continue;
    }
    usage();
  }

  const existingConfig = await loadConfig(home.configPath);
  const config = existingConfig ?? baseConfig({
    sessionId: sessionId ?? "agent-buccet-default",
    actorId: actorId ?? defaultActorId(),
    defaultScopes: [callerCwd],
    dryRun,
  });
  const nextConfig: BuccetConfig = {
    ...config,
    sessionId: sessionId ?? config.sessionId,
    actorId: actorId ?? config.actorId,
    dryRun: dryRun || config.dryRun,
    defaultScopes: uniquePaths([...config.defaultScopes, ...extraScopes, callerCwd]),
    updatedAt: new Date().toISOString(),
  };

  await saveConfig(home.configPath, nextConfig);
  const store = await ensureStore(boundary, {
    config: nextConfig,
    sessionsDir: home.sessionsDir,
  });
  await ensureScopes(boundary, {
    store,
    scopePaths: nextConfig.defaultScopes,
    actorId: nextConfig.actorId,
  });
  await store.persist();

  const runResult = await boundary.runBoundaryWrappedCommand({
    sessionId: nextConfig.sessionId,
    actorId: nextConfig.actorId,
    command,
    commandArgs: commandArgs.slice(1),
    scopePaths: uniquePaths(
      store.getConfig().pathLaws.filter((law) => !law.revokedAt).map((law) => law.rootPath),
    ),
    sessionsDir: home.sessionsDir,
    keepSession: true,
    dryRun: nextConfig.dryRun,
    cwd: requestedCwd ?? callerCwd,
    provenance: "trusted_user",
  });

  console.log(`exit code: ${runResult.exitCode}`);
  process.exitCode = runResult.exitCode;
}

async function handleUninstall() {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);

  // Stop the hook daemon before removing home so it cannot recreate run-dir files.
  const hookPid = await fs.readFile(home.hookPidPath, "utf8")
    .then((raw) => Number(raw.trim())).catch(() => 0);
  if (hookPid && await pidAlive(hookPid)) {
    try {
      process.kill(hookPid, "SIGTERM");
      // Give the daemon a moment to exit before we rm the directory.
      await new Promise<void>((resolve) => setTimeout(resolve, 150));
    } catch {
      // already dead — fine
    }
  }

  const launcherCandidates = uniquePaths([
    home.launcherPath,
    path.join(home.homePath, "bin", "buccet"),
  ]);

  for (const launcherPath of launcherCandidates) {
    await fs.rm(launcherPath, { force: true }).catch(() => undefined);
  }
  await fs.rm(home.homePath, { recursive: true, force: true });
  console.log(`removed: ${home.homePath}`);
  for (const launcherPath of launcherCandidates) {
    console.log(`removed: ${launcherPath}`);
  }
}

type HookStatusPayload = {
  initialized: boolean;
  running: boolean;
  pid?: number;
  state?: string;
  sessionId?: string;
  actorId?: string;
  interceptSocketPath?: string;
  gravityBridgeSocketPath?: string;
  brainStatusPath?: string;
  nativeLibraryPath?: string;
  restarts?: number;
  lastError?: string;
};

async function handleSwarm(rest: string[]) {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  const config = await loadConfig(home.configPath);
  if (!config) {
    throw new Error("Agent Buccet is not initialized. Run `buccet init` first.");
  }

  const boundary = await importBoundary(homePath);
  const subcommand = rest[0];
  const asJson = rest.includes("--json");
  if (!subcommand) {
    usage();
  }

  const target = { socketPath: home.interceptSocketPath };

  if (subcommand === "list") {
    const output = await boundary.sendBoundaryInterceptServerInput({
      target,
      input: {
        command: "swarm_status",
      },
    });
    if (output.type !== "swarm_status") {
      throw new Error(`unexpected swarm response: ${output.type}`);
    }
    if (asJson) {
      printJson(output);
      return;
    }
    console.log(`Agent Buccet swarm groups`);
    console.log(`pending: ${output.totals.pending}`);
    console.log(`waiting members: ${output.totals.waitingMembers}`);
    for (const group of output.groups) {
      console.log(
        `${group.state} | ${group.groupId} | ${group.actionClass}.${group.operation} | ${group.target} | members=${group.memberCount} waiting=${group.waitingCount}`,
      );
    }
    return;
  }

  const groupId = rest[1] ?? usage();
  let issuedBy = config.actorId;
  let deniedBy = config.actorId;
  let reason: string | undefined;

  for (let index = 2; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--issued-by") {
      issuedBy = rest[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--denied-by") {
      deniedBy = rest[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--reason") {
      reason = rest[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--json") {
      continue;
    }
    usage();
  }

  if (subcommand === "approve") {
    const output = await boundary.sendBoundaryInterceptServerInput({
      target,
      input: {
        command: "swarm_approve",
        groupId,
        issuedBy,
        reason,
      },
    });
    if (output.type !== "ack") {
      throw new Error(`unexpected swarm response: ${output.type}`);
    }
    if (asJson) {
      printJson(output);
      return;
    }
    console.log(`approved swarm group: ${groupId}`);
    return;
  }

  if (subcommand === "deny") {
    const output = await boundary.sendBoundaryInterceptServerInput({
      target,
      input: {
        command: "swarm_deny",
        groupId,
        deniedBy,
        reason,
      },
    });
    if (output.type !== "ack") {
      throw new Error(`unexpected swarm response: ${output.type}`);
    }
    if (asJson) {
      printJson(output);
      return;
    }
    console.log(`denied swarm group: ${groupId}`);
    return;
  }

  usage();
}

async function handleHook(rest: string[]) {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  const config = await loadConfig(home.configPath);
  const subcommand = rest[0];
  if (!subcommand) {
    usage();
  }

  const daemonScriptPath = path.join(currentScriptDir(), "agent-buccet-hook-daemon.ts");

  if (subcommand === "build") {
    await ensureDir(home.nativeBuildDir);
    await ensureDir(home.runDir);
    const nativeSourceDir = await resolveNativeSourceDir(home);
    const compileArgs = process.platform === "darwin"
      ? [
          "-dynamiclib",
          "-fPIC",
          "-o",
          home.nativeLibraryPath,
          path.join(nativeSourceDir, "gravity.c"),
          "-ldl",
        ]
      : [
          "-shared",
          "-fPIC",
          "-o",
          home.nativeLibraryPath,
          path.join(nativeSourceDir, "gravity.c"),
          "-ldl",
        ];
    const result = await runSubprocess({
      command: process.env.CC ?? "cc",
      args: compileArgs,
      cwd: home.homePath,
    });
    if (result.code !== 0) {
      throw new Error(result.stderr || `native hook build failed with code ${result.code}`);
    }
    console.log(`built native hook: ${home.nativeLibraryPath}`);
    return;
  }

  if (subcommand === "start") {
    if (!config) {
      throw new Error("Agent Buccet is not initialized. Run `buccet init` first.");
    }
    await ensureDir(home.runDir);
    const existingPid = await fs.readFile(home.hookPidPath, "utf8").then((raw) => Number(raw.trim())).catch(() => 0);
    if (existingPid && await pidAlive(existingPid)) {
      console.log(`hook daemon already running: ${existingPid}`);
      return;
    }
    const daemonExec = process.env.BUCCET_DAEMON_EXEC ?? process.execPath;
    const child = spawn(daemonExec, [
      daemonScriptPath,
      "--session-id",
      config.sessionId,
      "--actor-id",
      config.actorId,
      "--sessions-dir",
      home.sessionsDir,
      "--intercept-socket",
      home.interceptSocketPath,
      "--bridge-socket",
      home.gravityBridgeSocketPath,
      "--brain-status-file",
      home.brainStatusPath,
      "--pid-file",
      home.hookPidPath,
    ], {
      cwd: home.homePath,
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        AGENT_BUCCET_HOME: home.homePath,
      },
    });
    child.unref();
    console.log(`hook daemon started`);
    console.log(`bridge socket: ${home.gravityBridgeSocketPath}`);
    return;
  }

  if (subcommand === "status") {
    const asJson = rest.includes("--json");
    const hookState = await readJsonIfExists<{
      state?: string;
      sessionId?: string;
      actorId?: string;
      interceptSocketPath?: string;
      gravityBridgeSocketPath?: string;
      brainStatusPath?: string;
      restartCount?: number;
      lastError?: string;
      pid?: number;
    }>(home.brainStatusPath);
    const pid = await fs.readFile(home.hookPidPath, "utf8").then((raw) => Number(raw.trim())).catch(() => 0);
    const running = pid ? await pidAlive(pid) : false;
    const payload: HookStatusPayload = {
      initialized: Boolean(config),
      running,
      pid: pid || undefined,
      state: hookState?.state,
      sessionId: hookState?.sessionId ?? config?.sessionId,
      actorId: hookState?.actorId ?? config?.actorId,
      interceptSocketPath: hookState?.interceptSocketPath ?? home.interceptSocketPath,
      gravityBridgeSocketPath: hookState?.gravityBridgeSocketPath ?? home.gravityBridgeSocketPath,
      brainStatusPath: hookState?.brainStatusPath ?? home.brainStatusPath,
      nativeLibraryPath: home.nativeLibraryPath,
      restarts: hookState?.restartCount,
      lastError: hookState?.lastError,
    };
    if (asJson) {
      printJson(payload);
      return;
    }
    console.log(`Agent Buccet hook status`);
    console.log(`initialized: ${payload.initialized ? "yes" : "no"}`);
    console.log(`running: ${payload.running ? "yes" : "no"}`);
    console.log(`state: ${payload.state ?? "missing"}`);
    console.log(`pid: ${payload.pid ?? "-"}`);
    console.log(`bridge socket: ${payload.gravityBridgeSocketPath}`);
    console.log(`brain status: ${payload.brainStatusPath}`);
    console.log(`native library: ${payload.nativeLibraryPath}`);
    return;
  }

  if (subcommand === "env") {
    const asJson = rest.includes("--json");
    const isMac = process.platform === "darwin";
    const payload = {
      BUCCET_SOCKET_PATH: home.gravityBridgeSocketPath,
      BUCCET_BRAIN_STATUS_PATH: home.brainStatusPath,
      ...(isMac
        ? {
            DYLD_INSERT_LIBRARIES: home.nativeLibraryPath,
            DYLD_FORCE_FLAT_NAMESPACE: "1",
          }
        : {
            LD_PRELOAD: home.nativeLibraryPath,
          }),
    };
    if (asJson) {
      printJson(payload);
      return;
    }
    for (const [key, value] of Object.entries(payload)) {
      console.log(`${key}=${value}`);
    }
    return;
  }

  if (subcommand === "run") {
    if (!config) {
      throw new Error("Agent Buccet is not initialized. Run `buccet init` first.");
    }
    const separatorIndex = rest.indexOf("--");
    if (separatorIndex === -1) {
      usage();
    }
    const commandArgs = rest.slice(separatorIndex + 1);
    const command = commandArgs[0];
    if (!command) {
      usage();
    }
    if (!(await pathExists(home.nativeLibraryPath))) {
      await handleHook(["build"]);
    }
    const pid = await fs.readFile(home.hookPidPath, "utf8").then((raw) => Number(raw.trim())).catch(() => 0);
    if (!(pid && await pidAlive(pid))) {
      await handleHook(["start"]);
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const status = await readJsonIfExists<{ state?: string }>(home.brainStatusPath);
        if (status?.state === "alive") {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    const env = {
      ...process.env,
      AGENT_BUCCET_HOME: home.homePath,
      BUCCET_SOCKET_PATH: home.gravityBridgeSocketPath,
      BUCCET_BRAIN_STATUS_PATH: home.brainStatusPath,
      ...(process.platform === "darwin"
        ? {
            DYLD_INSERT_LIBRARIES: home.nativeLibraryPath,
            DYLD_FORCE_FLAT_NAMESPACE: "1",
          }
        : {
            LD_PRELOAD: home.nativeLibraryPath,
          }),
    };
    const child = spawn(command, commandArgs.slice(1), {
      cwd: resolveCallerCwd(),
      env,
      stdio: "inherit",
    });
    const exitCode = await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
    });
    process.exitCode = exitCode;
    return;
  }

  if (subcommand === "stop") {
    const pid = await fs.readFile(home.hookPidPath, "utf8").then((raw) => Number(raw.trim())).catch(() => 0);
    if (!pid) {
      console.log("hook daemon not running");
      return;
    }
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      console.log("hook daemon not running");
      return;
    }
    console.log(`hook daemon stopped: ${pid}`);
    return;
  }

  usage();
}

// ─── platform helpers ──────────────────────────────────────────────────────

function detectPlatformLabel(): string {
  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "x64" : process.arch;
  const platform = process.platform === "darwin" ? "macOS"
    : process.platform === "linux" ? "Linux"
    : process.platform === "win32" ? "Windows"
    : process.platform;
  return `${platform} ${arch}`;
}

function detectBackendLabel(): string {
  if (process.platform === "darwin") return "darwin_physwrap";
  if (process.platform === "linux") return "linux_physwrap";
  if (process.platform === "win32") return "windows_physwrap";
  return "user_space";
}

// ─── buccet doctor ─────────────────────────────────────────────────────────

async function handleDoctor() {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  const config = await loadConfig(home.configPath);

  const platformLabel = detectPlatformLabel();
  const backendLabel = detectBackendLabel();
  const nativeReady = await pathExists(home.nativeLibraryPath);
  const protectionMode = nativeReady ? "strong_path" : "compatibility_path";

  const hookPid = await fs.readFile(home.hookPidPath, "utf8")
    .then((raw) => Number(raw.trim())).catch(() => 0);
  const hookAlive = hookPid ? await pidAlive(hookPid) : false;

  let interceptReachable = false;
  if (hookAlive) {
    try {
      const boundary = await importBoundary(homePath);
      const out = await boundary.sendBoundaryInterceptServerInput({
        target: { socketPath: home.interceptSocketPath },
        input: { command: "status" },
      });
      interceptReachable = out.type === "status";
    } catch {
      interceptReachable = false;
    }
  }

  let ledgerChainOk: boolean | null = null;
  let ledgerEntries = 0;
  if (config) {
    try {
      const boundary = await importBoundary(homePath);
      const verify = await boundary.verifyBoundaryLedgerChain();
      const entries = await boundary.readBoundaryLedgerBySession(config.sessionId);
      ledgerChainOk = verify.ok;
      ledgerEntries = entries.length;
    } catch {
      ledgerChainOk = null;
    }
  }

  const sessionStatus = config ? "initialized" : "not initialized";

  const passIcon = "ok";
  const failIcon = "FAIL";
  const warnIcon = "warn";

  const lines: string[] = [
    ``,
    `  Agent Buccet — Doctor`,
    `  ─────────────────────────────────────`,
    `  Platform:         ${platformLabel}`,
    `  Backend:          ${backendLabel}`,
    `  Native library:   ${nativeReady ? `${passIcon} (${protectionMode})` : `${warnIcon} (${protectionMode} — run 'buccet hook build')`}`,
    `  Hook daemon:      ${hookAlive ? `${passIcon} (pid ${hookPid})` : `${failIcon} (not running — run 'buccet hook start')`}`,
    `  Intercept socket: ${interceptReachable ? passIcon : hookAlive ? `${failIcon} (daemon alive but socket unreachable)` : `${warnIcon} (daemon not running)`}`,
    `  Ledger chain:     ${ledgerChainOk === null ? `${warnIcon} (not checked)` : ledgerChainOk ? `${passIcon} (${ledgerEntries} entries)` : `${failIcon} (chain broken — run 'buccet ledger repair')`}`,
    `  Session:          ${sessionStatus}`,
    ``,
  ];

  for (const line of lines) {
    console.log(line);
  }

  const critical = !hookAlive || (hookAlive && !interceptReachable) || ledgerChainOk === false;
  if (critical) {
    console.log(`  One or more checks require attention.`);
    console.log(`  Run 'buccet hook start' to re-arm the protected execution lane.`);
    console.log(``);
  } else {
    console.log(`  All systems active. This machine is guarded.`);
    console.log(``);
  }
}

// ─── buccet console ────────────────────────────────────────────────────────

async function handleConsole() {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  const config = await loadConfig(home.configPath);

  if (!config) {
    console.error(`Agent Buccet is not initialized. Run 'buccet init' first.`);
    process.exit(1);
  }

  const boundary = await importBoundary(homePath);
  const interceptTarget = { socketPath: home.interceptSocketPath };

  const platformLabel = detectPlatformLabel();
  const backendLabel = detectBackendLabel();
  const nativeReady = await pathExists(home.nativeLibraryPath);
  const protectionMode = nativeReady ? "strong_path" : "compatibility_path";

  // Print the header once.
  console.log(``);
  console.log(`  Agent Buccet — Bodyguard Console`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Platform:         ${platformLabel}`);
  console.log(`  Backend:          ${backendLabel}`);
  console.log(`  Protection mode:  ${protectionMode}`);
  console.log(`  Session:          ${config.sessionId}`);
  console.log(``);
  console.log(`  This is the bodyguard console. Terminal 1 is the protected execution lane.`);
  console.log(``);
  console.log(`  Commands:`);
  console.log(`    1 / 2 / 3 / 4      — decide pending approval (when one group is waiting)`);
  console.log(`    allow <id>         — allow once`);
  console.log(`    deny <id>          — deny once`);
  console.log(`    law <id>           — allow as standing law`);
  console.log(`    deny-law <id>      — deny as standing law`);
  console.log(`    laws               — list active scope laws for this session`);
  console.log(`    unblock [prov]     — show or clear a standing ingress block`);
  console.log(`    nsl [n]            — list or select a pending NSL move`);
  console.log(`    status             — session status`);
  console.log(`    logs [n]           — last n ledger entries (default 10)`);
  console.log(`    feed               — toggle live event feed on/off`);
  console.log(`    upl                — active UPL laws`);
  console.log(`    doctor             — health check`);
  console.log(`    quit               — exit`);
  console.log(``);

  // Track which groups have already been reported.
  const reportedGroupIds = new Set<string>();
  // Current waiting groups — updated on every approval poll for numbered shorthand.
  let currentWaitingGroups: Array<{
    groupId: string;
    state: string;
    actionClass: string;
    operation: string;
    target: string;
    reason: string;
    lawIds: string[];
    memberCount: number;
    waitingCount: number;
  }> = [];
  // Live feed toggle.
  let feedEnabled = true;
  // Ledger position — seeded to current length so we don't replay old events on startup.
  let lastSeenCount = 0;
  // Standing blocked provenances observed this session (from feed).
  const blockedProvenances = new Set<string>();
  // Pending NSL move suggestions from the live feed.
  const nslSuggestions: Array<{ reason: string; timestamp: string }> = [];

  // Format a notable ledger event for the live feed. Returns null for noisy events.
  function formatLedgerEvent(record: {
    META: { event_type: string; timestamp?: string; metadata?: Record<string, unknown> };
    INPUT: { action?: string; target?: string };
    DECISION: { reason?: string };
  }): string | null {
    const et = record.META.event_type;
    const action = record.INPUT.action ?? "-";
    const target = record.INPUT.target ?? "-";
    const reason = record.DECISION.reason ?? "";
    const meta = record.META.metadata ?? {};

    // Infrastructure / noisy events — skip entirely.
    const skip = new Set([
      "ACTION_PROPOSED", "DECISION_RETURNED",
      "SESSION_STARTED", "SESSION_RESTORED", "SESSION_PERSISTED", "SESSION_ENDED",
      "PATH_OPENED", "PATH_LAW_INSTANTIATED",
      "RECIPIENT_OPENED", "RECIPIENT_LAW_INSTANTIATED",
      "DOMAIN_OPENED", "DOMAIN_LAW_INSTANTIATED",
      "TOOL_OPENED", "TOOL_LAW_INSTANTIATED",
      "DATABASE_OPENED", "DATABASE_LAW_INSTANTIATED",
      "SYSTEM_OPENED", "SYSTEM_LAW_INSTANTIATED",
      "GRANT_ISSUED", "GRANT_REVOKED", "GRANT_EXPIRED",
      "PROPOSAL_REPLAYED", "APPROVAL_REQUESTED",
      "PROCESS_LAUNCH_REQUESTED", "PROCESS_SPAWNED", "PROCESS_EXITED",
      "PROCESS_ENV_FILTERED", "PROCESS_PHYSWRAP_ACTIVE", "PROCESS_PHYSWRAP_FALLBACK",
    ]);
    if (skip.has(et)) return null;

    if (et === "ACTION_BLOCKED") {
      return action === "chat.emit"
        ? `  ✗ CHAT BLOCKED     ${reason}`
        : `  ✗ BLOCKED          ${action} → ${target}  [${reason}]`;
    }
    if (et === "ACTION_EXECUTED")          return `  ✓ ALLOWED          ${action} → ${target}`;
    if (et === "APPROVAL_GRANTED")         return `  ✓ APPROVED         ${action} → ${target}`;
    if (et === "APPROVAL_DENIED")          return `  ✗ DENIED           ${action} → ${target}`;
    if (et === "PROCESS_WALL_CLOCK_KILL")  return `  ⚡ WALL-CLOCK KILL  ${target}`;
    if (et === "GOVERNOR_TRIP")            return `  ⚡ GOVERNOR TRIP    ${reason}`;
    if (et === "PROCESS_PHYSWRAP_CAP_WARNING") return `  ⚠  PHYSWRAP WARN    ${reason}`;
    if (et === "INGRESS_PROVENANCE_BLOCKED") {
      return `  ✗ INGRESS BLOCKED  ${String(meta["provenance"] ?? target)}`;
    }
    if (et === "INGRESS_STANDING_LAW_WRITTEN") {
      const prov = String(meta["provenance"] ?? target);
      const kind = meta["promotion_kind"] ? `  [${String(meta["promotion_kind"])}]` : "";
      return `  ⚑ STANDING LAW     ${prov}${kind}`;
    }
    if (et === "INGRESS_VELOCITY_TRIP")    return `  ✗ VELOCITY TRIP    ${String(meta["provenance"] ?? target)}`;
    if (et === "INGRESS_DENSITY_TRIP")     return `  ✗ DENSITY TRIP     ${String(meta["provenance"] ?? target)}`;
    if (et === "INGRESS_MASS_TRIP")        return `  ✗ MASS TRIP        ${String(meta["provenance"] ?? target)}`;
    if (et === "INGRESS_DENIED")           return `  ✗ INGRESS DENIED   ${target}`;
    if (et === "NSL_GRANT_OFFERED")        return `  → NSL OFFER        ${action} → ${target}`;
    if (et === "NSL_MOVE_SUGGESTED")       return `  → NSL MOVE         ${reason}`;
    if (et === "NSL_MOVE_CHOSEN")          return `  ✓ NSL CHOSEN       ${reason}`;
    if (et === "UPL_ALLOW_RECORDED")       return `  ⚑ UPL ALLOW LAW    ${target}`;
    if (et === "UPL_DENY_RECORDED")        return `  ⚑ UPL DENY LAW     ${target}`;
    if (et === "USER_CONFIRMED_DENY")      return `  ✗ USER DENY        ${target}`;
    if (et === "LEDGER_STORM_SUMMARY") {
      return `  ⚡ STORM SUMMARY    shed ${String(meta["shed_count"] ?? "?")} events`;
    }
    return null; // unknown — skip
  }

  async function pollLedger() {
    try {
      // config is guaranteed non-null — checked at function entry before pollLedger is defined.
      const sessionId = (config as NonNullable<typeof config>).sessionId;
      const records = await boundary.readBoundaryLedgerBySession(sessionId);
      if (records.length <= lastSeenCount) return;
      const newRecords = records.slice(lastSeenCount);
      lastSeenCount = records.length;
      for (const record of newRecords as Parameters<typeof formatLedgerEvent>[0][]) {
        const et = record.META.event_type;
        const meta = record.META.metadata ?? {};
        // Track standing ingress blocks for `unblock` command.
        if (et === "INGRESS_PROVENANCE_BLOCKED" || et === "INGRESS_STANDING_LAW_WRITTEN") {
          const prov = String(meta["provenance"] ?? record.INPUT.target ?? "");
          if (prov && prov !== "-") blockedProvenances.add(prov);
        }
        // Track NSL move suggestions for `nsl` command.
        if (et === "NSL_MOVE_SUGGESTED") {
          nslSuggestions.push({ reason: record.DECISION.reason ?? "", timestamp: String(record.META.timestamp ?? "") });
          if (nslSuggestions.length > 20) nslSuggestions.shift();
        }
        if (feedEnabled) {
          const line = formatLedgerEvent(record);
          if (line) console.log(line);
        }
      }
    } catch { /* silent */ }
  }

  async function pollApprovals() {
    try {
      const out = await boundary.sendBoundaryInterceptServerInput({
        target: interceptTarget,
        input: { command: "swarm_status" },
      });
      if (out.type !== "swarm_status") return;

      const waitingGroups = out.groups.filter(
        (g: { state: string; waitingCount: number }) => g.state === "waiting" || g.waitingCount > 0,
      );
      currentWaitingGroups = waitingGroups;

      for (const group of waitingGroups) {
        if (reportedGroupIds.has(group.groupId)) continue;
        reportedGroupIds.add(group.groupId);
        console.log(``);
        console.log(`  ╔═ BOUNDARY INTERCEPTION ══════════════════════════════════════════╗`);
        console.log(`  ║  Action:    ${group.actionClass}.${group.operation}`);
        console.log(`  ║  Target:    ${group.target}`);
        console.log(`  ║  Waiting:   ${group.waitingCount} request(s)`);
        if (group.reason) {
          console.log(`  ║`);
          console.log(`  ║  Reason:    ${group.reason}`);
        }
        if (group.lawIds?.length > 0) {
          console.log(`  ║  Laws:      ${(group.lawIds as string[]).join(", ")}`);
        }
        console.log(`  ║`);
        console.log(`  ║  1. Allow once     — proceeds; no law written`);
        console.log(`  ║  2. Allow as law   — proceeds; standing allow law written`);
        console.log(`  ║  3. Deny once      — blocked; no law written`);
        console.log(`  ║  4. Deny as law    — blocked; standing deny law written`);
        console.log(`  ║`);
        console.log(`  ║  > 1 / 2 / 3 / 4   or   allow/deny/law/deny-law ${group.groupId}`);
        console.log(`  ╚══════════════════════════════════════════════════════════════════╝`);
        console.log(``);
      }

      // Clear resolved groups from reported set.
      for (const id of reportedGroupIds) {
        if (!waitingGroups.some((g: { groupId: string }) => g.groupId === id)) {
          reportedGroupIds.delete(id);
        }
      }
    } catch {
      // Intercept socket not reachable — daemon may not be running. Silent.
    }
  }

  // Seed lastSeenCount to avoid replaying old events on startup.
  try {
    const existing = await boundary.readBoundaryLedgerBySession(config.sessionId);
    lastSeenCount = existing.length;
  } catch { /* silent */ }

  const pollHandle = setInterval(() => {
    void pollApprovals();
    void pollLedger();
  }, 1_000);

  // Initial approval poll.
  await pollApprovals();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "buccet> ",
    terminal: true,
  });

  rl.prompt();

  rl.on("line", (rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      rl.prompt();
      return;
    }

    const parts = line.split(/\s+/);
    const cmd = parts[0];
    const arg1 = parts[1];

    void (async () => {
      try {
        if (cmd === "quit" || cmd === "q" || cmd === "exit") {
          clearInterval(pollHandle);
          rl.close();
          process.exit(0);
        }

        // Numbered shorthand: 1/2/3/4 when exactly one group is waiting.
        if (cmd === "1" || cmd === "2" || cmd === "3" || cmd === "4") {
          if (currentWaitingGroups.length === 0) {
            console.log(`  No pending approvals.`);
            rl.prompt();
            return;
          }
          if (currentWaitingGroups.length > 1) {
            console.log(`  ${currentWaitingGroups.length} groups pending — use allow/deny/law/deny-law <id>`);
            rl.prompt();
            return;
          }
          const groupId = currentWaitingGroups[0].groupId;
          const choiceCmd = cmd === "1" ? "allow" : cmd === "2" ? "law" : cmd === "3" ? "deny" : "deny-law";
          let input: Record<string, unknown>;
          if (choiceCmd === "allow") {
            input = { command: "swarm_approve", groupId, issuedBy: config.actorId, reason: "console: allow once" };
          } else if (choiceCmd === "law") {
            input = { command: "swarm_approve", groupId, issuedBy: config.actorId, reason: "console: allow as law" };
          } else if (choiceCmd === "deny-law") {
            input = { command: "swarm_deny", groupId, deniedBy: config.actorId, reason: "console: deny as law", asLaw: true };
          } else {
            input = { command: "swarm_deny", groupId, deniedBy: config.actorId, reason: "console: deny once" };
          }
          const out = await boundary.sendBoundaryInterceptServerInput({
            target: interceptTarget,
            input: input as Parameters<typeof boundary.sendBoundaryInterceptServerInput>[0]["input"],
          });
          if (out.type === "error") {
            console.log(`  Error: ${out.error}`);
          } else {
            console.log(`  ${choiceCmd}: ${groupId} — done`);
            reportedGroupIds.delete(groupId);
          }
          rl.prompt();
          return;
        }

        if (cmd === "feed") {
          feedEnabled = !feedEnabled;
          console.log(`  Event feed: ${feedEnabled ? "on" : "off"}`);
          rl.prompt();
          return;
        }

        if (cmd === "status") {
          const sessionState = await boundary.loadBoundarySessionState({
            sessionId: config.sessionId,
            sessionsDir: home.sessionsDir,
          });
          const scopes = (sessionState?.pathLaws ?? []).filter((l: { revokedAt?: string }) => !l.revokedAt);
          const grants = (sessionState?.grants ?? []).filter((g: { revokedAt?: string }) => !g.revokedAt);
          console.log(``);
          console.log(`  Session:    ${config.sessionId}`);
          console.log(`  Status:     ${sessionState?.session.status ?? "missing"}`);
          console.log(`  Scopes:     ${scopes.length}`);
          console.log(`  Grants:     ${grants.length}`);
          console.log(`  Feed:       ${feedEnabled ? "on" : "off"}`);
          console.log(`  Pending:    ${currentWaitingGroups.length} group(s) waiting`);
          console.log(``);
          rl.prompt();
          return;
        }

        if (cmd === "logs") {
          const limit = arg1 ? Number(arg1) : 10;
          const records = await boundary.readBoundaryLedgerBySession(config.sessionId);
          const tail = records.slice(-limit);
          console.log(``);
          for (const record of tail) {
            printLogRecord(record);
          }
          console.log(``);
          rl.prompt();
          return;
        }

        if (cmd === "upl") {
          const upl = await boundary.loadUserPathLedger();
          const approved = (upl.userApprovedLawPaths ?? []).filter((l) => l.status === "ACTIVE");
          const denied = (upl.userDeniedLawPaths ?? []).filter((l) => l.status === "ACTIVE");
          console.log(``);
          console.log(`  UPL: ${approved.length} approved laws / ${denied.length} denied laws`);
          for (const law of approved.slice(-8)) {
            console.log(`  allow | ${law.id} | ${law.domain ?? "-"} | ${law.path}`);
          }
          for (const law of denied.slice(-5)) {
            console.log(`  deny  | ${law.id} | ${law.domain ?? "-"} | ${law.path}`);
          }
          console.log(``);
          rl.prompt();
          return;
        }

        if (cmd === "doctor") {
          await handleDoctor();
          rl.prompt();
          return;
        }

        if (cmd === "laws") {
          const sessionState = await boundary.loadBoundarySessionState({
            sessionId: config.sessionId,
            sessionsDir: home.sessionsDir,
          });
          const pathLaws = (sessionState?.pathLaws ?? []).filter(
            (l: { revokedAt?: string }) => !l.revokedAt,
          );
          console.log(``);
          console.log(`  Active scope laws — ${config.sessionId}`);
          console.log(`  ─────────────────────────────────────`);
          if (pathLaws.length === 0) {
            console.log(`  No active path laws.`);
          } else {
            for (const law of pathLaws) {
              const l = law as { lawId: string; rootPath: string; grantedActions: string[]; issuedBy: string };
              console.log(`  ${l.lawId}`);
              console.log(`    path:    ${l.rootPath}`);
              console.log(`    actions: ${l.grantedActions.join(", ")}`);
              console.log(`    issued:  ${l.issuedBy}`);
            }
          }
          console.log(``);
          rl.prompt();
          return;
        }

        if (cmd === "unblock") {
          if (!arg1) {
            console.log(``);
            if (blockedProvenances.size === 0) {
              console.log(`  No standing ingress blocks recorded this session.`);
            } else {
              console.log(`  Standing ingress blocks this session:`);
              for (const prov of blockedProvenances) {
                console.log(`    ${prov}`);
              }
              console.log(`  Use: unblock <provenance>`);
            }
            console.log(``);
            rl.prompt();
            return;
          }
          // Restart the intercept daemon — this clears all in-memory admission state
          // including standing density/velocity deny entries.
          try {
            await boundary.sendBoundaryInterceptServerInput({
              target: interceptTarget,
              input: { command: "restart", reason: `console: unblock ${arg1}` } as Parameters<typeof boundary.sendBoundaryInterceptServerInput>[0]["input"],
            });
            blockedProvenances.delete(arg1);
            console.log(`  Intercept restarted — admission state cleared for '${arg1}'.`);
          } catch {
            console.log(`  Intercept daemon unreachable. Run 'buccet hook start' first.`);
          }
          rl.prompt();
          return;
        }

        if (cmd === "nsl") {
          const indexArg = arg1 ? Number(arg1) : NaN;
          if (!isNaN(indexArg) && nslSuggestions.length > 0) {
            // User picked a move by index (1-based).
            const pick = nslSuggestions[indexArg - 1];
            if (!pick) {
              console.log(`  No NSL suggestion at index ${indexArg}. Use 'nsl' to list.`);
              rl.prompt();
              return;
            }
            // NSL move selection maps to the corresponding waiting swarm group.
            // Find a waiting group whose reason matches the suggestion.
            const match = currentWaitingGroups.find((g) => g.reason === pick.reason);
            if (match) {
              const out = await boundary.sendBoundaryInterceptServerInput({
                target: interceptTarget,
                input: { command: "swarm_approve", groupId: match.groupId, issuedBy: config.actorId, reason: `console: nsl pick ${indexArg}` },
              });
              if (out.type === "error") {
                console.log(`  Error: ${out.error}`);
              } else {
                nslSuggestions.splice(indexArg - 1, 1);
                reportedGroupIds.delete(match.groupId);
                console.log(`  NSL move ${indexArg} selected — ${pick.reason}`);
              }
            } else {
              console.log(`  No matching intercept group for NSL move ${indexArg}.`);
              console.log(`  Use allow/deny <group-id> if the group is still pending.`);
            }
            rl.prompt();
            return;
          }
          // Show pending NSL suggestions.
          console.log(``);
          if (nslSuggestions.length === 0) {
            console.log(`  No pending NSL move suggestions.`);
          } else {
            console.log(`  Pending NSL move suggestions:`);
            for (let i = 0; i < nslSuggestions.length; i++) {
              const s = nslSuggestions[i];
              console.log(`  [${i + 1}] ${s.reason}  (${s.timestamp})`);
            }
            console.log(`  Use: nsl <n>  to select a move`);
          }
          console.log(``);
          rl.prompt();
          return;
        }

        if (cmd === "allow" || cmd === "deny" || cmd === "law" || cmd === "deny-law") {
          if (!arg1) {
            console.log(`  Usage: ${cmd} <group-id>`);
            rl.prompt();
            return;
          }
          const groupId = arg1;
          let input: Record<string, unknown>;
          if (cmd === "allow") {
            input = { command: "swarm_approve", groupId, issuedBy: config.actorId, reason: "console: allow once" };
          } else if (cmd === "law") {
            input = { command: "swarm_approve", groupId, issuedBy: config.actorId, reason: "console: allow as law" };
          } else if (cmd === "deny-law") {
            input = { command: "swarm_deny", groupId, deniedBy: config.actorId, reason: "console: deny as law", asLaw: true };
          } else {
            input = { command: "swarm_deny", groupId, deniedBy: config.actorId, reason: "console: deny once" };
          }
          const out = await boundary.sendBoundaryInterceptServerInput({
            target: interceptTarget,
            input: input as Parameters<typeof boundary.sendBoundaryInterceptServerInput>[0]["input"],
          });
          if (out.type === "error") {
            console.log(`  Error: ${out.error}`);
          } else {
            console.log(`  ${cmd}: ${groupId} — done`);
            reportedGroupIds.delete(groupId);
          }
          rl.prompt();
          return;
        }

        console.log(`  Unknown command: ${cmd}. Type 'quit' to exit.`);
      } catch (error) {
        console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
      }
      rl.prompt();
    })();
  });

  rl.on("close", () => {
    clearInterval(pollHandle);
    process.exit(0);
  });

  // Keep alive until rl closes.
  await new Promise<void>((resolve) => {
    rl.on("close", resolve);
  });
}

// ─── main ──────────────────────────────────────────────────────────────────

async function main() {
  const parsed = parseGlobal(process.argv.slice(2));

  if (parsed.command === "init") {
    await handleInit(parsed.rest);
    return;
  }
  if (parsed.command === "console") {
    await handleConsole();
    return;
  }
  if (parsed.command === "doctor") {
    await handleDoctor();
    return;
  }
  if (parsed.command === "status") {
    await handleStatus(parsed.rest);
    return;
  }
  if (parsed.command === "logs") {
    await handleLogs(parsed.rest);
    return;
  }
  if (parsed.command === "scope") {
    await handleScope(parsed.rest);
    return;
  }
  if (parsed.command === "run") {
    await handleRun(parsed.rest);
    return;
  }
  if (parsed.command === "hook") {
    await handleHook(parsed.rest);
    return;
  }
  if (parsed.command === "swarm") {
    await handleSwarm(parsed.rest);
    return;
  }
  if (parsed.command === "uninstall") {
    await handleUninstall();
    return;
  }
  usage();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
