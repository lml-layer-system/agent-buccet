export type BuccetFullSystemBodyRuntimeFacts = {
  baseAcceptanceCount: number;
  baseDenialCount: number;
  defaultPathCount: number;
  substrateNodeCount: number;
  substratePlaneCount: number;
  substrateTerminalCount: number;
  consequenceBoundaryCount: number;
  executableBodyCount: number;
  snapAvgMs: number;
  snapTargetMs: number;
  snapUnderTargetFactor: number;
  snapDeterministic: boolean;
};

export type BuccetFullSystemBody = {
  concept: string;
  runtimeFacts: BuccetFullSystemBodyRuntimeFacts;
};

export type BuccetInstallSnapSummary = {
  runtimeNodeCount: number;
  runtimeExecutablePrimitiveCount: number;
  runtimeSnapAvgMs: number;
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
      snapAvgMs: 0,
      snapTargetMs: 10,
      snapUnderTargetFactor: 0,
      snapDeterministic: true,
    },
  };
}

export function buildBuccetInstallSnapSummary(): BuccetInstallSnapSummary {
  return {
    runtimeNodeCount: 0,
    runtimeExecutablePrimitiveCount: 0,
    runtimeSnapAvgMs: 0,
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
    "This public build intentionally omits internal runtime-collapse methodology.",
    "",
    "Agent Buccet exposes the governed action boundary, UPL/user-law model, witness ledger, and operator docs needed to run the open-source runtime.",
  ].join("\n");
}
