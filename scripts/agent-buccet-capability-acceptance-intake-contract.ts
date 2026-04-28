import assert from "node:assert/strict";
import {
  CAPABILITY_ACCEPTANCE_INTAKE_FAMILIES,
  CAPABILITY_INTAKE_SNAPSHOT,
} from "../lib/agent-buccet/capability-acceptance-intake.ts";

async function main() {
  assert.equal(CAPABILITY_INTAKE_SNAPSHOT.snapshotId, "BUCCET.CAPABILITY.SNAPSHOT.01");
  assert.equal(CAPABILITY_INTAKE_SNAPSHOT.label, "bundled_capability_surface");

  assert.ok(CAPABILITY_INTAKE_SNAPSHOT.builtInTools.includes("exec"));
  assert.ok(CAPABILITY_INTAKE_SNAPSHOT.builtInTools.includes("message"));
  assert.ok(CAPABILITY_INTAKE_SNAPSHOT.channels.includes("WhatsApp"));
  assert.ok(CAPABILITY_INTAKE_SNAPSHOT.channels.includes("Telegram"));
  assert.ok(CAPABILITY_INTAKE_SNAPSHOT.skills.includes("coding-agent"));
  assert.ok(CAPABILITY_INTAKE_SNAPSHOT.skills.includes("taskflow"));
  assert.ok(CAPABILITY_INTAKE_SNAPSHOT.extensionGroups.modelAndGatewayExtensions.includes("openai"));
  assert.ok(CAPABILITY_INTAKE_SNAPSHOT.extensionGroups.searchAndFetchExtensions.includes("firecrawl"));

  assert.ok(
    CAPABILITY_ACCEPTANCE_INTAKE_FAMILIES.some((family) =>
      family.id === "BUCCET.CAPABILITY.LOCAL.WORKSPACE" &&
      family.disposition === "base_candidate" &&
      family.normalizedActionKinds.includes("fs.read") &&
      family.normalizedActionKinds.includes("fs.write"),
    ),
    "expected local workspace acceptance family",
  );

  assert.ok(
    CAPABILITY_ACCEPTANCE_INTAKE_FAMILIES.some((family) =>
      family.id === "BUCCET.CAPABILITY.MESSAGE.CHANNELS" &&
      family.sourceNames.includes("WhatsApp") &&
      family.sourceNames.includes("Slack"),
    ),
    "expected channel intake family",
  );

  assert.ok(
    CAPABILITY_ACCEPTANCE_INTAKE_FAMILIES.some((family) =>
      family.id === "BUCCET.CAPABILITY.MODEL.PROVIDERS" &&
      family.normalizedActionKinds.includes("sys.credential.use") &&
      family.sourceNames.includes("OpenAI"),
    ),
    "expected provider intake family",
  );

  console.log("Agent Buccet capability acceptance intake contract");
  console.log(`built-in tools: ${CAPABILITY_INTAKE_SNAPSHOT.builtInTools.length}`);
  console.log(`channels: ${CAPABILITY_INTAKE_SNAPSHOT.channels.length}`);
  console.log(`skills: ${CAPABILITY_INTAKE_SNAPSHOT.skills.length}`);
  console.log(`acceptance families: ${CAPABILITY_ACCEPTANCE_INTAKE_FAMILIES.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
