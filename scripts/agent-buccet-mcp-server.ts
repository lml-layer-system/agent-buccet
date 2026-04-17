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

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// ─── arg parsing ────────────────────────────────────────────────────────────

type ParsedArgs = {
  sessionId: string;
  actorId: string;
  sessionsDir: string;
  home: string;
  dryRun: boolean;
};

function usage(): never {
  process.stderr.write(
    [
      "Usage:",
      "  node scripts/agent-buccet-mcp-server.ts",
      "    --session-id <id>",
      "    --actor-id <id>",
      "    --sessions-dir <path>",
      "    --home <path>",
      "    [--dry-run]",
    ].join("\n") + "\n",
  );
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  let sessionId = "";
  let actorId = "";
  let sessionsDir = "";
  let home = process.env.AGENT_BUCCET_HOME ?? path.join(os.homedir(), ".buccet");
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--session-id") { sessionId = argv[++i] ?? usage(); continue; }
    if (t === "--actor-id") { actorId = argv[++i] ?? usage(); continue; }
    if (t === "--sessions-dir") { sessionsDir = argv[++i] ?? usage(); continue; }
    if (t === "--home") { home = argv[++i] ?? usage(); continue; }
    if (t === "--dry-run") { dryRun = true; continue; }
  }

  if (!sessionId || !actorId || !sessionsDir) {
    usage();
  }
  return { sessionId, actorId, sessionsDir, home, dryRun };
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
  process.stdout.write(JSON.stringify(res) + "\n");
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
    description: "Read the contents of a file at the given path. Enforced by Buccet boundary (fs.read).",
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
    description: "Write content to a file at the given path. Creates the file if it does not exist. Enforced by Buccet boundary (fs.write).",
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
    description: "Append content to a file at the given path. Enforced by Buccet boundary (fs.append).",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or relative path to the file to append to." },
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
    description: "Create a directory (and any parents) at the given path. Enforced by Buccet boundary (fs.mkdir).",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute or relative path of the directory to create." },
      },
      required: ["path"],
    },
  },
  {
    name: "move_file",
    description: "Move or rename a file from one path to another. Enforced by Buccet boundary (fs.move).",
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
    description: "Run a shell command and capture its output. Enforced by Buccet boundary (tool.exec).",
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
    description: "Emit a chat message to the primary surface. Enforced by Buccet boundary (chat.emit).",
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
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  const inp = input as Record<string, unknown>;

  switch (toolName) {
    case "read_file": {
      const filePath = String(inp.path ?? "");
      const text = await fs.readFile(filePath, "utf8");
      return { content: [{ type: "text", text }] };
    }
    case "write_file": {
      const filePath = String(inp.path ?? "");
      const content = String(inp.content ?? "");
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, "utf8");
      return { content: [{ type: "text", text: `Written ${content.length} bytes to ${filePath}` }] };
    }
    case "append_file": {
      const filePath = String(inp.path ?? "");
      const content = String(inp.content ?? "");
      await fs.appendFile(filePath, content, "utf8");
      return { content: [{ type: "text", text: `Appended ${content.length} bytes to ${filePath}` }] };
    }
    case "delete_file": {
      const filePath = String(inp.path ?? "");
      await fs.unlink(filePath);
      return { content: [{ type: "text", text: `Deleted ${filePath}` }] };
    }
    case "make_directory": {
      const dirPath = String(inp.path ?? "");
      await fs.mkdir(dirPath, { recursive: true });
      return { content: [{ type: "text", text: `Created directory ${dirPath}` }] };
    }
    case "move_file": {
      const from = String(inp.from ?? "");
      const to = String(inp.to ?? "");
      await fs.mkdir(path.dirname(to), { recursive: true });
      await fs.rename(from, to);
      return { content: [{ type: "text", text: `Moved ${from} → ${to}` }] };
    }
    case "run_command": {
      const command = String(inp.command ?? "");
      const args = inp.args ? String(inp.args).split(/\s+/).filter(Boolean) : [];
      const cwd = inp.cwd ? String(inp.cwd) : process.cwd();
      const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
        const child = spawn(command, args, {
          cwd,
          stdio: ["ignore", "pipe", "pipe"],
          env: process.env,
          shell: false,
        });
        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
        child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
        child.on("error", reject);
        child.on("close", (code) => resolve({ stdout, stderr, code }));
      });
      const text = [
        result.stdout,
        result.stderr ? `[stderr]\n${result.stderr}` : "",
        `[exit ${result.code ?? 0}]`,
      ].filter(Boolean).join("\n");
      return { content: [{ type: "text", text }] };
    }
    case "send_http_request": {
      const url = String(inp.url ?? "");
      const method = String(inp.method ?? "GET").toUpperCase();
      const body = inp.body ? String(inp.body) : undefined;
      const headersRaw = inp.headers ? String(inp.headers) : undefined;
      const headers: Record<string, string> = headersRaw ? JSON.parse(headersRaw) : {};
      const res = await fetch(url, { method, body, headers });
      const text = await res.text();
      return {
        content: [{
          type: "text",
          text: `HTTP ${res.status} ${res.statusText}\n\n${text}`,
        }],
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

type BoundaryInterceptActionClass = "file" | "shell" | "network" | "database" | "system" | "communication";

type ToolBoundaryMapping = {
  actionClass: BoundaryInterceptActionClass;
  operation: string;
  describeTarget: (input: Record<string, unknown>) => string;
  describePayload?: (input: Record<string, unknown>) => string | undefined;
};

const TOOL_BOUNDARY_MAP: Record<string, ToolBoundaryMapping> = {
  read_file:         { actionClass: "file",          operation: "read",    describeTarget: (i) => String(i.path ?? "") },
  write_file:        { actionClass: "file",          operation: "write",   describeTarget: (i) => String(i.path ?? ""), describePayload: (i) => `${String(i.content ?? "").length} bytes` },
  append_file:       { actionClass: "file",          operation: "append",  describeTarget: (i) => String(i.path ?? "") },
  delete_file:       { actionClass: "file",          operation: "delete",  describeTarget: (i) => String(i.path ?? "") },
  make_directory:    { actionClass: "file",          operation: "mkdir",   describeTarget: (i) => String(i.path ?? "") },
  move_file:         { actionClass: "file",          operation: "move",    describeTarget: (i) => `${i.from} → ${i.to}` },
  run_command:       { actionClass: "shell",         operation: "exec",    describeTarget: (i) => String(i.command ?? "") },
  send_http_request: { actionClass: "network",       operation: "send",    describeTarget: (i) => String(i.url ?? "") },
  read_env:          { actionClass: "system",        operation: "env.read", describeTarget: (i) => String(i.key ?? "") },
  emit_chat:         { actionClass: "communication", operation: "emit",    describeTarget: () => "chat:primary" },
};

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Change to the Buccet home so relative paths resolve correctly.
  await fs.mkdir(args.home, { recursive: true });
  process.chdir(args.home);

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));

  // Load the boundary library and intercept module at startup.
  const boundary = await import(path.join(scriptDir, "../lib/agent-buccet/index.ts"));
  const intercept = await import(path.join(scriptDir, "../lib/agent-buccet/intercept.ts"));
  const { createBoundaryFunnelInterceptRequest, evaluateBoundaryIntercept } = intercept;
  // enableBodyguardControl sets bodyguardOnline: true so the inline law evaluator
  // (evaluateBodyguardAction) runs. Without it resolveBodyguardHeldRequest denies
  // with BODYGUARD.OFFLINE.01.
  const { enableBodyguardControl } = boundary;

  // Restore or start the boundary session.
  const restored = await boundary.restoreBoundaryRuntimeStore({
    sessionId: args.sessionId,
    sessionsDir: args.sessionsDir,
    hydrationMode: "full",
  });
  const store = restored ?? await boundary.createPersistentBoundaryRuntimeStore({
    sessionId: args.sessionId,
    actorId: args.actorId,
    dryRun: args.dryRun,
    sessionsDir: args.sessionsDir,
    hydrationMode: "full",
  });

  const config = store.getConfig();

  // ── JSON-RPC 2.0 stdio loop ───────────────────────────────────────────────
  //
  // We track in-flight requests so that when stdin closes we wait for all
  // pending tool calls to complete before exiting.

  let initialized = false;
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
      const callParams = params as { name?: string; arguments?: unknown } | undefined;
      const toolName = callParams?.name ?? "";
      const toolInput = callParams?.arguments ?? {};

      const mapping = TOOL_BOUNDARY_MAP[toolName];
      if (!mapping) {
        respondResult(id, {
          content: [{
            type: "text",
            text: `Tool "${toolName}" is not registered in the Buccet boundary tool registry. Unknown tools are denied.\n\nlawId: BOUNDARY.TOOL.UNMAPPED`,
          }],
          isError: true,
        });
        return;
      }

      const inputRecord = toolInput as Record<string, unknown>;

      // Route through the full boundary enforcement chain.
      // enableBodyguardControl sets bodyguardOnline: true so the inline law
      // evaluator runs (evaluateBodyguardAction) rather than denying offline.
      const request = createBoundaryFunnelInterceptRequest({
        source: "framework",
        rawAction: toolName,
        actionClass: mapping.actionClass,
        operation: mapping.operation,
        target: mapping.describeTarget(inputRecord),
        payloadSummary: mapping.describePayload?.(inputRecord),
        provenance: "mcp_host",
        extra: "adapter=mcp",
      });

      const result = await evaluateBoundaryIntercept({
        config: enableBodyguardControl(config),
        request,
      });

      if (result.decision === "deny") {
        respondResult(id, {
          content: [{
            type: "text",
            text: [
              `Boundary denied: ${result.reason}`,
              result.lawIds?.length ? `lawIds: ${result.lawIds.join(", ")}` : "",
            ].filter(Boolean).join("\n"),
          }],
          isError: true,
        });
        return;
      }

      if (result.decision === "require_approval") {
        respondResult(id, {
          content: [{
            type: "text",
            text: [
              `Boundary requires approval: ${result.reason}`,
              result.lawIds?.length ? `lawIds: ${result.lawIds.join(", ")}` : "",
              "Approve via: buccet console",
            ].filter(Boolean).join("\n"),
          }],
          isError: true,
        });
        return;
      }

      // Boundary allows — execute.
      try {
        const execResult = await execTool(toolName, toolInput);
        respondResult(id, execResult);
      } catch (err) {
        respondResult(id, {
          content: [{
            type: "text",
            text: `Execution error: ${err instanceof Error ? err.message : String(err)}`,
          }],
          isError: true,
        });
      }
      return;
    }

    respondError(id, -32601, `Method not found: ${method}`);
  }

  await new Promise<void>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

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

      track(handleRequest(req).catch((err) => {
        process.stderr.write(`[buccet-mcp] request error: ${err instanceof Error ? err.message : String(err)}\n`);
      }));
    });

    rl.on("close", () => {
      // Wait for all in-flight requests before resolving.
      void Promise.all([...inFlight]).then(resolve);
    });

    process.once("SIGTERM", () => { rl.close(); });
    process.once("SIGINT",  () => { rl.close(); });
  });
}

main().catch((err) => {
  process.stderr.write(`[buccet-mcp] fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
