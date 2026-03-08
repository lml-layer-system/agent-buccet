import { NextResponse } from "next/server";
import { getAuthContext, requireRole } from "@/lib/auth/rbac";
import { buildHallwayQueues, classifyCaseFlow } from "@/lib/flow/classifier";
import { listFlowCasesForLawyer } from "@/lib/storage/product-store";

export async function GET(request: Request) {
  try {
    const auth = getAuthContext(request);
    requireRole(auth, ["lawyer", "staff"]);

    const cases = await listFlowCasesForLawyer(auth.userId);
    const items = cases.flatMap((entry) => classifyCaseFlow(entry));
    const board = buildHallwayQueues(items, 7);

    return NextResponse.json({
      totalItems: items.length,
      focusCap: board.focusCap,
      focus: board.focus,
      lanes: board.lanes,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load hallway flow." }, { status: 403 });
  }
}
