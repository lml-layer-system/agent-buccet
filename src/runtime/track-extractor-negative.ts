const METAPHOR_MARKERS = [
  /\blike a\b/i,
  /\bas if\b/i,
  /\bas though\b/i,
  /\bphoenix\b/i,
  /\blegendary\b/i,
  /\bcosmic\b/i,
  /\bmythic\b/i,
];

const SUBJECTIVE_MARKERS = [
  /\bperhaps\b/i,
  /\bmaybe\b/i,
  /\bprobably\b/i,
  /\barguably\b/i,
  /\bobviously\b/i,
  /\bclearly\b/i,
  /\bi think\b/i,
  /\bi believe\b/i,
  /\bfeels?\b/i,
  /\bseems?\b/i,
  /\bawesome\b/i,
  /\bamazing\b/i,
  /\bunforgettable\b/i,
  /\bincredible\b/i,
  /\bfantastic\b/i,
];

const PERSPECTIVE_MARKERS = [/\bi\b/i, /\bwe\b/i, /\bour\b/i, /\byou\b/i, /\byour\b/i];

const ORDERING_MARKERS = [
  /\bfirst\b/i,
  /\bthen\b/i,
  /\bnext\b/i,
  /\bfinally\b/i,
  /\bafter that\b/i,
  /\btherefore\b/i,
];

const HEDGE_MARKERS = [
  /\bkind of\b/i,
  /\bsort of\b/i,
  /\bsomewhat\b/i,
  /\brather\b/i,
  /\bpretty\b/i,
];

export type TrackMeaningSurface = "expression" | "output" | "action";

function computeMarkerScore(text: string, markers: RegExp[], perHit: number): number {
  let score = 0;
  for (const marker of markers) {
    if (marker.test(text)) {
      score += perHit;
    }
  }
  return score;
}

export function canonicalizeTrackLiteral(text: string): string {
  return text
    .trim()
    .replace(/[.?!]+$/g, "")
    .replace(/\s+/g, " ");
}

export function computeTrackMeaningEntropy(text: string, surface: TrackMeaningSurface): number {
  let score = 0;
  score += computeMarkerScore(text, METAPHOR_MARKERS, surface === "expression" ? 0.2 : 0.14);
  score += computeMarkerScore(text, SUBJECTIVE_MARKERS, surface === "expression" ? 0.16 : 0.1);
  score += computeMarkerScore(text, PERSPECTIVE_MARKERS, surface === "expression" ? 0.16 : 0.08);
  score += computeMarkerScore(text, ORDERING_MARKERS, 0.08);
  score += computeMarkerScore(text, HEDGE_MARKERS, 0.08);

  if ((text.match(/,/g) ?? []).length >= 3) {
    score += surface === "expression" ? 0.1 : 0.06;
  }
  if (text.split(/\s+/).length > (surface === "expression" ? 10 : 16)) {
    score += surface === "expression" ? 0.14 : 0.08;
  }
  if (/!/.test(text)) {
    score += surface === "expression" ? 0.14 : 0.06;
  }
  return Math.min(score, 1);
}

export function passesTrackMeaningGate(text: string, surface: TrackMeaningSurface): boolean {
  const threshold = surface === "expression" ? 0.18 : surface === "action" ? 0.26 : 0.3;
  return computeTrackMeaningEntropy(text, surface) <= threshold;
}
