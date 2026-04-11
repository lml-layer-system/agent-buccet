const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_BASE_LAYER_IDS = ['BASE', 'STATE', 'OUTPUT'];
const DEFAULT_TIME_LAYER_IDS = ['BASE', 'STATE', 'OUTPUT', 'TEMPORAL'];

const BASE_LAYER_TEMPLATES = {
  BASE: (familyLaw, projectedLawId, ordinal, total) => `Base law ${projectedLawId}: ${familyLaw} This is surviving base law ${ordinal} of ${total} in its family.`,
  STATE: (familyLaw, projectedLawId, ordinal, total) => `State law ${projectedLawId}: Agent Buccet state admissibility MUST satisfy: ${familyLaw} This is surviving state law ${ordinal} of ${total} in its family.`,
  OUTPUT: (familyLaw, projectedLawId, ordinal, total) => `Output law ${projectedLawId}: Agent Buccet boundary output and action crossing MUST satisfy: ${familyLaw} This is surviving output law ${ordinal} of ${total} in its family.`
};

const TIME_LAYER_TEMPLATES = {
  BASE: (familyLaw, projectedLawId, anchor, ordinal, total) => `Base time law ${projectedLawId}: ${familyLaw} Source continuity anchor: ${anchor}. This is surviving base time law ${ordinal} of ${total} in its family.`,
  STATE: (familyLaw, projectedLawId, anchor, ordinal, total) => `State time law ${projectedLawId}: ${familyLaw} Source continuity anchor: ${anchor}. This is surviving state time law ${ordinal} of ${total} in its family.`,
  OUTPUT: (familyLaw, projectedLawId, anchor, ordinal, total) => `Output time law ${projectedLawId}: ${familyLaw} Source continuity anchor: ${anchor}. This is surviving output time law ${ordinal} of ${total} in its family.`,
  TEMPORAL: (familyLaw, projectedLawId, anchor, ordinal, total) => `Temporal time law ${projectedLawId}: ${familyLaw} Source continuity anchor: ${anchor}. This is surviving temporal time law ${ordinal} of ${total} in its family.`
};

