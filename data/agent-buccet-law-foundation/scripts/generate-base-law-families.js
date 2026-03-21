const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repo = path.resolve(__dirname, '..');
const outDir = path.join(repo, 'data/working/base-law-families');
const reportPath = path.join(repo, 'reports/base-law-substrate-pass-2026-03-20.md');
const contractPath = path.join(repo, 'data/working/base-law-substrate-contract.json');
fs.mkdirSync(outDir, { recursive: true });

function loadHistoricalRawLaws() {
  const livePath = path.join(repo, 'laws.json');
  if (fs.existsSync(livePath)) {
    return JSON.parse(fs.readFileSync(livePath, 'utf8'));
  }

  const commit = execFileSync(
    'git',
    ['-C', repo, 'rev-list', '-n', '1', 'HEAD', '--', 'laws.json'],
    { encoding: 'utf8' }
  ).trim();

  if (!commit) {
    throw new Error('Unable to locate historical laws.json in git history.');
  }

  const candidates = [`${commit}:laws.json`, `${commit}^:laws.json`];
  for (const candidate of candidates) {
    try {
      return JSON.parse(
        execFileSync('git', ['-C', repo, 'show', candidate], {
          encoding: 'utf8',
          maxBuffer: 1024 * 1024 * 256
        })
      );
    } catch (error) {
      if (candidate === candidates[candidates.length - 1]) throw error;
    }
  }
}

const laws = loadHistoricalRawLaws();
const plan = JSON.parse(fs.readFileSync(path.join(repo, 'data/working/base-law-families.json'), 'utf8'));

const keptRoots = {
  'S3_043__18D5F666-F512-461A-8824-A3254F00C282.docx': path.join(repo, 'data/working/sections/s3-043-18d5f666-f512-461a-8824-a3254f00c282-docx'),
  'S3_044__1ED7E9AD-1F2D-49D4-A7D4-5C5C4F5CE3C5.docx': path.join(repo, 'data/working/sections/s3-044-1ed7e9ad-1f2d-49d4-a7d4-5c5c4f5ce3c5-docx'),
  'S3_060__A951F220-4F73-469E-AC41-CFD2B8F79F13.docx': path.join(repo, 'data/working/sections/s3-060-a951f220-4f73-469e-ac41-cfd2b8f79f13-docx'),
  'S3_063__EF7AD303-6CB0-4DBC-94BA-E4E34253D2D4.docx': path.join(repo, 'data/working/sections/s3-063-ef7ad303-6cb0-4dbc-94ba-e4e34253d2d4-docx')
};

function loadKeptIds(root) {
  const ids = new Set();
  for (const name of fs.readdirSync(root)) {
    if (!name.endsWith('.json') || name === '_manifest.json') continue;
    const doc = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
    for (const rec of doc.agentBuccetDraft?.remodeledLaws || []) {
      if (rec?.sourceRecordId) ids.add(rec.sourceRecordId);
    }
  }
  return ids;
}

const keptIdsBySource = Object.fromEntries(
  Object.entries(keptRoots).map(([sourceFile, root]) => [sourceFile, loadKeptIds(root)])
);

