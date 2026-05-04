import assert from "node:assert/strict";
import { mapClaudeToolUseToInterceptRequest } from "./../../src/integrations/claude-sdk.ts";
import {
  mapBoundaryGravityFunnelPayloadToInterceptRequests,
  parseBoundaryGravityFunnelPayload,
} from "./../../src/runtime/intercept.ts";
import { mapSystemInterceptEventToRequest } from "./../../src/runtime/system-intercept.ts";

function main() {
  console.log("Agent Buccet feeder funnel contract");

  const gravityRequest = mapBoundaryGravityFunnelPayloadToInterceptRequests(
    parseBoundaryGravityFunnelPayload(
      "write|/tmp/funnel-target.txt|4242|prov=agent_inference flags=authorityClaimed from-funnel",
    ),
  )[0]!;

  const systemRequest = mapSystemInterceptEventToRequest({
    requestId: "system-1",
    kind: "file.write",
    target: "/tmp/funnel-target.txt",
    payloadSummary: "from-funnel",
    pid: 4242,
    provenance: "agent_inference",
    flags: {
      authorityClaimed: true,
    },
  });

  assert.equal(gravityRequest.actionClass, "file");
  assert.equal(systemRequest.actionClass, "file");
  assert.equal(gravityRequest.operation, "write");
  assert.equal(systemRequest.operation, "write");
  assert.equal(gravityRequest.target, systemRequest.target);
  assert.equal(gravityRequest.provenance, systemRequest.provenance);
  assert.deepEqual(gravityRequest.flags, systemRequest.flags);
  assert.equal(gravityRequest.funnel?.source, "gravity");
  assert.equal(systemRequest.funnel?.source, "system");
  assert.equal(systemRequest.funnel?.rawAction, "file.write");
  assert.match(systemRequest.payloadSummary ?? "", /pid=4242/);
  console.log(
    `gravity and system feeders normalize to: ${gravityRequest.actionClass}.${gravityRequest.operation}`,
  );

  const claudeRequest = mapClaudeToolUseToInterceptRequest({
    toolName: "write_file",
    toolInput: {
      path: "/tmp/funnel-target.txt",
      content: "hello",
    },
    mapping: {
      actionClass: "file",
      operation: "write",
      describeTarget: (input) => (input as { path: string }).path,
      describePayload: (input) =>
        `content-length=${String((input as { content: string }).content.length)}`,
      provenance: "agent_inference",
    },
  });

  assert.equal(claudeRequest.actionClass, "file");
  assert.equal(claudeRequest.operation, "write");
  assert.equal(claudeRequest.target, "/tmp/funnel-target.txt");
  assert.equal(claudeRequest.provenance, "agent_inference");
  assert.equal(claudeRequest.funnel?.source, "framework");
  assert.equal(claudeRequest.funnel?.rawAction, "write_file");
  assert.equal(claudeRequest.funnel?.extra, "adapter=claude-sdk");
  console.log(`framework feeder normalize source: ${claudeRequest.funnel?.source}`);
}

main();
