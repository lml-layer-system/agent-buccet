#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import type {
  BoundaryActionKind,
  BoundaryRuntimeConfig,
  BuccetPathFormationState,
  BuccetPathMemorySnapshot,
  BuccetPathSource,
  BuccetPathTemplate,
  DocumentLawDiagnosticEntry,
  BoundarySession,
  BoundaryUplEntry,
  BoundaryUplEntryType,
  BoundaryUplScope,
  BoundaryUplStatus,
  BoundaryUserPathLedger,
  CompiledDocumentLaw,
} from "../lib/agent-buccet/index.ts";

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

type ConsoleApprovalMode = "interactive" | "standing_law";
type UplSourceLane = "acceptance" | "denial";

type UplSourceSpec = {
  lane: UplSourceLane;
  dir: string;
  readmePath: string;
};

type UplSyncLaneFiles = {
  spec: UplSourceSpec;
  files: string[];
};

type UplSyncResult = {
  scope: BoundaryUplScope;
  root: string;
  laneFiles: UplSyncLaneFiles[];
  imported: Array<{ lane: UplSourceLane; file: string; imported: number; entries: string[] }>;
  fingerprint: string;
};

type UplAutoSyncState = {
  fingerprint: string;
  syncedAt: string;
  fileCount: number;
};

type UplAcceptanceSourceCatalog = {
  id: "skillsmp" | "aitmpl" | "skillhub" | "agentskills";
  name: string;
  url: string;
  description: string;
};

type SourceIntakeDoc = {
  name: string;
  catalog: string;
  url: string;
  sourceText: string;
  mode: "template" | "raw_markdown";
};

type BuccetTransportManifest = {
  schemaVersion: 1;
  kind: "buccet_transport";
  name: string;
  createdAt: string;
  rootfsDir: "rootfs";
  workdir: string;
  entrypoint: string[];
  fileCount: number;
  portabilityChain: ["applyIsolation", "persistState", "enterEnvironment"];
};

type BuccetTransportPackResult = {
  artifactPath: string;
  manifest: BuccetTransportManifest;
  sourceDir: string;
  lawEntryCount?: number;
};

const TRANSPORT_LAW_FILE = "transport-law.json";

type TransportLawEntry = {
  uplEntry: BoundaryUplEntry;
  witnessHashes: string[];
  actionKinds: string[];
  targets: string[];
  witnessCount: number;
};

type TransportLawManifest = {
  schemaVersion: 1;
  kind: "buccet_transport_law";
  packedAt: string;
  entryCount: number;
  entries: TransportLawEntry[];
  allWitnessHashes: string[];
  integrityHash: string;
};

type BuccetTransportImportResult = {
  destinationDir: string;
  manifest: BuccetTransportManifest;
  rootfsPath: string;
};

type BuccetTransportRunResult = {
  artifactInput: string;
  manifest: BuccetTransportManifest;
  runtimeDir: string;
  launchCwd: string;
  command: string[];
  isolationActive: boolean;
  persistedState: boolean;
  enteredEnvironment: boolean;
  exitCode: number;
  cleanedUpRuntime: boolean;
};

type BuccetShedHistoryEntry = {
  eventType: "DISPOSABLE_SHED_TRIGGERED" | "DISPOSABLE_RESPAWNED";
  sessionId: string;
  actorId: string;
  requestId?: string;
  actionKind?: string;
  target?: string;
  reason?: string;
  createdAt: string;
  lawIds: string[];
  metadata: Record<string, unknown>;
};

type BuccetShedStatusPayload = {
  sessionId: string;
  shedCount: number;
  respawnCount: number;
  latest?: BuccetShedHistoryEntry;
  entries: BuccetShedHistoryEntry[];
};

type BuccetQuarantineEntry = {
  itemId: string;
  entryId: string;
  side: "approved" | "denied";
  path: string;
  pathHash: string;
  actionKind?: string;
  target?: string;
  verdict: "survivor" | "pit";
  reason: string;
  lawIds: string[];
  resolution: "pending" | "denied_as_law" | "survivor";
};

type BuccetQuarantineStatusPayload = {
  sessionId: string;
  required: boolean;
  status: string;
  triggeredAt?: string;
  reason?: string;
  total: number;
  processedItems: number;
  complete: boolean;
  survivors: number;
  pitCount: number;
  pendingCount: number;
  totalShards: number;
  completedShards: number;
  shardSize: number;
  workerCount: number;
  entries: BuccetQuarantineEntry[];
};

type ParsedUplSelection = {
  ids: string[];
  queryTerms: string[];
  includeAll: boolean;
  typeFilter: BoundaryUplEntryType | null;
  statusFilter: BoundaryUplStatus | null;
};

function parseConsoleApprovalModeToken(token: string | undefined): ConsoleApprovalMode | null {
  if (!token) {
    return null;
  }
  switch (token.trim().toLowerCase()) {
    case "interactive":
    case "live":
      return "interactive";
    case "standing-law":
    case "standing_law":
    case "no-questions":
    case "no_questions":
    case "24/7":
    case "24x7":
    case "headless":
      return "standing_law";
    default:
      return null;
  }
}

function formatConsoleApprovalMode(mode: ConsoleApprovalMode): string {
  return mode === "standing_law" ? "24/7 no-questions (standing law)" : "interactive";
}

function usage(): never {
  console.error([
    "Usage:",
    "  buccet init [--session-id <id>] [--actor-id <id>] [--scope <path>] [--dry-run] [--no-default-scope] [--arm-now]",
    "  buccet console                                            — open the unified operator cockpit (shield + control + witness)",
    "  buccet where [--json]                                     — show exactly where approved law, denied law, path sources, and scopes go",
    "  buccet doctor [--strict]                                  — health check: platform, backend, intercept, ledger",
    "  buccet run [--scope <path>] [--cwd <path>] [--session-id <id>] [--actor-id <id>] [--dry-run] -- <command> [args...]",
    "  buccet status [--json]",
    "  buccet logs [--limit <n>] [--json]",
    "  buccet ledger [--limit <n>] [--json] [--follow]          — optional split witness view",
    "  buccet scope add <path> [--actions <csv>]",
    "  buccet scope list [--json]",
    "  buccet upl list [--all] [--type approved|denied] [--status active|muted|deleted] [--search <query...>] [--json]",
    "  buccet upl search <query...> [--all] [--type approved|denied] [--status active|muted|deleted] [--json]",
    "  buccet upl show <upl-id> [--json]",
    "  buccet upl diff [--all] [--type approved|denied] [--status active|muted|deleted] [--search <query...>] [--json]",
    "  buccet upl mute <upl-id...> [--search <query...>] [--type approved|denied] [--status active|muted|deleted] [--json]",
    "  buccet upl unmute <upl-id...> [--search <query...>] [--type approved|denied] [--status active|muted|deleted] [--json]",
    "  buccet upl remove <upl-id...> [--search <query...>] [--type approved|denied] [--status active|muted|deleted] [--json]",
    "  buccet upl sources [--open <catalog|all>] [--json]       — show authored lanes plus external UPL intake catalogs",
    "  buccet upl import <file...> [--scope GLOBAL|SESSION] [--json]",
    "  buccet upl sync [--scope GLOBAL|SESSION] [--lane acceptance|denial] [--json]",
    "  buccet path list [--json]",
    "  buccet path show <path-name> [--json]",
    "  buccet path run <path-name> [--request <text>] [--domain <domain>] [--steps <n>|--all] [--fresh] [--json]",
    "  buccet path watch <path-name|formation-id> [--follow] [--interval-ms <n>] [--json]",
    "  buccet path formations list [--all-sessions] [--json]",
    "  buccet path close <path-name|formation-id> [--json]",
    "  buccet path sources add <path-name> <file...> [--domain <domain>] [--json]",
    "  buccet path sources list <path-name> [--json]",
    "  buccet transport pack <source-dir> [--output <artifact.buccet.tgz>] [--name <name>] [--workdir </path>] [--with-law] [--json] [-- <entrypoint> ...]",
    "  buccet transport export <source-dir> [--output <artifact.buccet.tgz>] [--name <name>] [--workdir </path>] [--with-law] [--json] [-- <entrypoint> ...]",
    "  buccet transport import <artifact.buccet.tgz> [--into <dir>] [--json]",
    "  buccet transport run <artifact-or-dir> [--into <runtime-dir>] [--unit-id <id>] [--json] [-- <command> ...]",
    "  buccet shed [--reason <text>] [--json]                  — deny-side shed and clean disposable respawn",
    "  buccet shed status [--limit <n>] [--json]               — recent shed / respawn witness history",
    "  buccet quarantine [status] [--limit <n>] [--json]       — shed reboot boundary-on-self status and caught set",
    "  buccet quarantine review [--json]                       — interactive first-screen deny flow for shed reboot quarantine",
    "  buccet quarantine deny-all [--json]                     — write all caught quarantine items into denial law",
    "  buccet quarantine deny <item-id...> [--json]            — write selected caught quarantine items into denial law",
    "  buccet hook build",
    "  buccet hook start",
    "  buccet hook status [--json] [--watch]                     — optional split shield / heartbeat view",
    "  buccet hook env [--json]",
    "  buccet hook run -- <command> [args...]",
    "  buccet hook stop",
    "  buccet swarm list [--json]",
    "  buccet swarm mode [interactive|standing-law] [--json]",
    "  buccet swarm approve <group-id> [--issued-by <id>] [--reason <text>] [--json]",
    "  buccet swarm deny <group-id> [--denied-by <id>] [--reason <text>] [--json]",
    "  buccet mcp [--session-id <id>] [--actor-id <id>] [--dry-run]      — start MCP server (JSON-RPC 2.0 over stdio, full boundary enforcement)",
    "  buccet mcp status                                                  — show MCP session, hook daemon state, and ledger location",
    "  buccet uninstall",
  "  buccet extract-laws <file.md> [--lane acceptance|denial] [--json]  — extract and inspect law directives from a markdown document",
  ].join("\n"));
  process.exit(1);
}

function currentScriptDir(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

function shortSocketPath(homePath: string, label: string): string {
  const digest = createHash("sha256").update(`${homePath}:${label}`).digest("hex").slice(0, 12);
  const socketRoot = os.tmpdir();
  return path.join(socketRoot, `buccet-${label}-${digest}.sock`);
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

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.map((entry) => path.resolve(entry)))];
}

// ─── Terminal display helpers ──────────────────────────────────────────────────
// Zero-dependency color/format. Disabled automatically when stdout is not a TTY
// or when NO_COLOR env var is set (https://no-color.org).

const isTTY = process.stdout.isTTY === true && !process.env.NO_COLOR;
const c = {
  reset:  isTTY ? "\x1b[0m"  : "",
  bold:   isTTY ? "\x1b[1m"  : "",
  dim:    isTTY ? "\x1b[2m"  : "",
  green:  isTTY ? "\x1b[32m" : "",
  red:    isTTY ? "\x1b[31m" : "",
  yellow: isTTY ? "\x1b[33m" : "",
  cyan:   isTTY ? "\x1b[36m" : "",
  blue:   isTTY ? "\x1b[34m" : "",
  blueBright: isTTY ? "\x1b[38;5;27m" : "",
};

function clrOk(text = ""): string   { return `${c.green}✓${c.reset}${text ? ` ${text}` : ""}`; }
function clrFail(text = ""): string { return `${c.red}✗${c.reset}${text ? ` ${text}` : ""}`; }
function clrWarn(text = ""): string { return `${c.yellow}⚠${c.reset}${text ? ` ${text}` : ""}`; }
function clrBold(text: string): string { return `${c.bold}${text}${c.reset}`; }
function clrDim(text: string): string  { return `${c.dim}${text}${c.reset}`; }

function printCliHeader(title: string, subtitle?: string): void {
  const bar = "━".repeat(Math.max(46, title.length + 6));
  console.log(``);
  console.log(`${c.bold}${c.cyan}  ${bar}${c.reset}`);
  console.log(`${c.bold}    ${title}${c.reset}`);
  console.log(`${c.cyan}  ${bar}${c.reset}`);
  if (subtitle) {
    console.log(`    ${clrDim(subtitle)}`);
  }
}

function printCliSection(title: string, rows: Array<string | null | undefined>): void {
  console.log(``);
  console.log(`  ${clrBold(title)}`);
  console.log(`  ${c.dim}${"─".repeat(Math.max(24, title.length + 2))}${c.reset}`);
  for (const row of rows) {
    if (!row) {
      continue;
    }
    console.log(`  ${row}`);
  }
}

function formatCliKeyValue(label: string, value: string | number | boolean | null | undefined): string {
  return `${clrDim(label.padEnd(18, " "))} ${String(value ?? "-")}`;
}

function printBuccetWordmark(): void {
  // Only render the wordmark when stdout is a real terminal.
  if (!isTTY) return;
  const B = c.blueBright + c.bold;
  const D = c.dim;
  const R = c.reset;
  console.log(``);
  console.log(`${B}  AGENT${R}`);
  console.log(`${B}  ██████╗ ██╗   ██╗ ██████╗ ██████╗███████╗████████╗${R}`);
  console.log(`${B}  ██╔══██╗██║   ██║██╔════╝██╔════╝██╔════╝╚══██╔══╝${R}`);
  console.log(`${B}  ██████╔╝██║   ██║██║     ██║     █████╗     ██║   ${R}`);
  console.log(`${B}  ██╔══██╗██║   ██║██║     ██║     ██╔══╝     ██║   ${R}`);
  console.log(`${B}  ██████╔╝╚██████╔╝╚██████╗╚██████╗███████╗   ██║   ${R}`);
  console.log(`${B}  ╚═════╝  ╚═════╝  ╚═════╝ ╚═════╝╚══════╝   ╚═╝   ${R}`);
  console.log(`  ${D}Building Ultimate Containment Constraints Every Time${R}`);
  console.log(``);
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

function fallbackBoundarySession(config: BuccetConfig): BoundarySession {
  return {
    sessionId: config.sessionId,
    actorId: config.actorId,
    createdAt: config.createdAt,
    dryRun: config.dryRun,
    persistent: true,
    status: "active",
  };
}

async function loadActiveBoundarySession(
  boundary: {
    loadBoundarySessionState: (args: { sessionId: string; sessionsDir?: string }) => Promise<{
      session: BoundarySession;
      sessionUpl?: BoundaryUserPathLedger;
      quarantineState?: { required: boolean; status: string };
    } | null>;
  },
  home: ReturnType<typeof resolveHomePaths>,
  config: BuccetConfig,
): Promise<BoundarySession> {
  const sessionState = await loadActiveBoundarySessionState(boundary, home, config);
  return sessionState?.session ?? fallbackBoundarySession(config);
}

async function loadActiveBoundarySessionState(
  boundary: {
    loadBoundarySessionState: (args: { sessionId: string; sessionsDir?: string }) => Promise<{
      session: BoundarySession;
      sessionUpl?: BoundaryUserPathLedger;
      quarantineState?: { required: boolean; status: string; triggeredAt?: string; reason?: string };
    } | null>;
  },
  home: ReturnType<typeof resolveHomePaths>,
  config: BuccetConfig,
): Promise<{
  session: BoundarySession;
  sessionUpl?: BoundaryUserPathLedger;
  quarantineState?: { required: boolean; status: string; triggeredAt?: string; reason?: string };
} | null> {
  const sessionState = await boundary.loadBoundarySessionState({
    sessionId: config.sessionId,
    sessionsDir: home.sessionsDir,
  });
  return sessionState;
}

async function loadEffectiveUserPathLedger(
  boundary: Awaited<ReturnType<typeof importBoundary>>,
  home: ReturnType<typeof resolveHomePaths>,
  config: BuccetConfig,
): Promise<BoundaryUserPathLedger> {
  const [ledger, sessionState] = await Promise.all([
    boundary.loadUserPathLedger(),
    loadActiveBoundarySessionState(boundary, home, config),
  ]);
  return sessionState?.sessionUpl
    ? boundary.mergeUserPathLedgers({
      baseLedger: ledger,
      overlayLedger: sessionState.sessionUpl,
    })
    : ledger;
}

async function buildEffectiveUserLawIds(
  boundary: Awaited<ReturnType<typeof importBoundary>>,
  config: BoundaryRuntimeConfig,
  upl: BoundaryUserPathLedger,
): Promise<string[]> {
  return boundary.buildActiveAgentBuccetLawIds({
    executableLaws: config.laws,
    existingLawIds: boundary.getActiveUserLawIds(upl, config.session),
    runtimeMuscle: config.runtimeMuscle,
  });
}

function resolveHomePaths(homePath: string) {
  const runDir = path.join(homePath, "run");
  const nativeDir = path.join(homePath, "native");
  const installedNativeSourceDir = path.join(homePath, "current", "native", "deep-intercept");
  const repoNativeSourceDir = path.resolve(currentScriptDir(), "..", "native", "deep-intercept");
  const nativeBuildDir = path.join(nativeDir, "build");
  const uplDocsDir = path.join(homePath, "upl-docs");
  const pathMemoryDir = path.join(homePath, "path-memory");
  const isMac = process.platform === "darwin";
  const nativeLibraryName = isMac ? "libbuccet-hook.dylib" : "libbuccet-hook.so";
  return {
    homePath,
    configPath: path.join(homePath, "config.json"),
    sessionsDir: path.join(homePath, "data", "agent-boundary", "sessions"),
    launcherPath: process.env.AGENT_BUCCET_LAUNCHER_PATH ?? path.join(os.homedir(), ".local", "bin", "buccet"),
    runDir,
    interceptSocketPath: shortSocketPath(homePath, "intercept"),
    gravityBridgeSocketPath: shortSocketPath(homePath, "gravity"),
    brainStatusPath: path.join(runDir, "brain-status.json"),
    hookPidPath: path.join(runDir, "hook-daemon.pid"),
    uplDocsDir,
    uplAcceptanceDocsDir: path.join(uplDocsDir, "acceptance"),
    uplDenialDocsDir: path.join(uplDocsDir, "denial"),
    uplAcceptancePipelinePath: path.join(uplDocsDir, "acceptance", "PIPELINE.txt"),
    uplAcceptanceSkillTemplatePath: path.join(uplDocsDir, "acceptance", "SKILL_INTAKE_TEMPLATE.txt"),
    uplAutoSyncStatePath: path.join(uplDocsDir, ".autosync-state.json"),
    pathMemoryDir,
    pathLibraryPath: path.join(pathMemoryDir, "library.json"),
    pathFormationSnapshotPath: path.join(pathMemoryDir, "formations.json"),
    installedNativeSourceDir,
    repoNativeSourceDir,
    nativeBuildDir,
    nativeLibraryPath: path.join(nativeBuildDir, nativeLibraryName),
    consoleHintsMutedPath: path.join(homePath, ".console-hints-muted"),
  };
}

function parseUplSourceLaneToken(token: string | undefined): UplSourceLane | null {
  if (!token) {
    return null;
  }
  switch (token.trim().toLowerCase()) {
    case "acceptance":
    case "accept":
    case "allow":
    case "approved":
      return "acceptance";
    case "denial":
    case "deny":
    case "denied":
    case "block":
      return "denial";
    default:
      return null;
  }
}

function uplSourceSpecs(home: ReturnType<typeof resolveHomePaths>): UplSourceSpec[] {
  return [
    {
      lane: "acceptance",
      dir: home.uplAcceptanceDocsDir,
      readmePath: path.join(home.uplAcceptanceDocsDir, "README.txt"),
    },
    {
      lane: "denial",
      dir: home.uplDenialDocsDir,
      readmePath: path.join(home.uplDenialDocsDir, "README.txt"),
    },
  ];
}

function acceptanceSourceCatalogs(): UplAcceptanceSourceCatalog[] {
  return [
    {
      id: "skillsmp",
      name: "SkillsMP",
      url: "https://skillsmp.com",
      description: "largest broad skill catalog",
    },
    {
      id: "aitmpl",
      name: "AITmpl Skills",
      url: "https://aitmpl.com/skills",
      description: "template and one-command install workflows",
    },
    {
      id: "skillhub",
      name: "SkillHub",
      url: "https://skillhub.club",
      description: "AI-rated skills and high-signal curation",
    },
    {
      id: "agentskills",
      name: "AgentSkills",
      url: "https://agentskills.io",
      description: "official spec and shape grounding",
    },
  ];
}

function normalizeCatalogToken(token: string): string {
  return token.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
}

function resolveSourceCatalogSelection(token: string): UplAcceptanceSourceCatalog[] {
  const normalized = normalizeCatalogToken(token);
  const catalogs = acceptanceSourceCatalogs();
  if (normalized === "all") {
    return catalogs;
  }
  const matched = catalogs.find((catalog) => (
    normalized === catalog.id
    || normalized === normalizeCatalogToken(catalog.name)
    || normalized === normalizeCatalogToken(catalog.url)
  ));
  if (!matched) {
    throw new Error(`unknown UPL source catalog: ${token}`);
  }
  return [matched];
}

function assertCatalogOpenUrl(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error(`refusing to open non-https catalog url: ${url}`);
  }
  const allowedHosts = new Set(acceptanceSourceCatalogs().map((catalog) => new URL(catalog.url).host));
  if (!allowedHosts.has(parsed.host)) {
    throw new Error(`refusing to open unknown catalog host: ${parsed.host}`);
  }
  return parsed;
}

async function openCatalogInBrowser(catalog: UplAcceptanceSourceCatalog): Promise<void> {
  const safeUrl = assertCatalogOpenUrl(catalog.url).toString();
  const capturePath = process.env.BUCCET_BROWSER_OPEN_CAPTURE_PATH;
  if (capturePath) {
    await ensureDir(path.dirname(capturePath));
    await fs.appendFile(capturePath, `${JSON.stringify({ id: catalog.id, url: safeUrl })}\n`, "utf8");
    return;
  }

  const launch = (command: string, args: string[]) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  };

  if (process.platform === "darwin") {
    launch("open", [safeUrl]);
    return;
  }
  if (process.platform === "win32") {
    launch("cmd", ["/c", "start", "", safeUrl]);
    return;
  }
  launch("xdg-open", [safeUrl]);
}

function acceptancePipelineCommands(home: ReturnType<typeof resolveHomePaths>) {
  const exampleDocPath = path.join(home.uplAcceptanceDocsDir, "my-skill.md");
  return {
    copyTemplate: `cp ${home.uplAcceptanceSkillTemplatePath} ${exampleDocPath}`,
    sync: "buccet upl sync --lane acceptance",
    inspectSearch: "buccet upl search my-skill",
    inspectDiff: "buccet upl diff --search my-skill",
    inspectShow: "buccet upl show <upl-id>",
  };
}

function buildWherePayload(home: ReturnType<typeof resolveHomePaths>) {
  const acceptanceCommands = acceptancePipelineCommands(home);
  return {
    home: home.homePath,
    operator: {
      initCommand: "buccet init",
      consoleCommand: "buccet console",
      doctorCommand: "buccet doctor --strict",
      mapCommand: "buccet where --json",
    },
    upl: {
      rootDir: home.uplDocsDir,
      acceptance: {
        dir: home.uplAcceptanceDocsDir,
        putHere: [
          "markdown law docs",
          "raw skill text",
          "SKILL.md",
          "README.md",
          "extracted package markdown",
        ],
        compileCommand: "buccet upl sync --lane acceptance",
        inspectCommands: [
          "buccet upl search <query>",
          "buccet upl diff --search <query>",
          "buccet upl show <upl-id>",
        ],
      },
      denial: {
        dir: home.uplDenialDocsDir,
        putHere: [
          "markdown law docs",
          "raw skill text",
          "SKILL.md",
          "README.md",
          "extracted package markdown",
        ],
        compileCommand: "buccet upl sync --lane denial",
        inspectCommands: [
          "buccet upl search <query> --type denied",
          "buccet upl diff --type denied --search <query>",
          "buccet upl show <upl-id>",
        ],
      },
      externalCatalogs: acceptanceSourceCatalogs().map((catalog) => ({
        id: catalog.id,
        name: catalog.name,
        url: catalog.url,
        openCommand: `buccet upl sources --open ${catalog.id}`,
      })),
      pipelineGuidePath: home.uplAcceptancePipelinePath,
      intakeTemplatePath: home.uplAcceptanceSkillTemplatePath,
      templateCopyCommand: acceptanceCommands.copyTemplate,
    },
    pathSources: {
      libraryPath: home.pathLibraryPath,
      addCommand: "buccet path sources add <path-name> <file...> [--domain <domain>]",
      listCommand: "buccet path sources list <path-name>",
      showCommand: "buccet path show <path-name>",
      note: "source files can live anywhere; Buccet ingests their content into the path as domain context",
    },
    scope: {
      addCommand: "buccet scope add <path>",
      listCommand: "buccet scope list",
    },
    pathRuntime: {
      runCommand: "buccet path run <path-name> [--request <text>] [--steps <n>|--all]",
      watchCommand: "buccet path watch <path-name|formation-id> [--follow]",
      formationsCommand: "buccet path formations list",
      closeCommand: "buccet path close <path-name|formation-id>",
    },
  };
}

function acceptancePipelineGuideText(home: ReturnType<typeof resolveHomePaths>): string {
  const catalogs = acceptanceSourceCatalogs();
  const commands = acceptancePipelineCommands(home);
  return [
    "Agent Buccet acceptance source pipeline",
    "",
      "Use this when you want to pull a skill or workflow from an external catalog into the UPL acceptance side.",
    "",
    "Source catalogs:",
    ...catalogs.map((catalog) => `- ${catalog.name} — ${catalog.url} — ${catalog.description} — open: buccet upl sources --open ${catalog.id}`),
    "",
    "Steps:",
    "1. Open one of the source catalogs above and choose the skill or workflow you want.",
    "2. Copy the raw source text, SKILL.md, README, or extracted package markdown you want.",
    "3. Put that raw material into a markdown file in this lane.",
    `   Template path (optional): ${home.uplAcceptanceSkillTemplatePath}`,
    `   Fast copy helper: ${commands.copyTemplate}`,
    "4. Compile it into the live UPL acceptance side:",
    `   ${commands.sync}`,
    "5. Inspect the result:",
    `   ${commands.inspectSearch}`,
    `   ${commands.inspectDiff}`,
    `   ${commands.inspectShow}`,
    "",
    "Rules:",
    "- Paste real source text, SKILL.md content, README content, or extracted package markdown.",
    "- Buccet parses raw source material into bounded yes-side UPL automatically.",
    "- If the file is already real authored UPL law, Buccet keeps using the strict authored-law parser first.",
      "- Put the same raw source material in the denial lane and sync denial to compile it into denied UPL instead.",
      "- Denial still overrides acceptance on overlap.",
    "- Repeat this process as long as you want. The source side stays open-ended; Buccet acceptance stays the finite compiled result.",
  ].join("\n");
}

function acceptanceSkillTemplateText(): string {
  return [
    "# <skill-or-workflow-name>",
    "",
    "Catalog: <SkillsMP | AITmpl Skills | SkillHub | AgentSkills>",
    "URL: <paste source URL here>",
    "",
    "## Source material",
    "Copied text:",
    "Paste the skill or workflow description here.",
    "",
    "Paste the raw source material only.",
    "This can be copied catalog text, SKILL.md content, README content, or extracted package markdown.",
    "Buccet acceptance intake will parse this into bounded yes-side UPL on `buccet upl sync --lane acceptance`.",
  ].join("\n");
}

function escapeRegexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function uniqueOrderedStrings(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    ordered.push(trimmed);
  }
  return ordered;
}

function inferSourceCatalog(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("skillsmp.com")) {
    return "SkillsMP";
  }
  if (lower.includes("aitmpl.com/skills")) {
    return "AITmpl Skills";
  }
  if (lower.includes("skillhub.club")) {
    return "SkillHub";
  }
  if (lower.includes("agentskills.io")) {
    return "AgentSkills";
  }
  return "UPL Source";
}

function extractUrlsFromText(text: string): string[] {
  return uniqueOrderedStrings(
    [...text.matchAll(/https?:\/\/[^\s)>"']+/gi)].map((match) => (
      match[0]?.replace(/[.,;:]+$/, "") ?? ""
    )),
  );
}

function inferSourceUrl(text: string, slug: string): string {
  return extractUrlsFromText(text)[0] ?? `upl-source://${slug}`;
}

function inferSourceName(markdown: string, filePath?: string): string {
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  if (headingMatch?.[1]?.trim()) {
    return headingMatch[1].trim();
  }
  const namedField = markdown.match(/^(?:name|title):\s*(.+)$/mi);
  if (namedField?.[1]?.trim()) {
    return namedField[1].trim();
  }
  if (filePath) {
    return path.basename(filePath, path.extname(filePath));
  }
  return "source-intake";
}

function looksLikeSourceMaterial(markdown: string): boolean {
  const lower = markdown.toLowerCase();
  if (!lower.trim()) {
    return false;
  }
  if (
    /^catalog:\s*.+$/mi.test(markdown)
    || /^url:\s*.+$/mi.test(markdown)
    || /^##\s+source material\s*$/mi.test(markdown)
  ) {
    return true;
  }
  if (
    /^##\s+(?:description|overview|usage|examples|capabilities|features|tools|installation|when to use|how to use)\s*$/mi.test(markdown)
    || /```[\s\S]*?```/.test(markdown)
    || /https?:\/\//i.test(markdown)
  ) {
    return true;
  }
  return false;
}

