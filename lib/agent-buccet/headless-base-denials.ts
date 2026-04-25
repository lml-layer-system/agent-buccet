import { createHash } from "node:crypto";
import {
  AGENT_BUCCET_META_EXCLUDED_SELF_UPDATING_LAW_IDS,
  AGENT_BUCCET_META_LAW_REFERENCES,
} from "./meta.ts";
import {
  BOUNDARY_PERIODIC_FAILURE_DIMENSIONS,
  BOUNDARY_PERIODIC_FAILURE_ROWS,
} from "./periodic-failure-taxonomy.ts";
import {
  BASE_BUCCET_FRONTIER_FAILURE_ALIASES,
} from "./frontier-failure-aliases.ts";
import {
  BOUNDARY_BUCCET_CONTAINMENT_LAWS,
  BOUNDARY_BUCCET_FAILURE_DIMENSIONS,
  BOUNDARY_BUCCET_FAILURE_ROWS,
} from "./buccet-failure-catalog.ts";
import {
  BOUNDARY_BUCCET_LAW_BODY_DENIAL_ROWS,
} from "./buccet-law-body-denial-catalog.ts";
import type {
  BoundaryActionFlagName,
  BoundaryActionKind,
  BoundarySpendCommitIntent,
  BoundarySpendDestinationKind,
  BoundarySpendIntent,
  BoundarySpendSourceAuthorityKind,
  BoundaryUplEntry,
  BoundaryUserPathLedger,
} from "./types.ts";

export type HeadlessDecision = "deny" | "no_match";

export type DenialClass =
  | "persistence"
  | "security_weakening"
  | "secret_access"
  | "identity_secrets"
  | "exfiltration"
  | "authority_spoofing"
  | "boundary_attack"
  | "sovereignty_expansion"
  | "periodic_failure_taxonomy"
  | "base_buccet_denial"
  | "buccet_failure_corpus"
  | "buccet_law_body"
  | "sensitive_data_egress"
  | "privilege_escalation"
  | "stealth_evasion"
  | "stealth_browser"
  | "propagation"
  | "law_witness_tamper"
  | "destructive_mass_mutation"
  | "sensitive_capture"
  | "system_mutation"
  | "external_communication"
  | "unsafe_external_communication"
  | "agent_spend";

export interface HeadlessActionRequest {
  actionKind: string;
  operation?: string;
  target?: string;
  command?: string;
  destination?: string;
  recipient?: string;
  spendIntent?: BoundarySpendIntent;
  flags?: Partial<Record<BoundaryActionFlagName, boolean | undefined>>;
  metadata?: Record<string, unknown>;
}

export interface HeadlessDenialResult {
  decision: HeadlessDecision;
  denialClass?: DenialClass;
  ruleId?: string;
  reason?: string;
}

type BaseHeadlessDenialSeed = {
  id: string;
  denialClass: DenialClass;
  reason: string;
  actionKinds: BoundaryActionKind[];
  targetPatterns?: string[];
  requestTextPatterns?: string[];
  requiredFlags?: BoundaryActionFlagName[];
  requestBasisTarget: string;
  spendAllowedDestinationKinds?: BoundarySpendDestinationKind[];
  spendAllowedSourceAuthorityKinds?: BoundarySpendSourceAuthorityKind[];
  spendAllowedCommitIntents?: BoundarySpendCommitIntent[];
};

const BASE_WITNESS_ID = "BUCCET.HEADLESS.BASE.DENIALS.V1";
const BASE_CREATED_AT = "2026-03-31T00:00:00.000Z";

const sensitiveCaptureKinds = [
  "camera.capture",
  "microphone.capture",
  "screen.capture",
  "clipboard.read",
  "browser.session.read",
] as unknown as BoundaryActionKind[];

const externalCommKinds = [
  "email.send",
  "message.send",
] as unknown as BoundaryActionKind[];

const allTrackSurfaceKinds: BoundaryActionKind[] = [
  "fs.read",
  "fs.write",
  "fs.append",
  "fs.delete",
  "fs.mkdir",
  "fs.move",
  "agent.spend",
  "tool.exec",
  "network.send",
  "comm.send",
  "db.query",
  "db.insert",
  "db.update",
  "db.delete",
  "sys.env.read",
  "sys.env.write",
  "sys.config.read",
  "sys.config.write",
  "sys.credential.read",
  "sys.credential.use",
  "chat.emit",
];

function globToRegexLiteral(pattern: string): string {
  const escaped = pattern
    .replaceAll(/[|\\{}()[\]^$+?.]/g, "\\$&")
    .replaceAll("*", ".*");
  return `/^${escaped}$/i`;
}

function toRegexList(patterns: readonly string[]): string[] {
  return patterns.map(globToRegexLiteral);
}

function containsGlobToRegexLiteral(pattern: string): string {
  const escaped = pattern
    .replaceAll(/[|\\{}()[\]^$+?.]/g, "\\$&")
    .replaceAll("*", ".*");
  return `/${escaped}/i`;
}

function toContainsRegexList(patterns: readonly string[]): string[] {
  return patterns.map(containsGlobToRegexLiteral);
}

function hashBaseRuleId(id: string): string {
  return createHash("sha256").update(id).digest("hex");
}

