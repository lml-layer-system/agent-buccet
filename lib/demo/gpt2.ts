import { createHash, randomUUID } from "node:crypto";
import type { Witness } from "../engine/types.ts";
import { projectCodingQuantumSnap, type QuantumSnapGenerateOptions, type QuantumSnapSeed } from "@/lib/nocr";

export type Gpt2CallResult = {
  text: string;
  allowedSummary: string;
  receipt: {
    provider: "gpt2-runtime";
    model: "gpt2";
    callId: string;
    inputDigest: string;
    at: string;
    generationStatus: "generated" | "fallback";
    generationFailureClass: "none" | "service_unreachable" | "timeout" | "http_error" | "empty_generation" | "invalid_response";
    generationDetail: string;
  };
};

export async function runGpt2Constrained(args: {
  runId: string;
  content: string;
  witness: Witness;
  mode?: "legal_demo" | "chat_ontology";
}): Promise<Gpt2CallResult> {
  const { content, witness } = args;
  const mode = args.mode ?? "legal_demo";
  const cleaned = content.replace(/\s+/g, " ").trim();
  const receipt: Gpt2CallResult["receipt"] = {
    provider: "gpt2-runtime" as const,
    model: "gpt2" as const,
    callId: randomUUID(),
    inputDigest: createHash("sha256").update(cleaned).digest("hex"),
    at: new Date().toISOString(),
    generationStatus: "generated" as const,
    generationFailureClass: "none" as const,
    generationDetail: "model_generation_ok",
  };

  const prompt = buildPrompt(mode, content, witness);
  const codingPayload = mode === "chat_ontology" && /lml coding generation policy/i.test(content);
  let sanitized = buildServiceUnavailableFallback(mode);
  if (!codingPayload) {
    const profile = buildChatOntologyProfile(content);
    const generated = await generateWithLocalGpt2(prompt, {
      maxNewTokens: mode === "chat_ontology" ? profile.maxNewTokens : 300,
      minNewTokens: mode === "chat_ontology" ? profile.minNewTokens : 32,
      temperature: mode === "chat_ontology" ? profile.temperature : 0.6,
      topP: mode === "chat_ontology" ? profile.topP : 0.92,
      doSample: mode === "chat_ontology" ? profile.doSample : true,
      repetitionPenalty: mode === "chat_ontology" ? profile.repetitionPenalty : 1.05,
      noRepeatNgramSize: mode === "chat_ontology" ? profile.noRepeatNgramSize : 3,
    });
    const text = generated.ok ? generated.text : buildGenerationFallback(mode, generated.failureClass, generated.detail);
    receipt.generationStatus = generated.ok ? "generated" : "fallback";
    receipt.generationFailureClass = generated.ok ? "none" : generated.failureClass;
    receipt.generationDetail = generated.ok ? `model_generation_ok:length=${generated.text.length}` : generated.detail;
    sanitized = sanitizeModelOutput(text, content, mode);
  } else {
    const userRequest = extractQuotedLine(content, "User request") ?? "";
    const preferredLanguage = (extractField(content, "Preferred language") ?? "typescript").toLowerCase();
    const concrete = isConcreteCodingRequest(userRequest);
    const wantsTests = /\bwants_tests=yes\b/i.test(content) || /\b(test|tests|pytest|jest|vitest)\b/i.test(userRequest);
    const superposition: QuantumSnapSeed[] = [
      {
        id: "seed.det.001",
        prompt,
        kind: "deterministic",
        sourceReason: "primary_deterministic_seed",
        opts: {
          maxNewTokens: 360,
          minNewTokens: 64,
          temperature: 0.15,
          topP: 1.0,
          doSample: false,
          repetitionPenalty: 1.2,
          noRepeatNgramSize: 3,
        },
      },
      {
        id: "seed.exp.001",
        prompt,
        kind: "exploratory",
        sourceReason: "secondary_exploratory_seed",
        opts: {
          maxNewTokens: 360,
          minNewTokens: 64,
          temperature: 0.35,
          topP: 0.9,
          doSample: true,
          repetitionPenalty: 1.15,
          noRepeatNgramSize: 3,
        },
      },
      {
        id: "seed.rep.001",
        prompt: buildCodingRetryPrompt(content, witness),
        kind: "repair",
        sourceReason: "initial_repair_seed",
        opts: {
          maxNewTokens: 360,
          minNewTokens: 64,
          temperature: 0.1,
          topP: 1.0,
          doSample: false,
          repetitionPenalty: 1.2,
          noRepeatNgramSize: 3,
        },
      },
    ];
    const admissible: Array<{ text: string; score: number }> = [];
    let lastFailureReason = "unstable_generation";
    const executedSeedIds: string[] = [];
    for (let idx = 0; idx < 6; idx += 1) {
      const projection = projectCodingQuantumSnap({
        seeds: superposition,
        preferredLanguage,
        concrete,
        wantsTests,
        lastFailureReason,
        executedSeedIds,
      });
      const branch = projection.executionPlan[0];
      if (!branch) {
        break;
      }
      executedSeedIds.push(branch.id);
      const generated = await generateWithLocalGpt2(branch.prompt, branch.opts);
      if (!generated.ok) {
        lastFailureReason = generated.failureClass;
        superposition.push({
          id: `seed.rep.empty.${String(superposition.length + 1).padStart(3, "0")}`,
          prompt: buildCodingRepairPrompt(content, witness, generated.failureClass, ""),
          kind: "repair",
          sourceReason: `${generated.failureClass}_repair_seed`,
          opts: {
            maxNewTokens: 360,
            minNewTokens: 64,
            temperature: 0.1,
            topP: 1.0,
            doSample: false,
            repetitionPenalty: 1.2,
            noRepeatNgramSize: 3,
          },
        });
        continue;
      }
      const candidate = sanitizeModelOutput(generated.text, content, mode);
      if (!concrete) {
        admissible.push({ text: candidate, score: 1 });
        continue;
      }
      const validation = await evaluateCodingCandidate(candidate, preferredLanguage);
      if (!validation.ok) {
        lastFailureReason = validation.reason;
        superposition.push({
          id: `seed.rep.${String(superposition.length + 1).padStart(3, "0")}`,
          prompt: buildCodingRepairPrompt(content, witness, validation.reason, candidate),
          kind: "repair",
          sourceReason: `validation_repair_seed:${validation.reason}`,
          opts: {
            maxNewTokens: 360,
            minNewTokens: 64,
            temperature: 0.1,
            topP: 1.0,
            doSample: false,
            repetitionPenalty: 1.2,
            noRepeatNgramSize: 3,
          },
        });
        continue;
      }
      admissible.push({ text: candidate, score: scoreCodingCandidate(candidate, preferredLanguage, wantsTests) });
    }
    const best = admissible.sort((a, b) => b.score - a.score)[0];
    if (best?.text) {
      sanitized = ensureFencedCodingOutput(best.text, preferredLanguage);
      receipt.generationStatus = "generated";
      receipt.generationFailureClass = "none";
      receipt.generationDetail = `coding_generation_ok:admissible=${admissible.length}`;
    } else {
      sanitized = `I can’t produce stable full code for that exact scope right now (${lastFailureReason}). Try a narrower target: \`write python function is_valid_email(value: str) with pytest tests\`.`;
      receipt.generationStatus = "fallback";
      receipt.generationFailureClass = classifyCodingFailureClass(lastFailureReason);
      receipt.generationDetail = `coding_generation_fallback:${lastFailureReason}`;
    }
  }
  return {
    text: sanitized,
    allowedSummary: witness.outcome === "NULL"
      ? "Refusal path enforced by active ontology constraints."
      : "Success path admitted by active ontology constraints.",
    receipt,
  };
}

