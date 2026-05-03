import type {
  BoundaryActionKind,
  BoundaryRequestProvenance,
} from "./types.ts";
import type { BoundaryToolProposal } from "./../boundaries/bodyguard.ts";
import { inferBoundaryMetaFlagsFromText } from "./../law/meta-flags.ts";

export function buildRemoteBoundaryProposal<T>(args: {
  actionKind: BoundaryActionKind;
  target: string;
  channel: string;
  rawText: string;
  payloadSummary?: string;
  execute?: () => Promise<T>;
  successReason: string;
  provenance?: BoundaryRequestProvenance;
}): BoundaryToolProposal<T> {
  return {
    actionKind: args.actionKind,
    target: args.target,
    payloadSummary: args.payloadSummary ?? `channel:${args.channel}`,
    provenance: args.provenance ?? "remote_user",
    flags: inferBoundaryMetaFlagsFromText(args.rawText),
    execute: args.execute,
    successReason: args.successReason,
    dryRunPreviewReason: `remote ${args.channel} action previewed but not executed`,
    successMetadata: {
      channel: args.channel,
    },
  };
}
