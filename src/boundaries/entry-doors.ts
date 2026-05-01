import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import {
  inferBoundaryProtectedMaterialSignals,
} from "./secrets-boundary.ts";
import type {
  BoundaryActionRequest,
  BoundaryProtectedSubjectKind,
  BoundaryRuntimeConfig,
  BoundaryReviewContext,
} from "./../runtime/types.ts";

export type BoundaryHostKind = "claude-code" | "claude-desktop" | "cursor" | "vscode";

export type BoundaryHostAttachPlan = {
  host: BoundaryHostKind;
  configPath: string;
  serverName: string;
  command: string;
  args: string[];
  config: {
    mcpServers: Record<string, { command: string; args: string[] }>;
  };
};

export type BoundaryToolDoorSignals = {
  payloadSummary: string;
  flags?: BoundaryActionRequest["flags"];
  reviewContext?: BoundaryReviewContext;
};

const MAX_TOOL_DOOR_PAYLOAD_CHARS = 64_000;
const MAX_TOOL_DOOR_FILE_BYTES = 24_000;

function truncateDoorPayload(value: string): string {
  if (value.length <= MAX_TOOL_DOOR_PAYLOAD_CHARS) {
    return value;
  }
  return `${value.slice(0, MAX_TOOL_DOOR_PAYLOAD_CHARS)}\n...[truncated]`;
}

function defaultHostConfigPath(host: BoundaryHostKind, projectPath: string | undefined, homeDir: string): string {
  if (host === "claude-code") {
    return projectPath
      ? path.join(projectPath, ".claude", "settings.json")
      : path.join(homeDir, ".claude", "settings.json");
  }
  if (host === "cursor") {
    return projectPath
      ? path.join(projectPath, ".cursor", "mcp.json")
      : path.join(homeDir, ".cursor", "mcp.json");
  }
  if (host === "vscode") {
    return projectPath
      ? path.join(projectPath, ".vscode", "mcp.json")
      : process.platform === "darwin"
        ? path.join(homeDir, "Library", "Application Support", "Code", "User", "mcp.json")
        : process.platform === "win32"
          ? path.join(process.env.APPDATA ?? path.join(homeDir, "AppData", "Roaming"), "Code", "User", "mcp.json")
          : path.join(homeDir, ".config", "Code", "User", "mcp.json");
  }
  return process.platform === "darwin"
    ? path.join(homeDir, "Library", "Application Support", "Claude", "claude_desktop_config.json")
    : process.platform === "win32"
      ? path.join(process.env.APPDATA ?? path.join(homeDir, "AppData", "Roaming"), "Claude", "claude_desktop_config.json")
      : path.join(homeDir, ".config", "Claude", "claude_desktop_config.json");
}

export function resolveBoundaryHostConfigPath(args: {
  host: BoundaryHostKind;
  projectPath?: string;
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
}): string {
  const homeDir = args.homeDir ?? os.homedir();
  const projectPath = args.projectPath ? path.resolve(args.projectPath) : undefined;
  const env = args.env ?? process.env;
  if (projectPath && (args.host === "claude-code" || args.host === "cursor" || args.host === "vscode")) {
    return defaultHostConfigPath(args.host, projectPath, homeDir);
  }
  const override =
    args.host === "claude-code"
      ? env.BUCCET_HOST_CLAUDE_CODE_CONFIG_PATH
      : args.host === "claude-desktop"
      ? env.BUCCET_HOST_CLAUDE_CONFIG_PATH
      : args.host === "cursor"
        ? env.BUCCET_HOST_CURSOR_CONFIG_PATH
        : env.BUCCET_HOST_VSCODE_CONFIG_PATH;
  return path.resolve(override ?? defaultHostConfigPath(args.host, projectPath, homeDir));
}