function extractCommandTargets(text: string): string[] {
  const snippets = [
    ...[...text.matchAll(/```[\w-]*\n([\s\S]*?)```/g)].map((match) => match[1] ?? ""),
    ...[...text.matchAll(/`([^`\n]+)`/g)].map((match) => match[1] ?? ""),
  ];
  const commandCandidates = new Set<string>();
  const lines = snippets
    .flatMap((snippet) => snippet.split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const normalized = line.replace(/^\$\s*/, "").trim();
    if (!normalized || normalized.startsWith("#")) {
      continue;
    }
    const first = normalized.split(/\s+/)[0] ?? "";
    const command = path.basename(first).replace(/[^\w.-].*$/, "");
    if (!command) {
      continue;
    }
    if (/^(?:https?:|cat|echo|cd|ls|pwd|export|set|env)$/i.test(command)) {
      continue;
    }
    if (/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(command)) {
      commandCandidates.add(command.toLowerCase());
    }
  }

  for (const known of [
    "firecrawl",
    "playwright",
    "n8n",
    "mcp",
    "fastmcp",
    "ollama",
    "python",
    "node",
    "npm",
    "pnpm",
    "yarn",
    "git",
    "rg",
    "pytest",
    "tsc",
    "docker",
  ]) {
    if (new RegExp(`\\b${escapeRegexLiteral(known)}\\b`, "i").test(text)) {
      commandCandidates.add(known);
    }
  }

  return [...commandCandidates];
}

function normalizeNetworkOrigin(value: string): string | null {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (["skillsmp.com", "aitmpl.com", "skillhub.club", "agentskills.io"].includes(url.hostname)) {
      return null;
    }
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function extractNetworkTargets(text: string): string[] {
  return uniqueOrderedStrings(
    extractUrlsFromText(text)
      .map((value) => normalizeNetworkOrigin(value))
      .filter(Boolean) as string[],
  );
}

function extractNamedTargets(args: {
  actionKind: BoundaryActionKind;
  text: string;
  slug: string;
}): string[] {
  const lower = args.text.toLowerCase();
  const channelTargets = [
    "slack",
    "discord",
    "telegram",
    "whatsapp",
    "beeper",
    "rocketchat",
    "email",
    "mail",
    "bluebubbles",
    "imsg",
    "voice-call",
  ];
  const dataTargets = [
    "notion",
    "obsidian",
    "trello",
    "asana",
    "google-calendar",
    "google-sheets",
    "google-workspace",
    "apple-notes",
    "apple-reminders",
    "joplin",
    "bookstack",
  ];
  const configTargets = [
    "mcp",
    "plugin",
    "connector",
    "workspace",
    "google-workspace",
    "playwright",
  ];
  if (args.actionKind === "tool.exec") {
    return uniqueOrderedStrings([...extractCommandTargets(args.text), args.slug]);
  }
  if (args.actionKind === "network.send") {
    return uniqueOrderedStrings([
      ...extractNetworkTargets(args.text),
      ...channelTargets.filter((target) => lower.includes(target)),
      ...dataTargets.filter((target) => lower.includes(target)),
      args.slug,
    ]);
  }
  if (args.actionKind === "comm.send") {
    return uniqueOrderedStrings([
      ...channelTargets.filter((target) => lower.includes(target)),
      args.slug,
    ]);
  }
  if (args.actionKind.startsWith("db.")) {
    return uniqueOrderedStrings([
      ...dataTargets.filter((target) => lower.includes(target)),
      args.slug,
    ]);
  }
  if (args.actionKind.startsWith("sys.")) {
    return uniqueOrderedStrings([
      ...configTargets.filter((target) => lower.includes(target)),
      args.slug,
    ]);
  }
  return [args.slug];
}

function slugifyAcceptanceSourceName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "source-intake";
}

function parseSourceIntakeDoc(markdown: string, filePath?: string): SourceIntakeDoc | null {
  const trimmed = markdown.trim();
  const titleMatch = trimmed.match(/^#\s+(.+)$/m);
  const catalogMatch = trimmed.match(/^Catalog:\s*(.+)$/mi);
  const urlMatch = trimmed.match(/^URL:\s*(.+)$/mi);
  const sourceSectionMatch = trimmed.match(/(?:^##\s+Source material\s*$)([\s\S]+)$/mi);
  if (titleMatch && catalogMatch && urlMatch && sourceSectionMatch) {
    let sourceText = sourceSectionMatch[1]
      .replace(/^Copied text:\s*/mi, "")
      .trim();
    sourceText = sourceText
      .replace(/^Paste the skill or workflow description here\.\s*$/mi, "")
      .replace(/^Paste the raw source material only\.\s*$/mi, "")
      .replace(/^Buccet acceptance intake will parse this into bounded yes-side UPL on `buccet upl sync --lane acceptance`\.\s*$/mi, "")
      .trim();

    if (!sourceText) {
      return null;
    }

    return {
      name: titleMatch[1].trim(),
      catalog: catalogMatch[1].trim(),
      url: urlMatch[1].trim(),
      sourceText,
      mode: "template",
    };
  }

  if (!looksLikeSourceMaterial(trimmed)) {
    return null;
  }

  const inferredName = inferSourceName(trimmed, filePath);
  const slug = slugifyAcceptanceSourceName(inferredName);
  const inferredUrl = inferSourceUrl(trimmed, slug);
  return {
    name: inferredName,
    catalog: inferSourceCatalog(`${inferredUrl}\n${trimmed}`),
    url: inferredUrl,
    sourceText: trimmed,
    mode: "raw_markdown",
  };
}

function inferSourceIntakeActionKinds(text: string): BoundaryActionKind[] {
  const lower = text.toLowerCase();
  const kinds = new Set<BoundaryActionKind>();

  if (/\b(pdf|docx|pptx|xlsx|word|excel|slide|document|docs|markdown|report|file|read|write|edit|merge|split|form)\b/.test(lower)) {
    kinds.add("fs.read");
    kinds.add("fs.write");
    kinds.add("fs.append");
  }
  if (/\b(notes|obsidian|notion|vault|memory|tasks|calendar|contact|knowledge|database|sql|query|sheet|spreadsheet|analytics)\b/.test(lower)) {
    kinds.add("db.query");
    kinds.add("db.update");
  }
  if (/\b(browser|playwright|crawl|search|research|fetch|extract|web|http|api|scrape|crawl|map)\b/.test(lower)) {
    kinds.add("network.send");
  }
  if (/```[\s\S]*?```/.test(text) || /\b(debug|test|build|exec|run|tool|cli|automation|agent|workflow|pipeline|code|mcp|server|developer|design|artifact|generate|render|bash|shell|npm|pnpm|yarn|node|python|cargo|go|make|docker|playwright|firecrawl)\b/.test(lower)) {
    kinds.add("tool.exec");
  }
  if (/\b(email|mail|slack|discord|telegram|whatsapp|message|chat|social|seo|marketing|brand|content)\b/.test(lower)) {
    kinds.add("chat.emit");
    kinds.add("comm.send");
  }
  if (/\b(config|settings|workspace|integration|plugin|connector)\b/.test(lower)) {
    kinds.add("sys.config.read");
    kinds.add("sys.config.write");
  }

  if (kinds.size === 0) {
    kinds.add("tool.exec");
  }

  return [...kinds];
}

function compileSourceIntakeDoc(args: {
  filePath: string;
  lane: UplSourceLane;
  doc: SourceIntakeDoc;
  scope: BoundaryUplScope;
}): CompiledDocumentLaw[] {
  const slug = slugifyAcceptanceSourceName(args.doc.name);
  const inferredKinds = inferSourceIntakeActionKinds([
    args.doc.name,
    args.doc.catalog,
    args.doc.url,
    args.doc.sourceText,
  ].join("\n"));
  const summary = args.doc.sourceText
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
  const namePattern = escapeRegexLiteral(args.doc.name.trim()).replace(/\s+/g, "\\s+");
  const slugPattern = escapeRegexLiteral(slug).replace(/-/g, "[-\\s]?");
  const aliasPatterns = uniqueOrderedStrings([
    `/\\b(?:${slugPattern}|${namePattern})\\b/i`,
    ...extractCommandTargets(args.doc.sourceText).map((value) => `/\\b${escapeRegexLiteral(value)}\\b/i`),
    ...extractNamedTargets({ actionKind: "comm.send", text: args.doc.sourceText, slug }).map((value) => `/\\b${escapeRegexLiteral(value)}\\b/i`),
  ]);
  const notes = formatUplSourceNote({
    lane: args.lane,
    filePath: args.filePath,
    notes: `[${args.lane}-source-intake] mode=${args.doc.mode} catalog=${args.doc.catalog} url=${args.doc.url} name=${args.doc.name}`,
  });
  const type: BoundaryUplEntryType = args.lane === "acceptance" ? "APPROVED" : "DENIED";
  const payloadPrefix = `${args.lane}-source-intake`;

  const normalizedKinds = uniqueOrderedStrings(
    inferredKinds
      .filter((kind) => !kind.startsWith("fs."))
      .concat(inferredKinds.every((kind) => kind.startsWith("fs.")) ? ["tool.exec"] : []),
  ) as BoundaryActionKind[];

  const entries: CompiledDocumentLaw[] = [];
  const seen = new Set<string>();
  for (const actionKind of normalizedKinds) {
    const targets = extractNamedTargets({
      actionKind,
      text: [args.doc.name, args.doc.url, args.doc.sourceText].join("\n"),
      slug,
    });
    for (const target of targets) {
      const signature = `${actionKind}::${target}`;
      if (seen.has(signature)) {
        continue;
      }
      seen.add(signature);
      const targetPatterns = actionKind === "network.send" && /^https?:\/\//i.test(target)
        ? [`/^${escapeRegexLiteral(target)}(?:\\/.*)?$/i`]
        : [target];
      const targetMatchMode = actionKind === "network.send" && /^https?:\/\//i.test(target)
        ? "regex"
        : "exact";
      entries.push({
        type,
        scope: args.scope,
        notes,
        requestBasis: {
          actionKind,
          target,
          payloadSummary: `${payloadPrefix}:${args.doc.catalog}:${slug}:${actionKind}:${target}`,
          provenance: "trusted_system",
          reviewContext: {
            surface: actionKind === "chat.emit" ? "chat" : "action",
            title: `${args.doc.name} source intake`,
            evidence: [args.doc.url],
          },
        },
        trackConstraint: {
          allowedActionKinds: [actionKind],
          ...(actionKind === "chat.emit"
            ? {}
            : {
                targetPatterns,
                targetMatchMode,
              }),
          requestTextPatterns: aliasPatterns,
          description: `${args.doc.name} — sourced from ${args.doc.catalog}; ${summary || "bounded source intake"}`,
        },
      });
    }
  }

  if (entries.length === 0) {
    entries.push({
      type,
      scope: args.scope,
      notes,
      requestBasis: {
        actionKind: "tool.exec",
        target: slug,
        payloadSummary: `${payloadPrefix}:${args.doc.catalog}:${slug}:tool.exec:${slug}`,
        provenance: "trusted_system",
        reviewContext: {
          surface: "action",
          title: `${args.doc.name} source intake`,
          evidence: [args.doc.url],
        },
      },
      trackConstraint: {
        allowedActionKinds: ["tool.exec"],
        targetPatterns: [slug],
        targetMatchMode: "exact",
        requestTextPatterns: aliasPatterns,
        description: `${args.doc.name} — sourced from ${args.doc.catalog}; ${summary || "bounded source intake"}`,
      },
    });
  }

  return entries;
}

function uplLaneTag(lane: UplSourceLane): string {
  return `[upl-doc-lane:${lane}]`;
}

function formatUplSourceNote(args: {
  lane: UplSourceLane;
  filePath: string;
  notes?: string | null;
}): string {
  const base = `${uplLaneTag(args.lane)} source=${args.filePath}`;
  return args.notes ? `${base} | ${args.notes}` : base;
}

function laneMatchesType(lane: UplSourceLane, type: BoundaryUplEntryType): boolean {
  return lane === "acceptance" ? type === "APPROVED" : type === "DENIED";
}

function isIgnorableDocumentDiagnostic(diagnostic: DocumentLawDiagnosticEntry): boolean {
  return diagnostic.skipReason === "duplicate directive (same signature as earlier block)";
}

function validateExtractedDocumentLane(args: {
  lane?: UplSourceLane;
  filePath: string;
  compiled: CompiledDocumentLaw[];
  diagnostics: DocumentLawDiagnosticEntry[];
}): void {
  const fatalDiagnostics = args.diagnostics.filter((diagnostic) => (
    !diagnostic.compiled && !isIgnorableDocumentDiagnostic(diagnostic)
  ));
  if (fatalDiagnostics.length > 0) {
    const detail = fatalDiagnostics
      .slice(0, 3)
      .map((diagnostic) => {
        const location = diagnostic.startLine === diagnostic.endLine
          ? `line ${diagnostic.startLine}`
          : `lines ${diagnostic.startLine}-${diagnostic.endLine}`;
        return `${location}: ${diagnostic.skipReason ?? "unsupported law block"}`;
      })
      .join("; ");
    throw new Error(
      `${args.filePath} contains ${fatalDiagnostics.length} unsupported or unsnappable law block(s). Buccet refuses partial import. Inspect it with \`buccet extract-laws ${args.filePath}\`. ${detail}`,
    );
  }
  if (args.compiled.length === 0) {
    throw new Error(
      `${args.filePath} did not compile into any${args.lane ? ` ${args.lane}` : ""} law. Rewrite it into supported law shapes or inspect it with \`buccet extract-laws ${args.filePath}\`.`,
    );
  }
  const mismatched = args.lane
    ? args.compiled.filter((entry) => !laneMatchesType(args.lane!, entry.type))
    : [];
  if (args.lane && mismatched.length > 0) {
    const wrongSide = args.lane === "acceptance" ? "denied" : "approved";
    throw new Error(
      `${args.filePath} compiled ${mismatched.length} ${wrongSide} law block(s) in the ${args.lane} lane. Move the document to the other lane or rewrite it. Buccet will not coerce lane polarity.`,
    );
  }
}

async function ensureUplSourceHomes(home: ReturnType<typeof resolveHomePaths>): Promise<void> {
  await ensureDir(home.uplDocsDir);
  for (const spec of uplSourceSpecs(home)) {
    await ensureDir(spec.dir);
    if (!(await pathExists(spec.readmePath))) {
      const content = spec.lane === "acceptance"
        ? [
            "Agent Buccet UPL document source — acceptance lane",
            "",
            "Put markdown law docs here when you want them to compile into approved UPL law.",
            "These docs become open-road segments in the live UPL field.",
            "",
            "Rules:",
            "- Supported files: .md and .markdown",
            "- README.md and other markdown source files are allowed in this lane",
            "- The parser is strict and fail-closed",
            "- If a document compiles into denied law here, sync refuses it",
            "- Raw source intake works here too: copied skill text, SKILL.md, README.md, or extracted package markdown will compile into approved UPL in this lane",
            "- For external skill catalogs, use PIPELINE.txt and SKILL_INTAKE_TEMPLATE.txt in this lane",
            "",
            "Useful commands:",
            "- buccet extract-laws <file.md> --lane acceptance",
            "- buccet upl sync",
            "- buccet upl sources --open <catalog>",
            "",
            "External intake catalogs:",
            ...acceptanceSourceCatalogs().map((catalog) => `- ${catalog.name}: ${catalog.url}`),
          ].join("\n")
        : [
            "Agent Buccet UPL document source — denial lane",
            "",
            "Put markdown law docs here when you want them to compile into denied UPL law.",
            "These docs become wall segments in the live UPL field.",
            "",
            "Rules:",
            "- Supported files: .md and .markdown",
            "- README.md and other markdown source files are allowed in this lane",
            "- The parser is strict and fail-closed",
            "- If a document compiles into approved law here, sync refuses it",
            "- Raw source intake works here too: copied skill text, SKILL.md, README.md, or extracted package markdown will compile into denied UPL in this lane",
            "",
            "Useful commands:",
            "- buccet extract-laws <file.md> --lane denial",
            "- buccet upl sync",
            "- buccet upl sources --open <catalog>",
          ].join("\n");
      await fs.writeFile(spec.readmePath, `${content}\n`, "utf8");
    }
  }
  if (!(await pathExists(home.uplAcceptancePipelinePath))) {
    await fs.writeFile(home.uplAcceptancePipelinePath, `${acceptancePipelineGuideText(home)}\n`, "utf8");
  }
  if (!(await pathExists(home.uplAcceptanceSkillTemplatePath))) {
    await fs.writeFile(home.uplAcceptanceSkillTemplatePath, `${acceptanceSkillTemplateText()}\n`, "utf8");
  }
  const rootReadmePath = path.join(home.uplDocsDir, "README.txt");
  if (!(await pathExists(rootReadmePath))) {
    await fs.writeFile(rootReadmePath, [
      "Agent Buccet UPL document sources",
      "",
      "Author law separately for humans:",
      `- acceptance: ${home.uplAcceptanceDocsDir}`,
      `- denial: ${home.uplDenialDocsDir}`,
      "",
      "At runtime Buccet compiles both sides into one live UPL field.",
      "Acceptance creates road. Denial creates wall. Denial wins on overlap.",
      "",
      `Acceptance source pipeline: ${home.uplAcceptancePipelinePath}`,
      `Acceptance intake template: ${home.uplAcceptanceSkillTemplatePath}`,
      "",
      "Run `buccet where` for the full add-map.",
      "",
      "Use `buccet upl sync` to compile both lanes into the active UPL.",
    ].join("\n") + "\n", "utf8");
  }
}

async function ensurePathMemoryHome(home: ReturnType<typeof resolveHomePaths>): Promise<void> {
  await ensureDir(home.pathMemoryDir);
  const readmePath = path.join(home.pathMemoryDir, "README.txt");
  if (!(await pathExists(readmePath))) {
    await fs.writeFile(readmePath, [
      "Agent Buccet Path Memory",
      "",
      "This folder stores the persisted Buccet path library.",
      "Path sources enrich a path with domain context.",
      "They do not change UPL and they do not widen permissions.",
      "Run `buccet where` for the full add-map.",
      "",
      "Useful commands:",
      "- buccet path list",
      "- buccet path show <path-name>",
      "- buccet path run <path-name>",
      "- buccet path watch <path-name|formation-id>",
      "- buccet path formations list",
      "- buccet path close <path-name|formation-id>",
      "- buccet path sources add <path-name> <file...>",
      "- buccet path sources list <path-name>",
    ].join("\n") + "\n", "utf8");
  }
}

async function handleWhere(rest: string[]) {
  const asJson = rest.includes("--json");
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  await ensureUplSourceHomes(home);
  await ensurePathMemoryHome(home);

  const payload = buildWherePayload(home);
  if (asJson) {
    printJson(payload);
    return;
  }

  printCliHeader("Agent Buccet — Where To Add What");
  printCliSection("Start Here", [
    formatCliKeyValue("init", payload.operator.initCommand),
    formatCliKeyValue("console", payload.operator.consoleCommand),
    formatCliKeyValue("health", payload.operator.doctorCommand),
  ]);
  printCliSection("Approved UPL (yes side)", [
    formatCliKeyValue("folder", payload.upl.acceptance.dir),
    formatCliKeyValue("put here", payload.upl.acceptance.putHere.join(" | ")),
    formatCliKeyValue("compile", payload.upl.acceptance.compileCommand),
    formatCliKeyValue("inspect", payload.upl.acceptance.inspectCommands.join(" | ")),
  ]);
  printCliSection("Denied UPL (no side)", [
    formatCliKeyValue("folder", payload.upl.denial.dir),
    formatCliKeyValue("put here", payload.upl.denial.putHere.join(" | ")),
    formatCliKeyValue("compile", payload.upl.denial.compileCommand),
    formatCliKeyValue("inspect", payload.upl.denial.inspectCommands.join(" | ")),
  ]);
  printCliSection("External Yes-Side Intake", [
    formatCliKeyValue("guide", payload.upl.pipelineGuidePath),
    formatCliKeyValue("template", payload.upl.intakeTemplatePath),
    formatCliKeyValue("copy template", payload.upl.templateCopyCommand),
    ...payload.upl.externalCatalogs.map((catalog) =>
      formatCliKeyValue(catalog.name, `${catalog.url} | open: ${catalog.openCommand}`)),
  ]);
  printCliSection("Path Sources (domain context)", [
    formatCliKeyValue("add", payload.pathSources.addCommand),
    formatCliKeyValue("list", payload.pathSources.listCommand),
    formatCliKeyValue("show", payload.pathSources.showCommand),
    formatCliKeyValue("persists in", payload.pathSources.libraryPath),
    payload.pathSources.note,
  ]);
  printCliSection("Scopes", [
    formatCliKeyValue("open scope", payload.scope.addCommand),
    formatCliKeyValue("list scopes", payload.scope.listCommand),
  ]);
  printCliSection("Run Paths", [
    formatCliKeyValue("run", payload.pathRuntime.runCommand),
    formatCliKeyValue("watch", payload.pathRuntime.watchCommand),
    formatCliKeyValue("formations", payload.pathRuntime.formationsCommand),
    formatCliKeyValue("close", payload.pathRuntime.closeCommand),
  ]);
}

async function loadPersistedBuccetPathLibrary(
  boundary: Awaited<ReturnType<typeof importBoundary>>,
  home: ReturnType<typeof resolveHomePaths>,
): Promise<Record<string, BuccetPathTemplate>> {
  await ensurePathMemoryHome(home);
  return await boundary.loadBuccetPathLibrary(home.pathLibraryPath) ?? boundary.createDefaultBuccetPathLibrary();
}

async function savePersistedBuccetPathLibrary(
  boundary: Awaited<ReturnType<typeof importBoundary>>,
  home: ReturnType<typeof resolveHomePaths>,
  library: Record<string, BuccetPathTemplate>,
): Promise<void> {
  await ensurePathMemoryHome(home);
  await boundary.saveBuccetPathLibrary(home.pathLibraryPath, library);
}

async function loadPersistedBuccetPathMemoryStore(
  boundary: Awaited<ReturnType<typeof importBoundary>>,
  home: ReturnType<typeof resolveHomePaths>,
) {
  await ensurePathMemoryHome(home);
  const store = new boundary.BuccetPathMemoryStore();
  const snapshot = await boundary.loadBuccetPathMemorySnapshot(home.pathFormationSnapshotPath);
  if (snapshot) {
    store.replace(snapshot);
  }
  return store;
}

async function savePersistedBuccetPathMemoryStore(
  boundary: Awaited<ReturnType<typeof importBoundary>>,
  home: ReturnType<typeof resolveHomePaths>,
  store: { snapshot(): BuccetPathMemorySnapshot },
): Promise<void> {
  await ensurePathMemoryHome(home);
  await boundary.saveBuccetPathMemorySnapshot(home.pathFormationSnapshotPath, store.snapshot());
}

function isTerminalPathFormation(state: BuccetPathFormationState): boolean {
  return state.status === "COMPLETED" || state.status === "BLOCKED" || state.status === "FAILED";
}

function collectRuntimePathTargets(entry: BoundaryUplEntry): string[] {
  const constraint = entry.trackConstraint;
  const targets = [
    ...(constraint?.targetPatterns ?? []),
    ...(constraint?.targetPattern ? [constraint.targetPattern] : []),
  ].filter((value): value is string => Boolean(value));
  if (targets.length > 0) {
    return targets;
  }
  return entry.requestBasis?.target ? [entry.requestBasis.target] : [];
}

async function resolveRuntimeBuccetPathUplBindings(
  boundary: Awaited<ReturnType<typeof importBoundary>>,
  home: ReturnType<typeof resolveHomePaths>,
  config: BuccetConfig,
): Promise<Array<{ actionKinds: BoundaryActionKind[]; targets?: string[]; notes?: string }>> {
  const session = await loadActiveBoundarySession(boundary, home, config);
  const ledger = await loadEffectiveUserPathLedger(boundary, home, config);
  const allowTrackSegments = boundary
    .compileLiveUplTrackField({ ledger, session })
    .filter((segment) => segment.polarity === "allow");
  const allowSegments = (allowTrackSegments.length > 0
    ? allowTrackSegments
    : boundary.compileLiveUplField({ ledger, session }).filter((segment) => segment.polarity === "allow"));
  const actionKinds = [...new Set(allowSegments.flatMap((segment) => (
    segment.entry.trackConstraint?.allowedActionKinds
      ?? (segment.entry.requestBasis?.actionKind ? [segment.entry.requestBasis.actionKind] : [])
  )))].sort();
  const targets = [...new Set(allowSegments.flatMap((segment) => collectRuntimePathTargets(segment.entry)))].sort();
  return [{
    actionKinds,
    ...(targets.length > 0 ? { targets } : {}),
    ...(actionKinds.length === 0 && targets.length === 0
      ? { notes: "no active approved UPL surface" }
      : { notes: "resolved from live approved UPL" }),
  }];
}

async function ensureConcreteBuccetPathTemplate(args: {
  boundary: Awaited<ReturnType<typeof importBoundary>>;
  home: ReturnType<typeof resolveHomePaths>;
  config: BuccetConfig;
  library: Record<string, BuccetPathTemplate>;
  pathName: string;
  userRequest: string;
  domain?: string;
}): Promise<BuccetPathTemplate> {
  const existing = args.boundary.getBuccetPathTemplate(args.library, args.pathName);
  const resolvedBindings = await resolveRuntimeBuccetPathUplBindings(args.boundary, args.home, args.config);
  if (!existing) {
    const created = args.boundary.createBuccetPathTemplate({
      pathName: args.pathName,
      userRequest: args.userRequest,
      draft: {
        ...(args.domain ? { domain: args.domain } : {}),
        uplBindings: resolvedBindings,
      },
    }) as BuccetPathTemplate;
    args.library[args.pathName] = created;
    return created;
  }
  if (!args.boundary.buccetPathTemplateNeedsLawfulSurfaceMaterialization(existing)) {
    return existing;
  }
  const materialized = args.boundary.materializeBuccetPathTemplateLawfulSurface({
    template: existing,
    uplBindings: resolvedBindings,
  }) as BuccetPathTemplate;
  args.library[args.pathName] = materialized;
  return materialized;
}

function formatPathStageOutput(state: BuccetPathFormationState): string {
  const stage = state.stages[state.currentStageIndex];
  if (!stage) {
    return `${state.pathName} is complete.`;
  }
  const agents = state.agentRoster
    .filter((agent) => stage.agentIds.includes(agent.id))
    .map((agent) => agent.title);
  const sources = state.pathSources
    .filter((source) => (stage.sourceIds ?? []).length > 0
      ? (stage.sourceIds ?? []).includes(source.id)
      : state.agentRoster
        .filter((agent) => stage.agentIds.includes(agent.id))
        .some((agent) => (agent.memoryBank.sourceIds ?? []).includes(source.id)))
    .map((source) => source.title);
  const lawfulActionKinds = [...new Set([
    ...(stage.uplBindings ?? []).flatMap((binding) => binding.actionKinds),
    ...state.agentRoster
      .filter((agent) => stage.agentIds.includes(agent.id))
      .flatMap((agent) => agent.uplBindings.flatMap((binding) => binding.actionKinds)),
  ])];
  const lawfulTargets = [...new Set([
    ...(stage.uplBindings ?? []).flatMap((binding) => binding.targets ?? []),
    ...state.agentRoster
      .filter((agent) => stage.agentIds.includes(agent.id))
      .flatMap((agent) => agent.uplBindings.flatMap((binding) => binding.targets ?? [])),
  ])];
  return [
    `Stage ${stage.title} advanced.`,
    `Purpose: ${stage.purpose}`,
    `Owners: ${agents.join(", ") || "none"}`,
    `Sources: ${sources.join(", ") || "none"}`,
    `Lawful action kinds: ${lawfulActionKinds.join(", ") || "runtime_resolved"}`,
    `Lawful targets: ${lawfulTargets.join(", ") || "runtime_resolved"}`,
  ].join(" ");
}

function advanceFormationStep(
  boundary: Awaited<ReturnType<typeof importBoundary>>,
  state: BuccetPathFormationState,
): BuccetPathFormationState {
  const stage = boundary.getCurrentBuccetStage(state) as typeof state.stages[number] | null;
  if (!stage) {
    return state;
  }
  const activeAgents = boundary.getCurrentBuccetStageAgents(state) as Array<{ id: string; title: string; memoryBank: { sourceTitles: string[] } }>;
  const sourceTitles = [...new Set(activeAgents.flatMap((agent) => agent.memoryBank.sourceTitles))];
  const output = {
    last_stage_id: stage.id,
    last_stage_title: stage.title,
    last_stage_position: stage.position,
    last_stage_summary: formatPathStageOutput(state),
    last_stage_agents: activeAgents.map((agent) => agent.title),
    last_stage_sources: sourceTitles,
    [`stage_${stage.id}_completed`]: true,
    [`stage_${stage.id}_summary`]: formatPathStageOutput(state),
    ...(stage.terminal ? {
      final_output: `${state.title} completed for request: ${state.userRequest}`,
      final_stage_id: stage.id,
    } : {}),
  };
  return boundary.advanceBuccetFormation({
    state,
    result: stage.terminal ? "complete" : "success",
    output,
    reason: `${stage.id} advanced by Buccet path runtime`,
  }) as BuccetPathFormationState;
}

function resolveFormationSelector(args: {
  store: {
    get(id: string): BuccetPathFormationState | null;
    findBySessionAndPath(sessionId: string, pathName: string): BuccetPathFormationState | null;
  };
  selector: string;
  sessionId: string;
}): BuccetPathFormationState | null {
  const byId = args.store.get(args.selector);
  if (byId) {
    return byId;
  }
  const byPath = args.store.findBySessionAndPath(args.sessionId, args.selector);
  if (byPath) {
    return byPath;
  }
  return null;
}

const PATH_SOURCE_SUPPORTED_EXTENSIONS = new Set([
  ".md", ".markdown", ".txt", ".json", ".yaml", ".yml",
  ".csv", ".html", ".htm", ".ts", ".tsx", ".js", ".jsx", ".py",
]);

const PATH_SOURCE_SKIP_DIRS = new Set([
  ".git", ".obsidian", ".trash", "node_modules", ".next",
  ".cache", "dist", "build", "__pycache__", ".venv", "venv",
]);

async function collectPathSourceFiles(inputs: string[]): Promise<string[]> {
  const collected = new Set<string>();
  const visit = async (targetPath: string) => {
    const resolved = path.resolve(targetPath);
    const stat = await fs.stat(resolved).catch(() => null);
    if (!stat) {
      return;
    }
    if (stat.isDirectory()) {
      const dirName = path.basename(resolved);
      if (dirName.startsWith(".") || PATH_SOURCE_SKIP_DIRS.has(dirName)) {
        return;
      }
      const entries = await fs.readdir(resolved, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        await visit(path.join(resolved, entry.name));
      }
      return;
    }
    if (stat.isFile()) {
      const ext = path.extname(resolved).toLowerCase();
      if (!PATH_SOURCE_SUPPORTED_EXTENSIONS.has(ext)) {
        return;
      }
      collected.add(resolved);
    }
  };
  for (const input of inputs) {
    await visit(input);
  }
  return [...collected].sort((left, right) => left.localeCompare(right));
}

function slugifyPathSourceId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "path-source";
}

function inferPathSourceKind(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".md":
    case ".markdown":
      return "markdown";
    case ".txt":
      return "text";
    case ".json":
      return "json";
    case ".yaml":
    case ".yml":
      return "yaml";
    case ".csv":
      return "csv";
    case ".html":
    case ".htm":
      return "html";
    case ".ts":
    case ".tsx":
    case ".js":
    case ".jsx":
    case ".py":
      return "code";
    default:
      return extension.replace(/^\./, "") || "document";
  }
}

function inferPathSourceTitle(filePath: string, content: string): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) {
    return heading;
  }
  return path.basename(filePath, path.extname(filePath));
}

function summarizePathSourceContent(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 180);
}

function assertPathSourceTextContent(filePath: string, content: string): void {
  if (content.includes("\u0000")) {
    throw new Error(`path source is binary or unsupported text encoding: ${filePath}`);
  }
}

async function compilePathSourcesFromFiles(args: {
  filePaths: string[];
}): Promise<BuccetPathSource[]> {
  const sources: BuccetPathSource[] = [];
  for (const filePath of args.filePaths) {
    const content = await fs.readFile(filePath, "utf8").catch(() => null);
    if (content === null) {
      continue;
    }
    if (content.includes("\u0000")) {
      continue;
    }
    if (content.trim().length === 0) {
      continue;
    }
    const title = inferPathSourceTitle(filePath, content);
    sources.push({
      id: slugifyPathSourceId(path.basename(filePath, path.extname(filePath))),
      title,
      kind: inferPathSourceKind(filePath),
      content,
      summary: summarizePathSourceContent(content),
      sourceUri: filePath,
      tags: [inferPathSourceKind(filePath)],
    });
  }
  return sources;
}

const BUCCET_TRANSPORT_MANIFEST = "buccet-transport.json";

