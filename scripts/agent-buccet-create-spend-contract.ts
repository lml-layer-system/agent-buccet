/**
 * Create-Spend Contract
 *
 * Invariants:
 *   1. `buccet create spend <team> --domain <d> --confirm-spend` creates a team
 *      with buccetClass: "spend" and the UBIE value-boundary brain.
 *   2. Non-interactive shell without --confirm-spend exits non-zero.
 *   3. manifest.buccetClass === "spend" — field is stamped.
 *   4. manifest.brainSourceId === "spending-agent-ubie-value-boundary".
 *   5. manifest.notes contains "[SPEND BUCCET" stamp.
 *   6. Notes stamp names financial-agent use case.
 *   7. Workshop (default) team does NOT receive buccetClass or value-boundary brain.
 *   8. teamManifestBrainSourceId returns value-boundary id for SPEND class.
 *   9. teamManifestBrainSourceId returns default brain id for workshop class.
 *  10. CLI output for spend create includes "SPEND" and "value-boundary" markers.
 *  11. CLI output points the operator into the spend-law switchboard.
 */
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import {
  createTeam,
  loadTeam,
  teamManifestBrainSourceId,
  teamSlug,
} from "../lib/agent-buccet/team-workshop.ts";
import {
  SPENDING_AGENT_UBIE_VALUE_BOUNDARY_SOURCE,
  UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE,
} from "../lib/agent-buccet/path-memory.ts";

