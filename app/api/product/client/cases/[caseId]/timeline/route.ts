import { NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth/rbac";
import { findCase } from "@/lib/storage/product-store";

export async function GET(request: Request, context: { params: Promise<{ caseId: string }> }) {
  try {
    const auth = getAuthContext(request);
    requireRole(auth, ["client"]);

    const { caseId } = await context.params;
    const item = await findCase(caseId);

    if (!item || item.clientId !== auth.userId) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    return NextResponse.json({
      item: {
        id: item.id,
        title: item.title,
        currentStage: item.currentStage,
        currentStatus: item.currentStatus,
        nextStep: item.nextStep,
        eta: item.eta,
        updatedAt: item.updatedAt,
        timeline: item.timeline.filter((entry) => entry.visibility === "client"),
        files: item.files.filter((entry) => entry.visibility === "client"),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load timeline." }, { status: 403 });
  }
}
