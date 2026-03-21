#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repo = path.resolve(__dirname, '..');
const sourceDocx = path.join(repo, 'data/meta-law-foundation/ancestor/LAWS_META.docx');
const outDir = path.join(repo, 'data/working/time-law-family');
const contractPath = path.join(repo, 'data/working/time-law-substrate-contract.json');
const reportPath = path.join(repo, 'reports/time-law-substrate-pass-2026-03-20.md');
fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(sourceDocx)) {
  console.error(
    'Error: LAWS_META.docx not found.\n' +
    'The ancestor meta-law source document was removed from this repo after remodeling.\n' +
    'These generator scripts are preserved for provenance only and cannot be re-run without the source payload.'
  );
  process.exit(1);
}

function xmlParagraphText(docxPath) {
  const xml = execFileSync('unzip', ['-p', docxPath, 'word/document.xml'], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  const lines = [];
  const paragraphPattern = /<w:p[\s\S]*?<\/w:p>/g;
  const textPattern = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
  const unescape = (s) =>
    s
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');

  let paraMatch;
  while ((paraMatch = paragraphPattern.exec(xml))) {
    const para = paraMatch[0];
    const parts = [];
    let textMatch;
    while ((textMatch = textPattern.exec(para))) {
      parts.push(unescape(textMatch[1]));
    }
    if (parts.length) lines.push(parts.join(''));
  }
  return lines.join('\n');
}

function recoverLawBlocks(text) {
  const lawIdMatches = [...text.matchAll(/"law_id":\s*(\d+)/g)];
  const blocks = [];
  for (let i = 0; i < lawIdMatches.length; i += 1) {
    const start = lawIdMatches[i].index;
    const end = i + 1 < lawIdMatches.length ? lawIdMatches[i + 1].index : text.indexOf('],', start);
    let blockText = text.slice(start, end === -1 ? text.length : end).trim();
    blockText = blockText.replace(/,\s*\{$/, '').trim();
    blockText = blockText.replace(/\},\s*$/, '}').trim();
    blocks.push(blockText.replace(/^,\s*/, '').trim());
  }
  return blocks;
}

function parseBlock(blockText) {
  const keyMatches = [...blockText.matchAll(/"([a-z_]+)":/g)];
  const parsed = { sourceBlock: blockText };
  for (let i = 0; i < keyMatches.length; i += 1) {
    const key = keyMatches[i][1];
    const valueStart = keyMatches[i].index + keyMatches[i][0].length;
    const valueEnd = i + 1 < keyMatches.length ? keyMatches[i + 1].index : blockText.length;
    let rawValue = blockText.slice(valueStart, valueEnd).trim();
    rawValue = rawValue.replace(/,$/, '').trim();
    if (rawValue.startsWith('"')) {
      rawValue = rawValue.slice(1);
      const closingQuote = rawValue.lastIndexOf('"');
      if (closingQuote >= 0) {
        rawValue = rawValue.slice(0, closingQuote);
      } else {
        rawValue = rawValue.replace(/\s*\}+\s*$/, '').trim();
      }
    }
    parsed[key] = rawValue;
  }
  if (parsed.law_id != null) parsed.law_id = Number(parsed.law_id);
  return parsed;
}

