import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  renderBuccetMetaEfueSubstrateProcessMarkdown,
} from "../lib/agent-buccet/meta-efue-substrate-process.ts";

function repoRootFromHere() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(scriptDir, "..");
}

async function main() {
  const repoRoot = repoRootFromHere();
  const outputPath = path.join(repoRoot, "docs/agent-boundary/BUCCET_META_EFUE_SUBSTRATE_PROCESS.md");
  await fs.writeFile(outputPath, `${renderBuccetMetaEfueSubstrateProcessMarkdown()}\n`, "utf8");
  console.log(`wrote ${path.relative(repoRoot, outputPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
