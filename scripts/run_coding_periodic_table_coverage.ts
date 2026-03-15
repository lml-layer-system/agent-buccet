import { promises as fs } from "node:fs";
import path from "node:path";

type TableLeaf = {
  id: string;
  title: string;
  dimension: string;
};

type CoverageStatus = "direct" | "subsumed" | "uncovered";

type CoverageResult = {
  id: string;
  title: string;
  status: CoverageStatus;
  reason: string;
};

const TABLE_PATH = "/Users/ryangatoloai-faupula/Desktop/INFINITE TO FINITE EFUE ✅ 2/CODING_FAILURE_PERIODIC_TABLE.md";
const REPORT_PATH = path.join(process.cwd(), "docs", "CODING_FAILURE_PERIODIC_TABLE_COVERAGE_20260312.md");

async function main(): Promise<void> {
  const raw = await fs.readFile(TABLE_PATH, "utf8");
  const leaves = parseLeaves(raw);
  const results = leaves.map(classifyCoverage);
  const report = renderReport(leaves, results);
  await fs.writeFile(REPORT_PATH, report, "utf8");
  console.log(REPORT_PATH);
}

function parseLeaves(markdown: string): TableLeaf[] {
  const matches = [...markdown.matchAll(/\*\*([SLAGCFI]\d\.\d)\:\s+([^*]+)\*\*/g)];
  return matches.map((match) => ({
    id: match[1],
    title: match[2].trim(),
    dimension: match[1][0],
  }));
}

function classifyCoverage(leaf: TableLeaf): CoverageResult {
  const id = leaf.id;

  const direct = new Map<string, string>([
    ["S1.2", "Directly caught by language-surface and cross-language contamination checks."],
    ["A1.3", "Directly caught by circular dependency architecture validation."],
    ["A1.1", "Directly caught by tight-coupling design validation."],
    ["A1.2", "Directly caught by god-object design validation."],
    ["A1.4", "Directly caught by feature-envy design validation."],
    ["A1.5", "Directly caught by inappropriate-intimacy design validation."],
    ["A1.6", "Directly caught by message-chain design validation."],
    ["A1.7", "Directly caught by middle-man design validation."],
    ["F1.1", "Directly caught by SQL injection security validator."],
    ["F1.2", "Directly caught by XSS security validator."],
    ["F1.3", "Directly caught by hardcoded credentials security validator."],
    ["G1.1", "Directly caught by wrong-time-complexity scale validation."],
    ["G1.2", "Directly caught by exponential-growth scale validation."],
    ["G1.3", "Directly caught by non-scaling query/app shape validation."],
    ["I1.1", "Directly caught by dependency version mismatch validation."],
    ["I1.2", "Directly caught by missing dependency validation."],
    ["I1.3", "Directly caught by transitive dependency conflict validation."],
    ["L7.1", "Directly caught by uninitialized variable state validation."],
    ["L7.2", "Directly caught by race-condition state validation."],
    ["L7.3", "Directly caught by deadlock state validation."],
    ["L7.4", "Directly caught by state inconsistency validation."],
    ["L7.5", "Directly caught by global state pollution validation."],
    ["L7.6", "Directly caught by stale state validation."],
    ["L7.7", "Directly caught by missing state reset validation."],
  ]);
  if (direct.has(id)) {
    return { id, title: leaf.title, status: "direct", reason: direct.get(id)! };
  }

  if (/^S[1-7]\./.test(id)) {
    return {
      id,
      title: leaf.title,
      status: "subsumed",
      reason: "Subsumed by syntax substrate checks, AST/runtime validation, fenced-code shape, and language-surface coherence.",
    };
  }
  if (/^L[1-6]\./.test(id)) {
    return {
      id,
      title: leaf.title,
      status: "subsumed",
      reason: "Subsumed by witness validation, semantic contract checks, and test-behavior surface checks.",
    };
  }
  if (/^C1\./.test(id)) {
    return {
      id,
      title: leaf.title,
      status: "subsumed",
      reason: "Subsumed by intent spec, family fit, and collapse-no-survivor/context-gap handling.",
    };
  }

  return {
    id,
    title: leaf.title,
    status: "uncovered",
    reason: "No explicit leaf-class validator or defensible subsumption rule is installed yet.",
  };
}

function renderReport(leaves: TableLeaf[], results: CoverageResult[]): string {
  const counts = {
    direct: results.filter((result) => result.status === "direct").length,
    subsumed: results.filter((result) => result.status === "subsumed").length,
    uncovered: results.filter((result) => result.status === "uncovered").length,
  };

  const byDimension = new Map<string, { direct: number; subsumed: number; uncovered: number }>();
  for (const result of results) {
    const bucket = byDimension.get(result.id[0]) ?? { direct: 0, subsumed: 0, uncovered: 0 };
    bucket[result.status] += 1;
    byDimension.set(result.id[0], bucket);
  }

  const lines: string[] = [];
  lines.push("# Coding Failure Periodic Table Coverage Report");
  lines.push("");
  lines.push("## Scope");
  lines.push(`- source: ${TABLE_PATH}`);
  lines.push(`- explicit leaf classes parsed: ${leaves.length}`);
  lines.push("- note: this report only scores explicit leaf classes present in the current markdown file; placeholder groups not expanded in the file are not counted as leaves here.");
  lines.push("");
  lines.push("## Summary");
  lines.push(`- direct: ${counts.direct}`);
  lines.push(`- subsumed: ${counts.subsumed}`);
  lines.push(`- uncovered: ${counts.uncovered}`);
  lines.push("");
  lines.push("## By Dimension");
  for (const [dimension, bucket] of [...byDimension.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`- ${dimension}: direct=${bucket.direct}, subsumed=${bucket.subsumed}, uncovered=${bucket.uncovered}`);
  }
  lines.push("");
  lines.push("## Direct Coverage");
  for (const result of results.filter((item) => item.status === "direct")) {
    lines.push(`- ${result.id} ${result.title}: ${result.reason}`);
  }
  lines.push("");
  lines.push("## Uncovered Leaf Classes");
  for (const result of results.filter((item) => item.status === "uncovered")) {
    lines.push(`- ${result.id} ${result.title}: ${result.reason}`);
  }
  lines.push("");
  lines.push("## Read");
  lines.push("- `direct` means there is an explicit validator or law path for the named leaf class.");
  lines.push("- `subsumed` means the current law stack catches the class through a stronger generalized validator, but not by leaf-specific naming.");
  lines.push("- `uncovered` means the current system should not claim that leaf class is structurally closed yet.");
  return `${lines.join("\n")}\n`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
