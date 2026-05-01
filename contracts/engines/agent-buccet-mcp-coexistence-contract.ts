import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, "scripts", "buccet.ts");

type CliResult = {
  stdout: string;
  stderr: string;
  code: number | null;
};

function runCli(args: string[], env: NodeJS.ProcessEnv, stdinInput?: string): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath, ...args], {
      cwd: repoRoot,
      env,
      stdio: [stdinInput !== undefined ? "pipe" : "ignore", "pipe", "pipe"],
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

    if (stdinInput !== undefined) {
      child.stdin?.write(stdinInput);
      child.stdin?.end();
    }
  });
}

async function runNodeScript(scriptName: string): Promise<CliResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn("node", [`scripts/${scriptName}`], {
      cwd: repoRoot,
      env: process.env,
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
      resolve({ code, stdout, stderr });
    });
  });
}

async function proveFreshHomeMcpAutoInit() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-mcp-coexistence-"));
  const homePath = path.join(tempRoot, "home");
  const env = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_CALLER_CWD: tempRoot,
    AGENT_BUCCET_LAUNCHER_PATH: path.join(tempRoot, "bin", "buccet"),
    AGENT_BUCCET_UPL_LEDGER_PATH: path.join(tempRoot, "upl-ledger.json"),
  };

  try {
    const before = await runCli(["mcp", "status"], env);
    assert.equal(before.code, 0, before.stderr);
    assert.match(before.stdout, /not initialized/i);

    const autoInit = await new Promise<{ stderr: string; code: number | null }>((resolve, reject) => {
      const child = spawn("node", [scriptPath, "mcp"], {
        cwd: repoRoot,
        env,
        stdio: ["pipe", "ignore", "pipe"],
      });
      let stderr = "";
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
        if (stderr.includes("[buccet-mcp] ensuring hook daemon")) {
          child.kill("SIGTERM");
        }
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ stderr, code }));
      setTimeout(() => child.kill("SIGTERM"), 30_000).unref();
    });

    assert.match(autoInit.stderr, /auto-initializing Agent Buccet/);
    assert.match(autoInit.stderr, /auto-initialization complete/);
    assert.match(autoInit.stderr, /restoring session/);

    const after = await runCli(["mcp", "status"], env);
    assert.equal(after.code, 0, after.stderr);
    assert.match(after.stdout, /MCP status/);
    assert.doesNotMatch(after.stdout, /not initialized/i);

    const overall = await runCli(["status", "--json"], env);
    assert.equal(overall.code, 0, overall.stderr);
    const payload = JSON.parse(overall.stdout) as { initialized: boolean; scopes: string[] };
    assert.equal(payload.initialized, true);
    assert.ok(
      payload.scopes.includes(os.homedir()),
      "expected buccet mcp to seed os.homedir() when no default scopes exist",
    );
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function proveAiFailurePeriodicTableLane() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-mcp-coexistence-base-pack-"));
  const previousCwd = process.cwd();
  const previousLedgerPath = process.env.AGENT_BUCCET_UPL_LEDGER_PATH;
  const ledgerPath = path.join(tempRoot, "user-path-ledger.json");
  process.env.AGENT_BUCCET_UPL_LEDGER_PATH = ledgerPath;
  process.chdir(tempRoot);

  try {
    await fs.cp(
      path.join(repoRoot, "data", "agent-buccet-law-foundation"),
      path.join(tempRoot, "data", "agent-buccet-law-foundation"),
      { recursive: true },
    );
    const boundary = await import("../lib/agent-buccet/index.ts");
    const sessionId = `agent-buccet-mcp-coexistence-${Date.now()}`;
    const actorId = "user:mcp-coexistence-contract";
    const workspace = path.join(tempRoot, "workspace");
    await fs.mkdir(workspace, { recursive: true });

    const store = await boundary.createPersistentBoundaryRuntimeStore({
      sessionId,
      actorId,
    });
    const { config } = await boundary.openBoundaryPath({
      config: store.getConfig(),
      rootPath: workspace,
      grantedActions: ["fs.read", "fs.write", "fs.append", "fs.delete", "fs.mkdir", "fs.move"],
      issuedBy: actorId,
    });
    store.replaceConfig(config);

    const upl = await boundary.loadUserPathLedger();
    const baseAcceptanceEntries = upl.userApprovedLawPaths.filter((entry) =>
      entry.status === "ACTIVE" &&
      entry.scope === "SESSION" &&
      entry.sessionId === sessionId &&
      entry.notes?.includes("Buccet base acceptance pack")
    );

    assert.ok(
      baseAcceptanceEntries.some((entry) => entry.requestBasis?.target === "ai-failure-periodic-table"),
      "expected ai-failure-periodic-table curated capability entry in the live base acceptance pack",
    );
  } finally {
    if (previousLedgerPath === undefined) {
      delete process.env.AGENT_BUCCET_UPL_LEDGER_PATH;
    } else {
      process.env.AGENT_BUCCET_UPL_LEDGER_PATH = previousLedgerPath;
    }
    process.chdir(previousCwd);
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  await proveFreshHomeMcpAutoInit();

  const mcp = await runNodeScript("agent-buccet-mcp-contract.ts");
  assert.equal(mcp.code, 0, mcp.stderr || mcp.stdout);
  assert.match(mcp.stdout, /ledger provenance: mcp_host/);
  assert.match(mcp.stdout, /unknown tool deny: BOUNDARY\.TOOL\.UNMAPPED/);
  assert.match(mcp.stdout, /out-of-scope deny: BOUNDARY\.DEFAULT_SCOPE\.01/);

  await proveAiFailurePeriodicTableLane();

  console.log("Agent Buccet MCP coexistence contract");
  console.log("- fresh-home buccet mcp auto-init and fallback scope: ok");
  console.log("- ai-failure-periodic-table curated acceptance lane is present in the live base pack: ok");
  console.log("- same Buccet denial side still governs MCP host-path execution: ok");
}

await main();
