import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_MUSCLE_RELATIVE = path.join(
  "data",
  "agent-buccet-law-foundation",
  "data",
  "working",
  "active-law-body",
  "runtime-muscle.json",
);

export type BuccetInstallMetricsSummary = {
  runtimeLawIds: number;
  activeBaseLaws: number;
  activeTimeLaws: number;
  substrateFamilyCount: number;
  substrateSourceKernelCount: number;
  runtimeSubstrateBytes: number;
  runtimeSubstrateSha256: string;
  deterministic: boolean;
  operatorConsoleCommand: string;
  generatedAt: string;
};

type Manifest = {
  activeBaseLawCount: number;
  activeTimeLawCount: number;
  activeLawBodyCount: number;
  substrateFamilyCount: number;
  substrateSourceKernelCount: number;
  hashes: { runtimeSubstrateSha256: string };
  sizes: { runtimeSubstrateBytes: number };
  generatedAt: string;
};

function readManifest(): Manifest {
  const candidates = [
    path.join(moduleDir, "../../", RUNTIME_MUSCLE_RELATIVE),
    path.join(moduleDir, "../", RUNTIME_MUSCLE_RELATIVE),
    path.join(process.cwd(), RUNTIME_MUSCLE_RELATIVE),
  ];
  for (const candidate of candidates) {
    try {
      const raw = readFileSync(candidate, "utf8");
      const parsed = JSON.parse(raw) as { manifest: Manifest };
      if (parsed?.manifest) {
        return parsed.manifest;
      }
    } catch {}
  }
  throw new Error(
    `unable to locate Agent Buccet runtime-muscle artifact at ${RUNTIME_MUSCLE_RELATIVE}`,
  );
}

export function computeBuccetInstallMetricsSummary(): BuccetInstallMetricsSummary {
  const manifest = readManifest();
  return {
    runtimeLawIds: manifest.activeLawBodyCount,
    activeBaseLaws: manifest.activeBaseLawCount,
    activeTimeLaws: manifest.activeTimeLawCount,
    substrateFamilyCount: manifest.substrateFamilyCount,
    substrateSourceKernelCount: manifest.substrateSourceKernelCount,
    runtimeSubstrateBytes: manifest.sizes.runtimeSubstrateBytes,
    runtimeSubstrateSha256: manifest.hashes.runtimeSubstrateSha256,
    deterministic: true,
    operatorConsoleCommand: "buccet console",
    generatedAt: manifest.generatedAt,
  };
}

export function renderBuccetInstallMetricsSummaryText(
  summary: BuccetInstallMetricsSummary = computeBuccetInstallMetricsSummary(),
): string {
  return [
    "Agent Buccet release install summary:",
    `  runtime law ids: ${summary.runtimeLawIds}`,
    `  active base laws: ${summary.activeBaseLaws}`,
    `  active time laws: ${summary.activeTimeLaws}`,
    `  substrate families: ${summary.substrateFamilyCount}`,
    `  substrate source kernels: ${summary.substrateSourceKernelCount}`,
    `  runtime substrate bytes: ${summary.runtimeSubstrateBytes}`,
    `  runtime substrate sha256: ${summary.runtimeSubstrateSha256}`,
    `  deterministic: ${summary.deterministic ? "yes" : "no"}`,
    `  console: ${summary.operatorConsoleCommand}`,
    `  generated at: ${summary.generatedAt}`,
  ].join("\n");
}
