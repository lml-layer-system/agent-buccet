export type BuccetInstallMetricsSummary = {
  repoFileCount: number;
  publicGroupCount: number;
  groupingRatio: number;
  groupingPercent: number;
  runtimeNodeCount: number;
  runtimePrimitiveCount: number;
  runtimeAvgMs: number;
  repoGroupingAvgMs: number;
  runtimeDeterministic: boolean;
  repoDeterministic: boolean;
  operatorConsoleCommand: string;
};

export function computeBuccetInstallMetricsSummary(): BuccetInstallMetricsSummary {
  return {
    repoFileCount: 0,
    publicGroupCount: 0,
    groupingRatio: 0,
    groupingPercent: 0,
    runtimeNodeCount: 0,
    runtimePrimitiveCount: 0,
    runtimeAvgMs: 0,
    repoGroupingAvgMs: 0,
    runtimeDeterministic: true,
    repoDeterministic: true,
    operatorConsoleCommand: "buccet console",
  };
}

export function renderBuccetInstallMetricsSummaryText(
  summary: BuccetInstallMetricsSummary = computeBuccetInstallMetricsSummary(),
): string {
  return [
    "Agent Buccet release install summary:",
    `  repo files: ${summary.repoFileCount}`,
    `  public groups: ${summary.publicGroupCount}`,
    `  runtime primitives: ${summary.runtimePrimitiveCount}`,
    `  speed: runtime ${summary.runtimeAvgMs.toFixed(6)}ms | repo grouping ${summary.repoGroupingAvgMs.toFixed(6)}ms`,
    `  deterministic: runtime ${summary.runtimeDeterministic ? "yes" : "no"} | repo ${summary.repoDeterministic ? "yes" : "no"}`,
    `  console: ${summary.operatorConsoleCommand}`,
  ].join("\n");
}
