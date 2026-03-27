import { createHash } from "node:crypto";
import path from "node:path";
import type {
  BoundaryUplTrackConstraint,
  CompiledDocumentLaw,
} from "./types.ts";
import {
  extractPatternTail,
  hasEnoughPolicySignals,
  isPolicyClaim,
  passesPolicyEntropy,
  segmentPolicyClaims,
  stripTrailingPunctuation,
} from "./track-extractor-entropy.ts";
import {
  collapseActionTrackMeaning,
  inferActionKindFromSentence,
  inferReviewSurface,
  inferTargetFromSentence,
  resolveActionKind,
} from "./track-extractor-action.ts";
import {
  collapseOutputTrackMeaning,
  detectCompletionGrammar,
  detectOutputShape,
} from "./output-track-extractor.ts";
import {
  buildExpressionInvariantLabel,
  collapseExpressionTrackMeaning,
  extractExpressionFieldsFromSentence,
  normalizeExpressionProfile,
} from "./expression-track-extractor.ts";
import type { DocumentLawBlock, ParsedDirective } from "./track-extractor-types.ts";

const FIELD_ALIASES: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /^(?:decision|disposition|status)$/i, key: "decision" },
  { pattern: /^(?:invariant|rule|constraint|law)$/i, key: "invariant" },
  { pattern: /^(?:enforcement|enforced by|guard|mechanism)$/i, key: "enforcement" },
  { pattern: /^(?:action|action kind|surface|move family)$/i, key: "action" },
  { pattern: /^(?:target|path|scope path|command|domain|recipient|database|system target)$/i, key: "target" },
  { pattern: /^(?:speak this way|speak like|respond like|expression|tone|style)$/i, key: "expression" },
  { pattern: /^(?:output shape|return shape|format|schema)$/i, key: "output_shape" },
  { pattern: /^(?:completion grammar|completion shape|completion)$/i, key: "completion_grammar" },
  { pattern: /^(?:must include|must say|say this|only say|respond with|required|require)$/i, key: "require" },
  { pattern: /^(?:must not include|do not say|never say|must not say|forbid phrase|forbid|forbidden)$/i, key: "forbid" },
];

