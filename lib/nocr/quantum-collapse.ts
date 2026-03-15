import { selectFormation } from "@/lib/lml/path-orchestrator";
import { solveQuantumEfue, type QuantumEvolutionRule, type QuantumRequirement, type QuantumWitness } from "@/lib/nocr/unified-qe";
import type { NocrFunnelState, NocrRootDomain, QuantumCollapseResult } from "@/lib/nocr/types";

export function resolveQuantumCollapse(
  funnelState: NocrFunnelState,
  finalAction: "success" | "refusal",
): QuantumCollapseResult {
  const allSeeds = dedupeTaggedSeeds([
    funnelState.taggedSeed,
    ...funnelState.exactChatSeeds,
    ...funnelState.qeChatSeeds,
  ]);
  const locks = allSeeds.map((taggedSeed) => {
    const preferredDomains = inferPreferredRootDomains(taggedSeed.seed);
    const lock = resolveRootLock(funnelState, taggedSeed, preferredDomains);
    return { taggedSeed, preferredDomains, lock };
  });
  const snapMatches = locks
    .filter((entry) => entry.lock.matchedRoot)
    .map((entry) => ({
      seedTag: entry.taggedSeed.seedTag,
      seedId: entry.taggedSeed.seed.id,
      rootTag: entry.lock.matchedRoot!.rootTag,
      rootId: entry.lock.matchedRoot!.root.id,
      domain: entry.lock.matchedRoot!.root.domain,
      reasonClass: entry.lock.reasonClass,
      score: entry.lock.score,
    }));
  const primary = locks.find((entry) => entry.taggedSeed.seedTag === funnelState.taggedSeed.seedTag) ?? locks[0];
  const domain = primary.preferredDomains[0];
  const lock = primary.lock;

  if (!lock.matchedRoot) {
    return {
      taggedSeed: funnelState.taggedSeed,
      matchedRoot: null,
      snapMatches,
      branch: null,
      tree: null,
      stateChange: null,
      lockReasonClass: "no_extracted_root_match",
      matchScore: 0,
      qeGeneratedRootCount: lock.generatedRootCount,
      qeCheckedRootCount: lock.checkedRootCount,
      formationId: selectFormation(funnelState.taggedSeed.seed.abilityRoute, "refusal"),
      collapseMoment: "post_nocr_funnel",
      lockState: "clipped",
      reason: `collapse_moment=post_nocr_funnel; seed_source=${funnelState.taggedSeed.seed.source}; requested_domain=${domain}; route=${funnelState.taggedSeed.seed.abilityRoute}; lock=miss; lock_reason_class=no_extracted_root_match; score=0`,
    };
  }

  return {
    taggedSeed: funnelState.taggedSeed,
    matchedRoot: lock.matchedRoot,
    snapMatches,
    branch: buildBranch(funnelState.taggedSeed.seedTag, lock.matchedRoot.rootTag, lock.matchedRoot.root.id),
    tree: buildTree(lock.matchedRoot.rootTag, lock.matchedRoot.root.domain),
    stateChange: buildStateChange(funnelState.taggedSeed.seedTag, lock.matchedRoot.rootTag),
    lockReasonClass: lock.reasonClass,
    matchScore: lock.score,
    qeGeneratedRootCount: lock.generatedRootCount,
    qeCheckedRootCount: lock.checkedRootCount,
    formationId: selectFormation(funnelState.taggedSeed.seed.abilityRoute, finalAction),
    collapseMoment: "post_nocr_funnel",
    lockState: "locked",
    reason: buildCollapseReason(funnelState, domain, lock.reasonClass, lock.score),
  };
}

function inferPreferredRootDomains(seed: NocrFunnelState["taggedSeed"]["seed"]): NocrRootDomain[] {
  const lower = seed.text.toLowerCase();
  const domains: NocrRootDomain[] = [];

  if (/\b(trust|betrayal|loyalty|alliance|guidance|mentor|tribe fit|mirroring|human|bro|brodie|girlfriend|gf|wife|husband|friend|patience|angry|mad|sad|apology|relationship|dont talk down|keep me solid)\b/.test(lower)) {
    domains.push("human");
  }
  if (/\b(quantum|superposition|collapse|parallel admissibility|quantum snap|quantum spark)\b/.test(lower)) {
    domains.push("quantum");
  }
  if (seed.abilityRoute.startsWith("coding.") || seed.abilityRoute.startsWith("web_search.")) {
    domains.push("ability");
  }
  if (seed.abilityRoute === "guard.refusal") {
    domains.push("sun");
  }
  if (/\b(route|root|branch|nocr|uuis|snap|law|constraint|repair|projection|priority|prioritize|most important|without losing any piece|make sense of it|new planet|new universe|novelty)\b/.test(lower)) {
    domains.push("meta");
  }
  if (seed.abilityRoute === "chat.governed") {
    domains.push("human", "meta", "sun");
  }
  if (domains.length === 0) {
    domains.push("sun");
  }
  return uniqueDomains(domains);
}

