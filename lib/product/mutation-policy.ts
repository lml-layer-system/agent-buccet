import { resolveCaseArtifactRefs } from "../storage/product-store.ts";

export type TimelineMutationInput = {
  caseId: string;
  status: "waiting" | "in_progress" | "delayed" | "complete";
  ownerId?: string;
  dueAt?: string | null;
  riskBand?: "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7";
  artifactRefs?: string[];
};

export type TimelineMutationPolicyResult = {
  ok: boolean;
  error: string | null;
  riskBand: "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7";
  artifactRefs: string[];
};

export async function evaluateTimelineMutationPolicy(input: TimelineMutationInput): Promise<TimelineMutationPolicyResult> {
  if (input.status === "waiting") {
    if (!input.ownerId?.trim()) {
      return {
        ok: false,
        error: "Waiting items require ownerId.",
        riskBand: input.riskBand ?? "C6",
        artifactRefs: [],
      };
    }
    if (!input.dueAt?.trim()) {
      return {
        ok: false,
        error: "Waiting items require dueAt as expected follow-up date.",
        riskBand: input.riskBand ?? "C6",
        artifactRefs: [],
      };
    }
  }

  const riskBand = input.riskBand ?? "C6";
  const artifactRefs = await resolveCaseArtifactRefs(input.caseId, input.artifactRefs ?? []);
  const highRisk = riskBand === "C1" || riskBand === "C2";

  if (highRisk && artifactRefs.length === 0) {
    return {
      ok: false,
      error: "C1/C2 updates require proof artifacts. Attach artifact first or include artifactRefs.",
      riskBand,
      artifactRefs: [],
    };
  }

  return {
    ok: true,
    error: null,
    riskBand,
    artifactRefs,
  };
}
