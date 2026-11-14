#!/usr/bin/env node
/**
 * Agent Buccet MCP Server
 *
 * Model Context Protocol (MCP) server over stdio — JSON-RPC 2.0.
 * Every tool call is routed through the full Buccet boundary enforcement chain
 * (gravity → bodyguard → law evaluation) before execution.
 *
 * MCP is transport only. No Buccet logic is duplicated or bypassed here.
 * All calls are recorded in the ledger with provenance "mcp_host".
 *
 * Invoked by `buccet mcp`. Not intended to be called directly.
 */

import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { pathToFileURL } from "node:url";
import { loadBuccetBoxBridge } from "../src/box/bridge.ts";
import { fetchBuccetApprovedDestination } from "../src/box/safe-http.ts";
import { executeScopedFileTool } from "../src/box/confined-fs.ts";
import { readMcpSessionOwnerProof, verifyMcpSessionOwner } from "../src/box/session-authority.ts";
import type { BoundaryPathLaw } from "../src/runtime/types.ts";

// ─── arg parsing ────────────────────────────────────────────────────────────

type ParsedArgs = {
  sessionId: string;
  actorId: string;
  sessionsDir: string;
  home: string;
  dryRun: boolean;
  /** Explicit host-provisioned FD; untrusted CLI actor/session strings are not credentials. */
  mcpOwnerProofFd?: number;
};

function usage(): never {
  process.stderr.write(
    `${[
      "Usage:",
      "  node scripts/agent-buccet-mcp-server.ts",
      "    --session-id <id>",
      "    --actor-id <id>",
      "    --sessions-dir <path>",
      "    --home <path>",
      "    [--session-owner-fd 3]  (trusted host pipe; required for restored grants)",
      "    [--dry-run]",
    ].join("\n")}\n`,
  );
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  let sessionId = "";
  let actorId = "";
  let sessionsDir = "";
  let home = process.env.AGENT_BUCCET_HOME ?? path.join(os.homedir(), ".buccet");
  let dryRun = false;
  let mcpOwnerProofFd: number | undefined;

  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--session-id") {
      sessionId = argv[++i] ?? usage();
      continue;
    }
    if (t === "--actor-id") {
      actorId = argv[++i] ?? usage();
      continue;
    }
    if (t === "--sessions-dir") {
      sessionsDir = argv[++i] ?? usage();
      continue;
    }
    if (t === "--home") {
      home = argv[++i] ?? usage();
      continue;
    }
    if (t === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (t === "--session-owner-fd") {
      const fd = Number(argv[++i] ?? usage());
      if (!Number.isSafeInteger(fd) || fd < 3 || fd > 1024) usage();
      mcpOwnerProofFd = fd;
      continue;
    }
  }

  if (!sessionId || !actorId || !sessionsDir) {
    usage();
  }
  return { sessionId, actorId, sessionsDir, home, dryRun, mcpOwnerProofFd };
}

// ─── MCP JSON-RPC 2.0 types ─────────────────────────────────────────────────

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
};

function respond(res: JsonRpcResponse): void {
  process.stdout.write(`${JSON.stringify(res)}\n`);
}

function respondError(id: string | number | null, code: number, message: string): void {
  respond({ jsonrpc: "2.0", id, error: { code, message } });
}

function respondResult(id: string | number | null, result: unknown): void {
  respond({ jsonrpc: "2.0", id, result });
}

// ─── tool definitions ────────────────────────────────────────────────────────

