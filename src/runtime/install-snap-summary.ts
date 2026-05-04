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

export function computeBuccetInstallSnapSummary(): BuccetInstallSnapSummary {
  return {
    repoArtifactCount: 0,
    repoSnapBodyCount: 0,
    repoCompressionRatio: 0,
    repoCompressionPercent: 0,
    runtimeNodeCount: 0,
    runtimeExecutablePrimitiveCount: 0,
    runtimeSnapAvgMs: 0,
    repoSnapAvgMs: 0,
    runtimeDeterministic: true,
    repoDeterministic: true,
    operatorConsoleCommand: "buccet console",
  };
}

export function renderBuccetInstallSnapSummaryText(
  summary: BuccetInstallSnapSummary = computeBuccetInstallSnapSummary(),
): string {
  return [
    "Agent Buccet release install summary:",
    `  repo files: ${summary.repoArtifactCount}`,
    `  public groups: ${summary.repoSnapBodyCount}`,
    `  runtime primitives: ${summary.runtimeExecutablePrimitiveCount}`,
    `  speed: runtime ${summary.runtimeSnapAvgMs.toFixed(6)}ms | repo grouping ${summary.repoSnapAvgMs.toFixed(6)}ms`,
    `  deterministic: runtime ${summary.runtimeDeterministic ? "yes" : "no"} | repo ${summary.repoDeterministic ? "yes" : "no"}`,
    `  console: ${summary.operatorConsoleCommand}`,
  ].join("\n");
}
