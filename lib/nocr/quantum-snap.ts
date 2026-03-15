import {
  solveQuantumEfue,
  type QuantumEvolutionRule,
  type QuantumRequirement,
  type QuantumWitness,
} from "@/lib/nocr/unified-qe";

export type QuantumSnapGenerateOptions = {
  maxNewTokens: number;
  minNewTokens?: number;
  temperature: number;
  topP: number;
  doSample: boolean;
  repetitionPenalty?: number;
  noRepeatNgramSize?: number;
};

export type QuantumSnapSeed = {
  id: string;
  prompt: string;
  opts: QuantumSnapGenerateOptions;
  kind: "deterministic" | "exploratory" | "repair";
  sourceReason: string;
};

export type QuantumSnapProjection = {
  executionPlan: QuantumSnapSeed[];
  rejectedSeedIds: string[];
  projectionReason: string;
};

export function projectCodingQuantumSnap(args: {
  seeds: QuantumSnapSeed[];
  preferredLanguage: string;
  concrete: boolean;
  wantsTests: boolean;
  lastFailureReason?: string;
  executedSeedIds?: string[];
}): QuantumSnapProjection {
  const executed = new Set(args.executedSeedIds ?? []);
  const maxBranches = args.concrete ? 3 : 2;
  const qe = solveQuantumEfue<QuantumSnapSeed>({
    seed: buildRootSeed(args.seeds),
    evolutionRules: buildCodingEvolutionRules(args),
    requirements: buildCodingRequirements(executed),
    witnesses: buildCodingWitnesses(args),
    maxDepth: 1,
    maxCheck: Math.max(args.seeds.length + 4, 8),
    maxAdmissible: maxBranches,
    dedupeKey: (seed) => seed.id,
    rootStateId: "qe.coding.root",
  });
  const rankedIds = args.seeds
    .filter((seed) => !executed.has(seed.id))
    .map((seed) => seed.id);
  const executionPlan = qe.admissible.map((state) => state.content);
  const admittedIds = new Set(executionPlan.map((seed) => seed.id));
  const rejectedSeedIds = rankedIds.filter((seedId) => !admittedIds.has(seedId));

  return {
    executionPlan,
    rejectedSeedIds,
    projectionReason: `coding_quantum_snap:qe_lazy_branching=true;max_branches=${maxBranches};generated=${qe.stats.generatedStateCount};checked=${qe.stats.checkedStateCount};admissible=${qe.stats.admissibleStateCount}`,
  };
}

function buildRootSeed(seeds: QuantumSnapSeed[]): QuantumSnapSeed {
  return seeds[0] ?? {
    id: "seed.coding.root",
    prompt: "",
    kind: "exploratory",
    sourceReason: "empty_seed_root",
    opts: {
      maxNewTokens: 64,
      temperature: 0.2,
      topP: 1.0,
      doSample: false,
    },
  };
}

function buildCodingEvolutionRules(args: {
  seeds: QuantumSnapSeed[];
  preferredLanguage: string;
  concrete: boolean;
  wantsTests: boolean;
  lastFailureReason?: string;
}): Array<QuantumEvolutionRule<QuantumSnapSeed>> {
  return [
    {
      id: "qe.expand.coding_seed_pool",
      apply: (state) => state.depth === 0
        ? args.seeds.map((seed) => ({
          id: seed.id,
          content: seed,
          amplitude: scoreSeed(seed, args),
        }))
        : [],
    },
  ];
}

function buildCodingRequirements(executed: Set<string>): Array<QuantumRequirement<QuantumSnapSeed>> {
  return [
    {
      name: "not_executed",
      predicate: (state) => !executed.has(state.content.id),
    },
    {
      name: "prompt_present",
      predicate: (state) => state.content.prompt.trim().length > 0,
    },
  ];
}

function buildCodingWitnesses(args: {
  preferredLanguage: string;
  concrete: boolean;
  wantsTests: boolean;
  lastFailureReason?: string;
}): Array<QuantumWitness<QuantumSnapSeed>> {
  return [
    {
      name: "deterministic_or_repair",
      pattern: (seed) => seed.kind === "deterministic" || seed.kind === "repair",
    },
    {
      name: "tests_requested_signal",
      pattern: (seed) => !args.wantsTests || /test|pytest|jest|vitest|assert/i.test(seed.prompt),
    },
    {
      name: "language_alignment",
      pattern: (seed) => seed.prompt.toLowerCase().includes(args.preferredLanguage.toLowerCase()),
    },
    {
      name: "concrete_or_exploratory",
      pattern: (seed) => !args.concrete || seed.kind !== "exploratory" || seed.opts.temperature <= 0.35,
    },
  ];
}

function scoreSeed(
  seed: QuantumSnapSeed,
  args: {
    preferredLanguage: string;
    concrete: boolean;
    wantsTests: boolean;
    lastFailureReason?: string;
  },
): number {
  let score = 1;

  if (!seed.opts.doSample) score += 4;
  if (seed.opts.temperature <= 0.15) score += 3;
  else if (seed.opts.temperature <= 0.35) score += 1;
  else score -= 1;

  if (seed.kind === "deterministic") score += 3;
  if (seed.kind === "repair") score += args.lastFailureReason ? 4 : 1;
  if (seed.kind === "exploratory") score += 1;

  if (args.concrete) score += 2;
  if (args.wantsTests && /test|pytest|jest|vitest|assert/i.test(seed.prompt)) score += 2;
  if (seed.prompt.toLowerCase().includes(args.preferredLanguage.toLowerCase())) score += 1;
  if (/repair|retry|fix|correct/i.test(seed.prompt)) score += 1;
  if (seed.opts.repetitionPenalty && seed.opts.repetitionPenalty >= 1.15) score += 1;

  return score;
}
