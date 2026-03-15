export const CODING_TRUNK_LAWS = [
  "ABILITY.CODING.95: LOGIC_STATE_INTEGRITY is a root coding trunk; stale, inconsistent, polluted, unsynchronized, or unreset state must collapse before emission.",
  "ABILITY.CODING.96: LOGIC_TEST_SURFACE is a root coding trunk; missing test blocks, missing test functions, missing subject import, trivial assertions, or missing behavior assertions must collapse before emission.",
  "ABILITY.CODING.97: SYNTAX_SUBSTRATE is a root coding trunk; malformed fenced substrate, wrong language surface, and non-code output must collapse before emission.",
  "ABILITY.CODING.98: ARCH_PROJECT_GRAPH is a root coding trunk; project graph illegality, missing exports, circular dependency, and deep design boundary collapse must fail closed.",
  "ABILITY.CODING.99: SAFETY_GUARD is a root coding trunk; hardcoded credentials, injection surfaces, auth guard loss, and explicit-failure loss are structural null conditions.",
  "ABILITY.CODING.100: LOGIC_CONTROL_FLOW is a root coding trunk; wrong return, null dereference, mutation during iteration, unchecked key access, missing cases, and swallowed exceptions must collapse before emission.",
  "ABILITY.CODING.101: INTEGRATION_FRAMEWORK_BINDING is a root coding trunk; framework import, app constructor, route surface, test harness, ORM universe, and runtime surface must remain coherent.",
  "ABILITY.CODING.102: INTEGRATION_DEPENDENCY_UNIVERSE is a root coding trunk; version mismatch, missing dependency declaration, and transitive dependency conflict must collapse before emission.",
  "ABILITY.CODING.103: ALGO_HALTING is a root coding trunk; non-halting or asymptotically unlawful solving paths must collapse before emission.",
  "ABILITY.CODING.104: INTEGRATION_PROJECT_BINDING is a root coding trunk; refactor/app service continuity and project import continuity must remain lawful across the graph.",
] as const;