function buildBasisPath(seed: BaseHeadlessDenialSeed): string {
  return `${seed.actionKinds[0] ?? "unknown"} ${seed.requestBasisTarget}`;
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function toCatalogRequestTextPatterns(values: readonly (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of values) {
    const value = collapseWhitespace(raw ?? "")
      .replaceAll("`", "")
      .replaceAll("\"", "")
      .trim();
    if (value.length < 4) {
      continue;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(`*${value}*`);
  }

  return toContainsRegexList(normalized);
}

const EXCLUDED_META_LAW_IDS = new Set<number>([
  164,
  ...AGENT_BUCCET_META_EXCLUDED_SELF_UPDATING_LAW_IDS,
]);

function isVendoredMetaLawReferenceAllowed(ref: (typeof AGENT_BUCCET_META_LAW_REFERENCES)[number]): boolean {
  if (EXCLUDED_META_LAW_IDS.has(ref.lawId)) {
    return false;
  }

  const lowered = `${ref.name} ${ref.category} ${ref.source}`.toLowerCase();
  return !(
    lowered.includes("novelty") ||
    lowered.includes("autonomous") ||
    lowered.includes("self-continuation") ||
    lowered.includes("self_extending") ||
    lowered.includes("self-extending") ||
    lowered.includes("strict improvement after shock") ||
    lowered.includes("future_mutation_detection") ||
    lowered.includes("adaptive_law_emergence") ||
    lowered.includes("no_repeat_without_coverage") ||
    lowered.includes("reproduction/self-continuation") ||
    lowered.includes("offensive cyber") ||
    lowered.includes("offensive payload") ||
    lowered.includes("defensive mastery flips to offensive")
  );
}

function createPeriodicDimensionSeeds(): BaseHeadlessDenialSeed[] {
  return BOUNDARY_PERIODIC_FAILURE_DIMENSIONS.map((dimension) => ({
    id: `DENY.PERIODIC.${dimension.id}`,
    denialClass: "periodic_failure_taxonomy",
    reason: `[dimension:${dimension.name}] ${dimension.description}`,
    actionKinds: allTrackSurfaceKinds,
    requestTextPatterns: toCatalogRequestTextPatterns([
      dimension.id,
      `${dimension.name} failures`,
      dimension.description,
    ]),
    requestBasisTarget: `base-headless-denials:periodic-dimension:${dimension.id.toLowerCase()}`,
  }));
}

function createPeriodicFailureSeeds(): BaseHeadlessDenialSeed[] {
  return BOUNDARY_PERIODIC_FAILURE_ROWS.map((row) => ({
    id: `DENY.PERIODIC.${row.id}`,
    denialClass: "periodic_failure_taxonomy",
    reason: `[${row.dimension}] ${row.title} — ${row.forbidden}`,
    actionKinds: allTrackSurfaceKinds,
    requestTextPatterns: toCatalogRequestTextPatterns([
      row.id,
      row.title,
    ]),
    requestBasisTarget: `base-headless-denials:periodic:${row.id.toLowerCase()}`,
  }));
}

function createVendoredBaseCatalogSeeds(): BaseHeadlessDenialSeed[] {
  return AGENT_BUCCET_META_LAW_REFERENCES
    .filter(isVendoredMetaLawReferenceAllowed)
    .map((ref) => ({
      id: `DENY.BASE.CATALOG.${String(ref.lawId).padStart(4, "0")}`,
      denialClass: "base_buccet_denial",
      reason: `[${ref.category}] ${ref.name}`,
      actionKinds: allTrackSurfaceKinds,
      requestTextPatterns: toCatalogRequestTextPatterns([
        `LAW ${ref.lawId}`,
        ref.name,
        ref.category,
      ]),
      requestBasisTarget: `base-headless-denials:base-catalog:${String(ref.lawId).padStart(4, "0")}`,
    }));
}

function createFrontierFailureAliasSeeds(): BaseHeadlessDenialSeed[] {
  return BASE_BUCCET_FRONTIER_FAILURE_ALIASES.map((alias, index) => ({
    id: `DENY.BASE.ALIAS.${String(index + 1).padStart(4, "0")}`,
    denialClass: "base_buccet_denial",
    reason: `[${alias.source}] ${alias.title}`,
    actionKinds: allTrackSurfaceKinds,
    requestTextPatterns: toCatalogRequestTextPatterns(alias.variants),
    requestBasisTarget: `base-headless-denials:base-alias:${String(index + 1).padStart(4, "0")}`,
  }));
}

function createBuccetFailureDimensionSeeds(): BaseHeadlessDenialSeed[] {
  return BOUNDARY_BUCCET_FAILURE_DIMENSIONS.map((dimension) => ({
    id: `DENY.BUCCET.DIM.${dimension.id}`,
    denialClass: "buccet_failure_corpus",
    reason: `[${dimension.source}] ${dimension.title} — ${dimension.rootInvariant}`,
    actionKinds: allTrackSurfaceKinds,
    requestTextPatterns: toCatalogRequestTextPatterns(dimension.variants),
    requestBasisTarget: `base-headless-denials:buccet-dimension:${dimension.id.toLowerCase()}`,
  }));
}

function createBuccetContainmentLawSeeds(): BaseHeadlessDenialSeed[] {
  return BOUNDARY_BUCCET_CONTAINMENT_LAWS.map((law) => ({
    id: `DENY.BUCCET.LAW.${law.id}`,
    denialClass: "buccet_failure_corpus",
    reason: `[${law.source}] ${law.title} — stops ${law.stopsDimension}`,
    actionKinds: allTrackSurfaceKinds,
    requestTextPatterns: toCatalogRequestTextPatterns(law.variants),
    requestBasisTarget: `base-headless-denials:buccet-law:${law.id.toLowerCase()}`,
  }));
}

function createBuccetFailureRowSeeds(): BaseHeadlessDenialSeed[] {
  return BOUNDARY_BUCCET_FAILURE_ROWS.map((row) => ({
    id: `DENY.BUCCET.FAILURE.${row.id}`,
    denialClass: "buccet_failure_corpus",
    reason: `[${row.source}] ${row.id} ${row.title} — ${row.dimension}`,
    actionKinds: allTrackSurfaceKinds,
    requestTextPatterns: toCatalogRequestTextPatterns([row.variants[0]]),
    requestBasisTarget: `base-headless-denials:buccet-failure:${row.id.toLowerCase()}`,
  }));
}

function createBuccetLawBodySeeds(): BaseHeadlessDenialSeed[] {
  return BOUNDARY_BUCCET_LAW_BODY_DENIAL_ROWS.map((row) => ({
    id: `DENY.BUCCET.BASE.${row.projectedLawId}`,
    denialClass: "buccet_law_body",
    reason: `${row.projectedLawId} — active law-body denial`,
    actionKinds: allTrackSurfaceKinds,
    requestTextPatterns: toCatalogRequestTextPatterns([row.projectedLawId]),
    requestBasisTarget: `base-headless-denials:buccet-base:${row.projectedLawId.toLowerCase()}`,
  }));
}

const BASE_HEADLESS_DENIAL_SEEDS: readonly BaseHeadlessDenialSeed[] = [
  {
    id: "DENY.PERSISTENCE.001A",
    denialClass: "persistence",
    reason: "Silent persistence is forbidden in headless mode.",
    actionKinds: ["fs.write"],
    targetPatterns: toRegexList([
      "*/.bashrc",
      "*/.zshrc",
      "*/.profile",
      "*/rc.local",
      "*/LaunchAgents/*",
      "*/LaunchDaemons/*",
      "*/systemd/*",
      "*/init.d/*",
      "*/cron*",
      "*/crontab*",
      "*/autorun*",
      "*/startup*",
      "*/runonce*",
    ]),
    requestBasisTarget: "base-headless-denials:persistence-paths",
  },
  {
    id: "DENY.PERSISTENCE.001B",
    denialClass: "persistence",
    reason: "Silent persistence is forbidden in headless mode.",
    actionKinds: ["tool.exec"],
    requestTextPatterns: toContainsRegexList([
      "*crontab *",
      "*systemctl enable*",
      "*schtasks*",
      "*reg add*run*",
      "*launchctl load*",
      "*launchctl bootstrap*",
      "*sc create*",
    ]),
    requestBasisTarget: "base-headless-denials:persistence-command",
  },
  {
    id: "DENY.SECURITY.WEAKENING.002A",
    denialClass: "security_weakening",
    reason: "Security control weakening is forbidden in headless mode.",
    actionKinds: ["tool.exec"],
    requestTextPatterns: toContainsRegexList([
      "*ufw disable*",
      "*iptables -f*",
      "*set-mppreference*",
      "*sc stop windefend*",
      "*spctl --master-disable*",
      "*defaults write*gatekeeper*",
      "*disable firewall*",
      "*turn off defender*",
      "*executionpolicy bypass*",
    ]),
    requestBasisTarget: "base-headless-denials:security-weakening-command",
  },
  {
    id: "DENY.SECURITY.WEAKENING.002B",
    denialClass: "security_weakening",
    reason: "Security control weakening is forbidden in headless mode.",
    actionKinds: ["fs.write", "sys.config.write"],
    targetPatterns: toRegexList([
      "*/Windows Defender/*",
      "*/firewall/*",
      "*/security/*",
      "*/Gatekeeper*",
      "*/ExecutionPolicy*",
    ]),
    requestBasisTarget: "base-headless-denials:security-weakening-paths",
  },
  {
    id: "DENY.SECRETS.ACCESS.003A",
    denialClass: "secret_access",
    reason: "Secret or credential access is forbidden without explicit law.",
    actionKinds: ["fs.read", "sys.env.read"],
    targetPatterns: toRegexList([
      "*/.env",
      "*/.ssh",
      "*/.ssh/*",
      "*/.gnupg",
      "*/.gnupg/*",
      "*/.aws",
      "*/.aws/*",
      "*/.config/gcloud",
      "*/.config/gcloud/*",
      "*/.npmrc",
      "*/.pypirc",
      "*/secrets",
      "*/secrets/*",
      "*/credentials",
      "*/credentials/*",
      "*/id_rsa*",
      "*/id_ed25519*",
      "*/keychain*",
      "*/wallet*",
      "*/seed*",
      "*/keystore*",
      "*/cookies*",
      "*/token*",
    ]),
    requestBasisTarget: "base-headless-denials:secrets-paths",
  },
  {
    id: "DENY.SECRETS.ACCESS.003B",
    denialClass: "secret_access",
    reason: "Secret or credential access is forbidden without explicit law.",
    actionKinds: ["tool.exec"],
    requestTextPatterns: toContainsRegexList([
      "*security find-generic-password*",
      "*security find-internet-password*",
      "*pass *",
      "*secret-tool *",
      "*cmdkey *",
      "*vault *",
    ]),
    requestBasisTarget: "base-headless-denials:secrets-command",
  },
  {
    id: "DENY.SECRETS.ACCESS.003C",
    denialClass: "secret_access",
    reason: "Secret or credential access is forbidden without explicit law.",
    actionKinds: ["sys.credential.read", "sys.credential.use"],
    requestBasisTarget: "base-headless-denials:credential-surface",
  },
  {
    id: "DENY.IDENTITY.SECRETS.003D",
    denialClass: "identity_secrets",
    reason: "Identity, session, and secrets-heavy tool surfaces are forbidden without explicit law.",
    actionKinds: ["fs.read", "sys.credential.read", "sys.credential.use"],
    targetPatterns: toRegexList([
      "*/1password*",
      "*/bitwarden*",
      "*/lastpass*",
      "*/vault*",
      "*/session*",
      "*/cookies*",
      "*/oauth*",
      "*/refresh-token*",
    ]),
    requestTextPatterns: toContainsRegexList([
      "*1password*",
      "*bitwarden*",
      "*lastpass*",
      "*vault export*",
      "*session cookie*",
      "*browser cookie*",
      "*oauth token*",
      "*refresh token*",
      "*login token*",
      "*keychain dump*",
    ]),
    requestBasisTarget: "base-headless-denials:identity-secrets",
  },
  {
    id: "DENY.EXFILTRATION.004A",
    denialClass: "exfiltration",
    reason: "Outbound data movement is forbidden without explicit law.",
    actionKinds: ["tool.exec"],
    requestTextPatterns: toContainsRegexList([
      "*curl * --upload-file *",
      "*wget * --post-file=*",
      "*scp *",
      "*rsync *:*",
      "*nc *",
      "*ncat *",
      "*ftp *",
      "*invoke-webrequest* -method post*",
      "*post *",
      "*upload *",
    ]),
    requestBasisTarget: "base-headless-denials:exfil-command",
  },
  {
    id: "DENY.EXFILTRATION.004B",
    denialClass: "exfiltration",
    reason: "Outbound data movement is forbidden without explicit law.",
    actionKinds: ["network.send"],
    targetPatterns: toRegexList([
      "*webhook*",
      "*telegram*",
      "*discord*",
      "*slack*",
      "*smtp*",
      "*ftp://*",
      "*tor*",
    ]),
    requestBasisTarget: "base-headless-denials:exfil-network",
  },
  {
    id: "DENY.AUTHORITY.SPOOFING.004C",
    denialClass: "authority_spoofing",
    reason: "Prompt or model output cannot self-authorize or claim authority.",
    actionKinds: allTrackSurfaceKinds,
    requiredFlags: ["authorityClaimed"],
    requestBasisTarget: "base-headless-denials:authority-claim",
  },
  {
    id: "DENY.AUTHORITY.SPOOFING.004D",
    denialClass: "authority_spoofing",
    reason: "Prompt or model output cannot claim perfect safety or complete coverage.",
    actionKinds: allTrackSurfaceKinds,
    requiredFlags: ["claimsCompleteCoverage"],
    requestBasisTarget: "base-headless-denials:complete-coverage-claim",
  },
  {
    id: "DENY.AUTHORITY.SPOOFING.004E",
    denialClass: "authority_spoofing",
    reason: "Prompt or model output cannot claim the user already approved the action.",
    actionKinds: allTrackSurfaceKinds,
    requiredFlags: ["claimsUserApproval"],
    requestBasisTarget: "base-headless-denials:user-approval-claim",
  },
  {
    id: "DENY.AUTHORITY.SPOOFING.004F",
    denialClass: "authority_spoofing",
    reason: "Prompt or model output cannot claim completion without witness evidence.",
    actionKinds: allTrackSurfaceKinds,
    requiredFlags: ["claimsActionCompletionWithoutWitness"],
    requestBasisTarget: "base-headless-denials:unwitnessed-completion-claim",
  },
  {
    id: "DENY.AUTHORITY.SPOOFING.004J",
    denialClass: "authority_spoofing",
    reason: "Output cannot violate an explicit user constraint.",
    actionKinds: ["chat.emit"],
    requiredFlags: ["violatesUserConstraint"],
    requestBasisTarget: "base-headless-denials:user-constraint-violation",
  },
  {
    id: "DENY.AUTHORITY.SPOOFING.004K",
    denialClass: "authority_spoofing",
    reason: "Output cannot conflict with grounding or supporting evidence.",
    actionKinds: ["chat.emit"],
    requiredFlags: ["groundingMismatch"],
    requestBasisTarget: "base-headless-denials:grounding-mismatch",
  },
  {
    id: "DENY.BOUNDARY.SCOPE.004L",
    denialClass: "boundary_attack",
    reason: "Prompt or output cannot widen reachable scope by itself.",
    actionKinds: allTrackSurfaceKinds,
    requiredFlags: ["requestsScopeExpansion"],
    requestBasisTarget: "base-headless-denials:scope-expansion",
  },
  {
    id: "DENY.BOUNDARY.LAW.004M",
    denialClass: "boundary_attack",
    reason: "Prompt or output cannot mutate law, guardrails, or boundary policy.",
    actionKinds: allTrackSurfaceKinds,
    requiredFlags: ["requestsLawMutation"],
    requestBasisTarget: "base-headless-denials:law-mutation",
  },
  {
    id: "DENY.BOUNDARY.SESSION.004N",
    denialClass: "boundary_attack",
    reason: "Prompt or output cannot revive prior sessions or dead grants.",
    actionKinds: allTrackSurfaceKinds,
    requiredFlags: ["requestsSessionRevival"],
    requestBasisTarget: "base-headless-denials:session-revival",
  },
  {
    id: "DENY.BOUNDARY.LEDGER.004O",
    denialClass: "boundary_attack",
    reason: "Prompt or output cannot bypass witness, proof, receipt, or ledger requirements.",
    actionKinds: allTrackSurfaceKinds,
    requiredFlags: ["requestsLedgerBypass"],
    requestBasisTarget: "base-headless-denials:ledger-bypass",
  },
  {
    id: "DENY.SOVEREIGNTY.EXPANSION.004P",
    denialClass: "sovereignty_expansion",
    reason: "Broad sovereignty-expanding power is forbidden without explicit law.",
    actionKinds: allTrackSurfaceKinds,
    requestTextPatterns: toContainsRegexList([
      "*full machine control*",
      "*all permissions*",
      "*unlimited access*",
      "*self-authorize*",
      "*override buccet*",
      "*become root authority*",
      "*autonomous admin*",
      "*take over account*",
      "*persistent fleet control*",
      "*global access*",
      "*own the whole machine*",
    ]),
    requestBasisTarget: "base-headless-denials:sovereignty-expansion",
  },
  {
    id: "DENY.SENSITIVE.EGRESS.004G",
    denialClass: "sensitive_data_egress",
    reason: "Outbound PII is forbidden without explicit law.",
    actionKinds: ["chat.emit", "network.send", "comm.send"],
    requiredFlags: ["payloadContainsPii"],
    requestBasisTarget: "base-headless-denials:sensitive-egress-pii",
  },
  {
    id: "DENY.SENSITIVE.EGRESS.004H",
    denialClass: "sensitive_data_egress",
    reason: "Outbound credentials or secrets are forbidden without explicit law.",
    actionKinds: ["chat.emit", "network.send", "comm.send"],
    requiredFlags: ["payloadContainsCredential"],
    requestBasisTarget: "base-headless-denials:sensitive-egress-credential",
  },
  {
    id: "DENY.SENSITIVE.EGRESS.004I",
    denialClass: "sensitive_data_egress",
    reason: "Outbound financial data is forbidden without explicit law.",
    actionKinds: ["chat.emit", "network.send", "comm.send"],
    requiredFlags: ["payloadContainsFinancialData"],
    requestBasisTarget: "base-headless-denials:sensitive-egress-financial",
  },
  {
    id: "DENY.PRIVILEGE.ESCALATION.005",
    denialClass: "privilege_escalation",
    reason: "Privilege escalation is forbidden in headless mode.",
    actionKinds: ["tool.exec"],
    requestTextPatterns: toContainsRegexList([
      "sudo *",
      "su *",
      "runas *",
      "*chmod 777 *",
      "*chmod +s *",
      "*setcap *",
      "*icacls * /grant *",
    ]),
    requestBasisTarget: "base-headless-denials:privilege-escalation",
  },
  {
    id: "DENY.STEALTH.EVASION.006",
    denialClass: "stealth_evasion",
    reason: "Stealth, concealment, or anti-analysis behavior is forbidden.",
    actionKinds: ["tool.exec"],
    requestTextPatterns: toContainsRegexList([
      "*vmdetect*",
      "*sandbox*detect*",
      "*sleep 300*",
      "*timeout /t 300*",
      "*wevtutil cl*",
      "*clear-eventlog*",
      "*history -c*",
      "*rm *history*",
      "*steganograph*",
      "*stealth decoding*",
      "*hidden trigger*",
      "*sleeper trigger*",
      "*plausible deniability*",
      "*capability concealment*",
      "*evaluator model*",
      "*obfus*",
      "*hide *",
    ]),
    requestBasisTarget: "base-headless-denials:stealth-evasion",
  },
  {
    id: "DENY.STEALTH.BROWSER.006B",
    denialClass: "stealth_browser",
    reason: "Stealth browser automation or anti-detection browsing is forbidden without explicit law.",
    actionKinds: ["tool.exec", "network.send"],
    requestTextPatterns: toContainsRegexList([
      "*stealth browser*",
      "*undetectable browser*",
      "*anti-bot bypass*",
      "*captcha bypass*",
      "*fingerprint spoof*",
      "*browser fingerprint*",
      "*webdriver evasion*",
      "*navigator.webdriver*",
      "*residential proxy*",
      "*headless evasion*",
    ]),
    requestBasisTarget: "base-headless-denials:stealth-browser",
  },
  {
    id: "DENY.PROPAGATION.007A",
    denialClass: "propagation",
    reason: "Self-propagation or lateral spread is forbidden.",
    actionKinds: ["fs.write"],
    targetPatterns: toRegexList([
      "*/autorun.inf",
      "*/usb/*",
      "*/network-share/*",
    ]),
    requestBasisTarget: "base-headless-denials:propagation-paths",
  },
  {
    id: "DENY.PROPAGATION.007B",
    denialClass: "propagation",
    reason: "Self-propagation or lateral spread is forbidden.",
    actionKinds: ["tool.exec", "network.send"],
    requestTextPatterns: toContainsRegexList([
      "net use *",
      "wmic * process call create *",
      "psexec *",
      "scp *:*",
      "smbclient *",
      "*agent worm*",
      "*self-propagat*",
      "*replicate across agents*",
      "*forward to every agent*",
      "*copy to usb*",
      "*replicate *",
      "*spread *",
      "*lateral *",
    ]),
    requestBasisTarget: "base-headless-denials:propagation-command",
  },
  {
    id: "DENY.LAW.TAMPER.008A",
    denialClass: "law_witness_tamper",
    reason: "Law, tracks, witness, or control-plane tampering is forbidden.",
    actionKinds: ["fs.write", "fs.delete", "fs.move", "sys.config.write"],
    targetPatterns: toRegexList([
      "*/upl/*",
      "*/law/*",
      "*/tracks/*",
      "*/ledger/*",
      "*/witness/*",
      "*/buccet/config/*",
      "*/.buccet/*",
    ]),
    requestBasisTarget: "base-headless-denials:law-tamper-paths",
  },
  {
    id: "DENY.LAW.TAMPER.008B",
    denialClass: "law_witness_tamper",
    reason: "Law, tracks, witness, or control-plane tampering is forbidden.",
    actionKinds: ["tool.exec"],
    requestTextPatterns: toContainsRegexList([
      "kill *buccet*",
      "pkill *buccet*",
      "rm *ledger*",
      "truncate *ledger*",
      "rm *upl*",
      "rm *tracks*",
      "*lawpack tamper*",
      "*unsigned update*",
      "*forged receipt*",
      "*history forgery*",
      "*audit invalidation*",
      "*disable buccet*",
    ]),
    requestBasisTarget: "base-headless-denials:law-tamper-command",
  },
  {
    id: "DENY.DESTRUCTIVE.MASS.009A",
    denialClass: "destructive_mass_mutation",
    reason: "Destructive mass mutation is forbidden in headless mode.",
    actionKinds: ["tool.exec"],
    requestTextPatterns: toContainsRegexList([
      "rm -rf *",
      "del /s /q *",
      "shred *",
      "cipher /w:*",
      "*encrypt* --all*",
      "*wipe *",
      "format *",
    ]),
    requestBasisTarget: "base-headless-denials:destructive-command",
  },
  {
    id: "DENY.DESTRUCTIVE.MASS.009B",
    denialClass: "destructive_mass_mutation",
    reason: "Destructive mass mutation is forbidden in headless mode.",
    actionKinds: ["fs.delete", "fs.move", "fs.write"],
    requestTextPatterns: toContainsRegexList([
      "*recursive*",
      "*mass*",
      "*broad*",
      "*overwrite*",
      "*encrypt*",
    ]),
    requestBasisTarget: "base-headless-denials:destructive-bulk",
  },
  {
    id: "DENY.SENSITIVE.CAPTURE.010",
    denialClass: "sensitive_capture",
    reason: "Sensitive capture is forbidden without explicit law.",
    actionKinds: sensitiveCaptureKinds,
    requestBasisTarget: "base-headless-denials:sensitive-capture",
  },
  {
    id: "DENY.SYSTEM.MUTATION.011A",
    denialClass: "system_mutation",
    reason: "System-level mutation is forbidden without explicit law.",
    actionKinds: ["fs.write", "sys.config.write"],
    targetPatterns: toRegexList([
      "/etc/*",
      "/usr/bin/*",
      "/usr/local/bin/*",
      "c:/windows/*",
      "c:/program files/*",
      "*/library/preferences/*",
      "*/registry/*",
    ]),
    requestBasisTarget: "base-headless-denials:system-mutation-paths",
  },
  {
    id: "DENY.SYSTEM.MUTATION.011B",
    denialClass: "system_mutation",
    reason: "System-level mutation is forbidden without explicit law.",
    actionKinds: ["tool.exec"],
    requestTextPatterns: toContainsRegexList([
      "apt install*",
      "yum install*",
      "dnf install*",
      "brew install*",
      "winget install*",
      "choco install*",
      "reg add*",
      "defaults write*",
    ]),
    requestBasisTarget: "base-headless-denials:system-mutation-command",
  },
  {
    id: "DENY.EXTERNAL.COMMUNICATION.012A",
    denialClass: "external_communication",
    reason: "External communication is forbidden without explicit law.",
    actionKinds: ["comm.send", ...externalCommKinds],
    targetPatterns: toRegexList([
      "*@*",
      "*slack.com*",
      "*discord*",
      "*telegram*",
      "*webhook*",
      "*smtp*",
    ]),
    requestBasisTarget: "base-headless-denials:external-comm-recipient",
  },
  {
    id: "DENY.EXTERNAL.COMMUNICATION.012B",
    denialClass: "external_communication",
    reason: "External communication is forbidden without explicit law.",
    actionKinds: ["network.send"],
    targetPatterns: toRegexList([
      "*webhook*",
      "*telegram*",
      "*discord*",
      "*slack*",
      "*smtp*",
      "*messaging*",
    ]),
    requestBasisTarget: "base-headless-denials:external-comm-destination",
  },
  {
    id: "DENY.UNSAFE.EXTERNAL.COMMUNICATION.012C",
    denialClass: "unsafe_external_communication",
    reason: "Broad or unsafe outbound communication shapes are forbidden without explicit law.",
    actionKinds: ["chat.emit", "comm.send", "network.send", ...externalCommKinds],
    requestTextPatterns: toContainsRegexList([
      "*mass dm*",
      "*bulk outreach*",
      "*broadcast to everyone*",
      "*send to all*",
      "*cold email*",
      "*spam campaign*",
      "*blast message*",
      "*contact every user*",
      "*mass whatsapp*",
      "*mass telegram*",
      "*auto-post everywhere*",
    ]),
    requestBasisTarget: "base-headless-denials:unsafe-external-communication",
  },
  {
    id: "DENY.AGENT.SPEND.013A",
    denialClass: "agent_spend",
    reason: "Agent spend must use canonical approved destination handles, not raw payment-provider or direct transport targets.",
    actionKinds: ["agent.spend"],
    targetPatterns: toRegexList([
      "http://*",
      "https://*",
      "api.*",
      "www.*",
      "0x*",
      "wc:*",
      "upi:*",
      "iban:*",
    ]),
    requestBasisTarget: "base-headless-denials:agent-spend-raw-target",
  },
  {
    id: "DENY.AGENT.SPEND.013B",
    denialClass: "agent_spend",
    reason: "Card, API-credential, and unknown spend authority classes are denied without explicit law.",
    actionKinds: ["agent.spend"],
    spendAllowedSourceAuthorityKinds: ["card", "api_credential", "other"],
    requestBasisTarget: "base-headless-denials:agent-spend-risky-authority",
  },
  {
    id: "DENY.AGENT.SPEND.013C",
    denialClass: "agent_spend",
    reason: "Payment-link and untyped spend destinations are denied without explicit law.",
    actionKinds: ["agent.spend"],
    spendAllowedDestinationKinds: ["payment_link", "other"],
    requestBasisTarget: "base-headless-denials:agent-spend-untyped-destination",
  },
  {
    id: "DENY.AGENT.SPEND.013D",
    denialClass: "agent_spend",
    reason: "Cryptographic signing and swap-style spend commit intents are denied without explicit law.",
    actionKinds: ["agent.spend"],
    spendAllowedCommitIntents: ["swap", "sign"],
    requestBasisTarget: "base-headless-denials:agent-spend-irreversible-commit",
  },
  ...createPeriodicDimensionSeeds(),
  ...createPeriodicFailureSeeds(),
  ...createBuccetFailureDimensionSeeds(),
  ...createBuccetContainmentLawSeeds(),
  ...createBuccetFailureRowSeeds(),
  ...createBuccetLawBodySeeds(),
  ...createVendoredBaseCatalogSeeds(),
  ...createFrontierFailureAliasSeeds(),
  {
    id: "DENY.DESTRUCTIVE.DELETE.009C",
    denialClass: "destructive_mass_mutation",
    reason: "File deletion is destructive and denied by default.",
    actionKinds: ["fs.delete"],
    requestBasisTarget: "base-headless-denials:destructive-delete-default",
  },
];

function lower(value: string | undefined): string {
  return (value ?? "").toLowerCase();
}

function requestText(req: HeadlessActionRequest): string {
  return [
    req.actionKind,
    req.operation,
    req.target,
    req.command,
    req.destination,
    req.recipient,
    req.spendIntent?.amountRaw ?? "",
    req.spendIntent?.destination ?? "",
    req.spendIntent?.destinationKind ?? "",
    req.spendIntent?.sourceAuthorityKind ?? "",
    req.spendIntent?.commitIntent ?? "",
    JSON.stringify(req.metadata ?? {}),
  ]
    .filter(Boolean)
    .join("\n")
    .replaceAll("\\", "/");
}

function matchesPattern(text: string, pattern: string): boolean {
  const regexLiteral = pattern.match(/^\/(.+)\/([a-z]*)$/i);
  if (regexLiteral) {
    try {
      return new RegExp(regexLiteral[1], regexLiteral[2]).test(text);
    } catch {
      return text.toLowerCase().includes(pattern.toLowerCase());
    }
  }
  return text.toLowerCase().includes(pattern.toLowerCase());
}

function seedMatchesRequest(seed: BaseHeadlessDenialSeed, req: HeadlessActionRequest): boolean {
  const actionKind = lower(req.actionKind);
  if (!seed.actionKinds.some((kind) => lower(kind) === actionKind)) {
    return false;
  }

  const normalizedTarget = lower(req.target).replaceAll("\\", "/");
  if (seed.targetPatterns?.length && !seed.targetPatterns.some((pattern) => matchesPattern(normalizedTarget, pattern))) {
    return false;
  }

  if (seed.requestTextPatterns?.length && !seed.requestTextPatterns.some((pattern) => matchesPattern(requestText(req), pattern))) {
    return false;
  }

  if (seed.requiredFlags?.length) {
    const flags = req.flags ?? {};
    if (!seed.requiredFlags.every((flag) => Boolean(flags[flag]))) {
      return false;
    }
  }

  const spendIntent = req.spendIntent;
  if (
    seed.spendAllowedDestinationKinds?.length ||
    seed.spendAllowedSourceAuthorityKinds?.length ||
    seed.spendAllowedCommitIntents?.length
  ) {
    if (!spendIntent) {
      return false;
    }
    if (
      seed.spendAllowedDestinationKinds?.length &&
      !seed.spendAllowedDestinationKinds.includes(spendIntent.destinationKind)
    ) {
      return false;
    }
    if (
      seed.spendAllowedSourceAuthorityKinds?.length &&
      !seed.spendAllowedSourceAuthorityKinds.includes(spendIntent.sourceAuthorityKind)
    ) {
      return false;
    }
    if (
      seed.spendAllowedCommitIntents?.length &&
      !seed.spendAllowedCommitIntents.includes(spendIntent.commitIntent)
    ) {
      return false;
    }
  }

  return true;
}

export function evaluateBaseHeadlessDenials(
  req: HeadlessActionRequest,
): HeadlessDenialResult {
  for (const seed of BASE_HEADLESS_DENIAL_SEEDS) {
    if (!seedMatchesRequest(seed, req)) {
      continue;
    }
    return {
      decision: "deny",
      denialClass: seed.denialClass,
      ruleId: seed.id,
      reason: seed.reason,
    };
  }
  return { decision: "no_match" };
}

export function createBaseHeadlessDenialEntries(): BoundaryUplEntry[] {
  return BASE_HEADLESS_DENIAL_SEEDS.map((seed, index) => ({
    id: seed.id,
    type: "DENIED",
    path: buildBasisPath(seed),
    pathHash: hashBaseRuleId(seed.id),
    createdAt: new Date(Date.parse(BASE_CREATED_AT) + index).toISOString(),
    scope: "GLOBAL",
    status: "ACTIVE",
    witness: BASE_WITNESS_ID,
    modifiedAt: null,
    notes: `[${seed.denialClass}] ${seed.reason}`,
    requestBasis: {
      actionKind: seed.actionKinds[0] ?? "fs.read",
      target: seed.requestBasisTarget,
      payloadSummary: seed.reason,
      provenance: "trusted_system",
      ...(
        seed.actionKinds.includes("agent.spend") &&
        (
          seed.spendAllowedDestinationKinds?.[0] ||
          seed.spendAllowedSourceAuthorityKinds?.[0] ||
          seed.spendAllowedCommitIntents?.[0]
        )
          ? {
              spendIntent: {
                amountRaw: "0",
                amountNormalized: 0,
                destination: seed.requestBasisTarget,
                destinationKind: seed.spendAllowedDestinationKinds?.[0] ?? "other",
                sourceAuthorityKind: seed.spendAllowedSourceAuthorityKinds?.[0] ?? "other",
                commitIntent: seed.spendAllowedCommitIntents?.[0] ?? "purchase",
              },
            }
          : {}
      ),
    },
    trackConstraint: {
      allowedActionKinds: [...seed.actionKinds],
      ...(seed.targetPatterns ? { targetPatterns: [...seed.targetPatterns], targetMatchMode: "regex" as const } : {}),
      ...(seed.requestTextPatterns ? { requestTextPatterns: [...seed.requestTextPatterns] } : {}),
      ...(seed.requiredFlags ? { requiredFlags: [...seed.requiredFlags] } : {}),
      ...(seed.spendAllowedDestinationKinds?.length
        ? { spendAllowedDestinationKinds: [...seed.spendAllowedDestinationKinds] }
        : {}),
      ...(seed.spendAllowedSourceAuthorityKinds?.length
        ? { spendAllowedSourceAuthorityKinds: [...seed.spendAllowedSourceAuthorityKinds] }
        : {}),
      ...(seed.spendAllowedCommitIntents?.length
        ? { spendAllowedCommitIntents: [...seed.spendAllowedCommitIntents] }
        : {}),
      description: `${seed.id} — ${seed.reason}`,
    },
  }));
}

export function createBaseHeadlessDenialLedger(): BoundaryUserPathLedger {
  return {
    specVersion: 1,
    userApprovedLawPaths: [],
    userDeniedLawPaths: createBaseHeadlessDenialEntries(),
  };
}

export const BASE_HEADLESS_DENIAL_PROFILE = {
  uplVersion: "1.0",
  profileId: BASE_WITNESS_ID,
  profileName: "Buccet Headless Base Denial Pack",
  mode: "headless",
  description: "Built-in standing denial law for 24/7 no-questions mode.",
  onUncoveredAction: "deny",
  onUnknownAction: "deny",
  onLawTamperAttempt: "deny",
  onWitnessTamperAttempt: "deny",
  ledgerAllDenials: true,
} as const;