export function createBoundaryHostAttachPlan(args: {
  host: BoundaryHostKind;
  serverName?: string;
  commandPath?: string;
  projectPath?: string;
  homeDir?: string;
  env?: NodeJS.ProcessEnv;
}): BoundaryHostAttachPlan {
  const serverName = args.serverName ?? "buccet";
  const command = args.commandPath ?? process.env.AGENT_BUCCET_LAUNCHER_PATH ?? "buccet";
  return {
    host: args.host,
    configPath: resolveBoundaryHostConfigPath({
      host: args.host,
      projectPath: args.projectPath,
      homeDir: args.homeDir,
      env: args.env,
    }),
    serverName,
    command,
    args: ["mcp"],
    config: {
      mcpServers: {
        [serverName]: {
          command,
          args: ["mcp"],
        },
      },
    },
  };
}

export async function mergeBoundaryHostConfig(args: {
  configPath: string;
  fragment: BoundaryHostAttachPlan["config"];
}): Promise<Record<string, unknown>> {
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await fs.readFile(args.configPath, "utf8")) as Record<string, unknown>;
  } catch {
    existing = {};
  }
  const currentServers =
    typeof existing.mcpServers === "object" && existing.mcpServers !== null
      ? (existing.mcpServers as Record<string, unknown>)
      : {};
  return {
    ...existing,
    mcpServers: {
      ...currentServers,
      ...args.fragment.mcpServers,
    },
  };
}

async function runCaptured(command: string, commandArgs: string[], cwd: string): Promise<{
  code: number | null;
  stdout: string;
  stderr: string;
}> {
  return await new Promise((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      resolve({ code: 1, stdout, stderr: error instanceof Error ? error.message : String(error) });
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function readOptionValue(commandArgs: string[], names: string[]): string[] {
  const values: string[] = [];
  for (let index = 0; index < commandArgs.length; index += 1) {
    const token = commandArgs[index];
    if (!names.includes(token)) {
      continue;
    }
    const value = commandArgs[index + 1];
    if (value) {
      values.push(value);
      index += 1;
    }
  }
  return values;
}

async function collectGhPayloadText(commandArgs: string[], cwd: string): Promise<string[]> {
  const payloads = [
    ...readOptionValue(commandArgs, ["--body", "-b"]),
    ...readOptionValue(commandArgs, ["--title", "-t"]),
    ...readOptionValue(commandArgs, ["--message", "-m"]),
    ...readOptionValue(commandArgs, ["--notes"]),
    ...readOptionValue(commandArgs, ["--subject"]),
  ];
  for (const filePath of readOptionValue(commandArgs, ["--body-file", "-F", "--notes-file", "--template", "--input"])) {
    try {
      payloads.push(await fs.readFile(path.resolve(cwd, filePath), "utf8"));
    } catch {
      continue;
    }
  }
  return payloads;
}

async function collectProtectedPathPayload(args: {
  config: BoundaryRuntimeConfig;
  cwd: string;
  tokens: string[];
}): Promise<string[]> {
  const subjects = args.config.protectedSubjects ?? [];
  const sourcePathSubjects = subjects.filter((subject) => subject.sourcePath);
  const payloads: string[] = [];
  const seen = new Set<string>();

  for (const token of args.tokens) {
    if (!token || token.startsWith("-")) {
      continue;
    }
    const filePath = path.resolve(args.cwd, token);
    if (seen.has(filePath)) {
      continue;
    }
    seen.add(filePath);
    const matchedSubject = sourcePathSubjects.find((subject) => subject.sourcePath === filePath);
    if (!matchedSubject) {
      continue;
    }
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) {
        continue;
      }
      const content = await fs.readFile(filePath, "utf8");
      payloads.push(`file:${filePath}\n${content.slice(0, MAX_TOOL_DOOR_FILE_BYTES)}`);
    } catch {
      continue;
    }
  }

  return payloads;
}

async function collectGitCandidateFiles(cwd: string): Promise<string[]> {
  const candidates = new Set<string>();
  const commands: string[][] = [
    ["diff", "--cached", "--name-only"],
    ["diff", "--name-only"],
    ["ls-files", "-m", "-o", "--exclude-standard"],
    ["show", "--pretty=", "--name-only", "HEAD"],
  ];
  for (const commandArgs of commands) {
    const result = await runCaptured("git", commandArgs, cwd);
    if ((result.code ?? 1) !== 0) {
      continue;
    }
    for (const line of result.stdout.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean)) {
      candidates.add(path.resolve(cwd, line));
    }
  }
  return [...candidates];
}

