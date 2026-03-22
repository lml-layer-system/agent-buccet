import { randomUUID } from "node:crypto";
import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryRequestProvenance,
  BoundaryRuntimeConfig,
} from "./types.ts";

export function createBoundaryActionRequest(args: {
  config: BoundaryRuntimeConfig;
  actionKind: BoundaryActionKind;
  target: string;
  payloadSummary?: string;
  provenance?: BoundaryRequestProvenance;
  flags?: BoundaryActionRequest["flags"];
}): BoundaryActionRequest {
  return {
    requestId: randomUUID(),
    sessionId: args.config.session.sessionId,
    actionKind: args.actionKind,
    target: args.target,
    payloadSummary: args.payloadSummary,
    requestedAt: new Date().toISOString(),
    provenance: args.provenance ?? "agent_inference",
    flags: args.flags,
  };
}
