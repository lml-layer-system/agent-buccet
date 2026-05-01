#!/usr/bin/env node
// Import rewrite script: fixes relative import paths after repo reorganization.
// Run with: node scripts/dev/rewrite-imports.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative, dirname, basename, extname } from "node:path";

const ROOT = resolve(new URL(".", import.meta.url).pathname, "../..");

// ── 1. Build a map: absolute path (new location) for every .ts file we moved ──

function walk(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) walk(full, results);
    else if (entry.endsWith(".ts")) results.push(full);
  }
  return results;
}

const scanDirs = ["src", "cli", "contracts", "scripts"];
const allFiles = scanDirs.flatMap((d) => {
  try { return walk(resolve(ROOT, d)); } catch { return []; }
});

// Index by basename and by last two path segments (for subdir imports like gravity-adapter/gravity-service.ts)
const byBasename = new Map(); // basename → [absPath, ...]
const byTwoSegments = new Map(); // "dir/file.ts" → absPath

for (const f of allFiles) {
  const b = basename(f);
  if (!byBasename.has(b)) byBasename.set(b, []);
  byBasename.get(b).push(f);

  const parts = f.split("/");
  const twoSeg = parts.slice(-2).join("/");
  byTwoSegments.set(twoSeg, f);
  // also index three segments for deep subdirs
  if (parts.length >= 3) {
    const threeSeg = parts.slice(-3).join("/");
    byTwoSegments.set(threeSeg, f);
  }
}

// ── 2. Resolve a specifier from a given file to find the actual new target ──

function findTarget(fromFile, specifier) {
  // Resolve the specifier naively from the current file location
  const naivePath = resolve(dirname(fromFile), specifier);

  // If it actually exists at the naive path, no rewrite needed
  try {
    statSync(naivePath);
    return null; // already correct
  } catch { /* continue to search */ }

  // Extract the meaningful part of the specifier
  // e.g. "./ledger.ts" → "ledger.ts"
  // e.g. "../lib/agent-buccet/ledger.ts" → "ledger.ts"
  // e.g. "./gravity-adapter/gravity-service.ts" → "gravity-adapter/gravity-service.ts"
  // e.g. "../lib/agent-buccet/gravity-adapter/gravity-service.ts" → "gravity-adapter/gravity-service.ts"

  const specBase = specifier.replace(/^(\.\.?\/)+/, ""); // strip leading ./  ../  ../../ etc
  const specBasename = basename(specBase);

  // Try two-segment lookup first (handles subdir imports)
  const twoSeg = specBase.includes("/") ? specBase.split("/").slice(-2).join("/") : null;
  if (twoSeg && byTwoSegments.has(twoSeg)) {
    return byTwoSegments.get(twoSeg);
  }

  // Try three-segment lookup
  if (specBase.includes("/")) {
    const segs = specBase.split("/");
    const threeSeg = segs.slice(-3).join("/");
    if (byTwoSegments.has(threeSeg)) return byTwoSegments.get(threeSeg);
  }

  // Fallback: basename lookup (single match only)
  const candidates = byBasename.get(specBasename);
  if (!candidates || candidates.length === 0) return undefined; // not found
  if (candidates.length === 1) return candidates[0];

  // Multiple candidates: prefer the one closest to the naive path
  // Sort by edit distance (simple: fewest path-segment differences)
  const naiveParts = naivePath.split("/");
  candidates.sort((a, b) => {
    const aParts = a.split("/");
    const bParts = b.split("/");
    const aDiff = aParts.filter((p, i) => p !== naiveParts[i]).length;
    const bDiff = bParts.filter((p, i) => p !== naiveParts[i]).length;
    return aDiff - bDiff;
  });
  return candidates[0];
}

// ── 3. Rewrite one file ──

const IMPORT_RE = /(?:import|export)(?:\s+type)?\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|import\(["']([^"']+)["']\)/g;

let totalChanged = 0;

function rewriteFile(filePath) {
  const src = readFileSync(filePath, "utf8");
  let changed = false;

  const out = src.replace(IMPORT_RE, (match, spec1, spec2) => {
    const specifier = spec1 ?? spec2;
    if (!specifier) return match;
    // Only rewrite relative paths that end in .ts
    if (!specifier.startsWith(".") || !specifier.endsWith(".ts")) return match;

    const target = findTarget(filePath, specifier);
    if (target == null) return match; // already correct or not found
    if (target === undefined) {
      process.stderr.write(`WARN: cannot resolve "${specifier}" in ${relative(ROOT, filePath)}\n`);
      return match;
    }

    const newRelative = "./" + relative(dirname(filePath), target).replace(/\\/g, "/");
    if (newRelative === specifier) return match;

    changed = true;
    return match.replace(specifier, newRelative);
  });

  if (changed) {
    writeFileSync(filePath, out, "utf8");
    totalChanged++;
    process.stdout.write(`  updated: ${relative(ROOT, filePath)}\n`);
  }
}

// ── 4. Run on all scanned files ──

process.stdout.write(`Rewriting imports across ${allFiles.length} files...\n`);
for (const f of allFiles) rewriteFile(f);
process.stdout.write(`Done. ${totalChanged} file(s) updated.\n`);