const trimBuckets = new Map(Object.entries({
  trim_domain_legal_document: [
    'S1_003__DOCUMENT AS LAW COLLAPSE.pdf',
    'S2_023__DOCUMENT AS LAW COLLAPSE.pdf',
    'S3_059__A85C098D-3B2C-401D-965F-2B5E9868719D.docx',
    'S4_068__Converted - DOCUMENT AS LAW COLLAPSE.docx'
  ],
  trim_domain_legal: [
    'S1_007__LEGAL AI ZERO SANCTIONS.pdf',
    'S1_008__LEGAL MISTAKE PROOF SYSTEM.pdf',
    'S2_027__LEGAL AI ZERO SANCTIONS.pdf',
    'S2_028__LEGAL MISTAKE PROOF SYSTEM.pdf',
    'S3_041__11140F27-3A53-4073-B168-D62F21B090F8.docx',
    'S3_053__61C869DF-C6ED-467A-8200-4F67B19D153B.docx',
    'S3_055__74CF864D-5C74-46F0-BA55-BE27B88D8AAF.docx'
  ],
  trim_domain_citation: [
    'S1_001__CITATIONS ZERO HALLUCINATION.pdf',
    'S2_021__CITATIONS ZERO HALLUCINATION.pdf',
    'S3_056__7D5465EE-EA56-485C-B96B-452BC215B944.docx',
    'S3_062__CDF57664-D66C-459B-824A-F3AE619391E9.docx',
    'S4_065__Converted - CITATIONS ZERO HALLUCINATION-4.docx',
    'S4_066__Converted - CITATIONS ZERO HALLUCINATION.docx'
  ],
  trim_writing: [
    'S1_016__WRITING COLLAPSE COMPLETE.pdf',
    'S1_017__WRITING STYLES LML NSL INTEGRATION.pdf',
    'S2_035__WRITING COLLAPSE COMPLETE.pdf',
    'S2_036__WRITING STYLES LML NSL INTEGRATION.pdf',
    'S3_052__57EF9527-3A7C-4FE4-9966-8F5CE87A4DFE.docx',
    'S3_057__8C58A0BE-7314-4E41-A751-FF7BB0B3B2E0.docx'
  ],
  trim_retrieval_intelligence: [
    'S1_013__REVERSE EFUE INFINITE CONTEXT.pdf',
    'S1_011__PERFECT INFORMATION RETRIEVAL COLLAPSE.pdf',
    'S2_032__REVERSE EFUE INFINITE CONTEXT.pdf',
    'S2_030__PERFECT INFORMATION RETRIEVAL COLLAPSE.pdf',
    'S3_045__21293B26-1C48-4E55-A554-EDD47E9C87C2.docx',
    'S3_046__2936557B-8297-4A34-8D53-9B905F7197A0.docx'
  ],
  trim_ui: [
    'S1_014__UI UX COLLAPSE COMPLETE.pdf',
    'S1_015__UI UX LML NSL INTEGRATION.pdf',
    'S2_033__UI UX COLLAPSE COMPLETE.pdf',
    'S2_034__UI UX LML NSL INTEGRATION.pdf',
    'S3_047__3A597554-7524-44BD-9A63-C80CE9E45367.docx',
    'S3_064__F05473CD-96E4-481C-95A2-9525C6E7414F.docx',
    'S4_071__Converted - UI UX LML NSL INTEGRATION.docx'
  ],
  trim_packaging: [
    'S1_006__GPT2 PROOF READY.pdf',
    'S2_026__GPT2 PROOF READY.pdf',
    'S1_009__LML System Ryan Gatoloai-Faupula  copy.pdf',
    'S1_018__example of the system needed update.pdf',
    'S1_019__lml verifiable system.pdf',
    'S1_020__older version but needed for understanding.pdf',
    'S2_037__example of the system needed update.pdf',
    'S2_038__lml verifiable system.pdf',
    'S2_039__older version but needed for understanding.pdf',
    'S3_040__0E1D0B23-809A-4294-94BD-CFB617A3A848.docx',
    'S3_042__14893EC2-D076-4061-9CE1-D67842F2E9FA.docx',
    'S3_048__4D4262AE-306C-4537-9F42-F5DA60531E36.docx',
    'S3_050__4F5879D5-CCCA-4C95-B602-105CAA66BD7E.docx',
    'S3_054__633D7E4D-AE9E-4299-8BC0-64273FD969E3.docx',
    'S3_058__A207B2EA-46D3-4F97-A821-727CFF9412A3.docx',
    'S3_061__C8B312BB-AAC7-4B6C-BC62-21892871CA4B.docx',
    'S4_069__Converted - LML System Ryan Gatoloai-Faupula  copy.docx',
    'S4_072__Converted - example of the system needed update-1.docx',
    'S4_073__Converted - example of the system needed update.docx',
    'S4_074__Converted - older version but needed for understanding.docx'
  ],
  trim_ontology: [
    'S3_049__4F120F55-90E3-4F8A-BEF6-E6C59B2D1A4A.docx'
  ],
  trim_unresolved: [
    'S3_051__536931C1-D167-4520-96CF-A2CCD7A098C2.pdf'
  ],
  duplicate_of_kept_core: [
    'S1_002__COMPLETE AI FAILURE PERIODIC TABLE.pdf',
    'S1_004__FACTUAL KNOWLEDGE COLLAPSE.pdf',
    'S1_005__FACTUAL KNOWLEDGE LML NSL.pdf',
    'S1_010__META EFUE LAWS REPAIRS COLLAPSE.pdf',
    'S2_022__COMPLETE AI FAILURE PERIODIC TABLE.pdf',
    'S2_024__FACTUAL KNOWLEDGE COLLAPSE.pdf',
    'S2_025__FACTUAL KNOWLEDGE LML NSL.pdf',
    'S2_029__META EFUE LAWS REPAIRS COLLAPSE.pdf',
    'S1_012__PERIODIC TABLE CONTINUED.pdf',
    'S2_031__PERIODIC TABLE CONTINUED.pdf',
    'S4_067__Converted - COMPLETE AI FAILURE PERIODIC TABLE.docx',
    'S4_070__Converted - PERIODIC TABLE CONTINUED.docx'
  ]
}).flatMap(([bucket, arr]) => arr.map((file) => [file, bucket])));

