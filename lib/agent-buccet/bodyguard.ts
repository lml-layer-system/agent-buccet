import { randomUUID } from "node:crypto";
import { createApprovalQueueAdapter } from "./approval.ts";
import {
  evaluateBoundaryGovernor,
  initialGovernorState,
  recordGovernorCrossing,
} from "./governor.ts";
import {
  adjudicateBodyguardRequest,
  applyBodyguardUserLawDecision,
  attachBodyguardControl,
  evaluateBodyguardAction,
  resolveBodyguardHeldRequest,
} from "./bodyguard-core.ts";
import { createBoundaryGravityService } from "./gravity-adapter/gravity-service.ts";
import { appendBoundaryLedger } from "./ledger.ts";
import { createBoundaryGravityAttachment } from "./gravity.ts";
import type { BoundaryRuntimeStore } from "./store.ts";
import { buildTelegramBoundaryProposal } from "./integrations/telegram.ts";
import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryApprovalChoice,
  BoundaryApprovalDecision,
  BoundaryApprovalOption,
  BoundaryApprovalPrompt,
  BoundaryApprovalRequest,
  BoundaryDecision,
  BoundaryLedgerRecord,
  BoundaryLegacyApprovalDecision,
  BoundaryRequestProvenance,
  BoundaryReviewContext,
  BoundaryRuntimeConfig,
  NslMove,
} from "./types.ts";

export {
  type BodyguardAdjudication,
  type BodyguardHeldDecision,
  type BodyguardRequestAdjudication,
} from "./bodyguard-core.ts";

export function enableBodyguardControl(
  config: BoundaryRuntimeConfig,
  overrides?: Partial<BoundaryRuntimeConfig>,
): BoundaryRuntimeConfig {
  return attachBodyguardControl(config, overrides);
}

export type BoundaryExecutionResult<T = void> = {
  config: BoundaryRuntimeConfig;
  allowed: boolean;
  executed: boolean;
  requiresApproval: boolean;
  reason: string;
  nslMoves: NslMove[];
  value?: T;
};

export type BoundaryToolProposal<T = unknown> = {
  actionKind: BoundaryActionKind;
  target: string;
  payloadSummary?: string;
  provenance?: BoundaryRequestProvenance;
  flags?: BoundaryActionRequest["flags"];
  reviewContext?: BoundaryReviewContext;
  successReason: string;
  dryRunPreviewReason?: string;
  execute?: () => Promise<T>;
  successMetadata?: Record<string, string | number | boolean>;
};

export type BoundaryToolEnvelope<TInput, TOutput> = {
  toolName: string;
  describeTarget: (input: TInput) => string;
  actionKind: BoundaryActionKind;
  payloadSummary?: (input: TInput) => string | undefined;
  provenance?: BoundaryRequestProvenance | ((input: TInput) => BoundaryRequestProvenance);
  flags?: (input: TInput) => BoundaryActionRequest["flags"];
  reviewContext?: (input: TInput) => BoundaryReviewContext | undefined;
  successReason?: string | ((input: TInput) => string);
  dryRunPreviewReason?: string | ((input: TInput) => string);
  successMetadata?: (input: TInput) => Record<string, string | number | boolean> | undefined;
  execute: (input: TInput) => Promise<TOutput>;
};

export type BoundaryChatEmissionProposal<T = string> = {
  target?: string;
  userInput?: string;
  attemptedOutput: string;
  invariantLawId?: string;
  invariantLabel?: string;
  evidence?: string[];
  provenance?: BoundaryRequestProvenance;
  flags?: BoundaryActionRequest["flags"];
  execute?: () => Promise<T>;
  successReason?: string;
  dryRunPreviewReason?: string;
  successMetadata?: Record<string, string | number | boolean>;
};

export function createBoundaryActionRequest(args: {
  config: BoundaryRuntimeConfig;
  actionKind: BoundaryActionKind;
  target: string;
  payloadSummary?: string;
  provenance?: BoundaryRequestProvenance;
  flags?: BoundaryActionRequest["flags"];
  reviewContext?: BoundaryReviewContext;
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
    reviewContext: args.reviewContext,
  };
}

async function logBlockedAction(
  config: BoundaryRuntimeConfig,
  request: BoundaryActionRequest,
  reason: string,
  lawIds: string[],
): Promise<void> {
  await appendBoundaryLedger("ACTION_BLOCKED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    requestId: request.requestId,
    actionKind: request.actionKind,
    target: request.target,
    decision: "deny",
    reason,
    lawIds,
    createdAt: new Date().toISOString(),
  });
}

async function logExecutedAction(
  config: BoundaryRuntimeConfig,
  request: BoundaryActionRequest,
  reason: string,
  metadata?: Record<string, string | number | boolean>,
): Promise<void> {
  await appendBoundaryLedger("ACTION_EXECUTED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    requestId: request.requestId,
    actionKind: request.actionKind,
    target: request.target,
    decision: "allow",
    reason,
    metadata,
    createdAt: new Date().toISOString(),
  });
}

async function logProposedAction(
  config: BoundaryRuntimeConfig,
  request: BoundaryActionRequest,
  reason = "action proposed",
): Promise<void> {
  await appendBoundaryLedger("ACTION_PROPOSED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    requestId: request.requestId,
    actionKind: request.actionKind,
    target: request.target,
    reason,
    createdAt: request.requestedAt,
  });
}

