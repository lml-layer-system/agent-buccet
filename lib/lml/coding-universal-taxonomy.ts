import { classifyCodingFailureDimension } from "./coding-failure-laws.ts";

export const CODING_UNIVERSAL_TAXONOMY_LAWS = [
  "ABILITY.CODING.103: Coding failure pressure must be readable through the universal seven-group taxonomy: termination, correctness, specification, resource, robustness, security, and determinism.",
  "ABILITY.CODING.104: Local coding failure classes may be finer than the universal taxonomy, but every coding failure must still map into one universal group for hostile-field coverage.",
  "ABILITY.CODING.105: Universal taxonomy coverage is an overlay on the coding planet, not a replacement for direct leaf, trunk, root, or meta-root collapse.",
] as const;

export type CodingUniversalFailureGroup =
  | "termination"
  | "correctness"
  | "specification"
  | "resource"
  | "robustness"
  | "security"
  | "determinism"
  | "unknown";

export function mapCodingFailureToUniversalGroup(reason: string): CodingUniversalFailureGroup {
  const lower = reason.toLowerCase();
  const { dimension, classId } = classifyCodingFailureDimension(reason);

  if (dimension === "algorithm" || /timeout|halts?|non[- ]?terminat|deadlock|infinite_loop/.test(lower)) {
    return "termination";
  }

  if (dimension === "safety" || /sql_injection|xss|hardcoded_credentials|auth_guard|security_failed:/.test(lower)) {
    return "security";
  }

  if (/race_condition|deadlock|global_state_pollution|stale_state|missing_state_reset|determin/i.test(lower)) {
    return "determinism";
  }

  if (/version_mismatch|missing_dependency|transitive_dependency_conflict|memory|stack|resource|dependency_surface/.test(lower)) {
    return "resource";
  }

  if (dimension === "context" || /spec_gap|underspecified|wrong_family|wrong task|wrong language/.test(lower)) {
    return "specification";
  }

  if (/surface_failed:|witness_failed:|semantic_failed:|execution_failed:|state_failed:|design_failed:|grounding_failed:/.test(lower)) {
    return "robustness";
  }

  if (dimension === "syntax" || dimension === "logic" || dimension === "architecture" || dimension === "integration") {
    if (/wrong_output|logic|arithmetic|type|data structure|algorithm|output/i.test(lower) || /^L|^A|^I|^S/.test(classId)) {
      return "correctness";
    }
  }

  return "unknown";
}
