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

  const flush = () => {
    if (!active) return;
    if (Object.keys(active.fields).length > 0) {
      blocks.push(active);
    }
    active = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const trimmed = rawLine.trim();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    if (!trimmed) {
      flush();
      continue;
    }
    if (trimmed.startsWith("#")) {
      flush();
      currentHeading = trimmed.replace(/^#+\s*/, "").trim() || undefined;
      continue;
    }

    const normalized = trimmed.replace(/^[-*]\s*/, "");
    const match = normalized.match(/^([^:]+):\s*(.+)$/);
    if (!match) {
      continue;
    }
    const key = normalizeFieldKey(match[1] ?? "");
    if (!key) {
      continue;
    }
    if (!active) {
      active = {
        startLine: index + 1,
        endLine: index + 1,
        heading: currentHeading,
        fields: {},
      };
    }
    active.endLine = index + 1;
    active.fields[key] = [...(active.fields[key] ?? []), match[2].trim()];
  }

  flush();
  return blocks;
}

function inferDecision(block: DocumentLawBlock): "APPROVED" | "DENIED" {
  const explicit = block.fields.decision?.join(" ").toLowerCase() ?? "";
  if (/\bdeny\b|\bdenied\b|\bforbid\b|\bforbidden\b|\bblock\b/.test(explicit)) {
    return "DENIED";
  }
  return "APPROVED";
}

function dedupePatterns(values: string[]): string[] {
  return [...new Set(values.flatMap((value) => normalizeDelimitedList(value)))];
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
  const expressionProfile = args.block.fields.expression?.at(0)?.trim();
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