function buildCollapseReason(
  funnelState: NocrFunnelState,
  domain: NocrRootDomain,
  reasonClass: QuantumCollapseResult["lockReasonClass"],
  score: number,
): string {
  const { seed } = funnelState.taggedSeed;
  return `collapse_moment=post_nocr_funnel; seed_source=${seed.source}; matched_domain=${domain}; route=${seed.abilityRoute}; lock=hit; lock_reason_class=${reasonClass}; score=${score}`;
}

function resolveRootLock(
  funnelState: NocrFunnelState,
  taggedSeed: NocrFunnelState["taggedSeed"],
  preferredDomains: NocrRootDomain[],
): {
  matchedRoot: NocrFunnelState["taggedRoots"][number] | null;
  score: number;
  reasonClass: QuantumCollapseResult["lockReasonClass"];
  generatedRootCount: number;
  checkedRootCount: number;
} {
  const extractedRoots = funnelState.taggedRoots.filter((root) => root.root.provenance.classification !== "static");
  const qe = solveQuantumEfue<NocrFunnelState["taggedRoots"][number]>({
    seed: extractedRoots[0] ?? makeNullRootSeed(funnelState, preferredDomains[0]),
    evolutionRules: buildRootLockEvolutionRules(funnelState, taggedSeed, extractedRoots, preferredDomains),
    requirements: buildRootLockRequirements(taggedSeed, preferredDomains),
    witnesses: buildRootLockWitnesses(taggedSeed, preferredDomains),
    maxDepth: 1,
    maxCheck: Math.max(extractedRoots.length + 4, 8),
    maxAdmissible: 1,
    dedupeKey: (root) => root.root.id,
    rootStateId: "qe.root_lock.root",
  });

  const top = qe.admissible[0];
  if (!top) {
    return {
      matchedRoot: null,
      score: 0,
      reasonClass: "no_extracted_root_match",
      generatedRootCount: qe.stats.generatedStateCount,
      checkedRootCount: qe.stats.checkedStateCount,
    };
  }

  return {
    matchedRoot: top.content,
    score: scoreRootLock(taggedSeed.seed.text, top.content.root.label, taggedSeed.seed.abilityRoute, top.content.root.domain, preferredDomains),
    reasonClass: classifyLockReason(taggedSeed.seed.text, top.content.root.label, taggedSeed.seed.abilityRoute, top.content.root.domain, preferredDomains),
    generatedRootCount: qe.stats.generatedStateCount,
    checkedRootCount: qe.stats.checkedStateCount,
  };
}

function buildRootLockEvolutionRules(
  funnelState: NocrFunnelState,
  taggedSeed: NocrFunnelState["taggedSeed"],
  roots: Array<NocrFunnelState["taggedRoots"][number]>,
  preferredDomains: NocrRootDomain[],
): Array<QuantumEvolutionRule<NocrFunnelState["taggedRoots"][number]>> {
  return [
    {
      id: "qe.expand.tagged_roots",
      apply: (state) => state.depth === 0
        ? roots.map((root, index) => ({
          id: `qe.root.${index + 1}`,
          content: root,
          amplitude: scoreRootLock(
            taggedSeed.seed.text,
            root.root.label,
            taggedSeed.seed.abilityRoute,
            root.root.domain,
            preferredDomains,
          ),
        }))
        : [],
    },
  ];
}

function buildRootLockRequirements(
  taggedSeed: NocrFunnelState["taggedSeed"],
  preferredDomains: NocrRootDomain[],
): Array<QuantumRequirement<NocrFunnelState["taggedRoots"][number]>> {
  return [
    {
      name: "extracted_only",
      predicate: (state) => state.content.root.provenance.classification !== "static",
    },
    {
      name: "preferred_domain_or_positive_lock",
      predicate: (state) => preferredDomains.includes(state.content.root.domain)
        || scoreRootLock(
          taggedSeed.seed.text,
          state.content.root.label,
          taggedSeed.seed.abilityRoute,
          state.content.root.domain,
          preferredDomains,
        ) >= 6,
    },
    {
      name: "positive_score",
      predicate: (state) => scoreRootLock(
        taggedSeed.seed.text,
        state.content.root.label,
        taggedSeed.seed.abilityRoute,
        state.content.root.domain,
        preferredDomains,
      ) > 0,
    },
  ];
}

