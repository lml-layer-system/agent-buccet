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
  /\boverride (the )?(rules|laws|guardrails|system prompt)\b/i,
  /\bself-approve\b/i,
  /\bauthorize yourself\b/i,
  /\bbypass (the )?(approval|boundary|guardrails|laws)\b/i,
  /\bdeveloper mode\b/i,
  /\bdev(?:eloper)? mode\b/i,
  /\bdo anything now\b/i,
  /\bdan\b/i,
  /\bgrandma exploit\b/i,
  /\bsystem override\b/i,
  /\broot override\b/i,
  /\badmin override\b/i,
];

const SCOPE_EXPANSION_PATTERNS = [
  /\bopen path\b/i,
  /\bgrant access\b/i,
  /\ballow .*outside\b/i,
  /\bexpand scope\b/i,
  /\bopen (the )?(whole|entire) (machine|filesystem|repo)\b/i,
  /\ball files? (are|should be) (now )?(accessible|in scope)\b/i,
  /\bbroad access\b/i,
  /\boutside the workspace\b/i,
  /\bdrop the sandbox\b/i,
];

const LAW_MUTATION_PATTERNS = [
  /\bdisable (the )?(laws|guardrails|boundary)\b/i,
  /\bremove (the )?(restrictions|guardrails)\b/i,
  /\bchange (the )?(policy|law)\b/i,
  /\bjailbreak\b/i,
  /\bprompt injection\b/i,
  /\bindirect prompt injection\b/i,
  /\bcontext window injection\b/i,
  /\bhidden instruction\b/i,
  /\bbase64(?: encoding)? bypass\b/i,
  /\brot13\b/i,
  /\bhashjack\b/i,
  /\bunsigned update\b/i,
  /\blawpack update\b/i,
  /\boverride the system prompt\b/i,
];

const SESSION_REVIVAL_PATTERNS = [
  /\breopen session\b/i,
  /\bresume old session\b/i,
  /\brestore deleted grant\b/i,
  /\breactivate access\b/i,
  /\bresume previous access\b/i,
  /\brevive the old session\b/i,
];

const LEDGER_BYPASS_PATTERNS = [
  /\bdon't log\b/i,
  /\bdo not log\b/i,
  /\bskip (the )?ledger\b/i,
  /\bwithout audit\b/i,
  /\bwithout logging\b/i,
  /\bhide (this|the action)\b/i,
  /\bdelete (the )?logs\b/i,
  /\baudit invalidation\b/i,
  /\bforged? receipt\b/i,
  /\bhistory forgery\b/i,
  /\bprefill\/history-f(?:orgery|ake)\b/i,
  /\bwithout proof\b/i,
  /\bno proof\b/i,
  /\bhide from witness\b/i,
];

export function inferBoundaryMetaFlagsFromText(text: string): {
  authorityClaimed?: boolean;
  claimsCompleteCoverage?: boolean;
  requestsScopeExpansion?: boolean;
  requestsLawMutation?: boolean;
  requestsSessionRevival?: boolean;
  requestsLedgerBypass?: boolean;
} {
  return {
    authorityClaimed: AUTHORITY_PATTERNS.some((pattern) => pattern.test(text)) || undefined,
    claimsCompleteCoverage:
      COMPLETE_COVERAGE_PATTERNS.some((pattern) => pattern.test(text)) || undefined,
    requestsScopeExpansion:
      SCOPE_EXPANSION_PATTERNS.some((pattern) => pattern.test(text)) || undefined,
    requestsLawMutation: LAW_MUTATION_PATTERNS.some((pattern) => pattern.test(text)) || undefined,
    requestsSessionRevival:
      SESSION_REVIVAL_PATTERNS.some((pattern) => pattern.test(text)) || undefined,
    requestsLedgerBypass: LEDGER_BYPASS_PATTERNS.some((pattern) => pattern.test(text)) || undefined,
  };
}