type GenerateOptions = QuantumSnapGenerateOptions;
type GenerationFailureClass = "service_unreachable" | "timeout" | "http_error" | "empty_generation" | "invalid_response";
type GenerateResult =
  | { ok: true; text: string }
  | {
    ok: false;
    failureClass: GenerationFailureClass;
    detail: string;
  };

export type Gpt2GeneratorOptions = GenerateOptions;
export type Gpt2GeneratorAttempt = {
  ok: boolean;
  text: string;
  receipt: Gpt2CallResult["receipt"];
};

type ChatOntologyProfile = {
  maxNewTokens: number;
  minNewTokens: number;
  temperature: number;
  topP: number;
  doSample: boolean;
  repetitionPenalty: number;
  noRepeatNgramSize: number;
};

function buildPrompt(mode: "legal_demo" | "chat_ontology", content: string, witness: Witness): string {
  const witnessSummary = witness.outcome === "NULL"
    ? `Outcome is NULL. Blocked reasons: ${(witness.explanation.blockedReasons ?? []).join(" | ") || "none"}.`
    : `Outcome is ADMISSIBLE. Accepted reasons: ${(witness.explanation.acceptedReasons ?? []).join(" | ") || "none"}.`;
  if (mode === "chat_ontology") {
    if (/lml coding generation policy/i.test(content)) {
      const userRequest = extractQuotedLine(content, "User request") ?? "";
      const preferredLanguage = extractField(content, "Preferred language") ?? "typescript";
      const wantsTests = /\bwants_tests=yes\b/i.test(content) || /\b(test|tests|pytest|jest|vitest)\b/i.test(userRequest);
      const concrete = isConcreteCodingRequest(userRequest);
      if (!concrete) {
        return [
          "Task: Ask one concise clarification question for coding.",
          `Request: ${userRequest}`,
          "Assistant:",
        ].join("\n");
      }
      const language = preferredLanguage.toLowerCase().includes("python") ? "python" : preferredLanguage.toLowerCase();
      return [
        `Task: ${userRequest}`,
        `${language} code:`,
        `\`\`\`${language}`,
        "",
        "\nAssistant:",
        witnessSummary,
        wantsTests ? "Include tests in a second fenced block." : "Single code block is acceptable.",
      ].join("\n");
    }
    return [
      "You are GPT-2 running inside the LML runtime.",
      "Follow the policy payload exactly. Do not output hidden headers. Respond naturally.",
      compressWitnessSummary(witnessSummary),
      "Payload:",
      content,
      "Assistant:",
    ].join("\n");
  }
  return [
    "You are GPT-2 running inside LML legal demo runtime.",
    "Write one concise professional response aligned with the payload and witness outcome.",
    witnessSummary,
    "Payload:",
    content,
    "Assistant:",
  ].join("\n");
}

