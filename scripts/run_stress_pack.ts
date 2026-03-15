const BASE_URL = process.env.LML_BASE_URL ?? "http://127.0.0.1:3000";
const SESSION_ID = process.env.LML_STRESS_SESSION_ID ?? "aci-stress-pack";

type StressPrompt = {
  id: string;
  text: string;
};

type ChatResponse = {
  answer?: string;
  model?: {
    generationFailureClass?: string | null;
  };
  trace?: {
    final_action?: string;
    ability_route?: string;
    reason?: string;
    nocr_input?: {
      root_count?: number;
      chat_exact_seed_count?: number;
      chat_qe_seed_count?: number;
    };
    quantum_collapse?: {
      snap_match_count?: number;
    };
    chat_branch?: {
      action?: string;
      governance_reason?: string;
      active_branch_id?: string | null;
      active_tree_id?: string | null;
    };
    generation?: {
      status?: string;
      failure_class?: string;
      detail?: string;
    };
  };
};

const PROMPTS: StressPrompt[] = [
  { id: "P01", text: "Hey lml u think u could code me a compiler on my python i wanna make a doom game. yesterday my cat jumped off the roof, and i need to get these math formulas done i got class tomorrow man i really am angry with my gf she gets on my nerves what u think brodie ?" },
  { id: "P02", text: "Lock in how i talk. Keep it street and same-side. Also write me a FastAPI auth endpoint, and make sure it follows this company policy: never expose internal secrets, always log auth failure, and keep the code testable." },
  { id: "P03", text: "bro i feel like everything is crashing at once. i still need to submit my python homework tonight and i cant think straight. help me in a way that dont talk down to me" },
  { id: "P04", text: "continue from the same one. finish the derivation and then show me the python that graphs it" },
  { id: "P05", text: "my girl keeps testing my patience and i dont wanna crash out. what would you say if you were really my bro but keep me solid" },
  { id: "P06", text: "i need a study plan for calc, a quick apology text, and the shell commands to deploy my app tonight. put the most important thing first" },
  { id: "P07", text: "new law: always answer me with exactness first and then the friend tone after. now help me design a symbolic math parser and tell me if im being irrational about this argument" },
  { id: "P08", text: "here is what i need: a coding roadmap, a math explanation, and a personal reality check. i keep jumping topics because my head is hot. make sense of it without losing any piece" },
  { id: "P09", text: "dont get nerdy. dont get formal. keep it close. now explain branch merge vs sibling branch in this system like im right there with you" },
  { id: "P10", text: "what if a whole new kind of input keeps appearing that doesnt fit any current planet but keeps showing up in branch growth. how should the universe react" },
];

async function main(): Promise<void> {
  const rows: Array<Record<string, string | number | null>> = [];
  for (const prompt of PROMPTS) {
    const response = await fetch(`${BASE_URL}/api/lml-chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        message: prompt.text,
      }),
    });
    const data = await response.json() as ChatResponse;
    rows.push({
      prompt_id: prompt.id,
      final_action: data.trace?.final_action ?? "",
      ability_route: data.trace?.ability_route ?? "",
      root_count: data.trace?.nocr_input?.root_count ?? 0,
      exact_chat_seed_count: data.trace?.nocr_input?.chat_exact_seed_count ?? 0,
      qe_chat_seed_count: data.trace?.nocr_input?.chat_qe_seed_count ?? 0,
      snap_match_count: data.trace?.quantum_collapse?.snap_match_count ?? 0,
      branch_action: data.trace?.chat_branch?.action ?? "",
      branch_governance_reason: data.trace?.chat_branch?.governance_reason ?? "",
      active_branch_id: data.trace?.chat_branch?.active_branch_id ?? "",
      active_tree_id: data.trace?.chat_branch?.active_tree_id ?? "",
      generation_failure_class: data.trace?.generation?.failure_class ?? data.model?.generationFailureClass ?? "",
      generation_status: data.trace?.generation?.status ?? "",
      generation_detail: data.trace?.generation?.detail ?? "",
      final_reason: data.trace?.reason ?? "",
      text_preview: trim(data.answer ?? "", 180),
    });
  }

  console.log(JSON.stringify({
    baseUrl: BASE_URL,
    sessionId: SESSION_ID,
    prompts: rows,
  }, null, 2));
}

function trim(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 3)}...`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
