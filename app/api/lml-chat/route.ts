import { NextResponse } from "next/server";
import { run_lml_chat_runtime, type RuntimeUserLaw } from "@/lib/lml/chat-runtime";

type ChatBody = {
  message?: string;
  sessionId?: string;
  userLaws?: RuntimeUserLaw[];
  documentText?: string;
  documents?: Array<{ id: string; name: string; text: string }>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatBody;
    const message = (body.message ?? "").trim();
    if (!message) {
      return NextResponse.json({ error: "Missing `message`." }, { status: 400 });
    }

    const result = await run_lml_chat_runtime({
      user_message: message,
      session_id: body.sessionId ?? "default-session",
      user_laws: body.userLaws ?? [],
      document_text: body.documentText ?? "",
      documents: body.documents ?? [],
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to run LML chat runtime." },
      { status: 500 },
    );
  }
}