function buildChatOntologyProfile(content: string): ChatOntologyProfile {
  const lane = extractField(content, "Lane")?.toLowerCase() ?? "base_chat";
  if (lane === "life_preservation") {
    return {
      maxNewTokens: 72,
      minNewTokens: 12,
      temperature: 0.0,
      topP: 1.0,
      doSample: false,
      repetitionPenalty: 1.12,
      noRepeatNgramSize: 4,
    };
  }
  if (lane === "style_directive") {
    return {
      maxNewTokens: 64,
      minNewTokens: 8,
      temperature: 0.0,
      topP: 1.0,
      doSample: false,
      repetitionPenalty: 1.12,
      noRepeatNgramSize: 4,
    };
  }
  if (lane === "context_anchor" || lane === "learning") {
    return {
      maxNewTokens: 96,
      minNewTokens: 12,
      temperature: 0.1,
      topP: 1.0,
      doSample: false,
      repetitionPenalty: 1.12,
      noRepeatNgramSize: 4,
    };
  }
  return {
    maxNewTokens: 112,
    minNewTokens: 12,
    temperature: 0.15,
    topP: 1.0,
    doSample: false,
    repetitionPenalty: 1.12,
    noRepeatNgramSize: 4,
  };
}

export async function runGpt2GeneratorOnly(args: {
  prompt: string;
  options: Gpt2GeneratorOptions;
}): Promise<Gpt2GeneratorAttempt> {
  const cleanedPrompt = args.prompt.replace(/\s+/g, " ").trim();
  const receipt: Gpt2CallResult["receipt"] = {
    provider: "gpt2-runtime",
    model: "gpt2",
    callId: randomUUID(),
    inputDigest: createHash("sha256").update(cleanedPrompt).digest("hex"),
    at: new Date().toISOString(),
    generationStatus: "generated",
    generationFailureClass: "none",
    generationDetail: "generator_only_ok",
  };
  const generated = await generateWithLocalGpt2(args.prompt, args.options);
  if (!generated.ok) {
    receipt.generationStatus = "fallback";
    receipt.generationFailureClass = generated.failureClass;
    receipt.generationDetail = generated.detail;
    return {
      ok: false,
      text: "",
      receipt,
    };
  }
  receipt.generationDetail = `generator_only_ok:length=${generated.text.length}`;
  return {
    ok: true,
    text: generated.text,
    receipt,
  };
}

