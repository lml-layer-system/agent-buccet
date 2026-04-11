#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const contractPath = path.join(repoRoot, "UPSTREAM_TRANSFER_CONTRACT.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const contract = readJson(contractPath);
const requiredFiles = contract.sourcePayload.requiredFiles;

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  assert(fs.existsSync(absolutePath), `Missing required file: ${relativePath}`);
}

const baseManifest = readJson(
  path.join(repoRoot, "data/working/base-law-families/manifest.json"),
);
assert(typeof baseManifest === "object" && baseManifest !== null, "base-law-families manifest must be an object");
assert(
  baseManifest.survivingLawCount === contract.sourcePayload.survivingBaseLawCount,
  `surviving law count ${baseManifest.survivingLawCount} does not match expected ${contract.sourcePayload.survivingBaseLawCount}`,
);
assert(
  baseManifest.familyCount + contract.sourcePayload.timeFamilyCount === contract.sourcePayload.familyCount,
  `combined family count ${baseManifest.familyCount + contract.sourcePayload.timeFamilyCount} does not match expected ${contract.sourcePayload.familyCount}`,
);

const runtimeManifest = readJson(
  path.join(repoRoot, "data/working/base-law-runtime-corpus/manifest.json"),
);
assert(typeof runtimeManifest === "object" && runtimeManifest !== null, "base-law-runtime-corpus manifest must be an object");
assert(
  runtimeManifest.projectedLawCount === contract.sourcePayload.runtimeProjectedBaseLawCount,
  `base projected law count ${runtimeManifest.projectedLawCount} does not match expected ${contract.sourcePayload.runtimeProjectedBaseLawCount}`,
);
assert(
  runtimeManifest.layerCount === contract.sourcePayload.runtimeLayerCount,
  `runtime layer count ${runtimeManifest.layerCount} does not match expected ${contract.sourcePayload.runtimeLayerCount}`,
);

const projectedLaws = readJson(
  path.join(repoRoot, "data/working/base-law-runtime-corpus/projected-laws.json"),
);
assert(Array.isArray(projectedLaws), "projected-laws.json must be an array");
assert(
  projectedLaws.length === contract.sourcePayload.runtimeProjectedBaseLawCount,
  `base projected-laws.json row count ${projectedLaws.length} does not match expected ${contract.sourcePayload.runtimeProjectedBaseLawCount}`,
);

const timeFamilyManifest = readJson(
  path.join(repoRoot, "data/working/time-law-family/manifest.json"),
);
assert(typeof timeFamilyManifest === "object" && timeFamilyManifest !== null, "time-law-family manifest must be an object");
assert(
  timeFamilyManifest.familyCount === contract.sourcePayload.timeFamilyCount,
  `time family count ${timeFamilyManifest.familyCount} does not match expected ${contract.sourcePayload.timeFamilyCount}`,
);

const timeRuntimeManifest = readJson(
  path.join(repoRoot, "data/working/time-law-runtime-corpus/manifest.json"),
);
assert(typeof timeRuntimeManifest === "object" && timeRuntimeManifest !== null, "time-law-runtime-corpus manifest must be an object");
assert(
  timeRuntimeManifest.projectedLawCount === contract.sourcePayload.runtimeProjectedTimeLawCount,
  `time projected law count ${timeRuntimeManifest.projectedLawCount} does not match expected ${contract.sourcePayload.runtimeProjectedTimeLawCount}`,
);
assert(
  timeRuntimeManifest.layerCount === contract.sourcePayload.timeRuntimeLayerCount,
  `time runtime layer count ${timeRuntimeManifest.layerCount} does not match expected ${contract.sourcePayload.timeRuntimeLayerCount}`,
);

const timeProjectedLaws = readJson(
  path.join(repoRoot, "data/working/time-law-runtime-corpus/projected-laws.json"),
);
assert(Array.isArray(timeProjectedLaws), "time projected-laws.json must be an array");
assert(
  timeProjectedLaws.length === contract.sourcePayload.runtimeProjectedTimeLawCount,
  `time projected-laws.json row count ${timeProjectedLaws.length} does not match expected ${contract.sourcePayload.runtimeProjectedTimeLawCount}`,
);

const timeFamily = readJson(
  path.join(repoRoot, "data/working/time-law-family/BUCCET.TIME.FAMILY.01.json"),
);
assert(typeof timeFamily === "object" && timeFamily !== null, "time family payload must be an object");

const uplBehavioralSpec = readJson(
  path.join(repoRoot, "user-path-ledger-spec.json"),
);
assert(typeof uplBehavioralSpec === "object" && uplBehavioralSpec !== null, "root user-path-ledger behavioral spec must be an object");

const uplSpec = readJson(
  path.join(repoRoot, "data/working/user-path-ledger-spec.json"),
);
assert(typeof uplSpec === "object" && uplSpec !== null, "user-path-ledger spec must be an object");
assert(
  uplSpec.familyId === timeFamily.familyId,
  `UPL spec family ${uplSpec.familyId} does not match time family ${timeFamily.familyId}`,
);