const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "read_file",
    description:
      "Read the contents of a file at the given path. Enforced by Buccet boundary (fs.read).",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or relative path to the file to read." },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Write content to a file at the given path. Creates the file if it does not exist. Enforced by Buccet boundary (fs.write).",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or relative path to the file to write." },
        content: { type: "string", description: "Text content to write to the file." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "append_file",
    description:
      "Append content to a file at the given path. Enforced by Buccet boundary (fs.append).",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute or relative path to the file to append to.",
        },
        content: { type: "string", description: "Text content to append." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "delete_file",
    description: "Delete a file at the given path. Enforced by Buccet boundary (fs.delete).",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or relative path to the file to delete." },
      },
      required: ["path"],
    },
  },
  {
    name: "make_directory",
    description:
      "Create a directory (and any parents) at the given path. Enforced by Buccet boundary (fs.mkdir).",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute or relative path of the directory to create.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "move_file",
    description:
      "Move or rename a file from one path to another. Enforced by Buccet boundary (fs.move).",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Source path." },
        to: { type: "string", description: "Destination path." },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "run_command",
    description:
      "Run a shell command and capture its output. Enforced by Buccet boundary (tool.exec).",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "The command to run." },
        args: { type: "string", description: "Space-separated arguments (optional)." },
        cwd: { type: "string", description: "Working directory for the command (optional)." },
      },
      required: ["command"],
    },
  },
  {
    name: "send_http_request",
    description: "Send an HTTP request to a URL. Enforced by Buccet boundary (network.send).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to send the request to." },
        method: { type: "string", description: "HTTP method (GET, POST, PUT, DELETE, etc.)." },
        body: { type: "string", description: "Request body (optional)." },
        headers: { type: "string", description: "JSON-encoded headers object (optional)." },
      },
      required: ["url"],
    },
  },
  {
    name: "read_env",
    description: "Read an environment variable. Enforced by Buccet boundary (sys.env.read).",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Environment variable name." },
      },
      required: ["key"],
    },
  },
  {
    name: "emit_chat",
    description:
      "Emit a chat message to the primary surface. Enforced by Buccet boundary (chat.emit).",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The message to emit." },
      },
      required: ["message"],
    },
  },
];

// ─── tool execution ──────────────────────────────────────────────────────────

async function execTool(
  toolName: string,
  input: unknown,
  options?: {
    fsPathLaws?: BoundaryPathLaw[];
    runCommand?: (
      command: string,
      args: string[],
      cwd: string,
    ) => Promise<{
      stdout: string;
      stderr: string;
      exitCode: number;
    }>;
  },
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const inp = input as Record<string, unknown>;

  switch (toolName) {
    case "read_file":
    case "write_file":
    case "append_file":
    case "delete_file":
    case "make_directory":
    case "move_file": {
      const text = await executeScopedFileTool(toolName, inp, options?.fsPathLaws ?? []);
      return { content: [{ type: "text", text }] };
    }
    case "run_command": {
      const command = String(inp.command ?? "");
      const args = inp.args ? String(inp.args).split(/\s+/).filter(Boolean) : [];
      const cwd = inp.cwd ? String(inp.cwd) : process.cwd();
      if (!options?.runCommand) {
        throw new Error("run_command executor is not configured");
      }
      const result = await options.runCommand(command, args, cwd);
      const text = [
        result.stdout,
        result.stderr ? `[stderr]\n${result.stderr}` : "",
        `[exit ${result.exitCode}]`,
      ]
        .filter(Boolean)
        .join("\n");
      return { content: [{ type: "text", text }] };
    }
    case "send_http_request": {
      const url = String(inp.url ?? "");
      const method = String(inp.method ?? "GET").toUpperCase();
      const body = inp.body ? String(inp.body) : undefined;
      const headersRaw = inp.headers ? String(inp.headers) : undefined;
      const headers: Record<string, string> = headersRaw ? JSON.parse(headersRaw) : {};
      const res = await fetchBuccetApprovedDestination(url, { method, body, headers });
      const text = await res.text();
      return {
        content: [
          {
            type: "text",
            text: `HTTP ${res.status} ${res.statusText}\n\n${text}`,
          },
        ],
      };
    }
    case "read_env": {
      const key = String(inp.key ?? "");
      const value = process.env[key];
      if (value === undefined) {
        return { content: [{ type: "text", text: `Environment variable "${key}" is not set.` }] };
      }
      return { content: [{ type: "text", text: value }] };
    }
    case "emit_chat": {
      const message = String(inp.message ?? "");
      return { content: [{ type: "text", text: message }] };
    }
    default: {
      return {
        content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
        isError: true,
      };
    }
  }
}

// ─── boundary action class mapping ──────────────────────────────────────────

type BoundaryInterceptActionClass =
  | "file"
  | "shell"
  | "network"
  | "database"
  | "system"
  | "communication";

type ToolBoundaryMapping = {
  actionClass: BoundaryInterceptActionClass;
  operation: string;
  describeTarget: (input: Record<string, unknown>) => string;
  describePayload?: (input: Record<string, unknown>) => string | undefined;
};

