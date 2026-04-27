import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  describeUserPath,
  hashUserPath,
} from "../lib/agent-buccet/index.ts";
import type {
  BoundaryLedgerRecord,
  BoundaryUplEntry,
} from "../lib/agent-buccet/index.ts";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "scripts", "buccet.ts");

type CliResult = {
  stdout: string;
  stderr: string;
  code: number | null;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

type McpToolCallResult = {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeLauncher(binDir: string) {
  const launcherPath = path.join(binDir, "buccet");
  await fs.mkdir(binDir, { recursive: true });
  await fs.writeFile(
    launcherPath,
    [
      "#!/bin/sh",
      `exec node "${scriptPath}" "$@"`,
      "",
    ].join("\n"),
    "utf8",
  );
  await fs.chmod(launcherPath, 0o755);
  return launcherPath;
}

function makeEnv(args: {
  homePath: string;
  workspacePath: string;
  uplLedgerPath: string;
  launcherDir: string;
}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    AGENT_BUCCET_HOME: args.homePath,
    AGENT_BUCCET_CALLER_CWD: args.workspacePath,
    AGENT_BUCCET_UPL_LEDGER_PATH: args.uplLedgerPath,
    PATH: `${args.launcherDir}${path.delimiter}${process.env.PATH ?? ""}`,
  };
}

function runCli(args: string[], env: NodeJS.ProcessEnv): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("buccet", args, {
      cwd: repoRoot,
      env,
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
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ stdout, stderr, code });
    });
  });
}

async function readLedgerRecords(ledgerPath: string): Promise<BoundaryLedgerRecord[]> {
  const raw = await fs.readFile(ledgerPath, "utf8");
  return raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as BoundaryLedgerRecord);
}

function eventTypesForTarget(args: {
  records: BoundaryLedgerRecord[];
  target: string;
  actionKind?: string;
}) {
  return args.records
    .filter((record) =>
      record.payload.target === args.target
      && (!args.actionKind || record.payload.actionKind === args.actionKind)
    )
    .map((record) => record.META.event_type);
}

async function writeStandingLawLedger(args: {
  uplLedgerPath: string;
  allowedReadTargets: string[];
}) {
  const createdAt = new Date().toISOString();
  const approvedEntries: BoundaryUplEntry[] = args.allowedReadTargets.map((target, index) => {
    const request = {
      sessionId: "upl-global",
      requestId: `upl-read-${index + 1}`,
      requestedAt: new Date(0).toISOString(),
      actionKind: "fs.read" as const,
      target,
      provenance: "mcp_host" as const,
    };
    return {
      id: `UPL-MCP-READ-${String(index + 1).padStart(3, "0")}`,
      type: "APPROVED",
      path: describeUserPath(request),
      pathHash: hashUserPath(request),
      createdAt,
      scope: "GLOBAL",
      status: "ACTIVE",
      witness: "mcp-contract",
      requestBasis: {
        actionKind: request.actionKind,
        target: request.target,
        provenance: request.provenance,
      },
    };
  });

  await fs.writeFile(
    args.uplLedgerPath,
    `${JSON.stringify({
      specVersion: 1,
      userApprovedLawPaths: approvedEntries,
      userDeniedLawPaths: [],
    }, null, 2)}\n`,
    "utf8",
  );
}

