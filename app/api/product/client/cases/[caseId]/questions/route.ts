import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { appendProductMutationLedger } from "@/lib/ledger";
import { getAuthContext, requireRole } from "@/lib/auth/rbac";
import { addClientQuestion, findCase } from "@/lib/storage/product-store";

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const auth = getAuthContext(request);
    requireRole(auth, ["client"]);

    const { caseId } = await context.params;
    const existing = await findCase(caseId);
    if (!existing || existing.clientId !== auth.userId) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    const body = (await request.json()) as { text?: string };
    const text = (body.text ?? "").trim();
    if (!text) {
      return NextResponse.json({ error: "Question text is required." }, { status: 400 });
    }

    const result = await addClientQuestion({
      caseId,
      clientId: auth.userId,
      text,
    });

    if (!result) {
      return NextResponse.json({ error: "Unable to submit question." }, { status: 500 });
    }

    const ledger = await appendProductMutationLedger({
      mutationId: randomUUID(),
      mutationType: "QUESTION_SUBMITTED",
      caseId,
      actorId: auth.userId,
      role: auth.role,
      details: {
        questionId: result.question.id,
        textLength: text.length,
      },
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      message: "Question submitted.",
      autoAck: result.question.autoAck,
      questionId: result.question.id,
      ledger: {
        index: ledger.index,
        digest: ledger.digest,
        prevDigest: ledger.prevDigest,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to submit question." }, { status: 403 });
  }
}
