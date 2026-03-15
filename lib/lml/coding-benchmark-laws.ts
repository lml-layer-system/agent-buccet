export const CODING_BENCHMARK_LAWS = [
  "ABILITY.CODING.152: Benchmark pressure must be applied against real repo state or fully materialized repo-equivalent task packs, not isolated snippets alone.",
  "ABILITY.CODING.153: A benchmark coding task only counts as solved when repo-local witnesses, tests, typecheck, or exact machine-checkable output prove completion without hidden manual steps.",
  "ABILITY.CODING.154: Benchmark hostile variants must preserve the same file graph as the lawful task while embedding a realistic defect that the witness exposes directly.",
  "ABILITY.CODING.155: Benchmark patch, debug, feature, refactor, and test-fix tasks must constrain expected file changes so the system is measured on bounded lawful edits rather than unconstrained rewrites.",
  "ABILITY.CODING.156: Benchmark success must reject test-only cheating unless the task itself explicitly authorizes test repair as the target contract.",
] as const;
