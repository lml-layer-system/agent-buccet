export type ThresholdMap = Record<string, number | string | boolean>;

export type DimensionSpec = {
  id: string;
  name: string;
  levels: string[];
};

export type LawSpec = {
  id: string;
  text: string;
  scope: string;
  enforcement: string;
};

export type RepairSpec = {
  id: string;
  trigger: string;
  move: string;
  effect: string;
  mapsFailures: string[];
};

export type DetectorSpec = {
  id: string;
  description: string;
  signal: string;
};

export type GateSpec = {
  id: string;
  description: string;
  hard: boolean;
};

export type ProfileCriticalBlocker = {
  id: string;
  missing: string;
  neededFor: string;
};

export type SnapProfile = {
  profileId: string;
  immutableHash: string;
  version: string;
  domain: "DOC" | "FORMAT" | "CITATION" | "LEGAL_AI" | "WRITING" | "FACTUAL" | "META";
  dimensions: DimensionSpec[];
  lmlLaws: LawSpec[];
  nslRepairs: RepairSpec[];
  detectors: DetectorSpec[];
  hardGates: GateSpec[];
  thresholds: ThresholdMap;
  criticalBlockers: ProfileCriticalBlocker[];
};

export type RunMode = "demo" | "product";