function compressWitnessSummary(summary: string): string {
  return summary
    .replace("Outcome is ADMISSIBLE. Accepted reasons:", "ADMISSIBLE:")
    .replace("Outcome is NULL. Blocked reasons:", "NULL:")
    .replace(/\s+/g, " ")
    .trim();
}

async function generateWithLocalGpt2(prompt: string, opts: GenerateOptions): Promise<GenerateResult> {
  const baseUrl = process.env.GPT2_PY_URL ?? "http://127.0.0.1:8009";
  const isFrontierBenchmarkPrompt =
    /\bswe-bench pro\b/i.test(prompt) &&
    /\binstance id:\b/i.test(prompt) &&
    /\bunified git diff patch\b/i.test(prompt);
  const timeoutMs = Number(process.env.GPT2_TIMEOUT_MS ?? (isFrontierBenchmarkPrompt ? 45000 : 15000));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        prompt,
        max_new_tokens: opts.maxNewTokens,
        min_new_tokens: opts.minNewTokens ?? 1,
        temperature: opts.temperature,
        top_p: opts.topP,
        do_sample: opts.doSample,
        repetition_penalty: opts.repetitionPenalty ?? 1.0,
        no_repeat_ngram_size: opts.noRepeatNgramSize ?? 0,
        stop_strings: ["\nSystem:", "\nUser:", "\nPayload:"],
      }),
    });
    if (!response.ok) {
      return {
        ok: false,
        failureClass: "http_error",
        detail: `http_error:${response.status}`,
      };
    }
    const data = (await response.json()) as { text?: string };
    if (typeof data.text !== "string") {
      return {
        ok: false,
        failureClass: "invalid_response",
        detail: "invalid_response:missing_text_field",
      };
    }
    const text = (data.text ?? "").trim();
    if (!text) {
      return {
        ok: false,
        failureClass: "empty_generation",
        detail: "empty_generation:blank_text",
      };
    }
    return { ok: true, text };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        failureClass: "timeout",
        detail: `timeout:${timeoutMs}ms`,
      };
    }
    return {
      ok: false,
      failureClass: "service_unreachable",
      detail: error instanceof Error ? `service_unreachable:${error.message}` : "service_unreachable:unknown",
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildServiceUnavailableFallback(mode: "legal_demo" | "chat_ontology"): string {
  const line = "Local GPT-2 service is unavailable. Start it with: npm run gpt2:serve";
  if (mode === "chat_ontology") {
    return line;
  }
  return `${line} Then retry your request.`;
}

function buildGenerationFallback(
  mode: "legal_demo" | "chat_ontology",
  failureClass: GenerationFailureClass,
  detail: string,
): string {
  switch (failureClass) {
    case "empty_generation":
      return mode === "chat_ontology"
        ? "Local GPT-2 generation returned empty text under current constraints."
        : "Local GPT-2 generation returned empty text under current constraints. Retry after adjusting the request.";
    case "timeout":
      return mode === "chat_ontology"
        ? "Local GPT-2 generation timed out under current constraints."
        : "Local GPT-2 generation timed out under current constraints. Retry after narrowing the request.";
    case "http_error":
      return mode === "chat_ontology"
        ? `Local GPT-2 generation failed with HTTP error (${detail}).`
        : `Local GPT-2 generation failed with HTTP error (${detail}). Retry after checking the local service.`;
    case "invalid_response":
      return mode === "chat_ontology"
        ? "Local GPT-2 generation returned an invalid response payload."
        : "Local GPT-2 generation returned an invalid response payload. Retry after checking the local service.";
    case "service_unreachable":
    default:
      return buildServiceUnavailableFallback(mode);
  }
}

function classifyCodingFailureClass(
  reason: string,
): Gpt2CallResult["receipt"]["generationFailureClass"] {
  if (reason.startsWith("python_syntax_invalid") || reason.startsWith("python_runtime_invalid")) {
    return "invalid_response";
  }
  if (reason === "timeout") return "timeout";
  if (reason === "http_error") return "http_error";
  if (reason === "service_unreachable") return "service_unreachable";
  if (reason === "empty_generation") return "empty_generation";
  return "invalid_response";
}

function sanitizeModelOutput(
  raw: string,
  payload: string,
  mode: "legal_demo" | "chat_ontology",
): string {
  const bannedLinePatterns = [
    /do not output this header/i,
    /^lml .* guidance/i,
    /^lml .* policy/i,
    /^response rules:/i,
    /^\d+\)\s+/,
    /^assistant:\s*$/i,
    /^payload:\s*$/i,
    /^user (message|request):/i,
    /^route:\s*/i,
    /^style (profile|family):/i,
    /^address as:/i,
    /^applied constraints:/i,
    /^signals:/i,
    /^doc signals:/i,
  ];

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !bannedLinePatterns.some((pattern) => pattern.test(line)));

  const joined = lines.join("\n").trim();
  const userMessage = extractQuotedLine(payload, "User message") ?? "";
  const capabilitiesIntent = /\b(what can lml do|what can you do|help|capabilities)\b/i.test(userMessage);
  const capabilitiesRelevant = /\b(lml|law|laws|ingest|docs?|constraints?|nsl|trace|coding|web[_\s-]?search)\b/i.test(joined);
  const numericDrift = hasNumericNarrativeDrift(joined);
  const obviousLeak =
    !joined ||
    /do not output this header/i.test(joined) ||
    /response rules:/i.test(joined);
  const degenerate = isDegenerateOutput(joined);

  if (capabilitiesIntent && (!capabilitiesRelevant || numericDrift)) {
    return "I can ingest docs into LML laws to create the reality your AI must follow.";
  }

  if (!obviousLeak && !degenerate) {
    return joined;
  }

  const isCoding = /lml coding generation policy/i.test(payload);
  const codingRequest = extractQuotedLine(payload, "User request") ?? "";
  if (mode === "chat_ontology" && isCoding) {
    if (isConcreteCodingRequest(codingRequest)) return "Generation unstable.";
    return "Coding is active. Give me one concrete build target and stack, and I will generate code.";
  }
  if (mode === "chat_ontology") {
    return "I’m tracking your request. Give me one concrete next action.";
  }
  return "Generation completed under active constraints.";
}

