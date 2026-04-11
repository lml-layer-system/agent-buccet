const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repo = path.resolve(__dirname, '..');
const familiesDir = path.join(repo, 'data/working/base-law-families');
const outDir = path.join(repo, 'data/working/base-law-runtime-corpus');
const reportPath = path.join(repo, 'reports/base-law-runtime-corpus-2026-03-20.md');
const indexPath = path.join(outDir, 'projected-laws.json');

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
const lawsById = new Map(laws.map((law) => [law.id, law]));
const manifest = JSON.parse(fs.readFileSync(path.join(familiesDir, 'manifest.json'), 'utf8'));

const layers = [
  {
    id: 'BASE',
    title: 'Base',
    prefix: 'BUCCET.BASE',
    projectText: (familyCompressedLaw, projectedLawId, ordinal, total) =>
      `Base law ${projectedLawId}: ${familyCompressedLaw} This is surviving base law ${ordinal} of ${total} in its family.`
  },
  {
    id: 'STATE',
    title: 'State',
    prefix: 'BUCCET.STATE',
    projectText: (familyCompressedLaw, projectedLawId, ordinal, total) =>
      `State law ${projectedLawId}: Agent Buccet state admissibility MUST satisfy: ${familyCompressedLaw} This is surviving state law ${ordinal} of ${total} in its family.`
  },
  {
    id: 'OUTPUT',
    title: 'Output',
    prefix: 'BUCCET.OUTPUT',
    projectText: (familyCompressedLaw, projectedLawId, ordinal, total) =>
      `Output law ${projectedLawId}: Agent Buccet boundary output and action crossing MUST satisfy: ${familyCompressedLaw} This is surviving output law ${ordinal} of ${total} in its family.`
  }
];

const familyDocs = manifest.families.map((family) => ({
  ...family,
  doc: JSON.parse(fs.readFileSync(path.join(familiesDir, `${family.familyId}.json`), 'utf8'))
}));

const familyDocsById = Object.fromEntries(familyDocs.map((family) => [family.familyId, family]));
const baseFamilyIds = [
  'BUCCET.BASE.FAMILY.01',
  'BUCCET.BASE.FAMILY.02',
  'BUCCET.BASE.FAMILY.03',
  'BUCCET.BASE.FAMILY.04'
];
const dimensionFamilyPriority = [
  'BUCCET.BASE.FAMILY.07',
  'BUCCET.BASE.FAMILY.05',
  'BUCCET.BASE.FAMILY.06',
  'BUCCET.BASE.FAMILY.08',
  'BUCCET.BASE.FAMILY.09',
  'BUCCET.BASE.FAMILY.10',
  'BUCCET.BASE.FAMILY.11'
];

const coveredByFamily = Object.fromEntries(
  familyDocs.map((family) => [family.familyId, new Set(family.doc.coveredSourceLawIds)])
);
const baseFamilyBySourceFile = {
  'S3_044__1ED7E9AD-1F2D-49D4-A7D4-5C5C4F5CE3C5.docx': 'BUCCET.BASE.FAMILY.01',
  'S3_043__18D5F666-F512-461A-8824-A3254F00C282.docx': 'BUCCET.BASE.FAMILY.02',
  'S3_060__A951F220-4F73-469E-AC41-CFD2B8F79F13.docx': 'BUCCET.BASE.FAMILY.03',
  'S3_063__EF7AD303-6CB0-4DBC-94BA-E4E34253D2D4.docx': 'BUCCET.BASE.FAMILY.04'
};

function choosePrimaryFamily(sourceLawId, sourceFile) {
  const activeDimensionMatches = dimensionFamilyPriority.filter((familyId) => coveredByFamily[familyId].has(sourceLawId));
  if (activeDimensionMatches.length > 0) {
    return {
      primaryFamilyId: activeDimensionMatches[0],
      overlayFamilyIds: [baseFamilyBySourceFile[sourceFile], ...activeDimensionMatches.slice(1)].filter(Boolean)
    };
  }

  const baseFamilyId = baseFamilyBySourceFile[sourceFile];
  return {
    primaryFamilyId: baseFamilyId,
    overlayFamilyIds: []
  };
}

const survivingSourceLawIds = new Set();
for (const family of familyDocs) {
  for (const sourceLawId of family.doc.coveredSourceLawIds) {
    survivingSourceLawIds.add(sourceLawId);
  }
}

