import { NextResponse } from "next/server";
import { extractPdfTextWithOcr } from "@/lib/server/pdf-ocr";

type ExtractBody = {
  filename?: string;
  contentBase64?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExtractBody;
    const b64 = (body.contentBase64 ?? "").trim();
    if (!b64) {
      return NextResponse.json({ error: "Missing `contentBase64`." }, { status: 400 });
    }

    const buffer = Buffer.from(b64, "base64");
    if (buffer.length === 0) {
      return NextResponse.json({ error: "Empty PDF payload." }, { status: 400 });
    }

    const result = await extractPdfTextWithOcr(new Uint8Array(buffer));
    return NextResponse.json({
      filename: body.filename ?? "input.pdf",
      method: result.method,
      chars: result.text.length,
      text: result.text,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to extract PDF text." },
      { status: 500 },
    );
  }
}
