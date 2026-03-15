export type QuantumEfueState<T> = {
  id: string;
  content: T;
  amplitude: number;
  phase: number;
  depth: number;
  parentStateId: string | null;
  evolutionRuleId: string | null;
};

export type QuantumEfueStateDraft<T> = {
  id: string;
  content: T;
  amplitude?: number;
  phase?: number;
};

export type QuantumEvolutionRule<T> = {
  id: string;
  apply: (state: QuantumEfueState<T>) => Iterable<QuantumEfueStateDraft<T>>;
};

export type QuantumRequirement<T> = {
  name: string;
  predicate: (state: QuantumEfueState<T>) => boolean;
};

export type QuantumWitness<T> = {
  name: string;
  pattern: (content: T, state: QuantumEfueState<T>) => boolean;
};

export type QuantumEfueSolveResult<T> = {
  admissible: QuantumEfueState<T>[];
  stats: {
    generatedStateCount: number;
    checkedStateCount: number;
    admissibleStateCount: number;
    witnessMatchedCount: number;
    maxDepth: number;
    maxCheck: number;
  };
};

export function solveQuantumEfue<T>(args: {
  seed: T;
  evolutionRules: QuantumEvolutionRule<T>[];
  requirements: QuantumRequirement<T>[];
  witnesses: QuantumWitness<T>[];
  maxDepth?: number;
  maxCheck?: number;
  maxAdmissible?: number;
  dedupeKey?: (content: T) => string;
  rootStateId?: string;
}): QuantumEfueSolveResult<T> {
  const maxDepth = args.maxDepth ?? 2;
  const maxCheck = args.maxCheck ?? 512;
  const maxAdmissible = args.maxAdmissible ?? 64;
  const iterator = iterateQuantumSuperposition({
    seed: args.seed,
    evolutionRules: args.evolutionRules,
    maxDepth,
    dedupeKey: args.dedupeKey,
    rootStateId: args.rootStateId,
  });

  const admissible: QuantumEfueState<T>[] = [];
  let generatedStateCount = 0;
  let checkedStateCount = 0;
  let witnessMatchedCount = 0;

  for (const state of iterator) {
    if (state.depth === 0) {
      continue;
    }

    generatedStateCount += 1;
    checkedStateCount += 1;

    if (!args.requirements.every((requirement) => requirement.predicate(state))) {
      if (checkedStateCount >= maxCheck) break;
      continue;
    }

    const witnessMatched = args.witnesses.length === 0
      ? true
      : args.witnesses.some((witness) => witness.pattern(state.content, state));
    if (!witnessMatched) {
      if (checkedStateCount >= maxCheck) break;
      continue;
    }

    witnessMatchedCount += 1;
    admissible.push(state);
    if (checkedStateCount >= maxCheck) {
      break;
    }
  }

  admissible.sort((a, b) => {
    if (b.amplitude !== a.amplitude) return b.amplitude - a.amplitude;
    if (a.phase !== b.phase) return a.phase - b.phase;
    return a.id.localeCompare(b.id);
  });

  return {
    admissible: admissible.slice(0, maxAdmissible),
    stats: {
      generatedStateCount,
      checkedStateCount,
      admissibleStateCount: Math.min(admissible.length, maxAdmissible),
      witnessMatchedCount,
      maxDepth,
      maxCheck,
    },
  };
}

function* iterateQuantumSuperposition<T>(args: {
  seed: T;
  evolutionRules: QuantumEvolutionRule<T>[];
  maxDepth: number;
  dedupeKey?: (content: T) => string;
  rootStateId?: string;
}): Generator<QuantumEfueState<T>> {
  const rootState: QuantumEfueState<T> = {
    id: args.rootStateId ?? "qe.seed",
    content: args.seed,
    amplitude: 1,
    phase: 0,
    depth: 0,
    parentStateId: null,
    evolutionRuleId: null,
  };

  const queue: QuantumEfueState<T>[] = [rootState];
  const seen = new Set<string>([makeDedupeKey(rootState.content, args.dedupeKey, rootState.id)]);

  while (queue.length > 0) {
    const state = queue.shift()!;
    yield state;

    if (state.depth >= args.maxDepth) {
      continue;
    }

    for (const rule of args.evolutionRules) {
      for (const draft of rule.apply(state)) {
        const key = makeDedupeKey(draft.content, args.dedupeKey, draft.id);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        const nextState: QuantumEfueState<T> = {
          id: draft.id,
          content: draft.content,
          amplitude: draft.amplitude ?? Math.max(0.001, state.amplitude * 0.85),
          phase: draft.phase ?? state.phase + 1,
          depth: state.depth + 1,
          parentStateId: state.id,
          evolutionRuleId: rule.id,
        };
        queue.push(nextState);
      }
    }
  }
}

function makeDedupeKey<T>(content: T, dedupeKey: ((content: T) => string) | undefined, fallbackId: string): string {
  if (dedupeKey) {
    return dedupeKey(content);
  }
  return fallbackId;
}
