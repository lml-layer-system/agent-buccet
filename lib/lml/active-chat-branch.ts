import type { QuantumCollapseResult } from "@/lib/nocr/types";

export type ActiveChatBranch = {
  id: string;
  treeId: string;
  status: "active" | "closed";
  startedAt: string;
  updatedAt: string;
  turnCount: number;
  matchedSeedIds: string[];
  matchedRootIds: string[];
  abilityRoutes: string[];
  reasonTrail: string[];
  dominanceScore: number;
  lineageParentBranchId: string | null;
};

export type ActiveChatBranchState = {
  activeBranchId: string | null;
  activeTreeId: string | null;
  branches: ActiveChatBranch[];
};

export type ActiveChatBranchUpdate = {
  action: "new_tree" | "extend" | "fork" | "sibling" | "merge" | "none";
  branch: ActiveChatBranch | null;
  state: ActiveChatBranchState;
  governanceReason: string;
};

type BranchCandidate = {
  branch: ActiveChatBranch;
  overlapRoots: number;
  overlapSeeds: number;
  sameAbilityRoute: boolean;
  sameTree: boolean;
  score: number;
};

export function defaultActiveChatBranchState(): ActiveChatBranchState {
  return {
    activeBranchId: null,
    activeTreeId: null,
    branches: [],
  };
}

export function updateActiveChatBranch(args: {
  current: ActiveChatBranchState;
  quantumCollapse: QuantumCollapseResult;
  reason: string;
  abilityRoute: string;
}): ActiveChatBranchUpdate {
  if (!args.quantumCollapse.branch || !args.quantumCollapse.tree) {
    return {
      action: "none",
      branch: null,
      state: args.current,
      governanceReason: "rootability_or_branchability_failed",
    };
  }

  const now = new Date().toISOString();
  const incomingTreeId = args.quantumCollapse.tree.id;
  const nextSeedIds = unique(args.quantumCollapse.snapMatches.map((match) => match.seedId));
  const nextRootIds = unique(args.quantumCollapse.snapMatches.map((match) => match.rootId));
  if (nextSeedIds.length === 0 || nextRootIds.length === 0) {
    return {
      action: "none",
      branch: null,
      state: args.current,
      governanceReason: "rootability_or_branchability_failed",
    };
  }

  const activeBranches = args.current.branches.filter((branch) => branch.status === "active");
  const activeBranch = activeBranches.find((branch) => branch.id === args.current.activeBranchId) ?? null;
  const closedBranchCollision = args.current.branches.some((branch) =>
    branch.status === "closed"
    && nextRootIds.some((rootId) => branch.matchedRootIds.includes(rootId))
    && nextSeedIds.some((seedId) => branch.matchedSeedIds.includes(seedId)),
  );

  const candidates = activeBranches
    .map((branch) => scoreCandidateBranch(branch, nextSeedIds, nextRootIds, args.abilityRoute, incomingTreeId))
    .sort((left, right) => right.score - left.score || right.branch.turnCount - left.branch.turnCount || left.branch.id.localeCompare(right.branch.id));
  const dominantCandidate = candidates.at(0) ?? null;
  const exactBranchCandidate = candidates.find((candidate) =>
    candidate.branch.id === args.quantumCollapse.branch?.id
    && candidate.branch.treeId === args.quantumCollapse.tree?.id,
  ) ?? null;

  if (exactBranchCandidate && exactBranchCandidate.score >= 6) {
    return extendExistingBranch(args.current, exactBranchCandidate.branch, nextSeedIds, nextRootIds, args.abilityRoute, args.reason, now, "path_legibility_and_parent_child_inheritance_hold");
  }

  if (closedBranchCollision) {
    return appendNewBranch(args.current, {
      id: args.quantumCollapse.branch.id,
      treeId: activeBranch?.treeId ?? args.quantumCollapse.tree.id,
      nextSeedIds,
      nextRootIds,
      abilityRoute: args.abilityRoute,
      reason: args.reason,
      now,
      action: "fork",
      governanceReason: "non_cycle_preference_forced_fork_against_closed_collision",
      lineageParentBranchId: activeBranch?.id ?? null,
      dominanceScore: dominantCandidate?.score ?? 0,
    });
  }

  if (dominantCandidate && dominantCandidate.score >= 10 && dominantCandidate.overlapRoots > 0 && dominantCandidate.overlapSeeds > 0) {
    return mergeIntoDominantBranch(args.current, dominantCandidate.branch, nextSeedIds, nextRootIds, args.abilityRoute, args.reason, now, dominantCandidate.score);
  }

  if (dominantCandidate && dominantCandidate.sameTree && dominantCandidate.overlapRoots > 0) {
    return appendNewBranch(args.current, {
      id: args.quantumCollapse.branch.id,
      treeId: dominantCandidate.branch.treeId,
      nextSeedIds,
      nextRootIds,
      abilityRoute: args.abilityRoute,
      reason: args.reason,
      now,
      action: "sibling",
      governanceReason: "differentiation_capacity_created_sibling_within_tree",
      lineageParentBranchId: dominantCandidate.branch.id,
      dominanceScore: dominantCandidate.score,
    });
  }

  if (dominantCandidate && dominantCandidate.sameTree) {
    return appendNewBranch(args.current, {
      id: args.quantumCollapse.branch.id,
      treeId: dominantCandidate.branch.treeId,
      nextSeedIds,
      nextRootIds,
      abilityRoute: args.abilityRoute,
      reason: args.reason,
      now,
      action: "fork",
      governanceReason: "containment_break_or_root_divergence_required_fork",
      lineageParentBranchId: dominantCandidate.branch.id,
      dominanceScore: dominantCandidate.score,
    });
  }

  if (dominantCandidate && dominantCandidate.score > 0) {
    return appendNewBranch(args.current, {
      id: args.quantumCollapse.branch.id,
      treeId: args.quantumCollapse.tree.id,
      nextSeedIds,
      nextRootIds,
      abilityRoute: args.abilityRoute,
      reason: args.reason,
      now,
      action: "new_tree",
      governanceReason: "current_trees_cannot_contain_meet_without_identity_loss",
      lineageParentBranchId: null,
      dominanceScore: dominantCandidate.score,
    });
  }

  return appendNewBranch(args.current, {
    id: args.quantumCollapse.branch.id,
    treeId: args.quantumCollapse.tree.id,
    nextSeedIds,
    nextRootIds,
    abilityRoute: args.abilityRoute,
    reason: args.reason,
    now,
    action: "new_tree",
    governanceReason: "new_rooted_tree_started",
    lineageParentBranchId: null,
    dominanceScore: 0,
  });
}

