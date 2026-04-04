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

type UplAcceptanceSourceCatalog = {
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
    "  buccet init [--session-id <id>] [--actor-id <id>] [--scope <path>] [--dry-run] [--no-default-scope]",
    "  buccet console                                            — open the command center (Terminal 2)",
    "  buccet doctor                                             — health check: platform, backend, intercept, ledger",
    "  buccet run [--scope <path>] [--cwd <path>] [--session-id <id>] [--actor-id <id>] [--dry-run] -- <command> [args...]",
    "  buccet status [--json]",
    "  buccet logs [--limit <n>] [--json]",
    "  buccet ledger [--limit <n>] [--json] [--follow]          — open the witness ledger (Terminal 3, optional)",
    "  buccet scope add <path> [--actions <csv>]",
    "  buccet scope list [--json]",
    "  buccet upl list [--all] [--type approved|denied] [--status active|muted|deleted] [--search <query...>] [--json]",
    "  buccet upl search <query...> [--all] [--type approved|denied] [--status active|muted|deleted] [--json]",
    "  buccet upl show <upl-id> [--json]",
    "  buccet upl diff [--all] [--type approved|denied] [--status active|muted|deleted] [--search <query...>] [--json]",
    "  buccet upl mute <upl-id...> [--search <query...>] [--type approved|denied] [--status active|muted|deleted] [--json]",
    "  buccet upl unmute <upl-id...> [--search <query...>] [--type approved|denied] [--status active|muted|deleted] [--json]",
    "  buccet upl remove <upl-id...> [--search <query...>] [--type approved|denied] [--status active|muted|deleted] [--json]",
    "  buccet upl sources [--json]                               — show authored lanes plus external UPL intake catalogs",
    "  buccet upl import <file...> [--scope GLOBAL|SESSION] [--json]",
    "  buccet upl sync [--scope GLOBAL|SESSION] [--lane acceptance|denial] [--json]",
    "  buccet hook build",
    "  buccet hook start",
    "  buccet hook status [--json] [--watch]                     — Terminal 1 live shield / heartbeat",
    "  buccet hook env [--json]",
    "  buccet hook run -- <command> [args...]",
    "  buccet hook stop",
    "  buccet swarm list [--json]",
    "  buccet swarm mode [interactive|standing-law] [--json]",
    "  buccet swarm approve <group-id> [--issued-by <id>] [--reason <text>] [--json]",
    "  buccet swarm deny <group-id> [--denied-by <id>] [--reason <text>] [--json]",
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
  const socketRoot = process.platform === "darwin" ? "/tmp" : os.tmpdir();
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
    loadBoundarySessionState: (args: { sessionId: string; sessionsDir?: string }) => Promise<{ session: BoundarySession } | null>;
  },
  home: ReturnType<typeof resolveHomePaths>,
  config: BuccetConfig,
): Promise<BoundarySession> {
  const sessionState = await boundary.loadBoundarySessionState({
    sessionId: config.sessionId,
    sessionsDir: home.sessionsDir,
  });
  return sessionState?.session ?? fallbackBoundarySession(config);
}

function resolveHomePaths(homePath: string) {
  const runDir = path.join(homePath, "run");
  const nativeDir = path.join(homePath, "native");
  const installedNativeSourceDir = path.join(homePath, "current", "native", "deep-intercept");
  const repoNativeSourceDir = path.resolve(currentScriptDir(), "..", "native", "deep-intercept");
  const nativeBuildDir = path.join(nativeDir, "build");
  const uplDocsDir = path.join(homePath, "upl-docs");
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
    installedNativeSourceDir,
    repoNativeSourceDir,
    nativeBuildDir,
    nativeLibraryPath: path.join(nativeBuildDir, nativeLibraryName),
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
      name: "SkillsMP",
      url: "https://skillsmp.com",
      description: "largest broad skill catalog",
    },
    {
      name: "AITmpl Skills",
      url: "https://aitmpl.com/skills",
      description: "template and one-command install workflows",
    },
    {
      name: "SkillHub",
      url: "https://skillhub.club",
      description: "AI-rated skills and high-signal curation",
    },
    {
      name: "AgentSkills",
      url: "https://agentskills.io",
      description: "official spec and shape grounding",
    },
  ];
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

