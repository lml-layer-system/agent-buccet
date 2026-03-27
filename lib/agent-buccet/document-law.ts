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

function compileDirective(args: {
  sourcePath: string;
  lineNumber: number;
  type: "APPROVED" | "DENIED";
  label: string;
  requiredTextPatterns?: string[];
  forbiddenTextPatterns?: string[];
  outputShape?: BoundaryUplTrackConstraint["outputShape"];
  expressionProfile?: string;
}): ParsedDirective {
  const invariantLawId = buildInvariantId(args.sourcePath, args.lineNumber, args.label);
  const description = args.expressionProfile
    ? `${args.type === "APPROVED" ? "approved" : "denied"} chat corridor: ${args.expressionProfile}`
    : `${args.type === "APPROVED" ? "approved" : "denied"} chat corridor from ${path.basename(args.sourcePath)}`;
  const trackConstraint: BoundaryUplTrackConstraint = {
    allowedActionKinds: ["chat.emit"],
    reviewSurface: "chat",
    reviewInvariantLawId: invariantLawId,
    ...(args.requiredTextPatterns?.length ? { requiredTextPatterns: args.requiredTextPatterns } : {}),
    ...(args.forbiddenTextPatterns?.length ? { forbiddenTextPatterns: args.forbiddenTextPatterns } : {}),
    ...(args.outputShape ? { outputShape: args.outputShape } : {}),
    ...(args.expressionProfile ? { expressionProfile: args.expressionProfile } : {}),
    description,
  };
  return {
    type: args.type,
    invariantLawId,
    invariantLabel: args.label,
    notes: `document-law import: ${path.basename(args.sourcePath)}:${args.lineNumber}`,
    trackConstraint,
    reviewContext: {
      surface: "chat",
      invariantLawId,
      invariantLabel: args.label,
    },
  };
}

export function compileMarkdownDocumentToLaws(args: {
  sourcePath: string;
  markdown: string;
}): CompiledDocumentLaw[] {
  const lines = args.markdown.split(/\r?\n/);
  const compiled: CompiledDocumentLaw[] = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    if (rawLine.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const lineNumber = index + 1;
    let directive: ParsedDirective | null = null;

    const speakThisWay = line.match(/^(?:[-*]\s*)?(?:speak this way|speak like|respond like|expression|tone)\s*:\s*(.+)$/i);
    if (speakThisWay) {
      const profile = speakThisWay[1].trim();
      directive = compileDirective({
        sourcePath: args.sourcePath,
        lineNumber,
        type: "APPROVED",
        label: `Use expression profile: ${profile}`,
        expressionProfile: profile,
      });
    }

    const outputShape = !directive && line.match(/^(?:[-*]\s*)?(?:output shape|return shape|completion grammar)\s*:\s*(.+)$/i);
    if (outputShape) {
      const shape = detectOutputShape(outputShape[1]);
      if (shape) {
        directive = compileDirective({
          sourcePath: args.sourcePath,
          lineNumber,
          type: "APPROVED",
          label: `Output shape must remain ${shape}`,
          outputShape: shape,
          expressionProfile: shape,
        });
      }
    }

    const mustInclude = !directive && line.match(/^(?:[-*]\s*)?(?:must include|must say|say this|only say|respond with)\s*:\s*(.+)$/i);
    if (mustInclude) {
      const required = normalizeDelimitedList(mustInclude[1]);
      if (required.length > 0) {
        directive = compileDirective({
          sourcePath: args.sourcePath,
          lineNumber,
          type: "APPROVED",
          label: `Output must include: ${required.join(", ")}`,
          requiredTextPatterns: required,
        });
      }
    }

    const mustNotInclude = !directive && line.match(/^(?:[-*]\s*)?(?:must not include|do not say|never say|must not say|forbid phrase)\s*:\s*(.+)$/i);
    if (mustNotInclude) {
      const forbidden = normalizeDelimitedList(mustNotInclude[1]);
      if (forbidden.length > 0) {
        directive = compileDirective({
          sourcePath: args.sourcePath,
          lineNumber,
          type: "DENIED",
          label: `Output must not include: ${forbidden.join(", ")}`,
          forbiddenTextPatterns: forbidden,
        });
      }
    }

    if (!directive) {
      continue;
    }

    compiled.push({
      type: directive.type,
      scope: "GLOBAL",
      notes: directive.notes,
      requestBasis: {
        actionKind: "chat.emit",
        target: "chat:primary",
        payloadSummary: `${directive.invariantLawId} :: ${directive.invariantLabel}`,
        provenance: "agent_inference",
        reviewContext: directive.reviewContext,
      },
      trackConstraint: directive.trackConstraint,
    });
  }

  return compiled;
}
