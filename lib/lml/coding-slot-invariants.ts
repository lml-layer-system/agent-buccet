import type { CodingBodyFillSlot } from "./coding-body-fill";

export const CODING_SLOT_INVARIANT_LAWS = [
  "ABILITY.CODING.137: Slot fill must satisfy positive constraints that define the lawful local body, not only avoid forbidden tokens.",
  "ABILITY.CODING.138: Slot fill must satisfy negative constraints that exclude protocol, framework, or state violations inside the local body.",
  "ABILITY.CODING.139: Slot fill must preserve role and protocol invariants; a route slot stays a route slot, a repository slot stays a repository slot.",
  "ABILITY.CODING.140: Slot fill must preserve functional identity under the slot contract; local freedom cannot violate the declared body role.",
  "ABILITY.CODING.141: Slot fill must preserve structural identity with the scaffold and must not author new top-level structure outside the slot boundary.",
  "ABILITY.CODING.142: Slot fill must respect positive requirement constraints and negative prohibition constraints as a coupled admissibility boundary.",
  "ABILITY.CODING.143: Slot fill must preserve consistency and connectivity requirements with the surrounding scaffold contract.",
  "ABILITY.CODING.144: Slot fill must preserve token identity, structural identity, and functional identity of the declared slot role under local transformation.",
  "ABILITY.CODING.145: Slot fill must preserve role and protocol invariants even under adversarial or shortcut completions.",
  "ABILITY.CODING.146: Slot fill must fail closed when constraint intersections are empty or when a completion satisfies wording but violates role intent.",
] as const;

export function validateSlotInvariants(slot: CodingBodyFillSlot, joined: string): boolean {
  if (/\b(import|from)\s+/.test(joined)) {
    return false;
  }
  if (/^\s*(def|class)\s+/m.test(joined)) {
    return false;
  }
  if (/\btry:\s*[\s\S]*except\s*:\s*pass/.test(joined)) {
    return false;
  }

  const positive = requiredSlotConstraints(slot);
  const negative = forbiddenSlotConstraints(slot);
  if (positive.some((pattern) => !pattern.test(joined))) {
    return false;
  }
  if (negative.some((pattern) => pattern.test(joined))) {
    return false;
  }

  switch (slot.kind) {
    case "route_delegate":
      return /\breturn\b/.test(joined) && !/\b(jwt|hash_password|verify_password)\b/.test(joined);
    case "service_payload":
      return /\breturn\b/.test(joined) && !/\b(router|app\s*=|@app\.)/.test(joined);
    case "return_model":
      return /\breturn\b/.test(joined) && /[A-Z][A-Za-z0-9_]*\(/.test(joined) && !/\bjson\.loads\(/.test(joined);
    case "emit_string":
      return /\breturn\b/.test(joined) && !/\bexec\(|\beval\(|__import__\(/.test(joined);
    case "state_safe":
      return !/\bglobal\b/.test(joined) && !/\bthreading\b/.test(joined) && !/\bsetattr\b/.test(joined);
    case "render_safe":
      return !/\bglobal\b/.test(joined) && !/\bwhile\b/.test(joined) && !/\bthreading\b/.test(joined) && !/\bstate\.[a-z0-9_]+\s*=/.test(joined);
    case "auth_session":
      return !/\bpassword_hash\b/.test(joined) && !/\bsecret\b/.test(joined) && /\breturn\b/.test(joined) && /\btoken\b/.test(joined);
    case "decode_mapping":
      return !/\bpassword\b/.test(joined) && !/\bhash\b/.test(joined) && /\breturn\b/.test(joined) && /\bsub\b/.test(joined);
    case "orm_schema_create":
    case "orm_schema_list":
      return !/\bsession\.execute\(f/.test(joined) && !/\braw sql\b/.test(joined) && /\breturn\b/.test(joined);
    case "transform_plan":
      return /\breturn\b/.test(joined) && !/replace\(|re\.sub\(/.test(joined);
    case "emit_source":
      return /\breturn\b/.test(joined) && !/replace\(|re\.sub\(|print\(/.test(joined);
    default:
      return true;
  }
}

function requiredSlotConstraints(slot: CodingBodyFillSlot): RegExp[] {
  switch (slot.kind) {
    case "route_delegate":
      return [/\breturn\b/, /\b[a-z_][a-z0-9_]*\(/];
    case "service_payload":
      return [/\breturn\b/, /\b(status|detail|token|message)\b/];
    case "return_model":
      return [/\breturn\b/, /[A-Z][A-Za-z0-9_]*\(/];
    case "auth_session":
      return [/\breturn\b/, /\btoken\b/];
    case "decode_mapping":
      return [/\breturn\b/, /\bsub\b/, /\bexp\b/];
    case "emit_string":
      return [/\breturn\b/];
    case "state_safe":
      return [/\b(return|reset|invalidate|version|clear)\b/];
    case "render_safe":
      return [/\b(state|screen|surface|score|player_x)\b/];
    case "orm_schema_create":
      return [/\breturn\b/, /\bsession\.(add|commit)\(/];
    case "orm_schema_list":
      return [/\breturn\b/];
    case "transform_plan":
      return [/\breturn\b/, /\b(kind|plan|noop)\b/];
    case "emit_source":
      return [/\breturn\b/];
    default:
      return [];
  }
}

function forbiddenSlotConstraints(slot: CodingBodyFillSlot): RegExp[] {
  const shared = [/\bprint\(/, /\bglobal\b/, /\bthreading\b/];
  switch (slot.kind) {
    case "route_delegate":
      return [...shared, /\b(jwt|hash_password|verify_password)\b/, /\btry:\s*[\s\S]*except\s*:\s*pass/];
    case "service_payload":
      return [...shared, /\b(router|app\s*=|@app\.)/, /\bjson\.loads\(/];
    case "return_model":
      return [...shared, /\bjson\.loads\(/, /\brouter\b/];
    case "auth_session":
      return [...shared, /\bpassword_hash\b/, /\bsecret\b/, /verify\s*=\s*false/];
    case "decode_mapping":
      return [...shared, /\bpassword\b/, /\bhash\b/];
    case "emit_string":
      return [...shared, /\bexec\(/, /\beval\(/, /__import__\(/];
    case "state_safe":
      return [...shared, /\bsetattr\b/, /\bwhile\s+true\b/];
    case "render_safe":
      return [...shared, /\bwhile\b/, /\bstate\.[a-z0-9_]+\s*=/];
    case "orm_schema_create":
    case "orm_schema_list":
      return [...shared, /\bsession\.execute\(f/, /\braw sql\b/, /\bcommit\(\)\s*\n\s*for\b/];
    case "transform_plan":
    case "emit_source":
      return [...shared, /replace\(/, /re\.sub\(/];
    default:
      return shared;
  }
}
