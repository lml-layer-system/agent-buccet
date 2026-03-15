import type { InfiniteContextState } from "./infinite-context";
import type { PendingLawProposal } from "./meta-delivery";

export type FailureLearningResult = {
  proposedLaws: PendingLawProposal[];
  signature: string;
};

export function deriveFailureLearningProposals(args: {
  userMessage: string;
  abilityRoute: string;
  finalAction: "success" | "refusal";
  reason: string;
  failureClasses: string[];
  triggeredRepairs: string[];
  state: InfiniteContextState;
}): FailureLearningResult {
  const signature = buildFailureSignature(args.userMessage, args.reason, args.failureClasses);
  const domainScope = args.abilityRoute.startsWith("coding.") ? "coding" : "global";
  const proposals: PendingLawProposal[] = [];

  if (args.failureClasses.length > 0 || args.triggeredRepairs.length > 0 || args.finalAction === "refusal") {
    proposals.push({
      text: `Debugging must remain visible as a lawful process for failure signature ${signature}, with branch, tree, repair, and outcome legibility preserved.`,
      scope: "meta",
      enforcement: "meta_failure_learning_debug_visibility",
      source: "meta_failure_learning",
    });
    proposals.push({
      text: `Failure signature ${signature} must map to explicit failure classes ${args.failureClasses.join("|") || "F_UNCERTAIN"} and repairs ${args.triggeredRepairs.join("|") || "none"} so the system hardens structurally after debugging.`,
      scope: "meta",
      enforcement: "meta_failure_learning_repair_binding",
      source: "meta_failure_learning",
    });
    proposals.push({
      text: `NOCR and NSL ledgers must preserve debugging evidence for failure signature ${signature} so every collapse, repair, branch, and null can become inspectable meta law material.`,
      scope: "meta",
      enforcement: "meta_failure_learning_ledger_binding",
      source: "meta_failure_learning",
    });
    proposals.push({
      text: domainScope === "coding"
        ? `Coding debugging for signature ${signature} must create structural hardening laws so repeated generator failures do not recur unchanged.`
        : `General debugging for signature ${signature} must create structural hardening laws so repeated conversational or routing failures do not recur unchanged.`,
      scope: domainScope,
      enforcement: "meta_failure_learning_domain_hardening",
      source: "meta_failure_learning",
    });
  }

  if (isCriticalFailure(args.reason, args.failureClasses)) {
    proposals.push({
      text: `Critical failure signature ${signature} must auto-harden the system before the same structural break repeats.`,
      scope: "meta",
      enforcement: "meta_hardening_critical_failure_learning",
      source: "meta_failure_learning",
    });
  }

  return {
    proposedLaws: dedupeProposals(proposals),
    signature,
  };
}

function buildFailureSignature(userMessage: string, reason: string, failureClasses: string[]): string {
  const normalized = `${userMessage} ${reason} ${failureClasses.join(" ")}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length >= 4)
    .slice(0, 8)
    .join("_");
  return normalized || "generic_failure_signature";
}

function isCriticalFailure(reason: string, failureClasses: string[]): boolean {
  const lower = `${reason} ${failureClasses.join(" ")}`.toLowerCase();
  return /\b(nocr|nsl|parity|root|parent|lock|life|integrity|null|under_enumerated)\b/.test(lower);
}

function dedupeProposals(items: PendingLawProposal[]): PendingLawProposal[] {
  const byKey = new Map<string, PendingLawProposal>();
  for (const item of items) {
    byKey.set(`${item.text.toLowerCase()}|${item.scope}|${item.enforcement}|${item.source}`, item);
  }
  return Array.from(byKey.values());
}
