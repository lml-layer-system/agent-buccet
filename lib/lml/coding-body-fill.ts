import { runGpt2GeneratorOnly } from "@/lib/demo/gpt2";
import { buildMicroEmitterPrompt, isSingleSlotEmission, renderMicroEmitterPrompt } from "@/lib/lml/coding-micro-emitter";
import { applyPostFillSemanticCorrections } from "@/lib/lml/coding-post-fill-correction";
import { validateSlotInvariants } from "@/lib/lml/coding-slot-invariants";

export type CodingBodyFillSlot = {
  id: string;
  language: string;
  instruction: string;
  fallbackBody: string[];
  maxLines?: number;
  mustInclude?: string[];
  mustNotInclude?: string[];
  kind?:
    | "return_dict"
    | "return_model"
    | "return_string"
    | "return_bool"
    | "return_list"
    | "decode_mapping"
    | "auth_session"
    | "emit_string"
    | "route_delegate"
    | "service_payload"
    | "transform_plan"
    | "emit_source"
    | "tokenize"
    | "parse"
    | "state_safe"
    | "render_safe"
    | "orm_create"
    | "orm_list"
    | "orm_schema_create"
    | "orm_schema_list";
};

export async function materializeCodingBodySlots(args: {
  text: string;
  slots: CodingBodyFillSlot[];
}): Promise<{ text: string; usedGenerator: number; usedFallback: number }> {
  let text = args.text;
  let usedGenerator = 0;
  let usedFallback = 0;

  for (const slot of args.slots) {
    const marker = `__LML_SLOT_${slot.id}__`;
    const line = text.split("\n").find((entry) => entry.includes(marker));
    if (!line) continue;
    const indent = line.match(/^(\s*)/)?.[1] ?? "";
    const currentBrokenCode = slot.fallbackBody.join("\n");
    const microPrompt = buildMicroEmitterPrompt(slot, currentBrokenCode);
    const generated = await runGpt2GeneratorOnly({
      prompt: renderMicroEmitterPrompt(microPrompt),
      options: {
        maxNewTokens: 64,
        minNewTokens: 8,
        temperature: 0.0,
        topP: 1.0,
        doSample: false,
        repetitionPenalty: 1.12,
        noRepeatNgramSize: 4,
      },
    });
    const bodyLines = generated.ok
      ? generated.text
          .split(/\r?\n/)
          .map((entry) => entry.trimEnd())
          .filter((entry) => entry.trim().length > 0)
          .filter((entry) => !entry.trim().startsWith("```"))
          .filter((entry) => !/^\s*(def|class)\s+/.test(entry))
          .slice(0, slot.maxLines ?? 12)
      : [];
    const postFill = applyPostFillSemanticCorrections(slot, bodyLines);
    const acceptedGenerated =
      bodyLines.length > 0 &&
      isSingleSlotEmission(bodyLines) &&
      postFill.ok &&
      validateSlotBody(slot, postFill.correctedLines);
    const lines = acceptedGenerated ? postFill.correctedLines : slot.fallbackBody;
    if (bodyLines.length > 0) usedGenerator += 1;
    if (!acceptedGenerated) usedFallback += 1;
    const replacement = lines.map((entry) => `${indent}${entry}`).join("\n");
    text = text.replace(line, replacement);
  }

  return { text, usedGenerator, usedFallback };
}

function validateSlotBody(slot: CodingBodyFillSlot, lines: string[]): boolean {
  const joined = lines.join("\n").toLowerCase();
  if (/^\s*(try|except|while\s+true|for\s*\(\s*;\s*;\s*\)|pass\s*$)/m.test(joined)) {
    return false;
  }
  if (slot.mustInclude?.some((pattern) => !joined.includes(pattern.toLowerCase()))) {
    return false;
  }
  if (slot.mustNotInclude?.some((pattern) => joined.includes(pattern.toLowerCase()))) {
    return false;
  }
  if (!validateSlotInvariants(slot, joined)) {
    return false;
  }

  switch (slot.kind) {
    case "return_dict":
      return /\breturn\s+\{/.test(joined);
    case "return_model":
      return /\breturn\s+[A-Z]\w*\(/.test(joined);
    case "return_bool":
      return /\breturn\s+(true|false|username\s*==|password\s*==)/.test(joined);
    case "return_string":
      return /\breturn\s+/.test(joined) && /['"]|f'|f"/.test(joined);
    case "return_list":
      return /\breturn\s+\[/.test(joined) || /\breturn\s+list\(/.test(joined);
    case "decode_mapping":
      return /\breturn\s+\{/.test(joined) || /\breturn\s+.+if.+else.+/.test(joined);
    case "auth_session":
      return /\breturn\b/.test(joined) && /(token|role|\{\})/.test(joined);
    case "emit_string":
      return /\breturn\s+.*(join|startswith|['"])/.test(joined);
    case "route_delegate":
      return /\breturn\b/.test(joined) && !/\brequests\./.test(joined);
    case "service_payload":
      return /\breturn\b/.test(joined) && /(status|detail|token|message)/.test(joined);
    case "transform_plan":
      return /\breturn\b/.test(joined) && /(kind|plan|noop)/.test(joined);
    case "emit_source":
      return /\breturn\b/.test(joined) && !/\bre\.sub\b/.test(joined) && !/\.replace\(/.test(joined);
    case "tokenize":
      return /\breturn\s+\[/.test(joined) && /(split|token|chunk)/.test(joined);
    case "parse":
      return /\breturn\s+\[/.test(joined) && /(tokenize|token\.value|valuenode)/.test(joined);
    case "state_safe":
      return !/\bglobal\b/.test(joined) && !/\bthreading\b/.test(joined) && /(invalidate|updated_at|version|clear|reset|return)/.test(joined);
    case "render_safe":
      return !/\bthreading\b/.test(joined) && !/\bglobal\b/.test(joined) && !/\bwhile\s+/.test(joined);
    case "orm_create":
      return /\bsession\.add\(/.test(joined) && /\breturn\b/.test(joined);
    case "orm_list":
      return /(session\.scalars|select\()/.test(joined) && /\breturn\b/.test(joined);
    case "orm_schema_create":
      return /\breturn\b/.test(joined) && /Schema|ReadSchema/.test(joined);
    case "orm_schema_list":
      return /\breturn\b/.test(joined) && /\[.*Schema|for .* in session\.items/.test(joined);
    default:
      return true;
  }
}