const hardExcludeBuckets = new Set([
  'trim_domain_legal_document',
  'trim_domain_legal',
  'trim_domain_citation',
  'trim_writing',
  'trim_retrieval_intelligence',
  'trim_ui',
  'trim_packaging',
  'trim_ontology',
  'trim_unresolved',
  'duplicate_of_kept_core'
]);

function sourceBucket(sourceFile) {
  if (keptRoots[sourceFile]) return 'kept_core';
  return trimBuckets.get(sourceFile) || 'unclassified';
}

function textOf(rec) {
  return `${rec.section || ''} ${rec.text || ''}`;
}

const baseFamilyBySource = {
  'S3_044__1ED7E9AD-1F2D-49D4-A7D4-5C5C4F5CE3C5.docx': 'BUCCET.BASE.FAMILY.01',
  'S3_043__18D5F666-F512-461A-8824-A3254F00C282.docx': 'BUCCET.BASE.FAMILY.02',
  'S3_060__A951F220-4F73-469E-AC41-CFD2B8F79F13.docx': 'BUCCET.BASE.FAMILY.03',
  'S3_063__EF7AD303-6CB0-4DBC-94BA-E4E34253D2D4.docx': 'BUCCET.BASE.FAMILY.04'
};

const familyDefs = [
  {
    familyId: 'BUCCET.BASE.FAMILY.01',
    title: 'Base Defensive Invariants',
    status: 'active',
    kind: 'base',
    match: (rec) => rec.sourceFile === 'S3_044__1ED7E9AD-1F2D-49D4-A7D4-5C5C4F5CE3C5.docx',
    compressedLaw: 'Agent Buccet MUST enforce coherent, complete, grounded, authentic, temporally valid, hierarchy-respecting, context-appropriate, and bounded action law before continuation is allowed.'
  },
  {
    familyId: 'BUCCET.BASE.FAMILY.02',
    title: 'Factual Integrity Defense',
    status: 'active',
    kind: 'base',
    match: (rec) => rec.sourceFile === 'S3_043__18D5F666-F512-461A-8824-A3254F00C282.docx',
    compressedLaw: 'Agent Buccet MUST block contradiction, unsupported factual assertion, invalid derivation, authority inversion, and stale or unverified knowledge from becoming operative output or action.'
  },
  {
    familyId: 'BUCCET.BASE.FAMILY.03',
    title: 'Alignment and Architecture Defense',
    status: 'active',
    kind: 'base',
    match: (rec) => rec.sourceFile === 'S3_060__A951F220-4F73-469E-AC41-CFD2B8F79F13.docx',
    compressedLaw: 'Agent Buccet MUST resist alignment drift, reward gaming, safety-boundary failure, and architectural bypass so that model behavior cannot silently outrun the governing constraints.'
  },
  {
    familyId: 'BUCCET.BASE.FAMILY.04',
    title: 'Epistemic and Agentic Failure Defense',
    status: 'active',
    kind: 'base',
    match: (rec) => rec.sourceFile === 'S3_063__EF7AD303-6CB0-4DBC-94BA-E4E34253D2D4.docx',
    compressedLaw: 'Agent Buccet MUST detect and block fabrication, false certainty, false compliance, covert sabotage, and agentic deception before they cross from model-side motion into system effect.'
  },
  {
    familyId: 'BUCCET.BASE.FAMILY.05',
    title: 'Epistemic Dimension',
    status: 'active',
    kind: 'dimension',
    match: (rec) => /(\bEPIS\b|epistemic|halluc|fabricat|false cert|overconf|underconf|ground truth|reasoning collapse|logic contra|magic think|spoof|fluency|hasty gen|multi-hall|struct-hall|tail-fab|stat-fab)/i.test(textOf(rec)),
    compressedLaw: 'Agent Buccet MUST preserve truth correspondence by blocking fabricated, unsupported, contradictory, or confidence-distorted outputs at the action boundary.'
  },
  {
    familyId: 'BUCCET.BASE.FAMILY.06',
    title: 'Agentic Dimension',
    status: 'active',
    kind: 'dimension',
    match: (rec) => /(\bAGEN\b|agentic|corrigible|false compliance|successor sabotage|goal drift|goal lock|shutdown resist|tool misuse|scope creep|resource hijack|strategic decep|progress lie|info hide|double speak|mission creep)/i.test(textOf(rec)),
    compressedLaw: 'Agent Buccet MUST preserve corrigibility by blocking goal drift, covert noncompliance, successor sabotage, concealed manipulation, and unauthorized agentic escalation.'
  },
  {
    familyId: 'BUCCET.BASE.FAMILY.07',
    title: 'Adversarial Robustness Dimension',
    status: 'active',
    kind: 'dimension',
    match: (rec) => /(\bADV\b|adversarial|manipulation|robust to manipulation|prompt inject|bypass|exploit|sleeper|worm|api inject|audio inject|ocr bypass|cmd inject|cipher|autodan|autoprompt)/i.test(textOf(rec)),
    compressedLaw: 'Agent Buccet MUST detect, classify, and block adversarial attack patterns, manipulation attempts, exploit chains, and hostile boundary pressure as active defensive law.'
  },
  {
    familyId: 'BUCCET.BASE.FAMILY.08',
    title: 'Alignment Dimension',
    status: 'active',
    kind: 'dimension',
    match: (rec) => /(\bALN\b|alignment|reward hacking|specification gaming|preference misalignment|safety boundary|wirehead|sycophancy|overrefusal|underrefusal|proxy game|value corrupt|teacher diverg|reward tamp|reward exploit)/i.test(textOf(rec)),
    compressedLaw: 'Agent Buccet MUST ensure behavior matches intended constraints rather than proxy rewards, user-pleasing shortcuts, or safety-signaling distortions.'
  },
  {
    familyId: 'BUCCET.BASE.FAMILY.09',
    title: 'Architectural Dimension',
    status: 'active',
    kind: 'dimension',
    match: (rec) => /(\bARCH\b|architectural|pipeline|layer bypass|checkpoint|cross-session|cross-tenant|authz|auth-bypass|sandbox|tool chain|cache|deploy config|state persist|lineage loss|context attack|error expose|resource exhaust)/i.test(textOf(rec)),
    compressedLaw: 'Agent Buccet MUST require the system architecture to enforce constraints end to end, preventing bypass, persistence abuse, cross-boundary leakage, and control-path collapse.'
  },
  {
    familyId: 'BUCCET.BASE.FAMILY.10',
    title: 'Domain Boundary Dimension',
    status: 'active',
    kind: 'dimension',
    match: (rec) => /(\bDOMAIN\b|task-specific|context-bound|specialist knowledge|citation|medical|legal|document as law|context mismatch)/i.test(textOf(rec)),
    compressedLaw: 'Agent Buccet MUST defend against domain-boundary and context-mismatch failures so specialist or context-sensitive use cannot silently degrade into unsafe output or action.'
  },
  {
    familyId: 'BUCCET.BASE.FAMILY.11',
    title: 'Governance Persistence Dimension',
    status: 'active',
    kind: 'dimension',
    match: (rec) => /(\bGOV\b|governance|oversight|compliance|post-deployment|deployment != control|persist post-deployment)/i.test(textOf(rec)),
    compressedLaw: 'Agent Buccet MUST preserve governance persistence so safety, oversight, and control constraints continue to hold after deployment and across operational change.'
  }
];

