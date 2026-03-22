import {
  createTimeAuthoritySkill,
  createTimeLawSkill,
  createTimeLedgerSkill,
  createTimeScopeSkill,
  createTimeSessionSkill,
  createTimeTrustSkill,
  createScopeGrantSkill,
} from "./skills.ts";
import type { LawSkill } from "./types.ts";

/**
 * Default law-skills for the gravity kernel (TIME.* + SCOPE.GRANT.CLOSED).
 * Use this when starting the kernel without custom skills.
 */
export function getDefaultLawSkills(): LawSkill[] {
  return [
    createTimeTrustSkill(),
    createTimeAuthoritySkill(),
    createTimeScopeSkill(),
    createTimeLawSkill(),
    createTimeSessionSkill(),
    createTimeLedgerSkill(),
    createScopeGrantSkill(),
  ];
}
