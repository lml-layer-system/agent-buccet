import { CODING_SKELETON_LAWS } from "@/lib/lml/coding-skeleton-laws";
import { CODING_ARCHITECTURE_LAWS } from "@/lib/lml/coding-architecture";
import { CODING_FAILURE_LAWS, CODING_HALTING_COLLAPSE_LAWS } from "@/lib/lml/coding-failure-laws";
import { CODING_FLOOR_LAWS } from "@/lib/lml/coding-physics";
import { CODING_INTENT_SPEC_LAWS } from "@/lib/lml/coding-intent-spec";
import { CODING_EXECUTION_LAWS } from "@/lib/lml/coding-execution";
import { CODING_INTEGRATION_LAWS } from "@/lib/lml/coding-integration";
import { CODING_LOGIC_LAWS } from "@/lib/lml/coding-logic";
import { CODING_META_ROOT_LAWS } from "@/lib/lml/coding-meta-root-laws";
import { CODING_SECURITY_LAWS } from "@/lib/lml/coding-security";
import { CODING_SEMANTIC_LAWS } from "@/lib/lml/coding-semantics";
import { CODING_STATE_LAWS } from "@/lib/lml/coding-state";
import { CODING_SURFACE_LAWS } from "@/lib/lml/coding-surface";
import { CODING_DESIGN_LAWS } from "@/lib/lml/coding-design";
import { CODING_SCALE_LAWS } from "@/lib/lml/coding-scale";
import { CODING_DEPENDENCY_LAWS } from "@/lib/lml/coding-dependencies";
import { CODING_GROUNDING_LAWS } from "@/lib/lml/coding-grounding";
import { CODING_ROOT_LAWS } from "@/lib/lml/coding-root-laws";
import { CODING_TRUNK_LAWS } from "@/lib/lml/coding-trunk-laws";
import { CODING_GENERATOR_LAWS } from "@/lib/lml/coding-generator-laws";
import { CODING_UNIVERSAL_TAXONOMY_LAWS } from "@/lib/lml/coding-universal-taxonomy";
import { CODING_SLOT_INVARIANT_LAWS } from "@/lib/lml/coding-slot-invariants";
import { CODING_APP_TASK_LAWS } from "@/lib/lml/coding-app-task-laws";
import { CODING_BENCHMARK_LAWS } from "@/lib/lml/coding-benchmark-laws";
import { CODING_REPO_PRESSURE_LAWS } from "@/lib/lml/coding-repo-pressure-laws";
import { CODING_SUBSTRATE_LAWS } from "@/lib/lml/coding-substrate-laws";
import { CODING_EFUE_MASTERY_LAWS } from "@/lib/lml/coding-efue-laws";
import { CODING_FRONTIER_BENCHMARK_LAWS } from "@/lib/lml/coding-frontier-benchmark-laws";

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
  ...CODING_SKELETON_LAWS,
  ...CODING_INTENT_SPEC_LAWS,
  ...CODING_EXECUTION_LAWS,
  ...CODING_INTEGRATION_LAWS,
  ...CODING_LOGIC_LAWS,
  ...CODING_ARCHITECTURE_LAWS,
  ...CODING_FLOOR_LAWS,
  ...CODING_SEMANTIC_LAWS,
  ...CODING_SECURITY_LAWS,
  ...CODING_STATE_LAWS,
  ...CODING_SURFACE_LAWS,
  ...CODING_DESIGN_LAWS,
  ...CODING_SCALE_LAWS,
  ...CODING_DEPENDENCY_LAWS,
  ...CODING_GROUNDING_LAWS,
  ...CODING_GENERATOR_LAWS,
  ...CODING_UNIVERSAL_TAXONOMY_LAWS,
  ...CODING_SLOT_INVARIANT_LAWS,
  ...CODING_APP_TASK_LAWS,
  ...CODING_BENCHMARK_LAWS,
  ...CODING_FRONTIER_BENCHMARK_LAWS,
  ...CODING_REPO_PRESSURE_LAWS,
  ...CODING_SUBSTRATE_LAWS,
  ...CODING_EFUE_MASTERY_LAWS,
  ...CODING_TRUNK_LAWS,
  ...CODING_ROOT_LAWS,
  ...CODING_META_ROOT_LAWS,
  ...CODING_FAILURE_LAWS,
  ...CODING_HALTING_COLLAPSE_LAWS,
] as const;
