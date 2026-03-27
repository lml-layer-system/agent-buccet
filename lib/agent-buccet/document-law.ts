import { createHash } from "node:crypto";
import path from "node:path";
import type {
  CompiledDocumentLaw,
  BoundaryReviewContext,
  BoundaryUplTrackConstraint,
} from "./types.ts";

type ParsedDirective = {
  type: "APPROVED" | "DENIED";
  invariantLawId: string;
  invariantLabel: string;
  notes: string;
  trackConstraint: BoundaryUplTrackConstraint;
  reviewContext: BoundaryReviewContext;
};

type DocumentLawBlock = {
  startLine: number;
  endLine: number;
  heading?: string;
  fields: Record<string, string[]>;
  source: "structured" | "prose";
};

const CHAT_TARGET = "chat:primary";
const FIELD_ALIASES: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /^(?:decision|disposition|status)$/i, key: "decision" },
  { pattern: /^(?:invariant|rule|constraint|law)$/i, key: "invariant" },
  { pattern: /^(?:enforcement|enforced by|guard|mechanism)$/i, key: "enforcement" },
  { pattern: /^(?:speak this way|speak like|respond like|expression|tone|style)$/i, key: "expression" },
  { pattern: /^(?:output shape|return shape|completion grammar|format|schema)$/i, key: "output_shape" },
  { pattern: /^(?:must include|must say|say this|only say|respond with|required|require)$/i, key: "require" },
  { pattern: /^(?:must not include|do not say|never say|must not say|forbid phrase|forbid|forbidden)$/i, key: "forbid" },
];

function sanitizeLawSlug(input: string): string {
  return input
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]+/g, ".")
    .replaceAll(/^\.+|\.+$/g, "")
    || "DOCUMENT";
}

