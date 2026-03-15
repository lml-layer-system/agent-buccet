export type ProbeFieldNode<TPayload> = {
  id: string;
  depth: number;
  label: string;
  payload: TPayload;
  lineage: string[];
};

export type ProbeFieldExpansion<TPayload> = {
  maxDepth: number;
  maxNodes: number;
  expand: (node: ProbeFieldNode<TPayload>) => ProbeFieldNode<TPayload>[];
};

export type ProbeFieldEvaluation<TResult, TPayload> = {
  prune: (node: ProbeFieldNode<TPayload>) => TResult | null;
  score: (result: TResult) => number;
};

export type ProbeFieldRun<TResult, TPayload> = {
  visited: number;
  pruned: TResult[];
  retained: ProbeFieldNode<TPayload>[];
  frontier: ProbeFieldNode<TPayload>[];
  survivors: TResult[];
};

export function runProbeField<TResult, TPayload>(
  seeds: ProbeFieldNode<TPayload>[],
  expansion: ProbeFieldExpansion<TPayload>,
  evaluation: ProbeFieldEvaluation<TResult, TPayload>,
): ProbeFieldRun<TResult, TPayload> {
  const queue = [...seeds];
  const pruned: TResult[] = [];
  const retained: ProbeFieldNode<TPayload>[] = [];
  const frontier: ProbeFieldNode<TPayload>[] = [];
  let visited = 0;

  while (queue.length > 0 && visited < expansion.maxNodes) {
    const node = queue.shift()!;
    visited += 1;

    const outcome = evaluation.prune(node);
    if (outcome) {
      pruned.push(outcome);
      continue;
    }

    retained.push(node);

    if (node.depth >= expansion.maxDepth) {
      frontier.push(node);
      continue;
    }

    const children = expansion.expand(node);
    for (const child of children) {
      if (visited + queue.length >= expansion.maxNodes) {
        break;
      }
      queue.push(child);
    }
  }

  // Survivors are the unpruned leaf/frontier nodes represented by best retained results
  // The current probe-field API uses prune() for failed states only. Callers can compute
  // survivors separately from the retained node set if needed; this placeholder keeps the
  // surface stable for later expansion.
  return {
    visited,
    pruned,
    retained,
    frontier,
    survivors: [],
  };
}