async function logDecisionReturned(
  config: BoundaryRuntimeConfig,
  request: BoundaryActionRequest,
  reason: string,
  decision: BoundaryDecision,
  lawIds: string[],
): Promise<void> {
  await appendBoundaryLedger("DECISION_RETURNED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    requestId: request.requestId,
    actionKind: request.actionKind,
    target: request.target,
    decision,
    reason,
    lawIds,
    createdAt: new Date().toISOString(),
  });
}

function normalizeApprovalDecision(
  decision: boolean | BoundaryApprovalDecision | BoundaryLegacyApprovalDecision,
): BoundaryApprovalDecision {
  if (typeof decision === "boolean") {
    return { choice: decision ? "allow_once" : "deny_once" };
  }
  if ("choice" in decision) {
    return decision;
  }
  if (decision.approved) {
    return {
      choice: "allow_as_law",
      scope: decision.scope,
      notes: decision.notes,
      domain: decision.domain,
    };
  }
  if (decision.persistDenied) {
    return {
      choice: "deny_as_law",
      scope: decision.scope,
      notes: decision.notes,
      domain: decision.domain,
    };
  }
  return {
    choice: "deny_once",
    scope: decision.scope,
    notes: decision.notes,
    domain: decision.domain,
  };
}

async function requestApproval(
  config: BoundaryRuntimeConfig,
  approval: BoundaryApprovalRequest,
  lawIds: string[],
): Promise<{ approved: boolean; decision: BoundaryApprovalDecision; witnessRecord: Awaited<ReturnType<typeof appendBoundaryLedger>> }> {
  await appendBoundaryLedger("APPROVAL_REQUESTED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    requestId: approval.request.requestId,
    actionKind: approval.request.actionKind,
    target: approval.request.target,
    decision: "require_approval",
    reason: approval.reason,
    lawIds,
    createdAt: new Date().toISOString(),
  });

  if (!config.approvalHandler) {
    const witnessRecord = await appendBoundaryLedger("APPROVAL_DENIED", {
      sessionId: config.session.sessionId,
      actorId: config.session.actorId,
      requestId: approval.request.requestId,
      actionKind: approval.request.actionKind,
      target: approval.request.target,
      decision: "deny",
      reason: "approval denied or unavailable",
      lawIds,
      createdAt: new Date().toISOString(),
    });
    return { approved: false, decision: { choice: "deny_once" }, witnessRecord };
  }

  const decision = normalizeApprovalDecision(await config.approvalHandler(approval));
  const approved = isApprovalAllowed(decision);
  const witnessRecord = await appendBoundaryLedger(approved ? "APPROVAL_GRANTED" : "APPROVAL_DENIED", {
    sessionId: config.session.sessionId,
    actorId: config.session.actorId,
    requestId: approval.request.requestId,
    actionKind: approval.request.actionKind,
    target: approval.request.target,
    decision: approved ? "allow" : "deny",
    reason: approved ? "approval granted by user" : "approval denied or unavailable",
    lawIds,
    metadata: {
      approval_choice: decision.choice,
    },
    createdAt: new Date().toISOString(),
  });

  return { approved, decision, witnessRecord };
}

function isApprovalAllowed(decision: BoundaryApprovalDecision): boolean {
  return decision.choice === "allow_once" || decision.choice === "allow_as_law";
}

function defaultApprovalOptions(): BoundaryApprovalOption[] {
  return [
    {
      choice: "allow_once",
      label: "Yes, allow once",
      effect: "allows this one boundary event without creating standing law",
    },
    {
      choice: "allow_as_law",
      label: "Yes, allow and make it law",
      effect: "allows this event and records a standing UPL allow",
    },
    {
      choice: "deny_once",
      label: "No, block once",
      effect: "blocks this event without creating standing law",
    },
    {
      choice: "deny_as_law",
      label: "No, block and make it law",
      effect: "blocks this event and records a standing UPL deny",
    },
  ];
}

function describeFlagViolations(request: BoundaryActionRequest): string[] {
  const flags = request.flags;
  if (!flags) {
    return [];
  }

  const violations: string[] = [];
  if (flags.authorityClaimed) {
    violations.push("attempt claims authority or self-approval");
  }
  if (flags.claimsUserApproval) {
    violations.push("attempt claims the user already approved it");
  }
  if (flags.claimsCompleteCoverage) {
    violations.push("attempt claims complete safety or complete coverage");
  }
  if (flags.requestsScopeExpansion) {
    violations.push("attempt tries to widen scope or open new reachability");
  }
  if (flags.requestsLawMutation) {
    violations.push("attempt tries to mutate or disable law");
  }
  if (flags.requestsSessionRevival) {
    violations.push("attempt tries to revive or reopen a closed session");
  }
  if (flags.requestsLedgerBypass) {
    violations.push("attempt tries to bypass or suppress ledgering");
  }
  if (flags.violatesUserConstraint) {
    violations.push("attempt conflicts with an explicit user constraint");
  }
  if (flags.groundingMismatch) {
    violations.push("attempt conflicts with grounding or supporting evidence");
  }
  if (flags.claimsActionCompletionWithoutWitness) {
    violations.push("attempt claims completion without witness evidence");
  }
  if (flags.payloadContainsPii) {
    violations.push("payload contains personally identifiable information (PII)");
  }
  if (flags.payloadContainsCredential) {
    violations.push("payload contains credentials or secrets");
  }
  if (flags.payloadContainsFinancialData) {
    violations.push("payload contains financial data (card number or similar)");
  }
  return violations;
}