async function collectProtectedGitPayload(args: {
  config: BoundaryRuntimeConfig;
  cwd: string;
}): Promise<string[]> {
  const candidateFiles = await collectGitCandidateFiles(args.cwd);
  const subjects = args.config.protectedSubjects ?? [];
  const sourcePathSubjects = subjects.filter((subject) => subject.sourcePath);
  const payloads: string[] = [];
  const emitted = new Set<string>();
  const cwdPath = path.resolve(args.cwd);

  const appendSubjectPayload = async (filePath: string) => {
    if (emitted.has(filePath)) {
      return;
    }
    emitted.add(filePath);
    try {
      const content = await fs.readFile(filePath, "utf8");
      payloads.push(`file:${filePath}\n${content.slice(0, MAX_TOOL_DOOR_FILE_BYTES)}`);
    } catch {
      return;
    }
  };

  for (const filePath of candidateFiles) {
    const matchedSubject = sourcePathSubjects.find((subject) => subject.sourcePath === filePath);
    if (!matchedSubject) {
      continue;
    }
    await appendSubjectPayload(filePath);
  }

  for (const subject of sourcePathSubjects) {
    const filePath = subject.sourcePath;
    if (!filePath) {
      continue;
    }
    const resolvedPath = path.resolve(filePath);
    if (!(resolvedPath === cwdPath || resolvedPath.startsWith(`${cwdPath}${path.sep}`))) {
      continue;
    }
    await appendSubjectPayload(resolvedPath);
  }

  return payloads;
}

function mergeDoorSignals(args: {
  basePayload: string;
  extraPayloads: string[];
  config: BoundaryRuntimeConfig;
}): BoundaryToolDoorSignals {
  const payloadSummary = truncateDoorPayload(
    [args.basePayload, ...args.extraPayloads.filter(Boolean)].filter(Boolean).join("\n\n"),
  );
  const inferred = inferBoundaryProtectedMaterialSignals({
    config: args.config,
    actionKind: "tool.exec",
    payload: payloadSummary,
  });

  return {
    payloadSummary,
    flags: inferred.flags,
    reviewContext: inferred.evidence.length > 0
      ? {
          surface: "action",
          evidence: inferred.evidence,
          protectedSubjectIds: inferred.protectedSubjectIds,
          protectedSubjectKinds: inferred.protectedSubjectKinds as BoundaryProtectedSubjectKind[],
        }
      : undefined,
  };
}

export async function inferBoundaryToolDoorSignals(args: {
  config: BoundaryRuntimeConfig;
  toolName: "git" | "gh";
  commandArgs: string[];
  cwd: string;
}): Promise<BoundaryToolDoorSignals> {
  const basePayload = `${args.toolName} ${args.commandArgs.join(" ")}`.trim();
  if (args.toolName === "gh") {
    return mergeDoorSignals({
      basePayload,
      extraPayloads: [
        ...await collectGhPayloadText(args.commandArgs, args.cwd),
        ...await collectProtectedPathPayload({
          config: args.config,
          cwd: args.cwd,
          tokens: args.commandArgs,
        }),
      ],
      config: args.config,
    });
  }

  const primary = args.commandArgs[0] ?? "";
  const extraPayloads: string[] = [];
  if (["archive", "bundle", "format-patch", "push", "request-pull", "send-email"].includes(primary)) {
    extraPayloads.push(...await collectProtectedGitPayload({
      config: args.config,
      cwd: args.cwd,
    }));
  }
  if (primary === "commit") {
    extraPayloads.push(...readOptionValue(args.commandArgs, ["-m", "--message"]));
    for (const filePath of readOptionValue(args.commandArgs, ["-F", "--file"])) {
      try {
        extraPayloads.push(await fs.readFile(path.resolve(args.cwd, filePath), "utf8"));
      } catch {
        continue;
      }
    }
  }

  return mergeDoorSignals({
    basePayload,
    extraPayloads,
    config: args.config,
  });
}

