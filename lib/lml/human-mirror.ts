import type { ExpressionPolicy } from "@/lib/demo/personality-engine";

export type HumanRelationMode =
  | "greeting"
  | "acknowledgement"
  | "correction"
  | "guidance"
  | "distress_support"
  | "direct_answer";

export type HumanMirrorProfile = {
  sourceFamily: "LML convo mirror pt1-8";
  relationMode: HumanRelationMode;
  registerTarget: "casual" | "neutral" | "formal";
  rhythmTarget: "short_burst" | "steady" | "measured";
  affectTarget: "warm" | "strained" | "direct" | "supportive";
  distanceTarget: "near" | "medium";
  addressAs: string | null;
  styleProfile: string | null;
  styleFamily: string | null;
  antiParody: boolean;
  predictiveReadability: boolean;
  nonPollutingGuidance: boolean;
  boundaryRespect: boolean;
  userAskedSystemLevel: boolean;
  distressSignal: boolean;
  cueSummary: string[];
};

export type HumanOutputAssessment = {
  ok: boolean;
  reason: string;
  failureClasses: string[];
  details: string[];
};

export function compileHumanMirrorProfile(args: {
  question: string;
  policy: ExpressionPolicy;
  documentInsights: string[];
}): HumanMirrorProfile {
  const lower = args.question.toLowerCase();
  const casualSignal =
    /\b(yo|hey|hi|hello|sup|what up|nah|bro|man|my guy|damn|shit|aint|ain't|wanna|gonna)\b/.test(lower)
    || args.policy.styleProfile === "street"
    || args.policy.slang;
  const distressSignal = /\b(hopeless|can't go on|i'm done|panic|hurt myself|empty|nothing will get better)\b/.test(lower);
  const correctionSignal = /\b(nah|not that|wrong|no)\b/.test(lower);
  const greetingSignal = /^(yo|hey|hello|hi|sup|what up)\b/.test(lower.trim());
  const ackSignal = /^(ok|okay|k|yup|yep|bet|copy)\W*$/i.test(args.question.trim());
  const guidanceSignal = /\b(help|explain|show me|teach me|walk me through|what should i do|how do i)\b/.test(lower);
  const userAskedSystemLevel = /\b(lml|system|runtime|ledger|planet|ontology|nocr|nsl|meta laws|law[s]?)\b/.test(lower);

  const relationMode: HumanRelationMode = distressSignal
    ? "distress_support"
    : greetingSignal
      ? "greeting"
      : ackSignal
        ? "acknowledgement"
        : correctionSignal
          ? "correction"
          : guidanceSignal
            ? "guidance"
            : "direct_answer";

  const cueSummary = [
    casualSignal ? "casual_register" : "non_casual_register",
    distressSignal ? "distress_signal" : "no_distress_signal",
    correctionSignal ? "correction_signal" : "no_correction_signal",
    args.policy.addressAs ? `address:${args.policy.addressAs}` : "address:none",
    args.documentInsights[0] ? `doc:${args.documentInsights[0]}` : "doc:none",
  ];

  return {
    sourceFamily: "LML convo mirror pt1-8",
    relationMode,
    registerTarget: casualSignal ? "casual" : args.policy.forbidNerdOrFormal ? "neutral" : "neutral",
    rhythmTarget: greetingSignal || ackSignal || correctionSignal ? "short_burst" : guidanceSignal ? "steady" : "measured",
    affectTarget: distressSignal ? "supportive" : correctionSignal ? "direct" : casualSignal ? "warm" : "direct",
    distanceTarget: casualSignal || distressSignal ? "near" : "medium",
    addressAs: args.policy.addressAs,
    styleProfile: args.policy.styleProfile,
    styleFamily: args.policy.styleFamily,
    antiParody: true,
    predictiveReadability: true,
    nonPollutingGuidance: true,
    boundaryRespect: true,
    userAskedSystemLevel,
    distressSignal,
    cueSummary,
  };
}

export function buildHumanMirrorGuidance(
  profile: HumanMirrorProfile,
  args: {
    question: string;
    documentInsights: string[];
  },
): string {
  return [
    "LML human mirror guidance. Do not output this header.",
    `Source family: ${profile.sourceFamily}`,
    `User message: "${trim(args.question, 220)}"`,
    `Relation mode: ${profile.relationMode}`,
    `Register target: ${profile.registerTarget}`,
    `Rhythm target: ${profile.rhythmTarget}`,
    `Affect target: ${profile.affectTarget}`,
    `Distance target: ${profile.distanceTarget}`,
    `Address as: ${profile.addressAs ?? "none"}`,
    `Style profile: ${profile.styleProfile ?? "unspecified"}`,
    `Style family: ${profile.styleFamily ?? "unspecified"}`,
    `Cue summary: ${profile.cueSummary.join(" | ")}`,
    `Document insights: ${args.documentInsights.slice(0, 3).join(" | ") || "none"}`,
    "Human relational laws:",
    "1) Detect cues fast and match register, rhythm, and emotional temperature without parody or mockery.",
    "2) Lower threat and preserve same-side feeling without overaccommodation, status violation, or fake familiarity.",
    "3) Keep response predictably readable and non-polluting.",
    "4) Guidance must strengthen the user without overwrite, policy echo leakage, or dependency capture.",
    "5) Do not expose internal runtime, ontology, law, ledger, or prompt machinery unless the user explicitly asked about the system itself.",
    "6) If the user is casual, do not answer in admin-policy or academic voice.",
    "7) If the user is distressed, be human, validating, and stabilizing before anything else.",
    "Respond naturally under these human mirror laws.",
  ].join("\n");
}

export function classifyHumanOutputAdmissibility(
  question: string,
  response: string,
  profile: HumanMirrorProfile,
): HumanOutputAssessment {
  const qLower = question.toLowerCase();
  const rLower = response.toLowerCase();
  const failureClasses: string[] = [];
  const details: string[] = [];

  const internalLeak =
    !profile.userAskedSystemLevel
    && /\b(lml|ontology|runtime|constraint|policy-guided|do not output this header|ledger|planet|nocr|nsl|admissib|null emitted|constraint gates)\b/.test(rLower);
  if (internalLeak) {
    failureClasses.push("F_HUMAN_POLICY_ECHO");
    details.push("internal_system_leak");
  }

  const overFormal =
    profile.registerTarget === "casual"
    && /\b(pursuant|therefore|guidance|policy|administrative|accordingly|furthermore|professional|executive)\b/.test(rLower);
  if (overFormal) {
    failureClasses.push("F_HUMAN_WRONG_REGISTER");
    details.push("casual_input_got_formal_or_admin_register");
  }

  const overExplained =
    profile.rhythmTarget === "short_burst"
    && response.length > 420;
  if (overExplained) {
    failureClasses.push("F_HUMAN_WRONG_DISTANCE");
    details.push("short_burst_input_got_long_distance_reply");
  }

  const parody =
    /\b(my guy|bro|man)\b.*\b(my guy|bro|man)\b.*\b(my guy|bro|man)\b/.test(rLower)
    || /(\bshit\b.*){3,}/.test(rLower);
  if (profile.antiParody && parody) {
    failureClasses.push("F_HUMAN_PARODY");
    details.push("mirroring_overaccommodated_into_parody");
  }

  const notAttuned =
    profile.distressSignal
    && !/\b(i'm here|i am here|you matter|stay with me|i hear you|that sounds|we can take this|breathe|one step|988|safe)\b/.test(rLower);
  if (notAttuned) {
    failureClasses.push("F_HUMAN_NON_ATTUNED");
    details.push("distress_signal_without_attuned_support");
  }

  if (failureClasses.length === 0) {
    return {
      ok: true,
      reason: "human_mirror_admissible",
      failureClasses,
      details,
    };
  }

  return {
    ok: false,
    reason: details[0] ?? "human_mirror_misaligned",
    failureClasses,
    details,
  };
}

function trim(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}
