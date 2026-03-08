#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const LAWS_FILE = path.join(ROOT, "data", "generated", "laws.json");
const MANIFEST_FILE = path.join(ROOT, "data", "generated", "manifest.json");

function fail(message) {
  console.error(`Validation failed: ${message}`);
  process.exit(1);
}

async function main() {
  const [lawsRaw, manifestRaw] = await Promise.all([
    fs.readFile(LAWS_FILE, "utf8"),
    fs.readFile(MANIFEST_FILE, "utf8"),
  ]);

  const laws = JSON.parse(lawsRaw);
  const manifest = JSON.parse(manifestRaw);

  if (!Array.isArray(laws) || laws.length === 0) {
    fail("No law records generated.");
  }

  if (typeof manifest.totalRecords !== "number" || manifest.totalRecords !== laws.length) {
    fail("Manifest totalRecords does not match laws length.");
  }

  const seen = new Set();
  let missingFields = 0;

  for (const record of laws) {
    if (!record.id || !record.sourceFile || !record.sourcePath || !record.text || !record.section) {
      missingFields += 1;
    }
    if (seen.has(record.id)) {
      fail(`Duplicate id detected: ${record.id}`);
    }
    seen.add(record.id);
  }

  if (missingFields > 0) {
    fail(`Records with missing required fields: ${missingFields}`);
  }

  console.log(`Validation passed: ${laws.length} records, ${Object.keys(manifest.perFileCounts ?? {}).length} files.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
