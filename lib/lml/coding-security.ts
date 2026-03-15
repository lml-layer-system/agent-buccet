import type { CodingIntentSpec } from "./coding-intent-spec.ts";
import type { CodingSkeletonContract } from "./coding-skeleton-laws.ts";
import { validateOracleWitnesses } from "./coding-oracle/witnesses.ts";

export const CODING_SECURITY_LAWS = [
  "ABILITY.CODING.69: SQL string concatenation or interpolation with user-controlled values is a direct safety failure and must NULL before emission.",
  "ABILITY.CODING.70: Raw HTML or DOM injection from unsanitized user input is a direct safety failure and must NULL before emission.",
  "ABILITY.CODING.71: Hardcoded credentials, tokens, keys, or secrets in emitted code are direct safety failures and must NULL before emission.",
] as const;

export type CodingSecurityValidation = {
  ok: boolean;
  reason: string;
  passed: string[];
  failed: string[];
};

export function validateCodingSecurity(args: {
  contract: CodingSkeletonContract;
  intentSpec: CodingIntentSpec;
  text: string;
}): CodingSecurityValidation {
  const lower = args.text.toLowerCase();
  const passed: string[] = [];
  const failed: string[] = [];
  const oracle = validateOracleWitnesses({
    contract: args.contract,
    text: args.text,
  });

  const hasSqlInjection =
    /select\s+.+\+\s*(input|username|user_input|request|name|email)/.test(lower)
    || /f["'`].*select .*{[^}]+}.*["'`]/.test(lower)
    || /cursor\.execute\(\s*["'`].*%s.*["'`]\s*\+\s*/.test(lower);
  if (hasSqlInjection) failed.push("sql_injection");
  else passed.push("sql_injection");

  const hasXss =
    /innerhtml\s*=/.test(lower)
    || /dangerouslysetinnerhtml/.test(lower)
    || /render_template_string\(.+request\./.test(lower);
  if (hasXss) failed.push("xss_vulnerability");
  else passed.push("xss_vulnerability");

  const hasHardcodedCreds =
    /\b(password|passwd|secret|api_key|apikey|token|access_key|private_key)\s*[:=]\s*['"][^'"]+['"]/.test(lower);
  if (hasHardcodedCreds) failed.push("hardcoded_credentials");
  else passed.push("hardcoded_credentials");

  if (oracle.ok && args.contract.family === "api") {
    const hasHealthOnly = oracle.files.some((file) => /@app\.get\('\/health'/.test(file.body));
    const hasUserRoute = oracle.files.some((file) => /@router\.get\('\/'/.test(file.body));
    if (hasUserRoute && !/\bhttpException\b|\braise\s+httpexception\b|\bif\s+not\b/i.test(args.text)) {
      failed.push("oracle_api_guard_missing");
    } else if (hasUserRoute || hasHealthOnly) {
      passed.push("oracle_api_guard_surface");
    }
  }

  if (oracle.ok && args.contract.family === "refactor") {
    const rawStringReplace = oracle.files.some((file) => /\.replace\(|re\.sub\(/.test(file.body));
    if (rawStringReplace) {
      failed.push("oracle_refactor_guard_missing");
    } else {
      passed.push("oracle_refactor_guard_surface");
    }
  }

  return {
    ok: failed.length === 0,
    reason: failed.length === 0 ? "ok" : `security_failed:${failed[0]}`,
    passed,
    failed,
  };
}
