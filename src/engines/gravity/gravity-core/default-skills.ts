import {
  createMetaAuthoritySkill,
  createMetaContactSkill,
  createMetaContinuationSkill,
  createMetaLawSkill,
  createMetaLedgerSkill,
  createMetaScopeSkill,
  createMetaSessionSkill,
  createMetaTrustSkill,
  createScopeGrantSkill,
} from "./skills.ts";
import type { LawSkill } from "./types.ts";

/**
 * Default law-skills for the gravity kernel (META.* + SCOPE.GRANT.CLOSED).
 * Use this when starting the kernel without custom skills.
 */
export function getDefaultLawSkills(): LawSkill[] {
  return [
    createMetaContactSkill(),
    createMetaTrustSkill(),
    createMetaAuthoritySkill(),
    createMetaScopeSkill(),
    createMetaLawSkill(),
    createMetaSessionSkill(),
    createMetaLedgerSkill(),
    createMetaContinuationSkill(),
    createScopeGrantSkill(),
  ];
}