function normalizeTransportWorkdir(raw: string | undefined): string {
  const normalized = (raw ?? "/").trim();
  if (!normalized || normalized === ".") {
    return "/";
  }
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function defaultTransportArtifactPath(sourceDir: string): string {
  const base = path.basename(path.resolve(sourceDir)).replace(/[^a-zA-Z0-9._-]+/g, "-") || "artifact";
  return path.join(resolveCallerCwd(), `${base}.buccet.tgz`);
}

function defaultTransportImportDir(artifactPath: string): string {
  const base = path.basename(path.resolve(artifactPath))
    .replace(/\.buccet\.tgz$/i, "")
    .replace(/\.tar\.gz$/i, "")
    .replace(/\.tgz$/i, "")
    || "artifact";
  return path.join(resolveCallerCwd(), base);
}

function transportManifestPath(rootDir: string): string {
  return path.join(rootDir, BUCCET_TRANSPORT_MANIFEST);
}

function isTransportArchive(targetPath: string): boolean {
  return /\.(?:buccet\.tgz|tar\.gz|tgz)$/i.test(targetPath);
}

const DEFAULT_TRANSPORT_IGNORED_DIRECTORIES = new Set([
  ".git",
  "node_modules",
  "dist",
  ".next",
  ".cache",
  ".turbo",
  ".parcel-cache",
  ".svelte-kit",
  "coverage",
  "tmp",
  "temp",
  ".vscode",
  ".idea",
  ".aws",
  ".ssh",
  "secrets",
  "credentials",
]);

const DEFAULT_TRANSPORT_IGNORED_FILES = new Set([
  ".env",
  ".DS_Store",
  "Thumbs.db",
  ".buccetignore",
]);

const DEFAULT_TRANSPORT_IGNORED_BASENAME_PATTERNS = [
  /^\.env\..+$/,
  /^.*\.log$/i,
  /^.*\.(?:tmp|temp|swp|swo|pid)$/i,
  /^.*\.(?:pem|key|p12|pfx)$/i,
];

type TransportIgnoreRule = {
  raw: string;
  dirOnly: boolean;
  matchBasename: boolean;
  regex: RegExp;
};

function escapeTransportPattern(pattern: string): string {
  return pattern.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function compileTransportIgnoreRule(rawPattern: string): TransportIgnoreRule | null {
  const trimmed = rawPattern.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("!")) {
    return null;
  }

  const dirOnly = trimmed.endsWith("/");
  let normalized = trimmed.replace(/\/+$/g, "");
  const anchored = normalized.startsWith("/");
  if (anchored) {
    normalized = normalized.replace(/^\/+/, "");
  }
  if (!normalized) {
    return null;
  }

  const matchBasename = !normalized.includes("/");
  const source = escapeTransportPattern(normalized)
    .replace(/\\\*\\\*/g, ".*")
    .replace(/\\\*/g, "[^/]*")
    .replace(/\\\?/g, "[^/]");
  const regex = matchBasename
    ? new RegExp(`^${source}$`)
    : anchored
      ? new RegExp(`^${source}$`)
      : new RegExp(`(?:^|/)${source}$`);

  return {
    raw: trimmed,
    dirOnly,
    matchBasename,
    regex,
  };
}

async function loadTransportIgnoreRules(sourceDir: string): Promise<TransportIgnoreRule[]> {
  const ignorePath = path.join(sourceDir, ".buccetignore");
  const raw = await fs.readFile(ignorePath, "utf8").catch(() => null);
  if (!raw) {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map((line) => compileTransportIgnoreRule(line))
    .filter((rule): rule is TransportIgnoreRule => rule !== null);
}

function shouldIgnoreTransportEntry(args: {
  relativePath: string;
  isDirectory: boolean;
  userRules: TransportIgnoreRule[];
}): boolean {
  const relativePath = args.relativePath.split(path.sep).join("/");
  if (!relativePath || relativePath === ".") {
    return false;
  }

  const basename = path.posix.basename(relativePath);
  if (args.isDirectory && DEFAULT_TRANSPORT_IGNORED_DIRECTORIES.has(basename)) {
    return true;
  }
  if (DEFAULT_TRANSPORT_IGNORED_FILES.has(basename)) {
    return true;
  }
  if (DEFAULT_TRANSPORT_IGNORED_BASENAME_PATTERNS.some((pattern) => pattern.test(basename))) {
    return true;
  }

  return args.userRules.some((rule) => {
    if (rule.dirOnly && !args.isDirectory) {
      return false;
    }
    return rule.matchBasename
      ? rule.regex.test(basename)
      : rule.regex.test(relativePath);
  });
}

async function copyTransportSourceFiltered(args: {
  sourceDir: string;
  destinationDir: string;
}): Promise<void> {
  const userRules = await loadTransportIgnoreRules(args.sourceDir);
  await fs.cp(args.sourceDir, args.destinationDir, {
    recursive: true,
    filter: async (sourcePath) => {
      if (sourcePath === args.sourceDir) {
        return true;
      }
      const relativePath = path.relative(args.sourceDir, sourcePath);
      const stats = await fs.lstat(sourcePath);
      return !shouldIgnoreTransportEntry({
        relativePath,
        isDirectory: stats.isDirectory(),
        userRules,
      });
    },
  });
}

async function countFilesRecursively(rootDir: string): Promise<number> {
  const stats = await fs.stat(rootDir);
  if (!stats.isDirectory()) {
    return 1;
  }
  let count = 0;
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const child = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      count += await countFilesRecursively(child);
      continue;
    }
    if (entry.isFile() || entry.isSymbolicLink()) {
      count += 1;
    }
  }
  return count;
}

async function ensureDirectoryMissingOrEmpty(targetDir: string): Promise<void> {
  const exists = await pathExists(targetDir);
  if (!exists) {
    return;
  }
  const entries = await fs.readdir(targetDir);
  if (entries.length > 0) {
    throw new Error(`destination directory must be empty: ${targetDir}`);
  }
}

async function tarCreate(args: {
  sourceDir: string;
  outputPath: string;
}): Promise<void> {
  await ensureDir(path.dirname(args.outputPath));
  const result = await runSubprocess({
    command: "tar",
    args: ["-czf", args.outputPath, "-C", args.sourceDir, "."],
  });
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || `tar create failed for ${args.outputPath}`);
  }
}

async function tarExtract(args: {
  artifactPath: string;
  destinationDir: string;
}): Promise<void> {
  await ensureDir(args.destinationDir);
  const result = await runSubprocess({
    command: "tar",
    args: ["-xzf", args.artifactPath, "-C", args.destinationDir],
  });
  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || `tar extract failed for ${args.artifactPath}`);
  }
}

async function loadTransportManifest(rootDir: string): Promise<BuccetTransportManifest> {
  const manifest = await readJsonIfExists<BuccetTransportManifest>(transportManifestPath(rootDir));
  if (!manifest || manifest.kind !== "buccet_transport" || manifest.schemaVersion !== 1) {
    throw new Error(`invalid Buccet transport manifest in ${rootDir}`);
  }
  if (manifest.rootfsDir !== "rootfs") {
    throw new Error(`unsupported transport rootfs layout in ${rootDir}`);
  }
  return manifest;
}

function resolveTransportLaunchCwd(rootfsPath: string, workdir: string): string {
  const relative = workdir === "/" ? "." : workdir.replace(/^\/+/, "");
  const launchCwd = path.resolve(rootfsPath, relative);
  const relativeToRoot = path.relative(rootfsPath, launchCwd);
  if (relativeToRoot.startsWith("..") || path.isAbsolute(relativeToRoot)) {
    throw new Error(`transport workdir escapes packaged rootfs: ${workdir}`);
  }
  return launchCwd;
}