export function closeActiveChatBranch(current: ActiveChatBranchState, branchId: string | null): ActiveChatBranchState {
  if (!branchId) {
    return current;
  }
  return {
    ...current,
    activeBranchId: current.activeBranchId === branchId ? null : current.activeBranchId,
    branches: current.branches.map((branch) => branch.id === branchId ? { ...branch, status: "closed" as const } : branch),
  };
}

function scoreCandidateBranch(branch: ActiveChatBranch, nextSeedIds: string[], nextRootIds: string[], abilityRoute: string, incomingTreeId: string): BranchCandidate {
  const overlapRoots = overlapCount(branch.matchedRootIds, nextRootIds);
  const overlapSeeds = overlapCount(branch.matchedSeedIds, nextSeedIds);
  const sameAbilityRoute = branch.abilityRoutes.includes(abilityRoute);
  const sameTree = branch.treeId === incomingTreeId;
  return {
    branch,
    overlapRoots,
    overlapSeeds,
    sameAbilityRoute,
    sameTree,
    score: (overlapRoots * 5) + (overlapSeeds * 3) + (sameAbilityRoute ? 2 : 0) + 1,
  };
}

function extendExistingBranch(
  current: ActiveChatBranchState,
  target: ActiveChatBranch,
  nextSeedIds: string[],
  nextRootIds: string[],
  abilityRoute: string,
  reason: string,
  now: string,
  governanceReason: string,
): ActiveChatBranchUpdate {
  const updated = current.branches.map((branch) => branch.id === target.id
    ? {
      ...branch,
      status: "active" as const,
      updatedAt: now,
      turnCount: branch.turnCount + 1,
      matchedSeedIds: unique([...branch.matchedSeedIds, ...nextSeedIds]),
      matchedRootIds: unique([...branch.matchedRootIds, ...nextRootIds]),
      abilityRoutes: unique([...branch.abilityRoutes, abilityRoute]),
      reasonTrail: pushTrail(branch.reasonTrail, reason),
      dominanceScore: Math.max(branch.dominanceScore, scoreForDominance(branch.matchedSeedIds, branch.matchedRootIds, nextSeedIds, nextRootIds)),
    }
    : branch);
  const branch = updated.find((item) => item.id === target.id) ?? null;
  return {
    action: "extend",
    branch,
    state: {
      activeBranchId: target.id,
      activeTreeId: target.treeId,
      branches: updated,
    },
    governanceReason,
  };
}

