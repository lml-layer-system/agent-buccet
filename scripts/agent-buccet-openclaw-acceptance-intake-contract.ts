import assert from "node:assert/strict";
import {
  OPENCLAW_ACCEPTANCE_INTAKE_FAMILIES,
  OPENCLAW_ACCEPTANCE_SOURCE,
} from "../lib/agent-buccet/openclaw-acceptance-intake.ts";

async function main() {
  assert.equal(OPENCLAW_ACCEPTANCE_SOURCE.repo, "openclaw/openclaw");
  assert.equal(OPENCLAW_ACCEPTANCE_SOURCE.commit, "9978d2276b");

  assert.ok(OPENCLAW_ACCEPTANCE_SOURCE.builtInTools.includes("exec"));
  assert.ok(OPENCLAW_ACCEPTANCE_SOURCE.builtInTools.includes("message"));
  assert.ok(OPENCLAW_ACCEPTANCE_SOURCE.channels.includes("WhatsApp"));
  assert.ok(OPENCLAW_ACCEPTANCE_SOURCE.channels.includes("Telegram"));
  assert.ok(OPENCLAW_ACCEPTANCE_SOURCE.skills.includes("coding-agent"));
  assert.ok(OPENCLAW_ACCEPTANCE_SOURCE.skills.includes("taskflow"));
  assert.ok(OPENCLAW_ACCEPTANCE_SOURCE.extensionGroups.modelAndGatewayExtensions.includes("openai"));
  assert.ok(OPENCLAW_ACCEPTANCE_SOURCE.extensionGroups.searchAndFetchExtensions.includes("firecrawl"));

  assert.ok(
    OPENCLAW_ACCEPTANCE_INTAKE_FAMILIES.some((family) =>
      family.id === "OPENCLAW.ACCEPT.LOCAL.WORKSPACE" &&
      family.disposition === "base_candidate" &&
      family.normalizedActionKinds.includes("fs.read") &&
      family.normalizedActionKinds.includes("fs.write"),
    ),
    "expected local workspace acceptance family",
  );

  assert.ok(
    OPENCLAW_ACCEPTANCE_INTAKE_FAMILIES.some((family) =>
      family.id === "OPENCLAW.ACCEPT.MESSAGE.CHANNELS" &&
      family.sourceNames.includes("WhatsApp") &&
      family.sourceNames.includes("Slack"),
    ),
    "expected channel intake family",
  );

  assert.ok(
    OPENCLAW_ACCEPTANCE_INTAKE_FAMILIES.some((family) =>
      family.id === "OPENCLAW.ACCEPT.MODEL.PROVIDERS" &&
      family.normalizedActionKinds.includes("sys.credential.use") &&
      family.sourceNames.includes("OpenAI"),
    ),
    "expected provider intake family",
  );

  console.log("Agent Buccet OpenClaw acceptance intake contract");
  console.log(`built-in tools: ${OPENCLAW_ACCEPTANCE_SOURCE.builtInTools.length}`);
  console.log(`channels: ${OPENCLAW_ACCEPTANCE_SOURCE.channels.length}`);
  console.log(`skills: ${OPENCLAW_ACCEPTANCE_SOURCE.skills.length}`);
  console.log(`acceptance families: ${OPENCLAW_ACCEPTANCE_INTAKE_FAMILIES.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