function normalizeDelimitedList(raw: string): string[] {
  return raw
    .split(/\s*\|\s*|\s*;\s*|\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function detectOutputShape(raw: string): BoundaryUplTrackConstraint["outputShape"] | undefined {
  const value = raw.trim().toLowerCase();
  if (value.includes("json")) return "json";
  if (value.includes("bullet")) return "bullets";
  if (value.includes("number")) return "numbered";
  if (value.includes("paragraph")) return "paragraph";
  return undefined;
}

function normalizeExpressionProfile(raw: string): string {
  return stripTrailingPunctuation(raw)
    .replace(/\b(?:tone|style|expression|voice)\b$/i, "")
    .trim();
}

function buildInvariantId(sourcePath: string, lineNumber: number, label: string): string {
  const docName = sanitizeLawSlug(path.basename(sourcePath, path.extname(sourcePath)));
  const labelSlug = sanitizeLawSlug(label).split(".").slice(0, 4).join(".");
  return `UPL.DOC.${docName}.${String(lineNumber).padStart(3, "0")}.${labelSlug}`;
}

function normalizeFieldKey(rawKey: string): string | null {
  const cleaned = rawKey.trim().replace(/^[-*]\s*/, "");
  for (const alias of FIELD_ALIASES) {
    if (alias.pattern.test(cleaned)) {
      return alias.key;
    }
  }
  return null;
}

function parseDocumentBlocks(markdown: string): DocumentLawBlock[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: DocumentLawBlock[] = [];
  let inFence = false;
  let active: DocumentLawBlock | null = null;
  let currentHeading: string | undefined;
  let proseStartLine: number | null = null;
  let proseLines: string[] = [];

  const flush = () => {
    if (!active) return;
    if (Object.keys(active.fields).length > 0) {
      blocks.push(active);
    }
    active = null;
  };

  const flushProse = () => {
    if (!proseStartLine || proseLines.length === 0) {
      proseStartLine = null;
      proseLines = [];
      return;
    }
    const startLine = proseStartLine;
    const endLine = startLine + Math.max(0, proseLines.length - 1);
    const paragraph = proseLines.join(" ").trim();
    proseStartLine = null;
    proseLines = [];
    const fields = extractFieldsFromProse(paragraph);
    if (Object.keys(fields).length === 0) {
      return;
    }
    blocks.push({
      startLine,
      endLine,
      heading: currentHeading,
      fields,
      source: "prose",
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const trimmed = rawLine.trim();
    if (trimmed.startsWith("```")) {
      flush();
      flushProse();
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    if (!trimmed) {
      flush();
      flushProse();
      continue;
    }
    if (trimmed.startsWith("#")) {
      flush();
      flushProse();
      currentHeading = trimmed.replace(/^#+\s*/, "").trim() || undefined;
      continue;
    }

    const normalized = trimmed.replace(/^[-*]\s*/, "");
    const match = normalized.match(/^([^:]+):\s*(.+)$/);
    if (!match) {
      if (!active) {
        proseStartLine ??= index + 1;
        proseLines.push(trimmed);
      }
      continue;
    }
    flushProse();
    const key = normalizeFieldKey(match[1] ?? "");
    if (!key) {
      if (!active) {
        proseStartLine ??= index + 1;
        proseLines.push(trimmed);
      }
      continue;
    }
    if (!active) {
      active = {
        startLine: index + 1,
        endLine: index + 1,
        heading: currentHeading,
        fields: {},
        source: "structured",
      };
    }
    active.endLine = index + 1;
    active.fields[key] = [...(active.fields[key] ?? []), match[2].trim()];
  }

  flush();
  flushProse();
  return blocks;
}

function inferDecision(block: DocumentLawBlock): "APPROVED" | "DENIED" {
  const explicit = block.fields.decision?.join(" ").toLowerCase() ?? "";
  if (/\bdeny\b|\bdenied\b|\bforbid\b|\bforbidden\b|\bblock\b/.test(explicit)) {
    return "DENIED";
  }
  const hasOnlyNegativeRail =
    (block.fields.forbid?.length ?? 0) > 0
    && (block.fields.require?.length ?? 0) === 0
    && (block.fields.expression?.length ?? 0) === 0
    && (block.fields.output_shape?.length ?? 0) === 0;
  if (hasOnlyNegativeRail) {
    return "DENIED";
  }
  return "APPROVED";
}

function dedupePatterns(values: string[]): string[] {
  return [...new Set(values.flatMap((value) => expandStructuralPatterns(normalizeDelimitedList(value))))];
}

function expandStructuralPatterns(values: string[]): string[] {
  const expanded = new Set<string>();
  for (const value of values) {
    const trimmed = stripTrailingPunctuation(value);
    if (!trimmed) {
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

function buildInvariantLabel(block: DocumentLawBlock, args: {
  expressionProfile?: string;
  outputShape?: BoundaryUplTrackConstraint["outputShape"];
  requiredTextPatterns: string[];
  forbiddenTextPatterns: string[];
}): string {
  const explicit = block.fields.invariant?.find(Boolean)?.trim();
  if (explicit) {
    return explicit;
  }
  if (block.heading) {
    return block.heading;
  }
  if (args.expressionProfile) {
    return `Use expression profile: ${args.expressionProfile}`;
  }
  if (args.outputShape) {
    return `Output shape must remain ${args.outputShape}`;
  }
  if (args.requiredTextPatterns.length > 0) {
    return `Output must include: ${args.requiredTextPatterns.join(", ")}`;
  }
  return `Output must not include: ${args.forbiddenTextPatterns.join(", ")}`;
}

function compileBlock(args: {
  sourcePath: string;
  block: DocumentLawBlock;
}): ParsedDirective | null {
  const requiredTextPatterns = dedupePatterns(args.block.fields.require ?? []);
  const forbiddenTextPatterns = dedupePatterns(args.block.fields.forbid ?? []);
  const outputShape = args.block.fields.output_shape
    ?.map((value) => detectOutputShape(value))
    .find((value) => value !== undefined);
  const expressionProfileRaw = args.block.fields.expression?.at(0)?.trim();
  const expressionProfile = expressionProfileRaw ? normalizeExpressionProfile(expressionProfileRaw) : undefined;
  const enforcement = args.block.fields.enforcement?.join("; ").trim();

  if (
    requiredTextPatterns.length === 0
    && forbiddenTextPatterns.length === 0
    && !outputShape
    && !expressionProfile
  ) {
    return null;
  }

  const invariantLabel = buildInvariantLabel(args.block, {
    expressionProfile,
    outputShape,
    requiredTextPatterns,
    forbiddenTextPatterns,
  });
  const invariantLawId = buildInvariantId(args.sourcePath, args.block.startLine, invariantLabel);
  const type = inferDecision(args.block);
  const descriptionParts = [
    type === "APPROVED" ? "approved" : "denied",
    "chat corridor",
    expressionProfile ? `expression=${expressionProfile}` : null,
    outputShape ? `shape=${outputShape}` : null,
    enforcement ? `enforcement=${enforcement}` : null,
  ].filter(Boolean);

  const trackConstraint: BoundaryUplTrackConstraint = {
    allowedActionKinds: ["chat.emit"],
    reviewSurface: "chat",
    reviewInvariantLawId: invariantLawId,
    ...(requiredTextPatterns.length ? { requiredTextPatterns } : {}),
    ...(forbiddenTextPatterns.length ? { forbiddenTextPatterns } : {}),
    ...(outputShape ? { outputShape } : {}),
    ...(expressionProfile ? { expressionProfile } : {}),
    description: descriptionParts.join(" | "),
  };

  return {
    type,
    invariantLawId,
    invariantLabel,
    notes: `document-law import: ${path.basename(args.sourcePath)}:${args.block.startLine}-${args.block.endLine}`,
    trackConstraint,
    reviewContext: {
      surface: "chat",
      invariantLawId,
      invariantLabel,
      title: args.block.heading,
      question: enforcement,
    },
  };
}

function directiveSignature(directive: ParsedDirective): string {
  return createHash("sha256")
    .update(JSON.stringify({
      type: directive.type,
      invariantLabel: directive.invariantLabel,
      trackConstraint: directive.trackConstraint,
      reviewContext: directive.reviewContext,
    }))
    .digest("hex");
}

function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function stripTrailingPunctuation(value: string): string {
  return value.trim().replace(/[.?!]+$/g, "").trim();
}

function extractPatternTail(sentence: string, regexes: RegExp[]): string[] {
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

function extractFieldsFromProse(paragraph: string): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  const sentences = splitSentences(paragraph);
  let policySignals = 0;

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const push = (key: string, value: string) => {
      fields[key] = [...(fields[key] ?? []), value];
      policySignals += 1;
    };

    if (/\b(enforce|enforced|reject|block|catch|deny|guard|must stay within)\b/.test(lower)) {
      push("enforcement", stripTrailingPunctuation(sentence));
    }

    const shapes = extractPatternTail(sentence, [
      /\b(?:respond|return|output|format)\s+(?:only\s+)?(?:in|as|using)\s+(.+)/i,
      /\b(?:the answer|response|output)\s+must\s+be\s+(.+)/i,
    ]).map((value) => detectOutputShape(value)).filter(Boolean) as Array<NonNullable<BoundaryUplTrackConstraint["outputShape"]>>;
    for (const shape of shapes) {
      push("output_shape", shape);
    }

    const expressions = extractPatternTail(sentence, [
      /\b(?:speak|respond|write)\s+(?:in|with|like)\s+(.+)/i,
      /\b(?:tone|style|expression)\s+(?:is|must be|should be)\s+(.+)/i,
    ]);
    for (const expression of expressions) {
      push("expression", expression);
    }

    const required = extractPatternTail(sentence, [
      /\b(?:must include|must say|should include|should say|include|contain)\s+(.+)/i,
      /\b(?:return|respond with|answer with)\s+(.+)/i,
    ]);
    for (const requirement of required) {
      if (/^(?:in|as|with)\b/i.test(requirement)) {
        continue;
      }
      push("require", requirement);
    }

    const forbidden = extractPatternTail(sentence, [
      /\b(?:must not include|must not say|do not say|never say|never mention|must not mention|forbid|forbidden|block)\s+(.+)/i,
      /\bwithout\s+(.+)/i,
    ]);
    for (const prohibition of forbidden) {
      push("forbid", prohibition);
    }

    if (/\bmust\b|\bshall\b|\bonly\b|\bnever\b|\bdo not\b|\balways\b/.test(lower)) {
      push("invariant", stripTrailingPunctuation(sentence));
    }
    if (/\bdeny\b|\bforbid\b|\bblock\b|\bprohibit\b/.test(lower)) {
      push("decision", "deny");
    }
  }

  if (policySignals < 2) {
    return {};
  }
  return fields;
}

export function compileMarkdownDocumentToLaws(args: {
  sourcePath: string;
  markdown: string;
}): CompiledDocumentLaw[] {
  const blocks = parseDocumentBlocks(args.markdown);
  const compiled = new Map<string, CompiledDocumentLaw>();

  for (const block of blocks) {
    const directive = compileBlock({
      sourcePath: args.sourcePath,
      block,
    });
    if (!directive) {
      continue;
    }

    const signature = directiveSignature(directive);
    if (compiled.has(signature)) {
      continue;
    }

    compiled.set(signature, {
      type: directive.type,
      scope: "GLOBAL",
      notes: directive.notes,
      requestBasis: {
        actionKind: "chat.emit",
        target: CHAT_TARGET,
        payloadSummary: `${directive.invariantLawId} :: ${directive.invariantLabel}`,
        provenance: "agent_inference",
        reviewContext: directive.reviewContext,
      },
      trackConstraint: directive.trackConstraint,
    });
  }

  return [...compiled.values()];
}
