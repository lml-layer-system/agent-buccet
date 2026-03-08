import { runUIC, runUUIS, runLmlIntegration } from "@/lib/snap";
import { appendSnapRunLedger } from "@/lib/ledger";
import type { RuntimeUserLaw } from "@/lib/lml/chat-runtime";
import type { InfiniteContextState } from "@/lib/lml/infinite-context";

export type NoveltyCycleResult = {
  noveltyDetected: boolean;
  coverageIncomplete: boolean;
  proposedLaws: Array<{ text: string; scope: string; enforcement: string; source: string }>;
  activatedNextCycle: number;
  ledgerIndex: number | null;
};

export async function runNoveltyControllerCycle(args: {
  runId: string;
  message: string;
  sessionId: string;
  userLaws: RuntimeUserLaw[];
  state: InfiniteContextState;
  baseCoverageComplete: boolean;
}): Promise<NoveltyCycleResult> {
  const noveltyDetected = detectNovelty(args.message, args.userLaws, args.state);
  const coverageIncomplete = !args.baseCoverageComplete;

  if (!noveltyDetected) {
    return {
      noveltyDetected: false,
      coverageIncomplete,
      proposedLaws: [],
      activatedNextCycle: 0,
      ledgerIndex: null,
    };
  }

  const per = runUIC(args.message, undefined, "demo");
  const uuis = runUUIS(per);
  const { delta } = runLmlIntegration(per, uuis, {
    artifactRef: `novelty:${args.runId}`,
    runMode: "demo",
    authorizedRepairPacks: ["NSL.REPAIR_PACK.ALL"],
    measurementPackAuthorized: true,
    allowVersionRef: true,
  });

  const candidates = delta.LML_ADD
    .filter((law) => law.source_claim_ids.length > 0)
    .map((law) => ({
      text: law.text,
      scope: law.scope,
      enforcement: law.enforcement,
      source: "novelty_cycle",
    }));

  const validated = validateAgainstMetaLaws(candidates);
  args.state.pendingLawProposals = uniqueProposals([...args.state.pendingLawProposals, ...validated]);

  const ledger = await appendSnapRunLedger({
    runId: args.runId,
    profileId: "NOVELTY_CONTROLLER",
    profileVersion: "1.0.0",
    profileImmutableHash: "novelty-controller-v1",
    runMode: "demo",
    admissible: true,
    nullOutput: false,
    blockerCount: 0,
    rejectedCount: candidates.length - validated.length,
    artifactLength: args.message.length,
    createdAt: new Date().toISOString(),
  });

  return {
    noveltyDetected: true,
    coverageIncomplete,
    proposedLaws: validated,
    activatedNextCycle: 0,
    ledgerIndex: ledger.index,
  };
}

function detectNovelty(message: string, userLaws: RuntimeUserLaw[], state: InfiniteContextState): boolean {
  const lower = message.toLowerCase();
  const known = userLaws.map((law) => law.text.toLowerCase()).join("\n");
  const neverSeen = !state.ltm.L0.some((entry) => entry.user.toLowerCase() === lower);
  const asksNewAbility = /\ballow ability|install|module|new capability|enable\b/.test(lower);
  const unknownConstraintToken = /\b(infinite context|reverse efue|ontology shift|constraint projector)\b/.test(lower) && !known.includes("reverse efue");
  return neverSeen && (asksNewAbility || unknownConstraintToken);
}

function validateAgainstMetaLaws(
  candidates: Array<{ text: string; scope: string; enforcement: string; source: string }>,
): Array<{ text: string; scope: string; enforcement: string; source: string }> {
  return candidates.filter((law) => {
    const lower = law.text.toLowerCase();
    const invariantModal = /\b(must|must not|shall|shall not|never|required|forbidden|cannot)\b/.test(lower);
    const enforceable = /\b(block|refuse|gate|validate|verify|enforce|require|restrict)\b/.test(lower);
    return invariantModal && enforceable;
  });
}

function uniqueProposals<T extends { text: string; scope: string; enforcement: string }>(items: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const item of items) {
    byKey.set(`${item.text.toLowerCase()}|${item.scope}|${item.enforcement}`, item);
  }
  return Array.from(byKey.values());
}
