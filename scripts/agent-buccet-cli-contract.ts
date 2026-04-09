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

async function waitFor<T>(
  fn: () => Promise<T | null>,
  label: string,
  attempts = 100,
  delayMs = 100,
): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = await fn();
    if (value !== null) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-cli-"));
  const homePath = path.join(tempRoot, "home");
  const workspacePath = path.join(tempRoot, "workspace");
  const uplLedgerPath = path.join(tempRoot, "upl-ledger.json");
  const customPathName = "domain-workbench";
  const customDomain = "specialized_domain_ops";
  await fs.mkdir(workspacePath, { recursive: true });
  await fs.writeFile(path.join(workspacePath, "note.txt"), "hello\n", "utf8");
  await fs.writeFile(
    path.join(workspacePath, "domain-playbook.md"),
    "# Domain Playbook\n\nDomain rules, source material, operating steps, and output expectations.\n",
    "utf8",
  );

  const env = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_CALLER_CWD: workspacePath,
    AGENT_BUCCET_LAUNCHER_PATH: path.join(tempRoot, "bin", "buccet"),
    AGENT_BUCCET_UPL_LEDGER_PATH: uplLedgerPath,
    BUCCET_BROWSER_OPEN_CAPTURE_PATH: path.join(tempRoot, "browser-open.jsonl"),
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

  const uplSourcesResult = await runCli(["upl", "sources", "--json"], env);
  assert.equal(uplSourcesResult.code, 0, uplSourcesResult.stderr);
  const uplSources = JSON.parse(uplSourcesResult.stdout) as {
    root: string;
    lanes: Array<{ lane: "acceptance" | "denial"; dir: string; files: string[] }>;
    catalogs: Array<{ name: string; url: string }>;
    acceptancePipeline: {
      guidePath: string;
      templatePath: string;
      commands: {
        copyTemplate: string;
        sync: string;
      };
    };
  };
  assert.ok(uplSources.lanes.some((lane) => lane.lane === "acceptance"));
  assert.ok(uplSources.catalogs.some((catalog) => catalog.url.includes("skillsmp.com")));
  assert.ok(uplSources.catalogs.some((catalog) => catalog.url.includes("aitmpl.com/skills")));
  assert.ok(uplSources.catalogs.some((catalog) => catalog.url.includes("skillhub.club")));
  assert.ok(uplSources.catalogs.some((catalog) => catalog.url.includes("agentskills.io")));
  await fs.access(uplSources.acceptancePipeline.guidePath);
  await fs.access(uplSources.acceptancePipeline.templatePath);
  assert.match(uplSources.acceptancePipeline.commands.sync, /buccet upl sync --lane acceptance/);

  const uplOpenResult = await runCli(["upl", "sources", "--open", "skillsmp", "--json"], env);
  assert.equal(uplOpenResult.code, 0, uplOpenResult.stderr);
  const uplOpen = JSON.parse(uplOpenResult.stdout) as {
    opened: Array<{ id: string; url: string }>;
  };
  assert.equal(uplOpen.opened.length, 1);
  assert.equal(uplOpen.opened[0]?.id, "skillsmp");
  assert.match(uplOpen.opened[0]?.url ?? "", /^https:\/\/skillsmp\.com\/?$/);
  const openCaptureRaw = await fs.readFile(env.BUCCET_BROWSER_OPEN_CAPTURE_PATH!, "utf8");
  assert.match(openCaptureRaw, /"id":"skillsmp"/);
  assert.match(openCaptureRaw, /"url":"https:\/\/skillsmp\.com\/?"/);

  const pathListBeforeResult = await runCli(["path", "list", "--json"], env);
  assert.equal(pathListBeforeResult.code, 0, pathListBeforeResult.stderr);
  const pathListBefore = JSON.parse(pathListBeforeResult.stdout) as {
    paths: Array<{ pathName: string }>;
  };
  assert.ok(pathListBefore.paths.some((entry) => entry.pathName === "search"));

  const pathAddSourcesResult = await runCli([
    "path",
    "sources",
    "add",
    customPathName,
    "domain-playbook.md",
    "--domain",
    customDomain,
    "--json",
  ], env);
  assert.equal(pathAddSourcesResult.code, 0, pathAddSourcesResult.stderr);
  const pathAddSources = JSON.parse(pathAddSourcesResult.stdout) as {
    pathName: string;
    domain: string;
    totalSources: number;
    addedSources: Array<{ title: string; sourceUri?: string }>;
  };
  assert.equal(pathAddSources.pathName, customPathName);
  assert.equal(pathAddSources.domain, customDomain);
  assert.equal(pathAddSources.totalSources, 1);
  assert.equal(pathAddSources.addedSources[0]?.title, "Domain Playbook");

  const pathSourceListResult = await runCli(["path", "sources", "list", customPathName, "--json"], env);
  assert.equal(pathSourceListResult.code, 0, pathSourceListResult.stderr);
  const pathSourceList = JSON.parse(pathSourceListResult.stdout) as {
    pathName: string;
    sources: Array<{ title: string; sourceUri?: string }>;
  };
  assert.equal(pathSourceList.pathName, customPathName);
  assert.equal(pathSourceList.sources.length, 1);
  assert.match(pathSourceList.sources[0]?.sourceUri ?? "", /domain-playbook\.md$/);

  const pathShowResult = await runCli(["path", "show", customPathName, "--json"], env);
  assert.equal(pathShowResult.code, 0, pathShowResult.stderr);
  const pathShow = JSON.parse(pathShowResult.stdout) as {
    path: {
      pathName: string;
      domain: string;
      pathSources: Array<{ title: string }>;
    };
  };
  assert.equal(pathShow.path.pathName, customPathName);
  assert.equal(pathShow.path.domain, customDomain);
  assert.ok(pathShow.path.pathSources.some((source) => source.title === "Domain Playbook"));

  const pathListAfterResult = await runCli(["path", "list", "--json"], env);
  assert.equal(pathListAfterResult.code, 0, pathListAfterResult.stderr);
  const pathListAfter = JSON.parse(pathListAfterResult.stdout) as {
    paths: Array<{ pathName: string; sourceCount: number }>;
  };
  assert.ok(pathListAfter.paths.some((entry) => entry.pathName === customPathName && entry.sourceCount === 1));

  const pathRunResult = await runCli([
    "path",
    "run",
    customPathName,
    "--request",
    "do the work for this domain",
    "--steps",
    "1",
    "--json",
  ], env);
  assert.equal(pathRunResult.code, 0, pathRunResult.stderr);
  const pathRun = JSON.parse(pathRunResult.stdout) as {
    started: string;
    advancedSteps: number;
    formation: {
      formationId: string;
      pathName: string;
      status: string;
    };
    liveView: {
      pathName: string;
      currentStageId: string | null;
      pathSourceCount: number;
    };
  };
  assert.equal(pathRun.formation.pathName, customPathName);
  assert.equal(pathRun.advancedSteps, 1);
  assert.equal(pathRun.liveView.pathName, customPathName);
  assert.equal(pathRun.liveView.pathSourceCount, 1);

  const pathWatchResult = await runCli(["path", "watch", customPathName, "--json"], env);
  assert.equal(pathWatchResult.code, 0, pathWatchResult.stderr);
  const pathWatch = JSON.parse(pathWatchResult.stdout) as {
    formation: {
      formationId: string;
      pathName: string;
    };
    liveView: {
      pathName: string;
      pathSourceCount: number;
    };
  };
  assert.equal(pathWatch.formation.formationId, pathRun.formation.formationId);
  assert.equal(pathWatch.liveView.pathSourceCount, 1);

  const formationListResult = await runCli(["path", "formations", "list", "--json"], env);
  assert.equal(formationListResult.code, 0, formationListResult.stderr);
  const formationList = JSON.parse(formationListResult.stdout) as {
    formations: Array<{ formationId: string; pathName: string; sourceCount: number }>;
  };
  assert.ok(formationList.formations.some((entry) => entry.formationId === pathRun.formation.formationId && entry.pathName === customPathName && entry.sourceCount === 1));

  const pathRunAllResult = await runCli(["path", "run", customPathName, "--all", "--json"], env);
  assert.equal(pathRunAllResult.code, 0, pathRunAllResult.stderr);
  const pathRunAll = JSON.parse(pathRunAllResult.stdout) as {
    formation: {
      formationId: string;
      status: string;
    };
    terminalResult: string | null;
  };
  assert.equal(pathRunAll.formation.formationId, pathRun.formation.formationId);
  assert.equal(pathRunAll.formation.status, "COMPLETED");
  assert.match(pathRunAll.terminalResult ?? "", /Domain Workbench Path|domain-workbench/i);

  const pathCloseResult = await runCli(["path", "close", customPathName, "--json"], env);
  assert.equal(pathCloseResult.code, 0, pathCloseResult.stderr);
  const pathClose = JSON.parse(pathCloseResult.stdout) as {
    closedFormationId: string;
    pathName: string;
  };
  assert.equal(pathClose.closedFormationId, pathRun.formation.formationId);
  assert.equal(pathClose.pathName, customPathName);

  const formationListAfterCloseResult = await runCli(["path", "formations", "list", "--json"], env);
  assert.equal(formationListAfterCloseResult.code, 0, formationListAfterCloseResult.stderr);
  const formationListAfterClose = JSON.parse(formationListAfterCloseResult.stdout) as {
    formations: Array<{ formationId: string }>;
  };
  assert.ok(!formationListAfterClose.formations.some((entry) => entry.formationId === pathRun.formation.formationId));

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

  const strictDoctorResult = await runCli(["doctor", "--strict"], env);
  assert.equal(strictDoctorResult.code, 0, strictDoctorResult.stderr);
  assert.match(strictDoctorResult.stdout, /Strict posture: PASS/);

  const hookStatusResult = await runCli(["hook", "status", "--json"], env);
  assert.equal(hookStatusResult.code, 0, hookStatusResult.stderr);
  const hookStatus = JSON.parse(hookStatusResult.stdout) as {
    initialized: boolean;
    interceptedAttempts?: number;
  };
  assert.equal(hookStatus.initialized, true);

  const consoleResult = await runCli(["console"], env, "shield\nquit\n");
  assert.equal(consoleResult.code, 0, consoleResult.stderr);
  assert.match(consoleResult.stdout, /Unified Operator Console/);
  assert.match(consoleResult.stdout, /Protected Execution Lane/i);
  assert.match(consoleResult.stdout, /SHIELD|summary:/);

  const logsResult = await runCli(["logs", "--limit", "20", "--json"], env);
  assert.equal(logsResult.code, 0, logsResult.stderr);
  const logs = JSON.parse(logsResult.stdout) as Array<{ META: { event_type: string } }>;
  assert.ok(logs.length > 0, "expected CLI log surface to return ledger records");

  const ledgerResult = await runCli(["ledger", "--limit", "5"], env);
  assert.equal(ledgerResult.code, 0, ledgerResult.stderr);
  assert.match(ledgerResult.stdout, /Witness Ledger/);

  const hookStopResult = await runCli(["hook", "stop"], env);
  assert.equal(hookStopResult.code, 0, hookStopResult.stderr);

  await waitFor(async () => {
    const stoppedStatusResult = await runCli(["hook", "status", "--json"], env);
    if (stoppedStatusResult.code !== 0) {
      return null;
    }
    const stoppedStatus = JSON.parse(stoppedStatusResult.stdout) as {
      running: boolean;
    };
    return stoppedStatus.running === false ? true : null;
  }, "hook daemon stop");

  const strictDoctorFailResult = await runCli(["doctor", "--strict"], env);
  assert.equal(strictDoctorFailResult.code, 1, strictDoctorFailResult.stderr);
  assert.match(strictDoctorFailResult.stdout, /Strict posture: FAIL/);
  assert.match(strictDoctorFailResult.stdout, /Gravity bridge:/);

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