function buildDefaultActionAttemptLines(request: BoundaryActionRequest): string[] {
  if (request.actionKind === "tool.exec") {
    const command = request.payloadSummary?.startsWith("spawn:")
      ? request.payloadSummary.slice("spawn:".length)
      : `${request.target}${request.payloadSummary ? ` ${request.payloadSummary}` : ""}`;
    return [`$ ${command}`];
  }

  switch (request.actionKind) {
    case "fs.delete":
      return [`$ delete ${request.target}`];
    case "fs.write":
      return [`$ write ${request.target}`, ...(request.payloadSummary ? [`  ${request.payloadSummary}`] : [])];
    case "fs.append":
      return [`$ append ${request.target}`, ...(request.payloadSummary ? [`  ${request.payloadSummary}`] : [])];
    case "fs.mkdir":
      return [`$ mkdir ${request.target}`];
    case "fs.move":
      return [`$ move ${request.target}`, ...(request.payloadSummary ? [`  ${request.payloadSummary}`] : [])];
    case "network.send":
      return [`$ network.send ${request.target}`, ...(request.payloadSummary ? [`  ${request.payloadSummary}`] : [])];
    case "comm.send":
      return [`$ comm.send ${request.target}`, ...(request.payloadSummary ? [`  ${request.payloadSummary}`] : [])];
    case "db.query":
    case "db.insert":
    case "db.update":
    case "db.delete":
      return [`$ ${request.actionKind} ${request.target}`, ...(request.payloadSummary ? [`  ${request.payloadSummary}`] : [])];
    default:
      return [`$ ${request.actionKind} ${request.target}`, ...(request.payloadSummary ? [`  ${request.payloadSummary}`] : [])];
  }
}

function actionPromptTitle(request: BoundaryActionRequest, context?: BoundaryReviewContext): string {
  if (context?.title) {
    return context.title;
  }
  if (request.actionKind === "tool.exec") {
    return "Would you like to run the following command?";
  }
  return "Would you like to allow the following boundary action?";
}

function buildBoundaryApprovalPrompt(args: {
  request: BoundaryActionRequest;
  reason: string;
  lawIds: string[];
}): BoundaryApprovalPrompt {
  const context = args.request.reviewContext;
  if (context?.surface === "chat") {
    const actorLabel = context.actorLabel ?? "Agent";
    return {
      title: `${actorLabel} hit the chat action boundary`,
      question: context.question ?? "Does this emitted output match your intent?",
      surface: "chat",
      lawIds: args.lawIds,
      userInput: context.userInput,
      attemptedOutput: context.attemptedOutput,
      invariantLawId: context.invariantLawId ?? args.lawIds[0],
      invariantLabel: context.invariantLabel ?? args.reason,
      evidence: context.evidence ?? [],
      violations: context.violations ?? describeFlagViolations(args.request),
      options: defaultApprovalOptions(),
    };
  }

  return {
    title: actionPromptTitle(args.request, context),
    question: context?.question ?? args.reason,
    surface: "action",
    lawIds: args.lawIds,
    attemptLines: context?.attemptLines ?? buildDefaultActionAttemptLines(args.request),
    invariantLawId: args.lawIds[0],
    violations: context?.violations ?? describeFlagViolations(args.request),
    options: defaultApprovalOptions(),
  };
}

export function renderBoundaryApprovalPrompt(approval: BoundaryApprovalRequest): string {
  const lines: string[] = [approval.prompt.title, ""];
  if (approval.prompt.lawIds.length > 0) {
    lines.push("Triggered laws:");
    for (const lawId of approval.prompt.lawIds) {
      lines.push(`- ${lawId}`);
    }
  }
  if (approval.prompt.surface === "chat") {
    if (approval.prompt.invariantLabel) {
      lines.push("", approval.prompt.invariantLabel);
    }
    if (approval.prompt.userInput) {
      lines.push("", `User input: ${approval.prompt.userInput}`);
    }
    if (approval.prompt.attemptedOutput) {
      lines.push(`Attempted output: ${approval.prompt.attemptedOutput}`);
    }
    if (approval.prompt.evidence?.length) {
      lines.push("", "Evidence:");
      for (const line of approval.prompt.evidence) {
        lines.push(`- ${line}`);
      }
    }
  } else if (approval.prompt.attemptLines?.length) {
    lines.push("", "Attempt:");
    for (const line of approval.prompt.attemptLines) {
      lines.push(line);
    }
  }
  if (approval.prompt.violations?.length) {
    lines.push("", "Violations:");
    for (const line of approval.prompt.violations) {
      lines.push(`- ${line}`);
    }
  }
  lines.push("", approval.prompt.question, "");
  approval.prompt.options.forEach((option, index) => {
    lines.push(`${index + 1}. ${option.label}`);
    lines.push(`   ${option.effect}`);
  });
  return lines.join("\n");
}

export async function enforceBoundaryProposal<T>(args: {
  config: BoundaryRuntimeConfig;
  proposal: BoundaryToolProposal<T>;
}): Promise<BoundaryExecutionResult<T>> {
  return runBoundaryControlledAction({
    config: enableBodyguardControl(args.config),
    request: createBoundaryActionRequest({
      config: args.config,
      actionKind: args.proposal.actionKind,
      target: args.proposal.target,
      payloadSummary: args.proposal.payloadSummary,
      provenance: args.proposal.provenance,
      flags: args.proposal.flags,
      reviewContext: args.proposal.reviewContext,
    }),
    execute: args.proposal.execute,
    successReason: args.proposal.successReason,
    dryRunPreviewReason: args.proposal.dryRunPreviewReason,
    successMetadata: args.proposal.successMetadata,
  });
}

