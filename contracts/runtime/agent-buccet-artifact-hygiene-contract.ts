import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const blockedNames = [".DS_Store"];
const blockedPrefix = "._";
const ignoredDirs = new Set([".git", "node_modules", "dist", ".cursor", "data"]);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function scanForArtifacts(rootDir: string): Promise<string[]> {
  const matches: string[] = [];

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
      if (entry.name.startsWith(blockedPrefix) || blockedNames.includes(entry.name)) {
        matches.push(path.relative(repoRoot, fullPath));
      }
    }
  }

  await walk(rootDir);
  return matches.sort();
}

async function main() {
  const matches = await scanForArtifacts(repoRoot);
  assert(matches.length === 0, `artifact hygiene contract failed:\n- ${matches.join("\n- ")}`);
  console.log("artifact hygiene contract passed (no AppleDouble/metadata artifacts detected)");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
