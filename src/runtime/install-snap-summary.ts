/**
 * Install-bundle metrics only (counts, timings, compression).
 * Used by packaging; no doctrinal exposition.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BUCCET_CONSEQUENCE_BOUNDARIES,
  BUCCET_SUBSTRATE_PLANES,
  BUCCET_SYSTEM_NODES,
  BUCCET_TERMINALS,
  benchmarkBuccetSystemSnap,
  snapBuccetSystem,
} from "./substrate/system-substrate.ts";

const BUCCET_REPO_SNAP_BUCKETS = [
  "LawBody",
  "RuntimeBody",
  "PathBody",
  "WitnessBody",
  "OperatorBody",
  "InstallReleaseBody",
  "ProofBody",
  "RenderDocsBody",
  "FoundationDataBody",
] as const;

type BuccetRepoSnapBucket = (typeof BUCCET_REPO_SNAP_BUCKETS)[number];

type BuccetRepoArtifact = {
  relativePath: string;
  body: BuccetRepoSnapBucket | "orphaned";
};

export type BuccetInstallSnapSummary = {
  repoArtifactCount: number;
  repoSnapBodyCount: number;
  repoCompressionRatio: number;
  repoCompressionPercent: number;
  runtimeNodeCount: number;
  runtimeExecutablePrimitiveCount: number;
  runtimeSnapAvgMs: number;
  repoSnapAvgMs: number;
  runtimeDeterministic: boolean;
  repoDeterministic: boolean;
  operatorConsoleCommand: string;
};

function repoRootFromHere(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

function walkFiles(rootPath: string, relativeRoot: string): string[] {
  if (!fs.existsSync(rootPath)) {
    return [];
  }
  const out: string[] = [];
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    if (entry.name.startsWith("._")) {
      continue;
    }
    const abs = path.join(rootPath, entry.name);
    const rel = path.join(relativeRoot, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(abs, rel));
    } else if (entry.isFile()) {
      out.push(rel.split(path.sep).join("/"));
    }
  }
  return out;
}

function classifyBuccetRepoArtifact(relativePath: string): BuccetRepoSnapBucket | "orphaned" {
  if (
    relativePath === "package.json" ||
    relativePath === "package-lock.json" ||
    relativePath === "LICENSE" ||
    relativePath === ".gitignore" ||
    relativePath === "biome.json" ||
    relativePath === "tsconfig.json" ||
    relativePath === "tsconfig.build.json" ||
    relativePath.startsWith(".github/")
  ) {
    return "InstallReleaseBody";
  }
  if (
    relativePath === "README.md" ||
    relativePath === "CHANGELOG.md" ||
    relativePath === "SECURITY.md" ||
    relativePath === "AGENTS.md" ||
    relativePath === "CONTRIBUTING.md" ||
    relativePath === "CODE_OF_CONDUCT.md" ||
    relativePath.startsWith("docs/")
  ) {
    return "RenderDocsBody";
  }
  if (relativePath.startsWith("data/agent-buccet-law-foundation/")) {
    return "FoundationDataBody";
  }
  if (relativePath.startsWith("scripts/render-")) {
    return "RenderDocsBody";
  }
  if (
    relativePath.startsWith("scripts/install-") ||
    relativePath === "scripts/prepare-agent-buccet-package.ts"
  ) {
    return "InstallReleaseBody";
  }
  if (relativePath.startsWith("scripts/") && relativePath.endsWith("-contract.ts")) {
    return "ProofBody";
  }
  if (relativePath.startsWith("scripts/")) {
    return "OperatorBody";
  }
  if (relativePath.startsWith("server/witness/")) {
    return "WitnessBody";
  }
  if (relativePath.startsWith("native/")) {
    return "RuntimeBody";
  }
  if (relativePath.startsWith("examples/") || relativePath.startsWith("demo/")) {
    return "OperatorBody";
  }
  if (
    relativePath === "lib/agent-buccet/path-memory.ts" ||
    relativePath === "lib/agent-buccet/swarm.ts"
  ) {
    return "PathBody";
  }
  if (
    relativePath.startsWith("lib/agent-buccet/ledger") ||
    relativePath === "lib/agent-buccet/witness.ts" ||
    relativePath === "lib/agent-buccet/release-witness.ts"
  ) {
    return "WitnessBody";
  }
  if (
    relativePath.startsWith("lib/agent-buccet/gravity-core/") ||
    relativePath.startsWith("lib/agent-buccet/gravity-adapter/")
  ) {
    return "RuntimeBody";
  }
  if (relativePath.startsWith("lib/agent-buccet/integrations/")) {
    return "RuntimeBody";
  }
  if (relativePath.startsWith("lib/agent-buccet/")) {
    const file = relativePath.slice("lib/agent-buccet/".length);
    if (
      file.startsWith("base-upl-acceptance") ||
      file.startsWith("headless-base-denials") ||
      file.startsWith("document-law") ||
      file.startsWith("track-extractor") ||
      file.startsWith("upl-") ||
      file.startsWith("user-path-ledger") ||
      file.startsWith("capability-") ||
      file.startsWith("core-skill-") ||
      file.startsWith("extended-skill-") ||
      file.startsWith("list-v-acceptance") ||
      file.startsWith("marketplace-acceptance") ||
      file.startsWith("time-constraint-flags") ||
      file.startsWith("periodic-failure-taxonomy") ||
      file.startsWith("frontier-failure-aliases") ||
      file.startsWith("buccet-failure-catalog") ||
      file.startsWith("buccet-law-body-denial-catalog") ||
      file.startsWith("law") ||
      file.startsWith("meta") ||
      file.startsWith("foundation")
    ) {
      return "LawBody";
    }
    return "RuntimeBody";
  }
  return "orphaned";
}

function createBuccetRepoArtifactManifest(repoRoot: string): BuccetRepoArtifact[] {
  const artifacts = walkFiles(repoRoot, "").filter((relativePath) => {
    return !(
      relativePath.startsWith(".git/") ||
      relativePath === ".git" ||
      relativePath.startsWith(".next/") ||
      relativePath.startsWith("out/") ||
      relativePath.startsWith("coverage/") ||
      relativePath.startsWith("node_modules/") ||
      relativePath.startsWith("dist/") ||
      relativePath.startsWith("data/agent-boundary/") ||
      relativePath.startsWith("data/ledger/") ||
      relativePath.startsWith("artifacts/") ||
      relativePath.startsWith("demo/workspace/") ||
      relativePath.includes("/build/")
    );
  });
  return [...new Set(artifacts)]
    .sort((left, right) => left.localeCompare(right))
    .map((relativePath) => ({
      relativePath,
      body: classifyBuccetRepoArtifact(relativePath),
    }));
}

function snapBuccetRepoArtifactManifest(manifest: BuccetRepoArtifact[]): {
  orphanedArtifacts: string[];
  compressionRatio: number;
} {
  const orphanedArtifacts: string[] = [];
  for (const artifact of manifest) {
    if (artifact.body === "orphaned") {
      orphanedArtifacts.push(artifact.relativePath);
    }
  }
  return {
    orphanedArtifacts,
    compressionRatio: Number((manifest.length / BUCCET_REPO_SNAP_BUCKETS.length).toFixed(2)),
  };
}

function benchmarkBuccetRepoArtifactSnap(
  manifest: BuccetRepoArtifact[],
  iterations: number,
): {
  avgMs: number;
  deterministic: boolean;
  iterations: number;
} {
  const startedAt = performance.now();
  const first = JSON.stringify(snapBuccetRepoArtifactManifest(manifest));
  let deterministic = true;
  for (let index = 1; index < iterations; index += 1) {
    const current = JSON.stringify(snapBuccetRepoArtifactManifest(manifest));
    if (current !== first) {
      deterministic = false;
    }
  }
  const totalMs = performance.now() - startedAt;
  return {
    avgMs: totalMs / iterations,
    deterministic,
    iterations,
  };
}

function percentCompressedFromRatio(ratio: number): number {
  return Number((100 - 100 / ratio).toFixed(2));
}

export function computeBuccetInstallSnapSummary(): BuccetInstallSnapSummary {
  const repoRoot = repoRootFromHere();
  const repoManifest = createBuccetRepoArtifactManifest(repoRoot);
  const repoSnap = snapBuccetRepoArtifactManifest(repoManifest);
  const benchmark = benchmarkBuccetSystemSnap(10_000);
  const repoBenchmark = benchmarkBuccetRepoArtifactSnap(repoManifest, 10_000);
  const substrateJson = JSON.stringify(snapBuccetSystem());
  const deterministic = Array.from({ length: 10 }).every(
    () => JSON.stringify(snapBuccetSystem()) === substrateJson,
  );
  const repoSnapJson = JSON.stringify(repoSnap);
  const repoDeterministic = Array.from({ length: 10 }).every(
    () => JSON.stringify(snapBuccetRepoArtifactManifest(repoManifest)) === repoSnapJson,
  );
  const executableBodyCount =
    BUCCET_SUBSTRATE_PLANES.length +
    BUCCET_TERMINALS.length +
    BUCCET_CONSEQUENCE_BOUNDARIES.length +
    1;

  return {
    repoArtifactCount: repoManifest.length,
    repoSnapBodyCount: BUCCET_REPO_SNAP_BUCKETS.length,
    repoCompressionRatio: repoSnap.compressionRatio,
    repoCompressionPercent: percentCompressedFromRatio(repoSnap.compressionRatio),
    runtimeNodeCount: BUCCET_SYSTEM_NODES.length,
    runtimeExecutablePrimitiveCount: executableBodyCount,
    runtimeSnapAvgMs: benchmark.avgMs,
    repoSnapAvgMs: repoBenchmark.avgMs,
    runtimeDeterministic: deterministic,
    repoDeterministic: repoDeterministic,
    operatorConsoleCommand: "buccet console",
  };
}

export function renderBuccetInstallSnapSummaryText(
  summary: BuccetInstallSnapSummary = computeBuccetInstallSnapSummary(),
): string {
  return [
    "Agent Buccet release install summary:",
    `  repo body: ${summary.repoArtifactCount} artifacts -> ${summary.repoSnapBodyCount} grouped bodies (${summary.repoCompressionPercent}% compression)`,
    `  runtime body: ${summary.runtimeNodeCount} substrate nodes -> ${summary.runtimeExecutablePrimitiveCount} substrate primitives`,
    `  speed: runtime ${summary.runtimeSnapAvgMs.toFixed(6)}ms | repo grouping ${summary.repoSnapAvgMs.toFixed(6)}ms`,
    `  deterministic: runtime ${summary.runtimeDeterministic ? "yes" : "no"} | repo ${summary.repoDeterministic ? "yes" : "no"}`,
    `  console: ${summary.operatorConsoleCommand}`,
  ].join("\n");
}
