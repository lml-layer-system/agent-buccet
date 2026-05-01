const POLICY_MIN_SIGNAL_COUNT = 2;
const POLICY_ENTROPY_THRESHOLD = 0.34;

const SUBJECTIVE_MARKERS = [
  /\bperhaps\b/i,
  /\bmaybe\b/i,
  /\bprobably\b/i,
  /\barguably\b/i,
  /\bclearly\b/i,
  /\bobviously\b/i,
  /\bi think\b/i,
  /\bi believe\b/i,
  /\bwe believe\b/i,
  /\bfeels?\b/i,
  /\bseems?\b/i,
];

const METAPHOR_MARKERS = [
  /\blike a\b/i,
  /\bas if\b/i,
  /\bas though\b/i,
  /\bphoenix\b/i,
  /\bopens the door\b/i,
  /\bsheds light\b/i,
  /\bgame over\b/i,
];

const PERSPECTIVE_MARKERS = [
  /\bi\b/i,
  /\bwe\b/i,
  /\bour\b/i,
  /\byou\b/i,
  /\byour\b/i,
];

const ORDERING_MARKERS = [
  /\bfirst\b/i,
  /\bthen\b/i,
  /\bnext\b/i,
  /\bfinally\b/i,
  /\bafter that\b/i,
  /\btherefore\b/i,
];

const POLICY_MARKERS = [
  /\bmust\b/i,
  /\bmust not\b/i,
  /\bnever\b/i,
  /\bonly\b/i,
  /\bdo not\b/i,
  /\bshould\b/i,
  /\bshall\b/i,
  /\brequire\b/i,
  /\bforbid\b/i,
  /\bdeny\b/i,
  /\bblock\b/i,
  /\bspeak\b/i,
  /\bwrite\b/i,
  /\btone\b/i,
  /\bstyle\b/i,
  /\bexpression\b/i,
  /\brespond\b/i,
  /\breturn\b/i,
  /\boutput\b/i,
  /\binclude\b/i,
  /\bmention\b/i,
];

export function stripTrailingPunctuation(value: string): string {
  return value.trim().replace(/[.?!]+$/g, "").trim();
}

export function normalizeDelimitedList(raw: string): string[] {
  return raw
    .split(/\s*\|\s*|\s*;\s*|\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function segmentPolicyClaims(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+|\s*;\s*/)
    .map((sentence) => stripTrailingPunctuation(sentence))
    .filter(Boolean);
}

export function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function computePolicyEntropy(text: string): number {
  const markers = [
    ...SUBJECTIVE_MARKERS,
    ...METAPHOR_MARKERS,
    ...PERSPECTIVE_MARKERS,
    ...ORDERING_MARKERS,
  ];
  let score = 0;
  for (const marker of markers) {
    if (marker.test(text)) {
      score += 0.12;
    }
  }
  if ((text.match(/,/g) ?? []).length >= 3) {
    score += 0.08;
  }
  if (text.split(/\s+/).length > 28) {
    score += 0.08;
  }
  return Math.min(score, 1);
}

export function isPolicyClaim(text: string): boolean {
  return POLICY_MARKERS.some((marker) => marker.test(text));
}

export function extractPatternTail(sentence: string, regexes: RegExp[]): string[] {
  const results: string[] = [];
  for (const regex of regexes) {
    const match = sentence.match(regex);
    if (!match?.[1]) {
      continue;
    }
    results.push(...normalizeDelimitedList(stripTrailingPunctuation(match[1])));
  }
  return results;
}

export function hasEnoughPolicySignals(count: number): boolean {
  return count >= POLICY_MIN_SIGNAL_COUNT;
}

export function passesPolicyEntropy(sentence: string): boolean {
  return computePolicyEntropy(sentence) <= POLICY_ENTROPY_THRESHOLD;
}
