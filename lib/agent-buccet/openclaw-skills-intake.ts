import { OPENCLAW_ACCEPTANCE_SOURCE } from "./openclaw-acceptance-intake.ts";

export type OpenClawBundledSkillName = typeof OPENCLAW_ACCEPTANCE_SOURCE.skills[number];

export const OPENCLAW_SKILLS_INTAKE_SOURCE = {
  repo: OPENCLAW_ACCEPTANCE_SOURCE.repo,
  commit: OPENCLAW_ACCEPTANCE_SOURCE.commit,
  totalBundledSkills: OPENCLAW_ACCEPTANCE_SOURCE.skills.length,
} as const;

export const OPENCLAW_BUNDLED_SKILLS: readonly OpenClawBundledSkillName[] = [
  ...OPENCLAW_ACCEPTANCE_SOURCE.skills,
] as const;
