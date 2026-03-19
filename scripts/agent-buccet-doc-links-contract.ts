import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function walkMarkdownFiles(rootDir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") {
          continue;
        }
        await walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        results.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return results;
}

function normalizeLinkTarget(link: string): string | null {
  const trimmed = link.trim();
  if (!trimmed) {
    return null;
  }
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("#")
  ) {
    return null;
  }

  const noAnchor = trimmed.split("#")[0] ?? "";
  const noQuery = noAnchor.split("?")[0] ?? "";
  if (!noQuery) {
    return null;
  }
  return noQuery;
}

async function main() {
  const markdownFiles = await walkMarkdownFiles(repoRoot);

  const errors: string[] = [];
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;

  for (const filePath of markdownFiles) {
    const raw = await fs.readFile(filePath, "utf8");

    for (const match of raw.matchAll(linkPattern)) {
      const target = normalizeLinkTarget(match[1] ?? "");
      if (!target) {
        continue;
      }

      // GitHub interprets `/docs/...` and `/lib/...` as domain-root paths, not repo-root.
      // Enforce repo-relative links so public docs don't break.
      if (target.startsWith("/")) {
        errors.push(
          `${path.relative(repoRoot, filePath)} uses forbidden absolute local link target: ${target}`,
        );
        continue;
      }

      const resolved = path.resolve(path.dirname(filePath), target);

      const exists = await fs.access(resolved).then(() => true).catch(() => false);
      if (!exists) {
        errors.push(
          `${path.relative(repoRoot, filePath)} has broken local link target: ${target}`,
        );
      }
    }
  }

  assert(errors.length === 0, `doc link contract failed:\n- ${errors.join("\n- ")}`);
  console.log(`doc link contract passed (${markdownFiles.length} markdown files checked)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