function sanitizeLawSlug(input: string): string {
  return input
    .toUpperCase()
    .replaceAll(/[^A-Z0-9]+/g, ".")
    .replaceAll(/^\.+|\.+$/g, "") || "DOCUMENT";
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

function extractFieldsFromProse(paragraph: string): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  const sentences = segmentPolicyClaims(paragraph)
    .filter((sentence) => isPolicyClaim(sentence))
    .filter((sentence) => passesPolicyEntropy(sentence));
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

    const actionKind = inferActionKindFromSentence(sentence);
    if (actionKind) {
      push("action", actionKind);
    }
    const target = inferTargetFromSentence(sentence);
    if (target) {
      push("target", target);
    }

    const shapeTails = extractPatternTail(sentence, [
      /\b(?:respond|return|output|format)\s+(?:only\s+)?(?:in|as|using)\s+(.+)/i,
      /\b(?:the answer|response|output)\s+must\s+be\s+(.+)/i,
    ]);
    const shapes = shapeTails
      .map((value) => detectOutputShape(value))
      .filter(Boolean) as Array<NonNullable<BoundaryUplTrackConstraint["outputShape"]>>;
    for (const shape of shapes) {
      push("output_shape", shape);
    }
    for (const grammar of shapeTails.map((value) => detectCompletionGrammar(value)).filter(Boolean) as string[]) {
      push("completion_grammar", grammar);
    }

    const expressions = extractExpressionFieldsFromSentence(sentence);
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

  if (!hasEnoughPolicySignals(policySignals)) {
    return {};
  }
  return fields;
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

function compileBlock(args: {
  sourcePath: string;
  block: DocumentLawBlock;
}): ParsedDirective | null {
  const actionKind = resolveActionKind(args.block.fields.action?.at(0));
  const surface = inferReviewSurface(actionKind);
  const actionMeaning = collapseActionTrackMeaning({
    actionKind,
    rawTarget: args.block.fields.target?.at(0),
  });
  const {
    corridor: actionCorridor,
    target,
    targetPattern,
    targetMatchMode,
  } = actionMeaning;
  const outputShape = args.block.fields.output_shape
    ?.map((value) => detectOutputShape(value))
    .find((value) => value !== undefined);
  const completionGrammar = args.block.fields.completion_grammar
    ?.map((value) => detectCompletionGrammar(value))
    .find((value) => value !== undefined);
  const expressionProfileRaw = args.block.fields.expression?.at(0)?.trim();
  const expressionMeaning = collapseExpressionTrackMeaning({
    block: args.block,
    expressionProfile: expressionProfileRaw ? normalizeExpressionProfile(expressionProfileRaw) : undefined,
  });
  const expressionProfile = expressionMeaning.profile;
  const expressionCorridor = expressionMeaning.corridor;
  const enforcement = args.block.fields.enforcement?.join("; ").trim();
  const outputMeaning = collapseOutputTrackMeaning({
    block: args.block,
    requiredValues: args.block.fields.require ?? [],
    forbiddenValues: args.block.fields.forbid ?? [],
    outputShape,
    completionGrammar,
  });
  const {
    corridor: outputCorridor,
    completionCorridor,
    requiredTextPatterns,
    forbiddenTextPatterns,
  } = outputMeaning;
  const hasMaterializedActionCorridor = Boolean(actionCorridor);
  const requestedExpressionCorridor = (args.block.fields.expression?.length ?? 0) > 0;
  const requestedOutputCorridor =
    (args.block.fields.require?.length ?? 0) > 0
    || (args.block.fields.forbid?.length ?? 0) > 0
    || (args.block.fields.output_shape?.length ?? 0) > 0
    || (args.block.fields.completion_grammar?.length ?? 0) > 0;
  const requestedActionCorridor =
    (args.block.fields.action?.length ?? 0) > 0
    || (args.block.fields.target?.length ?? 0) > 0;

  const snapIntegritySatisfied =
    (!requestedExpressionCorridor || Boolean(expressionCorridor))
    && (!requestedOutputCorridor || Boolean(outputCorridor) || Boolean(completionCorridor))
    && (!requestedActionCorridor || hasMaterializedActionCorridor);

  if (
    !snapIntegritySatisfied
    || (
    !hasMaterializedActionCorridor
    && requiredTextPatterns.length === 0
    && forbiddenTextPatterns.length === 0
    && !outputShape
    && !completionCorridor
    && !expressionCorridor
    )
  ) {
    return null;
  }

  const invariantLabel = expressionMeaning.invariantLabel
    ?? buildExpressionInvariantLabel(args.block, expressionProfile)
    ?? outputMeaning.invariantLabel
    ?? "Track corridor";
  const invariantLawId = buildInvariantId(args.sourcePath, args.block.startLine, invariantLabel);
  const type = inferDecision(args.block);
  const descriptionParts = [
    type === "APPROVED" ? "approved" : "denied",
    `${surface} corridor`,
    hasMaterializedActionCorridor ? `action=${actionKind}` : null,
    hasMaterializedActionCorridor && targetPattern ? `target=${targetPattern}` : null,
    expressionProfile ? `expression=${expressionProfile}` : null,
    expressionCorridor && !expressionProfile ? `expression=structured` : null,
    outputShape ? `shape=${outputShape}` : null,
    completionCorridor ? `completion=${completionCorridor.grammar}` : null,
    enforcement ? `enforcement=${enforcement}` : null,
  ].filter(Boolean);

  const trackConstraint: BoundaryUplTrackConstraint = {
    allowedActionKinds: [hasMaterializedActionCorridor ? actionKind : "chat.emit"],
    ...(hasMaterializedActionCorridor && targetPattern ? { targetPattern } : {}),
    ...(hasMaterializedActionCorridor && targetMatchMode ? { targetMatchMode } : {}),
    reviewSurface: surface,
    reviewInvariantLawId: invariantLawId,
    ...(actionKind === "chat.emit" && requiredTextPatterns.length ? { requiredTextPatterns } : {}),
    ...(actionKind === "chat.emit" && forbiddenTextPatterns.length ? { forbiddenTextPatterns } : {}),
    ...(actionKind === "chat.emit" && outputShape ? { outputShape } : {}),
    ...(actionKind === "chat.emit" && outputCorridor ? { outputCorridor } : {}),
    ...(actionKind === "chat.emit" && outputMeaning.completionGrammar ? { completionGrammar: outputMeaning.completionGrammar } : {}),
    ...(actionKind === "chat.emit" && completionCorridor ? { completionCorridor } : {}),
    ...(actionKind === "chat.emit" && expressionProfile ? { expressionProfile } : {}),
    ...(actionKind === "chat.emit" && expressionCorridor ? { expressionCorridor } : {}),
    ...(hasMaterializedActionCorridor ? { actionCorridor } : {}),
    description: descriptionParts.join(" | "),
  };

  return {
    type,
    invariantLawId,
    invariantLabel,
    notes: `document-law import: ${path.basename(args.sourcePath)}:${args.block.startLine}-${args.block.endLine}`,
    actionKind,
    target,
    trackConstraint,
    reviewContext: {
      surface,
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
        actionKind: directive.actionKind,
        target: directive.target,
        payloadSummary: `${directive.invariantLawId} :: ${directive.invariantLabel}`,
        provenance: "agent_inference",
        reviewContext: directive.reviewContext,
      },
      trackConstraint: directive.trackConstraint,
    });
  }

  return [...compiled.values()];
}
