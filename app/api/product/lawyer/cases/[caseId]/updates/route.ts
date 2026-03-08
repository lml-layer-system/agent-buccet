import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { appendProductMutationLedger } from "@/lib/ledger";
import { getAuthContext, requireRole } from "@/lib/auth/rbac";
import { evaluateTimelineMutationPolicy } from "@/lib/product/mutation-policy";
import { addTimelineUpdate, findCase } from "@/lib/storage/product-store";

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const auth = getAuthContext(request);
    requireRole(auth, ["lawyer", "staff"]);

    const { caseId } = await context.params;
    const target = await findCase(caseId);
    if (!target) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    if (target.assignedLawyerId !== auth.userId && auth.role !== "staff") {
      return NextResponse.json({ error: "Forbidden: case does not belong to your assignment." }, { status: 403 });
    }

    const body = (await request.json()) as {
      stage?: string;
      status?: "waiting" | "in_progress" | "delayed" | "complete";
      note?: string;
      eta?: string | null;
      dueAt?: string | null;
      nextStep?: string;
      visibility?: "client" | "private";
      ownerId?: string;
      objectType?: "action" | "waiting" | "document" | "deadline" | "message" | "gate";
      obligationBand?: "B1" | "B2" | "B3" | "B4" | "B5" | "B6" | "B7";
      riskBand?: "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7";
      artifactRefs?: string[];
    };

    if (!body.stage || !body.status || !body.note) {
      return NextResponse.json({ error: "stage, status, and note are required." }, { status: 400 });
    }

    const policy = await evaluateTimelineMutationPolicy({
      caseId,
      status: body.status,
      ownerId: body.ownerId,
      dueAt: body.dueAt,
      riskBand: body.riskBand,
      artifactRefs: body.artifactRefs,
    });
    if (!policy.ok) {
      return NextResponse.json(
        { error: policy.error ?? "Timeline mutation policy failed." },
        { status: 400 },
      );
    }

    const updated = await addTimelineUpdate({
      caseId,
      actorId: auth.userId,
      stage: body.stage,
      status: body.status,
      note: body.note,
      eta: body.eta,
      dueAt: body.dueAt,
      nextStep: body.nextStep,
      visibility: body.visibility ?? "client",
      ownerId: body.ownerId,
      objectType: body.objectType,
      obligationBand: body.obligationBand,
      riskBand: policy.riskBand,
      artifactRefs: policy.artifactRefs,
    });

    if (!updated) {
      return NextResponse.json({ error: "Case update failed." }, { status: 500 });
    }

    const ledger = await appendProductMutationLedger({
      mutationId: randomUUID(),
      mutationType: "CASE_UPDATED",
      caseId,
      actorId: auth.userId,
      role: auth.role,
      details: {
        stage: body.stage,
        status: body.status,
        visibility: body.visibility ?? "client",
        riskBand: policy.riskBand,
        obligationBand: body.obligationBand ?? "B4",
        artifactRefCount: policy.artifactRefs.length,
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to apply case update." }, { status: 403 });
  }
}
