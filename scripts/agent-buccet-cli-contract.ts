import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import type { BoundaryUplEntry } from "../lib/agent-buccet/index.ts";

const repoRoot = process.cwd();
const scriptPath = await (async () => {
  const candidates = [
    path.join(repoRoot, "scripts", "buccet.ts"),
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

function runCli(args: string[], env: NodeJS.ProcessEnv, stdinInput?: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
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
      child.stdin!.write(stdinInput);
      child.stdin!.end();
    }
  });
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-cli-"));
  const homePath = path.join(tempRoot, "home");
  const workspacePath = path.join(tempRoot, "workspace");
  const uplLedgerPath = path.join(tempRoot, "upl-ledger.json");
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.writeFile(path.join(workspacePath, "note.txt"), "hello\n", "utf8");

  const env = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_CALLER_CWD: workspacePath,
    AGENT_BUCCET_LAUNCHER_PATH: path.join(tempRoot, "bin", "buccet"),
    AGENT_BUCCET_UPL_LEDGER_PATH: uplLedgerPath,
  };

  const initResult = await runCli(["init"], env);
  assert.equal(initResult.code, 0, initResult.stderr);
  assert.match(initResult.stdout, /Agent Buccet/);

  const statusResult = await runCli(["status", "--json"], env);
  assert.equal(statusResult.code, 0, statusResult.stderr);
  const status = JSON.parse(statusResult.stdout) as {
    initialized: boolean;
    sessionStatus: string;
    scopes: string[];
  };
  assert.equal(status.initialized, true);
  assert.equal(status.sessionStatus, "active");
  assert.ok(status.scopes.includes(workspacePath));

  const scopeAddResult = await runCli(["scope", "add", "."], env);
  assert.equal(scopeAddResult.code, 0, scopeAddResult.stderr);

  const scopeListResult = await runCli(["scope", "list", "--json"], env);
  assert.equal(scopeListResult.code, 0, scopeListResult.stderr);
  const scopes = JSON.parse(scopeListResult.stdout) as Array<{ rootPath: string }>;
  assert.ok(scopes.some((scope) => scope.rootPath === workspacePath));

  const uplListResult = await runCli(["upl", "list", "--json"], env);
  assert.equal(uplListResult.code, 0, uplListResult.stderr);
  const uplList = JSON.parse(uplListResult.stdout) as {
    activeApproved: BoundaryUplEntry[];
    activeDenied: BoundaryUplEntry[];
  };
  assert.ok(uplList.activeApproved.length > 0, "expected base acceptance to seed active approved UPL");
  assert.ok(uplList.activeDenied.length > 0, "expected base denial pack to seed active denied UPL");

  const mutableEntry = uplList.activeDenied[0];
  assert.ok(mutableEntry?.id, "expected an active denied UPL entry to mutate");

  const uplShowResult = await runCli(["upl", "show", mutableEntry.id, "--json"], env);
  assert.equal(uplShowResult.code, 0, uplShowResult.stderr);
  const shown = JSON.parse(uplShowResult.stdout) as {
    entry: BoundaryUplEntry;
    view: {
      whatItIs: string;
      connectsTo: string;
      actionKinds: string[];
      bounds: string[];
    };
    liveState: string;
  };
  assert.equal(shown.entry.id, mutableEntry.id);
  assert.ok(shown.view.whatItIs.length > 0);
  assert.ok(Array.isArray(shown.view.actionKinds));
  assert.equal(typeof shown.liveState, "string");

  const searchResult = await runCli(["upl", "search", mutableEntry.id, "--json"], env);
  assert.equal(searchResult.code, 0, searchResult.stderr);
  const search = JSON.parse(searchResult.stdout) as {
    matches: Array<{ entry: BoundaryUplEntry; liveState: string }>;
  };
  assert.ok(search.matches.some((match) => match.entry.id === mutableEntry.id));

  const diffResult = await runCli(["upl", "diff", "--search", mutableEntry.id, "--json"], env);
  assert.equal(diffResult.code, 0, diffResult.stderr);
  const diff = JSON.parse(diffResult.stdout) as {
    rows: Array<{ entry: BoundaryUplEntry; liveState: string }>;
  };
  assert.equal(diff.rows.length, 1);
  assert.equal(diff.rows[0]?.entry.id, mutableEntry.id);
  assert.equal(diff.rows[0]?.liveState, "deny_wall");

  const muteResult = await runCli(["upl", "mute", "--search", mutableEntry.id, "--json"], env);
  assert.equal(muteResult.code, 0, muteResult.stderr);
  const muted = JSON.parse(muteResult.stdout) as {
    changed: BoundaryUplEntry[];
    matchedIds: string[];
  };
  assert.equal(muted.changed.length, 1);
  assert.equal(muted.matchedIds.length, 1);
  assert.equal(muted.changed[0]?.status, "MUTED");

  const listAllAfterMute = await runCli(["upl", "list", "--all", "--json"], env);
  assert.equal(listAllAfterMute.code, 0, listAllAfterMute.stderr);
  const listedAfterMute = JSON.parse(listAllAfterMute.stdout) as {
    entries: BoundaryUplEntry[];
  };
  assert.equal(listedAfterMute.entries.find((entry) => entry.id === mutableEntry.id)?.status, "MUTED");

  const unmuteResult = await runCli(["upl", "unmute", "--search", mutableEntry.id, "--status", "muted", "--json"], env);
  assert.equal(unmuteResult.code, 0, unmuteResult.stderr);
  const unmuted = JSON.parse(unmuteResult.stdout) as {
    changed: BoundaryUplEntry[];
  };
  assert.equal(unmuted.changed.length, 1);
  assert.equal(unmuted.changed[0]?.status, "ACTIVE");

  const removeResult = await runCli(["upl", "remove", mutableEntry.id, "--json"], env);
  assert.equal(removeResult.code, 0, removeResult.stderr);
  const removed = JSON.parse(removeResult.stdout) as {
    changed: BoundaryUplEntry[];
  };
  assert.equal(removed.changed.length, 1);
  assert.equal(removed.changed[0]?.status, "DELETED");

  const listAllAfterRemove = await runCli(["upl", "list", "--all", "--json"], env);
  assert.equal(listAllAfterRemove.code, 0, listAllAfterRemove.stderr);
  const listedAfterRemove = JSON.parse(listAllAfterRemove.stdout) as {
    entries: BoundaryUplEntry[];
  };
  assert.equal(listedAfterRemove.entries.find((entry) => entry.id === mutableEntry.id)?.status, "DELETED");

  const doctorResult = await runCli(["doctor"], env);
  assert.equal(doctorResult.code, 0, doctorResult.stderr);
  assert.match(doctorResult.stdout, /Doctor/);

  const hookStatusResult = await runCli(["hook", "status", "--json"], env);
  assert.equal(hookStatusResult.code, 0, hookStatusResult.stderr);
  const hookStatus = JSON.parse(hookStatusResult.stdout) as {
    initialized: boolean;
    interceptedAttempts?: number;
  };
  assert.equal(hookStatus.initialized, true);

  const consoleResult = await runCli(["console"], env, "quit\n");
  assert.equal(consoleResult.code, 0, consoleResult.stderr);
  assert.match(consoleResult.stdout, /Command Center/);

  const logsResult = await runCli(["logs", "--limit", "20", "--json"], env);
  assert.equal(logsResult.code, 0, logsResult.stderr);
  const logs = JSON.parse(logsResult.stdout) as Array<{ META: { event_type: string } }>;
  assert.ok(logs.length > 0, "expected CLI log surface to return ledger records");

  const ledgerResult = await runCli(["ledger", "--limit", "5"], env);
  assert.equal(ledgerResult.code, 0, ledgerResult.stderr);
  assert.match(ledgerResult.stdout, /Witness Ledger/);

  const uninstallResult = await runCli(["uninstall"], env);
  assert.equal(uninstallResult.code, 0, uninstallResult.stderr);
  const homeExists = await fs.access(homePath).then(() => true).catch(() => false);
  assert.equal(homeExists, false);

  console.log(`cli status scopes: ${status.scopes.length}`);
  console.log(`cli log tail: ${logs.length}`);
  console.log(`cli doctor: ok`);
  console.log(`cli hook status: ok`);
  console.log(`cli console: ok`);
  console.log(`cli ledger: ok`);
  console.log(`cli upl controls: ok`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
