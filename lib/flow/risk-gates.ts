import type { RiskBand } from "@/lib/storage/product-types";

export function evaluateRiskGates(input: {
  riskBand: RiskBand;
  artifactRefs: string[];
}): { requiresHardGate: boolean; reason: string | null } {
  const highRisk = input.riskBand === "C1" || input.riskBand === "C2";
  if (!highRisk) {
    return { requiresHardGate: false, reason: null };
  }

  if (input.artifactRefs.length === 0) {
    return {
      requiresHardGate: true,
      reason: "C1/C2 items require proof artifact references before completion.",
    };
  }

  return { requiresHardGate: false, reason: null };
}
