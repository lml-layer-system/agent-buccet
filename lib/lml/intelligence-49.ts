export type Intelligence49Profile = {
  pattern_recognition: number;
  abstraction: number;
  prediction: number;
  optimization: number;
  composition: number;
  adaptation: number;
  communication: number;
};

export type Intelligence49Report = {
  enabled: true;
  source: "COMPLETE_49_CLASS_ENUMERATION";
  class_id: string;
  profile_vector: [number, number, number, number, number, number, number];
  level_label: "base_generalist" | "hybrid" | "specialist" | "meta";
  summary: string;
};

// Base intelligence profile for core runtime before user overlays.
const BASE_PROFILE: Intelligence49Profile = {
  pattern_recognition: 4,
  abstraction: 4,
  prediction: 4,
  optimization: 4,
  composition: 4,
  adaptation: 4,
  communication: 4,
};

export function getBaseIntelligence49Report(): Intelligence49Report {
  const vector = toVector(BASE_PROFILE);
  const classId = classifyIntelligence49(BASE_PROFILE);
  const label = classId === "I49"
    ? "meta"
    : classId === "I45" || classId === "I46" || classId === "I47" || classId === "I48"
      ? "base_generalist"
      : /^I([1-7])$/.test(classId)
        ? "specialist"
        : "hybrid";

  return {
    enabled: true,
    source: "COMPLETE_49_CLASS_ENUMERATION",
    class_id: classId,
    profile_vector: vector,
    level_label: label,
    summary: buildSummary(classId, vector),
  };
}

export function classifyIntelligence49(profile: Intelligence49Profile): string {
  const vec = toVector(profile);
  const maxVal = Math.max(...vec);
  const maxIndices = vec
    .map((value, index) => ({ value, index }))
    .filter((item) => item.value >= maxVal - 1)
    .map((item) => item.index);

  if (maxIndices.length === 1 && maxVal >= 5) {
    return `I${maxIndices[0] + 1}`;
  }

  if (maxIndices.length === 2 && maxVal >= 4) {
    const [dim1, dim2] = maxIndices.sort((a, b) => a - b);
    const pairIndex = dim1 * 7 + dim2 - Math.floor((dim1 * (dim1 + 1)) / 2);
    return `I${8 + pairIndex}`;
  }

  const avg = vec.reduce((sum, value) => sum + value, 0) / vec.length;
  if (avg >= 5.5) return "I49";
  if (avg >= 4.5) return "I48";
  if (avg >= 3.5) return "I45";
  if (avg >= 2.5) return "I46";
  return "I47";
}

function toVector(profile: Intelligence49Profile): [number, number, number, number, number, number, number] {
  return [
    profile.pattern_recognition,
    profile.abstraction,
    profile.prediction,
    profile.optimization,
    profile.composition,
    profile.adaptation,
    profile.communication,
  ];
}

function buildSummary(classId: string, vector: number[]): string {
  return `Base intelligence class ${classId} with vector I[${vector.join(", ")}]. Governance overlays specialize this base class at runtime.`;
}
