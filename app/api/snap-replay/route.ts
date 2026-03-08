import { NextResponse } from "next/server";
import { replaySnapRunById } from "@/lib/ledger";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const runId = (url.searchParams.get("runId") ?? "").trim();

    if (!runId) {
      return NextResponse.json({ error: "Missing runId query parameter." }, { status: 400 });
    }

    const proof = await replaySnapRunById(runId);

    if (!proof.found) {
      return NextResponse.json({ error: "Run not found.", proof }, { status: 404 });
    }

    return NextResponse.json({ proof });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to replay run.",
      },
      { status: 500 },
    );
  }
}

