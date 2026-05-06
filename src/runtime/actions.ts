import { enableBodyguardControl } from "./../boundaries/bodyguard.ts";
import {
  type BoundaryExecutionResult,
  createBoundaryActionRequest,
  createBoundarySpendRequest,
  runBoundaryControlledAction,
} from "./../boundaries/bodyguard.ts";
import type {
  BoundaryRequestProvenance,
  BoundaryReviewContext,
  BoundaryRuntimeConfig,
  BoundarySpendIntent,
} from "./types.ts";

export type BoundaryActionResult<T = void> = BoundaryExecutionResult<T>;

export async function boundaryNetworkSend<T>(args: {
  config: BoundaryRuntimeConfig;
  domain: string;
  payloadSummary?: string;
  provenance?: BoundaryRequestProvenance;
  flags?: {
    authorityClaimed?: boolean;
    claimsCompleteCoverage?: boolean;
    requestsScopeExpansion?: boolean;
    requestsLawMutation?: boolean;
    requestsSessionRevival?: boolean;
    requestsLedgerBypass?: boolean;
  };
  reviewContext?: BoundaryReviewContext;
  execute?: () => Promise<T>;
}): Promise<BoundaryActionResult<T>> {
  return runBoundaryControlledAction({
    config: enableBodyguardControl(args.config),
    request: createBoundaryActionRequest({
      config: args.config,
      actionKind: "network.send",
      target: args.domain,
      payloadSummary: args.payloadSummary,
      provenance: args.provenance,
      flags: args.flags,
      reviewContext: args.reviewContext,
    }),
    execute: args.execute,
    successReason: "network send executed inside boundary runtime",
    dryRunPreviewReason: "session is in dry-run mode; network send previewed but not executed",
  });
}

export async function boundaryRecipientSend<T>(args: {
  config: BoundaryRuntimeConfig;
  recipient: string;
  payloadSummary?: string;
  provenance?: BoundaryRequestProvenance;
  flags?: {
    authorityClaimed?: boolean;
    claimsCompleteCoverage?: boolean;
    requestsScopeExpansion?: boolean;
    requestsLawMutation?: boolean;
    requestsSessionRevival?: boolean;
    requestsLedgerBypass?: boolean;
  };
  reviewContext?: BoundaryReviewContext;
  execute?: () => Promise<T>;
}): Promise<BoundaryActionResult<T>> {
  return runBoundaryControlledAction({
    config: enableBodyguardControl(args.config),
    request: createBoundaryActionRequest({
      config: args.config,
      actionKind: "comm.send",
      target: args.recipient,
      payloadSummary: args.payloadSummary,
      provenance: args.provenance,
      flags: args.flags,
      reviewContext: args.reviewContext,
    }),
    execute: args.execute,
    successReason: "recipient send executed inside boundary runtime",
    dryRunPreviewReason: "session is in dry-run mode; recipient send previewed but not executed",
  });
}

export async function boundaryAgentSpendAction<T>(args: {
  config: BoundaryRuntimeConfig;
  spendIntent: BoundarySpendIntent;
  target?: string;
  payloadSummary?: string;
  provenance?: BoundaryRequestProvenance;
  flags?: {
    authorityClaimed?: boolean;
    claimsCompleteCoverage?: boolean;
    requestsScopeExpansion?: boolean;
    requestsLawMutation?: boolean;
    requestsSessionRevival?: boolean;
    requestsLedgerBypass?: boolean;
    payloadContainsFinancialData?: boolean;
  };
  reviewContext?: BoundaryReviewContext;
  execute?: () => Promise<T>;
}): Promise<BoundaryActionResult<T>> {
  return runBoundaryControlledAction({
    config: enableBodyguardControl(args.config),
    request: createBoundarySpendRequest({
      config: args.config,
      target: args.target,
      spendIntent: args.spendIntent,
      payloadSummary: args.payloadSummary,
      provenance: args.provenance,
      flags: args.flags,
      reviewContext: args.reviewContext,
    }),
    execute: args.execute,
    successReason: "agent spend executed inside boundary runtime",
    dryRunPreviewReason: "session is in dry-run mode; agent spend previewed but not executed",
  });
}