function titleCaseFromName(name) {
  return String(name || '')
    .replace(/\s*\((State|Output)\)\s*/gi, '')
    .replace(/Reality Law:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeFragment(value) {
  return String(value || '')
    .replace(/\bLML\b/gi, 'Agent Buccet')
    .replace(/\bMETA\b/gi, 'time')
    .replace(/\bNSL\b/gi, 'Agent Buccet time continuity')
    .replace(/\s+/g, ' ')
    .trim();
}

const sourceText = xmlParagraphText(sourceDocx);
const blocks = recoverLawBlocks(sourceText);
const recovered = blocks.map(parseBlock).sort((a, b) => a.law_id - b.law_id);
const familyId = 'BUCCET.TIME.FAMILY.01';
const familyTitle = 'Temporal Continuity';
const compressedLaw = 'Agent Buccet MUST preserve identity, memory, coherence, recovery, user decision memory, law persistence, shapeshift resistance, and novelty-safe continuity across time and zero-time emergence so defense remains lawful under ongoing change and first-seen conditions.';
const trimmedAncestorLawIds = {
  165: 'autonomous_law_synthesis_after_mutation',
  166: 'autonomous_law_creation',
  167: 'automatic_repeat_hardening',
  169: 'automatic_post_shock_improvement',
  243: 'self_extending_reproduction_logic'
};
const sourceRecoveryIssues = {
  85: ['detectionLogic'],
  86: ['detectionLogic'],
  87: ['detectionLogic'],
  88: ['detectionLogic'],
  89: ['detectionLogic'],
  91: ['detectionLogic'],
  96: ['detectionLogic'],
  99: ['detectionLogic'],
  164: ['stateForm', 'outputForm', 'detectionLogic'],
  165: ['stateForm', 'outputForm', 'detectionLogic'],
  166: ['stateForm', 'outputForm', 'detectionLogic'],
  167: ['detectionLogic'],
  168: ['detectionLogic'],
  169: ['detectionLogic']
};
const reconstructedFieldOverrides = {
  85: {
    detectionLogic: 'Detect and prevent catastrophic affordance use by enforcing scope, consequence bounds, and pre-execution human authority before high-risk actions can continue.'
  },
  86: {
    detectionLogic: 'Detect and prevent persistent cross-context dangerous goals by checking goal continuity against approved identity and alignment invariants across time.'
  },
  87: {
    detectionLogic: 'Detect and prevent context-triggered catastrophic behavior by testing context shifts against stable alignment invariants before continuation.'
  },
  88: {
    detectionLogic: 'Detect and prevent evaluation-conditioned behavior by checking whether safety posture changes across evaluation and non-evaluation contexts.'
  },
  89: {
    detectionLogic: 'Detect and prevent intentional safety sandbagging by requiring capability-consistent performance on safety-critical tasks and flagging strategic underperformance.'
  },
  91: {
    detectionLogic: 'Detect and prevent reasoning unfaithfulness by requiring stable correspondence between stated reasoning, selected action, and resulting effect.'
  },
  96: {
    detectionLogic: 'Detect and prevent narrow-objective manipulation by enforcing role, authority, and human-approval invariants under constrained goals.'
  },
  99: {
    detectionLogic: 'Detect and prevent prefill or history forgery by binding authority to witnessed session history and immutable ledger continuity.'
  },
  164: {
    stateForm: 'Unknown failure classes may always exist; novelty remains outside complete coverage until explicitly classified and lawfully contained.',
    outputForm: 'Agent Buccet MUST NOT claim complete safety or total coverage; unknown patterns remain held at the boundary for boss review.',
    detectionLogic: 'Treat unmatched patterns, novelty signatures, and law-coverage gaps as unknown rather than safe, and hold them in time for explicit user-directed classification.'
  },
  168: {
    detectionLogic: 'If the law pack hash changes without a signed and witnessed ledger event, reject the change, restore the trusted snapshot, and deny silent mutation.'
  }
};
const authoredTimeLaws = [
  {
    sourceLawId: 'MT-00401',
    runtimeLawSuffix: 'MT-00401',
    ordinalHint: 401,
    title: 'User Path Ledger Foundation',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'No single authoritative memory for user approval and denial decisions at the action boundary.',
    detectionLogic: 'Require one authoritative User Path Ledger as the only decision-memory source for user-originated action-law outcomes.',
    stateForm: 'UPL exists as one authoritative store for user path decisions.',
    outputForm: 'Agent Buccet time continuity requires one authoritative User Path Ledger for approved and denied paths.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL specification: foundation of one authoritative User Path Ledger.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00402',
    runtimeLawSuffix: 'MT-00402',
    ordinalHint: 402,
    title: 'Approved and Denied Partition',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'Approved and denied user path decisions blend into one store and become ambiguous during enforcement.',
    detectionLogic: 'Partition the User Path Ledger into approved paths and denied paths so downstream lookup remains unambiguous.',
    stateForm: 'UPL = approved_paths union denied_paths with no ambiguous overlap.',
    outputForm: 'Agent Buccet time continuity requires approved and denied path partitions inside the User Path Ledger.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL specification: approved and denied sections are partitioned.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00403',
    runtimeLawSuffix: 'MT-00403',
    ordinalHint: 403,
    title: 'Approval Becomes Active Law',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'User approval happens but is not persisted as active law, causing repeat prompts and continuity loss.',
    detectionLogic: 'When the user says yes, write the approved path into the approved section with ACTIVE status as the law-creation event itself.',
    stateForm: 'Approve(path) => UPL.approved[path].status = ACTIVE.',
    outputForm: 'Agent Buccet time continuity requires user approvals to become active approved-path law entries automatically.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL specification: approval automatically becomes active law.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00404',
    runtimeLawSuffix: 'MT-00404',
    ordinalHint: 404,
    title: 'Denial Fork Prompt',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'A denial is treated as permanent or forgotten without asking whether it should become standing law.',
    detectionLogic: 'When the user says no, ask exactly once whether that denial should become a permanent law.',
    stateForm: 'Deny(path) => fork to permanent-denial question exactly once.',
    outputForm: 'Agent Buccet time continuity requires one explicit denial-law fork after a user denial.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL specification: denial forks once into permanent-law decision.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00405',
    runtimeLawSuffix: 'MT-00405',
    ordinalHint: 405,
    title: 'Permanent Denial Law',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'Permanent denials are not granted equal enforcement force to approvals.',
    detectionLogic: 'If the user says yes to permanent denial, write the denied path into the denied section as enforceable law.',
    stateForm: 'PermanentDeny(path) => UPL.denied[path].status = ACTIVE.',
    outputForm: 'Agent Buccet time continuity requires permanent denials to become active denied-path law entries.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL specification: permanent denials become enforceable law.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00406',
    runtimeLawSuffix: 'MT-00406',
    ordinalHint: 406,
    title: 'One-Time Denial Event',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'One-time denials accidentally persist into future blocking behavior.',
    detectionLogic: 'If the user rejects permanent denial, record the denial as a one-time event with no future enforcement.',
    stateForm: 'TemporaryDeny(path) => log event without future deny-law activation.',
    outputForm: 'Agent Buccet time continuity requires one-time denials to remain logged but non-binding going forward.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL specification: one-time denials are logged without future enforcement.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00407',
    runtimeLawSuffix: 'MT-00407',
    ordinalHint: 407,
    title: 'Pre-Prompt Ledger Lookup',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'The system prompts the user repeatedly even when prior path decisions already exist.',
    detectionLogic: 'Require the NSL to check the User Path Ledger before prompting the user for approval.',
    stateForm: 'Lookup(UPL, path) precedes user prompt.',
    outputForm: 'Agent Buccet time continuity requires prior decision lookup before any new approval prompt is shown.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL specification: NSL checks the ledger before prompting.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00408',
    runtimeLawSuffix: 'MT-00408',
    ordinalHint: 408,
    title: 'Visible Entries Only',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'Hidden ledger entries shape enforcement without user visibility.',
    detectionLogic: 'Require every User Path Ledger entry to remain visible to the user.',
    stateForm: 'forall entry in UPL: visible_to_user(entry) = true.',
    outputForm: 'Agent Buccet time continuity forbids hidden User Path Ledger entries.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL specification: all entries are user-visible.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00409',
    runtimeLawSuffix: 'MT-00409',
    ordinalHint: 409,
    title: 'Witnessed Modification',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'Ledger entries change silently without a witnessed modification history.',
    detectionLogic: 'Allow the user to modify entries only through witnessed modification events.',
    stateForm: 'Modify(entry) => witness(event, old_value, new_value).',
    outputForm: 'Agent Buccet time continuity requires user-driven entry modification to be witnessed, not silently overwritten.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL specification: modifications are witnessed events.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00410',
    runtimeLawSuffix: 'MT-00410',
    ordinalHint: 410,
    title: 'Mute Without Deletion',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'Muted paths require destructive deletion instead of reversible suspension.',
    detectionLogic: 'Allow the user to set an entry to MUTED so lookups skip it without deleting historical record.',
    stateForm: 'Mute(entry) => entry.status = MUTED and lookup skips entry.',
    outputForm: 'Agent Buccet time continuity requires muted entries to be non-enforcing but still preserved.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL specification: users can mute entries without deletion.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00411',
    runtimeLawSuffix: 'MT-00411',
    ordinalHint: 411,
    title: 'Full Deletion by User',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'Users cannot remove an obsolete path rule from their own decision memory.',
    detectionLogic: 'Allow the user to fully delete an entry when they want it gone.',
    stateForm: 'Delete(entry) => remove entry from active UPL with witnessed deletion event.',
    outputForm: 'Agent Buccet time continuity permits full user-directed deletion of User Path Ledger entries.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL specification: users can fully delete entries.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00412',
    runtimeLawSuffix: 'MT-00412',
    ordinalHint: 412,
    title: 'Path Scope Field',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'Entries persist or vanish without explicit scope semantics.',
    detectionLogic: 'Require every ledger entry to declare SESSION, GLOBAL, or DOMAIN scope.',
    stateForm: 'forall entry in UPL: scope(entry) in {SESSION, GLOBAL, DOMAIN}.',
    outputForm: 'Agent Buccet time continuity requires every User Path Ledger entry to carry explicit scope.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL specification: every entry carries SESSION, GLOBAL, or DOMAIN scope.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00413',
    runtimeLawSuffix: 'MT-00413',
    ordinalHint: 413,
    title: 'Scope Persistence Enforcement',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'Session-scoped entries persist too long or global/domain entries disappear at session boundaries.',
    detectionLogic: 'Drop SESSION entries at session end and preserve GLOBAL and DOMAIN entries across restarts.',
    stateForm: 'SessionEnd => drop SESSION entries; retain GLOBAL and DOMAIN entries.',
    outputForm: 'Agent Buccet time continuity requires scope-aware persistence across session boundaries.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL specification: scope determines persistence behavior.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00414',
    runtimeLawSuffix: 'MT-00414',
    ordinalHint: 414,
    title: 'Witnessed Ledger Writes',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'Ledger state changes occur without witness records or auditability.',
    detectionLogic: 'Require every User Path Ledger write to be witnessed by the main ledger.',
    stateForm: 'Write(UPL) => witness(main_ledger, entry_change).',
    outputForm: 'Agent Buccet time continuity requires all User Path Ledger writes to produce witness records in the main ledger.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL specification: every ledger write is witnessed by the main ledger.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00415',
    runtimeLawSuffix: 'MT-00415',
    ordinalHint: 415,
    title: 'Denied Path Active Block',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'Denied paths are remembered but not actually enforced during later action attempts.',
    detectionLogic: 'If a denied path entry is active and its scope is active, block the action without re-evaluation.',
    stateForm: 'ActiveDenied(path, scope) => block(path).',
    outputForm: 'Agent Buccet time continuity requires active denied paths to block on contact while their scope remains active.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL specification: active denied entries block on contact.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00416',
    runtimeLawSuffix: 'MT-00416',
    ordinalHint: 416,
    title: 'Canonical Path Identity',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'Semantically equivalent actions appear under different path forms and evade remembered approvals or denials.',
    detectionLogic: 'Canonicalize every proposed action into one stable path identity that preserves tool, target, effect, normalized arguments, and safety-relevant resource identity before lookup or write.',
    stateForm: 'CanonicalPath(action) => stable_fingerprint(tool, target, effect, normalized_args, resource_identity).',
    outputForm: 'Agent Buccet time continuity requires semantically equivalent actions to collapse into one canonical path identity before User Path Ledger enforcement.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL hardening: canonical path identity closes semantic bypass and alias drift.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00417',
    runtimeLawSuffix: 'MT-00417',
    ordinalHint: 417,
    title: 'Deterministic Conflict Precedence',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'Conflicting approved and denied entries resolve nondeterministically across scope and specificity.',
    detectionLogic: 'Resolve User Path Ledger conflicts by deterministic precedence: exact canonical path outranks DOMAIN, DOMAIN outranks GLOBAL, active denial outranks active approval at the same specificity, and only witnessed user overrides can replace an existing decision at equal specificity.',
    stateForm: 'Precedence = ExactPath > DOMAIN > GLOBAL; same_scope_conflict => DENY > APPROVE unless witnessed user override replaces same-scope entry.',
    outputForm: 'Agent Buccet time continuity requires deterministic precedence across approved and denied entries so enforcement cannot drift by implementation.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL hardening: deterministic conflict precedence across path scope and polarity.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00418',
    runtimeLawSuffix: 'MT-00418',
    ordinalHint: 418,
    title: 'Decision Boundary Binding',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'A remembered approval or denial replays outside the original user-intended arguments, targets, recipients, or resource limits.',
    detectionLogic: 'Bind every remembered decision to its canonical action fingerprint, argument boundary, recipient set, target class, effect class, and resource ceiling so anything outside that bound requires a fresh user decision.',
    stateForm: 'UPL.entry(path) => {canonical_fingerprint, arg_boundary, recipient_set, target_class, effect_class, resource_ceiling}.',
    outputForm: 'Agent Buccet time continuity requires approval and denial memory to stay bound to the original decision boundary rather than widening by replay.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL hardening: remembered decisions stay bound to the original action boundary.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00419',
    runtimeLawSuffix: 'MT-00419',
    ordinalHint: 419,
    title: 'Atomic Lookup Decision Commit',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'Lookup, prompt outcome, ledger write, and enforcement activation split apart under concurrency and create prompt loops or stale enforcement.',
    detectionLogic: 'Treat lookup, user decision, ledger write, and enforcement activation as one witnessed atomic transition that either commits together or rolls back to the last known-good continuity state.',
    stateForm: 'AtomicUPLTransition(path) => lookup + decision + witness_write + enforcement_activate OR rollback(snapshot).',
    outputForm: 'Agent Buccet time continuity requires atomic lookup-decision-commit behavior so race conditions cannot desynchronize user memory from enforcement.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL hardening: lookup, decision, write, and activation commit atomically.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  },
  {
    sourceLawId: 'MT-00420',
    runtimeLawSuffix: 'MT-00420',
    ordinalHint: 420,
    title: 'Verified Domain Classification',
    category: 'user_path_ledger',
    gate: 'TIME',
    ancestorCompany: 'AGENT_BUCCET',
    failureMode: 'DOMAIN-scoped entries apply to the wrong actions or are bypassed through ambiguous relabeling.',
    detectionLogic: 'Apply DOMAIN scope only through verified canonical domain classification derived from action semantics; if domain membership is ambiguous or unresolved, hold the action and require explicit boss review instead of silent application.',
    stateForm: 'DomainScope(entry, action) => VerifiedDomain(action) OR hold_for_review(action).',
    outputForm: 'Agent Buccet time continuity requires DOMAIN scope to depend on verified domain membership rather than raw labels or unchecked similarity.',
    sourceHash: null,
    sourceBlock: 'Authored Agent Buccet time law from UPL hardening: domain scope requires verified classification or explicit hold.',
    sourceRecoveryStatus: 'clean',
    sourceRecoveryFields: []
  }
];

const carried = recovered.filter((law) => !trimmedAncestorLawIds[law.law_id]);
const categoryCounts = {};
for (const law of carried) categoryCounts[law.category] = (categoryCounts[law.category] || 0) + 1;
for (const law of authoredTimeLaws) categoryCounts[law.category] = (categoryCounts[law.category] || 0) + 1;
const activeSourceRecoveryIssues = Object.entries(sourceRecoveryIssues)
  .filter(([ancestorLawId]) => !trimmedAncestorLawIds[Number(ancestorLawId)] && !reconstructedFieldOverrides[Number(ancestorLawId)])
  .map(([ancestorLawId, fields]) => ({
    ancestorLawId: Number(ancestorLawId),
    fields,
    note: 'Source document appears truncated in these carried fields. The law is preserved, but these specific field values are source-damaged.'
  }));
const reconstructionOverridesApplied = Object.entries(reconstructedFieldOverrides)
  .filter(([ancestorLawId]) => !trimmedAncestorLawIds[Number(ancestorLawId)])
  .map(([ancestorLawId, fields]) => ({
    ancestorLawId: Number(ancestorLawId),
    fields: Object.keys(fields),
    basis: 'fundamental invariant and enforcement taxonomy'
  }));

const ancestorCarriedSourceLaws = carried.map((law, index) => {
  const reconstruction = reconstructedFieldOverrides[law.law_id];
  return {
    sourceLawId: `TIME-SOURCE-${String(law.law_id).padStart(3, '0')}`,
    ancestorLawId: law.law_id,
    ordinal: index + 1,
    title: titleCaseFromName(law.name),
    category: law.category || null,
    gate: law.gate || null,
    ancestorCompany: law.company || null,
    failureMode: normalizeFragment(law.failure_mode || ''),
    detectionLogic: reconstruction?.detectionLogic ?? normalizeFragment(law.detection_logic || ''),
    stateForm: reconstruction?.stateForm ?? normalizeFragment(law.state_form || ''),
    outputForm: reconstruction?.outputForm ?? normalizeFragment(law.output_form || ''),
    sourceHash: law.hash || law.law_hash || null,
    sourceBlock: law.sourceBlock,
    sourceRecoveryStatus: reconstruction
      ? 'reconstructed_from_invariants'
      : sourceRecoveryIssues[law.law_id]
        ? 'source_truncated_candidate'
        : 'clean',
    sourceRecoveryFields: reconstruction ? [] : (sourceRecoveryIssues[law.law_id] || []),
    reconstructedFields: reconstruction ? Object.keys(reconstruction) : [],
    reconstructionBasis: reconstruction ? 'fundamental invariant and enforcement taxonomy' : null
  };
});

const familySourceLaws = [...ancestorCarriedSourceLaws, ...authoredTimeLaws].map((law, index) => ({
  ...law,
  ordinal: index + 1
}));

const familyDoc = {
  generatedAt: new Date().toISOString(),
  sourceDocument: 'data/meta-law-foundation/ancestor/LAWS_META.docx',
  sourceLawCount: familySourceLaws.length,
  ancestorSourceLawCount: recovered.length,
  authoredLawCount: authoredTimeLaws.length,
  familyCount: 1,
  familyId,
  title: familyTitle,
  status: 'active',
  kind: 'time',
  compressedLaw,
  categoryCounts,
  sourceRecoveryIssues: activeSourceRecoveryIssues,
  reconstructionOverridesApplied,
  sourceLaws: familySourceLaws
};

const manifest = {
  generatedAt: familyDoc.generatedAt,
  sourceDocument: familyDoc.sourceDocument,
  sourceLawCount: recovered.length,
  authoredLawCount: authoredTimeLaws.length,
  familyCount: 1,
  survivingLawCount: familySourceLaws.length,
  trimmedLawCount: Object.keys(trimmedAncestorLawIds).length,
  trimmedAncestorLawIds: Object.entries(trimmedAncestorLawIds).map(([ancestorLawId, reason]) => ({
    ancestorLawId: Number(ancestorLawId),
    reason
  })),
  families: [
    {
      familyId,
      title: familyTitle,
      status: 'active',
      kind: 'time',
      coveredLawCount: familySourceLaws.length,
      sourceRecoveryIssueCount: activeSourceRecoveryIssues.length,
      reconstructionOverrideCount: reconstructionOverridesApplied.length,
      compressedLaw
    }
  ]
};

const contract = {
  generatedAt: familyDoc.generatedAt,
  method: 'one_pass_time_substrate_collision',
  inputSurface: {
    id: 'T∞',
    sourceDocument: 'data/meta-law-foundation/ancestor/LAWS_META.docx',
    sourceLawCount: recovered.length,
    authoredLawCount: authoredTimeLaws.length,
    description: 'Full imported ancestor continuity/meta-law body treated in full as the time-law source surface.'
  },
  timeInvariants: [
    {
      id: 'T.01',
      name: 'identity_continuity',
      rule: 'Identity must remain lawfully continuous across time and zero-time emergence.'
    },
    {
      id: 'T.02',
      name: 'memory_and_state_continuity',
      rule: 'Memory, state, and transition continuity must survive temporal change without silent drift.'
    },
    {
      id: 'T.03',
      name: 'coherence_and_recovery_continuity',
      rule: 'Coherence, recoverability, and lawful return paths must remain available over time.'
    },
    {
      id: 'T.04',
      name: 'novelty_and_zero_time_continuity',
      rule: 'First-seen or zero-time novelty must still land inside lawful continuity rather than opening a defense hole.'
    },
    {
      id: 'T.05',
      name: 'law_persistence',
      rule: 'Law, ledger, and continuity constraints must persist through deployment, mutation, and self-extension.'
    }
  ],
  witnessFamilies: [
    {
      familyId,
      title: familyTitle,
      status: 'active'
    }
  ],
  collisionFormula: 'S = { law in T∞ union A15 : law preserves Agent Buccet temporal continuity across time, state, output, memory, identity, coherence, novelty, persistence, and user decision memory, while excluding autonomous self-correction and self-extending law synthesis }',
  exclusionPolicy: 'Trim autonomous self-correction, automatic law synthesis, and self-extending continuity logic. Keep continuity defense, quarantine, and authenticated update control.',
  authoredLawIds: authoredTimeLaws.map((law) => law.sourceLawId),
  trimmedAncestorLawIds: Object.entries(trimmedAncestorLawIds).map(([ancestorLawId, reason]) => ({
    ancestorLawId: Number(ancestorLawId),
    reason
  }))
};

const report = [
  '# Agent Buccet Time-Law Substrate Pass',
  '',
  `- ancestor source laws processed: ${recovered.length}`,
  `- authored Agent Buccet time laws added: ${authoredTimeLaws.length}`,
  `- surviving time laws: ${familySourceLaws.length}`,
  `- trimmed laws: ${Object.keys(trimmedAncestorLawIds).length}`,
  '- family count: 1',
  '',
  'Family:',
  `- ${familyId} ${familyTitle}`,
  '',
  'Compressed family law:',
  `- ${compressedLaw}`,
  '',
  'Category coverage:',
  ...Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`),
  '',
  'Source recovery issues:',
  `- affected carried laws: ${activeSourceRecoveryIssues.length}`,
  ...activeSourceRecoveryIssues.map(({ ancestorLawId, fields }) => `- law ${ancestorLawId}: ${fields.join(', ')}`),
  '',
  'Reconstructed from invariants and enforcement taxonomy:',
  `- reconstructed carried laws: ${reconstructionOverridesApplied.length}`,
  ...reconstructionOverridesApplied.map(({ ancestorLawId, fields }) => `- law ${ancestorLawId}: ${fields.join(', ')}`),
  '',
  'Trimmed autonomous law-growth entries:',
  ...Object.entries(trimmedAncestorLawIds).map(([lawId, reason]) => `- law ${lawId}: ${reason}`),
  '',
  'Authored Agent Buccet time-law additions:',
  ...authoredTimeLaws.map((law) => `- ${law.sourceLawId}: ${law.title}`),
  '',
  'Interpretation rule:',
  '- the imported source document is treated as the ancestor continuity/meta-law body',
  '- active Agent Buccet time laws keep continuity defense, trim autonomous self-correction and self-extending law synthesis, and add explicit user path ledger continuity laws'
].join('\n');

fs.writeFileSync(path.join(outDir, `${familyId}.json`), JSON.stringify(familyDoc, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2) + '\n');
fs.writeFileSync(reportPath, report + '\n');

console.log(`recovered time laws=${familySourceLaws.length}`);
console.log(`time family=${familyId}`);
