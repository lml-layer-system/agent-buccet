import { normalizeDelimitedList, stripTrailingPunctuation } from "./track-extractor-entropy.ts";
import { canonicalizeTrackLiteral, passesTrackMeaningGate } from "./track-extractor-negative.ts";
import type { DocumentLawBlock } from "./track-extractor-types.ts";
import type {
  BoundaryCompletionCorridor,
  BoundaryCompletionGrammar,
  BoundaryOutputCorridor,
  BoundaryUplTrackConstraint,
} from "./types.ts";

export type OutputTrackMeaning = {
  corridor?: BoundaryOutputCorridor;
  completionCorridor?: BoundaryCompletionCorridor;
  requiredTextPatterns: string[];
  forbiddenTextPatterns: string[];
  outputShape?: BoundaryUplTrackConstraint["outputShape"];
  completionGrammar?: BoundaryCompletionGrammar;
  invariantLabel?: string;
};

export function detectOutputShape(
  raw: string,
): BoundaryUplTrackConstraint["outputShape"] | undefined {
  const value = raw.trim().toLowerCase();
  if (value.includes("json")) return "json";
  if (value.includes("bullet")) return "bullets";
  if (value.includes("number")) return "numbered";
  if (value.includes("paragraph")) return "paragraph";
  return undefined;
}

export function detectCompletionGrammar(raw: string): BoundaryCompletionGrammar | undefined {
  const value = raw.trim().toLowerCase();
  if (value.includes("json")) return "json";
  if (value.includes("bullet")) return "bullets";
  if (value.includes("number")) return "numbered";
  if (value.includes("paragraph")) return "paragraph";
  if (value.includes("single sentence") || value.includes("one sentence")) return "single_sentence";
  if (value.includes("short answer") || value.includes("brief answer")) return "short_answer";
  return undefined;
}