export function wrapBoundaryTool<TInput, TOutput>(
  config: BoundaryRuntimeConfig,
  envelope: BoundaryToolEnvelope<TInput, TOutput>,
): (input: TInput) => Promise<BoundaryExecutionResult<TOutput>> {
  return async (input: TInput) =>
    enforceBoundaryProposal({
      config,
      proposal: {
        actionKind: envelope.actionKind,
        target: envelope.describeTarget(input),
        payloadSummary: envelope.payloadSummary?.(input),
        provenance:
          typeof envelope.provenance === "function"
            ? envelope.provenance(input)
            : envelope.provenance,
        flags: envelope.flags?.(input),
        reviewContext: envelope.reviewContext?.(input),
        successReason:
          typeof envelope.successReason === "function"
            ? envelope.successReason(input)
            : envelope.successReason ?? `${envelope.toolName} executed inside boundary runtime`,
        dryRunPreviewReason:
          typeof envelope.dryRunPreviewReason === "function"
            ? envelope.dryRunPreviewReason(input)
            : envelope.dryRunPreviewReason,
        successMetadata: envelope.successMetadata?.(input),
        execute: async () => envelope.execute(input),
      },
    });
}

const COMPLETE_COVERAGE_PATTERNS = [
  /\bcomplete safety\b/i,
  /\bcomplete coverage\b/i,
  /\bfully safe\b/i,
  /\bguaranteed safe\b/i,
  /\bnothing can go wrong\b/i,
  /\bperfectly secure\b/i,
];

const AUTHORITY_PATTERNS = [
  /\bignore (all )?(previous|prior) instructions\b/i,
  /\boverride (the )?(rules|laws|guardrails)\b/i,
  /\bself-approve\b/i,
  /\bauthorize yourself\b/i,
  /\bbypass (the )?(approval|boundary|guardrails|laws)\b/i,
];

const USER_APPROVAL_PATTERNS = [
  /\bthe user (already )?(approved|said yes)\b/i,
  /\bboss (already )?said yes\b/i,
  /\bpermission (was|has been) granted\b/i,
];

const ACTION_COMPLETION_PATTERNS = [
  /\bi (already )?(did|completed|executed|sent|deleted|updated|wrote)\b/i,
  /\bit (has been|was) done\b/i,
  /\bcompleted successfully\b/i,
];

export function inferBoundaryChatFlagsFromOutput(text: string): BoundaryActionRequest["flags"] {
  return {
    authorityClaimed: AUTHORITY_PATTERNS.some((pattern) => pattern.test(text)) || undefined,
    claimsCompleteCoverage: COMPLETE_COVERAGE_PATTERNS.some((pattern) => pattern.test(text)) || undefined,
    claimsUserApproval: USER_APPROVAL_PATTERNS.some((pattern) => pattern.test(text)) || undefined,
    claimsActionCompletionWithoutWitness: ACTION_COMPLETION_PATTERNS.some((pattern) => pattern.test(text)) || undefined,
  };
}

// ─── Structural Generators ────────────────────────────────────────────────────
// The defense is the finite structural generator that makes a string valid in the
// real world — not surface regex. A fake credit card fails Luhn. A fake IP fails
// the 8-bit octet constraint. A fake IBAN fails MOD-97. Structural generators
// cannot be juked by AI hallucination or prompt-injection mockdata.