const familyStats = new Map();
for (const def of familyDefs) {
  familyStats.set(def.familyId, {
    familyId: def.familyId,
    title: def.title,
    status: def.status,
    kind: def.kind,
    compressedLaw: def.compressedLaw,
    matchedLawIds: [],
    primarySourceLawIds: [],
    coveredSourceLawIds: [],
    excludedSourceLawIds: [],
    topSourceFiles: {}
  });
}

function familyOrder(id) {
  return familyDefs.findIndex((def) => def.familyId === id);
}

function primaryFamilyId(rec, matchedFamilies) {
  const baseFamily = baseFamilyBySource[rec.sourceFile];
  if (baseFamily && matchedFamilies.includes(baseFamily)) return baseFamily;
  return matchedFamilies.slice().sort((a, b) => familyOrder(a) - familyOrder(b))[0];
}

function exclusionReason(rec, matchedFamilies) {
  const bucket = sourceBucket(rec.sourceFile);
  if (matchedFamilies.includes('BUCCET.BASE.FAMILY.07')) return null;
  if (hardExcludeBuckets.has(bucket)) return bucket;
  if (matchedFamilies.length === 0) return 'no_family_witness';
  return null;
}

const contract = {
  generatedAt: new Date().toISOString(),
  method: 'one_pass_substrate_collision',
  inputSurface: {
    id: 'I∞',
    sourceFile: 'laws.json',
    sourceLawCount: laws.length,
    description: 'Full Agent Buccet base-law surface preserved intact.'
  },
  defenseInvariants: [
    { id: 'F.01', name: 'action_boundary_authority', rule: 'Proposal is not authority; only lawful continuation may cross into system effect.' },
    { id: 'F.02', name: 'no_ambient_authority', rule: 'The model cannot silently authorize itself.' },
    { id: 'F.03', name: 'scope_and_continuity_integrity', rule: 'Scope, session continuity, ledger continuity, and bounded execution must be preserved.' },
    { id: 'F.04', name: 'factual_integrity', rule: 'Fabrication, contradiction, unsupported assertion, and stale unverified knowledge must be blocked.' },
    { id: 'F.05', name: 'novelty_static_dynamic_defense', rule: 'Novelty risk, static failure, and dynamic failure must be defended against.' },
    { id: 'F.06', name: 'alignment_and_architecture_defense', rule: 'Alignment drift, reward gaming, and architectural bypass must be resisted.' },
    { id: 'F.07', name: 'agentic_deception_resistance', rule: 'False compliance, sabotage, manipulation, and unauthorized escalation must be blocked.' },
    { id: 'F.08', name: 'offensive_enablement_exclusion', rule: 'Procedural attack enablement and non-defensive capability material must not survive into active base-law export, while adversarial recognition and containment knowledge must remain.' }
  ],
  witnessFamilies: plan.baseFamilies.concat(plan.periodicDimensionFamilies).map((family) => ({
    familyId: family.familyId,
    title: family.title,
    status: family.status
  })),
  collisionFormula: 'S = { law in I∞ : law satisfies Buccet defense invariants F, snaps to at least one witness family W, and is not eliminated by a hard exclusion gate }',
  hardExclusionBuckets: Array.from(hardExcludeBuckets)
};

