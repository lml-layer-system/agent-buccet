export const META_PLANET_LAWS = [
  "META.01: Finite generator laws must define admissible behavior space; infinite branch execution is prohibited.",
  "META.02: Projection failures are converted into meta-hardening laws that tighten future admissibility.",
  "META.03: Generator knowledge is law-level and evolves monotonically via ledgered updates.",
  "META.04: Bad-path signatures must be persisted as exclusion constraints in pending law proposals.",
  "META.05: Activated meta-hardening laws must apply automatically in subsequent cycles.",
  "META.06: NSL repair mappings must bind to projection failure classes before output release.",
  "META.07: Collapse witness must include failed gate, predicate, and return moves when NULL occurs.",
  "META.08: Projection and repair traces must remain queryable from operator surfaces.",
  "META.09: Ability state transitions are lawful events and must be reflected in capability graph.",
  "META.10: Novelty-induced laws remain finite, deduplicated, and scoped by enforcement class.",
] as const;
