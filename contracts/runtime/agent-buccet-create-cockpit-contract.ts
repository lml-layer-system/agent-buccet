import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  addTeamAgent,
  appendTeamPathSourceMemoryEntry,
  createTeam,
  prepareTeamRuntime,
  saveTeam,
  teamSlug,
} from "./../../src/teams/team-workshop.ts";

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
    } catch {}
  }
  throw new Error("unable to locate buccet CLI script");
})();

function runCli(
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("node", [scriptPath, ...args], {
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
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

async function appendSessionRecord(homePath: string, slug: string, record: unknown): Promise<void> {
  const targetPath = path.join(homePath, "teams", slug, "session.jsonl");
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.appendFile(targetPath, `${JSON.stringify(record)}\n`, "utf8");
}

async function main(): Promise<void> {
  console.log("--- Agent Buccet Create Cockpit Contract ---");
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-buccet-create-cockpit-"));
  const homePath = path.join(tempRoot, "home");
  const workspacePath = path.join(tempRoot, "workspace");
  await fs.mkdir(workspacePath, { recursive: true });
  const env = {
    ...process.env,
    AGENT_BUCCET_HOME: homePath,
    AGENT_BUCCET_CALLER_CWD: workspacePath,
    AGENT_BUCCET_LAUNCHER_PATH: path.join(tempRoot, "bin", "buccet"),
    AGENT_BUCCET_UPL_LEDGER_PATH: path.join(tempRoot, "upl-ledger.json"),
  };

  try {
    await createTeam({ homePath, name: "active-team", domain: "runtime", summary: "active team" });
    await createTeam({
      homePath,
      name: "waiting-team",
      domain: "runtime",
      summary: "waiting team",
    });
    await createTeam({
      homePath,
      name: "blocked-team",
      domain: "runtime",
      summary: "blocked team",
    });

    const activeSlug = teamSlug("active-team");
    const waitingSlug = teamSlug("waiting-team");
    const blockedSlug = teamSlug("blocked-team");

    for (const slug of [activeSlug, waitingSlug, blockedSlug]) {
      await addTeamAgent({
        homePath,
        slug,
        agentId: `${slug}-peer`,
        title: "Peer",
        specialty: `${slug} specialty`,
        ownsStep: "transform",
      });
    }

    const activePrepared = await prepareTeamRuntime({
      homePath,
      slug: activeSlug,
      markReady: true,
    });
    activePrepared.manifest.status = "running";
    await saveTeam(homePath, activePrepared.manifest);
    await appendSessionRecord(homePath, activeSlug, {
      type: "team_status",
      at: "2026-04-28T12:00:00.000Z",
      team: activeSlug,
      text: "brain pass started",
      meta: {
        status: "running",
      },
    });
    await appendTeamPathSourceMemoryEntry({
      homePath,
      slug: activeSlug,
      kind: "peer_result",
      title: "architect:transform",
      text: "Active Buccet is still working through the refactor wall.",
    });

    await appendSessionRecord(homePath, waitingSlug, {
      type: "team_status",
      at: "2026-04-28T12:01:00.000Z",
      team: waitingSlug,
      text: "brain pass unavailable; queued fallback",
      meta: {
        status: "queued",
        reason: "Pi engine not installed",
      },
    });
    await appendTeamPathSourceMemoryEntry({
      homePath,
      slug: waitingSlug,
      kind: "team_status",
      title: "team_status:waiting-team",
      text: "Pi engine not installed",
    });

    await appendSessionRecord(homePath, blockedSlug, {
      type: "team_status",
      at: "2026-04-28T12:02:00.000Z",
      team: blockedSlug,
      text: "brain pass blocked",
      meta: {
        status: "blocked",
        reason: "coherence gate — disposition: BlockFinalization",
      },
    });
    await appendTeamPathSourceMemoryEntry({
      homePath,
      slug: blockedSlug,
      kind: "coherence_adjudication",
      title: "coherence_adjudication:blocked-team",
      text: "coherence gate — disposition: BlockFinalization",
    });

    const cockpitResult = await runCli(["create", "cockpit", "--json"], env);
    assert.equal(cockpitResult.code, 0, cockpitResult.stderr);
    const cockpit = JSON.parse(cockpitResult.stdout) as {
      totalTeams: number;
      activeTeams: number;
      waitingTeams: number;
      blockedTeams: number;
      teamsNeedingAttention: number;
      teams: Array<{
        slug: string;
        runState: string;
        waitingFor: string | null;
        latestProofTitle: string | null;
      }>;
    };
    assert.equal(cockpit.totalTeams, 3);
    assert.equal(cockpit.activeTeams, 1);
    assert.equal(cockpit.waitingTeams, 1);
    assert.equal(cockpit.blockedTeams, 1);
    assert.equal(cockpit.teamsNeedingAttention, 2);
    assert.equal(cockpit.teams.find((team) => team.slug === activeSlug)?.runState, "active");
    assert.equal(cockpit.teams.find((team) => team.slug === waitingSlug)?.runState, "waiting");
    assert.ok(
      cockpit.teams
        .find((team) => team.slug === waitingSlug)
        ?.waitingFor?.includes("Pi engine not installed"),
      "waiting Buccet must surface the persisted wait reason",
    );
    assert.equal(cockpit.teams.find((team) => team.slug === blockedSlug)?.runState, "blocked");
    assert.ok(
      cockpit.teams
        .find((team) => team.slug === activeSlug)
        ?.latestProofTitle?.includes("architect:transform"),
      "cockpit must surface the latest proof-of-work title",
    );
    console.log(
      "SUCCESS: create cockpit surfaces multi-Buccet active/waiting/blocked state with proof-of-work.",
    );

    const statusResult = await runCli(["status", "--json"], env);
    assert.equal(statusResult.code, 0, statusResult.stderr);
    const statusPayload = JSON.parse(statusResult.stdout) as {
      workshop: {
        cockpit: {
          totalTeams: number;
          activeTeams: number;
          waitingTeams: number;
          blockedTeams: number;
          teamsNeedingAttention: number;
        };
      };
    };
    assert.equal(statusPayload.workshop.cockpit.totalTeams, 3);
    assert.equal(statusPayload.workshop.cockpit.activeTeams, 1);
    assert.equal(statusPayload.workshop.cockpit.waitingTeams, 1);
    assert.equal(statusPayload.workshop.cockpit.blockedTeams, 1);
    assert.equal(statusPayload.workshop.cockpit.teamsNeedingAttention, 2);
    console.log("SUCCESS: status --json carries the same creation cockpit snapshot.");

    console.log("\n--- Create Cockpit Contract Verified ---");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