async function runBuccet(
  args: string[],
  env: Record<string, string>,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [path.resolve(import.meta.dirname, "buccet.ts"), ...args],
      {
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("close", (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ab-create-spend-"));
  const env = { AGENT_BUCCET_HOME: tempRoot };

  try {
    // ── 1. Library: createTeam with buccetClass:"spend" stamps manifest correctly ─

    const slug = teamSlug("spend-contract-team");
    const manifest = await createTeam({
      homePath: tempRoot,
      name: "spend-contract-team",
      domain: "finance",
      summary: "Spend contract test team",
      createdBy: "contract",
      buccetClass: "spend",
    });

    assert.equal(manifest.buccetClass, "spend", "buccetClass must be 'spend'");
    assert.equal(
      manifest.brainSourceId,
      SPENDING_AGENT_UBIE_VALUE_BOUNDARY_SOURCE.id,
      "brainSourceId must be the value-boundary brain id",
    );
    assert.ok(
      manifest.notes?.includes("[SPEND BUCCET"),
      "notes must contain [SPEND BUCCET stamp",
    );
    assert.ok(
      manifest.notes?.includes("financial"),
      "notes stamp must mention financial agents",
    );
    assert.ok(
      manifest.notes?.includes("value-boundary"),
      "notes stamp must mention value-boundary",
    );

    // ── 2. Loaded manifest matches what was written ───────────────────────────────

    const loaded = await loadTeam(tempRoot, slug);
    assert.ok(loaded, "manifest must be loadable from disk");
    assert.equal(loaded!.buccetClass, "spend", "loaded manifest buccetClass must be 'spend'");
    assert.equal(
      loaded!.brainSourceId,
      SPENDING_AGENT_UBIE_VALUE_BOUNDARY_SOURCE.id,
      "loaded manifest brainSourceId must be value-boundary",
    );

    // ── 3. teamManifestBrainSourceId returns value-boundary for SPEND class ───────

    const spendBrainId = teamManifestBrainSourceId(manifest);
    assert.equal(
      spendBrainId,
      SPENDING_AGENT_UBIE_VALUE_BOUNDARY_SOURCE.id,
      "teamManifestBrainSourceId must return value-boundary id for SPEND team",
    );

    // ── 4. Workshop team gets default brain, no buccetClass ──────────────────────

    const workshopSlug = teamSlug("workshop-contract-team");
    const workshopManifest = await createTeam({
      homePath: tempRoot,
      name: "workshop-contract-team",
      domain: "research",
      summary: "Workshop test team",
      createdBy: "contract",
    });
    assert.equal(
      workshopManifest.buccetClass,
      undefined,
      "workshop team must not have buccetClass",
    );
    assert.equal(
      workshopManifest.brainSourceId,
      UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE.id,
      "workshop team must use default comprehension brain",
    );
    const workshopBrainId = teamManifestBrainSourceId(workshopManifest);
    assert.equal(
      workshopBrainId,
      UNIVERSAL_AGENT_COMPREHENSION_PROCESS_SOURCE.id,
      "teamManifestBrainSourceId must return default brain for workshop team",
    );
    assert.ok(
      !workshopManifest.notes?.includes("[SPEND BUCCET"),
      "workshop team must not have SPEND BUCCET stamp in notes",
    );

    // ── 5. CLI --confirm-spend creates team and emits spend markers ───────────────

    const cliResult = await runBuccet(
      ["create", "spend", "cli-spend-team", "--domain", "shopping", "--confirm-spend"],
      env,
    );
    assert.equal(
      cliResult.code,
      0,
      `CLI create spend must exit 0; stderr: ${cliResult.stderr}`,
    );
    assert.ok(
      cliResult.stdout.includes("SPEND BUCCET created") || cliResult.stdout.includes("SPEND"),
      "CLI output must include SPEND marker",
    );
    assert.ok(
      cliResult.stdout.includes("value-boundary") || cliResult.stdout.includes("spending-agent-ubie"),
      "CLI output must reference value-boundary brain",
    );
    assert.ok(
      cliResult.stdout.includes("buccet upl spend list"),
      "CLI output must point to spend pack listing",
    );
    assert.ok(
      cliResult.stdout.includes("buccet upl spend setup subscription.provider"),
      "CLI output must point to guided spend corridor setup",
    );

    const cliSlug = teamSlug("cli-spend-team");
    const cliManifest = await loadTeam(tempRoot, cliSlug);
    assert.ok(cliManifest, "CLI-created spend team must be loadable");
    assert.equal(cliManifest!.buccetClass, "spend", "CLI-created manifest must have buccetClass spend");
    assert.equal(
      cliManifest!.brainSourceId,
      SPENDING_AGENT_UBIE_VALUE_BOUNDARY_SOURCE.id,
      "CLI-created manifest must have value-boundary brain",
    );

    // ── 6. CLI without --confirm-spend on non-TTY exits non-zero ─────────────────

    const noConfirmResult = await runBuccet(
      ["create", "spend", "no-confirm-team", "--domain", "finance"],
      env,
    );
    assert.notEqual(
      noConfirmResult.code,
      0,
      "CLI must exit non-zero without --confirm-spend on non-TTY",
    );
    const combinedOutput = noConfirmResult.stdout + noConfirmResult.stderr;
    assert.ok(
      combinedOutput.includes("confirm-spend") || combinedOutput.includes("non-interactive"),
      "CLI must mention --confirm-spend or non-interactive in error output",
    );

    // ── 7. UBIE prose contains 'exchange' and 'subscribe' vocabulary ─────────────

    const brainContent = SPENDING_AGENT_UBIE_VALUE_BOUNDARY_SOURCE.content;
    assert.ok(
      brainContent.includes("exchange"),
      "UBIE value-boundary prose must contain 'exchange' vocabulary",
    );
    assert.ok(
      brainContent.includes("subscribe"),
      "UBIE value-boundary prose must contain 'subscribe' vocabulary",
    );
    assert.ok(
      brainContent.includes("principal"),
      "UBIE prose must contain 'principal'",
    );
    assert.ok(
      brainContent.includes("purpose"),
      "UBIE prose must contain 'purpose'",
    );
    assert.ok(
      brainContent.includes("bucket"),
      "UBIE prose must contain 'bucket'",
    );
    assert.ok(
      brainContent.includes("terms"),
      "UBIE prose must contain 'terms'",
    );
    assert.ok(
      brainContent.includes("recurring") || brainContent.includes("recurrence"),
      "UBIE prose must contain recurring/recurrence",
    );
    assert.ok(
      brainContent.includes("risk"),
      "UBIE prose must contain 'risk'",
    );
    assert.ok(
      brainContent.includes("accountability"),
      "UBIE prose must contain 'accountability'",
    );
    assert.ok(
      brainContent.includes("instruction provenance"),
      "UBIE prose must contain 'instruction provenance'",
    );

    console.log("Create-Spend Contract");
    console.log("buccetClass stamp:               buccetClass='spend' on manifest");
    console.log("brainSourceId:                   spending-agent-ubie-value-boundary");
    console.log("notes stamp:                     [SPEND BUCCET] + financial + value-boundary");
    console.log("teamManifestBrainSourceId:       value-boundary for SPEND; default for workshop");
    console.log("CLI --confirm-spend:             exits 0, SPEND + value-boundary in output");
    console.log("CLI spend next-steps:            points to upl spend list + upl spend setup");
    console.log("CLI no --confirm-spend (non-TTY): exits non-zero, mentions confirm-spend");
    console.log("UBIE prose vocabulary:           all 10 terms present incl. exchange + subscribe");
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