/**
 * Bind human approval to a digest of the ENTIRE consequential payload. The
 * preview is for readability; the full SHA-256 distinguishes same-length
 * writes, command arguments, headers, and request bodies.
 */
function describeApprovalPayload(kind: "file" | "command" | "http", input: Record<string, unknown>): string {
  let complete: string;
  if (kind === "file") {
    complete = String(input.content ?? "");
    const preview = JSON.stringify(complete.slice(0, 160));
    const hash = createHash("sha256").update(complete).digest("hex");
    return `size=${Buffer.byteLength(complete, "utf8")} bytes; sha256=${hash}; preview=${preview}${complete.length > 160 ? " [truncated]" : ""}`;
  }
  if (kind === "command") {
    complete = JSON.stringify({
      command: String(input.command ?? ""),
      args: String(input.args ?? ""),
      cwd: String(input.cwd ?? ""),
    });
  } else {
    complete = JSON.stringify({
      url: String(input.url ?? ""),
      method: String(input.method ?? "GET").toUpperCase(),
      body: String(input.body ?? ""),
      headers: String(input.headers ?? ""),
    });
  }
  const hash = createHash("sha256").update(complete).digest("hex");
  return `sha256=${hash}; params=${complete.slice(0, 320)}${complete.length > 320 ? " [truncated]" : ""}`;
}

const TOOL_BOUNDARY_MAP: Record<string, ToolBoundaryMapping> = {
  read_file: {
    actionClass: "file",
    operation: "read",
    describeTarget: (i) => String(i.path ?? ""),
  },
  write_file: {
    actionClass: "file",
    operation: "write",
    describeTarget: (i) => String(i.path ?? ""),
    describePayload: (i) => describeApprovalPayload("file", i),
  },
  append_file: {
    actionClass: "file",
    operation: "append",
    describeTarget: (i) => String(i.path ?? ""),
    describePayload: (i) => describeApprovalPayload("file", i),
  },
  delete_file: {
    actionClass: "file",
    operation: "delete",
    describeTarget: (i) => String(i.path ?? ""),
  },
  make_directory: {
    actionClass: "file",
    operation: "mkdir",
    describeTarget: (i) => String(i.path ?? ""),
  },
  move_file: {
    actionClass: "file",
    operation: "move",
    describeTarget: (i) => `${i.from} → ${i.to}`,
  },
  run_command: {
    actionClass: "shell",
    operation: "exec",
    describeTarget: (i) => String(i.command ?? ""),
    describePayload: (i) => describeApprovalPayload("command", i),
  },
  send_http_request: {
    actionClass: "network",
    operation: "send",
    describeTarget: (i) => String(i.url ?? ""),
    describePayload: (i) => describeApprovalPayload("http", i),
  },
  read_env: {
    actionClass: "system",
    operation: "env.read",
    describeTarget: (i) => String(i.key ?? ""),
  },
  emit_chat: {
    actionClass: "communication",
    operation: "emit",
    describeTarget: () => "chat:primary",
  },
};

// ─── main ────────────────────────────────────────────────────────────────────

