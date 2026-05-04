export type BuccetFullSystemBodyRuntimeFacts = {
  baseAcceptanceCount: number;
  baseDenialCount: number;
  defaultPathCount: number;
  substrateNodeCount: number;
  substratePlaneCount: number;
  substrateTerminalCount: number;
  consequenceBoundaryCount: number;
  executableBodyCount: number;
  runtimeAvgMs: number;
  runtimeTargetMs: number;
  runtimeUnderTargetFactor: number;
  runtimeDeterministic: boolean;
};

export type BuccetFullSystemBody = {
  concept: string;
  runtimeFacts: BuccetFullSystemBodyRuntimeFacts;
};

export type BuccetInstallSnapSummary = {
  runtimeNodeCount: number;
  runtimeExecutablePrimitiveCount: number;
  runtimeAvgMs: number;
  runtimeDeterministic: boolean;
  operatorConsoleCommand: string;
};

export function runBuccetFullSystemBody(): BuccetFullSystemBody {
  return {
    concept: "public-safe Agent Buccet runtime surface summary",
    runtimeFacts: {
      baseAcceptanceCount: 0,
      baseDenialCount: 0,
      defaultPathCount: 0,
      substrateNodeCount: 0,
      substratePlaneCount: 0,
      substrateTerminalCount: 0,
      consequenceBoundaryCount: 0,
      executableBodyCount: 0,
      runtimeAvgMs: 0,
      runtimeTargetMs: 10,
      runtimeUnderTargetFactor: 0,
      runtimeDeterministic: true,
    },
  };
}

export function buildBuccetInstallSnapSummary(): BuccetInstallSnapSummary {
  return {
    runtimeNodeCount: 0,
    runtimeExecutablePrimitiveCount: 0,
    runtimeAvgMs: 0,
    runtimeDeterministic: true,
    operatorConsoleCommand: "buccet console",
  };
}

export function renderBuccetInstallSnapSummaryText(): string {
  return [
    "Agent Buccet install:",
    "  public-safe runtime surface summary",
    "  console: buccet console",
  ].join("\n");
}

export function renderBuccetFullSystemBodyMarkdown(): string {
  return [
    "# Agent Buccet Runtime Surface",
    "",
    "This public build intentionally omits internal runtime methodology.",
    "",
    "Agent Buccet exposes the governed action boundary, UPL/user-law model, witness ledger, and operator docs needed to run the open-source runtime.",
  ].join("\n");
}