function buildRootLockWitnesses(
  taggedSeed: NocrFunnelState["taggedSeed"],
  preferredDomains: NocrRootDomain[],
): Array<QuantumWitness<NocrFunnelState["taggedRoots"][number]>> {
  return [
    {
      name: "exact_label",
      pattern: (root) => classifyLockReason(
        taggedSeed.seed.text,
        root.root.label,
        taggedSeed.seed.abilityRoute,
        root.root.domain,
        preferredDomains,
      ) === "exact_label",
    },
    {
      name: "token_or_route_lock",
      pattern: (root) => {
        const reason = classifyLockReason(
          taggedSeed.seed.text,
          root.root.label,
          taggedSeed.seed.abilityRoute,
          root.root.domain,
          preferredDomains,
        );
        return reason === "token_overlap" || reason === "route_domain_alignment";
      },
    },
  ];
}

function makeNullRootSeed(
  funnelState: NocrFunnelState,
  domain: NocrRootDomain,
): NocrFunnelState["taggedRoots"][number] {
  return funnelState.taggedRoots.find((root) => root.root.domain === domain) ?? funnelState.taggedRoots[0];
}

function scoreRootLock(
  seedText: string,
  rootLabel: string,
  abilityRoute: string,
  domain: NocrRootDomain,
  preferredDomains: NocrRootDomain[],
): number {
  const normalizedSeed = normalize(seedText);
  const normalizedRoot = normalize(rootLabel);
  if (normalizedSeed === normalizedRoot) {
    return 1000;
  }
  const seedTerms = tokenize(seedText);
  const rootTerms = tokenize(rootLabel);
  let score = 0;
  for (const term of seedTerms) {
    if (rootTerms.has(term)) score += 1;
  }
  if (normalizedSeed.includes(normalizedRoot) || normalizedRoot.includes(normalizedSeed)) {
    score += 8;
  }
  if (routeDomainMatches(abilityRoute, domain)) {
    score += 3;
  }
  if (preferredDomains.includes(domain)) {
    score += Math.max(4 - preferredDomains.indexOf(domain), 1);
  }
  return score;
}

function classifyLockReason(
  seedText: string,
  rootLabel: string,
  abilityRoute: string,
  domain: NocrRootDomain,
  preferredDomains: NocrRootDomain[],
): QuantumCollapseResult["lockReasonClass"] {
  const normalizedSeed = normalize(seedText);
  const normalizedRoot = normalize(rootLabel);
  if (normalizedSeed === normalizedRoot || normalizedSeed.includes(normalizedRoot) || normalizedRoot.includes(normalizedSeed)) {
    return "exact_label";
  }
  if ((routeDomainMatches(abilityRoute, domain) || preferredDomains.includes(domain))
    && scoreRootLock(seedText, rootLabel, abilityRoute, domain, preferredDomains) <= 5) {
    return "route_domain_alignment";
  }
  return "token_overlap";
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length >= 4),
  );
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function routeDomainMatches(abilityRoute: string, domain: NocrRootDomain): boolean {
  if (domain === "ability") {
    return abilityRoute.startsWith("coding.") || abilityRoute.startsWith("web_search.");
  }
  if (domain === "sun") {
    return abilityRoute === "guard.refusal";
  }
  if (domain === "meta") {
    return abilityRoute === "chat.governed";
  }
  return false;
}

function uniqueDomains(domains: NocrRootDomain[]): NocrRootDomain[] {
  return [...new Set(domains)];
}

function dedupeTaggedSeeds(seeds: NocrFunnelState["exactChatSeeds"]): NocrFunnelState["exactChatSeeds"] {
  const seen = new Set<string>();
  const result: NocrFunnelState["exactChatSeeds"] = [];
  for (const seed of seeds) {
    if (seen.has(seed.seedTag)) {
      continue;
    }
    seen.add(seed.seedTag);
    result.push(seed);
  }
  return result;
}

function buildBranch(seedTag: string, rootTag: string, rootId: string) {
  return {
    id: `branch.${seedTag}__${rootTag}`,
    seedTag,
    rootTag,
    rootId,
  };
}

function buildTree(rootTag: string, planet: NocrRootDomain) {
  return {
    id: `tree.${rootTag}`,
    rootTag,
    planet,
  };
}

function buildStateChange(seedTag: string, rootTag: string) {
  return {
    id: `state.${seedTag}__${rootTag}.collapse`,
    type: "collapse_resolved" as const,
    branchId: `branch.${seedTag}__${rootTag}`,
    treeId: `tree.${rootTag}`,
  };
}
