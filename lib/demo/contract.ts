import type { Witness } from "../engine/types.ts";
import type { PublicDemoResponse } from "./types.ts";
import { buildLmlStages, buildWhyChecked, buildWhyNeedsRepair, sanitizePublicText } from "./presentation.ts";
import type { Gpt2CallResult } from "./gpt2.ts";

export function buildPublicDemoResponse(
  witness: Witness,
  gpt2: Gpt2CallResult,
  extras?: PublicDemoResponse["repairAudit"] extends undefined ? never : {
    runMode?: "check" | "fixed";
    repairAudit?: PublicDemoResponse["repairAudit"];
  },
): PublicDemoResponse {
  return {
    demoMode: true,
    runMode: extras?.runMode ?? "check",
    notice: "LML Demo - NOT a Legal Product. NOT FOR LEGAL USE.",
    lmlStages: buildLmlStages(witness),
    whyChecked: buildWhyChecked(witness),
    whyNeedsRepair: buildWhyNeedsRepair(witness),
    gpt2Response: {
      text: sanitizePublicText(gpt2.text),
      allowedSummary: sanitizePublicText(gpt2.allowedSummary),
    },
    repairAudit: extras?.repairAudit,
    humanReviewStatus: witness.outcome === "ADMISSIBLE"
      ? {
          status: "ready",
          summary: "Prepared for human legal review and approval.",
        }
      : {
          status: "needs_repair",
          summary: "Needs document updates before human legal review.",
        },
    modelReceipt: {
      provider: gpt2.receipt.provider,
      model: gpt2.receipt.model,
      runId: witness.runId,
      callId: gpt2.receipt.callId,
      inputDigest: gpt2.receipt.inputDigest,
      at: gpt2.receipt.at,
    },
  };
}