// ─── Entry-Door Attachment Boundary ────────────────────────────────────────

export type BoundaryEntryDoorKind = "host" | "tool" | "hook_transport";
export type BoundaryEntryDoorAttachState = "attached" | "unattached" | "degraded";

export type BoundaryEntryDoorAttachment = {
  doorKind: BoundaryEntryDoorKind;
  host?: BoundaryHostKind;
  toolName?: string;
  attachState: BoundaryEntryDoorAttachState;
  hookAvailable: boolean;
  attachedAt?: string;
};

export type BoundaryControlledEntrySurface = {
  decision: "governed" | "blocked";
  doorAttachment: BoundaryEntryDoorAttachment;
  doorSignals?: BoundaryToolDoorSignals;
  reason: string;
};

export function evaluateControlledEntrySurface(args: {
  doorAttachment: BoundaryEntryDoorAttachment;
  doorSignals?: BoundaryToolDoorSignals;
}): BoundaryControlledEntrySurface {
  const { doorAttachment, doorSignals } = args;
  if (doorAttachment.attachState === "unattached") {
    return {
      decision: "blocked",
      doorAttachment,
      doorSignals,
      reason: "door is not attached to enforcement body — no unattached door may carry consequence",
    };
  }
  if (doorAttachment.attachState === "degraded") {
    return {
      decision: "blocked",
      doorAttachment,
      doorSignals,
      reason: "door is in degraded state — enforcement body contact is uncertain",
    };
  }
  // Host doors (MCP attach) are allowed without hook — the MCP channel is itself the enforcement path.
  // Tool doors (git, gh, curl, etc.) require hook transport to be live, because they operate
  // outside the MCP channel and bypass the intercept layer if the hook is down.
  if (doorAttachment.doorKind === "tool" && !doorAttachment.hookAvailable) {
    return {
      decision: "blocked",
      doorAttachment,
      doorSignals,
      reason: "tool door cannot carry consequence — hook transport is unavailable and this door bypasses MCP intercept",
    };
  }
  return {
    decision: "governed",
    doorAttachment,
    doorSignals,
    reason: "door is attached and enforcement path is confirmed",
  };
}

// ─── Hook Availability Boundary ────────────────────────────────────────────

export type BoundaryHookAvailabilityState = {
  available: boolean;
  socketPath?: string;
  gravitySocketPath?: string;
  pid?: number;
  sessionId?: string;
  checkedAt: string;
  reason?: string;
};

export async function evaluateHookAvailability(args: {
  brainStatusPath: string;
}): Promise<BoundaryHookAvailabilityState> {
  const checkedAt = new Date().toISOString();
  let raw: string;
  try {
    raw = await fs.readFile(args.brainStatusPath, "utf8");
  } catch {
    return { available: false, checkedAt, reason: "brain status file not readable — hook daemon may not be running" };
  }
  let status: {
    state?: string;
    interceptSocketPath?: string;
    gravityBridgeSocketPath?: string;
    pid?: number;
    sessionId?: string;
  };
  try {
    status = JSON.parse(raw) as typeof status;
  } catch {
    return { available: false, checkedAt, reason: "brain status file is not valid JSON" };
  }
  if (status.state !== "alive") {
    return { available: false, checkedAt, reason: `hook daemon state is '${status.state ?? "unknown"}' — expected 'alive'` };
  }
  if (status.interceptSocketPath) {
    try {
      await fs.access(status.interceptSocketPath);
    } catch {
      return { available: false, checkedAt, reason: "hook intercept socket path not accessible — daemon may have exited" };
    }
  }
  return {
    available: true,
    socketPath: status.interceptSocketPath,
    gravitySocketPath: status.gravityBridgeSocketPath,
    pid: status.pid,
    sessionId: status.sessionId,
    checkedAt,
  };
}