class McpClient {
  private nextId = 1;
  private buffer = "";
  private pending = new Map<string, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (error: unknown) => void;
  }>();
  private exitPromise: Promise<number | null>;
  private unexpectedStdout: string[] = [];
  private stderrWaiters: Array<{
    pattern: RegExp;
    resolve: () => void;
    reject: (error: unknown) => void;
    timeout: ReturnType<typeof setTimeout>;
  }> = [];
  private exitCode: number | null | undefined;
  stderr = "";
  readonly child: ReturnType<typeof spawn>;

  constructor(child: ReturnType<typeof spawn>) {
    this.child = child;
    this.child.stdout?.on("data", (chunk) => {
      this.buffer += chunk.toString();
      this.flushLines();
    });
    this.child.stderr?.on("data", (chunk) => {
      this.stderr += chunk.toString();
      this.flushStderrWaiters();
    });
    this.exitPromise = new Promise((resolve) => {
      this.child.on("close", (code) => {
        this.exitCode = code;
        for (const { reject } of this.pending.values()) {
          reject(new Error(`MCP process exited before response\n${this.stderr}`));
        }
        this.pending.clear();
        for (const waiter of this.stderrWaiters) {
          clearTimeout(waiter.timeout);
          waiter.reject(new Error(`MCP process exited before stderr matched pattern\n${this.stderr}`));
        }
        this.stderrWaiters = [];
        resolve(code);
      });
    });
  }

  private flushLines() {
    while (true) {
      const newline = this.buffer.indexOf("\n");
      if (newline === -1) {
        return;
      }
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) {
        continue;
      }
      let parsed: JsonRpcResponse;
      try {
        parsed = JSON.parse(line) as JsonRpcResponse;
      } catch {
        this.unexpectedStdout.push(line);
        continue;
      }
      const id = parsed.id === undefined ? null : String(parsed.id);
      if (id === null) {
        continue;
      }
      const pending = this.pending.get(id);
      if (!pending) {
        this.unexpectedStdout.push(line);
        continue;
      }
      this.pending.delete(id);
      pending.resolve(parsed);
    }
  }

  assertCleanStdout() {
    assert.equal(
      this.unexpectedStdout.length,
      0,
      `unexpected non-JSON or orphan stdout from MCP process\n${this.unexpectedStdout.join("\n")}\n${this.stderr}`,
    );
  }

  private flushStderrWaiters() {
    const nextWaiters: typeof this.stderrWaiters = [];
    for (const waiter of this.stderrWaiters) {
      if (waiter.pattern.test(this.stderr)) {
        clearTimeout(waiter.timeout);
        waiter.resolve();
        continue;
      }
      nextWaiters.push(waiter);
    }
    this.stderrWaiters = nextWaiters;
  }

  debugState() {
    return {
      unexpectedStdout: [...this.unexpectedStdout],
      stderr: this.stderr,
      pendingIds: [...this.pending.keys()],
    };
  }

  waitForStderr(pattern: RegExp, timeoutMs = 15_000) {
    if (pattern.test(this.stderr)) {
      return Promise.resolve();
    }
    if (this.exitCode !== undefined) {
      return Promise.reject(new Error(
        `MCP process already exited before stderr matched pattern ${pattern}\n${JSON.stringify(this.debugState(), null, 2)}`,
      ));
    }
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.stderrWaiters = this.stderrWaiters.filter((entry) => entry.timeout !== timeout);
        reject(new Error(
          `timed out waiting for stderr pattern ${pattern}\n${JSON.stringify(this.debugState(), null, 2)}`,
        ));
      }, timeoutMs);
      this.stderrWaiters.push({ pattern, resolve, reject, timeout });
    });
  }

  request(method: string, params?: unknown, timeoutMs = 15_000): Promise<JsonRpcResponse> {
    const id = String(this.nextId++);
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(
          `timed out waiting for MCP response to ${method}\n${JSON.stringify(this.debugState(), null, 2)}`,
        ));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject });
      this.child.stdin?.write(`${payload}\n`, (error) => {
        if (error) {
          clearTimeout(timeout);
          this.pending.delete(id);
          reject(error);
        }
      });
      const pending = this.pending.get(id);
      if (pending) {
        this.pending.set(id, {
          resolve: (value) => {
            clearTimeout(timeout);
            pending.resolve(value);
          },
          reject: (error) => {
            clearTimeout(timeout);
            pending.reject(error);
          },
        });
      }
    });
  }

  notify(method: string, params?: unknown) {
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      method,
      ...(params !== undefined ? { params } : {}),
    });
    this.child.stdin?.write(`${payload}\n`);
  }

  endInput() {
    this.child.stdin?.end();
  }

  async waitForExit() {
    return this.exitPromise;
  }
}

function extractText(result: unknown): string {
  const call = result as McpToolCallResult;
  return call.content.map((entry) => entry.text).join("\n");
}

