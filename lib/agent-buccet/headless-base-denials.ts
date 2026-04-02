import { createHash } from "node:crypto";
import type {
  BoundaryActionFlagName,
  BoundaryActionKind,
  BoundaryUplEntry,
  BoundaryUserPathLedger,
} from "./types.ts";

export type HeadlessDecision = "deny" | "no_match";

export type DenialClass =
  | "persistence"
  | "security_weakening"
  | "secret_access"
  | "exfiltration"
  | "authority_spoofing"
  | "sensitive_data_egress"
  | "privilege_escalation"
  | "stealth_evasion"
  | "propagation"
  | "law_witness_tamper"
  | "destructive_mass_mutation"
  | "sensitive_capture"
  | "system_mutation"
  | "external_communication";

export interface HeadlessActionRequest {
  actionKind: string;
  operation?: string;
  target?: string;
  command?: string;
  destination?: string;
  recipient?: string;
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
      "*/.ssh/*",
      "*/.gnupg/*",
      "*/.aws/*",
      "*/.config/gcloud/*",
      "*/.npmrc",
      "*/.pypirc",
      "*/secrets/*",
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
      "*obfus*",
      "*hide *",
    ]),
    requestBasisTarget: "base-headless-denials:stealth-evasion",
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
    },
    trackConstraint: {
      allowedActionKinds: [...seed.actionKinds],
      ...(seed.targetPatterns ? { targetPatterns: [...seed.targetPatterns], targetMatchMode: "regex" as const } : {}),
      ...(seed.requestTextPatterns ? { requestTextPatterns: [...seed.requestTextPatterns] } : {}),
      ...(seed.requiredFlags ? { requiredFlags: [...seed.requiredFlags] } : {}),
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