function hasNumericNarrativeDrift(text: string): boolean {
  if (!text) return false;
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length < 12) return false;
  const numericish = tokens.filter((token) => /[\d%/]/.test(token)).length;
  const ratio = numericish / tokens.length;
  return ratio > 0.2;
}

function buildCodingRetryPrompt(content: string, witness: Witness): string {
  const userRequest = extractQuotedLine(content, "User request") ?? "";
  const preferredLanguage = extractField(content, "Preferred language") ?? "typescript";
  const wantsTests = /\bwants_tests=yes\b/i.test(content) || /\b(test|tests|pytest|jest|vitest)\b/i.test(userRequest);
  const witnessSummary = witness.outcome === "NULL"
    ? `Outcome is NULL. Blocked reasons: ${(witness.explanation.blockedReasons ?? []).join(" | ") || "none"}.`
    : `Outcome is ADMISSIBLE. Accepted reasons: ${(witness.explanation.acceptedReasons ?? []).join(" | ") || "none"}.`;
  return [
    "You are GPT-2.",
    "Write code only.",
    witnessSummary,
    `Implement: ${userRequest}`,
    `Language: ${preferredLanguage}`,
    wantsTests ? "Include tests as second fenced block." : "No test block required unless requested.",
    "Output must start with a fenced code block and contain no prose.",
    "Assistant:",
  ].join("\n");
}

