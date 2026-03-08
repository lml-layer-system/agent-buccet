import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { runUIC, runUUIS, runSnapToEngine } from "@/lib/snap";
import { buildProfileAdapter } from "@/lib/snap/profiles";
import { assertPinnedProfile, getProfileOrThrow } from "@/lib/profiles";
import { enforceState } from "@/lib/engine/enforcement";
import { assertApiLawReadiness } from "@/lib/engine/readiness";
import { loadLawWeb } from "@/lib/engine/store";
import { createCitationProvider, extractCitationCandidates, runCitationWorkflow } from "@/lib/providers/citation";
import { appendSnapRunLedger } from "@/lib/ledger";
import type { RunMode } from "@/lib/profiles";

type SnapRunBody = {
  artifact?: string;
  profileId?: string;
  runMode?: RunMode;
  providedProofLawIds?: string[];
  jurisdictionHint?: string;
  profileVersion?: string;
  profileImmutableHash?: string;
};

export async function POST(request: Request) {
  try {
    await assertApiLawReadiness();

    const body = (await request.json()) as SnapRunBody;
    const artifact = (body.artifact ?? "").trim();
    const profileId = body.profileId ?? "DOC_LAW_PROFILE";
    const runMode = body.runMode ?? "demo";
    const runId = randomUUID();

    if (!artifact) {
      return NextResponse.json({ error: "Missing `artifact` in request body." }, { status: 400 });
    }

    const profile = getProfileOrThrow(profileId);
    assertPinnedProfile(
      profile,
      {
        version: body.profileVersion,
        immutableHash: body.profileImmutableHash,
      },
      runMode,
    );
    const adapter = buildProfileAdapter(profileId, runMode, `${profileId}:${runMode}`, body.providedProofLawIds ?? []);

    const per = runUIC(artifact, profile, runMode);
    const uuis = runUUIS(per, profile);
    const output = runSnapToEngine(per, uuis, adapter.integration);
    const hardGateFailures: string[] = [];

    // P0.1 citation provider workflow: product mode uses provider interfaces, not local simulated matching.
    if (runMode === "product") {
      const citationCandidates = extractCitationCandidates(artifact);
      if (citationCandidates.length > 0) {
        const lawWeb = await loadLawWeb();
        const provider = createCitationProvider(lawWeb);
        const workflow = await runCitationWorkflow(provider, citationCandidates, body.jurisdictionHint);

        if (workflow.fakeCount > 0) {
          hardGateFailures.push("GATE.CITE.ONE_FAKE_STOP");
          output.D_BLOCKERS.HOLES_BLOCKING_LML.push({
            id: "H-CITE-FAKE-001",
            needed_for: "citation_existence",
            missing: `${workflow.fakeCount} citation(s) failed existence verification`,
            consequence_if_missing: "Hard stop: one fake citation rule in product mode.",
            source_claim_ids: [],
          });
          output.C_DELTA.REJECTED.push({
            id: `R-${String(output.C_DELTA.REJECTED.length + 1).padStart(4, "0")}`,
            reason: "fake_citation_hard_stop",
            text: "One or more citations failed provider existence verification.",
            source_claim_ids: [],
          });
        }

        if (workflow.badCurrencyCount > 0) {
          hardGateFailures.push("GATE.CITE.CURRENCY");
          output.D_BLOCKERS.HOLES_BLOCKING_LML.push({
            id: "H-CITE-CURR-001",
            needed_for: "citation_currency",
            missing: `${workflow.badCurrencyCount} citation(s) are overruled/superseded`,
            consequence_if_missing: "Product legal output blocked until currency violations are resolved.",
            source_claim_ids: [],
          });
        }

        if (workflow.jurisdictionFailCount > 0) {
          hardGateFailures.push("GATE.CITE.JURISDICTION");
          output.D_BLOCKERS.HOLES_BLOCKING_LML.push({
            id: "H-CITE-JUR-001",
            needed_for: "citation_jurisdiction",
            missing: `${workflow.jurisdictionFailCount} citation(s) failed jurisdiction applicability`,
            consequence_if_missing: "Product legal output blocked until jurisdiction checks pass.",
            source_claim_ids: [],
          });
        }

        if (workflow.missingAdverseCount > 0) {
          hardGateFailures.push("GATE.CITE.ADVERSE");
          output.D_BLOCKERS.HOLES_BLOCKING_LML.push({
            id: "H-CITE-ADV-001",
            needed_for: "citation_adverse_authority",
            missing: `${workflow.missingAdverseCount} citation(s) missing adverse authority coverage`,
            consequence_if_missing: "Product legal output blocked until adverse authority review is complete.",
            source_claim_ids: [],
          });
        }
      }
    }

    const invariantsObserved = profile.lmlLaws
      .filter((law) => uuis.block1_identity_kernel.content.some((line) => line.includes(law.id) || line.toLowerCase().includes(law.text.toLowerCase().slice(0, 20))))
      .map((law) => law.id);

    const enforcement = enforceState(
      {
        mode: runMode,
        profileId,
        invariantsObserved,
        disturbancesObserved: per.delta,
        proofsProvided: body.providedProofLawIds ?? [],
        blockers: output.D_BLOCKERS.HOLES_BLOCKING_LML.map((hole) => hole.needed_for),
        hardGateFailures: unique(hardGateFailures),
      },
      profile,
      runMode,
      0,
    );

    output.C_DELTA.ENFORCEMENT_REPORT = {
      admissible: enforcement.admissible,
      null_output: enforcement.nullOutput,
      failed_enforcement_classes: enforcement.failedEnforcementClasses,
      triggered_repairs: enforcement.triggeredRepairs,
      generator: enforcement.generator,
    };

    if (runMode === "product" && (enforcement.nullOutput || output.D_BLOCKERS.HOLES_BLOCKING_LML.length > 0)) {
      output.C_DELTA.LML_ADD = [];
      output.C_DELTA.REJECTED.push({
        id: `R-${String(output.C_DELTA.REJECTED.length + 1).padStart(4, "0")}`,
        reason: "non_admissible_null_boundary",
        text: enforcement.reasonIfNull ?? "non-admissible state",
        source_claim_ids: [],
      });
    }

    const nullOutput = runMode === "product" ? enforcement.nullOutput || output.D_BLOCKERS.HOLES_BLOCKING_LML.length > 0 : enforcement.nullOutput;
    const admissible = !nullOutput;

    // P0.3 immutable audit ledger: append-only hash-linked record.
    // Product mode fails closed if ledger write fails.
    const ledgerRecord = await appendSnapRunLedger({
      runId,
      profileId: profile.profileId,
      profileVersion: profile.version,
      profileImmutableHash: profile.immutableHash,
      runMode,
      admissible,
      nullOutput,
      blockerCount: output.D_BLOCKERS.HOLES_BLOCKING_LML.length + output.D_BLOCKERS.HOLES_BLOCKING_NSL.length,
      rejectedCount: output.C_DELTA.REJECTED.length,
      artifactLength: artifact.length,
      createdAt: new Date().toISOString(),
    });

    // Contract: exact four-object SNAP output.
    return NextResponse.json({
      runId,
      ledger: {
        index: ledgerRecord.index,
        digest: ledgerRecord.digest,
        prevDigest: ledgerRecord.prevDigest,
      },
      A_PER: per,
      B_UUIS: uuis,
      C_DELTA: output.C_DELTA,
      D_BLOCKERS: output.D_BLOCKERS,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to run SNAP pipeline.",
      },
      { status: 500 },
    );
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
