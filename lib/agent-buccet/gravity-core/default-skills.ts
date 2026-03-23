import {
  createMetaAuthoritySkill,
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
    createMetaTrustSkill(),
    createMetaAuthoritySkill(),
    createMetaScopeSkill(),
    createMetaLawSkill(),
    createMetaSessionSkill(),
    createMetaLedgerSkill(),
    createScopeGrantSkill(),
  ];
}
