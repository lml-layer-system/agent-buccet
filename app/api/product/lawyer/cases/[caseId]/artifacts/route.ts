import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { appendProductMutationLedger } from "@/lib/ledger";
import { getAuthContext, requireRole } from "@/lib/auth/rbac";
import { storeArtifact } from "@/lib/storage/artifact-store";
import { attachCaseArtifact, findCase } from "@/lib/storage/product-store";

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const auth = getAuthContext(request);
    requireRole(auth, ["lawyer", "staff"]);

    const { caseId } = await context.params;
    const existing = await findCase(caseId);
    if (!existing) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    if (auth.role === "lawyer" && existing.assignedLawyerId !== auth.userId) {
      return NextResponse.json({ error: "Forbidden: case does not belong to your assignment." }, { status: 403 });
    }

    const body = (await request.json()) as {
      fileName?: string;
      contentType?: string;
      contentBase64?: string;
      visibility?: "client" | "private";
    };

    if (!body.fileName || !body.contentBase64) {
      return NextResponse.json({ error: "fileName and contentBase64 are required." }, { status: 400 });
    }

    const artifact = await storeArtifact({
      caseId,
      fileName: body.fileName,
      contentType: body.contentType ?? "application/octet-stream",
      contentBase64: body.contentBase64,
    });

    const updated = await attachCaseArtifact({
      caseId,
      uploadedBy: auth.userId,
      name: body.fileName,
      contentType: artifact.contentType,
      digest: artifact.digest,
      sizeBytes: artifact.sizeBytes,
      storageRef: artifact.storageRef,
      visibility: body.visibility ?? "private",
    });

    if (!updated) {
      return NextResponse.json({ error: "Unable to attach artifact." }, { status: 500 });
    }

    const ledger = await appendProductMutationLedger({
      mutationId: randomUUID(),
      mutationType: "ARTIFACT_ATTACHED",
      caseId,
      actorId: auth.userId,
      role: auth.role,
      details: {
        fileName: body.fileName,
        digest: artifact.digest,
        storageRef: artifact.storageRef,
        sizeBytes: artifact.sizeBytes,
        visibility: body.visibility ?? "private",
      },
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      item: {
        artifactId: artifact.artifactId,
        storageRef: artifact.storageRef,
        digest: artifact.digest,
      },
      ledger: {
        index: ledger.index,
        digest: ledger.digest,
        prevDigest: ledger.prevDigest,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to attach artifact." }, { status: 403 });
  }
}