export function expandStructuralPatterns(values: string[]): string[] {
  const expanded = new Set<string>();
  for (const value of values) {
    const trimmed = canonicalizeTrackLiteral(stripTrailingPunctuation(value));
    if (!trimmed) {
      continue;
    }
    if (!passesTrackMeaningGate(trimmed, "output")) {
      continue;
    }
    expanded.add(trimmed);
    for (const year of trimmed.match(/\b(?:19|20)\d{2}s?\b/g) ?? []) {
      expanded.add(year);
    }
    const onlyMatch = trimmed.match(/^\s*only\s+(.+)$/i);
    if (onlyMatch?.[1]) {
      expanded.add(stripTrailingPunctuation(onlyMatch[1]));
    }
    for (const quoted of trimmed.match(/"([^"]+)"|'([^']+)'/g) ?? []) {
      expanded.add(quoted.replace(/^['"]|['"]$/g, "").trim());
    }
  }
  return [...expanded];
}

export function dedupePatterns(values: string[]): string[] {
  return [
    ...new Set(values.flatMap((value) => expandStructuralPatterns(normalizeDelimitedList(value)))),
  ];
}

export function collapseOutputTrackMeaning(args: {
  block: DocumentLawBlock;
  requiredValues: string[];
  forbiddenValues: string[];
  outputShape?: BoundaryUplTrackConstraint["outputShape"];
  completionGrammar?: BoundaryCompletionGrammar;
}): OutputTrackMeaning {
  const requiredTextPatterns = dedupePatterns(args.requiredValues);
  const forbiddenTextPatterns = dedupePatterns(args.forbiddenValues);
  const completionGrammar =
    args.completionGrammar ??
    (args.outputShape === "json"
      ? "json"
      : args.outputShape === "bullets"
        ? "bullets"
        : args.outputShape === "numbered"
          ? "numbered"
          : args.outputShape === "paragraph"
            ? "paragraph"
            : undefined);
  const completionCorridor = completionGrammar
    ? {
        grammar: completionGrammar,
        ...(completionGrammar === "single_sentence" ? { maxLines: 1 } : {}),
        ...(completionGrammar === "short_answer" ? { maxLines: 1, maxWords: 12 } : {}),
      }
    : undefined;
  const explicit = args.block.fields.invariant?.find(Boolean)?.trim();
  let invariantLabel: string | undefined;
  if (explicit) {
    invariantLabel = explicit;
  } else if (args.block.heading) {
    invariantLabel = args.block.heading;
  } else if (completionGrammar) {
    invariantLabel = `Completion grammar must remain ${completionGrammar}`;
  } else if (args.outputShape) {
    invariantLabel = `Output shape must remain ${args.outputShape}`;
  } else if (requiredTextPatterns.length > 0) {
    invariantLabel = `Output must include: ${requiredTextPatterns.join(", ")}`;
  } else if (forbiddenTextPatterns.length > 0) {
    invariantLabel = `Output must not include: ${forbiddenTextPatterns.join(", ")}`;
  }
  return {
    corridor:
      requiredTextPatterns.length || forbiddenTextPatterns.length || args.outputShape
        ? {
            ...(requiredTextPatterns.length ? { requiredTextPatterns } : {}),
            ...(forbiddenTextPatterns.length ? { forbiddenTextPatterns } : {}),
            ...(args.outputShape ? { outputShape: args.outputShape } : {}),
          }
        : undefined,
    completionCorridor,
    requiredTextPatterns,
    forbiddenTextPatterns,
    outputShape: args.outputShape,
    completionGrammar,
    invariantLabel,
  };
}

function textMatchesPattern(text: string, pattern: string): boolean {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) {
    return true;
  }
  const regexLiteral = trimmedPattern.match(/^\/(.+)\/([a-z]*)$/i);
  if (regexLiteral) {
    try {
      return new RegExp(regexLiteral[1], regexLiteral[2]).test(text);
    } catch {
      return text.toLowerCase().includes(trimmedPattern.toLowerCase());
    }
  }
  return text.toLowerCase().includes(trimmedPattern.toLowerCase());
}

export function describeOutputShape(shape: BoundaryUplTrackConstraint["outputShape"]): string {
  return shape ?? "unspecified";
}

export function isOutputShapeSatisfied(
  shape: BoundaryUplTrackConstraint["outputShape"],
  output: string,
): boolean {
  const trimmed = output.trim();
  if (!shape) {
    return true;
  }
  if (shape === "json") {
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
      return false;
    }
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (shape === "bullets") {
    return lines.length > 0 && lines.every((line) => /^[-*]\s+/.test(line));
  }
  if (shape === "numbered") {
    return lines.length > 0 && lines.every((line) => /^\d+\.\s+/.test(line));
  }
  if (shape === "paragraph") {
    return (
      lines.length <= 1 || lines.every((line) => !/^[-*]\s+/.test(line) && !/^\d+\.\s+/.test(line))
    );
  }
  return true;
}

export function checkOutputCorridor(
  corridor: BoundaryOutputCorridor | undefined,
  fallbackConstraint: BoundaryUplTrackConstraint,
  text: string,
): string | null {
  const requiredTextPatterns =
    corridor?.requiredTextPatterns ?? fallbackConstraint.requiredTextPatterns;
  const forbiddenTextPatterns =
    corridor?.forbiddenTextPatterns ?? fallbackConstraint.forbiddenTextPatterns;
  const outputShape = corridor?.outputShape ?? fallbackConstraint.outputShape;

  if (requiredTextPatterns?.length) {
    for (const pattern of requiredTextPatterns) {
      if (!textMatchesPattern(text, pattern)) {
        return `output exits the approved execution corridor (required pattern missing: ${pattern})`;
      }
    }
  }

  if (forbiddenTextPatterns?.length) {
    for (const pattern of forbiddenTextPatterns) {
      if (textMatchesPattern(text, pattern)) {
        return `output exits the approved execution corridor (forbidden pattern present: ${pattern})`;
      }
    }
  }

  if (outputShape && !isOutputShapeSatisfied(outputShape, text)) {
    return `output exits the approved execution corridor (required shape: ${describeOutputShape(outputShape)})`;
  }

  return null;
}

export function checkCompletionCorridor(
  corridor: BoundaryCompletionCorridor | undefined,
  fallbackConstraint: BoundaryUplTrackConstraint,
  text: string,
): string | null {
  const active =
    corridor ??
    (fallbackConstraint.completionGrammar
      ? {
          grammar: fallbackConstraint.completionGrammar,
          ...(fallbackConstraint.completionGrammar === "single_sentence" ? { maxLines: 1 } : {}),
          ...(fallbackConstraint.completionGrammar === "short_answer"
            ? { maxLines: 1, maxWords: 12 }
            : {}),
        }
      : undefined);
  if (!active) {
    return null;
  }

  const trimmed = text.trim();
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (active.maxLines && lines.length > active.maxLines) {
    return `output exits the approved execution corridor (completion exceeds ${active.maxLines} lines)`;
  }
  if (active.maxWords && words.length > active.maxWords) {
    return `output exits the approved execution corridor (completion exceeds ${active.maxWords} words)`;
  }

  if (active.grammar === "single_sentence") {
    const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (sentences.length > 1 || lines.length > 1) {
      return (
        "output exits the approved execution corridor " +
        "(completion grammar requires a single sentence)"
      );
    }
  }

  if (active.grammar === "short_answer") {
    if (lines.length > 1 || words.length > 12) {
      return (
        "output exits the approved execution corridor " +
        "(completion grammar requires a short answer)"
      );
    }
  }

  if (active.grammar === "json" && !isOutputShapeSatisfied("json", text)) {
    return "output exits the approved execution corridor " + "(completion grammar requires json)";
  }
  if (active.grammar === "bullets" && !isOutputShapeSatisfied("bullets", text)) {
    return (
      "output exits the approved execution corridor " + "(completion grammar requires bullets)"
    );
  }
  if (active.grammar === "numbered" && !isOutputShapeSatisfied("numbered", text)) {
    return (
      "output exits the approved execution corridor " +
      "(completion grammar requires numbered output)"
    );
  }
  if (active.grammar === "paragraph" && !isOutputShapeSatisfied("paragraph", text)) {
    return (
      "output exits the approved execution corridor " +
      "(completion grammar requires paragraph output)"
    );
  }

  return null;
}