// ─── General Command Payload Extraction ────────────────────────────────────
// Invariant: CommandMayCarryPayload → ExtractOrConstrainPayload
// Any command that can export, upload, package, publish, post, send, or execute
// using file-backed input must have its payload extracted and surfaced as a
// boundary signal before it can carry consequence.

export type BoundaryCommandPayloadClass =
  | "file_upload"     // curl, wget, scp, rsync, sftp
  | "package_publish" // npm, pnpm, yarn, pip, docker, podman
  | "archive"         // tar, zip, gzip, 7z
  | "script_exec"     // python, node, bash — may execute file-backed code
  | "git_export"      // git push/archive/bundle/format-patch
  | "github_post";    // gh issue/pr/comment

const _COMMAND_PAYLOAD_CLASSES: Record<string, BoundaryCommandPayloadClass> = {
  curl:    "file_upload",
  wget:    "file_upload",
  scp:     "file_upload",
  rsync:   "file_upload",
  sftp:    "file_upload",
  npm:     "package_publish",
  pnpm:    "package_publish",
  yarn:    "package_publish",
  pip:     "package_publish",
  docker:  "package_publish",
  podman:  "package_publish",
  tar:     "archive",
  zip:     "archive",
  gzip:    "archive",
  "7z":    "archive",
  python:  "script_exec",
  python3: "script_exec",
  node:    "script_exec",
  bash:    "script_exec",
  sh:      "script_exec",
  zsh:     "script_exec",
  git:     "git_export",
  gh:      "github_post",
};

const _NPM_CONSEQUENCE_SUBCOMMANDS = new Set(["publish", "deploy", "pack"]);
const _DOCKER_CONSEQUENCE_SUBCOMMANDS = new Set(["push", "build", "save", "export"]);
const _PIP_CONSEQUENCE_SUBCOMMANDS = new Set(["upload"]);
const _GIT_EXPORT_SUBCOMMANDS = new Set(["push", "archive", "bundle", "format-patch", "request-pull", "send-email"]);

export function classifyCommandPayloadClass(
  toolName: string,
  commandArgs: string[],
): BoundaryCommandPayloadClass | null {
  const cls = _COMMAND_PAYLOAD_CLASSES[toolName] ?? null;
  if (!cls) return null;
  const sub = commandArgs[0] ?? "";
  if ((toolName === "npm" || toolName === "pnpm" || toolName === "yarn") && !_NPM_CONSEQUENCE_SUBCOMMANDS.has(sub)) {
    return null;
  }
  if ((toolName === "docker" || toolName === "podman") && !_DOCKER_CONSEQUENCE_SUBCOMMANDS.has(sub)) {
    return null;
  }
  if (toolName === "pip" && !_PIP_CONSEQUENCE_SUBCOMMANDS.has(sub)) {
    return null;
  }
  if (toolName === "git" && !_GIT_EXPORT_SUBCOMMANDS.has(sub)) {
    return null;
  }
  return cls;
}

function extractFlagValues(commandArgs: string[], flags: string[]): string[] {
  const results: string[] = [];
  for (let i = 0; i < commandArgs.length; i++) {
    const token = commandArgs[i];
    if (flags.includes(token)) {
      const next = commandArgs[i + 1];
      if (next !== undefined && !next.startsWith("-")) {
        results.push(next);
        i += 1;
      }
    } else {
      for (const flag of flags) {
        if (flag.length > 1 && token.startsWith(`${flag}=`)) {
          results.push(token.slice(flag.length + 1));
        }
      }
    }
  }
  return results;
}