export async function runBuccetMcpServer(input: ParsedArgs | string[] = process.argv.slice(2)) {
  const args = Array.isArray(input) ? parseArgs(input) : input;
  const originalCwd = process.cwd();

  try {
    // Change to the Buccet home so relative paths resolve correctly.
    await fs.mkdir(args.home, { recursive: true });
    process.chdir(args.home);

    // Load the boundary library and intercept module at startup.
    // Use static-looking relative specifiers so the module resolver works
    // identically on all platforms (absolute paths break on Linux).
    const boundary = await import("./../src/index.ts");
    const intercept = await import("./../src/runtime/intercept.ts");
    const {
      createBoundaryFunnelInterceptRequest,
      evaluateBoundaryIntercept,
      mapInterceptToBoundaryAction,
    } = intercept;
    const {
      createBoundaryActionRequest,
      enableBodyguardControl,
      recordBoundaryApprovalRequested,
      recordBoundaryBlockedAction,
      recordBoundaryDecisionReturned,
      recordBoundaryProposedAction,
    } = boundary;
    // Only the trusted host launch channel can present a session capability.
    // Neither --session-id nor --actor-id confers owner authority.
    const ownerProof = args.mcpOwnerProofFd === undefined
      ? null : readMcpSessionOwnerProof(args.mcpOwnerProofFd);
    if (args.mcpOwnerProofFd !== undefined && !ownerProof) {
      throw new Error("BUCCET_SESSION_PROOF_DENIED: invalid trusted host owner pipe");
    }
    // Restore or start the boundary session.
    const restored = await boundary.restoreBoundaryRuntimeStore({
      sessionId: args.sessionId,
      sessionsDir: args.sessionsDir,
      hydrationMode: "full",
    });
    const store =
      restored ??
      (await boundary.createPersistentBoundaryRuntimeStore({
        sessionId: args.sessionId,
        actorId: args.actorId,
        ...(ownerProof ? { mcpOwnerProof: ownerProof } : {}),
        dryRun: args.dryRun,
        sessionsDir: args.sessionsDir,
        hydrationMode: "full",
      }));

    // A restored session is authority belonging to its original actor.
    // A caller may name a session, but may not inherit another actor's grants.
    if (store.getConfig().session.actorId !== args.actorId) {
      throw new Error("BUCCET_IDENTITY_DENIED: restored session actor mismatch");
    }
    // Preempt ID-02: matching the *labels* of victim actor/session does not
    // confer the victim process' restored authority. Legacy sessions with
    // path grants but no owner binding fail closed; operator must re-provision
    // their host launch capability instead of silently trusting same-UID CLI.
    const saved = store.getConfig();
    const hasRestoredAuthority = restored !== null && (
      saved.pathLaws.length > 0 ||
      saved.grants.some((grant: { resourceKind: string }) => grant.resourceKind !== "chat")
    );
    if (restored && (hasRestoredAuthority || saved.session.mcpOwnerDigest)) {
      if (!verifyMcpSessionOwner(args.sessionId, args.actorId,
          saved.session.mcpOwnerDigest, ownerProof)) {
        throw new Error("BUCCET_SESSION_PROOF_DENIED: restored authority requires host proof");
      }
    }

    let config = store.getConfig();
    let initialized = false;
    const cancelledCalls = new Set<string>();
    const cancellationKey = (id: unknown) => JSON.stringify(id);
    let actionQueue: Promise<void> = Promise.resolve();
    const inFlight = new Set<Promise<void>>();

    function track(p: Promise<void>): void {
      inFlight.add(p);
      p.finally(() => inFlight.delete(p));
    }

    async function handleRequest(req: JsonRpcRequest): Promise<void> {
      const { id, method, params } = req;

      if (method === "initialize") {
        initialized = true;
        respondResult(id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "agent-buccet", version: "0.1.0" },
        });
        return;
      }

      if (method === "notifications/initialized") {
        return;
      }

      if (method === "ping") {
        respondResult(id, {});
        return;
      }

      if (!initialized) {
        respondError(id, -32002, "Server not initialized");
        return;
      }

      if (method === "tools/list") {
        respondResult(id, { tools: MCP_TOOLS });
        return;
      }

      if (method === "tools/call") {
        if (cancelledCalls.has(cancellationKey(id))) {
          respondError(id, -32800, "Buccet MCP request cancelled before execution");
          return;
        }
        const callParams = params as { name?: string; arguments?: unknown } | undefined;
        const toolName = callParams?.name ?? "";
        const toolInput = callParams?.arguments ?? {};

        const mapping = TOOL_BOUNDARY_MAP[toolName];
        if (!mapping) {
          respondResult(id, {
            content: [
              {
                type: "text",
                text: `Tool "${toolName}" is not registered in the Buccet boundary tool registry. Unknown tools are denied.\n\nlawId: BOUNDARY.TOOL.UNMAPPED`,
              },
            ],
            isError: true,
          });
          return;
        }

        const inputRecord = toolInput as Record<string, unknown>;
        const requestId = `${toolName}:${randomUUID()}`;
        const requestedAt = new Date().toISOString();
        const target = mapping.describeTarget(inputRecord);
        const payloadSummary = mapping.describePayload?.(inputRecord);
        const actionKind = mapInterceptToBoundaryAction({
          actionClass: mapping.actionClass,
          operation: mapping.operation,
          target,
          payloadSummary,
          provenance: "mcp_host",
        });
        const boundaryRequest = createBoundaryActionRequest({
          config,
          requestId,
          requestedAt,
          actionKind,
          target,
          payloadSummary,
          provenance: "mcp_host",
        });

        await recordBoundaryProposedAction(config, boundaryRequest, "mcp tool call proposed");

        const request = createBoundaryFunnelInterceptRequest({
          source: "framework",
          rawAction: toolName,
          actionClass: mapping.actionClass,
          operation: mapping.operation,
          target,
          payloadSummary,
          provenance: "mcp_host",
          extra: "adapter=mcp",
        });

        const result = await evaluateBoundaryIntercept({
          config: enableBodyguardControl(config),
          request,
        });
        await recordBoundaryDecisionReturned(
          config,
          boundaryRequest,
          result.reason,
          result.decision,
          result.lawIds,
        );

        // The box is transport, not law. The intercept verdict is the first
        // gate; the canonical action runner is a second, deny-wins gate.
        // The agent cannot authorize itself by calling a separate MCP tool.
        let box: Awaited<ReturnType<typeof loadBuccetBoxBridge>>;
        try {
          box = await loadBuccetBoxBridge();
        } catch {
          await recordBoundaryBlockedAction(
            config, boundaryRequest, "Invalid local Box bridge configuration", result.lawIds,
          );
          respondResult(id, {
            content: [{ type: "text", text: "Buccet Box configuration invalid; action blocked." }],
            isError: true,
          });
          return;
        }
        async function report(decision: "allow" | "deny", reason: string) {
          await box?.record({
            requestId,
            actorId: args.actorId,
            actionKind,
            target,
            decision,
            reason,
          });
        }
        if (result.decision === "deny") {
          await recordBoundaryBlockedAction(config, boundaryRequest, result.reason, result.lawIds);
          await report("deny", result.reason);
          respondResult(id, {
            content: [{ type: "text", text: `Boundary denied: ${result.reason}` }],
            isError: true,
          });
          return;
        }

        // A require_approval verdict MUST obtain standing UPL approval or a
        // human answer before any action can enter the executor.
        // In autonomous mode, standing UPL is consulted without asking.
        // In interactive mode, an unanswered or disconnected box denies.
        let operatorChoice:
          | "allow_once"
          | "allow_as_law"
          | "deny_once"
          | "deny_as_law"
          | null = null;
        if (result.decision === "require_approval") {
          await recordBoundaryApprovalRequested({
            config,
            request: boundaryRequest,
            reason: result.reason,
            lawIds: result.lawIds,
          });
          const response = box
            ? await box.requestApproval({
                requestId,
                sessionId: args.sessionId,
                actorId: args.actorId,
                actionKind,
                target,
                payloadSummary,
                reason: result.reason,
                lawIds: result.lawIds,
                question: `Should ${args.actorId} perform ${actionKind} on ${target}?`,
              })
            : { mode: "interactive" as const, choice: "deny_once" as const };
          if (response.mode === "interactive") operatorChoice = response.choice ?? "deny_once";
          if (response.mode === "autonomous") {
            // A non-interactive response is NOT authorization. Require a
            // matching, currently active UPL acceptance rail right now.
            const standing = boundary.createBoundaryHeadlessApprovalHandler({
              mode: "follow_upl",
              getLedger: async () => store.getConfig().upl ?? boundary.loadUserPathLedger(),
            });
            const standingDecision = await standing({
              session: config.session,
              request: boundaryRequest,
              reason: result.reason,
              lawIds: result.lawIds,
              bodyguardMoves: result.bodyguardMoves,
              prompt: {
                title: "Autonomous UPL decision",
                question: "Does standing UPL authorize this exact proposal?",
                surface: "action",
                lawIds: result.lawIds,
                options: [],
              },
            });
            operatorChoice = typeof standingDecision === "boolean"
              ? (standingDecision ? "allow_once" : "deny_once")
              : "choice" in standingDecision
                ? standingDecision.choice
                : (standingDecision.approved ? "allow_once" : "deny_once");
          }
          if (operatorChoice === "deny_once" || operatorChoice === "deny_as_law") {
            const reason = box ? "Human denied this action" : "Buccet Box unavailable: approval denied";
            await recordBoundaryBlockedAction(config, boundaryRequest, reason, result.lawIds);
            await report("deny", reason);
            respondResult(id, {
              content: [{ type: "text", text: `Boundary denied: ${reason}` }],
              isError: true,
            });
            return;
          }
        }

        // The host may cancel while the human approval prompt is held.
        // A stale approval click is never authority to execute a cancelled call.
        if (cancelledCalls.has(cancellationKey(id))) {
          await recordBoundaryBlockedAction(config, boundaryRequest,
            "MCP host cancelled this request", result.lawIds);
          await report("deny", "MCP host cancelled this request");
          respondResult(id, {
            content: [{ type: "text", text: "Buccet denied: MCP request cancelled" }],
            isError: true,
          });
          return;
        }

        // The action must still pass the existing Bodyguard/UPL runtime, even
        // after the Box supplies a decision. Only the frozen proposal may use
        // its one-time choice. A second approval request fails closed.
        const activeConfig = store.getConfig();
        // Durable revocations can arrive from another Buccet process while
        // this one is held at a human approval prompt. Compare the exact
        // persisted path authority before using this process's cached grant.
        // This closes the demonstrated revocation-during-approval window,
        // but is not a cross-process atomic transaction with the later syscall.
        const pathAuthoritySnapshot = (laws: typeof activeConfig.pathLaws) =>
          JSON.stringify(laws.map((law) => ({
            lawId: law.lawId,
            sessionId: law.sessionId,
            rootPath: law.rootPath,
            grantedActions: [...law.grantedActions].sort(),
            revokedAt: law.revokedAt ?? null,
            expiresAt: law.expiresAt ?? null,
          })).sort((a, b) => a.lawId.localeCompare(b.lawId)));
        const currentStore = await boundary.restoreBoundaryRuntimeStore({
          sessionId: args.sessionId,
          sessionsDir: args.sessionsDir,
          hydrationMode: "full",
        });
        const currentConfig = currentStore?.getConfig();
        if (!currentConfig ||
            currentConfig.session.actorId !== args.actorId ||
            pathAuthoritySnapshot(currentConfig.pathLaws) !==
              pathAuthoritySnapshot(activeConfig.pathLaws)) {
          const reason = "Path authority changed or was revoked while action awaited approval";
          await recordBoundaryBlockedAction(config, boundaryRequest, reason, result.lawIds);
          await report("deny", reason);
          respondResult(id, {
            content: [{ type: "text", text: `Boundary denied: ${reason}` }],
            isError: true,
          });
          return;
        }
        let decisionUsed = false;
        const guardedConfig = enableBodyguardControl({
          ...activeConfig,
          // Force a canonical approval check if the intercept gate required one.
          approvalRequiredFor:
            result.decision === "require_approval"
              ? [...new Set([...(activeConfig.approvalRequiredFor ?? []), actionKind])]
              : activeConfig.approvalRequiredFor,
          approvalHandler: async (approval) => {
            if (decisionUsed) return { choice: "deny_once" as const };
            decisionUsed = true;
            if (approval.request.actionKind !== actionKind ||
                approval.request.target !== target ||
                approval.request.payloadSummary !== payloadSummary) {
              return { choice: "deny_once" as const };
            }
            if (operatorChoice) return { choice: operatorChoice };
            // A new canonical approval gate may be hit even when the MCP
            // intercept preflight returned allow. Surface it interactively.
            const answer = box
              ? await box.requestApproval({
                  requestId: approval.request.requestId,
                  sessionId: approval.session.sessionId,
                  actorId: approval.session.actorId,
                  actionKind: approval.request.actionKind,
                  target: approval.request.target,
                  payloadSummary: approval.request.payloadSummary,
                  reason: approval.reason,
                  lawIds: approval.lawIds,
                  question: approval.prompt.question,
                })
              : { mode: "interactive" as const, choice: "deny_once" as const };
            if (answer.mode === "interactive") return { choice: answer.choice ?? "deny_once" };
            const handler = boundary.createBoundaryHeadlessApprovalHandler({
              mode: "follow_upl",
              getLedger: async () => store.getConfig().upl ?? boundary.loadUserPathLedger(),
            });
            return handler(approval);
          },
        });
        try {
          const final = await boundary.runBoundaryControlledAction({
            config: guardedConfig,
            request: boundaryRequest,
            successReason: `${toolName} executed through Buccet MCP`,
            execute: async () => {
              if (cancelledCalls.has(cancellationKey(id))) {
                throw new Error("BUCCET_MCP_CANCELLED: request cancelled before effect");
              }
              const finalStore = await boundary.restoreBoundaryRuntimeStore({
                sessionId: args.sessionId,
                sessionsDir: args.sessionsDir,
                hydrationMode: "full",
              });
              if (!finalStore ||
                  finalStore.getConfig().session.actorId !== args.actorId ||
                  pathAuthoritySnapshot(finalStore.getConfig().pathLaws) !==
                    pathAuthoritySnapshot(activeConfig.pathLaws)) {
                throw new Error("BUCCET_REVOKED: durable path authority changed before effect");
              }
              return execTool(toolName, toolInput, {
              fsPathLaws: guardedConfig.pathLaws,
              runCommand: async (command, commandArgs, cwd) => {
                const liveConfig = store.getConfig();
                const scopePaths = liveConfig.pathLaws
                  .filter((law: { revokedAt?: unknown; rootPath: string }) => !law.revokedAt)
                  .map((law: { rootPath: string }) => law.rootPath);
                const launched = await boundary.runBoundaryProcess({
                  config: liveConfig,
                  command,
                  commandArgs,
                  scopePaths,
                  requestedCwd: cwd,
                  allowedCommandTargets: [path.basename(command.trim())],
                  ioMode: "capture",
                });
                return {
                  stdout: launched.stdout,
                  stderr: launched.stderr,
                  exitCode: launched.exitCode,
                };
              },
              });
            },
          });
          // Persist the *law changes*, not the per-request approval callback
          // or its temporary action-kind approval gate. Otherwise a single
          // held action could make every subsequent action of its kind ask
          // again (or carry a stale human answer into the next proposal).
          const durableConfig = {
            ...final.config,
            approvalRequiredFor: activeConfig.approvalRequiredFor,
            approvalHandler: activeConfig.approvalHandler,
          };
          config = durableConfig;
          store.replaceConfig(durableConfig);
          if (!final.allowed || !final.executed) {
            const reason = final.reason || "Boundary held or denied execution";
            await report("deny", reason);
            respondResult(id, {
              content: [{ type: "text", text: `Boundary held: ${reason}` }],
              isError: true,
            });
            return;
          }
          await report("allow", final.reason);
          respondResult(id, final.value);
        } catch (err) {
          const reason = `Execution error: ${err instanceof Error ? err.message : String(err)}`;
          await report("deny", reason);
          respondResult(id, {
            content: [{ type: "text", text: reason }],
            isError: true,
          });
        }
        return;
      }

      respondError(id, -32601, `Method not found: ${method}`);
    }

    await new Promise<void>((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        crlfDelay: Number.POSITIVE_INFINITY,
      });

      rl.on("line", (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let req: JsonRpcRequest;
        try {
          req = JSON.parse(trimmed) as JsonRpcRequest;
        } catch {
          respondError(null, -32700, "Parse error");
          return;
        }

        // Cancellation is out-of-band: never queue it behind the action whose
        // approval is awaiting a human. IDs are scoped to this transport.
        if (req.method === "notifications/cancelled") {
          const cancelledId = (req.params as { requestId?: unknown } | undefined)?.requestId;
          if (typeof cancelledId === "string" || typeof cancelledId === "number") {
            cancelledCalls.add(cancellationKey(cancelledId));
          }
          return;
        }

        // Serialize consequence-bearing calls so concurrent agent requests
        // cannot race session-law updates or single-use approvals.
        const run = async () => {
          try {
            await handleRequest(req);
          } catch (err) {
            process.stderr.write(
              `[buccet-mcp] request error: ${err instanceof Error ? err.message : String(err)}\n`,
            );
            respondError(req.id, -32000, "Buccet enforcement failed closed");
          } finally {
            if (req.method === "tools/call") {
              cancelledCalls.delete(cancellationKey(req.id));
            }
          }
        };
        if (req.method === "tools/call") {
          const work = actionQueue.then(run);
          actionQueue = work.catch(() => undefined);
          track(work);
        } else {
          track(run());
        }
      });

      rl.on("close", () => {
        void Promise.all([...inFlight]).then(() => resolve());
      });

      process.once("SIGTERM", () => {
        rl.close();
      });
      process.once("SIGINT", () => {
        rl.close();
      });
    });
  } finally {
    process.chdir(originalCwd);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runBuccetMcpServer(process.argv.slice(2)).catch((err) => {
    process.stderr.write(
      `[buccet-mcp] fatal: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
}
