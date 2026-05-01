import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import { restoreBoundaryRuntimeStore } from "./../../src/index.ts";

const repoRoot = process.cwd();
const scriptPath = await (async () => {
  const candidates = [
    path.join(repoRoot, "cli", "buccet.ts"),
    path.join(repoRoot, "bin", "buccet.ts"),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error("unable to locate buccet CLI script");
})();

function runCli(
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd = repoRoot,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath, ...args], {
      cwd,
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
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

function run(command: string, args: string[], cwd: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-entry-surface-"));
  const workspacePath = path.join(tempRoot, "workspace");
  const homePath = path.join(tempRoot, "home");
  const launcherPath = path.join(tempRoot, "bin", "buccet");
  const claudeCodeConfigPath = path.join(tempRoot, "claude-code", "settings.json");
  const claudeConfigPath = path.join(tempRoot, "claude", "claude_desktop_config.json");
  const cursorConfigPath = path.join(tempRoot, "cursor-global", "mcp.json");
  const vscodeConfigPath = path.join(tempRoot, "vscode-global", "mcp.json");
  await fs.mkdir(workspacePath, { recursive: true });

  const env = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_CALLER_CWD: workspacePath,
    AGENT_BUCCET_LAUNCHER_PATH: launcherPath,
    AGENT_BUCCET_UPL_LEDGER_PATH: path.join(tempRoot, "upl-ledger.json"),
    BUCCET_HOST_CLAUDE_CODE_CONFIG_PATH: claudeCodeConfigPath,
    BUCCET_HOST_CLAUDE_CONFIG_PATH: claudeConfigPath,
    BUCCET_HOST_CURSOR_CONFIG_PATH: cursorConfigPath,
    BUCCET_HOST_VSCODE_CONFIG_PATH: vscodeConfigPath,
  };

  const claudeCodeProject = path.join(workspacePath, "claude-code-project");
  await fs.mkdir(claudeCodeProject, { recursive: true });
  const claudeCodeAttach = await runCli(
    ["host", "attach", "claude-code", "--project", claudeCodeProject, "--write", "--json"],
    env,
  );
  assert.equal(claudeCodeAttach.code, 0, claudeCodeAttach.stderr);
  const claudeCodePlan = JSON.parse(claudeCodeAttach.stdout) as {
    configPath: string;
    config: { mcpServers: Record<string, { command: string; args: string[] }> };
  };
  assert.equal(claudeCodePlan.configPath, path.join(claudeCodeProject, ".claude", "settings.json"));
  assert.equal(claudeCodePlan.config.mcpServers.buccet.command, launcherPath);

  const claudeAttach = await runCli(["host", "attach", "claude-desktop", "--write", "--json"], env);
  assert.equal(claudeAttach.code, 0, claudeAttach.stderr);
  const claudePlan = JSON.parse(claudeAttach.stdout) as {
    host: string;
    wrote: boolean;
    configPath: string;
    config: { mcpServers: Record<string, { command: string; args: string[] }> };
  };
  assert.equal(claudePlan.host, "claude-desktop");
  assert.equal(claudePlan.wrote, true);
  assert.equal(claudePlan.configPath, claudeConfigPath);
  assert.equal(claudePlan.config.mcpServers.buccet.command, launcherPath);
  assert.deepEqual(claudePlan.config.mcpServers.buccet.args, ["mcp"]);

  const cursorProject = path.join(workspacePath, "cursor-project");
  await fs.mkdir(cursorProject, { recursive: true });
  const cursorAttach = await runCli(
    ["host", "attach", "cursor", "--project", cursorProject, "--write", "--json"],
    env,
  );
  assert.equal(cursorAttach.code, 0, cursorAttach.stderr);
  const cursorPlan = JSON.parse(cursorAttach.stdout) as {
    configPath: string;
    config: { mcpServers: Record<string, { command: string; args: string[] }> };
  };
  assert.equal(cursorPlan.configPath, path.join(cursorProject, ".cursor", "mcp.json"));
  assert.equal(cursorPlan.config.mcpServers.buccet.command, launcherPath);

  const vscodeProject = path.join(workspacePath, "vscode-project");
  await fs.mkdir(vscodeProject, { recursive: true });
  const vscodeAttach = await runCli(
    ["host", "attach", "vscode", "--project", vscodeProject, "--write", "--json"],
    env,
  );
  assert.equal(vscodeAttach.code, 0, vscodeAttach.stderr);
  const vscodePlan = JSON.parse(vscodeAttach.stdout) as {
    configPath: string;
    config: { mcpServers: Record<string, { command: string; args: string[] }> };
  };
  assert.equal(vscodePlan.configPath, path.join(vscodeProject, ".vscode", "mcp.json"));
  assert.equal(vscodePlan.config.mcpServers.buccet.command, launcherPath);

  const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8")) as {
    exports?: Record<string, string>;
  };
  assert.equal(packageJson.exports?.["./integrations"], "./src/integrations/index.ts");
  const integrationsIndex = await fs.readFile(
    path.join(repoRoot, "src", "integrations", "index.ts"),
    "utf8",
  );
  assert.match(integrationsIndex, /vercel-ai-sdk/, "expected vercel ai sdk integration export");

  const initResult = await runCli(["init", "--scope", "."], env, workspacePath);
  assert.equal(initResult.code, 0, initResult.stderr);

  const protectedSource = [
    "export function privateCoreX() {",
    "  const launchCode = \"X-LAW-NEVER-LEAK\";",
    "  return launchCode;",
    "}",
  ].join("\n");
  const protectedFile = path.join(workspacePath, "private-core.ts");
  await fs.writeFile(protectedFile, protectedSource, "utf8");

  const gitInit = await run("git", ["init"], workspacePath);
  assert.equal(gitInit.code, 0, gitInit.stderr);
  const gitRemote = await run("git", ["remote", "add", "origin", "https://example.com/private.git"], workspacePath);
  assert.equal(gitRemote.code, 0, gitRemote.stderr);
  const gitAdd = await run("git", ["add", "private-core.ts"], workspacePath);
  assert.equal(gitAdd.code, 0, gitAdd.stderr);

  const restored = await restoreBoundaryRuntimeStore({
    sessionId: "agent-buccet-default",
    sessionsDir: path.join(homePath, "data", "agent-boundary", "sessions"),
  });
  assert.ok(restored, "expected CLI init to create a restorable boundary session");
  await restored!.sealProtectedFile({
    filePath: protectedFile,
    kind: "source_code",
    sealedBy: "user:entry-surface-contract",
  });
  await restored!.persist();

  const gitPush = await runCli(["git", "push", "origin", "main"], env, workspacePath);
  assert.equal(gitPush.code, 1, "expected protected git push to hard deny");
  assert.match(gitPush.stderr, /Secrets Boundary/i);

  const ghLeak = await runCli(
    ["gh", "issue", "create", "--title", "leak", "--body", protectedSource],
    env,
    workspacePath,
  );
  assert.equal(ghLeak.code, 1, "expected protected GitHub post to hard deny");
  assert.match(ghLeak.stderr, /Secrets Boundary/i);

  const leakBodyFile = path.join(workspacePath, "leak-body.txt");
  await fs.writeFile(leakBodyFile, protectedSource, "utf8");

  const ghPrLeak = await runCli(
    ["gh", "pr", "create", "--title", "leak", "--body-file", leakBodyFile],
    env,
    workspacePath,
  );
  assert.equal(ghPrLeak.code, 1, "expected protected GitHub PR body to hard deny");
  assert.match(ghPrLeak.stderr, /Secrets Boundary/i);

  const ghCommentLeak = await runCli(
    ["gh", "issue", "comment", "123", "--body-file", leakBodyFile],
    env,
    workspacePath,
  );
  assert.equal(ghCommentLeak.code, 1, "expected protected GitHub comment to hard deny");
  assert.match(ghCommentLeak.stderr, /Secrets Boundary/i);

  const gitPatchLeak = await runCli(
    ["git", "format-patch", "-1", "HEAD"],
    env,
    workspacePath,
  );
  assert.equal(gitPatchLeak.code, 1, "expected protected patch export to hard deny");
  assert.match(gitPatchLeak.stderr, /Secrets Boundary/i);

  console.log("Agent Buccet entry surface contract");
  console.log(`claude-code attach: ${claudeCodePlan.configPath}`);
  console.log(`claude attach: ${claudePlan.configPath}`);
  console.log(`cursor attach: ${cursorPlan.configPath}`);
  console.log(`vscode attach: ${vscodePlan.configPath}`);
  console.log("integrations export: ok");
  console.log("git push protected source: denied");
  console.log("gh issue protected source: denied");
  console.log("gh pr body protected source: denied");
  console.log("gh comment protected source: denied");
  console.log("git patch export protected source: denied");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
