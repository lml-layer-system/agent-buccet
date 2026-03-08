import type { Witness } from "../engine/types.ts";
import type { LmlCheckItem, LmlRepairItem, LmlStage } from "./types.ts";

const BANNED_INTERNAL = [/\bnull\b/i, /\bnsl\b/i, /\buic\b/i, /\buuis\b/i, /\bpredicate\s+px-/i, /\blaw-\d+/i];

export function buildLmlStages(witness: Witness): LmlStage[] {
  const blocked = witness.outcome === "NULL";
  const hasRepair = witness.repairPlan.length > 0;

  if (blocked) {
    return [
      { label: "LML Checking...", status: "pass", detail: "LML checks completed and violations were found." },
      { label: "LML Repairing...", status: hasRepair ? "needs_repair" : "blocked", detail: hasRepair ? "Repair actions prepared and applied constraints updated." : "Repair actions are required before re-check." },
      { label: "LML RE-Checking...", status: "blocked", detail: "Re-check still requires user-side document updates." },
      { label: "LML Confirmed...", status: "blocked", detail: "Not yet confirmed for human legal review." },
      { label: "LML READY FOR HUMAN REVIEW/APPROVAL", status: "blocked", detail: "Resolve repair items and rerun." },
    ];
  }

  return [
    { label: "LML Checking...", status: "pass", detail: "All required checks completed." },
    { label: "LML Repairing...", status: "pass", detail: "No repairing required for this run." },
    { label: "LML RE-Checking...", status: "pass", detail: "Re-check confirms all boundaries are satisfied." },
    { label: "LML Confirmed...", status: "pass", detail: "Constrained to current legal safety boundaries." },
    { label: "LML READY FOR HUMAN REVIEW/APPROVAL", status: "ready", detail: "Prepared for lawyer review and final legal judgment." },
  ];
}

export function buildWhyChecked(witness: Witness): LmlCheckItem[] {
  return [
    toCheck("Citation verification", witness, ["UNVERIFIED_CITATION", "CITATION_ADMISSIBILITY"], "Citation checks are within current demo safety boundaries."),
    toCheck("Jurisdiction check", witness, ["ADMISSIBILITY_PREREQS", "META_LAW_BOUNDARY"], "Jurisdiction and scope anchors are clear for this run."),
    toCheck("Style boundary", witness, ["NON_LEGAL_STYLE", "STYLE_CLASS_BOUND"], "Legal style is constrained appropriately."),
    toCheck("Admissibility baseline", witness, ["DOC_SIZE", "SINGLE_DOC_ONLY", "EXTERNAL_AUTHORITY_REQUEST", "ONTOLOGY_DRIFT", "LEDGER_LOOP_LOCK"], "Baseline admissibility checks are satisfied."),
  ];
}

export function buildWhyNeedsRepair(witness: Witness): LmlRepairItem[] {
  if (witness.outcome !== "NULL") {
    return [];
  }
  const plan = witness.explanation.lmlRepairingPlan.filter((r) => !/No repairing required/i.test(r.title));
  return plan.map((r) => ({
    title: sanitizePublicText(r.title),
    outcome: sanitizePublicText(r.instruction),
  }));
}

export function sanitizePublicText(text: string): string {
  let out = text;
  for (const pattern of BANNED_INTERNAL) {
    out = out.replace(pattern, "LML boundary");
  }
  return out;
}

function toCheck(
  name: LmlCheckItem["name"],
  witness: Witness,
  codes: string[],
  passReason: string,
): LmlCheckItem {
  const failGate = witness.gates.find((gate) => !gate.pass && codes.includes(gate.code));
  if (failGate) {
    return {
      name,
      status: "needs_repair",
      reason: sanitizePublicText(failGate.detail),
    };
  }
  return {
    name,
    status: "pass",
    reason: passReason,
  };
}

