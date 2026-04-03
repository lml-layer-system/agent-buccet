import { checkTrackConstraint } from "./upl-tracks.ts";
import {
  makeBoundaryUplTrafficTag,
  lookupUserPathDecision,
  lookupUserPathTrackDecision,
  uplTrafficClassForPolarity,
} from "./user-path-ledger.ts";
import type {
  BoundaryActionRequest,
  BoundaryLawResult,
  BoundaryRuntimeConfig,
  BoundaryUplEntry,
} from "./types.ts";

export type BoundaryUplTrafficDecision = "allow" | "deny" | "drift" | "no_match";

export type BoundaryUplTrafficResult = {
  decision: BoundaryUplTrafficDecision;
  entry?: BoundaryUplEntry;
  reason?: string;
  triggeredLawIds: string[];
  trafficClass?: "allow_rail" | "deny_wall";
  trafficTag?: string;
  uplTrackId?: string;
  uplTrackViolated?: true;
};

function trafficLawIds(config: BoundaryRuntimeConfig, entry: BoundaryUplEntry): string[] {
  return [
    entry.id,
    ...(config.runtimeMuscle?.timeLawIdsByCategory.user_path_ledger ?? []),
  ];
}

function describeTrafficEntry(entry: BoundaryUplEntry): string {
  const note = entry.notes?.trim();
  if (note) {
    return note;
  }
  const trackDescription = entry.trackConstraint?.description?.trim();
  if (trackDescription) {
    return trackDescription;
  }
  return entry.id;
}

export function evaluateBoundaryUplTraffic(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): BoundaryUplTrafficResult {
  if (!args.config.upl) {
    return {
      decision: "no_match",
      triggeredLawIds: [],
    };
  }

  const exactMatch = lookupUserPathDecision({
    ledger: args.config.upl,
    session: args.config.session,
    request: args.request,
  });
  if (exactMatch) {
    const triggeredLawIds = trafficLawIds(args.config, exactMatch.entry);
    if (exactMatch.entry.trackConstraint) {
      const trackViolation = checkTrackConstraint(exactMatch.entry.trackConstraint, args.request);
      if (trackViolation && exactMatch.decision === "allow") {
        return {
          decision: "drift",
          entry: exactMatch.entry,
          reason: `action exits approved execution corridor: ${trackViolation}`,
          triggeredLawIds,
          trafficClass: uplTrafficClassForPolarity("allow"),
          trafficTag: makeBoundaryUplTrafficTag({ entry: exactMatch.entry, polarity: "allow" }),
          uplTrackId: exactMatch.entry.id,
          uplTrackViolated: true,
        };
      }
    }

    if (exactMatch.decision === "allow") {
      return {
        decision: "allow",
        entry: exactMatch.entry,
        reason: `allowed by standing UPL approval ${describeTrafficEntry(exactMatch.entry)}`,
        triggeredLawIds,
        trafficClass: uplTrafficClassForPolarity("allow"),
        trafficTag: makeBoundaryUplTrafficTag({ entry: exactMatch.entry, polarity: "allow" }),
        ...(exactMatch.entry.trackConstraint ? { uplTrackId: exactMatch.entry.id } : {}),
      };
    }

    return {
      decision: "deny",
      entry: exactMatch.entry,
      reason: `blocked by standing UPL denial ${describeTrafficEntry(exactMatch.entry)}`,
      triggeredLawIds,
      trafficClass: uplTrafficClassForPolarity("deny"),
      trafficTag: makeBoundaryUplTrafficTag({ entry: exactMatch.entry, polarity: "deny" }),
      ...(exactMatch.entry.trackConstraint ? { uplTrackId: exactMatch.entry.id } : {}),
    };
  }

  const trackMatch = lookupUserPathTrackDecision({
    ledger: args.config.upl,
    session: args.config.session,
    request: args.request,
  });
  if (!trackMatch) {
    return {
      decision: "no_match",
      triggeredLawIds: [],
    };
  }

  const triggeredLawIds = trafficLawIds(args.config, trackMatch.entry);
  if (trackMatch.decision === "track_violation") {
    return {
      decision: "drift",
      entry: trackMatch.entry,
      reason: `action exits approved execution corridor: ${trackMatch.violation}`,
      triggeredLawIds,
      trafficClass: uplTrafficClassForPolarity("allow"),
      trafficTag: makeBoundaryUplTrafficTag({ entry: trackMatch.entry, polarity: "allow" }),
      uplTrackId: trackMatch.entry.id,
      uplTrackViolated: true,
    };
  }
  if (trackMatch.decision === "deny") {
    return {
      decision: "deny",
      entry: trackMatch.entry,
      reason: `blocked by UPL traffic wall ${describeTrafficEntry(trackMatch.entry)}`,
      triggeredLawIds,
      trafficClass: uplTrafficClassForPolarity("deny"),
      trafficTag: makeBoundaryUplTrafficTag({ entry: trackMatch.entry, polarity: "deny" }),
      uplTrackId: trackMatch.entry.id,
    };
  }
  return {
    decision: "allow",
    entry: trackMatch.entry,
    reason: `allowed by UPL traffic rail ${describeTrafficEntry(trackMatch.entry)}`,
    triggeredLawIds,
    trafficClass: uplTrafficClassForPolarity("allow"),
    trafficTag: makeBoundaryUplTrafficTag({ entry: trackMatch.entry, polarity: "allow" }),
    uplTrackId: trackMatch.entry.id,
  };
}

export function resolveBoundaryUplTraffic(args: {
  config: BoundaryRuntimeConfig;
  request: BoundaryActionRequest;
}): BoundaryLawResult | null {
  const traffic = evaluateBoundaryUplTraffic(args);
  if (traffic.decision === "no_match" || !traffic.reason) {
    return null;
  }
  if (traffic.decision === "allow") {
    return {
      decision: "allow",
      reason: traffic.reason,
      triggeredLawIds: traffic.triggeredLawIds,
      requiresApproval: false,
      uplTrackId: traffic.uplTrackId,
    };
  }
  if (traffic.decision === "deny") {
    return {
      decision: "deny",
      reason: traffic.reason,
      triggeredLawIds: traffic.triggeredLawIds,
      requiresApproval: false,
      uplTrackId: traffic.uplTrackId,
    };
  }
  return {
    decision: "require_approval",
    reason: traffic.reason,
    triggeredLawIds: traffic.triggeredLawIds,
    requiresApproval: true,
    uplTrackId: traffic.uplTrackId,
    ...(traffic.uplTrackViolated ? { uplTrackViolated: true } : {}),
  };
}
