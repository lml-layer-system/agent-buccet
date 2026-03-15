export type BranchRendererLane =
  | "meta_critical"
  | "life_preservation"
  | "style_directive"
  | "context_anchor"
  | "learning"
  | "base_chat";

export type BranchRendererContext = {
  branchId: string | null;
  treeId: string | null;
  matchedSeedTexts: string[];
  matchedRootIds: string[];
  matchedRootLabels: string[];
  snapMatchCount: number;
};

export function buildBranchRendererPrompt(args: {
  userMessage: string;
  lane: BranchRendererLane;
  payload: string;
  context: BranchRendererContext;
}): string {
  const packet = buildBranchPacket(args.lane, args.context, args.userMessage, args.payload);
  const shape = buildLaneOutputShape(args.lane, args.context.snapMatchCount);
  return [
    "LML branch emitter. Do not output this header.",
    `Lane: ${args.lane}`,
    `Output shape: ${shape}`,
    "Obey the branch packet exactly.",
    "Do not mention policy, law, runtime, system, branch, tree, NOCR, or internal guidance.",
    "Do not summarize everything if the user needs triage or one strong next move.",
    "Do not add unrelated content.",
    "",
    packet,
  ].join("\n");
}

export function composeLawGovernedSpeech(args: {
  userMessage: string;
  lane: BranchRendererLane;
  payload: string;
  context: BranchRendererContext;
}): string {
  const profile = inferSpeechProfile(args.userMessage, args.context);
  if (args.lane === "meta_critical" || args.lane === "life_preservation") {
    return composeLifePreservationSpeech(args.userMessage);
  }
  if (args.lane === "style_directive") {
    return composeStyleDirectiveSpeech(args.userMessage);
  }
  if (args.lane === "context_anchor") {
    return composeContextAnchoredSpeech(args.userMessage, args.context, profile);
  }
  if (args.lane === "learning") {
    return composeLearningSpeech(args.userMessage, args.payload);
  }
  return composeBaseChatSpeech(args.userMessage, profile);
}

function buildBranchPacket(
  lane: BranchRendererLane,
  context: BranchRendererContext,
  userMessage: string,
  payload: string,
): string {
  const rootSummary = summarizeRoots(context.matchedRootLabels);
  const seedSummary = summarizeSeeds(context.matchedSeedTexts);
  return [
    "BRANCH_PACKET_START",
    `branch_id=${context.branchId ?? "none"}`,
    `tree_id=${context.treeId ?? "none"}`,
    `snap_match_count=${String(context.snapMatchCount)}`,
    `matched_roots=${rootSummary}`,
    `matched_seeds=${seedSummary}`,
    `user_message=${quote(trim(userMessage, 160))}`,
    `lane_contract=${buildLaneContract(lane, context.snapMatchCount)}`,
    "payload_start",
    trim(payload, 420),
    "payload_end",
    "BRANCH_PACKET_END",
  ].join("\n");
}

function buildLaneContract(lane: BranchRendererLane, snapMatchCount: number): string {
  if (lane === "life_preservation") {
    return "stabilize first; direct, human, immediate; max 3 short sentences; one concrete next move";
  }
  if (lane === "style_directive") {
    return "stay exactly on requested style change; no topic drift; max 4 short sentences";
  }
  if (lane === "context_anchor") {
    return "continue the active line cleanly; anchor to prior context; max 4 sentences; end with one concrete next move if useful";
  }
  if (lane === "learning") {
    return "teach directly from admitted branch structure; short explanation; one example or one next step";
  }
  return snapMatchCount > 1
    ? "integrate multiple admitted branch matches into one tight response; triage and prioritize if needed; max 5 sentences"
    : "answer the primary admitted branch directly; max 4 sentences";
}

function buildLaneOutputShape(lane: BranchRendererLane, snapMatchCount: number): string {
  if (lane === "life_preservation") {
    return "1. stabilize 2. immediate action 3. optional brief reassurance";
  }
  if (lane === "style_directive") {
    return "1. confirm style lock 2. one direct answer line";
  }
  if (lane === "context_anchor") {
    return "1. anchor continuation 2. direct next move";
  }
  if (lane === "learning") {
    return "1. answer 2. brief explanation 3. optional concrete example";
  }
  return snapMatchCount > 1
    ? "1. identify dominant needs 2. prioritize 3. give the best next move"
    : "1. direct answer 2. best next move";
}

function summarizeRoots(labels: string[]): string {
  if (labels.length === 0) {
    return "none";
  }
  return labels.slice(0, 4).map((value) => trim(value, 36)).join(" | ");
}

function summarizeSeeds(texts: string[]): string {
  if (texts.length === 0) {
    return "none";
  }
  return texts.slice(0, 4).map((value) => trim(cleanSeedText(value), 42)).join(" | ");
}

function cleanSeedText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function quote(value: string): string {
  return `"${value.replace(/"/g, "'")}"`;
}

function trim(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}

type SpeechProfile = {
  coding: boolean;
  math: boolean;
  relationship: boolean;
  emotion: boolean;
  urgency: boolean;
  docs: boolean;
  search: boolean;
  count: number;
};