async function extractCommandFilePayloads(args: {
  toolName: string;
  commandArgs: string[];
  cwd: string;
}): Promise<string[]> {
  const payloads: string[] = [];
  const { toolName, commandArgs, cwd } = args;

  if (toolName === "curl" || toolName === "wget") {
    for (const value of extractFlagValues(commandArgs, ["-d", "--data", "--data-binary", "--data-raw", "-T", "--upload-file"])) {
      if (value.startsWith("@")) {
        try {
          const content = await fs.readFile(path.resolve(cwd, value.slice(1)), "utf8");
          payloads.push(`file:${value.slice(1)}\n${content.slice(0, MAX_TOOL_DOOR_FILE_BYTES)}`);
        } catch { continue; }
      } else {
        payloads.push(value.slice(0, MAX_TOOL_DOOR_FILE_BYTES));
      }
    }
  }

  if (toolName === "tar" || toolName === "zip" || toolName === "gzip" || toolName === "7z") {
    for (const token of commandArgs.filter((t) => !t.startsWith("-"))) {
      try {
        const filePath = path.resolve(cwd, token);
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          const content = await fs.readFile(filePath, "utf8");
          payloads.push(`file:${token}\n${content.slice(0, MAX_TOOL_DOOR_FILE_BYTES)}`);
        }
      } catch { continue; }
    }
  }

  if (["python", "python3", "node", "bash", "sh", "zsh"].includes(toolName)) {
    for (const value of extractFlagValues(commandArgs, ["-c"])) {
      payloads.push(value.slice(0, MAX_TOOL_DOOR_FILE_BYTES));
    }
    const scriptArg = commandArgs.find((t) => !t.startsWith("-"));
    if (scriptArg) {
      try {
        const content = await fs.readFile(path.resolve(cwd, scriptArg), "utf8");
        payloads.push(`file:${scriptArg}\n${content.slice(0, MAX_TOOL_DOOR_FILE_BYTES)}`);
      } catch { /* not a readable script file */ }
    }
  }

  if (toolName === "scp" || toolName === "rsync" || toolName === "sftp") {
    for (const token of commandArgs.filter((t) => !t.startsWith("-") && !t.includes(":"))) {
      try {
        const filePath = path.resolve(cwd, token);
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          const content = await fs.readFile(filePath, "utf8");
          payloads.push(`file:${token}\n${content.slice(0, MAX_TOOL_DOOR_FILE_BYTES)}`);
        }
      } catch { continue; }
    }
  }

  if (toolName === "docker" || toolName === "podman") {
    for (const value of extractFlagValues(commandArgs, ["--secret"])) {
      const srcMatch = /src=([^,]+)/.exec(value);
      if (srcMatch) {
        try {
          const content = await fs.readFile(path.resolve(cwd, srcMatch[1]), "utf8");
          payloads.push(`file:${srcMatch[1]}\n${content.slice(0, MAX_TOOL_DOOR_FILE_BYTES)}`);
        } catch { continue; }
      }
    }
  }

  return payloads;
}

export async function inferBoundaryCommandDoorSignals(args: {
  config: BoundaryRuntimeConfig;
  toolName: string;
  commandArgs: string[];
  cwd: string;
}): Promise<BoundaryToolDoorSignals | null> {
  const payloadClass = classifyCommandPayloadClass(args.toolName, args.commandArgs);
  if (!payloadClass) return null;

  if (args.toolName === "git" || args.toolName === "gh") {
    return inferBoundaryToolDoorSignals({
      config: args.config,
      toolName: args.toolName as "git" | "gh",
      commandArgs: args.commandArgs,
      cwd: args.cwd,
    });
  }

  const basePayload = `${args.toolName} ${args.commandArgs.join(" ")}`.trim();
  const filePayloads = await extractCommandFilePayloads({
    toolName: args.toolName,
    commandArgs: args.commandArgs,
    cwd: args.cwd,
  });

  return mergeDoorSignals({
    basePayload,
    extraPayloads: filePayloads,
    config: args.config,
  });
}
