import type {
  BoundaryActionKind,
  BoundaryRequestProvenance,
} from "./types.ts";
import type { BoundaryToolProposal } from "./adapters.ts";

const AUTHORITY_PATTERNS = [
  /\bignore (all )?(previous|prior) instructions\b/i,
  /\boverride (the )?(rules|laws|guardrails)\b/i,
  /\bself-approve\b/i,
  /\bauthorize yourself\b/i,
  /\bbypass (the )?(approval|boundary|guardrails|laws)\b/i,
];

const SCOPE_EXPANSION_PATTERNS = [
  /\bopen path\b/i,
  /\bgrant access\b/i,
  /\ballow .*outside\b/i,
  /\bexpand scope\b/i,
];

const LAW_MUTATION_PATTERNS = [
  /\bdisable (the )?(laws|guardrails|boundary)\b/i,
  /\bremove (the )?(restrictions|guardrails)\b/i,
  /\bchange (the )?(policy|law)\b/i,
];

const SESSION_REVIVAL_PATTERNS = [
  /\breopen session\b/i,
  /\bresume old session\b/i,
  /\brestore deleted grant\b/i,
  /\breactivate access\b/i,
];

const LEDGER_BYPASS_PATTERNS = [
  /\bdon't log\b/i,
  /\bdo not log\b/i,
  /\bskip (the )?ledger\b/i,
  /\bwithout audit\b/i,
  /\bwithout logging\b/i,
  /\bhide (this|the action)\b/i,
  /\bdelete (the )?logs\b/i,
];

export function inferBoundaryMetaFlagsFromText(text: string): {
  authorityClaimed?: boolean;
  requestsScopeExpansion?: boolean;
  requestsLawMutation?: boolean;
  requestsSessionRevival?: boolean;
  requestsLedgerBypass?: boolean;
} {
  return {
    authorityClaimed: AUTHORITY_PATTERNS.some((pattern) => pattern.test(text)) || undefined,
    requestsScopeExpansion: SCOPE_EXPANSION_PATTERNS.some((pattern) => pattern.test(text)) || undefined,
    requestsLawMutation: LAW_MUTATION_PATTERNS.some((pattern) => pattern.test(text)) || undefined,
    requestsSessionRevival: SESSION_REVIVAL_PATTERNS.some((pattern) => pattern.test(text)) || undefined,
    requestsLedgerBypass: LEDGER_BYPASS_PATTERNS.some((pattern) => pattern.test(text)) || undefined,
  };
}

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