function mergeIntoDominantBranch(
  current: ActiveChatBranchState,
  dominant: ActiveChatBranch,
  nextSeedIds: string[],
  nextRootIds: string[],
  abilityRoute: string,
  reason: string,
  now: string,
  dominanceScore: number,
): ActiveChatBranchUpdate {
  const updated = current.branches.map((branch) => branch.id === dominant.id
    ? {
      ...branch,
      status: "active" as const,
      updatedAt: now,
      turnCount: branch.turnCount + 1,
      matchedSeedIds: unique([...branch.matchedSeedIds, ...nextSeedIds]),
      matchedRootIds: unique([...branch.matchedRootIds, ...nextRootIds]),
      abilityRoutes: unique([...branch.abilityRoutes, abilityRoute]),
      reasonTrail: pushTrail(branch.reasonTrail, reason),
      dominanceScore: Math.max(branch.dominanceScore, dominanceScore),
    }
    : branch);
  const branch = updated.find((item) => item.id === dominant.id) ?? null;
  return {
    action: "merge",
    branch,
    state: {
      activeBranchId: dominant.id,
      activeTreeId: dominant.treeId,
      branches: updated,
    },
    governanceReason: "dominance_rule_selected_existing_branch_for_merge",
  };
}

function appendNewBranch(
  current: ActiveChatBranchState,
  args: {
    id: string;
    treeId: string;
    nextSeedIds: string[];
    nextRootIds: string[];
    abilityRoute: string;
    reason: string;
    now: string;
    action: "new_tree" | "fork" | "sibling";
    governanceReason: string;
    lineageParentBranchId: string | null;
    dominanceScore: number;
  },
): ActiveChatBranchUpdate {
  const nextBranch: ActiveChatBranch = {
    id: args.id,
    treeId: args.treeId,
    status: "active",
    startedAt: args.now,
    updatedAt: args.now,
    turnCount: 1,
    matchedSeedIds: args.nextSeedIds,
    matchedRootIds: args.nextRootIds,
    abilityRoutes: [args.abilityRoute],
    reasonTrail: [args.reason],
    dominanceScore: args.dominanceScore,
    lineageParentBranchId: args.lineageParentBranchId,
  };
  return {
    action: args.action,
    branch: nextBranch,
    state: {
      activeBranchId: nextBranch.id,
      activeTreeId: nextBranch.treeId,
      branches: [...current.branches, nextBranch],
    },
    governanceReason: args.governanceReason,
  };
}

function overlapCount(left: string[], right: string[]): number {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value)).length;
}

function scoreForDominance(currentSeedIds: string[], currentRootIds: string[], nextSeedIds: string[], nextRootIds: string[]): number {
  return (overlapCount(currentRootIds, nextRootIds) * 5) + (overlapCount(currentSeedIds, nextSeedIds) * 3);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function pushTrail(values: string[], value: string): string[] {
  const next = [...values, value];
  return next.slice(-12);
}
