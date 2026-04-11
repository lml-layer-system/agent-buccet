import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryGovernorConfig,
  BoundaryGovernorState,
} from "./types.ts";

export const DEFAULT_GOVERNOR_WEIGHT: Record<BoundaryActionKind, number> = {
  "fs.read": 1,
  "fs.write": 4,
  "fs.append": 3,
  "fs.delete": 8,
  "fs.mkdir": 3,
  "fs.move": 4,
  "chat.emit": 1,
  "comm.send": 5,
  "tool.exec": 10,
  "network.send": 5,
  "db.query": 2,
  "db.insert": 4,
  "db.update": 5,
  "db.delete": 7,
  "sys.env.read": 3,
  "sys.env.write": 6,
  "sys.config.read": 3,
  "sys.config.write": 7,
  "sys.credential.read": 8,
  "sys.credential.use": 8,
};

export const DEFAULT_GOVERNOR_CONFIG: BoundaryGovernorConfig = {
  // Shipped default posture: cap runaway outbound rate and weighted session cost.
  // Density remains opt-in because it is a stronger pathology detector and should
  // not silently become the baseline egress experience.
  velocity: { maxRpm: 120, windowMs: 60_000 },
  mass: { maxCrossings: 500 },
};

export type BoundaryGovernorTrip =
  | {
      tripped: false;
    }
  | {
      tripped: true;
      dimension: "velocity" | "density" | "mass";
      lawId: string;
      reason: string;
    };

export function initialGovernorState(): BoundaryGovernorState {
  return {
    crossingTimestamps: [],
    totalWeightedCrossings: 0,
    recentDecisions: [],
  };
}

function pruneVelocityWindow(
  timestamps: number[],
  windowMs: number,
  nowMs: number,
): number[] {
  const cutoff = nowMs - windowMs;
  return timestamps.filter((timestamp) => timestamp >= cutoff);
}

function decisionWindow(
  decisions: boolean[],
  windowSize: number,
): boolean[] {
  return decisions.slice(-windowSize);
}

function actionWeight(
  actionKind: BoundaryActionKind,
  config: BoundaryGovernorConfig,
): number {
  return config.weight?.[actionKind] ?? DEFAULT_GOVERNOR_WEIGHT[actionKind];
}

export function evaluateBoundaryGovernor(args: {
  config: BoundaryGovernorConfig;
  state: BoundaryGovernorState;
  request: Pick<BoundaryActionRequest, "actionKind">;
  nowMs: number;
}): BoundaryGovernorTrip {
  const { config, state, request, nowMs } = args;

  if (config.velocity) {
    const windowMs = config.velocity.windowMs ?? 60_000;
    const activeCrossings = pruneVelocityWindow(state.crossingTimestamps, windowMs, nowMs);
    if (activeCrossings.length >= config.velocity.maxRpm) {
      return {
        tripped: true,
        dimension: "velocity",
        lawId: "BOUNDARY.GOVERNOR.VELOCITY.01",
        reason: `boundary governor velocity ceiling tripped (${activeCrossings.length}/${config.velocity.maxRpm} in ${windowMs}ms)`,
      };
    }
  }

  if (config.density) {
    const windowSize = config.density.windowSize ?? 20;
    const recent = decisionWindow(state.recentDecisions, windowSize);
    if (recent.length > 0) {
      const denied = recent.filter((decision) => !decision).length;
      const denyRatio = denied / recent.length;
      if (denyRatio >= config.density.maxFailureRatio) {
        return {
          tripped: true,
          dimension: "density",
          lawId: "BOUNDARY.GOVERNOR.DENSITY.01",
          reason: `boundary governor density ceiling tripped (${denied}/${recent.length} denied, ratio ${denyRatio.toFixed(2)})`,
        };
      }
    }
  }

  if (config.mass) {
    const nextMass = state.totalWeightedCrossings + actionWeight(request.actionKind, config);
    if (nextMass > config.mass.maxCrossings) {
      return {
        tripped: true,
        dimension: "mass",
        lawId: "BOUNDARY.GOVERNOR.MASS.01",
        reason: `boundary governor mass ceiling tripped (${nextMass} > ${config.mass.maxCrossings})`,
      };
    }
  }

  return { tripped: false };
}

export function recordGovernorCrossing(args: {
  state: BoundaryGovernorState;
  config: BoundaryGovernorConfig;
  actionKind: BoundaryActionKind;
  wasLawful: boolean;
  nowMs: number;
}): BoundaryGovernorState {
  const windowMs = args.config.velocity?.windowMs ?? 60_000;
  const nextTimestamps = pruneVelocityWindow(
    [...args.state.crossingTimestamps, args.nowMs],
    windowMs,
    args.nowMs,
  );
  const densityWindow = args.config.density?.windowSize ?? 20;
  const nextDecisions = decisionWindow(
    [...args.state.recentDecisions, args.wasLawful],
    densityWindow,
  );

  return {
    crossingTimestamps: nextTimestamps,
    totalWeightedCrossings:
      args.state.totalWeightedCrossings + actionWeight(args.actionKind, args.config),
    recentDecisions: nextDecisions,
  };
}
