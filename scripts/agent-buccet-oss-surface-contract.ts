import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const ignoredDirs = new Set([".git", "node_modules", "dist"]);
const ignoredExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".wasm",
  ".zip",
  ".gz",
  ".tgz",
  ".lockb",
]);

const proprietaryCollapseToken = String.fromCharCode(69, 70, 85, 69);
const blockedPatterns = [
  new RegExp(`\\b${proprietaryCollapseToken}\\b`, "i"),
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function scanRepo(rootDir: string): Promise<string[]> {
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

      if (ignoredExtensions.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }

      let content: string;
      try {
        content = await fs.readFile(fullPath, "utf8");
      } catch {
        continue;
      }

      for (const pattern of blockedPatterns) {
        if (pattern.test(content)) {
          matches.push(path.relative(repoRoot, fullPath));
          break;
        }
      }
    }
  }

  await walk(rootDir);
  return matches.sort();
}

async function main() {
  const matches = await scanRepo(repoRoot);
  assert(
    matches.length === 0,
    `OSS surface contract failed; proprietary internal-engine references must not appear in the public repo:\n- ${matches.join("\n- ")}`,
  );
  console.log("OSS surface contract passed (no proprietary internal-engine references in public repo)");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
