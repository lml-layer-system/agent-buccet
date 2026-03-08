export type LawRecord = {
  id: string;
  sourceFile: string;
  sourcePath: string;
  section: string;
  indexInFile: number;
  text: string;
  level: string | null;
  dimension: string | null;
  normative: boolean;
  tags: string[];
};

export type LawsManifest = {
  generatedAt: string;
  sourceDir: string;
  totalSourceFiles: number;
  processedFiles: number;
  failedFiles: number;
  totalRecords: number;
  perFileCounts: Record<string, number>;
  failures: Array<{ file: string; reason: string }>;
  levels: string[];
  dimensions: string[];
};