function assertInsideRootfs(rootfsPath: string, candidatePath: string, label: string): void {
  const relative = path.relative(rootfsPath, candidatePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes packaged rootfs: ${candidatePath}`);
  }
}

function transportSearchRoots(rootfsPath: string, launchCwd: string): string[] {
  return uniquePaths([
    launchCwd,
    path.join(rootfsPath, "bin"),
    path.join(rootfsPath, "usr", "bin"),
    path.join(rootfsPath, "usr", "local", "bin"),
  ]);
}

async function resolveTransportExecutable(args: {
  rootfsPath: string;
  launchCwd: string;
  command: string;
}): Promise<string> {
  const { rootfsPath, launchCwd, command } = args;
  const hasPathSyntax = command.includes("/") || command.includes(path.sep);

  if (hasPathSyntax) {
    const resolved = command.startsWith("/")
      ? path.resolve(rootfsPath, `.${command}`)
      : path.resolve(launchCwd, command);
    assertInsideRootfs(rootfsPath, resolved, "transport command");
    const stats = await fs.stat(resolved).catch(() => null);
    if (!stats?.isFile()) {
      throw new Error(`transport command not found inside packaged rootfs: ${command}`);
    }
    return resolved;
  }

  for (const searchRoot of transportSearchRoots(rootfsPath, launchCwd)) {
    const candidate = path.join(searchRoot, command);
    assertInsideRootfs(rootfsPath, candidate, "transport command");
    const stats = await fs.stat(candidate).catch(() => null);
    if (stats?.isFile()) {
      return candidate;
    }
  }

  throw new Error(`transport command is not packaged inside the artifact: ${command}`);
}

function computeTransportLawIntegrityHash(entries: TransportLawEntry[]): string {
  const canonical = JSON.stringify(
    [...entries]
      .sort((a, b) => a.uplEntry.pathHash.localeCompare(b.uplEntry.pathHash))
      .map((e) => ({
        pathHash: e.uplEntry.pathHash,
        type: e.uplEntry.type,
        path: e.uplEntry.path,
        witnessHashes: [...e.witnessHashes].sort(),
      })),
  );
  return createHash("sha256").update(canonical).digest("hex");
}

async function buildTransportLawManifest(
  boundary: Awaited<ReturnType<typeof importBoundary>>,
): Promise<TransportLawManifest> {
  const [records, upl] = await Promise.all([
    boundary.readAllBoundaryLedgerRecords(),
    boundary.loadUserPathLedger(),
  ]);

  const witnessedByLaw = new Map<string, {
    hashes: string[];
    actionKinds: Set<string>;
    targets: Set<string>;
  }>();

  for (const record of records) {
    if (
      record.META.event_type !== "ACTION_EXECUTED"
      || record.DECISION.verdict !== "ALLOW"
      || !record.DECISION.law_triggered
    ) {
      continue;
    }
    const lawId = record.DECISION.law_triggered;
    if (!witnessedByLaw.has(lawId)) {
      witnessedByLaw.set(lawId, { hashes: [], actionKinds: new Set(), targets: new Set() });
    }
    const w = witnessedByLaw.get(lawId)!;
    w.hashes.push(record.META.hash);
    if (record.INPUT.action) w.actionKinds.add(record.INPUT.action);
    if (record.INPUT.target) w.targets.add(record.INPUT.target);
  }

  const allUplEntries = boundary.listUserPathEntries(upl);
  const entries: TransportLawEntry[] = [];

  for (const [lawId, witnesses] of witnessedByLaw) {
    const uplEntry = allUplEntries.find((e) => e.id === lawId && e.status === "ACTIVE");
    if (!uplEntry) continue;
    entries.push({
      uplEntry,
      witnessHashes: witnesses.hashes,
      actionKinds: [...witnesses.actionKinds],
      targets: [...witnesses.targets],
      witnessCount: witnesses.hashes.length,
    });
  }

  const allWitnessHashes = [...new Set(entries.flatMap((e) => e.witnessHashes))];
  const integrityHash = computeTransportLawIntegrityHash(entries);

  return {
    schemaVersion: 1,
    kind: "buccet_transport_law",
    packedAt: new Date().toISOString(),
    entryCount: entries.length,
    entries,
    allWitnessHashes,
    integrityHash,
  };
}

function verifyTransportLawManifest(manifest: TransportLawManifest): { ok: boolean; reason?: string } {
  if (manifest.kind !== "buccet_transport_law" || manifest.schemaVersion !== 1) {
    return { ok: false, reason: "invalid transport law manifest schema" };
  }
  if (manifest.entries.length !== manifest.entryCount) {
    return { ok: false, reason: "transport law entry count mismatch" };
  }
  const expectedHash = computeTransportLawIntegrityHash(manifest.entries);
  if (expectedHash !== manifest.integrityHash) {
    return { ok: false, reason: "transport law integrity check failed — manifest may have been tampered" };
  }
  return { ok: true };
}

type TransportLawSecurityWarning = {
  entryIndex: number;
  level: "warn" | "critical";
  message: string;
};

function scanTransportLawSecurity(manifest: TransportLawManifest): TransportLawSecurityWarning[] {
  const warnings: TransportLawSecurityWarning[] = [];
  for (let i = 0; i < manifest.entries.length; i += 1) {
    const { uplEntry, witnessCount } = manifest.entries[i];
    const p = uplEntry.path;
    if (p === "/**" || p === "**" || p === "*") {
      warnings.push({ entryIndex: i, level: "critical", message: "global wildcard — covers entire filesystem" });
    } else if (p.includes("**")) {
      warnings.push({ entryIndex: i, level: "warn", message: "broad wildcard (**) covers all descendants" });
    }
    if (witnessCount === 0) {
      warnings.push({ entryIndex: i, level: "critical", message: "no ledger witnesses — entry was never actually exercised on sender machine" });
    }
  }
  return warnings;
}

async function promptTransportLawApproval(
  manifest: TransportLawManifest,
  artifactName: string,
): Promise<boolean> {
  const warnings = scanTransportLawSecurity(manifest);
  const criticals = warnings.filter((w) => w.level === "critical");

  process.stdout.write(`\nBuccet transport law — artifact: ${artifactName}\n`);
  process.stdout.write(`${manifest.entryCount} law ${manifest.entryCount === 1 ? "entry" : "entries"} bundled by sender\n\n`);

  for (let i = 0; i < manifest.entries.length; i += 1) {
    const { uplEntry, actionKinds, witnessCount } = manifest.entries[i];
    const typeLabel = uplEntry.type === "APPROVED" ? "ALLOW" : "DENY ";
    const entryWarnings = warnings.filter((w) => w.entryIndex === i);
    process.stdout.write(`  [${i + 1}] ${typeLabel}  ${uplEntry.path}\n`);
    process.stdout.write(`       witnessed: ${witnessCount}x | actions: ${actionKinds.join(", ") || "unknown"} | scope: ${uplEntry.scope}\n`);
    if (uplEntry.notes) {
      process.stdout.write(`       notes: ${uplEntry.notes}\n`);
    }
    for (const w of entryWarnings) {
      const icon = w.level === "critical" ? "✖" : "⚠";
      process.stdout.write(`       ${icon}  ${w.message}\n`);
    }
    process.stdout.write("\n");
  }

  if (criticals.length > 0) {
    process.stdout.write(`  ${criticals.length} critical security issue${criticals.length === 1 ? "" : "s"} detected above.\n\n`);
  } else if (warnings.length > 0) {
    process.stdout.write(`  ${warnings.length} security warning${warnings.length === 1 ? "" : "s"} flagged above.\n\n`);
  }

  process.stdout.write("These entries will be written to your GLOBAL UPL before the agent runs.\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question("Approve all and run? [y/N] ", (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });

  return answer.toLowerCase() === "y";
}

async function importTransportLawEntries(
  boundary: Awaited<ReturnType<typeof importBoundary>>,
  manifest: TransportLawManifest,
): Promise<number> {
  const currentUpl = await boundary.loadUserPathLedger();
  const existing = boundary.listUserPathEntries(currentUpl);
  let nextUpl = currentUpl;
  let importedCount = 0;

  for (const { uplEntry, witnessHashes } of manifest.entries) {
    const alreadyExists = existing.some(
      (e) => e.pathHash === uplEntry.pathHash && e.type === uplEntry.type && e.status === "ACTIVE",
    );
    if (alreadyExists) continue;

    const importedEntry: BoundaryUplEntry = {
      ...uplEntry,
      id: `transport-import-${Date.now()}-${importedCount}`,
      scope: "GLOBAL",
      notes: uplEntry.notes ? `[transport-import] ${uplEntry.notes}` : "[transport-import]",
      witness: witnessHashes[0] ?? uplEntry.witness,
      modifiedAt: new Date().toISOString(),
    };

    if (uplEntry.type === "APPROVED") {
      nextUpl = { ...nextUpl, userApprovedLawPaths: [...nextUpl.userApprovedLawPaths, importedEntry] };
    } else {
      nextUpl = { ...nextUpl, userDeniedLawPaths: [...nextUpl.userDeniedLawPaths, importedEntry] };
    }
    importedCount += 1;
  }

  if (importedCount > 0) {
    await boundary.saveUserPathLedger(nextUpl);
  }
  return importedCount;
}

async function packBuccetTransportArtifact(args: {
  sourceDir: string;
  outputPath: string;
  name?: string;
  workdir?: string;
  entrypoint?: string[];
  withLaw?: boolean;
  boundary?: Awaited<ReturnType<typeof importBoundary>>;
}): Promise<BuccetTransportPackResult> {
  const sourceDir = path.resolve(args.sourceDir);
  const sourceStats = await fs.stat(sourceDir).catch(() => null);
  if (!sourceStats?.isDirectory()) {
    throw new Error(`transport source directory not found: ${sourceDir}`);
  }

  const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-transport-pack-"));
  const stagingRootfs = path.join(stagingDir, "rootfs");
  try {
    await copyTransportSourceFiltered({
      sourceDir,
      destinationDir: stagingRootfs,
    });
    const manifest: BuccetTransportManifest = {
      schemaVersion: 1,
      kind: "buccet_transport",
      name: (args.name?.trim() || path.basename(sourceDir)).trim(),
      createdAt: new Date().toISOString(),
      rootfsDir: "rootfs",
      workdir: normalizeTransportWorkdir(args.workdir),
      entrypoint: args.entrypoint ?? [],
      fileCount: await countFilesRecursively(stagingRootfs),
      portabilityChain: ["applyIsolation", "persistState", "enterEnvironment"],
    };
    await fs.writeFile(transportManifestPath(stagingDir), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    let lawEntryCount: number | undefined;
    if (args.withLaw && args.boundary) {
      const lawManifest = await buildTransportLawManifest(args.boundary);
      await fs.writeFile(
        path.join(stagingDir, TRANSPORT_LAW_FILE),
        `${JSON.stringify(lawManifest, null, 2)}\n`,
        "utf8",
      );
      lawEntryCount = lawManifest.entryCount;
    }

    const artifactPath = path.resolve(args.outputPath);
    await tarCreate({
      sourceDir: stagingDir,
      outputPath: artifactPath,
    });
    return {
      artifactPath,
      manifest,
      sourceDir,
      lawEntryCount,
    };
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function importBuccetTransportArtifact(args: {
  artifactPath: string;
  destinationDir: string;
}): Promise<BuccetTransportImportResult> {
  const artifactPath = path.resolve(args.artifactPath);
  if (!isTransportArchive(artifactPath)) {
    throw new Error(`transport artifact must be a .buccet.tgz or .tar.gz file: ${artifactPath}`);
  }
  const exists = await pathExists(artifactPath);
  if (!exists) {
    throw new Error(`transport artifact not found: ${artifactPath}`);
  }

  const destinationDir = path.resolve(args.destinationDir);
  await ensureDirectoryMissingOrEmpty(destinationDir);
  await tarExtract({
    artifactPath,
    destinationDir,
  });

  const manifest = await loadTransportManifest(destinationDir);
  const rootfsPath = path.join(destinationDir, manifest.rootfsDir);
  const rootfsExists = await pathExists(rootfsPath);
  if (!rootfsExists) {
    throw new Error(`transport artifact missing packaged rootfs: ${rootfsPath}`);
  }
  return {
    destinationDir,
    manifest,
    rootfsPath,
  };
}

async function runBuccetTransport(args: {
  artifactOrDir: string;
  runtimeDir?: string;
  unitId: string;
  command?: string[];
}): Promise<BuccetTransportRunResult> {
  const artifactInput = path.resolve(args.artifactOrDir);
  const runtimeProvided = Boolean(args.runtimeDir);
  const runtimeDir = path.resolve(
    args.runtimeDir
      ?? await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-transport-run-")),
  );
  const transportRoot = isTransportArchive(artifactInput)
    ? runtimeDir
    : artifactInput;

  if (isTransportArchive(artifactInput)) {
    await ensureDirectoryMissingOrEmpty(runtimeDir);
    await tarExtract({
      artifactPath: artifactInput,
      destinationDir: runtimeDir,
    });
  }

  const manifest = await loadTransportManifest(transportRoot);
  const rootfsPath = path.join(transportRoot, manifest.rootfsDir);
  const rootfsStats = await fs.stat(rootfsPath).catch(() => null);
  if (!rootfsStats?.isDirectory()) {
    throw new Error(`transport rootfs missing: ${rootfsPath}`);
  }

  const homePath = resolveHome();
  const boundary = await importBoundary(homePath);

  // Law approval — must happen before substrate init so recipient controls what runs
  const lawFilePath = path.join(transportRoot, TRANSPORT_LAW_FILE);
  const lawFileExists = await pathExists(lawFilePath);
  if (lawFileExists) {
    const rawLaw = await fs.readFile(lawFilePath, "utf8");
    const lawManifest = JSON.parse(rawLaw) as TransportLawManifest;
    const verification = verifyTransportLawManifest(lawManifest);
    if (!verification.ok) {
      throw new Error(`transport law rejected: ${verification.reason}`);
    }
    if (lawManifest.entryCount > 0) {
      const approved = await promptTransportLawApproval(lawManifest, manifest.name);
      if (!approved) {
        process.stdout.write("transport run cancelled — law not approved.\n");
        process.exitCode = 1;
        return {
          artifactInput,
          manifest,
          runtimeDir,
          launchCwd: resolveTransportLaunchCwd(path.join(transportRoot, manifest.rootfsDir), manifest.workdir),
          command: [],
          isolationActive: false,
          persistedState: false,
          enteredEnvironment: false,
          exitCode: 1,
          cleanedUpRuntime: false,
        };
      }
      const importedCount = await importTransportLawEntries(boundary, lawManifest);
      process.stdout.write(`transport law: imported ${importedCount} new ${importedCount === 1 ? "entry" : "entries"} into your GLOBAL UPL.\n`);
    }
  }

  await boundary.substrate.init();

  const substrateStateDir = path.join(runtimeDir, ".buccet-substrate");
  const upperDir = path.join(substrateStateDir, "upper");
  const workDir = path.join(substrateStateDir, "work");
  const mergedDir = path.join(substrateStateDir, "merged");
  await ensureDir(substrateStateDir);

  const isolation = boundary.substrate.applyIsolation(args.unitId, {
    namespace_flags: 0x64020000,
  });
  const persistedState = boundary.substrate.persistState(args.unitId, {
    lower: rootfsPath,
    upper: upperDir,
    work: workDir,
    merged: mergedDir,
  });
  const enteredEnvironment = boundary.substrate.enterEnvironment(args.unitId, {
    rootfs: rootfsPath,
    workdir: manifest.workdir,
    merged_dir: mergedDir,
  });

  const command = args.command && args.command.length > 0
    ? args.command
    : manifest.entrypoint;
  if (command.length === 0) {
    throw new Error("transport artifact has no entrypoint. Pass an override command after `--`.");
  }

  const launchCwd = resolveTransportLaunchCwd(rootfsPath, manifest.workdir);
  const resolvedCommand = await resolveTransportExecutable({
    rootfsPath,
    launchCwd,
    command: command[0],
  });
  const child = spawn(resolvedCommand, command.slice(1), {
    cwd: launchCwd,
    env: {
      ...process.env,
      BUCCET_TRANSPORT_ROOTFS: rootfsPath,
      BUCCET_TRANSPORT_RUNTIME: runtimeDir,
      BUCCET_TRANSPORT_NAME: manifest.name,
      PATH: transportSearchRoots(rootfsPath, launchCwd).join(path.delimiter),
    },
    stdio: "inherit",
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });

  const cleanedUpRuntime = !runtimeProvided && isTransportArchive(artifactInput);
  if (cleanedUpRuntime) {
    await fs.rm(runtimeDir, { recursive: true, force: true }).catch(() => undefined);
  }

  return {
    artifactInput,
    manifest,
    runtimeDir,
    launchCwd,
    command: [resolvedCommand, ...command.slice(1)],
    isolationActive: isolation.active,
    persistedState,
    enteredEnvironment,
    exitCode,
    cleanedUpRuntime,
  };
}

async function listLaneMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await listLaneMarkdownFiles(absolutePath));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!/\.(md|markdown)$/i.test(entry.name)) {
      continue;
    }
    results.push(absolutePath);
  }
  return results.sort((left, right) => left.localeCompare(right));
}

async function collectUplSyncLaneFiles(home: ReturnType<typeof resolveHomePaths>): Promise<UplSyncLaneFiles[]> {
  return await Promise.all(
    uplSourceSpecs(home).map(async (spec) => ({
      spec,
      files: await listLaneMarkdownFiles(spec.dir),
    })),
  );
}

async function computeUplSyncFingerprint(lanes: UplSyncLaneFiles[]): Promise<string> {
  const digest = createHash("sha256");
  for (const lane of lanes) {
    digest.update(`${lane.spec.lane}\n`);
    for (const filePath of lane.files) {
      const stats = await fs.stat(filePath);
      digest.update(`${filePath}\n${stats.size}\n${Math.floor(stats.mtimeMs)}\n`);
    }
  }
  return digest.digest("hex");
}

async function loadUplAutoSyncState(statePath: string): Promise<UplAutoSyncState | null> {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    return JSON.parse(raw) as UplAutoSyncState;
  } catch {
    return null;
  }
}

async function saveUplAutoSyncState(statePath: string, state: UplAutoSyncState): Promise<void> {
  await ensureDir(path.dirname(statePath));
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function muteLaneSourcedEntries(args: {
  ledger: BoundaryUserPathLedger;
  lane: UplSourceLane;
  scope: BoundaryUplScope;
  session: BoundarySession;
  modifiedAt: string;
}): BoundaryUserPathLedger {
  const tag = uplLaneTag(args.lane);
  const shouldMute = (entry: BoundaryUplEntry): boolean => {
    if (entry.status !== "ACTIVE") {
      return false;
    }
    if (!entry.notes?.includes(tag)) {
      return false;
    }
    if (entry.scope !== args.scope) {
      return false;
    }
    if (args.scope === "SESSION" && entry.sessionId !== args.session.sessionId) {
      return false;
    }
    return true;
  };
  const mute = (entry: BoundaryUplEntry): BoundaryUplEntry => {
    if (!shouldMute(entry)) {
      return entry;
    }
    return {
      ...entry,
      status: "MUTED",
      modifiedAt: args.modifiedAt,
    };
  };
  return {
    ...args.ledger,
    userApprovedLawPaths: args.ledger.userApprovedLawPaths.map(mute),
    userDeniedLawPaths: args.ledger.userDeniedLawPaths.map(mute),
  };
}

function summarizeUplEntrySource(entry: BoundaryUplEntry): string {
  if (entry.notes?.includes("[acceptance-source-intake]")) {
    return "acceptance-source-intake";
  }
  if (entry.notes?.includes("[denial-source-intake]")) {
    return "denial-source-intake";
  }
  if (entry.notes?.includes("[upl-doc-lane:acceptance]")) {
    return "acceptance-doc";
  }
  if (entry.notes?.includes("[upl-doc-lane:denial]")) {
    return "denial-doc";
  }
  if (entry.witness === "BUCCET.HEADLESS.BASE.DENIALS.V1") {
    return "base-denial-pack";
  }
  if (entry.notes?.includes("Buccet base acceptance pack")) {
    return "base-acceptance-pack";
  }
  return "runtime";
}

function parseUplTypeToken(token: string | undefined): BoundaryUplEntryType | null {
  if (!token) {
    return null;
  }
  const normalized = token.trim().toUpperCase();
  if (normalized === "APPROVED" || normalized === "DENIED") {
    return normalized;
  }
  return null;
}

function parseUplStatusToken(token: string | undefined): BoundaryUplStatus | null {
  if (!token) {
    return null;
  }
  const normalized = token.trim().toUpperCase();
  if (normalized === "ACTIVE" || normalized === "MUTED" || normalized === "DELETED") {
    return normalized;
  }
  return null;
}

function parseUplSelection(args: string[], options?: {
  allowIds?: boolean;
  allowPositionalQuery?: boolean;
}): ParsedUplSelection {
  const allowIds = options?.allowIds ?? true;
  const allowPositionalQuery = options?.allowPositionalQuery ?? false;
  const ids: string[] = [];
  const queryTerms: string[] = [];
  let includeAll = false;
  let typeFilter: BoundaryUplEntryType | null = null;
  let statusFilter: BoundaryUplStatus | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--json") {
      continue;
    }
    if (token === "--all") {
      includeAll = true;
      continue;
    }
    if (token === "--type") {
      const parsed = parseUplTypeToken(args[index + 1]);
      if (!parsed) {
        throw new Error(`unsupported UPL type filter: ${args[index + 1] ?? ""}`);
      }
      typeFilter = parsed;
      index += 1;
      continue;
    }
    if (token === "--status") {
      const parsed = parseUplStatusToken(args[index + 1]);
      if (!parsed) {
        throw new Error(`unsupported UPL status filter: ${args[index + 1] ?? ""}`);
      }
      statusFilter = parsed;
      index += 1;
      continue;
    }
    if (token === "--search") {
      let consumed = 0;
      for (let cursor = index + 1; cursor < args.length; cursor += 1) {
        if (args[cursor]?.startsWith("--")) {
          break;
        }
        queryTerms.push(args[cursor]!);
        consumed += 1;
      }
      if (consumed === 0) {
        throw new Error("`--search` requires at least one query term");
      }
      index += consumed;
      continue;
    }
    if (token.startsWith("--")) {
      usage();
    }
    if (allowPositionalQuery) {
      queryTerms.push(token);
      continue;
    }
    if (allowIds) {
      ids.push(token);
      continue;
    }
    usage();
  }

  return {
    ids,
    queryTerms,
    includeAll,
    typeFilter,
    statusFilter,
  };
}

function normalizeUplSearchText(entry: BoundaryUplEntry): string {
  return [
    entry.id,
    entry.type,
    entry.status,
    entry.scope,
    entry.path,
    entry.domain ?? "",
    entry.witness,
    entry.notes ?? "",
    summarizeUplEntrySource(entry),
    JSON.stringify(entry.requestBasis ?? {}),
    JSON.stringify(entry.trackConstraint ?? {}),
  ].join("\n").toLowerCase();
}

function selectUplEntries(entries: BoundaryUplEntry[], selection: ParsedUplSelection): BoundaryUplEntry[] {
  const includeInactive = selection.includeAll || selection.statusFilter !== null;
  return entries.filter((entry) => {
    if (!includeInactive && entry.status !== "ACTIVE") {
      return false;
    }
    if (selection.typeFilter && entry.type !== selection.typeFilter) {
      return false;
    }
    if (selection.statusFilter && entry.status !== selection.statusFilter) {
      return false;
    }
    if (selection.queryTerms.length === 0) {
      return true;
    }
    const haystack = normalizeUplSearchText(entry);
    return selection.queryTerms.every((term) => haystack.includes(term.toLowerCase()));
  });
}

function formatTargetMatcher(
  pattern: string,
  mode: "prefix" | "exact" | "regex" | undefined,
  multiple = false,
): string {
  const label = multiple ? "targets" : "target";
  switch (mode) {
    case "exact":
      return `${label} == ${pattern}`;
    case "regex":
      return `${label} ~= ${pattern}`;
    default:
      return `${label} ^= ${pattern}`;
  }
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function buildUplEntryView(entry: BoundaryUplEntry): {
  source: string;
  whatItIs: string;
  connectsTo: string;
  actionKinds: string[];
  bounds: string[];
} {
  const source = summarizeUplEntrySource(entry);
  const constraint = entry.trackConstraint;
  const actionKinds = uniqueStrings([
    ...(constraint?.actionCorridor?.allowedActionKinds ?? []),
    ...(constraint?.allowedActionKinds ?? []),
    entry.requestBasis?.actionKind,
  ]);
  const whatItIs = constraint?.description
    ?? `${entry.type === "APPROVED" ? "Acceptance" : "Denial"} UPL entry for ${actionKinds.join(", ") || "recorded motion"}`;

  const connectTargets = uniqueStrings([
    entry.requestBasis?.target,
    constraint?.actionCorridor?.targetPattern
      ? formatTargetMatcher(
        constraint.actionCorridor.targetPattern,
        constraint.actionCorridor.targetMatchMode,
      )
      : null,
    constraint?.targetPattern
      ? formatTargetMatcher(constraint.targetPattern, constraint.targetMatchMode)
      : null,
    constraint?.targetPatterns?.length
      ? formatTargetMatcher(
        constraint.targetPatterns.join(" ; "),
        constraint.targetMatchMode,
        true,
      )
      : null,
    entry.domain ? `domain = ${entry.domain}` : null,
  ]);

  const bounds = uniqueStrings([
    `scope = ${entry.scope.toLowerCase()}`,
    `source = ${source}`,
    entry.sessionId ? `session = ${entry.sessionId}` : null,
    entry.requestBasis?.flags
      ? uniqueStrings(
        Object.entries(entry.requestBasis.flags)
          .filter(([, enabled]) => Boolean(enabled))
          .map(([flag]) => `flag = ${flag}`),
      ).join(" | ")
      : null,
    constraint?.requestTextPatterns?.length
      ? `request ~= ${constraint.requestTextPatterns.join(" ; ")}`
      : null,
    constraint?.requiredFlags?.length
      ? `needs-flags = ${constraint.requiredFlags.join(", ")}`
      : null,
    constraint?.reviewSurface ? `surface = ${constraint.reviewSurface}` : null,
    constraint?.reviewInvariantLawId ? `invariant = ${constraint.reviewInvariantLawId}` : null,
    (constraint?.outputCorridor?.outputShape ?? constraint?.outputShape)
      ? `shape = ${constraint.outputCorridor?.outputShape ?? constraint.outputShape}`
      : null,
    (constraint?.outputCorridor?.requiredTextPatterns ?? constraint?.requiredTextPatterns)?.length
      ? `require = ${(constraint.outputCorridor?.requiredTextPatterns ?? constraint.requiredTextPatterns)?.join(" ; ")}`
      : null,
    (constraint?.outputCorridor?.forbiddenTextPatterns ?? constraint?.forbiddenTextPatterns)?.length
      ? `forbid = ${(constraint.outputCorridor?.forbiddenTextPatterns ?? constraint.forbiddenTextPatterns)?.join(" ; ")}`
      : null,
    constraint?.completionGrammar ? `completion = ${constraint.completionGrammar}` : null,
    constraint?.expressionProfile ? `expression = ${constraint.expressionProfile}` : null,
  ]);

  return {
    source,
    whatItIs,
    connectsTo: connectTargets.join(" | ") || "path-scoped recorded motion",
    actionKinds,
    bounds,
  };
}

function sortUplEntries(entries: BoundaryUplEntry[]): BoundaryUplEntry[] {
  return [...entries].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return right.createdAt.localeCompare(left.createdAt);
    }
    return left.id.localeCompare(right.id);
  });
}

function liveStateForEntry(args: {
  entryId: string;
  liveField: Array<{
    entry: BoundaryUplEntry;
    trafficClass: "allow_rail" | "deny_wall";
    trafficTag: string;
  }>;
}): {
  state: "allow_rail" | "deny_wall" | "inactive";
  trafficTag: string | null;
} {
  const liveSegment = args.liveField.find((segment) => segment.entry.id === args.entryId) ?? null;
  return liveSegment
    ? { state: liveSegment.trafficClass, trafficTag: liveSegment.trafficTag }
    : { state: "inactive", trafficTag: null };
}

function printUplEntryDetails(args: {
  entry: BoundaryUplEntry;
  liveState: { state: "allow_rail" | "deny_wall" | "inactive"; trafficTag: string | null };
}) {
  const view = buildUplEntryView(args.entry);
  console.log(`${args.entry.status} | ${args.entry.type} | ${args.entry.id}`);
  console.log(`  what it is: ${view.whatItIs}`);
  console.log(`  connects to: ${view.connectsTo}`);
  console.log(`  action kinds: ${view.actionKinds.join(", ") || "none recorded"}`);
  console.log(`  bounds: ${view.bounds.join(" | ") || "none recorded"}`);
  console.log(`  source: ${view.source}`);
  console.log(`  live field: ${args.liveState.state}${args.liveState.trafficTag ? ` | ${args.liveState.trafficTag}` : ""}`);
}

function summarizeDiffStates(rows: Array<{ liveState: "allow_rail" | "deny_wall" | "inactive" }>): {
  allow: number;
  deny: number;
  inactive: number;
} {
  let allow = 0;
  let deny = 0;
  let inactive = 0;
  for (const row of rows) {
    if (row.liveState === "allow_rail") {
      allow += 1;
    } else if (row.liveState === "deny_wall") {
      deny += 1;
    } else {
      inactive += 1;
    }
  }
  return { allow, deny, inactive };
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

async function readHookPid(pidFilePath: string): Promise<number> {
  return await fs.readFile(pidFilePath, "utf8").then((raw) => Number(raw.trim())).catch(() => 0);
}

type HookRuntimeHealth = {
  running: boolean;
  healthy: boolean;
  pid?: number;
  state?: string;
  interceptReady: boolean;
  bridgeReady: boolean;
  reason?: string;
};

async function probeGravityBridge(socketPath: string, timeoutMs = 1_500): Promise<void> {
  await withTimeout(new Promise<void>((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    socket.once("error", (error) => {
      finish(error instanceof Error ? error : new Error(String(error)));
    });
    socket.once("connect", () => {
      socket.write("__health__\n");
    });
    socket.on("data", (chunk) => {
      const response = chunk.toString();
      if (response.includes("1")) {
        finish();
        return;
      }
      finish(new Error(`unexpected gravity bridge health response: ${JSON.stringify(response)}`));
    });
    socket.once("end", () => {
      finish(new Error("gravity bridge closed before health response"));
    });
  }), timeoutMs, "gravity bridge health check");
}

async function getHookRuntimeHealth(
  boundary: Awaited<ReturnType<typeof importBoundary>>,
  home: ReturnType<typeof resolveHomePaths>,
): Promise<HookRuntimeHealth> {
  const pid = await readHookPid(home.hookPidPath);
  const running = pid ? await pidAlive(pid) : false;
  const hookState = await readJsonIfExists<{ state?: string }>(home.brainStatusPath);
  const state = hookState?.state;

  if (!running) {
    return {
      running: false,
      healthy: false,
      pid: pid || undefined,
      state,
      interceptReady: false,
      bridgeReady: false,
      reason: "hook daemon is not running",
    };
  }

  if (state !== "alive") {
    return {
      running,
      healthy: false,
      pid,
      state,
      interceptReady: false,
      bridgeReady: false,
      reason: `hook daemon state is ${state ?? "missing"}`,
    };
  }

  if (!(await pathExists(home.interceptSocketPath))) {
    return {
      running,
      healthy: false,
      pid,
      state,
      interceptReady: false,
      bridgeReady: false,
      reason: "intercept socket is missing",
    };
  }

  if (!(await pathExists(home.gravityBridgeSocketPath))) {
    return {
      running,
      healthy: false,
      pid,
      state,
      interceptReady: true,
      bridgeReady: false,
      reason: "gravity bridge socket is missing",
    };
  }

  try {
    const interceptStatus = await withTimeout(boundary.sendBoundaryInterceptServerInput({
      target: { socketPath: home.interceptSocketPath },
      input: {
        command: "status",
      },
    }), 1_500, "intercept server health check");
    if (interceptStatus.type !== "status" || interceptStatus.running !== true) {
      return {
        running,
        healthy: false,
        pid,
        state,
        interceptReady: false,
        bridgeReady: false,
        reason: `unexpected intercept server health response: ${interceptStatus.type}`,
      };
    }
  } catch (error) {
    return {
      running,
      healthy: false,
      pid,
      state,
      interceptReady: false,
      bridgeReady: false,
      reason: error instanceof Error ? error.message : "intercept server health check failed",
    };
  }

  try {
    await probeGravityBridge(home.gravityBridgeSocketPath);
  } catch (error) {
    return {
      running,
      healthy: false,
      pid,
      state,
      interceptReady: true,
      bridgeReady: false,
      reason: error instanceof Error ? error.message : "gravity bridge health check failed",
    };
  }

  return {
    running,
    healthy: true,
    pid,
    state,
    interceptReady: true,
    bridgeReady: true,
  };
}

async function waitForHookRuntimeHealthy(
  boundary: Awaited<ReturnType<typeof importBoundary>>,
  home: ReturnType<typeof resolveHomePaths>,
  timeoutMs = 10_000,
): Promise<HookRuntimeHealth> {
  const startedAt = Date.now();
  let lastHealth: HookRuntimeHealth | null = null;
  let lastReason = "";
  const profileInit = process.env.BUCCET_PROFILE_INIT === "1";

  while (Date.now() - startedAt < timeoutMs) {
    lastHealth = await getHookRuntimeHealth(boundary, home);
    if (lastHealth.healthy) {
      if (profileInit) {
        console.error(`[buccet-init-profile] hook healthy in ${Date.now() - startedAt}ms`);
      }
      return lastHealth;
    }
    if (profileInit && lastHealth.reason && lastHealth.reason !== lastReason) {
      lastReason = lastHealth.reason;
      console.error(`[buccet-init-profile] hook wait reason: ${lastReason}`);
    }
    if (lastHealth.state === "dead") {
      throw new Error(lastHealth.reason ?? "hook runtime entered dead state");
    }
    await sleep(100);
  }

  throw new Error(lastHealth?.reason ?? "hook runtime did not become healthy");
}

async function stopHookDaemonPid(pid: number): Promise<void> {
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return;
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (!(await pidAlive(pid))) {
      return;
    }
    await sleep(100);
  }

  throw new Error(`hook daemon ${pid} did not stop cleanly`);
}

async function importBoundary(homePath: string) {
  await ensureDir(homePath);
  process.chdir(homePath);
  return import("../lib/agent-buccet/index.ts");
}

async function ensureStore(boundary: Awaited<ReturnType<typeof importBoundary>>, args: {
  config: BuccetConfig;
  sessionsDir: string;
  hydrationMode?: "full" | "light";
}) {
  const restored = await boundary.restoreBoundaryRuntimeStore({
    sessionId: args.config.sessionId,
    sessionsDir: args.sessionsDir,
    hydrationMode: args.hydrationMode ?? "full",
  });
  if (restored) {
    return restored;
  }
  return boundary.createPersistentBoundaryRuntimeStore({
    sessionId: args.config.sessionId,
    actorId: args.config.actorId,
    dryRun: args.config.dryRun,
    sessionsDir: args.sessionsDir,
    hydrationMode: args.hydrationMode ?? "full",
  });
}

async function ensureScopes(boundary: Awaited<ReturnType<typeof importBoundary>>, args: {
  store: Awaited<ReturnType<typeof ensureStore>>;
  scopePaths: string[];
  actorId: string;
  grantedActions?: BoundaryActionKind[];
}) {
  const profileInit = process.env.BUCCET_PROFILE_INIT === "1";
  const profileStartedAt = Date.now();
  const profileMark = (label: string) => {
    if (!profileInit) {
      return;
    }
    console.error(`[buccet-init-profile] ensureScopes ${label}: ${Date.now() - profileStartedAt}ms`);
  };
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
    const scopeStartedAt = Date.now();
    await args.store.openPath({
      rootPath: scopePath,
      grantedActions,
      issuedBy: args.actorId,
    });
    if (profileInit) {
      console.error(`[buccet-init-profile] ensureScopes openPath ${scopePath}: ${Date.now() - scopeStartedAt}ms`);
    }
  }
  profileMark("path openings complete");

  if (process.platform === "darwin") {
    const runtimeSupportGrants = [
      { target: "/", actions: ["fs.read"] as BoundaryActionKind[] },
      { target: "/dev/null", actions: ["fs.read", "fs.write", "fs.append"] as BoundaryActionKind[] },
      { target: "/usr/local/etc/openssl@3/openssl.cnf", actions: ["fs.read"] as BoundaryActionKind[] },
      { target: "/opt/homebrew/etc/openssl@3/openssl.cnf", actions: ["fs.read"] as BoundaryActionKind[] },
    ];
    const existingExactGrantKeys = new Set(
      args.store.getConfig().grants
        .filter((grant) => !grant.revokedAt)
        .filter((grant) => grant.resourceKind === "path")
        .filter((grant) => grant.metadata?.exact_only === true)
        .flatMap((grant) =>
          grant.grantedActions.map((action) => `${path.resolve(grant.resourceValue)}:${action}`),
        ),
    );

    const pendingRuntimeSupportGrants: Array<{
      resourceKind: "path";
      resourceValue: string;
      grantedActions: BoundaryActionKind[];
      issuedBy: string;
      metadata: Record<string, string | number | boolean>;
    }> = [];
    const pendingGrantTargets: string[] = [];

    for (const grant of runtimeSupportGrants) {
      const missingAction = grant.actions.find((action) =>
        !existingExactGrantKeys.has(`${path.resolve(grant.target)}:${action}`)
      );
      if (!missingAction) {
        continue;
      }
      if (!(await pathExists(grant.target))) {
        continue;
      }
      pendingRuntimeSupportGrants.push({
        resourceKind: "path",
        resourceValue: grant.target,
        grantedActions: grant.actions,
        issuedBy: args.actorId,
        metadata: {
          exact_only: true,
          runtime_support: true,
        },
      });
      pendingGrantTargets.push(grant.target);
    }

    if (pendingRuntimeSupportGrants.length > 0) {
      const batchStartedAt = Date.now();
      const result = await boundary.issueBoundaryGrantBatch({
        config: args.store.getConfig(),
        grants: pendingRuntimeSupportGrants,
      });
      args.store.replaceConfig(result.config);
      if (profileInit) {
        for (const target of pendingGrantTargets) {
          console.error(`[buccet-init-profile] ensureScopes runtime grant ${target}: batched`);
        }
        console.error(`[buccet-init-profile] ensureScopes runtime grants batch: ${Date.now() - batchStartedAt}ms`);
      }
    }
  }
  profileMark("complete");
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

function printLogRecord(record: {
  META: { timestamp: string; event_type: string; id: string };
  DECISION: { verdict: string; reason: string };
  INPUT: { action: string; target: string; source: string };
}) {
  const verdict = record.DECISION.verdict ?? "";
  const verdictColor =
    verdict === "allow"            ? c.green  :
    verdict === "deny"             ? c.red     :
    verdict === "require_approval" ? c.yellow  :
    c.dim;
  const ts      = clrDim(record.META.timestamp.slice(0, 19).replace("T", " "));
  const vt      = `${verdictColor}${verdict.toUpperCase().padEnd(16)}${c.reset}`;
  const ev      = `${c.cyan}${record.META.event_type}${c.reset}`;
  const target  = clrDim(record.INPUT.target || "-");
  console.log(`  ${ts}  ${vt}  ${ev}  ${record.INPUT.action}  ${target}`);
  if (record.DECISION.reason) {
    console.log(`  ${" ".repeat(21)}${clrDim(record.DECISION.reason)}`);
  }
}

function summarizeInterceptedAttempts(records: Array<{ META: { event_type: string } }>): number {
  const intercepted = new Set([
    "ACTION_BLOCKED",
    "APPROVAL_DENIED",
    "GOVERNOR_TRIP",
    "INGRESS_PROVENANCE_BLOCKED",
    "INGRESS_CANYON_STATE_WRITTEN",
  ]);
  return records.reduce((sum, record) => sum + (intercepted.has(record.META.event_type) ? 1 : 0), 0);
}

async function buildHookStatusPayload(boundary: Awaited<ReturnType<typeof importBoundary>>, args: {
  home: ReturnType<typeof resolveHomePaths>;
  config: BuccetConfig | null;
}): Promise<HookStatusPayload> {
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
  }>(args.home.brainStatusPath);
  const health = await getHookRuntimeHealth(boundary, args.home);
  const running = health.running;

  let interceptReachable = health.interceptReady;
  let ledgerEntries = 0;
  let interceptedAttempts = 0;
  let canyonHeld = 0;
  let pendingApprovals = 0;

  if (args.config && running) {
    try {
      const status = await boundary.sendBoundaryInterceptServerInput({
        target: { socketPath: args.home.interceptSocketPath },
        input: { command: "status" },
      });
      interceptReachable = status.type === "status";
      if (status.type === "status") {
        pendingApprovals = status.swarm?.pending ?? 0;
      }
      const ingress = await boundary.sendBoundaryInterceptServerInput({
        target: { socketPath: args.home.interceptSocketPath },
        input: { command: "ingress_status" },
      });
      if (ingress.type === "ingress_status") {
        canyonHeld = ingress.provenances.filter((entry: { state: string }) => entry.state === "canyon").length;
      }
    } catch {
      interceptReachable = false;
    }

    try {
      const records = await boundary.readBoundaryLedgerBySession(args.config.sessionId);
      ledgerEntries = records.length;
      interceptedAttempts = summarizeInterceptedAttempts(records);
    } catch {
      ledgerEntries = 0;
      interceptedAttempts = 0;
    }
  }

  return {
    initialized: Boolean(args.config),
    running,
    healthy: health.healthy,
    pid: health.pid,
    state: health.state ?? hookState?.state,
    sessionId: hookState?.sessionId ?? args.config?.sessionId,
    actorId: hookState?.actorId ?? args.config?.actorId,
    interceptSocketPath: hookState?.interceptSocketPath ?? args.home.interceptSocketPath,
    gravityBridgeSocketPath: hookState?.gravityBridgeSocketPath ?? args.home.gravityBridgeSocketPath,
    brainStatusPath: hookState?.brainStatusPath ?? args.home.brainStatusPath,
    nativeLibraryPath: args.home.nativeLibraryPath,
    restarts: hookState?.restartCount,
    lastError: health.reason ?? hookState?.lastError,
    interceptReady: health.interceptReady,
    bridgeReady: health.bridgeReady,
    interceptReachable,
    ledgerEntries,
    interceptedAttempts,
    canyonHeld,
    pendingApprovals,
  };
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
  let armNow = false;
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
    if (token === "--arm-now") {
      armNow = true;
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
  const profileInit = process.env.BUCCET_PROFILE_INIT === "1";
  const initStartedAt = Date.now();
  const profileMark = (label: string) => {
    if (!profileInit) {
      return;
    }
    console.error(`[buccet-init-profile] ${label}: ${Date.now() - initStartedAt}ms`);
  };

  const store = await ensureStore(boundary, {
    config: nextConfig,
    sessionsDir: home.sessionsDir,
    hydrationMode: "light",
  });
  profileMark("store ready");
  await ensureScopes(boundary, {
    store,
    scopePaths: nextConfig.defaultScopes,
    actorId: nextConfig.actorId,
  });
  profileMark("scopes ready");
  await store.persist();
  profileMark("store persisted");
  await saveConfig(home.configPath, nextConfig);
  profileMark("config saved");
  await ensureUplSourceHomes(home);
  profileMark("upl homes ready");
  await ensurePathMemoryHome(home);
  profileMark("path memory ready");

  const platformLabel = detectPlatformLabel();
  const backendLabel = detectBackendLabel();
  const nativeReady = await pathExists(home.nativeLibraryPath);
  const protectionMode = nativeReady ? "strong_path" : "compatibility_path";
  const shouldArmNow = armNow || nativeReady;

  printBuccetWordmark();
  printCliSection("Initialized", [
    formatCliKeyValue("home", home.homePath),
    formatCliKeyValue("protection", protectionMode),
    formatCliKeyValue("platform", platformLabel),
    formatCliKeyValue("backend", backendLabel),
  ]);
  console.log(``);
  console.log(`  ${clrOk()}  ${clrBold("Agent Buccet is ready.")}`);
  console.log(`  Run ${c.bold}${c.blue}buccet console${c.reset} to open the operator cockpit.`);
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
    console.log(``);
    console.log(`  ${clrWarn()}  ${clrBold("Agent Buccet is not initialized.")}`);
    console.log(`  ${clrDim("home:")}  ${home.homePath}`);
    console.log(`  Run ${clrBold("buccet init")} to get started.`);
    console.log(``);
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
    quarantineStatus: sessionState?.quarantineState?.required
      ? sessionState.quarantineState.status
      : null,
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

  printCliHeader("Agent Buccet — Status Snapshot");
  printCliSection("Session", [
    formatCliKeyValue("home", payload.home),
    formatCliKeyValue("session", payload.sessionId),
    formatCliKeyValue("actor", payload.actorId),
    formatCliKeyValue("session status", payload.sessionStatus),
    ...(payload.quarantineStatus ? [formatCliKeyValue("quarantine", payload.quarantineStatus)] : []),
  ]);
  printCliSection("Authority", [
    formatCliKeyValue("scopes", payload.scopes.length),
    formatCliKeyValue("active grants", payload.grants),
  ]);
  printCliSection("Ledger", [
    formatCliKeyValue("entries", payload.ledger.entries),
    formatCliKeyValue("chain", payload.ledger.chainOk ? "ok" : "broken"),
    formatCliKeyValue("checked from", payload.ledger.checkedFrom ?? "-"),
  ]);
  if (payload.witness) {
    printCliSection("Witness", [
      formatCliKeyValue("target", payload.witness.target),
      formatCliKeyValue("mode", payload.witness.mode),
      formatCliKeyValue(
        "status",
        `${payload.witness.status}${payload.witness.fallback ? " (fallback: local file)" : ""}`,
      ),
      payload.witness.published_at ? formatCliKeyValue("published", payload.witness.published_at) : null,
    ]);
  } else {
    printCliSection("Witness", [
      "unavailable (run package build to generate)",
    ]);
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

async function handleLedger(rest: string[]) {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  const boundary = await importBoundary(homePath);
  const config = await loadConfig(home.configPath);
  if (!config) {
    throw new Error("Agent Buccet is not initialized. Run `buccet init` first.");
  }

  let limit = 20;
  const asJson = rest.includes("--json");
  const follow = rest.includes("--follow");
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index] === "--limit") {
      limit = Number(rest[index + 1] ?? usage());
      index += 1;
    }
  }

  const render = async (fromCount = 0) => {
    const records = await boundary.readBoundaryLedgerBySession(config.sessionId);
    const slice = follow ? records.slice(fromCount) : records.slice(-limit);
    if (!follow && asJson) {
      printJson(slice);
      return records.length;
    }
    if (!follow) {
      console.log(``);
      console.log(`  ${clrBold("Agent Buccet — Witness Ledger")}`);
      console.log(`  ${c.dim}─────────────────────────────────────${c.reset}`);
      console.log(`  ${clrDim("session:")}  ${config.sessionId}`);
      console.log(`  ${clrDim("entries:")}  ${records.length}`);
      console.log(``);
    }
    for (const record of slice) {
      printLogRecord(record);
    }
    return records.length;
  };

  if (!follow) {
    await render();
    return;
  }

  let lastSeen = 0;
  console.log(``);
  console.log(`  ${clrBold("Agent Buccet — Witness Ledger")}`);
  console.log(`  ${c.dim}─────────────────────────────────────${c.reset}`);
  console.log(`  ${clrDim("session:")}  ${config.sessionId}`);
  console.log(`  ${clrDim("Following live ledger stream. Ctrl-C to exit.")}`);
  console.log(``);
  lastSeen = await render(0);
  const interval = setInterval(() => {
    void render(lastSeen).then((next) => {
      lastSeen = next;
    }).catch(() => undefined);
  }, 1_000);
  await new Promise<void>((resolve) => {
    const stop = () => {
      clearInterval(interval);
      resolve();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
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
    console.log(``);
    printCliHeader("  Active Scopes");
    if (scopes.length === 0) {
      console.log(`  ${clrDim("No scopes configured.")}`);
    } else {
      for (const scope of scopes) {
        const statusColor = scope.status === "active" ? c.green : c.dim;
        console.log(`  ${statusColor}${scope.status}${c.reset}  ${scope.rootPath}  ${clrDim(scope.grantedActions.join(", "))}`);
      }
    }
    console.log(``);
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
  console.log(`  ${clrOk(clrBold("scope opened:"))}  ${scopePath}`);
}

async function importCompiledDocumentLaws(args: {
  boundary: Awaited<ReturnType<typeof importBoundary>>;
  config: BuccetConfig;
  store: Awaited<ReturnType<typeof ensureStore>>;
  upl: BoundaryUserPathLedger;
  filePath: string;
  compiled: CompiledDocumentLaw[];
  scope: BoundaryUplScope;
  importReason: string;
  metadata?: Record<string, string | number | boolean>;
}): Promise<{ upl: BoundaryUserPathLedger; entryIds: string[]; imported: number }> {
  const scoped = args.compiled.map((entry) => ({
    ...entry,
    scope: args.scope,
  }));
  const entryIds: string[] = [];
  const witnessByType = new Map<"APPROVED" | "DENIED", Awaited<ReturnType<typeof args.boundary.appendBoundaryLedger>>>();
  for (const lawType of ["APPROVED", "DENIED"] as const) {
    const matching = scoped.filter((entry) => entry.type === lawType);
    if (matching.length === 0) {
      continue;
    }
    const requestId = `upl-import-${createHash("sha256").update(`${args.filePath}:${lawType}:${matching.map((entry) => entry.requestBasis.payloadSummary ?? entry.requestBasis.target).join("|")}`).digest("hex").slice(0, 12)}`;
    const representative = matching[0];
    const witness = await args.boundary.appendBoundaryLedger(
      lawType === "APPROVED" ? "UPL_ALLOW_RECORDED" : "UPL_DENY_RECORDED",
      {
        sessionId: args.config.sessionId,
        actorId: args.config.actorId,
        requestId,
        actionKind: representative.requestBasis.actionKind,
        target: representative.requestBasis.target,
        decision: lawType === "APPROVED" ? "allow" : "deny",
        reason: `${args.importReason} (${matching.length} compiled laws)`,
        lawIds: [],
        metadata: {
          source_document: args.filePath,
          upl_scope: args.scope,
          compiled_law_count: matching.length,
          imported_invariant_batch: createHash("sha256")
            .update(matching
              .map((entry) => entry.requestBasis.reviewContext?.invariantLawId ?? entry.requestBasis.payloadSummary ?? "unknown")
              .join("|"))
            .digest("hex")
            .slice(0, 16),
          ...(args.metadata ?? {}),
        },
        createdAt: new Date().toISOString(),
      },
    );
    witnessByType.set(lawType, witness);
  }

  const batch = scoped.flatMap((law) => {
    const witness = witnessByType.get(law.type);
    return witness ? [{ compiledLaw: law, witness }] : [];
  });
  const approvedCountBefore = args.upl.userApprovedLawPaths.length;
  const deniedCountBefore = args.upl.userDeniedLawPaths.length;
  const upl = await args.boundary.writeCompiledUserPathLaws({
    ledger: args.upl,
    compiledLaws: batch,
    session: args.store.getConfig().session,
  });
  for (const entry of upl.userApprovedLawPaths.slice(approvedCountBefore)) {
    entryIds.push(entry.id);
  }
  for (const entry of upl.userDeniedLawPaths.slice(deniedCountBefore)) {
    entryIds.push(entry.id);
  }

  return {
    upl,
    entryIds,
    imported: scoped.length,
  };
}

async function syncUplDocumentSources(args: {
  boundary: Awaited<ReturnType<typeof importBoundary>>;
  home: ReturnType<typeof resolveHomePaths>;
  config: BuccetConfig;
  scope: BoundaryUplScope;
  laneSelection?: UplSourceLane | null;
}): Promise<UplSyncResult> {
  await ensureUplSourceHomes(args.home);
  const allLaneFiles = await collectUplSyncLaneFiles(args.home);
  const fingerprint = await computeUplSyncFingerprint(allLaneFiles);
  const laneFiles = allLaneFiles.filter((lane) => !args.laneSelection || lane.spec.lane === args.laneSelection);
  const lanes = laneFiles.map((lane) => lane.spec);
  const store = await ensureStore(args.boundary, {
    config: args.config,
    sessionsDir: args.home.sessionsDir,
  });
  const staged: Array<{ lane: UplSourceLane; filePath: string; compiled: CompiledDocumentLaw[] }> = [];
  for (const lane of laneFiles) {
    for (const filePath of lane.files) {
      const markdown = await fs.readFile(filePath, "utf8");
      const extracted = args.boundary.extractDocumentLawsWithDiagnostics({
        sourcePath: filePath,
        markdown,
      });
      const hasCompiledLaw = extracted.laws.length > 0;
      const intakeDoc = !hasCompiledLaw
        ? parseSourceIntakeDoc(markdown, filePath)
        : null;
      const tagged = hasCompiledLaw
        ? (() => {
          validateExtractedDocumentLane({
            lane: lane.spec.lane,
            filePath,
            compiled: extracted.laws,
            diagnostics: extracted.diagnostics,
          });
          return extracted.laws.map((entry) => ({
            ...entry,
            notes: formatUplSourceNote({
              lane: lane.spec.lane,
              filePath,
              notes: entry.notes,
            }),
          }));
        })()
        : intakeDoc
          ? compileSourceIntakeDoc({
              filePath,
              lane: lane.spec.lane,
              doc: intakeDoc,
              scope: args.scope,
            })
          : (() => {
            validateExtractedDocumentLane({
              lane: lane.spec.lane,
              filePath,
              compiled: extracted.laws,
              diagnostics: extracted.diagnostics,
            });
            return extracted.laws.map((entry) => ({
              ...entry,
              notes: formatUplSourceNote({
                lane: lane.spec.lane,
                filePath,
                notes: entry.notes,
              }),
            }));
          })();
      staged.push({
        lane: lane.spec.lane,
        filePath,
        compiled: tagged,
      });
    }
  }

  let upl = await args.boundary.loadUserPathLedger();
  const now = new Date().toISOString();
  for (const lane of lanes) {
    upl = muteLaneSourcedEntries({
      ledger: upl,
      lane: lane.lane,
      scope: args.scope,
      session: store.getConfig().session,
      modifiedAt: now,
    });
  }
  if (staged.length === 0) {
    upl = await args.boundary.saveUserPathLedger(upl);
  }

  const imported: Array<{ lane: UplSourceLane; file: string; imported: number; entries: string[] }> = [];
  for (const item of staged) {
    const result = await importCompiledDocumentLaws({
      boundary: args.boundary,
      config: args.config,
      store,
      upl,
      filePath: item.filePath,
      compiled: item.compiled,
      scope: args.scope,
      importReason: `document law synced from ${item.lane} source`,
      metadata: {
        import_mode: "upl_sync",
        document_lane: item.lane,
      },
    });
    upl = result.upl;
    imported.push({
      lane: item.lane,
      file: item.filePath,
      imported: result.imported,
      entries: result.entryIds,
    });
  }

  store.replaceConfig({
    ...store.getConfig(),
    upl,
    userLawIds: await buildEffectiveUserLawIds(args.boundary, store.getConfig(), upl),
  });
  await store.persist();

  return {
    scope: args.scope,
    root: args.home.uplDocsDir,
    laneFiles,
    imported,
    fingerprint,
  };
}

async function ensureRuntimeUplAutoSync(args: {
  boundary: Awaited<ReturnType<typeof importBoundary>>;
  home: ReturnType<typeof resolveHomePaths>;
  config: BuccetConfig;
}): Promise<boolean> {
  await ensureUplSourceHomes(args.home);
  const laneFiles = await collectUplSyncLaneFiles(args.home);
  const fingerprint = await computeUplSyncFingerprint(laneFiles);
  const previous = await loadUplAutoSyncState(args.home.uplAutoSyncStatePath);
  if (previous?.fingerprint === fingerprint) {
    return false;
  }
  const result = await syncUplDocumentSources({
    boundary: args.boundary,
    home: args.home,
    config: args.config,
    scope: "GLOBAL",
  });
  await saveUplAutoSyncState(args.home.uplAutoSyncStatePath, {
    fingerprint: result.fingerprint,
    syncedAt: new Date().toISOString(),
    fileCount: laneFiles.reduce((sum, lane) => sum + lane.files.length, 0),
  });
  return true;
}

async function handleUpl(rest: string[]) {
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

  if (subcommand === "sources") {
    let openSelection: string | null = null;
    for (let index = 1; index < rest.length; index += 1) {
      const token = rest[index];
      if (token === "--open") {
        openSelection = rest[index + 1] ?? usage();
        index += 1;
        continue;
      }
      if (token === "--json") {
        continue;
      }
      usage();
    }
    await ensureUplSourceHomes(home);
    const catalogs = acceptanceSourceCatalogs();
    const commands = acceptancePipelineCommands(home);
    const snapshot = await Promise.all(
      uplSourceSpecs(home).map(async (spec) => ({
        lane: spec.lane,
        dir: spec.dir,
        files: await listLaneMarkdownFiles(spec.dir),
      })),
    );
    const opened = openSelection
      ? await Promise.all(resolveSourceCatalogSelection(openSelection).map(async (catalog) => {
        await openCatalogInBrowser(catalog);
        return {
          id: catalog.id,
          name: catalog.name,
          url: catalog.url,
        };
      }))
      : [];
    if (asJson) {
      printJson({
        root: home.uplDocsDir,
        lanes: snapshot,
        catalogs,
        opened,
        acceptancePipeline: {
          guidePath: home.uplAcceptancePipelinePath,
          templatePath: home.uplAcceptanceSkillTemplatePath,
          commands,
        },
      });
      return;
    }
    console.log(``);
    printCliHeader("  UPL Document Sources");
    printCliSection("Lanes", [
      formatCliKeyValue("root", home.uplDocsDir),
      ...snapshot.map((lane) => {
        const laneColor = lane.lane === "acceptance" ? c.green : c.red;
        return formatCliKeyValue(`${laneColor}${lane.lane}${c.reset}`, `${lane.files.length} file${lane.files.length === 1 ? "" : "s"}  ${clrDim(lane.dir)}`);
      }),
    ]);
    for (const lane of snapshot) {
      if (lane.files.length > 0) {
        console.log(``);
        const laneColor = lane.lane === "acceptance" ? c.green : c.red;
        console.log(`  ${laneColor}${c.bold}${lane.lane}${c.reset}  ${clrDim(`(${lane.files.length} file${lane.files.length === 1 ? "" : "s"})`)}`);
        for (const filePath of lane.files) {
          console.log(`    ${clrDim("·")} ${filePath}`);
        }
      }
    }
    if (opened.length > 0) {
      console.log(``);
      for (const catalog of opened) {
        console.log(`  ${clrOk()}  ${c.bold}${catalog.name}${c.reset}  ${clrDim(catalog.url)}`);
      }
    }
    printCliSection("Intake Catalogs", catalogs.map((catalog) =>
      `${c.bold}${catalog.name}${c.reset}  ${clrDim(catalog.description)}\n    ${clrDim(catalog.url)}  ${clrDim(`· open: buccet upl sources --open ${catalog.id}`)}`,
    ));
    printCliSection("Acceptance Pipeline", [
      formatCliKeyValue("guide", home.uplAcceptancePipelinePath),
      formatCliKeyValue("template", home.uplAcceptanceSkillTemplatePath),
    ]);
    console.log(``);
    console.log(`  ${clrDim("1.")} choose a skill/workflow from a catalog above`);
    console.log(`  ${clrDim("2.")} copy the source text you want`);
    console.log(`  ${clrDim("3.")} paste into ${c.green}acceptance${c.reset} (allow) or ${c.red}denial${c.reset} (deny)`);
    console.log(`  ${clrDim("4.")} scaffold a new doc:   ${clrBold(commands.copyTemplate)}`);
    console.log(`  ${clrDim("5.")} compile to live UPL:  ${clrBold(commands.sync)}`);
    console.log(`  ${clrDim("6.")} inspect what landed:  ${clrBold(commands.inspectDiff)}`);
    console.log(``);
    return;
  }

  if (subcommand === "list" || subcommand === "search" || subcommand === "diff") {
    const selection = parseUplSelection(rest.slice(1), {
      allowIds: false,
      allowPositionalQuery: subcommand === "search",
    });
    if (subcommand === "search" && selection.queryTerms.length === 0) {
      usage();
    }

    const upl = await loadEffectiveUserPathLedger(boundary, home, config);
    const session = await loadActiveBoundarySession(boundary, home, config);
    const entries = sortUplEntries(boundary.listUserPathEntries(upl));
    const approved = entries.filter((entry) => entry.type === "APPROVED" && entry.status === "ACTIVE");
    const denied = entries.filter((entry) => entry.type === "DENIED" && entry.status === "ACTIVE");
    const muted = entries.filter((entry) => entry.status === "MUTED");
    const deleted = entries.filter((entry) => entry.status === "DELETED");
    const runtimeTrackField = boundary.compileLiveUplTrackField({ ledger: upl, session });
    const liveField = boundary.compileLiveUplField({ ledger: upl, session });
    const filteredEntries = sortUplEntries(selectUplEntries(entries, selection));

    if (subcommand === "list") {
      if (asJson) {
        printJson({
          approved,
          denied,
          activeApproved: approved,
          activeDenied: denied,
          muted,
          deleted,
          runtimeTrackField,
          filters: selection,
          entries: filteredEntries,
        });
        return;
      }
      console.log(``);
      printCliHeader("  User Path Ledger");
      printCliSection("Summary", [
        formatCliKeyValue(`${c.green}approved${c.reset}`, approved.length),
        formatCliKeyValue(`${c.red}denied${c.reset}`, denied.length),
        formatCliKeyValue("muted", muted.length),
        formatCliKeyValue("deleted", deleted.length),
        formatCliKeyValue("runtime segments", runtimeTrackField.length),
      ]);
      if (!selection.includeAll && selection.statusFilter === null) {
        console.log(`  ${clrDim("showing active laws only — use --all to include muted and deleted")}`);
        console.log(``);
      }
      if (selection.typeFilter || selection.statusFilter || selection.queryTerms.length > 0) {
        console.log(`  ${clrDim(`filtered matches: ${filteredEntries.length}`)}`);
        console.log(``);
      }
      for (const entry of filteredEntries) {
        const view = buildUplEntryView(entry);
        const typeColor = entry.type === "APPROVED" ? c.green : c.red;
        const statusDim = entry.status !== "ACTIVE" ? clrDim : (s: string) => s;
        console.log(`  ${typeColor}${entry.type === "APPROVED" ? "allow" : "deny "}${c.reset}  ${statusDim(entry.status.toLowerCase())}  ${clrDim(entry.id)}  ${clrDim(view.source)}  ${entry.path}`);
      }
      console.log(``);
      return;
    }

    const rows = filteredEntries.map((entry) => {
      const view = buildUplEntryView(entry);
      const liveState = liveStateForEntry({ entryId: entry.id, liveField });
      return {
        entry,
        view,
        liveState: liveState.state,
        liveTag: liveState.trafficTag,
      };
    });

    if (subcommand === "search") {
      if (asJson) {
        printJson({
          filters: selection,
          matches: rows,
        });
        return;
      }
      console.log(`UPL search`);
      console.log(`matches: ${rows.length}`);
      console.log(`query: ${selection.queryTerms.join(" ")}`);
      for (const row of rows) {
        printUplEntryDetails({
          entry: row.entry,
          liveState: { state: row.liveState, trafficTag: row.liveTag },
        });
      }
      return;
    }

    const stateSummary = summarizeDiffStates(rows);
    if (asJson) {
      printJson({
        filters: selection,
        summary: stateSummary,
        rows,
      });
      return;
    }
    console.log(``);
    printCliHeader("  UPL Diff");
    printCliSection("Summary", [
      formatCliKeyValue("matches", rows.length),
      formatCliKeyValue(`${c.green}live allow${c.reset}`, stateSummary.allow),
      formatCliKeyValue(`${c.red}live deny${c.reset}`, stateSummary.deny),
      formatCliKeyValue("inactive", stateSummary.inactive),
    ]);
    for (const row of rows) {
      const typeColor = row.entry.type === "APPROVED" ? c.green : c.red;
      const liveColor = row.liveState === "allow_rail" ? c.green : row.liveState === "deny_wall" ? c.red : "";
      console.log(`  ${typeColor}${row.entry.type === "APPROVED" ? "allow" : "deny "}${c.reset}  ${clrBold(row.entry.id)}  ${clrDim(`authored=${row.entry.type}/${row.entry.status}`)}  ${liveColor}live=${row.liveState}${c.reset}`);
      console.log(`    ${clrDim("what:")}    ${row.view.whatItIs}`);
      console.log(`    ${clrDim("connects:")} ${row.view.connectsTo}`);
      console.log(`    ${clrDim("actions:")} ${row.view.actionKinds.join(", ") || clrDim("none recorded")}`);
      if (row.view.bounds.length > 0) {
        console.log(`    ${clrDim("bounds:")}  ${row.view.bounds.join(" | ")}`);
      }
      if (row.liveTag) {
        console.log(`    ${clrDim("tag:")}     ${row.liveTag}`);
      }
    }
    console.log(``);
    return;
  }

  if (subcommand === "show") {
    const entryId = rest.find((token, index) => index > 0 && token !== "--json");
    if (!entryId) {
      usage();
    }
    const upl = await loadEffectiveUserPathLedger(boundary, home, config);
    const session = await loadActiveBoundarySession(boundary, home, config);
    const entry = boundary.findUserPathEntryById(upl, entryId);
    if (!entry) {
      throw new Error(`unknown UPL id: ${entryId}`);
    }
    const liveField = boundary.compileLiveUplField({ ledger: upl, session });
    const liveSegment = liveField.find((segment) => segment.entry.id === entry.id) ?? null;
    const view = buildUplEntryView(entry);
    if (asJson) {
      printJson({
        entry,
        liveSegment,
        view,
        liveState: liveSegment ? liveSegment.trafficClass : "inactive",
      });
      return;
    }
    const typeColor = entry.type === "APPROVED" ? c.green : c.red;
    const liveColor = liveSegment ? (liveSegment.trafficClass === "allow_rail" ? c.green : c.red) : "";
    console.log(``);
    printCliHeader(`  UPL Entry  ${clrDim(entry.id)}`);
    printCliSection("Identity", [
      formatCliKeyValue("id", entry.id),
      formatCliKeyValue("type", `${typeColor}${entry.type}${c.reset}`),
      formatCliKeyValue("status", entry.status),
      formatCliKeyValue("scope", entry.scope),
      formatCliKeyValue("source", summarizeUplEntrySource(entry)),
      formatCliKeyValue("created", entry.createdAt),
      formatCliKeyValue("modified", entry.modifiedAt ?? "never"),
      entry.notes ? formatCliKeyValue("notes", entry.notes) : null,
    ]);
    printCliSection("Path", [
      formatCliKeyValue("path", entry.path),
      formatCliKeyValue("witness", entry.witness),
      formatCliKeyValue("what it is", view.whatItIs),
      formatCliKeyValue("connects to", view.connectsTo),
      formatCliKeyValue("action kinds", view.actionKinds.join(", ") || clrDim("none recorded")),
      view.bounds.length > 0 ? formatCliKeyValue("bounds", view.bounds.join(" | ")) : null,
    ]);
    if (entry.trackConstraint) {
      printCliSection("Track Constraint", [
        formatCliKeyValue("kinds", entry.trackConstraint.allowedActionKinds.join(", ")),
        formatCliKeyValue("corridor", boundary.formatTrackConstraint(entry.trackConstraint)),
      ]);
    }
    printCliSection("Live Field", [
      liveSegment
        ? formatCliKeyValue("state", `${liveColor}${liveSegment.trafficClass}${c.reset}  ${clrDim(liveSegment.trafficTag ?? "")}`)
        : formatCliKeyValue("state", clrDim("inactive")),
    ]);
    console.log(``);
    return;
  }

  if (subcommand === "mute" || subcommand === "unmute" || subcommand === "remove") {
    const parsed = parseUplSelection(rest.slice(1), {
      allowIds: true,
      allowPositionalQuery: false,
    });
    const selection = subcommand === "unmute" && parsed.statusFilter === null && !parsed.includeAll
      ? {
        ...parsed,
        statusFilter: "MUTED" as BoundaryUplStatus,
      }
      : parsed;
    if (selection.ids.length === 0 && selection.queryTerms.length === 0 && !selection.typeFilter && !selection.statusFilter) {
      usage();
    }

    const status = subcommand === "mute"
      ? "MUTED"
      : subcommand === "unmute"
        ? "ACTIVE"
        : "DELETED";
    const [globalUpl, sessionState] = await Promise.all([
      boundary.loadUserPathLedger(),
      loadActiveBoundarySessionState(boundary, home, config),
    ]);
    const session = sessionState?.session ?? fallbackBoundarySession(config);
    const upl = sessionState?.sessionUpl
      ? boundary.mergeUserPathLedgers({
        baseLedger: globalUpl,
        overlayLedger: sessionState.sessionUpl,
      })
      : globalUpl;
    const entries = sortUplEntries(boundary.listUserPathEntries(upl));
    const hasSearchSelection = selection.queryTerms.length > 0 || Boolean(selection.typeFilter) || Boolean(selection.statusFilter) || selection.includeAll;
    const matchedEntries = hasSearchSelection
      ? sortUplEntries(selectUplEntries(entries, {
        ...selection,
        ids: [],
      }))
      : [];
    const targetIds = [...new Set([...selection.ids, ...matchedEntries.map((entry) => entry.id)])];
    if (targetIds.length === 0) {
      throw new Error("no UPL entries matched the requested selection");
    }
    const beforeLiveField = boundary.compileLiveUplField({ ledger: upl, session });
    const update = boundary.updateUserPathEntryStatuses({
      ledger: upl,
      ids: targetIds,
      status,
      modifiedAt: new Date().toISOString(),
    });
    if (update.missing.length > 0) {
      throw new Error(`unknown UPL ids: ${update.missing.join(", ")}`);
    }
    const nextSessionUpl: BoundaryUserPathLedger = {
      specVersion: 1,
      userApprovedLawPaths: update.ledger.userApprovedLawPaths.filter((entry) => boundary.isSessionOverlayEntryId(entry.id)),
      userDeniedLawPaths: update.ledger.userDeniedLawPaths.filter((entry) => boundary.isSessionOverlayEntryId(entry.id)),
    };
    const nextGlobalLedger: BoundaryUserPathLedger = {
      ...update.ledger,
      userApprovedLawPaths: update.ledger.userApprovedLawPaths.filter((entry) => !boundary.isSessionOverlayEntryId(entry.id)),
      userDeniedLawPaths: update.ledger.userDeniedLawPaths.filter((entry) => !boundary.isSessionOverlayEntryId(entry.id)),
    };
    const changedGlobal = update.changed.some((entry) => !boundary.isSessionOverlayEntryId(entry.id));
    const savedGlobal = changedGlobal ? await boundary.saveUserPathLedger(nextGlobalLedger) : globalUpl;
    const saved = boundary.hasUserPathEntries(nextSessionUpl)
      ? boundary.mergeUserPathLedgers({
        baseLedger: savedGlobal,
        overlayLedger: nextSessionUpl,
      })
      : savedGlobal;
    const store = await ensureStore(boundary, {
      config,
      sessionsDir: home.sessionsDir,
    });
    store.replaceConfig({
      ...store.getConfig(),
      upl: saved,
      userLawIds: await buildEffectiveUserLawIds(boundary, store.getConfig(), saved),
    });
    await store.persist();
    const afterLiveField = boundary.compileLiveUplField({ ledger: saved, session });
    const changedDiff = update.changed.map((entry) => {
      const beforeEntry = entries.find((candidate) => candidate.id === entry.id) ?? entry;
      const beforeLive = liveStateForEntry({ entryId: entry.id, liveField: beforeLiveField });
      const afterLive = liveStateForEntry({ entryId: entry.id, liveField: afterLiveField });
      return {
        entry,
        beforeStatus: beforeEntry.status,
        afterStatus: entry.status,
        beforeLive: beforeLive.state,
        afterLive: afterLive.state,
        beforeLiveTag: beforeLive.trafficTag,
        afterLiveTag: afterLive.trafficTag,
        view: buildUplEntryView(entry),
      };
    });

    if (asJson) {
      printJson({
        action: subcommand,
        matchedIds: targetIds,
        changed: update.changed,
        unchanged: update.unchanged,
        diff: changedDiff,
      });
      return;
    }
    console.log(`${subcommand} UPL laws`);
    console.log(`matched: ${targetIds.length}`);
    console.log(`changed: ${update.changed.length}`);
    console.log(`unchanged: ${update.unchanged.length}`);
    for (const row of changedDiff) {
      console.log(`${row.entry.id} | ${row.entry.type} | ${row.beforeStatus} -> ${row.afterStatus} | ${row.beforeLive} -> ${row.afterLive}`);
      console.log(`  what it is: ${row.view.whatItIs}`);
      console.log(`  connects to: ${row.view.connectsTo}`);
    }
    for (const entry of update.unchanged) {
      console.log(`unchanged | ${entry.id} | ${entry.type} | ${entry.status} | ${entry.path}`);
    }
    return;
  }

  if (subcommand === "sync") {
    let scope: BoundaryUplScope = "GLOBAL";
    let laneSelection: UplSourceLane | null = null;
    for (let index = 1; index < rest.length; index += 1) {
      const token = rest[index];
      if (token === "--scope") {
        const rawScope = (rest[index + 1] ?? usage()).toUpperCase();
        if (rawScope !== "GLOBAL" && rawScope !== "SESSION") {
          throw new Error(`unsupported UPL sync scope: ${rawScope}`);
        }
        scope = rawScope;
        index += 1;
        continue;
      }
      if (token === "--lane") {
        laneSelection = parseUplSourceLaneToken(rest[index + 1] ?? usage());
        if (!laneSelection) {
          throw new Error(`unsupported UPL lane: ${rest[index + 1] ?? ""}`);
        }
        index += 1;
        continue;
      }
      if (token === "--json") {
        continue;
      }
      usage();
    }

    const result = await syncUplDocumentSources({
      boundary,
      home,
      config,
      scope,
      laneSelection,
    });
    if (scope === "GLOBAL" && !laneSelection) {
      await saveUplAutoSyncState(home.uplAutoSyncStatePath, {
        fingerprint: result.fingerprint,
        syncedAt: new Date().toISOString(),
        fileCount: result.laneFiles.reduce((sum, lane) => sum + lane.files.length, 0),
      });
    }

    if (asJson) {
      printJson({
        scope: result.scope,
        root: result.root,
        lanes: result.laneFiles.map((lane) => ({
          lane: lane.spec.lane,
          dir: lane.spec.dir,
          files: lane.files,
        })),
        imported: result.imported,
      });
      return;
    }
    console.log(``);
    printCliHeader("  UPL Sync");
    const laneRows = result.laneFiles.map((lane) =>
      formatCliKeyValue(lane.spec.lane, `${lane.files.length} file${lane.files.length === 1 ? "" : "s"}  ${clrDim(lane.spec.dir)}`),
    );
    printCliSection("Lanes", [
      formatCliKeyValue("scope", result.scope),
      ...laneRows,
    ]);
    if (result.imported.length === 0) {
      console.log(`  ${clrWarn("⚠")}  No authored UPL markdown documents found.`);
      console.log(`  ${clrDim("Add .md files under acceptance or denial, then run")} buccet upl sync ${clrDim("again.")}`);
      console.log(``);
      return;
    }
    console.log(`  ${clrOk("✓")}  ${clrBold(`${result.imported.reduce((s, e) => s + e.imported, 0)} laws`)} imported across ${result.imported.length} file${result.imported.length === 1 ? "" : "s"}`);
    console.log(``);
    for (const entry of result.imported) {
      const typeColor = entry.lane === "acceptance" ? c.green : c.red;
      console.log(`  ${typeColor}${entry.lane}${c.reset}  ${entry.imported} laws  ${clrDim(entry.file)}${entry.entries.length ? `  ${clrDim(entry.entries.join(", "))}` : ""}`);
    }
    console.log(``);
    return;
  }

  if (subcommand === "import") {
    let scope: "GLOBAL" | "SESSION" = "GLOBAL";
    const files: string[] = [];
    const callerCwd = resolveCallerCwd();
    for (let index = 1; index < rest.length; index += 1) {
      const token = rest[index];
      if (token === "--scope") {
        const rawScope = (rest[index + 1] ?? usage()).toUpperCase();
        if (rawScope !== "GLOBAL" && rawScope !== "SESSION") {
          throw new Error(`unsupported UPL import scope: ${rawScope}`);
        }
        scope = rawScope;
        index += 1;
        continue;
      }
      if (token === "--json") {
        continue;
      }
      files.push(path.resolve(callerCwd, token));
    }
    if (files.length === 0) {
      usage();
    }

    const store = await ensureStore(boundary, {
      config,
      sessionsDir: home.sessionsDir,
    });
    let upl = await boundary.loadUserPathLedger();
    const imported: Array<{ file: string; imported: number; entries: string[] }> = [];

    for (const filePath of files) {
      const markdown = await fs.readFile(filePath, "utf8");
      const extracted = boundary.extractDocumentLawsWithDiagnostics({
        sourcePath: filePath,
        markdown,
      });
      validateExtractedDocumentLane({
        filePath,
        compiled: extracted.laws,
        diagnostics: extracted.diagnostics,
      });
      const result = await importCompiledDocumentLaws({
        boundary,
        config,
        store,
        upl,
        filePath,
        compiled: extracted.laws,
        scope,
        importReason: `document law imported from ${path.basename(filePath)}`,
        metadata: {
          import_mode: "upl_import",
        },
      });
      upl = result.upl;

      imported.push({
        file: filePath,
        imported: result.imported,
        entries: result.entryIds,
      });
    }

    store.replaceConfig({
      ...store.getConfig(),
      upl,
      userLawIds: await buildEffectiveUserLawIds(boundary, store.getConfig(), upl),
    });
    await store.persist();

    if (asJson) {
      printJson({ scope, imported });
      return;
    }
    console.log(`Imported document law into UPL`);
    console.log(`scope: ${scope}`);
    for (const entry of imported) {
      console.log(`${entry.file} | laws=${entry.imported}${entry.entries.length ? ` | entries=${entry.entries.join(",")}` : ""}`);
    }
    return;
  }

  usage();
}

async function handlePath(rest: string[]) {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  const callerCwd = resolveCallerCwd();
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
  if (subcommand === "show" || subcommand === "run" || subcommand === "watch") {
    await ensureRuntimeUplAutoSync({
      boundary,
      home,
      config,
    });
  }

  if (subcommand === "list") {
    const library = await loadPersistedBuccetPathLibrary(boundary, home);
    const templates = Object.values(library).sort((left, right) => left.pathName.localeCompare(right.pathName));
    if (asJson) {
      printJson({
        libraryPath: home.pathLibraryPath,
        paths: templates.map((template) => ({
          pathName: template.pathName,
          domain: template.domain,
          sourceCount: template.pathSources.length,
          agentCount: template.agentRoster.length,
          stageCount: template.stages.length,
        })),
      });
      return;
    }
    printCliHeader("Buccet Path Library");
    printCliSection("Library", [
      formatCliKeyValue("path", home.pathLibraryPath),
      formatCliKeyValue("templates", templates.length),
    ]);
    printCliSection("Paths", templates.map((template) => (
      `${template.pathName}  |  domain=${template.domain}  |  sources=${template.pathSources.length}  |  agents=${template.agentRoster.length}  |  stages=${template.stages.length}`
    )));
    return;
  }

  if (subcommand === "show") {
    const pathName = rest.find((token, index) => index > 0 && token !== "--json");
    if (!pathName) {
      usage();
    }
    const library = await loadPersistedBuccetPathLibrary(boundary, home);
    const existing = boundary.getBuccetPathTemplate(library, pathName);
    if (!existing) {
      throw new Error(`unknown Buccet path: ${pathName}`);
    }
    const template = boundary.buccetPathTemplateNeedsLawfulSurfaceMaterialization(existing)
      ? await ensureConcreteBuccetPathTemplate({
        boundary,
        home,
        config,
        library,
        pathName,
        userRequest: `inspect path ${pathName}`,
      })
      : existing;
    if (!template) {
      throw new Error(`unknown Buccet path: ${pathName}`);
    }
    await savePersistedBuccetPathLibrary(boundary, home, library);
    if (asJson) {
      printJson({
        libraryPath: home.pathLibraryPath,
        path: template,
      });
      return;
    }
    printCliHeader(`Buccet Path — ${template.pathName}`);
    printCliSection("Identity", [
      formatCliKeyValue("domain", template.domain),
      formatCliKeyValue("title", template.title),
      formatCliKeyValue("sources", template.pathSources.length),
      formatCliKeyValue("agents", template.agentRoster.length),
      formatCliKeyValue("stages", template.stages.length),
    ]);
    printCliSection("Sources", template.pathSources.length > 0
      ? template.pathSources.map((source) => `${source.id}  |  ${source.title}  |  kind=${source.kind}${source.sourceUri ? `  |  ${source.sourceUri}` : ""}`)
      : ["none"]);
    printCliSection("Agents", template.agentRoster.map((agent) => {
      const sourceTitles = template.pathSources
        .filter((source) => (agent.sourceIds ?? []).includes(source.id))
        .map((source) => source.title);
      return `${agent.id}  |  ${agent.title}  |  sources=${sourceTitles.join(", ") || "all path sources"}`;
    }));
    printCliSection("Stages", template.stages.map((stage) => {
      const sourceTitles = template.pathSources
        .filter((source) => (stage.sourceIds ?? []).includes(source.id))
        .map((source) => source.title);
      return `${stage.id}  |  owners=${stage.agentIds.join(", ")}  |  sources=${sourceTitles.join(", ") || "agent memory banks"}`;
    }));
    return;
  }

  if (subcommand === "run") {
    const pathName = rest[1];
    if (!pathName) {
      usage();
    }
    let requestText: string | undefined;
    let domain: string | undefined;
    let steps = 1;
    let runAll = false;
    let fresh = false;
    for (let index = 2; index < rest.length; index += 1) {
      const token = rest[index];
      if (token === "--request") {
        requestText = rest[index + 1] ?? usage();
        index += 1;
        continue;
      }
      if (token === "--domain") {
        domain = rest[index + 1] ?? usage();
        index += 1;
        continue;
      }
      if (token === "--steps") {
        const parsed = Number(rest[index + 1] ?? usage());
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error(`invalid --steps value: ${rest[index + 1]}`);
        }
        steps = Math.floor(parsed);
        index += 1;
        continue;
      }
      if (token === "--all") {
        runAll = true;
        continue;
      }
      if (token === "--fresh") {
        fresh = true;
        continue;
      }
      if (token === "--json") {
        continue;
      }
      usage();
    }
    const boundary = await importBoundary(homePath);
    await assertNoActiveQuarantine({
      boundary,
      sessionId: config.sessionId,
      sessionsDir: home.sessionsDir,
    });
    const library = await loadPersistedBuccetPathLibrary(boundary, home);
    const store = await loadPersistedBuccetPathMemoryStore(boundary, home);
    await ensureConcreteBuccetPathTemplate({
      boundary,
      home,
      config,
      library,
      pathName,
      userRequest: requestText ?? `run ${pathName}`,
      ...(domain ? { domain } : {}),
    });
    let formation = !fresh ? store.findBySessionAndPath(config.sessionId, pathName) as BuccetPathFormationState | null : null;
    let started = "resumed";
    if (!formation || isTerminalPathFormation(formation)) {
      formation = boundary.instantiateBuccetFormation({
        sessionId: config.sessionId,
        userRequest: requestText ?? `run ${pathName}`,
        pathName,
        library,
      }) as BuccetPathFormationState;
      started = "created";
    } else if (requestText) {
      formation = {
        ...formation,
        userRequest: requestText,
        context: {
          ...formation.context,
          user_request: requestText,
        },
      };
    }
    if (boundary.buccetFormationNeedsLawfulSurfaceMaterialization(formation)) {
      formation = boundary.materializeBuccetFormationLawfulSurface({
        state: formation,
        uplBindings: await resolveRuntimeBuccetPathUplBindings(boundary, home, config),
      }) as BuccetPathFormationState;
    }
    let advancedSteps = 0;
    while (formation.status === "RUNNING" && (runAll || advancedSteps < steps)) {
      formation = advanceFormationStep(boundary, formation);
      advancedSteps += 1;
    }
    store.remember(formation);
    await savePersistedBuccetPathLibrary(boundary, home, library);
    await savePersistedBuccetPathMemoryStore(boundary, home, store);
    const liveView = boundary.describeBuccetFormationLiveView(formation);
    if (asJson) {
      printJson({
        libraryPath: home.pathLibraryPath,
        formationsPath: home.pathFormationSnapshotPath,
        started,
        advancedSteps,
        formation,
        liveView,
        terminalResult: isTerminalPathFormation(formation) ? boundary.getBuccetFormationTerminalResult(formation) : null,
      });
      return;
    }
    printCliHeader("Buccet Path Run");
    printCliSection("Run", [
      formatCliKeyValue("path", formation.pathName),
      formatCliKeyValue("formation", formation.formationId),
      formatCliKeyValue("mode", started),
      formatCliKeyValue("advanced steps", advancedSteps),
      formatCliKeyValue("status", formation.status),
    ]);
    process.stdout.write(boundary.renderBuccetFormationLiveView(formation));
    if (isTerminalPathFormation(formation)) {
      console.log(`terminal_result: ${String(boundary.getBuccetFormationTerminalResult(formation) ?? "none")}`);
    }
    return;
  }

  if (subcommand === "watch") {
    const selector = rest.find((token, index) => index > 0 && !token.startsWith("--"));
    if (!selector) {
      usage();
    }
    let follow = false;
    let intervalMs = 1000;
    for (let index = 1; index < rest.length; index += 1) {
      const token = rest[index];
      if (token === "--follow") {
        follow = true;
        continue;
      }
      if (token === "--interval-ms") {
        const parsed = Number(rest[index + 1] ?? usage());
        if (!Number.isFinite(parsed) || parsed <= 0) {
          throw new Error(`invalid --interval-ms value: ${rest[index + 1]}`);
        }
        intervalMs = Math.floor(parsed);
        index += 1;
        continue;
      }
      if (token === "--json" || !token.startsWith("--")) {
        continue;
      }
      usage();
    }
    const boundary = await importBoundary(homePath);
    let store = await loadPersistedBuccetPathMemoryStore(boundary, home);
    let formation = resolveFormationSelector({
      store,
      selector,
      sessionId: config.sessionId,
    });
    if (!formation) {
      throw new Error(`unknown Buccet path formation or path: ${selector}`);
    }
    if (boundary.buccetFormationNeedsLawfulSurfaceMaterialization(formation)) {
      formation = boundary.materializeBuccetFormationLawfulSurface({
        state: formation,
        uplBindings: await resolveRuntimeBuccetPathUplBindings(boundary, home, config),
      }) as BuccetPathFormationState;
      store.remember(formation);
      await savePersistedBuccetPathMemoryStore(boundary, home, store);
    }
    if (asJson) {
      printJson({
        formationsPath: home.pathFormationSnapshotPath,
        formation,
        liveView: boundary.describeBuccetFormationLiveView(formation),
        terminalResult: isTerminalPathFormation(formation) ? boundary.getBuccetFormationTerminalResult(formation) : null,
      });
      return;
    }
    let lastRendered = "";
    for (;;) {
      const rendered = boundary.renderBuccetFormationLiveView(formation);
      if (rendered !== lastRendered) {
        if (lastRendered) {
          console.log("");
        }
        process.stdout.write(rendered);
        if (isTerminalPathFormation(formation)) {
          console.log(`terminal_result: ${String(boundary.getBuccetFormationTerminalResult(formation) ?? "none")}`);
        }
        lastRendered = rendered;
      }
      if (!follow || isTerminalPathFormation(formation)) {
        return;
      }
      await sleep(intervalMs);
      store = await loadPersistedBuccetPathMemoryStore(boundary, home);
      const next = resolveFormationSelector({
        store,
        selector: formation.formationId,
        sessionId: config.sessionId,
      });
      if (!next) {
        throw new Error(`formation disappeared while watching: ${formation.formationId}`);
      }
      formation = next;
    }
  }

  if (subcommand === "formations") {
    const action = rest[1];
    if (action !== "list") {
      usage();
    }
    const boundary = await importBoundary(homePath);
    const store = await loadPersistedBuccetPathMemoryStore(boundary, home);
    const includeAllSessions = rest.includes("--all-sessions");
    const formations = (includeAllSessions ? store.list() : store.listBySession(config.sessionId))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    if (asJson) {
      printJson({
        formationsPath: home.pathFormationSnapshotPath,
        formations: formations.map((formation) => ({
          formationId: formation.formationId,
          sessionId: formation.sessionId,
          pathName: formation.pathName,
          domain: formation.domain,
          status: formation.status,
          currentStageId: formation.stages[formation.currentStageIndex]?.id ?? null,
          updatedAt: formation.updatedAt,
          sourceCount: formation.pathSources.length,
        })),
      });
      return;
    }
    printCliHeader("Buccet Path Formations");
    printCliSection("Store", [
      formatCliKeyValue("path", home.pathFormationSnapshotPath),
      formatCliKeyValue("formations", formations.length),
    ]);
    printCliSection("Formations", formations.length > 0
      ? formations.map((formation) => (
        `${formation.formationId}  |  path=${formation.pathName}  |  domain=${formation.domain}  |  status=${formation.status}  |  stage=${formation.stages[formation.currentStageIndex]?.id ?? "none"}  |  sources=${formation.pathSources.length}`
      ))
      : ["none"]);
    return;
  }

  if (subcommand === "close") {
    const selector = rest.find((token, index) => index > 0 && token !== "--json");
    if (!selector) {
      usage();
    }
    const boundary = await importBoundary(homePath);
    const store = await loadPersistedBuccetPathMemoryStore(boundary, home);
    const formation = resolveFormationSelector({
      store,
      selector,
      sessionId: config.sessionId,
    });
    if (!formation) {
      throw new Error(`unknown Buccet path formation or path: ${selector}`);
    }
    store.remove(formation.formationId);
    await savePersistedBuccetPathMemoryStore(boundary, home, store);
    if (asJson) {
      printJson({
        formationsPath: home.pathFormationSnapshotPath,
        closedFormationId: formation.formationId,
        pathName: formation.pathName,
      });
      return;
    }
    console.log(`Closed Buccet formation`);
    console.log(`formation: ${formation.formationId}`);
    console.log(`path: ${formation.pathName}`);
    return;
  }

  if (subcommand === "sources") {
    const action = rest[1];
    if (action === "add") {
      const pathName = rest[2];
      if (!pathName) {
        usage();
      }
      let domain: string | undefined;
      const inputs: string[] = [];
      for (let index = 3; index < rest.length; index += 1) {
        const token = rest[index];
        if (token === "--domain") {
          domain = rest[index + 1] ?? usage();
          index += 1;
          continue;
        }
        if (token === "--json") {
          continue;
        }
        inputs.push(path.resolve(callerCwd, token));
      }
      if (inputs.length === 0) {
        usage();
      }
      const filePaths = await collectPathSourceFiles(inputs);
      if (filePaths.length === 0) {
        console.log(`No supported source files found in: ${inputs.join(", ")}`);
        console.log(`Supported: ${[...PATH_SOURCE_SUPPORTED_EXTENSIONS].join(", ")}`);
        return;
      }
      const newSources = await compilePathSourcesFromFiles({ filePaths });
      const library = await loadPersistedBuccetPathLibrary(boundary, home);
      const template = await ensureConcreteBuccetPathTemplate({
        boundary,
        home,
        config,
        library,
        pathName,
        userRequest: `enrich path ${pathName} with sources`,
        ...(domain ? { domain } : {}),
      });
      const nextSources = [...template.pathSources];
      for (const source of newSources) {
        const existingIndex = nextSources.findIndex((entry) => entry.id === source.id);
        if (existingIndex >= 0) {
          nextSources[existingIndex] = source;
        } else {
          nextSources.push(source);
        }
      }
      library[pathName] = boundary.createBuccetPathTemplate({
        pathName,
        userRequest: `enrich path ${pathName} with sources`,
        draft: {
          domain: domain ?? template.domain,
          title: template.title,
          summary: template.summary,
          modelHint: template.modelHint,
          laws: template.laws,
          tools: template.tools,
          pathSources: nextSources,
          uplBindings: template.uplBindings,
          agentRoster: template.agentRoster,
          stages: template.stages,
        },
      });
      await savePersistedBuccetPathLibrary(boundary, home, library);
      if (asJson) {
        printJson({
          libraryPath: home.pathLibraryPath,
          pathName,
          domain: library[pathName]!.domain,
          addedSources: newSources,
          totalSources: library[pathName]!.pathSources.length,
        });
        return;
      }
      console.log(`Added path sources`);
      console.log(`path: ${pathName}`);
      console.log(`domain: ${library[pathName]!.domain}`);
      console.log(`scanned: ${filePaths.length} file${filePaths.length === 1 ? "" : "s"}`);
      console.log(`added: ${newSources.length}`);
      console.log(`skipped: ${filePaths.length - newSources.length}`);
      console.log(`total sources: ${library[pathName]!.pathSources.length}`);
      for (const source of newSources) {
        console.log(`- ${source.title} | ${source.sourceUri ?? source.id}`);
      }
      return;
    }

    if (action === "list") {
      const pathName = rest.find((token, index) => index > 1 && token !== "--json");
      if (!pathName) {
        usage();
      }
      const library = await loadPersistedBuccetPathLibrary(boundary, home);
      const template = boundary.getBuccetPathTemplate(library, pathName);
      if (!template) {
        throw new Error(`unknown Buccet path: ${pathName}`);
      }
      if (asJson) {
        printJson({
          libraryPath: home.pathLibraryPath,
          pathName,
          domain: template.domain,
          sources: template.pathSources,
        });
        return;
      }
      console.log(`Path sources for ${pathName}`);
      console.log(`domain: ${template.domain}`);
      console.log(`count: ${template.pathSources.length}`);
      for (const source of template.pathSources) {
        console.log(`- ${source.id} | ${source.title} | ${source.kind}${source.sourceUri ? ` | ${source.sourceUri}` : ""}`);
      }
      return;
    }
  }

  usage();
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

  await assertNoActiveQuarantine({
    boundary,
    sessionId: nextConfig.sessionId,
    sessionsDir: home.sessionsDir,
  });

  await saveConfig(home.configPath, nextConfig);
  await ensureRuntimeUplAutoSync({
    boundary,
    home,
    config: nextConfig,
  });
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

  if (!(await pathExists(home.nativeLibraryPath))) {
    await handleHook(["build", "--quiet"]);
  }
  const hookHealth = await getHookRuntimeHealth(boundary, home);
  if (!hookHealth.healthy) {
    await handleHook(["start", "--quiet"]);
  }
  await waitForHookRuntimeHealthy(boundary, home);

  const hookEnv = {
    AGENT_BUCCET_HOME: home.homePath,
    AGENT_BUCCET_INTERCEPT_SOCKET: home.interceptSocketPath,
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
    env: hookEnv,
  });

  console.log(`exit code: ${runResult.exitCode}`);
  process.exitCode = runResult.exitCode;
}

async function handleTransport(rest: string[]) {
  const subcommand = rest[0];
  const callerCwd = resolveCallerCwd();
  if (!subcommand) {
    usage();
  }

  if (subcommand === "pack" || subcommand === "export") {
    const sourceDir = rest[1] ? path.resolve(callerCwd, rest[1]) : usage();
    const separatorIndex = rest.indexOf("--");
    const optionArgs = separatorIndex === -1 ? rest.slice(2) : rest.slice(2, separatorIndex);
    const entrypoint = separatorIndex === -1 ? [] : rest.slice(separatorIndex + 1);

    let outputPath = defaultTransportArtifactPath(sourceDir);
    let name: string | undefined;
    let workdir = "/";
    let asJson = false;
    let withLaw = false;

    for (let index = 0; index < optionArgs.length; index += 1) {
      const token = optionArgs[index];
      if (token === "--output") {
        outputPath = path.resolve(callerCwd, optionArgs[index + 1] ?? usage());
        index += 1;
        continue;
      }
      if (token === "--name") {
        name = optionArgs[index + 1] ?? usage();
        index += 1;
        continue;
      }
      if (token === "--workdir") {
        workdir = optionArgs[index + 1] ?? usage();
        index += 1;
        continue;
      }
      if (token === "--with-law") {
        withLaw = true;
        continue;
      }
      if (token === "--json") {
        asJson = true;
        continue;
      }
      usage();
    }

    const packBoundary = withLaw ? await importBoundary(resolveHome()) : undefined;
    const result = await packBuccetTransportArtifact({
      sourceDir,
      outputPath,
      name,
      workdir,
      entrypoint,
      withLaw,
      boundary: packBoundary,
    });

    if (asJson) {
      printJson(result);
      return;
    }

    console.log(`Buccet transport ${subcommand}`);
    console.log(`source: ${result.sourceDir}`);
    console.log(`artifact: ${result.artifactPath}`);
    console.log(`name: ${result.manifest.name}`);
    console.log(`workdir: ${result.manifest.workdir}`);
    console.log(`files: ${result.manifest.fileCount}`);
    console.log(`entrypoint: ${result.manifest.entrypoint.length > 0 ? result.manifest.entrypoint.join(" ") : "(none)"}`);
    if (result.lawEntryCount !== undefined) {
      console.log(`law entries: ${result.lawEntryCount} (ledger-witnessed)`);
    }
    return;
  }

  if (subcommand === "import") {
    const artifactPath = rest[1] ? path.resolve(callerCwd, rest[1]) : usage();
    let destinationDir = defaultTransportImportDir(artifactPath);
    let asJson = false;

    for (let index = 2; index < rest.length; index += 1) {
      const token = rest[index];
      if (token === "--into") {
        destinationDir = path.resolve(callerCwd, rest[index + 1] ?? usage());
        index += 1;
        continue;
      }
      if (token === "--json") {
        asJson = true;
        continue;
      }
      usage();
    }

    const result = await importBuccetTransportArtifact({
      artifactPath,
      destinationDir,
    });

    if (asJson) {
      printJson(result);
      return;
    }

    console.log(`Buccet transport import`);
    console.log(`artifact: ${artifactPath}`);
    console.log(`destination: ${result.destinationDir}`);
    console.log(`rootfs: ${result.rootfsPath}`);
    console.log(`name: ${result.manifest.name}`);
    return;
  }

  if (subcommand === "run") {
    const artifactOrDir = rest[1] ? path.resolve(callerCwd, rest[1]) : usage();
    const separatorIndex = rest.indexOf("--");
    const optionArgs = separatorIndex === -1 ? rest.slice(2) : rest.slice(2, separatorIndex);
    const command = separatorIndex === -1 ? [] : rest.slice(separatorIndex + 1);
    let runtimeDir: string | undefined;
    let unitId = `transport-${Date.now()}`;
    let asJson = false;

    for (let index = 0; index < optionArgs.length; index += 1) {
      const token = optionArgs[index];
      if (token === "--into") {
        runtimeDir = path.resolve(callerCwd, optionArgs[index + 1] ?? usage());
        index += 1;
        continue;
      }
      if (token === "--unit-id") {
        unitId = optionArgs[index + 1] ?? usage();
        index += 1;
        continue;
      }
      if (token === "--json") {
        asJson = true;
        continue;
      }
      usage();
    }

    const result = await runBuccetTransport({
      artifactOrDir,
      runtimeDir,
      unitId,
      command,
    });

    if (asJson) {
      printJson(result);
    } else {
      console.log(`Buccet transport run`);
      console.log(`name: ${result.manifest.name}`);
      console.log(`runtime: ${result.runtimeDir}`);
      console.log(`cwd: ${result.launchCwd}`);
      console.log(`command: ${result.command.join(" ")}`);
      console.log(`isolation active: ${result.isolationActive ? "yes" : "deferred"}`);
      console.log(`persisted state: ${result.persistedState ? "yes" : "no"}`);
      console.log(`entered environment: ${result.enteredEnvironment ? "yes" : "no"}`);
      console.log(`exit code: ${result.exitCode}`);
    }

    process.exitCode = result.exitCode;
    return;
  }

  usage();
}

function toShedHistoryEntry(record: {
  META: { event_type: string };
  payload: {
    sessionId: string;
    actorId: string;
    requestId?: string;
    actionKind?: string;
    target?: string;
    reason?: string;
    createdAt?: string;
    lawIds?: string[];
    metadata?: Record<string, unknown>;
  };
}): BuccetShedHistoryEntry | null {
  if (record.META.event_type !== "DISPOSABLE_SHED_TRIGGERED" && record.META.event_type !== "DISPOSABLE_RESPAWNED") {
    return null;
  }
  return {
    eventType: record.META.event_type,
    sessionId: record.payload.sessionId,
    actorId: record.payload.actorId,
    requestId: record.payload.requestId,
    actionKind: record.payload.actionKind,
    target: record.payload.target,
    reason: record.payload.reason,
    createdAt: record.payload.createdAt ?? "",
    lawIds: record.payload.lawIds ?? [],
    metadata: record.payload.metadata ?? {},
  };
}

async function buildShedStatusPayload(args: {
  boundary: Awaited<ReturnType<typeof importBoundary>>;
  sessionId: string;
  limit: number;
}): Promise<BuccetShedStatusPayload> {
  const records = await args.boundary.readAllBoundaryLedgerRecords();
  const entries = records
    .map((record) => toShedHistoryEntry(record))
    .filter((entry): entry is BuccetShedHistoryEntry => Boolean(entry))
    .filter((entry) => entry.sessionId === args.sessionId);
  const tail = entries.slice(-Math.max(1, args.limit));
  return {
    sessionId: args.sessionId,
    shedCount: entries.filter((entry) => entry.eventType === "DISPOSABLE_SHED_TRIGGERED").length,
    respawnCount: entries.filter((entry) => entry.eventType === "DISPOSABLE_RESPAWNED").length,
    latest: entries.at(-1),
    entries: tail,
  };
}

async function handleShed(rest: string[]) {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  const config = await loadConfig(home.configPath);
  if (!config) {
    throw new Error("Agent Buccet is not initialized. Run `buccet init` first.");
  }

  const boundary = await importBoundary(homePath);
  const subcommand = rest[0];

  if (subcommand === "status") {
    let limit = 10;
    const asJson = rest.includes("--json");
    for (let index = 1; index < rest.length; index += 1) {
      const token = rest[index];
      if (token === "--limit") {
        limit = Number(rest[index + 1] ?? usage());
        index += 1;
        continue;
      }
      if (token === "--json") {
        continue;
      }
      usage();
    }

    const payload = await buildShedStatusPayload({
      boundary,
      sessionId: config.sessionId,
      limit,
    });

    if (asJson) {
      printJson(payload);
      return;
    }

    printCliHeader("  Disposable Shed History");
    printCliSection("Summary", [
      formatCliKeyValue("session", payload.sessionId),
      formatCliKeyValue("shed count", payload.shedCount),
      formatCliKeyValue("respawns", payload.respawnCount),
      formatCliKeyValue("latest", payload.latest?.createdAt ?? "none"),
    ]);
    printCliSection("Entries", payload.entries.length > 0
      ? payload.entries.map((entry) => (
        `${entry.createdAt} | ${entry.eventType} | ${entry.actionKind ?? "-"} | ${entry.reason ?? "-"}`
      ))
      : ["No shed events recorded for this session."]);
    console.log("");
    return;
  }

  let reason = "operator forced denial-side shed and clean disposable respawn";
  const asJson = rest.includes("--json");
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--reason") {
      reason = rest[index + 1] ?? usage();
      index += 1;
      continue;
    }
    if (token === "--json") {
      continue;
    }
    if (index === 0 && !token.startsWith("--")) {
      usage();
    }
  }

  const store = await ensureStore(boundary, {
    config,
    sessionsDir: home.sessionsDir,
  });
  const result = await boundary.shedBoundarySessionSkin({
    config: store.getConfig(),
    reason,
    issuedBy: config.actorId,
  });

  if (asJson) {
    printJson(result);
    return;
  }

  printCliHeader("  Shed Complete");
  printCliSection("Respawn", [
    formatCliKeyValue("unit", result.unitId),
    formatCliKeyValue("source", result.sourceDomain),
    formatCliKeyValue("trust", result.trustDomain),
    formatCliKeyValue("runtime", result.runtimeDir),
    formatCliKeyValue("rootfs", result.rootfsDir),
    formatCliKeyValue("isolation", result.isolationActive ? "active" : "deferred"),
    formatCliKeyValue("persisted", result.persistedState ? "yes" : "no"),
    formatCliKeyValue("entered", result.enteredEnvironment ? "yes" : "no"),
    formatCliKeyValue("started", result.lifecycleStarted ? "yes" : "no"),
    formatCliKeyValue("snapshot", result.snapshotPath),
  ]);
  console.log("");
}

async function buildQuarantineStatusPayload(args: {
  boundary: Awaited<ReturnType<typeof importBoundary>>;
  sessionId: string;
  sessionsDir: string;
  limit: number;
}): Promise<BuccetQuarantineStatusPayload> {
  const status = await args.boundary.getBoundaryQuarantineStatus({
    sessionId: args.sessionId,
    sessionsDir: args.sessionsDir,
  });
  const report = status.report;
  const tail = report
    ? report.items
      .filter((item) => item.verdict === "pit")
      .slice(0, Math.max(1, args.limit))
    : [];
  return {
    sessionId: args.sessionId,
    required: Boolean(status.quarantineState?.required),
    status: status.quarantineState?.status ?? "inactive",
    triggeredAt: status.quarantineState?.triggeredAt,
    reason: status.quarantineState?.reason,
    total: report?.total ?? 0,
    processedItems: report?.processedItems ?? 0,
    complete: report?.complete ?? false,
    survivors: report?.survivorCount ?? 0,
    pitCount: report?.pitCount ?? 0,
    pendingCount: report?.items.filter((item) => item.verdict === "pit" && item.resolution === "pending").length ?? 0,
    totalShards: report?.totalShards ?? 0,
    completedShards: report?.completedShards ?? 0,
    shardSize: report?.shardSize ?? 0,
    workerCount: report?.workerCount ?? 0,
    entries: tail,
  };
}

function formatQuarantineEntry(entry: BuccetQuarantineEntry, index?: number): string {
  const prefix = index === undefined ? entry.itemId : `[${index + 1}] ${entry.itemId}`;
  return `${prefix} | ${entry.side} | ${entry.actionKind ?? "-"} | ${entry.target ?? entry.path} | ${entry.reason}`;
}

async function streamToBuffer(stream: NodeJS.ReadStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks);
}

async function runInteractiveQuarantineReview(args: {
  boundary: Awaited<ReturnType<typeof importBoundary>>;
  sessionId: string;
  sessionsDir: string;
  input: NodeJS.ReadStream;
  output: NodeJS.WriteStream;
}): Promise<{
  cleared: boolean;
  required: boolean;
  remaining: number;
}> {
  const interactive = Boolean(args.input.isTTY && args.output.isTTY);
  const rl = interactive
    ? readline.createInterface({
        input: args.input,
        output: args.output,
        terminal: true,
      })
    : null;
  const scriptedAnswers = interactive
    ? []
    : String(await streamToBuffer(args.input))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

  const ask = async (prompt: string) => {
    if (rl) {
      return new Promise<string>((resolve) => rl.question(prompt, resolve));
    }
    args.output.write(prompt);
    return scriptedAnswers.shift() ?? "q";
  };

  const loadPayload = async () =>
    buildQuarantineStatusPayload({
      boundary: args.boundary,
      sessionId: args.sessionId,
      sessionsDir: args.sessionsDir,
      limit: Number.MAX_SAFE_INTEGER,
    });

  try {
    let payload = await loadPayload();
    if (!payload.required) {
      return {
        cleared: true,
        required: false,
        remaining: 0,
      };
    }

    let pendingEntries = payload.entries.filter((entry) => entry.verdict === "pit" && entry.resolution === "pending");
    let reviewIndex = 0;

    while (true) {
      if (!payload.required || pendingEntries.length === 0) {
        console.log("");
        printCliHeader("  Quarantine Cleared");
        printCliSection("Result", [
          formatCliKeyValue("session", payload.sessionId),
          formatCliKeyValue("remaining", 0),
          formatCliKeyValue("clean boot", "ready"),
        ]);
        console.log("");
        return {
          cleared: true,
          required: false,
          remaining: 0,
        };
      }

      console.log("");
      printCliHeader("  Shed Reboot — Boundary on Self");
      printCliSection("Quarantine", [
        formatCliKeyValue("session", payload.sessionId),
        formatCliKeyValue("status", payload.status),
        formatCliKeyValue("processed", `${payload.processedItems}/${payload.total}`),
        formatCliKeyValue("survivors", payload.survivors),
        formatCliKeyValue("pit", payload.pitCount),
        formatCliKeyValue("pending", payload.pendingCount),
        formatCliKeyValue("shards", `${payload.completedShards}/${payload.totalShards}`),
      ]);

      console.log("  Resolve:");
      console.log("  1. deny all as law");
      console.log("  2. review one by one");
      console.log("  q. quit");
      const choice = (await ask("quarantine> ")).trim().toLowerCase();

      if (choice === "q" || choice === "quit" || choice === "exit") {
        return {
          cleared: false,
          required: true,
          remaining: pendingEntries.length,
        };
      }

      if (choice === "1" || choice === "deny-all") {
        const report = await args.boundary.applyBoundaryQuarantinePitDenials({
          sessionId: args.sessionId,
          sessionsDir: args.sessionsDir,
        });
        payload = await loadPayload();
        pendingEntries = payload.entries.filter((entry) => entry.verdict === "pit" && entry.resolution === "pending");
        console.log("");
        printCliHeader("  Quarantine Denials Recorded");
        printCliSection("Result", [
          formatCliKeyValue("session", payload.sessionId),
          formatCliKeyValue(
            "denied as law",
            report?.items.filter((item) => item.resolution === "denied_as_law").length ?? 0,
          ),
          formatCliKeyValue("remaining", pendingEntries.length),
        ]);
        continue;
      }

      if (choice !== "2" && choice !== "review") {
        console.log("  Unknown choice. Use 1, 2, or q.");
        continue;
      }

      while (pendingEntries.length > 0) {
        const entry = pendingEntries[Math.min(reviewIndex, pendingEntries.length - 1)];
        reviewIndex = Math.min(reviewIndex, pendingEntries.length - 1);

        console.log("");
        printCliHeader("  Quarantine Item Review");
        printCliSection("Entry", [
          formatCliKeyValue("index", `${reviewIndex + 1}/${pendingEntries.length}`),
          formatCliKeyValue("item", entry.itemId),
          formatCliKeyValue("side", entry.side),
          formatCliKeyValue("action", entry.actionKind ?? "-"),
          formatCliKeyValue("target", entry.target ?? entry.path),
          formatCliKeyValue("reason", entry.reason),
          formatCliKeyValue("laws", entry.lawIds.join(", ") || "-"),
        ]);
        console.log("  Review:");
        console.log("  1. deny this as law");
        console.log("  2. skip / next");
        console.log("  l. list caught set");
        console.log("  b. back");
        console.log("  q. quit");
        const reviewChoice = (await ask("review> ")).trim().toLowerCase();

        if (reviewChoice === "q" || reviewChoice === "quit" || reviewChoice === "exit") {
          return {
            cleared: false,
            required: true,
            remaining: pendingEntries.length,
          };
        }

        if (reviewChoice === "b" || reviewChoice === "back") {
          break;
        }

        if (reviewChoice === "l" || reviewChoice === "list") {
          console.log("");
          printCliSection(
            "Caught Set",
            pendingEntries.map((item, index) => formatQuarantineEntry(item, index)),
          );
          continue;
        }

        if (reviewChoice === "1" || reviewChoice === "deny") {
          await args.boundary.applyBoundaryQuarantinePitDenials({
            sessionId: args.sessionId,
            sessionsDir: args.sessionsDir,
            itemIds: [entry.itemId],
          });
          payload = await loadPayload();
          pendingEntries = payload.entries.filter((item) => item.verdict === "pit" && item.resolution === "pending");
          continue;
        }

        if (reviewChoice === "2" || reviewChoice === "skip" || reviewChoice === "next") {
          reviewIndex = (reviewIndex + 1) % pendingEntries.length;
          continue;
        }

        console.log("  Unknown choice. Use 1, 2, l, b, or q.");
      }
    }
  } finally {
    rl?.close();
  }
}

async function handleQuarantine(rest: string[]) {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  const config = await loadConfig(home.configPath);
  if (!config) {
    throw new Error("Agent Buccet is not initialized. Run `buccet init` first.");
  }

  const boundary = await importBoundary(homePath);
  const subcommand = rest[0] ?? "status";
  const asJson = rest.includes("--json");

  if (subcommand === "status") {
    let limit = 25;
    for (let index = 1; index < rest.length; index += 1) {
      const token = rest[index];
      if (token === "--limit") {
        limit = Number(rest[index + 1] ?? usage());
        index += 1;
        continue;
      }
      if (token === "--json") {
        continue;
      }
      usage();
    }

    const payload = await buildQuarantineStatusPayload({
      boundary,
      sessionId: config.sessionId,
      sessionsDir: home.sessionsDir,
      limit,
    });
    if (asJson) {
      printJson(payload);
      return;
    }

    printCliHeader("  Shed Reboot — Boundary on Self");
    printCliSection("Quarantine", [
      formatCliKeyValue("session", payload.sessionId),
      formatCliKeyValue("required", payload.required ? "yes" : "no"),
      formatCliKeyValue("status", payload.status),
      formatCliKeyValue("triggered", payload.triggeredAt ?? "-"),
      formatCliKeyValue("reason", payload.reason ?? "-"),
      formatCliKeyValue("processed", `${payload.processedItems}/${payload.total}`),
      formatCliKeyValue("survivors", payload.survivors),
      formatCliKeyValue("pit", payload.pitCount),
      formatCliKeyValue("pending", payload.pendingCount),
      formatCliKeyValue("shards", `${payload.completedShards}/${payload.totalShards}`),
      formatCliKeyValue("shard size", payload.shardSize || "-"),
      formatCliKeyValue("workers", payload.workerCount || "-"),
    ]);
    printCliSection("Caught Set", payload.entries.length > 0
      ? payload.entries.map((entry, index) => formatQuarantineEntry(entry, index))
      : ["No quarantine items recorded for this session."]);
    console.log("");
    return;
  }

  if (subcommand === "review") {
    const result = await runInteractiveQuarantineReview({
      boundary,
      sessionId: config.sessionId,
      sessionsDir: home.sessionsDir,
      input: process.stdin,
      output: process.stdout,
    });
    if (asJson) {
      printJson(result);
    }
    return;
  }

  if (subcommand === "deny-all" || subcommand === "deny") {
    const itemIds = subcommand === "deny"
      ? rest.slice(1).filter((token) => token !== "--json")
      : [];
    if (subcommand === "deny" && itemIds.length === 0) {
      usage();
    }

    const report = await boundary.applyBoundaryQuarantinePitDenials({
      sessionId: config.sessionId,
      sessionsDir: home.sessionsDir,
      ...(itemIds.length > 0 ? { itemIds } : {}),
    });
    if (!report) {
      const payload = {
        sessionId: config.sessionId,
        applied: 0,
        remaining: 0,
      };
      if (asJson) {
        printJson(payload);
        return;
      }
      console.log("No active quarantine state for this session.");
      return;
    }

    const applied = report.items.filter((item) => item.resolution === "denied_as_law").length;
    const remaining = report.items.filter((item) => item.verdict === "pit" && item.resolution === "pending").length;
    const payload = {
      sessionId: config.sessionId,
      applied,
      remaining,
      items: report.items,
    };
    if (asJson) {
      printJson(payload);
      return;
    }

    printCliHeader("  Quarantine Denials Recorded");
    printCliSection("Result", [
      formatCliKeyValue("session", payload.sessionId),
      formatCliKeyValue("denied as law", payload.applied),
      formatCliKeyValue("remaining", payload.remaining),
    ]);
    console.log("");
    return;
  }

  usage();
}

async function assertNoActiveQuarantine(args: {
  boundary: Awaited<ReturnType<typeof importBoundary>>;
  sessionId: string;
  sessionsDir: string;
}) {
  const sessionState = await args.boundary.loadBoundarySessionState({
    sessionId: args.sessionId,
    sessionsDir: args.sessionsDir,
  });
  if (sessionState?.quarantineState?.required) {
    throw new Error(
      "quarantine is active; normal runtime remains asleep until caught items are resolved. " +
      "Run `buccet quarantine status` first.",
    );
  }
}

async function handleUninstall() {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);

  // Stop the hook daemon before removing home so it cannot recreate run-dir files.
  const hookPid = await readHookPid(home.hookPidPath);
  if (hookPid) {
    await stopHookDaemonPid(hookPid);
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
  healthy?: boolean;
  pid?: number;
  state?: string;
  sessionId?: string;
  actorId?: string;
  interceptSocketPath?: string;
  gravityBridgeSocketPath?: string;
  brainStatusPath?: string;
  nativeLibraryPath?: string;
  interceptReady?: boolean;
  bridgeReady?: boolean;
  restarts?: number;
  lastError?: string;
  interceptReachable?: boolean;
  ledgerEntries?: number;
  interceptedAttempts?: number;
  canyonHeld?: number;
  pendingApprovals?: number;
};

function formatHookOperatorSummary(payload: HookStatusPayload): string {
  const posture = payload.healthy ? "protected" : payload.running ? "degraded" : "offline";
  const state = payload.state ?? (payload.running ? "running" : "missing");
  return `${posture} | state: ${state} | intercepted: ${payload.interceptedAttempts ?? 0} | canyon: ${payload.canyonHeld ?? 0} | pending: ${payload.pendingApprovals ?? 0}`;
}

function printHookStatusDetails(payload: HookStatusPayload): void {
  console.log(`initialized: ${payload.initialized ? "yes" : "no"}`);
  console.log(`running: ${payload.running ? "yes" : "no"}`);
  console.log(`healthy: ${payload.healthy ? "yes" : "no"}`);
  console.log(`state: ${payload.state ?? "missing"}`);
  console.log(`pid: ${payload.pid ?? "-"}`);
  console.log(`intercept ready: ${payload.interceptReady ? "yes" : "no"}`);
  console.log(`bridge ready: ${payload.bridgeReady ? "yes" : "no"}`);
  console.log(`intercept socket: ${payload.interceptReachable ? "reachable" : "unreachable"}`);
  console.log(`bridge socket: ${payload.gravityBridgeSocketPath ?? "-"}`);
  console.log(`intercepted attempts: ${payload.interceptedAttempts ?? 0}`);
  console.log(`canyon held: ${payload.canyonHeld ?? 0}`);
  console.log(`pending approvals: ${payload.pendingApprovals ?? 0}`);
  console.log(`brain status: ${payload.brainStatusPath}`);
  console.log(`native library: ${payload.nativeLibraryPath}`);
  if (payload.lastError) {
    console.log(`last error: ${payload.lastError}`);
  }
}

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
    console.log(`mode: ${formatConsoleApprovalMode(output.mode)}`);
    console.log(`pending: ${output.totals.pending}`);
    console.log(`waiting members: ${output.totals.waitingMembers}`);
    for (const group of output.groups) {
      console.log(
        `${group.state} | ${group.groupId} | ${group.actionClass}.${group.operation} | ${group.target} | members=${group.memberCount} waiting=${group.waitingCount}`,
      );
    }
    return;
  }

  if (subcommand === "mode") {
    const requestedMode = parseConsoleApprovalModeToken(rest[1]);
    if (rest[1] && !requestedMode) {
      throw new Error(`unknown swarm mode: ${rest[1]}`);
    }
    const output = await boundary.sendBoundaryInterceptServerInput({
      target,
      input: {
        command: "swarm_mode",
        ...(requestedMode ? { mode: requestedMode } : {}),
      },
    });
    if (output.type !== "swarm_mode") {
      throw new Error(`unexpected swarm response: ${output.type}`);
    }
    if (asJson) {
      printJson(output);
      return;
    }
    console.log(`swarm mode: ${formatConsoleApprovalMode(output.mode)}`);
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

async function handleMcpStatus() {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  const config = await loadConfig(home.configPath);

  if (!config) {
    console.log("Agent Buccet is not initialized. Run `buccet init` first.");
    return;
  }

  const boundary = await importBoundary(homePath);
  const hookHealth = await getHookRuntimeHealth(boundary, home);

  const ledgerPath = path.join(homePath, "data", "ledger", "agent-boundary-ledger.jsonl");

  const lines: string[] = [
    "MCP status",
    "",
    `  session:     ${config.sessionId}`,
    `  actor:       ${config.actorId}`,
    `  dry-run:     ${config.dryRun ? "yes" : "no"}`,
    `  hook daemon: ${hookHealth.healthy ? "running" : "not running"}`,
    `  ledger:      ${ledgerPath}`,
    "",
    "  Use `buccet console` for approvals and law authoring.",
    "  Use `buccet logs` to inspect recent boundary decisions.",
  ];

  console.log(lines.join("\n"));
}

async function handleMcp(rest: string[]) {
  if (rest[0] === "status") {
    await handleMcpStatus();
    return;
  }

  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  const config = await loadConfig(home.configPath);

  if (!config) {
    throw new Error("Agent Buccet is not initialized. Run `buccet init` first.");
  }

  // Allow overriding session/actor via CLI flags (for multi-session MCP use).
  let sessionId = config.sessionId;
  let actorId = config.actorId;
  let dryRun = config.dryRun;
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (t === "--session-id") { sessionId = rest[++i] ?? sessionId; continue; }
    if (t === "--actor-id")   { actorId   = rest[++i] ?? actorId;   continue; }
    if (t === "--dry-run")    { dryRun = true; continue; }
  }

  // Load the boundary and ensure the session + scopes are in place — same as
  // `buccet run`. The hook daemon (gravity bridge + intercept) must be running
  // for the full bodyguard chain to be active.
  process.stderr.write("[buccet-mcp] restoring session...\n");
  const boundary = await importBoundary(homePath);
  await assertNoActiveQuarantine({
    boundary,
    sessionId,
    sessionsDir: home.sessionsDir,
  });
  const store = await ensureStore(boundary, {
    config: { ...config, sessionId, actorId, dryRun },
    sessionsDir: home.sessionsDir,
  });
  await ensureScopes(boundary, {
    store,
    scopePaths: config.defaultScopes,
    actorId,
  });
  await store.persist();

  process.stderr.write("[buccet-mcp] ensuring hook daemon...\n");
  if (!(await pathExists(home.nativeLibraryPath))) {
    await handleHook(["build", "--quiet"]);
  }
  const hookHealth = await getHookRuntimeHealth(boundary, home);
  if (!hookHealth.healthy) {
    await handleHook(["start", "--quiet"]);
  }
  process.stderr.write("[buccet-mcp] waiting for boundary runtime...\n");
  await waitForHookRuntimeHealthy(boundary, home);

  const { runBuccetMcpServer } = await import(path.join(currentScriptDir(), "agent-buccet-mcp-server.ts"));

  // Hook socket env so the MCP server can reach the bodyguard/intercept IPC.
  const hookEnv = {
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_INTERCEPT_SOCKET: home.interceptSocketPath,
    BUCCET_SOCKET_PATH: home.gravityBridgeSocketPath,
    BUCCET_BRAIN_STATUS_PATH: home.brainStatusPath,
    ...(process.platform === "darwin"
      ? { DYLD_INSERT_LIBRARIES: home.nativeLibraryPath, DYLD_FORCE_FLAT_NAMESPACE: "1" }
      : { LD_PRELOAD: home.nativeLibraryPath }),
  };

  const previousEnv = new Map<string, string | undefined>();
  for (const key of Object.keys(hookEnv)) {
    previousEnv.set(key, process.env[key]);
  }
  Object.assign(process.env, hookEnv);
  process.stderr.write("[buccet-mcp] ready.\n");
  try {
    await runBuccetMcpServer({
      sessionId,
      actorId,
      sessionsDir: home.sessionsDir,
      home: homePath,
      dryRun,
    });
  } finally {
    for (const [key, value] of previousEnv) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
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
  const quiet = rest.includes("--quiet");
  const emitHookStatus = (message: string) => {
    if (quiet) {
      process.stderr.write(`${message}\n`);
      return;
    }
    console.log(message);
  };

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
    emitHookStatus(`built native hook: ${home.nativeLibraryPath}`);
    return;
  }

  if (subcommand === "start") {
    if (!config) {
      throw new Error("Agent Buccet is not initialized. Run `buccet init` first.");
    }
    await ensureDir(home.runDir);
    const boundary = await importBoundary(homePath);
    const existingPid = await readHookPid(home.hookPidPath);
    if (existingPid && await pidAlive(existingPid)) {
      const health = await getHookRuntimeHealth(boundary, home);
      if (health.healthy) {
        emitHookStatus(`hook daemon already running: ${existingPid}`);
        return;
      }
      await stopHookDaemonPid(existingPid);
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
      "--gravity-bridge-socket",
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
    await waitForHookRuntimeHealthy(boundary, home);
    emitHookStatus("hook daemon started");
    return;
  }

  if (subcommand === "status") {
    const boundary = await importBoundary(homePath);
    const asJson = rest.includes("--json");
    const watch = rest.includes("--watch");
    const render = async () => {
      const payload = await buildHookStatusPayload(boundary, { home, config });
      if (asJson && !watch) {
        printJson(payload);
        return payload;
      }
      if (watch) {
        process.stdout.write("\x1Bc");
        console.log(`Buccet live | ${formatHookOperatorSummary(payload)}`);
        console.log(``);
      } else {
        console.log(`Agent Buccet hook status — split shield view`);
      }
      printHookStatusDetails(payload);
      if (!watch && !payload.running) {
        console.log(`re-arm: buccet hook start`);
      }
      return payload;
    };
    if (!watch) {
      await render();
      return;
    }
    await render();
    const interval = setInterval(() => {
      void render();
    }, 1_000);
    await new Promise<void>((resolve) => {
      const stop = () => {
        clearInterval(interval);
        resolve();
      };
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    });
    return;
  }

  if (subcommand === "env") {
    const asJson = rest.includes("--json");
    const isMac = process.platform === "darwin";
    const payload = {
      AGENT_BUCCET_INTERCEPT_SOCKET: home.interceptSocketPath,
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
    const boundary = await importBoundary(homePath);
    await ensureRuntimeUplAutoSync({
      boundary,
      home,
      config,
    });
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
    const health = await getHookRuntimeHealth(boundary, home);
    if (!health.healthy) {
      await handleHook(["start"]);
    }
    await waitForHookRuntimeHealthy(boundary, home);
    const env = {
      ...process.env,
      AGENT_BUCCET_HOME: home.homePath,
      AGENT_BUCCET_INTERCEPT_SOCKET: home.interceptSocketPath,
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
    const pid = await readHookPid(home.hookPidPath);
    if (!pid) {
      emitHookStatus("hook daemon not running");
      return;
    }
    try {
      await stopHookDaemonPid(pid);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
      return;
    }
    emitHookStatus(`hook daemon stopped: ${pid}`);
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

async function handleDoctor(rest: string[] = []) {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  const config = await loadConfig(home.configPath);
  const strict = rest.includes("--strict");

  const platformLabel = detectPlatformLabel();
  const backendLabel = detectBackendLabel();
  const nativeReady = await pathExists(home.nativeLibraryPath);
  const protectionMode = nativeReady ? "strong_path" : "compatibility_path";
  const boundary = await importBoundary(homePath);
  const hookHealth = await getHookRuntimeHealth(boundary, home).catch<HookRuntimeHealth>(() => ({
    running: false,
    healthy: false,
    interceptReady: false,
    bridgeReady: false,
    reason: "hook runtime health check failed",
  }));
  const hookAlive = hookHealth.running;
  const hookPid = hookHealth.pid ?? 0;
  const hookState = hookHealth.state ?? "missing";
  const interceptReachable = hookHealth.interceptReady;
  const bridgeReachable = hookHealth.bridgeReady;

  let ledgerChainOk: boolean | null = null;
  let ledgerEntries = 0;
  if (config) {
    try {
      const verify = await boundary.verifyBoundaryLedgerChain();
      const entries = await boundary.readBoundaryLedgerBySession(config.sessionId);
      ledgerChainOk = verify.ok;
      ledgerEntries = entries.length;
    } catch {
      ledgerChainOk = null;
    }
  }

  const sessionStatus = config ? "initialized" : "not initialized";

  const passIcon = clrOk();
  const failIcon = clrFail();
  const warnIcon = clrWarn();

  const kv = (label: string, value: string) =>
    `  ${clrDim(label.padEnd(18))} ${value}`;

  const lines: string[] = [
    ``,
    `  ${clrBold("Agent Buccet — Doctor")}`,
    `  ${c.dim}─────────────────────────────────────${c.reset}`,
    kv("Platform:",        platformLabel),
    kv("Backend:",         backendLabel),
    kv("Native library:",  nativeReady ? `${passIcon} ${clrDim(`(${protectionMode})`)}` : `${warnIcon} ${clrDim(`(${protectionMode} — run 'buccet hook build')`)}`),
    kv("Hook daemon:",     hookAlive ? `${passIcon} ${clrDim(`(pid ${hookPid})`)}` : `${failIcon} ${clrDim("(not running — run 'buccet hook start')")}`),
    kv("Hook state:",      hookAlive ? (hookState === "alive" ? passIcon : `${failIcon} ${clrDim(`(${hookState})`)}`) : `${warnIcon} ${clrDim("(not running)")}`),
    kv("Intercept socket:", interceptReachable ? passIcon : hookAlive ? `${failIcon} ${clrDim(`(${hookHealth.reason ?? "unreachable"})`)}` : `${warnIcon} ${clrDim("(daemon not running)")}`),
    kv("Gravity bridge:",  bridgeReachable ? passIcon : hookAlive ? `${failIcon} ${clrDim(`(${hookHealth.reason ?? "unreachable"})`)}` : `${warnIcon} ${clrDim("(daemon not running)")}`),
    kv("Ledger chain:",    ledgerChainOk === null ? `${warnIcon} ${clrDim("(not checked)")}` : ledgerChainOk ? `${passIcon} ${clrDim(`(${ledgerEntries} entries)`)}` : `${failIcon} ${clrDim("(chain broken — run 'buccet ledger repair')")}`),
    kv("Session:",         sessionStatus),
    ``,
  ];

  for (const line of lines) {
    console.log(line);
  }

  const critical = !hookHealth.healthy || ledgerChainOk === false;
  const strictFailure =
    !config
    || !nativeReady
    || !hookHealth.healthy
    || ledgerChainOk !== true;
  if (critical) {
    console.log(`  One or more checks require attention.`);
    console.log(`  Run 'buccet hook start' to re-arm the protected execution lane.`);
    console.log(``);
  } else {
    console.log(`  All systems active. This machine is guarded.`);
    console.log(``);
  }
  if (strict) {
    const strictLabel = strictFailure
      ? `${clrFail(clrBold("FAIL"))}  ${clrDim("one or more checks not passing")}`
      : `${clrOk(clrBold("PASS"))}  ${clrDim("all strict checks clear")}`;
    console.log(`  ${clrDim("strict posture:")}  ${strictLabel}`);
    console.log(``);
    if (strictFailure) {
      process.exitCode = 1;
    }
  }
}

// ─── buccet console ────────────────────────────────────────────────────────

async function handleConsole() {
  const homePath = resolveHome();
  const home = resolveHomePaths(homePath);
  let config = await loadConfig(home.configPath);

  if (!config) {
    console.log(`Agent Buccet is not initialized. Bringing the machine up now...`);
    await handleInit(["--arm-now"]);
    config = await loadConfig(home.configPath);
    if (!config) {
      console.error(`Agent Buccet could not initialize. Run 'buccet init' first.`);
      process.exit(1);
    }
  }

  const boundary = await importBoundary(homePath);
  await ensureRuntimeUplAutoSync({
    boundary,
    home,
    config,
  });
  const interceptTarget = { socketPath: home.interceptSocketPath };

  const platformLabel = detectPlatformLabel();
  const backendLabel = detectBackendLabel();
  const nativeReady = await pathExists(home.nativeLibraryPath);
  const protectionMode = nativeReady ? "strong_path" : "compatibility_path";

  // Fetch initial status for the dashboard
  const initialHookPayload = await buildHookStatusPayload(boundary, { home, config });
  const initialSessionState = await boundary.loadBoundarySessionState({
    sessionId: config.sessionId,
    sessionsDir: home.sessionsDir,
  });

  if (initialSessionState?.quarantineState?.required) {
    const review = await runInteractiveQuarantineReview({
      boundary,
      sessionId: config.sessionId,
      sessionsDir: home.sessionsDir,
      input: process.stdin,
      output: process.stdout,
    });
    if (!review.cleared) {
      console.log("");
      printCliSection("Quarantine", [
        formatCliKeyValue("status", "runtime remains asleep"),
        formatCliKeyValue("remaining", review.remaining),
      ]);
      console.log("");
      return;
    }
  }

  const sessionStateAfterQuarantine = await boundary.loadBoundarySessionState({
    sessionId: config.sessionId,
    sessionsDir: home.sessionsDir,
  });

  const hintsMuted = await pathExists(home.consoleHintsMutedPath);

  printBuccetWordmark();
  const bar = "─".repeat(46);
  const kv = (label: string, value: string) =>
    `  ${clrDim(label.padEnd(12))} ${value}`;
  console.log(`  ${c.blue}${bar}${c.reset}`);
  console.log(kv("platform", platformLabel));
  console.log(kv("backend", backendLabel));
  console.log(kv("mode", `${c.bold}interactive${c.reset}`));
  console.log(kv("shield", formatHookOperatorSummary(initialHookPayload)));
  console.log(kv("session", `${clrDim(config.sessionId)}`));
  console.log(kv("status", sessionStateAfterQuarantine?.session.status ?? "missing"));
  console.log(`  ${c.blue}${bar}${c.reset}`);
  if (!hintsMuted) {
    console.log(``);
    console.log(`  ${c.bold}What is this?${c.reset}  ${clrDim("Every action your AI agent tries to take — files, APIs, commands —")}`);
    console.log(`  ${clrDim("is intercepted here before it lands. You allow or deny it. Decisions become law.")}`);
    console.log(``);
    console.log(`  ${clrDim("→ Connect your agent:")}  add ${c.bold}buccet mcp${c.reset} to your MCP host ${clrDim("(Claude Desktop, Cursor, etc.)")}`);
    console.log(`    ${clrDim(`{ "mcpServers": { "buccet": { "command": "buccet", "args": ["mcp"] } } }`)}`);
    console.log(`  ${clrDim("→ When an action hits:")}  ${c.green}${c.bold}1${c.reset} allow once  ${c.green}${c.bold}2${c.reset} allow as law  ${c.red}${c.bold}3${c.reset} deny once  ${c.red}${c.bold}4${c.reset} deny as law`);
    console.log(``);
    console.log(`  ${clrDim("Type")} ${c.bold}where${c.reset} ${clrDim("for the full operator map  ·  type")} ${c.bold}mute hints${c.reset} ${clrDim("to hide this.")}`);
    console.log(``);
  } else {
    console.log(`  ${clrDim("type")} ${c.bold}help${c.reset} ${clrDim("for commands  ·  type")} ${c.bold}quit${c.reset} ${clrDim("to exit")}`);
    console.log(``);
  }

  // Track which groups have already been reported.
  const reportedGroupIds = new Set<string>();
  let currentApprovalMode: ConsoleApprovalMode = "interactive";
  // Current waiting groups — updated on every approval poll for numbered shorthand.
  let currentWaitingGroups: Array<{
    groupId: string;
    state: string;
    actionClass: string;
    operation: string;
    target: string;
    reason: string;
    payloadSummary?: string;
    reviewContext?: {
      surface: "action" | "chat";
      title?: string;
      question?: string;
      actorLabel?: string;
      invariantLawId?: string;
      invariantLabel?: string;
      userInput?: string;
      attemptedOutput?: string;
      attemptLines?: string[];
      evidence?: string[];
      violations?: string[];
    };
    lawIds: string[];
    bodyguardMoves: Array<{ moveId: string; kind: string; title: string; description: string; target?: string }>;
    memberCount: number;
    waitingCount: number;
  }> = [];
  // Live feed toggle.
  let feedEnabled = true;
  // Ledger position — seeded to current length so we don't replay old events on startup.
  let lastSeenCount = 0;
  // Canyon-held ingress state observed this session.
  const canyonProvenances = new Set<string>();
  const reportedCanyonProvenances = new Set<string>();
  let currentIngressEntries: Array<{
    provenance: string;
    state: "canyon" | "allow_once" | "deny_once" | "allow_as_law";
    reason: string;
    promotionKind?: "density" | "hard_ceiling";
    operatorDisposition?: "deny_as_law";
    seenAt: number;
    ledgered?: boolean;
    deniedCount: number;
    allowOnceRemaining: number;
    standingAllowed: boolean;
  }> = [];
  type ConsoleBodyguardSuggestion = {
    groupId: string;
    moveId: string;
    kind: string;
    title: string;
    description: string;
    target?: string;
  };
  const nslSuggestions: ConsoleBodyguardSuggestion[] = [];
  let currentHookPayload: HookStatusPayload | null = null;
  let lastHookSummary: string | null = null;

  function ingressStateLabel(entry: typeof currentIngressEntries[number]): string {
    if (entry.state === "canyon") {
      return `canyon-held${entry.promotionKind ? ` [${entry.promotionKind}]` : ""}`;
    }
    if (entry.state === "allow_once") {
      return `allow-once (${entry.allowOnceRemaining} remaining)`;
    }
    if (entry.state === "deny_once") {
      return "deny-once";
    }
    return "allow-as-law";
  }

  function renderBoundaryEventDetails(group: typeof currentWaitingGroups[number]) {
    const context = group.reviewContext;
    if (context?.surface === "chat") {
      if (context.userInput) console.log(`  ║  User input: ${context.userInput}`);
      if (context.attemptedOutput) console.log(`  ║  Attempted:  ${context.attemptedOutput}`);
      if (context.evidence?.length) {
        console.log(`  ║  Evidence:`);
        for (const line of context.evidence) {
          console.log(`  ║    - ${line}`);
        }
      }
      if (context.violations?.length) {
        console.log(`  ║  Violations:`);
        for (const line of context.violations) {
          console.log(`  ║    - ${line}`);
        }
      }
      return;
    }

    const attemptLines = context?.attemptLines ?? (group.payloadSummary ? [group.payloadSummary] : []);
    if (attemptLines.length) {
      console.log(`  ║  Attempt:`);
      for (const line of attemptLines) {
        console.log(`  ║    ${line}`);
      }
    }
    if (context?.violations?.length) {
      console.log(`  ║  Violations:`);
      for (const line of context.violations) {
        console.log(`  ║    - ${line}`);
      }
    }
  }

  function syncNslSuggestions(waitingGroups: typeof currentWaitingGroups) {
    nslSuggestions.length = 0;
    for (const group of waitingGroups) {
      for (const move of group.bodyguardMoves) {
        nslSuggestions.push({
          groupId: group.groupId,
          moveId: move.moveId,
          kind: move.kind,
          title: move.title,
          description: move.description,
          target: move.target,
        });
      }
    }
  }

  async function setConsoleApprovalMode(
    mode: ConsoleApprovalMode,
    reason: string,
    options?: { silent?: boolean },
  ): Promise<boolean> {
    try {
      const out = await boundary.sendBoundaryInterceptServerInput({
        target: interceptTarget,
        input: {
          command: "swarm_mode",
          mode,
        },
      });
      if (out.type !== "swarm_mode") {
        console.log(`  Error: unexpected mode response: ${out.type}`);
        return false;
      }
      currentApprovalMode = out.mode;
      reportedGroupIds.clear();
      if (!options?.silent) {
        if (out.mode === "standing_law") {
          console.log(`  24/7 no-questions mode active — UPL is now resolving pending action groups. Press Esc to return to interactive mode.`);
        } else {
          console.log(`  Interactive mode restored — Terminal 2 will ask the 4 choices again.`);
        }
        console.log(`  reason: ${reason}`);
      }
      return true;
    } catch (error) {
      console.log(`  Error: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

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
    if (et === "INGRESS_CANYON_STATE_WRITTEN") {
      const prov = String(meta["provenance"] ?? target);
      const kind = meta["promotion_kind"] ? `  [${String(meta["promotion_kind"])}]` : "";
      return `  ⚑ CANYON HOLD      ${prov}${kind}`;
    }
    if (et === "INGRESS_ALLOW_ONCE")       return `  ✓ CANYON RELEASE    ${target}  [once]`;
    if (et === "INGRESS_ALLOW_AS_LAW")     return `  ✓ CANYON RELEASE    ${target}  [standing]`;
    if (et === "INGRESS_DENY_ONCE")        return `  ✗ CANYON KEEP       ${target}  [once]`;
    if (et === "INGRESS_DENY_AS_LAW")      return `  ✗ CANYON KEEP       ${target}  [standing]`;
    if (et === "INGRESS_VELOCITY_TRIP")    return `  ✗ VELOCITY TRIP    ${String(meta["provenance"] ?? target)}`;
    if (et === "INGRESS_DENSITY_TRIP")     return `  ✗ DENSITY TRIP     ${String(meta["provenance"] ?? target)}`;
    if (et === "INGRESS_MASS_TRIP")        return `  ✗ MASS TRIP        ${String(meta["provenance"] ?? target)}`;
    if (et === "INGRESS_DENIED")           return `  ✗ INGRESS DENIED   ${target}`;
    if (et === "BODYGUARD_GRANT_OFFERED")        return `  → BODYGUARD OFFER        ${action} → ${target}`;
    if (et === "BODYGUARD_MOVE_SUGGESTED")       return `  → BODYGUARD MOVE         ${reason}`;
    if (et === "BODYGUARD_MOVE_CHOSEN")          return `  ✓ BODYGUARD CHOSEN       ${reason}`;
    if (et === "DISPOSABLE_SHED_TRIGGERED")      return `  ✗ SHED TRIGGERED        ${reason}`;
    if (et === "DISPOSABLE_RESPAWNED")           return `  ✓ SHED RESPAWNED        ${String(meta["unit_id"] ?? target)}`;
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
        if (et === "INGRESS_PROVENANCE_BLOCKED" || et === "INGRESS_CANYON_STATE_WRITTEN") {
          const prov = String(meta["provenance"] ?? record.INPUT.target ?? "");
          if (prov && prov !== "-") canyonProvenances.add(prov);
        }
        if (et === "INGRESS_ALLOW_ONCE" || et === "INGRESS_ALLOW_AS_LAW") {
          const prov = String(meta["provenance"] ?? record.INPUT.target ?? "");
          if (prov && prov !== "-") {
            canyonProvenances.delete(prov);
            reportedCanyonProvenances.delete(prov);
          }
        }
        if (feedEnabled) {
          const line = formatLedgerEvent(record);
          if (line) console.log(line);
        }
      }
    } catch { /* silent */ }
  }

  async function pollIngress() {
    try {
      const out = await boundary.sendBoundaryInterceptServerInput({
        target: interceptTarget,
        input: { command: "ingress_status" },
      });
      if (out.type !== "ingress_status") return;
      currentIngressEntries = out.provenances;
      const currentCanyonEntries = currentIngressEntries.filter((entry) => entry.state === "canyon");

      for (const entry of currentCanyonEntries) {
        canyonProvenances.add(entry.provenance);
        if (reportedCanyonProvenances.has(entry.provenance)) {
          continue;
        }
        reportedCanyonProvenances.add(entry.provenance);
        console.log(``);
        const _W = 72;
        console.log(`  ${c.cyan}╔═ INGRESS CANYON HOLD ${"═".repeat(_W - 19)}╗${c.reset}`);
        console.log(`  ${c.cyan}║${c.reset}  ${clrDim("provenance:")} ${c.bold}${entry.provenance}${c.reset}`);
        console.log(`  ${c.cyan}║${c.reset}  ${clrDim("state:")}      canyon-held  ${clrDim(`[${entry.promotionKind}]`)}`);
        console.log(`  ${c.cyan}║${c.reset}  ${clrDim("pressure:")}   ${entry.deniedCount} tarpit decision(s) recorded`);
        console.log(`  ${c.cyan}║${c.reset}`);
        console.log(`  ${c.cyan}║${c.reset}  ${clrDim("reason:")}     ${entry.reason}`);
        console.log(`  ${c.cyan}║${c.reset}`);
        console.log(`  ${c.cyan}║${c.reset}  ${c.dim}1.${c.reset} ${c.green}allow once${c.reset}    — release this provenance once`);
        console.log(`  ${c.cyan}║${c.reset}  ${c.dim}2.${c.reset} ${c.bold}${c.green}allow as law${c.reset}  — standing ingress allow`);
        console.log(`  ${c.cyan}║${c.reset}  ${c.dim}3.${c.reset} ${c.red}deny once${c.reset}     — keep this provenance in the canyon`);
        console.log(`  ${c.cyan}║${c.reset}  ${c.dim}4.${c.reset} ${c.bold}${c.red}deny as law${c.reset}   — standing canyon hold`);
        console.log(`  ${c.cyan}║${c.reset}`);
        console.log(`  ${c.cyan}║${c.reset}  ${clrDim(`> canyon 1 ${entry.provenance}   /   canyon 2 ${entry.provenance}`)}`);
        console.log(`  ${c.cyan}║${c.reset}  ${clrDim(`> canyon 3 ${entry.provenance}   /   canyon 4 ${entry.provenance}`)}`);
        console.log(`  ${c.cyan}╚${"═".repeat(_W)}╝${c.reset}`);
        console.log(``);
      }

      const live = new Set(currentCanyonEntries.map((entry) => entry.provenance));
      for (const prov of [...reportedCanyonProvenances]) {
        if (!live.has(prov)) {
          reportedCanyonProvenances.delete(prov);
          canyonProvenances.delete(prov);
        }
      }
    } catch {
      // Intercept daemon may be offline. Silent.
    }
  }

  async function pollApprovals() {
    try {
      const out = await boundary.sendBoundaryInterceptServerInput({
        target: interceptTarget,
        input: { command: "swarm_status" },
      });
      if (out.type !== "swarm_status") return;
      currentApprovalMode = out.mode;

      const waitingGroups = out.groups.filter(
        (g: { state: string; waitingCount: number }) => g.state === "waiting" || g.waitingCount > 0,
      );
      currentWaitingGroups = waitingGroups;
      syncNslSuggestions(waitingGroups);

      if (currentApprovalMode === "standing_law") {
        for (const id of reportedGroupIds) {
          if (!waitingGroups.some((g: { groupId: string }) => g.groupId === id)) {
            reportedGroupIds.delete(id);
          }
        }
        return;
      }

      for (const group of waitingGroups) {
        if (reportedGroupIds.has(group.groupId)) continue;
        reportedGroupIds.add(group.groupId);
        console.log(``);
        const bodyguardMoves = (group.bodyguardMoves ?? []) as Array<{ moveId: string; kind: string; title: string; description: string; target?: string }>;
        const isBodyguardGrantOffer = bodyguardMoves.some((m) => m.kind === "open_as_law");
        const openAsLawMove = bodyguardMoves.find((m) => m.kind === "open_as_law");

        if (isBodyguardGrantOffer && openAsLawMove) {
          const W = 72;
          const bar = "═".repeat(W);
          console.log(`  ${c.cyan}╔═ BODYGUARD GRANT OFFER ${bar.slice(0, W - 21)}╗${c.reset}`);
          console.log(`  ${c.cyan}║${c.reset}  ${c.bold}${openAsLawMove.title}${c.reset}`);
          console.log(`  ${c.cyan}║${c.reset}  ${clrDim(openAsLawMove.description)}`);
          console.log(`  ${c.cyan}║${c.reset}`);
          console.log(`  ${c.cyan}║${c.reset}  ${clrDim("action:")}   ${c.bold}${group.actionClass}.${group.operation}${c.reset}`);
          if (openAsLawMove.target ?? group.target) {
            console.log(`  ${c.cyan}║${c.reset}  ${clrDim("scope:")}    ${c.bold}${openAsLawMove.target ?? group.target}${c.reset}`);
          }
          console.log(`  ${c.cyan}║${c.reset}  ${clrDim("waiting:")}  ${group.waitingCount} request(s)`);
          if (group.lawIds?.length > 0) {
            console.log(`  ${c.cyan}║${c.reset}  ${clrDim("laws:")}     ${clrDim((group.lawIds as string[]).join(", "))}`);
          }
          renderBoundaryEventDetails(group);
          console.log(`  ${c.cyan}║${c.reset}`);
          console.log(`  ${c.cyan}║${c.reset}  ${c.dim}1.${c.reset} ${c.green}allow once${c.reset}    — proceed this time; no law written`);
          console.log(`  ${c.cyan}║${c.reset}  ${c.dim}2.${c.reset} ${c.bold}${c.green}open as law${c.reset}   — open scope as ${c.bold}standing law${c.reset}; always allowed`);
          console.log(`  ${c.cyan}║${c.reset}  ${c.dim}3.${c.reset} ${c.red}deny once${c.reset}     — block this request; no law written`);
          console.log(`  ${c.cyan}║${c.reset}  ${c.dim}4.${c.reset} ${c.bold}${c.red}deny as law${c.reset}   — ${c.bold}standing deny law${c.reset}; always blocked`);
        } else {
          const W = 62;
          const bar = "═".repeat(W);
          console.log(`  ${c.cyan}╔═ BOUNDARY INTERCEPTION ${bar.slice(0, W - 21)}╗${c.reset}`);
          console.log(`  ${c.cyan}║${c.reset}  ${clrDim("action:")}   ${c.bold}${group.actionClass}.${group.operation}${c.reset}`);
          console.log(`  ${c.cyan}║${c.reset}  ${clrDim("target:")}   ${c.bold}${group.target}${c.reset}`);
          console.log(`  ${c.cyan}║${c.reset}  ${clrDim("waiting:")}  ${group.waitingCount} request(s)`);
          if (group.reason) {
            console.log(`  ${c.cyan}║${c.reset}`);
            console.log(`  ${c.cyan}║${c.reset}  ${clrDim("reason:")}   ${group.reason}`);
          }
          renderBoundaryEventDetails(group);
          if (group.lawIds?.length > 0) {
            console.log(`  ${c.cyan}║${c.reset}  ${clrDim("laws:")}     ${clrDim((group.lawIds as string[]).join(", "))}`);
          }
          console.log(`  ${c.cyan}║${c.reset}`);
          console.log(`  ${c.cyan}║${c.reset}  ${c.dim}1.${c.reset} ${c.green}allow once${c.reset}    — proceeds; no law written`);
          console.log(`  ${c.cyan}║${c.reset}  ${c.dim}2.${c.reset} ${c.bold}${c.green}allow as law${c.reset}  — proceeds; ${c.bold}standing allow law${c.reset} written`);
          console.log(`  ${c.cyan}║${c.reset}  ${c.dim}3.${c.reset} ${c.red}deny once${c.reset}     — blocked; no law written`);
          console.log(`  ${c.cyan}║${c.reset}  ${c.dim}4.${c.reset} ${c.bold}${c.red}deny as law${c.reset}   — blocked; ${c.bold}standing deny law${c.reset} written`);
        }
        console.log(`  ${c.cyan}║${c.reset}`);
        console.log(`  ${c.cyan}║${c.reset}  ${clrDim(`> 1 / 2 / 3 / 4   or   allow / deny / law / deny-law`)}`);
        console.log(`  ${c.cyan}╚${"═".repeat(62)}╝${c.reset}`);
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

  async function pollShield(force = false) {
    try {
      const payload = await buildHookStatusPayload(boundary, { home, config });
      currentHookPayload = payload;
      const summary = formatHookOperatorSummary(payload);
      const changed = summary !== lastHookSummary;
      lastHookSummary = summary;
      if ((force || changed) && feedEnabled) {
        console.log(`  ◉ SHIELD           ${summary}`);
      }
    } catch {
      // Hook runtime may be offline during startup. Silent.
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
    void pollIngress();
    void pollShield();
  }, 1_000);

  // Initial approval poll.
  await pollApprovals();
  await pollIngress();
  await pollShield(true);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "buccet> ",
    terminal: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  });

  readline.emitKeypressEvents(process.stdin, rl);
  const rawModeSupported = process.stdin.isTTY && typeof process.stdin.setRawMode === "function";
  if (rawModeSupported) {
    process.stdin.setRawMode(true);
  }

  const onKeypress = (_input: string, key: { name?: string; ctrl?: boolean }) => {
    if (!rawModeSupported || rl.line.trim().length > 0) {
      return;
    }
    if (key.name === "right" && currentApprovalMode !== "standing_law") {
      void setConsoleApprovalMode("standing_law", "console: right-arrow enabled 24/7 no-questions mode");
      rl.prompt();
      return;
    }
    if (key.name === "escape" && currentApprovalMode === "standing_law") {
      void setConsoleApprovalMode("interactive", "console: Esc returned Terminal 2 to interactive mode");
      rl.prompt();
    }
  };
  process.stdin.on("keypress", onKeypress);

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

        if (cmd === "help") {
          console.log(``);
          printCliHeader("  Buccet Console  —  command reference");
          printCliSection("Approvals", [
            formatCliKeyValue("1 / 2 / 3 / 4", "decide pending approval (single group)"),
            formatCliKeyValue(`${c.green}allow${c.reset} <id>`, "allow once"),
            formatCliKeyValue(`${c.bold}${c.green}law${c.reset} <id>`, "allow as standing law"),
            formatCliKeyValue(`${c.red}deny${c.reset} <id>`, "deny once"),
            formatCliKeyValue(`${c.bold}${c.red}deny-law${c.reset} <id>`, "deny as standing law"),
          ]);
          printCliSection("Ingress", [
            formatCliKeyValue("canyon [prov]", "inspect ingress control state or list all"),
            formatCliKeyValue("canyon <1-4> <prov>", "decide an ingress-controlled provenance"),
            formatCliKeyValue("unblock <prov>", "release provenance from canyon once"),
          ]);
          printCliSection("Mode", [
            formatCliKeyValue("mode [name]", "show or set interactive / standing-law mode"),
            formatCliKeyValue("no-questions", "enter 24/7 standing-law mode"),
            formatCliKeyValue("right-arrow", "enter 24/7 no-questions mode (keyboard)"),
            formatCliKeyValue("Esc", "return to interactive mode"),
          ]);
          printCliSection("Laws & UPL", [
            formatCliKeyValue("laws", "active scope laws for this session"),
            formatCliKeyValue("tracks", "active UPL track corridors"),
            formatCliKeyValue("upl", "active UPL laws"),
            formatCliKeyValue("nsl [n]", "list or select a pending bodyguard move"),
          ]);
          printCliSection("Observability", [
            formatCliKeyValue("where", "full operator map — every surface and command"),
            formatCliKeyValue("status", "unified operator snapshot"),
            formatCliKeyValue("shield", "protected execution lane heartbeat"),
            formatCliKeyValue("logs [n]", "last n witness ledger entries (default 10)"),
            formatCliKeyValue("feed", "toggle live shield + witness feed"),
            formatCliKeyValue("doctor", "health check"),
          ]);
          printCliSection("Recovery", [
            formatCliKeyValue("shed", "force denial-side shed and clean disposable respawn"),
            formatCliKeyValue("shed status [n]", "recent shed / respawn witness history"),
            formatCliKeyValue("quarantine status [n]", "caught set from shed reboot boundary-on-self"),
            formatCliKeyValue("quarantine review", "interactive one-by-one quarantine denial flow"),
            formatCliKeyValue("quarantine deny-all", "write all caught items into deny law"),
            formatCliKeyValue("quarantine deny <item-id...>", "write selected caught items into deny law"),
          ]);
          printCliSection("Other", [
            formatCliKeyValue("mute hints", "hide the onboarding message on open"),
            formatCliKeyValue("unmute hints", "bring the onboarding message back"),
            formatCliKeyValue("hook status --watch", "optional split shield view"),
            formatCliKeyValue("ledger --follow", "optional split witness view"),
            formatCliKeyValue("quit / q / exit", "exit"),
          ]);
          console.log(``);
          rl.prompt();
          return;
        }

        if (cmd === "mode" || cmd === "no-questions" || cmd === "standing-law" || cmd === "interactive" || cmd === "24/7") {
          const requestedMode = cmd === "mode"
            ? parseConsoleApprovalModeToken(arg1)
            : cmd === "interactive"
              ? "interactive"
              : "standing_law";
          if (cmd === "mode" && arg1 && !requestedMode) {
            console.log(`  Usage: mode [interactive|standing-law|no-questions|24/7]`);
            rl.prompt();
            return;
          }
          if (!requestedMode) {
            console.log(`  Mode: ${formatConsoleApprovalMode(currentApprovalMode)}`);
            rl.prompt();
            return;
          }
          await setConsoleApprovalMode(
            requestedMode,
            requestedMode === "standing_law"
              ? "console: enabled 24/7 no-questions mode"
              : "console: restored interactive mode",
          );
          rl.prompt();
          return;
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
            input = { command: "swarm_approve", groupId, issuedBy: config.actorId, reason: "console: allow once", asLaw: false };
          } else if (choiceCmd === "law") {
            input = { command: "swarm_approve", groupId, issuedBy: config.actorId, reason: "console: allow as law", asLaw: true };
          } else if (choiceCmd === "deny-law") {
            input = { command: "swarm_deny", groupId, deniedBy: config.actorId, reason: "console: deny as law", asLaw: true };
          } else {
            input = { command: "swarm_deny", groupId, deniedBy: config.actorId, reason: "console: deny once", asLaw: false };
          }
          const out = await boundary.sendBoundaryInterceptServerInput({
            target: interceptTarget,
            input: input as Parameters<typeof boundary.sendBoundaryInterceptServerInput>[0]["input"],
          });
          if (out.type === "error") {
            console.log(`  ${clrFail("✗")}  ${out.error}`);
          } else {
            const label = choiceCmd === "allow" ? `${clrOk("✓")}  ${c.green}allowed once${c.reset}` :
                          choiceCmd === "law"   ? `${clrOk("✓")}  ${c.bold}${c.green}allowed as law${c.reset}` :
                          choiceCmd === "deny"  ? `${clrFail("✗")}  ${c.red}denied once${c.reset}` :
                                                  `${clrFail("✗")}  ${c.bold}${c.red}denied as law${c.reset}`;
            console.log(`  ${label}  ${clrDim(groupId)}`);
            reportedGroupIds.delete(groupId);
          }
          rl.prompt();
          return;
        }

        if (cmd === "feed") {
          feedEnabled = !feedEnabled;
          console.log(`  Live feed: ${feedEnabled ? "on" : "off"}`);
          rl.prompt();
          return;
        }

        if (cmd === "mute" && arg1 === "hints") {
          await fs.writeFile(home.consoleHintsMutedPath, new Date().toISOString(), "utf8");
          console.log(`  ${clrOk()}  ${clrBold("Hints muted.")}  ${clrDim("They won't show on next open. Type 'unmute hints' to bring them back.")}`);
          rl.prompt();
          return;
        }

        if (cmd === "unmute" && arg1 === "hints") {
          await fs.unlink(home.consoleHintsMutedPath).catch(() => undefined);
          console.log(`  ${clrOk()}  ${clrBold("Hints restored.")}  ${clrDim("They'll show again on next open.")}`);
          rl.prompt();
          return;
        }

        if (cmd === "shield") {
          const payload = currentHookPayload ?? await buildHookStatusPayload(boundary, { home, config });
          console.log(``);
          printCliHeader("  Protected Execution Lane");
          printCliSection("Shield", [
            formatCliKeyValue("summary", formatHookOperatorSummary(payload)),
            formatCliKeyValue("initialized", payload.initialized ? "yes" : "no"),
            formatCliKeyValue("running", payload.running ? "yes" : "no"),
            formatCliKeyValue("healthy", payload.healthy ? "yes" : "no"),
            formatCliKeyValue("state", payload.state ?? "missing"),
            formatCliKeyValue("pid", payload.pid ?? "-"),
            formatCliKeyValue("intercept", payload.interceptReachable ? "reachable" : "unreachable"),
            formatCliKeyValue("bridge", payload.bridgeReady ? "ready" : "missing"),
            formatCliKeyValue("intercepted", payload.interceptedAttempts ?? 0),
            formatCliKeyValue("canyon held", payload.canyonHeld ?? 0),
            formatCliKeyValue("pending", payload.pendingApprovals ?? 0),
          ]);
          printCliSection("Runtime Files", [
            formatCliKeyValue("brain status", payload.brainStatusPath),
            formatCliKeyValue("native library", payload.nativeLibraryPath),
            payload.lastError ? formatCliKeyValue("last error", payload.lastError) : null,
          ]);
          if (!payload.running) {
            console.log(`re-arm: buccet hook start`);
          }
          console.log(``);
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
          const payload = currentHookPayload ?? await buildHookStatusPayload(boundary, { home, config });
          console.log(``);
          printCliHeader("  Unified Operator Snapshot");
          printCliSection("Session", [
            formatCliKeyValue("session", config.sessionId),
            formatCliKeyValue("status", sessionState?.session.status ?? "missing"),
            formatCliKeyValue("scopes", scopes.length),
            formatCliKeyValue("grants", grants.length),
          ]);
          printCliSection("Operator", [
            formatCliKeyValue("shield", formatHookOperatorSummary(payload)),
            formatCliKeyValue("mode", formatConsoleApprovalMode(currentApprovalMode)),
            formatCliKeyValue("feed", feedEnabled ? "on" : "off"),
            formatCliKeyValue("pending groups", currentWaitingGroups.length),
            formatCliKeyValue(
              "canyon held",
              currentIngressEntries.filter((entry) => entry.state === "canyon").length,
            ),
          ]);
          console.log(``);
          rl.prompt();
          return;
        }

        if (cmd === "shed") {
          if (arg1 === "status") {
            const limit = parts[2] ? Number(parts[2]) : 10;
            const payload = await buildShedStatusPayload({
              boundary,
              sessionId: config.sessionId,
              limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
            });
            console.log(``);
            printCliHeader("  Disposable Shed History");
            printCliSection("Summary", [
              formatCliKeyValue("session", payload.sessionId),
              formatCliKeyValue("shed count", payload.shedCount),
              formatCliKeyValue("respawns", payload.respawnCount),
              formatCliKeyValue("latest", payload.latest?.createdAt ?? "none"),
            ]);
            printCliSection("Entries", payload.entries.length > 0
              ? payload.entries.map((entry) => (
                `${entry.createdAt} | ${entry.eventType} | ${entry.actionKind ?? "-"} | ${entry.reason ?? "-"}`
              ))
              : ["No shed events recorded for this session."]);
            console.log(``);
            rl.prompt();
            return;
          }

          const store = await ensureStore(boundary, {
            config,
            sessionsDir: home.sessionsDir,
          });
          const result = await boundary.shedBoundarySessionSkin({
            config: store.getConfig(),
            reason: "console: operator forced denial-side shed and clean disposable respawn",
            issuedBy: config.actorId,
          });
          console.log(``);
          printCliHeader("  Shed Complete");
          printCliSection("Respawn", [
            formatCliKeyValue("unit", result.unitId),
            formatCliKeyValue("source", result.sourceDomain),
            formatCliKeyValue("trust", result.trustDomain),
            formatCliKeyValue("runtime", result.runtimeDir),
            formatCliKeyValue("snapshot", result.snapshotPath),
          ]);
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
          const upl = await loadEffectiveUserPathLedger(boundary, home, config);
          const session = await loadActiveBoundarySession(boundary, home, config);
          const approved = (upl.userApprovedLawPaths ?? []).filter((l) => l.status === "ACTIVE");
          const denied = (upl.userDeniedLawPaths ?? []).filter((l) => l.status === "ACTIVE");
          const runtimeTrackField = boundary.compileLiveUplTrackField({ ledger: upl, session });
          console.log(``);
          printCliHeader("  User Path Ledger");
          printCliSection("Summary", [
            formatCliKeyValue("approved laws", approved.length),
            formatCliKeyValue("denied laws", denied.length),
            formatCliKeyValue("runtime segments", runtimeTrackField.length),
          ]);
          if (approved.length > 0) {
            console.log(`  ${clrOk("●")} ${clrBold("Allow laws")}  ${clrDim(`(showing last ${Math.min(8, approved.length)})`)}`)
            for (const law of approved.slice(-8)) {
              console.log(`    ${c.green}allow${c.reset}  ${clrDim(law.id)}  ${law.domain ? clrDim(law.domain) + "  " : ""}${law.path}`);
            }
            console.log(``);
          }
          if (denied.length > 0) {
            console.log(`  ${clrFail("●")} ${clrBold("Deny laws")}  ${clrDim(`(showing last ${Math.min(5, denied.length)})`)}`)
            for (const law of denied.slice(-5)) {
              console.log(`    ${c.red}deny${c.reset}   ${clrDim(law.id)}  ${law.domain ? clrDim(law.domain) + "  " : ""}${law.path}`);
            }
            console.log(``);
          }
          if (approved.length === 0 && denied.length === 0) {
            console.log(`  ${clrDim("No active UPL laws.")}`);
            console.log(``);
          }
          rl.prompt();
          return;
        }

        if (cmd === "doctor") {
          await handleDoctor();
          rl.prompt();
          return;
        }

        if (cmd === "where") {
          await handleWhere([]);
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
          printCliHeader("  Active Scope Laws");
          if (pathLaws.length === 0) {
            console.log(`  ${clrDim("No active path laws.")}`);
          } else {
            console.log(`  ${clrDim(`session  ${config.sessionId}`)}`);
            console.log(``);
            for (const law of pathLaws) {
              const l = law as { lawId: string; rootPath: string; grantedActions: string[]; issuedBy: string };
              console.log(`  ${clrOk("●")} ${c.bold}${l.lawId}${c.reset}`);
              console.log(`    ${clrDim("path:")}    ${l.rootPath}`);
              console.log(`    ${clrDim("actions:")} ${c.green}${l.grantedActions.join(", ")}${c.reset}`);
              console.log(`    ${clrDim("issued:")}  ${l.issuedBy}`);
            }
          }
          console.log(``);
          rl.prompt();
          return;
        }

        if (cmd === "tracks") {
          const upl = await loadEffectiveUserPathLedger(boundary, home, config);
          const session = await loadActiveBoundarySession(boundary, home, config);
          const approved = (upl.userApprovedLawPaths ?? []).filter((entry) => entry.status === "ACTIVE");
          const denied = (upl.userDeniedLawPaths ?? []).filter((entry) => entry.status === "ACTIVE");
          const tracked = boundary.compileLiveUplTrackField({ ledger: upl, session });
          console.log(``);
          printCliHeader("  UPL Runtime Track Field");
          printCliSection("Summary", [
            formatCliKeyValue("authored", `${approved.length} approved / ${denied.length} denied`),
            formatCliKeyValue("compiled", `${tracked.length} segments`),
          ]);
          if (tracked.length === 0) {
            console.log(`  ${clrDim("No active track corridors.")}`);
          } else {
            for (const segment of tracked) {
              const entry = segment.entry;
              const tc = entry.trackConstraint!;
              const polarityColor = segment.polarity === "allow" ? c.green : c.red;
              console.log(`  ${polarityColor}${segment.polarity === "allow" ? "open " : "wall "}${c.reset} ${clrBold(entry.id)}  ${clrDim(tc.description)}`);
              console.log(`    ${clrDim("kinds:")}   ${polarityColor}${tc.allowedActionKinds.join(", ")}${c.reset}`);
              if (tc.targetPattern) {
                console.log(`    ${clrDim("target:")}  ${tc.targetPattern}`);
              }
              if (tc.targetPatterns?.length) {
                console.log(`    ${clrDim("targets:")} ${tc.targetPatterns.join(" | ")}`);
              }
              if (tc.reviewInvariantLawId) {
                console.log(`    ${clrDim("track:")}   invariant ${tc.reviewInvariantLawId}`);
              }
              console.log(`    ${clrDim("scope:")}   ${entry.scope}`);
            }
          }
          console.log(``);
          rl.prompt();
          return;
        }

        if (cmd === "canyon" || cmd === "unblock") {
          const canyonChoice = (cmd === "unblock") ? "1" : arg1;
          const provenanceArg = (cmd === "unblock") ? arg1 : parts[2];
          if (!canyonChoice || (canyonChoice !== "1" && canyonChoice !== "2" && canyonChoice !== "3" && canyonChoice !== "4")) {
            const targetProv = cmd === "canyon" ? arg1 : undefined;
            const entries = targetProv
              ? currentIngressEntries.filter((entry) => entry.provenance === targetProv)
              : currentIngressEntries;
            console.log(``);
            if (entries.length === 0) {
              console.log(`  No ingress control entries.`);
            } else {
              console.log(`  Ingress control entries:`);
              for (const entry of entries) {
                console.log(`  ${entry.provenance}`);
                console.log(`    state:    ${ingressStateLabel(entry)}`);
                console.log(`    reason:   ${entry.reason}`);
                console.log(`    pressure: ${entry.deniedCount} tarpit decision(s)`);
                if (entry.operatorDisposition) {
                  console.log(`    operator: ${entry.operatorDisposition}`);
                }
              }
              console.log(`  Use: canyon <1-4> <provenance>`);
            }
            console.log(``);
            rl.prompt();
            return;
          }
          if (!provenanceArg) {
            console.log(`  Usage: canyon <1-4> <provenance>`);
            rl.prompt();
            return;
          }
          const entry = currentIngressEntries.find((item) => item.provenance === provenanceArg);
          if (!entry) {
            console.log(`  No ingress control entry '${provenanceArg}'.`);
            rl.prompt();
            return;
          }
          const ingressCommand =
            canyonChoice === "1" ? "ingress_allow_once" :
            canyonChoice === "2" ? "ingress_allow_as_law" :
            canyonChoice === "3" ? "ingress_deny_once" :
            "ingress_deny_as_law";
          const reason =
            canyonChoice === "1" ? `console: release ${provenanceArg} from canyon once` :
            canyonChoice === "2" ? `console: standing ingress allow for ${provenanceArg}` :
            canyonChoice === "3" ? `console: keep ${provenanceArg} in canyon once` :
            `console: standing canyon hold for ${provenanceArg}`;
          const out = await boundary.sendBoundaryInterceptServerInput({
            target: interceptTarget,
            input: {
              command: ingressCommand,
              provenance: provenanceArg,
              issuedBy: config.actorId,
              deniedBy: config.actorId,
              reason,
            } as Parameters<typeof boundary.sendBoundaryInterceptServerInput>[0]["input"],
          });
          if (out.type === "error") {
            console.log(`  Error: ${out.error}`);
          } else {
            if (canyonChoice === "1" || canyonChoice === "2" || canyonChoice === "3") {
              canyonProvenances.delete(provenanceArg);
              reportedCanyonProvenances.delete(provenanceArg);
            }
            await pollIngress();
            const canyonLabel = canyonChoice === "1" ? `${clrOk("✓")}  ${c.green}released once${c.reset}` :
                                canyonChoice === "2" ? `${clrOk("✓")}  ${c.bold}${c.green}standing ingress allow${c.reset}` :
                                canyonChoice === "3" ? `${clrFail("✗")}  ${c.red}kept in canyon${c.reset}` :
                                                      `${clrFail("✗")}  ${c.bold}${c.red}standing canyon hold${c.reset}`;
            console.log(`  ${canyonLabel}  ${clrDim(provenanceArg)}`);
          }
          rl.prompt();
          return;
        }

        if (cmd === "nsl") {
          const indexArg = arg1 ? Number(arg1) : NaN;
          if (!isNaN(indexArg) && nslSuggestions.length > 0) {
            const pick = nslSuggestions[indexArg - 1];
            if (!pick) {
              console.log(`  No bodyguard move suggestion at index ${indexArg}. Use 'nsl' to list.`);
              rl.prompt();
              return;
            }
            let input: Parameters<typeof boundary.sendBoundaryInterceptServerInput>[0]["input"] | null = null;
            if (pick.kind === "open_as_law" || pick.kind === "open_path") {
              input = { command: "swarm_approve", groupId: pick.groupId, issuedBy: config.actorId, reason: `console: bodyguard move ${indexArg}`, asLaw: true };
            } else if (pick.kind.startsWith("grant_")) {
              input = { command: "swarm_approve", groupId: pick.groupId, issuedBy: config.actorId, reason: `console: bodyguard move ${indexArg}`, asLaw: false };
            } else if (pick.kind === "deny_and_explain") {
              input = { command: "swarm_deny", groupId: pick.groupId, deniedBy: config.actorId, reason: `console: bodyguard move ${indexArg}`, asLaw: false };
            }

            if (!input) {
              console.log(`  Bodyguard move ${indexArg} is advisory only: ${pick.title}`);
              console.log(`  Use explicit allow/deny/law/deny-law commands for this group.`);
              rl.prompt();
              return;
            }
            const out = await boundary.sendBoundaryInterceptServerInput({
              target: interceptTarget,
              input,
            });
            if (out.type === "error") {
              console.log(`  Error: ${out.error}`);
            } else {
              reportedGroupIds.delete(pick.groupId);
              console.log(`  bodyguard move ${indexArg} selected — ${pick.title}`);
            }
            rl.prompt();
            return;
          }
          // Show pending bodyguard suggestions.
          console.log(``);
          if (nslSuggestions.length === 0) {
            console.log(`  No pending bodyguard move suggestions.`);
          } else {
            console.log(`  Pending bodyguard move suggestions:`);
            for (let i = 0; i < nslSuggestions.length; i++) {
              const s = nslSuggestions[i];
              console.log(`  [${i + 1}] ${s.title}  [${s.kind}]  group=${s.groupId}`);
              console.log(`      ${s.description}`);
            }
            console.log(`  Use: nsl <n>  to select a bodyguard move`);
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
            input = { command: "swarm_approve", groupId, issuedBy: config.actorId, reason: "console: allow once", asLaw: false };
          } else if (cmd === "law") {
            input = { command: "swarm_approve", groupId, issuedBy: config.actorId, reason: "console: allow as law", asLaw: true };
          } else if (cmd === "deny-law") {
            input = { command: "swarm_deny", groupId, deniedBy: config.actorId, reason: "console: deny as law", asLaw: true };
          } else {
            input = { command: "swarm_deny", groupId, deniedBy: config.actorId, reason: "console: deny once", asLaw: false };
          }
          const out = await boundary.sendBoundaryInterceptServerInput({
            target: interceptTarget,
            input: input as Parameters<typeof boundary.sendBoundaryInterceptServerInput>[0]["input"],
          });
          if (out.type === "error") {
            console.log(`  ${clrFail("✗")}  ${out.error}`);
          } else {
            const label = cmd === "allow"    ? `${clrOk("✓")}  ${c.green}allowed once${c.reset}` :
                          cmd === "law"      ? `${clrOk("✓")}  ${c.bold}${c.green}allowed as law${c.reset}` :
                          cmd === "deny"     ? `${clrFail("✗")}  ${c.red}denied once${c.reset}` :
                                              `${clrFail("✗")}  ${c.bold}${c.red}denied as law${c.reset}`;
            console.log(`  ${label}  ${clrDim(groupId)}`);
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
    process.stdin.off("keypress", onKeypress);
    if (rawModeSupported) {
      process.stdin.setRawMode(false);
    }
    process.exit(0);
  });

  // Keep alive until rl closes.
  await new Promise<void>((resolve) => {
    rl.on("close", resolve);
  });
}