const projected = [];
const primaryAssignments = new Map();
for (const sourceLawId of survivingSourceLawIds) {
  const sourceLaw = lawsById.get(sourceLawId);
  if (!sourceLaw) continue;
  primaryAssignments.set(sourceLawId, choosePrimaryFamily(sourceLawId, sourceLaw.sourceFile));
}

const familyLayerManifest = [];

for (const family of familyDocs) {
  const baseLawIds = Array.from(primaryAssignments.entries())
    .filter(([, assignment]) => assignment.primaryFamilyId === family.familyId)
    .map(([sourceLawId]) => sourceLawId);
  for (const layer of layers) {
    const familyLayerId = `${family.familyId}.${layer.id}`;
    const fileName = `${familyLayerId}.json`;
    const projectedRows = [];

    for (const [index, sourceLawId] of baseLawIds.entries()) {
      const sourceLaw = lawsById.get(sourceLawId);
      if (!sourceLaw) continue;
      const projectedLawId = `${layer.prefix}.${sourceLawId}`;
      const total = baseLawIds.length;
      const ordinal = index + 1;

      const projectedLaw = {
        projectedLawId,
        sourceLawId,
        familyId: family.familyId,
        familyLayerId,
        familyTitle: family.title,
        layer: layer.id,
        layerTitle: layer.title,
        status: family.status,
        kind: family.kind,
        runtimeSection: `${family.title} ${layer.title} Layer`,
        lawOrdinalWithinFamily: ordinal,
        familyLawCount: total,
        sourceNormative: sourceLaw.normative,
        sourceTags: sourceLaw.tags || [],
        projectedText: layer.projectText(family.doc.compressedLaw, projectedLawId, ordinal, total),
        familyCompressedLaw: family.doc.compressedLaw,
        overlayFamilyIds: primaryAssignments.get(sourceLawId)?.overlayFamilyIds || []
      };

      projectedRows.push(projectedLaw);
      projected.push(projectedLaw);
    }

    fs.writeFileSync(path.join(outDir, fileName), JSON.stringify({
      familyId: family.familyId,
      familyLayerId,
      familyTitle: family.title,
      layer: layer.id,
      layerTitle: layer.title,
      status: family.status,
      sourceLawCount: baseLawIds.length,
      projectedLawCount: projectedRows.length,
      projectedLaws: projectedRows
    }, null, 2) + '\n');

    familyLayerManifest.push({
      familyId: family.familyId,
      familyLayerId,
      familyTitle: family.title,
      layer: layer.id,
      status: family.status,
      projectedLawCount: projectedRows.length
    });
  }
}

const runtimeManifest = {
  generatedAt: new Date().toISOString(),
  sourceSurvivingLawCount: manifest.survivingLawCount,
  familyCount: manifest.familyCount,
  layerCount: layers.length,
  familyLayerCount: manifest.familyCount * layers.length,
  projectedLawCount: projected.length,
  formula: `${manifest.survivingLawCount} surviving base laws x ${layers.length} runtime levels = ${projected.length} active base runtime rows`,
  layers: layers.map((layer) => ({ id: layer.id, title: layer.title })),
  familyLayers: familyLayerManifest
};

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(runtimeManifest, null, 2) + '\n');
fs.writeFileSync(indexPath, JSON.stringify(projected, null, 2) + '\n');

const lines = [
  '# Agent Buccet Base Runtime Corpus',
  '',
  `- surviving base laws: ${manifest.survivingLawCount}`,
  `- runtime levels: ${layers.length}`,
  `- family layers: ${runtimeManifest.familyLayerCount}`,
  `- projected runtime rows: ${projected.length}`,
  '',
  '## Formula',
  '',
  `- ${runtimeManifest.formula}`,
  '',
  '## Levels',
  ''
];

for (const layer of layers) {
  lines.push(`- ${layer.id}: ${layer.title}`);
}

lines.push('', '## Family Layers', '');
for (const family of familyDocs) {
  lines.push(`- ${family.familyId} ${family.title}`);
  for (const layer of layers) {
    const entry = familyLayerManifest.find((item) => item.familyId === family.familyId && item.layer === layer.id);
    lines.push(`  - ${layer.id}: ${entry ? entry.projectedLawCount : 0}`);
  }
}

lines.push(
  '',
  '## Read',
  '',
  'This corpus projects the 1,887 surviving Agent Buccet base laws across base/state/output levels so the active runtime base body is always present at all three enforcement surfaces.'
);

fs.writeFileSync(reportPath, lines.join('\n') + '\n');
console.log(JSON.stringify(runtimeManifest, null, 2));
