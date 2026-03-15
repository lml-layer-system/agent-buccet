import type { CodingBodyFillSlot } from "@/lib/lml/coding-body-fill";

export type CodingMicroEmitterPrompt = {
  systemDirective: string;
  slotType: string;
  contract: string;
  contextVariablesInScope: string[];
  currentBrokenCode: string;
  expectedOutputFormat: "RAW_CODE_SNIPPET";
};

export function buildMicroEmitterPrompt(slot: CodingBodyFillSlot, currentBrokenCode: string): CodingMicroEmitterPrompt {
  return {
    systemDirective:
      "You are a micro-emitter. Generate exactly one bounded slot body. Do not output markdown, signatures, imports, or surrounding structure.",
    slotType: slot.kind ?? slot.language.toUpperCase(),
    contract: slot.instruction,
    contextVariablesInScope: inferContextVariables(slot),
    currentBrokenCode,
    expectedOutputFormat: "RAW_CODE_SNIPPET",
  };
}

export function renderMicroEmitterPrompt(prompt: CodingMicroEmitterPrompt): string {
  return JSON.stringify(prompt, null, 2);
}

export function isSingleSlotEmission(lines: string[]): boolean {
  const joined = lines.join("\n");
  if (/\b(import|from)\s+/.test(joined)) return false;
  if (/^\s*(def|class|async\s+def|export\s+(default\s+)?function|function)\s+/m.test(joined)) return false;
  if (/^\s*```/m.test(joined)) return false;
  return true;
}

function inferContextVariables(slot: CodingBodyFillSlot): string[] {
  const contexts: Record<NonNullable<CodingBodyFillSlot["kind"]>, string[]> = {
    return_dict: [],
    return_model: ["payload"],
    return_string: ["value"],
    return_bool: ["value"],
    return_list: ["items"],
    decode_mapping: ["token"],
    auth_session: ["session", "token"],
    emit_string: ["node"],
    route_delegate: ["request", "service", "session"],
    service_payload: ["payload", "session"],
    transform_plan: ["node", "plan"],
    emit_source: ["tree"],
    tokenize: ["source"],
    parse: ["tokens"],
    state_safe: ["state"],
    render_safe: ["state", "surface"],
    orm_create: ["session", "entity"],
    orm_list: ["session"],
    orm_schema_create: ["session", "entity"],
    orm_schema_list: ["session", "rows"],
  };

  return slot.kind ? contexts[slot.kind] ?? [] : [];
}
