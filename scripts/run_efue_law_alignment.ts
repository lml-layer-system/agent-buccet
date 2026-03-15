import { promises as fs } from "node:fs";
import path from "node:path";
import {
  CODING_EFUE_DIMENSIONS,
  CODING_EFUE_FAILURE_SPACE,
  CODING_EFUE_MASTERY_LAWS,
  CODING_EFUE_META_PRINCIPLES,
} from "../lib/lml/coding-efue-laws.ts";
import { appendCodingEfueLedger } from "../lib/lml/coding-efue-ledger.ts";

function countHiddenFailureClasses(): number {
  return Object.values(CODING_EFUE_FAILURE_SPACE).reduce((total, group) => total + group.length, 0);
}

async function main(): Promise<void> {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const reportPath = path.join(process.cwd(), "docs", `CODING_EFUE_LAW_ALIGNMENT_${stamp}.md`);
  const lines = [
    "# Coding EFUE Law Alignment",
    "",
    "- planet: `ability`",
    "- ontology: `aligned`",
    `- law range: \`ABILITY.CODING.177-275\``,
    `- mastery law count: \`${CODING_EFUE_MASTERY_LAWS.length}\``,
    `- hidden failure classes modeled: \`${countHiddenFailureClasses()}\``,
    `- dimensions: \`${CODING_EFUE_DIMENSIONS.length}\``,
    `- meta-principles: \`${CODING_EFUE_META_PRINCIPLES.length}\``,
    "",
    "## Integrated Sections",
    "",
    "- hidden failure space taxonomy",
    "- 99 mastery laws",
    "- 9 coding mastery dimensions",
    "- 9 meta-principles",
    "",
    "## Active Files",
    "",
    "- `lib/lml/coding-efue-laws.ts`",
    "- `lib/lml/ability-planet-laws.ts`",
    "",
    "## Read",
    "",
    "- EFUE law body is now part of the live coding law planet",
    "- the hidden failure taxonomy is explicitly modeled in-repo",
    "- mastery dimensions and meta-principles are recorded as coding-planet reference structure",
  ];

  await fs.writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
  await appendCodingEfueLedger("EFUE_LAW_ALIGNMENT_COMPLETED", {
    createdAt: new Date().toISOString(),
    reportPath,
    planet: "ability",
    ontologyStatus: "aligned",
    lawRange: "ABILITY.CODING.177-275",
    lawCount: CODING_EFUE_MASTERY_LAWS.length,
    hiddenFailureClassCount: countHiddenFailureClasses(),
    dimensionCount: CODING_EFUE_DIMENSIONS.length,
    metaPrincipleCount: CODING_EFUE_META_PRINCIPLES.length,
  });
  console.log(reportPath);
}

await main();
