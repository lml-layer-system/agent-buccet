#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import type { BoundaryActionKind } from "../lib/lml/agent-boundary/index.ts";

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
    "  buccet run [--scope <path>] [--cwd <path>] [--session-id <id>] [--actor-id <id>] [--dry-run] -- <command> [args...]",
    "  buccet status [--json]",
    "  buccet logs [--limit <n>] [--json]",
    "  buccet scope add <path> [--actions <csv>]",
    "  buccet scope list [--json]",
    "  buccet uninstall",
  ].join("\n"));
  process.exit(1);
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
  return {
    homePath,
    configPath: path.join(homePath, "config.json"),
    sessionsDir: path.join(homePath, "data", "agent-boundary", "sessions"),
    launcherPath: process.env.AGENT_BUCCET_LAUNCHER_PATH ?? path.join(os.homedir(), ".local", "bin", "buccet"),
  };
}

async function importBoundary(homePath: string) {
  await ensureDir(homePath);
  process.chdir(homePath);
  return import("../lib/lml/agent-boundary/index.ts");
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

  console.log(`Agent Buccet initialized.`);
  console.log(`home: ${home.homePath}`);
  console.log(`session: ${nextConfig.sessionId}`);
  console.log(`actor: ${nextConfig.actorId}`);
  console.log(`scopes: ${nextConfig.defaultScopes.length}`);
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

async function main() {
  const parsed = parseGlobal(process.argv.slice(2));

  if (parsed.command === "init") {
    await handleInit(parsed.rest);
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
