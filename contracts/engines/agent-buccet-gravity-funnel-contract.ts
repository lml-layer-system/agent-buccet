import assert from "node:assert/strict";
import {
  mapBoundaryGravityFunnelPayloadToInterceptRequests,
  parseBoundaryGravityFunnelPayload,
} from "./../../src/index.ts";

function main() {
  console.log("Agent Buccet gravity funnel contract");

  const writePayload = parseBoundaryGravityFunnelPayload(
    "write|/tmp/funnel%20target.txt|4242|prov=agent_inference flags=authorityClaimed,requestsScopeExpansion from-funnel",
  );
  assert.deepEqual(writePayload, {
    action: "write",
    target: "/tmp/funnel target.txt",
    pid: "4242",
    extra: "prov=agent_inference flags=authorityClaimed,requestsScopeExpansion from-funnel",
  });

  const writeRequests = mapBoundaryGravityFunnelPayloadToInterceptRequests(writePayload);
  assert.equal(writeRequests.length, 1);
  assert.deepEqual(writeRequests[0], {
    actionClass: "file",
    operation: "write",
    target: "/tmp/funnel target.txt",
    payloadSummary: "pid=4242 from-funnel",
    provenance: "agent_inference",
    flags: {
      authorityClaimed: true,
      requestsScopeExpansion: true,
    },
    funnel: {
      source: "gravity",
      rawAction: "write",
      pid: "4242",
      extra: "prov=agent_inference flags=authorityClaimed,requestsScopeExpansion from-funnel",
    },
  });
  console.log(`write funnel normalized: ${writeRequests[0]!.operation}`);

  const networkRequests = mapBoundaryGravityFunnelPayloadToInterceptRequests(
    parseBoundaryGravityFunnelPayload(
      "connect|tcp://example.com:443|777|prov=tool_output outbound-request",
    ),
  );
  assert.equal(networkRequests.length, 1);
  assert.equal(networkRequests[0]!.actionClass, "network");
  assert.equal(networkRequests[0]!.operation, "send");
  assert.equal(networkRequests[0]!.provenance, "tool_output");
  assert.equal(networkRequests[0]!.funnel?.rawAction, "connect");
  console.log(`network funnel normalized: ${networkRequests[0]!.operation}`);

  const renameRequests = mapBoundaryGravityFunnelPayloadToInterceptRequests(
    parseBoundaryGravityFunnelPayload(
      "rename|/tmp/source.txt|88|/tmp/destination.txt",
    ),
  );
  assert.equal(renameRequests.length, 2);
  assert.deepEqual(
    renameRequests.map((request) => ({
      actionClass: request.actionClass,
      operation: request.operation,
      target: request.target,
      payloadSummary: request.payloadSummary,
      rawAction: request.funnel?.rawAction,
    })),
    [
      {
        actionClass: "file",
        operation: "move",
        target: "/tmp/source.txt",
        payloadSummary: "move-destination:/tmp/destination.txt",
        rawAction: "rename",
      },
      {
        actionClass: "file",
        operation: "move",
        target: "/tmp/destination.txt",
        payloadSummary: "move-source:/tmp/source.txt",
        rawAction: "rename",
      },
    ],
  );
  console.log(`rename funnel split count: ${renameRequests.length}`);

  assert.throws(
    () => parseBoundaryGravityFunnelPayload("broken"),
    /malformed gravity payload/,
  );
  assert.throws(
    () =>
      mapBoundaryGravityFunnelPayloadToInterceptRequests({
        action: "rename",
        target: "/tmp/source.txt",
        pid: "1",
        extra: "",
      }),
    /requires counterpart target/,
  );
  console.log("gravity funnel rejects malformed payloads");
}

main();
