export const CODING_ROOT_LAWS = [
  "ABILITY.CODING.105: ROOT_TEST_ARTIFACT_MISSING is a coding root; missing test blocks, missing test functions, missing subject imports, and missing behavior assertions must collapse before emission.",
  "ABILITY.CODING.106: ROOT_STATE_LIFECYCLE_MISSING is a coding root; stale cache, missing invalidation, missing reset, polluted global state, inconsistent versioning, race, and deadlock must collapse before emission.",
  "ABILITY.CODING.107: ROOT_FRAMEWORK_ENTRY_MISSING is a coding root; missing framework import, missing app constructor, missing route surface, missing test harness, and missing runtime dependency surface must collapse before emission.",
  "ABILITY.CODING.108: ROOT_DEPENDENCY_UNIVERSE_BROKEN is a coding root; version mismatch, missing dependency declaration, and transitive conflict must collapse before emission.",
  "ABILITY.CODING.109: ROOT_PROJECT_BINDING_BROKEN is a coding root; app service continuity and refactor import continuity must remain lawful across the project graph.",
  "ABILITY.CODING.110: ROOT_CONTROL_FLOW_UNSAFE is a coding root; null dereference, swallowed exception, mutation during iteration, unchecked key access, wrong return shape, and missing condition cases must collapse before emission.",
  "ABILITY.CODING.111: ROOT_SYNTAX_SUBSTRATE_ILLEGAL is a coding root; malformed code substrate, missing fences, and wrong language surface must collapse before emission.",
  "ABILITY.CODING.112: ROOT_ARCH_GRAPH_ILLEGAL is a coding root; circular dependency, missing export, and illegal project graph topology must collapse before emission.",
  "ABILITY.CODING.113: ROOT_SAFETY_GUARD_MISSING is a coding root; auth guard loss, explicit failure loss, injection surfaces, and hardcoded credential surfaces must collapse before emission.",
  "ABILITY.CODING.114: ROOT_HALTING_PATH_ILLEGAL is a coding root; infinite recursion, infinite loop, and non-scaling solving paths must collapse before emission.",
] as const;
