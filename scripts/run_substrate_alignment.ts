import { promises as fs } from "node:fs";
import path from "node:path";
import { appendCodingSubstrateLedger } from "../lib/lml/coding-substrate-ledger.ts";

function renderReport(): string {
  const lines: string[] = [];
  lines.push("# Coding Substrate Alignment");
  lines.push("");
  lines.push("- planet: `ability`");
  lines.push("- ontology: `aligned`");
  lines.push("- substrate features: `micro-emitter`, `post-fill semantic correction`, `slot-local fail-closed gating`");
  lines.push("- integrated inputs:");
  lines.push("  - `CODEX NEEDS/Micro-Emitter.txt`");
  lines.push("  - `CODEX NEEDS/post-fill semantic correction loop.txt`");
  lines.push("");
  lines.push("## Active Files");
  lines.push("");
  lines.push("- `lib/lml/coding-micro-emitter.ts`");
  lines.push("- `lib/lml/coding-post-fill-correction.ts`");
  lines.push("- `lib/lml/coding-body-fill.ts`");
  lines.push("- `lib/lml/coding-substrate-laws.ts`");
  lines.push("");
  lines.push("## Laws");
  lines.push("");
  lines.push("- `ABILITY.CODING.166`");
  lines.push("- `ABILITY.CODING.167`");
  lines.push("- `ABILITY.CODING.168`");
  lines.push("- `ABILITY.CODING.169`");
  lines.push("- `ABILITY.CODING.170`");
  lines.push("");
  lines.push("## Alignment");
  lines.push("");
  lines.push("- micro-emitter prompt builder is active in slot fill");
  lines.push("- single-slot emission gate is active before generated slot admission");
  lines.push("- post-fill rollback/auth-bypass audit is active before generated slot admission");
  lines.push("- failed post-fill audit collapses to scaffold fallback");
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const reportPath = path.join(process.cwd(), "docs", `CODING_SUBSTRATE_ALIGNMENT_${stamp}.md`);
  await fs.writeFile(reportPath, renderReport(), "utf8");
  await appendCodingSubstrateLedger("SUBSTRATE_ALIGNMENT_COMPLETED", {
    createdAt: new Date().toISOString(),
    reportPath,
    planet: "ability",
    ontologyStatus: "aligned",
    lawIds: [
      "ABILITY.CODING.166",
      "ABILITY.CODING.167",
      "ABILITY.CODING.168",
      "ABILITY.CODING.169",
      "ABILITY.CODING.170",
    ],
    substrateFeatures: [
      "micro-emitter-prompt-builder",
      "single-slot-emission-gate",
      "post-fill-semantic-correction",
      "fail-closed-fallback-on-audit-failure",
    ],
    integratedInputs: [
      "CODEX NEEDS/Micro-Emitter.txt",
      "CODEX NEEDS/post-fill semantic correction loop.txt",
    ],
  });
  console.log(reportPath);
}

await main();