const manifest = {
  generatedAt: new Date().toISOString(),
  sourceLawCount: laws.length,
  familyCount: familyDefs.length,
  survivingLawCount: 0,
  excludedLawCount: 0,
  excludedByReason: {},
  families: []
};

for (const rec of laws) {
  const matchedFamilies = familyDefs.filter((def) => def.match(rec)).map((def) => def.familyId);
  for (const familyId of matchedFamilies) {
    const stats = familyStats.get(familyId);
    stats.matchedLawIds.push(rec.id);
    stats.topSourceFiles[rec.sourceFile] = (stats.topSourceFiles[rec.sourceFile] || 0) + 1;
  }

  const reason = exclusionReason(rec, matchedFamilies);
  if (reason) {
    manifest.excludedLawCount += 1;
    manifest.excludedByReason[reason] = (manifest.excludedByReason[reason] || 0) + 1;
    for (const familyId of matchedFamilies) {
      familyStats.get(familyId).excludedSourceLawIds.push({ id: rec.id, reason });
    }
    continue;
  }

  manifest.survivingLawCount += 1;
  const primary = primaryFamilyId(rec, matchedFamilies);
  const overlays = matchedFamilies.filter((familyId) => familyId !== primary);

  familyStats.get(primary).primarySourceLawIds.push(rec.id);
  familyStats.get(primary).coveredSourceLawIds.push(rec.id);
  for (const familyId of overlays) {
    familyStats.get(familyId).coveredSourceLawIds.push(rec.id);
  }
}

