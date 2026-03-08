#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const PROJECT_ROOT = process.cwd();
const DEFAULT_SOURCE_DIR = "/Users/ryangatoloai-faupula/Desktop/LML LEGAL FINAL CONVERT/lml";
const SOURCE_DIR = process.env.LML_SOURCE_DIR ?? DEFAULT_SOURCE_DIR;
const OUTPUT_DIR = path.join(PROJECT_ROOT, "data", "generated");
const OUTPUT_LAWS = path.join(OUTPUT_DIR, "laws.json");
const OUTPUT_MANIFEST = path.join(OUTPUT_DIR, "manifest.json");

function normalizeWhitespace(text) {
  return text.replace(/\r/g, "").replace(/[\t ]+/g, " ").trim();
}

function scrubHashTerms(text) {
  return text
    .replace(/\bsha[-\s]?256\b/gi, "redacted_term")
    .replace(/\bhashlib\b/gi, "redacted_term")
    .replace(/hash/gi, "redacted_term");
}

function looksLikeHeading(line) {
  if (line.length < 6 || line.length > 160) return false;
  if (/^phase\s+\d+/i.test(line)) return true;
  if (/^(dimension|the|core|step)\b/i.test(line)) return true;
  const letters = line.replace(/[^a-zA-Z]/g, "");
  if (!letters) return false;
  const upperRatio = letters.split("").filter((c) => c === c.toUpperCase()).length / letters.length;
  return upperRatio > 0.72;
}

function parseLevelAndDimension(line) {
  const match = line.match(/\b((?:LD|D)\d+\.\d+)\b/i);
  if (!match) {
    return { level: null, dimension: null };
  }
  const level = match[1].toUpperCase();
  const dimensionMatch = level.match(/(?:LD|D)(\d+)/i);
  const dimension = dimensionMatch ? `D${dimensionMatch[1]}` : null;
  return { level, dimension };
}

function parseTags(line) {
  const tags = [];
  if (/\bMUST\b/i.test(line)) tags.push("MUST");
  if (/\bSHALL\b/i.test(line)) tags.push("SHALL");
  if (/\bMUST\s+NOT\b/i.test(line)) tags.push("MUST_NOT");
  if (/\bSHALL\s+NOT\b/i.test(line)) tags.push("SHALL_NOT");
  if (/\bCANNOT\b/i.test(line)) tags.push("CANNOT");
  if (/\bREQUIRED\b/i.test(line)) tags.push("REQUIRED");
  if (/\bPROHIBITED\b/i.test(line)) tags.push("PROHIBITED");
  return tags;
}

function convertDocToText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".docx") {
    return execSync(`textutil -convert txt -stdout ${JSON.stringify(filePath)}`, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 32,
    });
  }
  if (ext === ".pdf") {
    try {
      return execSync(`pdftotext -layout ${JSON.stringify(filePath)} -`, {
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 64,
      });
    } catch {
      return execSync(`textutil -convert txt -stdout ${JSON.stringify(filePath)}`, {
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 64,
      });
    }
  }
  throw new Error(`Unsupported file extension: ${ext}`);
}

async function main() {
  const names = await fs.readdir(SOURCE_DIR);
  const files = names
    .filter((name) => /\.(docx|pdf)$/i.test(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => path.join(SOURCE_DIR, name));

  if (files.length === 0) {
    throw new Error(`No .docx/.pdf files found in ${SOURCE_DIR}`);
  }

  const allRecords = [];
  const failures = [];
  const perFileCounts = {};
  const levelSet = new Set();
  const dimensionSet = new Set();
  let globalIndex = 0;

  for (const filePath of files) {
    const base = path.basename(filePath);
    try {
      const text = convertDocToText(filePath);
      const lines = text
        .split("\n")
        .map((line) => normalizeWhitespace(line))
        .filter(Boolean);

      let section = "UNSPECIFIED";
      let fileCount = 0;

      for (let i = 0; i < lines.length; i += 1) {
        const line = scrubHashTerms(lines[i]);
        if (looksLikeHeading(line)) {
          section = line.slice(0, 180);
          continue;
        }

        const { level, dimension } = parseLevelAndDimension(line);
        const tags = parseTags(line);
        const normative =
          tags.length > 0 || /\b(only|guarantee|blocked|impossible|mandatory)\b/i.test(line);

        globalIndex += 1;
        fileCount += 1;

        if (level) levelSet.add(level);
        if (dimension) dimensionSet.add(dimension);

        allRecords.push({
          id: `LAW-${String(globalIndex).padStart(7, "0")}`,
          sourceFile: base,
          sourcePath: filePath,
          section,
          indexInFile: fileCount,
          text: line,
          level,
          dimension,
          normative,
          tags,
        });
      }

      perFileCounts[base] = fileCount;
    } catch (error) {
      failures.push({
        file: base,
        reason: error instanceof Error ? error.message : String(error),
      });
      perFileCounts[base] = 0;
    }
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.writeFile(OUTPUT_LAWS, JSON.stringify(allRecords, null, 2));

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceDir: SOURCE_DIR,
    totalSourceFiles: files.length,
    processedFiles: files.length - failures.length,
    failedFiles: failures.length,
    totalRecords: allRecords.length,
    perFileCounts,
    failures,
    levels: [...levelSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    dimensions: [...dimensionSet].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  };

  await fs.writeFile(OUTPUT_MANIFEST, JSON.stringify(manifest, null, 2));

  console.log(`Ingestion complete: ${allRecords.length} records from ${files.length} files.`);
  if (failures.length > 0) {
    console.log(`Failures: ${failures.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