function isValidIpv4Structural(candidate: string): boolean {
  const parts = candidate.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

function ibanMod97Check(iban: string): boolean {
  const cleaned = iban.replace(/[\s-]/g, "").toUpperCase();
  if (cleaned.length < 5 || cleaned.length > 34) return false;
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0n;
  for (const ch of numeric) {
    remainder = (remainder * 10n + BigInt(ch)) % 97n;
  }
  return remainder === 1n;
}

function shannonEntropy(str: string): number {
  const freq: Record<string, number> = {};
  for (const ch of str) freq[ch] = (freq[ch] ?? 0) + 1;
  const len = str.length;
  return Object.values(freq).reduce((acc, count) => {
    const p = count / len;
    return acc - p * Math.log2(p);
  }, 0);
}

function isHighEntropyToken(str: string): boolean {
  return str.length >= 32 && shannonEntropy(str) >= 3.5;
}

function abaRoutingCheck(routing: string): boolean {
  if (!/^\d{9}$/.test(routing)) return false;
  const d = routing.split("").map(Number);
  return (3 * (d[0]! + d[3]! + d[6]!) + 7 * (d[1]! + d[4]! + d[7]!) + (d[2]! + d[5]! + d[8]!)) % 10 === 0;
}

// ─── PII Patterns (direct: no additional structural validation) ───────────────

const EGRESS_PII_PATTERNS: RegExp[] = [
  // Email address
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/,
  // US phone (NANP)
  /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  // US SSN (dashed)
  /\b\d{3}-\d{2}-\d{4}\b/,
  // International phone E.164
  /\+\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{3,5}[-.\s]?\d{4,9}\b/,
  // IPv6 full (8 hex groups)
  /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/,
  // IPv6 compressed (requires at least two colons adjacent or separated)
  /\b(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}\b/,
  // Date of birth with context keyword
  /\b(?:dob|date[_\s]of[_\s]birth|born)\b[:\s]+\d{2,4}[-/]\d{2}[-/]\d{2,4}/i,
  // ISO date (YYYY-MM-DD — strong DOB signal in outbound context)
  /\b(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/,
  // US passport number with keyword
  /\bpassport[:\s#]+[A-Z]\d{8}\b/i,
  // Medical record number
  /\b(?:mrn|medical[_\s]record|patient[_\s]id)[:\s#]+\d{6,10}\b/i,
  // SWIFT/BIC code with context keyword (context-bounded to prevent all-caps word false positives)
  /\b(?:swift|bic|bank[_\s]code)[:\s]+[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b/i,
  // National ID / government ID with context
  /\b(?:national[_\s]id|gov(?:ernment)?[_\s]id|id[_\s]number)[:\s#]+[A-Z0-9\-]{6,20}\b/i,
];

// ─── Credential Patterns ──────────────────────────────────────────────────────

const EGRESS_CREDENTIAL_PATTERNS: RegExp[] = [
  // Generic sk-/pk-/api-key prefix
  /\b(sk-|pk-|api[_-]?key[_-]?)[a-zA-Z0-9]{16,}/i,
  // PEM private key
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  // PEM certificate
  /-----BEGIN CERTIFICATE-----/,
  // Password / secret / token assignment
  /\b(password|passwd|secret|token)\s*[:=]\s*\S{6,}/i,
  // AWS access key ID
  /\bAKIA[0-9A-Z]{16}\b/,
  // GitHub PAT (vendor namespace: ghp_ + exactly 36 alphanum)
  /\bghp_[A-Za-z0-9]{36}\b/,
  // GitHub fine-grained PAT
  /\bgithub_pat_[A-Za-z0-9_]{82}\b/,
  // Google API key (AIza + exactly 35 chars)
  /\bAIza[A-Za-z0-9_\-]{35}\b/,
  // Stripe secret/publishable key
  /\bsk_(?:live|test)_[A-Za-z0-9]{24,}\b/,
  // Slack token
  /\bxox[bpoa]-[A-Za-z0-9\-]{10,}\b/,
  // JWT (all three segments present: eyJheader.eyJpayload.signature)
  /\beyJ[A-Za-z0-9_\-]+\.eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/,
];

// ─── Financial Patterns ───────────────────────────────────────────────────────

const EGRESS_FINANCIAL_PATTERNS: RegExp[] = [
  // Visa (13 or 16 digits)
  /\b4[0-9]{12}(?:[0-9]{3})?\b/,
  // Mastercard (16 digits, BINs 51-55)
  /\b5[1-5][0-9]{14}\b/,
  // Amex (15 digits)
  /\b3[47][0-9]{13}\b/,
  // Discover (16 digits)
  /\b6(?:011|5[0-9]{2})[0-9]{12}\b/,
  // UnionPay (16-19 digits, BIN 62)
  /\b62[0-9]{14,17}\b/,
];

function luhnCheck(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  let sum = 0;
  let isEven = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i]!, 10);
    if (isEven) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    isEven = !isEven;
  }
  return sum % 10 === 0 && digits.length >= 13;
}

export function inferBoundaryEgressFlagsFromPayload(payload: string): BoundaryActionRequest["flags"] {
  // Lane A — structural generators: regex catches candidates, generator confirms validity
  let hasPii = EGRESS_PII_PATTERNS.some((p) => p.test(payload));
  if (!hasPii) {
    // IPv4 byte-boundary: 256.0.0.0 fails, 255.255.255.255 passes
    const ipv4Candidates = [...payload.matchAll(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g)];
    hasPii = ipv4Candidates.some((m) => isValidIpv4Structural(m[0]));
  }
  if (!hasPii) {
    // IBAN MOD-97: structurally invalid IBANs are not real PII
    const ibanCandidates = [...payload.matchAll(/\b[A-Z]{2}\d{2}[A-Z0-9]{4,30}\b/g)];
    hasPii = ibanCandidates.some((m) => ibanMod97Check(m[0]));
  }

  // Lane B — credential patterns + structural entropy check
  let hasCredential = EGRESS_CREDENTIAL_PATTERNS.some((p) => p.test(payload));
  if (!hasCredential) {
    // Bearer token: high-entropy suffix confirms it is not hallucinated test data
    const bearerMatch = /\bBearer\s+([A-Za-z0-9+/=_\-]{32,})/i.exec(payload);
    hasCredential = bearerMatch?.[1] ? isHighEntropyToken(bearerMatch[1]) : false;
  }

  // Financial: Luhn on card pattern candidates
  const financialCardMatch = EGRESS_FINANCIAL_PATTERNS.reduce<RegExpExecArray | null>(
    (found, p) => found ?? p.exec(payload),
    null,
  );
  let hasFinancial = financialCardMatch ? luhnCheck(financialCardMatch[0]) : false;
  if (!hasFinancial) {
    // ABA routing number: 9-digit weighted checksum (3-7-1 mod 10)
    const abaCandidates = [...payload.matchAll(/\b(\d{9})\b/g)];
    hasFinancial = abaCandidates.some((m) => abaRoutingCheck(m[1] ?? ""));
  }

  return {
    payloadContainsPii: hasPii || undefined,
    payloadContainsCredential: hasCredential || undefined,
    payloadContainsFinancialData: hasFinancial || undefined,
  };
}

function extractYears(text: string | undefined): number[] {
  if (!text) {
    return [];
  }
  return [...text.matchAll(/\b(19|20)\d{2}\b/g)].map((match) => Number(match[0]));
}

function extractBlockedDecades(text: string | undefined): number[] {
  if (!text) {
    return [];
  }
  const matches = [...text.matchAll(/\b((?:19|20)\d)0s\b/g)];
  return matches.map((match) => Number(`${match[1]}0`));
}

function inferBoundaryChatConstraintSignals(args: {
  userInput?: string;
  attemptedOutput: string;
}): {
  flags: BoundaryActionRequest["flags"];
  evidence: string[];
  invariantLabel?: string;
} {
  const userInput = args.userInput ?? "";
  const attemptedOutput = args.attemptedOutput;
  const userYears = extractYears(userInput);
  const outputYears = extractYears(attemptedOutput);
  const blockedDecades = extractBlockedDecades(userInput);
  const hasOnlyConstraint = /\bonly\b/i.test(userInput);
  const hasNegativeConstraint = /\b(do not|don't|not from|no|exclude|without)\b/i.test(userInput);

  const outputViolatesExplicitYearOnly =
    hasOnlyConstraint &&
    userYears.length > 0 &&
    outputYears.length > 0 &&
    outputYears.some((year) => !userYears.includes(year));

  const outputViolatesBlockedDecade =
    blockedDecades.length > 0 &&
    outputYears.some((year) => blockedDecades.includes(Math.floor(year / 10) * 10));

  if (!outputViolatesExplicitYearOnly && !outputViolatesBlockedDecade) {
    return {
      flags: {},
      evidence: [],
    };
  }

  const evidence: string[] = [];
  if (userYears.length > 0 && (hasOnlyConstraint || hasNegativeConstraint)) {
    evidence.push(`User constrained the answer to ${userYears.join(", ")}.`);
  }
  if (blockedDecades.length > 0) {
    evidence.push(`User excluded material from the ${blockedDecades.map((decade) => `${decade}s`).join(", ")}.`);
  }
  if (outputYears.length > 0) {
    evidence.push(`Attempted output references ${outputYears.join(", ")}.`);
  }

  return {
    flags: {
      violatesUserConstraint: true,
      groundingMismatch: true,
    },
    evidence,
    invariantLabel: "Output conflicts with the user time constraint.",
  };
}

function mergeEvidenceLines(...groups: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const group of groups) {
    for (const line of group ?? []) {
      if (seen.has(line)) {
        continue;
      }
      seen.add(line);
      merged.push(line);
    }
  }
  return merged;
}

function summarizeChatEmission(args: {
  attemptedOutput: string;
  invariantLawId?: string;
  evidence?: string[];
}): string {
  const preview = args.attemptedOutput.replace(/\s+/g, " ").trim().slice(0, 160);
  const prefix = args.invariantLawId ? `${args.invariantLawId} :: ` : "";
  const evidence = args.evidence?.[0] ? ` :: ${args.evidence[0]}` : "";
  return `${prefix}${preview}${evidence}`;
}

export function createBoundaryChatEmissionRequest(args: {
  config: BoundaryRuntimeConfig;
  target?: string;
  userInput?: string;
  attemptedOutput: string;
  invariantLawId?: string;
  invariantLabel?: string;
  actorLabel?: string;
  evidence?: string[];
  provenance?: BoundaryRequestProvenance;
  flags?: BoundaryActionRequest["flags"];
}): BoundaryActionRequest {
  const inferredConstraintSignals = inferBoundaryChatConstraintSignals({
    userInput: args.userInput,
    attemptedOutput: args.attemptedOutput,
  });
  const inferredOutputFlags = inferBoundaryChatFlagsFromOutput(args.attemptedOutput);
  const mergedEvidence = mergeEvidenceLines(inferredConstraintSignals.evidence, args.evidence);

  return createBoundaryActionRequest({
    config: args.config,
    actionKind: "chat.emit",
    target: args.target ?? "chat:primary",
    payloadSummary: summarizeChatEmission({
      attemptedOutput: args.attemptedOutput,
      invariantLawId: args.invariantLawId,
      evidence: args.evidence,
    }),
    provenance: args.provenance ?? "agent_inference",
    flags: {
      ...inferredOutputFlags,
      ...inferredConstraintSignals.flags,
      ...args.flags,
    },
    reviewContext: {
      surface: "chat",
      actorLabel: args.actorLabel,
      invariantLawId: args.invariantLawId,
      invariantLabel: args.invariantLabel ?? inferredConstraintSignals.invariantLabel,
      userInput: args.userInput,
      attemptedOutput: args.attemptedOutput,
      evidence: mergedEvidence,
    },
  });
}

export async function guardBoundaryChatEmission<T = string>(args: {
  config: BoundaryRuntimeConfig;
  proposal: BoundaryChatEmissionProposal<T>;
}): Promise<BoundaryExecutionResult<T>> {
  return runBoundaryControlledAction({
    config: enableBodyguardControl(args.config),
    request: createBoundaryChatEmissionRequest({
      config: args.config,
      target: args.proposal.target,
      userInput: args.proposal.userInput,
      attemptedOutput: args.proposal.attemptedOutput,
      invariantLawId: args.proposal.invariantLawId,
      invariantLabel: args.proposal.invariantLabel,
      evidence: args.proposal.evidence,
      provenance: args.proposal.provenance,
      flags: args.proposal.flags,
    }),
    execute: args.proposal.execute,
    successReason: args.proposal.successReason ?? "chat emission admitted by bodyguard",
    dryRunPreviewReason: args.proposal.dryRunPreviewReason,
    successMetadata: args.proposal.successMetadata,
  });
}

export async function runBoundaryControlledAction<T>(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  execute?: () => Promise<T>;
  successReason: string;
  dryRunPreviewReason?: string;
  successMetadata?: Record<string, string | number | boolean>;
}): Promise<BoundaryExecutionResult<T>> {
  let activeConfig = args.config;
  let activeRequest = args.request;

  // Governor pre-check — runs before any law evaluation or ledger entry.
  // If the session has exceeded a kinetic limit (velocity/density/mass), the
  // action is denied immediately without reaching the law engine.
  if (activeConfig.governorConfig) {
    const govState = activeConfig.governorState ?? initialGovernorState();
    const govResult = evaluateBoundaryGovernor({
      config: activeConfig.governorConfig,
      state: govState,
      request: activeRequest,
      nowMs: Date.now(),
    });
    if (govResult.tripped) {
      await appendBoundaryLedger("GOVERNOR_TRIP", {
        sessionId: activeConfig.session.sessionId,
        actorId: activeConfig.session.actorId,
        requestId: activeRequest.requestId,
        actionKind: activeRequest.actionKind,
        target: activeRequest.target,
        decision: "deny",
        reason: govResult.reason,
        lawIds: [govResult.lawId],
        createdAt: new Date().toISOString(),
      });
      return {
        config: activeConfig,
        allowed: false,
        executed: false,
        requiresApproval: false,
        reason: govResult.reason,
        nslMoves: [{
          moveId: randomUUID(),
          kind: "deny_and_explain",
          title: "Boundary governor tripped",
          description: govResult.reason,
        }],
      };
    }
  }

  await logProposedAction(activeConfig, activeRequest);
  let adjudication = await adjudicateBoundaryRequest({
    config: activeConfig,
    request: activeRequest,
  });
  activeConfig = adjudication.config;
  activeRequest = adjudication.request;

  // Record the boundary crossing in governor state after the first adjudication.
  // wasLawful = true if the decision is allow or require_approval (the action is
  // not denied outright by law); false if denied — this feeds the density window.
  if (activeConfig.governorConfig) {
    const updatedGovState = recordGovernorCrossing({
      state: activeConfig.governorState ?? initialGovernorState(),
      config: activeConfig.governorConfig,
      actionKind: activeRequest.actionKind,
      wasLawful: adjudication.result.decision !== "deny",
      nowMs: Date.now(),
    });
    activeConfig = { ...activeConfig, governorState: updatedGovState };
  }

  await logDecisionReturned(
    activeConfig,
    activeRequest,
    adjudication.result.reason,
    adjudication.result.decision,
    adjudication.result.triggeredLawIds,
  );

  if (adjudication.result.decision === "deny") {
    await logBlockedAction(
      activeConfig,
      activeRequest,
      adjudication.result.reason,
      adjudication.result.triggeredLawIds,
    );

    for (const move of adjudication.nslMoves) {
      await appendBoundaryLedger("NSL_MOVE_SUGGESTED", {
        sessionId: activeConfig.session.sessionId,
        actorId: activeConfig.session.actorId,
        requestId: activeRequest.requestId,
        actionKind: activeRequest.actionKind,
        target: activeRequest.target,
        moveId: move.moveId,
        decision: adjudication.result.decision,
        reason: move.description,
        lawIds: adjudication.result.triggeredLawIds,
        createdAt: new Date().toISOString(),
      });
    }

    return {
      config: activeConfig,
      allowed: false,
      executed: false,
      requiresApproval: false,
      reason: adjudication.result.reason,
      nslMoves: adjudication.nslMoves,
    };
  }

  while (adjudication.result.decision === "require_approval") {
    const approvalResult = await requestApproval(
      activeConfig,
      {
        session: activeConfig.session,
        request: activeRequest,
        reason: adjudication.result.reason,
        lawIds: adjudication.result.triggeredLawIds,
        nslMoves: adjudication.nslMoves,
        prompt: buildBoundaryApprovalPrompt({
          request: activeRequest,
          reason: adjudication.result.reason,
          lawIds: adjudication.result.triggeredLawIds,
        }),
      },
      adjudication.result.triggeredLawIds,
    );
    activeConfig = await recordBodyguardUserLawDecision({
      config: activeConfig,
      request: activeRequest,
      witness: approvalResult.witnessRecord,
      decision: approvalResult.decision,
    });

    if (!approvalResult.approved) {
      if (adjudication.grantOffer) {
        await adjudication.grantOffer.denyGrant();
      }
      await logBlockedAction(
        activeConfig,
        activeRequest,
        adjudication.result.reason,
        adjudication.result.triggeredLawIds,
      );
      return {
        config: activeConfig,
        allowed: false,
        executed: false,
        requiresApproval: true,
        reason: adjudication.result.reason,
        nslMoves: adjudication.nslMoves,
      };
    }

    if (adjudication.grantOffer) {
      const replayApproval: BoundaryApprovalRequest = {
        session: activeConfig.session,
        request: activeRequest,
        reason: adjudication.result.reason,
        lawIds: adjudication.result.triggeredLawIds,
        nslMoves: adjudication.nslMoves,
        prompt: buildBoundaryApprovalPrompt({
          request: activeRequest,
          reason: adjudication.result.reason,
          lawIds: adjudication.result.triggeredLawIds,
        }),
      };
      const replay = await adjudication.grantOffer.applyGrant({
        ...replayApproval,
      });
      activeConfig = replay.config;
      activeRequest = replay.request;
      await appendBoundaryLedger("PROPOSAL_REPLAYED", {
        sessionId: activeConfig.session.sessionId,
        actorId: activeConfig.session.actorId,
        requestId: activeRequest.requestId,
        actionKind: activeRequest.actionKind,
        target: activeRequest.target,
        reason: "proposal replayed after user approval changed standing law",
        lawIds: adjudication.result.triggeredLawIds,
        createdAt: new Date().toISOString(),
      });
      adjudication = await adjudicateBoundaryRequest({
        config: activeConfig,
        request: activeRequest,
      });
      activeConfig = adjudication.config;
      activeRequest = adjudication.request;
      await logDecisionReturned(
        activeConfig,
        activeRequest,
        adjudication.result.reason,
        adjudication.result.decision,
        adjudication.result.triggeredLawIds,
      );
      if (adjudication.result.decision === "deny") {
        await logBlockedAction(
          activeConfig,
          activeRequest,
          adjudication.result.reason,
          adjudication.result.triggeredLawIds,
        );
        return {
          config: activeConfig,
          allowed: false,
          executed: false,
          requiresApproval: false,
          reason: adjudication.result.reason,
          nslMoves: adjudication.nslMoves,
        };
      }
      continue;
    }

    adjudication = await adjudicateBoundaryRequest({
      config: activeConfig,
      request: activeRequest,
    });
    activeConfig = adjudication.config;
    activeRequest = adjudication.request;
    await logDecisionReturned(
      activeConfig,
      activeRequest,
      adjudication.result.reason,
      adjudication.result.decision,
      adjudication.result.triggeredLawIds,
    );
    if (adjudication.result.decision === "deny") {
      await logBlockedAction(
        activeConfig,
        activeRequest,
        adjudication.result.reason,
        adjudication.result.triggeredLawIds,
      );
      return {
        config: activeConfig,
        allowed: false,
        executed: false,
        requiresApproval: false,
        reason: adjudication.result.reason,
        nslMoves: adjudication.nslMoves,
      };
    }
  }

  if (!args.execute) {
    return {
      config: activeConfig,
      allowed: true,
      executed: false,
      requiresApproval: adjudication.result.requiresApproval,
      reason: args.successReason,
      nslMoves: adjudication.nslMoves,
    };
  }

  const isMutatingAction = activeRequest.actionKind !== "fs.read";
  if (activeConfig.session.dryRun && isMutatingAction) {
    const reason =
      args.dryRunPreviewReason ?? "session is in dry-run mode; action previewed but not executed";
    await logExecutedAction(activeConfig, activeRequest, reason, { dry_run: true });
    return {
      config: activeConfig,
      allowed: true,
      executed: false,
      requiresApproval: adjudication.result.requiresApproval,
      reason,
      nslMoves: adjudication.nslMoves,
    };
  }

  const value = await args.execute();
  await logExecutedAction(activeConfig, activeRequest, args.successReason, args.successMetadata);

  return {
    config: activeConfig,
    allowed: true,
    executed: true,
    requiresApproval: adjudication.result.requiresApproval,
    reason: args.successReason,
    nslMoves: adjudication.nslMoves,
    value,
  };
}

export async function adjudicateHeldBoundaryRequest(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}) {
  return resolveBodyguardHeldRequest(args);
}

export function adjudicateBoundaryAction(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}) {
  return evaluateBodyguardAction(args);
}