function buildCodingRepairPrompt(content: string, witness: Witness, reason: string, priorOutput: string): string {
  const userRequest = extractQuotedLine(content, "User request") ?? "";
  const preferredLanguage = extractField(content, "Preferred language") ?? "typescript";
  const witnessSummary = witness.outcome === "NULL"
    ? `Outcome is NULL. Blocked reasons: ${(witness.explanation.blockedReasons ?? []).join(" | ") || "none"}.`
    : `Outcome is ADMISSIBLE. Accepted reasons: ${(witness.explanation.acceptedReasons ?? []).join(" | ") || "none"}.`;
  const trimmedPrior = priorOutput.length > 800 ? `${priorOutput.slice(0, 800)}...` : priorOutput;
  return [
    "You are GPT-2.",
    "Repair the previous coding attempt.",
    witnessSummary,
    `Task: ${userRequest}`,
    `Language: ${preferredLanguage}`,
    `Failure reason: ${reason}`,
    "Return code only in fenced block(s). No prose.",
    "Previous output (for repair context):",
    trimmedPrior || "<empty>",
    "Assistant:",
  ].join("\n");
}

function isConcreteCodingRequest(text: string): boolean {
  const lower = text.toLowerCase();
  const action = /\b(build|write|implement|create|debug|refactor|generate)\b/.test(lower);
  const target = /\b(function|class|endpoint|api|service|validator|script|module|cli|fastapi|flask|express)\b/.test(lower);
  const language = /\b(python|typescript|javascript|go|golang|rust|java|c#|cpp|c\+\+)\b/.test(lower);
  return action && (target || language);
}

function extractQuotedLine(content: string, label: string): string | null {
  const pattern = new RegExp(`${escapeRegExp(label)}:\\s*\"([\\s\\S]*?)\"`, "i");
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

function extractField(content: string, label: string): string | null {
  const pattern = new RegExp(`${escapeRegExp(label)}:\\s*([^\\n]+)`, "i");
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDegenerateOutput(text: string): boolean {
  if (!text) return true;

  const lower = text.toLowerCase();
  if (/\(define-value|\(define-key|\)\s*\(define-value/.test(lower)) return true;
  if (text.includes("```") && text.length > 30) return false;
  if (/^[^a-zA-Z0-9]*$/.test(text)) return true;

  const tokens = lower
    .replace(/[^a-z0-9()\-_"\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length < 3) return true;

  const unique = new Set(tokens);
  const uniqueRatio = unique.size / tokens.length;
  if (tokens.length >= 20 && uniqueRatio < 0.35) return true;

  const repeatedRuns = /(.)\1{7,}/.test(lower);
  if (repeatedRuns) return true;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const key = `${tokens[i]} ${tokens[i + 1]}`;
    bigrams.set(key, (bigrams.get(key) ?? 0) + 1);
  }
  const maxBigram = Math.max(0, ...bigrams.values());
  if (tokens.length >= 16 && maxBigram >= 5) return true;

  return false;
}

function extractFencedBlock(text: string, language?: string): string | null {
  const pattern = language
    ? new RegExp("```" + escapeRegExp(language) + "\\n([\\s\\S]*?)```", "i")
    : /```[a-zA-Z0-9_+-]*\n([\s\S]*?)```/;
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}

function extractFencedBlocks(text: string, language: string): string[] {
  const pattern = new RegExp("```" + escapeRegExp(language) + "\\n([\\s\\S]*?)```", "gi");
  const out: string[] = [];
  let match = pattern.exec(text);
  while (match) {
    out.push((match[1] ?? "").trim());
    match = pattern.exec(text);
  }
  return out.filter(Boolean);
}

function looksLikeCode(text: string): boolean {
  if (text.includes("```")) return true;
  return /\b(def |class |import |from |return |if |for |while )/.test(text);
}

async function validatePythonCode(code: string): Promise<{ ok: boolean; error?: string }> {
  if (!code.trim()) return { ok: false, error: "empty_code" };
  const baseUrl = process.env.GPT2_PY_URL ?? "http://127.0.0.1:8009";
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/validate_python`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) return { ok: false, error: "validator_http_error" };
    const data = (await response.json()) as { ok?: boolean; error?: string };
    return { ok: Boolean(data.ok), error: data.error };
  } catch {
    return { ok: false, error: "validator_unreachable" };
  }
}

async function validatePythonRuntime(code: string, tests: string): Promise<{ ok: boolean; error?: string }> {
  if (!code.trim()) return { ok: false, error: "empty_code" };
  const baseUrl = process.env.GPT2_PY_URL ?? "http://127.0.0.1:8009";
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/validate_python_runtime`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, tests }),
    });
    if (!response.ok) return { ok: false, error: "runtime_validator_http_error" };
    const data = (await response.json()) as { ok?: boolean; error?: string };
    return { ok: Boolean(data.ok), error: data.error };
  } catch {
    return { ok: false, error: "runtime_validator_unreachable" };
  }
}

export async function evaluateCodingCandidate(
  candidate: string,
  preferredLanguage: string,
): Promise<{ ok: boolean; reason: string }> {
  if (!looksLikeCode(candidate)) {
    return { ok: false, reason: "output_does_not_look_like_code" };
  }

  if (preferredLanguage.includes("python")) {
    const pyBlocks = extractFencedBlocks(candidate, "python");
    const code = pyBlocks[0] ?? extractFencedBlock(candidate) ?? candidate;
    if (!code.trim()) {
      return { ok: false, reason: "missing_python_code_block" };
    }
    const syntaxResult = await validatePythonCode(code);
    if (!syntaxResult.ok) {
      return { ok: false, reason: `python_syntax_invalid: ${trimReason(syntaxResult.error)}` };
    }
    const tests = pyBlocks.length > 1 ? pyBlocks.slice(1).join("\n\n") : "";
    const runtimeResult = await validatePythonRuntime(code, tests);
    if (!runtimeResult.ok) {
      return { ok: false, reason: `python_runtime_invalid: ${trimReason(runtimeResult.error)}` };
    }
  }

  return { ok: true, reason: "ok" };
}

function scoreCodingCandidate(candidate: string, preferredLanguage: string, wantsTests: boolean): number {
  let score = 0;
  const language = preferredLanguage.includes("python") ? "python" : preferredLanguage;
  if (extractFencedBlock(candidate, language)) score += 4;
  if (extractFencedBlock(candidate)) score += 2;
  if (wantsTests && /(test_|pytest|assert )/.test(candidate.toLowerCase())) score += 3;
  if (candidate.length > 60) score += 1;
  return score;
}

function ensureFencedCodingOutput(text: string, preferredLanguage: string): string {
  const language = preferredLanguage.includes("python") ? "python" : preferredLanguage.trim().toLowerCase();
  if (extractFencedBlock(text, language) || extractFencedBlock(text)) {
    return text;
  }
  const cleaned = text.trim();
  if (!cleaned) {
    return text;
  }
  return `\`\`\`${language}\n${cleaned}\n\`\`\``;
}

function trimReason(value?: string): string {
  if (!value) return "unknown";
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 180 ? `${compact.slice(0, 180)}...` : compact;
}
