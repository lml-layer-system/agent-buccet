#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const familyPath = path.join(repo, 'data/working/time-law-family/BUCCET.TIME.FAMILY.01.json');
const outDir = path.join(repo, 'data/working/time-law-runtime-corpus');
const reportPath = path.join(repo, 'reports/time-law-runtime-corpus-2026-03-20.md');
fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(familyPath)) {
  console.error(
    'Error: BUCCET.TIME.FAMILY.01.json not found.\n' +
    'The time-law family output was generated from the ancestor meta-law source document, which was removed after remodeling.\n' +
    'These generator scripts are preserved for provenance only and cannot be re-run without the source payload.'
  );
  process.exit(1);
}

const family = JSON.parse(fs.readFileSync(familyPath, 'utf8'));
const layers = [
  { id: 'BASE', title: 'Base', kind: 'time-base' },
  { id: 'STATE', title: 'State', kind: 'time-state' },
  { id: 'OUTPUT', title: 'Output', kind: 'time-output' },
  { id: 'TEMPORAL', title: 'Temporal', kind: 'time-temporal' }
];

function clean(value) {
  return String(value || '')
    .replace(/\bLML\b/gi, 'Agent Buccet')
    .replace(/\bNSL\b/gi, 'Agent Buccet time continuity')
    .replace(/\bMETA\b/gi, 'time')
    .replace(/\s+/g, ' ')
    .trim();
}

function continuityAnchorFor(layerId, law) {
  switch (layerId) {
    case 'BASE':
      return clean(law.detectionLogic || law.failureMode || law.stateForm || law.outputForm || law.title);
    case 'STATE':
      return clean(law.stateForm || law.detectionLogic || law.failureMode || law.outputForm || law.title);
    case 'OUTPUT':
      return clean(law.outputForm || law.detectionLogic || law.failureMode || law.stateForm || law.title);
    case 'TEMPORAL':
      return clean(law.failureMode || law.detectionLogic || law.stateForm || law.outputForm || law.title);
    default:
      return clean(law.detectionLogic || law.failureMode || law.stateForm || law.outputForm || law.title);
  }
}

const projectedLaws = [];
const familyLayers = [];
for (const layer of layers) {
  const familyLayerId = `${family.familyId}.${layer.id}`;
  const projected = family.sourceLaws.map((law, index) => {
    const suffix = law.runtimeLawSuffix || String(law.ancestorLawId).padStart(6, '0');
    const projectedLawId = `BUCCET.TIME.${layer.id}.LAW-${suffix}`;
    const anchor = continuityAnchorFor(layer.id, law);
    const projectedText = `${layer.title} time law ${projectedLawId}: ${family.compressedLaw} Source continuity anchor: ${anchor}. This is surviving ${layer.title.toLowerCase()} time law ${index + 1} of ${family.sourceLaws.length} in its family.`;
    return {
      projectedLawId,
      sourceLawId: law.sourceLawId,
      ancestorLawId: law.ancestorLawId ?? null,
      familyId: family.familyId,
      familyLayerId,
      familyTitle: family.title,
      layer: layer.id,
      layerTitle: layer.title,
      status: family.status,
      kind: layer.kind,
      runtimeSection: `${family.title} ${layer.title} Layer`,
      lawOrdinalWithinFamily: index + 1,
      familyLawCount: family.sourceLaws.length,
      category: law.category,
      gate: law.gate,
      projectedText,
      familyCompressedLaw: family.compressedLaw,
      continuityAnchor: anchor,
      overlayFamilyIds: [],
      sourceTags: law.sourceTags || [],
      sourceNormative: law.sourceNormative === true
    };
  });

  familyLayers.push({
    familyId: family.familyId,
    familyLayerId,
    familyTitle: family.title,
    layer: layer.id,
    status: family.status,
    projectedLawCount: projected.length
  });

  projectedLaws.push(...projected);

  fs.writeFileSync(
    path.join(outDir, `${familyLayerId}.json`),
    JSON.stringify({
      familyId: family.familyId,
      familyLayerId,
      familyTitle: family.title,
      layer: layer.id,
      layerTitle: layer.title,
      status: family.status,
      sourceLawCount: family.sourceLaws.length,
      projectedLawCount: projected.length,
      projectedLaws: projected
    }, null, 2) + '\n'
  );
}

const manifest = {
  generatedAt: new Date().toISOString(),
  sourceSurvivingLawCount: family.sourceLaws.length,
  familyCount: 1,
  layerCount: layers.length,
  familyLayerCount: familyLayers.length,
  projectedLawCount: projectedLaws.length,
  formula: `${family.sourceLaws.length} time laws x ${layers.length} runtime levels = ${projectedLaws.length} active time runtime rows`,
  layers: layers.map(({ id, title }) => ({ id, title })),
  familyLayers
};

const report = [
  '# Agent Buccet Time-Law Runtime Corpus',
  '',
  `- source time laws: ${family.sourceLaws.length}`,
  `- runtime layers: ${layers.length}`,
  `- projected runtime rows: ${projectedLaws.length}`,
  '',
  'Formula:',
  `- ${manifest.formula}`,
  '',
  'Family layers:',
  ...familyLayers.map((item) => `- ${item.familyLayerId}: ${item.projectedLawCount}`)
].join('\n');

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'projected-laws.json'), JSON.stringify(projectedLaws, null, 2) + '\n');
fs.writeFileSync(reportPath, report + '\n');

console.log(`projected time laws=${projectedLaws.length}`);