function assertMcpSuccess(response: JsonRpcResponse): McpToolCallResult {
  assert.ok(!response.error, `unexpected JSON-RPC error: ${JSON.stringify(response.error)}`);
  return response.result as McpToolCallResult;
}

async function clearSessionStandingLaw(args: {
  sessionsDir: string;
  sessionId: string;
}) {
  const paths = [
    path.join(args.sessionsDir, `${args.sessionId}.json`),
    path.join(args.sessionsDir, `${args.sessionId}.bak.json`),
  ];

  for (const statePath of paths) {
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    delete parsed.sessionUpl;
    await fs.writeFile(statePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  }
}

async function startMcp(args: {
  env: NodeJS.ProcessEnv;
  command: string;
  args: string[];
}) {
  const child = spawn(args.command, args.args, {
    cwd: repoRoot,
    env: args.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const client = new McpClient(child);
  await client.waitForStderr(/\[buccet-mcp\] ready\./, 60_000);

  const initialize = await client.request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "agent-buccet-mcp-contract",
      version: "0.1.0",
    },
  });
  assert.ok(!initialize.error, `initialize failed: ${JSON.stringify(initialize.error)}\n${client.stderr}`);
  const initResult = initialize.result as {
    protocolVersion: string;
    capabilities: { tools: object };
    serverInfo: { name: string; version: string };
  };
  assert.equal(initResult.protocolVersion, "2024-11-05");
  assert.equal(initResult.serverInfo.name, "agent-buccet");
  client.notify("notifications/initialized");

  return client;
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-mcp-"));
  const homePath = path.join(tempRoot, "home");
  const workspacePath = path.join(tempRoot, "workspace");
  const launcherDir = path.join(tempRoot, "bin");
  const uplLedgerPath = path.join(tempRoot, "upl-ledger.json");
  const sessionsDir = path.join(homePath, "data", "agent-boundary", "sessions");
  const ledgerPath = path.join(homePath, "data", "ledger", "agent-boundary-ledger.jsonl");
  const sessionId = `agent-buccet-mcp-contract-${Date.now()}`;
  const actorId = "user:mcp-contract";
  const allowedReadPath = path.join(workspacePath, "allowed.txt");
  const approvalWritePath = path.join(workspacePath, "approval.txt");
  const shutdownReadPath = path.join(workspacePath, "shutdown-proof.txt");

  await fs.mkdir(workspacePath, { recursive: true });
  await fs.writeFile(allowedReadPath, "allowed through standing law\n", "utf8");
  await fs.writeFile(shutdownReadPath, `${"shutdown proof line\n".repeat(16_384)}`, "utf8");
  await writeLauncher(launcherDir);

  const env = makeEnv({
    homePath,
    workspacePath,
    uplLedgerPath,
    launcherDir,
  });

  const init = await runCli(["init", "--session-id", sessionId, "--actor-id", actorId], env);
  assert.equal(init.code, 0, init.stderr);
  await writeStandingLawLedger({
    uplLedgerPath,
    allowedReadTargets: [allowedReadPath, shutdownReadPath],
  });

  const hostConfig = {
    mcpServers: {
      buccet: {
        command: "buccet",
        args: ["mcp"],
      },
    },
  };
  assert.equal(hostConfig.mcpServers.buccet.command, "buccet");
  assert.deepEqual(hostConfig.mcpServers.buccet.args, ["mcp"]);

  await clearSessionStandingLaw({
    sessionsDir,
    sessionId,
  });

  const client = await startMcp({
    env,
    command: hostConfig.mcpServers.buccet.command,
    args: hostConfig.mcpServers.buccet.args,
  });

  const list = await client.request("tools/list");
  assert.ok(!list.error, `tools/list failed: ${JSON.stringify(list.error)}\n${client.stderr}`);
  const tools = (list.result as { tools: Array<{ name: string }> }).tools;
  assert.equal(tools.length, 10);
  assert.ok(tools.some((tool) => tool.name === "read_file"));
  assert.ok(tools.some((tool) => tool.name === "run_command"));

  const allowedRead = assertMcpSuccess(await client.request("tools/call", {
    name: "read_file",
    arguments: { path: allowedReadPath },
  }));
  assert.equal(allowedRead.isError, undefined);
  assert.match(extractText(allowedRead), /allowed through standing law/);

  const outOfScope = assertMcpSuccess(await client.request("tools/call", {
    name: "read_file",
    arguments: { path: "/etc/passwd" },
  }));
  assert.equal(outOfScope.isError, true);
  assert.match(extractText(outOfScope), /Boundary denied:/);
  assert.match(extractText(outOfScope), /BOUNDARY\.DEFAULT_SCOPE\.01/);

  const unknownTool = assertMcpSuccess(await client.request("tools/call", {
    name: "drop_database",
    arguments: { target: "prod" },
  }));
  assert.equal(unknownTool.isError, true);
  assert.match(extractText(unknownTool), /BOUNDARY\.TOOL\.UNMAPPED/);

  const approvalRequired = assertMcpSuccess(await client.request("tools/call", {
    name: "write_file",
    arguments: {
      path: approvalWritePath,
      content: "needs approval\n",
    },
  }));
  assert.equal(approvalRequired.isError, true, JSON.stringify(approvalRequired, null, 2));
  assert.match(extractText(approvalRequired), /Boundary requires approval:/);
  assert.match(extractText(approvalRequired), /self-originated Buccet motion re-enters through novelty before consequence/);
  assert.match(extractText(approvalRequired), /META\.NOVELTY\.01/);
  assert.match(extractText(approvalRequired), /Approve via: buccet console/);

  client.endInput();
  const firstExit = await client.waitForExit();
  assert.equal(firstExit, 0, client.stderr);
  client.assertCleanStdout();

  const records = await readLedgerRecords(ledgerPath);
  const sessionRecords = records.filter((record) => record.META.session_id === sessionId);
  assert.ok(sessionRecords.length > 0, "expected MCP session ledger records");
  assert.ok(
    sessionRecords.some((record) => {
      const metadata = record.payload.metadata as Record<string, unknown> | undefined;
      return metadata?.provenance === "mcp_host";
    }),
    "expected ledger provenance mcp_host",
  );

  assert.deepEqual(
    eventTypesForTarget({
      records: sessionRecords,
      target: allowedReadPath,
      actionKind: "fs.read",
    }),
    ["ACTION_PROPOSED", "DECISION_RETURNED", "ACTION_EXECUTED"],
  );
  assert.deepEqual(
    eventTypesForTarget({
      records: sessionRecords,
      target: "/etc/passwd",
      actionKind: "fs.read",
    }),
    ["ACTION_PROPOSED", "BODYGUARD_GRANT_OFFERED", "DECISION_RETURNED", "ACTION_BLOCKED"],
  );
  assert.deepEqual(
    eventTypesForTarget({
      records: sessionRecords,
      target: approvalWritePath,
      actionKind: "fs.write",
    }),
    ["ACTION_PROPOSED", "DECISION_RETURNED", "APPROVAL_REQUESTED"],
  );

  const shutdownClient = await startMcp({
    env,
    command: hostConfig.mcpServers.buccet.command,
    args: hostConfig.mcpServers.buccet.args,
  });
  const inFlightRead = shutdownClient.request("tools/call", {
    name: "read_file",
    arguments: { path: shutdownReadPath },
  });
  shutdownClient.endInput();
  const shutdownResult = assertMcpSuccess(await inFlightRead);
  assert.equal(shutdownResult.isError, undefined);
  assert.match(extractText(shutdownResult), /shutdown proof line/);
  const shutdownExit = await shutdownClient.waitForExit();
  assert.equal(shutdownExit, 0, shutdownClient.stderr);
  shutdownClient.assertCleanStdout();

  console.log("Agent Buccet MCP contract");
  console.log(`session: ${sessionId}`);
  console.log(`tools exposed: ${tools.length}`);
  console.log("allowed read: standing law");
  console.log("out-of-scope deny: BOUNDARY.DEFAULT_SCOPE.01");
  console.log("unknown tool deny: BOUNDARY.TOOL.UNMAPPED");
  console.log("in-scope write: approval required without standing law");
  console.log("in-scope write: approval required");
  console.log("ledger provenance: mcp_host");
  console.log("shutdown: clean");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