function acceptancePipelineGuideText(home: ReturnType<typeof resolveHomePaths>): string {
  const catalogs = acceptanceSourceCatalogs();
  const commands = acceptancePipelineCommands(home);
  return [
    "Agent Buccet acceptance source pipeline",
    "",
      "Use this when you want to pull a skill or workflow from an external catalog into the UPL acceptance side.",
    "",
    "Source catalogs:",
    ...catalogs.map((catalog) => `- ${catalog.name} — ${catalog.url} — ${catalog.description}`),
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
            "- README files are ignored by `buccet upl sync`",
            "- The parser is strict and fail-closed",
            "- If a document compiles into denied law here, sync refuses it",
            "- Raw source intake works here too: copied skill text, SKILL.md, README.md, or extracted package markdown will compile into approved UPL in this lane",
            "- For external skill catalogs, use PIPELINE.txt and SKILL_INTAKE_TEMPLATE.txt in this lane",
            "",
            "Useful commands:",
            "- buccet extract-laws <file.md> --lane acceptance",
            "- buccet upl sync",
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
            "- README files are ignored by `buccet upl sync`",
            "- The parser is strict and fail-closed",
            "- If a document compiles into approved law here, sync refuses it",
            "- Raw source intake works here too: copied skill text, SKILL.md, README.md, or extracted package markdown will compile into denied UPL in this lane",
            "",
            "Useful commands:",
            "- buccet extract-laws <file.md> --lane denial",
            "- buccet upl sync",
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
      "Use `buccet upl sync` to compile both lanes into the active UPL.",
    ].join("\n") + "\n", "utf8");
  }
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
    if (/^readme\./i.test(entry.name)) {
      continue;
    }
    results.push(absolutePath);
  }
  return results.sort((left, right) => left.localeCompare(right));
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

  while (Date.now() - startedAt < timeoutMs) {
    lastHealth = await getHookRuntimeHealth(boundary, home);
    if (lastHealth.healthy) {
      return lastHealth;
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
      await args.store.issueGrant({
        resourceKind: "path",
        resourceValue: grant.target,
        grantedActions: grant.actions,
        issuedBy: args.actorId,
        metadata: {
          exact_only: true,
          runtime_support: true,
        },
      });
    }
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
  await ensureUplSourceHomes(home);

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
      const existingPid = await readHookPid(home.hookPidPath);
      if (existingPid && await pidAlive(existingPid)) {
        const health = await getHookRuntimeHealth(boundary, home);
        if (health.healthy) {
          interceptLine = `strong_path (libc-level, pid ${existingPid})`;
        } else {
          interceptLine = "compatibility_path (hook runtime unhealthy; run 'buccet hook start')";
        }
      } else {
        const daemonScriptPath = path.join(currentScriptDir(), "agent-buccet-hook-daemon.ts");
        const daemonExec = process.env.BUCCET_DAEMON_EXEC ?? process.execPath;
        const hookChild = spawn(daemonExec, [
          daemonScriptPath,
          "--session-id", nextConfig.sessionId,
          "--actor-id", nextConfig.actorId,
          "--sessions-dir", home.sessionsDir,
          "--intercept-socket", home.interceptSocketPath,
          "--gravity-bridge-socket", home.gravityBridgeSocketPath,
          "--brain-status-file", home.brainStatusPath,
          "--pid-file", home.hookPidPath,
        ], {
          cwd: home.homePath,
          detached: true,
          stdio: "ignore",
          env: { ...process.env, AGENT_BUCCET_HOME: home.homePath },
        });
        hookChild.unref();
        try {
          await waitForHookRuntimeHealthy(boundary, home);
          interceptLine = "strong_path (libc-level)";
        } catch {
          interceptLine = "compatibility_path (hook runtime failed to become healthy; run 'buccet hook start')";
        }
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
  console.log(`  This terminal is now Terminal 1: the protected execution lane.`);
  console.log(``);
  console.log(`  Open Terminal 2 and Terminal 3 like this:`);
  console.log(``);
  console.log(`    buccet console`);
  console.log(`    buccet ledger --follow`);
  console.log(`    buccet upl sync`);
  console.log(``);
  console.log(`  UPL document sources:`);
  console.log(``);
  console.log(`    acceptance: ${home.uplAcceptanceDocsDir}`);
  console.log(`    denial:     ${home.uplDenialDocsDir}`);
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
      console.log(`  Agent Buccet — Witness Ledger`);
      console.log(`  ─────────────────────────────────────`);
      console.log(`  Session: ${config.sessionId}`);
      console.log(`  Entries: ${records.length}`);
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
  console.log(`  Agent Buccet — Witness Ledger`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Session: ${config.sessionId}`);
  console.log(`  Following live ledger stream. Ctrl-C to exit.`);
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
    if (asJson) {
      printJson({
        root: home.uplDocsDir,
        lanes: snapshot,
        catalogs,
        acceptancePipeline: {
          guidePath: home.uplAcceptancePipelinePath,
          templatePath: home.uplAcceptanceSkillTemplatePath,
          commands,
        },
      });
      return;
    }
    console.log(`UPL document sources`);
    console.log(`root: ${home.uplDocsDir}`);
    for (const lane of snapshot) {
      console.log(`${lane.lane}: ${lane.dir} (${lane.files.length} file${lane.files.length === 1 ? "" : "s"})`);
      for (const filePath of lane.files) {
        console.log(`  - ${filePath}`);
      }
    }
    console.log(``);
    console.log(`UPL intake catalogs`);
    for (const catalog of catalogs) {
      console.log(`- ${catalog.name}: ${catalog.url} (${catalog.description})`);
    }
    console.log(``);
    console.log(`Acceptance pipeline`);
    console.log(`guide: ${home.uplAcceptancePipelinePath}`);
    console.log(`template: ${home.uplAcceptanceSkillTemplatePath}`);
    console.log(`1. choose a skill/workflow from a catalog above`);
    console.log(`2. copy the source text you want`);
    console.log(`3. paste it into acceptance for approved UPL or denial for denied UPL`);
    console.log(`4. create a new acceptance doc from the template if you want the scaffold`);
    console.log(`   ${commands.copyTemplate}`);
    console.log(`5. compile it into live UPL`);
    console.log(`   ${commands.sync}`);
    console.log(`   denial: buccet upl sync --lane denial`);
    console.log(`6. inspect what landed`);
    console.log(`   ${commands.inspectSearch}`);
    console.log(`   ${commands.inspectDiff}`);
    console.log(`   ${commands.inspectShow}`);
    console.log(`sync: buccet upl sync`);
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

    const upl = await boundary.loadUserPathLedger();
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
      console.log(`UPL laws`);
      console.log(`active approved: ${approved.length}`);
      console.log(`active denied: ${denied.length}`);
      console.log(`muted: ${muted.length}`);
      console.log(`deleted: ${deleted.length}`);
      console.log(`runtime track field: ${runtimeTrackField.length} compiled segments`);
      if (!selection.includeAll && selection.statusFilter === null) {
        console.log(`showing active laws only | use --all to include muted and deleted`);
      }
      if (selection.typeFilter || selection.statusFilter || selection.queryTerms.length > 0) {
        console.log(`filtered matches: ${filteredEntries.length}`);
      }
      for (const entry of filteredEntries) {
        const view = buildUplEntryView(entry);
        console.log(`${entry.status} | ${entry.type} | ${entry.id} | ${view.source} | ${view.whatItIs} | ${entry.path}`);
      }
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
    console.log(`UPL diff`);
    console.log(`matches: ${rows.length}`);
    console.log(`live allow: ${stateSummary.allow}`);
    console.log(`live deny: ${stateSummary.deny}`);
    console.log(`inactive: ${stateSummary.inactive}`);
    for (const row of rows) {
      console.log(`${row.entry.id} | authored=${row.entry.type}/${row.entry.status} -> live=${row.liveState}`);
      console.log(`  what it is: ${row.view.whatItIs}`);
      console.log(`  connects to: ${row.view.connectsTo}`);
      console.log(`  action kinds: ${row.view.actionKinds.join(", ") || "none recorded"}`);
      console.log(`  bounds: ${row.view.bounds.join(" | ") || "none recorded"}`);
      if (row.liveTag) {
        console.log(`  live tag: ${row.liveTag}`);
      }
    }
    return;
  }

  if (subcommand === "show") {
    const entryId = rest.find((token, index) => index > 0 && token !== "--json");
    if (!entryId) {
      usage();
    }
    const upl = await boundary.loadUserPathLedger();
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
    console.log(`UPL entry ${entry.id}`);
    console.log(`status: ${entry.status}`);
    console.log(`type: ${entry.type}`);
    console.log(`scope: ${entry.scope}`);
    console.log(`source: ${summarizeUplEntrySource(entry)}`);
    console.log(`created: ${entry.createdAt}`);
    console.log(`modified: ${entry.modifiedAt ?? "never"}`);
    console.log(`path: ${entry.path}`);
    console.log(`witness: ${entry.witness}`);
    if (entry.notes) {
      console.log(`notes: ${entry.notes}`);
    }
    console.log(`what it is: ${view.whatItIs}`);
    console.log(`connects to: ${view.connectsTo}`);
    console.log(`action kinds: ${view.actionKinds.join(", ") || "none recorded"}`);
    console.log(`bounds: ${view.bounds.join(" | ") || "none recorded"}`);
    if (entry.trackConstraint) {
      console.log(`track: yes`);
      console.log(`track kinds: ${entry.trackConstraint.allowedActionKinds.join(", ")}`);
      console.log(`track corridor: ${boundary.formatTrackConstraint(entry.trackConstraint)}`);
    } else {
      console.log(`track: no`);
    }
    if (liveSegment) {
      console.log(`live field: ${liveSegment.trafficClass} | ${liveSegment.trafficTag}`);
    } else {
      console.log(`live field: inactive`);
    }
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
    const upl = await boundary.loadUserPathLedger();
    const session = await loadActiveBoundarySession(boundary, home, config);
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
    const saved = await boundary.saveUserPathLedger(update.ledger);
    const store = await ensureStore(boundary, {
      config,
      sessionsDir: home.sessionsDir,
    });
    store.replaceConfig({
      ...store.getConfig(),
      upl: saved,
      userLawIds: boundary.getActiveUserLawIds(saved, store.getConfig().session),
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

    await ensureUplSourceHomes(home);
    const lanes = uplSourceSpecs(home).filter((spec) => !laneSelection || spec.lane === laneSelection);
    const laneFiles = await Promise.all(
      lanes.map(async (spec) => ({
        spec,
        files: await listLaneMarkdownFiles(spec.dir),
      })),
    );
    const store = await ensureStore(boundary, {
      config,
      sessionsDir: home.sessionsDir,
    });
    const staged: Array<{ lane: UplSourceLane; filePath: string; compiled: CompiledDocumentLaw[] }> = [];
    for (const lane of laneFiles) {
      for (const filePath of lane.files) {
        const markdown = await fs.readFile(filePath, "utf8");
        const extracted = boundary.extractDocumentLawsWithDiagnostics({
          sourcePath: filePath,
          markdown,
        });
        const hasCompiledLaw = extracted.laws.length > 0;
        const hasStructuredSignals = /^(?:decision|invariant|enforcement|action|target|require|forbid|expression|output shape|completion grammar):/mi.test(markdown);
        const intakeDoc = !hasCompiledLaw && !hasStructuredSignals
          ? parseSourceIntakeDoc(markdown, filePath)
          : null;
        const tagged = intakeDoc
          ? compileSourceIntakeDoc({
            filePath,
            lane: lane.spec.lane,
            doc: intakeDoc,
            scope,
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

    let upl = await boundary.loadUserPathLedger();
    const now = new Date().toISOString();
    for (const lane of lanes) {
      upl = muteLaneSourcedEntries({
        ledger: upl,
        lane: lane.lane,
        scope,
        session: store.getConfig().session,
        modifiedAt: now,
      });
    }
    if (staged.length === 0) {
      upl = await boundary.saveUserPathLedger(upl);
    }

    const imported: Array<{ lane: UplSourceLane; file: string; imported: number; entries: string[] }> = [];
    for (const item of staged) {
      const result = await importCompiledDocumentLaws({
        boundary,
        config,
        store,
        upl,
        filePath: item.filePath,
        compiled: item.compiled,
        scope,
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
      userLawIds: [
        ...new Set([
          ...(store.getConfig().userLawIds ?? []),
          ...boundary.getActiveUserLawIds(upl, store.getConfig().session),
        ]),
      ],
    });
    await store.persist();

    if (asJson) {
      printJson({
        scope,
        root: home.uplDocsDir,
        lanes: laneFiles.map((lane) => ({
          lane: lane.spec.lane,
          dir: lane.spec.dir,
          files: lane.files,
        })),
        imported,
      });
      return;
    }
    console.log(`Synced UPL document sources into authored law`);
    console.log(`scope: ${scope}`);
    for (const lane of laneFiles) {
      console.log(`${lane.spec.lane}: ${lane.files.length} file${lane.files.length === 1 ? "" : "s"} from ${lane.spec.dir}`);
    }
    if (imported.length === 0) {
      console.log(`No authored UPL markdown documents found. Add .md files under acceptance or denial, then run \`buccet upl sync\` again.`);
      return;
    }
    for (const entry of imported) {
      console.log(`${entry.lane} | ${entry.file} | laws=${entry.imported}${entry.entries.length ? ` | entries=${entry.entries.join(",")}` : ""}`);
    }
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
      userLawIds: [
        ...new Set([
          ...(store.getConfig().userLawIds ?? []),
          ...boundary.getActiveUserLawIds(upl, store.getConfig().session),
        ]),
      ],
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

  if (!(await pathExists(home.nativeLibraryPath))) {
    await handleHook(["build"]);
  }
  const hookHealth = await getHookRuntimeHealth(boundary, home);
  if (!hookHealth.healthy) {
    await handleHook(["start"]);
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
    const boundary = await importBoundary(homePath);
    const existingPid = await readHookPid(home.hookPidPath);
    if (existingPid && await pidAlive(existingPid)) {
      const health = await getHookRuntimeHealth(boundary, home);
      if (health.healthy) {
        console.log(`hook daemon already running: ${existingPid}`);
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
    console.log(`hook daemon started`);
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
        console.log(`Buccet live | ${payload.healthy ? "protected" : "degraded"} | intercepted: ${payload.interceptedAttempts ?? 0} | canyon: ${payload.canyonHeld ?? 0} | pending: ${payload.pendingApprovals ?? 0}`);
        console.log(``);
      } else {
        console.log(`Agent Buccet hook status — Terminal 1`);
      }
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
    const boundary = await importBoundary(homePath);
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
  console.log(`  Agent Buccet — Command Center`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  Platform:         ${platformLabel}`);
  console.log(`  Backend:          ${backendLabel}`);
  console.log(`  Protection mode:  ${protectionMode}`);
  console.log(`  Session:          ${config.sessionId}`);
  console.log(``);
  console.log(`  This is Terminal 2: the command center. Terminal 1 is the protected execution lane.`);
  console.log(``);
  console.log(`  Commands:`);
  console.log(`    1 / 2 / 3 / 4      — decide pending approval (when one group is waiting)`);
  console.log(`    right-arrow        — enter 24/7 no-questions mode`);
  console.log(`    Esc                — return to interactive mode`);
  console.log(`    allow <id>         — allow once`);
  console.log(`    deny <id>          — deny once`);
  console.log(`    law <id>           — allow as standing law`);
  console.log(`    deny-law <id>      — deny as standing law`);
  console.log(`    mode [name]        — show or set interactive / standing-law mode`);
  console.log(`    no-questions       — turn on 24/7 standing-law mode`);
  console.log(`    canyon [prov]      — inspect ingress control state or list all`);
  console.log(`    canyon <1-4> <prov> — decide an ingress-controlled provenance`);
  console.log(`    laws               — list active scope laws for this session`);
  console.log(`    tracks             — list active UPL track corridors`);
  console.log(`    nsl [n]            — list or select a pending bodyguard move`);
  console.log(`    status             — session status`);
  console.log(`    logs [n]           — last n ledger entries (default 10)`);
  console.log(`    feed               — toggle live event feed on/off`);
  console.log(`    upl                — active UPL laws`);
  console.log(`    doctor             — health check`);
  console.log(`    ledger --follow    — open Terminal 3 witness stream from another terminal`);
  console.log(`    quit               — exit`);
  console.log(``);

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
        console.log(`  ╔═ INGRESS CANYON HOLD ═════════════════════════════════════════════════╗`);
        console.log(`  ║  Provenance: ${entry.provenance}`);
        console.log(`  ║  State:      canyon-held  [${entry.promotionKind}]`);
        console.log(`  ║  Pressure:   ${entry.deniedCount} tarpit decision(s) recorded`);
        console.log(`  ║`);
        console.log(`  ║  Reason:     ${entry.reason}`);
        console.log(`  ║`);
        console.log(`  ║  1. Allow once     — release this provenance once`);
        console.log(`  ║  2. Allow as law   — standing ingress allow`);
        console.log(`  ║  3. Deny once      — keep this provenance in the canyon`);
        console.log(`  ║  4. Deny as law    — standing canyon hold`);
        console.log(`  ║`);
        console.log(`  ║  > canyon 1 ${entry.provenance}   /   canyon 2 ${entry.provenance}`);
        console.log(`  ║  > canyon 3 ${entry.provenance}   /   canyon 4 ${entry.provenance}`);
        console.log(`  ╚═══════════════════════════════════════════════════════════════════════╝`);
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
          // bodyguard grant offer — show the full negotiation surface
          console.log(`  ╔═ BODYGUARD GRANT OFFER ═════════════════════════════════════════════════╗`);
          console.log(`  ║  ${openAsLawMove.title}`);
          console.log(`  ║  ${openAsLawMove.description}`);
          console.log(`  ║`);
          console.log(`  ║  Action:    ${group.actionClass}.${group.operation}`);
          if (openAsLawMove.target ?? group.target) {
            console.log(`  ║  Scope:     ${openAsLawMove.target ?? group.target}`);
          }
          console.log(`  ║  Waiting:   ${group.waitingCount} request(s)`);
          if (group.lawIds?.length > 0) {
            console.log(`  ║  Laws:      ${(group.lawIds as string[]).join(", ")}`);
          }
          renderBoundaryEventDetails(group);
          console.log(`  ║`);
          console.log(`  ║  1. Allow once     — proceed this time; no law written`);
          console.log(`  ║  2. Open as law    — open scope as standing law; always allowed`);
          console.log(`  ║  3. Deny once      — block this request; no law written`);
          console.log(`  ║  4. Deny as law    — deny as standing law; always blocked`);
        } else {
          // Standard boundary interception
          console.log(`  ╔═ BOUNDARY INTERCEPTION ══════════════════════════════════════════╗`);
          console.log(`  ║  Action:    ${group.actionClass}.${group.operation}`);
          console.log(`  ║  Target:    ${group.target}`);
          console.log(`  ║  Waiting:   ${group.waitingCount} request(s)`);
          if (group.reason) {
            console.log(`  ║`);
            console.log(`  ║  Reason:    ${group.reason}`);
          }
          renderBoundaryEventDetails(group);
          if (group.lawIds?.length > 0) {
            console.log(`  ║  Laws:      ${(group.lawIds as string[]).join(", ")}`);
          }
          console.log(`  ║`);
          console.log(`  ║  1. Allow once     — proceeds; no law written`);
          console.log(`  ║  2. Allow as law   — proceeds; standing allow law written`);
          console.log(`  ║  3. Deny once      — blocked; no law written`);
          console.log(`  ║  4. Deny as law    — blocked; standing deny law written`);
        }
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
    void pollIngress();
  }, 1_000);

  // Initial approval poll.
  await pollApprovals();
  await pollIngress();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "buccet> ",
    terminal: true,
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
          console.log(`  Mode:       ${formatConsoleApprovalMode(currentApprovalMode)}`);
          console.log(`  Feed:       ${feedEnabled ? "on" : "off"}`);
          console.log(`  Pending:    ${currentWaitingGroups.length} action group(s) waiting`);
          console.log(`  Canyon:     ${currentIngressEntries.filter((entry) => entry.state === "canyon").length} provenance(s) held`);
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
          const session = await loadActiveBoundarySession(boundary, home, config);
          const approved = (upl.userApprovedLawPaths ?? []).filter((l) => l.status === "ACTIVE");
          const denied = (upl.userDeniedLawPaths ?? []).filter((l) => l.status === "ACTIVE");
          const runtimeTrackField = boundary.compileLiveUplTrackField({ ledger: upl, session });
          console.log(``);
          console.log(`  UPL: ${approved.length} approved laws / ${denied.length} denied laws`);
          console.log(`  Runtime field: ${runtimeTrackField.length} compiled track segments`);
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

        if (cmd === "tracks") {
          const upl = await boundary.loadUserPathLedger();
          const session = await loadActiveBoundarySession(boundary, home, config);
          const approved = (upl.userApprovedLawPaths ?? []).filter((entry) => entry.status === "ACTIVE");
          const denied = (upl.userDeniedLawPaths ?? []).filter((entry) => entry.status === "ACTIVE");
          const tracked = boundary.compileLiveUplTrackField({ ledger: upl, session });
          console.log(``);
          console.log(`  Active UPL runtime track field`);
          console.log(`  ─────────────────────────────────────`);
          console.log(`  authored: ${approved.length} approved / ${denied.length} denied`);
          console.log(`  runtime:  ${tracked.length} compiled segments`);
          if (tracked.length === 0) {
            console.log(`  No active track corridors.`);
          } else {
            for (const segment of tracked) {
              const entry = segment.entry;
              const tc = entry.trackConstraint!;
              console.log(`  ${segment.polarity === "allow" ? "open " : "wall "} | ${entry.id} | ${tc.description}`);
              console.log(`    kinds:   ${tc.allowedActionKinds.join(", ")}`);
              if (tc.targetPattern) {
                console.log(`    target:  ${tc.targetPattern}`);
              }
              if (tc.targetPatterns?.length) {
                console.log(`    targets: ${tc.targetPatterns.join(" | ")}`);
              }
              if (tc.reviewInvariantLawId) {
                console.log(`    track:   invariant ${tc.reviewInvariantLawId}`);
              }
              console.log(`    scope:   ${entry.scope}`);
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
            console.log(`  canyon ${canyonChoice}: ${provenanceArg} — done`);
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