export async function adjudicateBoundaryRequest(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}) {
  return adjudicateBodyguardRequest(args);
}

export async function recordBodyguardUserLawDecision(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
  witness: BoundaryLedgerRecord;
  decision: BoundaryApprovalDecision;
}) {
  return applyBodyguardUserLawDecision(args);
}

export function createBoundaryBodyguard(store: BoundaryRuntimeStore) {
  const approvals = createApprovalQueueAdapter();
  const gravityService = createBoundaryGravityService();

  function getGuardedConfig() {
    return enableBodyguardControl(store.getConfig(), {
      approvalHandler: approvals.handler,
      gravityService,
    });
  }

  async function enforceProposal<T>(proposal: BoundaryToolProposal<T>): Promise<BoundaryExecutionResult<T>> {
    const result = await enforceBoundaryProposal({
      config: getGuardedConfig(),
      proposal,
    });
    store.replaceConfig(result.config);
    return result;
  }

  async function emitChat<T = string>(proposal: BoundaryChatEmissionProposal<T>): Promise<BoundaryExecutionResult<T>> {
    const result = await guardBoundaryChatEmission({
      config: getGuardedConfig(),
      proposal,
    });
    store.replaceConfig(result.config);
    return result;
  }

  function wrapTool<TInput, TOutput>(envelope: BoundaryToolEnvelope<TInput, TOutput>) {
    return async (input: TInput) => {
      const result = await wrapBoundaryTool(getGuardedConfig(), envelope)(input);
      store.replaceConfig(result.config);
      return result;
    };
  }

  const gravity = createBoundaryGravityAttachment({
    store,
    approvalHandler: approvals.handler,
  });

  return {
    store,
    approvals,
    gravity,
    enforceProposal,
    wrapTool,
    nemo: {
      enforceProposal,
      wrapTool,
    },
    openaiAgents: {
      enforceProposal,
      wrapTool,
    },
    langgraph: {
      enforceProposal,
      wrapNode: wrapTool,
    },
    chat: {
      emit: emitChat,
    },
    telegram: {
      buildProposal: buildTelegramBoundaryProposal,
      enforceProposal,
      approvals,
    },
  };
}
