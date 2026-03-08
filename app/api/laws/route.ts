import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import type { LawRecord, LawsManifest } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data", "generated");
const LAWS_FILE = path.join(DATA_DIR, "laws.json");
const MANIFEST_FILE = path.join(DATA_DIR, "manifest.json");

async function loadData(): Promise<{ laws: LawRecord[]; manifest: LawsManifest }> {
  const [lawsRaw, manifestRaw] = await Promise.all([
    fs.readFile(LAWS_FILE, "utf-8"),
    fs.readFile(MANIFEST_FILE, "utf-8"),
  ]);
  return {
    laws: JSON.parse(lawsRaw) as LawRecord[],
    manifest: JSON.parse(manifestRaw) as LawsManifest,
  };
}

export async function GET(request: Request) {
  try {
    const { laws, manifest } = await loadData();
    const { searchParams } = new URL(request.url);

    if (searchParams.get("stats") === "1") {
      return NextResponse.json(manifest);
    }

    const q = (searchParams.get("q") ?? "").trim().toLowerCase();
    const source = (searchParams.get("source") ?? "").trim().toLowerCase();
    const dimension = (searchParams.get("dimension") ?? "").trim();
    const level = (searchParams.get("level") ?? "").trim();
    const page = Number(searchParams.get("page") ?? "1") || 1;
    const pageSize = Math.min(Number(searchParams.get("pageSize") ?? "50") || 50, 200);

    const filtered = laws.filter((law) => {
      if (q && !law.text.toLowerCase().includes(q) && !law.section.toLowerCase().includes(q)) {
        return false;
      }
      if (source && !law.sourceFile.toLowerCase().includes(source)) {
        return false;
      }
      if (dimension && law.dimension !== dimension) {
        return false;
      }
      if (level && law.level !== level) {
        return false;
      }
      return true;
    });

    const start = (Math.max(1, page) - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return NextResponse.json({
      page,
      pageSize,
      total: filtered.length,
      items,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Law dataset not found or unreadable.",
        hint: "Run `npm run ingest` then `npm run validate`.",
      },
      { status: 500 },
    );
  }
}
