import type {
  BoundaryActionKind,
  BoundaryReviewContext,
  BoundaryUplTrackConstraint,
} from "./types.ts";

export type ParsedDirective = {
  type: "APPROVED" | "DENIED";
  invariantLawId: string;
  invariantLabel: string;
  notes: string;
  actionKind: BoundaryActionKind;
  target: string;
  trackConstraint: BoundaryUplTrackConstraint;
  reviewContext: BoundaryReviewContext;
};

export type DocumentLawBlock = {
  startLine: number;
  endLine: number;
  heading?: string;
  fields: Record<string, string[]>;
  source: "structured" | "prose";
};
