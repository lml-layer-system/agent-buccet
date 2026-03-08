import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { appendProductMutationLedger } from "@/lib/ledger";
import { getAuthContext, requireRole } from "@/lib/auth/rbac";
import { createCase, listCasesForLawyer } from "@/lib/storage/product-store";

export async function GET(request: Request) {
  try {
    const auth = getAuthContext(request);
    requireRole(auth, ["lawyer", "staff"]);

    const cases = await listCasesForLawyer(auth.userId);
    return NextResponse.json({ items: cases });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to list cases." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = getAuthContext(request);
    requireRole(auth, ["lawyer"]);

    const body = (await request.json()) as {
      title?: string;
      firmId?: string;
      clientId?: string;
      clientName?: string;
      assignedLawyerId?: string;
    };

    if (!body.title || !body.firmId || !body.clientId || !body.clientName) {
      return NextResponse.json({ error: "title, firmId, clientId, and clientName are required." }, { status: 400 });
    }

    const created = await createCase({
      title: body.title,
      firmId: body.firmId,
      clientId: body.clientId,
      clientName: body.clientName,
      assignedLawyerId: body.assignedLawyerId ?? auth.userId,
      createdBy: auth.userId,
    });

    const ledger = await appendProductMutationLedger({
      mutationId: randomUUID(),
      mutationType: "CASE_CREATED",
      caseId: created.id,
      actorId: auth.userId,
      role: auth.role,
      details: {
        title: created.title,
        clientId: created.clientId,
        assignedLawyerId: created.assignedLawyerId,
      },
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        item: created,
        ledger: {
          index: ledger.index,
          digest: ledger.digest,
          prevDigest: ledger.prevDigest,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create case." }, { status: 403 });
  }
}
