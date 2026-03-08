import { NextResponse } from "next/server";
import { clearAllOverlayLaws, getOrCreateContextState, persistContextState, setUserOverlayLaws } from "@/lib/lml/infinite-context";
import { compileCapabilityGraphFromRuntimeLaws, getAbilityPlanetInventory, getMetaPlanetInventory, type RuntimeUserLaw } from "@/lib/lml/chat-runtime";

type StateBody = {
  sessionId?: string;
  userLaws?: RuntimeUserLaw[];
  action?: "replace" | "clear";
};

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId") ?? "default-session";
    const state = await getOrCreateContextState(sessionId);
    const runtimeAutoAsLaws: RuntimeUserLaw[] = state.activeAutoLaws.map((law, index) => ({
      law_id: `AUTO-${String(index + 1).padStart(4, "0")}`,
      text: law.text,
      scope: law.scope,
      enforcement: law.enforcement,
    }));
    const capabilityGraph = compileCapabilityGraphFromRuntimeLaws([...state.userOverlayLaws, ...runtimeAutoAsLaws]);
    const abilityPlanet = getAbilityPlanetInventory();
    const activeAbilityPlanet = {
      coding: capabilityGraph.abilities.coding.state === "allowed" ? abilityPlanet.coding : [],
      web_search: capabilityGraph.abilities.web_search.state === "allowed" ? abilityPlanet.web_search : [],
    };
    const metaPlanetLaws = getMetaPlanetInventory();
    const activeMetaPlanetLaws = state.activeAutoLaws.filter((law) => law.source === "meta_projection_loop");
    return NextResponse.json({
      sessionId: state.sessionId,
      userLaws: state.userOverlayLaws,
      activeAutoLaws: state.activeAutoLaws,
      pendingLawProposals: state.pendingLawProposals,
      metaPlanetLaws,
      activeMetaPlanetLaws,
      capabilityGraph,
      abilityPlanet,
      activeAbilityPlanet,
      docs: state.docs.map((doc) => ({ id: doc.id, name: doc.name, textLength: doc.text.length })),
      step: state.step,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to read LML state." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as StateBody;
    const sessionId = body.sessionId ?? "default-session";
    const state = await getOrCreateContextState(sessionId);
    if (body.action === "clear") {
      clearAllOverlayLaws(state);
    } else if (Array.isArray(body.userLaws)) {
      setUserOverlayLaws(state, body.userLaws);
    }
    await persistContextState(state);
    return NextResponse.json({ sessionId: state.sessionId, count: state.userOverlayLaws.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update LML state." }, { status: 500 });
  }
}
