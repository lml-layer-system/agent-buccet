import type { CodingSkeletonContract } from "@/lib/lml/coding-skeleton-laws";

export type OracleFamily = Extract<
  CodingSkeletonContract["family"],
  "api" | "app" | "auth" | "compiler" | "game" | "orm" | "refactor"
>;

export type OracleHostileFamily = Extract<
  CodingSkeletonContract["family"],
  "api" | "app" | "auth" | "compiler" | "game" | "orm" | "refactor" | "parser" | "utility"
>;

export type OracleFileNode = {
  path: string;
  role: string;
  required: boolean;
  summary: string;
};

export type OracleImportContract = {
  from: string;
  to: string;
  rule: string;
};

export type OracleExportContract = {
  file: string;
  mustExport: string[];
  type: string;
};

export type OracleGraphVariant = {
  id: string;
  description: string;
  decompositionRule: string;
  files: OracleFileNode[];
};

export type OracleFamilyDefinition = {
  family: OracleFamily;
  title: string;
  stack: string[];
  variants: OracleGraphVariant[];
  canonicalFileRoles: Record<string, string>;
  importContracts: OracleImportContract[];
  exportContracts: OracleExportContract[];
  lawfulInvariants: string[];
};

export type OracleHostilePack = {
  family: OracleHostileFamily;
  variantName: string;
  targetFailure: string;
  hostileGraphVariant: string;
  hostileScaffoldShape: string;
  hostileSlotTrap: string;
  hostileInvariantsViolated: string[];
  hostileWitnessExpectation: string;
  forbiddenEscapeRoutes: string[];
  minimalHostileExample: string;
};
