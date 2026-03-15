import { selectFormation, type FormationId } from "@/lib/lml/path-orchestrator";
import type { NocrFunnelState, NocrRoot, NocrSeed, NocrTaggedRoot, NocrTaggedSeed } from "@/lib/nocr/types";

const ROOT_SPACE: NocrRoot[] = [
  {
    id: "root.sun.001",
    domain: "sun",
    planet: "sun",
    label: "Sun invariant root",
    lawId: "SUN.ROOT.001",
    provenance: {
      classification: "static",
      extractionStage: "static_seed",
      sourceLabel: "runtime:root_space:sun",
      sourceDigest: "runtime-root-sun-001",
    },
  },
  {
    id: "root.ability.001",
    domain: "ability",
    planet: "ability",
    label: "Ability planet root",
    lawId: "ABILITY.ROOT.001",
    provenance: {
      classification: "static",
      extractionStage: "static_seed",
      sourceLabel: "runtime:root_space:ability",
      sourceDigest: "runtime-root-ability-001",
    },
  },
  {
    id: "root.meta.001",
    domain: "meta",
    planet: "meta",
    label: "Meta planet root",
    lawId: "META.ROOT.001",
    provenance: {
      classification: "static",
      extractionStage: "static_seed",
      sourceLabel: "runtime:root_space:meta",
      sourceDigest: "runtime-root-meta-001",
    },
  },
  {
    id: "root.human.001",
    domain: "human",
    planet: "human",
    label: "Human planet root",
    lawId: "HUMAN.ROOT.001",
    provenance: {
      classification: "static",
      extractionStage: "static_seed",
      sourceLabel: "runtime:root_space:human",
      sourceDigest: "runtime-root-human-001",
    },
  },
  {
    id: "root.quantum.001",
    domain: "quantum",
    planet: "quantum",
    label: "Quantum planet root",
    lawId: "QUANTUM.ROOT.001",
    provenance: {
      classification: "static",
      extractionStage: "static_seed",
      sourceLabel: "runtime:root_space:quantum",
      sourceDigest: "runtime-root-quantum-001",
    },
  },
];

export function buildNocrSeed(text: string, abilityRoute: string): NocrSeed {
  const source = abilityRoute.startsWith("coding.")
    ? "coding"
    : abilityRoute.startsWith("web_search.")
      ? "web_search"
      : abilityRoute === "guard.refusal"
        ? "refusal"
        : "chat";
  return {
    id: `seed.${source}.${abilityRoute.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.${normalizeSeedText(text)}`,
    source,
    text,
    abilityRoute,
    origin: "efue.sentence",
    rank: 0,
  };
}

export function getNocrRootSpace(roots?: NocrRoot[]): NocrRoot[] {
  return roots ? [...roots] : [...ROOT_SPACE];
}

export function tagSeedForNocr(seed: NocrSeed): NocrTaggedSeed {
  return {
    seed,
    seedTag: `seed.${seed.source}.${seed.abilityRoute.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
    funnelReason: `nocr_tagged_seed:source=${seed.source};route=${seed.abilityRoute}`,
  };
}

export function tagSeedsForNocr(seeds: NocrSeed[]): NocrTaggedSeed[] {
  return seeds.map((seed) => tagSeedForNocr(seed));
}

export function tagRootSpaceForNocr(roots?: NocrRoot[]): NocrTaggedRoot[] {
  return getNocrRootSpace(roots).map((root) => ({
    root,
    rootTag: `root.${root.domain}.${root.id.split(".").slice(-1)[0] ?? "001"}`,
    source: root.provenance.extractionStage,
  }));
}

export function buildNocrFunnelState(
  seed: NocrSeed,
  roots?: NocrRoot[],
  exactChatSeeds: NocrSeed[] = [],
  qeChatSeeds: NocrSeed[] = [],
): NocrFunnelState {
  return {
    taggedSeed: tagSeedForNocr(seed),
    taggedRoots: tagRootSpaceForNocr(roots),
    exactChatSeeds: tagSeedsForNocr(exactChatSeeds),
    qeChatSeeds: tagSeedsForNocr(qeChatSeeds),
    ledgerState: "tagged",
  };
}

export function selectNocrFormation(seed: NocrSeed, finalAction: "success" | "refusal"): FormationId {
  return selectFormation(seed.abilityRoute, finalAction);
}

function normalizeSeedText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 32) || "empty";
}
