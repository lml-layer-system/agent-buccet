import type { NocrRoot } from "@/lib/nocr/types";
import { extractRootParentsFromArtifact, type RootExtractionResult } from "@/lib/uuis/root-extraction";

export type RootRegistry = {
  staticRoots: NocrRoot[];
  extractedRoots: NocrRoot[];
  allRoots: NocrRoot[];
  extraction: {
    sourceUnitCount: number;
    identityKernelCount: number;
    legalityRegionCount: number;
    metaLoopCount: number;
    directiveCount: number;
    codeUnitCount: number;
    mathUnitCount: number;
    sentenceCount: number;
    artifactRootCount: number;
    userLawRootCount: number;
    extractedRootCount: number;
    expansionDelta: number;
    underEnumerated: boolean;
  };
};

export function buildRootRegistry(args: {
  staticRoots: NocrRoot[];
  artifactTexts: string[];
  userLawTexts?: string[];
}): RootRegistry {
  const extraction = mergeExtractions(args.artifactTexts, args.userLawTexts ?? []);

  const allRoots = dedupeRoots([...args.staticRoots, ...extraction.roots]);
  return {
    staticRoots: [...args.staticRoots],
    extractedRoots: extraction.roots,
    allRoots,
    extraction: {
      sourceUnitCount: extraction.sourceUnitCount,
      identityKernelCount: extraction.identityKernelCount,
      legalityRegionCount: extraction.legalityRegionCount,
      metaLoopCount: extraction.metaLoopCount,
      directiveCount: extraction.directiveCount,
      codeUnitCount: extraction.codeUnitCount,
      mathUnitCount: extraction.mathUnitCount,
      sentenceCount: extraction.sentenceCount,
      artifactRootCount: extraction.artifactRootCount,
      userLawRootCount: extraction.userLawRootCount,
      extractedRootCount: extraction.coverage.extractedRootCount,
      expansionDelta: extraction.coverage.expansionDelta,
      underEnumerated: extraction.coverage.underEnumerated,
    },
  };
}

type MergedRootExtraction = RootExtractionResult & {
  artifactRootCount: number;
  userLawRootCount: number;
};

function mergeExtractions(artifactTexts: string[], userLawTexts: string[]): MergedRootExtraction {
  const aggregate: MergedRootExtraction = {
    roots: [],
    sourceUnitCount: 0,
    identityKernelCount: 0,
    legalityRegionCount: 0,
    metaLoopCount: 0,
    directiveCount: 0,
    codeUnitCount: 0,
    mathUnitCount: 0,
    sentenceCount: 0,
    coverage: {
      extractedRootCount: 0,
      expansionDelta: 0,
      underEnumerated: false,
    },
    artifactRootCount: 0,
    userLawRootCount: 0,
  };

  for (const [index, input] of artifactTexts.entries()) {
    if (!input.trim()) continue;
    const extracted = extractRootParentsFromArtifact(input, {
      classification: "artifact",
      sourceLabel: `artifact:${index + 1}`,
    });
    aggregate.roots.push(...extracted.roots);
    aggregate.sourceUnitCount += extracted.sourceUnitCount;
    aggregate.identityKernelCount += extracted.identityKernelCount;
    aggregate.legalityRegionCount += extracted.legalityRegionCount;
    aggregate.metaLoopCount += extracted.metaLoopCount;
    aggregate.directiveCount += extracted.directiveCount;
    aggregate.codeUnitCount += extracted.codeUnitCount;
    aggregate.mathUnitCount += extracted.mathUnitCount;
    aggregate.sentenceCount += extracted.sentenceCount;
    aggregate.coverage.extractedRootCount += extracted.coverage.extractedRootCount;
    aggregate.artifactRootCount += extracted.roots.length;
  }

  for (const [index, input] of userLawTexts.entries()) {
    if (!input.trim()) continue;
    const extracted = extractRootParentsFromArtifact(input, {
      classification: "user_law",
      sourceLabel: `user_law:${index + 1}`,
    });
    aggregate.roots.push(...extracted.roots);
    aggregate.sourceUnitCount += extracted.sourceUnitCount;
    aggregate.identityKernelCount += extracted.identityKernelCount;
    aggregate.legalityRegionCount += extracted.legalityRegionCount;
    aggregate.metaLoopCount += extracted.metaLoopCount;
    aggregate.directiveCount += extracted.directiveCount;
    aggregate.codeUnitCount += extracted.codeUnitCount;
    aggregate.mathUnitCount += extracted.mathUnitCount;
    aggregate.sentenceCount += extracted.sentenceCount;
    aggregate.coverage.extractedRootCount += extracted.coverage.extractedRootCount;
    aggregate.userLawRootCount += extracted.roots.length;
  }

  aggregate.roots = dedupeRoots(aggregate.roots);
  aggregate.coverage.extractedRootCount = aggregate.roots.length;
  aggregate.coverage.expansionDelta = aggregate.coverage.extractedRootCount - aggregate.sourceUnitCount;
  aggregate.coverage.underEnumerated = aggregate.coverage.extractedRootCount < aggregate.sourceUnitCount;
  return aggregate;
}

function dedupeRoots(roots: NocrRoot[]): NocrRoot[] {
  const byId = new Map<string, NocrRoot>();
  for (const root of roots) {
    byId.set(root.id, root);
  }
  return [...byId.values()];
}
