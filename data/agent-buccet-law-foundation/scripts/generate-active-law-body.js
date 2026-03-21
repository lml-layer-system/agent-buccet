#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..');
const outDir = path.join(repo, 'data/working/active-law-body');
fs.mkdirSync(outDir, { recursive: true });

function readJson(relativePath) {
  const absolutePath = path.join(repo, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required input: ${relativePath}`);
  }
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

const baseManifest = readJson('data/working/base-law-runtime-corpus/manifest.json');
const baseProjected = readJson('data/working/base-law-runtime-corpus/projected-laws.json');
const timeManifest = readJson('data/working/time-law-runtime-corpus/manifest.json');
const timeProjected = readJson('data/working/time-law-runtime-corpus/projected-laws.json');

const combinedProjected = [
  ...baseProjected.map((law) => ({ ...law, corpusPartition: 'base' })),
  ...timeProjected.map((law) => ({ ...law, corpusPartition: 'time' }))
];

const manifest = {
  generatedAt: new Date().toISOString(),
  baseProjectedLawCount: baseManifest.projectedLawCount,
  timeProjectedLawCount: timeManifest.projectedLawCount,
  projectedLawCount: combinedProjected.length,
  familyCount: baseManifest.familyCount + timeManifest.familyCount,
  formula: `${baseManifest.projectedLawCount} active base laws + ${timeManifest.projectedLawCount} active time laws = ${combinedProjected.length} full active Agent Buccet laws`,
  partitions: [
    {
      id: 'base',
      projectedLawCount: baseManifest.projectedLawCount,
      sourcePath: 'data/working/base-law-runtime-corpus/projected-laws.json'
    },
    {
      id: 'time',
      projectedLawCount: timeManifest.projectedLawCount,
      sourcePath: 'data/working/time-law-runtime-corpus/projected-laws.json'
    }
  ]
};

const index = { generatedAt: manifest.generatedAt, lawCount: combinedProjected.length, byId: {}, byFamilyLayer: {}, byFamily: {}, byLayer: {}, byPartition: {} };
for (let i = 0; i < combinedProjected.length; i++) {
  const law = combinedProjected[i];
  index.byId[law.projectedLawId] = i;
  const fl = law.familyLayerId;
  if (!index.byFamilyLayer[fl]) index.byFamilyLayer[fl] = [];
  index.byFamilyLayer[fl].push(i);
  const fam = law.familyId;
  if (!index.byFamily[fam]) index.byFamily[fam] = [];
  index.byFamily[fam].push(i);
  const layer = law.layer;
  if (!index.byLayer[layer]) index.byLayer[layer] = [];
  index.byLayer[layer].push(i);
  const part = law.corpusPartition;
  if (!index.byPartition[part]) index.byPartition[part] = [];
  index.byPartition[part].push(i);
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'projected-laws.json'), JSON.stringify(combinedProjected, null, 2) + '\n');
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2) + '\n');

console.log(`full active law body=${combinedProjected.length}`);
console.log(`law body index=${Object.keys(index.byId).length} entries, ${Object.keys(index.byFamilyLayer).length} family-layers`);
