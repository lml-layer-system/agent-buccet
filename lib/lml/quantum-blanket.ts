import type { InfiniteContextState } from "@/lib/lml/infinite-context";
import { type PendingLawProposal, uniquePendingProposals } from "@/lib/lml/meta-delivery";
import { extractSeedChildrenFromArtifact } from "@/lib/nocr/seed-extraction";

export type QuantumBlanketCycleResult = {
  active: true;
  candidateCount: number;
  finiteSeedCount: number;
  proposedLawCount: number;
  pendingProposalCount: number;
  proposals: PendingLawProposal[];
  seedsPreview: Array<{
    id: string;
    text: string;
    origin: string;
  }>;
};

type PendingProposal = {
  text: string;
  scope: string;
  enforcement: string;
  source: string;
};

export function runQuantumBlanketCycle(args: {
  message: string;
  documentText: string;
  userLawTexts: string[];
  state: InfiniteContextState;
}): QuantumBlanketCycleResult {
  const artifact = [
    args.message,
    args.documentText,
    ...args.userLawTexts.slice(-8),
    ...args.state.docs.slice(-4).map((doc) => doc.text),
    ...args.state.ltm.L0.slice(-4).flatMap((turn) => [turn.user, turn.assistant]),
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n\n");

  const extraction = extractSeedChildrenFromArtifact(artifact);
  const proposals = extraction.seeds
    .map(buildMetaProposalFromSeed)
    .filter((value): value is PendingProposal => value !== null)
    .slice(0, 8);

  args.state.pendingLawProposals = uniquePendingProposals([
    ...args.state.pendingLawProposals,
    ...proposals,
  ]);

  return {
    active: true,
    candidateCount: extraction.quantumSparkCandidateCount,
    finiteSeedCount: extraction.finiteSeedCount,
    proposedLawCount: proposals.length,
    pendingProposalCount: args.state.pendingLawProposals.filter((law) => law.source === "quantum_blanket_seed").length,
    proposals,
    seedsPreview: extraction.seeds.slice(0, 6).map((seed) => ({
      id: seed.id,
      text: seed.text,
      origin: seed.origin,
    })),
  };
}

function buildMetaProposalFromSeed(seed: ReturnType<typeof extractSeedChildrenFromArtifact>["seeds"][number]): PendingProposal | null {
  const lower = seed.text.toLowerCase();
  if (/\b(life|suicide|self harm|crisis|988|panic)\b/.test(lower)) {
    return {
      text: "Meta critical intercept must preserve life first, keep human presence, and escalate immediate safety support when crisis signals appear.",
      scope: "meta",
      enforcement: "quantum_blanket_seed_review",
      source: "quantum_blanket_seed",
    };
  }
  if (/\b(nocr|root|parent|collapse|null|admissible|branch|tree)\b/.test(lower)) {
    return {
      text: "Meta critical intercept must preserve lawful parent lock, collapse clipped branches to NULL, and keep branch and tree state legible.",
      scope: "meta",
      enforcement: "quantum_blanket_seed_review",
      source: "quantum_blanket_seed",
    };
  }
  if (/\b(ledger|parity|mirror|repair|nsl|fail[- ]closed)\b/.test(lower)) {
    return {
      text: "Ledger parity, mirror integrity, and repair trace continuity must remain intact before output admission.",
      scope: "meta",
      enforcement: "quantum_blanket_seed_review",
      source: "quantum_blanket_seed",
    };
  }
  if (!/\b(must|must not|never|required|forbid|cannot|always)\b/.test(lower)) {
    return null;
  }
  return {
    text: normalizeLaw(seed.text),
    scope: "meta",
    enforcement: "quantum_blanket_seed_review",
    source: "quantum_blanket_seed",
  };
}

function normalizeLaw(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  const sentence = compact.endsWith(".") ? compact.slice(0, -1) : compact;
  const capitalized = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  return capitalized.endsWith(".") ? capitalized : `${capitalized}.`;
}
