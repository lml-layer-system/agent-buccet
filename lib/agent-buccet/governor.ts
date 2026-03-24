import type {
  BoundaryActionKind,
  BoundaryActionRequest,
  BoundaryGovernorConfig,
  BoundaryGovernorState,
} from "./types.ts";

export const DEFAULT_GOVERNOR_WEIGHT: Partial<Record<BoundaryActionKind, number>> = {
  "tool.exec": 10,
  "fs.delete": 8,
  "sys.credential.use": 8,
  "sys.credential.read": 8,
  "sys.config.write": 6,
  "sys.env.write": 6,
  "network.send": 5,
  "comm.send": 5,
  "db.delete": 8,
  "db.update": 4,
  "db.insert": 3,
  "db.query": 2,
  "fs.write": 2,
  "fs.append": 2,
  "fs.move": 2,
  "fs.mkdir": 1,
  "fs.read": 1,
  "chat.emit": 1,
  "sys.env.read": 1,
  "sys.config.read": 1,
};

export function getActionWeight(
  actionKind: BoundaryActionKind,
  weight?: Partial<Record<BoundaryActionKind, number>>,
): number {
  return (weight ?? DEFAULT_GOVERNOR_WEIGHT)[actionKind] ?? 1;
}

export function initialGovernorState(): BoundaryGovernorState {
  return {
    crossingTimestamps: [],
    totalWeightedCrossings: 0,
    recentDecisions: [],
  };
}

export type BoundaryGovernorEvaluation =
  | { tripped: false }
  | { tripped: true; dimension: "velocity" | "density" | "mass"; lawId: string; reason: string };

export function evaluateBoundaryGovernor(args: {
  config: BoundaryGovernorConfig;
  state: BoundaryGovernorState;
  request: BoundaryActionRequest;
  nowMs: number;
}): BoundaryGovernorEvaluation {
  const { config, state, request, nowMs } = args;

  // Velocity: max boundary crossings per minute
  if (config.velocity) {
    const windowMs = config.velocity.windowMs ?? 60_000;
    const windowStart = nowMs - windowMs;
    const crossingsInWindow = state.crossingTimestamps.filter((t) => t >= windowStart).length;
    const maxPerWindow = Math.ceil((config.velocity.maxRpm * windowMs) / 60_000);
    if (crossingsInWindow >= maxPerWindow) {
      return {
        tripped: true,
        dimension: "velocity",
        lawId: "BOUNDARY.GOVERNOR.VELOCITY.01",
        reason: `action rate ceiling reached: ${crossingsInWindow} crossings in ${windowMs}ms window (max ${maxPerWindow})`,
      };
    }
  }

  // Density: pathological unlawful-to-lawful ratio in sliding window
  if (config.density) {
    const windowSize = config.density.windowSize ?? 20;
    const recent = state.recentDecisions.slice(-windowSize);
    if (recent.length >= Math.ceil(windowSize / 2)) {
      const deniedCount = recent.filter((lawful) => !lawful).length;
      const ratio = deniedCount / recent.length;
      if (ratio >= config.density.maxFailureRatio) {
        return {
          tripped: true,
          dimension: "density",
          lawId: "BOUNDARY.GOVERNOR.DENSITY.01",
          reason: `pathological denial density: ${Math.round(ratio * 100)}% unlawful crossings in last ${recent.length} actions (max ${Math.round(config.density.maxFailureRatio * 100)}%)`,
        };
      }
    }
  }

  // Mass: absolute weighted action horizon per session
  if (config.mass) {
    const weight = getActionWeight(request.actionKind, config.weight);
    if (state.totalWeightedCrossings + weight > config.mass.maxCrossings) {
      return {
        tripped: true,
        dimension: "mass",
        lawId: "BOUNDARY.GOVERNOR.MASS.01",
        reason: `session action horizon reached: ${state.totalWeightedCrossings} weighted crossings (max ${config.mass.maxCrossings})`,
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
  const { state, config, actionKind, wasLawful, nowMs } = args;

  const velocityWindowMs = config.velocity?.windowMs ?? 60_000;
  const windowStart = nowMs - velocityWindowMs;
  const trimmedTimestamps = [...state.crossingTimestamps.filter((t) => t >= windowStart), nowMs];

  const densityWindowSize = (config.density?.windowSize ?? 20) * 2;
  const trimmedDecisions = [...state.recentDecisions, wasLawful].slice(-densityWindowSize);

  const weight = getActionWeight(actionKind, config.weight);

  return {
    crossingTimestamps: trimmedTimestamps,
    totalWeightedCrossings: state.totalWeightedCrossings + weight,
    recentDecisions: trimmedDecisions,
  };
}
