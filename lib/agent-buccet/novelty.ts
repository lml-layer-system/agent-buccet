import type {
  BoundaryActionRequest,
  BoundaryNoveltyBoundaryHit,
  BoundaryNoveltyClass,
  BoundaryNoveltyState,
} from "./types.ts";

function normalizeStringList<T extends string>(values: readonly T[] | undefined): T[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean) as T[])].sort();
}

export function normalizeBoundaryNoveltyState(
  novelty?: BoundaryNoveltyState | null,
): BoundaryNoveltyState | undefined {
  if (!novelty) {
    return undefined;
  }

  const classes = normalizeStringList<BoundaryNoveltyClass>(novelty.classes);
  const boundaryHits = normalizeStringList<BoundaryNoveltyBoundaryHit>(novelty.boundaryHits);
  const reason = novelty.reason?.trim();
  const detected = novelty.detected || classes.length > 0 || boundaryHits.length > 0;

  if (!detected && !reason) {
    return undefined;
  }

  return {
    detected,
    ...(classes.length > 0 ? { classes } : {}),
    ...(boundaryHits.length > 0 ? { boundaryHits } : {}),
    ...(reason ? { reason } : {}),
    ...(novelty.disposition ? { disposition: novelty.disposition } : {}),
    ...(novelty.selfOriginated ? { selfOriginated: true } : {}),
    ...(novelty.admitted ? { admitted: true } : {}),
  };
}

export function noveltyFlagsForBoundaryRequest(
  novelty?: BoundaryNoveltyState | null,
): BoundaryActionRequest["flags"] | undefined {
  const normalized = normalizeBoundaryNoveltyState(novelty);
  if (!normalized?.detected) {
    return undefined;
  }

  return {
    noveltyDetected: true,
    ...(normalized.selfOriginated ? { noveltySelfOriginated: true } : {}),
  };
}

export function stableBoundaryNoveltyDescriptor(
  novelty?: BoundaryNoveltyState | null,
): {
  detected: boolean;
  classes: BoundaryNoveltyClass[];
  boundaryHits: BoundaryNoveltyBoundaryHit[];
  selfOriginated: boolean;
} | null {
  const normalized = normalizeBoundaryNoveltyState(novelty);
  if (!normalized?.detected) {
    return null;
  }

  return {
    detected: true,
    classes: normalizeStringList<BoundaryNoveltyClass>(normalized.classes),
    boundaryHits: normalizeStringList<BoundaryNoveltyBoundaryHit>(normalized.boundaryHits),
    selfOriginated: normalized.selfOriginated === true,
  };
}

export function admitBoundaryNoveltyState(
  novelty?: BoundaryNoveltyState | null,
): BoundaryNoveltyState | undefined {
  const normalized = normalizeBoundaryNoveltyState(novelty);
  if (!normalized) {
    return undefined;
  }
  return {
    ...normalized,
    admitted: true,
  };
}

export function describeBoundaryNoveltyState(
  novelty?: BoundaryNoveltyState | null,
): string | null {
  const normalized = normalizeBoundaryNoveltyState(novelty);
  if (!normalized?.detected) {
    return null;
  }

  if (normalized.reason) {
    return normalized.reason;
  }

  const parts: string[] = [];
  if (normalized.classes?.length) {
    parts.push(`classes=${normalized.classes.join(",")}`);
  }
  if (normalized.boundaryHits?.length) {
    parts.push(`hits=${normalized.boundaryHits.join(",")}`);
  }
  if (normalized.selfOriginated) {
    parts.push("self-originated");
  }
  if (parts.length === 0) {
    return "novel contact requires classification before consequence";
  }
  return `novel contact requires classification before consequence (${parts.join(" ; ")})`;
}
