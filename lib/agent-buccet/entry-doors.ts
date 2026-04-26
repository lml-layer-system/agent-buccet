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
} from "./types.ts";

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
