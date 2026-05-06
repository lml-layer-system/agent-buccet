import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const ignoredDirs = new Set([".git", "node_modules", "dist", ".cursor"]);
const boundaryLedgerDir = path.join(repoRoot, "data", "ledger");

async function removeArtifacts(rootDir: string): Promise<string[]> {
  const removed: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && ignoredDirs.has(entry.name)) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.name.startsWith("._") || entry.name === ".DS_Store") {
        await fs.rm(fullPath, { force: true });
        removed.push(path.relative(repoRoot, fullPath));
      }
    }
  }

  await walk(rootDir);
  return removed.sort();
}

async function main() {
  // Ensure boundary ledger tests run deterministically by removing any
  // accumulated ledger state from previous runs.
  await fs.rm(boundaryLedgerDir, { recursive: true, force: true }).catch(() => undefined);

  const removed = await removeArtifacts(repoRoot);
  if (removed.length === 0) {
    console.log("artifact clean: nothing to remove");
    return;
  }
  console.log(`artifact clean: removed ${removed.length} files`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