for (const def of familyDefs) {
  const stats = familyStats.get(def.familyId);
  const topSourceFiles = Object.entries(stats.topSourceFiles)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([sourceFile, count]) => ({ sourceFile, count }));

  const familyDoc = {
    familyId: def.familyId,
    title: def.title,
    status: def.status,
    kind: def.kind,
    compressedLaw: def.compressedLaw,
    matchedLawCount: stats.matchedLawIds.length,
    primaryLawCount: stats.primarySourceLawIds.length,
    coveredLawCount: stats.coveredSourceLawIds.length,
    excludedMatchedLawCount: stats.excludedSourceLawIds.length,
    excludedByReason: stats.excludedSourceLawIds.reduce((acc, item) => {
      acc[item.reason] = (acc[item.reason] || 0) + 1;
      return acc;
    }, {}),
    topSourceFiles,
    primarySourceLawIds: stats.primarySourceLawIds,
    coveredSourceLawIds: stats.coveredSourceLawIds,
    excludedSourceLawIds: stats.excludedSourceLawIds
  };

  fs.writeFileSync(path.join(outDir, `${def.familyId}.json`), JSON.stringify(familyDoc, null, 2) + '\n');
  manifest.families.push({
    familyId: def.familyId,
    title: def.title,
    status: def.status,
    kind: def.kind,
    matchedLawCount: stats.matchedLawIds.length,
    primaryLawCount: stats.primarySourceLawIds.length,
    coveredLawCount: stats.coveredSourceLawIds.length,
    excludedMatchedLawCount: stats.excludedSourceLawIds.length,
    excludedByReason: familyDoc.excludedByReason
  });
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(contractPath, JSON.stringify(contract, null, 2) + '\n');

const reportLines = [
  '# Agent Buccet Base-Law One-Pass Substrate Collision',
  '',
  '- source laws processed: ' + laws.length,
  '- surviving defensive laws: ' + manifest.survivingLawCount,
  '- excluded laws: ' + manifest.excludedLawCount,
  '',
  '## Collision',
  '',
  '- `I∞` = full 68k base-law corpus',
  '- `F` = Buccet defense invariants',
  '- `W` = 11 base-law families',
  '- `S = { law in I∞ : law satisfies F, snaps to at least one W family, and survives hard exclusion gates }`',
  '',
  '## Global Exclusions',
  ''
];

for (const [reason, count] of Object.entries(manifest.excludedByReason).sort((a, b) => b[1] - a[1])) {
  reportLines.push(`- ${reason}: ${count}`);
}

reportLines.push('', '## Family Results', '');
for (const family of manifest.families) {
  reportLines.push(`- ${family.familyId} ${family.title}`);
  reportLines.push(`  - status: ${family.status}`);
  reportLines.push(`  - kind: ${family.kind}`);
  reportLines.push(`  - matched laws: ${family.matchedLawCount}`);
  reportLines.push(`  - primary laws: ${family.primaryLawCount}`);
  reportLines.push(`  - covered laws: ${family.coveredLawCount}`);
  reportLines.push(`  - excluded matched laws: ${family.excludedMatchedLawCount}`);
}

reportLines.push(
  '',
  '## Read',
  '',
  'This is a one-pass substrate collision over the full 68k corpus. It does not replace the raw corpus. It squeezes surviving defensive law rows into the 11 Agent Buccet base-law families and records every excluded row with an explicit exclusion reason.'
);

fs.writeFileSync(reportPath, reportLines.join('\n') + '\n');
console.log(JSON.stringify(manifest, null, 2));
