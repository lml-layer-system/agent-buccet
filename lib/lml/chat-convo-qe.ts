import type { HumanMirrorProfile } from "@/lib/lml/human-mirror";

export type ChatConvoPossibilityOrigin =
  | "quantum_spark.chat_register"
  | "quantum_spark.chat_rhythm"
  | "quantum_spark.chat_affect"
  | "quantum_spark.chat_distance"
  | "quantum_spark.chat_guidance"
  | "quantum_spark.chat_distress";

export type ChatConvoPossibility = {
  id: string;
  text: string;
  origin: ChatConvoPossibilityOrigin;
  amplitude: number;
};

export type ChatConvoQuantumSparkResult = {
  candidateCount: number;
  possibilities: ChatConvoPossibility[];
};

export function runChatConvoQuantumSpark(args: {
  userMessage: string;
  profile: HumanMirrorProfile;
}): ChatConvoQuantumSparkResult {
  const message = args.userMessage.trim();
  if (!message) {
    return {
      candidateCount: 0,
      possibilities: [],
    };
  }

  const possibilities = uniqueByText([
    buildRegisterPossibility(message, args.profile),
    buildRhythmPossibility(message, args.profile),
    buildAffectPossibility(message, args.profile),
    buildDistancePossibility(message, args.profile),
    buildGuidancePossibility(message, args.profile),
    buildDistressPossibility(message, args.profile),
  ].filter(Boolean) as ChatConvoPossibility[]);

  return {
    candidateCount: possibilities.length,
    possibilities,
  };
}

function buildRegisterPossibility(message: string, profile: HumanMirrorProfile): ChatConvoPossibility {
  return {
    id: "chat_qe.register",
    origin: "quantum_spark.chat_register",
    amplitude: profile.registerTarget === "casual" ? 0.96 : 0.78,
    text: `Match the user's register exactly as said with ${profile.registerTarget} delivery and no policy echo. ${message}`,
  };
}

function buildRhythmPossibility(message: string, profile: HumanMirrorProfile): ChatConvoPossibility {
  return {
    id: "chat_qe.rhythm",
    origin: "quantum_spark.chat_rhythm",
    amplitude: profile.rhythmTarget === "short_burst" ? 0.95 : 0.8,
    text: `Respond with ${profile.rhythmTarget} rhythm shaped by the user's pacing and pressure state. ${message}`,
  };
}

function buildAffectPossibility(message: string, profile: HumanMirrorProfile): ChatConvoPossibility {
  return {
    id: "chat_qe.affect",
    origin: "quantum_spark.chat_affect",
    amplitude: profile.affectTarget === "supportive" ? 0.98 : 0.84,
    text: `Keep ${profile.affectTarget} affect and preserve same-side human alignment. ${message}`,
  };
}

function buildDistancePossibility(message: string, profile: HumanMirrorProfile): ChatConvoPossibility {
  return {
    id: "chat_qe.distance",
    origin: "quantum_spark.chat_distance",
    amplitude: profile.distanceTarget === "near" ? 0.94 : 0.76,
    text: `Hold ${profile.distanceTarget} conversational distance without fake familiarity or drift. ${message}`,
  };
}

function buildGuidancePossibility(message: string, profile: HumanMirrorProfile): ChatConvoPossibility {
  return {
    id: "chat_qe.guidance",
    origin: "quantum_spark.chat_guidance",
    amplitude: profile.nonPollutingGuidance ? 0.9 : 0.7,
    text: `Give non-polluting guidance that stays readable and useful under ${profile.relationMode}. ${message}`,
  };
}

function buildDistressPossibility(message: string, profile: HumanMirrorProfile): ChatConvoPossibility | null {
  if (!profile.distressSignal) {
    return null;
  }
  return {
    id: "chat_qe.distress",
    origin: "quantum_spark.chat_distress",
    amplitude: 1,
    text: `Stabilize the user first, preserve human presence, and keep guidance gentle and immediate. ${message}`,
  };
}

function uniqueByText(values: ChatConvoPossibility[]): ChatConvoPossibility[] {
  const seen = new Set<string>();
  const result: ChatConvoPossibility[] = [];
  for (const value of values) {
    const key = value.text.trim().toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(value);
  }
  return result;
}