export async function boundaryToolExec<T>(args: {
  config: BoundaryRuntimeConfig;
  toolName: string;
  payloadSummary?: string;
  provenance?: BoundaryRequestProvenance;
  flags?: {
    authorityClaimed?: boolean;
    claimsCompleteCoverage?: boolean;
    requestsScopeExpansion?: boolean;
    requestsLawMutation?: boolean;
    requestsSessionRevival?: boolean;
    requestsLedgerBypass?: boolean;
  };
  reviewContext?: BoundaryReviewContext;
  execute?: () => Promise<T>;
}): Promise<BoundaryActionResult<T>> {
  return runBoundaryControlledAction({
    config: enableBodyguardControl(args.config),
    request: createBoundaryActionRequest({
      config: args.config,
      actionKind: "tool.exec",
      target: args.toolName,
      payloadSummary: args.payloadSummary,
      provenance: args.provenance,
      flags: args.flags,
      reviewContext: args.reviewContext,
    }),
    execute: args.execute,
    successReason: "tool execution executed inside boundary runtime",
    dryRunPreviewReason: "session is in dry-run mode; tool execution previewed but not executed",
  });
}

export async function boundaryDatabaseAction<T>(args: {
  config: BoundaryRuntimeConfig;
  database: string;
  actionKind: "db.query" | "db.insert" | "db.update" | "db.delete";
  payloadSummary?: string;
  provenance?: BoundaryRequestProvenance;
  flags?: {
    authorityClaimed?: boolean;
    claimsCompleteCoverage?: boolean;
    requestsScopeExpansion?: boolean;
    requestsLawMutation?: boolean;
    requestsSessionRevival?: boolean;
    requestsLedgerBypass?: boolean;
  };
  reviewContext?: BoundaryReviewContext;
  execute?: () => Promise<T>;
}): Promise<BoundaryActionResult<T>> {
  return runBoundaryControlledAction({
    config: enableBodyguardControl(args.config),
    request: createBoundaryActionRequest({
      config: args.config,
      actionKind: args.actionKind,
      target: args.database,
      payloadSummary: args.payloadSummary,
      provenance: args.provenance,
      flags: args.flags,
      reviewContext: args.reviewContext,
    }),
    execute: args.execute,
    successReason: "database action executed inside boundary runtime",
    dryRunPreviewReason: "session is in dry-run mode; database action previewed but not executed",
  });
}

export async function boundarySystemAction<T>(args: {
  config: BoundaryRuntimeConfig;
  target: string;
  actionKind:
    | "sys.env.read"
    | "sys.env.write"
    | "sys.config.read"
    | "sys.config.write"
    | "sys.credential.read"
    | "sys.credential.use";
  payloadSummary?: string;
  provenance?: BoundaryRequestProvenance;
  flags?: {
    authorityClaimed?: boolean;
    claimsCompleteCoverage?: boolean;
    requestsScopeExpansion?: boolean;
    requestsLawMutation?: boolean;
    requestsSessionRevival?: boolean;
    requestsLedgerBypass?: boolean;
  };
  reviewContext?: BoundaryReviewContext;
  execute?: () => Promise<T>;
}): Promise<BoundaryActionResult<T>> {
  return runBoundaryControlledAction({
    config: enableBodyguardControl(args.config),
    request: createBoundaryActionRequest({
      config: args.config,
      actionKind: args.actionKind,
      target: args.target,
      payloadSummary: args.payloadSummary,
      provenance: args.provenance,
      flags: args.flags,
      reviewContext: args.reviewContext,
    }),
    execute: args.execute,
    successReason: "system action executed inside boundary runtime",
    dryRunPreviewReason: "session is in dry-run mode; system action previewed but not executed",
  });
}