function sha(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getRepoRoot(repoRoot) {
  return repoRoot || path.resolve(__dirname, '..');
}

function readJson(repoRoot, relativePath) {
  const absolutePath = path.join(getRepoRoot(repoRoot), relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Missing required input: ${relativePath}`);
  }
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function attachExecutionSurface(substrate) {
  if (!substrate.substrate.base.layerIds) substrate.substrate.base.layerIds = DEFAULT_BASE_LAYER_IDS.slice();
  if (!substrate.substrate.time.layerIds) substrate.substrate.time.layerIds = DEFAULT_TIME_LAYER_IDS.slice();
  substrate.substrate.base.layerTemplates = BASE_LAYER_TEMPLATES;
  substrate.substrate.time.layerTemplates = TIME_LAYER_TEMPLATES;
  if (!substrate.substrate.base.familyMap) {
    substrate.substrate.base.familyMap = Object.create(null);
    for (const family of substrate.substrate.base.families) {
      substrate.substrate.base.familyMap[family.familyId] = family;
    }
  }
  return substrate;
}

function stripExecutionSurface(substrate) {
  return {
    ...substrate,
    substrate: {
      ...substrate.substrate,
      base: {
        layerIds: substrate.substrate.base.layerIds,
        familyOrder: substrate.substrate.base.familyOrder,
        sourceFamilyIndex: substrate.substrate.base.sourceFamilyIndex,
        families: substrate.substrate.base.families
      },
      time: {
        layerIds: substrate.substrate.time.layerIds,
        family: substrate.substrate.time.family
      }
    }
  };
}

function resolveProjectedLaw(substrateInput, projectedLawId) {
  const substrate = attachExecutionSurface(substrateInput);
  let match = /^BUCCET\.(BASE|STATE|OUTPUT)\.LAW-(\d+)$/.exec(projectedLawId);
  if (match) {
    const layer = match[1];
    const sourceLawId = `LAW-${match[2]}`;
    const familyId = substrate.substrate.base.sourceFamilyIndex[sourceLawId];
    if (!familyId) return null;
    const family = substrate.substrate.base.familyMap[familyId];
    if (!family) return null;
    const idx = family.sourceIndex[sourceLawId];
    const src = family.sourceRows[idx];
    const ordinal = idx + 1;
    const total = family.sourceRows.length;
    return {
      projectedLawId,
      sourceLawId,
      familyId,
      familyLayerId: `${familyId}.${layer}`,
      familyTitle: family.familyTitle,
      layer,
      layerTitle: layer[0] + layer.slice(1).toLowerCase(),
      status: family.status,
      kind: family.kind,
      runtimeSection: `${family.familyTitle} ${layer[0] + layer.slice(1).toLowerCase()} Layer`,
      lawOrdinalWithinFamily: ordinal,
      familyLawCount: total,
      sourceNormative: src.sourceNormative,
      sourceTags: src.sourceTags,
      projectedText: substrate.substrate.base.layerTemplates[layer](family.familyCompressedLaw, projectedLawId, ordinal, total),
      familyCompressedLaw: family.familyCompressedLaw,
      overlayFamilyIds: src.overlayFamilyIds,
      corpusPartition: 'base'
    };
  }

  match = /^BUCCET\.TIME\.(BASE|STATE|OUTPUT|TEMPORAL)\.LAW-(.+)$/.exec(projectedLawId);
  if (match) {
    const layer = match[1];
    const suffix = match[2];
    const family = substrate.substrate.time.family;
    const idx = family.suffixIndex[suffix];
    if (idx == null) return null;
    const src = family.sourceRows[idx];
    const ordinal = idx + 1;
    const total = family.sourceRows.length;
    const layerTitle = layer[0] + layer.slice(1).toLowerCase();
    const anchor = src.anchors[layer];
    return {
      projectedLawId,
      sourceLawId: src.sourceLawId,
      ...(src.hasAncestorLawId ? { ancestorLawId: src.ancestorLawId } : {}),
      familyId: family.familyId,
      familyLayerId: `${family.familyId}.${layer}`,
      familyTitle: family.familyTitle,
      layer,
      layerTitle,
      status: family.status,
      kind: `time-${layer.toLowerCase()}`,
      runtimeSection: `${family.familyTitle} ${layerTitle} Layer`,
      lawOrdinalWithinFamily: ordinal,
      familyLawCount: total,
      category: src.category,
      gate: src.gate,
      projectedText: substrate.substrate.time.layerTemplates[layer](family.familyCompressedLaw, projectedLawId, anchor, ordinal, total),
      familyCompressedLaw: family.familyCompressedLaw,
      continuityAnchor: anchor,
      overlayFamilyIds: src.overlayFamilyIds,
      ...(src.hasSourceTags ? { sourceTags: src.sourceTags } : {}),
      ...(src.hasSourceNormative ? { sourceNormative: src.sourceNormative } : {}),
      corpusPartition: 'time'
    };
  }

  return null;
}

function materializeRuntimeLawBody(substrateInput) {
  const substrate = attachExecutionSurface(substrateInput);
  const rows = [];
  for (const family of substrate.substrate.base.families) {
    for (const layer of substrate.substrate.base.layerIds) {
      for (const src of family.sourceRows) {
        rows.push(resolveProjectedLaw(substrate, `BUCCET.${layer}.LAW-${src.sourceLawId.replace(/^LAW-/, '')}`));
      }
    }
  }
  for (const layer of substrate.substrate.time.layerIds) {
    for (const src of substrate.substrate.time.family.sourceRows) {
      rows.push(resolveProjectedLaw(substrate, `BUCCET.TIME.${layer}.LAW-${src.runtimeLawSuffix}`));
    }
  }
  return rows;
}

function selectTimeByGate(substrateInput, gate) {
  const substrate = attachExecutionSurface(substrateInput);
  const family = substrate.substrate.time.family;
  return (family.gateIndex[gate] || []).map((index) => family.sourceRows[index].sourceLawId);
}

function selectTimeByCategory(substrateInput, category) {
  const substrate = attachExecutionSurface(substrateInput);
  const family = substrate.substrate.time.family;
  return (family.categoryIndex[category] || []).map((index) => family.sourceRows[index].sourceLawId);
}

function buildRuntimeSubstrate(options = {}) {
  const repoRoot = getRepoRoot(options.repoRoot);
  const baseRows = readJson(repoRoot, 'data/working/base-law-runtime-corpus/projected-laws.json');
  const timeRows = readJson(repoRoot, 'data/working/time-law-runtime-corpus/projected-laws.json');

  const baseFamilies = new Map();
  const baseSourceFamily = Object.create(null);
  const baseFamilyOrder = [];

  for (const row of baseRows) {
    let family = baseFamilies.get(row.familyId);
    if (!family) {
      family = {
        familyId: row.familyId,
        familyTitle: row.familyTitle,
        status: row.status,
        kind: row.kind,
        familyCompressedLaw: row.familyCompressedLaw,
        sourceRows: [],
        sourceIndex: Object.create(null)
      };
      baseFamilies.set(row.familyId, family);
      baseFamilyOrder.push(row.familyId);
    }
    if (row.layer === 'BASE') {
      const idx = family.sourceRows.length;
      family.sourceIndex[row.sourceLawId] = idx;
      family.sourceRows.push({
        sourceLawId: row.sourceLawId,
        sourceNormative: row.sourceNormative,
        sourceTags: row.sourceTags,
        overlayFamilyIds: row.overlayFamilyIds
      });
      baseSourceFamily[row.sourceLawId] = row.familyId;
    }
  }

  const timeFamily = {
    familyId: timeRows[0].familyId,
    familyTitle: timeRows[0].familyTitle,
    status: timeRows[0].status,
    familyCompressedLaw: timeRows[0].familyCompressedLaw,
    sourceRows: [],
    suffixIndex: Object.create(null),
    gateIndex: Object.create(null),
    categoryIndex: Object.create(null)
  };

  for (const row of timeRows) {
    const suffix = row.projectedLawId.replace(/^BUCCET\.TIME\.[A-Z]+\.LAW-/, '');
    let idx = timeFamily.suffixIndex[suffix];
    if (idx == null) {
      idx = timeFamily.sourceRows.length;
      timeFamily.suffixIndex[suffix] = idx;
      const rec = {
        sourceLawId: row.sourceLawId,
        ancestorLawId: row.ancestorLawId ?? null,
        hasAncestorLawId: Object.prototype.hasOwnProperty.call(row, 'ancestorLawId'),
        runtimeLawSuffix: suffix,
        category: row.category,
        gate: row.gate,
        overlayFamilyIds: row.overlayFamilyIds,
        sourceTags: row.sourceTags || [],
        sourceNormative: row.sourceNormative === true,
        hasSourceTags: Object.prototype.hasOwnProperty.call(row, 'sourceTags'),
        hasSourceNormative: Object.prototype.hasOwnProperty.call(row, 'sourceNormative'),
        anchors: Object.create(null)
      };
      timeFamily.sourceRows.push(rec);
      if (!timeFamily.gateIndex[row.gate]) timeFamily.gateIndex[row.gate] = [];
      timeFamily.gateIndex[row.gate].push(idx);
      if (!timeFamily.categoryIndex[row.category]) timeFamily.categoryIndex[row.category] = [];
      timeFamily.categoryIndex[row.category].push(idx);
    }
    timeFamily.sourceRows[idx].anchors[row.layer] = row.continuityAnchor;
  }

  const substrate = attachExecutionSurface({
    specVersion: 1,
    generatedAt: new Date().toISOString(),
    concept: 'Agent Buccet Persistent CPU-Friendly Runtime Substrate',
    runtimeModel: {
      protectedBoundary: [
        'filesystem changes',
        'process execution',
        'network and recipient sends',
        'database mutations',
        'system and credential access'
      ],
      coreInvariants: [
        'agents can propose; they cannot authorize',
        'no ambient authority',
        'no out-of-scope actions',
        'no silent destructive tool use'
      ]
    },
    substrate: {
      base: {
        layerIds: DEFAULT_BASE_LAYER_IDS.slice(),
        familyOrder: baseFamilyOrder,
        sourceFamilyIndex: baseSourceFamily,
        families: baseFamilyOrder.map((familyId) => baseFamilies.get(familyId))
      },
      time: {
        layerIds: DEFAULT_TIME_LAYER_IDS.slice(),
        family: timeFamily
      }
    }
  });

  const materialized = materializeRuntimeLawBody(substrate);
  const portableSubstrate = stripExecutionSurface(substrate);
  const substrateString = JSON.stringify(portableSubstrate);
  const materializedString = JSON.stringify(materialized);

  substrate.manifest = {
    activeBaseLawCount: baseRows.length,
    activeTimeLawCount: timeRows.length,
    activeLawBodyCount: materialized.length,
    substrateFamilyCount: substrate.substrate.base.families.length + 1,
    substrateSourceKernelCount: substrate.substrate.base.families.reduce((count, family) => count + family.sourceRows.length, 0) + substrate.substrate.time.family.sourceRows.length,
    hashes: {
      runtimeSubstrateSha256: sha(substrateString),
      materializedActiveLawBodySha256: sha(materializedString)
    },
    sizes: {
      runtimeSubstrateBytes: Buffer.byteLength(substrateString),
      materializedActiveLawBodyBytes: Buffer.byteLength(materializedString)
    }
  };

  return substrate;
}

function writeRuntimeSubstrate(options = {}) {
  const repoRoot = getRepoRoot(options.repoRoot);
  const outDir = options.outDir || path.join(repoRoot, 'data/working/runtime-law-substrate');
  fs.mkdirSync(outDir, { recursive: true });

  const substrate = buildRuntimeSubstrate({ repoRoot });
  const portableSubstrate = stripExecutionSurface(substrate);

  fs.writeFileSync(path.join(outDir, 'agent-buccet-runtime-substrate.json'), JSON.stringify(portableSubstrate, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    activeBaseLawCount: substrate.manifest.activeBaseLawCount,
    activeTimeLawCount: substrate.manifest.activeTimeLawCount,
    activeLawBodyCount: substrate.manifest.activeLawBodyCount,
    substrateFamilyCount: substrate.manifest.substrateFamilyCount,
    substrateSourceKernelCount: substrate.manifest.substrateSourceKernelCount,
    hashes: substrate.manifest.hashes,
    sizes: substrate.manifest.sizes,
    artifactPaths: {
      substrate: 'data/working/runtime-law-substrate/agent-buccet-runtime-substrate.json',
      activeLawBodySource: 'data/working/active-law-body/projected-laws.json'
    }
  }, null, 2) + '\n');

  return { outDir, substrate };
}

function loadRuntimeSubstrate(options = {}) {
  const repoRoot = getRepoRoot(options.repoRoot);
  const substratePath = options.substratePath || path.join(repoRoot, 'data/working/runtime-law-substrate/agent-buccet-runtime-substrate.json');
  if (!fs.existsSync(substratePath)) {
    throw new Error(`Missing runtime substrate: ${substratePath}`);
  }
  return attachExecutionSurface(JSON.parse(fs.readFileSync(substratePath, 'utf8')));
}

module.exports = {
  buildRuntimeSubstrate,
  writeRuntimeSubstrate,
  loadRuntimeSubstrate,
  resolveProjectedLaw,
  materializeRuntimeLawBody,
  selectTimeByGate,
  selectTimeByCategory,
  stripExecutionSurface
};