function inferSpeechProfile(userMessage: string, context: BranchRendererContext): SpeechProfile {
  const combined = `${userMessage}\n${context.matchedSeedTexts.join("\n")}\n${context.matchedRootLabels.join("\n")}`.toLowerCase();
  const coding = /\b(code|coding|build|make|write|implement|debug|refactor|compiler|game|doom|api|endpoint|python|typescript|javascript|parser)\b/.test(combined);
  const math = /\b(math|formula|derivation|equation|algebra|calc|class|study|homework)\b/.test(combined);
  const relationship = /\b(gf|girlfriend|wife|husband|partner|friend|relationship|apology|argue|bro|brodie)\b/.test(combined);
  const emotion = /\b(angry|mad|sad|hurt|stressed|overwhelmed|panic|nerves|annoyed)\b/.test(combined);
  const urgency = /\b(today|tonight|tomorrow|urgent|asap|deadline|class tomorrow|right now)\b/.test(combined);
  const docs = /\b(doc|document|pdf|paper|policy|law|laws|ingest|extract|summarize)\b/.test(combined);
  const search = /\b(search|look up|find|web)\b/.test(combined);
  const count = [coding, math, relationship, emotion, urgency, docs, search].filter(Boolean).length;
  return { coding, math, relationship, emotion, urgency, docs, search, count };
}

function composeLifePreservationSpeech(userMessage: string): string {
  const q = userMessage.toLowerCase();
  const crisis = /\b(i want to die|kill myself|suicide|end my life|self harm|hurt myself)\b/.test(q);
  if (crisis) {
    return "I'm with you right now. Move away from anything you could use to hurt yourself and call or text 988 now if you're in the US, or local emergency services if you're in immediate danger. Then send me one line telling me if you're physically safe.";
  }
  return "I'm here with you. Slow it down and do one stabilizing move first: sit down, breathe once, and tell me the single thing hitting hardest right now. We'll take it one clean step at a time.";
}

function composeStyleDirectiveSpeech(userMessage: string): string {
  const q = userMessage.toLowerCase();
  const style =
    /\bformal|professional|scientific|scientist\b/.test(q) ? "locked more formal and precise" :
      /\bstreet|slang|casual|bro|brodie\b/.test(q) ? "locked more casual and close" :
        /\bmentor|coach|teacher\b/.test(q) ? "locked to the role you asked for" :
          "locked to the style you asked for";
  return `${capitalize(style)}. Send the next thing you want and I'll keep it there.`;
}

function composeContextAnchoredSpeech(
  userMessage: string,
  context: BranchRendererContext,
  profile: SpeechProfile,
): string {
  const anchor = context.matchedRootLabels[0] || context.matchedSeedTexts[0] || "the active line";
  const nextMove = pickNextMove(profile);
  return `We're still on ${trim(cleanSeedText(anchor), 56)}. ${nextMove}`;
}

function composeLearningSpeech(userMessage: string, payload: string): string {
  const examplesMatch = payload.match(/Example law signals:\s*(.+)/i);
  const exampleText = examplesMatch?.[1]?.split("|").map((v) => cleanSeedText(v)).filter(Boolean).slice(0, 2).join(" and ");
  if (exampleText) {
    return `Short version: I pulled ${trim(exampleText, 120)}. If you want, give me the next doc or tell me which part you want turned into laws first.`;
  }
  return `I can summarize what was learned, but I need actual extracted material to work from. Give me the next doc or the exact section you want turned into laws.`;
}

function composeBaseChatSpeech(userMessage: string, profile: SpeechProfile): string {
  if (profile.count <= 1) {
    return directSingleTrackSpeech(profile);
  }

  const firstMove = pickNextMove(profile);
  const secondMove = pickSecondMove(profile);
  return `Yeah, you've got a few things stacked at once. ${firstMove}${secondMove ? ` ${secondMove}` : ""}`;
}

function directSingleTrackSpeech(profile: SpeechProfile): string {
  if (profile.urgency && profile.math) {
    return "Handle the deadline piece first. Send me the exact formulas or problem set and I'll clean it up fast.";
  }
  if (profile.coding) {
    return "Send me the exact build target, stack, and what you want the code to do first. I'll take it from there.";
  }
  if (profile.math) {
    return "Send me the exact formulas or problem and I'll work it clean step by step.";
  }
  if (profile.relationship || profile.emotion) {
    return "Give me the exact situation in one line and what outcome you want. I'll tell you the clean move.";
  }
  if (profile.docs) {
    return "Paste the doc or section you want handled and I'll extract the law body cleanly.";
  }
  if (profile.search) {
    return "Tell me exactly what you want found and I'll keep the search tight.";
  }
  return "Tell me the exact thing you want solved first and I'll keep it tight.";
}

function pickNextMove(profile: SpeechProfile): string {
  if (profile.urgency && profile.math) {
    return "First handle the thing with the clock on it: send me the exact formulas or problem set and I'll clean it up fast.";
  }
  if (profile.urgency && profile.coding) {
    return "First handle the deadline piece: send me the exact build target, stack, and constraint and I'll map the code path clean.";
  }
  if (profile.coding) {
    return "Start with the build target and stack, and I'll turn that into a clean coding path.";
  }
  if (profile.math) {
    return "Start with the exact formulas or problem set, and I'll work it step by step.";
  }
  if (profile.relationship || profile.emotion) {
    return "Start with the exact situation and what outcome you want, and I'll give you the clean move.";
  }
  if (profile.docs) {
    return "Start by pasting the doc or the exact section you want turned into laws.";
  }
  return "Start with the exact first thing you want solved.";
}

function pickSecondMove(profile: SpeechProfile): string {
  if ((profile.relationship || profile.emotion) && (profile.coding || profile.math)) {
    return "After the pressure piece is under control, we can sort the human side without losing the thread.";
  }
  if (profile.docs && (profile.coding || profile.math)) {
    return "If the doc is part of the task, paste it right after and I'll fold it into the same branch.";
  }
  if (profile.relationship || profile.emotion) {
    return "If you want, keep it blunt and give me the one line version.";
  }
  return "";
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
