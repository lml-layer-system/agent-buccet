export const ABILITY_PLANET_LAWS = [
  "ABILITY.CODING.01: Python code output must satisfy grammar-valid construction before admission.",
  "ABILITY.CODING.02: Python generation must pass AST syntax validation before final output emission.",
  "ABILITY.CODING.03: Python generation must pass bounded runtime validation before final output emission.",
  "ABILITY.CODING.04: Code generation must run projection-first across candidate branches and select only admissible output.",
  "ABILITY.CODING.05: Non-admissible coding branches must collapse to NULL with witness trace and repair mapping.",
  "ABILITY.CODING.06: Coding failures must map to deterministic failure classes and trigger NSL return moves.",
  "ABILITY.CODING.07: Coding retries are finite and must terminate with admissible output or explicit legal NULL reason.",
  "ABILITY.CODING.08: Requests with explicit test requirement must include tests as part of admissibility scoring.",
  "ABILITY.CODING.09: Generated code must be emitted in copyable fenced blocks for deterministic extraction.",
  "ABILITY.CODING.10: Style and expression overlays may shape response form but cannot bypass coding legality gates.",
  "ABILITY.CODING.11: Runtime capability activation for coding is law-governed and must be reflected in ontology state.",
  "ABILITY.CODING.12: Every coding turn must append ledger evidence for branch projection, validation, repair, and final action.",
] as const;
