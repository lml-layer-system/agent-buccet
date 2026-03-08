import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { appendProductMutationLedger } from "@/lib/ledger";
import { getAuthContext, requireRole } from "@/lib/auth/rbac";
import { listLawyerQuestions, replyToQuestion } from "@/lib/storage/product-store";

export async function GET(request: Request) {
  try {
    const auth = getAuthContext(request);
    requireRole(auth, ["lawyer", "staff"]);

    const questions = await listLawyerQuestions(auth.userId);
    return NextResponse.json({ items: questions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load messages." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuthContext(request);
    requireRole(auth, ["lawyer", "staff"]);

    const body = (await request.json()) as {
      caseId?: string;
      questionId?: string;
      reply?: string;
    };

    if (!body.caseId || !body.questionId || !body.reply) {
      return NextResponse.json({ error: "caseId, questionId, and reply are required." }, { status: 400 });
    }

    const updated = await replyToQuestion({
      caseId: body.caseId,
      questionId: body.questionId,
      lawyerId: auth.userId,
      reply: body.reply,
    });

    if (!updated) {
      return NextResponse.json({ error: "Unable to reply to question." }, { status: 404 });
    }

    const ledger = await appendProductMutationLedger({
      mutationId: randomUUID(),
      mutationType: "QUESTION_REPLIED",
      caseId: body.caseId,
      actorId: auth.userId,
      role: auth.role,
      details: {
        questionId: body.questionId,
        replyLength: body.reply.length,
      },
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      item: updated,
      ledger: {
        index: ledger.index,
        digest: ledger.digest,
        prevDigest: ledger.prevDigest,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to send reply." }, { status: 403 });
  }
}
