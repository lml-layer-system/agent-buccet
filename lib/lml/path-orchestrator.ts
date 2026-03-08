export type OrchestratorStage = "intent" | "safety" | "execute" | "repair" | "output";

export type FormationId = "formation.chat" | "formation.coding" | "formation.search" | "formation.refusal";

export type StageRecord = {
  stage: OrchestratorStage;
  status: "ok" | "blocked" | "error";
  detail: string;
  at: string;
};

export type OrchestratorTrace = {
  formation_id: FormationId;
  stages: OrchestratorStage[];
  records: StageRecord[];
  terminated: boolean;
  termination_reason: string;
};

const FORMATION_STAGES: Record<FormationId, OrchestratorStage[]> = {
  "formation.chat": ["intent", "safety", "execute", "repair", "output"],
  "formation.coding": ["intent", "safety", "execute", "repair", "output"],
  "formation.search": ["intent", "safety", "execute", "repair", "output"],
  "formation.refusal": ["intent", "safety", "execute", "repair", "output"],
};

export function selectFormation(abilityRoute: string, finalAction: "success" | "refusal"): FormationId {
  if (finalAction === "refusal" || abilityRoute.endsWith(".blocked") || abilityRoute === "guard.refusal") {
    return "formation.refusal";
  }
  if (abilityRoute === "coding.governed") {
    return "formation.coding";
  }
  if (abilityRoute === "web_search.governed") {
    return "formation.search";
  }
  return "formation.chat";
}

export async function runPathFormation(
  formationId: FormationId,
  handlers: Partial<Record<OrchestratorStage, () => Promise<{ status: "ok" | "blocked" | "error"; detail: string }> | { status: "ok" | "blocked" | "error"; detail: string }>>,
): Promise<OrchestratorTrace> {
  const stages = FORMATION_STAGES[formationId];
  const records: StageRecord[] = [];
  let terminated = true;
  let terminationReason = "completed";

  for (const stage of stages) {
    const handler = handlers[stage];
    if (!handler) {
      records.push({
        stage,
        status: "ok",
        detail: "no-op",
        at: new Date().toISOString(),
      });
      continue;
    }

    try {
      const result = await handler();
      records.push({
        stage,
        status: result.status,
        detail: result.detail,
        at: new Date().toISOString(),
      });
      if (result.status === "blocked" || result.status === "error") {
        terminated = result.status !== "error";
        terminationReason = result.detail;
        break;
      }
    } catch (error) {
      terminated = false;
      terminationReason = error instanceof Error ? error.message : "stage execution error";
      records.push({
        stage,
        status: "error",
        detail: terminationReason,
        at: new Date().toISOString(),
      });
      break;
    }
  }

  return {
    formation_id: formationId,
    stages,
    records,
    terminated,
    termination_reason: terminationReason,
  };
}
