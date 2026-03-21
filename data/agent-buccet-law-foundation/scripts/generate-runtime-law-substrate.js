#!/usr/bin/env node

const path = require('path');
const { performance } = require('perf_hooks');
const { writeRuntimeSubstrate } = require('../runtime/agent-buccet-law-substrate');

const repoRoot = path.resolve(__dirname, '..');
const started = performance.now();
const { outDir, substrate } = writeRuntimeSubstrate({ repoRoot });
const elapsedMs = performance.now() - started;

console.log(JSON.stringify({
  outDir,
  activeBaseLawCount: substrate.manifest.activeBaseLawCount,
  activeTimeLawCount: substrate.manifest.activeTimeLawCount,
  activeLawBodyCount: substrate.manifest.activeLawBodyCount,
  substrateFamilyCount: substrate.manifest.substrateFamilyCount,
  substrateSourceKernelCount: substrate.manifest.substrateSourceKernelCount,
  runtimeSubstrateBytes: substrate.manifest.sizes.runtimeSubstrateBytes,
  materializedActiveLawBodyBytes: substrate.manifest.sizes.materializedActiveLawBodyBytes,
  reductionRatio: Number((1 - substrate.manifest.sizes.runtimeSubstrateBytes / substrate.manifest.sizes.materializedActiveLawBodyBytes).toFixed(6)),
  buildMs: Number(elapsedMs.toFixed(3))
}, null, 2));
