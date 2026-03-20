import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

type SourceRecord = {
  id: string;
};

type LawSection = {
  sectionId: string;
  title: string;
  lawIds: string[];
  laws: Array<{
    lawId: string;
    title: string;
    sourceRecords: Array<{
      id: string;
      pool: "floor" | "state" | "meta";
    }>;
  }>;
};

type Manifest = {
  sectionCount: number;
  lawCount: number;
  sections: Array<{
    sectionId: string;
    title: string;
    lawIds: string[];
    file: string;
  }>;
};

async function main() {
  const repoRoot = path.join(import.meta.dirname, "..");
  const lawWebPath = path.join(repoRoot, "data", "lml-law-foundation", "law-web.json");
  const sectionDir = path.join(repoRoot, "data", "agent-buccet-law-sections", "base-laws");
  const manifestPath = path.join(sectionDir, "manifest.json");

  const lawWeb = JSON.parse(await fs.readFile(lawWebPath, "utf8")) as Record<string, SourceRecord[]>;
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as Manifest;

  assert.equal(manifest.sectionCount, manifest.sections.length, "manifest section count mismatch");

  let totalLawCount = 0;

  for (const entry of manifest.sections) {
    const sectionPath = path.join(sectionDir, entry.file);
    const section = JSON.parse(await fs.readFile(sectionPath, "utf8")) as LawSection;

    assert.equal(section.sectionId, entry.sectionId, `section id mismatch for ${entry.file}`);
    assert.deepEqual(section.lawIds, entry.lawIds, `law id mismatch for ${entry.file}`);
    totalLawCount += section.lawIds.length;

    for (const law of section.laws) {
      assert.ok(section.lawIds.includes(law.lawId), `unexpected law ${law.lawId} in ${entry.file}`);
      assert.ok(law.sourceRecords.length > 0, `law ${law.lawId} has no source records`);

      for (const record of law.sourceRecords) {
        const exists = (lawWeb[record.pool] ?? []).some((candidate) => candidate.id === record.id);
        assert.ok(exists, `missing source record ${record.pool}:${record.id} for ${law.lawId}`);
      }
    }
  }

  assert.equal(totalLawCount, manifest.lawCount, "manifest law count mismatch");

  console.log(`base-law sections: ${manifest.sectionCount}`);
  console.log(`base-law count: ${manifest.lawCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