const uplLawIds = new Set(
  (timeFamily.sourceLaws || [])
    .filter((law) => law.category === "user_path_ledger")
    .map((law) => law.sourceLawId),
);
assert(
  uplLawIds.size === uplSpec.governingLawCount,
  `UPL law count ${uplLawIds.size} does not match expected ${uplSpec.governingLawCount}`,
);
assert(
  uplBehavioralSpec.governingLawSpec === "data/working/user-path-ledger-spec.json",
  `root UPL behavioral spec points to unexpected governing spec ${uplBehavioralSpec.governingLawSpec}`,
);
assert(
  uplSpec.behavioralSpec === "../../../user-path-ledger-spec.json",
  `working UPL governing spec points to unexpected behavioral spec ${uplSpec.behavioralSpec}`,
);
assert(
  Array.isArray(uplBehavioralSpec.governingLaws) &&
    uplBehavioralSpec.governingLaws.length === uplSpec.governingLawCount,
  "root UPL behavioral spec governing law list does not match working governing law count",
);
for (const lawId of uplSpec.governingLaws) {
  assert(uplLawIds.has(lawId), `Missing UPL governing law in time family: ${lawId}`);
  assert(
    uplBehavioralSpec.governingLaws.includes(lawId),
    `Missing UPL governing law in root behavioral spec: ${lawId}`,
  );
}

const fullManifest = readJson(
  path.join(repoRoot, "data/working/active-law-body/manifest.json"),
);
assert(typeof fullManifest === "object" && fullManifest !== null, "active-law-body manifest must be an object");
assert(
  fullManifest.projectedLawCount === contract.sourcePayload.runtimeProjectedFullLawCount,
  `full active law count ${fullManifest.projectedLawCount} does not match expected ${contract.sourcePayload.runtimeProjectedFullLawCount}`,
);
assert(
  fullManifest.baseProjectedLawCount === contract.sourcePayload.runtimeProjectedBaseLawCount,
  `full manifest base count ${fullManifest.baseProjectedLawCount} does not match expected ${contract.sourcePayload.runtimeProjectedBaseLawCount}`,
);
assert(
  fullManifest.timeProjectedLawCount === contract.sourcePayload.runtimeProjectedTimeLawCount,
  `full manifest time count ${fullManifest.timeProjectedLawCount} does not match expected ${contract.sourcePayload.runtimeProjectedTimeLawCount}`,
);

const fullProjectedLaws = readJson(
  path.join(repoRoot, "data/working/active-law-body/projected-laws.json"),
);
assert(Array.isArray(fullProjectedLaws), "active-law-body projected-laws.json must be an array");
assert(
  fullProjectedLaws.length === contract.sourcePayload.runtimeProjectedFullLawCount,
  `full projected-laws.json row count ${fullProjectedLaws.length} does not match expected ${contract.sourcePayload.runtimeProjectedFullLawCount}`,
);

const index = readJson(path.join(repoRoot, "data/working/active-law-body/index.json"));
assert(typeof index === "object" && index !== null, "active-law-body index.json must be an object");
assert(
  index.lawCount === contract.sourcePayload.runtimeProjectedFullLawCount,
  `index lawCount ${index.lawCount} does not match expected ${contract.sourcePayload.runtimeProjectedFullLawCount}`,
);
assert(
  Object.keys(index.byId).length === contract.sourcePayload.runtimeProjectedFullLawCount,
  `index.byId key count ${Object.keys(index.byId).length} does not match expected ${contract.sourcePayload.runtimeProjectedFullLawCount}`,
);

const sourceKernelCount = new Set(fullProjectedLaws.map((row) => row.sourceLawId)).size;
assert(
  sourceKernelCount === contract.sourcePayload.survivingBaseLawCount + contract.sourcePayload.runtimeProjectedTimeLawCount / contract.sourcePayload.timeRuntimeLayerCount,
  `runtime-ready source kernel count ${sourceKernelCount} does not match expected ${contract.sourcePayload.survivingBaseLawCount + contract.sourcePayload.runtimeProjectedTimeLawCount / contract.sourcePayload.timeRuntimeLayerCount}`,
);

const attachPoints = contract.upstreamTarget.attachPoints;
assert(
  typeof attachPoints.foundationLoader === "string" && attachPoints.foundationLoader.length > 0,
  "Missing foundation loader attach point",
);
assert(
  Array.isArray(attachPoints.sessionContinuity) &&
    attachPoints.sessionContinuity.length >= 1,
  "Missing session continuity attach points",
);
assert(
  typeof attachPoints.userPathLedger === "string" && attachPoints.userPathLedger.length > 0,
  "Missing userPathLedger attach point",
);
assert(
  typeof attachPoints.userPathLedgerStore === "string" && attachPoints.userPathLedgerStore.length > 0,
  "Missing userPathLedgerStore attach point",
);

console.log("agent-buccet-base-laws manifest integrity: OK");
console.log("scope: file presence, count consistency, and runtime-ready active law body continuity");
console.log(`surviving base laws=${baseManifest.survivingLawCount}`);
console.log(`active base laws=${runtimeManifest.projectedLawCount}`);
console.log(`active time laws=${timeRuntimeManifest.projectedLawCount}`);
console.log(`full active law body=${fullManifest.projectedLawCount}`);
console.log(`runtime-ready source kernels=${sourceKernelCount}`);
console.log(`user path ledger governing laws=${uplLawIds.size}`);
console.log(`upstream repo=${contract.upstreamTarget.repo}`);
console.log(`foundation loader=${attachPoints.foundationLoader}`);
console.log(
  `session continuity=${attachPoints.sessionContinuity.join(",")}`,
);
console.log(`user path ledger=${attachPoints.userPathLedger}`);
console.log(`law body index=OK (${Object.keys(index.byId).length} entries, ${Object.keys(index.byFamilyLayer).length} family-layers)`);
