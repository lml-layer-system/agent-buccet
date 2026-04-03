import assert from "node:assert/strict";
import {
  OPENCLAW_BUNDLED_SKILLS,
  OPENCLAW_SKILLS_INTAKE_SOURCE,
} from "../lib/agent-buccet/openclaw-skills-intake.ts";

function main() {
  assert.equal(OPENCLAW_SKILLS_INTAKE_SOURCE.repo, "openclaw/openclaw");
  assert.equal(OPENCLAW_SKILLS_INTAKE_SOURCE.commit, "9978d2276b");
  assert.equal(OPENCLAW_SKILLS_INTAKE_SOURCE.totalBundledSkills, 53);
  assert.equal(OPENCLAW_BUNDLED_SKILLS.length, 53);
  assert.ok(OPENCLAW_BUNDLED_SKILLS.includes("coding-agent"));
  assert.ok(OPENCLAW_BUNDLED_SKILLS.includes("taskflow"));
  assert.ok(OPENCLAW_BUNDLED_SKILLS.includes("github"));
  assert.ok(OPENCLAW_BUNDLED_SKILLS.includes("weather"));
  assert.ok(OPENCLAW_BUNDLED_SKILLS.includes("xurl"));

  console.log("Agent Buccet OpenClaw skills intake contract");
  console.log(`repo: ${OPENCLAW_SKILLS_INTAKE_SOURCE.repo}@${OPENCLAW_SKILLS_INTAKE_SOURCE.commit}`);
  console.log(`bundled skills: ${OPENCLAW_BUNDLED_SKILLS.length}`);
}

main();