// ─── extract-laws ──────────────────────────────────────────────────────────

async function handleExtractLaws(rest: string[]) {
  const { promises: fsp } = await import("node:fs");
  const { extractDocumentLawsWithDiagnostics } = await import(
    "../lib/agent-buccet/index.ts"
  );

  const jsonFlag = rest.includes("--json");
  let lane: UplSourceLane | null = null;
  let filePath: string | null = null;
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--lane") {
      lane = parseUplSourceLaneToken(rest[index + 1] ?? usage());
      if (!lane) {
        console.error(`Unsupported lane: ${rest[index + 1] ?? ""}`);
        process.exit(1);
      }
      index += 1;
      continue;
    }
    if (token === "--json") {
      continue;
    }
    if (!token.startsWith("--") && !filePath) {
      filePath = token;
    }
  }
  if (!filePath) {
    console.error("Usage: buccet extract-laws <file.md> [--lane acceptance|denial] [--json]");
    process.exit(1);
  }

  const resolvedPath = path.resolve(filePath);
  let markdown: string;
  try {
    markdown = await fsp.readFile(resolvedPath, "utf8");
  } catch {
    console.error(`Cannot read file: ${resolvedPath}`);
    process.exit(1);
  }

  const { laws, diagnostics } = extractDocumentLawsWithDiagnostics({
    sourcePath: resolvedPath,
    markdown,
  });

  if (jsonFlag) {
    const laneMismatches = lane
      ? laws
        .filter((law) => !laneMatchesType(lane as UplSourceLane, law.type))
        .map((law) => ({
          type: law.type,
          summary: law.requestBasis.payloadSummary ?? law.requestBasis.target,
          invariantLawId: law.requestBasis.reviewContext?.invariantLawId ?? null,
        }))
      : [];
    console.log(JSON.stringify({ laws, diagnostics, lane, laneMismatches }, null, 2));
    return;
  }

  const compiled = diagnostics.filter((d) => d.compiled);
  const skipped = diagnostics.filter((d) => !d.compiled);

  console.log(`\nDocument: ${path.basename(resolvedPath)}`);
  if (lane) {
    console.log(`Lane: ${lane}`);
  }
  console.log(`Extracted ${compiled.length} law directive${compiled.length === 1 ? "" : "s"}:\n`);

  for (let i = 0; i < compiled.length; i++) {
    const d = compiled[i]!;
    const source = d.source === "structured" ? "structured" : "prose";
    const corridorLabel = d.corridorType ? `${d.corridorType}Corridor` : "track";
    const location = d.startLine === d.endLine ? `line ${d.startLine}` : `lines ${d.startLine}-${d.endLine}`;
    console.log(`  [${i + 1}] ${corridorLabel}  ${d.description ?? d.invariantLawId ?? "—"}`);
    const law = laws[i];
    if (law) {
      console.log(`      polarity: ${law.type.toLowerCase()}`);
      if (lane && !laneMatchesType(lane, law.type)) {
        console.log(`      lane-mismatch: this block does not belong in the ${lane} lane`);
      }
    }
    if (d.heading) {
      console.log(`      section: "${d.heading}"`);
    }
    console.log(`      source: ${location} (${source})`);
    console.log(`      id: ${d.invariantLawId}`);
    console.log(`      confidence: ${d.confidence}`);
    console.log();
  }

  if (skipped.length > 0) {
    console.log(`  [!] ${skipped.length} block${skipped.length === 1 ? "" : "s"} below threshold or failed snap-integrity (skipped):`);
    for (const d of skipped) {
      const location = d.startLine === d.endLine ? `line ${d.startLine}` : `lines ${d.startLine}-${d.endLine}`;
      const label = d.heading ? `"${d.heading}"` : `(no heading)`;
      console.log(`      ${location}: ${label} — ${d.skipReason ?? "skipped"}`);
    }
    console.log();
  }

  if (compiled.length === 0 && skipped.length === 0) {
    console.log("  No law blocks found in this document.\n");
  }
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
  if (parsed.command === "where") {
    await handleWhere(parsed.rest);
    return;
  }
  if (parsed.command === "doctor") {
    await handleDoctor(parsed.rest);
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
  if (parsed.command === "ledger") {
    await handleLedger(parsed.rest);
    return;
  }
  if (parsed.command === "scope") {
    await handleScope(parsed.rest);
    return;
  }
  if (parsed.command === "upl") {
    await handleUpl(parsed.rest);
    return;
  }
  if (parsed.command === "path") {
    await handlePath(parsed.rest);
    return;
  }
  if (parsed.command === "run") {
    await handleRun(parsed.rest);
    return;
  }
  if (parsed.command === "transport") {
    await handleTransport(parsed.rest);
    return;
  }
  if (parsed.command === "shed") {
    await handleShed(parsed.rest);
    return;
  }
  if (parsed.command === "quarantine") {
    await handleQuarantine(parsed.rest);
    return;
  }
  if (parsed.command === "hook") {
    await handleHook(parsed.rest);
    return;
  }
  if (parsed.command === "mcp") {
    await handleMcp(parsed.rest);
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
  if (parsed.command === "extract-laws") {
    await handleExtractLaws(parsed.rest);
    return;
  }
  usage();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
